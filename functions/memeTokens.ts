import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// =============================================================================
// MEME TOKENS API - Multi-source aggregation for Solana meme coins
// =============================================================================
// Data Sources:
// 1. DexScreener API - For migrated tokens (Raydium, Meteora, PumpSwap)
// 2. PumpPortal API - For Pump.fun bonding curve tokens
// 3. Helius Token API - Backup for additional token data
// =============================================================================

const DEXSCREENER_API = 'https://api.dexscreener.com';
const PUMPFUN_ADVANCED_API = 'https://advanced-api-v2.pump.fun';
const PUMPFUN_FRONTEND_API = 'https://frontend-api-v2.pump.fun';

// In-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 15000; // 15 seconds

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

// Rate limiting
let activeRequests = 0;
const MAX_CONCURRENT = 5;
const requestQueue = [];

async function throttledFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const execute = async () => {
      activeRequests++;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        
        const res = await fetch(url, { 
          ...options, 
          signal: controller.signal,
          headers: { 
            'User-Agent': 'NextTrade-MemeTerminal/1.0',
            'Accept': 'application/json',
            ...options.headers 
          }
        });
        clearTimeout(timeout);
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
// DEXSCREENER: Fetch Solana tokens using multiple strategies
// =============================================================================

async function fetchDexScreenerTokens(targetCount = 200) {
  const cacheKey = 'dexscreener-tokens';
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`[DEXSCREENER] Cache hit: ${cached.length} tokens`);
    return cached;
  }

  console.log(`[DEXSCREENER] Fetching Solana tokens, target: ${targetCount}`);
  const startTime = Date.now();
  const tokenMap = new Map();

  try {
    // Strategy 1: Search for popular Solana meme tokens
    // These queries return the most active pairs
    const searchQueries = ['SOL', 'pump', 'meme', 'pepe', 'doge', 'cat', 'ai'];
    
    // Strategy 2: Get boosted/trending tokens
    const [boostsRes, profilesRes] = await Promise.all([
      throttledFetch(`${DEXSCREENER_API}/token-boosts/top/v1`).catch(() => ({ ok: false })),
      throttledFetch(`${DEXSCREENER_API}/token-profiles/latest/v1`).catch(() => ({ ok: false }))
    ]);

    let boostsData = [];
    let profilesData = [];

    if (boostsRes.ok) {
      boostsData = await boostsRes.json().catch(() => []);
    }
    if (profilesRes.ok) {
      profilesData = await profilesRes.json().catch(() => []);
    }

    // Build profile lookup
    const profileMap = new Map();
    if (Array.isArray(profilesData)) {
      profilesData.forEach(p => {
        if (p.chainId === 'solana') {
          profileMap.set(p.tokenAddress, p);
        }
      });
    }

    // Process boosted tokens (these are confirmed active)
    const solanaBoosts = (Array.isArray(boostsData) ? boostsData : [boostsData])
      .filter(t => t && t.chainId === 'solana');
    
    console.log(`[DEXSCREENER] Boosted tokens: ${solanaBoosts.length}`);

    // Fetch detailed data for boosted tokens in batches
    const batchSize = 10;
    for (let i = 0; i < Math.min(solanaBoosts.length, 100); i += batchSize) {
      const batch = solanaBoosts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (token) => {
          if (tokenMap.has(token.tokenAddress)) return null;
          try {
            const pairRes = await throttledFetch(`${DEXSCREENER_API}/tokens/v1/solana/${token.tokenAddress}`);
            const data = await pairRes.json();
            
            // Handle both array and direct pair responses
            const pairs = Array.isArray(data) ? data : (data.pairs || [data]);
            if (pairs.length > 0) {
              const pair = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
              return normalizeDexPair(pair, profileMap, token.totalAmount);
            }
          } catch (e) {
            // Silently skip failed fetches
          }
          return null;
        })
      );
      
      batchResults.filter(Boolean).forEach(token => {
        if (token && !tokenMap.has(token.mint)) {
          tokenMap.set(token.mint, token);
        }
      });
    }

    // Strategy 3: Search queries to find more tokens
    if (tokenMap.size < targetCount) {
      console.log(`[DEXSCREENER] Searching for more tokens (have ${tokenMap.size})...`);
      
      // Run multiple searches in parallel for speed
      const searchPromises = searchQueries.map(async (query) => {
        try {
          const searchRes = await throttledFetch(`${DEXSCREENER_API}/latest/dex/search?q=${query}`);
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            return (searchData.pairs || [])
              .filter(p => p.chainId === 'solana')
              .slice(0, 50);
          }
        } catch (e) {
          console.error(`[DEXSCREENER] Search "${query}" failed:`, e.message);
        }
        return [];
      });
      
      const searchResults = await Promise.all(searchPromises);
      searchResults.forEach((pairs, i) => {
        console.log(`[DEXSCREENER] Search "${searchQueries[i]}" returned ${pairs.length} pairs`);
        pairs.forEach(pair => {
          const token = normalizeDexPair(pair, profileMap);
          if (token && !tokenMap.has(token.mint)) {
            tokenMap.set(token.mint, token);
          }
        });
      });
    }

    // Strategy 4: Fetch latest Solana pairs (sorted by various metrics)
    if (tokenMap.size < targetCount) {
      // Fetch latest pairs by multiple sort orders
      const sortQueries = [
        'trending',
        'volume', 
        'liquidity'
      ];
      
      const pairPromises = sortQueries.map(async (sort) => {
        try {
          // Use pairs endpoint with chainId filter
          const url = sort === 'trending' 
            ? `${DEXSCREENER_API}/latest/dex/pairs/solana`
            : `${DEXSCREENER_API}/latest/dex/pairs/solana`;
          const pairRes = await throttledFetch(url);
          if (pairRes.ok) {
            const pairData = await pairRes.json();
            return { sort, pairs: (pairData.pairs || []).slice(0, 100) };
          }
        } catch (e) {
          console.error(`[DEXSCREENER] Pairs "${sort}" failed:`, e.message);
        }
        return { sort, pairs: [] };
      });
      
      const pairResults = await Promise.all(pairPromises);
      pairResults.forEach(({ sort, pairs }) => {
        console.log(`[DEXSCREENER] Pairs "${sort}" returned ${pairs.length} pairs`);
        pairs.forEach(pair => {
          const token = normalizeDexPair(pair, profileMap);
          if (token && !tokenMap.has(token.mint)) {
            tokenMap.set(token.mint, token);
          }
        });
      });
    }
    
    // Strategy 5: Search for specific trending terms
    if (tokenMap.size < targetCount) {
      const trendingSearches = ['trump', 'elon', 'fartcoin', 'bonk', 'wif', 'jup', 'jto'];
      
      const trendingPromises = trendingSearches.map(async (term) => {
        try {
          const searchRes = await throttledFetch(`${DEXSCREENER_API}/latest/dex/search?q=${term}`);
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            return (searchData.pairs || [])
              .filter(p => p.chainId === 'solana')
              .slice(0, 30);
          }
        } catch (e) {
          // Silently fail
        }
        return [];
      });
      
      const trendingResults = await Promise.all(trendingPromises);
      let added = 0;
      trendingResults.forEach((pairs) => {
        pairs.forEach(pair => {
          const token = normalizeDexPair(pair, profileMap);
          if (token && !tokenMap.has(token.mint)) {
            tokenMap.set(token.mint, token);
            added++;
          }
        });
      });
      console.log(`[DEXSCREENER] Trending searches added ${added} tokens`);
    }

    const tokens = Array.from(tokenMap.values())
      .filter(t => t && t.mint && (t.liquidity > 0 || t.market_cap > 0 || t.volume24h > 0))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, targetCount);

    const elapsed = Date.now() - startTime;
    console.log(`[DEXSCREENER] Complete: ${tokens.length} tokens in ${elapsed}ms`);
    
    if (tokens.length > 0) {
      console.log(`[DEXSCREENER] Newest: ${tokens[0]?.symbol} created ${new Date(tokens[0]?.createdAt).toISOString()}`);
      console.log(`[DEXSCREENER] Oldest: ${tokens[tokens.length-1]?.symbol} created ${new Date(tokens[tokens.length-1]?.createdAt).toISOString()}`);
    }

    setCache(cacheKey, tokens);
    return tokens;
  } catch (error) {
    console.error('[DEXSCREENER] Fatal error:', error);
    return getCached(cacheKey) || [];
  }
}

function normalizeDexPair(pair, profileMap = new Map(), boostAmount = 0) {
  if (!pair) return null;
  
  // Handle different response formats
  const baseToken = pair.baseToken || { address: pair.tokenAddress, symbol: pair.symbol, name: pair.name };
  if (!baseToken.address) return null;
  
  const profile = profileMap.get(baseToken.address);
  const socials = pair.info?.socials || [];
  const twitter = socials.find(s => s.platform === 'twitter')?.handle;
  const telegram = socials.find(s => s.platform === 'telegram')?.handle;
  const website = pair.info?.websites?.[0]?.url;

  // Determine if migrated
  const dexId = pair.dexId || '';
  const isMigrated = dexId !== 'pumpfun' || dexId.includes('swap') || dexId === 'raydium' || dexId === 'meteora';

  return {
    mint: baseToken.address,
    symbol: baseToken.symbol || 'UNKNOWN',
    name: baseToken.name || 'Unknown Token',
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
    dexId: dexId,
    pairAddress: pair.pairAddress,
    createdAt: pair.pairCreatedAt || Date.now(),
    bonding_curve_status: isMigrated ? 'migrated' : 'bonding_curve',
    boostAmount: boostAmount || 0,
    source: 'dexscreener'
  };
}

// =============================================================================
// PUMP.FUN: Fetch bonding curve tokens from official API
// =============================================================================

async function fetchPumpFunTokens(targetCount = 200) {
  const cacheKey = 'pumpfun-tokens';
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`[PUMPFUN] Cache hit: ${cached.length} tokens`);
    return cached;
  }

  console.log(`[PUMPFUN] Fetching bonding curve tokens, target: ${targetCount}`);
  const startTime = Date.now();
  const tokenMap = new Map();

  // Strategy 1: Try the advanced API with sort by creation time
  try {
    const advancedRes = await throttledFetch(
      `${PUMPFUN_ADVANCED_API}/coins/list?sortBy=creationTime&direction=desc`,
      { headers: { 'Accept': 'application/json' } }
    );
    
    if (advancedRes.ok) {
      const contentType = advancedRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await advancedRes.json();
        const coins = data.coins || data || [];
        
        if (Array.isArray(coins) && coins.length > 0) {
          console.log(`[PUMPFUN] Advanced API returned ${coins.length} coins`);
          
          coins.forEach(coin => {
            const token = normalizePumpFunCoin(coin);
            if (token && !tokenMap.has(token.mint)) {
              tokenMap.set(token.mint, token);
            }
          });
        }
      }
    } else {
      console.log(`[PUMPFUN] Advanced API status: ${advancedRes.status}`);
    }
  } catch (e) {
    console.error('[PUMPFUN] Advanced API error:', e.message);
  }

  // Strategy 2: Try the frontend API for latest coins
  if (tokenMap.size < targetCount) {
    try {
      const frontendRes = await throttledFetch(
        `${PUMPFUN_FRONTEND_API}/coins?offset=0&limit=100&sort=created_timestamp&order=DESC&includeNsfw=false`,
        { headers: { 'Accept': 'application/json' } }
      );
      
      if (frontendRes.ok) {
        const contentType = frontendRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const coins = await frontendRes.json();
          
          if (Array.isArray(coins) && coins.length > 0) {
            console.log(`[PUMPFUN] Frontend API returned ${coins.length} coins`);
            
            coins.forEach(coin => {
              const token = normalizePumpFunCoinLegacy(coin);
              if (token && !tokenMap.has(token.mint)) {
                tokenMap.set(token.mint, token);
              }
            });
          }
        }
      } else {
        console.log(`[PUMPFUN] Frontend API status: ${frontendRes.status}`);
      }
    } catch (e) {
      console.error('[PUMPFUN] Frontend API error:', e.message);
    }
  }

  // Strategy 3: Fallback to DexScreener for pumpfun pairs
  if (tokenMap.size < 50) {
    console.log('[PUMPFUN] Using DexScreener fallback...');
    
    try {
      // Search for new pump tokens
      const searchTerms = ['pump', 'new', 'launch'];
      
      for (const term of searchTerms) {
        if (tokenMap.size >= targetCount) break;
        
        try {
          const searchRes = await throttledFetch(`${DEXSCREENER_API}/latest/dex/search?q=${term}`);
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const pumpPairs = (searchData.pairs || [])
              .filter(p => p.chainId === 'solana' && p.dexId === 'pumpfun')
              .slice(0, 100);
            
            console.log(`[PUMPFUN] DexScreener search "${term}" found ${pumpPairs.length} pumpfun pairs`);
            
            pumpPairs.forEach(pair => {
              const token = normalizeDexPair(pair, new Map());
              if (token && !tokenMap.has(token.mint)) {
                token.bonding_curve_status = 'bonding_curve';
                token.source = 'dexscreener-pump';
                tokenMap.set(token.mint, token);
              }
            });
          }
        } catch (e) {
          // Continue with other terms
        }
      }
    } catch (e) {
      console.error('[PUMPFUN] DexScreener fallback error:', e.message);
    }
  }

  // Sort by creation time (newest first) and dedupe
  const tokens = Array.from(tokenMap.values())
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, targetCount);

  const elapsed = Date.now() - startTime;
  console.log(`[PUMPFUN] Complete: ${tokens.length} unique tokens in ${elapsed}ms`);
  
  if (tokens.length > 0) {
    const newest = tokens[0];
    const oldest = tokens[tokens.length - 1];
    const newestAge = formatTimeAge(newest?.createdAt);
    const oldestAge = formatTimeAge(oldest?.createdAt);
    console.log(`PumpFun: fetched ${tokenMap.size}, unique ${tokens.length}, newest=${newestAge}, oldest=${oldestAge}`);
  }

  setCache(cacheKey, tokens);
  return tokens;
}

function formatTimeAge(timestamp) {
  if (!timestamp) return 'unknown';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function normalizePumpFunCoin(coin) {
  if (!coin) return null;
  
  const mint = coin.coinMint || coin.mint;
  if (!mint) return null;

  // Calculate bonding curve progress
  const marketCap = coin.marketCap || coin.usd_market_cap || 0;
  const bondingProgress = coin.bondingCurveProgress || Math.min(100, (marketCap / 69000) * 100);

  return {
    mint: mint,
    symbol: coin.ticker || coin.symbol || 'UNKNOWN',
    name: coin.name || 'Unknown Token',
    image_url: coin.imageUrl || coin.image_uri || '',
    description: coin.description || '',
    price_usd: coin.currentMarketPrice || (marketCap > 0 ? marketCap / 1000000000 : 0),
    market_cap: marketCap,
    liquidity: 0, // Bonding curve tokens don't have traditional liquidity
    volume24h: coin.volume || 0,
    volume5m: 0,
    priceChange5m: 0,
    priceChange1h: 0,
    priceChange24h: 0,
    buys_5m: coin.buyTransactions || 0,
    sells_5m: coin.sellTransactions || 0,
    buys_1h: 0,
    sells_1h: 0,
    buys_24h: coin.transactions || 0,
    sells_24h: 0,
    holders: coin.numHolders || 0,
    twitter: coin.twitter || null,
    telegram: coin.telegram || null,
    website: coin.website || null,
    dexId: 'pumpfun',
    pairAddress: coin.poolAddress || null,
    createdAt: coin.creationTime || Date.now(),
    bonding_curve_status: coin.graduationDate ? 'migrated' : 'bonding_curve',
    bondingProgress: bondingProgress,
    allTimeHighMarketCap: coin.allTimeHighMarketCap || 0,
    devHoldingsPercentage: coin.devHoldingsPercentage || 0,
    source: 'pumpfun-advanced'
  };
}

function normalizePumpFunCoinLegacy(coin) {
  if (!coin || !coin.mint) return null;

  const marketCap = coin.usd_market_cap || coin.market_cap || 0;
  const bondingProgress = Math.min(100, (marketCap / 69000) * 100);

  return {
    mint: coin.mint,
    symbol: coin.symbol || 'UNKNOWN',
    name: coin.name || 'Unknown Token',
    image_url: coin.image_uri || coin.image || '',
    description: coin.description || '',
    price_usd: marketCap > 0 ? marketCap / 1000000000 : 0,
    market_cap: marketCap,
    liquidity: 0,
    volume24h: coin.volume_24h || 0,
    volume5m: 0,
    priceChange5m: 0,
    priceChange1h: 0,
    priceChange24h: 0,
    buys_5m: 0,
    sells_5m: 0,
    buys_1h: 0,
    sells_1h: 0,
    buys_24h: 0,
    sells_24h: 0,
    holders: coin.holder_count || 0,
    twitter: coin.twitter ? (coin.twitter.startsWith('http') ? coin.twitter : `https://twitter.com/${coin.twitter}`) : null,
    telegram: coin.telegram ? (coin.telegram.startsWith('http') ? coin.telegram : `https://t.me/${coin.telegram}`) : null,
    website: coin.website || null,
    dexId: 'pumpfun',
    pairAddress: null,
    createdAt: coin.created_timestamp || Date.now(),
    bonding_curve_status: coin.complete ? 'migrated' : 'bonding_curve',
    bondingProgress: bondingProgress,
    source: 'pumpfun-frontend'
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
    // GET MIGRATED - Post-migration tokens on Raydium/Meteora/etc
    // =========================================================================
    if (action === 'getMigrated' || action === 'getTrending') {
      const targetCount = body.limit || 200;
      const tokens = await fetchDexScreenerTokens(targetCount);

      return Response.json({
        ok: true,
        data: tokens,
        meta: { 
          source: 'dexscreener', 
          count: tokens.length,
          timestamp: Date.now()
        }
      });
    }

    // =========================================================================
    // GET PUMPFUN - Bonding curve tokens from Pump.fun
    // =========================================================================
    if (action === 'getPumpFun' || action === 'getBonding') {
      const targetCount = body.limit || 100;
      const tokens = await fetchPumpFunTokens(targetCount);

      return Response.json({
        ok: true,
        data: tokens,
        meta: { 
          source: 'pumpfun', 
          count: tokens.length,
          timestamp: Date.now()
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

      const pairRes = await throttledFetch(`${DEXSCREENER_API}/tokens/v1/solana/${mint}`);
      const data = await pairRes.json();
      
      const pairs = Array.isArray(data) ? data : (data.pairs || []);
      if (pairs.length === 0) {
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
        .slice(0, 30);

      const tokens = solanaPairs.map(pair => normalizeDexPair(pair, new Map())).filter(Boolean);

      return Response.json({ ok: true, data: tokens });
    }

    return Response.json({ ok: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[MEMETOKENS] Fatal error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});