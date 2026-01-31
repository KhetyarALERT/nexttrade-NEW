import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { base44 } from "@/api/base44Client";

const MemeDataContext = createContext(null);

export const useMemeData = () => useContext(MemeDataContext);

export const MemeDataProvider = ({ children }) => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  // Use a map for O(1) updates
  const tokensMapRef = useRef(new Map());

  // WebSocket Connection
  useEffect(() => {
    let ws;
    let reconnectTimer;
    
    const connect = () => {
        setConnectionStatus('connecting');
        ws = new WebSocket('wss://pumpportal.fun/api/data');

        ws.onopen = () => {
            console.log('Connected to PumpPortal Feed');
            setConnectionStatus('connected');
            setLoading(false);
            
            // Subscribe
            ws.send(JSON.stringify({ method: "subscribeNewToken" }));
            ws.send(JSON.stringify({ method: "subscribeMigration" }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // Handle New Token
                if (data.txType === 'create') {
                   // UPSERT - Check if exists first to avoid overwriting accumulation
                   const existing = tokensMapRef.current.get(data.mint) || {};
                   
                   const newToken = {
                       ...existing, // Keep existing stats if any
                       mint: data.mint,
                       symbol: data.symbol,
                       name: data.name,
                       image_url: data.uri, 
                       // Only overwrite if 0/missing, otherwise keep current price from trades
                       price: existing.price || 0,
                       price_usd: existing.price_usd || 0,
                       market_cap: existing.market_cap || 0,
                       liquidity: existing.liquidity || 0,
                       volume24h: existing.volume24h || 0,
                       holders: existing.holders || 0,
                       volume_sol_24h: existing.volume_sol_24h || 0,
                       bonding_curve_status: 'bonding_curve',
                       priceChange24h: existing.priceChange24h || 0,
                       createdAt: Date.now(), // New creation event = now
                       buys_5m: existing.buys_5m || 0,
                       sells_5m: existing.sells_5m || 0,
                       volume_5m: existing.volume_5m || 0,
                       tx_count: existing.tx_count || 0
                   };
                   
                   tokensMapRef.current.set(data.mint, newToken);
                } else if (data.txType === 'trade') {
                    // Update rolling metrics
                    let token = tokensMapRef.current.get(data.mint);
                    
                    // If trade comes before create event, init a skeleton
                    if (!token) {
                        token = {
                            mint: data.mint,
                            symbol: 'Unknown', // Will fill on create/fetch
                            name: 'Unknown Token',
                            image_url: '',
                            createdAt: Date.now(),
                            bonding_curve_status: 'bonding_curve'
                        };
                    }

                    const isBuy = data.isBuy;
                    const solAmount = data.solAmount;
                    const SOL_PRICE = 200; // Hardcoded for stability
                    
                    // Update rolling stats
                    token.buys_5m = (token.buys_5m || 0) + (isBuy ? 1 : 0);
                    token.sells_5m = (token.sells_5m || 0) + (isBuy ? 0 : 1);
                    token.volume_5m = (token.volume_5m || 0) + solAmount;
                    
                    // Update price and market cap
                    // Pump.fun emits marketCapSol
                    const priceUsd = (data.marketCapSol * SOL_PRICE) / 1000000000;
                    token.price_usd = priceUsd;
                    token.price = priceUsd; // Map to 'price' for UI
                    token.market_cap = data.marketCapSol * SOL_PRICE;
                    
                    // Estimate liquidity (virtual bonding curve liquidity ~15% of mcap)
                    token.liquidity = token.market_cap * 0.15; 
                    
                    // Update 24h volume (accumulate)
                    token.volume_sol_24h = (token.volume_sol_24h || 0) + solAmount;
                    token.volume24h = token.volume_sol_24h * SOL_PRICE;

                    // Ping update
                    token.lastTrade = Date.now();
                    tokensMapRef.current.set(data.mint, { ...token });
                }
            } catch (e) {
                console.error("WSS Error", e);
            }
        };

        ws.onclose = () => {
            setConnectionStatus('disconnected');
            reconnectTimer = setTimeout(connect, 3000);
        };
    };

    connect();

    // Initial Fetch of Trending Data
    const fetchInitialData = async () => {
        try {
             const res = await base44.functions.invoke('memeTrending', { limit: 100 });
             if (res.data?.ok && Array.isArray(res.data.data)) {
                 const initialTokens = res.data.data;
                 const mintsToSub = [];
                 initialTokens.forEach(t => {
                     const SOL_PRICE = 200; // Hardcoded for consistency as requested
                     const price = t.price_usd || 0;
                     const volume24h = (t.volume_sol_24h || 0) * SOL_PRICE;
                     
                     // Upsert: merge with existing if any
                     const existing = tokensMapRef.current.get(t.mint) || {};
                     
                     tokensMapRef.current.set(t.mint, {
                         ...existing,
                         ...t,
                         mint: t.mint, // Ensure mint is set
                         price: price,
                         market_cap: price * 1000000000, 
                         liquidity: (price * 1000000000) * 0.15,
                         volume24h: volume24h,
                         holders: t.holders || 0,
                         createdAt: new Date(t.last_trade_at || Date.now()).getTime(),
                         // Ensure stats object exists or map flat fields
                         stats: {
                             buys_5m: t.buys_5m || 0,
                             sells_5m: t.sells_5m || 0,
                             volume_5m: t.volume_sol_5m || 0,
                             ...existing.stats
                         },
                         // Flattened for easy UI access as well, or migrate UI to use stats.
                         buys_5m: t.buys_5m || 0,
                         sells_5m: t.sells_5m || 0,
                         volume_5m: t.volume_sol_5m || 0
                     });
                     mintsToSub.push(t.mint);
                 });
                 
                 if (ws && ws.readyState === WebSocket.OPEN && mintsToSub.length > 0) {
                     ws.send(JSON.stringify({
                         method: "subscribeTokenTrade",
                         keys: mintsToSub
                     }));
                 }
             }
        } catch (e) {
             console.warn("Initial fetch failed, relying on live feed", e);
        }
    };
    fetchInitialData();

    // Throttled State Update (Interval)
    const interval = setInterval(() => {
        if (tokensMapRef.current.size > 0) {
             const arr = Array.from(tokensMapRef.current.values());
             // Dedupe is inherent in Map, but ensure we don't have multiple entries with same mint in array
             // Sort by recency/trending
             arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
             
             // Update state only if changed significantly or just periodically
             setTokens(arr.slice(0, 1000));
        }
    }, 1000); 

    return () => {
        if (ws) ws.close();
        clearTimeout(reconnectTimer);
        clearInterval(interval);
    };
  }, []);

  return (
    <MemeDataContext.Provider value={{ tokens, loading, connectionStatus }}>
      {children}
    </MemeDataContext.Provider>
  );
};