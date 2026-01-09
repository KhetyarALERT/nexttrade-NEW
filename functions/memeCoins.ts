// @ts-nocheck
/// <reference lib="deno.ns" />

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Meme Coins Backend Function
 * - Pump.fun API: Pre-DEX tokens on bonding curve
 * - DexScreener API: Migrated/graduated tokens
 * - Jupiter API: Swaps with 1% platform commission
 */

// Constants
const PLATFORM_FEE_BPS = 100;
const FEE_WALLET = 'CrQyg1WovDzakhqd7UfBrVvPbEZzPHWyui6Qd2zMV2UL';
const PUMP_FUN_API = 'https://frontend-api.pump.fun';
const DEXSCREENER_API = 'https://api.dexscreener.com';
const JUPITER_API = 'https://quote-api.jup.ag/v6';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const CACHE_TTL = 30000;

const cache = new Map();

const log = (action, data) => {
  console.log(`[${new Date().toISOString()}] [MEME_COINS] ${action}`, data ? JSON.stringify(data) : '');
};

const logError = (action, error) => {
  console.error(`[${new Date().toISOString()}] [MEME_COINS_ERROR] ${action}:`, error?.message || error);
};

const getCached = (key) => {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
};

const setCache = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};

// Pump.fun API
async function fetchPumpFunTokens(options) {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;
  const sort = options?.sort || 'last_trade_timestamp';
  const order = options?.order || 'DESC';
  const includeNsfw = options?.includeNsfw || false;

  const cacheKey = `pump_${sort}_${order}_${offset}_${limit}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log('PUMP_CACHE_HIT', { cacheKey });
    return cached;
  }

  try {
    const url = `${PUMP_FUN_API}/coins?offset=${offset}&limit=${limit}&sort=${sort}&order=${order}&includeNsfw=${includeNsfw}`;
    log('PUMP_FETCH', { url });

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NextTrade/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Pump.fun API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform to consistent format
    const tokens = (data || []).map((token) => ({
      id: token.mint,
      mint: token.mint,
      symbol: token.symbol || 'UNKNOWN',
      name: token.name || 'Unknown Token',
      description: token.description || '',
      imageUrl: token.image_uri,
      
      // Pump.fun specific data
      isPumpFun: true,
      isGraduated: token.complete || false,
      bondingCurveProgress: token.bonding_curve_progress || 0,
      isKingOfHill: token.king_of_the_hill_timestamp != null,
      kingOfHillTimestamp: token.king_of_the_hill_timestamp,
      
      // Market data
      marketCap: token.usd_market_cap || 0,
      price: token.usd_market_cap ? token.usd_market_cap / 1e9 : 0, // Approximate
      virtualSolReserves: token.virtual_sol_reserves,
      virtualTokenReserves: token.virtual_token_reserves,
      
      // Social/engagement
      replyCount: token.reply_count || 0,
      twitter: token.twitter,
      telegram: token.telegram,
      website: token.website,
      
      // Creator info
      creator: token.creator,
      createdTimestamp: token.created_timestamp,
      lastTradeTimestamp: token.last_trade_timestamp,
      
      // Source identifier
      source: 'pump.fun'
    }));

    setCache(cacheKey, tokens);
    log('PUMP_SUCCESS', { count: tokens.length });
    return tokens;

  } catch (error) {
    logError('PUMP_FETCH_FAILED', error);
    return [];
  }
}

/**
 * Fetch a specific token from Pump.fun by mint address
 */
async function fetchPumpFunToken(mint) {
  const cacheKey = `pump_token_${mint}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${PUMP_FUN_API}/coins/${mint}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NextTrade/1.0'
      }
    });

    if (!response.ok) return null;

    const token = await response.json();
    const formatted = {
      id: token.mint,
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      description: token.description,
      imageUrl: token.image_uri,
      isPumpFun: true,
      isGraduated: token.complete || false,
      bondingCurveProgress: token.bonding_curve_progress || 0,
      marketCap: token.usd_market_cap || 0,
      creator: token.creator,
      createdTimestamp: token.created_timestamp,
      source: 'pump.fun'
    };

    setCache(cacheKey, formatted);
    return formatted;

  } catch (error) {
    logError('PUMP_TOKEN_FETCH_FAILED', error);
    return null;
  }
}

// =============================================================================
// DEXSCREENER API FUNCTIONS
// =============================================================================

/**
 * Fetch latest token profiles from DexScreener
 * These are tokens with updated social/marketing profiles
 */
async function fetchDexScreenerLatest() {
  const cacheKey = 'dex_latest';
  const cached = getCached(cacheKey);
  if (cached) {
    log('DEX_CACHE_HIT', { cacheKey });
    return cached;
  }

  try {
    const response = await fetch(`${DEXSCREENER_API}/token-profiles/latest/v1`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Filter for Solana tokens only
    const solanaTokens = (data || [])
      .filter((t) => t.chainId === 'solana')
      .slice(0, 50)
      .map((token) => ({
        id: token.tokenAddress,
        mint: token.tokenAddress,
        symbol: token.header?.split(' ')[0] || 'UNKNOWN',
        name: token.header || 'Unknown',
        description: token.description || '',
        imageUrl: token.icon,
        links: token.links || [],
        isPumpFun: false,
        isGraduated: true,
        source: 'dexscreener'
      }));

    setCache(cacheKey, solanaTokens);
    log('DEX_LATEST_SUCCESS', { count: solanaTokens.length });
    return solanaTokens;

  } catch (error) {
    logError('DEX_LATEST_FAILED', error);
    return [];
  }
}

/**
 * Fetch boosted tokens from DexScreener (promoted/trending)
 */
async function fetchDexScreenerBoosted() {
  const cacheKey = 'dex_boosted';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${DEXSCREENER_API}/token-boosts/latest/v1`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) return [];

    const data = await response.json();
    const solanaTokens = (data || [])
      .filter((t) => t.chainId === 'solana')
      .slice(0, 30);

    setCache(cacheKey, solanaTokens);
    return solanaTokens;

  } catch (error) {
    logError('DEX_BOOSTED_FAILED', error);
    return [];
  }
}

/**
 * Fetch trending Solana pairs from DexScreener
 * Gets tokens paired with SOL that have good liquidity/volume
 */
async function fetchDexScreenerTrending(limit = 50) {
  const cacheKey = `dex_trending_${limit}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log('DEX_CACHE_HIT', { cacheKey });
    return cached;
  }

  try {
    // Get pairs with SOL (native token)
    const response = await fetch(
      `${DEXSCREENER_API}/latest/dex/tokens/${SOL_MINT}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Filter and format Solana pairs with good liquidity
    const pairs = (data.pairs || [])
      .filter((pair) => 
        pair.chainId === 'solana' &&
        pair.liquidity?.usd > 5000 &&
        pair.baseToken?.symbol !== 'SOL' &&
        pair.baseToken?.symbol !== 'WSOL'
      )
      .slice(0, limit)
      .map((pair) => ({
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
        
        // Status flags
        isPumpFun: false,
        isGraduated: true,
        source: 'dexscreener'
      }));

    setCache(cacheKey, pairs);
    log('DEX_TRENDING_SUCCESS', { count: pairs.length });
    return pairs;

  } catch (error) {
    logError('DEX_TRENDING_FAILED', error);
    return [];
  }
}

/**
 * Search tokens on DexScreener
 */
async function searchDexScreener(query) {
  if (!query || query.length < 2) return [];

  const cacheKey = `dex_search_${query.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${DEXSCREENER_API}/latest/dex/search?q=${encodeURIComponent(query)}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) return [];

    const data = await response.json();
    
    // Filter for Solana only
    const results = (data.pairs || [])
      .filter((pair) => pair.chainId === 'solana')
      .slice(0, 20)
      .map((pair) => ({
        id: pair.pairAddress,
        mint: pair.baseToken?.address,
        symbol: pair.baseToken?.symbol,
        name: pair.baseToken?.name,
        price: parseFloat(pair.priceUsd) || 0,
        priceChange24h: pair.priceChange?.h24 || 0,
        volume24h: pair.volume?.h24 || 0,
        liquidity: pair.liquidity?.usd || 0,
        marketCap: pair.fdv || 0,
        dexId: pair.dexId,
        pairAddress: pair.pairAddress,
        imageUrl: pair.info?.imageUrl,
        isPumpFun: false,
        isGraduated: true,
        source: 'dexscreener'
      }));

    setCache(cacheKey, results);
    return results;

  } catch (error) {
    logError('DEX_SEARCH_FAILED', error);
    return [];
  }
}

/**
 * Get token pair details by address
 */
async function fetchTokenPair(pairAddress) {
  const cacheKey = `dex_pair_${pairAddress}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${DEXSCREENER_API}/latest/dex/pairs/solana/${pairAddress}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const pair = data.pairs?.[0] || data.pair;
    if (!pair) return null;

    const formatted = {
      id: pair.pairAddress,
      mint: pair.baseToken?.address,
      pairAddress: pair.pairAddress,
      symbol: pair.baseToken?.symbol,
      name: pair.baseToken?.name,
      price: parseFloat(pair.priceUsd) || 0,
      priceChange24h: pair.priceChange?.h24 || 0,
      volume24h: pair.volume?.h24 || 0,
      liquidity: pair.liquidity?.usd || 0,
      marketCap: pair.fdv || 0,
      dexId: pair.dexId,
      dexUrl: pair.url,
      imageUrl: pair.info?.imageUrl,
      isPumpFun: false,
      isGraduated: true,
      source: 'dexscreener'
    };

    setCache(cacheKey, formatted);
    return formatted;

  } catch (error) {
    logError('DEX_PAIR_FETCH_FAILED', error);
    return null;
  }
}

// =============================================================================
// JUPITER API FUNCTIONS (with 1% commission)
// =============================================================================

/**
 * Get swap quote from Jupiter with platform fee
 * Jupiter API docs: https://station.jup.ag/docs/apis/swap-api
 */
async function getSwapQuote(params) {
  const JUPITER_API_KEY = Deno.env.get('JUPITER_API_KEY');
  
  const inputMint = params.inputMint;
  const outputMint = params.outputMint;
  const amount = params.amount;
  const slippageBps = params.slippageBps || 50;

  try {
    const queryParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
      platformFeeBps: PLATFORM_FEE_BPS.toString(),
    });

    const headers = {
      'Accept': 'application/json'
    };

    // Add API key if available (for higher rate limits)
    if (JUPITER_API_KEY) {
      headers['Authorization'] = `Bearer ${JUPITER_API_KEY}`;
    }

    log('JUPITER_QUOTE', { inputMint, outputMint, amount, slippageBps, feeBps: PLATFORM_FEE_BPS });

    const response = await fetch(
      `${JUPITER_API}/quote?${queryParams.toString()}`,
      { headers }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jupiter API error: ${response.status} - ${errorText}`);
    }

    const quote = await response.json();

    // Add our fee info to the response
    return {
      ...quote,
      platformFee: {
        bps: PLATFORM_FEE_BPS,
        percent: PLATFORM_FEE_BPS / 100,
        wallet: FEE_WALLET
      }
    };

  } catch (error) {
    logError('JUPITER_QUOTE_FAILED', error);
    throw error;
  }
}

/**
 * Get swap transaction from Jupiter
 * Returns serialized transaction ready for signing
 */
async function getSwapTransaction(params) {
  const JUPITER_API_KEY = Deno.env.get('JUPITER_API_KEY');
  
  const quoteResponse = params.quoteResponse;
  const userPublicKey = params.userPublicKey;
  const wrapUnwrapSOL = params.wrapUnwrapSOL !== false;
  const feeAccount = params.feeAccount || FEE_WALLET;

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (JUPITER_API_KEY) {
      headers['Authorization'] = `Bearer ${JUPITER_API_KEY}`;
    }

    const body = {
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: wrapUnwrapSOL,
      feeAccount, // Platform fee account
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto'
    };

    log('JUPITER_SWAP_TX', { userPublicKey, feeAccount });

    const response = await fetch(`${JUPITER_API}/swap`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jupiter swap error: ${response.status} - ${errorText}`);
    }

    return await response.json();

  } catch (error) {
    logError('JUPITER_SWAP_FAILED', error);
    throw error;
  }
}

/**
 * Get token price in USD from Jupiter
 */
async function getTokenPrice(mint) {
  const cacheKey = `jup_price_${mint}`;
  const cached = getCached(cacheKey);
  if (cached !== null) return cached;

  try {
    const response = await fetch(
      `https://price.jup.ag/v6/price?ids=${mint}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const price = data.data?.[mint]?.price || null;
    
    if (price !== null) {
      setCache(cacheKey, price);
    }
    
    return price;

  } catch (error) {
    logError('JUPITER_PRICE_FAILED', error);
    return null;
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    // Verify authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, ...params } = body;

    log('REQUEST', { action, userId: user.id });

    switch (action) {
      // =====================================================================
      // PUMP.FUN ACTIONS - Pre-DEX Meme Coins
      // =====================================================================
      
      case 'getPumpFunTokens': {
        // Fetch latest tokens from Pump.fun (on bonding curve)
        const tokens = await fetchPumpFunTokens({
          limit: params.limit || 50,
          offset: params.offset || 0,
          sort: params.sort || 'last_trade_timestamp',
          order: params.order || 'DESC',
          includeNsfw: params.includeNsfw || false
        });
        return Response.json({ success: true, data: tokens, source: 'pump.fun' });
      }

      case 'getPumpFunNewLaunches': {
        // Get newest token launches on Pump.fun
        const tokens = await fetchPumpFunTokens({
          limit: params.limit || 30,
          offset: 0,
          sort: 'created_timestamp',
          order: 'DESC',
          includeNsfw: false
        });
        return Response.json({ success: true, data: tokens, source: 'pump.fun' });
      }

      case 'getPumpFunKingOfHill': {
        // Get tokens at King of the Hill (top of bonding curve)
        const allTokens = await fetchPumpFunTokens({ limit: 100 });
        const kingTokens = allTokens.filter(t => t.isKingOfHill);
        return Response.json({ success: true, data: kingTokens, source: 'pump.fun' });
      }

      case 'getPumpFunToken': {
        // Get specific Pump.fun token by mint
        if (!params.mint) {
          return Response.json({ success: false, error: 'Mint address required' }, { status: 400 });
        }
        const token = await fetchPumpFunToken(params.mint);
        if (!token) {
          return Response.json({ success: false, error: 'Token not found' }, { status: 404 });
        }
        return Response.json({ success: true, data: token, source: 'pump.fun' });
      }

      // =====================================================================
      // DEXSCREENER ACTIONS - Graduated/Migrated Tokens
      // =====================================================================

      case 'getTrendingTokens': {
        // Get trending Solana tokens from DexScreener
        const tokens = await fetchDexScreenerTrending(params.limit || 50);
        return Response.json({ success: true, data: tokens, source: 'dexscreener' });
      }

      case 'getLatestProfiles': {
        // Get tokens with recently updated profiles
        const tokens = await fetchDexScreenerLatest();
        return Response.json({ success: true, data: tokens, source: 'dexscreener' });
      }

      case 'getBoostedTokens': {
        // Get promoted/boosted tokens on DexScreener
        const tokens = await fetchDexScreenerBoosted();
        return Response.json({ success: true, data: tokens, source: 'dexscreener' });
      }

      case 'searchTokens': {
        // Search tokens across DexScreener
        if (!params.query) {
          return Response.json({ success: false, error: 'Search query required' }, { status: 400 });
        }
        const results = await searchDexScreener(params.query);
        return Response.json({ success: true, data: results, source: 'dexscreener' });
      }

      case 'getTokenPair': {
        // Get specific pair details
        if (!params.pairAddress) {
          return Response.json({ success: false, error: 'Pair address required' }, { status: 400 });
        }
        const pair = await fetchTokenPair(params.pairAddress);
        if (!pair) {
          return Response.json({ success: false, error: 'Pair not found' }, { status: 404 });
        }
        return Response.json({ success: true, data: pair, source: 'dexscreener' });
      }

      // =====================================================================
      // COMBINED/ALL SOURCES
      // =====================================================================

      case 'getAllMemeCoins': {
        // Fetch from all sources and combine
        const [pumpTokens, dexTrending] = await Promise.all([
          fetchPumpFunTokens({ limit: params.pumpLimit || 30 }),
          fetchDexScreenerTrending(params.dexLimit || 30)
        ]);

        return Response.json({
          success: true,
          data: {
            pumpFun: pumpTokens,          // Pre-DEX tokens on bonding curve
            graduated: dexTrending,        // Migrated tokens on DEXes
            totalPumpFun: pumpTokens.length,
            totalGraduated: dexTrending.length
          }
        });
      }

      // =====================================================================
      // JUPITER SWAP ACTIONS (with 1% commission)
      // =====================================================================

      case 'getSwapQuote': {
        // Get swap quote with platform fee
        if (!params.inputMint || !params.outputMint || !params.amount) {
          return Response.json({ 
            success: false, 
            error: 'inputMint, outputMint, and amount required' 
          }, { status: 400 });
        }
        
        const quote = await getSwapQuote({
          inputMint: params.inputMint,
          outputMint: params.outputMint,
          amount: params.amount,
          slippageBps: params.slippageBps
        });
        
        return Response.json({ success: true, data: quote });
      }

      case 'getSwapTransaction': {
        // Get serialized swap transaction
        if (!params.quoteResponse || !params.userPublicKey) {
          return Response.json({ 
            success: false, 
            error: 'quoteResponse and userPublicKey required' 
          }, { status: 400 });
        }
        
        const swapTx = await getSwapTransaction({
          quoteResponse: params.quoteResponse,
          userPublicKey: params.userPublicKey,
          wrapUnwrapSOL: params.wrapUnwrapSOL,
          feeAccount: params.feeAccount
        });
        
        return Response.json({ success: true, data: swapTx });
      }

      case 'getTokenPrice': {
        // Get token price from Jupiter
        if (!params.mint) {
          return Response.json({ success: false, error: 'Mint address required' }, { status: 400 });
        }
        
        const price = await getTokenPrice(params.mint);
        return Response.json({ success: true, data: { mint: params.mint, price } });
      }

      // =====================================================================
      // CONFIG/INFO
      // =====================================================================

      case 'getConfig': {
        // Return platform configuration
        return Response.json({
          success: true,
          data: {
            platformFeeBps: PLATFORM_FEE_BPS,
            platformFeePercent: PLATFORM_FEE_BPS / 100,
            feeWallet: FEE_WALLET,
            cacheTtlMs: CACHE_TTL,
            sources: ['pump.fun', 'dexscreener', 'jupiter']
          }
        });
      }

      default:
        return Response.json({ 
          success: false, 
          error: `Unknown action: ${action}. Valid actions: getPumpFunTokens, getPumpFunNewLaunches, getPumpFunKingOfHill, getPumpFunToken, getTrendingTokens, getLatestProfiles, getBoostedTokens, searchTokens, getTokenPair, getAllMemeCoins, getSwapQuote, getSwapTransaction, getTokenPrice, getConfig` 
        }, { status: 400 });
    }

  } catch (error) {
    logError('HANDLER_ERROR', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});
