import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Star, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { marketStore } from "./marketStore";

// Static top pairs data
const TOP_PAIRS = [
  { symbol: 'BTC-USDT', baseAsset: 'BTC', quoteAsset: 'USDT', price: 94500, change: 2.1 },
  { symbol: 'ETH-USDT', baseAsset: 'ETH', quoteAsset: 'USDT', price: 3380, change: 1.5 },
  { symbol: 'SOL-USDT', baseAsset: 'SOL', quoteAsset: 'USDT', price: 185, change: 3.2 },
  { symbol: 'BNB-USDT', baseAsset: 'BNB', quoteAsset: 'USDT', price: 680, change: 0.8 },
  { symbol: 'XRP-USDT', baseAsset: 'XRP', quoteAsset: 'USDT', price: 2.15, change: -0.5 },
  { symbol: 'ADA-USDT', baseAsset: 'ADA', quoteAsset: 'USDT', price: 0.92, change: 1.2 },
  { symbol: 'DOGE-USDT', baseAsset: 'DOGE', quoteAsset: 'USDT', price: 0.32, change: -1.1 },
  { symbol: 'AVAX-USDT', baseAsset: 'AVAX', quoteAsset: 'USDT', price: 38.5, change: 2.8 },
  { symbol: 'DOT-USDT', baseAsset: 'DOT', quoteAsset: 'USDT', price: 7.2, change: 0.3 },
  { symbol: 'LINK-USDT', baseAsset: 'LINK', quoteAsset: 'USDT', price: 22.8, change: 1.9 },
  { symbol: 'MATIC-USDT', baseAsset: 'MATIC', quoteAsset: 'USDT', price: 0.48, change: -0.7 },
  { symbol: 'UNI-USDT', baseAsset: 'UNI', quoteAsset: 'USDT', price: 13.5, change: 2.1 },
  { symbol: 'ATOM-USDT', baseAsset: 'ATOM', quoteAsset: 'USDT', price: 9.8, change: 1.4 },
  { symbol: 'LTC-USDT', baseAsset: 'LTC', quoteAsset: 'USDT', price: 102, change: 0.6 },
  { symbol: 'FIL-USDT', baseAsset: 'FIL', quoteAsset: 'USDT', price: 5.2, change: -0.3 }
];

export default function SymbolSelector({ selectedSymbol, onSymbolChange, compact = false }) {
  const [search, setSearch] = useState("");
  const [pairs, setPairs] = useState(TOP_PAIRS);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('favorite_pairs') || '["BTC-USDT","ETH-USDT"]');
    } catch { return ['BTC-USDT', 'ETH-USDT']; }
  });

  // Subscribe to market store for price updates
  useEffect(() => {
    const unsub = marketStore.subscribe('ticker', ({ symbol, ticker }) => {
      setPairs(prev => prev.map(p => 
        p.symbol === symbol ? { ...p, price: ticker.price || p.price, change: ticker.change || p.change } : p
      ));
    });

    // Subscribe to WebSocket for top pairs
    TOP_PAIRS.slice(0, 10).forEach(t => {
      try {
        marketStore.subscribeToTicker?.(t.symbol);
      } catch (e) {}
    });

    // Seed from any existing store data immediately
    const existing = marketStore.getAllTickers?.() || {};
    if (Object.keys(existing).length) {
      setPairs(prev => prev.map(p => ({ ...p, price: existing[p.symbol]?.price || p.price, change: existing[p.symbol]?.change || p.change })));
    }

    return () => unsub();
  }, []);

  const filteredPairs = pairs.filter(pair => {
    const matchesSearch = pair.symbol.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === "all" || (activeTab === "favorites" && favorites.includes(pair.symbol));
    return matchesSearch && matchesTab;
  });

  const toggleFavorite = (symbol) => {
    setFavorites(prev => {
      const updated = prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol];
      localStorage.setItem('favorite_pairs', JSON.stringify(updated));
      return updated;
    });
  };

  const formatPrice = (p) => {
    if (!p) return '0.00';
    if (p >= 1000) return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return p >= 1 ? p.toFixed(2) : p.toFixed(6);
  };

  const containerHeight = compact ? "max-h-[40vh]" : "h-[calc(100vh-380px)] min-h-[300px]";

  return (
    <Card className="bg-[#1E222D] border-[#2B2B43]">
      {!compact && (
        <CardHeader className="py-2 px-3 border-b border-[#2B2B43]">
          <CardTitle className="text-xs font-bold text-white">Markets</CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <div className="p-2 border-b border-[#2B2B43]">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-7 h-7 text-xs bg-[#131722] border-[#2B2B43] text-white placeholder:text-gray-500"
            />
          </div>
        </div>

        <div className="flex border-b border-[#2B2B43]">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex-1 py-1.5 text-[10px] font-medium ${activeTab === "all" ? "text-[#2962FF] border-b-2 border-[#2962FF]" : "text-gray-500"}`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab("favorites")}
            className={`flex-1 py-1.5 text-[10px] font-medium flex items-center justify-center gap-1 ${activeTab === "favorites" ? "text-[#2962FF] border-b-2 border-[#2962FF]" : "text-gray-500"}`}
          >
            <Star className="w-2.5 h-2.5" /> Fav
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 px-2 py-1 bg-[#131722] text-[9px] font-medium text-gray-500 uppercase">
          <span>Pair</span>
          <span className="text-right">Price</span>
          <span className="text-right">24h</span>
        </div>

        <ScrollArea className={containerHeight}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 text-[#2962FF] animate-spin" />
            </div>
          ) : filteredPairs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">No pairs found</div>
          ) : (
            filteredPairs.map(pair => {
              const isPositive = pair.change >= 0;
              const isFavorite = favorites.includes(pair.symbol);
              const isSelected = selectedSymbol === pair.symbol;
              
              return (
                <div
                  key={pair.symbol}
                  onClick={() => onSymbolChange(pair.symbol)}
                  className={`grid grid-cols-3 gap-1 px-2 py-1.5 cursor-pointer transition-colors ${isSelected ? "bg-[#2962FF]/20" : "hover:bg-[#1E222D]"}`}
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(pair.symbol); }}
                      className="text-gray-600 hover:text-yellow-500"
                    >
                      <Star className={`h-2.5 w-2.5 ${isFavorite ? "fill-yellow-500 text-yellow-500" : ""}`} />
                    </button>
                    <div>
                      <div className="text-[10px] font-bold text-white">{pair.baseAsset}</div>
                    </div>
                  </div>
                  <div className="text-right text-[10px] font-mono text-white">${formatPrice(pair.price)}</div>
                  <div className={`text-right text-[10px] font-bold flex items-center justify-end ${isPositive ? "text-[#26A69A]" : "text-[#EF5350]"}`}>
                    {isPositive ? "+" : ""}{pair.change?.toFixed(1) || '0.0'}%
                  </div>
                </div>
              );
            })
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

SymbolSelector.propTypes = {
  selectedSymbol: PropTypes.string,
  onSymbolChange: PropTypes.func,
  compact: PropTypes.bool
};