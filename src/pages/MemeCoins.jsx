import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useMemeData, MemeDataProvider } from '@/components/meme/MemeDataContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search, Loader2, Wifi, WifiOff, Filter, X, ChevronDown, TrendingUp, TrendingDown, 
  Zap, Star, BarChart3, Flame, DollarSign, Clock, Activity, ArrowUpDown, ArrowUp, ArrowDown,
  Sparkles, Info, RefreshCw
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TradeDrawer from '@/components/meme/TradeDrawer';
import MemeDetailPanel from '@/components/meme/MemeDetailPanel';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatPrice = (num) => {
  if (!num || num === 0) return '$0.00';
  if (num < 0.000001) return `$${num.toExponential(2)}`;
  if (num < 0.00001) return `$${num.toFixed(10)}`;
  if (num < 0.01) return `$${num.toFixed(8)}`;
  if (num < 1) return `$${num.toFixed(6)}`;
  return `$${num.toFixed(4)}`;
};

const formatMarketCap = (num) => {
  if (!num || num === 0) return '--';
  if (num >= 1000000000) return `$${(num / 1000000000).toFixed(2)}B`;
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
};

const formatVolume = (num) => {
  if (!num || num === 0) return '--';
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
};

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return 'Just now';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 0) return 'Just now';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

// ============================================================================
// MOBILE TOKEN CARD
// ============================================================================

const MobileTokenCard = React.memo(({ token, onTrade, onDetail, isFavorite, onToggleFavorite, isPumpfun }) => {
  const txns = (token.buys_5m || 0) + (token.sells_5m || 0);
  const priceChange = token.priceChange5m || 0;
  const isPositive = priceChange >= 0;
  const imageUrl = token.image_url || null;

  return (
    <div 
      className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-4 mb-3 cursor-pointer hover:border-emerald-500/50 hover:shadow-emerald-500/10 hover:shadow-xl transition-all duration-300 shadow-lg"
      onClick={() => onDetail(token)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-emerald-500 to-cyan-500 border border-slate-700/50 shadow-lg">
            {imageUrl ? (
              <img 
                src={imageUrl} 
                alt={token.symbol}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : null}
            <div className={`w-full h-full flex items-center justify-center text-sm font-bold text-white ${imageUrl ? 'hidden' : ''}`}>
              {token.symbol?.charAt(0)?.toUpperCase() || '?'}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-white truncate">{token.symbol}</h3>
              {isPumpfun ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-pink-500/20 text-pink-400 border border-pink-500/30">
                  PUMP
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  DEX
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 truncate">{token.name}</p>
          </div>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(token.mint); }}
          className="text-slate-400 hover:text-yellow-400 transition-colors flex-shrink-0 p-1"
        >
          <Star className={`w-5 h-5 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
        </button>
      </div>

      {/* Key Metrics Row */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-700/30">
        <div>
          <p className="text-[10px] text-slate-500 mb-0.5">Age</p>
          <p className="text-sm font-bold text-emerald-400">{formatTimeAgo(token.createdAt)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-500 mb-0.5">MCap</p>
          <p className="text-sm font-semibold text-white">{formatMarketCap(token.market_cap)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-500 mb-0.5">Liq</p>
          <p className="text-sm font-semibold text-cyan-400">{formatMarketCap(token.liquidity)}</p>
        </div>
        {isPumpfun && token.bondingProgress !== undefined ? (
          <div className="px-2 py-1 rounded-lg bg-pink-500/20">
            <p className="text-[9px] text-slate-500 mb-0.5">Progress</p>
            <p className="text-sm font-bold text-pink-400">{token.bondingProgress.toFixed(0)}%</p>
          </div>
        ) : (
          <div className={`px-2 py-1 rounded-lg ${isPositive ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
            <p className="text-[9px] text-slate-500 mb-0.5">5m</p>
            <p className={`text-sm font-bold flex items-center gap-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(priceChange).toFixed(1)}%
            </p>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-700/30 text-center">
          <p className="text-[10px] text-slate-500 mb-0.5 font-medium">Volume</p>
          <p className="font-bold text-white text-xs">{formatVolume(token.volume24h)}</p>
        </div>
        <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-700/30 text-center">
          <p className="text-[10px] text-slate-500 mb-0.5 font-medium">Txns (5m)</p>
          <p className="font-bold text-blue-400 text-xs">{txns}</p>
        </div>
        <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-700/30 text-center">
          <p className="text-[10px] text-slate-500 mb-0.5 font-medium">Holders</p>
          <p className="font-bold text-purple-400 text-xs">{token.holders || '--'}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 w-full">
        <Button 
          className="flex-1 h-11 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold rounded-xl transition-all duration-300 shadow-lg shadow-emerald-500/20"
          onClick={(e) => { e.stopPropagation(); onTrade(token); }}
        >
          <Zap className="w-4 h-4 mr-2 fill-current" /> Quick Buy
        </Button>
        <Button 
          className="flex-1 h-11 bg-slate-700/80 hover:bg-slate-600 text-white font-bold rounded-xl transition-all duration-300 border border-slate-600/50"
          onClick={(e) => { e.stopPropagation(); onDetail(token); }}
        >
          <BarChart3 className="w-4 h-4 mr-2" /> Chart
        </Button>
      </div>
    </div>
  );
});

// ============================================================================
// DESKTOP TOKEN ROW
// ============================================================================

const DesktopTokenRow = React.memo(({ token, onTrade, onDetail, isFavorite, onToggleFavorite, isPumpfun }) => {
  const txns = (token.buys_5m || 0) + (token.sells_5m || 0);
  const priceChange = token.priceChange5m || 0;
  const isPositive = priceChange >= 0;
  const imageUrl = token.image_url || null;

  return (
    <div 
      className="flex items-center justify-between px-4 py-3 border-b border-slate-700/20 hover:bg-slate-800/40 transition-all duration-200 cursor-pointer group"
      onClick={() => onDetail(token)}
    >
      {/* Favorite + Token */}
      <div className="flex items-center gap-3 min-w-[200px]">
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(token.mint); }}
          className="text-slate-600 hover:text-yellow-400 transition-colors"
        >
          <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-400 text-yellow-400 opacity-100' : 'opacity-50 group-hover:opacity-100'}`} />
        </button>
        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-emerald-500 to-cyan-500 border border-slate-700/50">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={token.symbol}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : null}
          <div className={`w-full h-full flex items-center justify-center text-xs font-bold text-white ${imageUrl ? 'hidden' : ''}`}>
            {token.symbol?.charAt(0)?.toUpperCase() || '?'}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-sm text-white truncate group-hover:text-emerald-400 transition-colors">{token.symbol}</h3>
            {isPumpfun ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-pink-500/20 text-pink-400">PUMP</span>
            ) : (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-purple-500/20 text-purple-400">DEX</span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate max-w-[120px]">{token.name}</p>
        </div>
      </div>

      {/* 5m Change or Bonding Progress */}
      <div className="min-w-[70px] text-right">
        {isPumpfun && token.bondingProgress !== undefined ? (
          <span className="text-sm font-semibold text-pink-400">{token.bondingProgress.toFixed(0)}%</span>
        ) : (
          <span className={`text-sm font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{priceChange.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Age */}
      <div className="min-w-[60px] text-right">
        <p className="text-sm font-medium text-emerald-400">{formatTimeAgo(token.createdAt)}</p>
      </div>

      {/* Market Cap */}
      <div className="min-w-[90px] text-right">
        <p className="text-sm font-medium text-white">{formatMarketCap(token.market_cap)}</p>
      </div>

      {/* Liquidity */}
      <div className="min-w-[90px] text-right">
        <p className="text-sm font-medium text-cyan-400">{formatMarketCap(token.liquidity)}</p>
      </div>

      {/* Volume */}
      <div className="min-w-[80px] text-right">
        <p className="text-sm text-slate-400">{formatVolume(token.volume24h)}</p>
      </div>

      {/* Txns */}
      <div className="min-w-[60px] text-right">
        <span className="text-sm font-medium text-blue-400">{txns}</span>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 ml-4">
        <Button 
          size="sm" 
          className="h-8 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold rounded-lg transition-all duration-300 shadow-lg shadow-emerald-500/20"
          onClick={(e) => { e.stopPropagation(); onTrade(token); }}
        >
          <Zap className="w-3 h-3 mr-1 fill-current" /> Buy
        </Button>
        <Button 
          size="sm" 
          className={`h-8 px-3 rounded-lg transition-all duration-300 border ${isPumpfun && !token.liquidity ? 'bg-slate-800/50 text-slate-500 border-slate-700/50 cursor-not-allowed' : 'bg-slate-700/80 hover:bg-slate-600 text-white border-slate-600/50'}`}
          onClick={(e) => { e.stopPropagation(); onDetail(token); }}
          disabled={isPumpfun && !token.liquidity}
          title={isPumpfun && !token.liquidity ? 'No pool yet (bonding curve)' : 'View chart'}
        >
          <BarChart3 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const MemeCoinsContent = () => {
  const { 
    migratedTokens, 
    pumpfunTokens, 
    loadingMigrated, 
    loadingPumpfun,
    activeTab,
    setActiveTab,
    refreshMigrated,
    refreshPumpfun,
    connectionStatus,
    diagnostics
  } = useMemeData();
  
  const [search, setSearch] = useState('');
  const [selectedToken, setSelectedToken] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isTradeDrawerOpen, setIsTradeDrawerOpen] = useState(false);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [favorites, setFavorites] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  // Filter states
  const [minLiquidity, setMinLiquidity] = useState(0);
  const [minMarketCap, setMinMarketCap] = useState(0);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    checkMobile();
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setSearch('');
    setSortConfig({ key: 'createdAt', direction: 'desc' });
  }, [setActiveTab]);

  const handleRefresh = useCallback(() => {
    if (activeTab === 'migrated') {
      refreshMigrated();
    } else {
      refreshPumpfun();
    }
  }, [activeTab, refreshMigrated, refreshPumpfun]);

  // Get current tokens based on active tab
  const currentTokens = activeTab === 'migrated' ? migratedTokens : pumpfunTokens;
  const loading = activeTab === 'migrated' ? loadingMigrated : loadingPumpfun;
  const isPumpfunTab = activeTab === 'pumpfun';

  const filteredTokens = useMemo(() => {
    // Clone and filter - never mutate original array
    const result = [...currentTokens].filter(t => {
      const matchesSearch = t.symbol.toLowerCase().includes(search.toLowerCase()) || 
                            t.name.toLowerCase().includes(search.toLowerCase());
      const matchesLiquidity = (t.liquidity || 0) >= minLiquidity * 1000;
      const matchesMarketCap = (t.market_cap || 0) >= minMarketCap * 1000;
      const matchesFavorites = !showOnlyFavorites || favorites.has(t.mint);

      return matchesSearch && matchesLiquidity && matchesMarketCap && matchesFavorites;
    });

    // Sort on cloned array
    result.sort((a, b) => {
      let aVal, bVal;

      if (sortConfig.key === 'txns') {
        aVal = (a.buys_5m || 0) + (a.sells_5m || 0);
        bVal = (b.buys_5m || 0) + (b.sells_5m || 0);
      } else if (sortConfig.key === 'bondingProgress') {
        aVal = a.bondingProgress || 0;
        bVal = b.bondingProgress || 0;
      } else {
        aVal = a[sortConfig.key] || 0;
        bVal = b[sortConfig.key] || 0;
      }
      
      if (sortConfig.direction === 'asc') {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });

    return result;
  }, [currentTokens, search, minLiquidity, minMarketCap, showOnlyFavorites, favorites, sortConfig]);

  const activeFiltersCount = (minLiquidity > 0 ? 1 : 0) + (minMarketCap > 0 ? 1 : 0);

  const clearFilters = () => {
    setMinLiquidity(0);
    setMinMarketCap(0);
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1 text-emerald-400" />
      : <ArrowDown className="w-3 h-3 ml-1 text-emerald-400" />;
  };

  const HeaderCell = ({ label, columnKey, align = 'right', minWidth = '100px' }) => (
    <div 
      className={`min-w-[${minWidth}] text-${align} flex items-center ${align === 'right' ? 'justify-end' : ''} cursor-pointer hover:text-white transition-colors select-none`}
      onClick={() => handleSort(columnKey)}
    >
      {label}
      <SortIcon columnKey={columnKey} />
    </div>
  );

  return (
    <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col overflow-hidden">
      
      {/* ===== TOP BAR ===== */}
      <div className="bg-gradient-to-r from-slate-900/95 via-slate-900/90 to-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 px-4 py-3 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Meme Terminal</h1>
              <p className="text-[10px] text-slate-500 -mt-0.5">Solana Meme Coins</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs text-slate-400 hover:text-white"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            <span className="ml-1 hidden sm:inline">Refresh</span>
          </Button>
          <button 
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300"
          >
            <Info className="w-4 h-4" />
          </button>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-sm ${connectionStatus === 'connected' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            {connectionStatus === 'connected' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-400 font-semibold">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-red-500" />
                <span className="text-xs text-red-400 font-semibold">...</span>
              </>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-full border border-slate-700/50 backdrop-blur-sm">
            <span className="text-xs text-slate-300 font-medium">{filteredTokens.length}</span>
            <span className="text-xs text-slate-500">tokens</span>
          </div>
        </div>
      </div>

      {/* ===== DIAGNOSTICS PANEL ===== */}
      {showDiagnostics && (
        <div className="bg-slate-900/80 border-b border-slate-700/50 px-4 py-2 text-xs font-mono">
          <div className="flex items-center gap-6 text-slate-400">
            <span className="text-slate-500">Migrated:</span>
            <span>{diagnostics.migrated?.count || 0} tokens</span>
            <span>Newest: {diagnostics.migrated?.newest?.slice(0, 19) || '--'}</span>
            <span>Source: {diagnostics.migrated?.source || '--'}</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-500">Pump.fun:</span>
            <span>{diagnostics.pumpfun?.count || 0} tokens</span>
            <span>Newest: {diagnostics.pumpfun?.newest?.slice(0, 19) || '--'}</span>
            <span>Source: {diagnostics.pumpfun?.source || '--'}</span>
          </div>
        </div>
      )}

      {/* ===== TAB SWITCHER ===== */}
      <div className="bg-slate-900/50 backdrop-blur-md border-b border-slate-700/50 px-4 py-2 shrink-0">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full max-w-md bg-slate-800/50 border border-slate-700/50">
            <TabsTrigger 
              value="migrated" 
              className="flex-1 data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-400"
            >
              <Activity className="w-4 h-4 mr-2" />
              Migrated (Dex)
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-slate-700/50">{migratedTokens.length}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="pumpfun" 
              className="flex-1 data-[state=active]:bg-pink-600/20 data-[state=active]:text-pink-400"
            >
              <Flame className="w-4 h-4 mr-2" />
              Pump.fun (Bonding)
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-slate-700/50">{pumpfunTokens.length}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ===== SEARCH & FILTER ===== */}
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

        {showFilters && (
          <div className="space-y-3 pt-3 border-t border-slate-700/50 animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={`h-9 text-xs border-slate-700/50 rounded-lg transition-all duration-300 ${minLiquidity > 0 ? 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10' : 'text-slate-400 bg-slate-800/50'}`}>
                    <DollarSign className="w-3 h-3 mr-1" /> Liquidity
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-900 border-slate-700/50">
                  <DropdownMenuLabel>Min Liquidity</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-700/50" />
                  {[0, 1, 5, 10, 50].map(val => (
                    <DropdownMenuItem key={val} onClick={() => setMinLiquidity(val)} className="hover:bg-slate-800">
                      {val === 0 ? 'Any' : `$${val}k+`}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={`h-9 text-xs border-slate-700/50 rounded-lg transition-all duration-300 ${minMarketCap > 0 ? 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10' : 'text-slate-400 bg-slate-800/50'}`}>
                    <BarChart3 className="w-3 h-3 mr-1" /> MCap
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-900 border-slate-700/50">
                  <DropdownMenuLabel>Min Market Cap</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-700/50" />
                  {[0, 10, 50, 100, 500].map(val => (
                    <DropdownMenuItem key={val} onClick={() => setMinMarketCap(val)} className="hover:bg-slate-800">
                      {val === 0 ? 'Any' : `$${val}k+`}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg">
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== CONTENT AREA ===== */}
      <div className="flex-1 flex overflow-hidden">
        
        <div className={`flex-1 flex flex-col overflow-hidden ${selectedToken && !isMobile ? 'max-w-[65%] border-r border-slate-700/50' : 'w-full'}`}>
          
          {!isMobile && (
            <div className="bg-slate-900/70 backdrop-blur-md border-b border-slate-700/50 px-4 py-2.5 flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">
              <div className="min-w-[200px]">Token</div>
              <HeaderCell label={isPumpfunTab ? "Progress" : "5m %"} columnKey={isPumpfunTab ? "bondingProgress" : "priceChange5m"} align="right" minWidth="70px" />
              <HeaderCell label="Age" columnKey="createdAt" align="right" minWidth="60px" />
              <HeaderCell label="MCap" columnKey="market_cap" align="right" minWidth="90px" />
              <HeaderCell label="Liq" columnKey="liquidity" align="right" minWidth="90px" />
              <HeaderCell label="Vol" columnKey="volume24h" align="right" minWidth="80px" />
              <HeaderCell label="Txns" columnKey="txns" align="right" minWidth="60px" />
              <div className="min-w-[120px] text-right">Action</div>
            </div>
          )}

          {loading && filteredTokens.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 p-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center mb-4 border border-emerald-500/30">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
              <p className="text-base font-semibold text-white mb-1">Loading {isPumpfunTab ? 'Pump.fun' : 'Migrated'} Coins</p>
              <p className="text-sm text-slate-400">Fetching latest data...</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {filteredTokens.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4 border border-slate-700/50">
                    <Search className="w-8 h-8 text-slate-600" />
                  </div>
                  <p className="text-lg font-semibold text-white mb-1">No tokens found</p>
                  <p className="text-sm text-slate-400 max-w-xs">Try adjusting your search or filters</p>
                  {activeFiltersCount > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={clearFilters}
                      className="mt-4 border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      Clear all filters
                    </Button>
                  )}
                </div>
              ) : (
                <div>
                  {isMobile ? (
                    <div className="p-4 space-y-3 pb-20">
                      {filteredTokens.map(token => (
                        <MobileTokenCard 
                          key={token.mint} 
                          token={token} 
                          onTrade={handleSelectTokenForTrade} 
                          onDetail={handleSelectTokenForDetail}
                          isFavorite={favorites.has(token.mint)}
                          onToggleFavorite={handleToggleFavorite}
                          isPumpfun={isPumpfunTab}
                        />
                      ))}
                    </div>
                  ) : (
                    <div>
                      {filteredTokens.map(token => (
                        <DesktopTokenRow 
                          key={token.mint} 
                          token={token} 
                          onTrade={handleSelectTokenForTrade} 
                          onDetail={handleSelectTokenForDetail}
                          isFavorite={favorites.has(token.mint)}
                          onToggleFavorite={handleToggleFavorite}
                          isPumpfun={isPumpfunTab}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

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

      {/* ===== MOBILE DETAIL SHEET ===== */}
      {isMobile && selectedToken && (
        <Sheet open={isDetailSheetOpen} onOpenChange={(open) => {
          setIsDetailSheetOpen(open);
          if (!open) setSelectedToken(null);
        }}>
          <SheetContent side="bottom" className="h-[90vh] p-0 bg-gradient-to-br from-slate-900 to-slate-950 border-t border-slate-700/50">
            <SheetHeader className="p-4 border-b border-slate-700/50">
              <SheetTitle className="text-white text-base">{selectedToken?.symbol}</SheetTitle>
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

      {/* ===== TRADE DRAWER ===== */}
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