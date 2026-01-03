import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Star, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { marketStore } from "./marketStore";

export default function SymbolSelector({ selectedSymbol, onSymbolChange }) {
  const [search, setSearch] = useState("");
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [favorites, setFavorites] = useState(['BTC-USDT', 'ETH-USDT']);

  // Fetch tickers ONCE, then subscribe to store
  useEffect(() => {
    let unsubscribers = [];
    
    const init = async () => {
      try {
        // REST fetch ONCE
        const result = await base44.functions.invoke('bingxMarketData', {
          action: 'getTickers',
          params: {}
        });

        if (result.data?.success && result.data?.data) {
          const tickers = result.data.data
            .filter(t => t.symbol.endsWith('-USDT'))
            .map(t => ({
              symbol: t.symbol,
              baseAsset: t.symbol.replace('-USDT', ''),
              quoteAsset: 'USDT',
              price: t.lastPrice,
              change: t.priceChangePercent,
              volume: t.quoteVolume
            }))
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 30);
          
          setPairs(tickers);
          
          // Subscribe to WebSocket for top 15 symbols
          tickers.slice(0, 15).forEach(t => {
            marketStore.subscribeWS(`${t.symbol}@ticker`);
          });
          
          // Subscribe to store for price updates
          const unsub = marketStore.subscribe('ticker', ({ symbol, ticker }) => {
            setPairs(prev => prev.map(p => 
              p.symbol === symbol ? { ...p, price: ticker.price, change: ticker.change } : p
            ));
          });
          unsubscribers.push(unsub);
        }
      } catch (err) {
        console.error('Failed to fetch tickers:', err);
      } finally {
        setLoading(false);
      }
    };
    
    init();
    
    return () => {
      unsubscribers.forEach(u => u());
    };
  }, []);

  const filteredPairs = pairs.filter(pair => {
    const matchesSearch = pair.symbol.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === "all" || (activeTab === "favorites" && favorites.includes(pair.symbol));
    return matchesSearch && matchesTab;
  });

  const toggleFavorite = (symbol) => {
    setFavorites(prev => 
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
  };

  const formatPrice = (p) => {
    if (!p) return '0.00';
    if (p >= 1000) return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return p >= 1 ? p.toFixed(2) : p.toFixed(6);
  };

  return (
    <Card className="bg-[#1E222D] border-[#2B2B43] h-full">
      <CardHeader className="py-3 px-4 border-b border-[#2B2B43]">
        <CardTitle className="text-sm font-bold text-white">Markets</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-3 border-b border-[#2B2B43]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-9 h-8 text-sm bg-[#131722] border-[#2B2B43] text-white placeholder:text-gray-500"
            />
          </div>
        </div>

        <div className="flex border-b border-[#2B2B43]">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex-1 py-2 text-xs font-medium ${activeTab === "all" ? "text-[#2962FF] border-b-2 border-[#2962FF]" : "text-gray-500"}`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab("favorites")}
            className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 ${activeTab === "favorites" ? "text-[#2962FF] border-b-2 border-[#2962FF]" : "text-gray-500"}`}
          >
            <Star className="w-3 h-3" /> Favorites
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-[#131722] text-[10px] font-medium text-gray-500 uppercase">
          <span>Pair</span>
          <span className="text-right">Price</span>
          <span className="text-right">24h %</span>
        </div>

        <ScrollArea className="h-[calc(100vh-380px)] min-h-[300px]">
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
                  className={`grid grid-cols-3 gap-2 px-3 py-2.5 cursor-pointer transition-colors ${isSelected ? "bg-[#2962FF]/20" : "hover:bg-[#1E222D]"}`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(pair.symbol); }}
                      className="text-gray-600 hover:text-yellow-500"
                    >
                      <Star className={`h-3 w-3 ${isFavorite ? "fill-yellow-500 text-yellow-500" : ""}`} />
                    </button>
                    <div>
                      <div className="text-xs font-bold text-white">{pair.baseAsset}</div>
                      <div className="text-[10px] text-gray-500">/{pair.quoteAsset}</div>
                    </div>
                  </div>
                  <div className="text-right text-xs font-mono text-white">${formatPrice(pair.price)}</div>
                  <div className={`text-right text-xs font-bold flex items-center justify-end gap-0.5 ${isPositive ? "text-[#26A69A]" : "text-[#EF5350]"}`}>
                    {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {isPositive ? "+" : ""}{pair.change?.toFixed(2) || '0.00'}%
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
  onSymbolChange: PropTypes.func
};