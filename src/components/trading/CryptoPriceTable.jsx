import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity, RefreshCw } from "lucide-react";
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
      ws.current = new WebSocket("wss://massive.com/ws/crypto/aggregates-per-second");

      ws.current.onopen = () => {
        setConnected(true);
        // Subscribe to symbols
        const subscribeMsg = {
          action: "subscribe",
          params: CRYPTO_SYMBOLS.map(s => s.symbol).join(",")
        };
        ws.current.send(JSON.stringify(subscribeMsg));
      };

      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "aggregate") {
          setPrices(prev => ({
            ...prev,
            [data.symbol]: {
              price: data.close,
              change: data.close - data.open,
              changePercent: ((data.close - data.open) / data.open) * 100,
              timestamp: data.timestamp
            }
          }));
        }
      };

      ws.current.onclose = () => {
        setConnected(false);
        // Reconnect after 5 seconds
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
    if (percent === undefined) return "0.00%";
    return `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`;
  };

  return (
    <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {language === "ar" ? "أسعار العملات الرقمية المباشرة" : "Live Crypto Prices"}
              </h3>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                  {connected ? (language === "ar" ? "متصل" : "Live Connection") : (language === "ar" ? "جاري الاتصال..." : "Connecting...")}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-gray-50">
                <th className="pb-4 font-semibold text-gray-600 text-sm">{language === "ar" ? "العملة" : "Asset"}</th>
                <th className="pb-4 font-semibold text-gray-600 text-sm text-right">{language === "ar" ? "السعر" : "Price"}</th>
                <th className="pb-4 font-semibold text-gray-600 text-sm text-right">{language === "ar" ? "التغيير" : "24h Change"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {CRYPTO_SYMBOLS.map((crypto) => {
                const data = prices[crypto.symbol];
                const isPositive = data?.change >= 0;

                return (
                  <tr key={crypto.symbol} className="group hover:bg-gray-50/50 transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-600">
                          {crypto.symbol.split("-")[0][0]}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{crypto.symbol.split("-")[0]}</div>
                          <div className="text-xs text-gray-500">{crypto.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-right">
                      <div className="font-bold text-gray-900 tabular-nums">
                        {formatPrice(data?.price)}
                      </div>
                    </td>
                    <td className="py-4 text-right">
                      <div className={`inline-flex items-center gap-1 font-bold tabular-nums ${isPositive ? "text-green-500" : "text-red-500"}`}>
                        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {formatPercent(data?.changePercent)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-50 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">
            {language === "ar" ? "بيانات فورية عبر Massive API" : "Real-time data via Massive API"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
