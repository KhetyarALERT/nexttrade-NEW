import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WalletButton } from '@/components/wallet/WalletButton';
import { useWallet } from '@/lib/web3/WalletContext';
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check,
  Flame,
  Clock,
  DollarSign,
  BarChart3,
  Shield,
  AlertTriangle,
  Rocket,
  Zap,
  Crown,
  Sparkles,
  GraduationCap
} from 'lucide-react';
import { createChart, ColorType } from 'lightweight-charts';
import { toast } from 'sonner';
// Use frontend-only DexScreener API (no backend needed)
import { 
  fetchTrendingSolanaTokens, 
  searchTokens as searchDexScreener,
  fetchNewLaunches,
  fetchGainers,
  formatNumber as dexFormatNumber,
  formatPrice as dexFormatPrice
} from '@/api/dexscreener';

// Commission wallet address
const FEE_WALLET = 'CrQyg1WovDzakhqd7UfBrVvPbEZzPHWyui6Qd2zMV2UL';
const PLATFORM_FEE_BPS = 100; // 1%

export default function MemeCoins() {
  const { isConnected, walletType } = useWallet();
  const [language] = useState('en');
  const [activeTab, setActiveTab] = useState('trending');
  const [tokens, setTokens] = useState([]);
  const [pumpTokens, setPumpTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [timeframe, setTimeframe] = useState('5m');
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  const t = language === 'ar' ? {
    title: 'تداول الميم كوين',
    subtitle: 'اكتشف وتداول أحدث العملات على سولانا',
    trending: 'الرائجة',
    newLaunches: 'إطلاقات جديدة',
    pumpFun: 'Pump.fun',
    graduated: 'متخرجة',
    search: 'بحث عن عملة...',
    price: 'السعر',
    marketCap: 'القيمة السوقية',
    volume: 'الحجم 24س',
    liquidity: 'السيولة',
    change: 'التغيير',
    buy: 'شراء',
    sell: 'بيع',
    connectWallet: 'قم بتوصيل محفظة Solana للتداول',
    lastUpdated: 'آخر تحديث',
    created: 'تم الإنشاء',
    bondingCurve: 'منحنى الربط',
    loading: 'جاري التحميل...',
    noTokens: 'لم يتم العثور على عملات',
    viewChart: 'عرض الرسم البياني',
    copied: 'تم النسخ!',
    safetyScore: 'درجة الأمان',
    holders: 'حاملين',
    txns: 'معاملات',
    refreshing: 'جاري التحديث...',
    kingOfHill: 'ملك التل'
  } : {
    title: 'Meme Coin Trading',
    subtitle: 'Discover & trade the hottest tokens on Solana',
    trending: 'Trending',
    newLaunches: 'New Launches',
    pumpFun: 'Pump.fun',
    graduated: 'Graduated',
    search: 'Search token...',
    price: 'Price',
    marketCap: 'Market Cap',
    volume: '24h Volume',
    liquidity: 'Liquidity',
    change: 'Change',
    buy: 'Buy',
    sell: 'Sell',
    connectWallet: 'Connect a Solana wallet to trade',
    lastUpdated: 'Last updated',
    created: 'Created',
    bondingCurve: 'Bonding Curve',
    loading: 'Loading...',
    noTokens: 'No tokens found',
    viewChart: 'View Chart',
    copied: 'Copied!',
    safetyScore: 'Safety Score',
    holders: 'Holders',
    txns: 'Txns',
    refreshing: 'Refreshing...',
    kingOfHill: 'King of the Hill'
  };

  // Timeframe options
  const timeframes = [
    { value: '1m', label: '1m' },
    { value: '5m', label: '5m' },
    { value: '15m', label: '15m' },
    { value: '1h', label: '1H' },
    { value: '4h', label: '4H' },
    { value: '1d', label: '1D' },
  ];

  // Format time ago
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const now = Date.now();
    const time = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    const diff = now - time;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Format large numbers
  const formatNumber = (num) => {
    if (!num) return '$0';
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  // Format price with proper decimals
  const formatPrice = (price) => {
    if (!price) return '$0';
    if (price < 0.00001) return `$${price.toExponential(2)}`;
    if (price < 0.01) return `$${price.toFixed(8)}`;
    if (price < 1) return `$${price.toFixed(6)}`;
    return `$${price.toFixed(4)}`;
  };

  // Copy address to clipboard
  const copyAddress = async (address) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    toast.success(t.copied);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  /**
   * Fetch trending tokens directly from DexScreener (frontend API)
   * No backend needed - DexScreener API is public and CORS-enabled
   */
  const fetchTrendingTokens = async () => {
    try {
      const data = await fetchTrendingSolanaTokens(50);
      
      if (!data || data.length === 0) {
        console.warn('No trending tokens returned from DexScreener');
        return;
      }

      // Format tokens for display
      const formattedTokens = data.map(token => ({
        id: token.pairAddress || token.id,
        symbol: token.symbol || 'Unknown',
        name: token.name || 'Unknown',
        address: token.mint,
        price: token.price || 0,
        priceChange24h: token.priceChange24h || 0,
        volume24h: token.volume24h || 0,
        liquidity: token.liquidity || 0,
        marketCap: token.marketCap || 0,
        pairAddress: token.pairAddress,
        dexId: token.dexId,
        txns24h: (token.txns24h?.buys || 0) + (token.txns24h?.sells || 0),
        buys24h: token.txns24h?.buys || 0,
        sells24h: token.txns24h?.sells || 0,
        createdAt: token.pairCreatedAt,
        url: token.dexUrl,
        imageUrl: token.imageUrl,
        isGraduated: true,
        isPump: false
      }));

      setTokens(formattedTokens);
      setLastUpdated(new Date());
      
      if (!selectedToken && formattedTokens.length > 0) {
        setSelectedToken(formattedTokens[0]);
      }
    } catch (error) {
      console.error('Error fetching trending tokens:', error);
      toast.error('Failed to fetch tokens');
    }
  };

  /**
   * Fetch new token launches from DexScreener
   */
  const fetchNewTokens = async () => {
    try {
      const data = await fetchNewLaunches(30);
      
      // Format for display  
      const formattedTokens = data.map(token => ({
        id: token.pairAddress || token.id,
        symbol: token.symbol || 'Unknown',
        name: token.name || 'Unknown',
        address: token.mint,
        price: token.price || 0,
        priceChange24h: token.priceChange24h || 0,
        volume24h: token.volume24h || 0,
        liquidity: token.liquidity || 0,
        marketCap: token.marketCap || 0,
        pairAddress: token.pairAddress,
        dexId: token.dexId,
        createdAt: token.pairCreatedAt,
        url: token.dexUrl,
        imageUrl: token.imageUrl,
        isGraduated: true,
        isPump: false
      }));

      setPumpTokens(formattedTokens); // Reusing pumpTokens state for new launches
    } catch (error) {
      console.error('Error fetching new launches:', error);
    }
  };

  // Initial fetch
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([fetchTrendingTokens(), fetchNewTokens()]);
      setLoading(false);
    };
    fetchAll();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchTrendingTokens();
      fetchNewTokens();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current || !selectedToken) return;

    // Clear previous chart
    if (chartRef.current) {
      chartRef.current.remove();
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });

    // Generate sample OHLC data based on current price
    const generateOHLC = () => {
      const data = [];
      const basePrice = selectedToken.price || 0.0001;
      const now = Math.floor(Date.now() / 1000);
      const interval = timeframe === '1m' ? 60 : 
                       timeframe === '5m' ? 300 : 
                       timeframe === '15m' ? 900 : 
                       timeframe === '1h' ? 3600 : 
                       timeframe === '4h' ? 14400 : 86400;
      
      for (let i = 100; i >= 0; i--) {
        const time = (now - (i * interval));
        const volatility = 0.02 + Math.random() * 0.03;
        const trend = Math.sin(i / 10) * 0.01;
        const open = basePrice * (1 + (Math.random() - 0.5) * volatility + trend);
        const close = open * (1 + (Math.random() - 0.5) * volatility);
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);
        
        data.push({ time: /** @type {import('lightweight-charts').Time} */ (time), open, high, low, close });
      }
      return data;
    };

    candlestickSeries.setData(generateOHLC());
    chart.timeScale().fitContent();
    chartRef.current = chart;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [selectedToken, timeframe]);

  // Load Jupiter Terminal
  useEffect(() => {
    // Only load Jupiter if wallet is connected
    if (!isConnected || walletType !== 'solana') return;
    
    const loadJupiter = async () => {
      // Check if Jupiter is already loaded
      if (window.Jupiter) {
        initJupiter();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://terminal.jup.ag/main-v3.js';
      script.async = true;
      script.onload = () => {
        // Wait a bit for Jupiter to initialize
        setTimeout(initJupiter, 500);
      };
      script.onerror = () => {
        console.error('[Jupiter] Failed to load Jupiter Terminal script');
      };
      document.head.appendChild(script);
    };

    const initJupiter = () => {
      const container = document.getElementById('jupiter-terminal');
      if (!container) return;

      try {
        // @ts-ignore - Jupiter is loaded dynamically from external script
        if (window.Jupiter && selectedToken?.address) {
          // @ts-ignore
          window.Jupiter.init({
            displayMode: 'integrated',
            integratedTargetId: 'jupiter-terminal',
            endpoint: 'https://api.mainnet-beta.solana.com',
            strictTokenList: false,
            defaultExplorer: 'Solscan',
            formProps: {
              initialOutputMint: selectedToken.address,
              fixedOutputMint: false,
              initialInputMint: 'So11111111111111111111111111111111111111112',
            },
            platformFeeAndAccounts: {
              feeBps: PLATFORM_FEE_BPS,
              feeAccounts: new Map([
                ['So11111111111111111111111111111111111111112', FEE_WALLET]
              ])
            }
          });
        }
      } catch (error) {
        console.error('[Jupiter] Failed to initialize:', error);
      }
    };

    loadJupiter();

    return () => {
      // Cleanup: Jupiter doesn't have a destroy method, but we should clean up
      const container = document.getElementById('jupiter-terminal');
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [selectedToken, isConnected, walletType]);

  // Filter tokens based on search
  const filteredTokens = tokens.filter(token =>
    token.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPumpTokens = pumpTokens.filter(token =>
    token.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get safety indicators based on token status and liquidity
  const getSafetyBadge = (token) => {
    // Pre-DEX tokens (still on Pump.fun bonding curve)
    if (token.isPump && !token.graduated) {
      return { color: 'bg-yellow-500/20 text-yellow-400', text: 'Pre-DEX', icon: Zap };
    }
    // Graduated tokens (migrated from Pump.fun to DEX)
    if (token.isGraduated && token.liquidity > 100000) {
      return { color: 'bg-emerald-500/20 text-emerald-400', text: 'Graduated', icon: GraduationCap };
    }
    // High liquidity (>$100k)
    if (token.liquidity > 100000) {
      return { color: 'bg-green-500/20 text-green-400', text: 'High Liq', icon: Shield };
    }
    // Medium liquidity ($10k-$100k)
    if (token.liquidity > 10000) {
      return { color: 'bg-blue-500/20 text-blue-400', text: 'Med Liq', icon: Shield };
    }
    // Low liquidity (<$10k) - higher risk
    return { color: 'bg-orange-500/20 text-orange-400', text: 'Low Liq', icon: AlertTriangle };
  };

  // Token card component
  const TokenCard = ({ token, onClick }) => {
    const safety = getSafetyBadge(token);
    const SafetyIcon = safety.icon;
    
    return (
      <div 
        onClick={() => onClick(token)}
        className={`p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50 ${
          selectedToken?.id === token.id 
            ? 'border-primary bg-primary/5' 
            : 'border-border/50 bg-card/50 hover:bg-card'
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Token Image */}
          <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0 overflow-hidden">
            {token.imageUrl ? (
              <img 
                src={token.imageUrl} 
                alt={token.symbol}
                className="w-full h-full object-cover"
                onError={(e) => { /** @type {HTMLImageElement} */ (e.target).style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground">
                {token.symbol?.[0] || '?'}
              </div>
            )}
          </div>

          {/* Token Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm truncate">{token.symbol}</span>
              {token.isKingOfHill && (
                <Crown className="w-3.5 h-3.5 text-yellow-400" />
              )}
              <Badge className={`${safety.color} text-[10px] px-1.5 py-0`}>
                <SafetyIcon className="w-2.5 h-2.5 mr-0.5" />
                {safety.text}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground truncate">{token.name}</div>
            
            {/* Price & Change */}
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-sm font-semibold">
                {formatPrice(token.price)}
              </span>
              {token.priceChange24h !== undefined && (
                <span className={`text-xs flex items-center ${
                  token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {token.priceChange24h >= 0 ? (
                    <TrendingUp className="w-3 h-3 mr-0.5" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-0.5" />
                  )}
                  {Math.abs(token.priceChange24h).toFixed(1)}%
                </span>
              )}
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
              {token.marketCap > 0 && (
                <span>MC: {formatNumber(token.marketCap)}</span>
              )}
              {token.liquidity > 0 && (
                <span>Liq: {formatNumber(token.liquidity)}</span>
              )}
              {token.bondingCurveProgress !== undefined && (
                <span>{Math.round(token.bondingCurveProgress * 100)}% bonded</span>
              )}
            </div>

            {/* Created Time */}
            {token.createdAt && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                <Clock className="w-2.5 h-2.5" />
                {formatTimeAgo(token.createdAt)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                <Rocket className="w-6 h-6 text-primary" />
                {t.title}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground">{t.subtitle}</p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Last Updated */}
              {lastUpdated && (
                <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  {t.lastUpdated}: {formatTimeAgo(lastUpdated)}
                </div>
              )}
              
              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLoading(true);
                  Promise.all([fetchTrendingTokens(), fetchNewTokens()]).then(() => setLoading(false));
                }}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>

              {/* Wallet Button - Uses existing component */}
              <WalletButton language={language} />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Panel - Token List */}
          <div className="lg:col-span-4 xl:col-span-3">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={t.search}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-background/50"
                  />
                </div>

                {/* Tabs - 3 categories: Trending, Gainers, New Launches */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-3">
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="trending" className="text-xs">
                      <Flame className="w-3 h-3 mr-1" />
                      {t.trending}
                    </TabsTrigger>
                    <TabsTrigger value="gainers" className="text-xs">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Gainers
                    </TabsTrigger>
                    <TabsTrigger value="new" className="text-xs">
                      <Sparkles className="w-3 h-3 mr-1" />
                      {t.newLaunches}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>

              <CardContent className="pt-0">
                <ScrollArea className="h-[calc(100vh-320px)] md:h-[600px]">
                  {loading ? (
                    <div className="flex items-center justify-center h-40">
                      <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-2 pr-4">
                      {/* Trending Tab - All tokens sorted by volume/activity */}
                      {activeTab === 'trending' && filteredTokens.map(token => (
                        <TokenCard 
                          key={token.id} 
                          token={token} 
                          onClick={setSelectedToken}
                        />
                      ))}
                      
                      {/* Gainers Tab - Tokens with highest price increase */}
                      {activeTab === 'gainers' && [...filteredTokens]
                        .sort((a, b) => (b.priceChange24h || 0) - (a.priceChange24h || 0))
                        .map(token => (
                          <TokenCard 
                            key={token.id} 
                            token={token} 
                            onClick={setSelectedToken}
                          />
                        ))}
                      
                      {/* New Launches Tab - Newest tokens */}
                      {activeTab === 'new' && filteredPumpTokens.map(token => (
                        <TokenCard 
                          key={token.id} 
                          token={token} 
                          onClick={setSelectedToken}
                        />
                      ))}
                      
                      {/* Empty state handling for all tabs */}
                      {((activeTab === 'trending' && filteredTokens.length === 0) ||
                        (activeTab === 'gainers' && filteredTokens.length === 0) ||
                        (activeTab === 'new' && filteredPumpTokens.length === 0)) && (
                        <div className="text-center py-10 text-muted-foreground">
                          {t.noTokens}
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Chart & Trading */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-4">
            {selectedToken ? (
              <>
                {/* Token Header */}
                <Card className="border-border/50">
                  <CardContent className="py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-muted overflow-hidden">
                          {selectedToken.imageUrl ? (
                            <img 
                              src={selectedToken.imageUrl} 
                              alt={selectedToken.symbol}
                              className="w-full h-full object-cover"
                              onError={(e) => { /** @type {HTMLImageElement} */ (e.target).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl font-bold">
                              {selectedToken.symbol?.[0]}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold">{selectedToken.symbol}</h2>
                            {selectedToken.isKingOfHill && (
                              <Badge className="bg-yellow-500/20 text-yellow-400">
                                <Crown className="w-3 h-3 mr-1" />
                                {t.kingOfHill}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-mono text-xs">
                              {selectedToken.address?.slice(0, 6)}...{selectedToken.address?.slice(-4)}
                            </span>
                            <button 
                              onClick={() => copyAddress(selectedToken.address)}
                              className="hover:text-primary transition-colors"
                            >
                              {copiedAddress === selectedToken.address ? (
                                <Check className="w-3.5 h-3.5 text-green-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {selectedToken.url && (
                              <a 
                                href={selectedToken.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="hover:text-primary transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                          {selectedToken.createdAt && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {t.created}: {formatTimeAgo(selectedToken.createdAt)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Price & Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground">{t.price}</div>
                          <div className="font-mono font-bold">{formatPrice(selectedToken.price)}</div>
                          {selectedToken.priceChange24h !== undefined && (
                            <div className={`text-xs ${selectedToken.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {selectedToken.priceChange24h >= 0 ? '+' : ''}{selectedToken.priceChange24h.toFixed(2)}%
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">{t.marketCap}</div>
                          <div className="font-mono font-bold">{formatNumber(selectedToken.marketCap)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">{t.volume}</div>
                          <div className="font-mono font-bold">{formatNumber(selectedToken.volume24h)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">{t.liquidity}</div>
                          <div className="font-mono font-bold">{formatNumber(selectedToken.liquidity)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Bonding Curve Progress for Pump tokens */}
                    {selectedToken.bondingCurveProgress !== undefined && (
                      <div className="mt-4">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{t.bondingCurve}</span>
                          <span className="font-mono">{Math.round(selectedToken.bondingCurveProgress * 100)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-primary to-green-400 transition-all"
                            style={{ width: `${selectedToken.bondingCurveProgress * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Chart */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Price Chart
                        {selectedToken.marketCap > 0 && (
                          <Badge variant="outline" className="ml-2 font-mono">
                            MC: {formatNumber(selectedToken.marketCap)}
                          </Badge>
                        )}
                      </CardTitle>
                      
                      {/* Timeframe Selector */}
                      <div className="flex gap-1">
                        {timeframes.map(tf => (
                          <Button
                            key={tf.value}
                            variant={timeframe === tf.value ? 'default' : 'ghost'}
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setTimeframe(tf.value)}
                          >
                            {tf.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div ref={chartContainerRef} className="w-full" />
                  </CardContent>
                </Card>

                {/* Trading Panel with Jupiter Swap + 1% Platform Fee */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Swap
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        1% Platform Fee
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isConnected && walletType === 'solana' ? (
                      <>
                        <div id="jupiter-terminal" className="min-h-[400px]" />
                        <div className="mt-3 p-2 bg-muted/30 rounded-lg text-xs text-muted-foreground text-center">
                          <Shield className="w-3 h-3 inline mr-1" />
                          Powered by Jupiter • 1% platform fee applied to all swaps
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-10">
                        <Rocket className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground mb-4">{t.connectWallet}</p>
                        <WalletButton language={language} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-border/50">
                <CardContent className="py-20 text-center">
                  <Rocket className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Select a token to start trading</h3>
                  <p className="text-muted-foreground">Choose a token from the list to view charts and trade</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
