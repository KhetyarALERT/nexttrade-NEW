import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useMemeData, MemeDataProvider } from '@/components/meme/MemeDataContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search, Loader2, Wifi, WifiOff, Filter, X, ChevronDown, TrendingUp, TrendingDown, 
  Zap, Star, BarChart3, Flame, DollarSign, Eye, EyeOff
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import TradeDrawer from '@/components/meme/TradeDrawer';
import MemeDetailPanel from '@/components/meme/MemeDetailPanel';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatPrice = (num) => {
  if (!num || num === 0) return '$0.00';
  if (num < 0.00001) return '$' + num.toExponential(2);
  if (num < 0.01) return '$' + num.toFixed(6);
  if (num < 1) return '$' + num.toFixed(4);
  return '$' + num.toFixed(2);
};

const formatMarketCap = (num) => {
  if (num === undefined || num === null) return 'Loading...';
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
};

const formatLiquidity = (token) => {
  if (token.bonding_curve_status === 'bonding_curve') return 'Bonding Curve';
  if (!token.liquidity) return 'N/A';
  return formatMarketCap(token.liquidity);
};

const formatVolume = (num) => {
  if (!num) return 'N/A';
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
};

// ============================================================================
// ULTRA-COMPACT TOKEN ROW (Terminal Style)
// ============================================================================

const TokenRow = React.memo(({ token, onTrade, onDetail, isFavorite, onToggleFavorite }) => {
  const priceChange = token.priceChange24h || 0;
  const isPositive = priceChange >= 0;

  return (
    <div 
      className="flex items-center h-7 px-2 border-b border-gray-900 hover:bg-gray-900/40 transition-colors cursor-pointer group text-xs"
      onClick={() => onDetail(token)}
    >
      {/* Favorite Toggle */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(token.mint);
        }}
        className="w-5 text-gray-600 hover:text-yellow-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
      >
        <Star className={`w-3 h-3 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
      </button>

      {/* Token Symbol */}
      <div className="w-16 flex-shrink-0 font-bold text-white">
        {token.symbol}
      </div>

      {/* Token Name (Hidden on Mobile) */}
      <div className="hidden sm:block w-32 text-gray-500 truncate flex-shrink-0">
        {token.name}
      </div>

      {/* Price */}
      <div className="w-20 text-right font-semibold text-white flex-shrink-0">
        {formatPrice(token.price)}
      </div>

      {/* 24h Change */}
      <div className={`w-16 text-right font-bold flex-shrink-0 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
        {priceChange.toFixed(2)}%
      </div>

      {/* Market Cap */}
      <div className="w-20 text-right text-gray-400 flex-shrink-0">
        {formatMarketCap(token.market_cap)}
      </div>

      {/* Liquidity */}
      <div className="w-20 text-right text-gray-400 flex-shrink-0">
        {formatLiquidity(token)}
      </div>

      {/* Volume (Hidden on Mobile) */}
      <div className="hidden sm:block w-20 text-right text-gray-400 flex-shrink-0">
        {formatVolume(token.volume24h)}
      </div>

      {/* Holders */}
      <div className="hidden md:block w-16 text-right text-gray-400 flex-shrink-0">
        {token.holders || '--'}
      </div>

      {/* Quick Buy Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTrade(token);
        }}
        className="ml-auto flex-shrink-0 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs transition-colors"
      >
        Buy
      </button>

      {/* Chart Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDetail(token);
        }}
        className="ml-1 flex-shrink-0 px-2 py-1 border border-gray-700 hover:border-emerald-500 text-gray-400 hover:text-emerald-400 rounded text-xs transition-colors"
      >
        📊
      </button>
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const MemeCoinsContent = () => {
  const { tokens, loading, connectionStatus } = useMemeData();
  
  // State
  const [search, setSearch] = useState('');
  const [selectedToken, setSelectedToken] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [filter, setFilter] = useState('all');
  const [minLiquidity, setMinLiquidity] = useState(0);
  const [minMarketCap, setMinMarketCap] = useState(0);
  const [minChange24h, setMinChange24h] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [isTradeDrawerOpen, setIsTradeDrawerOpen] = useState(false);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [favorites, setFavorites] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: 'market_cap', direction: 'desc' });
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  // Mobile Detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    checkMobile();
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handlers
  const handleSelectTokenForTrade = useCallback((token) => {
    setSelectedToken(token);
    if (isMobile) {
      setIsDetailSheetOpen(true);
    }
    // Desktop: Detail panel updates automatically
  }, [isMobile]);

  const handleSelectTokenForDetail = useCallback((token) => {
    setSelectedToken(token);
    if (isMobile) {
      setIsDetailSheetOpen(true);
    }
  }, [isMobile]);

  const handleToggleFavorite = useCallback((mint) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(mint)) {
        newFavorites.delete(mint);
      } else {
        newFavorites.add(mint);
      }
      return newFavorites;
    });
  }, []);

  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  }, []);

  // Filter and Sort
  const filteredTokens = useMemo(() => {
    let result = tokens.filter(t => {
      const matchesSearch = t.symbol.toLowerCase().includes(search.toLowerCase()) || 
                            t.name.toLowerCase().includes(search.toLowerCase());
      
      const matchesSource = filter === 'all' || 
                            (filter === 'pump' && t.bonding_curve_status !== 'migrated') ||
                            (filter === 'ray' && t.bonding_curve_status === 'migrated');
      
      const matchesLiquidity = (t.liquidity || 0) >= minLiquidity;
      const matchesMarketCap = (t.market_cap || 0) >= minMarketCap;
      const matchesChange = (t.priceChange24h || 0) >= minChange24h;
      const matchesFavorites = !showOnlyFavorites || favorites.has(t.mint);

      return matchesSearch && matchesSource && matchesLiquidity && matchesMarketCap && matchesChange && matchesFavorites;
    });

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortConfig.key] || 0;
      let bVal = b[sortConfig.key] || 0;
      
      if (sortConfig.direction === 'asc') {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });

    return result;
  }, [tokens, search, filter, minLiquidity, minMarketCap, minChange24h, showOnlyFavorites, favorites, sortConfig]);

  const activeFiltersCount = (minLiquidity > 0 ? 1 : 0) + (minMarketCap > 0 ? 1 : 0) + (minChange24h > 0 ? 1 : 0);

  const clearFilters = () => {
    setMinLiquidity(0);
    setMinMarketCap(0);
    setMinChange24h(0);
    setFilter('all');
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden">
      
      {/* ===== COMPACT TOP BAR ===== */}
      <div className="bg-[#0f172a] border-b border-gray-800 px-3 py-2 flex items-center justify-between shrink-0 h-10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">
            ⚡ NextTrade Terminal
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className={`flex items-center gap-1 ${connectionStatus === 'connected' ? 'text-emerald-400' : 'text-red-400'}`}>
            {connectionStatus === 'connected' ? (
              <>
                <Wifi className="w-2.5 h-2.5 animate-pulse" />
                Live
              </>
            ) : (
              <>
                <WifiOff className="w-2.5 h-2.5" />
                Offline
              </>
            )}
          </span>
          <span className="text-gray-600">•</span>
          <span className="text-gray-500">{tokens.length} tokens</span>
        </div>
      </div>

      {/* ===== SEARCH & FILTER BAR ===== */}
      <div className="bg-[#0f172a] border-b border-gray-800 px-3 py-2 shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
            <Input 
              placeholder="Search token, symbol, or contract..." 
              className="pl-7 h-7 text-xs bg-gray-900 border-gray-700 focus:border-emerald-500 rounded"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            className={`h-7 w-7 border-gray-700 flex-shrink-0 ${showFilters || activeFiltersCount > 0 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/50' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-3 h-3" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className={`h-7 w-7 border-gray-700 flex-shrink-0 ${showOnlyFavorites ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/50' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
            onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
          >
            <Star className="w-3 h-3" />
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="space-y-1.5 pt-1.5 border-t border-gray-800 text-xs">
            
            {/* Source Filter */}
            <div className="flex gap-1">
              <span className="text-gray-600 w-12">Source:</span>
              <div className="flex gap-0.5 bg-gray-900 p-0.5 rounded border border-gray-800">
                {['all', 'pump', 'ray'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2 py-0.5 rounded text-xs transition-colors font-medium ${filter === f ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                  >
                    {f === 'ray' ? 'Ray' : f === 'pump' ? 'Pump' : 'All'}
                  </button>
                ))}
              </div>
            </div>

            {/* Numeric Filters */}
            <div className="flex flex-wrap gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={`h-6 px-2 text-xs border-gray-700 ${minLiquidity > 0 ? 'text-emerald-400 border-emerald-500/50' : 'text-gray-400'}`}>
                    Liq {minLiquidity > 0 ? `$${minLiquidity}k` : ''}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-gray-900 border-gray-700 text-xs">
                  <DropdownMenuLabel>Min Liquidity</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  {[0, 5, 10, 50, 100].map(val => (
                    <DropdownMenuItem key={val} onClick={() => setMinLiquidity(val)} className="hover:bg-gray-800 text-xs">
                      {val === 0 ? 'Any' : `$${val}k+`}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={`h-6 px-2 text-xs border-gray-700 ${minMarketCap > 0 ? 'text-emerald-400 border-emerald-500/50' : 'text-gray-400'}`}>
                    MCap {minMarketCap > 0 ? `$${minMarketCap}k` : ''}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-gray-900 border-gray-700 text-xs">
                  <DropdownMenuLabel>Min Market Cap</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  {[0, 50, 100, 500, 1000].map(val => (
                    <DropdownMenuItem key={val} onClick={() => setMinMarketCap(val)} className="hover:bg-gray-800 text-xs">
                      {val === 0 ? 'Any' : `$${val}k+`}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={`h-6 px-2 text-xs border-gray-700 ${minChange24h > 0 ? 'text-emerald-400 border-emerald-500/50' : 'text-gray-400'}`}>
                    24h {minChange24h > 0 ? `${minChange24h}%` : ''}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-gray-900 border-gray-700 text-xs">
                  <DropdownMenuLabel>Min 24h Change</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  {[0, 10, 50, 100, 500].map(val => (
                    <DropdownMenuItem key={val} onClick={() => setMinChange24h(val)} className="hover:bg-gray-800 text-xs">
                      {val === 0 ? 'Any' : `${val}%+`}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10">
                  Clear
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== MAIN CONTENT AREA ===== */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT: Token List */}
        <div className={`flex-1 flex flex-col overflow-hidden ${selectedToken && !isMobile ? 'max-w-[65%] border-r border-gray-800' : 'w-full'}`}>
          
          {/* Column Headers */}
          <div className="bg-[#0f172a] border-b border-gray-800 px-2 h-6 flex items-center text-xs font-bold text-gray-600 uppercase tracking-wider shrink-0">
            <div className="w-5"></div>
            <div className="w-16">Token</div>
            <div className="hidden sm:block w-32">Name</div>
            <div className="w-20 text-right">Price</div>
            <div className="w-16 text-right">24h %</div>
            <div className="w-20 text-right">MCap</div>
            <div className="w-20 text-right">Liq</div>
            <div className="hidden sm:block w-20 text-right">Vol</div>
            <div className="hidden md:block w-16 text-right">Holders</div>
            <div className="ml-auto">Action</div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center flex-1 p-8">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
              <p className="text-xs text-gray-400">Connecting to Pump.fun & Jupiter...</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {filteredTokens.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <p className="text-xs text-gray-500">No tokens found</p>
                </div>
              ) : (
                <div>
                  {filteredTokens.map(token => (
                    <TokenRow 
                      key={token.mint} 
                      token={token} 
                      onTrade={handleSelectTokenForTrade} 
                      onDetail={handleSelectTokenForDetail}
                      isFavorite={favorites.has(token.mint)}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Detail Panel (Desktop Only) - Always Visible */}
        {!isMobile && (
          <div className="w-[380px] border-l border-gray-800 bg-[#0f172a] flex-shrink-0 flex flex-col transition-all duration-300">
            {selectedToken ? (
              <MemeDetailPanel 
                token={selectedToken} 
                onClose={() => setSelectedToken(null)} 
                onTrade={handleSelectTokenForTrade}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4 p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center border border-gray-800">
                  <TrendingUp className="w-8 h-8 text-gray-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-400 mb-1">Select a Token</h3>
                  <p className="text-xs text-gray-600">Click on any token in the list to view live stats, safety check, and trading panel.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== MOBILE: Detail Sheet ===== */}
      {isMobile && selectedToken && (
        <Sheet open={isDetailSheetOpen} onOpenChange={(open) => {
          setIsDetailSheetOpen(open);
          if (!open) setSelectedToken(null);
        }}>
          <SheetContent side="bottom" className="h-[90vh] p-0 bg-[#0f172a] border-t border-gray-800">
            <SheetHeader className="p-3 border-b border-gray-800">
              <SheetTitle className="text-white text-sm">{selectedToken.symbol} - {selectedToken.name}</SheetTitle>
            </SheetHeader>
            <div className="h-[calc(100%-50px)] overflow-y-auto">
              <MemeDetailPanel 
                token={selectedToken} 
                onClose={() => setIsDetailSheetOpen(false)} 
                onTrade={handleSelectTokenForTrade}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Trade Drawer Removed - Unified into Detail Panel */}
    </div>
  );
};

export default function MemeCoins() {
  return (
    <MemeDataProvider>
      <MemeCoinsContent />
    </MemeDataProvider>
  );
}