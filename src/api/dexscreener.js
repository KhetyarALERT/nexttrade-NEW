/**
 * DexScreener API Service - Frontend Only
 * 
 * Official API Documentation: https://docs.dexscreener.com/api/reference
 * 
 * All endpoints are public and do not require authentication.
 * Rate limits vary by endpoint (60-300 requests per minute).
 * 
 * Working API Endpoints:
 * - GET /token-profiles/latest/v1 - Latest token profiles with social info
 * - GET /token-boosts/latest/v1 - Latest boosted tokens  
 * - GET /token-boosts/top/v1 - Top boosted tokens by total boost amount
 * - GET /latest/dex/search?q=:q - Search pairs by token name/symbol
 * - GET /latest/dex/pairs/:chainId/:pairId - Get pair by address
 * - GET /orders/v1/:chainId/:tokenAddress - Get orders for a token
 */

const DEXSCREENER_API = 'https://api.dexscreener.com';

// Known meme coin symbols to search for
const MEME_SEARCH_TERMS = ['BONK', 'WIF', 'POPCAT', 'MEW', 'BOME', 'MYRO', 'SLERF', 'PENG', 'BOOK', 'MICHI'];

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 60000; // 60 seconds

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
 * Check if token is a stablecoin or wrapped token (to filter out)
 */
function isStablecoinOrWrapped(symbol) {
  const excluded = ['USDC', 'USDT', 'DAI', 'BUSD', 'SOL', 'WSOL', 'WETH', 'ETH', 'BTC', 'WBTC', 'MSOL', 'JSOL', 'BSOL', 'STSOL'];
  return excluded.includes(symbol?.toUpperCase());
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
 * Search for a specific token by symbol
 */
async function searchBySymbol(symbol) {
  try {
    const response = await fetch(`${DEXSCREENER_API}/latest/dex/search?q=${encodeURIComponent(symbol)}`, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'NextTrade/1.0'
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    
    // Filter for Solana pairs only, exclude stablecoins, require liquidity
    return (data.pairs || [])
      .filter(pair => 
        pair.chainId === 'solana' &&
        !isStablecoinOrWrapped(pair.baseToken?.symbol) &&
        (pair.liquidity?.usd || 0) > 5000
      )
      .slice(0, 5); // Take top 5 for each search term

  } catch (error) {
    console.error(`[DexScreener] Search failed for ${symbol}:`, error);
    return [];
  }
}

/**
 * Get trending Solana meme coins
 * Searches for popular meme coin symbols and aggregates results
 */
export async function fetchTrendingSolanaTokens(limit = 50) {
  const cacheKey = `trending_${limit}`;
  const cached = getCached(cacheKey);
  if (cached && cached.length > 0) {
    console.log('[DexScreener] Returning cached tokens:', cached.length);
    return cached;
  }

  try {
    console.log('[DexScreener] Fetching trending tokens...');
    
    // Method 1: Search for known meme coins
    const searchPromises = MEME_SEARCH_TERMS.map(term => searchBySymbol(term));
    const searchResults = await Promise.all(searchPromises);
    
    // Flatten and deduplicate by pair address
    const seenPairs = new Set();
    let allPairs = [];
    
    for (const results of searchResults) {
      for (const pair of results) {
        if (!seenPairs.has(pair.pairAddress)) {
          seenPairs.add(pair.pairAddress);
          allPairs.push(pair);
        }
      }
    }

    console.log('[DexScreener] Meme coin search results:', allPairs.length);

    // Method 2: Also get boosted tokens as additional source
    try {
      const boostedResponse = await fetch(`${DEXSCREENER_API}/token-boosts/top/v1`, {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'NextTrade/1.0'
        }
      });

      if (boostedResponse.ok) {
        const boostedData = await boostedResponse.json();
        const solanaBoosted = (boostedData || [])
          .filter(t => t.chainId === 'solana')
          .slice(0, 20);

        console.log('[DexScreener] Boosted Solana tokens:', solanaBoosted.length);

        // Get pair data for boosted tokens
        for (const token of solanaBoosted) {
          try {
            const pairResponse = await fetch(
              `${DEXSCREENER_API}/latest/dex/search?q=${token.tokenAddress}`,
              { headers: { 'Accept': 'application/json', 'User-Agent': 'NextTrade/1.0' } }
            );
            
            if (pairResponse.ok) {
              const pairData = await pairResponse.json();
              const solanaPairs = (pairData.pairs || []).filter(p => 
                p.chainId === 'solana' && 
                !isStablecoinOrWrapped(p.baseToken?.symbol) &&
                !seenPairs.has(p.pairAddress)
              );
              
              for (const pair of solanaPairs.slice(0, 2)) {
                seenPairs.add(pair.pairAddress);
                allPairs.push(pair);
              }
            }
          } catch {
            // Skip failed individual fetches
          }
        }
      }
    } catch (e) {
      console.log('[DexScreener] Boosted fetch failed, continuing with search results');
    }

    // Method 3: Get latest token profiles
    try {
      const profilesResponse = await fetch(`${DEXSCREENER_API}/token-profiles/latest/v1`, {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'NextTrade/1.0'
        }
      });

      if (profilesResponse.ok) {
        const profilesData = await profilesResponse.json();
        const solanaProfiles = (profilesData || [])
          .filter(t => t.chainId === 'solana')
          .slice(0, 30);

        console.log('[DexScreener] Solana profiles:', solanaProfiles.length);

        // Get pair data for profiles
        for (const profile of solanaProfiles.slice(0, 15)) {
          try {
            const pairResponse = await fetch(
              `${DEXSCREENER_API}/latest/dex/search?q=${profile.tokenAddress}`,
              { headers: { 'Accept': 'application/json', 'User-Agent': 'NextTrade/1.0' } }
            );
            
            if (pairResponse.ok) {
              const pairData = await pairResponse.json();
              const solanaPairs = (pairData.pairs || []).filter(p => 
                p.chainId === 'solana' && 
                !isStablecoinOrWrapped(p.baseToken?.symbol) &&
                !seenPairs.has(p.pairAddress) &&
                (p.liquidity?.usd || 0) > 1000
              );
              
              for (const pair of solanaPairs.slice(0, 1)) {
                seenPairs.add(pair.pairAddress);
                // Add profile image if available
                pair.info = pair.info || {};
                pair.info.imageUrl = pair.info.imageUrl || profile.icon;
                allPairs.push(pair);
              }
            }
          } catch {
            // Skip failed individual fetches
          }
        }
      }
    } catch (e) {
      console.log('[DexScreener] Profiles fetch failed, continuing');
    }

    // Sort by 24h volume and transform
    const sortedPairs = allPairs
      .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
      .slice(0, limit);

    const tokens = sortedPairs.map(transformPairToToken);
    
    console.log('[DexScreener] Total tokens found:', tokens.length);

    if (tokens.length > 0) {
      setCache(cacheKey, tokens);
    }
    
    return tokens;

  } catch (error) {
    console.error('[DexScreener] Failed to fetch trending tokens:', error);
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
 * Uses search API to find pairs for the token
 */
export async function fetchTokenByMint(mintAddress) {
  if (!mintAddress) return null;

  const cacheKey = `token_${mintAddress}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // Search for the token by address
    const response = await fetch(
      `${DEXSCREENER_API}/latest/dex/search?q=${mintAddress}`,
      { 
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'NextTrade/1.0'
        }
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const pairs = (data.pairs || []).filter(p => p.chainId === 'solana');
    
    if (pairs.length === 0) return null;

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
