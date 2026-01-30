import React, { useState, useEffect } from 'react';
import { useMemeData, MemeDataProvider } from '@/components/meme/MemeDataContext';
import MemeList from '@/components/meme/MemeList';
import MemeCard from '@/components/meme/MemeCard';
import MemeDetailPanel from '@/components/meme/MemeDetailPanel';
import TradeDrawer from '@/components/meme/TradeDrawer';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Wifi, WifiOff, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MemeCoinsContent = () => {
  const { tokens, loading, connectionStatus } = useMemeData();
  const [search, setSearch] = useState('');
  const [selectedToken, setSelectedToken] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [filter, setFilter] = useState('all'); // all, pump, ray
  // Enhanced filters
  const [minLiquidity, setMinLiquidity] = useState(0);
  const [minMarketCap, setMinMarketCap] = useState(0);
  const [minChange24h, setMinChange24h] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024); // Use lg breakpoint for split view
    window.addEventListener('resize', checkMobile);
    checkMobile();
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const filteredTokens = tokens.filter(t => {
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

  const clearFilters = () => {
    setMinLiquidity(0);
    setMinMarketCap(0);
    setMinChange24h(0);
    setFilter('all');
  };

  const activeFiltersCount = (minLiquidity > 0 ? 1 : 0) + (minMarketCap > 0 ? 1 : 0) + (minChange24h > 0 ? 1 : 0);

  return (
    <div className="h-[calc(100vh-64px)] bg-[#0a0a0a] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#0f172a]/50 backdrop-blur-md z-10 shrink-0">
        <div className="px-4 py-3">
          <div className="flex flex-col gap-3">
            {/* Top Row: Title + Search */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-500">
                    Meme Scout
                  </h1>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      {connectionStatus === 'connected' ? (
                        <><Wifi className="w-3 h-3 text-green-500" /> Live</>
                      ) : (
                        <><WifiOff className="w-3 h-3 text-red-500" /> Reconnecting</>
                      )}
                    </span>
                    <span>•</span>
                    <span>{tokens.length} scanned</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input 
                    placeholder="Search ticker..." 
                    className="pl-9 h-9 text-sm bg-gray-900 border-gray-700 focus:border-emerald-500"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className={`h-9 w-9 border-gray-700 ${showFilters || activeFiltersCount > 0 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/50' : 'bg-gray-900'}`}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Filter Panel */}
            {(showFilters || activeFiltersCount > 0) && (
              <div className="flex flex-wrap items-center gap-2 pb-1 text-sm animate-in fade-in slide-in-from-top-2">
                <div className="flex gap-1 bg-gray-900 p-1 rounded-lg border border-gray-800">
                  {['all', 'pump', 'ray'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1 text-xs rounded-md capitalize transition-colors ${filter === f ? 'bg-gray-800 text-white font-medium shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      {f === 'ray' ? 'Raydium' : f}
                    </button>
                  ))}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className={`h-8 border-gray-700 ${minLiquidity > 0 ? 'text-emerald-400 border-emerald-500/50' : ''}`}>
                      Liquidity {minLiquidity > 0 ? `> $${minLiquidity}k` : ''}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Min Liquidity</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setMinLiquidity(0)}>Any</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setMinLiquidity(5)}>$5k+</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setMinLiquidity(10)}>$10k+</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setMinLiquidity(50)}>$50k+</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className={`h-8 border-gray-700 ${minMarketCap > 0 ? 'text-emerald-400 border-emerald-500/50' : ''}`}>
                      MCap {minMarketCap > 0 ? `> $${minMarketCap}k` : ''}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Min Market Cap</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setMinMarketCap(0)}>Any</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setMinMarketCap(50)}>$50k+</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setMinMarketCap(100)}>$100k+</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setMinMarketCap(500)}>$500k+</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className={`h-8 border-gray-700 ${minChange24h > 0 ? 'text-emerald-400 border-emerald-500/50' : ''}`}>
                      24h % {minChange24h > 0 ? `> ${minChange24h}%` : ''}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Min 24h Change</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setMinChange24h(0)}>Any</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setMinChange24h(10)}>10%+</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setMinChange24h(50)}>50%+</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setMinChange24h(100)}>100%+</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs text-gray-400 hover:text-white">
                    Clear All
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Token List */}
        <div className={`flex-1 flex flex-col ${selectedToken && !isMobile ? 'max-w-[65%]' : 'w-full'}`}>
          {loading ? (
            <div className="flex flex-col items-center justify-center flex-1">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
              <div className="text-sm text-gray-500">Connecting to PumpPortal...</div>
            </div>
          ) : (
            <>
              {isMobile ? (
                // Mobile: Cards Grid
                <div className="p-4 overflow-y-auto pb-20">
                  <div className="grid grid-cols-1 gap-3">
                    {filteredTokens.map(token => (
                      <MemeCard 
                        key={token.mint} 
                        token={token} 
                        onTrade={setSelectedToken} 
                      />
                    ))}
                  </div>
                </div>
              ) : (
                // Desktop: Virtual List
                <div className="flex-1">
                  <MemeList 
                    tokens={filteredTokens} 
                    height={800} // Will auto-size in container normally, but fixed for now
                    onTrade={setSelectedToken} 
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Detail Panel (Desktop Only) */}
        {!isMobile && (
          <div className={`${selectedToken ? 'w-[35%] min-w-[380px]' : 'w-0'} transition-all duration-300 ease-in-out`}>
            {selectedToken && (
              <MemeDetailPanel 
                token={selectedToken} 
                onClose={() => setSelectedToken(null)} 
              />
            )}
          </div>
        )}
      </div>

      {/* Mobile Trade Drawer (Bottom Sheet) */}
      {isMobile && (
        <TradeDrawer 
          open={!!selectedToken} 
          onOpenChange={(open) => !open && setSelectedToken(null)}
          token={selectedToken}
        />
      )}
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