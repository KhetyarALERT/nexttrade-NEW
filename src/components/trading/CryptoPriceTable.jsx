import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

const CRYPTO_SYMBOLS = [
  { display: "BTC-USD", name: "Bitcoin", binance: "btcusdt" },
  { display: "ETH-USD", name: "Ethereum", binance: "ethusdt" },
  { display: "SOL-USD", name: "Solana", binance: "solusdt" },
  { display: "BNB-USD", name: "Binance Coin", binance: "bnbusdt" },
  { display: "XRP-USD", name: "XRP", binance: "xrpusdt" },
  { display: "ADA-USD", name: "Cardano", binance: "adausdt" }
];

export default function CryptoPriceTable({ language = "en" }) {
  const [prices, setPrices] = useState({});
  const [connected, setConnected] = useState(false);
  const ws = useRef(null);

  useEffect(() => {
    const streams = CRYPTO_SYMBOLS.map(s => `${s.binance}@ticker`).join('/');
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    const connectWS = () => {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log("Binance WS Connected");
        setConnected(true);
      };

      ws.current.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.stream && msg.data) {
          const binanceSymbol = msg.stream.split('@')[0].toUpperCase();
          const displaySymbol = binanceSymbol.replace('USDT', '-USD');
          const d = msg.data;

          setPrices(prev => ({
            ...prev,
            [displaySymbol]: {
              price: parseFloat(d.c),
              open: parseFloat(d.o),
              change: parseFloat(d.p),
              changePercent: parseFloat(d.P),
              timestamp: d.E
            }
          }));
        }
      };

      ws.current.onclose = () => {
        setConnected(false);
        console.log("Binance WS Disconnected – reconnecting...");
        setTimeout(connectWS, 3000);
      };

      ws.current.onerror = (err) => {
        console.error("Binance WS error:", err);
      };
    };

    connectWS();

    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const formatPrice = (price) => {
    if (!price) return "---";
    return new Intl.NumberFormat(language === "ar" ? "ar-SA" : "en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: price < 1 ? 6 : 2
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
                <th className="py-4 px-6 font-bold text-gray-400 text-[11px] uppercase tracking-wider text-right">{language === "ar" ? "التغيير 24س" : "24h Change"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {CRYPTO_SYMBOLS.map((crypto) => {
                const data = prices[crypto.display];
                const isPositive = data?.changePercent >= 0;

                return (
                  <tr key={crypto.display} className="group hover:bg-blue-50/30 transition-all duration-300">
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                          {crypto.display.split("-")[0][0]}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{crypto.display.split("-")[0]}</div>
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
            {language === "ar" ? "بيانات فورية عبر Binance WebSocket" : "Real-time Data via Binance WebSocket"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}