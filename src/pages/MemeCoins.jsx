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

// Constants
const SLIPPAGE_OPTIONS = [0.5, 1, 2, 5];
const DEXSCREENER_API = 'https://api.dexscreener.com';

// Popular Solana meme coins to search for
const MEME_COINS = [
  'BONK', 'WIF', 'POPCAT', 'MEW', 'BOME', 'MYRO', 
  'SLERF', 'PENG', 'BOOK', 'MICHI', 'SAMO', 'FOXY',
  'PONKE', 'GOAT', 'MUMU', 'TREMP', 'HARAMBE', 'GIGA'
];

// Simple cache
const cache = new Map();
const CACHE_TTL = 30000;

const SOL_MINT = jupiterApi.TOKENS.SOL;
const SOL_DECIMALS = 9;

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

      // Also fetch boosted tokens
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

      const swapTransaction = await jupiterApi.getSwapTransaction(
        currentQuote,
        wallet.publicKey.toString()
      );

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
        className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/25"
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
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden xl:table-cell">
                    <button
                      onClick={() => handleSort('liquidity')}
                      className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                    >
                      Liquidity <ArrowUpDown className="w-3 h-3" />
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
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                      <p className="text-muted-foreground">Loading meme coins...</p>
                    </td>
                  </tr>
                ) : filteredTokens.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
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
                      <td className="px-4 py-3 text-right font-mono text-sm hidden xl:table-cell">
                        {formatVolume(token.liquidity)}
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
          className="w-full sm:max-w-[500px] bg-background border-border overflow-y-auto p-0"
        >
          {selectedToken && (
            <div className="flex flex-col h-full">
              {/* Sheet Header */}
              <SheetHeader className="p-4 sm:p-6 pr-14 border-b border-border bg-muted/30">
                <SheetTitle className="flex items-center gap-3">
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
                  <div className="flex-1">
                    <div className="text-xl font-bold">{selectedToken.symbol}</div>
                    <div className="text-sm text-muted-foreground font-normal">
                      {selectedToken.name}
                    </div>
                  </div>
                </SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Price Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="bg-muted/30 border-border p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-muted-foreground mb-1">Price</div>
                    <div className="text-base sm:text-lg font-bold font-mono">
                      {formatPrice(selectedToken.price)}
                    </div>
                  </Card>
                  <Card className="bg-muted/30 border-border p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-muted-foreground mb-1">24h Change</div>
                    <div
                      className={'text-base sm:text-lg font-bold flex items-center gap-1.5 ' + 
                        (selectedToken.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500')
                      }
                    >
                      {selectedToken.change24h >= 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      {formatChange(selectedToken.change24h)}
                    </div>
                  </Card>
                  <Card className="bg-muted/30 border-border p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-muted-foreground mb-1">24h Volume</div>
                    <div className="text-base sm:text-lg font-bold font-mono">
                      {formatVolume(selectedToken.volume24h)}
                    </div>
                  </Card>
                  <Card className="bg-muted/30 border-border p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-muted-foreground mb-1">Liquidity</div>
                    <div className="text-base sm:text-lg font-bold font-mono">
                      {formatVolume(selectedToken.liquidity)}
                    </div>
                  </Card>
                  <Card className="bg-muted/30 border-border p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-muted-foreground mb-1">Market Cap (FDV)</div>
                    <div className="text-base sm:text-lg font-bold font-mono">
                      {formatVolume(selectedToken.marketCap)}
                    </div>
                  </Card>
                  <Card className="bg-muted/30 border-border p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-muted-foreground mb-1">24h Txns</div>
                    <div className="text-base sm:text-lg font-bold font-mono">
                      {(selectedToken.txns24h?.buys || 0) + (selectedToken.txns24h?.sells || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Buys: {selectedToken.txns24h?.buys || 0} · Sells: {selectedToken.txns24h?.sells || 0}
                    </div>
                  </Card>
                </div>

                {/* Chart */}
                <Card className="bg-muted/30 border-border p-3 sm:p-4">
                  <div className="text-sm font-medium mb-3 flex items-center justify-between">
                    <span>Price Chart</span>
                    {selectedToken.dexUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-2"
                        onClick={() => window.open(selectedToken.dexUrl, '_blank')}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        DexScreener
                      </Button>
                    )}
                  </div>
                  {getDexScreenerEmbedUrl(selectedToken) ? (
                    <div className="w-full h-[260px] sm:h-[320px] rounded-lg overflow-hidden bg-background">
                      <iframe
                        title={`${selectedToken.symbol} chart`}
                        src={getDexScreenerEmbedUrl(selectedToken)}
                        className="w-full h-full"
                        frameBorder="0"
                        allow="clipboard-write"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-[200px] sm:h-[250px] rounded-lg flex items-center justify-center text-sm text-muted-foreground">
                      Chart unavailable
                    </div>
                  )}
                </Card>

                {/* Swap Panel */}
                <Card className="bg-muted/30 border-border p-3 sm:p-4">
                  <Tabs value={swapMode} onValueChange={setSwapMode} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted">
                      <TabsTrigger 
                        value="buy" 
                        className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                      >
                        Buy
                      </TabsTrigger>
                      <TabsTrigger 
                        value="sell" 
                        className="data-[state=active]:bg-rose-600 data-[state=active]:text-white"
                      >
                        Sell
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value={swapMode} className="mt-0">
                      <div className="space-y-4">
                        {/* Input Amount */}
                        <div className="space-y-2">
                          <Label className="text-muted-foreground text-sm">
                            {swapMode === 'buy' ? 'Pay (SOL)' : 'Pay (' + selectedToken.symbol + ')'}
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

                        {/* Output Amount */}
                        <div className="space-y-2">
                          <Label className="text-muted-foreground text-sm">
                            {swapMode === 'buy' ? 'Receive (' + selectedToken.symbol + ')' : 'Receive (SOL)'}
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
                              Getting best price...
                            </div>
                          )}
                        </div>

                        {/* Slippage */}
                        <div className="space-y-2">
                          <Label className="text-muted-foreground text-sm">Slippage Tolerance</Label>
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
                              placeholder="Custom"
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

                        {/* Swap Button */}
                        <Button
                          size="lg"
                          className={'w-full text-base h-12 ' + 
                            (swapMode === 'buy' 
                              ? 'bg-emerald-600 hover:bg-emerald-700' 
                              : 'bg-rose-600 hover:bg-rose-700') +
                            ' text-white'
                          }
                          onClick={handleSwap}
                          disabled={swapping || quoteLoading || !inputAmount}
                        >
                          {!wallet.connected ? (
                            <>
                              <Wallet className="w-4 h-4 mr-2" />
                              Connect Wallet
                            </>
                          ) : swapping ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Swapping...
                            </>
                          ) : !inputAmount ? (
                            'Enter Amount'
                          ) : quoteLoading ? (
                            'Getting Quote...'
                          ) : (
                            <>
                              <Zap className="w-4 h-4 mr-2" />
                              {swapMode === 'buy' ? 'Buy' : 'Sell'} {selectedToken.symbol}
                            </>
                          )}
                        </Button>

                        {/* Price Impact Warning */}
                        {currentQuote && currentQuote.priceImpactPct > 1 && (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-600 dark:text-amber-400">
                            ⚠️ Price impact: {parseFloat(currentQuote.priceImpactPct).toFixed(2)}%
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </Card>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
