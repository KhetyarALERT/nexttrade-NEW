import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { base44 } from "@/api/base44Client";

const MemeDataContext = createContext(null);

export const useMemeData = () => useContext(MemeDataContext);

export const MemeDataProvider = ({ children }) => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  // Use a map for O(1) updates - persisted across renders
  const tokensMapRef = useRef(new Map());
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  // Fetch trending tokens from DexScreener API (reliable data source)
  const fetchTrendingTokens = useCallback(async () => {
    try {
      console.log('Fetching trending tokens from DexScreener...');
      const res = await base44.functions.invoke('memeTokens', { action: 'getTrending' });
      
      if (res.data?.ok && Array.isArray(res.data.data)) {
        const trendingTokens = res.data.data;
        console.log(`Received ${trendingTokens.length} trending tokens`);
        
        trendingTokens.forEach(t => {
          // Only update if we have real data (liquidity > 0)
          if (t.liquidity > 0 || t.market_cap > 0) {
            const existing = tokensMapRef.current.get(t.mint) || {};
            tokensMapRef.current.set(t.mint, {
              ...existing,
              ...t,
              // Ensure proper field mapping
              price: t.price_usd,
              lastUpdated: Date.now()
            });
          }
        });
        
        // Update state immediately after fetch
        updateTokensState();
        return trendingTokens.map(t => t.mint);
      }
      return [];
    } catch (e) {
      console.warn("Failed to fetch trending tokens:", e);
      return [];
    }
  }, []);

  // Update tokens state from map
  const updateTokensState = useCallback(() => {
    if (tokensMapRef.current.size > 0) {
      const arr = Array.from(tokensMapRef.current.values());
      
      // Filter: only show tokens with meaningful data
      // At minimum require liquidity > $100 OR market_cap > $1000 OR recent trades
      const filtered = arr.filter(t => {
        const hasLiquidity = (t.liquidity || 0) > 100;
        const hasMarketCap = (t.market_cap || 0) > 1000;
        const hasTrades = ((t.buys_5m || 0) + (t.sells_5m || 0)) > 0;
        const hasVolume = (t.volume24h || 0) > 0;
        return hasLiquidity || hasMarketCap || hasTrades || hasVolume;
      });
      
      // Sort by a combination of recency and activity
      filtered.sort((a, b) => {
        // Prioritize tokens with actual trading activity
        const aScore = (a.volume24h || 0) + (a.liquidity || 0) * 0.1;
        const bScore = (b.volume24h || 0) + (b.liquidity || 0) * 0.1;
        return bScore - aScore;
      });
      
      setTokens(filtered.slice(0, 200));
    }
  }, []);

  // WebSocket for real-time updates (supplement, not primary)
  const connectWebSocket = useCallback((mintsToSubscribe = []) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Already connected, just subscribe to new mints
      if (mintsToSubscribe.length > 0) {
        wsRef.current.send(JSON.stringify({
          method: "subscribeTokenTrade",
          keys: mintsToSubscribe
        }));
      }
      return;
    }

    setConnectionStatus('connecting');
    const ws = new WebSocket('wss://pumpportal.fun/api/data');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected to PumpPortal');
      setConnectionStatus('connected');
      
      // Subscribe to new tokens and migrations
      ws.send(JSON.stringify({ method: "subscribeNewToken" }));
      ws.send(JSON.stringify({ method: "subscribeMigration" }));
      
      // Subscribe to trades for existing tokens
      if (mintsToSubscribe.length > 0) {
        ws.send(JSON.stringify({
          method: "subscribeTokenTrade",
          keys: mintsToSubscribe.slice(0, 100) // Limit subscriptions
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.txType === 'create') {
          // New token - fetch full data from DexScreener after a delay
          // (give it time to appear on DEXes)
          setTimeout(async () => {
            try {
              const res = await base44.functions.invoke('memeTokens', { 
                action: 'getToken', 
                mint: data.mint 
              });
              if (res.data?.ok && res.data.data) {
                const t = res.data.data;
                if (t.liquidity > 100 || t.market_cap > 1000) {
                  tokensMapRef.current.set(t.mint, {
                    ...t,
                    price: t.price_usd,
                    lastUpdated: Date.now()
                  });
                }
              }
            } catch (e) {
              // Token might not be on DexScreener yet, that's ok
            }
          }, 5000);
        } 
        else if (data.txType === 'trade') {
          // Update existing token with trade data
          let token = tokensMapRef.current.get(data.mint);
          if (token) {
            const SOL_PRICE = 200;
            const isBuy = data.isBuy;
            const solAmount = data.solAmount || 0;
            
            // Update rolling stats
            token.buys_5m = (token.buys_5m || 0) + (isBuy ? 1 : 0);
            token.sells_5m = (token.sells_5m || 0) + (isBuy ? 0 : 1);
            
            // Update price from trade
            if (data.marketCapSol) {
              const newPrice = (data.marketCapSol * SOL_PRICE) / 1000000000;
              
              // Track price for 5m change
              const now = Date.now();
              if (!token.price5mAgo || !token.price5mAgoTime || (now - token.price5mAgoTime) > 300000) {
                token.price5mAgo = token.price_usd || newPrice;
                token.price5mAgoTime = now;
              }
              
              // Calculate 5m change
              if (token.price5mAgo > 0) {
                token.priceChange5m = ((newPrice - token.price5mAgo) / token.price5mAgo) * 100;
              }
              
              token.price_usd = newPrice;
              token.price = newPrice;
              token.market_cap = data.marketCapSol * SOL_PRICE;
            }
            
            token.lastTrade = Date.now();
            tokensMapRef.current.set(data.mint, { ...token });
          }
        }
      } catch (e) {
        console.error("WebSocket message error:", e);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnectionStatus('disconnected');
      // Reconnect after delay
      reconnectTimerRef.current = setTimeout(() => {
        const mints = Array.from(tokensMapRef.current.keys());
        connectWebSocket(mints);
      }, 5000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }, []);

  // Initial load and periodic refresh
  useEffect(() => {
    let mounted = true;
    let refreshInterval;

    const init = async () => {
      setLoading(true);
      
      // Fetch trending tokens first (reliable data)
      const mints = await fetchTrendingTokens();
      
      if (mounted) {
        setLoading(false);
        // Connect WebSocket for real-time updates
        connectWebSocket(mints);
      }
    };

    init();

    // Refresh trending data every 30 seconds
    refreshInterval = setInterval(() => {
      if (mounted) {
        fetchTrendingTokens();
      }
    }, 30000);

    // Update UI state every 2 seconds
    const uiInterval = setInterval(() => {
      if (mounted) {
        updateTokensState();
      }
    }, 2000);

    return () => {
      mounted = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      clearInterval(refreshInterval);
      clearInterval(uiInterval);
    };
  }, [fetchTrendingTokens, connectWebSocket, updateTokensState]);

  // Manual refresh function
  const refreshTokens = useCallback(async () => {
    setLoading(true);
    await fetchTrendingTokens();
    setLoading(false);
  }, [fetchTrendingTokens]);

  return (
    <MemeDataContext.Provider value={{ 
      tokens, 
      loading, 
      connectionStatus,
      refreshTokens 
    }}>
      {children}
    </MemeDataContext.Provider>
  );
};