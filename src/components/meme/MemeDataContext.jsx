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
    
    // Connect to PumpPortal (Directly from client as per architecture decision)
    // Or use the backend function `functions/memeStream.js` if we can determine URL.
    // For reliability in this implementation, we'll use direct PumpPortal WSS 
    // but process data to match the backend structure logic.
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
            // We can subscribe to specific trades if we want, but for "Trending", 
            // new tokens are the most exciting part for this feed.
            // For general trending, we might fetch a snapshot first.
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // Handle New Token
                if (data.txType === 'create') {
                   const newToken = {
                       mint: data.mint,
                       symbol: data.symbol,
                       name: data.name,
                       image_url: data.uri, // URI often contains metadata json, but sometimes direct image. PumpPortal sends metadata URI. 
                       // Need to fetch metadata if uri is json. But for speed, we'll use placeholder or try to infer.
                       price_usd: 0, // Initial
                       volume_sol_24h: 0,
                       bonding_curve_status: 'bonding_curve',
                       priceChange24h: 0,
                       createdAt: Date.now(),
                       buys_5m: 0,
                       sells_5m: 0,
                       volume_5m: 0,
                       tx_count: 0
                   };
                   
                   tokensMapRef.current.set(data.mint, newToken);
                } else if (data.txType === 'trade') {
                    // Update rolling metrics
                    const token = tokensMapRef.current.get(data.mint);
                    if (token) {
                        const isBuy = data.isBuy;
                        const solAmount = data.solAmount;
                        
                        // Simple rolling update (in prod this should be windowed)
                        if (isBuy) token.buys_5m = (token.buys_5m || 0) + 1;
                        else token.sells_5m = (token.sells_5m || 0) + 1;
                        
                        token.volume_5m = (token.volume_5m || 0) + solAmount;
                        token.price_usd = data.marketCapSol * 200 / 1000000000; // Rough approx if solPrice 200, better to use data.vSolInBondingCurve
                        
                        // Ping update
                        token.lastTrade = Date.now();
                        tokensMapRef.current.set(data.mint, { ...token });
                    }
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
                     tokensMapRef.current.set(t.mint, {
                         ...t,
                         createdAt: new Date(t.last_trade_at || Date.now()).getTime()
                     });
                     mintsToSub.push(t.mint);
                 });
                 
                 // Subscribe to trades for initial tokens if connected
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
             // Convert map to array and sort by latest/volume
             // Optimization: Only update if size changed or significant updates? 
             // For now, simple conversion.
             const arr = Array.from(tokensMapRef.current.values());
             // Sort by creation or volume (trending)
             arr.sort((a, b) => b.createdAt - a.createdAt);
             
             setTokens(prev => {
                 // Simple ref check to avoid rerenders if length is same? 
                 // No, data inside might change.
                 return arr.slice(0, 1000); // Limit to 1000 tokens to prevent memory issues
             });
        }
    }, 1000); // Update UI every 1 second max

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