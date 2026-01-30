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
                   const newToken = {
                       mint: data.mint,
                       symbol: data.symbol,
                       name: data.name,
                       image_url: data.uri, 
                       price_usd: 0,
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
                        token.price_usd = data.marketCapSol * 200 / 1000000000; // Rough approx if solPrice 200
                        
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
             // In dev/demo mode, we might not have backend data populated yet, 
             // so this gracefully handles empty responses.
             const res = await base44.functions.invoke('memeTrending', { limit: 100 });
             if (res.data?.ok && Array.isArray(res.data.data)) {
                 const initialTokens = res.data.data;
                 const mintsToSub = [];
                 initialTokens.forEach(t => {
                     tokensMapRef.current.set(t.mint, {
                         ...t,
                         createdAt: new Date(t.last_trade_at || Date.now()).getTime(),
                         buys_5m: t.buys_5m || 0,
                         sells_5m: t.sells_5m || 0,
                         volume_5m: t.volume_sol_5m || 0
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
             const arr = Array.from(tokensMapRef.current.values());
             // Sort by creation or volume (trending)
             // Prioritize recent volume + creation
             arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
             
             setTokens(prev => {
                 return arr.slice(0, 1000); 
             });
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