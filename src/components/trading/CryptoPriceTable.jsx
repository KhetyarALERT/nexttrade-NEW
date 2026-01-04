import React, { useState, useEffect, useRef } from "react";
import { marketStore } from "@/components/trading/marketStore";
import { Card, CardContent } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import nextTradeLogo from "@/assets/nexttrade-logo.png";

const COINS = [
  { id: "bitcoin", binance: "btcusdt", bingx: "BTC-USDT" },
  { id: "ethereum", binance: "ethusdt", bingx: "ETH-USDT" },
  { id: "solana", binance: "solusdt", bingx: "SOL-USDT" },
  { id: "dogecoin", binance: "dogeusdt", bingx: "DOGE-USDT" },
  { id: "pepe", binance: "pepeusdt", bingx: "PEPE-USDT" },
  { id: "binance-coin", binance: "bnbusdt", bingx: "BNB-USDT" },
  { id: "ripple", binance: "xrpusdt", bingx: "XRP-USDT" },
  { id: "cardano", binance: "adausdt", bingx: "ADA-USDT" },
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

    // Subscribe to shared market store (BingX) for live updates
    setConnected(marketStore.connected);
    const unsubConn = marketStore.subscribe('connected', setConnected);

    // Ensure tickers are subscribed
    COINS.filter(c => c.bingx).forEach(c => marketStore.subscribeToTicker(c.bingx));

    const unsubTicker = marketStore.subscribe('ticker', ({ symbol, ticker }) => {
      setMarketData(prev => prev.map(coin => {
        const match = coin.binanceSymbol?.toUpperCase().replace('USDT','-USDT') === symbol;
        if (match) {
          const oldPrice = coin.current_price || ticker.price || 1;
          const newPrice = ticker.price || oldPrice;
          const newCap = coin.market_cap ? coin.market_cap * (newPrice / oldPrice) : coin.market_cap;
          return {
            ...coin,
            current_price: newPrice,
            price_change_percentage_24h: typeof ticker.change === 'number' ? ticker.change : coin.price_change_percentage_24h,
            market_cap: newCap
          };
        }
        return coin;
      }));
    });

    return () => {
      if (unsubConn) unsubConn();
      if (unsubTicker) unsubTicker();
    };
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
        <div className="p-4 bg-gray-900/80 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-2">
              <img src={nextTradeLogo} alt="NextTrade" className="w-full h-full object-contain" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold">Live Crypto Markets</h3>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                <span className="text-xs text-gray-400">{connected ? "Real-time" : "Connecting..."}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden">
          <table className="w-full table-fixed">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="py-3 px-3 text-left text-xs font-medium text-gray-400 uppercase w-[25%]">Name</th>
                <th className="py-3 px-3 text-right text-xs font-medium text-gray-400 uppercase w-[18%]">Price</th>
                <th className="py-3 px-3 text-right text-xs font-medium text-gray-400 uppercase w-[15%]">24h</th>
                <th className="py-3 px-3 text-center text-xs font-medium text-gray-400 uppercase w-[22%]">Chart</th>
                <th className="py-3 px-3 text-right text-xs font-medium text-gray-400 uppercase w-[20%]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {marketData.map((coin) => {
                const isPositive = (coin.price_change_percentage_24h || 0) >= 0;
                return (
                  <tr key={coin.id} className="hover:bg-gray-900/50 transition-colors">
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-2">
                        <img src={coin.image} alt={coin.symbol} className="w-8 h-8 rounded-full flex-shrink-0" />
                        <div className="overflow-hidden">
                          <div className="font-semibold text-sm truncate">{coin.name}</div>
                          <div className="text-xs text-gray-400 uppercase">{coin.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-3 text-right font-bold">{formatPrice(coin.current_price)}</td>
                    <td className="py-4 px-3 text-right">
                      <span className={`font-bold text-sm ${isPositive ? "text-green-500" : "text-red-500"}`}>
                        {formatPercent(coin.price_change_percentage_24h)}
                      </span>
                    </td>
                    <td className="py-4 px-3 flex justify-center">
                      <Sparkline data={coin.sparkline_in_7d?.price} width={100} height={30} />
                    </td>
                    <td className="py-4 px-3 text-right">
                      <Link to={createPageUrl("Trading")}>
                        <button className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm w-full">
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

        <div className="p-3 bg-gray-900/50 text-center">
          <p className="text-xs text-gray-500 uppercase">Data via CoinGecko • Live updates via Binance</p>
        </div>
      </CardContent>
    </Card>
  );
}