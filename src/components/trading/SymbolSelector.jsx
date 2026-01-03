import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Star, TrendingUp, TrendingDown } from "lucide-react";

// BingX-compatible symbol format
const TRADING_PAIRS = [
  { symbol: "BTC-USDT", name: "Bitcoin", baseAsset: "BTC", quoteAsset: "USDT", price: 94250, change: 3.15, favorite: true },
  { symbol: "ETH-USDT", name: "Ethereum", baseAsset: "ETH", quoteAsset: "USDT", price: 3456.78, change: 2.45, favorite: true },
  { symbol: "SOL-USDT", name: "Solana", baseAsset: "SOL", quoteAsset: "USDT", price: 185.23, change: -1.23, favorite: false },
  { symbol: "BNB-USDT", name: "BNB", baseAsset: "BNB", quoteAsset: "USDT", price: 612.45, change: 0.87, favorite: false },
  { symbol: "XRP-USDT", name: "Ripple", baseAsset: "XRP", quoteAsset: "USDT", price: 2.34, change: 4.56, favorite: false },
  { symbol: "DOGE-USDT", name: "Dogecoin", baseAsset: "DOGE", quoteAsset: "USDT", price: 0.3245, change: -2.15, favorite: false },
  { symbol: "ADA-USDT", name: "Cardano", baseAsset: "ADA", quoteAsset: "USDT", price: 0.89, change: 1.23, favorite: false },
  { symbol: "AVAX-USDT", name: "Avalanche", baseAsset: "AVAX", quoteAsset: "USDT", price: 38.76, change: 5.67, favorite: false },
  { symbol: "DOT-USDT", name: "Polkadot", baseAsset: "DOT", quoteAsset: "USDT", price: 7.23, change: -0.45, favorite: false },
  { symbol: "LINK-USDT", name: "Chainlink", baseAsset: "LINK", quoteAsset: "USDT", price: 23.45, change: 3.21, favorite: false },
  { symbol: "MATIC-USDT", name: "Polygon", baseAsset: "MATIC", quoteAsset: "USDT", price: 0.89, change: 2.34, favorite: false },
  { symbol: "UNI-USDT", name: "Uniswap", baseAsset: "UNI", quoteAsset: "USDT", price: 12.34, change: -1.56, favorite: false },
];

export default function SymbolSelector({ selectedSymbol, onSymbolChange }) {
  const [search, setSearch] = useState("");
  const [pairs, setPairs] = useState(TRADING_PAIRS);
  const [activeTab, setActiveTab] = useState("all");

  const filteredPairs = pairs.filter(pair => {
    const matchesSearch = pair.symbol.toLowerCase().includes(search.toLowerCase()) ||
                          pair.name.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === "all" || (activeTab === "favorites" && pair.favorite);
    return matchesSearch && matchesTab;
  });

  const toggleFavorite = (symbol) => {
    setPairs(pairs.map(p => 
      p.symbol === symbol ? { ...p, favorite: !p.favorite } : p
    ));
  };

  const formatPrice = (price) => {
    if (price >= 1000) return price.toFixed(2);
    if (price >= 1) return price.toFixed(2);
    return price.toFixed(4);
  };

  return (
    <Card className="border-slate-200 shadow-sm h-full">
      <CardHeader className="py-3 px-4 border-b border-slate-100">
        <CardTitle className="text-sm font-bold">Markets</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Search */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pairs..."
              className="pl-9 h-8 text-sm"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex-1 py-2 text-xs font-medium ${
              activeTab === "all" 
                ? "text-blue-600 border-b-2 border-blue-600" 
                : "text-slate-500"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab("favorites")}
            className={`flex-1 py-2 text-xs font-medium ${
              activeTab === "favorites" 
                ? "text-blue-600 border-b-2 border-blue-600" 
                : "text-slate-500"
            }`}
          >
            ⭐ Favorites
          </button>
        </div>

        {/* Header */}
        <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
          <span>Pair</span>
          <span className="text-right">Price</span>
          <span className="text-right">24h %</span>
        </div>

        {/* Pairs List */}
        <ScrollArea className="h-[400px]">
          {filteredPairs.map(pair => (
            <div
              key={pair.symbol}
              onClick={() => onSymbolChange(pair.symbol)}
              className={`grid grid-cols-3 gap-2 px-3 py-2.5 cursor-pointer transition-colors hover:bg-slate-50 ${
                selectedSymbol === pair.symbol ? "bg-blue-50" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(pair.symbol);
                  }}
                  className="text-slate-300 hover:text-yellow-500"
                >
                  <Star className={`h-3 w-3 ${pair.favorite ? "fill-yellow-500 text-yellow-500" : ""}`} />
                </button>
                <div>
                  <div className="text-xs font-bold text-slate-900">{pair.baseAsset}</div>
                  <div className="text-[10px] text-slate-400">/{pair.quoteAsset}</div>
                </div>
              </div>
              <div className="text-right text-xs font-mono text-slate-900">
                ${formatPrice(pair.price)}
              </div>
              <div className={`text-right text-xs font-bold flex items-center justify-end gap-1 ${
                pair.change >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                {pair.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {pair.change >= 0 ? "+" : ""}{pair.change.toFixed(2)}%
              </div>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

SymbolSelector.propTypes = {
  selectedSymbol: PropTypes.string,
  onSymbolChange: PropTypes.func
};