/**
 * BingX WebSocket Manager - Market Data ONLY (No Auth)
 * 
 * Spot: wss://open-api.bingx.com/market
 * Futures/Swap: wss://open-api-swap.bingx.com/market
 * 
 * Features:
 * - Public streams only
 * - Multi-symbol support
 * - Auto-reconnect with backoff
 * - Heartbeat (ping/pong)
 * - NO REST polling
 */

class BingXWebSocket {
  constructor(type = 'spot') {
    this.type = type; // 'spot' or 'futures'
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.subscriptions = new Set();
    this.pingInterval = null;
    this.connected = false;
    this.listeners = new Map();
    
    this.baseUrl = type === 'spot' 
      ? 'wss://open-api.bingx.com/market'
      : 'wss://open-api-swap.bingx.com/market';
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.baseUrl);

        this.ws.onopen = () => {
          console.log(`[BingX WS ${this.type}] Connected`);
          this.connected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          
          // Resubscribe to existing subscriptions
          this.subscriptions.forEach(sub => {
            this.ws.send(JSON.stringify(sub));
          });
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error(`[BingX WS ${this.type}] Error:`, error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log(`[BingX WS ${this.type}] Disconnected`);
          this.connected = false;
          this.stopHeartbeat();
          this.attemptReconnect();
        };
      } catch (error) {
        console.error(`[BingX WS ${this.type}] Connection failed:`, error);
        reject(error);
      }
    });
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      // Handle pong response
      if (message.pong) {
        return;
      }

      // Emit message to listeners
      const dataType = message.dataType || message.e;
      if (dataType && this.listeners.has(dataType)) {
        this.listeners.get(dataType).forEach(callback => callback(message));
      }
      
      // Emit to all listeners
      if (this.listeners.has('*')) {
        this.listeners.get('*').forEach(callback => callback(message));
      }
    } catch (error) {
      console.error(`[BingX WS ${this.type}] Parse error:`, error);
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ ping: Date.now() }));
      }
    }, 30000); // 30 seconds
  }

  stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[BingX WS ${this.type}] Max reconnect attempts reached`);
      return;
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000
    );
    
    console.log(`[BingX WS ${this.type}] Reconnecting in ${delay}ms...`);
    this.reconnectAttempts++;
    
    setTimeout(() => {
      this.connect().catch(console.error);
    }, delay);
  }

  /**
   * Subscribe to market data streams
   * @param {string} symbol - e.g., "BTC-USDT" for spot, "BTC-USDT" for futures
   * @param {string} dataType - e.g., "trade", "kline_1m", "ticker", "depth"
   */
  subscribe(symbol, dataType) {
    const subscription = {
      id: `${symbol}_${dataType}`,
      dataType: `${symbol}@${dataType}`
    };

    this.subscriptions.add(subscription);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        id: subscription.id,
        reqType: 'sub',
        dataType: subscription.dataType
      }));
    }
  }

  /**
   * Unsubscribe from market data
   */
  unsubscribe(symbol, dataType) {
    const id = `${symbol}_${dataType}`;
    const dataTypeStr = `${symbol}@${dataType}`;
    
    this.subscriptions.forEach(sub => {
      if (sub.id === id) {
        this.subscriptions.delete(sub);
      }
    });

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        id,
        reqType: 'unsub',
        dataType: dataTypeStr
      }));
    }
  }

  /**
   * Add event listener
   */
  on(dataType, callback) {
    if (!this.listeners.has(dataType)) {
      this.listeners.set(dataType, new Set());
    }
    this.listeners.get(dataType).add(callback);
  }

  /**
   * Remove event listener
   */
  off(dataType, callback) {
    if (this.listeners.has(dataType)) {
      this.listeners.get(dataType).delete(callback);
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.subscriptions.clear();
    this.listeners.clear();
  }

  isConnected() {
    return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

// Export for frontend use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BingXWebSocket;
}