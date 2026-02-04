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
];

// Commodities - Gold & Silver from CoinGecko
const COMMODITIES = [
  { id: "tether-gold", symbol: "XAUT", name: "Gold (XAU)", isCommodity: true },
  { id: "silver-token", symbol: "XAG", name: "Silver (XAG)", isCommodity: true },
];

// Memoized Sparkline component to prevent unnecessary re-renders
const Sparkline = memo(function Sparkline({ data = [], width = 120, height = 40 }) {
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
});

Sparkline.propTypes = {
  data: PropTypes.array,
  width: PropTypes.number,
  height: PropTypes.number
};

export default function CryptoPriceTable({ language: _language = "en" }) {
  const [marketData, setMarketData] = useState([]);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    // Create abort controller for cleanup
    abortControllerRef.current = new AbortController();
    
    // Initial fetch from CoinGecko
    const fetchInitial = async () => {
      const cryptoIds = COINS.map(c => c.id).join(",");
      const commodityIds = COMMODITIES.filter(c => !c.hidden).map(c => c.id).join(",");
      const allIds = `${cryptoIds},${commodityIds}`;
      
      try {
        // Fetch crypto and gold-backed tokens
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${allIds}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`,
          { signal: abortControllerRef.current.signal }
        );
        
        if (res.ok) {
          const data = await res.json();
          
          // Map crypto coins
          const cryptoData = data
            .filter(coin => COINS.some(c => c.id === coin.id))
            .map(coin => ({
              ...coin,
              binanceSymbol: COINS.find(c => c.id === coin.id)?.binance || null,
              isCommodity: false
            }));
          
          // Map commodities (gold & silver tokens)
          const commodityData = data
            .filter(coin => COMMODITIES.some(c => c.id === coin.id))
            .map(coin => {
              const config = COMMODITIES.find(c => c.id === coin.id);
              return {
                ...coin,
                name: config?.name || coin.name,
                symbol: config?.symbol || coin.symbol,
                isCommodity: true,
                binanceSymbol: null
              };
            });
          
          // Combine all data: crypto first, then commodities
          const combined = [
            ...cryptoData,
            ...commodityData
          ];
          
          setMarketData(combined);
          setError(null);
        } else {
          setError("Failed to load market data");
        }
      } catch (err) {
        // Don't log abort errors
        if (err.name !== 'AbortError') {
          console.error("CoinGecko fetch error:", err);
          setError("Failed to load market data");
        }
      }
    };

    fetchInitial();

    // Cleanup: abort any pending requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
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

  // Loading state
  if (marketData.length === 0 && !error) {
    return <Card className="bg-gray-950 border-0"><CardContent className="p-12 text-center text-gray-500">Loading live data...</CardContent></Card>;
  }

  // Error state
  if (error) {
    return (
      <Card className="bg-gray-950 border-0">
        <CardContent className="p-12 text-center">
          <p className="text-red-400 mb-2">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="text-blue-400 hover:underline text-sm"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  // Separate crypto and commodities for display
  const cryptoAssets = marketData.filter(c => !c.isCommodity);
  const commodityAssets = marketData.filter(c => c.isCommodity);

  return (
    <Card className="border-0 shadow-2xl bg-gray-950 text-white overflow-hidden rounded-2xl">
      <CardContent className="p-0">
        <div className="p-4 bg-gray-900/80 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center p-2">
              <img src={nextTradeLogo} alt="NextTrade" className="w-full h-full object-contain" />
            </div>
            <div className="flex-1">
              <h3 className="text-base sm:text-lg font-bold">Live Markets</h3>
              <p className="text-[11px] text-gray-500">Crypto & Commodities</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[400px]">
            <thead className="bg-gray-900/50 sticky top-0">
              <tr>
                <th className="py-3 px-2 sm:px-3 text-left text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide">Asset</th>
                <th className="py-3 px-2 sm:px-3 text-right text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide">Price</th>
                <th className="py-3 px-2 sm:px-3 text-right text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide">24h</th>
                <th className="hidden lg:table-cell py-3 px-3 text-center text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide">7d Chart</th>
                <th className="py-3 px-2 sm:px-3 text-right text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {/* Crypto Assets */}
              {cryptoAssets.map((coin) => {
                const isPositive = (coin.price_change_percentage_24h || 0) >= 0;
                return (
                  <tr key={coin.id} className="hover:bg-gray-900/50 transition-colors">
                    <td className="py-3 sm:py-4 px-2 sm:px-3">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <img src={coin.image} alt={coin.symbol} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex-shrink-0" />
                        <div className="overflow-hidden min-w-0">
                          <div className="font-semibold text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none">{coin.name}</div>
                          <div className="text-[10px] sm:text-[11px] text-gray-500 uppercase">{coin.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 sm:py-4 px-2 sm:px-3 text-right">
                      <span className="font-bold text-xs sm:text-sm font-mono tabular-nums">{formatPrice(coin.current_price)}</span>
                    </td>
                    <td className="py-3 sm:py-4 px-2 sm:px-3 text-right">
                      <span className={`font-semibold text-xs sm:text-sm font-mono tabular-nums ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatPercent(coin.price_change_percentage_24h)}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell py-3 sm:py-4 px-3">
                      <div className="flex justify-center">
                        <Sparkline data={coin.sparkline_in_7d?.price} width={80} height={28} />
                      </div>
                    </td>
                    <td className="py-3 sm:py-4 px-2 sm:px-3 text-right">
                      <Link to={createPageUrl("Futures")}>
                        <button className="px-2.5 sm:px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-[11px] sm:text-xs whitespace-nowrap">
                          Trade
                        </button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
              
              {/* Commodities Section Divider */}
              {commodityAssets.length > 0 && (
                <tr className="bg-amber-500/5">
                  <td colSpan={5} className="py-2 px-3">
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs text-amber-400/80 font-medium uppercase tracking-wider">
                      <span className="w-4 h-px bg-amber-500/30" />
                      Precious Metals
                      <span className="flex-1 h-px bg-amber-500/30" />
                    </div>
                  </td>
                </tr>
              )}
              
              {/* Commodity Assets */}
              {commodityAssets.map((coin) => {
                const isPositive = (coin.price_change_percentage_24h || 0) >= 0;
                const hasChange = coin.price_change_percentage_24h != null;
                return (
                  <tr key={coin.id} className="hover:bg-gray-900/50 transition-colors">
                    <td className="py-3 sm:py-4 px-2 sm:px-3">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-amber-400 to-yellow-600">
                          {coin.symbol === "XAG" ? (
                            <span className="text-[10px] sm:text-xs font-bold text-white">Ag</span>
                          ) : (
                            <span className="text-[10px] sm:text-xs font-bold text-white">Au</span>
                          )}
                        </div>
                        <div className="overflow-hidden min-w-0">
                          <div className="font-semibold text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none">{coin.name}</div>
                          <div className="text-[10px] sm:text-[11px] text-amber-500/70 uppercase">{coin.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 sm:py-4 px-2 sm:px-3 text-right">
                      <span className="font-bold text-xs sm:text-sm font-mono tabular-nums">{formatPrice(coin.current_price)}</span>
                    </td>
                    <td className="py-3 sm:py-4 px-2 sm:px-3 text-right">
                      {hasChange ? (
                        <span className={`font-semibold text-xs sm:text-sm font-mono tabular-nums ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                          {formatPercent(coin.price_change_percentage_24h)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell py-3 sm:py-4 px-3">
                      <div className="flex justify-center">
                        {coin.sparkline_in_7d?.price ? (
                          <Sparkline data={coin.sparkline_in_7d.price} width={80} height={28} />
                        ) : (
                          <div className="w-[80px] h-[28px] bg-gray-800/30 rounded flex items-center justify-center">
                            <span className="text-[9px] text-gray-600">—</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 sm:py-4 px-2 sm:px-3 text-right">
                      <Link to={createPageUrl("Futures")}>
                        <button className="px-2.5 sm:px-4 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-medium text-[11px] sm:text-xs whitespace-nowrap">
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

CryptoPriceTable.propTypes = {
  language: PropTypes.string
};