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

const secondsForTimeframe = (timeframe, aggregate) => {
  switch (timeframe) {
    case 'hour':
      return 3600 * aggregate;
    case 'day':
      return 86400 * aggregate;
    case 'minute':
    default:
      return 60 * aggregate;
  }
};

const buildMockOhlcv = ({ timeframe, aggregate, limit }) => {
  const now = Math.floor(Date.now() / 1000);
  const step = secondsForTimeframe(timeframe, aggregate);
  const rows = [];
  let lastClose = 0.00018;

  for (let index = limit - 1; index >= 0; index -= 1) {
    const time = now - index * step;
    const wave = Math.sin((limit - index) / 6) * 0.00001;
    const open = lastClose;
    const close = Math.max(0.00001, open + wave);
    const high = Math.max(open, close) + Math.abs(wave) * 0.6;
    const low = Math.min(open, close) - Math.abs(wave) * 0.6;
    const volume = 400 + Math.abs(Math.cos((limit - index) / 3)) * 800;
    rows.push([time, open, high, low, close, volume]);
    lastClose = close;
  }

  return {
    data: {
      attributes: {
        ohlcv_list: rows,
      },
    },
  };
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
  onUpdate,
} = {}) => {
  if (!poolAddress) return null;
  const key = createOhlcvKey({ network, poolAddress, timeframe, aggregate, limit });
  const cached = getCacheEntry(ohlcvCache, key);
  if (isFresh(cached, OHLCV_TTL)) {
    return cached.data;
  }

  const fetcher = async () => buildMockOhlcv({ timeframe, aggregate, limit });

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
  onUpdate,
} = {}) => {
  if (!query) return null;
  const key = createSearchKey({ network, query });
  const cached = getCacheEntry(searchCache, key);
  if (isFresh(cached, SEARCH_TTL)) {
    return cached.data;
  }

  const fetcher = async () => ({
    data: [],
  });

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
