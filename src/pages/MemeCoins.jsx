import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useMemeData, MemeDataProvider } from '@/components/meme/MemeDataContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search, Loader2, Wifi, WifiOff, Filter, X, ChevronDown, TrendingUp, TrendingDown, 
  Zap, Star, BarChart3, Flame, DollarSign, Eye, EyeOff, Menu, Settings
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
  if (num < 0.00001) return num.toExponential(2);
  if (num < 0.01) return num.toFixed(6);
  if (num < 1) return num.toFixed(4);
  return num.toFixed(2);
};

const formatMarketCap = (num) => {
  if (!num) return '--';
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
};

const formatVolume = (num) => {
  if (!num) return '--';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toFixed(0);
};

// ============================================================================
// MOBILE TOKEN CARD (Beautiful, Responsive)
// ============================================================================

const MobileTokenCard = React.memo(({ token, onTrade, onDetail, isFavorite, onToggleFavorite }) => {
  const priceChange = token.priceChange24h || 0;
  const isPositive = priceChange >= 0;

  return (
    <div 
      className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-4 mb-3 cursor-pointer hover:border-emerald-500/50 transition-all duration-300 shadow-lg"
      onClick={() => onDetail(token)}
    >
      {/* Header: Token Info + Favorite */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-lg">
            {token.symbol.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base text-white truncate">{token.symbol}</h3>
            <p className="text-sm text-slate-400 truncate">{token.name}</p>
          </div>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(token.mint);
          }}
          className="text-slate-400 hover:text-yellow-400 transition-colors flex-shrink-0"
        >
          <Star className={`w-5 h-5 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
        </button>
      </div>

      {/* Price Row */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-700/30">
        <span className="text-2xl font-bold text-white">{formatPrice(token.price)}</span>
        <span className={`text-lg font-bold flex items-center gap-1 px-3 py-1 rounded-lg ${isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {priceChange.toFixed(2)}%
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/30">
          <p className="text-xs text-slate-500 mb-1 font-semibold">MCap</p>
          <p className="font-bold text-white text-sm">{formatMarketCap(token.market_cap)}</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/30">
          <p className="text-xs text-slate-500 mb-1 font-semibold">Liquidity</p>
          <p className="font-bold text-white text-sm">{formatMarketCap(token.liquidity)}</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/30">
          <p className="text-xs text-slate-500 mb-1 font-semibold">Volume</p>
          <p className="font-bold text-white text-sm">{formatVolume(token.volume24h)}</p>
        </div>
      </div>

      {/* Quick Actions - Full Width on Mobile */}
      <div className="flex gap-2 w-full">
        <Button 
          className="flex-1 h-10 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold rounded-lg transition-all duration-300 shadow-lg"
          onClick={(e) => {
            e.stopPropagation();
            onTrade(token);
          }}
        >
          <Zap className="w-4 h-4 mr-2" /> Buy Now
        </Button>
        <Button 
          className="flex-1 h-10 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-bold rounded-lg transition-all duration-300 border border-slate-600/50"
          onClick={(e) => {
            e.stopPropagation();
            onDetail(token);
          }}
        >
          <BarChart3 className="w-4 h-4 mr-2" /> Chart
        </Button>
      </div>
    </div>
  );
});

// ============================================================================
// DESKTOP TOKEN ROW (Beautiful, High-Density)
// ============================================================================

const DesktopTokenRow = React.memo(({ token, onTrade, onDetail, isFavorite, onToggleFavorite }) => {
  const priceChange = token.priceChange24h || 0;
  const isPositive = priceChange >= 0;

  return (
    <div 
      className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30 hover:bg-slate-800/30 transition-all duration-200 cursor-pointer group backdrop-blur-sm"
      onClick={() => onDetail(token)}
    >
      {/* Favorite + Token Name */}
      <div className="flex items-center gap-3 min-w-[220px]">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(token.mint);
          }}
          className="text-slate-500 hover:text-yellow-400 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
        </button>
        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-lg">
          {token.symbol.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-white truncate">{token.symbol}</h3>
          <p className="text-xs text-slate-500 truncate">{token.name}</p>
        </div>
      </div>

      {/* Price */}
      <div className="min-w-[110px] text-right">
        <p className="font-bold text-white">{formatPrice(token.price)}</p>
      </div>

      {/* 24h Change */}
      <div className="min-w-[100px] text-right">
        <span className={`font-bold flex items-center justify-end gap-1 px-2 py-1 rounded-lg ${isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {priceChange.toFixed(2)}%
        </span>
      </div>

      {/* Market Cap */}
      <div className="min-w-[110px] text-right">
        <p className="text-sm text-slate-300">{formatMarketCap(token.market_cap)}</p>
      </div>

      {/* Liquidity */}
      <div className="min-w-[110px] text-right">
        <p className="text-sm text-slate-300">{formatMarketCap(token.liquidity)}</p>
      </div>

      {/* Volume */}
      <div className="min-w-[100px] text-right">
        <p className="text-sm text-slate-300">{formatVolume(token.volume24h)}</p>
      </div>

      {/* Holders */}
      <div className="min-w-[80px] text-right">
        <p className="text-sm text-slate-300">{token.holders || '--'}</p>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 ml-4">
        <Button 
          size="sm" 
          className="h-8 px-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold rounded-lg transition-all duration-300"
          onClick={(e) => {
            e.stopPropagation();
            onTrade(token);
          }}
        >
          <Zap className="w-3 h-3" />
        </Button>
        <Button 
          size="sm" 
          className="h-8 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all duration-300 border border-slate-600/50"
          onClick={(e) => {
            e.stopPropagation();
            onDetail(token);
          }}
        >
          📊
        </Button>
      </div>
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
    setIsTradeDrawerOpen(true);
  }, []);

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
    <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col overflow-hidden">
      
      {/* ===== PREMIUM TOP BAR ===== */}
      <div className="bg-gradient-to-r from-slate-900/80 to-slate-800/80 backdrop-blur-xl border-b border-slate-700/50 px-4 py-3 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-lg flex items-center justify-center font-bold text-sm shadow-lg">
            ⚡
          </div>
          <div>
            <h1 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              NextTrade
            </h1>
            <p className="text-xs text-slate-500">Meme Trading Terminal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-full border border-slate-700/50 backdrop-blur-sm">
            {connectionStatus === 'connected' ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-400 font-semibold">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-red-500" />
                <span className="text-xs text-red-400 font-semibold">Offline</span>
              </>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-full border border-slate-700/50 backdrop-blur-sm">
            <span className="text-xs text-slate-400">{tokens.length} Tokens</span>
          </div>
        </div>
      </div>

      {/* ===== SEARCH & FILTER BAR ===== */}
      <div className="bg-slate-900/50 backdrop-blur-md border-b border-slate-700/50 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input 
              placeholder="Search token, symbol, or contract..." 
              className="pl-10 h-10 text-sm bg-slate-800/50 border-slate-700/50 focus:border-emerald-500 rounded-lg backdrop-blur-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            className={`h-10 w-10 border-slate-700/50 flex-shrink-0 rounded-lg transition-all duration-300 ${showFilters || activeFiltersCount > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-slate-800/50 text-slate-400 hover:text-white'}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className={`h-10 w-10 border-slate-700/50 flex-shrink-0 rounded-lg transition-all duration-300 ${showOnlyFavorites ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' : 'bg-slate-800/50 text-slate-400 hover:text-white'}`}
            onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
          >
            <Star className="w-4 h-4" />
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="space-y-3 pt-3 border-t border-slate-700/50 animate-in fade-in slide-in-from-top-2">
            
            {/* Source Filter */}
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs text-slate-500 font-semibold pt-2">Source:</span>
              <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
                {['all', 'pump', 'ray'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 text-xs rounded-md capitalize transition-all duration-300 font-medium ${filter === f ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700/50'}`}
                  >
                    {f === 'ray' ? 'Raydium' : f === 'pump' ? 'Pump.fun' : 'All'}
                  </button>
                ))}
              </div>
            </div>

            {/* Numeric Filters */}
            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={`h-9 text-xs border-slate-700/50 rounded-lg transition-all duration-300 ${minLiquidity > 0 ? 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10' : 'text-slate-400 bg-slate-800/50'}`}>
                    <DollarSign className="w-3 h-3 mr-1" /> Liquidity {minLiquidity > 0 ? `> $${minLiquidity}k` : ''}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-900 border-slate-700/50">
                  <DropdownMenuLabel>Min Liquidity</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-700/50" />
                  {[0, 5, 10, 50, 100].map(val => (
                    <DropdownMenuItem key={val} onClick={() => setMinLiquidity(val)} className="hover:bg-slate-800">
                      {val === 0 ? 'Any' : `$${val}k+`}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={`h-9 text-xs border-slate-700/50 rounded-lg transition-all duration-300 ${minMarketCap > 0 ? 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10' : 'text-slate-400 bg-slate-800/50'}`}>
                    <BarChart3 className="w-3 h-3 mr-1" /> MCap {minMarketCap > 0 ? `> $${minMarketCap}k` : ''}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-900 border-slate-700/50">
                  <DropdownMenuLabel>Min Market Cap</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-700/50" />
                  {[0, 50, 100, 500, 1000].map(val => (
                    <DropdownMenuItem key={val} onClick={() => setMinMarketCap(val)} className="hover:bg-slate-800">
                      {val === 0 ? 'Any' : `$${val}k+`}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={`h-9 text-xs border-slate-700/50 rounded-lg transition-all duration-300 ${minChange24h > 0 ? 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10' : 'text-slate-400 bg-slate-800/50'}`}>
                    <Flame className="w-3 h-3 mr-1" /> 24h {minChange24h > 0 ? `> ${minChange24h}%` : ''}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-900 border-slate-700/50">
                  <DropdownMenuLabel>Min 24h Change</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-700/50" />
                  {[0, 10, 50, 100, 500].map(val => (
                    <DropdownMenuItem key={val} onClick={() => setMinChange24h(val)} className="hover:bg-slate-800">
                      {val === 0 ? 'Any' : `${val}%+`}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg">
                  <X className="w-3 h-3 mr-1" /> Clear All
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== MAIN CONTENT AREA ===== */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT: Token List */}
        <div className={`flex-1 flex flex-col overflow-hidden ${selectedToken && !isMobile ? 'max-w-[65%] border-r border-slate-700/50' : 'w-full'}`}>
          
          {/* Desktop: Column Headers */}
          {!isMobile && (
            <div className="bg-slate-900/50 backdrop-blur-md border-b border-slate-700/50 px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
              <div className="min-w-[220px]">Token</div>
              <div className="min-w-[110px] text-right">Price</div>
              <div className="min-w-[100px] text-right">24h %</div>
              <div className="min-w-[110px] text-right">MCap</div>
              <div className="min-w-[110px] text-right">Liquidity</div>
              <div className="min-w-[100px] text-right">Volume</div>
              <div className="min-w-[80px] text-right">Holders</div>
              <div className="min-w-[80px] text-right">Action</div>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center flex-1 p-8">
              <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mb-3" />
              <p className="text-sm text-slate-400">Connecting to Pump.fun & Jupiter...</p>
              <p className="text-xs text-slate-600 mt-2">Fetching real-time data</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {filteredTokens.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <Search className="w-14 h-14 text-slate-700 mb-3" />
                  <p className="text-slate-400 font-semibold">No tokens found</p>
                  <p className="text-xs text-slate-600 mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                <div>
                  {isMobile ? (
                    // Mobile: Card Grid
                    <div className="p-4 space-y-3 pb-20">
                      {filteredTokens.map(token => (
                        <MobileTokenCard 
                          key={token.mint} 
                          token={token} 
                          onTrade={handleSelectTokenForTrade} 
                          onDetail={handleSelectTokenForDetail}
                          isFavorite={favorites.has(token.mint)}
                          onToggleFavorite={handleToggleFavorite}
                        />
                      ))}
                    </div>
                  ) : (
                    // Desktop: High-Density List
                    <div>
                      {filteredTokens.map(token => (
                        <DesktopTokenRow 
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
          )}
        </div>

        {/* RIGHT: Detail Panel (Desktop Only) */}
        {!isMobile && (
          <div className={`${selectedToken ? 'w-[35%] min-w-[380px]' : 'w-0'} transition-all duration-300 ease-in-out overflow-y-auto`}>
            {selectedToken && (
              <MemeDetailPanel 
                token={selectedToken} 
                onClose={() => setSelectedToken(null)} 
                onTrade={handleSelectTokenForTrade}
              />
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
          <SheetContent side="bottom" className="h-[90vh] p-0 bg-gradient-to-br from-slate-900 to-slate-950 border-t border-slate-700/50">
            <SheetHeader className="p-4 border-b border-slate-700/50">
              <SheetTitle className="text-white text-base">{selectedToken?.symbol} - {selectedToken?.name}</SheetTitle>
            </SheetHeader>
            <div className="h-[calc(100%-60px)] overflow-y-auto">
              <MemeDetailPanel 
                token={selectedToken} 
                onClose={() => setIsDetailSheetOpen(false)} 
                onTrade={handleSelectTokenForTrade}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* ===== TRADE DRAWER (Jupiter Swap) ===== */}
      <TradeDrawer 
        open={isTradeDrawerOpen} 
        onOpenChange={(open) => {
          setIsTradeDrawerOpen(open);
          if (!open) setSelectedToken(null);
        }}
        token={selectedToken}
      />
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
