import { useState, useEffect, useRef, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { 
  ArrowUpDown, TrendingUp, TrendingDown, Search, Loader2, 
  ExternalLink, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';

import * as jupiterApi from '@/api/jupiter';
import { fetchTrendingSolanaTokens } from '@/api/dexscreener';
import { useIsMobile } from '@/hooks/use-mobile';

// Constants
const SLIPPAGE_OPTIONS = [0.5, 1, 2, 5];

// Simple cache
const cache = new Map();
const CACHE_TTL = 30000;

const SOL_MINT = jupiterApi.TOKENS.SOL;
const SOL_DECIMALS = 9;

function SolanaMark({ className }) {
  return (
    <svg
      viewBox="0 0 397 311"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="solg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00FFA3" />
          <stop offset="1" stopColor="#DC1FFF" />
        </linearGradient>
      </defs>
      <path
        d="M64.6 236.9c2.5-2.5 5.9-3.9 9.5-3.9h306.3c6 0 9 7.3 4.7 11.6l-60.4 60.4c-2.5 2.5-5.9 3.9-9.5 3.9H8.9c-6 0-9-7.3-4.7-11.6l60.4-60.4z"
        fill="url(#solg)"
      />
      <path
        d="M64.6 3.9C67.1 1.4 70.5 0 74.1 0h306.3c6 0 9 7.3 4.7 11.6L324.7 72c-2.5 2.5-5.9 3.9-9.5 3.9H8.9c-6 0-9-7.3-4.7-11.6L64.6 3.9z"
        fill="url(#solg)"
      />
      <path
        d="M332.4 120.4c-2.5-2.5-5.9-3.9-9.5-3.9H16.6c-6 0-9 7.3-4.7 11.6l60.4 60.4c2.5 2.5 5.9 3.9 9.5 3.9h306.3c6 0 9-7.3 4.7-11.6l-60.4-60.4z"
        fill="url(#solg)"
      />
    </svg>
  );
}

function formatAgeMs(ms) {
  if (!ms || !Number.isFinite(ms)) return '—';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

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

export default function MemeCoinsTerminal() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const isMobile = useIsMobile();
  
  // State
  const [tokens, setTokens] = useState([]);
  const [filteredTokens, setFilteredTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'volume24h', direction: 'desc' });
  const [timeframe, setTimeframe] = useState('24h');
  const [mobilePreset, setMobilePreset] = useState('hot');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    minLiquidity: '',
    minMarketCap: '',
    minVolume: '',
    maxAgeHours: '',
    onlyGreen: false,
    onlyWithImage: false,
  });
  
  // Swap state
  const [swapMode, setSwapMode] = useState('buy');
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [slippage, setSlippage] = useState(1);
  const [customSlippage, setCustomSlippage] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(null);
  const [quoteSource, setQuoteSource] = useState('');

  // Mint decimals cache (needed for correct raw amounts in Jupiter)
  const mintDecimalsCacheRef = useRef(new Map());

  const getMintDecimals = useCallback(async (mint) => {
    if (!mint) return SOL_DECIMALS;
    if (mint === SOL_MINT) return SOL_DECIMALS;

    const cached = mintDecimalsCacheRef.current.get(mint);
    if (typeof cached === 'number') return cached;

    try {
      const info = await connection.getParsedAccountInfo(new PublicKey(mint));
      const data = info?.value?.data;
      const parsed = data && typeof data === 'object' && 'parsed' in data ? data.parsed : null;
      const decimals = parsed?.info?.decimals;
      if (typeof decimals === 'number' && Number.isFinite(decimals)) {
        mintDecimalsCacheRef.current.set(mint, decimals);
        return decimals;
      }
    } catch {
      // ignore
    }

    // Safe-ish default for most SPL meme coins
    mintDecimalsCacheRef.current.set(mint, 9);
    return 9;
  }, [connection]);

  // Format address
  const formatAddress = useCallback((address) => {
    if (!address) return '';
    const str = address.toString();
    return str.slice(0, 4) + '...' + str.slice(-4);
  }, []);

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

      const trending = await fetchTrendingSolanaTokens(50);

      // Normalize to the shape this page expects
      const formatted = (trending || [])
        .map((t) => ({
          address: t.mint || '',
          pairAddress: t.pairAddress || t.id || '',
          symbol: t.symbol || 'UNKNOWN',
          name: t.name || 'Unknown Token',
          price: toNumber(t.price),
          priceNative: toNumber(t.priceNative),
          change24h: toNumber(t.priceChange24h),
          change1h: toNumber(t.priceChange1h),
          change5m: toNumber(t.priceChange5m),
          change6h: toNumber(t.priceChange6h),
          volume24h: toNumber(t.volume24h),
          volume6h: toNumber(t.volume6h),
          volume1h: toNumber(t.volume1h),
          volume5m: toNumber(t.volume5m),
          liquidity: toNumber(t.liquidity),
          marketCap: toNumber(t.marketCap),
          txns24h: t.txns24h || { buys: 0, sells: 0 },
          txns1h: t.txns1h || { buys: 0, sells: 0 },
          txns5m: t.txns5m || { buys: 0, sells: 0 },
          imageUrl: t.imageUrl || null,
          dexUrl: t.dexUrl || null,
          pairCreatedAt: t.pairCreatedAt || null,
        }))
        .filter((t) => t.address && t.symbol !== 'UNKNOWN')
        .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));

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

  // Filter tokens when search changes
  const getVolumeKey = useCallback((tf) => {
    switch (tf) {
      case '5m':
        return 'volume5m';
      case '1h':
        return 'volume1h';
      case '6h':
        return 'volume6h';
      default:
        return 'volume24h';
    }
  }, []);

  const getChangeKey = useCallback((tf) => {
    switch (tf) {
      case '5m':
        return 'change5m';
      case '1h':
        return 'change1h';
      case '6h':
        return 'change6h';
      default:
        return 'change24h';
    }
  }, []);

  const getTokenChange = useCallback((token) => {
    const key = getChangeKey(timeframe);
    return toNumber(token?.[key]);
  }, [getChangeKey, timeframe]);

  const getTokenVolume = useCallback((token) => {
    const key = getVolumeKey(timeframe);
    return toNumber(token?.[key]);
  }, [getVolumeKey, timeframe]);

  const countActiveFilters = useCallback(() => {
    const n = (v) => (String(v || '').trim() ? 1 : 0);
    return (
      n(filters.minLiquidity) +
      n(filters.minMarketCap) +
      n(filters.minVolume) +
      n(filters.maxAgeHours) +
      (filters.onlyGreen ? 1 : 0) +
      (filters.onlyWithImage ? 1 : 0)
    );
  }, [filters]);

  const resetFilters = useCallback(() => {
    setFilters({
      minLiquidity: '',
      minMarketCap: '',
      minVolume: '',
      maxAgeHours: '',
      onlyGreen: false,
      onlyWithImage: false,
    });
  }, []);

  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    const base = query
      ? tokens.filter((token) => token.symbol?.toLowerCase().includes(query) || token.name?.toLowerCase().includes(query))
      : tokens;

    // Hard filters
    const minLiquidity = toNumber(filters.minLiquidity);
    const minMarketCap = toNumber(filters.minMarketCap);
    const minVolume = toNumber(filters.minVolume);
    const maxAgeHours = toNumber(filters.maxAgeHours);

    const filtered = base.filter((token) => {
      if (minLiquidity > 0 && toNumber(token.liquidity) < minLiquidity) return false;
      if (minMarketCap > 0 && toNumber(token.marketCap) < minMarketCap) return false;
      if (minVolume > 0 && getTokenVolume(token) < minVolume) return false;
      if (filters.onlyWithImage && !token.imageUrl) return false;
      if (filters.onlyGreen && getTokenChange(token) <= 0) return false;

      if (maxAgeHours > 0) {
        const created = Number(token.pairCreatedAt || 0);
        if (!created) return false;
        const ageHours = (Date.now() - created) / 36e5;
        if (!Number.isFinite(ageHours) || ageHours > maxAgeHours) return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const key = sortConfig.key;

      if (key === 'pairCreatedAt') {
        const aVal = Number(a.pairCreatedAt || 0);
        const bVal = Number(b.pairCreatedAt || 0);
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aVal = toNumber(a[key]);
      const bVal = toNumber(b[key]);
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    setFilteredTokens(sorted);
  }, [filters, getTokenChange, getTokenVolume, searchQuery, sortConfig, tokens]);

  // Sort tokens
  const handleSort = useCallback((key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc';
    setSortConfig({ key, direction });
  }, [sortConfig.key, sortConfig.direction]);

  const applyMobilePreset = useCallback(
    (preset) => {
      setMobilePreset(preset);
      if (preset === 'new') {
        setSortConfig({ key: 'pairCreatedAt', direction: 'desc' });
        return;
      }
      if (preset === 'mc') {
        setSortConfig({ key: 'marketCap', direction: 'desc' });
        return;
      }
      if (preset === 'liq') {
        setSortConfig({ key: 'liquidity', direction: 'desc' });
        return;
      }
      // hot
      setSortConfig({ key: getVolumeKey(timeframe), direction: 'desc' });
    },
    [getVolumeKey, timeframe]
  );

  useEffect(() => {
    // Keep preset sort aligned when timeframe changes.
    if (mobilePreset === 'hot') {
      setSortConfig({ key: getVolumeKey(timeframe), direction: 'desc' });
    }
  }, [getVolumeKey, mobilePreset, timeframe]);

  const switchSwapMode = useCallback((mode) => {
    setSwapMode(mode);
    setInputAmount('');
    setOutputAmount('');
    setCurrentQuote(null);
    setQuoteSource('');
  }, []);

  // Select token
  const selectToken = useCallback((token) => {
    setSelectedToken(token);
    setInputAmount('');
    setOutputAmount('');
    setCurrentQuote(null);
    setQuoteSource('');
  }, []);

  const getDexScreenerEmbedUrl = useCallback((token) => {
    if (!token?.pairAddress) return null;
    const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    return `https://dexscreener.com/solana/${token.pairAddress}?embed=1&theme=${theme}&trades=0&info=0`;
  }, []);

  const setQuickSolAmount = useCallback((amount) => {
    setInputAmount(String(amount));
  }, []);

  // Get quote when amount changes
  useEffect(() => {
    if (!selectedToken || !inputAmount || parseFloat(inputAmount) <= 0) {
      setOutputAmount('');
      setCurrentQuote(null);
      setQuoteSource('');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setQuoteLoading(true);

        const inputMint = swapMode === 'buy' ? SOL_MINT : selectedToken.address;
        const outputMint = swapMode === 'buy' ? selectedToken.address : SOL_MINT;

        if (!inputMint || !outputMint) {
          setOutputAmount('');
          setCurrentQuote(null);
          return;
        }

        const inputDecimals = await getMintDecimals(inputMint);
        const outputDecimals = await getMintDecimals(outputMint);
        
        const rawAmount = jupiterApi.toRawAmount(parseFloat(inputAmount), inputDecimals);
        const slippageBps = slippage * 100;

        // 1) Try Jupiter (real swap)
        try {
          const quote = await jupiterApi.getQuote(inputMint, outputMint, rawAmount, slippageBps);
          if (quote) {
            const output = jupiterApi.fromRawAmount(parseInt(quote.outAmount, 10), outputDecimals);
            const displayDecimals = Math.min(Math.max(outputDecimals, 2), 6);
            setOutputAmount(Number.isFinite(output) ? output.toFixed(displayDecimals) : '');
            setCurrentQuote(quote);
            setQuoteSource('jupiter');
            return;
          }
        } catch (e) {
          // 2) Fallback to an estimate using DexScreener native price
          // If the pair is SOL-quoted, `priceNative` is SOL-per-token.
          const priceNative = toNumber(selectedToken.priceNative);
          if (priceNative > 0 && inputMint === SOL_MINT && outputMint === selectedToken.address) {
            // buy token with SOL
            const out = parseFloat(inputAmount) / priceNative;
            setOutputAmount(Number.isFinite(out) ? out.toFixed(4) : '');
            setCurrentQuote(null);
            setQuoteSource('estimate');
            return;
          }
          if (priceNative > 0 && inputMint === selectedToken.address && outputMint === SOL_MINT) {
            // sell token for SOL
            const out = parseFloat(inputAmount) * priceNative;
            setOutputAmount(Number.isFinite(out) ? out.toFixed(4) : '');
            setCurrentQuote(null);
            setQuoteSource('estimate');
            return;
          }

          setOutputAmount('');
          setCurrentQuote(null);
          setQuoteSource('');

          const msg = String(e?.message || 'Failed to fetch quote');
          if (msg.includes('Failed to fetch') || msg.includes('ERR_NAME_NOT_RESOLVED')) {
            toast.error('Live quotes are blocked in this network. Estimated pricing may be shown; live swapping requires Jupiter access.');
          }
        }
      } catch (error) {
        console.error('Quote error:', error);
        setOutputAmount('');
        setCurrentQuote(null);
        setQuoteSource('');
      } finally {
        setQuoteLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [inputAmount, selectedToken, swapMode, slippage, getMintDecimals]);

  // Execute swap
  const handleSwap = useCallback(async () => {
    if (!wallet.connected) {
      setWalletModalVisible(true);
      return;
    }

    if (!currentQuote) {
      toast.error('Live quote required to swap');
      return;
    }

    try {
      setSwapping(true);

      const swapTransaction = await jupiterApi.getSwapTransaction(currentQuote, wallet.publicKey.toString());

      const signature = await jupiterApi.executeSwap(swapTransaction, wallet);
      
      toast.success('Swap successful! View on Solscan: ' + signature.slice(0, 8) + '...');
      
      setInputAmount('');
      setOutputAmount('');
      setCurrentQuote(null);
    } catch (error) {
      console.error('Swap error:', error);
      toast.error('Swap failed: ' + error.message);
    } finally {
      setSwapping(false);
    }
  }, [wallet, currentQuote, setWalletModalVisible]);

  // Format helpers
  const formatPrice = (price) => {
    const n = toNumber(price);
    if (!n) return '—';
    if (n >= 1) return `$${n.toFixed(4)}`;
    if (n >= 0.01) return `$${n.toFixed(6)}`;
    return `$${n.toPrecision(4)}`;
  };

  const formatChange = (change) => {
    const n = toNumber(change);
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}%`;
  };

  const formatVolume = (value) => {
    const n = toNumber(value);
    if (!n) return '—';
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(n);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold truncate">Meme Coin Terminal</h1>
            <Badge className="bg-muted/50 text-foreground border-border hover:bg-muted/60 gap-2">
              <SolanaMark className="h-4 w-4" />
              <span>Solana</span>
            </Badge>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-9 w-9"
              aria-label="Refresh"
            >
              <RefreshCw className={'w-4 h-4 ' + (refreshing ? 'animate-spin' : '')} />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search meme coins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card border-border"
              />
            </div>

            {/* Desktop Toolbar */}
            <div className="hidden sm:flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={mobilePreset === 'hot' ? 'default' : 'outline'}
                className="h-8"
                onClick={() => applyMobilePreset('hot')}
              >
                Hot
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mobilePreset === 'new' ? 'default' : 'outline'}
                className="h-8"
                onClick={() => applyMobilePreset('new')}
              >
                New
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mobilePreset === 'mc' ? 'default' : 'outline'}
                className="h-8"
                onClick={() => applyMobilePreset('mc')}
              >
                MC
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mobilePreset === 'liq' ? 'default' : 'outline'}
                className="h-8"
                onClick={() => applyMobilePreset('liq')}
              >
                Liquidity
              </Button>

              <div className="mx-2 h-5 w-px bg-border" />

              {['5m', '1h', '6h', '24h'].map((tf) => (
                <Button
                  key={tf}
                  type="button"
                  size="sm"
                  variant={timeframe === tf ? 'default' : 'outline'}
                  className="h-8"
                  onClick={() => setTimeframe(tf)}
                >
                  {tf}
                </Button>
              ))}

              <div className="ml-auto flex items-center gap-2">
                <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" size="sm" variant="outline" className="h-8">
                      Filters
                      {countActiveFilters() > 0 ? (
                        <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] text-primary-foreground">
                          {countActiveFilters()}
                        </span>
                      ) : null}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <Card className="bg-card border-border p-3">
                      <div className="grid grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Min Liquidity ($)</Label>
                          <Input
                            inputMode="numeric"
                            placeholder="10000"
                            value={filters.minLiquidity}
                            onChange={(e) => setFilters((p) => ({ ...p, minLiquidity: e.target.value }))}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Min MC ($)</Label>
                          <Input
                            inputMode="numeric"
                            placeholder="50000"
                            value={filters.minMarketCap}
                            onChange={(e) => setFilters((p) => ({ ...p, minMarketCap: e.target.value }))}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Min Vol ({timeframe})</Label>
                          <Input
                            inputMode="numeric"
                            placeholder="5000"
                            value={filters.minVolume}
                            onChange={(e) => setFilters((p) => ({ ...p, minVolume: e.target.value }))}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Max Age (hours)</Label>
                          <Input
                            inputMode="numeric"
                            placeholder="24"
                            value={filters.maxAgeHours}
                            onChange={(e) => setFilters((p) => ({ ...p, maxAgeHours: e.target.value }))}
                            className="h-9"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={filters.onlyGreen}
                              onCheckedChange={(checked) => setFilters((p) => ({ ...p, onlyGreen: !!checked }))}
                            />
                            <div className="text-xs">Green only</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={filters.onlyWithImage}
                              onCheckedChange={(checked) => setFilters((p) => ({ ...p, onlyWithImage: !!checked }))}
                            />
                            <div className="text-xs">Has logo</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-xs text-muted-foreground">{filteredTokens.length} tokens</div>
                          <Button type="button" size="sm" variant="outline" className="h-8" onClick={resetFilters}>
                            Reset
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>

            {/* Mobile Filters */}
            <div className="sm:hidden space-y-2">
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Button
                  type="button"
                  size="sm"
                  variant={mobilePreset === 'hot' ? 'default' : 'outline'}
                  className="h-8 shrink-0"
                  onClick={() => applyMobilePreset('hot')}
                >
                  Hot
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mobilePreset === 'new' ? 'default' : 'outline'}
                  className="h-8 shrink-0"
                  onClick={() => applyMobilePreset('new')}
                >
                  New
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mobilePreset === 'mc' ? 'default' : 'outline'}
                  className="h-8 shrink-0"
                  onClick={() => applyMobilePreset('mc')}
                >
                  MC
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mobilePreset === 'liq' ? 'default' : 'outline'}
                  className="h-8 shrink-0"
                  onClick={() => applyMobilePreset('liq')}
                >
                  Liquidity
                </Button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {['5m', '1h', '6h', '24h'].map((tf) => (
                  <Button
                    key={tf}
                    type="button"
                    size="sm"
                    variant={timeframe === tf ? 'default' : 'outline'}
                    className="h-8 shrink-0"
                    onClick={() => setTimeframe(tf)}
                  >
                    {tf}
                  </Button>
                ))}
                <div className="ml-auto shrink-0 flex items-center gap-2">
                  <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                    <CollapsibleTrigger asChild>
                      <Button type="button" size="sm" variant="outline" className="h-8">
                        Filters
                        {countActiveFilters() > 0 ? (
                          <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] text-primary-foreground">
                            {countActiveFilters()}
                          </span>
                        ) : null}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <Card className="bg-card border-border p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Min Liquidity ($)</Label>
                            <Input
                              inputMode="numeric"
                              placeholder="e.g. 10000"
                              value={filters.minLiquidity}
                              onChange={(e) => setFilters((p) => ({ ...p, minLiquidity: e.target.value }))}
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Min MC ($)</Label>
                            <Input
                              inputMode="numeric"
                              placeholder="e.g. 50000"
                              value={filters.minMarketCap}
                              onChange={(e) => setFilters((p) => ({ ...p, minMarketCap: e.target.value }))}
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Min Vol ({timeframe})</Label>
                            <Input
                              inputMode="numeric"
                              placeholder="e.g. 5000"
                              value={filters.minVolume}
                              onChange={(e) => setFilters((p) => ({ ...p, minVolume: e.target.value }))}
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Max Age (hours)</Label>
                            <Input
                              inputMode="numeric"
                              placeholder="e.g. 24"
                              value={filters.maxAgeHours}
                              onChange={(e) => setFilters((p) => ({ ...p, maxAgeHours: e.target.value }))}
                              className="h-9"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={filters.onlyGreen}
                              onCheckedChange={(checked) => setFilters((p) => ({ ...p, onlyGreen: !!checked }))}
                            />
                            <div className="text-xs">Green only</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={filters.onlyWithImage}
                              onCheckedChange={(checked) => setFilters((p) => ({ ...p, onlyWithImage: !!checked }))}
                            />
                            <div className="text-xs">Has logo</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <Button type="button" size="sm" variant="outline" className="h-8" onClick={resetFilters}>
                            Reset
                          </Button>
                          <div className="text-xs text-muted-foreground">
                            {filteredTokens.length} tokens
                          </div>
                        </div>
                      </Card>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            </div>

            {/* Token Table - Desktop */}
            <Card className="hidden sm:block bg-card border-border overflow-hidden">
              <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    <button
                      onClick={() => handleSort('symbol')}
                      className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                    >
                      Token <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    <button
                      onClick={() => handleSort('price')}
                      className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                    >
                      Price <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    <button
                      onClick={() => handleSort(getChangeKey(timeframe))}
                      className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                    >
                      {timeframe} % <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden lg:table-cell">
                    <button
                      onClick={() => handleSort(getVolumeKey(timeframe))}
                      className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                    >
                      Vol {timeframe} <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden lg:table-cell">
                    <button
                      onClick={() => handleSort('marketCap')}
                      className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                    >
                      MC <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden xl:table-cell">
                    <button
                      onClick={() => handleSort('liquidity')}
                      className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                    >
                      Liquidity <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden xl:table-cell">
                    <button
                      onClick={() => handleSort('pairCreatedAt')}
                      className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                    >
                      Age <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                      <p className="text-muted-foreground">Loading meme coins...</p>
                    </td>
                  </tr>
                ) : filteredTokens.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                      {searchQuery ? 'No tokens match your search' : 'No tokens found'}
                    </td>
                  </tr>
                ) : (
                  filteredTokens.map((token) => (
                    <tr
                      key={token.pairAddress || token.address}
                      className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => selectToken(token)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {token.imageUrl ? (
                            <img
                              src={token.imageUrl}
                              alt={token.symbol}
                              className="w-8 h-8 rounded-full bg-muted"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white">
                              {token.symbol?.charAt(0) || '?'}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold">{token.symbol}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[150px]">{token.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {formatPrice(token.price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={'inline-flex items-center gap-1 text-sm font-medium ' + 
                            (getTokenChange(token) >= 0 ? 'text-emerald-500' : 'text-rose-500')
                          }
                        >
                          {getTokenChange(token) >= 0 ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                          {formatChange(getTokenChange(token))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm hidden lg:table-cell">
                        {formatVolume(getTokenVolume(token))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm hidden lg:table-cell">
                        {formatVolume(token.marketCap)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm hidden xl:table-cell">
                        {formatVolume(token.liquidity)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm hidden xl:table-cell">
                        {token.pairCreatedAt ? formatAgeMs(Date.now() - Number(token.pairCreatedAt)) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectToken(token);
                          }}
                        >
                          <SolanaMark className="w-3.5 h-3.5" />
                          Trade
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
              </div>
            </Card>

            {/* Token List - Mobile */}
            <div className="sm:hidden space-y-2">
              {loading ? (
                <Card className="bg-card border-border p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-muted-foreground text-sm">Loading meme coins...</p>
                </Card>
              ) : filteredTokens.length === 0 ? (
                <Card className="bg-card border-border p-8 text-center text-muted-foreground text-sm">
                  {searchQuery ? 'No tokens match your search' : 'No tokens found'}
                </Card>
              ) : (
                filteredTokens.map((token) => (
                  <Card
                    key={token.pairAddress || token.address}
                    className="bg-card border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => selectToken(token)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {token.imageUrl ? (
                          <img
                            src={token.imageUrl}
                            alt={token.symbol}
                            className="w-10 h-10 rounded-full bg-muted"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-sm font-bold text-white">
                            {token.symbol?.charAt(0) || '?'}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold">{token.symbol}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatPrice(token.price)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={'text-sm font-medium ' + (getTokenChange(token) >= 0 ? 'text-emerald-500' : 'text-rose-500')}
                        >
                          {formatChange(getTokenChange(token))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Vol: {formatVolume(getTokenVolume(token))}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Desktop Side Panel */}
          <div className="hidden lg:block">
            <div className="sticky top-24">
              {selectedToken ? (
                <Card className="bg-card border-border overflow-hidden">
                  <div className="p-4 border-b border-border bg-muted/30 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-3">
                      {selectedToken.imageUrl ? (
                        <img src={selectedToken.imageUrl} alt={selectedToken.symbol} className="w-10 h-10 rounded-full bg-muted" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-sm font-bold text-white">
                          {selectedToken.symbol?.charAt(0) || '?'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-lg font-bold leading-tight truncate">{selectedToken.symbol}</div>
                        <div className="text-sm text-muted-foreground truncate">{selectedToken.name}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{formatAddress(selectedToken.address)}</span>
                          {selectedToken.pairCreatedAt ? (
                            <span>• {formatAgeMs(Date.now() - Number(selectedToken.pairCreatedAt))}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedToken.dexUrl ? (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => window.open(selectedToken.dexUrl, '_blank')}
                          aria-label="Open chart"
                          title="Open chart"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      ) : null}
                      <Button variant="outline" size="sm" onClick={() => setSelectedToken(null)}>Close</Button>
                    </div>
                  </div>

                  {/* Chart-first */}
                  {getDexScreenerEmbedUrl(selectedToken) ? (
                    <div className="w-full h-[360px] overflow-hidden bg-background">
                      <iframe
                        title={`${selectedToken.symbol} chart`}
                        src={getDexScreenerEmbedUrl(selectedToken)}
                        className="w-full h-full"
                        frameBorder="0"
                        allow="clipboard-write"
                      />
                    </div>
                  ) : null}

                  <div className="p-4 space-y-4">
                    {/* Compact stats */}
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      <Card className="shrink-0 bg-muted/30 border-border px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">Price</div>
                        <div className="text-sm font-bold font-mono">{formatPrice(selectedToken.price)}</div>
                      </Card>
                      <Card className="shrink-0 bg-muted/30 border-border px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">{timeframe} %</div>
                        <div className={(getTokenChange(selectedToken) >= 0 ? 'text-emerald-500' : 'text-rose-500') + ' text-sm font-bold'}>
                          {formatChange(getTokenChange(selectedToken))}
                        </div>
                      </Card>
                      <Card className="shrink-0 bg-muted/30 border-border px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">Vol {timeframe}</div>
                        <div className="text-sm font-bold font-mono">{formatVolume(getTokenVolume(selectedToken))}</div>
                      </Card>
                      <Card className="shrink-0 bg-muted/30 border-border px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">MC</div>
                        <div className="text-sm font-bold font-mono">{formatVolume(selectedToken.marketCap)}</div>
                      </Card>
                      <Card className="shrink-0 bg-muted/30 border-border px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">Liq</div>
                        <div className="text-sm font-bold font-mono">{formatVolume(selectedToken.liquidity)}</div>
                      </Card>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <SolanaMark className="w-4 h-4" />
                          Trade
                        </div>
                        {quoteSource === 'estimate' ? (
                          <Badge variant="outline" className="text-xs">Estimated</Badge>
                        ) : quoteSource === 'jupiter' ? (
                          <Badge className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Live</Badge>
                        ) : null}
                      </div>

                      <Tabs value={swapMode} onValueChange={setSwapMode} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-muted">
                          <TabsTrigger value="buy" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Buy</TabsTrigger>
                          <TabsTrigger value="sell" className="data-[state=active]:bg-rose-600 data-[state=active]:text-white">Sell</TabsTrigger>
                        </TabsList>
                        <TabsContent value={swapMode} className="mt-3">
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label className="text-muted-foreground text-xs">
                                {swapMode === 'buy' ? (
                                  <span className="inline-flex items-center gap-2">
                                    Pay
                                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5">
                                      <SolanaMark className="h-3.5 w-3.5" />
                                      SOL
                                    </span>
                                  </span>
                                ) : (
                                  `Pay (${selectedToken.symbol})`
                                )}
                              </Label>
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={inputAmount}
                                onChange={(e) => setInputAmount(e.target.value)}
                                className="bg-background border-border h-11"
                              />
                              {swapMode === 'buy' ? (
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                  {[0.1, 0.25, 0.5, 1].map((v) => (
                                    <Button key={v} type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={() => setQuickSolAmount(v)}>
                                      {v} SOL
                                    </Button>
                                  ))}
                                </div>
                              ) : null}
                            </div>

                            <div className="space-y-2">
                              <Label className="text-muted-foreground text-xs">{swapMode === 'buy' ? `Receive (${selectedToken.symbol})` : 'Receive (SOL)'}</Label>
                              <Input
                                type="text"
                                placeholder="0.00"
                                value={quoteLoading ? '...' : outputAmount}
                                readOnly
                                className="bg-muted border-border h-11"
                              />
                              {quoteLoading ? (
                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Getting quote...
                                </div>
                              ) : null}
                            </div>

                            <div className="space-y-2">
                              <Label className="text-muted-foreground text-xs">Slippage</Label>
                              <div className="flex flex-wrap gap-2">
                                {SLIPPAGE_OPTIONS.map((option) => (
                                  <Button
                                    key={option}
                                    size="sm"
                                    variant={slippage === option ? 'default' : 'outline'}
                                    onClick={() => {
                                      setSlippage(option);
                                      setCustomSlippage('');
                                    }}
                                    className={'h-8 ' + (slippage === option ? 'bg-primary' : '')}
                                  >
                                    {option}%
                                  </Button>
                                ))}
                                <Input
                                  type="number"
                                  placeholder="Cust"
                                  value={customSlippage}
                                  onChange={(e) => {
                                    setCustomSlippage(e.target.value);
                                    const val = parseFloat(e.target.value);
                                    if (val > 0 && val <= 50) setSlippage(val);
                                  }}
                                  className="w-20 h-8 bg-background border-border text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>

                      {/* Sticky action bar */}
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <Button
                          size="lg"
                          className={
                            (swapMode === 'buy' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-muted text-foreground hover:bg-muted/80') +
                            ' h-11 w-full'
                          }
                          onClick={() => {
                            if (swapMode !== 'buy') {
                              switchSwapMode('buy');
                              return;
                            }
                            handleSwap();
                          }}
                          disabled={swapMode === 'buy' ? !wallet.connected || swapping || quoteLoading || !inputAmount || !currentQuote : swapping}
                        >
                          {swapMode === 'buy'
                            ? swapping
                              ? 'Buying…'
                              : quoteSource === 'estimate'
                                ? 'BUY (live quote required)'
                                : `BUY ${inputAmount || '0'} SOL`
                            : 'BUY'}
                        </Button>
                        <Button
                          size="lg"
                          className={
                            (swapMode === 'sell' ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-muted text-foreground hover:bg-muted/80') +
                            ' h-11 w-full'
                          }
                          onClick={() => {
                            if (swapMode !== 'sell') {
                              switchSwapMode('sell');
                              return;
                            }
                            handleSwap();
                          }}
                          disabled={swapMode === 'sell' ? !wallet.connected || swapping || quoteLoading || !inputAmount || !currentQuote : swapping}
                        >
                          {swapMode === 'sell'
                            ? swapping
                              ? 'Selling…'
                              : quoteSource === 'estimate'
                                ? 'SELL (live quote required)'
                                : `SELL ${inputAmount || '0'} ${selectedToken.symbol}`
                            : 'SELL'}
                        </Button>
                      </div>

                      {!wallet.connected ? (
                        <div className="text-xs text-muted-foreground">
                          Connect your Solana wallet from the navbar to trade.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Card>
              ) : (
                <Card className="bg-card border-border p-4 text-sm text-muted-foreground">
                  Select a token to open the terminal.
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Token Detail Sheet (Mobile only) */}
      <Sheet open={!!selectedToken && isMobile} onOpenChange={(open) => !open && setSelectedToken(null)}>
        <SheetContent 
          side="right" 
          className="w-full bg-background border-border overflow-y-auto p-0"
        >
          {selectedToken && (
            <div className="flex flex-col h-full">
              {/* Chart-first layout */}
              <div className="relative">
                <div className="h-[48vh] min-h-[320px] w-full bg-background">
                  {getDexScreenerEmbedUrl(selectedToken) ? (
                    <iframe
                      title={`${selectedToken.symbol} chart`}
                      src={getDexScreenerEmbedUrl(selectedToken)}
                      className="w-full h-full"
                      frameBorder="0"
                      allow="clipboard-write"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                      Chart unavailable
                    </div>
                  )}
                </div>

                {/* Compact overlay header */}
                <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-background/90 to-transparent">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {selectedToken.imageUrl ? (
                          <img
                            src={selectedToken.imageUrl}
                            alt={selectedToken.symbol}
                            className="w-8 h-8 rounded-full bg-muted"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white">
                            {selectedToken.symbol?.charAt(0) || '?'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-base font-bold leading-tight truncate">{selectedToken.symbol}</div>
                          <div className="text-xs text-muted-foreground truncate">{selectedToken.name}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="font-mono text-muted-foreground">{formatAddress(selectedToken.address)}</span>
                        {selectedToken.pairCreatedAt ? (
                          <span className="text-muted-foreground">• {formatAgeMs(Date.now() - Number(selectedToken.pairCreatedAt))}</span>
                        ) : null}
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(selectedToken.address);
                              toast.success('Token mint copied');
                            } catch {
                              // ignore
                            }
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedToken.dexUrl ? (
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => window.open(selectedToken.dexUrl, '_blank')}
                          aria-label="Open chart"
                          title="Open chart"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      ) : null}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-9"
                        onClick={() => setSelectedToken(null)}
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Compact stats row */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <Card className="shrink-0 bg-muted/30 border-border px-3 py-2">
                    <div className="text-[11px] text-muted-foreground">Price</div>
                    <div className="text-sm font-bold font-mono">{formatPrice(selectedToken.price)}</div>
                  </Card>
                  <Card className="shrink-0 bg-muted/30 border-border px-3 py-2">
                    <div className="text-[11px] text-muted-foreground">{timeframe} %</div>
                    <div className={(getTokenChange(selectedToken) >= 0 ? 'text-emerald-500' : 'text-rose-500') + ' text-sm font-bold'}>
                      {formatChange(getTokenChange(selectedToken))}
                    </div>
                  </Card>
                  <Card className="shrink-0 bg-muted/30 border-border px-3 py-2">
                    <div className="text-[11px] text-muted-foreground">Vol {timeframe}</div>
                    <div className="text-sm font-bold font-mono">{formatVolume(getTokenVolume(selectedToken))}</div>
                  </Card>
                  <Card className="shrink-0 bg-muted/30 border-border px-3 py-2">
                    <div className="text-[11px] text-muted-foreground">MC</div>
                    <div className="text-sm font-bold font-mono">{formatVolume(selectedToken.marketCap)}</div>
                  </Card>
                  <Card className="shrink-0 bg-muted/30 border-border px-3 py-2">
                    <div className="text-[11px] text-muted-foreground">Liq</div>
                    <div className="text-sm font-bold font-mono">{formatVolume(selectedToken.liquidity)}</div>
                  </Card>
                </div>

                {/* Trade panel */}
                <Card className="bg-card border-border p-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-medium">Trade</div>
                        {quoteSource === 'estimate' ? (
                          <Badge variant="outline" className="text-xs">Estimated</Badge>
                        ) : quoteSource === 'jupiter' ? (
                          <Badge className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Live</Badge>
                        ) : null}
                      </div>

                      {!wallet.connected ? (
                        <div className="text-xs text-muted-foreground mb-3">
                          Connect your Solana wallet from the navbar to trade.
                        </div>
                      ) : null}

                      <Tabs value={swapMode} onValueChange={setSwapMode} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted">
                          <TabsTrigger value="buy" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Buy</TabsTrigger>
                          <TabsTrigger value="sell" className="data-[state=active]:bg-rose-600 data-[state=active]:text-white">Sell</TabsTrigger>
                        </TabsList>
                        <TabsContent value={swapMode} className="mt-0">
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label className="text-muted-foreground text-sm">
                                {swapMode === 'buy' ? 'Pay (SOL)' : `Pay (${selectedToken.symbol})`}
                              </Label>
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={inputAmount}
                                onChange={(e) => setInputAmount(e.target.value)}
                                className="bg-background border-border text-lg h-11"
                              />
                              {swapMode === 'buy' ? (
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                  {[0.1, 0.25, 0.5, 1].map((v) => (
                                    <Button key={v} type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={() => setQuickSolAmount(v)}>
                                      {v} SOL
                                    </Button>
                                  ))}
                                </div>
                              ) : null}
                            </div>

                            <div className="space-y-2">
                              <Label className="text-muted-foreground text-sm">
                                {swapMode === 'buy' ? `Receive (${selectedToken.symbol})` : 'Receive (SOL)'}
                              </Label>
                              <Input
                                type="text"
                                placeholder="0.00"
                                value={quoteLoading ? '...' : outputAmount}
                                readOnly
                                className="bg-muted border-border text-lg h-11"
                              />
                              {quoteLoading ? (
                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Getting quote...
                                </div>
                              ) : null}
                            </div>

                            <div className="space-y-2">
                              <Label className="text-muted-foreground text-sm">Slippage</Label>
                              <div className="flex flex-wrap gap-2">
                                {SLIPPAGE_OPTIONS.map((option) => (
                                  <Button
                                    key={option}
                                    size="sm"
                                    variant={slippage === option ? 'default' : 'outline'}
                                    onClick={() => {
                                      setSlippage(option);
                                      setCustomSlippage('');
                                    }}
                                    className={'h-8 ' + (slippage === option ? 'bg-primary' : '')}
                                  >
                                    {option}%
                                  </Button>
                                ))}
                                <Input
                                  type="number"
                                  placeholder="Cust"
                                  value={customSlippage}
                                  onChange={(e) => {
                                    setCustomSlippage(e.target.value);
                                    const val = parseFloat(e.target.value);
                                    if (val > 0 && val <= 50) setSlippage(val);
                                  }}
                                  className="w-20 h-8 bg-background border-border text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                </Card>

                {/* Sticky action bar (terminal-style) */}
                <div className="sticky bottom-0 left-0 right-0 -mx-4 mt-3 border-t border-border bg-background/95 backdrop-blur px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      size="lg"
                      className={
                        (swapMode === 'buy'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-muted text-foreground hover:bg-muted/80') +
                        ' h-12 w-full'
                      }
                      onClick={() => {
                        if (swapMode !== 'buy') {
                          switchSwapMode('buy');
                          return;
                        }
                        handleSwap();
                      }}
                      disabled={
                        swapMode === 'buy'
                          ? !wallet.connected || swapping || quoteLoading || !inputAmount || !currentQuote
                          : swapping
                      }
                    >
                      {swapMode === 'buy' ? (
                        swapping ? (
                          <><Loader2 className="w-4 h-4 animate-spin mr-2" />Buying...</>
                        ) : quoteSource === 'estimate' ? (
                          'BUY (live quote required)'
                        ) : (
                          `BUY ${inputAmount || '0'} SOL`
                        )
                      ) : (
                        'BUY'
                      )}
                    </Button>

                    <Button
                      size="lg"
                      className={
                        (swapMode === 'sell'
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-muted text-foreground hover:bg-muted/80') +
                        ' h-12 w-full'
                      }
                      onClick={() => {
                        if (swapMode !== 'sell') {
                          switchSwapMode('sell');
                          return;
                        }
                        handleSwap();
                      }}
                      disabled={
                        swapMode === 'sell'
                          ? !wallet.connected || swapping || quoteLoading || !inputAmount || !currentQuote
                          : swapping
                      }
                    >
                      {swapMode === 'sell' ? (
                        swapping ? (
                          <><Loader2 className="w-4 h-4 animate-spin mr-2" />Selling...</>
                        ) : quoteSource === 'estimate' ? (
                          'SELL (live quote required)'
                        ) : (
                          `SELL ${inputAmount || '0'} ${selectedToken.symbol}`
                        )
                      ) : (
                        'SELL'
                      )}
                    </Button>
                  </div>

                  {!wallet.connected ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Connect your Solana wallet from the navbar to trade.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
