import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { WalletButton } from '@/components/wallet/WalletButton';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// === OFFICIAL BRAND LOGOS ===

// Solana Official Logo
const SolanaLogo = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 397 311" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="solana-grad-1" x1="360.879" y1="351.455" x2="141.213" y2="-69.294" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00FFA3"/>
        <stop offset="1" stopColor="#DC1FFF"/>
      </linearGradient>
      <linearGradient id="solana-grad-2" x1="264.829" y1="401.601" x2="45.163" y2="-19.148" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00FFA3"/>
        <stop offset="1" stopColor="#DC1FFF"/>
      </linearGradient>
      <linearGradient id="solana-grad-3" x1="312.548" y1="376.688" x2="92.882" y2="-44.061" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00FFA3"/>
        <stop offset="1" stopColor="#DC1FFF"/>
      </linearGradient>
    </defs>
    <path d="M64.6 237.9C67.5 235 71.4 233.3 75.5 233.3H391.7C398.5 233.3 401.9 241.5 397 246.4L332.4 311C329.5 313.9 325.6 315.6 321.5 315.6H5.3C-1.5 315.6 -4.9 307.4 0 302.5L64.6 237.9Z" fill="url(#solana-grad-1)"/>
    <path d="M64.6 3.8C67.6 0.9 71.5 -0.8 75.5 -0.8H391.7C398.5 -0.8 401.9 7.4 397 12.3L332.4 76.9C329.5 79.8 325.6 81.5 321.5 81.5H5.3C-1.5 81.5 -4.9 73.3 0 68.4L64.6 3.8Z" fill="url(#solana-grad-2)"/>
    <path d="M332.4 120.2C329.5 117.3 325.6 115.6 321.5 115.6H5.3C-1.5 115.6 -4.9 123.8 0 128.7L64.6 193.3C67.5 196.2 71.4 197.9 75.5 197.9H391.7C398.5 197.9 401.9 189.7 397 184.8L332.4 120.2Z" fill="url(#solana-grad-3)"/>
  </svg>
);

// X (Twitter) Official Logo
const XLogo = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

// Telegram Official Logo  
const TelegramLogo = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

// DexScreener Logo
const DexScreenerLogo = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 252 300" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M151.818 106.866C151.818 106.866 167.19 91.8667 167.19 71.8667C167.19 51.8667 151.818 36.8667 126 36.8667C100.182 36.8667 84.8105 51.8667 84.8105 71.8667C84.8105 91.8667 100.182 106.866 100.182 106.866" stroke="currentColor" strokeWidth="24" strokeLinecap="round"/>
    <path d="M126 36.8667V6" stroke="currentColor" strokeWidth="24" strokeLinecap="round"/>
    <path d="M126 106.866V294" stroke="currentColor" strokeWidth="24" strokeLinecap="round"/>
    <path d="M36 156.866H216" stroke="currentColor" strokeWidth="24" strokeLinecap="round"/>
    <path d="M36 206.866H216" stroke="currentColor" strokeWidth="24" strokeLinecap="round"/>
  </svg>
);

// Globe/Website Icon
const GlobeIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

// === UI ICONS ===
const Icons = {
  Search: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  RefreshCw: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M3 21v-5h5"/>
    </svg>
  ),
  TrendingUp: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>
  ),
  TrendingDown: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/>
      <polyline points="16 17 22 17 22 11"/>
    </svg>
  ),
  BarChart3: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 3v18h18"/>
      <path d="M18 17V9"/>
      <path d="M13 17V5"/>
      <path d="M8 17v-3"/>
    </svg>
  ),
  Droplets: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/>
      <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>
    </svg>
  ),
  Sparkles: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/>
      <path d="M19 17v4"/>
      <path d="M3 5h4"/>
      <path d="M17 19h4"/>
    </svg>
  ),
  Clock: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Filter: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  ),
  X: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M18 6 6 18"/>
      <path d="m6 6 12 12"/>
    </svg>
  ),
  Copy: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>
  ),
  Check: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Loader: ({ className = "w-5 h-5" }) => (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
    </svg>
  ),
  ChartLine: ({ className = "w-8 h-8" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M3 3v18h18"/>
      <path d="m19 9-5 5-4-4-3 3"/>
    </svg>
  ),
  ArrowUp: ({ className = "w-3 h-3" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path d="m18 15-6-6-6 6"/>
    </svg>
  ),
  ArrowDown: ({ className = "w-3 h-3" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  ),
  AlertTriangle: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <path d="M12 9v4"/>
      <path d="M12 17h.01"/>
    </svg>
  ),
  ExternalLink: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" x2="21" y1="14" y2="3"/>
    </svg>
  ),
};

// === TRANSLATIONS ===
const translations = {
  en: {
    title: 'Solana Memes',
    search: 'Search by name, symbol, or address...',
    loading: 'Loading tokens...',
    noTokens: 'No tokens found',
    selectToken: 'Select a token to trade',
    buy: 'Buy',
    sell: 'Sell',
    enterAmount: 'Enter amount',
    connectWallet: 'Connect Wallet',
    mcap: 'MCap',
    liq: 'Liq',
    vol: 'Vol',
    age: 'Age',
    created: 'Created',
    buys: 'Buys',
    sells: 'Sells',
    bullish: 'Bullish',
    bearish: 'Bearish',
    neutral: 'Neutral',
    website: 'Website',
    retry: 'Retry',
    sortByVolume: 'Sort by Volume',
    sortByNew: 'Sort by Newest',
    sortByGainers: 'Sort by Top Gainers',
    sortByLiquidity: 'Sort by Liquidity',
    timeframe5m: '5 minutes',
    timeframe1h: '1 hour',
    timeframe24h: '24 hours',
    filters: 'Advanced Filters',
    minLiquidity: 'Min Liquidity',
    minVolume: 'Min Volume',
    maxAge: 'Max Age',
    any: 'Any',
  },
  ar: {
    title: 'عملات سولانا الميم',
    search: 'ابحث بالاسم أو الرمز أو العنوان...',
    loading: 'جاري تحميل العملات...',
    noTokens: 'لم يتم العثور على عملات',
    selectToken: 'اختر عملة للتداول',
    buy: 'شراء',
    sell: 'بيع',
    enterAmount: 'أدخل المبلغ',
    connectWallet: 'ربط المحفظة',
    mcap: 'القيمة',
    liq: 'السيولة',
    vol: 'الحجم',
    age: 'العمر',
    created: 'الإنشاء',
    buys: 'شراء',
    sells: 'بيع',
    bullish: 'صعودي',
    bearish: 'هبوطي',
    neutral: 'محايد',
    website: 'الموقع',
    retry: 'إعادة المحاولة',
    sortByVolume: 'ترتيب حسب الحجم',
    sortByNew: 'ترتيب حسب الأحدث',
    sortByGainers: 'ترتيب حسب الرابحين',
    sortByLiquidity: 'ترتيب حسب السيولة',
    timeframe5m: '5 دقائق',
    timeframe1h: '1 ساعة',
    timeframe24h: '24 ساعة',
    filters: 'فلاتر متقدمة',
    minLiquidity: 'الحد الأدنى للسيولة',
    minVolume: 'الحد الأدنى للحجم',
    maxAge: 'الحد الأقصى للعمر',
    any: 'الكل',
  },
};

// === FORMAT HELPERS ===
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
  if (!timestamp) return 'N/A';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
};

// Get color based on value tier
const getMetricColor = (value, type) => {
  if (type === 'mcap') {
    if (value >= 1e6) return 'text-emerald-500'; // Green: $1M+
    if (value >= 100000) return 'text-amber-500'; // Yellow: $100K+
    return 'text-rose-500'; // Red: <$100K
  }
  if (type === 'liq') {
    if (value >= 100000) return 'text-emerald-500'; // Green: $100K+
    if (value >= 10000) return 'text-amber-500'; // Yellow: $10K+
    return 'text-rose-500'; // Red: <$10K
  }
  if (type === 'vol') {
    if (value >= 100000) return 'text-emerald-500'; // Green: $100K+
    if (value >= 10000) return 'text-amber-500'; // Yellow: $10K+
    return 'text-rose-500'; // Red: <$10K
  }
  return 'text-foreground';
};

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
  const [language, setLanguage] = useState('en');
  const refreshIntervalRef = useRef(null);

  // Get translations
  const t = translations[language] || translations.en;

  // Load language from localStorage
  useEffect(() => {
    try {
      const storedLang = localStorage.getItem('app_language');
      if (storedLang === 'ar' || storedLang === 'en') {
        setLanguage(storedLang);
      }
    } catch (e) {
      // Ignore
    }

    // Listen for language changes
    const handleStorage = (e) => {
      if (e.key === 'app_language') {
        setLanguage(e.newValue === 'ar' ? 'ar' : 'en');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Fetch tokens from DexScreener
  const fetchTokens = useCallback(async () => {
    try {
      setError(null);
      const searchTerms = ['pump', 'sol', 'meme', 'bonk', 'pepe'];
      const allPairs = [];

      for (const term of searchTerms.slice(0, 2)) {
        try {
          const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${term}`);
          if (response.ok) {
            const data = await response.json();
            if (data.pairs) {
              allPairs.push(...data.pairs);
            }
          }
        } catch (e) {
          console.log(`Failed to fetch ${term}`);
        }
      }

      const solanaPairs = allPairs
        .filter(pair =>
          pair.chainId === 'solana' &&
          pair.liquidity?.usd > 1000 &&
          pair.baseToken?.address
        )
        .map(pair => ({
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

      const uniqueTokens = [];
      const seenAddresses = new Set();
      for (const token of solanaPairs) {
        if (!seenAddresses.has(token.address)) {
          seenAddresses.add(token.address);
          uniqueTokens.push(token);
        }
      }

      setTokens(uniqueTokens);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
    refreshIntervalRef.current = setInterval(fetchTokens, 30000);
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchTokens]);

  const getVolumePressure = (token) => {
    const buys = token.txns?.[timeframe]?.buys || 0;
    const sells = token.txns?.[timeframe]?.sells || 0;
    const total = buys + sells;
    if (total === 0) return { buyPercent: 50, sellPercent: 50, pressure: 'neutral', buys: 0, sells: 0 };

    const buyPercent = Math.round((buys / total) * 100);
    const sellPercent = 100 - buyPercent;
    const pressure = buyPercent > 60 ? 'bullish' : buyPercent < 40 ? 'bearish' : 'neutral';

    return { buyPercent, sellPercent, pressure, buys, sells };
  };

  const filteredTokens = useMemo(() => {
    let result = [...tokens];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(tk =>
        tk.symbol?.toLowerCase().includes(query) ||
        tk.name?.toLowerCase().includes(query) ||
        tk.address?.toLowerCase().includes(query)
      );
    }

    if (filters.minLiquidity > 0) {
      result = result.filter(tk => tk.liquidity >= filters.minLiquidity);
    }
    if (filters.minVolume > 0) {
      result = result.filter(tk => (tk.volume?.[timeframe] || 0) >= filters.minVolume);
    }
    if (filters.maxAge > 0) {
      const maxAgeMs = filters.maxAge * 3600 * 1000;
      result = result.filter(tk => tk.pairCreatedAt && (Date.now() - tk.pairCreatedAt) <= maxAgeMs);
    }
    if (filters.hasWebsite) {
      result = result.filter(tk => tk.websites?.length > 0);
    }
    if (filters.hasSocials) {
      result = result.filter(tk => tk.socials?.length > 0);
    }

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
      default:
        break;
    }

    return result;
  }, [tokens, searchQuery, sortBy, timeframe, filters]);

  const copyAddress = async (address) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // Token Card Component
  const TokenCard = ({ token }) => {
    const pressure = getVolumePressure(token);
    const change = token.priceChange?.[timeframe] || 0;
    const isPositive = change >= 0;
    const isNew = token.pairCreatedAt && (Date.now() - token.pairCreatedAt) < 24 * 3600 * 1000;
    const volValue = token.volume?.[timeframe] || 0;

    return (
      <Card
        className={`cursor-pointer transition-all duration-200 border ${
          selectedToken?.id === token.id
            ? 'ring-2 ring-primary/50 border-primary/30 bg-primary/5'
            : 'hover:border-border/80 hover:bg-muted/30'
        }`}
        onClick={() => setSelectedToken(token)}
      >
        <CardContent className="p-3">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-2.5">
            {token.imageUrl ? (
              <img src={token.imageUrl} alt="" className="w-10 h-10 rounded-full flex-shrink-0 ring-2 ring-border/30" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ring-2 ring-border/30">
                {token.symbol?.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold truncate text-foreground">{token.symbol}</span>
                {isNew && (
                  <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/90 text-white border-0">NEW</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">{token.name}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-mono font-semibold text-foreground">{formatPrice(token.price)}</div>
              <div className={`text-xs font-medium flex items-center justify-end gap-0.5 ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                {isPositive ? <Icons.ArrowUp /> : <Icons.ArrowDown />}
                {Math.abs(change).toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Stats with colors */}
          <div className="grid grid-cols-4 gap-1.5 text-[10px] mb-2.5">
            <div className="text-center p-1.5 bg-muted/50 rounded-md">
              <div className="text-muted-foreground">{t.mcap}</div>
              <div className={`font-semibold ${getMetricColor(token.marketCap, 'mcap')}`}>
                ${formatNumber(token.marketCap)}
              </div>
            </div>
            <div className="text-center p-1.5 bg-muted/50 rounded-md">
              <div className="text-muted-foreground">{t.liq}</div>
              <div className={`font-semibold ${getMetricColor(token.liquidity, 'liq')}`}>
                ${formatNumber(token.liquidity)}
              </div>
            </div>
            <div className="text-center p-1.5 bg-muted/50 rounded-md">
              <div className="text-muted-foreground">{t.vol}</div>
              <div className={`font-semibold ${getMetricColor(volValue, 'vol')}`}>
                ${formatNumber(volValue)}
              </div>
            </div>
            <div className="text-center p-1.5 bg-muted/50 rounded-md">
              <div className="text-muted-foreground">{t.age}</div>
              <div className="font-semibold text-foreground">{formatTimeAgo(token.pairCreatedAt)}</div>
            </div>
          </div>

          {/* Volume Pressure */}
          <div className="mb-2.5">
            <div className="flex justify-between text-[10px] mb-1 font-medium">
              <span className="text-emerald-500">{t.buy} {pressure.buyPercent}%</span>
              <span className="text-rose-500">{t.sell} {pressure.sellPercent}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pressure.buyPercent}%` }} />
              <div className="h-full bg-rose-500 transition-all" style={{ width: `${pressure.sellPercent}%` }} />
            </div>
          </div>

          {/* Social Links with Official Logos */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {token.websites?.length > 0 && (
                <a
                  href={token.websites[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                  title="Website"
                >
                  <GlobeIcon className="w-4 h-4" />
                </a>
              )}
              {token.socials?.map((social, i) => (
                <a
                  key={i}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                  title={social.type === 'twitter' ? 'X (Twitter)' : social.type === 'telegram' ? 'Telegram' : social.type}
                >
                  {social.type === 'twitter' ? <XLogo className="w-4 h-4" /> : <TelegramLogo className="w-4 h-4" />}
                </a>
              ))}
            </div>
            <a
              href={token.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
              title="DexScreener"
            >
              <DexScreenerLogo className="w-4 h-4" />
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
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const volValue = token.volume?.h24 || 0;

    return (
      <div className="h-full flex flex-col bg-background">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {token.imageUrl ? (
              <img src={token.imageUrl} alt="" className="w-9 h-9 rounded-full flex-shrink-0 ring-2 ring-border/30" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {token.symbol?.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-semibold truncate text-foreground">{token.symbol}</div>
              <div className="text-xs text-muted-foreground truncate max-w-[120px] sm:max-w-none">{token.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="font-mono font-semibold text-foreground">{formatPrice(token.price)}</div>
              <div className={`text-xs font-medium flex items-center justify-end gap-0.5 ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                {isPositive ? <Icons.ArrowUp /> : <Icons.ArrowDown />}
                {Math.abs(change).toFixed(2)}%
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg lg:hidden transition-colors"
            >
              <Icons.X />
            </button>
          </div>
        </div>

        {/* Chart - Large with minimal info overlay */}
        <div className="flex-1 min-h-[350px] md:min-h-[400px]" style={{ colorScheme: 'normal' }}>
          <iframe
            src={`https://dexscreener.com/solana/${token.address}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=${isDark ? 'dark' : 'light'}&theme=${isDark ? 'dark' : 'light'}&chartStyle=1&chartType=usd&interval=15`}
            className="w-full h-full border-0"
            style={{ colorScheme: 'normal', minHeight: '350px' }}
            title="Price Chart"
          />
        </div>

        {/* Token Info - Compact */}
        <div className="p-3 border-t border-border flex-shrink-0">
          {/* Stats with colors */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <div className="text-[10px] text-muted-foreground">{t.mcap}</div>
              <div className={`text-sm font-semibold ${getMetricColor(token.marketCap, 'mcap')}`}>
                ${formatNumber(token.marketCap)}
              </div>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <div className="text-[10px] text-muted-foreground">{t.liq}</div>
              <div className={`text-sm font-semibold ${getMetricColor(token.liquidity, 'liq')}`}>
                ${formatNumber(token.liquidity)}
              </div>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <div className="text-[10px] text-muted-foreground">{t.vol} 24h</div>
              <div className={`text-sm font-semibold ${getMetricColor(volValue, 'vol')}`}>
                ${formatNumber(volValue)}
              </div>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <div className="text-[10px] text-muted-foreground">{t.created}</div>
              <div className="text-sm font-semibold text-foreground">{formatTimeAgo(token.pairCreatedAt)}</div>
            </div>
          </div>

          {/* Volume Pressure */}
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-emerald-500 font-medium">{t.buys}: {pressure.buys}</span>
              <span className={`font-semibold ${
                pressure.pressure === 'bullish' ? 'text-emerald-500' :
                pressure.pressure === 'bearish' ? 'text-rose-500' : 'text-muted-foreground'
              }`}>
                {pressure.pressure === 'bullish' ? t.bullish : pressure.pressure === 'bearish' ? t.bearish : t.neutral}
              </span>
              <span className="text-rose-500 font-medium">{t.sells}: {pressure.sells}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden flex">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pressure.buyPercent}%` }} />
              <div className="h-full bg-rose-500 transition-all" style={{ width: `${pressure.sellPercent}%` }} />
            </div>
          </div>

          {/* Contract + Links */}
          <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg mb-3">
            <span className="text-xs text-muted-foreground flex-shrink-0">CA:</span>
            <span className="font-mono text-xs truncate flex-1 text-foreground">{token.address}</span>
            <button
              onClick={() => copyAddress(token.address)}
              className="p-1.5 hover:bg-muted rounded-md flex-shrink-0 transition-colors"
            >
              {copiedAddress ? <Icons.Check className="w-4 h-4 text-emerald-500" /> : <Icons.Copy className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>

          {/* Social Links with Official Logos */}
          <div className="flex flex-wrap gap-2 mb-3">
            {token.websites?.slice(0, 1).map((site, i) => (
              <a
                key={i}
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-muted/70 hover:bg-muted rounded-lg text-xs font-medium transition-colors text-foreground"
              >
                <GlobeIcon className="w-4 h-4" /> {t.website}
              </a>
            ))}
            {token.socials?.map((social, i) => (
              <a
                key={i}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-muted/70 hover:bg-muted rounded-lg text-xs font-medium transition-colors text-foreground"
              >
                {social.type === 'twitter' ? (
                  <><XLogo className="w-4 h-4" /> X</>
                ) : (
                  <><TelegramLogo className="w-4 h-4" /> Telegram</>
                )}
              </a>
            ))}
            <a
              href={token.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-muted/70 hover:bg-muted rounded-lg text-xs font-medium transition-colors text-foreground"
            >
              <DexScreenerLogo className="w-4 h-4" /> DEX
            </a>
          </div>
        </div>

        {/* Trade Section */}
        <div className="p-3 border-t border-border flex-shrink-0">
          {/* Buy/Sell Toggle */}
          <div className="flex mb-3 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setTradeMode('buy')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all ${
                tradeMode === 'buy'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.buy}
            </button>
            <button
              onClick={() => setTradeMode('sell')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all ${
                tradeMode === 'sell'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.sell}
            </button>
          </div>

          {/* Amount Buttons */}
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            {['0.1', '0.5', '1', '2', '5'].map((val) => (
              <button
                key={val}
                onClick={() => setAmount(val)}
                className={`py-2.5 text-xs font-semibold rounded-lg transition-all ${
                  amount === val
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/70 hover:bg-muted text-foreground'
                }`}
              >
                {val}
              </button>
            ))}
          </div>

          {/* Amount Input */}
          <div className="relative mb-3">
            <Input
              type="number"
              placeholder={t.enterAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pr-16 h-12 text-base"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
              <SolanaLogo className="w-4 h-4" />
              SOL
            </span>
          </div>

          {/* Trade Button - Uses main wallet connection */}
          {connected ? (
            <Button
              className={`w-full h-12 font-semibold text-base transition-all ${
                tradeMode === 'buy'
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-rose-500 hover:bg-rose-600 text-white'
              }`}
              disabled={!amount || parseFloat(amount) <= 0}
            >
              {tradeMode === 'buy' ? t.buy : t.sell} {token.symbol}
            </Button>
          ) : (
            <div className="text-center py-3 text-sm text-muted-foreground">
              {t.connectWallet}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden" dir="ltr">
        {/* Header */}
        <div className="flex-shrink-0 p-3 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <SolanaLogo className="w-6 h-6" />
              <h1 className="text-lg font-bold text-foreground">{t.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              {lastUpdated && (
                <span className="text-[10px] text-muted-foreground hidden sm:block">
                  {formatTimeAgo(lastUpdated.getTime())}
                </span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setLoading(true); fetchTokens(); }}
                    disabled={loading}
                    className="h-9 w-9 p-0 border-border/60"
                  >
                    {loading ? <Icons.Loader className="w-4 h-4" /> : <Icons.RefreshCw className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh tokens</TooltipContent>
              </Tooltip>
              <WalletButton />
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Icons.Search />
            </div>
            <Input
              placeholder={t.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11"
            />
          </div>

          {/* Sort & Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'volume', icon: Icons.BarChart3, label: 'Vol', tooltip: t.sortByVolume },
              { id: 'new', icon: Icons.Sparkles, label: 'New', tooltip: t.sortByNew },
              { id: 'gainers', icon: Icons.TrendingUp, label: 'Top', tooltip: t.sortByGainers },
              { id: 'liquidity', icon: Icons.Droplets, label: 'Liq', tooltip: t.sortByLiquidity },
            ].map((sort) => (
              <Tooltip key={sort.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={sortBy === sort.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSortBy(sort.id)}
                    className={`h-9 px-2.5 text-xs font-medium ${
                      sortBy !== sort.id ? 'border-border/60' : ''
                    }`}
                  >
                    <sort.icon className="w-3.5 h-3.5" />
                    <span className="ml-1.5 hidden xs:inline">{sort.label}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{sort.tooltip}</TooltipContent>
              </Tooltip>
            ))}

            <div className="w-px h-6 bg-border mx-1" />

            {[
              { id: 'm5', label: '5m', tooltip: t.timeframe5m },
              { id: 'h1', label: '1H', tooltip: t.timeframe1h },
              { id: 'h24', label: '24H', tooltip: t.timeframe24h },
            ].map((tf) => (
              <Tooltip key={tf.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={timeframe === tf.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeframe(tf.id)}
                    className={`h-9 px-2.5 text-xs font-medium ${
                      timeframe !== tf.id ? 'border-border/60' : ''
                    }`}
                  >
                    {tf.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{tf.tooltip}</TooltipContent>
              </Tooltip>
            ))}

            <div className="w-px h-6 bg-border mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showFilters ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`h-9 px-2.5 text-xs font-medium ${
                    !showFilters ? 'border-border/60' : ''
                  }`}
                >
                  <Icons.Filter className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.filters}</TooltipContent>
            </Tooltip>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-3 p-3 bg-muted/30 border border-border rounded-lg">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div>
                  <label className="block text-muted-foreground mb-1.5 font-medium">{t.minLiquidity}</label>
                  <select
                    value={filters.minLiquidity}
                    onChange={(e) => setFilters({ ...filters, minLiquidity: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground font-medium"
                  >
                    <option value={0}>{t.any}</option>
                    <option value={10000}>$10K+</option>
                    <option value={50000}>$50K+</option>
                    <option value={100000}>$100K+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1.5 font-medium">{t.minVolume}</label>
                  <select
                    value={filters.minVolume}
                    onChange={(e) => setFilters({ ...filters, minVolume: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground font-medium"
                  >
                    <option value={0}>{t.any}</option>
                    <option value={10000}>$10K+</option>
                    <option value={50000}>$50K+</option>
                    <option value={100000}>$100K+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1.5 font-medium">{t.maxAge}</label>
                  <select
                    value={filters.maxAge}
                    onChange={(e) => setFilters({ ...filters, maxAge: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground font-medium"
                  >
                    <option value={0}>{t.any}</option>
                    <option value={1}>1h</option>
                    <option value={6}>6h</option>
                    <option value={24}>24h</option>
                    <option value={168}>7d</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="hasWebsite"
                    checked={filters.hasWebsite}
                    onChange={(e) => setFilters({ ...filters, hasWebsite: e.target.checked })}
                    className="rounded border-border"
                  />
                  <label htmlFor="hasWebsite" className="flex items-center gap-1.5 text-foreground font-medium">
                    <GlobeIcon className="w-3.5 h-3.5" /> {t.website}
                  </label>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="hasSocials"
                    checked={filters.hasSocials}
                    onChange={(e) => setFilters({ ...filters, hasSocials: e.target.checked })}
                    className="rounded border-border"
                  />
                  <label htmlFor="hasSocials" className="flex items-center gap-1.5 text-foreground font-medium">
                    <XLogo className="w-3.5 h-3.5" /> Socials
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
            } overflow-y-auto p-3 border-r border-border`}
          >
            {loading && tokens.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <Icons.Loader className="w-8 h-8 mb-2" />
                <span className="font-medium">{t.loading}</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center text-rose-500 p-4">
                <Icons.AlertTriangle className="w-8 h-8 mb-2" />
                <p className="mb-3 text-center font-medium">{error}</p>
                <Button onClick={fetchTokens} size="sm" variant="outline">{t.retry}</Button>
              </div>
            ) : filteredTokens.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-muted-foreground p-8">
                <Icons.Search className="w-8 h-8 mb-2" />
                <p className="font-medium">{t.noTokens}</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredTokens.map((token) => (
                  <TokenCard key={token.id} token={token} />
                ))}
              </div>
            )}
          </div>

          {/* Trade Panel */}
          <div
            className={`${
              selectedToken ? 'w-full lg:w-2/3 xl:w-3/4' : 'hidden lg:flex lg:w-2/3 xl:w-3/4'
            } overflow-y-auto`}
          >
            {selectedToken ? (
              <TradePanel token={selectedToken} onClose={() => setSelectedToken(null)} />
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center h-full text-muted-foreground">
                <Icons.ChartLine className="w-16 h-16 mb-3 opacity-40" />
                <p className="text-lg font-medium">{t.selectToken}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}