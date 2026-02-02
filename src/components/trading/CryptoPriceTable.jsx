import { useState, useEffect, useRef, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import nextTradeLogo from "@/assets/nexttrade-logo.png";
import PropTypes from "prop-types";

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

export default function CryptoPriceTable({ language: _language = "en" }) {
  const [marketData, setMarketData] = useState([]);

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

    // Home page: CoinGecko-only updates (no WS)
    return () => {};
  }, []);

  const formatPrice = (p) => {
    if (!p) return "---";
    if (p < 0.000001) return p.toFixed(10).replace(/0+$/, "");
    const digits = p < 0.01 ? 8 : p < 1 ? 6 : 2;
    return `$${p.toFixed(digits).replace(/\.?0+$/, "")}`;
  };

  const _formatCap = (val) => {
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
            <div className="w-10 h-10 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center p-2">
              <img src={nextTradeLogo} alt="NextTrade" className="w-full h-full object-contain" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold">Live Crypto Markets</h3>
            </div>
          </div>
        </div>

        <div className="overflow-hidden">
          <table className="w-full table-auto">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="py-3 px-3 text-left text-[11px] sm:text-xs font-medium text-gray-400 uppercase">Name</th>
                <th className="py-3 px-3 text-right text-[11px] sm:text-xs font-medium text-gray-400 uppercase">Price</th>
                <th className="py-3 px-3 text-right text-[11px] sm:text-xs font-medium text-gray-400 uppercase">24h</th>
                <th className="hidden md:table-cell py-3 px-3 text-center text-[11px] sm:text-xs font-medium text-gray-400 uppercase">Chart</th>
                <th className="py-3 px-3 text-right text-[11px] sm:text-xs font-medium text-gray-400 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {marketData.map((coin) => {
                const isPositive = (coin.price_change_percentage_24h || 0) >= 0;
                return (
                  <tr key={coin.id} className="hover:bg-gray-900/50 transition-colors">
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-2">
                        <img src={coin.image} alt={coin.symbol} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0" />
                        <div className="overflow-hidden min-w-0">
                          <div className="font-semibold text-sm truncate">{coin.name}</div>
                          <div className="text-[11px] text-gray-400 uppercase">{coin.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-3 text-right font-bold text-sm">{formatPrice(coin.current_price)}</td>
                    <td className="py-4 px-3 text-right">
                      <span className={`font-bold text-sm ${isPositive ? "text-green-500" : "text-red-500"}`}>
                        {formatPercent(coin.price_change_percentage_24h)}
                      </span>
                    </td>
                    <td className="hidden md:table-cell py-4 px-3">
                      <div className="flex justify-center">
                        <Sparkline data={coin.sparkline_in_7d?.price} width={100} height={30} />
                      </div>
                    </td>
                    <td className="py-4 px-3 text-right">
                      <Link to={createPageUrl("Futures")}>
                        <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-xs sm:text-sm w-full">
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
      </CardContent>
    </Card>
  );
}