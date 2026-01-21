/**
 * OKX Futures Store - Production Grade
 * Single WebSocket connection for all market data
 * REST API only for initial seed, then pure WebSocket updates
 */

import { base44 } from "@/api/base44Client";

export const INTERVALS = ["1m", "5m", "15m", "1H", "4H", "1D"];

// OKX Public WebSocket endpoints
const OKX_WS_PUBLIC = "wss://ws.okx.com:8443/ws/v5/public";
const OKX_WS_BUSINESS = "wss://ws.okx.com:8443/ws/v5/business";

// Map intervals to OKX bar format
const intervalToOkxBar = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1H": "1H",
  "4H": "4H",
  "1D": "1D",
};

class OKXFuturesStore {
  constructor() {
    // Market data
    this.tickers = {};
    this.candles = {};
    this.premiumIndex = {};
    
    // Event subscribers
    this.subscribers = {};
    
    // WebSocket state
    this.publicWs = null;
    this.businessWs = null;
    this.wsConnected = { public: false, business: false };
    
    // Current subscriptions
    this.currentSymbol = null;
    this.currentInterval = null;
    this.activeChannels = new Set();
    
    // Reconnect state
    this.reconnectTimeouts = { public: null, business: null };
    this.pingIntervals = { public: null, business: null };
    this.reconnectAttempts = { public: 0, business: 0 };
    
    // Cache control - prevent duplicate REST calls
    this.pendingFetches = new Map();
    this.lastFetchTime = new Map();
    this.FETCH_COOLDOWN = 60000; // 60 seconds minimum between REST calls - NO API SPAM
    
    // Singleton instance tracking
    this.initialized = false;
  }

  // ========== EVENT SYSTEM ==========
  subscribe(event, callback) {
    if (!this.subscribers[event]) {
      this.subscribers[event] = [];
    }
    this.subscribers[event].push(callback);
    return () => {
      this.subscribers[event] = this.subscribers[event].filter(cb => cb !== callback);
    };
  }

  emit(event, data) {
    const callbacks = this.subscribers[event];
    if (callbacks) {
      callbacks.forEach(cb => {
        try { cb(data); } catch (e) { console.warn('[Store] Event callback error:', e); }
      });
    }
  }

  // ========== GETTERS ==========
  getTicker(symbol) {
    const normalized = String(symbol || "").toUpperCase();
    return this.tickers[normalized] || null;
  }

  getPremiumIndex(symbol) {
    const normalized = String(symbol || "").toUpperCase();
    return this.premiumIndex[normalized] || null;
  }

  getCandles(symbol, interval) {
    const key = `${String(symbol || "").toUpperCase()}_${interval}`;
    return this.candles[key] || [];
  }

  // ========== REST API (Initial Seed Only) ==========
  async fetchCandles(symbol, interval = "15m", limit = 300) {
    const normalized = String(symbol || "").toUpperCase();
    const bar = intervalToOkxBar[interval] || "15m";
    const cacheKey = `candles_${normalized}_${bar}`;
    
    // Check cooldown to prevent API spam
    const lastFetch = this.lastFetchTime.get(cacheKey);
    if (lastFetch && Date.now() - lastFetch < this.FETCH_COOLDOWN) {
      const existing = this.candles[`${normalized}_${interval}`];
      if (existing?.length > 0) {
        console.log(`[OKX Store] Using cached candles for ${cacheKey}`);
        return existing;
      }
    }
    
    // Check if already fetching
    if (this.pendingFetches.has(cacheKey)) {
      return this.pendingFetches.get(cacheKey);
    }
    
    const fetchPromise = (async () => {
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
          this.lastFetchTime.set(cacheKey, Date.now());
          console.log(`[OKX Store] Fetched ${candles.length} candles for ${key}`);
          return candles;
        }
        
        console.warn("[OKX Store] Failed to fetch candles:", res?.data?.error);
        return this.candles[`${normalized}_${interval}`] || [];
      } catch (err) {
        console.error("[OKX Store] fetchCandles error:", err);
        return this.candles[`${normalized}_${interval}`] || [];
      } finally {
        this.pendingFetches.delete(cacheKey);
      }
    })();
    
    this.pendingFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  async fetchPremiumIndex(symbol) {
    const normalized = String(symbol || "").toUpperCase();
    const cacheKey = `premium_${normalized}`;
    
    // Check cooldown
    const lastFetch = this.lastFetchTime.get(cacheKey);
    if (lastFetch && Date.now() - lastFetch < this.FETCH_COOLDOWN) {
      const existing = this.premiumIndex[normalized];
      if (existing) return existing;
    }
    
    // Check if already fetching
    if (this.pendingFetches.has(cacheKey)) {
      return this.pendingFetches.get(cacheKey);
    }
    
    const fetchPromise = (async () => {
      try {
        const res = await base44.functions.invoke("okxMarketData", {
          action: "getPremiumIndex",
          instId: normalized
        });
        
        if (res?.data?.ok && res.data.data) {
          const data = res.data.data;
          this.premiumIndex[normalized] = data;
          this.lastFetchTime.set(cacheKey, Date.now());
          this.emit(`premium:${normalized}`, data);
          return data;
        }
        return this.premiumIndex[normalized] || null;
      } catch (err) {
        console.error("[OKX Store] fetchPremiumIndex error:", err);
        return this.premiumIndex[normalized] || null;
      } finally {
        this.pendingFetches.delete(cacheKey);
      }
    })();
    
    this.pendingFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  // ========== WEBSOCKET MANAGEMENT ==========
  connectPublicWs() {
    if (this.publicWs && (this.publicWs.readyState === WebSocket.OPEN || this.publicWs.readyState === WebSocket.CONNECTING)) {
      // Already connected or connecting
      if (this.publicWs.readyState === WebSocket.OPEN) {
        this.wsConnected.public = true;
        this.emit("ws:public:connected", true);
      }
      return;
    }

    console.log("[OKX Store] Connecting Public WebSocket...");
    this.publicWs = new WebSocket(OKX_WS_PUBLIC);

    this.publicWs.onopen = () => {
      console.log("[OKX Store] Public WebSocket connected");
      this.wsConnected.public = true;
      this.reconnectAttempts.public = 0;
      this.emit("ws:public:connected", true);
      this.startPing("public");
      this.resubscribeChannels("public");
    };

    this.publicWs.onmessage = (event) => {
      try {
        if (event.data === "pong") return;
        const msg = JSON.parse(event.data);
        this.handlePublicMessage(msg);
      } catch {}
    };

    this.publicWs.onclose = (evt) => {
      console.log("[OKX Store] Public WebSocket closed:", evt?.code);
      this.wsConnected.public = false;
      this.emit("ws:public:connected", false);
      this.stopPing("public");
      this.scheduleReconnect("public");
    };

    this.publicWs.onerror = () => {
      console.log("[OKX Store] Public WebSocket error");
    };
  }

  connectBusinessWs() {
    if (this.businessWs && (this.businessWs.readyState === WebSocket.OPEN || this.businessWs.readyState === WebSocket.CONNECTING)) {
      // Already connected or connecting
      if (this.businessWs.readyState === WebSocket.OPEN) {
        this.wsConnected.business = true;
        this.emit("ws:business:connected", true);
      }
      return;
    }

    console.log("[OKX Store] Connecting Business WebSocket...");
    this.businessWs = new WebSocket(OKX_WS_BUSINESS);

    this.businessWs.onopen = () => {
      console.log("[OKX Store] Business WebSocket connected");
      this.wsConnected.business = true;
      this.reconnectAttempts.business = 0;
      this.emit("ws:business:connected", true);
      this.startPing("business");
      this.resubscribeChannels("business");
    };

    this.businessWs.onmessage = (event) => {
      try {
        if (event.data === "pong") return;
        const msg = JSON.parse(event.data);
        this.handleBusinessMessage(msg);
      } catch {}
    };

    this.businessWs.onclose = (evt) => {
      console.log("[OKX Store] Business WebSocket closed:", evt?.code);
      this.wsConnected.business = false;
      this.emit("ws:business:connected", false);
      this.stopPing("business");
      this.scheduleReconnect("business");
    };

    this.businessWs.onerror = () => {
      console.log("[OKX Store] Business WebSocket error");
    };
  }

  scheduleReconnect(type) {
    if (this.reconnectTimeouts[type]) {
      clearTimeout(this.reconnectTimeouts[type]);
    }
    
    this.reconnectAttempts[type] = Math.min(this.reconnectAttempts[type] + 1, 5);
    const delays = [1000, 2000, 5000, 15000, 30000];
    const delay = delays[this.reconnectAttempts[type] - 1] || 30000;
    
    console.log(`[OKX Store] Reconnecting ${type} in ${delay}ms`);
    this.reconnectTimeouts[type] = setTimeout(() => {
      if (type === "public") this.connectPublicWs();
      else this.connectBusinessWs();
    }, delay);
  }

  startPing(type) {
    this.stopPing(type);
    this.pingIntervals[type] = setInterval(() => {
      const ws = type === "public" ? this.publicWs : this.businessWs;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      }
    }, 25000);
  }

  stopPing(type) {
    if (this.pingIntervals[type]) {
      clearInterval(this.pingIntervals[type]);
      this.pingIntervals[type] = null;
    }
  }

  // ========== CHANNEL SUBSCRIPTION ==========
  sendSubscribe(ws, channel) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    
    try {
      ws.send(JSON.stringify({ op: "subscribe", args: [channel] }));
      return true;
    } catch {
      return false;
    }
  }

  sendUnsubscribe(ws, channel) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    try {
      ws.send(JSON.stringify({ op: "unsubscribe", args: [channel] }));
    } catch {}
  }

  resubscribeChannels(type) {
    if (!this.currentSymbol) return;
    
    const symbol = this.currentSymbol;
    const interval = this.currentInterval || "15m";
    const okxBar = intervalToOkxBar[interval] || "15m";
    
    if (type === "public") {
      // Mark price and tickers on public endpoint
      this.sendSubscribe(this.publicWs, { channel: "mark-price", instId: symbol });
      this.sendSubscribe(this.publicWs, { channel: "tickers", instId: symbol });
    } else {
      // Candles on business endpoint
      this.sendSubscribe(this.businessWs, { channel: `candle${okxBar}`, instId: symbol });
    }
  }

  // ========== MESSAGE HANDLERS ==========
  handlePublicMessage(msg) {
    if (msg.event === "subscribe" || msg.event === "unsubscribe" || msg.event === "error") {
      return;
    }

    if (!msg.arg || !msg.data) return;

    const channel = msg.arg.channel;
    const instId = msg.arg.instId;

    // Mark price updates
    if (channel === "mark-price") {
      for (const d of msg.data) {
        const symbol = d.instId;
        const markPrice = parseFloat(d.markPx);
        
        if (!this.premiumIndex[symbol]) {
          this.premiumIndex[symbol] = {};
        }
        this.premiumIndex[symbol].markPrice = markPrice;
        this.premiumIndex[symbol].ts = d.ts;
        this.emit(`premium:${symbol}`, this.premiumIndex[symbol]);
        this.emit(`markPrice:${symbol}`, markPrice);
      }
    }

    // Ticker updates - PRIMARY SOURCE FOR REAL-TIME PRICES
    if (channel === "tickers") {
      for (const t of msg.data) {
        const symbol = t.instId;
        const price = parseFloat(t.last);
        const open24h = parseFloat(t.open24h || t.sodUtc0 || 0);
        const change = open24h > 0 ? ((price - open24h) / open24h) * 100 : 0;

        const prevPrice = this.tickers[symbol]?.lastPrice;
        
        this.tickers[symbol] = {
          symbol,
          lastPrice: price,
          priceChangePercent: change.toFixed(2),
          highPrice: parseFloat(t.high24h),
          lowPrice: parseFloat(t.low24h),
          volume: parseFloat(t.vol24h),
          quoteVolume: parseFloat(t.volCcy24h),
          bidPx: parseFloat(t.bidPx),
          askPx: parseFloat(t.askPx),
          ts: t.ts,
        };

        // Always emit price updates from WebSocket tickers - this is the primary real-time feed
        this.emit(`price:${symbol}`, price);
        this.emit(`ticker:${symbol}`, this.tickers[symbol]);
        
        // Log significant price changes for debugging
        if (prevPrice && Math.abs(price - prevPrice) > 0) {
          // Price changed - WebSocket is working
        }
      }
    }
  }

  handleBusinessMessage(msg) {
    if (msg.event === "subscribe" || msg.event === "unsubscribe" || msg.event === "error") {
      return;
    }

    if (!msg.arg || !msg.data) return;

    const channel = msg.arg.channel;
    const instId = msg.arg.instId;

    // Candle updates
    if (channel?.startsWith("candle")) {
      const interval = channel.replace("candle", "");
      const key = `${instId}_${interval}`;
      
      for (const d of msg.data) {
        const candle = {
          time: parseInt(d[0]) / 1000,
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
          volume: parseFloat(d[5]),
          volCcy: parseFloat(d[6]),
          confirm: d[8] === "1",
        };

        // Update candles array
        const existing = this.candles[key];
        if (existing && existing.length > 0) {
          const lastIdx = existing.length - 1;
          if (existing[lastIdx].time === candle.time) {
            existing[lastIdx] = candle;
          } else if (candle.time > existing[lastIdx].time) {
            existing.push(candle);
            // Keep last 500 candles
            if (existing.length > 500) {
              this.candles[key] = existing.slice(-500);
            }
          }
        }

        // Emit updates
        this.emit(`candle:${key}`, candle);
        
        // Also emit price from candle close
        if (candle.close > 0) {
          this.emit(`price:${instId}`, candle.close);
        }
      }
    }
  }

  // ========== MAIN CONNECT/DISCONNECT ==========
  connectChartStreams({ symbol, interval, seeded = false }) {
    const normalized = String(symbol || "").toUpperCase();
    
    // If symbol changed, clear old subscriptions
    if (this.currentSymbol && this.currentSymbol !== normalized) {
      this.unsubscribeFromSymbol(this.currentSymbol, this.currentInterval);
    }
    
    this.currentSymbol = normalized;
    this.currentInterval = interval;

    // Connect both WebSockets
    this.connectPublicWs();
    this.connectBusinessWs();

    // Subscribe to channels
    const okxBar = intervalToOkxBar[interval] || "15m";
    
    // Public channels: mark-price, tickers
    if (this.publicWs?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(this.publicWs, { channel: "mark-price", instId: normalized });
      this.sendSubscribe(this.publicWs, { channel: "tickers", instId: normalized });
    }
    
    // Business channels: candles
    if (this.businessWs?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(this.businessWs, { channel: `candle${okxBar}`, instId: normalized });
    }

    // Fetch premium index once (will be updated via WS)
    if (!seeded) {
      this.fetchPremiumIndex(normalized);
    }
  }

  unsubscribeFromSymbol(symbol, interval) {
    const okxBar = intervalToOkxBar[interval] || "15m";
    
    if (this.publicWs?.readyState === WebSocket.OPEN) {
      this.sendUnsubscribe(this.publicWs, { channel: "mark-price", instId: symbol });
      this.sendUnsubscribe(this.publicWs, { channel: "tickers", instId: symbol });
    }
    
    if (this.businessWs?.readyState === WebSocket.OPEN) {
      this.sendUnsubscribe(this.businessWs, { channel: `candle${okxBar}`, instId: symbol });
    }
  }

  closeChartWs() {
    // Clear reconnect timeouts
    if (this.reconnectTimeouts.public) clearTimeout(this.reconnectTimeouts.public);
    if (this.reconnectTimeouts.business) clearTimeout(this.reconnectTimeouts.business);
    this.reconnectTimeouts = { public: null, business: null };

    // Stop pings
    this.stopPing("public");
    this.stopPing("business");

    // Unsubscribe from current symbol
    if (this.currentSymbol) {
      this.unsubscribeFromSymbol(this.currentSymbol, this.currentInterval);
    }

    // Close WebSockets
    if (this.publicWs) {
      try { this.publicWs.close(); } catch {}
      this.publicWs = null;
    }
    if (this.businessWs) {
      try { this.businessWs.close(); } catch {}
      this.businessWs = null;
    }

    this.wsConnected = { public: false, business: false };
    this.currentSymbol = null;
    this.currentInterval = null;
  }

  // Compatibility methods
  startTickerPolling() {}
  stopTickerPolling() {}
  stopPremiumPolling() {}
}

export const binanceFuturesStore = new OKXFuturesStore();