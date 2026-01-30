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
import { fetchTrendingSolanaTokens } from '@/components/api/dexscreener';
import { base44 } from '@/api/base44Client';

const SLIPPAGE_OPTIONS = [0.5, 1, 2, 5];

// --- Sub-component for Solid Picks Feed ---
function SolidPicksFeed({ onTrade }) {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    fetchPicks();
  }, []);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Mint address copied");
  };

  const formatTimeAgo = (ms) => {
    if (!ms) return '';
    const diff = Date.now() - ms;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const formatNumber = (num, isCurrency = true) => {
    if (num === undefined || num === null) return '-';
    if (num >= 1000000) return `${isCurrency ? '$' : ''}${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${isCurrency ? '$' : ''}${(num / 1000).toFixed(2)}K`;
    return `${isCurrency ? '$' : ''}${num.toFixed(2)}`;
  };

  const formatPrice = (price) => {
    if (!price) return '-';
    return price < 0.01 ? `$${price.toFixed(8)}` : `$${price.toFixed(4)}`;
  };

  const getScoreColor = (score) => {
    if (score >= 90) return "bg-green-500/20 text-green-400 border-green-500/30";
    if (score >= 70) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  if (loading && picks.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-gray-900/50 border-gray-800 p-4 h-64">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="w-10 h-10 rounded-full bg-gray-800" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24 bg-gray-800" />
                <Skeleton className="h-3 w-16 bg-gray-800" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-8 w-full bg-gray-800" />
              <Skeleton className="h-8 w-full bg-gray-800" />
              <Skeleton className="h-8 w-full bg-gray-800" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-lg font-semibold text-white">NextTrade Solid Picks</h3>
        <Button variant="ghost" size="sm" onClick={fetchPicks} className="text-gray-400 hover:text-white">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>
      
      {error ? (
        <div className="text-center py-12 text-red-400 bg-red-900/10 rounded-xl border border-red-900/30">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={fetchPicks} className="mt-4 border-red-800 text-red-400 hover:bg-red-900/20">
            Try Again
          </Button>
        </div>
      ) : picks.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-900/30 rounded-xl border border-gray-800">
          No picks available yet. Waiting for scout bot...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {picks.map((pick) => (
            <Card key={pick.id} className="bg-gray-900/50 border-gray-800 hover:border-purple-500/30 transition-all duration-200 flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-gray-800/50">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {pick.imageUrl ? (
                      <img src={pick.imageUrl} alt={pick.symbol} className="w-12 h-12 rounded-full border border-gray-700 object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center text-white font-bold text-lg border border-gray-700">
                        {pick.symbol?.[0]}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-white text-lg flex items-center gap-2">
                        {pick.symbol}
                        <Badge variant="outline" className={`text-[10px] h-5 px-1.5 border ${getScoreColor(pick.score)}`}>
                          {pick.score}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-400 truncate max-w-[140px]" title={pick.name}>{pick.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 font-mono mb-1">
                      {formatTimeAgo(pick.createdAtMs)}
                    </div>
                  </div>
                </div>

                {/* Socials */}
                <div className="flex gap-2 mt-3">
                  {pick.twitterUrl && (
                    <a href={pick.twitterUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors">
                      <Twitter className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {pick.telegramUrl && (
                    <a href={pick.telegramUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors">
                      <Send className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {pick.websiteUrl && (
                    <a href={pick.websiteUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors">
                      <Globe className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <div className="flex-1"></div>
                  <button onClick={() => copyToClipboard(pick.mint)} className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-400 hover:text-white transition-colors">
                    <Copy className="w-3 h-3" />
                    <span className="font-mono">{pick.mint.slice(0, 4)}...{pick.mint.slice(-4)}</span>
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="p-4 grid grid-cols-2 gap-y-3 gap-x-2 text-sm flex-1">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Price</div>
                  <div className="font-mono text-white font-medium">{formatPrice(pick.priceUsd)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">24h Change</div>
                  <div className={`font-mono font-medium flex items-center justify-end gap-1 ${pick.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pick.priceChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(pick.priceChange24h || 0).toFixed(2)}%
                  </div>
                </div>
                
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Market Cap</div>
                  <div className="font-mono text-gray-300">{formatNumber(pick.marketCap)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Liquidity</div>
                  <div className="font-mono text-gray-300">{formatNumber(pick.liquidityUsd)}</div>
                </div>

                <div className="col-span-2 border-t border-gray-800/50 mt-1 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">Volume (24h)</span>
                    <span className="font-mono text-gray-300">{formatNumber(pick.volume24h)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 pt-0 mt-auto space-y-2">
                 <Button 
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold"
                  onClick={() => onTrade(pick)}
                >
                  Trade {pick.symbol}
                </Button>

                <div className="flex gap-2">
                  {pick.dexUrl && (
                    <a href={pick.dexUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button size="sm" variant="outline" className="w-full text-xs border-gray-700 bg-transparent hover:bg-gray-800 h-8">
                        Dex <ExternalLink className="w-3 h-3 ml-1.5" />
                      </Button>
                    </a>
                  )}
                  {pick.solscanUrl && (
                    <a href={pick.solscanUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button size="sm" variant="outline" className="w-full text-xs border-gray-700 bg-transparent hover:bg-gray-800 h-8">
                        Scan <ExternalLink className="w-3 h-3 ml-1.5" />
                      </Button>
                    </a>
                  )}
                  {pick.rugcheckUrl && (
                    <a href={pick.rugcheckUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="icon" variant="outline" className="w-8 h-8 border-gray-700 bg-transparent hover:bg-gray-800" title="RugCheck">
                        <Shield className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </Card>
          ))}
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
  
  const [swapMode, setSwapMode] = useState('buy');
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [slippage, setSlippage] = useState(1);
  const [customSlippage, setCustomSlippage] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(null);
  const [balance, setBalance] = useState(null);
  
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    loadTokens();
  }, []);

  // Update balances when wallet/connection/selectedToken changes
  useEffect(() => {
    if (!wallet.publicKey || !connection) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        // Try with default connection first, then fallback
        const getConnection = () => {
           // If default connection is mainnet-beta (likely blocked), prefer fallback
           if (connection.rpcEndpoint.includes('mainnet-beta.solana.com')) {
             return new Connection('https://rpc.ankr.com/solana');
           }
           return connection;
        };
        
        const conn = getConnection();

        if (swapMode === 'buy') {
          // Buy mode: Input is SOL
          const bal = await conn.getBalance(wallet.publicKey);
          setBalance(bal / 1e9);
        } else if (swapMode === 'sell' && selectedToken) {
          // Sell mode: Input is Token
          const accounts = await conn.getParsedTokenAccountsByOwner(wallet.publicKey, {
            mint: new PublicKey(selectedToken.address)
          });
          
          if (accounts.value.length > 0) {
            const amount = accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
            setBalance(amount);
          } else {
            setBalance(0);
          }
        }
      } catch (e) {
        // Suppress 403 errors from console
        if (e?.message?.includes('403') || e?.toString().includes('403')) {
           console.warn("Balance fetch limited (403)");
        } else {
           console.error("Failed to fetch balance", e);
        }
        setBalance(null);
      }
    };

    fetchBalance();
    // Poll balance occasionally? or just on change
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);

  }, [wallet.publicKey, connection, swapMode, selectedToken]);

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
      imageUrl: token.imageUrl
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

  useEffect(() => {
    // Debounce quote fetching
    if (!selectedToken || !inputAmount || parseFloat(inputAmount) <= 0) {
      setOutputAmount('');
      setCurrentQuote(null);
      return;
    }
    
    const fetchQuote = async () => {
      if (!selectedToken || !inputAmount) return;
      try {
        setQuoteLoading(true);
        // Use SOL as input for Buy, Token as input for Sell
        const inputMint = swapMode === 'buy' ? jupiterApi.TOKENS.SOL : selectedToken.address;
        const outputMint = swapMode === 'buy' ? selectedToken.address : jupiterApi.TOKENS.SOL;
        
        // Decimals: SOL is 9, most tokens are 6 or 9. 
        // Assuming 9 for SOL. For output, we can get decimals from quote later or assume 6.
        const inputDecimals = swapMode === 'buy' ? 9 : 6; 
        const outputDecimals = swapMode === 'buy' ? 6 : 9;
        
        const rawAmount = jupiterApi.toRawAmount(parseFloat(inputAmount), inputDecimals);
        const slippageBps = slippage * 100;
        
        const quote = await jupiterApi.getQuote(inputMint, outputMint, rawAmount, slippageBps);
        if (quote) {
          const output = jupiterApi.fromRawAmount(parseInt(quote.outAmount), outputDecimals);
          setOutputAmount(output.toFixed(6));
          setCurrentQuote(quote);
        } else {
          setOutputAmount('');
          setCurrentQuote(null);
          toast.error("No route found");
        }
      } catch (error) {
        console.error('Error fetching quote:', error);
        toast.error('Failed to get quote');
        setOutputAmount('');
        setCurrentQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    };

    const delayDebounce = setTimeout(() => fetchQuote(), 600); // 600ms debounce
    return () => clearTimeout(delayDebounce);
  }, [inputAmount, selectedToken, swapMode, slippage]);

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

                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-800">
                  <div className="text-sm font-medium mb-4 text-gray-300">Price Chart (1H)</div>
                  {/* Chart Container - explicitly set height */}
                  <div ref={chartContainerRef} className="w-full h-[250px] rounded-lg overflow-hidden" />
                </div>

                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-800">
                  <Tabs value={swapMode} onValueChange={setSwapMode} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-900/80 p-1 rounded-lg">
                      <TabsTrigger value="buy" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-gray-400">Buy</TabsTrigger>
                      <TabsTrigger value="sell" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-gray-400">Sell</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="buy" className="space-y-4 mt-0">
                      <SwapForm 
                        inputLabel="Pay (SOL)" 
                        outputLabel={`Receive (${selectedToken.symbol})`} 
                        inputAmount={inputAmount} 
                        outputAmount={outputAmount} 
                        onInputChange={setInputAmount} 
                        slippage={slippage} 
                        customSlippage={customSlippage} 
                        onSlippageChange={setSlippage} 
                        onCustomSlippageChange={setCustomSlippage} 
                        quoteLoading={quoteLoading} 
                        swapping={swapping} 
                        onSwap={handleSwap} 
                        walletConnected={wallet.connected} 
                        connectWallet={() => setWalletModalVisible(true)}
                        actionLabel="Buy"
                        actionColor="bg-green-600 hover:bg-green-700"
                        onMax={handleMax}
                        balance={balance}
                        balanceLabel="SOL"
                      />
                    </TabsContent>
                    
                    <TabsContent value="sell" className="space-y-4 mt-0">
                      <SwapForm 
                        inputLabel={`Pay (${selectedToken.symbol})`} 
                        outputLabel="Receive (SOL)" 
                        inputAmount={inputAmount} 
                        outputAmount={outputAmount} 
                        onInputChange={setInputAmount} 
                        slippage={slippage} 
                        customSlippage={customSlippage} 
                        onSlippageChange={setSlippage} 
                        onCustomSlippageChange={setCustomSlippage} 
                        quoteLoading={quoteLoading} 
                        swapping={swapping} 
                        onSwap={handleSwap} 
                        walletConnected={wallet.connected} 
                        connectWallet={() => setWalletModalVisible(true)}
                        actionLabel="Sell"
                        actionColor="bg-red-600 hover:bg-red-700"
                        onMax={handleMax}
                        balance={balance}
                        balanceLabel={selectedToken.symbol}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SwapForm({ 
  inputLabel, 
  outputLabel, 
  inputAmount, 
  outputAmount, 
  onInputChange, 
  slippage, 
  customSlippage, 
  onSlippageChange, 
  onCustomSlippageChange, 
  quoteLoading, 
  swapping, 
  onSwap, 
  walletConnected,
  connectWallet,
  actionLabel,
  actionColor,
  onMax,
  balance,
  balanceLabel
}) {
  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-xs text-gray-400 font-medium ml-1">{inputLabel}</Label>
            {walletConnected && balance !== null && (
              <div className="text-xs text-gray-500 font-mono">
                Bal: {balance > 0 ? balance.toFixed(4) : '0.00'} {balanceLabel}
              </div>
            )}
          </div>
          <div className="relative">
            <Input 
              type="number" 
              placeholder="0.00" 
              value={inputAmount} 
              onChange={(e) => onInputChange(e.target.value)} 
              className="bg-gray-900 border-gray-700 text-lg h-12 font-mono placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-purple-500 focus-visible:border-purple-500 pr-16" 
            />
            {walletConnected && (
              <button 
                onClick={onMax}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-gray-800 hover:bg-gray-700 text-purple-400 px-2 py-1 rounded transition-colors"
              >
                MAX
              </button>
            )}
          </div>
        </div>
        
        <div className="flex justify-center -my-1 relative z-10">
          <div className="bg-gray-800 rounded-full p-1 border border-gray-700">
            <ArrowUpDown className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-gray-400 font-medium ml-1">{outputLabel}</Label>
          <div className="relative">
            <Input 
              type="text" 
              placeholder="0.00" 
              value={outputAmount} 
              readOnly 
              className="bg-gray-900/50 border-gray-700 text-lg h-12 font-mono text-gray-300 focus-visible:ring-0 focus-visible:border-gray-700" 
            />
            {quoteLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 px-2 py-1 bg-gray-800 rounded text-xs text-purple-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Quoting...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <div className="flex justify-between items-center">
          <Label className="text-xs text-gray-400">Slippage Tolerance</Label>
          <span className="text-xs text-gray-500">{slippage}%</span>
        </div>
        <div className="flex gap-2">
          {SLIPPAGE_OPTIONS.map((opt) => (
            <Button 
              key={opt} 
              size="sm" 
              variant={slippage === opt ? 'default' : 'outline'} 
              onClick={() => onSlippageChange(opt)} 
              className={`flex-1 h-8 text-xs ${slippage === opt ? 'bg-gray-700 text-white border-gray-600' : 'border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-300'}`}
            >
              {opt}%
            </Button>
          ))}
          <Input 
            type="number" 
            placeholder="Custom" 
            value={customSlippage} 
            onChange={(e) => { 
              onCustomSlippageChange(e.target.value); 
              const val = parseFloat(e.target.value); 
              if (val > 0) onSlippageChange(val); 
            }} 
            className="w-20 h-8 text-xs bg-gray-900 border-gray-700 focus-visible:ring-1 focus-visible:ring-purple-500" 
          />
        </div>
      </div>

      <div className="pt-4">
        {!walletConnected ? (
          <Button 
            size="lg" 
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-12"
            onClick={connectWallet}
          >
            Connect Wallet
          </Button>
        ) : (
          <Button 
            size="lg" 
            className={`w-full ${actionColor} text-white font-bold h-12`} 
            onClick={onSwap} 
            disabled={!inputAmount || !outputAmount || swapping || quoteLoading}
          >
            {swapping ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Swapping...</span>
              </div>
            ) : (
              actionLabel
            )}
          </Button>
        )}
      </div>
    </>
  );
}