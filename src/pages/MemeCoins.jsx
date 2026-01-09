import { useState, useEffect, useRef, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { 
  ArrowUpDown, TrendingUp, TrendingDown, Search, Loader2, 
  Wallet, ChevronDown, ExternalLink, Copy, LogOut, Check,
  RefreshCw, Zap
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import * as jupiterApi from '@/api/jupiter';
import { fetchTrendingSolanaTokens } from '@/api/dexscreener';

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
  
  // State
  const [tokens, setTokens] = useState([]);
  const [filteredTokens, setFilteredTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'volume24h', direction: 'desc' });
  
  // Wallet dropdown state
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Swap state
  const [swapMode, setSwapMode] = useState('buy');
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [slippage, setSlippage] = useState(1);
  const [customSlippage, setCustomSlippage] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(null);

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

  // Copy address
  const copyAddress = useCallback(async () => {
    if (wallet.publicKey) {
      await navigator.clipboard.writeText(wallet.publicKey.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Address copied!');
    }
  }, [wallet.publicKey]);

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

  // Get quote when amount changes
  useEffect(() => {
    if (!selectedToken || !inputAmount || parseFloat(inputAmount) <= 0) {
      setOutputAmount('');
      setCurrentQuote(null);
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

        const quote = await jupiterApi.getQuote(inputMint, outputMint, rawAmount, slippageBps);
        
        if (quote) {
          const output = jupiterApi.fromRawAmount(parseInt(quote.outAmount, 10), outputDecimals);
          const displayDecimals = Math.min(Math.max(outputDecimals, 2), 6);
          setOutputAmount(Number.isFinite(output) ? output.toFixed(displayDecimals) : '');
          setCurrentQuote(quote);
        }
      } catch (error) {
        console.error('Quote error:', error);
        setOutputAmount('');
        setCurrentQuote(null);

        // Helpful UX hint for hosted previews where Jupiter DNS is blocked.
        const msg = String(error?.message || 'Failed to fetch quote');
        if (msg.includes('Failed to fetch') || msg.includes('ERR_NAME_NOT_RESOLVED')) {
          toast.error('Quotes blocked by network/DNS in this environment. Try local dev or add a proxy for quote-api.jup.ag.');
        }
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
      toast.error('No quote available');
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
    if (!price || price === 0) return '$0.00';
    if (price < 0.000001) return '$' + price.toExponential(2);
    if (price < 0.01) return '$' + price.toFixed(8);
    if (price < 1) return '$' + price.toFixed(6);
    return '$' + price.toFixed(2);
  };

  const formatVolume = (volume) => {
    if (!volume || volume === 0) return '$0';
    if (volume >= 1e9) return '$' + (volume / 1e9).toFixed(2) + 'B';
    if (volume >= 1e6) return '$' + (volume / 1e6).toFixed(2) + 'M';
    if (volume >= 1e3) return '$' + (volume / 1e3).toFixed(2) + 'K';
    return '$' + volume.toFixed(2);
  };

  const formatChange = (change) => {
    if (change === undefined || change === null) return '0.00%';
    return (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
  };

  // Wallet Button Component
  const WalletButton = () => {
    if (wallet.connected && wallet.publicKey) {
      return (
        <DropdownMenu open={walletDropdownOpen} onOpenChange={setWalletDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="gap-2 bg-card border-border hover:bg-accent min-w-[140px]"
            >
              {wallet.wallet?.adapter?.icon ? (
                <img 
                  src={wallet.wallet.adapter.icon} 
                  alt={wallet.wallet.adapter.name}
                  className="w-5 h-5 rounded-full"
                />
              ) : (
                <Wallet className="w-4 h-4" />
              )}
              <span className="font-mono text-sm">{formatAddress(wallet.publicKey)}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs text-muted-foreground mb-1">Connected with {wallet.wallet?.adapter?.name}</p>
              <p className="font-mono text-sm">{formatAddress(wallet.publicKey)}</p>
            </div>
            <DropdownMenuItem onClick={copyAddress} className="gap-2 cursor-pointer">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Address'}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => window.open('https://solscan.io/account/' + wallet.publicKey, '_blank')}
              className="gap-2 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              View on Explorer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => wallet.disconnect()}
              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <Button 
        onClick={() => setWalletModalVisible(true)}
        className="glow-button bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-0 rounded-xl px-4 hover:from-blue-700 hover:to-cyan-700 gap-2"
      >
        <Wallet className="w-4 h-4" />
        Connect Wallet
      </Button>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold">Meme Coin Terminal</h1>
              <Badge className="bg-violet-500/10 text-violet-500 dark:text-violet-400 border-violet-500/20 hover:bg-violet-500/20">
                Solana
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={refreshing}
                className="h-9 w-9"
              >
                <RefreshCw className={'w-4 h-4 ' + (refreshing ? 'animate-spin' : '')} />
              </Button>
              <WalletButton />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Search */}
        <div className="mb-4 sm:mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search meme coins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card border-border"
            />
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
                      className={'text-sm font-medium ' + 
                        (token.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500')
                      }
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

      {/* Token Detail Sheet */}
      <Sheet open={!!selectedToken} onOpenChange={(open) => !open && setSelectedToken(null)}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-[920px] bg-background border-border overflow-y-auto p-0"
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

              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
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
                  </div>

                  <Card className="bg-muted/30 border-border p-3 sm:p-4">
                    {!wallet.connected && (
                      <Button
                        onClick={() => setWalletModalVisible(true)}
                        className="w-full glow-button bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-0 rounded-xl hover:from-blue-700 hover:to-cyan-700"
                      >
                        <Wallet className="w-4 h-4 mr-2" />
                        Connect Solana Wallet
                      </Button>
                    )}

                    <div className={wallet.connected ? '' : 'mt-3'}>
                      <Tabs value={swapMode} onValueChange={setSwapMode} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted">
                          <TabsTrigger value="buy" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                            Buy
                          </TabsTrigger>
                          <TabsTrigger value="sell" className="data-[state=active]:bg-rose-600 data-[state=active]:text-white">
                            Sell
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value={swapMode} className="mt-0">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-muted-foreground text-sm">
                                {swapMode === 'buy' ? 'Pay (SOL)' : `Pay (${selectedToken.symbol})`}
                              </Label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  value={inputAmount}
                                  onChange={(e) => setInputAmount(e.target.value)}
                                  className="bg-background border-border text-lg h-12 pr-16"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                  {swapMode === 'buy' ? 'SOL' : selectedToken.symbol}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-muted-foreground text-sm">
                                {swapMode === 'buy' ? `Receive (${selectedToken.symbol})` : 'Receive (SOL)'}
                              </Label>
                              <div className="relative">
                                <Input
                                  type="text"
                                  placeholder="0.00"
                                  value={quoteLoading ? '...' : outputAmount}
                                  readOnly
                                  className="bg-muted border-border text-lg h-12 pr-16"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                  {swapMode === 'buy' ? selectedToken.symbol : 'SOL'}
                                </span>
                              </div>
                              {quoteLoading && (
                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Getting quote...
                                </div>
                              )}
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
                                (swapMode === 'buy'
                                  ? 'bg-emerald-600 hover:bg-emerald-700'
                                  : 'bg-rose-600 hover:bg-rose-700') +
                                ' text-white'
                              }
                              onClick={handleSwap}
                              disabled={!wallet.connected || swapping || quoteLoading || !inputAmount || !currentQuote}
                            >
                              {swapping ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                  Swapping...
                                </>
                              ) : !wallet.connected ? (
                                'Connect wallet'
                              ) : !inputAmount ? (
                                'Enter amount'
                              ) : quoteLoading ? (
                                'Getting quote...'
                              ) : (
                                <>
                                  <Zap className="w-4 h-4 mr-2" />
                                  {swapMode === 'buy' ? 'Buy' : 'Sell'} {selectedToken.symbol}
                                </>
                              )}
                            </Button>

                            {currentQuote && currentQuote.priceImpactPct > 1 && (
                              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-600 dark:text-amber-400">
                                Price impact: {parseFloat(currentQuote.priceImpactPct).toFixed(2)}%
                              </div>
                            )}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
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
