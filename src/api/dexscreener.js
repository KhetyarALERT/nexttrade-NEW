/**
 * DexScreener API Service - Frontend Only
 * 
 * Official API Documentation: https://docs.dexscreener.com/api/reference
 * 
 * All endpoints are public and do not require authentication.
 * Rate limits vary by endpoint (60-300 requests per minute).
 * 
 * API Endpoints (as of 2024):
 * - GET /token-profiles/latest/v1 - Latest token profiles (60 req/min)
 * - GET /token-boosts/latest/v1 - Latest boosted tokens (60 req/min)  
 * - GET /token-boosts/top/v1 - Top boosted tokens (60 req/min)
 * - GET /tokens/v1/:chainId/:tokenAddresses - Get tokens by addresses (300 req/min)
 * - GET /token-pairs/v1/:chainId/:tokenAddress - Get pairs by token (300 req/min)
 * - GET /latest/dex/search?q=:q - Search pairs (300 req/min)
 * - GET /latest/dex/pairs/:chainId/:pairId - Get pair by address (300 req/min)
 */

const DEXSCREENER_API = 'https://api.dexscreener.com';

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

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

/**
 * Format large numbers for display
 */
export function formatNumber(num) {
  if (num === null || num === undefined) return '—';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

/**
 * Format price with appropriate decimals
 */
export function formatPrice(price) {
  if (price === null || price === undefined) return '—';
  if (price < 0.00001) return price.toExponential(2);
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  return price.toFixed(2);
}

/**
 * Transform DexScreener pair data to our token format
 */
function transformPairToToken(pair) {
  return {
    id: pair.pairAddress,
    mint: pair.baseToken?.address,
    pairAddress: pair.pairAddress,
    symbol: pair.baseToken?.symbol || 'UNKNOWN',
    name: pair.baseToken?.name || 'Unknown Token',
    
    // Pricing data
    price: parseFloat(pair.priceUsd) || 0,
    priceNative: parseFloat(pair.priceNative) || 0,
    priceChange5m: pair.priceChange?.m5 || 0,
    priceChange1h: pair.priceChange?.h1 || 0,
    priceChange6h: pair.priceChange?.h6 || 0,
    priceChange24h: pair.priceChange?.h24 || 0,
    
    // Volume & liquidity
    volume5m: pair.volume?.m5 || 0,
    volume1h: pair.volume?.h1 || 0,
    volume6h: pair.volume?.h6 || 0,
    volume24h: pair.volume?.h24 || 0,
    liquidity: pair.liquidity?.usd || 0,
    marketCap: pair.fdv || pair.marketCap || 0,
    
    // Transaction data
    txns5m: { buys: pair.txns?.m5?.buys || 0, sells: pair.txns?.m5?.sells || 0 },
    txns1h: { buys: pair.txns?.h1?.buys || 0, sells: pair.txns?.h1?.sells || 0 },
    txns24h: { buys: pair.txns?.h24?.buys || 0, sells: pair.txns?.h24?.sells || 0 },
    
    // DEX info
    dexId: pair.dexId,
    dexUrl: pair.url,
    
    // Token metadata
    imageUrl: pair.info?.imageUrl || null,
    websites: pair.info?.websites || [],
    socials: pair.info?.socials || [],
    
    // Timestamps
    pairCreatedAt: pair.pairCreatedAt,
    
    // Source
    source: 'dexscreener'
  };
}

/**
 * Get trending Solana tokens using search endpoint
 * This is more reliable than token-specific endpoints
 * API: GET /latest/dex/search?q=SOL
 */
export async function fetchTrendingSolanaTokens(limit = 50) {
  const cacheKey = `trending_${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // Use search endpoint with common Solana DEX names to get active pairs
    // This is more reliable than deprecated token endpoints
    const response = await fetch(`${DEXSCREENER_API}/latest/dex/search?q=solana`, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'NextTrade/1.0'
      }
    });

    if (!response.ok) {
      console.error(`[DexScreener] API error: ${response.status} ${response.statusText}`);
      throw new Error(`DexScreener API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[DexScreener] Search response:', { pairsCount: data?.pairs?.length || 0 });
    
    // Filter and format Solana pairs with good liquidity
    const tokens = (data.pairs || [])
      .filter(pair => 
        pair.chainId === 'solana' &&
        (pair.liquidity?.usd || 0) > 1000 // Lower threshold
      )
      .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0)) // Sort by 24h volume
      .slice(0, limit)
      .map(transformPairToToken);

    if (tokens.length > 0) {
      setCache(cacheKey, tokens);
    }
    
    console.log('[DexScreener] Filtered tokens:', tokens.length);
    return tokens;

  } catch (error) {
    console.error('[DexScreener] Failed to fetch trending tokens:', error);
    // Try fallback method
    return fetchTrendingFallback(limit);
  }
}

/**
 * Fallback method: Get tokens from boosted/promoted list
 * API: GET /token-boosts/top/v1
 */
async function fetchTrendingFallback(limit = 50) {
  try {
    console.log('[DexScreener] Trying fallback: boosted tokens');
    
    const response = await fetch(`${DEXSCREENER_API}/token-boosts/top/v1`, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'NextTrade/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[DexScreener] Boosted tokens response:', { count: data?.length || 0 });
    
    // Filter for Solana and get pair details
    const solanaTokens = (data || [])
      .filter(t => t.chainId === 'solana')
      .slice(0, limit);

    if (solanaTokens.length === 0) {
      console.log('[DexScreener] No Solana tokens in boosted list, trying profiles');
      return fetchFromProfiles(limit);
    }

    // Get full pair data for each token
    const tokensWithData = await Promise.all(
      solanaTokens.slice(0, 20).map(async (token) => {
        try {
          const pairData = await fetchTokenPairs(token.tokenAddress);
          if (pairData && pairData.length > 0) {
            return transformPairToToken(pairData[0]);
          }
          return null;
        } catch {
          return null;
        }
      })
    );

    return tokensWithData.filter(Boolean);

  } catch (error) {
    console.error('[DexScreener] Fallback failed:', error);
    return fetchFromProfiles(limit);
  }
}

/**
 * Get token pairs by token address
 * API: GET /token-pairs/v1/:chainId/:tokenAddress
 */
async function fetchTokenPairs(tokenAddress) {
  try {
    const response = await fetch(
      `${DEXSCREENER_API}/token-pairs/v1/solana/${tokenAddress}`,
      { 
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'NextTrade/1.0'
        }
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.pairs || data || [];

  } catch (error) {
    console.error('[DexScreener] Failed to fetch token pairs:', error);
    return null;
  }
}

/**
 * Fallback: Get tokens from latest profiles
 * API: GET /token-profiles/latest/v1
 */
async function fetchFromProfiles(limit = 50) {
  try {
    console.log('[DexScreener] Trying profiles fallback');
    
    const response = await fetch(`${DEXSCREENER_API}/token-profiles/latest/v1`, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'NextTrade/1.0'
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    console.log('[DexScreener] Profiles response:', { count: data?.length || 0 });
    
    // Filter for Solana tokens
    const solanaProfiles = (data || [])
      .filter(t => t.chainId === 'solana')
      .slice(0, limit);

    if (solanaProfiles.length === 0) return [];

    // Get pair data for each profile
    const tokensWithData = await Promise.all(
      solanaProfiles.slice(0, 20).map(async (profile) => {
        try {
          const pairData = await fetchTokenPairs(profile.tokenAddress);
          if (pairData && pairData.length > 0) {
            const token = transformPairToToken(pairData[0]);
            token.imageUrl = profile.icon || token.imageUrl;
            token.description = profile.description;
            return token;
          }
          return {
            id: profile.tokenAddress,
            mint: profile.tokenAddress,
            symbol: profile.header?.split(' ')[0] || 'UNKNOWN',
            name: profile.header || 'Unknown',
            description: profile.description || '',
            imageUrl: profile.icon,
            price: 0,
            source: 'dexscreener'
          };
        } catch {
          return null;
        }
      })
    );

    return tokensWithData.filter(Boolean);

  } catch (error) {
    console.error('[DexScreener] Profiles fallback failed:', error);
    return [];
  }
}

/**
 * Search for tokens on DexScreener
 * API: GET /latest/dex/search?q={query}
 */
export async function searchTokens(query) {
  if (!query || query.length < 2) return [];

  const cacheKey = `search_${query.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${DEXSCREENER_API}/latest/dex/search?q=${encodeURIComponent(query)}`,
      { 
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'NextTrade/1.0'
        }
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    
    // Filter for Solana only
    const results = (data.pairs || [])
      .filter(pair => pair.chainId === 'solana')
      .slice(0, 30)
      .map(transformPairToToken);

    if (results.length > 0) {
      setCache(cacheKey, results);
    }
    return results;

  } catch (error) {
    console.error('[DexScreener] Search failed:', error);
    return [];
  }
}

/**
 * Get token pair details by pair address
 * API: GET /latest/dex/pairs/:chainId/:pairAddress
 */
export async function fetchPairDetails(pairAddress) {
  if (!pairAddress) return null;

  const cacheKey = `pair_${pairAddress}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${DEXSCREENER_API}/latest/dex/pairs/solana/${pairAddress}`,
      { 
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'NextTrade/1.0'
        }
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const pair = data.pairs?.[0] || data.pair;
    if (!pair) return null;

    const formatted = transformPairToToken(pair);
    setCache(cacheKey, formatted);
    return formatted;

  } catch (error) {
    console.error('[DexScreener] Failed to fetch pair details:', error);
    return null;
  }
}

/**
 * Get token info by token address (mint)
 * API: GET /token-pairs/v1/:chainId/:tokenAddress
 */
export async function fetchTokenByMint(mintAddress) {
  if (!mintAddress) return null;

  const cacheKey = `token_${mintAddress}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const pairs = await fetchTokenPairs(mintAddress);
    if (!pairs || pairs.length === 0) return null;

    // Get the pair with most liquidity
    const bestPair = pairs.reduce((best, current) => {
      return (current.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? current : best;
    }, pairs[0]);

    const formatted = transformPairToToken(bestPair);
    formatted.allPairs = pairs.length;
    
    setCache(cacheKey, formatted);
    return formatted;

  } catch (error) {
    console.error('[DexScreener] Failed to fetch token:', error);
    return null;
  }
}

/**
 * Get latest token profiles (tokens with updated social info)
 * API: GET /token-profiles/latest/v1
 */
export async function fetchLatestProfiles() {
  const cacheKey = 'profiles_latest';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${DEXSCREENER_API}/token-profiles/latest/v1`, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'NextTrade/1.0'
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    
    // Filter for Solana tokens
    const tokens = (data || [])
      .filter(t => t.chainId === 'solana')
      .slice(0, 50)
      .map(token => ({
        id: token.tokenAddress,
        mint: token.tokenAddress,
        symbol: token.header?.split(' ')[0] || 'UNKNOWN',
        name: token.header || 'Unknown',
        description: token.description || '',
        imageUrl: token.icon,
        links: token.links || [],
        source: 'dexscreener'
      }));

    if (tokens.length > 0) {
      setCache(cacheKey, tokens);
    }
    return tokens;

  } catch (error) {
    console.error('[DexScreener] Failed to fetch latest profiles:', error);
    return [];
  }
}

/**
 * Get boosted/promoted tokens
 * API: GET /token-boosts/top/v1
 */
export async function fetchBoostedTokens() {
  const cacheKey = 'boosted_top';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${DEXSCREENER_API}/token-boosts/top/v1`, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'NextTrade/1.0'
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    
    // Filter for Solana tokens
    const tokens = (data || [])
      .filter(t => t.chainId === 'solana')
      .slice(0, 30);

    if (tokens.length > 0) {
      setCache(cacheKey, tokens);
    }
    return tokens;

  } catch (error) {
    console.error('[DexScreener] Failed to fetch boosted tokens:', error);
    return [];
  }
}

/**
 * Get tokens sorted by various metrics
 */
export async function fetchTopTokens(sortBy = 'volume24h', limit = 50) {
  const tokens = await fetchTrendingSolanaTokens(100);
  
  const sortFunctions = {
    volume24h: (a, b) => (b.volume24h || 0) - (a.volume24h || 0),
    marketCap: (a, b) => (b.marketCap || 0) - (a.marketCap || 0),
    liquidity: (a, b) => (b.liquidity || 0) - (a.liquidity || 0),
    priceChange24h: (a, b) => (b.priceChange24h || 0) - (a.priceChange24h || 0),
    newest: (a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0)
  };

  const sortFn = sortFunctions[sortBy] || sortFunctions.volume24h;
  return [...tokens].sort(sortFn).slice(0, limit);
}

/**
 * Get new token launches (recently created pairs)
 */
export async function fetchNewLaunches(limit = 30) {
  return fetchTopTokens('newest', limit);
}

/**
 * Get gainers (highest price increase)
 */
export async function fetchGainers(limit = 30) {
  return fetchTopTokens('priceChange24h', limit);
}

export default {
  fetchTrendingSolanaTokens,
  searchTokens,
  fetchPairDetails,
  fetchTokenByMint,
  fetchLatestProfiles,
  fetchBoostedTokens,
  fetchTopTokens,
  fetchNewLaunches,
  fetchGainers,
  formatNumber,
  formatPrice
};
