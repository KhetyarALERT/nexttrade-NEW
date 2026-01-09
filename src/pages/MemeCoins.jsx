import { useState, useEffect, useRef, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { 
  ArrowUpDown, TrendingUp, TrendingDown, Search, Loader2, 
  ExternalLink, RefreshCw, Zap
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
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
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTokens(tokens);
      return;
    }
    const query = searchQuery.toLowerCase();
    const filtered = tokens.filter(token =>
      token.symbol?.toLowerCase().includes(query) ||
      token.name?.toLowerCase().includes(query)
    );
    setFilteredTokens(filtered);
  }, [searchQuery, tokens]);

  // Sort tokens
  const handleSort = useCallback((key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc';
    setSortConfig({ key, direction });

    const sorted = [...filteredTokens].sort((a, b) => {
      const aVal = a[key] || 0;
      const bVal = b[key] || 0;
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    setFilteredTokens(sorted);
  }, [sortConfig, filteredTokens]);

  // Select token
  const selectToken = useCallback((token) => {
    setSelectedToken(token);
    setInputAmount('');
    setOutputAmount('');
    setCurrentQuote(null);
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
            <Badge className="bg-violet-500/10 text-violet-500 dark:text-violet-400 border-violet-500/20 hover:bg-violet-500/20">
              Solana
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
                      onClick={() => handleSort('change24h')}
                      className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                    >
                      24h % <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden lg:table-cell">
                    <button
                      onClick={() => handleSort('volume24h')}
                      className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                    >
                      Volume <ArrowUpDown className="w-3 h-3" />
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
                            (token.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500')
                          }
                        >
                          {token.change24h >= 0 ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                          {formatChange(token.change24h)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm hidden lg:table-cell">
                        {formatVolume(token.volume24h)}
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
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectToken(token);
                          }}
                        >
                          <Zap className="w-3.5 h-3.5 mr-1" />
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
                          className={'text-sm font-medium ' + (token.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500')}
                        >
                          {formatChange(token.change24h)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Vol: {formatVolume(token.volume24h)}
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
                    <div className="min-w-0">
                      <div className="text-lg font-bold leading-tight truncate">{selectedToken.symbol}</div>
                      <div className="text-sm text-muted-foreground truncate">{selectedToken.name}</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setSelectedToken(null)}>Close</Button>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <Card className="bg-muted/30 border-border p-3">
                        <div className="text-xs text-muted-foreground">Price</div>
                        <div className="text-base font-bold font-mono">{formatPrice(selectedToken.price)}</div>
                      </Card>
                      <Card className="bg-muted/30 border-border p-3">
                        <div className="text-xs text-muted-foreground">24h</div>
                        <div className={(selectedToken.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500') + ' text-base font-bold'}>
                          {formatChange(selectedToken.change24h)}
                        </div>
                      </Card>
                      <Card className="bg-muted/30 border-border p-3">
                        <div className="text-xs text-muted-foreground">Vol</div>
                        <div className="text-base font-bold font-mono">{formatVolume(selectedToken.volume24h)}</div>
                      </Card>
                      <Card className="bg-muted/30 border-border p-3">
                        <div className="text-xs text-muted-foreground">MC</div>
                        <div className="text-base font-bold font-mono">{formatVolume(selectedToken.marketCap)}</div>
                      </Card>
                    </div>

                    {getDexScreenerEmbedUrl(selectedToken) ? (
                      <div className="w-full h-[300px] rounded-lg overflow-hidden bg-background">
                        <iframe
                          title={`${selectedToken.symbol} chart`}
                          src={getDexScreenerEmbedUrl(selectedToken)}
                          className="w-full h-full"
                          frameBorder="0"
                          allow="clipboard-write"
                        />
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">Trade</div>
                        {quoteSource === 'estimate' ? (
                          <Badge variant="outline" className="text-xs">Estimated</Badge>
                        ) : quoteSource === 'jupiter' ? (
                          <Badge className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Live</Badge>
                        ) : null}
                      </div>

                      {!wallet.connected ? (
                        <div className="text-xs text-muted-foreground">
                          Connect your Solana wallet from the navbar to enable swapping.
                        </div>
                      ) : null}

                      <Tabs value={swapMode} onValueChange={setSwapMode} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-muted">
                          <TabsTrigger value="buy" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Buy</TabsTrigger>
                          <TabsTrigger value="sell" className="data-[state=active]:bg-rose-600 data-[state=active]:text-white">Sell</TabsTrigger>
                        </TabsList>
                        <TabsContent value={swapMode} className="mt-3">
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label className="text-muted-foreground text-xs">{swapMode === 'buy' ? 'Pay (SOL)' : `Pay (${selectedToken.symbol})`}</Label>
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={inputAmount}
                                onChange={(e) => setInputAmount(e.target.value)}
                                className="bg-background border-border h-11"
                              />
                              {swapMode === 'buy' ? (
                                <div className="flex gap-2">
                                  {[0.1, 0.25, 0.5, 1].map((v) => (
                                    <Button key={v} type="button" variant="outline" size="sm" className="h-8" onClick={() => setQuickSolAmount(v)}>
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

                            <Button
                              size="lg"
                              className={'w-full text-base h-11 ' + (swapMode === 'buy' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700') + ' text-white'}
                              onClick={handleSwap}
                              disabled={!wallet.connected || swapping || quoteLoading || !inputAmount || !currentQuote}
                            >
                              {swapping ? (
                                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Swapping...</>
                              ) : quoteSource === 'estimate' ? (
                                'Live quote required'
                              ) : (
                                <><Zap className="w-4 h-4 mr-2" />{swapMode === 'buy' ? 'Buy' : 'Sell'} {selectedToken.symbol}</>
                              )}
                            </Button>
                          </div>
                        </TabsContent>
                      </Tabs>
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
              <SheetHeader className="p-4 sm:p-6 pr-14 border-b border-border bg-muted/30">
                <SheetTitle className="flex items-start gap-3">
                  {selectedToken.imageUrl ? (
                    <img
                      src={selectedToken.imageUrl}
                      alt={selectedToken.symbol}
                      className="w-12 h-12 rounded-full bg-muted"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-lg font-bold text-white">
                      {selectedToken.symbol?.charAt(0) || '?'}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="text-xl font-bold leading-tight">{selectedToken.symbol}</div>
                    <div className="text-sm text-muted-foreground font-normal truncate">{selectedToken.name}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-normal">
                      <span className="font-mono">{formatAddress(selectedToken.address)}</span>
                      {selectedToken.pairCreatedAt ? (
                        <span>Age: {formatAgeMs(Date.now() - Number(selectedToken.pairCreatedAt))}</span>
                      ) : null}
                      <Button
                        variant="ghost"
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
                        Copy mint
                      </Button>
                      {selectedToken.dexUrl ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => window.open(selectedToken.dexUrl, '_blank')}
                        >
                          DexScreener
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Card className="bg-muted/30 border-border p-3">
                        <div className="text-xs text-muted-foreground mb-1">Price</div>
                        <div className="text-base font-bold font-mono">{formatPrice(selectedToken.price)}</div>
                        <div className="text-xs text-muted-foreground mt-1">1h: {formatChange(selectedToken.change1h || 0)}</div>
                      </Card>
                      <Card className="bg-muted/30 border-border p-3">
                        <div className="text-xs text-muted-foreground mb-1">Market Cap</div>
                        <div className="text-base font-bold font-mono">{formatVolume(selectedToken.marketCap)}</div>
                        <div className="text-xs text-muted-foreground mt-1">FDV</div>
                      </Card>
                      <Card className="bg-muted/30 border-border p-3">
                        <div className="text-xs text-muted-foreground mb-1">Liquidity</div>
                        <div className="text-base font-bold font-mono">{formatVolume(selectedToken.liquidity)}</div>
                        <div className="text-xs text-muted-foreground mt-1">24h vol: {formatVolume(selectedToken.volume24h)}</div>
                      </Card>
                      <Card className="bg-muted/30 border-border p-3">
                        <div className="text-xs text-muted-foreground mb-1">Txns (24h)</div>
                        <div className="text-base font-bold font-mono">
                          {(selectedToken.txns24h?.buys || 0) + (selectedToken.txns24h?.sells || 0)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          B/S: {selectedToken.txns24h?.buys || 0}/{selectedToken.txns24h?.sells || 0}
                        </div>
                      </Card>
                    </div>

                    <Card className="bg-muted/30 border-border p-3 sm:p-4">
                      <div className="text-sm font-medium mb-3 flex items-center justify-between">
                        <span>Chart</span>
                        {selectedToken.dexUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-2"
                            onClick={() => window.open(selectedToken.dexUrl, '_blank')}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open
                          </Button>
                        )}
                      </div>
                      {getDexScreenerEmbedUrl(selectedToken) ? (
                        <div className="w-full h-[340px] lg:h-[520px] rounded-lg overflow-hidden bg-background">
                          <iframe
                            title={`${selectedToken.symbol} chart`}
                            src={getDexScreenerEmbedUrl(selectedToken)}
                            className="w-full h-full"
                            frameBorder="0"
                            allow="clipboard-write"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-[300px] rounded-lg flex items-center justify-center text-sm text-muted-foreground">
                          Chart unavailable
                        </div>
                      )}
                    </Card>

                    <Card className="bg-muted/30 border-border p-3 sm:p-4">
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
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-muted-foreground text-sm">
                                {swapMode === 'buy' ? 'Pay (SOL)' : `Pay (${selectedToken.symbol})`}
                              </Label>
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={inputAmount}
                                onChange={(e) => setInputAmount(e.target.value)}
                                className="bg-background border-border text-lg h-12"
                              />
                              {swapMode === 'buy' ? (
                                <div className="flex gap-2">
                                  {[0.1, 0.25, 0.5, 1].map((v) => (
                                    <Button key={v} type="button" variant="outline" size="sm" className="h-8" onClick={() => setQuickSolAmount(v)}>
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
                                className="bg-muted border-border text-lg h-12"
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

                            <Button
                              size="lg"
                              className={'w-full text-base h-12 ' +
                                (swapMode === 'buy' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700') +
                                ' text-white'
                              }
                              onClick={handleSwap}
                              disabled={!wallet.connected || swapping || quoteLoading || !inputAmount || !currentQuote}
                            >
                              {swapping ? (
                                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Swapping...</>
                              ) : quoteSource === 'estimate' ? (
                                'Live quote required'
                              ) : (
                                <><Zap className="w-4 h-4 mr-2" />{swapMode === 'buy' ? 'Buy' : 'Sell'} {selectedToken.symbol}</>
                              )}
                            </Button>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </Card>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
