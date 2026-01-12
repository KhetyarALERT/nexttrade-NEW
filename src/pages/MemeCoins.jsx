import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { VersionedTransaction } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  fetchPairById,
  fetchSearchTokens,
  fetchTokenPairs,
  fetchTrendingTokens,
  mapPairDetailsToSummary,
} from '@/lib/market/dexscreener';
import {
  formatAge,
  formatCompactNumber,
  formatPercent,
  formatPrice,
  formatTokenAmount,
  selectBestPair,
} from '@/lib/market/selectors';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const DEFAULT_SLIPPAGE_BPS = 50;

const useDebouncedValue = (value, delay = 400) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(handle);
  }, [value, delay]);

  return debounced;
};

const normalizeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getFeeConfig = () => {
  const bps = Number(import.meta.env.NEXT_PUBLIC_JUP_PLATFORM_FEE_BPS || 0);
  const feeAccount = import.meta.env.NEXT_PUBLIC_JUP_FEE_ACCOUNT || '';
  if (!bps || !feeAccount) {
    return { enabled: false, bps: 0, feeAccount: '' };
  }
  return { enabled: true, bps, feeAccount };
};

const calcPressure = (txns24h) => {
  const buys = txns24h?.buys ?? 0;
  const sells = txns24h?.sells ?? 0;
  const total = buys + sells;
  if (!total) return { buys, sells, buyPercent: 50, sellPercent: 50 };
  const buyPercent = Math.round((buys / total) * 100);
  return { buys, sells, buyPercent, sellPercent: 100 - buyPercent };
};

const TokenRow = ({ token, selected, onSelect, isWatchlisted, onToggleWatchlist }) => {
  const change = token.priceChange24h ?? 0;
  const isPositive = change >= 0;
  const pressure = token.txns24h ? calcPressure(token.txns24h) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(token)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onSelect(token);
      }}
      className={cn(
        'w-full rounded-lg border px-3 py-2 text-left transition hover:bg-muted/30',
        selected ? 'border-primary/50 bg-primary/5' : 'border-border/50'
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          {token.imageUrl ? (
            <img src={token.imageUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span>{token.symbol?.slice(0, 1) || '?'}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{token.symbol || '—'}</span>
            {token.pairCreatedAt && Date.now() - token.pairCreatedAt < 86400000 ? (
              <Badge variant="secondary" className="text-[10px]">New</Badge>
            ) : null}
          </div>
          <div className="truncate text-xs text-muted-foreground">{token.name || '—'}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold">{formatPrice(token.priceUsd)}</div>
          <div className={cn('text-xs font-medium', isPositive ? 'text-emerald-500' : 'text-rose-500')}>
            {formatPercent(change)}
          </div>
        </div>
        <Button
          type="button"
          size="icon"
          variant={isWatchlisted ? 'default' : 'outline'}
          className="h-7 w-7"
          aria-label={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
          onClick={(event) => {
            event.stopPropagation();
            onToggleWatchlist(token.address);
          }}
        >
          ★
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-[10px] text-muted-foreground">
        <div>MCap: ${formatCompactNumber(token.marketCap)}</div>
        <div>Liq: ${formatCompactNumber(token.liquidityUsd)}</div>
        <div>Vol: ${formatCompactNumber(token.volume24h)}</div>
        <div>Age: {formatAge(token.pairCreatedAt)}</div>
      </div>
      {pressure ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-emerald-500" style={{ width: `${pressure.buyPercent}%` }} />
        </div>
      ) : null}
    </div>
  );
};

const TokenListPanel = ({
  tokens,
  isLoading,
  error,
  selectedAddress,
  onSelect,
  mode,
  onModeChange,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  filters,
  onFiltersChange,
  watchlist,
  onToggleWatchlist,
}) => {
  const displayTokens = useMemo(() => {
    let list = [...tokens];
    if (filters.minLiquidity) {
      list = list.filter((token) => (token.liquidityUsd ?? 0) >= filters.minLiquidity);
    }
    if (filters.minVolume) {
      list = list.filter((token) => (token.volume24h ?? 0) >= filters.minVolume);
    }
    if (mode === 'watchlist') {
      list = list.filter((token) => watchlist.includes(token.address));
    }

    switch (sortBy) {
      case 'volume':
        list.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
        break;
      case 'liquidity':
        list.sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0));
        break;
      case 'gainers':
        list.sort((a, b) => (b.priceChange24h ?? 0) - (a.priceChange24h ?? 0));
        break;
      case 'losers':
        list.sort((a, b) => (a.priceChange24h ?? 0) - (b.priceChange24h ?? 0));
        break;
      case 'new':
        list.sort((a, b) => (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0));
        break;
      default:
        break;
    }
    return list;
  }, [tokens, filters, mode, sortBy, watchlist]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={mode === 'discover' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onModeChange('discover')}
        >
          Discover
        </Button>
        <Button
          variant={mode === 'watchlist' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onModeChange('watchlist')}
        >
          Watchlist
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trending">Trending</SelectItem>
              <SelectItem value="volume">Volume</SelectItem>
              <SelectItem value="liquidity">Liquidity</SelectItem>
              <SelectItem value="gainers">Gainers</SelectItem>
              <SelectItem value="losers">Losers</SelectItem>
              <SelectItem value="new">New</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Input
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search name, symbol, address"
      />
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={String(filters.minLiquidity)}
          onValueChange={(value) => onFiltersChange({ ...filters, minLiquidity: Number(value) })}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Min Liq" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Min Liq</SelectItem>
            <SelectItem value="10000">$10k+</SelectItem>
            <SelectItem value="50000">$50k+</SelectItem>
            <SelectItem value="100000">$100k+</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={String(filters.minVolume)}
          onValueChange={(value) => onFiltersChange({ ...filters, minVolume: Number(value) })}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Min Vol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Min Vol</SelectItem>
            <SelectItem value="10000">$10k+</SelectItem>
            <SelectItem value="50000">$50k+</SelectItem>
            <SelectItem value="100000">$100k+</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-20" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-500">
            Data source unavailable. Try again soon.
          </div>
        ) : displayTokens.length === 0 ? (
          <div className="rounded-lg border border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground">
            No tokens found.
          </div>
        ) : (
          displayTokens.map((token) => (
            <TokenRow
              key={token.address}
              token={token}
              selected={token.address === selectedAddress}
              onSelect={onSelect}
              isWatchlisted={watchlist.includes(token.address)}
              onToggleWatchlist={onToggleWatchlist}
            />
          ))
        )}
      </div>
    </div>
  );
};

const ChartPanel = ({ pair, isLoading, error }) => {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-sm text-muted-foreground">
        Data source unavailable.
      </div>
    );
  }

  if (!pair && isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  if (!pair) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-sm text-muted-foreground">
        Select a token to view chart.
      </div>
    );
  }

  const change = pair.priceChange24h ?? 0;
  const isPositive = change >= 0;

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/50 bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
        <div>
          <div className="text-sm font-semibold">{pair.baseToken.symbol} / {pair.quoteToken.symbol}</div>
          <div className="text-xs text-muted-foreground">{pair.baseToken.name}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold">{formatPrice(pair.priceUsd)}</div>
          <div className={cn('text-xs font-medium', isPositive ? 'text-emerald-500' : 'text-rose-500')}>
            {formatPercent(change)}
          </div>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Liq: ${formatCompactNumber(pair.liquidityUsd)}</span>
          <span>Vol: ${formatCompactNumber(pair.volume24h)}</span>
          <span>{pair.dexId || 'DEX'}</span>
        </div>
      </div>
      <div className="flex-1">
        <iframe
          title="Dexscreener chart"
          className="h-full w-full"
          src={`https://dexscreener.com/solana/${pair.pairAddress}?embed=1&chartTheme=${isDark ? 'dark' : 'light'}&theme=${isDark ? 'dark' : 'light'}&trades=0&info=0&tabs=0`}
        />
      </div>
    </div>
  );
};

const TradePanel = ({ pair, quote, quoteLoading, onQuoteRefresh, onSwap, status, walletReady, onConnect }) => {
  const [side, setSide] = useState('buy');
  const [amount, setAmount] = useState('');
  const [slippageMode, setSlippageMode] = useState('auto');
  const [manualSlippage, setManualSlippage] = useState(DEFAULT_SLIPPAGE_BPS.toString());
  const [priorityFee, setPriorityFee] = useState(false);
  const feeConfig = getFeeConfig();

  useEffect(() => {
    if (!pair) return;
    setAmount('');
  }, [pair]);

  useEffect(() => {
    onQuoteRefresh({ amount, side, slippageMode, manualSlippage, priorityFee });
  }, [amount, side, slippageMode, manualSlippage, priorityFee, onQuoteRefresh]);

  if (!pair) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-sm text-muted-foreground">
        Select a token to trade.
      </div>
    );
  }

  const inputSymbol = side === 'buy' ? 'SOL' : pair.baseToken.symbol;
  const outputSymbol = side === 'buy' ? pair.baseToken.symbol : 'SOL';
  const outputDecimals = side === 'buy' ? pair.baseToken.decimals ?? 6 : 9;
  const warning = (pair.liquidityUsd ?? 0) < 5000;

  return (
    <div className="flex h-full flex-col gap-4 rounded-xl border border-border/50 bg-background p-4">
      <div className="flex items-center gap-2">
        <Button
          variant={side === 'buy' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSide('buy')}
          className="flex-1"
        >
          Buy
        </Button>
        <Button
          variant={side === 'sell' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSide('sell')}
          className="flex-1"
        >
          Sell
        </Button>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Amount ({inputSymbol})</label>
        <Input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.0"
          type="number"
        />
        <div className="grid grid-cols-5 gap-2">
          {['0.1', '0.5', '1', '2', '5'].map((value) => (
            <Button key={value} variant="outline" size="sm" onClick={() => setAmount(value)}>
              {value}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Slippage</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={slippageMode === 'auto' ? 'default' : 'outline'}
              onClick={() => setSlippageMode('auto')}
            >
              Auto
            </Button>
            <Button
              size="sm"
              variant={slippageMode === 'custom' ? 'default' : 'outline'}
              onClick={() => setSlippageMode('custom')}
            >
              Manual
            </Button>
          </div>
        </div>
        {slippageMode === 'custom' ? (
          <Input
            value={manualSlippage}
            onChange={(event) => setManualSlippage(event.target.value)}
            type="number"
            placeholder="50"
          />
        ) : null}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-xs">
        <span className="text-muted-foreground">Priority fee</span>
        <Button size="sm" variant={priorityFee ? 'default' : 'outline'} onClick={() => setPriorityFee(!priorityFee)}>
          {priorityFee ? 'On' : 'Off'}
        </Button>
      </div>

      <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">You get</span>
          <span className="font-semibold">
            {quoteLoading ? 'Loading...' : quote?.outAmount ? `${formatTokenAmount(quote.outAmount, outputDecimals)} ${outputSymbol}` : '—'}
          </span>
        </div>
        {feeConfig.enabled ? (
          <div className="mt-1 text-[11px] text-muted-foreground">Fee: {(feeConfig.bps / 100).toFixed(2)}%</div>
        ) : null}
        {warning ? (
          <div className="mt-2 text-[11px] text-amber-500">
            Low liquidity token. Trade cautiously.
          </div>
        ) : null}
      </div>

      <div className="flex-1" />

      <div className="sticky bottom-0 space-y-3 bg-background pb-2 pt-2 md:static md:pb-0">
        {!walletReady ? (
          <Button className="w-full" onClick={onConnect}>Connect wallet</Button>
        ) : (
          <Button
            className="w-full"
            onClick={() => onSwap({ side, amount, slippageMode, manualSlippage, priorityFee })}
            disabled={!amount || Number(amount) <= 0 || !quote}
          >
            {side === 'buy' ? 'Buy' : 'Sell'} {pair.baseToken.symbol}
          </Button>
        )}
        {status ? (
          <div className="rounded-lg border border-border/50 px-3 py-2 text-xs">
            <div>Status: {status.state}</div>
            {status.signature ? (
              <a
                className="text-primary underline"
                href={`https://solscan.io/tx/${status.signature}`}
                target="_blank"
                rel="noreferrer"
              >
                View on explorer
              </a>
            ) : null}
            {status.error ? <div className="text-rose-500">{status.error}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default function MemeCoins() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [mode, setMode] = useState('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('trending');
  const [filters, setFilters] = useState({ minLiquidity: 0, minVolume: 0 });
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedPairId, setSelectedPairId] = useState('');
  const [tradeSheetOpen, setTradeSheetOpen] = useState(false);
  const [swapStatus, setSwapStatus] = useState(null);
  const [pendingQuoteParams, setPendingQuoteParams] = useState(null);
  const [watchlist, setWatchlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('meme_watchlist') || '[]');
    } catch {
      return [];
    }
  });

  const debouncedSearch = useDebouncedValue(searchQuery, 400);
  const debouncedQuoteParams = useDebouncedValue(pendingQuoteParams, 400);
  const feeConfig = getFeeConfig();

  useEffect(() => {
    localStorage.setItem('meme_watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    if (selectedPairId || selectedAddress) {
      const params = new URLSearchParams();
      if (selectedPairId) params.set('pair', selectedPairId);
      else params.set('token', selectedAddress);
      window.history.replaceState(null, '', `?${params.toString()}`);
    }
  }, [selectedPairId, selectedAddress]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || '';
    const pair = params.get('pair') || '';
    if (pair) setSelectedPairId(pair);
    if (token) setSelectedAddress(token);
  }, []);

  const trendingQuery = useQuery({
    queryKey: ['memeTokens', mode],
    queryFn: ({ signal }) => fetchTrendingTokens(signal),
    staleTime: 15000,
    refetchInterval: 25000,
  });

  const searchQueryResult = useQuery({
    queryKey: ['memeTokensSearch', debouncedSearch],
    queryFn: ({ signal }) => fetchSearchTokens(debouncedSearch, signal),
    enabled: debouncedSearch.length > 1,
    staleTime: 15000,
  });

  const tokens = debouncedSearch.length > 1 ? searchQueryResult.data ?? [] : trendingQuery.data ?? [];

  const pairQuery = useQuery({
    queryKey: ['pairDetails', selectedPairId || selectedAddress],
    queryFn: async ({ signal }) => {
      if (selectedPairId) {
        return fetchPairById(selectedPairId, signal);
      }
      const pairs = await fetchTokenPairs(selectedAddress, signal);
      return selectBestPair(pairs);
    },
    enabled: Boolean(selectedPairId || selectedAddress),
    staleTime: 2000,
    refetchInterval: 4000,
  });

  const selectedPair = pairQuery.data ?? null;
  const selectedToken = selectedPair ? mapPairDetailsToSummary(selectedPair) : null;

  useEffect(() => {
    if (selectedPair?.baseToken?.address) {
      setSelectedAddress(selectedPair.baseToken.address);
    }
  }, [selectedPair]);

  const quoteQuery = useQuery({
    queryKey: ['jupQuote', debouncedQuoteParams, selectedPairId, selectedAddress, feeConfig.bps],
    queryFn: async ({ signal }) => {
      if (!debouncedQuoteParams || !selectedPair) return null;
      const { amount, side, slippageMode, manualSlippage } = debouncedQuoteParams;
      const inputDecimals = side === 'buy' ? 9 : selectedPair.baseToken.decimals ?? 6;
      const parsedAmount = normalizeNumber(amount);
      if (!parsedAmount) return null;
      const amountInSmallest = Math.floor(parsedAmount * Math.pow(10, inputDecimals));
      const inputMint = side === 'buy' ? SOL_MINT : selectedPair.baseToken.address;
      const outputMint = side === 'buy' ? selectedPair.baseToken.address : SOL_MINT;
      const slippageBps = slippageMode === 'custom' ? normalizeNumber(manualSlippage) : DEFAULT_SLIPPAGE_BPS;
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amountInSmallest.toString(),
        slippageBps: slippageBps.toString(),
      });
      if (feeConfig.enabled) {
        params.set('platformFeeBps', feeConfig.bps.toString());
      }
      const response = await fetch(`https://quote-api.jup.ag/v6/quote?${params.toString()}`, { signal });
      if (!response.ok) {
        return null;
      }
      return response.json();
    },
    enabled: Boolean(debouncedQuoteParams && selectedPair),
    staleTime: 2000,
  });

  const handleSelectToken = (token) => {
    setSelectedAddress(token.address);
    setSelectedPairId(token.pairAddress || '');
    setSwapStatus(null);
    setTradeSheetOpen(true);
  };

  const handleToggleWatchlist = (address) => {
    setWatchlist((prev) =>
      prev.includes(address) ? prev.filter((item) => item !== address) : [...prev, address]
    );
  };

  const handleQuoteRefresh = (params) => {
    setPendingQuoteParams(params);
  };

  const handleSwap = async (params) => {
    if (!selectedPair || !publicKey) return;
    const quote = quoteQuery.data;
    if (!quote) return;

    const { side, slippageMode, manualSlippage, priorityFee, amount } = params;
    const inputDecimals = side === 'buy' ? 9 : selectedPair.baseToken.decimals ?? 6;
    const parsedAmount = normalizeNumber(amount);
    if (!parsedAmount) return;

    const slippageBps = slippageMode === 'custom' ? normalizeNumber(manualSlippage) : DEFAULT_SLIPPAGE_BPS;

    try {
      setSwapStatus({ state: 'signing' });
      const response = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: publicKey.toBase58(),
          wrapAndUnwrapSol: true,
          feeAccount: feeConfig.enabled ? feeConfig.feeAccount : undefined,
          prioritizationFeeLamports: priorityFee ? 5000 : undefined,
          slippageBps,
          dynamicComputeUnitLimit: true,
        }),
      });

      if (!response.ok) {
        setSwapStatus({ state: 'failed', error: 'Swap request failed.' });
        return;
      }

      const swapData = await response.json();
      const transaction = VersionedTransaction.deserialize(
        Uint8Array.from(atob(swapData.swapTransaction), (char) => char.charCodeAt(0))
      );
      const signature = await sendTransaction(transaction, connection);
      setSwapStatus({ state: 'sent', signature });
      await connection.confirmTransaction(signature, 'confirmed');
      setSwapStatus({ state: 'confirmed', signature });
    } catch (error) {
      setSwapStatus({ state: 'failed', error: error?.message || 'Swap failed.' });
    }
  };

  const listError = trendingQuery.error || searchQueryResult.error;

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col gap-4 overflow-hidden px-4 pb-4 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Solana Memes</h1>
          <p className="text-xs text-muted-foreground">Professional trading terminal for meme tokens.</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedToken ? (
            <Badge variant="secondary">{selectedToken.symbol}</Badge>
          ) : null}
          <Sheet open={tradeSheetOpen} onOpenChange={setTradeSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="md:inline-flex lg:hidden">Trade</Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md">
              <TradePanel
                pair={selectedPair}
                quote={quoteQuery.data}
                quoteLoading={quoteQuery.isFetching}
                onQuoteRefresh={handleQuoteRefresh}
                onSwap={handleSwap}
                status={swapStatus}
                walletReady={connected}
                onConnect={() => setVisible(true)}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="hidden h-full grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,360px)] gap-4 lg:grid">
        <TokenListPanel
          tokens={tokens}
          isLoading={trendingQuery.isLoading || searchQueryResult.isFetching}
          error={listError}
          selectedAddress={selectedAddress}
          onSelect={handleSelectToken}
          mode={mode}
          onModeChange={setMode}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          filters={filters}
          onFiltersChange={setFilters}
          watchlist={watchlist}
          onToggleWatchlist={handleToggleWatchlist}
        />
        <ChartPanel pair={selectedPair} isLoading={pairQuery.isLoading} error={pairQuery.error} />
        <TradePanel
          pair={selectedPair}
          quote={quoteQuery.data}
          quoteLoading={quoteQuery.isFetching}
          onQuoteRefresh={handleQuoteRefresh}
          onSwap={handleSwap}
          status={swapStatus}
          walletReady={connected}
          onConnect={() => setVisible(true)}
        />
      </div>

      <div className="hidden h-full grid-cols-2 gap-4 md:grid lg:hidden">
        <TokenListPanel
          tokens={tokens}
          isLoading={trendingQuery.isLoading || searchQueryResult.isFetching}
          error={listError}
          selectedAddress={selectedAddress}
          onSelect={handleSelectToken}
          mode={mode}
          onModeChange={setMode}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          filters={filters}
          onFiltersChange={setFilters}
          watchlist={watchlist}
          onToggleWatchlist={handleToggleWatchlist}
        />
        <ChartPanel pair={selectedPair} isLoading={pairQuery.isLoading} error={pairQuery.error} />
      </div>

      <div className="flex h-full flex-col md:hidden">
        <Tabs defaultValue="list" className="flex h-full flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="chart">Chart</TabsTrigger>
            <TabsTrigger value="trade">Trade</TabsTrigger>
          </TabsList>
          <TabsContent value="list" className="mt-3 h-full">
            <TokenListPanel
              tokens={tokens}
              isLoading={trendingQuery.isLoading || searchQueryResult.isFetching}
              error={listError}
              selectedAddress={selectedAddress}
              onSelect={handleSelectToken}
              mode={mode}
              onModeChange={setMode}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sortBy={sortBy}
              onSortChange={setSortBy}
              filters={filters}
              onFiltersChange={setFilters}
              watchlist={watchlist}
              onToggleWatchlist={handleToggleWatchlist}
            />
          </TabsContent>
          <TabsContent value="chart" className="mt-3 h-full">
            <ChartPanel pair={selectedPair} isLoading={pairQuery.isLoading} error={pairQuery.error} />
          </TabsContent>
          <TabsContent value="trade" className="mt-3 h-full">
            <TradePanel
              pair={selectedPair}
              quote={quoteQuery.data}
              quoteLoading={quoteQuery.isFetching}
              onQuoteRefresh={handleQuoteRefresh}
              onSwap={handleSwap}
              status={swapStatus}
              walletReady={connected}
              onConnect={() => setVisible(true)}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
