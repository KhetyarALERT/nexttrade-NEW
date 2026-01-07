const BINANCE_FAPI_REST = "https://fapi.binance.com";
const BINANCE_FAPI_WS = "wss://fstream.binance.com";

const INTERVALS = /** @type {const} */ (["1m", "5m", "15m", "1h", "4h", "1d"]);

function intervalToSeconds(interval) {
  switch (interval) {
    case "1m":
      return 60;
    case "5m":
      return 5 * 60;
    case "15m":
      return 15 * 60;
    case "1h":
      return 60 * 60;
    case "4h":
      return 4 * 60 * 60;
    case "1d":
      return 24 * 60 * 60;
    default:
      return 60;
  }
}

function toNumber(v) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseKlines(klines) {
  // Binance kline array:
  // [
  //  0 openTime, 1 open, 2 high, 3 low, 4 close, 5 volume,
  //  6 closeTime, 7 quoteAssetVolume, 8 numberOfTrades,
  //  9 takerBuyBaseAssetVolume, 10 takerBuyQuoteAssetVolume, 11 ignore
  // ]
  if (!Array.isArray(klines)) return [];
  return klines
    .map((k) => {
      if (!Array.isArray(k) || k.length < 6) return null;
      const time = Math.floor(toNumber(k[0]) / 1000);
      const open = toNumber(k[1]);
      const high = toNumber(k[2]);
      const low = toNumber(k[3]);
      const close = toNumber(k[4]);
      const volume = toNumber(k[5]);
      if (!time) return null;
      return { time, open, high, low, close, volume };
    })
    .filter(Boolean);
}

class BinanceFuturesStore {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.subscribers = new Map();

    /** @type {string[]} */
    this.symbols = [];

    /** @type {Map<string, {symbol: string, lastPrice: number, priceChangePercent: number, quoteVolume: number}>} */
    this.tickers = new Map();

    /** @type {Map<string, {symbol: string, markPrice: number, indexPrice: number}>} */
    this.premiumIndex = new Map();

    /** @type {Map<string, Array<{time:number, open:number, high:number, low:number, close:number, volume:number}>>} */
    this.candles = new Map();

    /** @type {WebSocket | null} */
    this.chartWs = null;
    this.activeChart = { symbol: "BTCUSDT", interval: "1m" };
    this.chartReconnectAttempts = 0;
    this.chartReconnectTimer = null;

    this.tickerPollTimer = null;
    this.premiumPollTimer = null;
    this.premiumSymbol = null;
    this.exchangeInfoLoaded = false;
    this._disposed = false;

    // Boot
    this.init().catch(() => {
      // Non-fatal
    });
  }

  dispose() {
    this._disposed = true;
    try {
      if (this.tickerPollTimer) clearInterval(this.tickerPollTimer);
    } catch {}
    this.tickerPollTimer = null;

    try {
      if (this.premiumPollTimer) clearInterval(this.premiumPollTimer);
    } catch {}
    this.premiumPollTimer = null;
    this.premiumSymbol = null;

    this.closeChartWs();
    this.subscribers.clear();
  }

  subscribe(event, cb) {
    if (!this.subscribers.has(event)) this.subscribers.set(event, new Set());
    this.subscribers.get(event).add(cb);
    return () => {
      try {
        this.subscribers.get(event)?.delete(cb);
      } catch {}
    };
  }

  emit(event, payload) {
    const subs = this.subscribers.get(event);
    if (!subs || subs.size === 0) return;
    subs.forEach((cb) => {
      try {
        cb(payload);
      } catch {
        // ignore subscriber errors
      }
    });
  }

  getSymbols() {
    return this.symbols;
  }

  getTicker(symbol) {
    return this.tickers.get(symbol) || null;
  }

  getPremiumIndex(symbol) {
    return this.premiumIndex.get(symbol) || null;
  }

  getCandles(symbol, interval) {
    return this.candles.get(this._candleKey(symbol, interval)) || [];
  }

  setActiveChart(symbol, interval) {
    if (symbol) this.activeChart.symbol = symbol;
    if (interval) this.activeChart.interval = interval;
  }

  async init() {
    await this.loadExchangeInfo();
    this.startTickerPolling(7000);
  }

  async loadExchangeInfo() {
    // Prefer exchangeInfo so we only show USDT-M perpetual TRADING pairs
    try {
      const url = `${BINANCE_FAPI_REST}/fapi/v1/exchangeInfo`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`exchangeInfo HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data?.symbols) ? data.symbols : [];
      const symbols = list
        .filter((s) => s?.status === "TRADING")
        .filter((s) => s?.contractType === "PERPETUAL")
        .filter((s) => s?.quoteAsset === "USDT")
        .map((s) => String(s.symbol))
        .filter(Boolean);

      // Stable order: by baseAsset, then symbol
      symbols.sort((a, b) => a.localeCompare(b));

      if (symbols.length) {
        this.symbols = symbols;
        this.exchangeInfoLoaded = true;
        this.emit("symbols", symbols);
      }
    } catch {
      // Fallback: we can still populate from ticker endpoint later
      this.exchangeInfoLoaded = false;
    }
  }

  startTickerPolling(intervalMs = 7000) {
    if (this.tickerPollTimer) return;

    const tick = async () => {
      if (this._disposed) return;
      try {
        const url = `${BINANCE_FAPI_REST}/fapi/v1/ticker/24hr`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`ticker24hr HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) return;

        // If exchangeInfo failed, derive symbols list from tickers
        if (!this.exchangeInfoLoaded && this.symbols.length === 0) {
          const derived = data
            .map((t) => String(t?.symbol || ""))
            .filter((s) => s.endsWith("USDT"))
            .filter(Boolean);
          derived.sort((a, b) => a.localeCompare(b));
          this.symbols = derived;
          this.emit("symbols", derived);
        }

        const allowed = this.symbols.length ? new Set(this.symbols) : null;

        let anyChanged = false;
        for (const t of data) {
          const symbol = String(t?.symbol || "");
          if (!symbol) continue;
          if (allowed && !allowed.has(symbol)) continue;

          const lastPrice = toNumber(t?.lastPrice);
          const priceChangePercent = toNumber(t?.priceChangePercent);
          const quoteVolume = toNumber(t?.quoteVolume);

          const prev = this.tickers.get(symbol);
          if (
            !prev ||
            prev.lastPrice !== lastPrice ||
            prev.priceChangePercent !== priceChangePercent ||
            prev.quoteVolume !== quoteVolume
          ) {
            this.tickers.set(symbol, { symbol, lastPrice, priceChangePercent, quoteVolume });
            this.emit(`ticker:${symbol}`, this.tickers.get(symbol));
            anyChanged = true;
          }
        }

        if (anyChanged) this.emit("tickers", this.tickers);
      } catch {
        // ignore; next poll will retry
      }
    };

    // Run immediately then interval
    tick();
    this.tickerPollTimer = setInterval(tick, intervalMs);
  }

  stopTickerPolling() {
    if (!this.tickerPollTimer) return;
    clearInterval(this.tickerPollTimer);
    this.tickerPollTimer = null;
  }

  async fetchPremiumIndex(symbol) {
    const url = new URL(`${BINANCE_FAPI_REST}/fapi/v1/premiumIndex`);
    url.searchParams.set("symbol", symbol);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`premiumIndex HTTP ${res.status}`);
    const data = await res.json();
    const markPrice = toNumber(data?.markPrice);
    const indexPrice = toNumber(data?.indexPrice);
    const payload = { symbol, markPrice, indexPrice };
    this.premiumIndex.set(symbol, payload);
    this.emit(`premium:${symbol}`, payload);
    this.emit("premium", payload);
    return payload;
  }

  startPremiumPolling(symbol, intervalMs = 5000) {
    if (!symbol) return;
    if (this.premiumSymbol === symbol && this.premiumPollTimer) return;

    this.stopPremiumPolling();
    this.premiumSymbol = symbol;

    const tick = async () => {
      if (this._disposed) return;
      if (!this.premiumSymbol) return;
      try {
        await this.fetchPremiumIndex(this.premiumSymbol);
      } catch {
        // ignore
      }
    };

    tick();
    this.premiumPollTimer = setInterval(tick, intervalMs);
  }

  stopPremiumPolling() {
    if (this.premiumPollTimer) {
      clearInterval(this.premiumPollTimer);
      this.premiumPollTimer = null;
    }
    this.premiumSymbol = null;
  }

  async fetchCandles(symbol, interval, limit = 500) {
    if (!INTERVALS.includes(interval)) throw new Error("Unsupported interval");

    const url = new URL(`${BINANCE_FAPI_REST}/fapi/v1/klines`);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", interval);
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`klines HTTP ${res.status}`);

    const data = await res.json();
    const candles = parseKlines(data);

    this.candles.set(this._candleKey(symbol, interval), candles);
    this.emit(`candles:${this._candleKey(symbol, interval)}`, candles);

    const last = candles[candles.length - 1];
    if (last?.close) this.emit(`price:${symbol}`, last.close);

    return candles;
  }

  /**
   * Open a single combined WebSocket for the active chart streams.
   * @param {{ symbol?: string, interval?: string, seeded?: boolean }} opts
   */
  connectChartStreams(opts = {}) {
    const { symbol, interval, seeded = true } = opts;
    const sym = symbol || this.activeChart.symbol;
    const intv = interval || this.activeChart.interval;
    this.setActiveChart(sym, intv);

    // Always switch streams cleanly
    this.closeChartWs();

    const streamKline = `${sym.toLowerCase()}@kline_${intv}`;
    const streamTrade = `${sym.toLowerCase()}@trade`;
    const wsUrl = `${BINANCE_FAPI_WS}/stream?streams=${streamKline}/${streamTrade}`;

    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      return;
    }

    this.chartWs = ws;
    this.chartReconnectAttempts = 0;

    ws.onopen = () => {
      // no-op: combined streams auto-subscribe
      this.emit("chart:connected", { symbol: sym, interval: intv });
      if (!seeded) {
        // safety: if caller forgot to seed, do it here
        this.fetchCandles(sym, intv, 500).catch(() => {});
      }
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        const payload = msg?.data ?? msg;
        if (!payload) return;

        // Kline
        if (payload.e === "kline" && payload.k) {
          const k = payload.k;
          const symbolMsg = String(payload?.s || k?.s || sym);
          const intervalMsg = String(k?.i || intv);
          const candle = {
            time: Math.floor(toNumber(k.t) / 1000),
            open: toNumber(k.o),
            high: toNumber(k.h),
            low: toNumber(k.l),
            close: toNumber(k.c),
            volume: toNumber(k.v),
            closed: Boolean(k.x),
          };

          this._upsertCandle(symbolMsg, intervalMsg, candle);
          return;
        }

        // Trade
        if (payload.e === "trade" || payload.e === "aggTrade") {
          const symbolMsg = String(payload?.s || sym);
          const price = toNumber(payload?.p);
          if (price > 0) this.emit(`price:${symbolMsg}`, price);
          return;
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      this.emit("chart:connected", { symbol: sym, interval: intv, connected: false });
      this._scheduleChartReconnect();
    };

    ws.onerror = () => {
      // Let onclose handle reconnect
    };
  }

  closeChartWs() {
    if (this.chartReconnectTimer) {
      clearTimeout(this.chartReconnectTimer);
      this.chartReconnectTimer = null;
    }

    if (this.chartWs) {
      try {
        this.chartWs.onopen = null;
        this.chartWs.onmessage = null;
        this.chartWs.onclose = null;
        this.chartWs.onerror = null;
        this.chartWs.close();
      } catch {}
      this.chartWs = null;
    }
  }

  _scheduleChartReconnect() {
    if (this._disposed) return;

    this.chartReconnectAttempts = Math.min(this.chartReconnectAttempts + 1, 6);
    const base = [500, 1000, 2000, 5000, 10000, 20000][this.chartReconnectAttempts - 1] || 20000;
    const jitter = Math.floor(base * 0.25 * Math.random());
    const delay = base + jitter;

    if (this.chartReconnectTimer) clearTimeout(this.chartReconnectTimer);
    this.chartReconnectTimer = setTimeout(async () => {
      const { symbol, interval } = this.activeChart;

      // Backfill before reconnect to avoid gaps
      try {
        await this.fetchCandles(symbol, interval, 500);
      } catch {}

      this.connectChartStreams({ symbol, interval, seeded: true });
    }, delay);
  }

  _candleKey(symbol, interval) {
    return `${symbol}_${interval}`;
  }

  _upsertCandle(symbol, interval, candle) {
    const key = this._candleKey(symbol, interval);
    const arr = this.candles.get(key) || [];
    const last = arr[arr.length - 1];

    const intervalSec = intervalToSeconds(interval);

    // If gap is detected, backfill once (async)
    if (last?.time && candle.time && candle.time > last.time + intervalSec * 2) {
      this.fetchCandles(symbol, interval, 500).catch(() => {});
      return;
    }

    if (!last) {
      this.candles.set(key, [{ ...candle }]);
      this.emit(`candles:${key}`, this.candles.get(key));
      this.emit(`candle:${key}`, candle);
      this.emit(`price:${symbol}`, candle.close);
      return;
    }

    if (candle.time === last.time) {
      arr[arr.length - 1] = { ...last, ...candle };
    } else if (candle.time > last.time) {
      arr.push({ ...candle });
      // Keep memory bounded
      if (arr.length > 520) arr.splice(0, arr.length - 520);
    } else {
      // Ignore out-of-order updates
      return;
    }

    this.candles.set(key, arr);
    this.emit(`candle:${key}`, candle);
    if (candle.closed) {
      this.emit(`candles:${key}`, arr);
    }
    if (candle.close) this.emit(`price:${symbol}`, candle.close);
  }
}

export const binanceFuturesStore = new BinanceFuturesStore();
export { INTERVALS };
