import { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, Search, Loader2, 
  ExternalLink, RefreshCw, Zap, BarChart3, Flame, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

// Constants
const DEXSCREENER_API = 'https://api.dexscreener.com';

// Popular Solana meme coins
const MEME_COINS = [
  'BONK', 'WIF', 'POPCAT', 'MEW', 'BOME', 'MYRO', 
  'SLERF', 'PENG', 'BOOK', 'MICHI', 'SAMO', 'FOXY',
  'PONKE', 'GOAT', 'MUMU', 'TREMP', 'HARAMBE', 'GIGA'
];

// Simple cache
const cache = new Map();
const CACHE_TTL = 30000;

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// Utility functions
const formatPrice = (price) => {
  if (price === 0) return '$0.00';
  if (price < 0.0001) return '$' + price.toExponential(2);
  if (price < 1) return '$' + price.toFixed(6);
  return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatChange = (change) => {
  const sign = change >= 0 ? '+' : '';
  return sign + change.toFixed(2) + '%';
};

const formatVolume = (volume) => {
  if (volume >= 1e9) return '$' + (volume / 1e9).toFixed(2) + 'B';
  if (volume >= 1e6) return '$' + (volume / 1e6).toFixed(2) + 'M';
  if (volume >= 1e3) return '$' + (volume / 1e3).toFixed(2) + 'K';
  return '$' + volume.toFixed(2);
};

export default function MemeCoinsTerminal() {
  // State
  const [tokens, setTokens] = useState([]);
  const [filteredTokens, setFilteredTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'volume24h', direction: 'desc' });
  const [filterType, setFilterType] = useState('all');

  // Fetch tokens from DexScreener
  const fetchTokens = useCallback(async () => {
    const cacheKey = 'meme_tokens';
    const cached = getCached(cacheKey);
    if (cached && cached.length > 0) {
      setTokens(cached);
      setFilteredTokens(cached);
      setLoading(false);
      return;
    }

    try {
      console.log('[MemeCoins] Fetching tokens...');
      
      // Search for each meme coin in parallel
      const searchPromises = MEME_COINS.map(async (symbol) => {
        try {
          const response = await fetch(
            DEXSCREENER_API + '/latest/dex/search?q=' + symbol,
            { headers: { 'Accept': 'application/json' } }
          );
          if (!response.ok) return [];
          const data = await response.json();
          
          return (data.pairs || [])
            .filter(pair => 
              pair.chainId === 'solana' &&
              pair.baseToken?.symbol?.toUpperCase() === symbol &&
              (pair.liquidity?.usd || 0) > 10000
            )
            .slice(0, 1);
        } catch {
          return [];
        }
      });

      const results = await Promise.all(searchPromises);
      const allPairs = results.flat();

      // Fetch boosted tokens
      try {
        const boostedRes = await fetch(DEXSCREENER_API + '/token-boosts/top/v1');
        if (boostedRes.ok) {
          const boostedData = await boostedRes.json();
          const solanaBoosted = (boostedData || [])
            .filter(t => t.chainId === 'solana')
            .slice(0, 10);

          for (const token of solanaBoosted) {
            try {
              const pairRes = await fetch(
                DEXSCREENER_API + '/latest/dex/search?q=' + token.tokenAddress
              );
              if (pairRes.ok) {
                const pairData = await pairRes.json();
                const solanaPair = (pairData.pairs || []).find(p => 
                  p.chainId === 'solana' && 
                  p.baseToken?.address === token.tokenAddress
                );
                if (solanaPair && !allPairs.find(p => p.pairAddress === solanaPair.pairAddress)) {
                  allPairs.push(solanaPair);
                }
              }
            } catch {
              // Skip
            }
          }
        }
      } catch {
        console.log('[MemeCoins] Boosted fetch failed');
      }

      // Transform to our format
      const formatted = allPairs
        .map(pair => ({
          address: pair.baseToken?.address || '',
          pairAddress: pair.pairAddress || '',
          symbol: pair.baseToken?.symbol || 'UNKNOWN',
          name: pair.baseToken?.name || 'Unknown Token',
          price: parseFloat(pair.priceUsd) || 0,
          priceNative: parseFloat(pair.priceNative) || 0,
          change24h: parseFloat(pair.priceChange?.h24) || 0,
          change1h: parseFloat(pair.priceChange?.h1) || 0,
          volume24h: parseFloat(pair.volume?.h24) || 0,
          volume1h: parseFloat(pair.volume?.h1) || 0,
          liquidity: parseFloat(pair.liquidity?.usd) || 0,
          marketCap: parseFloat(pair.fdv) || 0,
          txns24h: {
            buys: pair.txns?.h24?.buys || 0,
            sells: pair.txns?.h24?.sells || 0
          },
          imageUrl: pair.info?.imageUrl || null,
          dexUrl: pair.url || null,
        }))
        .filter(t => t.address && t.symbol !== 'UNKNOWN')
        .sort((a, b) => b.volume24h - a.volume24h);

      console.log('[MemeCoins] Tokens loaded:', formatted.length);

      if (formatted.length > 0) {
        setCache(cacheKey, formatted);
      }

      setTokens(formatted);
      setFilteredTokens(formatted);
    } catch (error) {
      console.error('[MemeCoins] Failed to fetch:', error);
      toast.error('Failed to load meme coins');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    cache.delete('meme_tokens');
    fetchTokens();
  }, [fetchTokens]);

  // Filter and search
  useEffect(() => {
    let filtered = [...tokens];

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(token =>
        token.symbol?.toLowerCase().includes(query) ||
        token.name?.toLowerCase().includes(query)
      );
    }

    // Apply filter type
    if (filterType === 'gainers') {
      filtered = filtered.filter(t => t.change24h > 0);
    } else if (filterType === 'losers') {
      filtered = filtered.filter(t => t.change24h < 0);
    } else if (filterType === 'volume') {
      filtered = filtered.filter(t => t.volume24h > 1000000);
    }

    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      const aVal = a[sortConfig.key] || 0;
      const bVal = b[sortConfig.key] || 0;
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    setFilteredTokens(sorted);
  }, [searchQuery, tokens, sortConfig, filterType]);

  // Calculate stats
  const stats = {
    totalVolume: tokens.reduce((sum, t) => sum + t.volume24h, 0),
    gainers: tokens.filter(t => t.change24h > 0).length,
    losers: tokens.filter(t => t.change24h < 0).length,
    avgChange: tokens.length > 0 ? tokens.reduce((sum, t) => sum + t.change24h, 0) / tokens.length : 0,
  };

  const handleSort = useCallback((key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc';
    setSortConfig({ key, direction });
  }, [sortConfig]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Meme Terminal</h1>
              <p className="text-xs text-slate-400">Solana Trading</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-slate-300 hover:text-white hover:bg-slate-700/50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">24h Volume</p>
                <p className="text-2xl font-bold text-white mt-1">{formatVolume(stats.totalVolume)}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-cyan-500/30" />
            </div>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Gainers</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.gainers}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-emerald-500/30" />
            </div>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Losers</p>
                <p className="text-2xl font-bold text-rose-400 mt-1">{stats.losers}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-rose-500/30" />
            </div>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Avg Change</p>
                <p className={`text-2xl font-bold mt-1 ${stats.avgChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatChange(stats.avgChange)}
                </p>
              </div>
              <Sparkles className="w-8 h-8 text-blue-500/30" />
            </div>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search tokens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-cyan-500/50"
              />
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Tabs value={filterType} onValueChange={setFilterType} className="w-full sm:w-auto">
                <TabsList className="bg-slate-800/50 border border-slate-700/50">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  <TabsTrigger value="gainers" className="text-xs">Gainers</TabsTrigger>
                  <TabsTrigger value="losers" className="text-xs">Losers</TabsTrigger>
                  <TabsTrigger value="volume" className="text-xs">Volume</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Token Grid/List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500 mb-4" />
            <p className="text-slate-400">Loading meme coins...</p>
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400">{searchQuery ? 'No tokens match your search' : 'No tokens found'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTokens.map((token) => (
              <Card
                key={token.pairAddress || token.address}
                className="bg-slate-800/50 border-slate-700/50 hover:border-cyan-500/30 hover:bg-slate-800/70 transition-all cursor-pointer group p-4"
                onClick={() => setSelectedToken(token)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {token.imageUrl ? (
                      <img
                        src={token.imageUrl}
                        alt={token.symbol}
                        className="w-10 h-10 rounded-lg bg-slate-700"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-sm font-bold text-white">
                        {token.symbol?.charAt(0) || '?'}
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-white">{token.symbol}</h3>
                      <p className="text-xs text-slate-400 truncate max-w-[120px]">{token.name}</p>
                    </div>
                  </div>
                  {token.change24h > 5 && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      <Flame className="w-3 h-3 mr-1" />
                      Hot
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Price</span>
                    <span className="font-mono font-semibold text-white">{formatPrice(token.price)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">24h Change</span>
                    <span className={`font-semibold flex items-center gap-1 ${token.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {token.change24h >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {formatChange(token.change24h)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Volume</span>
                    <span className="font-mono text-sm text-slate-300">{formatVolume(token.volume24h)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Liquidity</span>
                    <span className="font-mono text-sm text-slate-300">{formatVolume(token.liquidity)}</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  className="w-full mt-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white border-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedToken(token);
                  }}
                >
                  <Zap className="w-3.5 h-3.5 mr-2" />
                  Trade Now
                </Button>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Token Detail Sheet */}
      <Sheet open={!!selectedToken} onOpenChange={(open) => !open && setSelectedToken(null)}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-[500px] bg-slate-900 border-slate-700/50 overflow-y-auto p-0"
        >
          {selectedToken && (
            <div className="flex flex-col h-full">
              {/* Sheet Header */}
              <SheetHeader className="p-6 border-b border-slate-700/50 bg-slate-800/50">
                <SheetTitle className="flex items-center gap-3">
                  {selectedToken.imageUrl ? (
                    <img
                      src={selectedToken.imageUrl}
                      alt={selectedToken.symbol}
                      className="w-12 h-12 rounded-lg bg-slate-700"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-lg font-bold text-white">
                      {selectedToken.symbol?.charAt(0) || '?'}
                    </div>
                  )}
                  <div>
                    <h2 className="text-white">{selectedToken.symbol}</h2>
                    <p className="text-sm text-slate-400">{selectedToken.name}</p>
                  </div>
                </SheetTitle>
              </SheetHeader>

              {/* Token Info */}
              <div className="p-6 space-y-4 flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                    <p className="text-slate-400 text-sm mb-1">Current Price</p>
                    <p className="text-2xl font-bold text-white">{formatPrice(selectedToken.price)}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                    <p className="text-slate-400 text-sm mb-1">24h Change</p>
                    <p className={`text-2xl font-bold flex items-center gap-1 ${selectedToken.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {selectedToken.change24h >= 0 ? (
                        <TrendingUp className="w-5 h-5" />
                      ) : (
                        <TrendingDown className="w-5 h-5" />
                      )}
                      {formatChange(selectedToken.change24h)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                    <p className="text-slate-400 text-sm mb-1">24h Volume</p>
                    <p className="text-lg font-semibold text-white">{formatVolume(selectedToken.volume24h)}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                    <p className="text-slate-400 text-sm mb-1">Liquidity</p>
                    <p className="text-lg font-semibold text-white">{formatVolume(selectedToken.liquidity)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                    <p className="text-slate-400 text-sm mb-1">Market Cap</p>
                    <p className="text-lg font-semibold text-white">{formatVolume(selectedToken.marketCap)}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                    <p className="text-slate-400 text-sm mb-1">1h Change</p>
                    <p className={`text-lg font-semibold ${selectedToken.change1h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatChange(selectedToken.change1h)}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                  <p className="text-slate-400 text-sm mb-3">Transactions (24h)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Buys</p>
                      <p className="text-emerald-400 font-semibold">{selectedToken.txns24h.buys.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Sells</p>
                      <p className="text-rose-400 font-semibold">{selectedToken.txns24h.sells.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {selectedToken.dexUrl && (
                  <Button
                    variant="outline"
                    className="w-full border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-800/50"
                    onClick={() => window.open(selectedToken.dexUrl, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View on DexScreener
                  </Button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-6 border-t border-slate-700/50 bg-slate-800/50 space-y-3">
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white border-0"
                  onClick={() => {
                    toast.success(`Buy ${selectedToken.symbol} - Coming soon!`);
                  }}
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Buy {selectedToken.symbol}
                </Button>
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white border-0"
                  onClick={() => {
                    toast.success(`Sell ${selectedToken.symbol} - Coming soon!`);
                  }}
                >
                  <TrendingDown className="w-4 h-4 mr-2" />
                  Sell {selectedToken.symbol}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
