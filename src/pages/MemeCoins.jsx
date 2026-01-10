import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, RefreshCw, TrendingUp, TrendingDown, Clock, Droplets,
  Flame, Star, ArrowUpRight, ArrowDownRight, ExternalLink, Copy,
  X, ChevronDown, Filter, BarChart3, Users, Shield, ShieldCheck,
  ShieldAlert, Globe, Twitter, MessageCircle, Zap, Activity,
  ArrowUp, ArrowDown, Sparkles, Timer, DollarSign, Percent,
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, XCircle,
  TrendingUp as VolumeIn, TrendingDown as VolumeOut, Layers
} from 'lucide-react';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEXSCREENER_API = 'https://api.dexscreener.com';
const REFRESH_INTERVAL = 30000; // 30 seconds

const TIMEFRAMES = [
  { id: 'm5', label: '5m', minutes: 5 },
  { id: 'h1', label: '1H', minutes: 60 },
  { id: 'h6', label: '6H', minutes: 360 },
  { id: 'h24', label: '24H', minutes: 1440 },
];

const SORT_OPTIONS = [
  { id: 'trending', label: 'Trending', icon: Flame },
  { id: 'newest', label: 'New', icon: Sparkles },
  { id: 'volume', label: 'Volume', icon: BarChart3 },
  { id: 'gainers', label: 'Gainers', icon: TrendingUp },
  { id: 'liquidity', label: 'Liquidity', icon: Droplets },
];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const formatNumber = (num, decimals = 2) => {
  if (!num || isNaN(num)) return '0';
  const n = parseFloat(num);
  if (n >= 1e9) return (n / 1e9).toFixed(decimals) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(decimals) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(decimals) + 'K';
  return n.toFixed(decimals);
};

const formatPrice = (price) => {
  if (!price) return '$0';
  const p = parseFloat(price);
  if (p < 0.00001) return '$' + p.toExponential(2);
  if (p < 0.01) return '$' + p.toFixed(6);
  if (p < 1) return '$' + p.toFixed(4);
  return '$' + p.toFixed(2);
};

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return 'Unknown';
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
};

const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text);
};

// Calculate volume pressure (buy vs sell)
const calculateVolumePressure = (txns) => {
  if (!txns) return { pressure: 50, buys: 0, sells: 0 };
  const buys = txns.buys || 0;
  const sells = txns.sells || 0;
  const total = buys + sells;
  if (total === 0) return { pressure: 50, buys: 0, sells: 0 };
  return {
    pressure: Math.round((buys / total) * 100),
    buys,
    sells
  };
};

// Detect token safety
const getTokenSafety = (token) => {
  const issues = [];
  let score = 100;
  
  // Check liquidity
  const liq = parseFloat(token.liquidity?.usd || 0);
  if (liq < 10000) {
    issues.push('Low liquidity');
    score -= 30;
  } else if (liq < 50000) {
    score -= 10;
  }
  
  // Check if LP is burned (heuristic based on info)
  const hasLpBurned = token.info?.socials?.some(s => 
    s.type === 'telegram' || s.type === 'twitter'
  );
  
  // Check age
  const ageMs = Date.now() - (token.pairCreatedAt || 0);
  const ageHours = ageMs / 3600000;
  if (ageHours < 1) {
    issues.push('Very new');
    score -= 20;
  }
  
  // Volume to liquidity ratio (potential rug indicator)
  const vol = parseFloat(token.volume?.h24 || 0);
  if (liq > 0 && vol / liq > 10) {
    issues.push('High vol/liq ratio');
    score -= 15;
  }
  
  return {
    score: Math.max(0, score),
    issues,
    level: score >= 70 ? 'safe' : score >= 40 ? 'caution' : 'danger'
  };
};

// =============================================================================
// COMPONENTS
// =============================================================================

// Volume Pressure Bar
const VolumePressureBar = ({ txns, timeframe }) => {
  const { pressure, buys, sells } = calculateVolumePressure(txns);
  const isBullish = pressure > 50;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-green-500 flex items-center gap-0.5">
          <ArrowUp className="w-3 h-3" />
          {buys}
        </span>
        <span className="text-muted-foreground">{timeframe}</span>
        <span className="text-red-500 flex items-center gap-0.5">
          {sells}
          <ArrowDown className="w-3 h-3" />
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
        <div 
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${pressure}%` }}
        />
        <div 
          className="h-full bg-red-500 transition-all duration-300"
          style={{ width: `${100 - pressure}%` }}
        />
      </div>
    </div>
  );
};

// Safety Badge
const SafetyBadge = ({ safety }) => {
  const config = {
    safe: { icon: ShieldCheck, color: 'text-green-500', bg: 'bg-green-500/10' },
    caution: { icon: ShieldAlert, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    danger: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' }
  };
  const { icon: Icon, color, bg } = config[safety.level];
  
  return (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${bg}`}>
      <Icon className={`w-3 h-3 ${color}`} />
      <span className={`text-[10px] font-medium ${color}`}>{safety.score}</span>
    </div>
  );
};

// Social Links
const SocialLinks = ({ info }) => {
  const socials = info?.socials || [];
  const websites = info?.websites || [];
  
  return (
    <div className="flex items-center gap-1">
      {websites.length > 0 && (
        <a 
          href={websites[0].url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="p-1 rounded hover:bg-muted transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Globe className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
        </a>
      )}
      {socials.map((s, i) => {
        const Icon = s.type === 'twitter' ? Twitter : MessageCircle;
        return (
          <a 
            key={i}
            href={s.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-1 rounded hover:bg-muted transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
          </a>
        );
      })}
    </div>
  );
};

// Token Card Component
const TokenCard = ({ token, isSelected, onClick, timeframe }) => {
  const priceChange = parseFloat(token.priceChange?.[timeframe] || 0);
  const isPositive = priceChange >= 0;
  const safety = getTokenSafety(token);
  const isNew = (Date.now() - (token.pairCreatedAt || 0)) < 86400000; // 24h
  const txns = token.txns?.[timeframe] || token.txns?.h24;
  
  return (
    <div
      onClick={onClick}
      className={`
        group relative p-3 rounded-xl border cursor-pointer transition-all duration-200
        ${isSelected 
          ? 'bg-primary/5 border-primary ring-1 ring-primary/20' 
          : 'bg-card hover:bg-muted/50 border-border hover:border-primary/30'
        }
      `}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Token Image */}
          <div className="relative flex-shrink-0">
            {token.info?.imageUrl ? (
              <img 
                src={token.info.imageUrl} 
                alt=""
                className="w-9 h-9 rounded-lg object-cover bg-muted"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">
                  {token.baseToken?.symbol?.[0] || '?'}
                </span>
              </div>
            )}
            {isNew && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
          
          {/* Token Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm truncate">
                {token.baseToken?.symbol || 'Unknown'}
              </span>
              <SafetyBadge safety={safety} />
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Timer className="w-3 h-3" />
              <span>{formatTimeAgo(token.pairCreatedAt)}</span>
              <span className="text-muted-foreground/50">|</span>
              <span className="truncate">{token.dexId}</span>
            </div>
          </div>
        </div>
        
        {/* Price & Change */}
        <div className="text-right flex-shrink-0">
          <div className="font-mono font-semibold text-sm">
            {formatPrice(token.priceUsd)}
          </div>
          <div className={`flex items-center justify-end gap-0.5 text-xs font-medium
            ${isPositive ? 'text-green-500' : 'text-red-500'}
          `}>
            {isPositive ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {Math.abs(priceChange).toFixed(2)}%
          </div>
        </div>
      </div>
      
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-2 mb-2">
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground">MCap</div>
          <div className="text-xs font-medium">${formatNumber(token.marketCap || token.fdv)}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground">Liq</div>
          <div className="text-xs font-medium">${formatNumber(token.liquidity?.usd)}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground">Vol</div>
          <div className="text-xs font-medium">${formatNumber(token.volume?.h24)}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground">Txns</div>
          <div className="text-xs font-medium">{formatNumber((txns?.buys || 0) + (txns?.sells || 0), 0)}</div>
        </div>
      </div>
      
      {/* Volume Pressure */}
      <VolumePressureBar txns={txns} timeframe={timeframe} />
      
      {/* Socials Row */}
      {(token.info?.socials?.length > 0 || token.info?.websites?.length > 0) && (
        <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
          <SocialLinks info={token.info} />
          <a
            href={token.url || `https://dexscreener.com/solana/${token.pairAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            Chart <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
};

// Trade Panel Component
const TradePanel = ({ token, onClose, isDark }) => {
  const [mode, setMode] = useState('buy');
  const [amount, setAmount] = useState('');
  const safety = getTokenSafety(token);
  const priceChange = parseFloat(token.priceChange?.h24 || 0);
  const isPositive = priceChange >= 0;
  
  const quickAmounts = [0.1, 0.5, 1, 2, 5];
  
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          {token.info?.imageUrl ? (
            <img src={token.info.imageUrl} alt="" className="w-8 h-8 rounded-lg" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="font-bold text-primary">{token.baseToken?.symbol?.[0]}</span>
            </div>
          )}
          <div>
            <div className="font-semibold">{token.baseToken?.symbol}</div>
            <div className="text-xs text-muted-foreground">{token.baseToken?.name}</div>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {/* Price Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono">{formatPrice(token.priceUsd)}</span>
          <span className={`flex items-center text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {Math.abs(priceChange).toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>MCap: ${formatNumber(token.marketCap || token.fdv)}</span>
          <span>Liq: ${formatNumber(token.liquidity?.usd)}</span>
          <SafetyBadge safety={safety} />
        </div>
      </div>
      
      {/* Chart */}
      <div className="flex-1 min-h-0 relative" style={{ minHeight: '300px' }}>
        <iframe
          src={`https://dexscreener.com/solana/${token.pairAddress}?embed=1&theme=${isDark ? 'dark' : 'light'}&info=0&trades=0`}
          className="absolute inset-0 w-full h-full"
          style={{ 
            border: 'none',
            colorScheme: 'normal'
          }}
          title="Chart"
          loading="lazy"
        />
      </div>
      
      {/* Token Details */}
      <div className="p-3 border-t border-border space-y-2">
        {/* Volume Pressure */}
        <div className="bg-muted/50 rounded-lg p-2">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Activity className="w-3 h-3" /> Volume Pressure (24h)
          </div>
          <VolumePressureBar txns={token.txns?.h24} timeframe="24h" />
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/50 rounded-lg p-2">
            <div className="text-[10px] text-muted-foreground">24h Vol</div>
            <div className="text-sm font-semibold">${formatNumber(token.volume?.h24)}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-2">
            <div className="text-[10px] text-muted-foreground">Created</div>
            <div className="text-sm font-semibold">{formatTimeAgo(token.pairCreatedAt)}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-2">
            <div className="text-[10px] text-muted-foreground">DEX</div>
            <div className="text-sm font-semibold capitalize">{token.dexId}</div>
          </div>
        </div>
        
        {/* Contract */}
        <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
          <div className="text-xs text-muted-foreground">Contract</div>
          <div className="flex items-center gap-2">
            <code className="text-xs">
              {token.baseToken?.address?.slice(0, 6)}...{token.baseToken?.address?.slice(-4)}
            </code>
            <button 
              onClick={() => copyToClipboard(token.baseToken?.address)}
              className="p-1 hover:bg-muted rounded"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>
        
        {/* Safety Warnings */}
        {safety.issues.length > 0 && (
          <div className={`rounded-lg p-2 text-xs ${
            safety.level === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'
          }`}>
            <div className="flex items-center gap-1 font-medium mb-1">
              <AlertTriangle className="w-3 h-3" /> Warnings
            </div>
            <div>{safety.issues.join(' • ')}</div>
          </div>
        )}
      </div>
      
      {/* Trade Section */}
      <div className="p-3 border-t border-border space-y-3">
        {/* Buy/Sell Toggle */}
        <div className="flex rounded-lg bg-muted p-1">
          <button
            onClick={() => setMode('buy')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
              mode === 'buy' 
                ? 'bg-green-500 text-white shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setMode('sell')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
              mode === 'sell' 
                ? 'bg-red-500 text-white shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sell
          </button>
        </div>
        
        {/* Quick Amounts */}
        <div className="flex gap-2">
          {quickAmounts.map((amt) => (
            <button
              key={amt}
              onClick={() => setAmount(amt.toString())}
              className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                amount === amt.toString()
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              {amt} SOL
            </button>
          ))}
        </div>
        
        {/* Custom Amount */}
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            className="w-full px-4 py-3 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            SOL
          </span>
        </div>
        
        {/* Trade Button */}
        <button
          className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${
            mode === 'buy'
              ? 'bg-green-500 hover:bg-green-600 active:bg-green-700'
              : 'bg-red-500 hover:bg-red-600 active:bg-red-700'
          }`}
        >
          {mode === 'buy' ? 'Buy' : 'Sell'} {token.baseToken?.symbol}
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function MemeCoins() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedToken, setSelectedToken] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('trending');
  const [timeframe, setTimeframe] = useState('h24');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minLiquidity: 0,
    minVolume: 0,
    maxAge: 0, // hours, 0 = any
    safeOnly: false,
    hasWebsite: false,
    hasSocials: false,
  });
  
  // Detect dark mode
  const isDark = document.documentElement.classList.contains('dark');
  
  // Fetch tokens
  const fetchTokens = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${DEXSCREENER_API}/latest/dex/tokens/SOL`);
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      const pairs = data.pairs || [];
      
      // Filter Solana pairs only
      const solanaPairs = pairs.filter(p => p.chainId === 'solana');
      setTokens(solanaPairs);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Initial fetch and refresh
  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchTokens]);
  
  // Filter and sort tokens
  const filteredTokens = useMemo(() => {
    let result = [...tokens];
    
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.baseToken?.symbol?.toLowerCase().includes(q) ||
        t.baseToken?.name?.toLowerCase().includes(q) ||
        t.baseToken?.address?.toLowerCase().includes(q)
      );
    }
    
    // Advanced filters
    if (filters.minLiquidity > 0) {
      result = result.filter(t => parseFloat(t.liquidity?.usd || 0) >= filters.minLiquidity);
    }
    if (filters.minVolume > 0) {
      result = result.filter(t => parseFloat(t.volume?.h24 || 0) >= filters.minVolume);
    }
    if (filters.maxAge > 0) {
      const maxAgeMs = filters.maxAge * 3600000;
      result = result.filter(t => (Date.now() - (t.pairCreatedAt || 0)) <= maxAgeMs);
    }
    if (filters.safeOnly) {
      result = result.filter(t => getTokenSafety(t).level === 'safe');
    }
    if (filters.hasWebsite) {
      result = result.filter(t => t.info?.websites?.length > 0);
    }
    if (filters.hasSocials) {
      result = result.filter(t => t.info?.socials?.length > 0);
    }
    
    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));
        break;
      case 'volume':
        result.sort((a, b) => parseFloat(b.volume?.h24 || 0) - parseFloat(a.volume?.h24 || 0));
        break;
      case 'gainers':
        result.sort((a, b) => parseFloat(b.priceChange?.[timeframe] || 0) - parseFloat(a.priceChange?.[timeframe] || 0));
        break;
      case 'liquidity':
        result.sort((a, b) => parseFloat(b.liquidity?.usd || 0) - parseFloat(a.liquidity?.usd || 0));
        break;
      case 'trending':
      default:
        // Already sorted by DexScreener
        break;
    }
    
    return result;
  }, [tokens, searchQuery, sortBy, timeframe, filters]);
  
  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold">Meme Coins</h1>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-[10px] text-muted-foreground">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchTokens}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, symbol or address..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-transparent focus:border-primary outline-none text-sm"
          />
        </div>
        
        {/* Sort & Timeframe */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {/* Sort Options */}
          <div className="flex gap-1 flex-shrink-0">
            {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSortBy(id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  sortBy === id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
          
          <div className="w-px h-5 bg-border flex-shrink-0" />
          
          {/* Timeframes */}
          <div className="flex gap-1 flex-shrink-0">
            {TIMEFRAMES.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTimeframe(id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  timeframe === id
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          
          <div className="w-px h-5 bg-border flex-shrink-0" />
          
          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              showFilters ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            <Filter className="w-3 h-3" />
            Filters
          </button>
        </div>
        
        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-2 p-3 bg-muted/50 rounded-lg space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Min Liquidity</label>
                <select
                  value={filters.minLiquidity}
                  onChange={(e) => setFilters(f => ({ ...f, minLiquidity: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 rounded bg-background border border-border text-xs"
                >
                  <option value={0}>Any</option>
                  <option value={10000}>$10K+</option>
                  <option value={50000}>$50K+</option>
                  <option value={100000}>$100K+</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Min Volume</label>
                <select
                  value={filters.minVolume}
                  onChange={(e) => setFilters(f => ({ ...f, minVolume: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 rounded bg-background border border-border text-xs"
                >
                  <option value={0}>Any</option>
                  <option value={10000}>$10K+</option>
                  <option value={50000}>$50K+</option>
                  <option value={100000}>$100K+</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Max Age</label>
                <select
                  value={filters.maxAge}
                  onChange={(e) => setFilters(f => ({ ...f, maxAge: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 rounded bg-background border border-border text-xs"
                >
                  <option value={0}>Any</option>
                  <option value={1}>1h</option>
                  <option value={6}>6h</option>
                  <option value={24}>24h</option>
                  <option value={168}>7d</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.safeOnly}
                  onChange={(e) => setFilters(f => ({ ...f, safeOnly: e.target.checked }))}
                  className="rounded"
                />
                <ShieldCheck className="w-3 h-3 text-green-500" />
                Safe only
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasWebsite}
                  onChange={(e) => setFilters(f => ({ ...f, hasWebsite: e.target.checked }))}
                  className="rounded"
                />
                <Globe className="w-3 h-3" />
                Has website
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasSocials}
                  onChange={(e) => setFilters(f => ({ ...f, hasSocials: e.target.checked }))}
                  className="rounded"
                />
                <Twitter className="w-3 h-3" />
                Has socials
              </label>
            </div>
          </div>
        )}
      </div>
      
      {/* Main Content */}
      <div className="flex-1 min-h-0 flex">
        {/* Token List */}
        <div className={`${
          selectedToken ? 'hidden lg:block lg:w-[400px]' : 'w-full'
        } border-r border-border overflow-hidden flex flex-col`}>
          {/* Results Count */}
          <div className="flex-shrink-0 px-3 py-2 text-xs text-muted-foreground border-b border-border">
            {filteredTokens.length} tokens found
          </div>
          
          {/* Token List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading && tokens.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-500">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">{error}</p>
                <button 
                  onClick={fetchTokens}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : filteredTokens.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tokens found</p>
              </div>
            ) : (
              filteredTokens.map((token) => (
                <TokenCard
                  key={token.pairAddress}
                  token={token}
                  isSelected={selectedToken?.pairAddress === token.pairAddress}
                  onClick={() => setSelectedToken(token)}
                  timeframe={timeframe}
                />
              ))
            )}
          </div>
        </div>
        
        {/* Trade Panel */}
        {selectedToken && (
          <div className="flex-1 min-w-0">
            <TradePanel 
              token={selectedToken} 
              onClose={() => setSelectedToken(null)}
              isDark={isDark}
            />
          </div>
        )}
        
        {/* Empty State (Desktop) */}
        {!selectedToken && (
          <div className="hidden lg:flex flex-1 items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a token to trade</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}