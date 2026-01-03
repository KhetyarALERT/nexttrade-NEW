/**
 * Centralized Market Data Store
 * Single source of truth for all market data
 * WebSocket feeds this store, components subscribe to it
 */

// WebSocket endpoints (PUBLIC - no auth)
const WS_FUTURES_URL = 'wss://open-api-swap.bingx.com/market';

class MarketStore {
  constructor() {
    this.prices = {};           // { symbol: price }
    this.tickers = {};          // { symbol: { price, change, high, low, volume } }
    this.candles = {};          // { symbol_interval: candle[] }
    this.subscribers = {};      // { event: callback[] }
    this.ws = null;
    this.subscriptions = new Set();
    this.connected = false;
    this.reconnectTimeout = null;
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
    
    this.ws.onmessage = (event) => {
      if (event.data === 'Pong') return;
      
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (e) {
        // Ignore parse errors
      }
    };
    
    this.ws.onclose = () => {
      console.log('[STORE] WebSocket disconnected');
      this.connected = false;
      this.emit('connected', false);
      this.stopPing();
      
      // Reconnect after 3 seconds
      this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
    };
    
    this.ws.onerror = (err) => {
      console.log('[STORE] WebSocket error');
    };
  }

  // Handle incoming WebSocket message
  handleMessage(msg) {
    if (!msg.dataType || !msg.data) return;
    
    const [symbol, channel] = msg.dataType.split('@');
    
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
      this.updateTicker(symbol, {
        price: parseFloat(msg.data.c),
        change: parseFloat(msg.data.p),
        high: parseFloat(msg.data.h),
        low: parseFloat(msg.data.l),
        volume: parseFloat(msg.data.v)
      });
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
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('Ping');
      }
    }, 20000);
  }

  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Disconnect
  disconnect() {
    this.stopPing();
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