import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import { useWallet } from '../lib/web3/WalletContext';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, TrendingUp, Zap, Shield, AlertTriangle, ExternalLink, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// Configuration
const CONFIG = {
  SOLANA_RPC: 'https://api.mainnet-beta.solana.com',
  JUPITER_API: 'https://quote-api.jup.ag/v6',
  DEXSCREENER_API: 'https://api.dexscreener.com',
  FEE_WALLET: 'CrQyg1WovDzakhqd7UfBrVvPbEZzPHWyui6Qd2zMV2UL',
  PLATFORM_FEE_BPS: 100, // 1% commission
  SOL_MINT: 'So11111111111111111111111111111111111111112',
  REFRESH_INTERVAL: 30000, // 30 seconds
};

// Utility functions
const formatNumber = (num, decimals = 2) => {
  if (!num) return '0';
  if (num >= 1e9) return (num / 1e9).toFixed(decimals) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(decimals) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(decimals) + 'K';
  return num.toFixed(decimals);
};

const formatPrice = (price) => {
  if (!price) return '$0';
  if (price < 0.00001) return '$' + price.toExponential(2);
  if (price < 1) return '$' + price.toFixed(6);
  return '$' + price.toFixed(2);
};

// Token Card Component
const TokenCard = ({ token, onSelect, isSelected }) => {
  const priceChange = token.priceChange?.h24 || 0;
  const isPositive = priceChange >= 0;
  
  return (
    <Card 
      className={`cursor-pointer transition-all hover:border-primary ${
        isSelected ? 'border-primary bg-primary/5' : ''
      }`}
      onClick={() => onSelect(token)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {token.info?.imageUrl && (
              <img 
                src={token.info.imageUrl} 
                alt={token.baseToken?.symbol} 
                className="w-8 h-8 rounded-full"
                onError={(e) => e.target.style.display = 'none'}
              />
            )}
            <div>
              <h3 className="font-bold text-sm">{token.baseToken?.symbol || 'Unknown'}</h3>
              <p className="text-xs text-muted-foreground truncate max-w-[100px]">
                {token.baseToken?.name || 'Unknown Token'}
              </p>
            </div>
          </div>
          <Badge variant={isPositive ? 'default' : 'destructive'} className="text-xs">
            {isPositive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            {Math.abs(priceChange).toFixed(1)}%
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Price</span>
            <p className="font-medium">{formatPrice(parseFloat(token.priceUsd))}</p>
          </div>
          <div>
            <span className="text-muted-foreground">MCap</span>
            <p className="font-medium">${formatNumber(token.marketCap || token.fdv)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Liquidity</span>
            <p className="font-medium">${formatNumber(token.liquidity?.usd)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">24h Vol</span>
            <p className="font-medium">${formatNumber(token.volume?.h24)}</p>
          </div>
        </div>
        
        <div className="flex gap-1 mt-2">
          {token.txns?.h24?.buys > token.txns?.h24?.sells && (
            <Badge variant="outline" className="text-xs text-green-500">🟢 More Buys</Badge>
          )}
          {token.liquidity?.usd > 50000 && (
            <Badge variant="outline" className="text-xs">💧 Good Liq</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Price Chart Component
const PriceChart = ({ tokenAddress }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  
  useEffect(() => {
    if (!chartContainerRef.current || !tokenAddress) return;
    
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.1)' },
        horzLines: { color: 'rgba(255,255,255,0.1)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });
    
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });
    
    // Fetch chart data from DexScreener
    // Note: DexScreener doesn't provide OHLC directly, so we simulate with price data
    // In production, you'd use a proper chart data provider
    const generateMockCandles = () => {
      const candles = [];
      const now = Math.floor(Date.now() / 1000);
      let price = 0.0001;
      
      for (let i = 100; i >= 0; i--) {
        const time = now - i * 3600;
        const open = price;
        const change = (Math.random() - 0.48) * 0.1;
        price = price * (1 + change);
        const close = price;
        const high = Math.max(open, close) * (1 + Math.random() * 0.02);
        const low = Math.min(open, close) * (1 - Math.random() * 0.02);
        
        candles.push({ time, open, high, low, close });
      }
      return candles;
    };
    
    candleSeries.setData(generateMockCandles());
    chartRef.current = chart;
    
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
  }, [tokenAddress]);
  
  return <div ref={chartContainerRef} className="w-full" />;
};

// Swap Panel Component
const SwapPanel = ({ selectedToken, solBalance }) => {
  const { solanaWallet, solanaConnected } = useWallet();
  const [mode, setMode] = useState('buy');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState(null);
  
  const quickAmounts = mode === 'buy' 
    ? [0.1, 0.5, 1, 2, 5] 
    : [25, 50, 75, 100];
  
  // Get quote from Jupiter
  const getQuote = useCallback(async () => {
    if (!selectedToken || !amount || parseFloat(amount) <= 0) {
      setQuote(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const inputMint = mode === 'buy' ? CONFIG.SOL_MINT : selectedToken.baseToken.address;
      const outputMint = mode === 'buy' ? selectedToken.baseToken.address : CONFIG.SOL_MINT;
      
      // Convert amount to lamports/smallest unit
      const inputAmount = mode === 'buy' 
        ? Math.floor(parseFloat(amount) * 1e9) // SOL has 9 decimals
        : Math.floor(parseFloat(amount) * Math.pow(10, selectedToken.baseToken.decimals || 9));
      
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: inputAmount.toString(),
        slippageBps: '100', // 1% slippage
        platformFeeBps: CONFIG.PLATFORM_FEE_BPS.toString(),
      });
      
      const response = await fetch(`${CONFIG.JUPITER_API}/quote?${params}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setQuote(data);
    } catch (err) {
      console.error('Quote error:', err);
      setError(err.message || 'Failed to get quote');
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }, [selectedToken, amount, mode]);
  
  // Debounced quote fetch
  useEffect(() => {
    const timer = setTimeout(getQuote, 500);
    return () => clearTimeout(timer);
  }, [getQuote]);
  
  // Execute swap
  const executeSwap = async () => {
    if (!quote || !solanaWallet || !solanaConnected) return;
    
    setSwapping(true);
    setError(null);
    
    try {
      // Get swap transaction from Jupiter
      const swapResponse = await fetch(`${CONFIG.JUPITER_API}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: solanaWallet.toString(),
          feeAccount: CONFIG.FEE_WALLET,
          wrapAndUnwrapSol: true,
        }),
      });
      
      const swapData = await swapResponse.json();
      
      if (swapData.error) {
        throw new Error(swapData.error);
      }
      
      // Deserialize and sign transaction
      const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      
      // Get provider (Phantom)
      const provider = window.solana;
      if (!provider) {
        throw new Error('Solana wallet not found');
      }
      
      // Sign and send
      const signedTx = await provider.signTransaction(transaction);
      const connection = new Connection(CONFIG.SOLANA_RPC, 'confirmed');
      const txid = await connection.sendRawTransaction(signedTx.serialize());
      
      // Wait for confirmation
      await connection.confirmTransaction(txid, 'confirmed');
      
      alert(`Swap successful! TX: ${txid}`);
      setAmount('');
      setQuote(null);
      
    } catch (err) {
      console.error('Swap error:', err);
      setError(err.message || 'Swap failed');
    } finally {
      setSwapping(false);
    }
  };
  
  if (!selectedToken) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Zap className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Select a token to trade</p>
        </CardContent>
      </Card>
    );
  }
  
  const outputAmount = quote ? (
    mode === 'buy' 
      ? parseFloat(quote.outAmount) / Math.pow(10, selectedToken.baseToken.decimals || 9)
      : parseFloat(quote.outAmount) / 1e9
  ) : 0;
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Swap</span>
          <Badge variant="outline">1% Fee</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Buy/Sell Toggle */}
        <div className="flex gap-2">
          <Button 
            variant={mode === 'buy' ? 'default' : 'outline'}
            className={`flex-1 ${mode === 'buy' ? 'bg-green-600 hover:bg-green-700' : ''}`}
            onClick={() => setMode('buy')}
          >
            Buy
          </Button>
          <Button 
            variant={mode === 'sell' ? 'default' : 'outline'}
            className={`flex-1 ${mode === 'sell' ? 'bg-red-600 hover:bg-red-700' : ''}`}
            onClick={() => setMode('sell')}
          >
            Sell
          </Button>
        </div>
        
        {/* Amount Input */}
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">
            {mode === 'buy' ? 'SOL Amount' : `${selectedToken.baseToken.symbol} Amount`}
          </label>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-lg"
          />
          {mode === 'buy' && solBalance && (
            <p className="text-xs text-muted-foreground mt-1">Balance: {solBalance.toFixed(4)} SOL</p>
          )}
        </div>
        
        {/* Quick Amount Buttons */}
        <div className="flex gap-2 flex-wrap">
          {quickAmounts.map((amt) => (
            <Button
              key={amt}
              variant="outline"
              size="sm"
              onClick={() => setAmount(mode === 'buy' ? amt.toString() : (amt / 100 * 100).toString())}
            >
              {mode === 'buy' ? `${amt} SOL` : `${amt}%`}
            </Button>
          ))}
        </div>
        
        {/* Quote Display */}
        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}
        
        {quote && !loading && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">You receive</span>
              <span className="font-medium">
                {formatNumber(outputAmount, 4)} {mode === 'buy' ? selectedToken.baseToken.symbol : 'SOL'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Price Impact</span>
              <span className={parseFloat(quote.priceImpactPct) > 5 ? 'text-red-500' : ''}>
                {(parseFloat(quote.priceImpactPct) * 100).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Platform Fee (1%)</span>
              <span>~{(parseFloat(amount) * 0.01).toFixed(4)} {mode === 'buy' ? 'SOL' : selectedToken.baseToken.symbol}</span>
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-500">
            <AlertTriangle className="w-4 h-4 inline mr-2" />
            {error}
          </div>
        )}
        
        {/* Swap Button */}
        <Button 
          className={`w-full ${mode === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
          size="lg"
          disabled={!quote || loading || swapping || !solanaConnected}
          onClick={executeSwap}
        >
          {swapping ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
          ) : !solanaConnected ? (
            'Connect Solana Wallet'
          ) : (
            `${mode === 'buy' ? 'Buy' : 'Sell'} ${selectedToken.baseToken.symbol}`
          )}
        </Button>
        
        <p className="text-xs text-center text-muted-foreground">
          Powered by Jupiter • 1% platform fee
        </p>
      </CardContent>
    </Card>
  );
};

// Main MemeCoins Page Component
export default function MemeCoins() {
  const { solanaConnected, solanaWallet } = useWallet();
  const [tokens, setTokens] = useState([]);
  const [filteredTokens, setFilteredTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('trending');
  const [solBalance, setSolBalance] = useState(null);
  
  // Fetch SOL balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!solanaWallet || !solanaConnected) return;
      
      try {
        const connection = new Connection(CONFIG.SOLANA_RPC, 'confirmed');
        const balance = await connection.getBalance(new PublicKey(solanaWallet));
        setSolBalance(balance / 1e9);
      } catch (err) {
        console.error('Balance fetch error:', err);
      }
    };
    
    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [solanaWallet, solanaConnected]);
  
  // Fetch tokens from DexScreener
  const fetchTokens = useCallback(async () => {
    setLoading(true);
    try {
      let endpoint = '';
      
      switch (activeTab) {
        case 'trending':
          endpoint = `${CONFIG.DEXSCREENER_API}/token-boosts/top/v1`;
          break;
        case 'new':
          endpoint = `${CONFIG.DEXSCREENER_API}/token-profiles/latest/v1`;
          break;
        case 'gainers':
          endpoint = `${CONFIG.DEXSCREENER_API}/token-boosts/top/v1`;
          break;
        default:
          endpoint = `${CONFIG.DEXSCREENER_API}/token-boosts/top/v1`;
      }
      
      const response = await fetch(endpoint);
      const data = await response.json();
      
      // Filter for Solana tokens and fetch full details
      let solanaTokens = [];
      
      if (Array.isArray(data)) {
        const solanaAddresses = data
          .filter(t => t.chainId === 'solana')
          .slice(0, 20)
          .map(t => t.tokenAddress);
        
        if (solanaAddresses.length > 0) {
          // Fetch full token details
          const detailsResponse = await fetch(
            `${CONFIG.DEXSCREENER_API}/latest/dex/tokens/${solanaAddresses.join(',')}`
          );
          const detailsData = await detailsResponse.json();
          solanaTokens = detailsData.pairs?.filter(p => p.chainId === 'solana') || [];
        }
      } else if (data.pairs) {
        solanaTokens = data.pairs.filter(p => p.chainId === 'solana');
      }
      
      // Sort by volume
      solanaTokens.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));
      
      setTokens(solanaTokens);
      setFilteredTokens(solanaTokens);
    } catch (err) {
      console.error('Fetch tokens error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);
  
  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, CONFIG.REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchTokens]);
  
  // Search filter
  useEffect(() => {
    if (!searchQuery) {
      setFilteredTokens(tokens);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = tokens.filter(token => 
      token.baseToken?.symbol?.toLowerCase().includes(query) ||
      token.baseToken?.name?.toLowerCase().includes(query) ||
      token.baseToken?.address?.toLowerCase().includes(query)
    );
    setFilteredTokens(filtered);
  }, [searchQuery, tokens]);
  
  // Search by address
  const searchByAddress = async (address) => {
    if (!address || address.length < 32) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${CONFIG.DEXSCREENER_API}/latest/dex/tokens/${address}`);
      const data = await response.json();
      
      const solanaPairs = data.pairs?.filter(p => p.chainId === 'solana') || [];
      if (solanaPairs.length > 0) {
        setFilteredTokens(solanaPairs);
        setSelectedToken(solanaPairs[0]);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto p-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500" />
            Meme Coins
          </h1>
          <p className="text-muted-foreground">Trade Solana meme coins with 1-click</p>
        </div>
        
        <div className="flex items-center gap-2">
          {solanaConnected && solBalance !== null && (
            <Badge variant="outline" className="text-sm py-1 px-3">
              💰 {solBalance.toFixed(4)} SOL
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={fetchTokens}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, symbol, or paste token address..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value.length >= 32) {
              searchByAddress(e.target.value);
            }
          }}
          className="pl-10"
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Token List */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="trending">
                <TrendingUp className="w-4 h-4 mr-2" />
                Trending
              </TabsTrigger>
              <TabsTrigger value="new">
                <Zap className="w-4 h-4 mr-2" />
                New Launches
              </TabsTrigger>
              <TabsTrigger value="gainers">
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Top Gainers
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : filteredTokens.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No tokens found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredTokens.map((token, index) => (
                <TokenCard
                  key={token.pairAddress || index}
                  token={token}
                  onSelect={setSelectedToken}
                  isSelected={selectedToken?.pairAddress === token.pairAddress}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Trading Panel */}
        <div className="space-y-4">
          {/* Token Info */}
          {selectedToken && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedToken.info?.imageUrl && (
                      <img 
                        src={selectedToken.info.imageUrl} 
                        alt={selectedToken.baseToken?.symbol}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <span>{selectedToken.baseToken?.symbol}</span>
                  </div>
                  <a 
                    href={`https://dexscreener.com/solana/${selectedToken.pairAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-2">
                  {formatPrice(parseFloat(selectedToken.priceUsd))}
                </div>
                <PriceChart tokenAddress={selectedToken.baseToken?.address} />
              </CardContent>
            </Card>
          )}
          
          {/* Swap Panel */}
          <SwapPanel selectedToken={selectedToken} solBalance={solBalance} />
          
          {/* Safety Info */}
          {selectedToken && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Token Info
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contract</span>
                  <span className="font-mono truncate max-w-[150px]">
                    {selectedToken.baseToken?.address?.slice(0, 8)}...{selectedToken.baseToken?.address?.slice(-6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">DEX</span>
                  <span>{selectedToken.dexId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pair Created</span>
                  <span>{selectedToken.pairCreatedAt ? new Date(selectedToken.pairCreatedAt).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Txns (24h)</span>
                  <span className="text-green-500">{selectedToken.txns?.h24?.buys || 0} buys</span>
                  <span className="text-red-500">{selectedToken.txns?.h24?.sells || 0} sells</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
