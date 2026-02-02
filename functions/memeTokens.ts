import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// =============================================================================
// MEME TOKENS API - DexScreener Migrated + Pump.fun Bonding Curve
// =============================================================================

const DEXSCREENER_API = 'https://api.dexscreener.com';
const PUMPFUN_API = 'https://frontend-api.pump.fun';

// In-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 20000; // 20 seconds

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// Rate limiting - max 3 concurrent requests
let activeRequests = 0;
const MAX_CONCURRENT = 3;
const requestQueue = [];

async function throttledFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const execute = async () => {
      activeRequests++;
      try {
        const res = await fetch(url, { 
          ...options, 
          headers: { 
            'User-Agent': 'NextTrade-MemeTerminal/1.0',
            ...options.headers 
          }
        });
        resolve(res);
      } catch (e) {
        reject(e);
      } finally {
        activeRequests--;
        if (requestQueue.length > 0) {
          const next = requestQueue.shift();
          next();
        }
      }
    };

    if (activeRequests < MAX_CONCURRENT) {
      execute();
    } else {
      requestQueue.push(execute);
    }
  });
}

// =============================================================================
// DEXSCREENER: Fetch latest Solana pairs with pagination
// =============================================================================

async function fetchDexScreenerLatest(targetCount = 200) {
  const cacheKey = 'dexscreener-latest';
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`[DEXSCREENER] Cache hit: ${cached.length} tokens`);
    return cached;
  }

  console.log(`[DEXSCREENER] Fetching latest Solana pairs, target: ${targetCount}`);
  const startTime = Date.now();
  
  try {
    // Strategy: Fetch from multiple endpoints to maximize coverage
    // 1. Latest pairs endpoint (sorted by creation time)
    // 2. Boosted/trending tokens
    // 3. Token profiles

    const [latestRes, boostsRes, profilesRes] = await Promise.all([
      throttledFetch(`${DEXSCREENER_API}/latest/dex/pairs/solana?limit=100`),
      throttledFetch(`${DEXSCREENER_API}/token-boosts/top/v1`),
      throttledFetch(`${DEXSCREENER_API}/token-profiles/latest/v1`)
    ]);

    const [latestData, boostsData, profilesData] = await Promise.all([
      latestRes.json().catch(() => ({ pairs: [] })),
      boostsRes.json().catch(() => []),
      profilesRes.json().catch(() => [])
    ]);

    // Build profile lookup
    const profileMap = new Map();
    if (Array.isArray(profilesData)) {
      profilesData.forEach(p => {
        if (p.chainId === 'solana') {
          profileMap.set(p.tokenAddress, p);
        }
      });
    }

    // Collect unique token addresses
    const tokenMap = new Map();
    
    // Process latest pairs first (most recent)
    const latestPairs = latestData.pairs || [];
    console.log(`[DEXSCREENER] Latest pairs returned: ${latestPairs.length}`);
    
    latestPairs.forEach(pair => {
      if (!pair.baseToken?.address || tokenMap.has(pair.baseToken.address)) return;
      tokenMap.set(pair.baseToken.address, normalizeDexPair(pair, profileMap));
    });

    // Add boosted tokens
    const solanaBoosts = (Array.isArray(boostsData) ? boostsData : [boostsData])
      .filter(t => t && t.chainId === 'solana');
    console.log(`[DEXSCREENER] Boosted tokens: ${solanaBoosts.length}`);

    // Fetch pair data for boosted tokens not in latest
    const missingBoosts = solanaBoosts.filter(t => !tokenMap.has(t.tokenAddress)).slice(0, 50);
    
    if (missingBoosts.length > 0) {
      const batchSize = 10;
      for (let i = 0; i < missingBoosts.length; i += batchSize) {
        const batch = missingBoosts.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (token) => {
            try {
              const pairRes = await throttledFetch(`${DEXSCREENER_API}/token-pairs/v1/solana/${token.tokenAddress}`);
              const pairs = await pairRes.json();
              if (Array.isArray(pairs) && pairs.length > 0) {
                const pair = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
                return normalizeDexPair(pair, profileMap, token.totalAmount);
              }
            } catch (e) {
              console.error(`[DEXSCREENER] Error fetching ${token.tokenAddress}:`, e.message);
            }
            return null;
          })
        );
        
        batchResults.filter(Boolean).forEach(token => {
          if (!tokenMap.has(token.mint)) {
            tokenMap.set(token.mint, token);
          }
        });
      }
    }

    // If we still need more, fetch trending/volume pairs
    if (tokenMap.size < targetCount) {
      console.log(`[DEXSCREENER] Need more tokens, fetching trending...`);
      try {
        const trendingRes = await throttledFetch(`${DEXSCREENER_API}/latest/dex/tokens/solana`);
        const trendingData = await trendingRes.json().catch(() => []);
        
        if (Array.isArray(trendingData)) {
          trendingData.slice(0, 100).forEach(token => {
            if (token.pairs && token.pairs[0] && !tokenMap.has(token.pairs[0].baseToken?.address)) {
              const pair = token.pairs[0];
              tokenMap.set(pair.baseToken.address, normalizeDexPair(pair, profileMap));
            }
          });
        }
      } catch (e) {
        console.error('[DEXSCREENER] Trending fetch failed:', e.message);
      }
    }

    const tokens = Array.from(tokenMap.values())
      .filter(t => t && t.mint)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, targetCount);

    const elapsed = Date.now() - startTime;
    console.log(`[DEXSCREENER] Complete: ${tokens.length} tokens in ${elapsed}ms`);
    console.log(`[DEXSCREENER] Newest: ${tokens[0]?.symbol} (${new Date(tokens[0]?.createdAt).toISOString()})`);
    console.log(`[DEXSCREENER] Oldest: ${tokens[tokens.length-1]?.symbol} (${new Date(tokens[tokens.length-1]?.createdAt).toISOString()})`);

    setCache(cacheKey, tokens);
    return tokens;
  } catch (error) {
    console.error('[DEXSCREENER] Fatal error:', error);
    return [];
  }
}

function normalizeDexPair(pair, profileMap, boostAmount = 0) {
  if (!pair || !pair.baseToken) return null;
  
  const profile = profileMap.get(pair.baseToken.address);
  const socials = pair.info?.socials || [];
  const twitter = socials.find(s => s.platform === 'twitter')?.handle;
  const telegram = socials.find(s => s.platform === 'telegram')?.handle;
  const website = pair.info?.websites?.[0]?.url;

  // Determine status - pumpswap = migrated from pump, raydium = migrated
  const isMigrated = pair.dexId !== 'pumpfun' || pair.dexId === 'pumpswap' || pair.dexId === 'raydium';

  return {
    mint: pair.baseToken.address,
    symbol: pair.baseToken.symbol || 'UNKNOWN',
    name: pair.baseToken.name || 'Unknown Token',
    image_url: pair.info?.imageUrl || profile?.icon || '',
    price_usd: parseFloat(pair.priceUsd) || 0,
    market_cap: pair.marketCap || pair.fdv || 0,
    liquidity: pair.liquidity?.usd || 0,
    volume24h: pair.volume?.h24 || 0,
    volume5m: pair.volume?.m5 || 0,
    volume1h: pair.volume?.h1 || 0,
    priceChange5m: pair.priceChange?.m5 || 0,
    priceChange1h: pair.priceChange?.h1 || 0,
    priceChange6h: pair.priceChange?.h6 || 0,
    priceChange24h: pair.priceChange?.h24 || 0,
    buys_5m: pair.txns?.m5?.buys || 0,
    sells_5m: pair.txns?.m5?.sells || 0,
    buys_1h: pair.txns?.h1?.buys || 0,
    sells_1h: pair.txns?.h1?.sells || 0,
    buys_24h: pair.txns?.h24?.buys || 0,
    sells_24h: pair.txns?.h24?.sells || 0,
    holders: 0,
    twitter: twitter ? `https://twitter.com/${twitter}` : null,
    telegram: telegram ? `https://t.me/${telegram}` : null,
    website: website || null,
    dexId: pair.dexId,
    pairAddress: pair.pairAddress,
    createdAt: pair.pairCreatedAt || Date.now(),
    bonding_curve_status: isMigrated ? 'migrated' : 'bonding_curve',
    boostAmount: boostAmount || 0,
    source: 'dexscreener'
  };
}

// =============================================================================
// PUMP.FUN: Fetch latest bonding curve coins
// =============================================================================

async function fetchPumpFunCoins(targetCount = 100) {
  const cacheKey = 'pumpfun-bonding';
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`[PUMPFUN] Cache hit: ${cached.length} tokens`);
    return cached;
  }

  console.log(`[PUMPFUN] Fetching bonding curve coins, target: ${targetCount}`);
  const startTime = Date.now();
  
  try {
    // Pump.fun frontend API endpoints
    // /coins endpoint returns latest coins in bonding curve stage
    const response = await throttledFetch(`${PUMPFUN_API}/coins?offset=0&limit=${Math.min(targetCount, 50)}&sort=created_timestamp&order=DESC&includeNsfw=false`);
    
    if (!response.ok) {
      console.error(`[PUMPFUN] API returned ${response.status}`);
      // Fallback: try alternative endpoint
      return await fetchPumpFunFallback(targetCount);
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      console.error('[PUMPFUN] Unexpected response format');
      return await fetchPumpFunFallback(targetCount);
    }

    const tokens = data.map(coin => normalizePumpCoin(coin)).filter(Boolean);
    
    const elapsed = Date.now() - startTime;
    console.log(`[PUMPFUN] Complete: ${tokens.length} tokens in ${elapsed}ms`);
    if (tokens.length > 0) {
      console.log(`[PUMPFUN] Newest: ${tokens[0]?.symbol} (${new Date(tokens[0]?.createdAt).toISOString()})`);
    }

    setCache(cacheKey, tokens);
    return tokens;
  } catch (error) {
    console.error('[PUMPFUN] Error:', error.message);
    return await fetchPumpFunFallback(targetCount);
  }
}

// Fallback: Use DexScreener to find pump.fun bonding curve pairs
async function fetchPumpFunFallback(targetCount = 100) {
  console.log('[PUMPFUN] Using DexScreener fallback for bonding curve tokens');
  
  try {
    // Search DexScreener for pumpfun dex pairs
    const res = await throttledFetch(`${DEXSCREENER_API}/latest/dex/pairs/solana?limit=100`);
    const data = await res.json();
    
    const pumpPairs = (data.pairs || [])
      .filter(p => p.dexId === 'pumpfun' || p.labels?.includes('pump'))
      .slice(0, targetCount);

    const tokens = pumpPairs.map(pair => {
      const normalized = normalizeDexPair(pair, new Map());
      if (normalized) {
        normalized.bonding_curve_status = 'bonding_curve';
        normalized.source = 'dexscreener-pump';
      }
      return normalized;
    }).filter(Boolean);

    console.log(`[PUMPFUN-FALLBACK] Found ${tokens.length} bonding curve tokens`);
    return tokens;
  } catch (e) {
    console.error('[PUMPFUN-FALLBACK] Error:', e.message);
    return [];
  }
}

function normalizePumpCoin(coin) {
  if (!coin || !coin.mint) return null;

  // Calculate progress through bonding curve (0-100%)
  // Pump.fun bonding curve completes at ~$69k market cap
  const bondingProgress = Math.min(100, ((coin.usd_market_cap || 0) / 69000) * 100);

  return {
    mint: coin.mint,
    symbol: coin.symbol || 'UNKNOWN',
    name: coin.name || 'Unknown Token',
    image_url: coin.image_uri || `https://pump.fun/${coin.mint}/image`,
    description: coin.description || '',
    price_usd: coin.usd_market_cap ? (coin.usd_market_cap / 1000000000) : 0, // Rough estimate
    market_cap: coin.usd_market_cap || 0,
    liquidity: coin.virtual_sol_reserves ? coin.virtual_sol_reserves * 200 : 0, // SOL price estimate
    volume24h: 0, // Not available from pump.fun API
    volume5m: 0,
    priceChange5m: 0,
    priceChange1h: 0,
    priceChange24h: 0,
    buys_5m: 0,
    sells_5m: 0,
    buys_1h: 0,
    sells_1h: 0,
    buys_24h: coin.total_supply ? Math.floor(coin.total_supply / 1000000) : 0,
    sells_24h: 0,
    holders: 0,
    twitter: coin.twitter ? `https://twitter.com/${coin.twitter}` : null,
    telegram: coin.telegram ? `https://t.me/${coin.telegram}` : null,
    website: coin.website || null,
    dexId: 'pumpfun',
    pairAddress: null,
    createdAt: coin.created_timestamp || Date.now(),
    bonding_curve_status: 'bonding_curve',
    bondingProgress: bondingProgress,
    king_of_the_hill_timestamp: coin.king_of_the_hill_timestamp,
    is_currently_live: coin.is_currently_live || false,
    source: 'pumpfun'
  };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'getMigrated';

    // =========================================================================
    // GET MIGRATED (DEXSCREENER) - Post-migration coins on Raydium/etc
    // =========================================================================
    if (action === 'getMigrated' || action === 'getTrending') {
      const targetCount = body.limit || 200;
      const tokens = await fetchDexScreenerLatest(targetCount);

      return Response.json({
        ok: true,
        data: tokens,
        meta: { 
          source: 'dexscreener', 
          count: tokens.length,
          timestamp: Date.now(),
          cacheHit: getCached('dexscreener-latest') !== null
        }
      });
    }

    // =========================================================================
    // GET PUMPFUN BONDING CURVE - Pre-migration coins still on pump.fun
    // =========================================================================
    if (action === 'getPumpFun' || action === 'getBonding') {
      const targetCount = body.limit || 100;
      const tokens = await fetchPumpFunCoins(targetCount);

      return Response.json({
        ok: true,
        data: tokens,
        meta: { 
          source: 'pumpfun', 
          count: tokens.length,
          timestamp: Date.now(),
          cacheHit: getCached('pumpfun-bonding') !== null
        }
      });
    }

    // =========================================================================
    // GET SINGLE TOKEN
    // =========================================================================
    if (action === 'getToken') {
      const { mint } = body;
      if (!mint) {
        return Response.json({ ok: false, error: 'mint required' }, { status: 400 });
      }

      const pairRes = await throttledFetch(`${DEXSCREENER_API}/token-pairs/v1/solana/${mint}`);
      const pairs = await pairRes.json();

      if (!Array.isArray(pairs) || pairs.length === 0) {
        return Response.json({ ok: false, error: 'Token not found' }, { status: 404 });
      }

      const pair = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      const token = normalizeDexPair(pair, new Map());

      return Response.json({ ok: true, data: token });
    }

    // =========================================================================
    // SEARCH TOKENS
    // =========================================================================
    if (action === 'searchTokens') {
      const { query } = body;
      if (!query) {
        return Response.json({ ok: false, error: 'query required' }, { status: 400 });
      }

      const searchRes = await throttledFetch(`${DEXSCREENER_API}/latest/dex/search?q=${encodeURIComponent(query)}`);
      const searchData = await searchRes.json();

      const solanaPairs = (searchData.pairs || [])
        .filter(p => p.chainId === 'solana')
        .slice(0, 20);

      const tokens = solanaPairs.map(pair => normalizeDexPair(pair, new Map())).filter(Boolean);

      return Response.json({ ok: true, data: tokens });
    }

    return Response.json({ ok: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[MEMETOKENS] Fatal error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});