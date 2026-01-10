import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { 
  TrendingUp, TrendingDown, Search, Loader2, 
  ExternalLink, RefreshCw, X, ChevronDown,
  Globe, Send, Clock, Users, Shield, Flame,
  ArrowUpRight, ArrowDownRight, Zap
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import * as jupiterApi from '@/api/jupiter';
import { fetchTrendingSolanaTokens, searchTokens } from '@/api/dexscreener';
import { useIsMobile } from '@/hooks/use-mobile';
import { tMemeCoins } from '@/lib/i18n/memecoins';

// Constants
const SLIPPAGE_OPTIONS = [0.5, 1, 2, 5];
const SOL_MINT = jupiterApi.TOKENS.SOL;
const SOL_DECIMALS = 9;

// Solana Logo SVG
function SolanaLogo({ className }) {
  return (
    <svg viewBox="0 0 397 311" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sol-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00FFA3" />
          <stop offset="100%" stopColor="#DC1FFF" />
        </linearGradient>
      </defs>
      <path d="M64.6 236.9c2.5-2.5 5.9-3.9 9.5-3.9h306.3c6 0 9 7.3 4.7 11.6l-60.4 60.4c-2.5 2.5-5.9 3.9-9.5 3.9H8.9c-6 0-9-7.3-4.7-11.6l60.4-60.4z" fill="url(#sol-gradient)"/>
      <path d="M64.6 3.9C67.1 1.4 70.5 0 74.1 0h306.3c6 0 9 7.3 4.7 11.6L324.7 72c-2.5 2.5-5.9 3.9-9.5 3.9H8.9c-6 0-9-7.3-4.7-11.6L64.6 3.9z" fill="url(#sol-gradient)"/>
      <path d="M332.4 120.4c-2.5-2.5-5.9-3.9-9.5-3.9H16.6c-6 0-9 7.3-4.7 11.6l60.4 60.4c2.5 2.5 5.9 3.9 9.5 3.9h306.3c6 0 9-7.3 4.7-11.6l-60.4-60.4z" fill="url(#sol-gradient)"/>
    </svg>
  );
}

// Utility functions
const toNumber = (val) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

const formatPrice = (price) => {
  const n = toNumber(price);
  if (!n) return '$0.00';
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toPrecision(3)}`;
};

const formatCompact = (num) => {
  const n = toNumber(num);
  if (!n) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
};

const formatChange = (change) => {
  const n = toNumber(change);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
};

const formatAge = (timestamp) => {
  if (!timestamp) return '—';
  const ms = Date.now() - Number(timestamp);
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const formatAddress = (addr) => addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : '';

// Token Card Component - Compact and clean
function TokenCard({ token, selected, onClick, timeframe }) {
  const change = toNumber(token[`change${timeframe}`] || token.change24h);
  const volume = toNumber(token[`volume${timeframe}`] || token.volume24h);
  const isUp = change >= 0;
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-xl border transition-all duration-200",
        "hover:bg-accent/50 active:scale-[0.98]",
        selected 
          ? "bg-primary/10 border-primary/30 shadow-sm" 
          : "bg-card/50 border-border/50 hover:border-border"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Token Image */}
        {token.imageUrl ? (
          <img src={token.imageUrl} alt="" className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {token.symbol?.charAt(0) || '?'}
          </div>
        )}
        
        {/* Token Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{token.symbol}</span>
            {token.pairCreatedAt && (Date.now() - Number(token.pairCreatedAt)) < 86400000 && (
              <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-amber-500/20 text-amber-600">
                <Flame className="w-2.5 h-2.5 mr-0.5" /> NEW
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span className="font-mono">{formatPrice(token.price)}</span>
            <span className="opacity-60">•</span>
            <span>MC {formatCompact(token.marketCap)}</span>
          </div>
        </div>
        
        {/* Price Change */}
        <div className="text-right flex-shrink-0">
          <div className={cn(
            "text-sm font-semibold flex items-center gap-1 justify-end",
            isUp ? "text-emerald-500" : "text-rose-500"
          )}>
            {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {formatChange(change)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Vol {formatCompact(volume)}
          </div>
        </div>
      </div>
    </button>
  );
}

// Trade Panel Component
function TradePanel({ token, onClose, isMobile }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  
  const [mode, setMode] = useState('buy');
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [slippage, setSlippage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quote, setQuote] = useState(null);

  // Get mint decimals
  const getMintDecimals = useCallback(async (mint) => {
    if (!mint || mint === SOL_MINT) return SOL_DECIMALS;
    try {
      const info = await connection.getParsedAccountInfo(new PublicKey(mint));
      return info?.value?.data?.parsed?.info?.decimals || 9;
    } catch {
      return 9;
    }
  }, [connection]);

  // Fetch quote when input changes
  useEffect(() => {
    if (!token || !inputAmount || parseFloat(inputAmount) <= 0) {
      setOutputAmount('');
      setQuote(null);
      return;
    }

    const fetchQuote = async () => {
      setQuoteLoading(true);
      try {
        const inputMint = mode === 'buy' ? SOL_MINT : token.address;
        const outputMint = mode === 'buy' ? token.address : SOL_MINT;
        const inputDecimals = await getMintDecimals(inputMint);
        const outputDecimals = await getMintDecimals(outputMint);
        const rawAmount = jupiterApi.toRawAmount(parseFloat(inputAmount), inputDecimals);
        
        const q = await jupiterApi.getQuote(inputMint, outputMint, rawAmount, slippage * 100);
        if (q) {
          const out = jupiterApi.fromRawAmount(parseInt(q.outAmount, 10), outputDecimals);
          setOutputAmount(out.toFixed(mode === 'buy' ? 2 : 6));
          setQuote(q);
        }
      } catch (e) {
        // Fallback to estimate
        const priceNative = toNumber(token.priceNative);
        if (priceNative > 0) {
          if (mode === 'buy') {
            setOutputAmount((parseFloat(inputAmount) / priceNative).toFixed(2));
          } else {
            setOutputAmount((parseFloat(inputAmount) * priceNative).toFixed(6));
          }
        }
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    };

    const timer = setTimeout(fetchQuote, 400);
    return () => clearTimeout(timer);
  }, [inputAmount, token, mode, slippage, getMintDecimals]);

  // Execute swap
  const handleSwap = async () => {
    if (!wallet.connected) {
      setWalletModalVisible(true);
      return;
    }
    if (!quote) {
      toast.error('Unable to get quote');
      return;
    }
    
    setLoading(true);
    try {
      const tx = await jupiterApi.getSwapTransaction(quote, wallet.publicKey.toString());
      const sig = await jupiterApi.executeSwap(tx, wallet);
      toast.success(`Swap successful! ${sig.slice(0, 8)}...`);
      setInputAmount('');
      setOutputAmount('');
      setQuote(null);
    } catch (e) {
      toast.error(`Swap failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Get chart URL with proper theme
  const getChartUrl = () => {
    if (!token?.pairAddress) return null;
    const isDark = document.documentElement.classList.contains('dark');
    return `https://dexscreener.com/solana/${token.pairAddress}?embed=1&theme=${isDark ? 'dark' : 'light'}&trades=0&info=0`;
  };

  return (
    <div className={cn(
      "flex flex-col bg-background",
      isMobile ? "h-full" : "h-full"
    )}>
      {/* Header - Minimal on mobile since chart shows token */}
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          {token.imageUrl ? (
            <img src={token.imageUrl} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
              {token.symbol?.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{token.symbol}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="font-mono">{formatAddress(token.address)}</span>
              {token.pairCreatedAt && (
                <><span>•</span><Clock className="w-3 h-3" /><span>{formatAge(token.pairCreatedAt)}</span></>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {token.dexUrl && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(token.dexUrl, '_blank')}>
              <ExternalLink className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Chart - Takes most space */}
      <div className={cn(
        "relative bg-card",
        isMobile ? "h-[45vh] min-h-[280px]" : "h-[350px]"
      )}>
        {getChartUrl() ? (
          <iframe
            title="Chart"
            src={getChartUrl()}
            className="absolute inset-0 w-full h-full border-0"
            allow="clipboard-write"
            style={{ colorScheme: 'normal' }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Chart unavailable
          </div>
        )}
      </div>

      {/* Stats Strip - Ultra compact */}
      <div className="flex gap-1 p-2 overflow-x-auto border-b border-border/50 bg-muted/30">
        {[
          { label: 'Price', value: formatPrice(token.price) },
          { label: 'MC', value: formatCompact(token.marketCap) },
          { label: 'Liq', value: formatCompact(token.liquidity) },
          { label: '24h Vol', value: formatCompact(token.volume24h) },
          { label: '24h', value: formatChange(token.change24h), color: toNumber(token.change24h) >= 0 ? 'text-emerald-500' : 'text-rose-500' },
        ].map((stat, i) => (
          <div key={i} className="flex-shrink-0 px-2 py-1 rounded-lg bg-background/50">
            <div className="text-[9px] text-muted-foreground">{stat.label}</div>
            <div className={cn("text-xs font-semibold font-mono", stat.color)}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Trade Form - Compact */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Mode Toggle */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
          <button
            onClick={() => { setMode('buy'); setInputAmount(''); setOutputAmount(''); }}
            className={cn(
              "flex-1 py-2 rounded-md text-sm font-medium transition-all",
              mode === 'buy' 
                ? "bg-emerald-500 text-white shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Buy
          </button>
          <button
            onClick={() => { setMode('sell'); setInputAmount(''); setOutputAmount(''); }}
            className={cn(
              "flex-1 py-2 rounded-md text-sm font-medium transition-all",
              mode === 'sell' 
                ? "bg-rose-500 text-white shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Sell
          </button>
        </div>

        {/* Input */}
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            {mode === 'buy' ? (
              <><span>Pay</span><SolanaLogo className="w-3 h-3" /><span>SOL</span></>
            ) : (
              <span>Sell {token.symbol}</span>
            )}
          </div>
          <Input
            type="number"
            placeholder="0.00"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
            className="h-11 text-base font-mono bg-muted/30 border-border/50"
          />
          {mode === 'buy' && (
            <div className="flex gap-1.5">
              {[0.1, 0.25, 0.5, 1].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setInputAmount(String(amt))}
                  className="flex-1 h-7 text-xs font-medium rounded-md bg-muted/50 hover:bg-muted transition-colors"
                >
                  {amt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Output */}
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">
            {mode === 'buy' ? `Receive ${token.symbol}` : 'Receive SOL'}
          </div>
          <div className="h-11 px-3 flex items-center bg-muted/30 rounded-lg border border-border/50">
            <span className="text-base font-mono text-muted-foreground">
              {quoteLoading ? '...' : outputAmount || '0.00'}
            </span>
          </div>
        </div>

        {/* Slippage */}
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">Slippage</div>
          <div className="flex gap-1.5">
            {SLIPPAGE_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setSlippage(opt)}
                className={cn(
                  "flex-1 h-7 text-xs font-medium rounded-md transition-colors",
                  slippage === opt 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted/50 hover:bg-muted"
                )}
              >
                {opt}%
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        {!wallet.connected ? (
          <Button 
            onClick={() => setWalletModalVisible(true)} 
            className="w-full h-11 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold"
          >
            Connect Wallet
          </Button>
        ) : (
          <Button
            onClick={handleSwap}
            disabled={loading || quoteLoading || !inputAmount || !quote}
            className={cn(
              "w-full h-11 font-semibold transition-all",
              mode === 'buy'
                ? "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                : "bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white"
            )}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : quoteLoading ? (
              'Getting quote...'
            ) : !quote ? (
              'Enter amount'
            ) : mode === 'buy' ? (
              `Buy ${token.symbol}`
            ) : (
              `Sell ${token.symbol}`
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// Main Component
export default function MemeCoinsTerminal({ language = 'en' }) {
  const isMobile = useIsMobile();
  const t = tMemeCoins(language);
  
  // State
  const [tokens, setTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sortBy, setSortBy] = useState('volume');
  const [timeframe, setTimeframe] = useState('24h');

  // Fetch tokens
  const fetchTokens = useCallback(async () => {
    try {
      const data = await fetchTrendingSolanaTokens(50);
      if (data && data.length > 0) {
        setTokens(data.map(t => ({
          address: t.mint || '',
          pairAddress: t.pairAddress || t.id || '',
          symbol: t.symbol || 'UNKNOWN',
          name: t.name || 'Unknown',
          price: toNumber(t.price),
          priceNative: toNumber(t.priceNative),
          change5m: toNumber(t.priceChange5m),
          change1h: toNumber(t.priceChange1h),
          change6h: toNumber(t.priceChange6h),
          change24h: toNumber(t.priceChange24h),
          volume5m: toNumber(t.volume5m),
          volume1h: toNumber(t.volume1h),
          volume6h: toNumber(t.volume6h),
          volume24h: toNumber(t.volume24h),
          liquidity: toNumber(t.liquidity),
          marketCap: toNumber(t.marketCap),
          imageUrl: t.imageUrl,
          dexUrl: t.dexUrl,
          pairCreatedAt: t.pairCreatedAt,
          websites: t.websites || [],
          socials: t.socials || [],
        })));
        setLastUpdated(new Date());
      }
    } catch (e) {
      console.error('Failed to fetch tokens:', e);
      toast.error('Failed to load tokens');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
    // Auto refresh every 60s
    const interval = setInterval(fetchTokens, 60000);
    return () => clearInterval(interval);
  }, [fetchTokens]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTokens();
  };

  // Filter and sort tokens
  const filteredTokens = useMemo(() => {
    let result = [...tokens];
    
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.symbol?.toLowerCase().includes(q) || 
        t.name?.toLowerCase().includes(q)
      );
    }
    
    // Sort
    const volKey = timeframe === '5m' ? 'volume5m' : timeframe === '1h' ? 'volume1h' : timeframe === '6h' ? 'volume6h' : 'volume24h';
    const changeKey = timeframe === '5m' ? 'change5m' : timeframe === '1h' ? 'change1h' : timeframe === '6h' ? 'change6h' : 'change24h';
    
    result.sort((a, b) => {
      switch (sortBy) {
        case 'volume': return toNumber(b[volKey]) - toNumber(a[volKey]);
        case 'marketCap': return toNumber(b.marketCap) - toNumber(a.marketCap);
        case 'change': return toNumber(b[changeKey]) - toNumber(a[changeKey]);
        case 'new': return toNumber(b.pairCreatedAt) - toNumber(a.pairCreatedAt);
        default: return 0;
      }
    });
    
    return result;
  }, [tokens, searchQuery, sortBy, timeframe]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="h-14 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">{t.title || 'Meme Coins'}</h1>
              <Badge variant="secondary" className="hidden sm:flex gap-1 h-6">
                <SolanaLogo className="w-3.5 h-3.5" />
                Solana
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {lastUpdated && (
                <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {Math.floor((Date.now() - lastUpdated) / 1000)}s ago
                </span>
              )}
              <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing} className="h-8 w-8">
                <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4">
        <div className={cn(
          "grid gap-4",
          !isMobile && "lg:grid-cols-[1fr_400px]"
        )}>
          {/* Token List Section */}
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t.searchPlaceholder || 'Search tokens...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-muted/30 border-border/50"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {/* Sort Buttons */}
              {[
                { key: 'volume', label: '🔥 Hot', icon: Flame },
                { key: 'new', label: '✨ New', icon: Zap },
                { key: 'marketCap', label: 'MC' },
                { key: 'change', label: '📈 Gainers' },
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key)}
                  className={cn(
                    "h-8 px-3 text-xs font-medium rounded-lg whitespace-nowrap transition-all flex-shrink-0",
                    sortBy === s.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {s.label}
                </button>
              ))}
              
              <div className="w-px h-8 bg-border/50 flex-shrink-0" />
              
              {/* Timeframe Buttons */}
              {['5m', '1h', '6h', '24h'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    "h-8 px-2 text-xs font-medium rounded-lg transition-all flex-shrink-0",
                    timeframe === tf
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Token List with Fixed Height */}
            <div className={cn(
              "space-y-2 overflow-y-auto pr-1",
              isMobile ? "max-h-[calc(100vh-200px)]" : "max-h-[calc(100vh-220px)]"
            )}>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                  <p className="text-sm text-muted-foreground">Loading meme coins...</p>
                </div>
              ) : filteredTokens.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Search className="w-8 h-8 mb-3 opacity-50" />
                  <p className="text-sm">No tokens found</p>
                </div>
              ) : (
                filteredTokens.map((token) => (
                  <TokenCard
                    key={token.pairAddress || token.address}
                    token={token}
                    selected={selectedToken?.address === token.address}
                    onClick={() => setSelectedToken(token)}
                    timeframe={timeframe}
                  />
                ))
              )}
            </div>
          </div>

          {/* Trade Panel - Desktop */}
          {!isMobile && (
            <div className="hidden lg:block">
              <div className="sticky top-20">
                {selectedToken ? (
                  <div className="border border-border/50 rounded-xl overflow-hidden bg-card h-[calc(100vh-120px)]">
                    <TradePanel 
                      token={selectedToken} 
                      onClose={() => setSelectedToken(null)} 
                      isMobile={false}
                    />
                  </div>
                ) : (
                  <div className="border border-dashed border-border/50 rounded-xl p-8 text-center text-muted-foreground">
                    <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Select a token to trade</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Trade Sheet */}
      {isMobile && selectedToken && (
        <div className="fixed inset-0 z-50 bg-background">
          <TradePanel 
            token={selectedToken} 
            onClose={() => setSelectedToken(null)} 
            isMobile={true}
          />
        </div>
      )}
    </div>
  );
}