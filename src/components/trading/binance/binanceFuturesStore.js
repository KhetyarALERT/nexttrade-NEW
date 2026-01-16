import { base44 } from "@/api/base44Client";
import { normalizeOkxSymbol } from "@/lib/market/okxSymbols";

const INTERVALS = /** @type {const} */ (["1m", "5m", "15m", "1H", "4H", "1D"]);

function normalizeSymbol(sym) {
  return normalizeOkxSymbol(sym);
}

function intervalToSeconds(interval) {
  switch (interval) {
    case "1m":
      return 60;
    case "5m":
      return 5 * 60;
    case "15m":
      return 15 * 60;
    case "1H":
      return 60 * 60;
    case "4H":
      return 4 * 60 * 60;
    case "1D":
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

    this.chartWs = null;
    this.activeChart = { symbol: "BTC-USDT-SWAP", interval: "1m" };
    this.chartReconnectAttempts = 0;
    this.chartReconnectTimer = null;
    this.chartPollTimer = null;

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
    if (this.chartPollTimer) clearInterval(this.chartPollTimer);
    this.chartPollTimer = null;
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
    return this.tickers.get(normalizeSymbol(symbol)) || null;
  }

  getPremiumIndex(symbol) {
    return this.premiumIndex.get(normalizeSymbol(symbol)) || null;
  }

  getCandles(symbol, interval) {
    return this.candles.get(this._candleKey(normalizeSymbol(symbol), interval)) || [];
  }

  setActiveChart(symbol, interval) {
    if (symbol) this.activeChart.symbol = normalizeSymbol(symbol);
    if (interval) this.activeChart.interval = interval;
  }

  async init() {
    await this.loadExchangeInfo();
    this.startTickerPolling(7000);
  }

  async loadExchangeInfo() {
    try {
      const res = await base44.functions.invoke("okxMarketData", { action: "listInstrumentsSwap" });
      const list = Array.isArray(res?.data?.data) ? res.data.data : [];
      const symbols = list
        .filter((s) => s?.instId && s?.state === "live")
        .filter((s) => s?.quoteCcy === "USDT")
        .map((s) => normalizeSymbol(s.instId))
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
        const res = await base44.functions.invoke("okxMarketData", { action: "getTickersSwap" });
        const data = Array.isArray(res?.data?.data) ? res.data.data : [];
        if (!data.length) return;

        // If exchangeInfo failed, derive symbols list from tickers
        if (!this.exchangeInfoLoaded && this.symbols.length === 0) {
          const derived = data
            .map((t) => normalizeSymbol(t?.instId || ""))
            .filter(Boolean);
          derived.sort((a, b) => a.localeCompare(b));
          this.symbols = derived;
          this.emit("symbols", derived);
        }

        const allowed = this.symbols.length ? new Set(this.symbols) : null;

        let anyChanged = false;
        for (const t of data) {
          const symbol = normalizeSymbol(t?.instId || "");
          if (!symbol) continue;
          if (allowed && !allowed.has(symbol)) continue;

          const lastPrice = toNumber(t?.last);
          const open24h = toNumber(t?.open24h);
          const priceChangePercent = open24h ? ((lastPrice - open24h) / open24h) * 100 : 0;
          const quoteVolume = toNumber(t?.volCcy24h);

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
    symbol = normalizeSymbol(symbol);
    const res = await base44.functions.invoke("okxMarketData", { action: "getMarkPrice", instId: symbol });
    const data = res?.data?.data || {};
    const markPrice = toNumber(data?.markPx);
    const indexPrice = toNumber(data?.idxPx || data?.markPx);
    const payload = { symbol, markPrice, indexPrice };
    this.premiumIndex.set(symbol, payload);
    this.emit(`premium:${symbol}`, payload);
    this.emit("premium", payload);
    return payload;
  }

  startPremiumPolling(symbol, intervalMs = 5000) {
    symbol = normalizeSymbol(symbol);
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
    symbol = normalizeSymbol(symbol);
    if (!INTERVALS.includes(interval)) throw new Error("Unsupported interval");

    const res = await base44.functions.invoke("okxMarketData", {
      action: "getCandles",
      instId: symbol,
      bar: interval,
      limit,
    });
    const candles = Array.isArray(res?.data?.data) ? res.data.data : [];

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
    const sym = normalizeSymbol(symbol || this.activeChart.symbol);
    const intv = interval || this.activeChart.interval;
    this.setActiveChart(sym, intv);

    this.closeChartWs();

    const poll = async () => {
      if (this._disposed) return;
      try {
        const candles = await this.fetchCandles(sym, intv, 500);
        const last = candles[candles.length - 1];
        if (last?.close) this.emit(`price:${sym}`, last.close);
      } catch {
        // ignore
      }
    };

    if (!seeded) {
      poll();
    }

    this.chartPollTimer = setInterval(poll, 5000);
    this.emit("chart:connected", { symbol: sym, interval: intv });
  }

  closeChartWs() {
    if (this.chartReconnectTimer) {
      clearTimeout(this.chartReconnectTimer);
      this.chartReconnectTimer = null;
    }

    if (this.chartPollTimer) {
      clearInterval(this.chartPollTimer);
      this.chartPollTimer = null;
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
    // no-op: polling handles reconnects
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
