import React, { useState, useEffect, useMemo } from 'react';
import { useMemeData, MemeDataProvider } from '@/components/meme/MemeDataContext';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Wifi, WifiOff, Filter, X, ChevronDown, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import TradeDrawer from '@/components/meme/TradeDrawer'; // Assuming this is the Jupiter Swap/Trade UI
import MemeDetailPanel from '@/components/meme/MemeDetailPanel'; // Assuming this is the chart/detail view

// --- Utility Functions ---
const formatNumber = (num, isPrice = false) => {
  if (num === undefined || num === null) return '--';
  if (isPrice) {
    return num < 0.01 ? num.toExponential(2) : num.toFixed(4);
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toFixed(2);
};

// --- New High-Density List Item Component (Mobile/Desktop) ---
const MemeListItem = React.memo(({ token, onTrade, onSelectDetail }) => {
  const priceChange = token.priceChange24h || 0;
  const isPositive = priceChange >= 0;
  const changeColor = isPositive ? 'text-emerald-400' : 'text-red-400';
  const changeIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div 
      className="flex items-center justify-between p-3 border-b border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer"
      onClick={() => onSelectDetail(token)}
    >
      {/* Left: Name, Symbol, Status */}
      <div className="flex flex-col min-w-[100px] sm:min-w-[150px]">
        <div className="flex items-center gap-2">
          {/* Placeholder for Token Logo - replace with actual image component */}
          <div className="w-5 h-5 bg-gray-600 rounded-full flex-shrink-0"></div>
          <span className="font-semibold text-sm truncate">{token.symbol}</span>
        </div>
        <span className="text-xs text-gray-500 truncate ml-7">{token.name}</span>
      </div>

      {/* Center: Price and 24h Change */}
      <div className="flex flex-col items-end min-w-[80px] sm:min-w-[100px]">
        <span className="text-sm font-medium">${formatNumber(token.price, true)}</span>
        <span className={`text-xs flex items-center ${changeColor}`}>
          <changeIcon className="w-3 h-3 mr-0.5" />
          {priceChange.toFixed(2)}%
        </span>
      </div>

      {/* Right: Market Cap, Liquidity, and Quick Trade Button */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end text-xs text-gray-400 min-w-[100px]">
          <span>MCap: ${formatNumber(token.market_cap)}</span>
          <span>Liq: ${formatNumber(token.liquidity)}</span>
        </div>
        <Button 
          size="sm" 
          className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold"
          onClick={(e) => {
            e.stopPropagation(); // Prevent detail panel from opening
            onTrade(token);
          }}
        >
          <Zap className="w-3 h-3 mr-1" /> Buy
        </Button>
      </div>
    </div>
  );
});

// --- Main Component ---
const MemeCoinsContent = () => {
  const { tokens, loading, connectionStatus } = useMemeData();
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

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768); // Use md breakpoint for mobile
    window.addEventListener('resize', checkMobile);
    checkMobile();
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSelectTokenForTrade = (token) => {
    setSelectedToken(token);
    setIsTradeDrawerOpen(true);
  };

  const handleSelectTokenForDetail = (token) => {
    setSelectedToken(token);
    if (isMobile) {
      setIsDetailSheetOpen(true);
    }
    // Desktop will handle the detail panel visibility based on selectedToken
  };

  const filteredTokens = useMemo(() => {
    return tokens.filter(t => {
      const matchesSearch = t.symbol.toLowerCase().includes(search.toLowerCase()) || 
                            t.name.toLowerCase().includes(search.toLowerCase());
      
      const matchesSource = filter === 'all' || 
                            (filter === 'pump' && t.bonding_curve_status !== 'migrated') ||
                            (filter === 'ray' && t.bonding_curve_status === 'migrated');
      
      const matchesLiquidity = (t.liquidity || 0) >= minLiquidity;
      const matchesMarketCap = (t.market_cap || 0) >= minMarketCap;
      const matchesChange = (t.priceChange24h || 0) >= minChange24h;

      return matchesSearch && matchesSource && matchesLiquidity && matchesMarketCap && matchesChange;
    });
  }, [tokens, search, filter, minLiquidity, minMarketCap, minChange24h]);

  const activeFiltersCount = (minLiquidity > 0 ? 1 : 0) + (minMarketCap > 0 ? 1 : 0) + (minChange24h > 0 ? 1 : 0);

  const clearFilters = () => {
    setMinLiquidity(0);
    setMinMarketCap(0);
    setMinChange24h(0);
    setFilter('all');
  };

  const connectionIcon = connectionStatus === 'connected' 
    ? <Wifi className="w-3 h-3 text-emerald-500" /> 
    : <WifiOff className="w-3 h-3 text-red-500" />;

  // --- Filter Dropdown Component ---
  const FilterDropdown = ({ label, value, setter, options, format }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={`h-8 border-gray-700 text-xs ${value > 0 ? 'text-emerald-400 border-emerald-500/50' : 'text-gray-400 hover:text-white'}`}
        >
          {label} {value > 0 ? format(value) : ''} <ChevronDown className="w-3 h-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48 bg-gray-900 border-gray-700">
        <DropdownMenuLabel className="text-gray-300">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-700" />
        <DropdownMenuItem onClick={() => setter(0)} className="text-gray-400 hover:bg-gray-800">Any</DropdownMenuItem>
        {options.map(opt => (
          <DropdownMenuItem key={opt.value} onClick={() => setter(opt.value)} className="hover:bg-gray-800">
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden">
      
      {/* --- Top Bar (Streamlined Header) --- */}
      <div className="flex items-center justify-between p-3 border-b border-gray-800 bg-[#0f172a] z-20 shrink-0">
        <h1 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">
          NextTrade Meme Terminal
        </h1>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            {connectionIcon} 
            <span className="hidden sm:inline">{connectionStatus === 'connected' ? 'Live' : 'Reconnecting'}</span>
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">{tokens.length} Tokens</span>
        </div>
      </div>

      {/* --- Search and Filter Bar --- */}
      <div className="p-3 border-b border-gray-800 bg-[#0f172a] z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              placeholder="Search token or contract..." 
              className="pl-9 h-9 text-sm bg-gray-900 border-gray-700 focus:border-emerald-500"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            className={`h-9 w-9 border-gray-700 flex-shrink-0 ${showFilters || activeFiltersCount > 0 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/50' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Filter Panel - Collapsible */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-3 text-sm animate-in fade-in slide-in-from-top-2">
            
            {/* Source Filter */}
            <div className="flex gap-1 bg-gray-900 p-1 rounded-lg border border-gray-800">
              {['all', 'pump', 'ray'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-xs rounded-md capitalize transition-colors ${filter === f ? 'bg-emerald-600 text-white font-medium shadow-sm' : 'text-gray-400 hover:bg-gray-800'}`}
                >
                  {f === 'ray' ? 'Raydium' : f === 'pump' ? 'Pump.fun' : 'All'}
                </button>
              ))}
            </div>

            {/* Liquidity Filter */}
            <FilterDropdown
              label="Liquidity"
              value={minLiquidity}
              setter={setMinLiquidity}
              format={(v) => `> $${v}k`}
              options={[
                { label: '$5k+', value: 5 },
                { label: '$10k+', value: 10 },
                { label: '$50k+', value: 50 },
                { label: '$100k+', value: 100 },
              ]}
            />

            {/* Market Cap Filter */}
            <FilterDropdown
              label="MCap"
              value={minMarketCap}
              setter={setMinMarketCap}
              format={(v) => `> $${v}k`}
              options={[
                { label: '$50k+', value: 50 },
                { label: '$100k+', value: 100 },
                { label: '$500k+', value: 500 },
                { label: '$1M+', value: 1000 },
              ]}
            />

            {/* 24h Change Filter */}
            <FilterDropdown
              label="24h %"
              value={minChange24h}
              setter={setMinChange24h}
              format={(v) => `> ${v}%`}
              options={[
                { label: '10%+', value: 10 },
                { label: '50%+', value: 50 },
                { label: '100%+', value: 100 },
                { label: '500%+', value: 500 },
              ]}
            />

            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs text-red-400 hover:text-red-300">
                <X className="w-3 h-3 mr-1" /> Clear
              </Button>
            )}
          </div>
        )}
      </div>

      {/* --- Content Area (List + Detail) --- */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Token List (Always visible) */}
        <div className={`flex-1 flex flex-col overflow-y-auto ${selectedToken && !isMobile ? 'max-w-[65%] border-r border-gray-800' : 'w-full'}`}>
          
          {/* List Header (for visual structure) */}
          <div className="sticky top-0 bg-[#0a0a0a] p-3 border-b border-gray-800 text-xs text-gray-500 font-semibold uppercase flex items-center justify-between shrink-0">
            <span className="min-w-[100px] sm:min-w-[150px]">Token</span>
            <span className="text-right min-w-[80px] sm:min-w-[100px]">Price / 24h %</span>
            <span className="hidden sm:inline text-right min-w-[100px]">MCap / Liq</span>
            <span className="w-16 text-right">Trade</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center flex-1 p-8">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
              <div className="text-sm text-gray-500">Connecting to PumpPortal and fetching data...</div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {filteredTokens.length === 0 ? (
                <div className="text-center text-gray-500 p-8">No tokens match your current filters.</div>
              ) : (
                filteredTokens.map(token => (
                  <MemeListItem 
                    key={token.mint} 
                    token={token} 
                    onTrade={handleSelectTokenForTrade} 
                    onSelectDetail={handleSelectTokenForDetail}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Right: Detail Panel (Desktop Only) */}
        {!isMobile && (
          <div className={`${selectedToken ? 'w-[35%] min-w-[380px]' : 'w-0'} transition-all duration-300 ease-in-out overflow-y-auto`}>
            {selectedToken && (
              <MemeDetailPanel 
                token={selectedToken} 
                onClose={() => setSelectedToken(null)} 
                onTrade={handleSelectTokenForTrade} // Pass trade handler to detail panel
              />
            )}
          </div>
        )}
      </div>

      {/* --- Mobile Full-Screen Detail Sheet (Chart/Info) --- */}
      {isMobile && selectedToken && (
        <Sheet open={isDetailSheetOpen} onOpenChange={(open) => {
          setIsDetailSheetOpen(open);
          if (!open) setSelectedToken(null);
        }}>
          <SheetContent side="bottom" className="h-[90vh] p-0 bg-[#0f172a] border-t border-gray-800">
            <SheetHeader className="p-4 border-b border-gray-800">
              <SheetTitle className="text-white">{selectedToken?.symbol} Trading View</SheetTitle>
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

      {/* --- Trade Drawer (Jupiter Swap - Mobile/Desktop) --- */}
      {/* The TradeDrawer component is assumed to handle the Jupiter Swap logic and UI */}
      <TradeDrawer 
        open={isTradeDrawerOpen} 
        onOpenChange={(open) => {
          setIsTradeDrawerOpen(open);
          if (!open) setSelectedToken(null); // Clear selected token when trade drawer closes
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

// NOTE: This refactor assumes the existence of the following components and hooks:
// - MemeDataProvider, useMemeData (from '@/components/meme/MemeDataContext')
// - MemeDetailPanel (from '@/components/meme/MemeDetailPanel')
// - TradeDrawer (from '@/components/meme/TradeDrawer') - This is where Jupiter Swap logic should reside.
// - UI components like Input, Button, DropdownMenu, Sheet (from '@/components/ui/*')
// The original file's imports suggest these components are already defined elsewhere in the project.
// The core logic for data fetching and connections (WebSocket, Jupiter Swap) is assumed to be preserved within the existing components and hooks.
// The file is saved as a .jsx file, which is standard for React components.
