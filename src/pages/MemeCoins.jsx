import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import WalletButton from '@/components/wallet/WalletButton';
import { useWallet } from '@solana/wallet-adapter-react';

// SVG Icon Components
const Icons = {
  Search: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  RefreshCw: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  Flame: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>,
  Sparkles: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
  TrendingUp: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
  TrendingDown: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>,
  BarChart: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Droplets: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" /></svg>,
  Clock: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Shield: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  Globe: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>,
  Twitter: () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>,
  Telegram: () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>,
  ExternalLink: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
  Copy: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  X: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  ChevronDown: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
  Filter: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>,
  AlertTriangle: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  Loader: () => <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>,
  Chart: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>,
};

// Format helpers
const formatNumber = (num) => {
  if (!num || isNaN(num)) return '0';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
};

const formatPrice = (price) => {
  if (!price || isNaN(price)) return '$0';
  if (price < 0.00001) return '$' + price.toExponential(2);
  if (price < 0.01) return '$' + price.toFixed(6);
  if (price < 1) return '$' + price.toFixed(4);
  return '$' + price.toFixed(2);
};

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return 'Unknown';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
};

// Commission wallet
const COMMISSION_WALLET = 'CrQyg1WovDzakhqd7UfBrVvPbEZzPHWyui6Qd2zMV2UL';

export default function MemeCoins() {
  const { connected, publicKey } = useWallet();
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedToken, setSelectedToken] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('volume');
  const [timeframe, setTimeframe] = useState('h24');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [tradeMode, setTradeMode] = useState('buy');
  const [amount, setAmount] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minLiquidity: 0,
    minVolume: 0,
    maxAge: 0,
    hasWebsite: false,
    hasSocials: false,
  });
  const [copiedAddress, setCopiedAddress] = useState(false);
  const refreshIntervalRef = useRef(null);

  // Fetch tokens from DexScreener
  const fetchTokens = useCallback(async () => {
    try {
      setError(null);
      
      // Search for trending Solana meme tokens
      const searchTerms = ['pump', 'sol', 'meme', 'doge', 'pepe', 'wojak'];
      const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
      
      const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${randomTerm}`);
      
      if (!response.ok) throw new Error('Failed to fetch tokens');
      
      const data = await response.json();
      
      // Filter only Solana pairs with good data
      const solanaPairs = (data.pairs || []).filter(pair => 
        pair.chainId === 'solana' && 
        pair.liquidity?.usd > 1000 &&
        pair.baseToken?.address
      ).map(pair => ({
        id: pair.pairAddress,
        address: pair.baseToken.address,
        symbol: pair.baseToken.symbol,
        name: pair.baseToken.name,
        price: parseFloat(pair.priceUsd) || 0,
        priceChange: pair.priceChange || {},
        volume: pair.volume || {},
        liquidity: pair.liquidity?.usd || 0,
        marketCap: pair.marketCap || pair.fdv || 0,
        txns: pair.txns || {},
        pairCreatedAt: pair.pairCreatedAt,
        dexId: pair.dexId,
        url: pair.url,
        imageUrl: pair.info?.imageUrl || null,
        websites: pair.info?.websites || [],
        socials: pair.info?.socials || [],
      }));

      // Remove duplicates by address
      const uniqueTokens = solanaPairs.reduce((acc, token) => {
        if (!acc.find(t => t.address === token.address)) {
          acc.push(token);
        }
        return acc;
      }, []);

      setTokens(uniqueTokens);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
      setLoading(false);
    }
  }, []);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchTokens();
    
    // Refresh every 30 seconds
    refreshIntervalRef.current = setInterval(fetchTokens, 30000);
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchTokens]);

  // Calculate volume pressure (buy vs sell)
  const getVolumePressure = (token) => {
    const buys = token.txns?.[timeframe]?.buys || 0;
    const sells = token.txns?.[timeframe]?.sells || 0;
    const total = buys + sells;
    if (total === 0) return { buyPercent: 50, sellPercent: 50, pressure: 'neutral' };
    
    const buyPercent = Math.round((buys / total) * 100);
    const sellPercent = 100 - buyPercent;
    const pressure = buyPercent > 60 ? 'bullish' : buyPercent < 40 ? 'bearish' : 'neutral';
    
    return { buyPercent, sellPercent, pressure, buys, sells };
  };

  // Filter and sort tokens
  const filteredTokens = useMemo(() => {
    let result = [...tokens];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.symbol?.toLowerCase().includes(query) ||
        t.name?.toLowerCase().includes(query) ||
        t.address?.toLowerCase().includes(query)
      );
    }

    // Apply filters
    if (filters.minLiquidity > 0) {
      result = result.filter(t => t.liquidity >= filters.minLiquidity);
    }
    if (filters.minVolume > 0) {
      result = result.filter(t => (t.volume?.[timeframe] || 0) >= filters.minVolume);
    }
    if (filters.maxAge > 0) {
      const maxAgeMs = filters.maxAge * 3600 * 1000;
      result = result.filter(t => t.pairCreatedAt && (Date.now() - t.pairCreatedAt) <= maxAgeMs);
    }
    if (filters.hasWebsite) {
      result = result.filter(t => t.websites?.length > 0);
    }
    if (filters.hasSocials) {
      result = result.filter(t => t.socials?.length > 0);
    }

    // Sort
    switch (sortBy) {
      case 'volume':
        result.sort((a, b) => (b.volume?.[timeframe] || 0) - (a.volume?.[timeframe] || 0));
        break;
      case 'liquidity':
        result.sort((a, b) => b.liquidity - a.liquidity);
        break;
      case 'gainers':
        result.sort((a, b) => (b.priceChange?.[timeframe] || 0) - (a.priceChange?.[timeframe] || 0));
        break;
      case 'new':
        result.sort((a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));
        break;
      case 'mcap':
        result.sort((a, b) => b.marketCap - a.marketCap);
        break;
      default:
        break;
    }

    return result;
  }, [tokens, searchQuery, sortBy, timeframe, filters]);

  // Copy address to clipboard
  const copyAddress = async (address) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // Token card component
  const TokenCard = ({ token }) => {
    const pressure = getVolumePressure(token);
    const change = token.priceChange?.[timeframe] || 0;
    const isPositive = change >= 0;
    const isNew = token.pairCreatedAt && (Date.now() - token.pairCreatedAt) < 24 * 3600 * 1000;

    return (
      <Card
        className={`cursor-pointer transition-all hover:scale-[1.02] border ${
          selectedToken?.id === token.id
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
        }`}
        onClick={() => setSelectedToken(token)}
      >
        <CardContent className="p-3">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            {token.imageUrl ? (
              <img src={token.imageUrl} alt={token.symbol} className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                {token.symbol?.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-sm truncate">{token.symbol}</span>
                {isNew && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-green-500/20 text-green-500">
                    NEW
                  </Badge>
                )}
              </div>
              <div className="text-[10px] text-gray-500 truncate">{token.name}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm font-bold">{formatPrice(token.price)}</div>
              <div className={`text-xs flex items-center justify-end gap-0.5 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? <Icons.TrendingUp /> : <Icons.TrendingDown />}
                {Math.abs(change).toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-1 text-[10px] mb-2">
            <div className="text-center">
              <div className="text-gray-500">MCap</div>
              <div className="font-medium">${formatNumber(token.marketCap)}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500">Liq</div>
              <div className="font-medium">${formatNumber(token.liquidity)}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500">Vol</div>
              <div className="font-medium">${formatNumber(token.volume?.[timeframe] || 0)}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500">Age</div>
              <div className="font-medium flex items-center justify-center gap-0.5">
                <Icons.Clock />
                {formatTimeAgo(token.pairCreatedAt)}
              </div>
            </div>
          </div>

          {/* Volume Pressure Bar */}
          <div className="mb-2">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-green-500">Buy {pressure.buyPercent}%</span>
              <span className="text-red-500">Sell {pressure.sellPercent}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden flex">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${pressure.buyPercent}%` }}
              />
              <div
                className="h-full bg-red-500 transition-all"
                style={{ width: `${pressure.sellPercent}%` }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {token.websites?.length > 0 && (
                <a
                  href={token.websites[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-gray-400 hover:text-blue-500 transition"
                >
                  <Icons.Globe />
                </a>
              )}
              {token.socials?.map((social, i) => (
                <a
                  key={i}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-gray-400 hover:text-blue-500 transition"
                >
                  {social.type === 'twitter' ? <Icons.Twitter /> : <Icons.Telegram />}
                </a>
              ))}
            </div>
            <a
              href={token.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-gray-400 hover:text-blue-500 transition"
            >
              <Icons.ExternalLink />
            </a>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Trade Panel Component
  const TradePanel = ({ token, onClose }) => {
    const pressure = getVolumePressure(token);
    const change = token.priceChange?.[timeframe] || 0;
    const isPositive = change >= 0;

    // Get theme for chart
    const isDark = document.documentElement.classList.contains('dark');

    return (
      <div className="h-full flex flex-col bg-white dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            {token.imageUrl ? (
              <img src={token.imageUrl} alt={token.symbol} className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                {token.symbol?.charAt(0)}
              </div>
            )}
            <div>
              <div className="font-bold">{token.symbol}</div>
              <div className="text-xs text-gray-500">{token.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="font-mono font-bold">{formatPrice(token.price)}</div>
              <div className={`text-xs flex items-center justify-end gap-0.5 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? <Icons.TrendingUp /> : <Icons.TrendingDown />}
                {Math.abs(change).toFixed(2)}%
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded lg:hidden"
            >
              <Icons.X />
            </button>
          </div>
        </div>

        {/* Chart */}
        <div className="flex-1 min-h-[350px] md:min-h-[400px]" style={{ colorScheme: 'normal' }}>
          <iframe
            src={`https://dexscreener.com/solana/${token.address}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=${isDark ? 'dark' : 'light'}&theme=${isDark ? 'dark' : 'light'}&chartStyle=1&chartType=usd&interval=15`}
            className="w-full h-full border-0"
            style={{ colorScheme: 'normal' }}
            title="Chart"
          />
        </div>

        {/* Token Info */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="text-gray-500 mb-1">Market Cap</div>
              <div className="font-bold">${formatNumber(token.marketCap)}</div>
            </div>
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="text-gray-500 mb-1">Liquidity</div>
              <div className="font-bold">${formatNumber(token.liquidity)}</div>
            </div>
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="text-gray-500 mb-1">Volume 24h</div>
              <div className="font-bold">${formatNumber(token.volume?.h24 || 0)}</div>
            </div>
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="text-gray-500 mb-1">Created</div>
              <div className="font-bold">{formatTimeAgo(token.pairCreatedAt)}</div>
            </div>
          </div>

          {/* Volume Pressure */}
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-green-500">Buys: {pressure.buys}</span>
              <span className="font-medium">
                {pressure.pressure === 'bullish' ? 'Bullish' : pressure.pressure === 'bearish' ? 'Bearish' : 'Neutral'}
              </span>
              <span className="text-red-500">Sells: {pressure.sells}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden flex">
              <div className="h-full bg-green-500" style={{ width: `${pressure.buyPercent}%` }} />
              <div className="h-full bg-red-500" style={{ width: `${pressure.sellPercent}%` }} />
            </div>
          </div>

          {/* Contract */}
          <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs mb-3">
            <span className="text-gray-500">Contract:</span>
            <span className="font-mono truncate flex-1">{token.address}</span>
            <button
              onClick={() => copyAddress(token.address)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              {copiedAddress ? <Icons.Check /> : <Icons.Copy />}
            </button>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-2 mb-3">
            {token.websites?.map((site, i) => (
              <a
                key={i}
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <Icons.Globe /> Website
              </a>
            ))}
            {token.socials?.map((social, i) => (
              <a
                key={i}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                {social.type === 'twitter' ? <><Icons.Twitter /> Twitter</> : <><Icons.Telegram /> Telegram</>}
              </a>
            ))}
            <a
              href={token.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <Icons.ExternalLink /> DexScreener
            </a>
          </div>
        </div>

        {/* Trade Section */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          {/* Buy/Sell Toggle */}
          <div className="flex mb-3 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <button
              onClick={() => setTradeMode('buy')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                tradeMode === 'buy'
                  ? 'bg-green-500 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setTradeMode('sell')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                tradeMode === 'sell'
                  ? 'bg-red-500 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Sell
            </button>
          </div>

          {/* Amount Input */}
          <div className="mb-3">
            <div className="flex gap-2 mb-2">
              {['0.1', '0.5', '1', '2', '5'].map((val) => (
                <button
                  key={val}
                  onClick={() => setAmount(val)}
                  className="flex-1 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  {val} SOL
                </button>
              ))}
            </div>
            <div className="relative">
              <Input
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                SOL
              </span>
            </div>
          </div>

          {/* Trade Button */}
          {connected ? (
            <Button
              className={`w-full py-3 font-bold ${
                tradeMode === 'buy'
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-red-500 hover:bg-red-600'
              }`}
              disabled={!amount || parseFloat(amount) <= 0}
            >
              {tradeMode === 'buy' ? 'Buy' : 'Sell'} {token.symbol}
            </Button>
          ) : (
            <WalletButton className="w-full py-3" />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden" dir="ltr">
      {/* Header */}
      <div className="flex-shrink-0 p-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">Solana Memes</h1>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                Updated {formatTimeAgo(lastUpdated.getTime())}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTokens}
              disabled={loading}
              className="h-8"
            >
              {loading ? <Icons.Loader /> : <Icons.RefreshCw />}
            </Button>
            <WalletButton />
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Icons.Search />
          <Input
            placeholder="Search by name, symbol, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Icons.Search />
          </div>
        </div>

        {/* Sort & Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {/* Sort Buttons */}
          <div className="flex gap-1">
            {[
              { id: 'volume', icon: Icons.BarChart, label: 'Vol' },
              { id: 'new', icon: Icons.Sparkles, label: 'New' },
              { id: 'gainers', icon: Icons.TrendingUp, label: 'Gain' },
              { id: 'liquidity', icon: Icons.Droplets, label: 'Liq' },
              { id: 'mcap', icon: Icons.Flame, label: 'MCap' },
            ].map((sort) => (
              <Button
                key={sort.id}
                variant={sortBy === sort.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy(sort.id)}
                className="h-7 px-2 text-xs gap-1"
              >
                <sort.icon />
                <span className="hidden sm:inline">{sort.label}</span>
              </Button>
            ))}
          </div>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-800" />

          {/* Timeframe Buttons */}
          <div className="flex gap-1">
            {[
              { id: 'm5', label: '5m' },
              { id: 'h1', label: '1H' },
              { id: 'h6', label: '6H' },
              { id: 'h24', label: '24H' },
            ].map((tf) => (
              <Button
                key={tf.id}
                variant={timeframe === tf.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeframe(tf.id)}
                className="h-7 px-2 text-xs"
              >
                {tf.label}
              </Button>
            ))}
          </div>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-800" />

          {/* Filter Button */}
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-7 px-2 text-xs gap-1"
          >
            <Icons.Filter />
            <span className="hidden sm:inline">Filter</span>
          </Button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block text-gray-500 mb-1">Min Liquidity</label>
                <select
                  value={filters.minLiquidity}
                  onChange={(e) => setFilters({ ...filters, minLiquidity: Number(e.target.value) })}
                  className="w-full p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                >
                  <option value={0}>Any</option>
                  <option value={10000}>$10K+</option>
                  <option value={50000}>$50K+</option>
                  <option value={100000}>$100K+</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-500 mb-1">Min Volume</label>
                <select
                  value={filters.minVolume}
                  onChange={(e) => setFilters({ ...filters, minVolume: Number(e.target.value) })}
                  className="w-full p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                >
                  <option value={0}>Any</option>
                  <option value={10000}>$10K+</option>
                  <option value={50000}>$50K+</option>
                  <option value={100000}>$100K+</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-500 mb-1">Max Age</label>
                <select
                  value={filters.maxAge}
                  onChange={(e) => setFilters({ ...filters, maxAge: Number(e.target.value) })}
                  className="w-full p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                >
                  <option value={0}>Any</option>
                  <option value={1}>1h</option>
                  <option value={6}>6h</option>
                  <option value={24}>24h</option>
                  <option value={168}>7d</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasWebsite"
                  checked={filters.hasWebsite}
                  onChange={(e) => setFilters({ ...filters, hasWebsite: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="hasWebsite" className="flex items-center gap-1">
                  <Icons.Globe /> Website
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasSocials"
                  checked={filters.hasSocials}
                  onChange={(e) => setFilters({ ...filters, hasSocials: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="hasSocials" className="flex items-center gap-1">
                  <Icons.Twitter /> Socials
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Token List */}
        <div
          className={`${
            selectedToken ? 'hidden lg:block lg:w-1/3 xl:w-1/4' : 'w-full'
          } overflow-y-auto p-3 border-r border-gray-200 dark:border-gray-800`}
        >
          {loading && tokens.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <Icons.Loader />
              <span className="ml-2 text-gray-500">Loading tokens...</span>
            </div>
          ) : error ? (
            <div className="text-center text-red-500 p-4">
              <Icons.AlertTriangle />
              <p className="mt-2">{error}</p>
              <Button onClick={fetchTokens} className="mt-3">
                Retry
              </Button>
            </div>
          ) : filteredTokens.length === 0 ? (
            <div className="text-center text-gray-500 p-4">
              <p>No tokens found</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredTokens.map((token) => (
                <TokenCard key={token.id} token={token} />
              ))}            </div>
          )}
        </div>

        {/* Trade Panel */}
        <div
          className={`${
            selectedToken ? 'w-full lg:w-2/3 xl:w-3/4' : 'hidden lg:flex lg:w-2/3 xl:w-3/4'
          } overflow-y-auto`}
        >
          {selectedToken ? (
            <TradePanel
              token={selectedToken}
              onClose={() => setSelectedToken(null)}
            />
          ) : (
            <div className="hidden lg:flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <Icons.Chart />
                <p className="mt-2">Select a token to trade</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}