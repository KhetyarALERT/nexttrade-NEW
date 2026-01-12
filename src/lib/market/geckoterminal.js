const API_BASE = 'https://api.geckoterminal.com/api/v2';
const DEFAULT_NETWORK = 'solana';
const OHLCV_TTL = 20000;
const SEARCH_TTL = 60000;

const ohlcvCache = new Map();
const searchCache = new Map();

const cacheNow = () => Date.now();

const getCacheEntry = (cache, key) => cache.get(key);

const setCacheEntry = (cache, key, data) => {
  cache.set(key, { data, timestamp: cacheNow(), inflight: null });
};

const isFresh = (entry, ttl) => entry && cacheNow() - entry.timestamp < ttl;

const fetchJson = async (url, signal) => {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error('Data source unavailable');
  }
  return response.json();
};

const createOhlcvKey = ({ network, poolAddress, timeframe, aggregate, limit }) =>
  [network, poolAddress, timeframe, aggregate, limit].join(':');

const createSearchKey = ({ network, query }) => [network, query].join(':');

const revalidateCache = async ({ cache, key, fetcher }) => {
  const entry = getCacheEntry(cache, key);
  if (entry?.inflight) return entry.inflight;
  const inflight = fetcher()
    .then((data) => {
      if (data) {
        setCacheEntry(cache, key, data);
      }
      return data;
    })
    .catch(() => null)
    .finally(() => {
      const latest = getCacheEntry(cache, key);
      if (latest) {
        cache.set(key, { ...latest, inflight: null });
      }
    });
  cache.set(key, { ...entry, inflight });
  return inflight;
};

export const fetchGeckoOhlcv = async ({
  network = DEFAULT_NETWORK,
  poolAddress,
  timeframe,
  aggregate = 1,
  limit = 120,
  signal,
  onUpdate,
} = {}) => {
  if (!poolAddress) return null;
  const key = createOhlcvKey({ network, poolAddress, timeframe, aggregate, limit });
  const cached = getCacheEntry(ohlcvCache, key);
  if (isFresh(cached, OHLCV_TTL)) {
    return cached.data;
  }

  const fetcher = async () => {
    const params = new URLSearchParams({
      aggregate: String(aggregate),
      limit: String(limit),
    });
    const url = `${API_BASE}/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}?${params.toString()}`;
    const data = await fetchJson(url, signal);
    return data;
  };

  if (cached) {
    revalidateCache({
      cache: ohlcvCache,
      key,
      fetcher,
    }).then((data) => {
      if (data && onUpdate) onUpdate(data);
    });
    return cached.data;
  }

  const data = await fetcher();
  setCacheEntry(ohlcvCache, key, data);
  return data;
};

export const fetchGeckoPoolSearch = async ({
  network = DEFAULT_NETWORK,
  query,
  signal,
  onUpdate,
} = {}) => {
  if (!query) return null;
  const key = createSearchKey({ network, query });
  const cached = getCacheEntry(searchCache, key);
  if (isFresh(cached, SEARCH_TTL)) {
    return cached.data;
  }

  const fetcher = async () => {
    const url = `${API_BASE}/search/pools?query=${encodeURIComponent(query)}&network=${network}`;
    return fetchJson(url, signal);
  };

  if (cached) {
    revalidateCache({
      cache: searchCache,
      key,
      fetcher,
    }).then((data) => {
      if (data && onUpdate) onUpdate(data);
    });
    return cached.data;
  }

  const data = await fetcher();
  setCacheEntry(searchCache, key, data);
  return data;
};

export const selectHighestLiquidityPool = (searchResult) => {
  const pools = searchResult?.data ?? [];
  if (!Array.isArray(pools) || pools.length === 0) return null;
  const sorted = [...pools].sort((a, b) => {
    const aLiq = Number(a?.attributes?.reserve_in_usd || 0);
    const bLiq = Number(b?.attributes?.reserve_in_usd || 0);
    return bLiq - aLiq;
  });
  return sorted[0] ?? null;
};
