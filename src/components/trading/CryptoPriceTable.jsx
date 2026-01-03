import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import nextTradeLogo from "@/assets/nexttrade-logo.png";

const COINS = [
  { id: "bitcoin", binance: "btcusdt" },
  { id: "ethereum", binance: "ethusdt" },
  { id: "solana", binance: "solusdt" },
  { id: "dogecoin", binance: "dogeusdt" },
  { id: "pepe", binance: "pepeusdt" },
  { id: "binance-coin", binance: "bnbusdt" },
  { id: "ripple", binance: "xrpusdt" },
  { id: "cardano", binance: "adausdt" },
  // add more if needed
];

const Sparkline = ({ data = [], width = 120, height = 40 }) => {
  if (!data || data.length < 2) return <div className="w-[120px] h-[40px] bg-gray-800/50 rounded" />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  const isUp = data[data.length - 1] >= data[0];
  const stroke = isUp ? "#22c55e" : "#ef4444";
  const fill = isUp ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polygon fill={fill} points={`0,${height} ${points} ${width},${height}`} />
      <polyline fill="none" stroke={stroke} strokeWidth="2" points={points} />
    </svg>
  );
};

export default function CryptoPriceTable({ language = "en" }) {
  const [marketData, setMarketData] = useState([]);
  const [connected, setConnected] = useState(false);
  const ws = useRef(null);

  useEffect(() => {
    // Initial fetch from CoinGecko
    const fetchInitial = async () => {
      const ids = COINS.map(c => c.id).join(",");
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`
        );
        if (res.ok) {
          const data = await res.json();
          const mapped = data.map(coin => ({
            ...coin,
            binanceSymbol: COINS.find(c => c.id === coin.id)?.binance || null
          }));
          setMarketData(mapped);
        }
      } catch (err) {
        console.error("CoinGecko fetch error:", err);
      }
    };

    fetchInitial();

    // Binance WS for live updates
    const streams = COINS.filter(c => c.binance).map(c => `${c.binance}@ticker`).join("/");
    if (streams) {
      const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
      const connect = () => {
        ws.current = new WebSocket(url);
        ws.current.onopen = () => setConnected(true);
        ws.current.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.stream && msg.data) {
            const stream = msg.stream.split("@")[0].toLowerCase();
            const d = msg.data;
            setMarketData(prev =>
              prev.map(coin => {
                if (coin.binanceSymbol?.toLowerCase() === stream) {
                  const oldPrice = coin.current_price || 1;
                  const newPrice = parseFloat(d.c);
                  const newCap = coin.market_cap * (newPrice / oldPrice);
                  return {
                    ...coin,
                    current_price: newPrice,
                    price_change_percentage_24h: parseFloat(d.P),
                    total_volume: parseFloat(d.q),
                    market_cap: newCap
                  };
                }
                return coin;
              })
            );
          }
        };
        ws.current.onclose = () => {
          setConnected(false);
          setTimeout(connect, 3000);
        };
      };
      connect();
    }

    return () => ws.current?.close();
  }, []);

  const formatPrice = (p) => {
    if (!p) return "---";
    if (p < 0.000001) return p.toFixed(10).replace(/0+$/, "");
    const digits = p < 0.01 ? 8 : p < 1 ? 6 : 2;
    return `$${p.toFixed(digits).replace(/\.?0+$/, "")}`;
  };

  const formatCap = (val) => {
    if (!val) return "-";
    if (val >= 1e12) return `$${ (val / 1e12).toFixed(1) }T`;
    if (val >= 1e9) return `$${ (val / 1e9).toFixed(1) }B`;
    if (val >= 1e6) return `$${ (val / 1e6).toFixed(1) }M`;
    return `$${val.toFixed(0)}`;
  };

  const formatPercent = (pct) => {
    if (pct == null) return "0.00%";
    return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
  };

  if (marketData.length === 0) {
    return <Card className="bg-gray-950 border-0"><CardContent className="p-12 text-center text-gray-500">Loading live data...</CardContent></Card>;
  }

  return (
    <Card className="border-0 shadow-2xl bg-gray-950 text-white overflow-hidden">
      <CardContent className="p-0">
        <div className="p-6 bg-gray-900/80 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center p-2">
                <img src={nextTradeLogo} alt="NextTrade" className="w-full h-full object-contain" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">Live Crypto Markets</h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                  <span className="text-sm text-gray-400">{connected ? "Real-time" : "Connecting..."}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="py-4 px-6 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                <th className="py-4 px-6 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Last Price</th>
                <th className="py-4 px-6 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">24h Change</th>
                <th className="py-4 px-6 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Charts</th>
                <th className="py-4 px-6 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Market Cap</th>
                <th className="py-4 px-6 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">24h Volume</th>
                <th className="py-4 px-6 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {marketData.map((coin) => {
                const isPositive = (coin.price_change_percentage_24h || 0) >= 0;
                return (
                  <tr key={coin.id} className="hover:bg-gray-900/50 transition-colors">
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-3">
                        <img src={coin.image} alt={coin.symbol} className="w-10 h-10 rounded-full" />
                        <div>
                          <div className="font-semibold">{coin.name}</div>
                          <div className="text-sm text-gray-400 uppercase">{coin.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-6 text-right font-bold text-lg">{formatPrice(coin.current_price)}</td>
                    <td className="py-5 px-6 text-right">
                      <span className={`font-bold ${isPositive ? "text-green-500" : "text-red-500"}`}>
                        {formatPercent(coin.price_change_percentage_24h)}
                      </span>
                    </td>
                    <td className="py-5 px-6 text-center">
                      <Sparkline data={coin.sparkline_in_7d?.price} />
                    </td>
                    <td className="py-5 px-6 text-right text-gray-300">{formatCap(coin.market_cap)}</td>
                    <td className="py-5 px-6 text-right text-gray-300">{formatCap(coin.total_volume)}</td>
                    <td className="py-5 px-6 text-right">
                      <Link to={createPageUrl("Trading")}>
                        <button className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
                          Trade
                        </button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-gray-900/50 text-center">
          <p className="text-xs text-gray-500 uppercase">Data via CoinGecko • Live updates via Binance</p>
        </div>
      </CardContent>
    </Card>
  );
}