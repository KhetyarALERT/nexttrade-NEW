/**
 * OKX Futures Store - Production Grade WebSocket-First Architecture
 * 
 * STRATEGY: WebSocket PUSH for all real-time data
 * - REST API only for initial candle snapshot (once per symbol/interval)
 * - WebSocket provides: tickers (prices), mark prices, candle updates
 * - Single WebSocket connection per endpoint (public + business)
 * - Multiplex subscriptions over same connection
 */

import { base44 } from "@/api/base44Client";

export const INTERVALS = ["1m", "5m", "15m", "1H", "4H", "1D"];

// OKX WebSocket endpoints
const OKX_WS_PUBLIC = "wss://ws.okx.com:8443/ws/v5/public";
const OKX_WS_BUSINESS = "wss://ws.okx.com:8443/ws/v5/business";

// Map our intervals to OKX bar format
const intervalToOkxBar = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1H": "1H",
  "4H": "4H",
  "1D": "1D",
};

// Singleton flag - prevent multiple instances
let SINGLETON_CREATED = false;

class OKXFuturesStore {
  constructor() {
    // Enforce singleton
    if (SINGLETON_CREATED) {
      console.warn("[OKX Store] Singleton already exists, returning");
      return;
    }
    SINGLETON_CREATED = true;
    
    // ========== DATA STORES ==========
    this.tickers = {};        // symbol -> ticker data
    this.candles = {};        // "SYMBOL_interval" -> candle array
    this.premiumIndex = {};   // symbol -> mark/funding data
    
    // ========== EVENT SYSTEM ==========
    this.subscribers = {};    // event -> callback[]
    
    // ========== WEBSOCKET STATE ==========
    this.publicWs = null;
    this.businessWs = null;
    this.wsState = { 
      public: "disconnected",   // disconnected | connecting | connected
      business: "disconnected" 
    };
    
    // ========== SUBSCRIPTION TRACKING ==========
    this.currentSymbol = null;
    this.currentInterval = null;
    this.subscribedChannels = new Set(); // "public:tickers:BTC-USDT-SWAP"
    
    // ========== RECONNECT STATE ==========
    this.reconnectTimeouts = { public: null, business: null };
    this.reconnectAttempts = { public: 0, business: 0 };
    this.pingIntervals = { public: null, business: null };
    this.lastPong = { public: 0, business: 0 };
    
    // ========== REST API DEDUPE (snapshot only) ==========
    this.pendingFetches = new Map();   // cacheKey -> Promise
    this.snapshotLoaded = new Set();   // Track which snapshots we've loaded
    this.lastRestCall = 0;
    this.REST_MIN_INTERVAL = 3000;     // 3s between REST calls
    
    // ========== CONNECTION GUARDS ==========
    this.connectingPublic = false;
    this.connectingBusiness = false;
    
    console.log("[OKX Store] Singleton instance created");
  }

  // ==================== EVENT SYSTEM ====================
  subscribe(event, callback) {
    if (!this.subscribers[event]) {
      this.subscribers[event] = [];
    }
    this.subscribers[event].push(callback);
    
    return () => {
      const arr = this.subscribers[event];
      if (arr) {
        this.subscribers[event] = arr.filter(cb => cb !== callback);
      }
    };
  }

  emit(event, data) {
    const callbacks = this.subscribers[event];
    if (callbacks?.length) {
      for (const cb of callbacks) {
        try { cb(data); } catch (e) { /* ignore */ }
      }
    }
  }

  // ==================== GETTERS ====================
  getTicker(symbol) {
    return this.tickers[String(symbol || "").toUpperCase()] || null;
  }

  getPremiumIndex(symbol) {
    return this.premiumIndex[String(symbol || "").toUpperCase()] || null;
  }

  getCandles(symbol, interval) {
    const key = `${String(symbol || "").toUpperCase()}_${interval}`;
    return this.candles[key] || [];
  }

  // ==================== WEBSOCKET: PUBLIC ====================
  connectPublicWs() {
    // Guard: already connected or connecting
    if (this.wsState.public === "connected") {
      return;
    }
    if (this.connectingPublic) {
      return;
    }
    
    // Close any stale socket
    if (this.publicWs) {
      try { this.publicWs.close(); } catch {}
      this.publicWs = null;
    }
    
    this.connectingPublic = true;
    this.wsState.public = "connecting";
    this.emit("ws:public:state", "connecting");
    
    console.log("[OKX Store] Connecting Public WS...");
    
    try {
      this.publicWs = new WebSocket(OKX_WS_PUBLIC);
    } catch (err) {
      console.error("[OKX Store] Failed to create Public WS:", err);
      this.connectingPublic = false;
      this.wsState.public = "disconnected";
      this.scheduleReconnect("public");
      return;
    }

    this.publicWs.onopen = () => {
      console.log("[OKX Store] Public WS connected");
      this.connectingPublic = false;
      this.wsState.public = "connected";
      this.reconnectAttempts.public = 0;
      this.lastPong.public = Date.now();
      this.emit("ws:public:connected", true);
      this.emit("ws:public:state", "connected");
      this.startPing("public");
      
      // Resubscribe to channels after connection
      setTimeout(() => this.resubscribePublic(), 100);
    };

    this.publicWs.onmessage = (event) => {
      this.handlePublicMessage(event.data);
    };

    this.publicWs.onclose = (evt) => {
      console.log("[OKX Store] Public WS closed:", evt?.code, evt?.reason);
      this.connectingPublic = false;
      this.wsState.public = "disconnected";
      this.emit("ws:public:connected", false);
      this.emit("ws:public:state", "disconnected");
      this.stopPing("public");
      this.scheduleReconnect("public");
    };

    this.publicWs.onerror = (err) => {
      console.error("[OKX Store] Public WS error:", err);
    };
  }

  // ==================== WEBSOCKET: BUSINESS ====================
  connectBusinessWs() {
    // Guard: already connected or connecting
    if (this.wsState.business === "connected") {
      return;
    }
    if (this.connectingBusiness) {
      return;
    }
    
    // Close any stale socket
    if (this.businessWs) {
      try { this.businessWs.close(); } catch {}
      this.businessWs = null;
    }
    
    this.connectingBusiness = true;
    this.wsState.business = "connecting";
    this.emit("ws:business:state", "connecting");
    
    console.log("[OKX Store] Connecting Business WS...");
    
    try {
      this.businessWs = new WebSocket(OKX_WS_BUSINESS);
    } catch (err) {
      console.error("[OKX Store] Failed to create Business WS:", err);
      this.connectingBusiness = false;
      this.wsState.business = "disconnected";
      this.scheduleReconnect("business");
      return;
    }

    this.businessWs.onopen = () => {
      console.log("[OKX Store] Business WS connected");
      this.connectingBusiness = false;
      this.wsState.business = "connected";
      this.reconnectAttempts.business = 0;
      this.lastPong.business = Date.now();
      this.emit("ws:business:connected", true);
      this.emit("ws:business:state", "connected");
      this.startPing("business");
      
      // Resubscribe to channels after connection
      setTimeout(() => this.resubscribeBusiness(), 100);
    };

    this.businessWs.onmessage = (event) => {
      this.handleBusinessMessage(event.data);
    };

    this.businessWs.onclose = (evt) => {
      console.log("[OKX Store] Business WS closed:", evt?.code, evt?.reason);
      this.connectingBusiness = false;
      this.wsState.business = "disconnected";
      this.emit("ws:business:connected", false);
      this.emit("ws:business:state", "disconnected");
      this.stopPing("business");
      this.scheduleReconnect("business");
    };

    this.businessWs.onerror = (err) => {
      console.error("[OKX Store] Business WS error:", err);
    };
  }

  // ==================== PING/PONG HEARTBEAT ====================
  startPing(type) {
    this.stopPing(type);
    
    // OKX requires ping every 30s, we do 25s to be safe
    this.pingIntervals[type] = setInterval(() => {
      const ws = type === "public" ? this.publicWs : this.businessWs;
      if (ws?.readyState === WebSocket.OPEN) {
        try {
          ws.send("ping");
        } catch {}
      }
      
      // Check for stale connection (no pong in 60s)
      if (Date.now() - this.lastPong[type] > 60000) {
        console.warn(`[OKX Store] ${type} WS seems dead, forcing reconnect`);
        try { ws?.close(); } catch {}
      }
    }, 25000);
  }

  stopPing(type) {
    if (this.pingIntervals[type]) {
      clearInterval(this.pingIntervals[type]);
      this.pingIntervals[type] = null;
    }
  }

  // ==================== RECONNECT LOGIC ====================
  scheduleReconnect(type) {
    // Clear existing timeout
    if (this.reconnectTimeouts[type]) {
      clearTimeout(this.reconnectTimeouts[type]);
      this.reconnectTimeouts[type] = null;
    }
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    const attempt = Math.min(this.reconnectAttempts[type], 5);
    const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
    this.reconnectAttempts[type]++;
    
    console.log(`[OKX Store] Scheduling ${type} reconnect in ${delay}ms (attempt ${this.reconnectAttempts[type]})`);
    
    this.reconnectTimeouts[type] = setTimeout(() => {
      if (type === "public") {
        this.connectPublicWs();
      } else {
        this.connectBusinessWs();
      }
    }, delay);
  }

  // ==================== SUBSCRIPTION MANAGEMENT ====================
  sendSubscribe(type, channel) {
    const ws = type === "public" ? this.publicWs : this.businessWs;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    const channelKey = `${type}:${channel.channel}:${channel.instId}`;
    if (this.subscribedChannels.has(channelKey)) {
      return true; // Already subscribed
    }
    
    try {
      const msg = JSON.stringify({ op: "subscribe", args: [channel] });
      ws.send(msg);
      this.subscribedChannels.add(channelKey);
      console.log(`[OKX Store] Subscribed: ${channelKey}`);
      return true;
    } catch (err) {
      console.error(`[OKX Store] Subscribe failed:`, err);
      return false;
    }
  }

  sendUnsubscribe(type, channel) {
    const ws = type === "public" ? this.publicWs : this.businessWs;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const channelKey = `${type}:${channel.channel}:${channel.instId}`;
    this.subscribedChannels.delete(channelKey);
    
    try {
      const msg = JSON.stringify({ op: "unsubscribe", args: [channel] });
      ws.send(msg);
      console.log(`[OKX Store] Unsubscribed: ${channelKey}`);
    } catch {}
  }

  resubscribePublic() {
    if (!this.currentSymbol) return;
    if (this.wsState.public !== "connected") return;
    
    const symbol = this.currentSymbol;
    
    // Subscribe to tickers (primary price source)
    this.sendSubscribe("public", { channel: "tickers", instId: symbol });
    
    // Subscribe to mark price
    this.sendSubscribe("public", { channel: "mark-price", instId: symbol });
  }

  resubscribeBusiness() {
    if (!this.currentSymbol || !this.currentInterval) return;
    if (this.wsState.business !== "connected") return;
    
    const symbol = this.currentSymbol;
    const okxBar = intervalToOkxBar[this.currentInterval] || "15m";
    
    // Subscribe to candles
    this.sendSubscribe("business", { channel: `candle${okxBar}`, instId: symbol });
  }

  // ==================== MESSAGE HANDLERS ====================
  handlePublicMessage(raw) {
    // Handle pong
    if (raw === "pong") {
      this.lastPong.public = Date.now();
      return;
    }
    
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    
    // Handle subscribe/unsubscribe confirmations
    if (msg.event === "subscribe" || msg.event === "unsubscribe") {
      return;
    }
    
    // Handle errors
    if (msg.event === "error") {
      console.error("[OKX Store] Public WS error:", msg);
      return;
    }
    
    // Handle data messages
    if (!msg.arg || !msg.data) return;
    
    const channel = msg.arg.channel;
    
    // ===== TICKERS: Primary price source =====
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
          bidPx: parseFloat(t.bidPx),
          askPx: parseFloat(t.askPx),
          ts: t.ts,
        };
        
        // Emit price update (this drives chart/UI updates)
        this.emit(`price:${symbol}`, price);
        this.emit(`ticker:${symbol}`, this.tickers[symbol]);
      }
    }
    
    // ===== MARK PRICE =====
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
  }

  handleBusinessMessage(raw) {
    // Handle pong
    if (raw === "pong") {
      this.lastPong.business = Date.now();
      return;
    }
    
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    
    // Handle subscribe/unsubscribe confirmations
    if (msg.event === "subscribe" || msg.event === "unsubscribe") {
      return;
    }
    
    // Handle errors
    if (msg.event === "error") {
      console.error("[OKX Store] Business WS error:", msg);
      return;
    }
    
    // Handle data messages
    if (!msg.arg || !msg.data) return;
    
    const channel = msg.arg.channel;
    const instId = msg.arg.instId;
    
    // ===== CANDLES =====
    if (channel?.startsWith("candle")) {
      const interval = channel.replace("candle", "");
      const key = `${instId}_${interval}`;
      
      for (const d of msg.data) {
        const candle = {
          time: Math.floor(parseInt(d[0]) / 1000),
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
        if (existing?.length > 0) {
          const lastIdx = existing.length - 1;
          if (existing[lastIdx].time === candle.time) {
            // Update existing candle
            existing[lastIdx] = candle;
          } else if (candle.time > existing[lastIdx].time) {
            // New candle
            existing.push(candle);
            // Keep last 500 candles
            if (existing.length > 500) {
              this.candles[key] = existing.slice(-500);
            }
          }
        }
        
        // Emit candle update
        this.emit(`candle:${key}`, candle);
        
        // Also emit price from candle close (backup)
        if (candle.close > 0) {
          this.emit(`price:${instId}`, candle.close);
        }
      }
    }
  }

  // ==================== REST API: SNAPSHOT ONLY ====================
  async fetchCandles(symbol, interval = "15m", limit = 300) {
    const normalized = String(symbol || "").toUpperCase();
    const bar = intervalToOkxBar[interval] || "15m";
    const cacheKey = `candles_${normalized}_${bar}`;
    const dataKey = `${normalized}_${interval}`;
    
    // 1. Return cached if already loaded this session
    if (this.snapshotLoaded.has(cacheKey)) {
      const existing = this.candles[dataKey];
      if (existing?.length > 0) {
        return existing;
      }
    }
    
    // 2. Return in-flight promise if exists (dedupe)
    const pending = this.pendingFetches.get(cacheKey);
    if (pending) {
      return pending;
    }
    
    // 3. Create fetch promise
    const fetchPromise = (async () => {
      try {
        // Rate limit
        const elapsed = Date.now() - this.lastRestCall;
        if (elapsed < this.REST_MIN_INTERVAL) {
          await new Promise(r => setTimeout(r, this.REST_MIN_INTERVAL - elapsed));
        }
        this.lastRestCall = Date.now();
        
        console.log(`[OKX Store] REST: Fetching candles for ${normalized} ${bar}`);
        
        const res = await base44.functions.invoke("okxMarketData", {
          action: "getCandles",
          instId: normalized,
          bar,
          limit
        });
        
        if (res?.data?.ok && Array.isArray(res.data.data)) {
          const candles = res.data.data;
          this.candles[dataKey] = candles;
          this.snapshotLoaded.add(cacheKey);
          console.log(`[OKX Store] REST: Loaded ${candles.length} candles for ${cacheKey}`);
          return candles;
        }
        
        console.warn("[OKX Store] REST: Failed to fetch candles:", res?.data?.error);
        return this.candles[dataKey] || [];
      } catch (err) {
        console.error("[OKX Store] REST: fetchCandles error:", err);
        return this.candles[dataKey] || [];
      } finally {
        // Clear pending after delay
        setTimeout(() => this.pendingFetches.delete(cacheKey), 500);
      }
    })();
    
    this.pendingFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  async fetchPremiumIndex(symbol) {
    const normalized = String(symbol || "").toUpperCase();
    const cacheKey = `premium_${normalized}`;
    
    // 1. Return cached if exists
    if (this.snapshotLoaded.has(cacheKey)) {
      const existing = this.premiumIndex[normalized];
      if (existing) return existing;
    }
    
    // 2. Return in-flight promise
    const pending = this.pendingFetches.get(cacheKey);
    if (pending) {
      return pending;
    }
    
    // 3. Create fetch promise
    const fetchPromise = (async () => {
      try {
        // Rate limit
        const elapsed = Date.now() - this.lastRestCall;
        if (elapsed < this.REST_MIN_INTERVAL) {
          await new Promise(r => setTimeout(r, this.REST_MIN_INTERVAL - elapsed));
        }
        this.lastRestCall = Date.now();
        
        console.log(`[OKX Store] REST: Fetching premium for ${normalized}`);
        
        const res = await base44.functions.invoke("okxMarketData", {
          action: "getPremiumIndex",
          instId: normalized
        });
        
        if (res?.data?.ok && res.data.data) {
          const data = res.data.data;
          this.premiumIndex[normalized] = data;
          this.snapshotLoaded.add(cacheKey);
          this.emit(`premium:${normalized}`, data);
          return data;
        }
        return this.premiumIndex[normalized] || null;
      } catch (err) {
        console.error("[OKX Store] REST: fetchPremiumIndex error:", err);
        return this.premiumIndex[normalized] || null;
      } finally {
        setTimeout(() => this.pendingFetches.delete(cacheKey), 500);
      }
    })();
    
    this.pendingFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  // ==================== MAIN API ====================
  connectChartStreams({ symbol, interval, seeded = false }) {
    const normalized = String(symbol || "").toUpperCase();
    
    // If symbol changed, unsubscribe from old
    if (this.currentSymbol && this.currentSymbol !== normalized) {
      this.unsubscribeFromSymbol(this.currentSymbol, this.currentInterval);
    }
    
    // If interval changed, unsubscribe old candle channel
    if (this.currentSymbol === normalized && this.currentInterval !== interval) {
      const oldBar = intervalToOkxBar[this.currentInterval] || "15m";
      this.sendUnsubscribe("business", { channel: `candle${oldBar}`, instId: normalized });
      // Clear channel key
      this.subscribedChannels.delete(`business:candle${oldBar}:${normalized}`);
    }
    
    this.currentSymbol = normalized;
    this.currentInterval = interval;
    
    // Connect WebSockets (idempotent - won't duplicate)
    this.connectPublicWs();
    this.connectBusinessWs();
    
    // Subscribe after short delay (allow WS to connect)
    const doSubscribe = () => {
      this.resubscribePublic();
      this.resubscribeBusiness();
    };
    
    // Try immediately + retries
    doSubscribe();
    setTimeout(doSubscribe, 300);
    setTimeout(doSubscribe, 1000);
    
    // Fetch initial premium index (REST snapshot)
    if (!seeded && !this.snapshotLoaded.has(`premium_${normalized}`)) {
      this.fetchPremiumIndex(normalized);
    }
  }

  unsubscribeFromSymbol(symbol, interval) {
    const okxBar = intervalToOkxBar[interval] || "15m";
    
    this.sendUnsubscribe("public", { channel: "tickers", instId: symbol });
    this.sendUnsubscribe("public", { channel: "mark-price", instId: symbol });
    this.sendUnsubscribe("business", { channel: `candle${okxBar}`, instId: symbol });
  }

  closeChartWs() {
    // Clear reconnect timeouts
    if (this.reconnectTimeouts.public) {
      clearTimeout(this.reconnectTimeouts.public);
      this.reconnectTimeouts.public = null;
    }
    if (this.reconnectTimeouts.business) {
      clearTimeout(this.reconnectTimeouts.business);
      this.reconnectTimeouts.business = null;
    }
    
    // Stop pings
    this.stopPing("public");
    this.stopPing("business");
    
    // Unsubscribe from current symbol
    if (this.currentSymbol) {
      this.unsubscribeFromSymbol(this.currentSymbol, this.currentInterval);
    }
    
    // Close sockets
    if (this.publicWs) {
      try { this.publicWs.close(); } catch {}
      this.publicWs = null;
    }
    if (this.businessWs) {
      try { this.businessWs.close(); } catch {}
      this.businessWs = null;
    }
    
    // Reset state
    this.wsState = { public: "disconnected", business: "disconnected" };
    this.connectingPublic = false;
    this.connectingBusiness = false;
    this.subscribedChannels.clear();
    this.currentSymbol = null;
    this.currentInterval = null;
    
    this.emit("ws:public:connected", false);
    this.emit("ws:business:connected", false);
  }

  // Compatibility aliases
  get wsConnected() {
    return {
      public: this.wsState.public === "connected",
      business: this.wsState.business === "connected"
    };
  }
  
  startTickerPolling() {} // No-op, WS handles this
  stopTickerPolling() {}  // No-op
  stopPremiumPolling() {} // No-op
}

// Export singleton instance
export const binanceFuturesStore = new OKXFuturesStore();