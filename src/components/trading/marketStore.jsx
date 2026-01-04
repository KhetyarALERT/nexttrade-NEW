/**
 * Centralized Market Data Store
 * Single source of truth for all market data
 * WebSocket feeds this store, components subscribe to it
 */

// WebSocket endpoints (PUBLIC - no auth)
// Using swap-market endpoint for better stability
const WS_FUTURES_URL = 'wss://open-api-swap.bingx.com/swap-market';

class MarketStore {
  constructor() {
    this.prices = {};           // { symbol: price }  // map of last prices used across UI
    this.tickers = {};          // { symbol: { price, change, high, low, volume } }
    this.candles = {};          // { symbol_interval: candle[] }
    this.subscribers = {};      // { event: callback[] }
    this.ws = null;
    this.subscriptions = new Set();
    this.connected = false;
    this.reconnectTimeout = null;
    this.lastTickerEmit = {}; // throttle map per symbol
    this.debugLoggedRaw = false;
    this.debugLoggedParsed = false;
    this.loggedFirstTicker = false;
  }

  // Subscribe to store events
  subscribe(event, callback) {
    if (!this.subscribers[event]) {
      this.subscribers[event] = [];
    }
    this.subscribers[event].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers[event] = this.subscribers[event].filter(cb => cb !== callback);
    };
  }

  // Emit event to subscribers
  emit(event, data) {
    if (this.subscribers[event]) {
      this.subscribers[event].forEach(cb => cb(data));
    }
  }

  // Update price
  updatePrice(symbol, price) {
    this.prices[symbol] = price;
    this.emit(`price:${symbol}`, price);
    this.emit('price', { symbol, price });
  }

  // Update ticker
  updateTicker(symbol, ticker) {
    this.tickers[symbol] = { ...this.tickers[symbol], ...ticker };
    this.emit(`ticker:${symbol}`, this.tickers[symbol]);
    this.emit('ticker', { symbol, ticker: this.tickers[symbol] });
  }

  // Get candle key
  getCandleKey(symbol, interval) {
    return `${symbol}_${interval}`;
  }

  // Set initial candles (from REST - called ONCE)
  setCandles(symbol, interval, candles) {
    const key = this.getCandleKey(symbol, interval);
    this.candles[key] = candles;
    this.emit(`candles:${key}`, candles);
    // Seed last price from REST preload for immediate UI display
    const last = Array.isArray(candles) && candles.length ? candles[candles.length - 1] : null;
    if (last?.close > 0) {
      this.updatePrice(symbol, last.close);
    }
  }

  // Update candle (from WebSocket)
  updateCandle(symbol, interval, candle) {
    const key = this.getCandleKey(symbol, interval);
    const candles = this.candles[key];
    
    if (!candles || candles.length === 0) return;
    
    const lastCandle = candles[candles.length - 1];
    
    if (candle.time === lastCandle.time) {
      // Update existing candle
      candles[candles.length - 1] = candle;
    } else if (candle.time > lastCandle.time) {
      // Append new candle
      candles.push(candle);
    }
    // NEVER insert older candles
    
    this.emit(`candle:${key}`, candle);
    this.updatePrice(symbol, candle.close);
  }

  // Get candles
  getCandles(symbol, interval) {
    return this.candles[this.getCandleKey(symbol, interval)] || [];
  }

  // Get price
  getPrice(symbol) {
    return this.prices[symbol] || 0;
  }

  // Get all tickers
  getAllTickers() {
    return this.tickers;
  }

  // Connect WebSocket
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    
    console.log(`[STORE] Connecting to ${WS_FUTURES_URL}`);
    this.ws = new WebSocket(WS_FUTURES_URL);
    
    this.ws.onopen = () => {
      console.log('[STORE] WebSocket connected');
      this.connected = true;
      this.emit('connected', true);
      
      // Resubscribe to all active subscriptions
      this.subscriptions.forEach(sub => {
        this.ws.send(JSON.stringify({
          id: `sub_${Date.now()}`,
          reqType: "sub",
          dataType: sub
        }));
      });
      
      // Start ping
      this.startPing();
    };
    
    this.ws.onmessage = async (event) => {
      try {
        let text = event.data;
        // Handle Blob data
        if (event.data instanceof Blob) {
          text = await event.data.text();
        }
        // Try to parse JSON message if possible
        let msg = null;
        try { msg = JSON.parse(text); } catch (_) {}
        // Ignore ping/pong responses from BingX
        if (msg && (msg.dataType === 'pong' || msg.ping || msg.reqType === 'pong')) return;
        if (text === 'Pong' || text === 'pong') return;
        if (msg) {
          this.handleMessage(msg);
        }
      } catch (e) {
        // Silently ignore parse errors
      }
    };
    
    this.ws.onclose = () => {
      console.log('[STORE] WebSocket disconnected');
      this.connected = false;
      this.emit('connected', false);
      this.stopPing();
      
      // Clear any existing heartbeat timeout
      if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);

      // Reconnect after 3 seconds
      this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
    };
    
    this.ws.onerror = (err) => {
      console.log('[STORE] WebSocket error');
    };
  }

  // Handle incoming WebSocket message
  handleMessage(msg) {
    this.resetHeartbeat(); // Reset watchdog on any valid message

    if (!msg.dataType || !msg.data) {
      if (!this.debugLoggedRaw) { try { console.log('[STORE] First WS message (unparsed):', msg); } catch(_) {} this.debugLoggedRaw = true; }
      return;
    }
    
    let channel, rawSymbol;
    if (typeof msg.dataType === 'string') {
      if (msg.dataType.includes('.')) {
        [channel, rawSymbol] = msg.dataType.split('.');
      } else if (msg.dataType.includes('@')) {
        [rawSymbol, channel] = msg.dataType.split('@');
      }
    }
    const symbol = String(rawSymbol || '').replace('[','').replace(']','').replace('/', '-').toUpperCase();
    if (!this.debugLoggedParsed && channel && symbol) { try { console.log('[STORE] First WS parsed:', msg.dataType, '->', channel, symbol); } catch(_) {} this.debugLoggedParsed = true; }
    
    if (channel?.startsWith('kline_')) {
      const interval = channel.replace('kline_', '');
      const k = msg.data;
      const candle = {
        time: Math.floor((k.T || k.t) / 1000),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v || 0)
      };
      this.updateCandle(symbol, interval, candle);
    }
    
    if (channel === 'trade') {
      const price = parseFloat(msg.data.p);
      if (price > 0) {
        this.updatePrice(symbol, price);
      }
    }
    
    if (channel === 'ticker') {
      const now = Date.now();
      const last = this.lastTickerEmit[symbol] || 0;
      const d = msg.data || {};
      const price = parseFloat(d.c ?? d.lastPrice ?? d.price ?? 0);
      const change = parseFloat(d.p ?? d.priceChangePercent ?? d.change ?? 0);
      const high = parseFloat(d.h ?? d.highPrice ?? d.high ?? 0);
      const low = parseFloat(d.l ?? d.lowPrice ?? d.low ?? 0);
      const volume = parseFloat(d.v ?? d.volume ?? 0);
      const mark = parseFloat(d.markPrice ?? d.mark ?? d.c ?? price);
      const ticker = { price, mark, change, high, low, volume };
      if (!this.loggedFirstTicker) { try { console.log('[STORE] First ticker received for', symbol, ticker); } catch(_) {} this.loggedFirstTicker = true; }
      this.tickers[symbol] = { ...this.tickers[symbol], ...ticker };
      if (!Number.isNaN(price) && price > 0) {
        this.updatePrice(symbol, price);
      }
      if (now - last >= 250) {
        this.lastTickerEmit[symbol] = now;
        this.emit(`ticker:${symbol}`, this.tickers[symbol]);
        this.emit('ticker', { symbol, ticker: this.tickers[symbol] });
      }
    }
  }

  // Subscribe to WebSocket channel
  subscribeWS(dataType) {
    this.subscriptions.add(dataType);
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        id: `sub_${Date.now()}`,
        reqType: "sub",
        dataType
      }));
      console.log(`[STORE] Subscribed: ${dataType}`);
    }
  }

  // Unsubscribe from WebSocket channel
  unsubscribeWS(dataType) {
    this.subscriptions.delete(dataType);
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        id: `unsub_${Date.now()}`,
        reqType: "unsub",
        dataType
      }));
    }
  }

  // Ping to keep connection alive
  startPing() {
    // Send JSON ping every 18s (BingX)
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ id: Date.now(), reqType: 'ping' }));
      }
    }, 20000);
    // Heartbeat watchdog
    this.resetHeartbeat();
  }

  resetHeartbeat() {
    if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
    
    this.heartbeatTimeout = setTimeout(() => {
      console.log('[STORE] No data received for 30s, reconnecting...');
      this.disconnect();
      this.connect();
    }, 30000);
  }

  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  // Subscribe to ticker channel for a symbol
  subscribeToTicker(symbol) {
    this.subscribeWS(`ticker.${symbol}`);
    this.subscribeWS(`ticker.[${symbol}]`);
  }

  // Convenience: subscribe to one symbol (ticker + trade)
  subscribeToSymbol(symbol) {
    this.subscribeWS(`ticker.${symbol}`);
    this.subscribeWS(`ticker.[${symbol}]`);
    this.subscribeWS(`trade.${symbol}`);
    this.subscribeWS(`trade.[${symbol}]`);
  }

  // Unsubscribe convenience for one symbol
  unsubscribeFromSymbol(symbol) {
    this.unsubscribeWS(`ticker.${symbol}`);
    this.unsubscribeWS(`ticker.[${symbol}]`);
    this.unsubscribeWS(`trade.${symbol}`);
    this.unsubscribeWS(`trade.[${symbol}]`);
  }

  // Subscribe to trade channel for a symbol
  subscribeToTrade(symbol) {
    this.subscribeWS(`trade.${symbol}`);
    this.subscribeWS(`trade.[${symbol}]`);
  }

  // Subscribe to candle channel for a symbol
  subscribeToCandles(symbol, interval = '1m') {
    this.subscribeWS(`kline_${interval}.${symbol}`);
    this.subscribeWS(`kline_${interval}.[${symbol}]`);
  }

  // Disconnect
  disconnect() {
    this.stopPing();
    if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Singleton instance
export const marketStore = new MarketStore();

// Auto-connect on import
marketStore.connect();