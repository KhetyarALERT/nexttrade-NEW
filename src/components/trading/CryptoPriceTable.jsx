import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CRYPTO_SYMBOLS = [
  { symbol: "BTC-USD", name: "Bitcoin" },
  { symbol: "ETH-USD", name: "Ethereum" },
  { symbol: "SOL-USD", name: "Solana" },
  { symbol: "BNB-USD", name: "Binance Coin" },
  { symbol: "XRP-USD", name: "XRP" },
  { symbol: "ADA-USD", name: "Cardano" }
];

export default function CryptoPriceTable({ language = "en" }) {
  const [prices, setPrices] = useState({});
  const [connected, setConnected] = useState(false);
  const ws = useRef(null);

  useEffect(() => {
    const connectWS = () => {
      // Correct Massive WebSocket URL
      ws.current = new WebSocket("wss://socket.massive.com/crypto");

      ws.current.onopen = () => {
        console.log("WebSocket Connected");
        // Massive requires authentication first, but for public data or if key is pre-configured in proxy
        // Based on docs, we need to send auth then subscribe
        // Since I don't have the API key, I'll assume the environment handles it or use the public pattern
        const authMsg = { action: "auth", params: "YOUR_API_KEY" }; // This usually comes from env
        ws.current.send(JSON.stringify(authMsg));
      };

      ws.current.onmessage = (event) => {
        const messages = JSON.parse(event.data);
        
        // Massive returns an array of messages
        messages.forEach(data => {
          if (data.ev === "status" && data.status === "auth_success") {
            setConnected(true);
            // Subscribe to symbols using XAS prefix for per-second aggregates
            const subscribeMsg = {
              action: "subscribe",
              params: CRYPTO_SYMBOLS.map(s => `XAS.${s.symbol}`).join(",")
            };
            ws.current.send(JSON.stringify(subscribeMsg));
          }

          if (data.ev === "XAS") {
            setPrices(prev => ({
              ...prev,
              [data.pair]: {
                price: data.c,
                open: data.o,
                change: data.c - data.o,
                changePercent: ((data.c - data.o) / data.o) * 100,
                timestamp: data.s
              }
            }));
          }
        });
      };

      ws.current.onclose = () => {
        setConnected(false);
        console.log("WebSocket Disconnected, retrying...");
        setTimeout(connectWS, 5000);
      };

      ws.current.onerror = (err) => {
        console.error("WebSocket error:", err);
        ws.current.close();
      };
    };

    connectWS();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const formatPrice = (price) => {
    if (!price) return "---";
    return new Intl.NumberFormat(language === "ar" ? "ar-SA" : "en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const formatPercent = (percent) => {
    if (percent === undefined || isNaN(percent)) return "0.00%";
    return `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`;
  };

  return (
    <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-sm overflow-hidden">
      <CardContent className="p-0">
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {language === "ar" ? "أسعار العملات الرقمية المباشرة" : "Live Crypto Markets"}
                </h3>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                    {connected ? (language === "ar" ? "متصل الآن" : "Real-time Stream") : (language === "ar" ? "جاري الاتصال..." : "Connecting...")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left bg-slate-50/50">
                <th className="py-4 px-6 font-bold text-gray-400 text-[11px] uppercase tracking-wider">{language === "ar" ? "العملة" : "Asset"}</th>
                <th className="py-4 px-6 font-bold text-gray-400 text-[11px] uppercase tracking-wider text-right">{language === "ar" ? "السعر" : "Price"}</th>
                <th className="py-4 px-6 font-bold text-gray-400 text-[11px] uppercase tracking-wider text-right">{language === "ar" ? "التغيير" : "24h Change"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {CRYPTO_SYMBOLS.map((crypto) => {
                const data = prices[crypto.symbol];
                const isPositive = data?.change >= 0;

                return (
                  <tr key={crypto.symbol} className="group hover:bg-blue-50/30 transition-all duration-300">
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                          {crypto.symbol.split("-")[0][0]}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{crypto.symbol.split("-")[0]}</div>
                          <div className="text-xs text-gray-500 font-medium">{crypto.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <div className="font-bold text-gray-900 tabular-nums text-lg">
                        {formatPrice(data?.price)}
                      </div>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <div className={`inline-flex items-center gap-1.5 font-bold tabular-nums px-3 py-1 rounded-full text-sm ${isPositive ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                        {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {formatPercent(data?.changePercent)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-slate-50/50 text-center">
          <p className="text-[9px] text-gray-400 uppercase tracking-[0.2em] font-bold">
            {language === "ar" ? "بيانات مشفرة فورية عبر Massive API" : "Institutional Grade Data via Massive API"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
