import type { PairDetails, TokenSummary } from './types';

const API_BASE = 'https://api.dexscreener.com';
const SOLANA_CHAIN = 'solana';

const safeNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeString = (value: unknown) => (typeof value === 'string' ? value : '');

const fetchJson = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error('Data source unavailable');
  }
  return response.json() as Promise<T>;
};

const mapPairToDetails = (pair: any): PairDetails => ({
  pairAddress: normalizeString(pair?.pairAddress || pair?.pairId || ''),
  chainId: normalizeString(pair?.chainId || SOLANA_CHAIN),
  dexId: normalizeString(pair?.dexId),
  url: normalizeString(pair?.url),
  baseToken: {
    address: normalizeString(pair?.baseToken?.address),
    symbol: normalizeString(pair?.baseToken?.symbol),
    name: normalizeString(pair?.baseToken?.name),
    decimals: pair?.baseToken?.decimals ?? null,
  },
  quoteToken: {
    address: normalizeString(pair?.quoteToken?.address),
    symbol: normalizeString(pair?.quoteToken?.symbol),
    name: normalizeString(pair?.quoteToken?.name),
    decimals: pair?.quoteToken?.decimals ?? null,
  },
  priceUsd: safeNumber(pair?.priceUsd),
  priceChange24h: safeNumber(pair?.priceChange?.h24),
  volume24h: safeNumber(pair?.volume?.h24),
  liquidityUsd: safeNumber(pair?.liquidity?.usd),
  marketCap: safeNumber(pair?.marketCap || pair?.fdv),
  pairCreatedAt: safeNumber(pair?.pairCreatedAt),
  txns24h: pair?.txns?.h24 ? { buys: pair.txns.h24.buys, sells: pair.txns.h24.sells } : null,
  info: pair?.info
    ? {
        imageUrl: pair.info.imageUrl ?? null,
        websites: pair.info.websites ?? [],
        socials: pair.info.socials ?? [],
      }
    : undefined,
});

const mapPairToTokenSummary = (pair: any): TokenSummary => ({
  address: normalizeString(pair?.baseToken?.address),
  symbol: normalizeString(pair?.baseToken?.symbol),
  name: normalizeString(pair?.baseToken?.name),
  chainId: normalizeString(pair?.chainId || SOLANA_CHAIN),
  imageUrl: pair?.info?.imageUrl ?? null,
  pairAddress: normalizeString(pair?.pairAddress),
  dexId: normalizeString(pair?.dexId),
  priceUsd: safeNumber(pair?.priceUsd),
  priceChange24h: safeNumber(pair?.priceChange?.h24),
  volume24h: safeNumber(pair?.volume?.h24),
  liquidityUsd: safeNumber(pair?.liquidity?.usd),
  marketCap: safeNumber(pair?.marketCap || pair?.fdv),
  pairCreatedAt: safeNumber(pair?.pairCreatedAt),
  websites: pair?.info?.websites ?? [],
  socials: pair?.info?.socials ?? [],
  txns24h: pair?.txns?.h24 ? { buys: pair.txns.h24.buys, sells: pair.txns.h24.sells } : null,
});

const mapProfileToSummary = (token: any): TokenSummary => ({
  address: normalizeString(token?.tokenAddress || token?.address || token?.baseToken?.address),
  symbol: normalizeString(token?.tokenSymbol || token?.symbol || token?.baseToken?.symbol),
  name: normalizeString(token?.tokenName || token?.name || token?.baseToken?.name),
  chainId: normalizeString(token?.chainId || token?.chain || token?.network || SOLANA_CHAIN),
  imageUrl: token?.icon || token?.imageUrl || token?.info?.imageUrl || null,
  pairAddress: normalizeString(token?.pairAddress || token?.pairId || token?.pair?.pairAddress),
  dexId: normalizeString(token?.dexId || token?.pair?.dexId),
  priceUsd: safeNumber(token?.priceUsd || token?.pair?.priceUsd),
  priceChange24h: safeNumber(token?.priceChange?.h24 || token?.pair?.priceChange?.h24),
  volume24h: safeNumber(token?.volume?.h24 || token?.pair?.volume?.h24),
  liquidityUsd: safeNumber(token?.liquidity?.usd || token?.pair?.liquidity?.usd),
  marketCap: safeNumber(token?.marketCap || token?.fdv || token?.pair?.marketCap),
  pairCreatedAt: safeNumber(token?.pairCreatedAt || token?.pair?.pairCreatedAt),
  websites: token?.websites || token?.info?.websites || [],
  socials: token?.socials || token?.info?.socials || [],
  txns24h: token?.txns?.h24
    ? { buys: token.txns.h24.buys, sells: token.txns.h24.sells }
    : token?.pair?.txns?.h24
      ? { buys: token.pair.txns.h24.buys, sells: token.pair.txns.h24.sells }
      : null,
});

const filterSolana = (items: TokenSummary[]) =>
  items.filter((item) => item.chainId === SOLANA_CHAIN && item.address);

export const fetchTrendingTokens = async (signal?: AbortSignal): Promise<TokenSummary[]> => {
  const [boostsResult, profilesResult] = await Promise.allSettled([
    fetchJson<any[]>(`${API_BASE}/token-boosts/top/v1`, signal),
    fetchJson<any[]>(`${API_BASE}/token-profiles/latest/v1`, signal),
  ]);

  if (boostsResult.status === 'rejected' && profilesResult.status === 'rejected') {
    throw new Error('Data source unavailable');
  }

  const boosts = boostsResult.status === 'fulfilled' ? boostsResult.value : [];
  const profiles = profilesResult.status === 'fulfilled' ? profilesResult.value : [];

  const merged = new Map<string, TokenSummary>();
  [...boosts, ...profiles].forEach((token) => {
    const summary = mapProfileToSummary(token);
    if (!summary.address) return;
    merged.set(summary.address, {
      ...merged.get(summary.address),
      ...summary,
    });
  });

  return filterSolana(Array.from(merged.values()));
};

export const fetchSearchTokens = async (query: string, signal?: AbortSignal): Promise<TokenSummary[]> => {
  if (!query) return [];
  const data = await fetchJson<{ pairs?: any[] }>(
    `${API_BASE}/latest/dex/search?q=${encodeURIComponent(query)}`,
    signal
  );
  const pairs = data?.pairs ?? [];
  return filterSolana(pairs.map(mapPairToTokenSummary));
};

export const fetchTokenPairs = async (tokenAddress: string, signal?: AbortSignal): Promise<PairDetails[]> => {
  if (!tokenAddress) return [];
  const data = await fetchJson<any[]>(
    `${API_BASE}/token-pairs/v1/${SOLANA_CHAIN}/${tokenAddress}`,
    signal
  );
  return (Array.isArray(data) ? data : []).map(mapPairToDetails);
};

export const fetchPairById = async (pairId: string, signal?: AbortSignal): Promise<PairDetails | null> => {
  if (!pairId) return null;
  const data = await fetchJson<{ pairs?: any[] }>(
    `${API_BASE}/latest/dex/pairs/${SOLANA_CHAIN}/${pairId}`,
    signal
  );
  const pair = data?.pairs?.[0];
  return pair ? mapPairToDetails(pair) : null;
};

export const mapPairDetailsToSummary = (pair: PairDetails): TokenSummary => ({
  address: pair.baseToken.address,
  symbol: pair.baseToken.symbol,
  name: pair.baseToken.name,
  chainId: pair.chainId,
  imageUrl: pair.info?.imageUrl ?? null,
  pairAddress: pair.pairAddress,
  dexId: pair.dexId ?? null,
  priceUsd: pair.priceUsd ?? null,
  priceChange24h: pair.priceChange24h ?? null,
  volume24h: pair.volume24h ?? null,
  liquidityUsd: pair.liquidityUsd ?? null,
  marketCap: pair.marketCap ?? null,
  pairCreatedAt: pair.pairCreatedAt ?? null,
  websites: pair.info?.websites ?? [],
  socials: pair.info?.socials ?? [],
  txns24h: pair.txns24h ?? null,
});
