/**
 * BingX WebSocket Client - Frontend Implementation
 * Handles real-time market data for Spot and Futures
 */

class BingXWebSocketClient {
  constructor(type = 'spot') {
    this.type = type;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.subscriptions = new Set();
    this.pingInterval = null;
    this.connected = false;
    this.listeners = new Map();
    
    // Use correct BingX WebSocket URLs - swap-market for better stability
    this.baseUrl = type === 'spot' 
      ? 'wss://open-api.bingx.com/market'
      : 'wss://open-api-swap.bingx.com/swap-market';
  }

  connect() {
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
      
      if (message.pong) return;

      const dataType = message.dataType || message.e;
      if (dataType && this.listeners.has(dataType)) {
        this.listeners.get(dataType).forEach(callback => callback(message));
      }
      
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
    }, 30000);
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
    
    this.reconnectAttempts++;
    setTimeout(() => this.connect().catch(console.error), delay);
  }

  subscribe(symbol, dataType) {
    const subscription = {
      id: `${symbol}_${dataType}`,
      reqType: 'sub',
      dataType: `${symbol}@${dataType}`
    };

    this.subscriptions.add(JSON.stringify(subscription));

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(subscription));
    }
  }

  unsubscribe(symbol, dataType) {
    const subscription = {
      id: `${symbol}_${dataType}`,
      reqType: 'unsub',
      dataType: `${symbol}@${dataType}`
    };

    this.subscriptions.forEach(sub => {
      if (sub.includes(`${symbol}_${dataType}`)) {
        this.subscriptions.delete(sub);
      }
    });

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(subscription));
    }
  }

  on(dataType, callback) {
    if (!this.listeners.has(dataType)) {
      this.listeners.set(dataType, new Set());
    }
    this.listeners.get(dataType).add(callback);
  }

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
  }

  isConnected() {
    return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

export default BingXWebSocketClient;