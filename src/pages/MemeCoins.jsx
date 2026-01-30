import { useState, useEffect, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Connection } from '@solana/web3.js';
import { createChart } from 'lightweight-charts';
import { 
  ArrowUpDown, TrendingUp, TrendingDown, Search, Loader2, 
  Copy, ExternalLink, RefreshCw, Shield, Globe, Send, Menu, X as XIcon, Twitter 
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
  SheetDescription,
} from '@/components/ui/sheet';
import { Skeleton } from "@/components/ui/skeleton";

import * as jupiterApi from '@/components/api/jupiter';
import JupiterSwapEmbed from '@/components/meme/JupiterSwapEmbed';
import { fetchTrendingSolanaTokens } from '@/components/api/dexscreener';
import { base44 } from '@/api/base44Client';

const SLIPPAGE_OPTIONS = [0.5, 1, 2, 5];

// --- Sub-component for Solid Picks Feed (Optimized for Speed/Mobile) ---
function SolidPicksFeed({ onTrade }) {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [solPriceUsd, setSolPriceUsd] = useState(null);

  const fetchPicks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await base44.functions.invoke('memeScoutList', { limit: 50 });
      if (response?.data?.ok) {
        setPicks(response.data.data || []);
      } else {
        const errMsg = response?.data?.error || "Unknown error";
        console.error("Failed to fetch picks:", errMsg);
        setError("Failed to load picks: " + errMsg);
      }
    } catch (e) {
      console.error("Failed to fetch picks exception", e);
      setError("Network or server error loading picks");
    } finally {
      setLoading(false);
    }
  };

  const fetchSolPrice = async () => {
    try {
      const res = await base44.functions.invoke('memeCoins', { action: 'getTokenPrice', mint: jupiterApi.TOKENS.SOL });
      const price = res?.data?.data?.data?.[jupiterApi.TOKENS.SOL]?.price;
      if (typeof price === 'number' && !Number.isNaN(price) && price > 0) setSolPriceUsd(price);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchPicks();
    fetchSolPrice();
  }, []);

  const formatNumber = (num, isCurrency = true) => {
    if (num === undefined || num === null) return '-';
    if (num >= 1000000) return `${isCurrency ? '$' : ''}${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${isCurrency ? '$' : ''}${(num / 1000).toFixed(2)}K`;
    return `${isCurrency ? '$' : ''}${num.toFixed(2)}`;
  };

  const formatPrice = (price) => {
    if (price === undefined || price === null || isNaN(price)) return '-';
    if (price < 0.000001) return `$${price.toExponential(4)}`;
    return price < 0.01 ? `$${price.toFixed(8)}` : `$${price.toFixed(4)}`;
  };

  const getScoreColor = (score) => {
    if (score >= 90) return "text-green-400 bg-green-400/10 border-green-400/20";
    if (score >= 70) return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
    return "text-red-400 bg-red-400/10 border-red-400/20";
  };

  const SafetyBadges = ({ pick }) => {
    const { 
      rugScore, riskLevel, mintAuthorityRevoked, freezeAuthorityDisabled, 
      lpStatus, stage 
    } = pick;

    // Don't render badges if safety data is completely missing
    if (rugScore === undefined && mintAuthorityRevoked === undefined && lpStatus === undefined) {
      return null;
    }

    // Helper for check/x marks
    const StatusIcon = ({ ok }) => (
      ok ? <div className="text-green-400">✅</div> : <div className="text-red-400">❌</div>
    );

    // Rug Score Badge
    const scoreColor = 
      riskLevel === 'good' ? 'text-green-400 border-green-500/30 bg-green-500/10' :
      riskLevel === 'warn' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' :
      'text-red-400 border-red-500/30 bg-red-500/10';
    
    // LP Badge
    let lpBadge = null;
    if (stage === 'watchlist') {
      lpBadge = (
        <Badge variant="outline" className="h-5 px-1.5 text-[9px] border-gray-700 text-gray-500 bg-gray-800/50">
          LP: N/A
        </Badge>
      );
    } else {
      const isLpSafe = lpStatus === 'locked' || lpStatus === 'burned';
      const lpColor = isLpSafe 
        ? 'text-green-400 border-green-500/30 bg-green-500/10' 
        : 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
      
      lpBadge = (
        <Badge variant="outline" className={`h-5 px-1.5 text-[9px] gap-1 ${lpColor}`}>
          LP: {lpStatus?.toUpperCase() || 'UNK'} {isLpSafe ? '🔒' : '⚠️'}
        </Badge>
      );
    }

    return (
      <div className="flex items-center gap-1.5 flex-wrap mt-1">
        {/* RugCheck Score */}
        {rugScore !== undefined && (
          <Badge variant="outline" className={`h-5 px-1.5 text-[9px] gap-1 ${scoreColor}`}>
            Risk: {rugScore}
          </Badge>
        )}

        {/* Authorities */}
        <Badge variant="outline" className="h-5 px-1.5 text-[9px] gap-1 border-gray-700 bg-gray-800/50 text-gray-300">
          Mint <StatusIcon ok={mintAuthorityRevoked} />
        </Badge>
        <Badge variant="outline" className="h-5 px-1.5 text-[9px] gap-1 border-gray-700 bg-gray-800/50 text-gray-300">
          Freeze <StatusIcon ok={freezeAuthorityDisabled} />
        </Badge>

        {/* LP Status */}
        {lpBadge}
      </div>
    );
  };

  if (loading && picks.length === 0) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-gray-900/50 border border-gray-800 rounded-xl">
            <Skeleton className="w-10 h-10 rounded-full bg-gray-800" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-24 bg-gray-800" />
              <Skeleton className="h-3 w-16 bg-gray-800" />
            </div>
            <Skeleton className="h-8 w-20 bg-gray-800 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-20">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Scout Picks</h3>
        <Button variant="ghost" size="sm" onClick={fetchPicks} className="h-7 text-xs text-gray-500 hover:text-white">
          <RefreshCw className="w-3 h-3 mr-1.5" /> Refresh
        </Button>
      </div>
      
      {error ? (
        <div className="text-center py-8 text-red-400 bg-red-900/10 rounded-xl border border-red-900/30 text-sm">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={fetchPicks} className="mt-3 h-7 text-xs border-red-800 text-red-400 hover:bg-red-900/20">
            Retry
          </Button>
        </div>
      ) : picks.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-900/30 rounded-xl border border-gray-800 text-sm">
          Waiting for new signals...
        </div>
      ) : (
        <div className="grid gap-2">
          {picks.map((pick) => {
            const tier = pick.raw?.tier === 'watchlist' ? 'watchlist' : 'solid';
            const isWatchlist = tier === 'watchlist';
            
            // Fallback display values
            const displaySymbol = pick.symbol || (isWatchlist ? "PUMP" : "UNKNOWN");
            const displayImage = pick.imageUrl;
            
            // Metrics extraction
            const metrics = pick.raw?.metrics || {};
            const trades = metrics.trades || 0;

            const buyPctNum = typeof metrics.buyPct === 'number'
              ? (metrics.buyPct <= 1 ? metrics.buyPct * 100 : metrics.buyPct)
              : null;
            const buyPct = buyPctNum != null ? buyPctNum.toFixed(0) : '-';

            const marketCapUsd =
              typeof metrics.marketCapUsd === 'number' ? metrics.marketCapUsd :
              (typeof metrics.marketCapSol === 'number' && typeof solPriceUsd === 'number' ? metrics.marketCapSol * solPriceUsd : null);

            const volumeUsd =
              typeof metrics.volumeUsd === 'number' ? metrics.volumeUsd :
              (typeof metrics.solAmountSum === 'number' && typeof solPriceUsd === 'number' ? metrics.solAmountSum * solPriceUsd : null);

            const mcDisplay = marketCapUsd != null ? formatNumber(marketCapUsd) : (metrics.marketCapSol ? `${Number(metrics.marketCapSol).toFixed(0)} SOL` : '-');
            const volDisplay = volumeUsd != null ? formatNumber(volumeUsd) : (metrics.solAmountSum ? `${Number(metrics.solAmountSum).toFixed(1)} SOL` : '-');

            return (
              <div 
                key={pick.id} 
                onClick={() => onTrade({
                  ...pick,
                  // Ensure fallbacks are passed to trade/details view
                  symbol: displaySymbol,
                  name: pick.name || (isWatchlist ? "Pump.fun token" : "Unknown Token")
                })}
                className="group relative flex items-center justify-between p-3 bg-gray-900/40 border border-gray-800 rounded-xl hover:bg-gray-800/40 hover:border-purple-500/30 transition-all cursor-pointer active:scale-[0.99]"
              >
                {/* Left: Token Info */}
                <div className="flex items-center gap-3 min-w-0">
                  {displayImage ? (
                    <img src={displayImage} alt={displaySymbol} className="w-10 h-10 rounded-full border border-gray-700/50 object-cover bg-gray-800" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-900/50 to-blue-900/50 flex items-center justify-center text-xs font-bold text-gray-300 border border-gray-700/50">
                      {displaySymbol.slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white text-sm truncate">{displaySymbol}</span>
                      {pick.score !== undefined && pick.score !== null ? (
                        <span className={`text-[9px] px-1 rounded border ${getScoreColor(pick.score)}`}>
                          {pick.score}
                        </span>
                      ) : null}
                      <Badge variant="outline" className={`text-[9px] h-4 px-1 ${isWatchlist ? 'border-blue-500/30 text-blue-400' : 'border-purple-500/30 text-purple-400'}`}>
                        {isWatchlist ? 'WATCH' : 'SOLID'}
                      </Badge>
                    </div>
                    
                    {/* Stats Row */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-mono mt-0.5">
                      {isWatchlist ? (
                        <>
                          <span>Tx: {trades}</span>
                          <span className="w-0.5 h-0.5 bg-gray-600 rounded-full"></span>
                          <span>MC: {mcDisplay}</span>
                          <span className="w-0.5 h-0.5 bg-gray-600 rounded-full"></span>
                          <span>Vol: {volDisplay}</span>
                        </>
                      ) : (
                        <>
                          <span>MC: {formatNumber(pick.marketCap)}</span>
                          <span className="w-0.5 h-0.5 bg-gray-600 rounded-full"></span>
                          <span>Liq: {formatNumber(pick.liquidityUsd)}</span>
                        </>
                      )}
                    </div>
                    {/* Safety Badges */}
                    <SafetyBadges pick={pick} />
                  </div>
                </div>

                {/* Right: Metrics & Trade */}
                <div className="flex items-center gap-3 pl-2">
                  <div className="text-right hidden xs:block">
                    {isWatchlist ? (
                      <>
                        <div className="font-mono text-sm text-white font-medium">Buy {buyPct}%</div>
                        <div className="text-xs text-blue-400 font-medium">Pre-DEX</div>
                      </>
                    ) : (
                      <>
                        <div className="font-mono text-sm text-white font-medium">{formatPrice(pick.priceUsd)}</div>
                        <div className={`text-xs font-medium ${pick.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {pick.priceChange24h >= 0 ? '+' : ''}{pick.priceChange24h?.toFixed(1)}%
                        </div>
                      </>
                    )}
                  </div>
                  
                  <Button 
                    size="sm" 
                    className={`h-8 px-3 font-semibold text-xs rounded-lg shadow-sm ${
                      isWatchlist 
                        ? 'bg-blue-600/80 hover:bg-blue-600 text-white shadow-blue-900/20' 
                        : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/20'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrade({
                        ...pick,
                        symbol: displaySymbol,
                        name: pick.name || (isWatchlist ? "Pump.fun token" : "Unknown Token")
                      });
                    }}
                  >
                    {isWatchlist ? 'Trade (Try)' : 'Trade'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Main MemeCoins Component ---
export default function MemeCoins() {
  const wallet = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { connection } = useConnection();
  
  const [tokens, setTokens] = useState([]);
  const [filteredTokens, setFilteredTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'volume24h', direction: 'desc' });
  
  // Swap state removed - managed by JupiterSwapEmbed
  
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    loadTokens();
  }, []);

  // Balance fetching removed - managed by JupiterSwapEmbed

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

  async function loadTokens() {
    try {
      setLoading(true);
      const data = await fetchTrendingSolanaTokens();
      
      const formatted = data.map(token => ({
        address: token.baseToken?.address || token.tokenAddress,
        symbol: token.baseToken?.symbol || token.info?.symbol || 'UNKNOWN',
        name: token.baseToken?.name || token.info?.name || 'Unknown Token',
        price: parseFloat(token.priceUsd || 0),
        change24h: parseFloat(token.priceChange?.h24 || 0),
        volume24h: parseFloat(token.volume?.h24 || 0),
        liquidity: parseFloat(token.liquidity?.usd || 0),
        imageUrl: token.info?.imageUrl || token.baseToken?.imageUrl,
      }));

      setTokens(formatted);
      setFilteredTokens(formatted);
    } catch (error) {
      console.error('Error loading tokens:', error);
      toast.error('Failed to load meme coins');
    } finally {
      setLoading(false);
    }
  }

  function handleSort(key) {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    const sorted = [...filteredTokens].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    setFilteredTokens(sorted);
  }

  function selectToken(token) {
    // Normalize token object if coming from Pick (MemeScoutAlert) vs Trending (DexScreener)
    const normalized = {
      address: token.address || token.mint, // Support both
      symbol: token.symbol,
      name: token.name,
      price: token.price || token.priceUsd,
      change24h: token.change24h || token.priceChange24h,
      volume24h: token.volume24h,
      liquidity: token.liquidity || token.liquidityUsd,
      imageUrl: token.imageUrl,
      // URLs for details view
      twitterUrl: token.twitterUrl || token.info?.socials?.find(s => s.type === 'twitter')?.url,
      telegramUrl: token.telegramUrl || token.info?.socials?.find(s => s.type === 'telegram')?.url,
      websiteUrl: token.websiteUrl || token.info?.websites?.[0]?.url,
      rugcheckUrl: token.rugcheckUrl,
      solscanUrl: token.solscanUrl || `https://solscan.io/token/${token.address || token.mint}`,
      dexUrl: token.dexUrl
    };

    setSelectedToken(normalized);
    setInputAmount('');
    setOutputAmount('');
    setCurrentQuote(null);
    setSwapMode('buy'); // Default to buy
    generateMockChartData(normalized);
  }

  function generateMockChartData(token) {
    const now = Math.floor(Date.now() / 1000);
    const data = [];
    let price = token.price || 0.000001;
    // Generate 100 candles, 1 hour apart
    for (let i = 100; i >= 0; i--) {
      const time = now - i * 3600;
      price = price * (1 + (Math.random() - 0.5) * 0.05); // More volatility
      data.push({ time, value: price });
    }
    setChartData(data);
  }

  // Effect to manage chart lifecycle and resizing
  useEffect(() => {
    // Only proceed if we have a container, token selected, and data
    if (!selectedToken || !chartContainerRef.current || chartData.length === 0) return;
    
    // Clean up previous chart instance
    if (chartRef.current) {
      try { 
        chartRef.current.remove(); 
      } catch (e) { 
        console.warn("Chart cleanup warning:", e);
      }
      chartRef.current = null;
    }

    // Create new chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 300,
      layout: { background: { color: '#0f172a' }, textColor: '#94a3b8' }, // Matching card bg
      grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
      timeScale: { timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
    });

    const lineSeries = chart.addLineSeries({ 
      color: '#22c55e', 
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 6,
        minMove: 0.000001,
      }
    });
    lineSeries.setData(chartData);
    chart.timeScale().fitContent();
    chartRef.current = chart;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        try { 
          chartRef.current.applyOptions({ 
            width: chartContainerRef.current.clientWidth 
          }); 
        } catch (e) {
          // Ignore resize errors if chart is disposed
        }
      }
    };
    
    // Use ResizeObserver for more robust resizing
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch (e) {}
        chartRef.current = null;
      }
    };
  }, [selectedToken, chartData]);

  // Quote fetching removed - managed by JupiterSwapEmbed

  async function handleSwap() {
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
      if (!swapTransaction) throw new Error("Failed to build transaction");

      // Sign and Send
      const signature = await jupiterApi.executeSwap(swapTransaction, wallet, connection);
      
      // Notify
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-bold">Transaction Sent!</span>
          <a href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noopener noreferrer" className="text-xs underline text-purple-200 hover:text-white">
            View on Solscan
          </a>
        </div>,
        { duration: 5000 }
      );

      setInputAmount('');
      setOutputAmount('');
      setCurrentQuote(null);
      
      // Update balance after a moment
      setTimeout(() => {
        // Trigger balance refresh logic (it's handled by effect, but maybe force it?)
        // The effect depends on wallet/connection which don't change, but we can rely on polling or just wait.
      }, 2000);

    } catch (error) {
      console.error('Error executing swap:', error);
      toast.error(`Swap failed: ${error.message}`);
    } finally {
      setSwapping(false);
    }
  }

  const handleMax = () => {
    if (balance === null) return;
    
    let amount = balance;
    if (swapMode === 'buy') {
      // Leave dust for gas (e.g. 0.01 SOL)
      amount = Math.max(0, balance - 0.01);
    }
    
    setInputAmount(amount.toFixed(6)); // Precision
  };

  const formatPrice = (price) => {
    if (price === undefined || price === null || isNaN(price)) return '-';
    return price < 0.01 ? `$${price.toFixed(6)}` : `$${price.toFixed(4)}`;
  };
  const formatVolume = (vol) => {
    if (vol === undefined || vol === null || isNaN(vol)) return '-';
    return vol >= 1e9 ? `$${(vol/1e9).toFixed(2)}B` : vol >= 1e6 ? `$${(vol/1e6).toFixed(2)}M` : vol >= 1e3 ? `$${(vol/1e3).toFixed(2)}K` : `$${vol.toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="border-b border-gray-800">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">Meme Coin Terminal</h1>
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20">Solana</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              placeholder="Search meme coins..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="pl-10 bg-gray-900/50 border-gray-800 focus:ring-purple-500" 
            />
          </div>
        </div>

        <Tabs defaultValue="trending" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6 bg-gray-900/80 p-1">
            <TabsTrigger value="trending" className="data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-400">Trending</TabsTrigger>
            <TabsTrigger value="picks" className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-400 text-gray-400 border border-transparent data-[state=active]:border-purple-500/30">NextTrade Solid Picks</TabsTrigger>
          </TabsList>

          <TabsContent value="trending" className="mt-0">
            <Card className="bg-gray-900/50 border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                        <button onClick={() => handleSort('symbol')} className="flex items-center gap-1 hover:text-white transition-colors">Token <ArrowUpDown className="w-3 h-3" /></button>
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">
                        <button onClick={() => handleSort('price')} className="flex items-center gap-1 ml-auto hover:text-white transition-colors">Price <ArrowUpDown className="w-3 h-3" /></button>
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">
                        <button onClick={() => handleSort('change24h')} className="flex items-center gap-1 ml-auto hover:text-white transition-colors">24h % <ArrowUpDown className="w-3 h-3" /></button>
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">
                        <button onClick={() => handleSort('volume24h')} className="flex items-center gap-1 ml-auto hover:text-white transition-colors">Volume <ArrowUpDown className="w-3 h-3" /></button>
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">
                        <button onClick={() => handleSort('liquidity')} className="flex items-center gap-1 ml-auto hover:text-white transition-colors">Liquidity <ArrowUpDown className="w-3 h-3" /></button>
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400"><div className="flex flex-col items-center justify-center gap-2"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /><span>Loading meme coins...</span></div></td></tr>
                    ) : filteredTokens.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No tokens found</td></tr>
                    ) : (
                      filteredTokens.map((token) => (
                        <tr key={token.address} className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors group" onClick={() => selectToken(token)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {token.imageUrl ? (
                                <img src={token.imageUrl} alt={token.symbol} className="w-8 h-8 rounded-full object-cover bg-gray-800" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400">{token.symbol?.charAt(0)}</div>
                              )}
                              <div>
                                <div className="font-medium group-hover:text-purple-400 transition-colors">{token.symbol}</div>
                                <div className="text-xs text-gray-500">{token.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-300">{formatPrice(token.price)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`inline-flex items-center justify-end gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${token.change24h >= 0 ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>
                              {token.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(token.change24h).toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-400">{formatVolume(token.volume24h)}</td>
                          <td className="px-4 py-3 text-right font-mono text-gray-400">{formatVolume(token.liquidity)}</td>
                          <td className="px-4 py-3 text-right">
                            <Button 
                              size="sm" 
                              className="bg-purple-600 hover:bg-purple-700 text-white" 
                              onClick={(e) => { e.stopPropagation(); selectToken(token); }}
                            >
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
          </TabsContent>

          <TabsContent value="picks" className="mt-0">
            <SolidPicksFeed onTrade={selectToken} />
          </TabsContent>
        </Tabs>
      </div>

      <Sheet open={!!selectedToken} onOpenChange={(open) => !open && setSelectedToken(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[500px] bg-[#0f172a] border-l border-gray-800 overflow-y-auto p-0 sm:p-0">
          {selectedToken && (
            <div className="h-full flex flex-col">
              <SheetHeader className="p-6 border-b border-gray-800 bg-[#0f172a]">
                <div className="flex items-center gap-4">
                  {selectedToken.imageUrl ? (
                    <img src={selectedToken.imageUrl} alt={selectedToken.symbol} className="w-12 h-12 rounded-full border border-gray-700 object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-lg font-bold">{selectedToken.symbol?.charAt(0)}</div>
                  )}
                  <div>
                    <SheetTitle className="text-xl font-bold text-white">{selectedToken.symbol}</SheetTitle>
                    <SheetDescription className="text-sm text-gray-400">{selectedToken.name}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-800">
                    <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Price</div>
                    <div className="text-lg font-bold font-mono text-white">{formatPrice(selectedToken.price)}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-800">
                    <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">24h Change</div>
                    <div className={`text-lg font-bold flex items-center gap-1 ${selectedToken.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {selectedToken.change24h >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {Math.abs(selectedToken.change24h || 0).toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* Socials & External Links */}
                <div className="flex flex-wrap gap-2">
                  {selectedToken.twitterUrl && (
                    <a href={selectedToken.twitterUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="h-8 border-gray-700 bg-gray-900/50 hover:bg-gray-800 text-gray-400 hover:text-white">
                        <Twitter className="w-3.5 h-3.5 mr-1.5" /> Twitter
                      </Button>
                    </a>
                  )}
                  {selectedToken.telegramUrl && (
                    <a href={selectedToken.telegramUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="h-8 border-gray-700 bg-gray-900/50 hover:bg-gray-800 text-gray-400 hover:text-white">
                        <Send className="w-3.5 h-3.5 mr-1.5" /> Telegram
                      </Button>
                    </a>
                  )}
                  {selectedToken.websiteUrl && (
                    <a href={selectedToken.websiteUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="h-8 border-gray-700 bg-gray-900/50 hover:bg-gray-800 text-gray-400 hover:text-white">
                        <Globe className="w-3.5 h-3.5 mr-1.5" /> Web
                      </Button>
                    </a>
                  )}
                  {selectedToken.solscanUrl && (
                    <a href={selectedToken.solscanUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="h-8 border-gray-700 bg-gray-900/50 hover:bg-gray-800 text-gray-400 hover:text-white">
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Solscan
                      </Button>
                    </a>
                  )}
                  {selectedToken.rugcheckUrl && (
                    <a href={selectedToken.rugcheckUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="h-8 border-gray-700 bg-gray-900/50 hover:bg-gray-800 text-gray-400 hover:text-white">
                        <Shield className="w-3.5 h-3.5 mr-1.5" /> RugCheck
                      </Button>
                    </a>
                  )}
                </div>

                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-800">
                  <div className="text-sm font-medium mb-4 text-gray-300">Price Chart (1H)</div>
                  {/* Chart Container - explicitly set height */}
                  <div ref={chartContainerRef} className="w-full h-[250px] rounded-lg overflow-hidden" />
                </div>

                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-800 min-h-[550px]">
                  <JupiterSwapEmbed isOpen={!!selectedToken} tokenMint={selectedToken.address} />
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// SwapForm removed - replaced by JupiterSwapEmbed