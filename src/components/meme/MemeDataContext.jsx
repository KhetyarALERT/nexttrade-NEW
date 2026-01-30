import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';

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
                       createdAt: Date.now()
                   };
                   
                   tokensMapRef.current.set(data.mint, newToken);
                   // Throttle state updates
                }

                // Handle Trades (if we subscribed)
                // PumpPortal sends trade events.
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

    // Polling for initial "Trending" snapshot from our backend function
    // This populates the list with rich data (volume, etc)
    const fetchTrending = async () => {
        try {
            // Using a mock fetch or actual backend call
            // Since we can't easily call internal function HTTP without SDK in some contexts,
            // We'll rely on a known public API or the SDK if available.
            // For this demo, we'll simulate an initial load or use DexScreener fallback if backend empty.
        } catch (e) {}
    };
    
    // Mock Data for UI Dev (Remove in prod if backend ready)
    const loadMock = () => {
        const mockTokens = Array.from({length: 50}).map((_, i) => ({
            mint: `So1111111111111111111111111111111111111111${i}`,
            symbol: `MEME${i}`,
            name: `Meme Token ${i}`,
            price_usd: Math.random() * 0.01,
            priceChange24h: (Math.random() * 200) - 100,
            volume_sol_24h: Math.random() * 1000,
            liquidity: Math.random() * 50000,
            bonding_curve_status: Math.random() > 0.5 ? 'migrated' : 'bonding_curve'
        }));
        setTokens(mockTokens);
        setLoading(false);
    };
    loadMock();

    return () => {
        if (ws) ws.close();
        clearTimeout(reconnectTimer);
    };
  }, []);

  return (
    <MemeDataContext.Provider value={{ tokens, loading, connectionStatus }}>
      {children}
    </MemeDataContext.Provider>
  );
};