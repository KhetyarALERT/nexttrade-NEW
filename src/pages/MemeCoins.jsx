import { useEffect, useId, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { VersionedTransaction } from '@solana/web3.js';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { tMemeCoins } from '@/lib/i18n/memecoins';
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

const SolanaLogo = ({ className = '' }) => {
  const gradientId = useId();
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 45.5L24.2 33.3C24.9 32.6 25.9 32.2 26.9 32.2H58.5C60 32.2 60.8 34 59.7 35.1L47.5 47.3C46.8 48 45.8 48.4 44.8 48.4H13.2C11.7 48.4 10.9 46.6 12 45.5Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M12 28.9L24.2 16.7C24.9 16 25.9 15.6 26.9 15.6H58.5C60 15.6 60.8 17.4 59.7 18.5L47.5 30.7C46.8 31.4 45.8 31.8 44.8 31.8H13.2C11.7 31.8 10.9 30 12 28.9Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M12 12.3L24.2 0.999999C24.9 0.299998 25.9 0 26.9 0H58.5C60 0 60.8 1.8 59.7 2.9L47.5 15.1C46.8 15.8 45.8 16.1 44.8 16.1H13.2C11.7 16.1 10.9 14.3 12 12.3Z"
        fill={`url(#${gradientId})`}
      />
      <defs>
        <linearGradient id={gradientId} x1="12" y1="0" x2="60" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00FFA3" />
          <stop offset="0.5" stopColor="#14F195" />
          <stop offset="1" stopColor="#9945FF" />
        </linearGradient>
      </defs>
    </svg>
  );
};

const HelpTooltip = ({ text, className = '' }) => (
  <span className={cn('inline-flex items-center', className)}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={text}
          title={text}
          className="hidden h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground md:inline-flex"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={text}
          title={text}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground md:hidden"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 text-xs">{text}</PopoverContent>
    </Popover>
  </span>
);

const TokenRow = ({ token, selected, onSelect, isWatchlisted, onToggleWatchlist, t, isRtl }) => {
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
      <div className={cn('flex items-center gap-3', isRtl && 'flex-row-reverse text-right')}>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          {token.imageUrl ? (
            <img src={token.imageUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span>{token.symbol?.slice(0, 1) || '?'}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn('flex items-center gap-2', isRtl && 'flex-row-reverse justify-end')}>
            <span className="truncate text-sm font-semibold">{token.symbol || '—'}</span>
            {token.pairCreatedAt && Date.now() - token.pairCreatedAt < 86400000 ? (
              <Badge variant="secondary" className="text-[10px]">{t.newBadge}</Badge>
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant={isWatchlisted ? 'default' : 'outline'}
              className="h-7 w-7"
              aria-label={isWatchlisted ? t.removeWatchlist : t.addWatchlist}
              title={isWatchlisted ? t.removeWatchlist : t.addWatchlist}
              onClick={(event) => {
                event.stopPropagation();
                onToggleWatchlist(token.address);
              }}
            >
              ★
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isWatchlisted ? t.removeWatchlist : t.addWatchlist}</TooltipContent>
        </Tooltip>
      </div>
      <div className={cn('mt-2 grid grid-cols-4 gap-2 text-[10px] text-muted-foreground', isRtl && 'text-right')}>
        <div>{t.marketCapShort}: ${formatCompactNumber(token.marketCap)}</div>
        <div>{t.liquidityShort}: ${formatCompactNumber(token.liquidityUsd)}</div>
        <div>{t.volumeShort}: ${formatCompactNumber(token.volume24h)}</div>
        <div>{t.ageShort}: {formatAge(token.pairCreatedAt)}</div>
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
  t,
  isRtl,
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
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div className={cn('flex flex-wrap items-center gap-2', isRtl && 'flex-row-reverse text-right')}>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={mode === 'discover' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onModeChange('discover')}
                title={t.discoverHelp}
                aria-label={t.discoverHelp}
              >
                {t.discover}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.discoverHelp}</TooltipContent>
          </Tooltip>
          <HelpTooltip text={t.discoverHelp} />
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={mode === 'watchlist' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onModeChange('watchlist')}
                title={t.watchlistHelp}
                aria-label={t.watchlistHelp}
              >
                {t.watchlist}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.watchlistHelp}</TooltipContent>
          </Tooltip>
          <HelpTooltip text={t.watchlistHelp} />
        </div>
        <div className={cn('ml-auto flex items-center gap-2', isRtl && 'ml-0 mr-auto')}>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t.sort}</span>
            <HelpTooltip text={t.sortHelp} />
          </div>
          <Select value={sortBy} onValueChange={onSortChange}>
            <Tooltip>
              <TooltipTrigger asChild>
                <SelectTrigger className="h-8 w-[130px]" title={t.sortHelp}>
                  <SelectValue placeholder={t.sort} />
                </SelectTrigger>
              </TooltipTrigger>
              <TooltipContent>{t.sortHelp}</TooltipContent>
            </Tooltip>
            <SelectContent>
              <SelectItem value="trending">{t.sortTrending}</SelectItem>
              <SelectItem value="volume">{t.sortVolume}</SelectItem>
              <SelectItem value="liquidity">{t.sortLiquidity}</SelectItem>
              <SelectItem value="gainers">{t.sortGainers}</SelectItem>
              <SelectItem value="losers">{t.sortLosers}</SelectItem>
              <SelectItem value="new">{t.sortNew}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', isRtl && 'flex-row-reverse')}>
          <span>{t.searchLabel}</span>
          <HelpTooltip text={t.searchHelp} />
        </div>
        <Input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t.searchPlaceholder}
          title={t.searchHelp}
          aria-label={t.searchHelp}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <div className={cn('flex items-center gap-2 text-[11px] text-muted-foreground', isRtl && 'flex-row-reverse')}>
            <span>{t.minLiquidityShort}</span>
            <HelpTooltip text={t.minLiquidityHelp} />
          </div>
          <Select
            value={String(filters.minLiquidity)}
            onValueChange={(value) => onFiltersChange({ ...filters, minLiquidity: Number(value) })}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <SelectTrigger className="h-8" title={t.minLiquidityHelp}>
                  <SelectValue placeholder={t.minLiquidityShort} />
                </SelectTrigger>
              </TooltipTrigger>
              <TooltipContent>{t.minLiquidityHelp}</TooltipContent>
            </Tooltip>
            <SelectContent>
              <SelectItem value="0">{t.minLiquidityShort}</SelectItem>
              <SelectItem value="10000">$10k+</SelectItem>
              <SelectItem value="50000">$50k+</SelectItem>
              <SelectItem value="100000">$100k+</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <div className={cn('flex items-center gap-2 text-[11px] text-muted-foreground', isRtl && 'flex-row-reverse')}>
            <span>{t.minVolumeShort}</span>
            <HelpTooltip text={t.minVolumeHelp} />
          </div>
          <Select
            value={String(filters.minVolume)}
            onValueChange={(value) => onFiltersChange({ ...filters, minVolume: Number(value) })}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <SelectTrigger className="h-8" title={t.minVolumeHelp}>
                  <SelectValue placeholder={t.minVolumeShort} />
                </SelectTrigger>
              </TooltipTrigger>
              <TooltipContent>{t.minVolumeHelp}</TooltipContent>
            </Tooltip>
            <SelectContent>
              <SelectItem value="0">{t.minVolumeShort}</SelectItem>
              <SelectItem value="10000">$10k+</SelectItem>
              <SelectItem value="50000">$50k+</SelectItem>
              <SelectItem value="100000">$100k+</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-20" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-500">
            {t.dataUnavailable}
          </div>
        ) : displayTokens.length === 0 ? (
          <div className="rounded-lg border border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground">
            {t.noTokensFound}
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
              t={t}
              isRtl={isRtl}
            />
          ))
        )}
      </div>
    </div>
  );
};

const ChartPanel = ({ pair, isLoading, error, t, isRtl }) => {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-sm text-muted-foreground">
        {t.dataUnavailable}
      </div>
    );
  }

  if (!pair && isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  if (!pair) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-sm text-muted-foreground">
        {t.selectTokenToViewChart}
      </div>
    );
  }

  const change = pair.priceChange24h ?? 0;
  const isPositive = change >= 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/50 bg-background">
      <div className={cn('flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-2 md:px-4 md:py-3', isRtl && 'flex-row-reverse text-right')}>
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
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>{t.liquidityShort}: ${formatCompactNumber(pair.liquidityUsd)}</span>
          <span>{t.volumeShort}: ${formatCompactNumber(pair.volume24h)}</span>
          <span>{pair.dexId || 'DEX'}</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <iframe
          title={t.chartTitle}
          className="h-full w-full"
          src={`https://dexscreener.com/solana/${pair.pairAddress}?embed=1&chartTheme=${isDark ? 'dark' : 'light'}&theme=${isDark ? 'dark' : 'light'}&trades=0&info=0&tabs=0`}
        />
      </div>
    </div>
  );
};

const TradePanel = ({ pair, quote, quoteLoading, onQuoteRefresh, onSwap, status, walletReady, onConnect, t, isRtl }) => {
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
        {t.selectTokenToTrade}
      </div>
    );
  }

  const inputSymbol = side === 'buy' ? 'SOL' : pair.baseToken.symbol;
  const outputSymbol = side === 'buy' ? pair.baseToken.symbol : 'SOL';
  const outputDecimals = side === 'buy' ? pair.baseToken.decimals ?? 6 : 9;
  const warning = (pair.liquidityUsd ?? 0) < 5000;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/50 bg-background">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className={cn('flex items-center gap-2', isRtl && 'flex-row-reverse')}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={side === 'buy' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSide('buy')}
                className="flex-1"
                title={t.buyHelp}
                aria-label={t.buyHelp}
              >
                {t.buy}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.buyHelp}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={side === 'sell' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSide('sell')}
                className="flex-1"
                title={t.sellHelp}
                aria-label={t.sellHelp}
              >
                {t.sell}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.sellHelp}</TooltipContent>
          </Tooltip>
        </div>

        <div className="space-y-2">
          <div className={cn('flex items-center gap-2 text-xs font-medium text-muted-foreground', isRtl && 'flex-row-reverse')}>
            <SolanaLogo className="h-4 w-4" />
            <span>{t.amountLabel} ({inputSymbol})</span>
            <HelpTooltip text={t.amountHelp} />
          </div>
          <Input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.0"
            type="number"
            title={t.amountHelp}
            aria-label={t.amountHelp}
          />
          <div className="grid grid-cols-5 gap-2">
            {['0.1', '0.5', '1', '2', '5'].map((value) => (
              <Tooltip key={value}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(value)}
                    title={t.amountChipHelp}
                    aria-label={t.amountChipHelp}
                    className="flex items-center justify-center gap-1"
                  >
                    <SolanaLogo className="h-3 w-3" />
                    {value}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.amountChipHelp}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className={cn('flex items-center justify-between text-xs', isRtl && 'flex-row-reverse')}>
            <div className={cn('flex items-center gap-2 text-muted-foreground', isRtl && 'flex-row-reverse')}>
              <span>{t.slippage}</span>
              <HelpTooltip text={t.slippageHelp} />
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant={slippageMode === 'auto' ? 'default' : 'outline'}
                    onClick={() => setSlippageMode('auto')}
                    title={t.slippageAutoHelp}
                    aria-label={t.slippageAutoHelp}
                  >
                    {t.slippageAuto}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.slippageAutoHelp}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant={slippageMode === 'custom' ? 'default' : 'outline'}
                    onClick={() => setSlippageMode('custom')}
                    title={t.slippageManualHelp}
                    aria-label={t.slippageManualHelp}
                  >
                    {t.slippageManual}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.slippageManualHelp}</TooltipContent>
              </Tooltip>
            </div>
          </div>
          {slippageMode === 'custom' ? (
            <Input
              value={manualSlippage}
              onChange={(event) => setManualSlippage(event.target.value)}
              type="number"
              placeholder="50"
              title={t.slippageManualHelp}
              aria-label={t.slippageManualHelp}
            />
          ) : null}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-xs">
          <div className={cn('flex items-center gap-2 text-muted-foreground', isRtl && 'flex-row-reverse')}>
            <span>{t.priorityFee}</span>
            <HelpTooltip text={t.priorityFeeHelp} />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={priorityFee ? 'default' : 'outline'}
                onClick={() => setPriorityFee(!priorityFee)}
                title={t.priorityFeeHelp}
                aria-label={t.priorityFeeHelp}
              >
                {priorityFee ? t.on : t.off}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.priorityFeeHelp}</TooltipContent>
          </Tooltip>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t.youGet}</span>
            <span className="font-semibold">
              {quoteLoading ? t.loadingQuote : quote?.outAmount ? `${formatTokenAmount(quote.outAmount, outputDecimals)} ${outputSymbol}` : '—'}
            </span>
          </div>
          {feeConfig.enabled ? (
            <div className="mt-1 text-[11px] text-muted-foreground">{t.feeLabel} {(feeConfig.bps / 100).toFixed(2)}%</div>
          ) : null}
          {warning ? (
            <div className="mt-2 text-[11px] text-amber-500">
              {t.lowLiquidityWarning}
            </div>
          ) : null}
        </div>

        <div className="flex-1" />
      </div>

      <div className="sticky bottom-0 space-y-3 border-t border-border/40 bg-background px-4 pb-4 pt-3">
        {!walletReady ? (
          <Button className="w-full" onClick={onConnect} title={t.connectWalletHelp} aria-label={t.connectWalletHelp}>
            {t.connectWallet}
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="w-full"
                onClick={() => onSwap({ side, amount, slippageMode, manualSlippage, priorityFee })}
                disabled={!amount || Number(amount) <= 0 || !quote}
                title={t.tradeCtaHelp}
                aria-label={t.tradeCtaHelp}
              >
                {side === 'buy' ? t.buy : t.sell} {pair.baseToken.symbol}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.tradeCtaHelp}</TooltipContent>
          </Tooltip>
        )}
        {status ? (
          <div className="rounded-lg border border-border/50 px-3 py-2 text-xs">
            <div>{t.statusLabel}: {status.state}</div>
            {status.signature ? (
              <a
                className="text-primary underline"
                href={`https://solscan.io/tx/${status.signature}`}
                target="_blank"
                rel="noreferrer"
              >
                {t.viewOnExplorer}
              </a>
            ) : null}
            {status.error ? <div className="text-rose-500">{status.error}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const MobileTradeBar = ({ pair, quote, quoteLoading, onQuoteRefresh, onSwap, walletReady, onConnect, t, isRtl }) => {
  const [side, setSide] = useState('buy');
  const [amount, setAmount] = useState('');
  const [slippageMode, setSlippageMode] = useState('auto');
  const [manualSlippage, setManualSlippage] = useState(DEFAULT_SLIPPAGE_BPS.toString());
  const [priorityFee, setPriorityFee] = useState(false);

  useEffect(() => {
    if (!pair) return;
    setAmount('');
  }, [pair]);

  useEffect(() => {
    onQuoteRefresh({ amount, side, slippageMode, manualSlippage, priorityFee });
  }, [amount, side, slippageMode, manualSlippage, priorityFee, onQuoteRefresh]);

  const inputSymbol = side === 'buy' ? 'SOL' : pair?.baseToken?.symbol || '—';
  const outputSymbol = side === 'buy' ? pair?.baseToken?.symbol || '—' : 'SOL';
  const outputDecimals = side === 'buy' ? pair?.baseToken?.decimals ?? 6 : 9;
  const ctaAmount = amount || '0';

  return (
    <div className="sticky bottom-0 z-20 mt-auto border-t border-border/40 bg-background/95 backdrop-blur-xl">
      <div className="flex flex-col gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
        <div className={cn('flex items-center gap-2', isRtl && 'flex-row-reverse')}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={side === 'buy' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSide('buy')}
                className="flex-1"
                title={t.buyHelp}
                aria-label={t.buyHelp}
              >
                {t.buy}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.buyHelp}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={side === 'sell' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSide('sell')}
                className="flex-1"
                title={t.sellHelp}
                aria-label={t.sellHelp}
              >
                {t.sell}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.sellHelp}</TooltipContent>
          </Tooltip>
        </div>

        <div className="space-y-2">
          <div className={cn('flex items-center gap-2 text-xs font-medium text-muted-foreground', isRtl && 'flex-row-reverse')}>
            <SolanaLogo className="h-4 w-4" />
            <span>{t.amountLabel} ({inputSymbol})</span>
            <HelpTooltip text={t.amountHelp} />
          </div>
          <Input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.0"
            type="number"
            title={t.amountHelp}
            aria-label={t.amountHelp}
          />
          <div className="grid grid-cols-5 gap-2">
            {['0.1', '0.5', '1', '2', '5'].map((value) => (
              <Tooltip key={value}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(value)}
                    title={t.amountChipHelp}
                    aria-label={t.amountChipHelp}
                    className="flex items-center justify-center gap-1"
                  >
                    <SolanaLogo className="h-3 w-3" />
                    {value}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.amountChipHelp}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t.youGet}</span>
          <span className="font-semibold text-foreground">
            {quoteLoading ? t.loadingQuote : quote?.outAmount ? `${formatTokenAmount(quote.outAmount, outputDecimals)} ${outputSymbol}` : '—'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1" title={t.advancedHelp} aria-label={t.advancedHelp}>
                {t.advanced}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="space-y-4">
              <div className={cn('flex items-center gap-2 text-sm', isRtl && 'flex-row-reverse text-right')}>
                <span className="font-semibold">{t.advanced}</span>
                <HelpTooltip text={t.advancedHelp} />
              </div>
              <div className="space-y-2">
                <div className={cn('flex items-center justify-between text-xs', isRtl && 'flex-row-reverse')}>
                  <div className={cn('flex items-center gap-2 text-muted-foreground', isRtl && 'flex-row-reverse')}>
                    <span>{t.slippage}</span>
                    <HelpTooltip text={t.slippageHelp} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={slippageMode === 'auto' ? 'default' : 'outline'}
                      onClick={() => setSlippageMode('auto')}
                      title={t.slippageAutoHelp}
                      aria-label={t.slippageAutoHelp}
                    >
                      {t.slippageAuto}
                    </Button>
                    <Button
                      size="sm"
                      variant={slippageMode === 'custom' ? 'default' : 'outline'}
                      onClick={() => setSlippageMode('custom')}
                      title={t.slippageManualHelp}
                      aria-label={t.slippageManualHelp}
                    >
                      {t.slippageManual}
                    </Button>
                  </div>
                </div>
                {slippageMode === 'custom' ? (
                  <Input
                    value={manualSlippage}
                    onChange={(event) => setManualSlippage(event.target.value)}
                    type="number"
                    placeholder="50"
                    title={t.slippageManualHelp}
                    aria-label={t.slippageManualHelp}
                  />
                ) : null}
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-xs">
                <div className={cn('flex items-center gap-2 text-muted-foreground', isRtl && 'flex-row-reverse')}>
                  <span>{t.priorityFee}</span>
                  <HelpTooltip text={t.priorityFeeHelp} />
                </div>
                <Button
                  size="sm"
                  variant={priorityFee ? 'default' : 'outline'}
                  onClick={() => setPriorityFee(!priorityFee)}
                  title={t.priorityFeeHelp}
                  aria-label={t.priorityFeeHelp}
                >
                  {priorityFee ? t.on : t.off}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          {!walletReady ? (
            <Button className="flex-1" onClick={onConnect} title={t.connectWalletHelp} aria-label={t.connectWalletHelp}>
              {t.connectWallet}
            </Button>
          ) : (
            <Button
              className="flex-1"
              onClick={() => onSwap({ side, amount, slippageMode, manualSlippage, priorityFee })}
              disabled={!amount || Number(amount) <= 0 || !quote || !pair}
              title={t.tradeCtaHelp}
              aria-label={t.tradeCtaHelp}
            >
              {side === 'buy' ? t.buy : t.sell} {ctaAmount} {inputSymbol}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function MemeCoins({ language = 'en' }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const t = tMemeCoins(language);
  const isRtl = language === 'ar';
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
    <TooltipProvider>
      <div className="flex h-[calc(100vh-64px)] min-h-0 flex-col gap-4 overflow-hidden px-4 pb-4 pt-2 text-foreground" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className={cn('flex flex-wrap items-center justify-between gap-2', isRtl && 'flex-row-reverse text-right')}>
          <div className="flex items-center gap-3">
            <SolanaLogo className="h-6 w-6" />
            <div>
              <h1 className="text-lg font-semibold">{t.pageTitle}</h1>
              <p className="text-xs text-muted-foreground">{t.pageSubtitle}</p>
            </div>
          </div>
          <div className={cn('flex items-center gap-2', isRtl && 'flex-row-reverse')}>
            {selectedToken ? (
              <Badge variant="secondary">{selectedToken.symbol}</Badge>
            ) : null}
            <Sheet open={tradeSheetOpen} onOpenChange={setTradeSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="md:inline-flex lg:hidden" title={t.tradePanelHelp} aria-label={t.tradePanelHelp}>
                  {t.trade}
                </Button>
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
                  t={t}
                  isRtl={isRtl}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="hidden min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)_360px] gap-4 lg:grid">
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
            t={t}
            isRtl={isRtl}
          />
          <ChartPanel pair={selectedPair} isLoading={pairQuery.isLoading} error={pairQuery.error} t={t} isRtl={isRtl} />
          <TradePanel
            pair={selectedPair}
            quote={quoteQuery.data}
            quoteLoading={quoteQuery.isFetching}
            onQuoteRefresh={handleQuoteRefresh}
            onSwap={handleSwap}
            status={swapStatus}
            walletReady={connected}
            onConnect={() => setVisible(true)}
            t={t}
            isRtl={isRtl}
          />
        </div>

        <div className="hidden min-h-0 flex-1 grid-cols-2 gap-4 md:grid lg:hidden">
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
            t={t}
            isRtl={isRtl}
          />
          <ChartPanel pair={selectedPair} isLoading={pairQuery.isLoading} error={pairQuery.error} t={t} isRtl={isRtl} />
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:hidden">
          <Tabs defaultValue="list" className="flex h-full min-h-0 flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="list">{t.listTab}</TabsTrigger>
              <TabsTrigger value="chart">{t.chartTab}</TabsTrigger>
              <TabsTrigger value="trade">{t.tradeTab}</TabsTrigger>
            </TabsList>
            <TabsContent value="list" className="mt-3 min-h-0 flex-1 overflow-hidden">
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
                t={t}
                isRtl={isRtl}
              />
            </TabsContent>
            <TabsContent value="chart" className="mt-3 min-h-0 flex-1 overflow-hidden">
              <div className="flex h-full min-h-0 flex-col gap-3">
                <div className="min-h-[60vh] flex-1">
                  <ChartPanel pair={selectedPair} isLoading={pairQuery.isLoading} error={pairQuery.error} t={t} isRtl={isRtl} />
                </div>
                <MobileTradeBar
                  pair={selectedPair}
                  quote={quoteQuery.data}
                  quoteLoading={quoteQuery.isFetching}
                  onQuoteRefresh={handleQuoteRefresh}
                  onSwap={handleSwap}
                  walletReady={connected}
                  onConnect={() => setVisible(true)}
                  t={t}
                  isRtl={isRtl}
                />
              </div>
            </TabsContent>
            <TabsContent value="trade" className="mt-3 min-h-0 flex-1 overflow-hidden">
              <TradePanel
                pair={selectedPair}
                quote={quoteQuery.data}
                quoteLoading={quoteQuery.isFetching}
                onQuoteRefresh={handleQuoteRefresh}
                onSwap={handleSwap}
                status={swapStatus}
                walletReady={connected}
                onConnect={() => setVisible(true)}
                t={t}
                isRtl={isRtl}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  );
}
