/**
 * OKX-Based Futures Store
 * REST API for initial candle load, WebSocket for real-time updates
 * Pattern: Single REST call to seed data, then WebSocket pushes updates
 */

import { base44 } from "@/api/base44Client";

export const INTERVALS = ["1m", "5m", "15m", "1H", "4H", "1D"];

// OKX Public WebSocket endpoint
const OKX_WS_URL = "wss://ws.okx.com:8443/ws/v5/public";

// Map our intervals to OKX bar format
const intervalToOkxBar = {
  "1m": "1m",
  "5m": "5m", 
  "15m": "15m",
  "1H": "1H",
  "4H": "4H",
  "1D": "1D",
};

class BinanceFuturesStore {
  constructor() {
    this.tickers = {};
    this.candles = {};
    this.premiumIndex = {};
    this.subscribers = {};
    this.ws = null;
    this.wsConnected = false;
    this.currentSymbol = null;
    this.currentInterval = null;
    this.reconnectTimeout = null;
    this.pingInterval = null;
    this.subscriptions = new Set();
    this.reconnectAttempts = 0;
    this.debugLogged = false;
  }

  // Subscribe to events
  subscribe(event, callback) {
    if (!this.subscribers[event]) {
      this.subscribers[event] = [];
    }
    this.subscribers[event].push(callback);
    return () => {
      this.subscribers[event] = this.subscribers[event].filter(cb => cb !== callback);
    };
  }

  // Emit events
  emit(event, data) {
    if (this.subscribers[event]) {
      this.subscribers[event].forEach(cb => {
        try { cb(data); } catch {}
      });
    }
  }

  // Get ticker for symbol
  getTicker(symbol) {
    const normalized = String(symbol || "").toUpperCase();
    return this.tickers[normalized] || null;
  }

  // Get premium index for symbol
  getPremiumIndex(symbol) {
    const normalized = String(symbol || "").toUpperCase();
    return this.premiumIndex[normalized] || null;
  }

  // Fetch candles from OKX REST API (initial seed)
  async fetchCandles(symbol, interval = "15m", limit = 500) {
    const normalized = String(symbol || "").toUpperCase();
    const bar = intervalToOkxBar[interval] || "15m";
    
    try {
      const res = await base44.functions.invoke("okxMarketData", {
        action: "getCandles",
        instId: normalized,
        bar,
        limit
      });
      
      if (res?.data?.ok && Array.isArray(res.data.data)) {
        const candles = res.data.data;
        const key = `${normalized}_${interval}`;
        this.candles[key] = candles;
        console.log(`[OKX Store] Seeded ${candles.length} candles for ${key}`);
        return candles;
      }
      
      console.warn("[OKX Store] Failed to fetch candles:", res?.data?.error);
      return [];
    } catch (err) {
      console.error("[OKX Store] fetchCandles error:", err);
      return [];
    }
  }

  // Fetch premium index (mark price, funding rate)
  async fetchPremiumIndex(symbol) {
    const normalized = String(symbol || "").toUpperCase();
    
    try {
      const res = await base44.functions.invoke("okxMarketData", {
        action: "getPremiumIndex",
        instId: normalized
      });
      
      if (res?.data?.ok && res.data.data) {
        const data = res.data.data;
        this.premiumIndex[normalized] = data;
        this.emit(`premium:${normalized}`, data);
        return data;
      }
      return null;
    } catch (err) {
      console.error("[OKX Store] fetchPremiumIndex error:", err);
      return null;
    }
  }

  // Connect WebSocket
  connectWs() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    console.log("[OKX Store] Connecting WebSocket...");
    this.ws = new WebSocket(OKX_WS_URL);

    this.ws.onopen = () => {
      console.log("[OKX Store] WebSocket connected");
      this.wsConnected = true;
      this.reconnectAttempts = 0;
      this.emit("connected", true);

      // Resubscribe to all active channels
      this.subscriptions.forEach(sub => {
        this.sendSubscribe(sub);
      });

      // Start ping/pong
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch {}
    };

    this.ws.onclose = (evt) => {
      console.log("[OKX Store] WebSocket disconnected", evt?.code);
      this.wsConnected = false;
      this.emit("connected", false);
      this.stopPing();

      // Exponential backoff reconnect
      this.reconnectAttempts = Math.min(this.reconnectAttempts + 1, 5);
      const delays = [1000, 2000, 5000, 15000, 30000];
      const delay = delays[this.reconnectAttempts - 1] || 30000;
      console.log(`[OKX Store] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      this.reconnectTimeout = setTimeout(() => this.connectWs(), delay);
    };

    this.ws.onerror = (err) => {
      console.log("[OKX Store] WebSocket error");
    };
  }

  // Send subscription message
  sendSubscribe(channel) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    const msg = {
      op: "subscribe",
      args: [channel]
    };
    
    try {
      this.ws.send(JSON.stringify(msg));
      console.log("[OKX Store] Subscribed:", channel);
    } catch {}
  }

  // Send unsubscribe message
  sendUnsubscribe(channel) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    const msg = {
      op: "unsubscribe",
      args: [channel]
    };
    
    try {
      this.ws.send(JSON.stringify(msg));
    } catch {}
  }

  // Handle incoming WebSocket messages
  handleMessage(msg) {
    // Pong response
    if (msg.event === "pong" || msg.op === "pong") return;
    
    // Subscription confirmation
    if (msg.event === "subscribe" || msg.event === "unsubscribe") {
      if (!this.debugLogged) {
        console.log("[OKX Store] WS event:", msg.event, msg.arg);
        this.debugLogged = true;
      }
      return;
    }

    // Data push
    if (msg.arg && msg.data) {
      const channel = msg.arg.channel;
      const instId = msg.arg.instId;

      // Handle candle/kline data
      if (channel?.startsWith("candle")) {
        const interval = channel.replace("candle", "");
        const key = `${instId}_${interval}`;
        
        for (const d of msg.data) {
          const candle = {
            time: parseInt(d[0]) / 1000, // ms to seconds
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5]),
            volCcy: parseFloat(d[6])
          };

          // Update or append candle
          const existing = this.candles[key];
          if (existing && existing.length > 0) {
            const lastIdx = existing.length - 1;
            if (existing[lastIdx].time === candle.time) {
              existing[lastIdx] = candle;
            } else if (candle.time > existing[lastIdx].time) {
              existing.push(candle);
            }
          }

          // Emit candle update
          this.emit(`candle:${key}`, candle);

          // Emit price update
          if (candle.close > 0) {
            this.emit(`price:${instId}`, candle.close);
          }
        }
      }

      // Handle ticker data
      if (channel === "tickers") {
        for (const t of msg.data) {
          const symbol = t.instId;
          const price = parseFloat(t.last);
          const open24h = parseFloat(t.open24h || t.sodUtc0 || 0);
          const change = open24h > 0 ? ((price - open24h) / open24h) * 100 : 0;

          this.tickers[symbol] = {
            symbol,
            lastPrice: price,
            priceChangePercent: change.toFixed(2),
            highPrice: parseFloat(t.high24h),
            lowPrice: parseFloat(t.low24h),
            volume: parseFloat(t.vol24h),
            quoteVolume: parseFloat(t.volCcy24h),
          };

          this.emit(`price:${symbol}`, price);
          this.emit(`ticker:${symbol}`, this.tickers[symbol]);
        }
      }

      // Handle mark price data
      if (channel === "mark-price") {
        for (const d of msg.data) {
          const symbol = d.instId;
          const markPrice = parseFloat(d.markPx);
          
          if (!this.premiumIndex[symbol]) {
            this.premiumIndex[symbol] = {};
          }
          this.premiumIndex[symbol].markPrice = markPrice;
          this.emit(`premium:${symbol}`, this.premiumIndex[symbol]);
        }
      }
    }
  }

  // Start ping to keep connection alive
  startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send("ping");
      }
    }, 20000);
  }

  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Connect chart streams (REST seed + WebSocket live)
  connectChartStreams({ symbol, interval, seeded = false }) {
    const normalized = String(symbol || "").toUpperCase();
    this.currentSymbol = normalized;
    this.currentInterval = interval;

    // Connect WebSocket if not connected
    this.connectWs();

    // Subscribe to candle channel
    const okxBar = intervalToOkxBar[interval] || "15m";
    const candleChannel = { channel: `candle${okxBar}`, instId: normalized };
    const tickerChannel = { channel: "tickers", instId: normalized };
    const markChannel = { channel: "mark-price", instId: normalized };

    // Track subscriptions for reconnect
    this.subscriptions.add(candleChannel);
    this.subscriptions.add(tickerChannel);
    this.subscriptions.add(markChannel);

    // Send subscriptions
    this.sendSubscribe(candleChannel);
    this.sendSubscribe(tickerChannel);
    this.sendSubscribe(markChannel);

    // Fetch initial premium index
    this.fetchPremiumIndex(normalized);
  }

  // Close chart WebSocket
  closeChartWs() {
    this.stopPing();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Unsubscribe from channels
    this.subscriptions.forEach(sub => {
      this.sendUnsubscribe(sub);
    });
    this.subscriptions.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.wsConnected = false;
  }

  // Stop ticker polling (compatibility)
  stopTickerPolling() {}
  startTickerPolling() {}
  stopPremiumPolling() {}
}

export const binanceFuturesStore = new BinanceFuturesStore();