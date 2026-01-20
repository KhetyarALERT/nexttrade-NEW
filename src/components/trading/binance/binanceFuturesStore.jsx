/**
 * OKX-Based Futures Store
 * Handles candles, tickers, and price data via OKX API
 * Uses polling for real-time updates (no WebSocket needed for public data)
 */

import { base44 } from "@/api/base44Client";

export const INTERVALS = ["1m", "5m", "15m", "1H", "4H", "1D"];

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
    this.tickerPollInterval = null;
    this.pricePollInterval = null;
    this.chartWsActive = false;
    this.currentSymbol = null;
    this.currentInterval = null;
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

  // Fetch candles from OKX
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
        return candles;
      }
      
      console.warn("[binanceFuturesStore] Failed to fetch candles:", res?.data?.error);
      return [];
    } catch (err) {
      console.error("[binanceFuturesStore] fetchCandles error:", err);
      return [];
    }
  }

  // Fetch single ticker from OKX
  async fetchTicker(symbol) {
    const normalized = String(symbol || "").toUpperCase();
    
    try {
      const res = await base44.functions.invoke("okxMarketData", {
        action: "getTicker",
        instId: normalized
      });
      
      if (res?.data?.ok && res.data.data) {
        const ticker = res.data.data;
        this.tickers[normalized] = {
          symbol: normalized,
          lastPrice: ticker.last,
          priceChangePercent: ticker.priceChangePercent,
          highPrice: ticker.high24h,
          lowPrice: ticker.low24h,
          volume: ticker.vol24h,
          quoteVolume: ticker.volCcy24h,
        };
        
        // Emit price update
        this.emit(`price:${normalized}`, ticker.last);
        this.emit(`ticker:${normalized}`, this.tickers[normalized]);
        
        return this.tickers[normalized];
      }
      return null;
    } catch (err) {
      console.error("[binanceFuturesStore] fetchTicker error:", err);
      return null;
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
      console.error("[binanceFuturesStore] fetchPremiumIndex error:", err);
      return null;
    }
  }

  // Start ticker polling for background price updates
  startTickerPolling(intervalMs = 5000) {
    if (this.tickerPollInterval) return;
    
    const tick = async () => {
      if (this.currentSymbol) {
        await Promise.all([
          this.fetchTicker(this.currentSymbol),
          this.fetchPremiumIndex(this.currentSymbol)
        ]);
      }
    };
    
    tick(); // Initial fetch
    this.tickerPollInterval = setInterval(tick, intervalMs);
  }

  stopTickerPolling() {
    if (this.tickerPollInterval) {
      clearInterval(this.tickerPollInterval);
      this.tickerPollInterval = null;
    }
  }

  // Start price polling for chart
  startPricePoll(symbol, interval = "15m", pollIntervalMs = 3000) {
    this.stopPricePoll();
    
    const normalized = String(symbol || "").toUpperCase();
    this.currentSymbol = normalized;
    this.currentInterval = interval;
    
    const tick = async () => {
      // Fetch latest candle for updates
      try {
        const res = await base44.functions.invoke("okxMarketData", {
          action: "getCandles",
          instId: normalized,
          bar: intervalToOkxBar[interval] || "15m",
          limit: 2
        });
        
        if (res?.data?.ok && Array.isArray(res.data.data) && res.data.data.length > 0) {
          const latestCandle = res.data.data[res.data.data.length - 1];
          const key = `${normalized}_${interval}`;
          
          // Update or append candle
          const existing = this.candles[key];
          if (existing && existing.length > 0) {
            const lastExisting = existing[existing.length - 1];
            if (latestCandle.time === lastExisting.time) {
              // Update existing candle
              existing[existing.length - 1] = latestCandle;
            } else if (latestCandle.time > lastExisting.time) {
              // Append new candle
              existing.push(latestCandle);
            }
          }
          
          // Emit candle update
          this.emit(`candle:${key}`, latestCandle);
          
          // Emit price update
          if (latestCandle.close) {
            this.emit(`price:${normalized}`, latestCandle.close);
          }
        }
      } catch {}
      
      // Also fetch ticker for accurate price
      await this.fetchTicker(normalized);
    };
    
    this.pricePollInterval = setInterval(tick, pollIntervalMs);
  }

  stopPricePoll() {
    if (this.pricePollInterval) {
      clearInterval(this.pricePollInterval);
      this.pricePollInterval = null;
    }
  }

  stopPremiumPolling() {
    // Premium is fetched with ticker polling
  }

  // Connect chart streams (starts polling)
  connectChartStreams({ symbol, interval, seeded = false }) {
    this.chartWsActive = true;
    this.currentSymbol = String(symbol || "").toUpperCase();
    this.currentInterval = interval;
    
    // Start polling for real-time updates
    this.startPricePoll(this.currentSymbol, interval, 3000);
    this.startTickerPolling(5000);
  }

  // Close chart "WebSocket" (stops polling)
  closeChartWs() {
    this.chartWsActive = false;
    this.stopPricePoll();
  }
}

export const binanceFuturesStore = new BinanceFuturesStore();