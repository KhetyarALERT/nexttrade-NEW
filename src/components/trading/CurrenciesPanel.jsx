import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { marketStore } from "@/components/trading/marketStore";
import CryptoIcon from "@/components/ui/CryptoIcon";
import { Input } from "@/components/ui/input";
import { Star } from "lucide-react";
import { toDisplayFormat } from "@/components/utils/symbolFormat";

const DEFAULT_SYMBOLS = [
  "BTC-USDT","ETH-USDT","SOL-USDT","BNB-USDT","XRP-USDT","DOGE-USDT","ADA-USDT","AVAX-USDT","LINK-USDT","DOT-USDT",
  "TON-USDT","TRX-USDT","NEAR-USDT","MATIC-USDT","ARB-USDT","OP-USDT","SUI-USDT","APT-USDT","ATOM-USDT","TIA-USDT"
];

export default function CurrenciesPanel({ selectedSymbol, onSelect }) {
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fav_symbols") || "[]"); } catch { return []; }
  });
  const [tickers, setTickers] = useState({});

  // Subscribe to all default symbols + favorites
  useEffect(() => {
    const subs = new Set([...DEFAULT_SYMBOLS, ...favorites]);
    subs.forEach(s => marketStore.subscribeToTicker(s));
    const unsub = marketStore.subscribe('ticker', ({ symbol, ticker }) => {
      setTickers(prev => ({ ...prev, [symbol]: ticker }));
    });
    return () => { unsub(); };
  }, [favorites]);

  const list = useMemo(() => {
    const base = [...new Set([...favorites, ...DEFAULT_SYMBOLS])];
    return base
      .filter(s => s.toLowerCase().includes(search.toLowerCase()))
      .map(symbol => ({ symbol, price: tickers[symbol]?.price || 0, change: tickers[symbol]?.change || 0 }));
  }, [favorites, search, tickers]);

  const toggleFav = (s) => {
    const next = favorites.includes(s) ? favorites.filter(x => x !== s) : [...favorites, s];
    setFavorites(next);
    localStorage.setItem("fav_symbols", JSON.stringify(next));
  };

  return (
    <div className="h-full flex flex-col bg-[#0f1220] text-white">
      <div className="p-2 border-b border-[#2B2B43]">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="h-8 bg-[#131722] border-[#2B2B43] text-xs" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {list.map(({ symbol, price, change }) => {
          const base = symbol.split('-')[0];
          const isActive = symbol === selectedSymbol;
          const isFav = favorites.includes(symbol);
          return (
            <button key={symbol} onClick={() => onSelect?.(symbol)} className={`w-full px-3 py-2 flex items-center justify-between border-b border-white/5 hover:bg-slate-800/30 ${isActive ? 'bg-blue-600/20' : ''}`}>
              <div className="flex items-center gap-2">
                <CryptoIcon currency={base} size="sm" />
                <div className="text-left">
                  <div className="text-xs font-semibold">{toDisplayFormat(symbol)}</div>
                  <div className="text-[10px] text-slate-400">{base}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono">${price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: price < 1 ? 6 : 2 })}</div>
                <div className={`text-[10px] ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{change >= 0 ? '+' : ''}{change?.toFixed(2)}%</div>
              </div>
              <Star onClick={(e) => { e.stopPropagation(); toggleFav(symbol); }} className={`ml-2 h-4 w-4 ${isFav ? 'fill-yellow-400 text-yellow-400' : 'text-slate-500'}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

CurrenciesPanel.propTypes = {
  selectedSymbol: PropTypes.string,
  onSelect: PropTypes.func,
};