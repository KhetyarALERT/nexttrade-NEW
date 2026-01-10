import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { 
  ArrowUpDown, TrendingUp, TrendingDown, Search, Loader2, 
  ExternalLink, RefreshCw, Globe, Link2, Send, ShieldCheck, Clock, Users
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';

import * as jupiterApi from '@/api/jupiter';
import { fetchTrendingSolanaTokens } from '@/api/dexscreener';
import { useIsMobile } from '@/hooks/use-mobile';
import { tMemeCoins } from '@/lib/i18n/memecoins';

// Constants
const SLIPPAGE_OPTIONS = [0.5, 1, 2, 5];

// Simple cache
const cache = new Map();
const CACHE_TTL = 30000;

const SOL_MINT = jupiterApi.TOKENS.SOL;
const SOL_DECIMALS = 9;

function SolanaMark({ className }) {
  return (
    <svg
      viewBox="0 0 397 311"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="solg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00FFA3" />
          <stop offset="1" stopColor="#DC1FFF" />
        </linearGradient>
      </defs>
      <path
        d="M64.6 236.9c2.5-2.5 5.9-3.9 9.5-3.9h306.3c6 0 9 7.3 4.7 11.6l-60.4 60.4c-2.5 2.5-5.9 3.9-9.5 3.9H8.9c-6 0-9-7.3-4.7-11.6l60.4-60.4z"
        fill="url(#solg)"
      />
      <path
        d="M64.6 3.9C67.1 1.4 70.5 0 74.1 0h306.3c6 0 9 7.3 4.7 11.6L324.7 72c-2.5 2.5-5.9 3.9-9.5 3.9H8.9c-6 0-9-7.3-4.7-11.6L64.6 3.9z"
        fill="url(#solg)"
      />
      <path
        d="M332.4 120.4c-2.5-2.5-5.9-3.9-9.5-3.9H16.6c-6 0-9 7.3-4.7 11.6l60.4 60.4c2.5 2.5 5.9 3.9 9.5 3.9h306.3c6 0 9-7.3 4.7-11.6l-60.4-60.4z"
        fill="url(#solg)"
      />
    </svg>
  );
}

function formatAgeMs(ms) {
  if (!ms || !Number.isFinite(ms)) return '—';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

export default function MemeCoinsTerminal({ language = 'en' }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const isMobile = useIsMobile();
  const t = tMemeCoins(language);
  
  // State
  const [tokens, setTokens] = useState([]);
  const [filteredTokens, setFilteredTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'volume24h', direction: 'desc' });
  const [timeframe, setTimeframe] = useState('24h');
  const [mobilePreset, setMobilePreset] = useState('hot');
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    minLiquidity: '',
    minMarketCap: '',
    minVolume: '',
    maxAgeHours: '',
    onlyGreen: false,
    onlyWithImage: false,
    onlyWithSocials: false,
    onlyLpSecured: false,
  });

  // Best-effort enrichment (may be blocked by some networks)
  const [rugcheckStatus, setRugcheckStatus] = useState({});
  const [holdersByMint, setHoldersByMint] = useState({});
  
  // Swap state
  const [swapMode, setSwapMode] = useState('buy');
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [slippage, setSlippage] = useState(1);
  const [customSlippage, setCustomSlippage] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(null);
  const [quoteSource, setQuoteSource] = useState('');

  // Mint decimals cache (needed for correct raw amounts in Jupiter)
  const mintDecimalsCacheRef = useRef(new Map());

  const getMintDecimals = useCallback(async (mint) => {
    if (!mint) return SOL_DECIMALS;
    if (mint === SOL_MINT) return SOL_DECIMALS;

    const cached = mintDecimalsCacheRef.current.get(mint);
    if (typeof cached === 'number') return cached;

    try {
      const info = await connection.getParsedAccountInfo(new PublicKey(mint));
      const data = info?.value?.data;
      const parsed = data && typeof data === 'object' && 'parsed' in data ? data.parsed : null;
      const decimals = parsed?.info?.decimals;
      if (typeof decimals === 'number' && Number.isFinite(decimals)) {
        mintDecimalsCacheRef.current.set(mint, decimals);
        return decimals;
      }
    } catch {
      // ignore
    }

    // Safe-ish default for most SPL meme coins
    mintDecimalsCacheRef.current.set(mint, 9);
    return 9;
  }, [connection]);

  // Format address
  const formatAddress = useCallback((address) => {
    if (!address) return '';
    const str = address.toString();
    return str.slice(0, 4) + '...' + str.slice(-4);
  }, []);

  // Fetch tokens from DexScreener
  const fetchTokens = useCallback(async () => {
    const cacheKey = 'meme_tokens';
    const cached = getCached(cacheKey);
    if (cached && cached.length > 0) {
      setTokens(cached);
      setFilteredTokens(cached);
      setLoading(false);
      return;
    }

    try {
      console.log('[MemeCoins] Fetching tokens...');

      const trending = await fetchTrendingSolanaTokens(50);

      // Normalize to the shape this page expects
      const formatted = (trending || [])
        .map((t) => ({
          address: t.mint || '',
          pairAddress: t.pairAddress || t.id || '',
          symbol: t.symbol || 'UNKNOWN',
          name: t.name || 'Unknown Token',
          price: toNumber(t.price),
          priceNative: toNumber(t.priceNative),
          change24h: toNumber(t.priceChange24h),
          change1h: toNumber(t.priceChange1h),
          change5m: toNumber(t.priceChange5m),
          change6h: toNumber(t.priceChange6h),
          volume24h: toNumber(t.volume24h),
          volume6h: toNumber(t.volume6h),
          volume1h: toNumber(t.volume1h),
          volume5m: toNumber(t.volume5m),
          liquidity: toNumber(t.liquidity),
          marketCap: toNumber(t.marketCap),
          txns24h: t.txns24h || { buys: 0, sells: 0 },
          txns1h: t.txns1h || { buys: 0, sells: 0 },
          txns5m: t.txns5m || { buys: 0, sells: 0 },
          imageUrl: t.imageUrl || null,
          websites: Array.isArray(t.websites) ? t.websites : [],
          socials: Array.isArray(t.socials) ? t.socials : [],
          dexUrl: t.dexUrl || null,
          pairCreatedAt: t.pairCreatedAt || null,
        }))
        .filter((t) => t.address && t.symbol !== 'UNKNOWN')
        .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));

      console.log('[MemeCoins] Tokens loaded:', formatted.length);

      if (formatted.length > 0) {
        setCache(cacheKey, formatted);
      }

      setTokens(formatted);
      setFilteredTokens(formatted);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('[MemeCoins] Failed to fetch:', error);
      toast.error('Failed to load meme coins');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    cache.delete('meme_tokens');
    fetchTokens();
  }, [fetchTokens]);

  // Filter tokens when search changes
  const getVolumeKey = useCallback((tf) => {
    switch (tf) {
      case '5m':
        return 'volume5m';
      case '1h':
        return 'volume1h';
      case '6h':
        return 'volume6h';
      default:
        return 'volume24h';
    }
  }, []);

  const getChangeKey = useCallback((tf) => {
    switch (tf) {
      case '5m':
        return 'change5m';
      case '1h':
        return 'change1h';
      case '6h':
        return 'change6h';
      default:
        return 'change24h';
    }
  }, []);

  const getTokenChange = useCallback((token) => {
    const key = getChangeKey(timeframe);
    return toNumber(token?.[key]);
  }, [getChangeKey, timeframe]);

  const getTokenVolume = useCallback((token) => {
    const key = getVolumeKey(timeframe);
    return toNumber(token?.[key]);
  }, [getVolumeKey, timeframe]);

  const strengthScale = useMemo(() => {
    const vols = (filteredTokens || []).map((t) => Math.log10(Math.max(1, getTokenVolume(t) || 0)));
    const liqs = (filteredTokens || []).map((t) => Math.log10(Math.max(1, toNumber(t?.liquidity) || 0)));
    const minLogVol = vols.length ? Math.min(...vols) : 0;
    const maxLogVol = vols.length ? Math.max(...vols) : 1;
    const minLogLiq = liqs.length ? Math.min(...liqs) : 0;
    const maxLogLiq = liqs.length ? Math.max(...liqs) : 1;
    return { minLogVol, maxLogVol, minLogLiq, maxLogLiq };
  }, [filteredTokens, getTokenVolume]);

  const getTrendStrength = useCallback(
    (token) => {
      const clamp01 = (v) => Math.max(0, Math.min(1, v));
      const vol = Math.log10(Math.max(1, getTokenVolume(token) || 0));
      const liq = Math.log10(Math.max(1, toNumber(token?.liquidity) || 0));
      const change = toNumber(getTokenChange(token));

      const volN = clamp01((vol - strengthScale.minLogVol) / Math.max(1e-6, strengthScale.maxLogVol - strengthScale.minLogVol));
      const liqN = clamp01((liq - strengthScale.minLogLiq) / Math.max(1e-6, strengthScale.maxLogLiq - strengthScale.minLogLiq));
      // Map -20%..+20% into 0..1
      const changeN = clamp01((change + 20) / 40);

      return 0.6 * volN + 0.25 * changeN + 0.15 * liqN;
    },
    [getTokenChange, getTokenVolume, strengthScale]
  );

  const hasSocials = useCallback((token) => {
    const socials = Array.isArray(token?.socials) ? token.socials : [];
    const websites = Array.isArray(token?.websites) ? token.websites : [];
    return socials.length > 0 || websites.length > 0;
  }, []);

  const countActiveFilters = useCallback(() => {
    const n = (v) => (String(v || '').trim() ? 1 : 0);
    return (
      n(filters.minLiquidity) +
      n(filters.minMarketCap) +
      n(filters.minVolume) +
      n(filters.maxAgeHours) +
      (filters.onlyGreen ? 1 : 0) +
      (filters.onlyWithImage ? 1 : 0) +
      (filters.onlyWithSocials ? 1 : 0) +
      (filters.onlyLpSecured ? 1 : 0)
    );
  }, [filters]);

  const resetFilters = useCallback(() => {
    setFilters({
      minLiquidity: '',
      minMarketCap: '',
      minVolume: '',
      maxAgeHours: '',
      onlyGreen: false,
      onlyWithImage: false,
      onlyWithSocials: false,
      onlyLpSecured: false,
    });
  }, []);

  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    const base = query
      ? tokens.filter((token) => token.symbol?.toLowerCase().includes(query) || token.name?.toLowerCase().includes(query))
      : tokens;

    // Hard filters
    const minLiquidity = toNumber(filters.minLiquidity);
    const minMarketCap = toNumber(filters.minMarketCap);
    const minVolume = toNumber(filters.minVolume);
    const maxAgeHours = toNumber(filters.maxAgeHours);

    const filtered = base.filter((token) => {
      if (minLiquidity > 0 && toNumber(token.liquidity) < minLiquidity) return false;
      if (minMarketCap > 0 && toNumber(token.marketCap) < minMarketCap) return false;
      if (minVolume > 0 && getTokenVolume(token) < minVolume) return false;
      if (filters.onlyWithImage && !token.imageUrl) return false;
      if (filters.onlyGreen && getTokenChange(token) <= 0) return false;
      if (filters.onlyWithSocials && !hasSocials(token)) return false;
      if (filters.onlyLpSecured && rugcheckStatus[token.address]?.lpSecured !== true) return false;

      if (maxAgeHours > 0) {
        const created = Number(token.pairCreatedAt || 0);
        if (!created) return false;
        const ageHours = (Date.now() - created) / 36e5;
        if (!Number.isFinite(ageHours) || ageHours > maxAgeHours) return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const key = sortConfig.key;

      if (key === 'pairCreatedAt') {
        const aVal = Number(a.pairCreatedAt || 0);
        const bVal = Number(b.pairCreatedAt || 0);
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aVal = toNumber(a[key]);
      const bVal = toNumber(b[key]);
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    setFilteredTokens(sorted);
  }, [filters, getTokenChange, getTokenVolume, hasSocials, rugcheckStatus, searchQuery, sortConfig, tokens]);

  // Sort tokens
  const handleSort = useCallback((key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc';
    setSortConfig({ key, direction });
  }, [sortConfig.key, sortConfig.direction]);

  const applyMobilePreset = useCallback(
    (preset) => {
      setMobilePreset(preset);
      if (preset === 'new') {
        setSortConfig({ key: 'pairCreatedAt', direction: 'desc' });
        return;
      }
      if (preset === 'mc') {
        setSortConfig({ key: 'marketCap', direction: 'desc' });
        return;
      }
      if (preset === 'liq') {
        setSortConfig({ key: 'liquidity', direction: 'desc' });
        return;
      }
      // hot
      setSortConfig({ key: getVolumeKey(timeframe), direction: 'desc' });
    },
    [getVolumeKey, timeframe]
  );

  useEffect(() => {
    // Keep preset sort aligned when timeframe changes.
    if (mobilePreset === 'hot') {
      setSortConfig({ key: getVolumeKey(timeframe), direction: 'desc' });
    }
  }, [getVolumeKey, mobilePreset, timeframe]);

  const switchSwapMode = useCallback((mode) => {
    setSwapMode(mode);
    setInputAmount('');
    setOutputAmount('');
    setCurrentQuote(null);
    setQuoteSource('');
  }, []);

  // Select token
  const selectToken = useCallback((token) => {
    setSelectedToken(token);
    setInputAmount('');
    setOutputAmount('');
    setCurrentQuote(null);
    setQuoteSource('');
  }, []);

  const getDexScreenerEmbedUrl = useCallback((token) => {
    if (!token?.pairAddress) return null;
    const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    return `https://dexscreener.com/solana/${token.pairAddress}?embed=1&theme=${theme}&trades=0&info=0`;
  }, []);

  const fetchRugcheckForMint = useCallback(
    async (mint) => {
      if (!mint) return;
      const existing = rugcheckStatus[mint];
      if (existing?.status === 'ok' || existing?.status === 'loading') return;

      setRugcheckStatus((prev) => ({ ...prev, [mint]: { status: 'loading' } }));

      const endpoints = [
        `https://api.rugcheck.xyz/v1/tokens/${mint}/report`,
        `https://api.rugcheck.xyz/v1/tokens/${mint}/summary`,
      ];

      const pickNumber = (...vals) => {
        for (const v of vals) {
          const n = Number(v);
          if (Number.isFinite(n)) return n;
        }
        return null;
      };

      try {
        let data = null;
        for (const url of endpoints) {
          try {
            const res = await fetch(url, { headers: { Accept: 'application/json' } });
            if (!res.ok) continue;
            data = await res.json();
            if (data) break;
          } catch {
            // try next
          }
        }

        if (!data) {
          setRugcheckStatus((prev) => ({ ...prev, [mint]: { status: 'error' } }));
          return;
        }

        const lockedPct = pickNumber(
          data?.lpLockedPct,
          data?.lp_locked_pct,
          data?.liquidity?.lpLockedPct,
          data?.liquidity?.lockedPct,
          data?.token?.lpLockedPct,
          data?.token?.lockedPct,
          data?.report?.lpLockedPct,
        );
        const burnedPct = pickNumber(
          data?.lpBurnedPct,
          data?.lp_burned_pct,
          data?.liquidity?.lpBurnedPct,
          data?.liquidity?.burnedPct,
          data?.token?.lpBurnedPct,
          data?.token?.burnedPct,
          data?.report?.lpBurnedPct,
        );

        const securedPct = (Number(lockedPct) || 0) + (Number(burnedPct) || 0);
        const lpSecured = securedPct >= 50 || (Number(lockedPct) || 0) >= 50 || (Number(burnedPct) || 0) >= 50;

        setRugcheckStatus((prev) => ({
          ...prev,
          [mint]: {
            status: 'ok',
            lockedPct: Number.isFinite(Number(lockedPct)) ? Number(lockedPct) : null,
            burnedPct: Number.isFinite(Number(burnedPct)) ? Number(burnedPct) : null,
            lpSecured,
            updatedAt: Date.now(),
          },
        }));
      } catch {
        setRugcheckStatus((prev) => ({ ...prev, [mint]: { status: 'error' } }));
      }
    },
    [rugcheckStatus]
  );

  const fetchHoldersCountForMint = useCallback(
    async (mint) => {
      if (!mint) return;
      const existing = holdersByMint[mint];
      if (existing?.status === 'ok' || existing?.status === 'loading') return;

      setHoldersByMint((prev) => ({ ...prev, [mint]: { status: 'loading' } }));

      const endpoints = [
        `https://public-api.solscan.io/token/meta?tokenAddress=${mint}`,
      ];

      const pickNumber = (...vals) => {
        for (const v of vals) {
          const n = Number(v);
          if (Number.isFinite(n)) return n;
        }
        return null;
      };

      try {
        let data = null;
        for (const url of endpoints) {
          try {
            const res = await fetch(url, { headers: { Accept: 'application/json' } });
            if (!res.ok) continue;
            data = await res.json();
            if (data) break;
          } catch {
            // try next
          }
        }

        if (!data) {
          setHoldersByMint((prev) => ({ ...prev, [mint]: { status: 'error' } }));
          return;
        }

        const holders = pickNumber(
          data?.holder,
          data?.holders,
          data?.data?.holder,
          data?.data?.holders,
        );

        setHoldersByMint((prev) => ({
          ...prev,
          [mint]: {
            status: 'ok',
            holders: Number.isFinite(Number(holders)) ? Number(holders) : null,
            updatedAt: Date.now(),
          },
        }));
      } catch {
        setHoldersByMint((prev) => ({ ...prev, [mint]: { status: 'error' } }));
      }
    },
    [holdersByMint]
  );

  useEffect(() => {
    if (!selectedToken?.address) return;
    fetchRugcheckForMint(selectedToken.address);
  }, [selectedToken?.address, fetchRugcheckForMint]);

  useEffect(() => {
    if (!selectedToken?.address) return;
    fetchHoldersCountForMint(selectedToken.address);
  }, [selectedToken?.address, fetchHoldersCountForMint]);

  useEffect(() => {
    if (!filters.onlyLpSecured) return;
    (tokens || []).slice(0, 40).forEach((tok) => tok?.address && fetchRugcheckForMint(tok.address));
  }, [filters.onlyLpSecured, tokens, fetchRugcheckForMint]);

  useEffect(() => {
    // Best-effort: keep the token dashboard informative without over-fetching.
    (filteredTokens || []).slice(0, 15).forEach((tok) => tok?.address && fetchHoldersCountForMint(tok.address));
  }, [filteredTokens, fetchHoldersCountForMint]);

  const setQuickSolAmount = useCallback((amount) => {
    setInputAmount(String(amount));
  }, []);

  // Get quote when amount changes
  useEffect(() => {
    if (!selectedToken || !inputAmount || parseFloat(inputAmount) <= 0) {
      setOutputAmount('');
      setCurrentQuote(null);
      setQuoteSource('');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setQuoteLoading(true);

        const inputMint = swapMode === 'buy' ? SOL_MINT : selectedToken.address;
        const outputMint = swapMode === 'buy' ? selectedToken.address : SOL_MINT;

        if (!inputMint || !outputMint) {
          setOutputAmount('');
          setCurrentQuote(null);
          return;
        }

        const inputDecimals = await getMintDecimals(inputMint);
        const outputDecimals = await getMintDecimals(outputMint);
        
        const rawAmount = jupiterApi.toRawAmount(parseFloat(inputAmount), inputDecimals);
        const slippageBps = slippage * 100;

        // 1) Try Jupiter (real swap)
        try {
          const quote = await jupiterApi.getQuote(inputMint, outputMint, rawAmount, slippageBps);
          if (quote) {
            const output = jupiterApi.fromRawAmount(parseInt(quote.outAmount, 10), outputDecimals);
            const displayDecimals = Math.min(Math.max(outputDecimals, 2), 6);
            setOutputAmount(Number.isFinite(output) ? output.toFixed(displayDecimals) : '');
            setCurrentQuote(quote);
            setQuoteSource('jupiter');
            return;
          }
        } catch (e) {
          // 2) Fallback to an estimate using DexScreener native price
          // If the pair is SOL-quoted, `priceNative` is SOL-per-token.
          const priceNative = toNumber(selectedToken.priceNative);
          if (priceNative > 0 && inputMint === SOL_MINT && outputMint === selectedToken.address) {
            // buy token with SOL
            const out = parseFloat(inputAmount) / priceNative;
            setOutputAmount(Number.isFinite(out) ? out.toFixed(4) : '');
            setCurrentQuote(null);
            setQuoteSource('estimate');
            return;
          }
          if (priceNative > 0 && inputMint === selectedToken.address && outputMint === SOL_MINT) {
            // sell token for SOL
            const out = parseFloat(inputAmount) * priceNative;
            setOutputAmount(Number.isFinite(out) ? out.toFixed(4) : '');
            setCurrentQuote(null);
            setQuoteSource('estimate');
            return;
          }

          setOutputAmount('');
          setCurrentQuote(null);
          setQuoteSource('');

          const msg = String(e?.message || 'Failed to fetch quote');
          if (msg.includes('Failed to fetch') || msg.includes('ERR_NAME_NOT_RESOLVED')) {
            toast.error('Live quotes are blocked in this network. Estimated pricing may be shown; live swapping requires Jupiter access.');
          }
        }
      } catch (error) {
        console.error('Quote error:', error);
        setOutputAmount('');
        setCurrentQuote(null);
        setQuoteSource('');
      } finally {
        setQuoteLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [inputAmount, selectedToken, swapMode, slippage, getMintDecimals]);

  // Execute swap
  const handleSwap = useCallback(async () => {
    if (!wallet.connected) {
      setWalletModalVisible(true);
      return;
    }

    if (!currentQuote) {
      toast.error('Live quote required to swap');
      return;
    }

    try {
      setSwapping(true);

      const swapTransaction = await jupiterApi.getSwapTransaction(currentQuote, wallet.publicKey.toString());

      const signature = await jupiterApi.executeSwap(swapTransaction, wallet);
      
      toast.success('Swap successful! View on Solscan: ' + signature.slice(0, 8) + '...');
      
      setInputAmount('');
      setOutputAmount('');
      setCurrentQuote(null);
    } catch (error) {
      console.error('Swap error:', error);
      toast.error('Swap failed: ' + error.message);
    } finally {
      setSwapping(false);
    }
  }, [wallet, currentQuote, setWalletModalVisible]);

  // Format helpers
  const formatPrice = (price) => {
    const n = toNumber(price);
    if (!n) return '—';
    if (n >= 1) return `$${n.toFixed(4)}`;
    if (n >= 0.01) return `$${n.toFixed(6)}`;
    return `$${n.toPrecision(4)}`;
  };

  const formatChange = (change) => {
    const n = toNumber(change);
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}%`;
  };

  const formatVolume = (value) => {
    const n = toNumber(value);
    if (!n) return '—';
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(n);
  };

  // Format relative time for last updated indicator
  const formatTimeAgo = (date) => {
    if (!date) return '';
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return seconds + 's ago';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    const hours = Math.floor(minutes / 60);
    return hours + 'h ago';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Gradient animation */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          animation: gradient-shift 3s ease infinite;
        }
      `}} />

      <div className="sticky top-0 z-10 border-b border-border/50 bg-card/90 backdrop-blur-xl shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold truncate bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">{t.title}</h1>
            <Badge className="bg-muted/50 text-foreground border-border hover:bg-muted/60 gap-2">
              <SolanaMark className="h-4 w-4" />
              <span>{t.solana}</span>
            </Badge>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-9 w-9 hover:bg-muted/60"
              aria-label="Refresh"
            >
              <RefreshCw className={'w-4 h-4 ' + (refreshing ? 'animate-spin' : '')} />
            </Button>
            {lastUpdated && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {formatTimeAgo(lastUpdated)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card/80 border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 transition-shadow"
              />
            </div>

            {/* Desktop Toolbar */}
            <div className="hidden sm:flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={mobilePreset === 'hot' ? 'default' : 'secondary'}
                className="h-8"
                onClick={() => applyMobilePreset('hot')}
              >
                {t.hot}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mobilePreset === 'new' ? 'default' : 'secondary'}
                className="h-8"
                onClick={() => applyMobilePreset('new')}
              >
                {t.newest}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mobilePreset === 'mc' ? 'default' : 'secondary'}
                className="h-8"
                onClick={() => applyMobilePreset('mc')}
              >
                MC
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mobilePreset === 'liq' ? 'default' : 'secondary'}
                className="h-8"
                onClick={() => applyMobilePreset('liq')}
              >
                {t.liquidity}
              </Button>

              <div className="mx-2 h-5 w-px bg-border" />

              {['5m', '1h', '6h', '24h'].map((tf) => (
                <Button
                  key={tf}
                  type="button"
                  size="sm"
                  variant={timeframe === tf ? 'default' : 'ghost'}
                  className="h-8"
                  onClick={() => setTimeframe(tf)}
                >
                  {tf}
                </Button>
              ))}

              <div className="ml-auto flex items-center gap-2">
                <Collapsible open={desktopFiltersOpen} onOpenChange={setDesktopFiltersOpen}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" size="sm" variant="outline" className="h-8">
                      {t.filters}
                      {countActiveFilters() > 0 ? (
                        <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] text-primary-foreground">
                          {countActiveFilters()}
                        </span>
                      ) : null}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <Card className="bg-card/80 border-border/50 p-4 rounded-xl backdrop-blur-sm">
                      <div className="grid grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t.minLiquidity}</Label>
                          <Input
                            inputMode="numeric"
                            placeholder="10000"
                            value={filters.minLiquidity}
                            onChange={(e) => setFilters((p) => ({ ...p, minLiquidity: e.target.value }))}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t.minMarketCap}</Label>
                          <Input
                            inputMode="numeric"
                            placeholder="50000"
                            value={filters.minMarketCap}
                            onChange={(e) => setFilters((p) => ({ ...p, minMarketCap: e.target.value }))}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t.minVolume} ({timeframe})</Label>
                          <Input
                            inputMode="numeric"
                            placeholder="5000"
                            value={filters.minVolume}
                            onChange={(e) => setFilters((p) => ({ ...p, minVolume: e.target.value }))}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t.maxAgeHours}</Label>
                          <Input
                            inputMode="numeric"
                            placeholder="24"
                            value={filters.maxAgeHours}
                            onChange={(e) => setFilters((p) => ({ ...p, maxAgeHours: e.target.value }))}
                            className="h-9"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={filters.onlyGreen}
                              onCheckedChange={(checked) => setFilters((p) => ({ ...p, onlyGreen: !!checked }))}
                            />
                            <div className="text-xs">{t.greenOnly}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={filters.onlyWithImage}
                              onCheckedChange={(checked) => setFilters((p) => ({ ...p, onlyWithImage: !!checked }))}
                            />
                            <div className="text-xs">{t.hasLogo}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={filters.onlyWithSocials}
                              onCheckedChange={(checked) => setFilters((p) => ({ ...p, onlyWithSocials: !!checked }))}
                            />
                            <div className="text-xs">{t.hasSocials}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={filters.onlyLpSecured}
                              onCheckedChange={(checked) => setFilters((p) => ({ ...p, onlyLpSecured: !!checked }))}
                            />
                            <div className="text-xs">{t.lpSecured}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-xs text-muted-foreground">{filteredTokens.length} {t.tokens}</div>
                          <Button type="button" size="sm" variant="outline" className="h-8" onClick={resetFilters}>
                            {t.reset}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>

            {/* Mobile Filters */}
            <div className="sm:hidden space-y-2">
              <div className="hidden sm:flex gap-2 overflow-x-auto pb-1">
                <Button
                  type="button"
                  size="sm"
                  variant={mobilePreset === 'hot' ? 'default' : 'secondary'}
                  className="h-8 shrink-0"
                  onClick={() => applyMobilePreset('hot')}
                >
                  {t.hot}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mobilePreset === 'new' ? 'default' : 'secondary'}
                  className="h-8 shrink-0"
                  onClick={() => applyMobilePreset('new')}
                >
                  {t.newest}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mobilePreset === 'mc' ? 'default' : 'secondary'}
                  className="h-8 shrink-0"
                  onClick={() => applyMobilePreset('mc')}
                >
                  MC
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mobilePreset === 'liq' ? 'default' : 'secondary'}
                  className="h-8 shrink-0"
                  onClick={() => applyMobilePreset('liq')}
                >
                  {t.liquidity}
                </Button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {['5m', '1h', '6h', '24h'].map((tf) => (
                  <Button
                    key={tf}
                    type="button"
                    size="sm"
                    variant={timeframe === tf ? 'default' : 'ghost'}
                    className="h-8 shrink-0"
                    onClick={() => setTimeframe(tf)}
                  >
                    {tf}
                  </Button>
                ))}
                <div className="ml-auto shrink-0 flex items-center gap-2">
                  <Sheet modal={false} open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                    <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setMobileFiltersOpen(true)}>
                      {t.filters}
                      {countActiveFilters() > 0 ? (
                        <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] text-primary-foreground">
                          {countActiveFilters()}
                        </span>
                      ) : null}
                    </Button>
                    <SheetContent side="bottom" className="w-full bg-background border-border p-4">
                      <div className="flex items-center justify-between pr-8">
                        <div className="text-sm font-semibold">{t.filters}</div>
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={resetFilters}>
                          {t.reset}
                        </Button>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t.minLiquidity}</Label>
                          <Input
                            inputMode="numeric"
                            placeholder="e.g. 10000"
                            value={filters.minLiquidity}
                            onChange={(e) => setFilters((p) => ({ ...p, minLiquidity: e.target.value }))}
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t.minMarketCap}</Label>
                          <Input
                            inputMode="numeric"
                            placeholder="e.g. 50000"
                            value={filters.minMarketCap}
                            onChange={(e) => setFilters((p) => ({ ...p, minMarketCap: e.target.value }))}
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t.minVolume} ({timeframe})</Label>
                          <Input
                            inputMode="numeric"
                            placeholder="e.g. 5000"
                            value={filters.minVolume}
                            onChange={(e) => setFilters((p) => ({ ...p, minVolume: e.target.value }))}
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t.maxAgeHours}</Label>
                          <Input
                            inputMode="numeric"
                            placeholder="e.g. 24"
                            value={filters.maxAgeHours}
                            onChange={(e) => setFilters((p) => ({ ...p, maxAgeHours: e.target.value }))}
                            className="h-10"
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          <Switch checked={filters.onlyGreen} onCheckedChange={(checked) => setFilters((p) => ({ ...p, onlyGreen: !!checked }))} />
                          <div className="text-sm">{t.greenOnly}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={filters.onlyWithImage} onCheckedChange={(checked) => setFilters((p) => ({ ...p, onlyWithImage: !!checked }))} />
                          <div className="text-sm">{t.hasLogo}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={filters.onlyWithSocials} onCheckedChange={(checked) => setFilters((p) => ({ ...p, onlyWithSocials: !!checked }))} />
                          <div className="text-sm">{t.hasSocials}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={filters.onlyLpSecured} onCheckedChange={(checked) => setFilters((p) => ({ ...p, onlyLpSecured: !!checked }))} />
                          <div className="text-sm">{t.lpSecured}</div>
                        </div>
                      </div>

                      <div className="mt-4 text-xs text-muted-foreground">{filteredTokens.length} {t.tokens}</div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            </div>

            {/* Token Table - Desktop */}
            <Card className="hidden sm:block bg-card border-border overflow-hidden max-h-[calc(100vh-280px)]">
              <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    <button
                      onClick={() => handleSort('symbol')}
                      className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                    >
                      {t.token} <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    <button
                      onClick={() => handleSort('price')}
                      className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                    >
                      {t.price} <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    <button
                      onClick={() => handleSort(getChangeKey(timeframe))}
                      className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                    >
                      {timeframe} % <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden lg:table-cell">
                    <button
                      onClick={() => handleSort(getVolumeKey(timeframe))}
                      className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                    >
                      {t.volume} {timeframe} <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden lg:table-cell">
                    <button
                      onClick={() => handleSort('marketCap')}
                      className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                    >
                      {t.marketCap} <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden xl:table-cell">
                    <button
                      onClick={() => handleSort('liquidity')}
                      className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                    >
                      {t.liquidity} <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden xl:table-cell">
                    <button
                      onClick={() => handleSort('pairCreatedAt')}
                      className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                    >
                      {t.age} <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    {t.action}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <Loader2 className="w-7 h-7 animate-spin mx-auto mb-3 text-primary drop-shadow-glow" />
                      <p className="text-muted-foreground">{t.loadingMemeCoins}</p>
                    </td>
                  </tr>
                ) : filteredTokens.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                      {searchQuery ? t.noTokensMatchSearch : t.noTokensFound}
                    </td>
                  </tr>
                ) : (
                  filteredTokens.map((token) => (
                    <tr
                      key={token.pairAddress || token.address}
                      className="border-b border-border/50 hover:bg-muted/40 cursor-pointer transition-all duration-150 active:bg-muted/60"
                      onClick={() => selectToken(token)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {token.imageUrl ? (
                            <img
                              src={token.imageUrl}
                              alt={token.symbol}
                              className="w-7 h-7 rounded-full bg-muted"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white ring-1 ring-white/10">
                              {token.symbol?.charAt(0) || '?'}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold">{token.symbol}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[150px]">{token.name}</div>
                            {token.pairCreatedAt || hasSocials(token) || rugcheckStatus[token.address]?.lpSecured || holdersByMint[token.address]?.holders ? (
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                {token.pairCreatedAt ? (
                                  <Badge variant="outline" className="h-5 px-2 text-[10px] gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatAgeMs(Date.now() - Number(token.pairCreatedAt))}
                                  </Badge>
                                ) : null}
                                {hasSocials(token) ? (
                                  <Badge variant="outline" className="h-5 px-2 text-[10px] gap-1">
                                    <Link2 className="w-3 h-3" />
                                    {t.socials}
                                  </Badge>
                                ) : null}
                                {rugcheckStatus[token.address]?.lpSecured ? (
                                  <Badge className="h-5 px-2 text-[10px] gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                    <ShieldCheck className="w-3 h-3" />
                                    {t.lpSecured}
                                  </Badge>
                                ) : null}
                                {holdersByMint[token.address]?.holders ? (
                                  <Badge variant="outline" className="h-5 px-2 text-[10px] gap-1">
                                    <Users className="w-3 h-3" />
                                    {Math.round(Number(holdersByMint[token.address]?.holders)).toLocaleString()}
                                  </Badge>
                                ) : null}
                              </div>
                            ) : null}

                            <div className="mt-2 h-1.5 w-28 rounded-full bg-muted overflow-hidden">
                              {(() => {
                                const strength = getTrendStrength(token);
                                const w = Math.round(strength * 100);
                                const up = getTokenChange(token) >= 0;
                                return (
                                  <div
                                    className={
                                      'h-full ' +
                                      (up
                                        ? 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                                        : 'bg-gradient-to-r from-rose-500 to-orange-500')
                                    }
                                    style={{ width: `${w}%` }}
                                  />
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {formatPrice(token.price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={'inline-flex items-center gap-1 text-sm font-medium ' + 
                            (getTokenChange(token) >= 0 ? 'text-emerald-500' : 'text-rose-500')
                          }
                        >
                          {getTokenChange(token) >= 0 ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                          {formatChange(getTokenChange(token))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm hidden lg:table-cell">
                        {formatVolume(getTokenVolume(token))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm hidden lg:table-cell">
                        {formatVolume(token.marketCap)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm hidden xl:table-cell">
                        {formatVolume(token.liquidity)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm hidden xl:table-cell">
                        {token.pairCreatedAt ? formatAgeMs(Date.now() - Number(token.pairCreatedAt)) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white gap-2 shadow-sm hover:shadow-md transition-all font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectToken(token);
                          }}
                        >
                          <SolanaMark className="w-3.5 h-3.5" />
                          {t.trade}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
              </div>
            </Card>

            {/* Token List - Mobile */}
            <div className="sm:hidden space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
              {loading ? (
                <Card className="bg-card border-border p-8 text-center">
                  <Loader2 className="w-7 h-7 animate-spin mx-auto mb-3 text-primary drop-shadow-glow" />
                  <p className="text-muted-foreground/80 text-[11px]">{t.loadingMemeCoins}</p>
                </Card>
              ) : filteredTokens.length === 0 ? (
                <Card className="bg-card border-border p-8 text-center text-muted-foreground text-sm">
                  {searchQuery ? t.noTokensMatchSearch : t.noTokensFound}
                </Card>
              ) : (
                filteredTokens.map((token) => (
                  <Card
                    key={token.pairAddress || token.address}
                    className="bg-gradient-to-br from-card to-card/80 border-border/50 p-3.5 cursor-pointer hover:bg-muted/40 hover:border-border transition-all duration-200 rounded-xl shadow-sm hover:shadow-md active:scale-[0.99]"
                    onClick={() => selectToken(token)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {token.imageUrl ? (
                          <img
                            src={token.imageUrl}
                            alt={token.symbol}
                            className="w-10 h-10 rounded-full bg-muted"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500 flex items-center justify-center text-sm font-bold text-white shadow-md ring-2 ring-white/10">
                            {token.symbol?.charAt(0) || '?'}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold">{token.symbol}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-[11px] text-muted-foreground">
                            <span className="font-mono">{formatPrice(token.price)}</span>
                            {token.pairCreatedAt ? (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatAgeMs(Date.now() - Number(token.pairCreatedAt))}
                              </span>
                            ) : null}
                            {hasSocials(token) ? (
                              <span className="inline-flex items-center gap-1">
                                <Link2 className="w-3 h-3" />
                                {t.socials}
                              </span>
                            ) : null}
                            {rugcheckStatus[token.address]?.lpSecured ? (
                              <span className="inline-flex items-center gap-1 text-emerald-500">
                                <ShieldCheck className="w-3 h-3" />
                                {t.lpSecured}
                              </span>
                            ) : null}
                            {holdersByMint[token.address]?.holders ? (
                              <span className="inline-flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {Math.round(Number(holdersByMint[token.address]?.holders)).toLocaleString()}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 h-1.5 w-40 rounded-full bg-muted overflow-hidden">
                            {(() => {
                              const strength = getTrendStrength(token);
                              const w = Math.round(strength * 100);
                              const up = getTokenChange(token) >= 0;
                              return (
                                <div
                                  className={
                                    'h-full ' +
                                    (up
                                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                                      : 'bg-gradient-to-r from-rose-500 to-orange-500')
                                  }
                                  style={{ width: `${w}%` }}
                                />
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={'text-sm font-medium ' + (getTokenChange(token) >= 0 ? 'text-emerald-500' : 'text-rose-500')}
                        >
                          {formatChange(getTokenChange(token))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t.volume}: {formatVolume(getTokenVolume(token))}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Desktop Side Panel */}
          <div className="hidden lg:block">
            <div className="sticky top-24">
              {selectedToken ? (
                <Card className="bg-card border-border overflow-hidden shadow-none">
                  <div className="p-4 border-b border-border bg-muted/30 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-3">
                      {selectedToken.imageUrl ? (
                        <img src={selectedToken.imageUrl} alt={selectedToken.symbol} className="w-10 h-10 rounded-full bg-muted" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500 flex items-center justify-center text-sm font-bold text-white shadow-md ring-2 ring-white/10">
                          {selectedToken.symbol?.charAt(0) || '?'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-lg font-bold leading-tight truncate">{selectedToken.symbol}</div>
                        <div className="text-sm text-muted-foreground truncate">{selectedToken.name}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{formatAddress(selectedToken.address)}</span>
                          {selectedToken.pairCreatedAt ? (
                            <span>• {formatAgeMs(Date.now() - Number(selectedToken.pairCreatedAt))}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedToken.dexUrl ? (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => window.open(selectedToken.dexUrl, '_blank')}
                          aria-label={t.openChart}
                          title={t.openChart}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      ) : null}
                      <Button variant="outline" size="sm" onClick={() => setSelectedToken(null)}>{t.close}</Button>
                    </div>
                  </div>

                  {/* Chart-first */}
                  {getDexScreenerEmbedUrl(selectedToken) ? (
                    <div className="relative w-full h-[360px] overflow-hidden bg-background rounded-lg border border-border/30">
                      <iframe
                        title={`${selectedToken.symbol} chart`}
                        src={getDexScreenerEmbedUrl(selectedToken)}
                        className="w-full h-full"
                        frameBorder="0"
                        allow="clipboard-write"
                      />
                    </div>
                  ) : null}

                  <div className="p-4 space-y-4">
                    {/* Compact stats */}
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      <div className="shrink-0 bg-muted/30 dark:bg-muted/20 border border-border/40 px-2 py-1.5 rounded-lg">
                        <div className="text-[9px] text-muted-foreground/80 leading-tight">{t.price}</div>
                        <div className="text-[11px] font-semibold font-mono leading-tight">{formatPrice(selectedToken.price)}</div>
                      </div>
                      <div className="shrink-0 bg-muted/30 dark:bg-muted/20 border border-border/40 px-2 py-1.5 rounded-lg">
                        <div className="text-[9px] text-muted-foreground/80 leading-tight">{timeframe} %</div>
                        <div className={(getTokenChange(selectedToken) >= 0 ? 'text-emerald-500' : 'text-rose-500') + ' text-sm font-bold'}>
                          {formatChange(getTokenChange(selectedToken))}
                        </div>
                      </div>
                      <div className="shrink-0 bg-muted/30 dark:bg-muted/20 border border-border/40 px-2 py-1.5 rounded-lg">
                        <div className="text-[9px] text-muted-foreground/80 leading-tight">{t.volume} {timeframe}</div>
                        <div className="text-[11px] font-semibold font-mono leading-tight">{formatVolume(getTokenVolume(selectedToken))}</div>
                      </div>
                      <div className="shrink-0 bg-muted/30 dark:bg-muted/20 border border-border/40 px-2 py-1.5 rounded-lg">
                        <div className="text-[9px] text-muted-foreground/80 leading-tight">{t.marketCap}</div>
                        <div className="text-[11px] font-semibold font-mono leading-tight">{formatVolume(selectedToken.marketCap)}</div>
                      </div>
                      <div className="shrink-0 bg-muted/30 dark:bg-muted/20 border border-border/40 px-2 py-1.5 rounded-lg">
                        <div className="text-[9px] text-muted-foreground/80 leading-tight">{t.liquidity}</div>
                        <div className="text-[11px] font-semibold font-mono leading-tight">{formatVolume(selectedToken.liquidity)}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                      {selectedToken.pairCreatedAt ? (
                        <Badge variant="outline" className="shrink-0 text-[11px]">
                          {t.launched}: {formatAgeMs(Date.now() - Number(selectedToken.pairCreatedAt))}
                        </Badge>
                      ) : null}
                      {(Array.isArray(selectedToken.websites) ? selectedToken.websites : []).slice(0, 1).map((w) => {
                        const url = typeof w === 'string' ? w : w?.url;
                        if (!url) return null;
                        return (
                          <button
                            key={url}
                            type="button"
                            className="shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white hover:bg-blue-600 flex items-center justify-center transition-all"
                            onClick={() => window.open(url, '_blank')}
                            title={t.website}
                          >
                            <Globe className="w-3.5 h-3.5" />
                          </button>
                        );
                      })}
                      {(Array.isArray(selectedToken.socials) ? selectedToken.socials : []).slice(0, 3).map((s) => {
                        const url = typeof s === 'string' ? s : s?.url;
                        if (!url) return null;
                        const type = typeof s === 'string' ? 'Link' : (s?.type || 'Link');
                        const lower = String(type).toLowerCase();
                        const urlLower = url.toLowerCase();
                        // Detect platform from URL or type
                        const isTwitter = lower.includes('twitter') || lower.includes('x') || urlLower.includes('twitter.com') || urlLower.includes('x.com');
                        const isTelegram = lower.includes('telegram') || urlLower.includes('t.me') || urlLower.includes('telegram');
                        const isDiscord = lower.includes('discord') || urlLower.includes('discord');
                        
                        // Use proper icons with brand colors
                        let iconEl, bgClass;
                        if (isTwitter) {
                          iconEl = <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
                          bgClass = 'bg-black dark:bg-white/10 text-white dark:text-white hover:bg-gray-800';
                        } else if (isTelegram) {
                          iconEl = <Send className="w-3.5 h-3.5" />;
                          bgClass = 'bg-[#0088cc] text-white hover:bg-[#0077b5]';
                        } else if (isDiscord) {
                          iconEl = <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>;
                          bgClass = 'bg-[#5865F2] text-white hover:bg-[#4752c4]';
                        } else {
                          iconEl = <Link2 className="w-3.5 h-3.5" />;
                          bgClass = 'bg-muted hover:bg-muted/80';
                        }
                        
                        return (
                          <button
                            key={url}
                            type="button"
                            className={'shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ' + bgClass}
                            onClick={() => window.open(url, '_blank')}
                            title={type}
                          >
                            {iconEl}
                          </button>
                        );
                      })}
                      {rugcheckStatus[selectedToken.address]?.lockedPct != null ? (
                        <Badge variant="outline" className="shrink-0 text-[11px]">
                          {t.lpLocked} {Math.round(Number(rugcheckStatus[selectedToken.address]?.lockedPct))}%
                        </Badge>
                      ) : null}
                      {rugcheckStatus[selectedToken.address]?.burnedPct != null ? (
                        <Badge variant="outline" className="shrink-0 text-[11px]">
                          {t.lpBurned} {Math.round(Number(rugcheckStatus[selectedToken.address]?.burnedPct))}%
                        </Badge>
                      ) : null}
                      {rugcheckStatus[selectedToken.address]?.lpSecured ? (
                        <Badge className="shrink-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px]">
                          {t.lpSecured}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <SolanaMark className="w-4 h-4" />
                          {t.trade}
                        </div>
                        {quoteSource === 'estimate' ? (
                          <Badge variant="outline" className="text-xs">{t.estimated}</Badge>
                        ) : quoteSource === 'jupiter' ? (
                          <Badge className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{t.live}</Badge>
                        ) : null}
                      </div>

                      <div className="space-y-1.5">
                        <div className="space-y-1.5">
                          <Label className="text-muted-foreground/80 text-[11px]">
                            {swapMode === 'buy' ? (
                              <span className="inline-flex items-center gap-2">
                                {t.pay}
                                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5">
                                  <SolanaMark className="h-3.5 w-3.5" />
                                  SOL
                                </span>
                              </span>
                            ) : (
                              `${t.pay} (${selectedToken.symbol})`
                            )}
                          </Label>
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={inputAmount}
                            onChange={(e) => setInputAmount(e.target.value)}
                            className="bg-background border-border h-11"
                          />
                          {swapMode === 'buy' ? (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {[0.1, 0.25, 0.5, 1].map((v) => (
                                <Button key={v} type="button" variant="outline" size="sm" className="h-8 shrink-0 rounded-lg hover:bg-muted/60 hover:border-primary/50 transition-colors" onClick={() => setQuickSolAmount(v)}>
                                  {v} SOL
                                </Button>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-muted-foreground/80 text-[11px]">
                            {swapMode === 'buy' ? `${t.receive} (${selectedToken.symbol})` : `${t.receive} (SOL)`}
                          </Label>
                          <Input
                            type="text"
                            placeholder="0.00"
                            value={quoteLoading ? '...' : outputAmount}
                            readOnly
                            className="bg-muted border-border h-11"
                          />
                          {quoteLoading ? (
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Getting quote...
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-muted-foreground/80 text-[11px]">{t.slippage}</Label>
                          <div className="flex flex-wrap gap-2">
                            {SLIPPAGE_OPTIONS.map((option) => (
                              <Button
                                key={option}
                                size="sm"
                                variant={slippage === option ? 'default' : 'outline'}
                                onClick={() => {
                                  setSlippage(option);
                                  setCustomSlippage('');
                                }}
                                className={'h-7 px-2 text-xs rounded-md font-medium ' + (slippage === option ? 'bg-primary shadow-sm' : 'hover:bg-muted/60')}
                              >
                                {option}%
                              </Button>
                            ))}
                            <Input
                              type="number"
                              placeholder="Cust"
                              value={customSlippage}
                              onChange={(e) => {
                                setCustomSlippage(e.target.value);
                                const val = parseFloat(e.target.value);
                                if (val > 0 && val <= 50) setSlippage(val);
                              }}
                              className="w-16 h-7 bg-background border-border text-xs rounded-md"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Sticky action bar */}
                      <div className="mt-2">
                        {!wallet.connected ? (
                          <Button
                            size="lg"
                            className="w-full h-11 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 hover:from-violet-600 hover:via-purple-600 hover:to-indigo-600 text-white font-semibold shadow-lg shadow-purple-500/25 rounded-xl transition-all"
                            onClick={() => setWalletModalVisible(true)}
                          >
                            {t.connectWallet}
                          </Button>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              size="lg"
                              className={
                                (swapMode === 'buy'
                                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25 font-semibold'
                                  : 'bg-muted/60 text-foreground/80 hover:bg-muted/90 border border-border/50') +
                                ' h-11 w-full'
                              }
                              onClick={() => {
                                if (swapMode !== 'buy') {
                                  switchSwapMode('buy');
                                  return;
                                }
                                handleSwap();
                              }}
                              disabled={swapMode === 'buy' ? swapping || quoteLoading || !inputAmount || !currentQuote : swapping}
                            >
                              {swapMode === 'buy'
                                ? swapping
                                  ? `${t.buy}…`
                                  : quoteSource === 'estimate'
                                    ? t.buyLiveRequired
                                    : `${t.buy} ${inputAmount || '0'} SOL`
                                : t.buy}
                            </Button>
                            <Button
                              size="lg"
                              className={
                                (swapMode === 'sell'
                                  ? 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-lg shadow-rose-500/25 font-semibold'
                                  : 'bg-muted/60 text-foreground/80 hover:bg-muted/90 border border-border/50') +
                                ' h-11 w-full'
                              }
                              onClick={() => {
                                if (swapMode !== 'sell') {
                                  switchSwapMode('sell');
                                  return;
                                }
                                handleSwap();
                              }}
                              disabled={swapMode === 'sell' ? swapping || quoteLoading || !inputAmount || !currentQuote : swapping}
                            >
                              {swapMode === 'sell'
                                ? swapping
                                  ? `${t.sell}…`
                                  : quoteSource === 'estimate'
                                    ? t.sellLiveRequired
                                    : `${t.sell} ${inputAmount || '0'} ${selectedToken.symbol}`
                                : t.sell}
                            </Button>
                          </div>
                        )}
                      </div>

                      {!wallet.connected ? <div className="text-xs text-muted-foreground">{t.connectFromNavbar}</div> : null}
                    </div>
                  </div>
                </Card>
              ) : (
                <Card className="bg-card border-border p-4 text-sm text-muted-foreground">
                  {t.selectTokenToOpenTerminal}
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Token Detail Sheet (Mobile only) */}
      <Sheet modal={false} open={!!selectedToken && isMobile} onOpenChange={(open) => !open && setSelectedToken(null)}>
        <SheetContent 
          side="right" 
          className="w-full bg-background border-border overflow-y-auto p-0 shadow-none"
        >
          {selectedToken && (
            <div className="flex flex-col h-full">
              {/* Chart-first layout */}
              <div className="relative">
                <div className="relative h-[50vh] min-h-[300px] max-h-[400px] w-full bg-background overflow-hidden rounded-b-xl">
                  {getDexScreenerEmbedUrl(selectedToken) ? (
                    <iframe
                      title={`${selectedToken.symbol} chart`}
                      src={getDexScreenerEmbedUrl(selectedToken)}
                      className="w-full h-full"
                      frameBorder="0"
                      allow="clipboard-write"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                      {t.chartUnavailable}
                    </div>
                  )}
                </div>

                {/* Compact overlay header */}
                <div className="absolute top-0 left-0 right-0 p-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {selectedToken.imageUrl ? (
                          <img
                            src={selectedToken.imageUrl}
                            alt={selectedToken.symbol}
                            className="w-7 h-7 rounded-full bg-muted"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white ring-1 ring-white/10">
                            {selectedToken.symbol?.charAt(0) || '?'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-bold leading-tight truncate">{selectedToken.symbol}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="font-mono text-muted-foreground">{formatAddress(selectedToken.address)}</span>
                        {selectedToken.pairCreatedAt ? (
                          <span className="text-muted-foreground">• {formatAgeMs(Date.now() - Number(selectedToken.pairCreatedAt))}</span>
                        ) : null}
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(selectedToken.address);
                              toast.success(t.copied);
                            } catch {
                              // ignore
                            }
                          }}
                        >
                          {t.copy}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedToken.dexUrl ? (
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => window.open(selectedToken.dexUrl, '_blank')}
                          aria-label={t.openChart}
                          title={t.openChart}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full bg-black/30 dark:bg-white/10 backdrop-blur-sm hover:bg-black/50 dark:hover:bg-white/20"
                        onClick={() => setSelectedToken(null)}
                      >
                        <X className="w-4 h-4 text-white" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Ultra-compact stats strip */}
                <div className="flex gap-1 overflow-x-auto pb-0.5 -mx-1 px-1">
                  <div className="shrink-0 bg-muted/30 dark:bg-muted/20 border border-border/40 px-2 py-1.5 rounded-lg">
                    <div className="text-[9px] text-muted-foreground/80 leading-tight">{t.price}</div>
                    <div className="text-[11px] font-semibold font-mono leading-tight">{formatPrice(selectedToken.price)}</div>
                  </div>
                  <div className="shrink-0 bg-muted/30 dark:bg-muted/20 border border-border/40 px-2 py-1.5 rounded-lg">
                    <div className="text-[9px] text-muted-foreground/80 leading-tight">{timeframe} %</div>
                    <div className={(getTokenChange(selectedToken) >= 0 ? 'text-emerald-500' : 'text-rose-500') + ' text-sm font-bold'}>
                      {formatChange(getTokenChange(selectedToken))}
                    </div>
                  </div>
                  <div className="shrink-0 bg-muted/30 dark:bg-muted/20 border border-border/40 px-2 py-1.5 rounded-lg">
                    <div className="text-[9px] text-muted-foreground/80 leading-tight">{t.volume} {timeframe}</div>
                    <div className="text-[11px] font-semibold font-mono leading-tight">{formatVolume(getTokenVolume(selectedToken))}</div>
                  </div>
                  <div className="shrink-0 bg-muted/30 dark:bg-muted/20 border border-border/40 px-2 py-1.5 rounded-lg">
                    <div className="text-[9px] text-muted-foreground/80 leading-tight">{t.marketCap}</div>
                    <div className="text-[11px] font-semibold font-mono leading-tight">{formatVolume(selectedToken.marketCap)}</div>
                  </div>
                  <div className="shrink-0 bg-muted/30 dark:bg-muted/20 border border-border/40 px-2 py-1.5 rounded-lg">
                    <div className="text-[9px] text-muted-foreground/80 leading-tight">{t.liquidity}</div>
                    <div className="text-[11px] font-semibold font-mono leading-tight">{formatVolume(selectedToken.liquidity)}</div>
                  </div>
                </div>

                {/* Socials / launch */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  {selectedToken.pairCreatedAt ? (
                    <Badge variant="outline" className="shrink-0 text-[11px]">
                      {t.launched}: {formatAgeMs(Date.now() - Number(selectedToken.pairCreatedAt))}
                    </Badge>
                  ) : null}
                  {(Array.isArray(selectedToken.websites) ? selectedToken.websites : []).slice(0, 1).map((w) => {
                    const url = typeof w === 'string' ? w : w?.url;
                    if (!url) return null;
                    return (
                      <Button
                        key={url}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 gap-2"
                        onClick={() => window.open(url, '_blank')}
                      >
                        <Globe className="h-3.5 w-3.5" />
                        {t.website}
                      </Button>
                    );
                  })}
                  {(Array.isArray(selectedToken.socials) ? selectedToken.socials : []).slice(0, 3).map((s) => {
                    const url = typeof s === 'string' ? s : s?.url;
                    if (!url) return null;
                    const type = typeof s === 'string' ? 'Link' : (s?.type || 'Link');
                    const lower = String(type).toLowerCase();
                    const Icon = lower.includes('telegram') ? Send : Link2;
                    return (
                      <Button
                        key={url}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 gap-2"
                        onClick={() => window.open(url, '_blank')}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {type}
                      </Button>
                    );
                  })}
                  {rugcheckStatus[selectedToken.address]?.lockedPct != null ? (
                    <Badge variant="outline" className="shrink-0 text-[11px]">
                      {t.lpLocked} {Math.round(Number(rugcheckStatus[selectedToken.address]?.lockedPct))}%
                    </Badge>
                  ) : null}
                  {rugcheckStatus[selectedToken.address]?.burnedPct != null ? (
                    <Badge variant="outline" className="shrink-0 text-[11px]">
                      {t.lpBurned} {Math.round(Number(rugcheckStatus[selectedToken.address]?.burnedPct))}%
                    </Badge>
                  ) : null}
                  {rugcheckStatus[selectedToken.address]?.lpSecured ? (
                    <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[10px] font-medium">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Safe
                    </span>
                  ) : rugcheckStatus[selectedToken.address]?.risks?.length > 0 ? (
                    <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 text-[10px] font-medium">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      Caution
                    </span>
                  ) : null}
                </div>

                {/* Quick Trade - Instant buy/sell with preset amounts */}
                <div className="bg-gradient-to-r from-emerald-500/5 via-transparent to-rose-500/5 border border-border/40 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-muted-foreground">{t.quickTrade || 'Quick Trade'}</span>
                    {wallet.connected && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {(solBalance || 0).toFixed(2)} SOL
                      </span>
                    )}
                  </div>
                  {wallet.connected ? (
                    <div className="flex gap-1.5">
                      {[0.05, 0.1, 0.25, 0.5].map((amount) => (
                        <button
                          key={`buy-${amount}`}
                          onClick={() => {
                            setInputAmount(String(amount));
                            setSwapMode('buy');
                            setTimeout(() => handleSwap(), 100);
                          }}
                          disabled={swapping || !selectedToken}
                          className="flex-1 h-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {swapping ? '...' : `${amount}`}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-center text-muted-foreground py-1">
                      {t.connectToQuickTrade || 'Connect wallet to quick trade'}
                    </div>
                  )}
                </div>

                {/* Trade panel */}
                <Card className="bg-card/80 border-border/50 p-3 rounded-xl backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-medium">{t.trade}</div>
                        {quoteSource === 'estimate' ? (
                          <Badge variant="outline" className="text-xs">{t.estimated}</Badge>
                        ) : quoteSource === 'jupiter' ? (
                          <Badge className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{t.live}</Badge>
                        ) : null}
                      </div>

                      <div className="space-y-1.5">
                            <div className="space-y-1.5">
                              <Label className="text-muted-foreground/80 text-[11px]">
                                {swapMode === 'buy' ? `${t.pay} (SOL)` : `${t.pay} (${selectedToken.symbol})`}
                              </Label>
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={inputAmount}
                                onChange={(e) => setInputAmount(e.target.value)}
                                className="bg-background border-border text-base h-9 rounded-lg"
                              />
                              {swapMode === 'buy' ? (
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                  {[0.1, 0.25, 0.5, 1].map((v) => (
                                    <Button 
                                      key={v} 
                                      type="button" 
                                      variant="outline" 
                                      size="sm" 
                                      className="h-7 px-2 text-xs shrink-0 rounded-md bg-muted/50 hover:bg-primary/10 hover:border-primary/50 hover:text-primary font-medium transition-all" 
                                      onClick={() => setQuickSolAmount(v)}
                                    >
                                      {v}
                                    </Button>
                                  ))}
                                </div>
                              ) : null}
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-muted-foreground/80 text-[11px]">
                                {swapMode === 'buy'
                                  ? `${t.receive} (${selectedToken.symbol})`
                                  : `${t.receive} (SOL)`}
                              </Label>
                              <Input
                                type="text"
                                placeholder="0.00"
                                value={quoteLoading ? '...' : outputAmount}
                                readOnly
                                className="bg-muted/40 border-border/40 text-base h-9 rounded-lg font-mono"
                              />
                              {quoteLoading ? (
                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Getting quote...
                                </div>
                              ) : null}
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-muted-foreground/80 text-[11px]">{t.slippage}</Label>
                              <div className="flex flex-wrap gap-2">
                                {SLIPPAGE_OPTIONS.map((option) => (
                                  <Button
                                    key={option}
                                    size="sm"
                                    variant={slippage === option ? 'default' : 'outline'}
                                    onClick={() => {
                                      setSlippage(option);
                                      setCustomSlippage('');
                                    }}
                                    className={'h-7 px-2 text-xs rounded-md font-medium ' + (slippage === option ? 'bg-primary shadow-sm' : 'hover:bg-muted/60')}
                                  >
                                    {option}%
                                  </Button>
                                ))}
                                <Input
                                  type="number"
                                  placeholder="Cust"
                                  value={customSlippage}
                                  onChange={(e) => {
                                    setCustomSlippage(e.target.value);
                                    const val = parseFloat(e.target.value);
                                    if (val > 0 && val <= 50) setSlippage(val);
                                  }}
                                  className="w-16 h-7 bg-background border-border text-xs rounded-md"
                                />
                              </div>
                            </div>
                          </div>
                </Card>

                {/* Sticky action bar (terminal-style) */}
                <div className="sticky bottom-0 left-0 right-0 -mx-4 mt-3 border-t border-border/30 bg-background/95 backdrop-blur-lg px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                  {!wallet.connected ? (
                    <div className="space-y-1.5">
                      <Button
                        size="lg"
                        className="w-full h-11 bg-gradient-to-r from-[#9945FF] via-[#14F195] to-[#9945FF] bg-[length:200%_100%] animate-gradient hover:shadow-xl hover:scale-[1.02] text-white font-bold shadow-lg rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
                        onClick={() => setWalletModalVisible(true)}
                      >
                        <SolanaMark className="w-5 h-5" />
                        {t.connectWallet}
                      </Button>
                      <div className="text-xs text-muted-foreground">{t.connectFromNavbar}</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="lg"
                        className={
                          (swapMode === 'buy'
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25 font-semibold'
                            : 'bg-muted/60 text-foreground/80 hover:bg-muted/90 border border-border/50') +
                          ' h-9 w-full rounded-lg text-sm'
                        }
                        onClick={() => {
                          if (swapMode !== 'buy') {
                            switchSwapMode('buy');
                            return;
                          }
                          handleSwap();
                        }}
                        disabled={swapMode === 'buy' ? swapping || quoteLoading || !inputAmount || !currentQuote : swapping}
                      >
                        {swapMode === 'buy' ? (
                          swapping ? (
                            <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t.buy}...</>
                          ) : quoteSource === 'estimate' ? (
                            t.buyLiveRequired
                          ) : (
                            `${t.buy} ${inputAmount || '0'} SOL`
                          )
                        ) : (
                          t.buy
                        )}
                      </Button>

                      <Button
                        size="lg"
                        className={
                          (swapMode === 'sell'
                            ? 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-lg shadow-rose-500/25 font-semibold'
                            : 'bg-muted/60 text-foreground/80 hover:bg-muted/90 border border-border/50') +
                          ' h-9 w-full rounded-lg text-sm'
                        }
                        onClick={() => {
                          if (swapMode !== 'sell') {
                            switchSwapMode('sell');
                            return;
                          }
                          handleSwap();
                        }}
                        disabled={swapMode === 'sell' ? swapping || quoteLoading || !inputAmount || !currentQuote : swapping}
                      >
                        {swapMode === 'sell' ? (
                          swapping ? (
                            <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t.sell}...</>
                          ) : quoteSource === 'estimate' ? (
                            t.sellLiveRequired
                          ) : (
                            `${t.sell} ${inputAmount || '0'} ${selectedToken.symbol}`
                          )
                        ) : (
                          t.sell
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
