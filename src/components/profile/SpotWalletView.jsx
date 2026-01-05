import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Search, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

// Same coins as Home page CryptoPriceTable
const COINS = [
  { id: "bitcoin", symbol: "BTC", binance: "btcusdt" },
  { id: "ethereum", symbol: "ETH", binance: "ethusdt" },
  { id: "binance-coin", symbol: "BNB", binance: "bnbusdt" },
  { id: "solana", symbol: "SOL", binance: "solusdt" },
  { id: "ripple", symbol: "XRP", binance: "xrpusdt" },
  { id: "dogecoin", symbol: "DOGE", binance: "dogeusdt" },
  { id: "cardano", symbol: "ADA", binance: "adausdt" },
  { id: "polygon", symbol: "MATIC", binance: "maticusdt" },
  { id: "polkadot", symbol: "DOT", binance: "dotusdt" },
  { id: "litecoin", symbol: "LTC", binance: "ltcusdt" },
  { id: "chainlink", symbol: "LINK", binance: "linkusdt" },
  { id: "avalanche-2", symbol: "AVAX", binance: "avaxusdt" },
  { id: "uniswap", symbol: "UNI", binance: "uniusdt" },
  { id: "cosmos", symbol: "ATOM", binance: "atomusdt" },
  { id: "stellar", symbol: "XLM", binance: "xlmusdt" }
];

const Sparkline = ({ data = [], width = 80, height = 30 }) => {
  if (!data || data.length < 2) return <div style={{ width, height }} className="bg-slate-800/50 rounded" />;

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

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke={stroke} strokeWidth="1.5" points={points} />
    </svg>
  );
};

const i18n = {
  en: {
    totalAssets: "Total Assets (USDT)",
    deposit: "Deposit",
    withdraw: "Withdraw",
    search: "Search coin",
    live: "Live"
  },
  ar: {
    totalAssets: "إجمالي الأصول (USDT)",
    deposit: "إيداع",
    withdraw: "سحب",
    search: "ابحث عن عملة",
    live: "مباشر"
  }
};

export default function SpotWalletView({ spotBalance = 0, onDeposit, onWithdraw, showBalances = true, language = 'en' }) {
  const t = i18n[language] || i18n.en;
  const [searchTerm, setSearchTerm] = useState("");
  const [hideZeroBalances, setHideZeroBalances] = useState(false);
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
          const mapped = data.map(coin => {
            const coinConfig = COINS.find(c => c.id === coin.id);
            return {
              ...coin,
              displaySymbol: coinConfig?.symbol || coin.symbol.toUpperCase(),
              binanceSymbol: coinConfig?.binance || null
            };
          });
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
                  return {
                    ...coin,
                    current_price: parseFloat(d.c),
                    price_change_percentage_24h: parseFloat(d.P)
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
    if (!p) return "--";
    if (p < 0.01) return `$${p.toFixed(6)}`;
    if (p < 1) return `$${p.toFixed(4)}`;
    return `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (pct) => {
    if (pct == null) return "0.00%";
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  };

  const filteredData = marketData.filter(coin => {
    if (searchTerm && !coin.displaySymbol.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !coin.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl p-4 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-slate-400 text-xs block mb-1">{t.totalAssets}</span>
            <div className="text-2xl font-bold text-white">
              {showBalances ? `$${spotBalance.toFixed(2)}` : "****"}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={onDeposit} size="sm" className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl flex-1 sm:flex-none">
              {t.deposit}
            </Button>
            <Button onClick={onWithdraw} size="sm" variant="outline" className="border-slate-600 text-white hover:bg-slate-800 rounded-xl flex-1 sm:flex-none">
              {t.withdraw}
            </Button>
          </div>
        </div>
      </div>

      {/* Asset List */}
      <div className="rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="p-4 border-b border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
              <Input
                placeholder={t.search}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${language === 'ar' ? 'pr-9' : 'pl-9'} bg-slate-800 border-slate-700 text-white placeholder:text-slate-500`}
              />
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-xs text-slate-500">{connected ? t.live : "..."}</span>
            </div>
          </div>
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-gradient-to-br from-slate-900 to-slate-800">
              <tr className="text-left text-[10px] text-slate-400 border-b border-slate-800 uppercase">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium text-right">Price</th>
                <th className="px-4 py-2 font-medium text-right">24h</th>
                <th className="px-4 py-2 font-medium text-center">Chart</th>
                <th className="px-4 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">
                    Loading...
                  </td>
                </tr>
              ) : (
                filteredData.map((coin) => {
                  const isPositive = (coin.price_change_percentage_24h || 0) >= 0;
                  return (
                    <tr key={coin.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <img src={coin.image} alt={coin.displaySymbol} className="w-6 h-6 rounded-full" />
                          <div>
                            <div className="text-white font-medium text-sm">{coin.displaySymbol}</div>
                            <div className="text-slate-500 text-[10px]">{coin.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-white text-sm font-medium">{formatPrice(coin.current_price)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className={`flex items-center justify-end gap-1 text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {formatPercent(coin.price_change_percentage_24h)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <Sparkline data={coin.sparkline_in_7d?.price} width={60} height={24} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={createPageUrl("Trading")}>
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3 rounded-lg">
                            Trade
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-2 bg-slate-900/50 text-center border-t border-slate-800">
          <p className="text-[10px] text-slate-500">Data via CoinGecko • Live via Binance</p>
        </div>
      </div>
    </div>
  );
}

SpotWalletView.propTypes = {
  spotBalance: PropTypes.number,
  onDeposit: PropTypes.func,
  onWithdraw: PropTypes.func,
  showBalances: PropTypes.bool
};
SpotWalletView.propTypes.language = PropTypes.string;