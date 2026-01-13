import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Check, Copy, Globe, Info, MessageCircle, Shield, Twitter } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import MemeChart from '@/components/meme/MemeChart';
import { cn } from '@/lib/utils';
import { tMemeCoins } from '@/lib/i18n/memecoins';
import solanaLogo from '@/assets/solana-logo.svg';
import solanaIcon from '/icons/solana.svg';
import {
  fetchPairById,
  fetchTokenProfile,
  fetchSearchTokens,
  fetchTokenPairs,
  fetchTrendingTokens,
  mapProfileDetailsToSummary,
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

const DEFAULT_SLIPPAGE_BPS = 50;
const useDebouncedValue = (value, delay = 400) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(handle);
  }, [value, delay]);

  return debounced;
};

const getFeeConfig = () => {
  const enabled = String(import.meta.env.NEXT_PUBLIC_NEXTTRADE_ENABLE_FEES || '').toLowerCase() === 'true';
  const bps = Number(import.meta.env.NEXT_PUBLIC_NEXTTRADE_SWAP_FEE_BPS || 0);
  const feeAccount = import.meta.env.NEXT_PUBLIC_NEXTTRADE_FEE_WALLET || '';
  if (!enabled || !bps || !feeAccount) {
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
      <div className={cn('mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground', isRtl && 'flex-row-reverse')}>
        <Badge variant="secondary" className="text-[9px]">{t.lpBurned}</Badge>
        <Badge variant="secondary" className="text-[9px]">{t.renouncedLabel}</Badge>
        <Badge variant="secondary" className="text-[9px]">{t.mintAuthorityLabel}</Badge>
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
    if (filters.maxAgeHours) {
      const maxAgeMs = filters.maxAgeHours * 60 * 60 * 1000;
      list = list.filter((token) => {
        if (!token.pairCreatedAt) return false;
        return Date.now() - token.pairCreatedAt <= maxAgeMs;
      });
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
      <div className="space-y-1">
        <div className={cn('flex items-center gap-2 text-[11px] text-muted-foreground', isRtl && 'flex-row-reverse')}>
          <span>{t.maxAgeShort}</span>
          <HelpTooltip text={t.maxAgeHelp} />
        </div>
        <Select
          value={String(filters.maxAgeHours)}
          onValueChange={(value) => onFiltersChange({ ...filters, maxAgeHours: Number(value) })}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <SelectTrigger className="h-8" title={t.maxAgeHelp}>
                <SelectValue placeholder={t.maxAgeShort} />
              </SelectTrigger>
            </TooltipTrigger>
            <TooltipContent>{t.maxAgeHelp}</TooltipContent>
          </Tooltip>
          <SelectContent>
            <SelectItem value="0">{t.maxAgeShort}</SelectItem>
            <SelectItem value="1">1h</SelectItem>
            <SelectItem value="6">6h</SelectItem>
            <SelectItem value="24">24h</SelectItem>
            <SelectItem value="168">7d</SelectItem>
          </SelectContent>
        </Select>
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

const ChartPanel = ({ pair, poolAddress, isLoading, error, t, isRtl, compact = false }) => {
  const [copied, setCopied] = useState('');

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

  const handleCopy = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied(''), 1500);
    } catch {
      setCopied('');
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div className="rounded-xl border border-border/50 bg-background px-3 py-3 md:px-4">
        <div className={cn('flex flex-wrap items-start justify-between gap-3', isRtl && 'flex-row-reverse text-right')}>
          <div>
            <div className="text-base font-semibold">{pair.baseToken.name} ({pair.baseToken.symbol})</div>
            <div className="text-xs text-muted-foreground">{pair.baseToken.symbol} / {pair.quoteToken.symbol}</div>
          </div>
          <div className={cn('text-right', isRtl && 'text-left')}>
            <div className="text-base font-semibold">{formatPrice(pair.priceUsd)}</div>
            <div className={cn('text-xs font-medium', isPositive ? 'text-emerald-500' : 'text-rose-500')}>
              {formatPercent(change)}
            </div>
          </div>
        </div>
        <div className={cn('mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground md:grid-cols-4', isRtl && 'text-right')}>
          <span>{t.marketCapShort}: ${formatCompactNumber(pair.marketCap)}</span>
          <span>{t.liquidityShort}: ${formatCompactNumber(pair.liquidityUsd)}</span>
          <span>{t.volumeShort}: ${formatCompactNumber(pair.volume24h)}</span>
          <span>{t.ageShort}: {formatAge(pair.pairCreatedAt)}</span>
        </div>
        {!compact ? (
          <>
            <div className={cn('mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground', isRtl && 'flex-row-reverse text-right')}>
              <span>{t.mintLabel}:</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-2 px-2 text-[11px]"
                    onClick={() => handleCopy(pair.baseToken.address)}
                    title={t.copyMintHelp}
                    aria-label={t.copyMintHelp}
                  >
                    <Copy className="h-3 w-3" />
                    {copied === pair.baseToken.address ? t.copied : t.copy}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.copyMintHelp}</TooltipContent>
              </Tooltip>
              <span className="truncate max-w-[180px]">{pair.baseToken.address}</span>
            </div>
            <div className={cn('mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground', isRtl && 'flex-row-reverse text-right')}>
              <span>{t.poolLabel}:</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-2 px-2 text-[11px]"
                    onClick={() => handleCopy(poolAddress)}
                    title={t.copyPoolHelp}
                    aria-label={t.copyPoolHelp}
                    disabled={!poolAddress}
                  >
                    <Copy className="h-3 w-3" />
                    {copied === poolAddress ? t.copied : t.copy}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.copyPoolHelp}</TooltipContent>
              </Tooltip>
              <span className="truncate max-w-[180px]">{poolAddress || t.notProvided}</span>
            </div>
          </>
        ) : null}
      </div>
      <div className="flex-1 min-h-0">
        <MemeChart
          poolAddress={poolAddress}
          t={t}
          isRtl={isRtl}
        />
      </div>
    </div>
  );
};

const TokenInfoPanel = ({ pair, profile, t, isRtl }) => {
  const [copied, setCopied] = useState(false);

  if (!pair) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-border/50 bg-background p-4 text-sm text-muted-foreground">
        {t.selectTokenToOpenTerminal}
      </div>
    );
  }

  const socials = [...(profile?.socials || []), ...(pair.info?.socials || [])];
  const websites = [...(profile?.websites || []), ...(pair.info?.websites || [])];
  const links = [
    ...websites.map((item) => ({ ...item, type: item?.type || 'website' })),
    ...socials,
  ].filter((item) => item?.url);

  const handleCopy = async () => {
    if (!pair?.baseToken?.address) return;
    try {
      await navigator.clipboard.writeText(pair.baseToken.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const iconForType = (type = '') => {
    switch (type.toLowerCase()) {
      case 'twitter':
      case 'x':
        return <Twitter className="h-4 w-4" />;
      case 'telegram':
        return <MessageCircle className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/50 bg-background">
      <div className="border-b border-border/50 px-4 py-3 text-sm font-semibold">{t.tokenInfoTitle}</div>
      <Tabs defaultValue="overview" className="flex h-full min-h-0 flex-col">
        <TabsList className="grid grid-cols-4">
          <TabsTrigger value="overview">{t.overviewTab}</TabsTrigger>
          <TabsTrigger value="socials">{t.socialsTab}</TabsTrigger>
          <TabsTrigger value="safety">{t.safetyTab}</TabsTrigger>
          <TabsTrigger value="holders">{t.holdersTab}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className={cn('grid gap-3 text-sm text-muted-foreground md:grid-cols-2', isRtl && 'text-right')}>
            <div>{t.marketCapShort}: ${formatCompactNumber(pair.marketCap)}</div>
            <div>{t.liquidityShort}: ${formatCompactNumber(pair.liquidityUsd)}</div>
            <div>{t.volumeShort}: ${formatCompactNumber(pair.volume24h)}</div>
            <div>{t.fdvLabel}: {pair.marketCap ? `$${formatCompactNumber(pair.marketCap)}` : t.comingSoon}</div>
            <div>{t.txnsLabel}: {pair.txns24h ? `${pair.txns24h.buys}/${pair.txns24h.sells}` : t.comingSoon}</div>
            <div>{t.pairAgeLabel}: {formatAge(pair.pairCreatedAt)}</div>
            <div>{t.dexLabel}: {pair.dexId || t.comingSoon}</div>
          </div>
          <div className={cn('mt-4 flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-xs', isRtl && 'flex-row-reverse')}>
            <div className="truncate text-muted-foreground">{t.contractLabel}: {pair.baseToken.address}</div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  title={t.copyAddressHelp}
                  aria-label={t.copyAddressHelp}
                  className="gap-1"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t.copied : t.copy}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.copyAddressHelp}</TooltipContent>
            </Tooltip>
          </div>
        </TabsContent>
        <TabsContent value="socials" className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {links.length ? (
            <div className="flex flex-col gap-2">
              {links.map((link, index) => (
                <a
                  key={`${link.url}-${index}`}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    'flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted/20',
                    isRtl && 'flex-row-reverse text-right'
                  )}
                >
                  <span className="flex items-center gap-2">
                    {iconForType(link.type)}
                    {link.label || link.type || t.website}
                  </span>
                  <span className="text-xs">{t.openLink}</span>
                </a>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">{t.notProvided}</div>
          )}
        </TabsContent>
        <TabsContent value="safety" className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className={cn('flex items-start gap-3 text-sm text-muted-foreground', isRtl && 'flex-row-reverse text-right')}>
            <Shield className="mt-0.5 h-4 w-4 text-amber-400" />
            <div className="space-y-2">
              <p className="font-medium text-foreground">{t.safetyTitle}</p>
              <p className="text-xs">{t.safetyNote}</p>
              <div className="grid gap-2 text-xs">
                <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                  <span>{t.renouncedLabel}</span>
                  <span className="text-muted-foreground">{t.comingSoon}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                  <span>{t.mintAuthorityLabel}</span>
                  <span className="text-muted-foreground">{t.comingSoon}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                  <span>{t.freezeAuthorityLabel}</span>
                  <span className="text-muted-foreground">{t.comingSoon}</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="holders" className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="text-sm text-muted-foreground">{t.holdersHelp}</p>
          <a
            href={`https://solscan.io/token/${pair.baseToken.address}#holders`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center rounded-lg border border-border/50 px-3 py-2 text-sm text-primary hover:bg-muted/20"
          >
            {t.viewHolders}
          </a>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const TradePanel = ({ pair, onPreview, walletReady, onConnect, maxAmount, t, isRtl }) => {
  const [side, setSide] = useState('buy');
  const [amount, setAmount] = useState('');
  const [slippageMode, setSlippageMode] = useState('auto');
  const [manualSlippage, setManualSlippage] = useState(DEFAULT_SLIPPAGE_BPS.toString());
  const [priorityFee, setPriorityFee] = useState(false);

  useEffect(() => {
    if (!pair) return;
    setAmount('');
  }, [pair]);

  if (!pair) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-sm text-muted-foreground">
        {t.selectTokenToTrade}
      </div>
    );
  }

  const inputSymbol = side === 'buy' ? 'SOL' : pair.baseToken.symbol;
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
            <img src={solanaIcon} alt="" className="h-4 w-4" />
            <span>{t.amountLabel} ({inputSymbol})</span>
            <HelpTooltip text={t.amountHelp} />
          </div>
          <div className="relative">
            <Input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.0"
              type="number"
              title={t.amountHelp}
              aria-label={t.amountHelp}
              className="pr-16"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => maxAmount && setAmount(maxAmount)}
                  title={t.maxHelp}
                  aria-label={t.maxHelp}
                  className="absolute right-2 top-1/2 h-7 -translate-y-1/2 px-2 text-[11px]"
                  disabled={!maxAmount}
                >
                  {t.max}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.maxHelp}</TooltipContent>
            </Tooltip>
          </div>
          {maxAmount ? (
            <div className="text-[11px] text-muted-foreground">
              {t.balanceLabel}: {maxAmount} {t.solSymbol}
            </div>
          ) : null}
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
                    <img src={solanaIcon} alt="" className="h-3 w-3" />
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
            <span className="flex items-center gap-2 text-muted-foreground">
              {t.youGet}
              <HelpTooltip text={t.youGetHelp} />
            </span>
            <span className="font-semibold">{t.estimatePlaceholder}</span>
          </div>
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
                onClick={() => onPreview({ side, amount, slippageMode, manualSlippage, priorityFee })}
                disabled={!amount || Number(amount) <= 0}
                title={t.tradeCtaHelp}
                aria-label={t.tradeCtaHelp}
              >
                {t.previewTrade}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.tradeCtaHelp}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

const MobileTradeBar = ({ pair, onPreview, walletReady, onConnect, maxAmount, t, isRtl }) => {
  const [side, setSide] = useState('buy');
  const [amount, setAmount] = useState('');
  const [slippageMode, setSlippageMode] = useState('auto');
  const [manualSlippage, setManualSlippage] = useState(DEFAULT_SLIPPAGE_BPS.toString());
  const [priorityFee, setPriorityFee] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (!pair) return;
    setAmount('');
  }, [pair]);

  const inputSymbol = side === 'buy' ? 'SOL' : pair?.baseToken?.symbol || '—';
  const ctaAmount = amount || '0';

  return (
    <div className="flex flex-col gap-4">
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
          <img src={solanaIcon} alt="" className="h-4 w-4" />
          <span>{t.amountLabel} ({inputSymbol})</span>
          <HelpTooltip text={t.amountHelp} />
        </div>
        <div className="relative">
          <Input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.0"
            type="number"
            title={t.amountHelp}
            aria-label={t.amountHelp}
            className="pr-16"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => maxAmount && setAmount(maxAmount)}
                title={t.maxHelp}
                aria-label={t.maxHelp}
                className="absolute right-2 top-1/2 h-7 -translate-y-1/2 px-2 text-[11px]"
                disabled={!maxAmount}
              >
                {t.max}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.maxHelp}</TooltipContent>
          </Tooltip>
        </div>
        {maxAmount ? (
          <div className="text-[11px] text-muted-foreground">
            {t.balanceLabel}: {maxAmount} {t.solSymbol}
          </div>
        ) : null}
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
                  <img src={solanaIcon} alt="" className="h-3 w-3" />
                  {value}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.amountChipHelp}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          {t.youGet}
          <HelpTooltip text={t.youGetHelp} />
        </span>
        <span className="font-semibold text-foreground">{t.estimatePlaceholder}</span>
      </div>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="flex-1" title={t.advancedHelp} aria-label={t.advancedHelp}>
            {t.advanced}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-3">
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
        </CollapsibleContent>
      </Collapsible>

      <div className="sticky bottom-0 z-20 mt-auto border-t border-border/40 bg-background/95 backdrop-blur-xl">
        <div className="flex items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSide(side === 'buy' ? 'sell' : 'buy')}
                title={t.switchSideHelp}
                aria-label={t.switchSideHelp}
                className="w-24"
              >
                {t.switchSide}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.switchSideHelp}</TooltipContent>
          </Tooltip>
          {!walletReady ? (
            <Button className="flex-1" onClick={onConnect} title={t.connectWalletHelp} aria-label={t.connectWalletHelp}>
              {t.connectWallet}
            </Button>
          ) : (
            <Button
              className="flex-1"
              onClick={() => onPreview({ side, amount, slippageMode, manualSlippage, priorityFee })}
              disabled={!amount || Number(amount) <= 0 || !pair}
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
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const t = tMemeCoins(language);
  const isRtl = language === 'ar';
  const [mode, setMode] = useState('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('trending');
  const [filters, setFilters] = useState({ minLiquidity: 0, minVolume: 0, maxAgeHours: 0 });
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedPairId, setSelectedPairId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTrade, setPendingTrade] = useState(null);
  const [watchlist, setWatchlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('meme_watchlist') || '[]');
    } catch {
      return [];
    }
  });

  const debouncedSearch = useDebouncedValue(searchQuery, 400);
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
    staleTime: 25000,
    refetchInterval: 25000,
  });

  const searchQueryResult = useQuery({
    queryKey: ['memeTokensSearch', debouncedSearch],
    queryFn: ({ signal }) => fetchSearchTokens(debouncedSearch, signal),
    enabled: debouncedSearch.length > 1,
    staleTime: 20000,
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

  const profileQuery = useQuery({
    queryKey: ['tokenProfile', selectedPair?.baseToken?.address],
    queryFn: ({ signal }) => fetchTokenProfile(selectedPair?.baseToken?.address, signal),
    enabled: Boolean(selectedPair?.baseToken?.address),
    staleTime: 600000,
  });

  const profileSummary = profileQuery.data ? mapProfileDetailsToSummary(profileQuery.data) : null;

  const balanceQuery = useQuery({
    queryKey: ['solBalance', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return null;
      const balance = await connection.getBalance(publicKey);
      return balance;
    },
    enabled: Boolean(publicKey),
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const maxAmount = balanceQuery.data ? formatTokenAmount(balanceQuery.data, 9) : '';

  useEffect(() => {
    if (selectedPair?.baseToken?.address) {
      setSelectedAddress(selectedPair.baseToken.address);
    }
  }, [selectedPair]);

  const handleSelectToken = (token) => {
    setSelectedAddress(token.address);
    setSelectedPairId(token.pairAddress || '');
    setPendingTrade(null);
  };

  const handleToggleWatchlist = (address) => {
    setWatchlist((prev) =>
      prev.includes(address) ? prev.filter((item) => item !== address) : [...prev, address]
    );
  };

  const handleSwap = (params) => {
    if (!selectedPair) return;
    setPendingTrade(params);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    toast.message(t.executionSoonTitle, { description: t.executionSoonDetail });
    setConfirmOpen(false);
  };

  const listError = trendingQuery.error || searchQueryResult.error;
  const chartPoolAddress = selectedPair?.pairAddress || selectedPair?.baseToken?.address || '';
  const confirmSide = pendingTrade?.side;
  const confirmAmount = pendingTrade?.amount;
  const confirmInputSymbol = confirmSide === 'buy' ? 'SOL' : selectedPair?.baseToken?.symbol || '—';
  const confirmOutAmount = t.estimatePlaceholder;
  const confirmSlippage = pendingTrade
    ? `${pendingTrade.slippageMode === 'custom' ? pendingTrade.manualSlippage : DEFAULT_SLIPPAGE_BPS} bps`
    : t.estimatePlaceholder;
  const feePercent = feeConfig.enabled ? (feeConfig.bps / 100).toFixed(2) : null;

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100dvh-64px)] min-h-0 flex-col gap-4 overflow-hidden overflow-x-hidden px-4 pb-4 pt-2 text-foreground" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className={cn('flex flex-wrap items-center justify-between gap-2', isRtl && 'flex-row-reverse text-right')}>
          <div className="flex items-center gap-3">
            <img src={solanaLogo} alt={t.solana} className="h-6 w-6" />
            <div>
              <h1 className="text-lg font-semibold">{t.pageTitle}</h1>
              <p className="text-xs text-muted-foreground">{t.pageSubtitle}</p>
            </div>
          </div>
          <div className={cn('flex items-center gap-2', isRtl && 'flex-row-reverse')}>
            {selectedToken ? (
              <Badge variant="secondary">{selectedToken.symbol}</Badge>
            ) : null}
          </div>
        </div>

        <div className="hidden min-h-0 min-w-0 flex-1 grid-cols-[340px_minmax(0,1fr)_360px] gap-4 lg:grid">
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
          <div className="flex min-h-0 flex-col gap-4">
            <div className="flex-1 min-h-0">
              <ChartPanel
                pair={selectedPair}
                poolAddress={chartPoolAddress}
                isLoading={pairQuery.isLoading}
                error={pairQuery.error}
                t={t}
                isRtl={isRtl}
              />
            </div>
            <div className="h-[280px] min-h-[240px]">
              <TokenInfoPanel pair={selectedPair} profile={profileSummary} t={t} isRtl={isRtl} />
            </div>
          </div>
          <TradePanel
            pair={selectedPair}
            onPreview={handleSwap}
            walletReady={connected}
            onConnect={() => setVisible(true)}
            maxAmount={maxAmount}
            t={t}
            isRtl={isRtl}
          />
        </div>

        <div className="hidden min-h-0 min-w-0 flex-1 grid-cols-2 gap-4 md:grid lg:hidden">
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
          <div className="flex min-h-0 flex-col gap-4">
            <div className="flex-1 min-h-0">
              <ChartPanel
                pair={selectedPair}
                poolAddress={chartPoolAddress}
                isLoading={pairQuery.isLoading}
                error={pairQuery.error}
                t={t}
                isRtl={isRtl}
              />
            </div>
            <div className="h-[240px] min-h-[220px]">
              <TokenInfoPanel pair={selectedPair} profile={profileSummary} t={t} isRtl={isRtl} />
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:hidden">
          <Tabs defaultValue="list" className="flex h-full min-h-0 flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list">{t.listTab}</TabsTrigger>
              <TabsTrigger value="chart">{t.chartTab}</TabsTrigger>
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
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-4">
                  <div className="min-h-[60vh]">
                    <ChartPanel
                      pair={selectedPair}
                      poolAddress={chartPoolAddress}
                      isLoading={pairQuery.isLoading}
                      error={pairQuery.error}
                      t={t}
                      isRtl={isRtl}
                      compact
                    />
                  </div>
                  <MobileTradeBar
                    pair={selectedPair}
                    onPreview={handleSwap}
                    walletReady={connected}
                    onConnect={() => setVisible(true)}
                    maxAmount={maxAmount}
                    t={t}
                    isRtl={isRtl}
                  />
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
                        {t.tokenInfoTitle}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3">
                      <TokenInfoPanel pair={selectedPair} profile={profileSummary} t={t} isRtl={isRtl} />
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.confirmTradeTitle}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t.confirmSide}</span>
                <span className="font-semibold">{confirmSide === 'sell' ? t.sell : t.buy}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t.amountLabel}</span>
                <span className="font-semibold">{confirmAmount || '0'} {confirmInputSymbol}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t.youGet}</span>
                <span className="font-semibold">{confirmOutAmount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t.slippage}</span>
                <span className="font-semibold">{confirmSlippage}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t.feeLabel}</span>
                <span className="font-semibold">{feePercent ? `${feePercent}%` : t.estimatePlaceholder}</span>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground">
                {t.executionSoonDetail}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={handleConfirm} disabled={!confirmAmount}>
                {t.confirmTradeCta}
              </Button>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                {t.close}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
