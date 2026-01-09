import { useState, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { createChart } from 'lightweight-charts';
import { ArrowUpDown, TrendingUp, TrendingDown, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet';

import * as jupiterApi from '../api/jupiter';
import { fetchTrendingSolanaTokens } from '../api/dexscreener';

const SLIPPAGE_OPTIONS = [0.5, 1, 2, 5];

export default function MemeCoinsTerminal() {
  const wallet = useWallet();
  
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
  
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    loadTokens();
  }, []);

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
    setSelectedToken(token);
    setInputAmount('');
    setOutputAmount('');
    setCurrentQuote(null);
    generateMockChartData(token);
  }

  function generateMockChartData(token) {
    const now = Date.now() / 1000;
    const data = [];
    let price = token.price;
    for (let i = 100; i >= 0; i--) {
      const time = now - i * 3600;
      price = price * (1 + (Math.random() - 0.5) * 0.02);
      data.push({ time, value: price });
    }
    setChartData(data);
  }

  useEffect(() => {
    if (!selectedToken || !chartContainerRef.current || chartData.length === 0) return;
    
    if (chartRef.current) {
      try { chartRef.current.remove(); } catch { /* disposed */ }
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 300,
      layout: { background: { color: '#0a0a0a' }, textColor: '#999' },
      grid: { vertLines: { color: '#1a1a1a' }, horzLines: { color: '#1a1a1a' } },
      timeScale: { timeVisible: true, secondsVisible: false },
    });

    const lineSeries = chart.addLineSeries({ color: '#22c55e', lineWidth: 2 });
    lineSeries.setData(chartData);
    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        try { chart.applyOptions({ width: chartContainerRef.current.clientWidth }); } catch { /* disposed */ }
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch { /* disposed */ }
        chartRef.current = null;
      }
    };
  }, [selectedToken, chartData]);

  useEffect(() => {
    if (!selectedToken || !inputAmount || parseFloat(inputAmount) <= 0) {
      setOutputAmount('');
      setCurrentQuote(null);
      return;
    }
    const delayDebounce = setTimeout(() => fetchQuote(), 500);
    return () => clearTimeout(delayDebounce);
  }, [inputAmount, selectedToken, swapMode, slippage]);

  async function fetchQuote() {
    if (!selectedToken || !inputAmount) return;
    try {
      setQuoteLoading(true);
      const inputMint = swapMode === 'buy' ? jupiterApi.TOKENS.USDC : selectedToken.address;
      const outputMint = swapMode === 'buy' ? selectedToken.address : jupiterApi.TOKENS.USDC;
      const inputDecimals = swapMode === 'buy' ? 6 : 9;
      const outputDecimals = swapMode === 'buy' ? 9 : 6;
      const rawAmount = jupiterApi.toRawAmount(parseFloat(inputAmount), inputDecimals);
      const slippageBps = slippage * 100;
      const quote = await jupiterApi.getQuote(inputMint, outputMint, rawAmount, slippageBps);
      if (quote) {
        const output = jupiterApi.fromRawAmount(parseInt(quote.outAmount), outputDecimals);
        setOutputAmount(output.toFixed(6));
        setCurrentQuote(quote);
      }
    } catch (error) {
      console.error('Error fetching quote:', error);
      toast.error('Failed to get quote');
      setOutputAmount('');
      setCurrentQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }

  async function handleSwap() {
    if (!wallet.connected) {
      toast.error('Please connect your wallet');
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
      toast.success(`Swap successful! Signature: ${signature.slice(0, 8)}...`);
      setInputAmount('');
      setOutputAmount('');
      setCurrentQuote(null);
    } catch (error) {
      console.error('Error executing swap:', error);
      toast.error(`Swap failed: ${error.message}`);
    } finally {
      setSwapping(false);
    }
  }

  const formatPrice = (price) => price < 0.01 ? `$${price.toFixed(6)}` : `$${price.toFixed(4)}`;
  const formatVolume = (vol) => vol >= 1e9 ? `$${(vol/1e9).toFixed(2)}B` : vol >= 1e6 ? `$${(vol/1e6).toFixed(2)}M` : vol >= 1e3 ? `$${(vol/1e3).toFixed(2)}K` : `$${vol.toFixed(2)}`;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="border-b border-gray-800">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">Meme Coin Terminal</h1>
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20">Solana</Badge>
            </div>
            <WalletMultiButton />
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search meme coins..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-gray-900/50 border-gray-800" />
          </div>
        </div>

        <Card className="bg-gray-900/50 border-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                    <button onClick={() => handleSort('symbol')} className="flex items-center gap-1 hover:text-white">Token <ArrowUpDown className="w-3 h-3" /></button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">
                    <button onClick={() => handleSort('price')} className="flex items-center gap-1 ml-auto hover:text-white">Price <ArrowUpDown className="w-3 h-3" /></button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">
                    <button onClick={() => handleSort('change24h')} className="flex items-center gap-1 ml-auto hover:text-white">24h % <ArrowUpDown className="w-3 h-3" /></button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">
                    <button onClick={() => handleSort('volume24h')} className="flex items-center gap-1 ml-auto hover:text-white">Volume <ArrowUpDown className="w-3 h-3" /></button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">
                    <button onClick={() => handleSort('liquidity')} className="flex items-center gap-1 ml-auto hover:text-white">Liquidity <ArrowUpDown className="w-3 h-3" /></button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Loading meme coins...</td></tr>
                ) : filteredTokens.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No tokens found</td></tr>
                ) : (
                  filteredTokens.map((token) => (
                    <tr key={token.address} className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors" onClick={() => selectToken(token)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {token.imageUrl ? <img src={token.imageUrl} alt={token.symbol} className="w-8 h-8 rounded-full" /> : <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs">{token.symbol?.charAt(0)}</div>}
                          <div><div className="font-medium">{token.symbol}</div><div className="text-xs text-gray-400">{token.name}</div></div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatPrice(token.price)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`flex items-center justify-end gap-1 ${token.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {token.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(token.change24h).toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatVolume(token.volume24h)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatVolume(token.liquidity)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={(e) => { e.stopPropagation(); selectToken(token); }}>Trade</Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Sheet open={!!selectedToken} onOpenChange={(open) => !open && setSelectedToken(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[600px] bg-gray-900 border-gray-800 overflow-y-auto">
          {selectedToken && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  {selectedToken.imageUrl ? <img src={selectedToken.imageUrl} alt={selectedToken.symbol} className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">{selectedToken.symbol?.charAt(0)}</div>}
                  <div><div className="text-xl font-bold">{selectedToken.symbol}</div><div className="text-sm text-gray-400 font-normal">{selectedToken.name}</div></div>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Price</div>
                    <div className="text-xl font-bold font-mono">{formatPrice(selectedToken.price)}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">24h Change</div>
                    <div className={`text-xl font-bold flex items-center gap-1 ${selectedToken.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {selectedToken.change24h >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {selectedToken.change24h.toFixed(2)}%
                    </div>
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="text-sm font-medium mb-3">Price Chart</div>
                  <div ref={chartContainerRef} className="w-full h-[300px]" />
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <Tabs value={swapMode} onValueChange={setSwapMode} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="buy" className="data-[state=active]:bg-green-600">Buy</TabsTrigger>
                      <TabsTrigger value="sell" className="data-[state=active]:bg-red-600">Sell</TabsTrigger>
                    </TabsList>
                    <TabsContent value="buy" className="space-y-4">
                      <SwapForm inputLabel="Pay (USDC)" outputLabel={`Receive (${selectedToken.symbol})`} inputAmount={inputAmount} outputAmount={outputAmount} onInputChange={setInputAmount} slippage={slippage} customSlippage={customSlippage} onSlippageChange={setSlippage} onCustomSlippageChange={setCustomSlippage} quoteLoading={quoteLoading} swapping={swapping} onSwap={handleSwap} walletConnected={wallet.connected} />
                    </TabsContent>
                    <TabsContent value="sell" className="space-y-4">
                      <SwapForm inputLabel={`Pay (${selectedToken.symbol})`} outputLabel="Receive (USDC)" inputAmount={inputAmount} outputAmount={outputAmount} onInputChange={setInputAmount} slippage={slippage} customSlippage={customSlippage} onSlippageChange={setSlippage} onCustomSlippageChange={setCustomSlippage} quoteLoading={quoteLoading} swapping={swapping} onSwap={handleSwap} walletConnected={wallet.connected} />
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SwapForm({ inputLabel, outputLabel, inputAmount, outputAmount, onInputChange, slippage, customSlippage, onSlippageChange, onCustomSlippageChange, quoteLoading, swapping, onSwap, walletConnected }) {
  return (
    <>
      <div className="space-y-2">
        <Label className="text-gray-400">{inputLabel}</Label>
        <Input type="number" placeholder="0.00" value={inputAmount} onChange={(e) => onInputChange(e.target.value)} className="bg-gray-900 border-gray-700 text-lg h-12" />
      </div>
      <div className="space-y-2">
        <Label className="text-gray-400">{outputLabel}</Label>
        <Input type="text" placeholder="0.00" value={outputAmount} readOnly className="bg-gray-900 border-gray-700 text-lg h-12" />
        {quoteLoading && <div className="text-xs text-gray-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" />Getting best price...</div>}
      </div>
      <div className="space-y-2">
        <Label className="text-gray-400">Slippage Tolerance</Label>
        <div className="flex gap-2">
          {SLIPPAGE_OPTIONS.map((opt) => (
            <Button key={opt} size="sm" variant={slippage === opt ? 'default' : 'outline'} onClick={() => onSlippageChange(opt)} className={slippage === opt ? 'bg-green-600' : ''}>{opt}%</Button>
          ))}
          <Input type="number" placeholder="Custom" value={customSlippage} onChange={(e) => { onCustomSlippageChange(e.target.value); const val = parseFloat(e.target.value); if (val > 0) onSlippageChange(val); }} className="w-24 bg-gray-900 border-gray-700" />
        </div>
      </div>
      <Button size="lg" className="w-full bg-green-600 hover:bg-green-700 text-lg h-12" onClick={onSwap} disabled={!walletConnected || !inputAmount || !outputAmount || swapping || quoteLoading}>
        {!walletConnected ? 'Connect Wallet' : swapping ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Swapping...</> : 'Swap'}
      </Button>
    </>
  );
}
