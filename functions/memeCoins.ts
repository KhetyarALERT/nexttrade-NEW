/**
 * Meme Coins Backend Function
 * - Pump.fun API: Pre-DEX tokens on bonding curve
 * - DexScreener API: Migrated/graduated tokens
 * - Jupiter API: Swaps with 1% platform commission
 * 
 * NOTE: This function does NOT require any Base44 entities.
 * It only fetches data from external APIs.
 */

// Constants
var PLATFORM_FEE_BPS = 100;
var FEE_WALLET = 'CrQyg1WovDzakhqd7UfBrVvPbEZzPHWyui6Qd2zMV2UL';
var PUMP_FUN_API = 'https://frontend-api.pump.fun';
var DEXSCREENER_API = 'https://api.dexscreener.com';
var JUPITER_API = 'https://quote-api.jup.ag/v6';
var SOL_MINT = 'So11111111111111111111111111111111111111112';
var CACHE_TTL = 30000;

var cache = new Map<string, { data: unknown; timestamp: number }>();

type PumpFunCoinApi = {
  mint: string;
  symbol?: string;
  name?: string;
  description?: string;
  image_uri?: string;

  complete?: boolean;
  bonding_curve_progress?: number;
  king_of_the_hill_timestamp?: number | null;

  usd_market_cap?: number;
  virtual_sol_reserves?: number;
  virtual_token_reserves?: number;

  reply_count?: number;
  twitter?: string;
  telegram?: string;
  website?: string;

  creator?: string;
  created_timestamp?: number;
  last_trade_timestamp?: number;
};

type DexTokenProfileApi = {
  chainId: string;
  tokenAddress: string;
  header?: string;
  description?: string;
  icon?: string;
  links?: unknown[];
};

type DexBoostApi = {
  chainId: string;
  [key: string]: unknown;
};

type DexPairApi = {
  chainId?: string;
  pairAddress?: string;
  baseToken?: { address?: string; symbol?: string; name?: string };
  priceUsd?: string;
  priceNative?: string;
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  volume?: { m5?: number; h1?: number; h6?: number; h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  txns?: {
    m5?: { buys?: number; sells?: number };
    h1?: { buys?: number; sells?: number };
    h24?: { buys?: number; sells?: number };
  };
  dexId?: string;
  url?: string;
  info?: { imageUrl?: string | null; websites?: unknown[]; socials?: unknown[] };
  pairCreatedAt?: number;
};

type DexPairsResponseApi = {
  pairs?: DexPairApi[];
  pair?: DexPairApi;
};

type JupiterPriceResponseApi = {
  data?: Record<string, { price?: number }>;
};

function log(action: string, data?: unknown) {
  console.log('[' + new Date().toISOString() + '] [MEME_COINS] ' + action, data ? JSON.stringify(data) : '');
}

function logError(action: string, error: unknown) {
  const message = error instanceof Error ? error.message : error;
  console.error('[' + new Date().toISOString() + '] [MEME_COINS_ERROR] ' + action + ':', message);
}

function getCached<T = unknown>(key: string): T | null {
  var entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data: data, timestamp: Date.now() });
}

// Pump.fun API
async function fetchPumpFunTokens(options?: { limit?: number; offset?: number; sort?: string; order?: string; includeNsfw?: boolean }) {
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

    const data: PumpFunCoinApi[] = await response.json();
    
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
async function fetchPumpFunToken(mint: string) {
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

    const token: PumpFunCoinApi = await response.json();
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

    const data: DexTokenProfileApi[] = await response.json();
    
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

    const data: DexBoostApi[] = await response.json();
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

    const data: DexPairsResponseApi = await response.json();
    
    // Filter and format Solana pairs with good liquidity
    const pairs = (data.pairs || [])
      .filter((pair) => 
        pair.chainId === 'solana' &&
        (pair.liquidity?.usd || 0) > 5000 &&
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
async function searchDexScreener(query: string) {
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

    const data: DexPairsResponseApi = await response.json();
    
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
async function fetchTokenPair(pairAddress: string) {
  const cacheKey = `dex_pair_${pairAddress}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${DEXSCREENER_API}/latest/dex/pairs/solana/${pairAddress}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) return null;

    const data: DexPairsResponseApi = await response.json();
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
async function getSwapQuote(params: { inputMint: string; outputMint: string; amount: string | number; slippageBps?: number }) {
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
async function getSwapTransaction(params: { quoteResponse: unknown; userPublicKey: string; wrapUnwrapSOL?: boolean; feeAccount?: string }) {
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
async function getTokenPrice(mint: string) {
  const cacheKey = `jup_price_${mint}`;
  const cached = getCached(cacheKey);
  if (cached !== null) return cached;

  try {
    const response = await fetch(
      `https://price.jup.ag/v6/price?ids=${mint}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) return null;

    const data: JupiterPriceResponseApi = await response.json();
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
  try {
    // Optional: require authentication (Base44 SDK removed because it's not required by this function)
    // If you need auth later, re-introduce the SDK using a supported import for your runtime.

    var body;
    try {
      body = await req.json();
    } catch (e) {
      return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }
    
    var action = body.action;
    log('REQUEST', { action: action });

    // PUMP.FUN ACTIONS - Pre-DEX Meme Coins
    
    if (action === 'getPumpFunTokens') {
      var tokens = await fetchPumpFunTokens({
        limit: body.limit || 50,
        offset: body.offset || 0,
        sort: body.sort || 'last_trade_timestamp',
        order: body.order || 'DESC',
        includeNsfw: body.includeNsfw || false
      });
      return Response.json({ success: true, data: tokens, source: 'pump.fun' });
    }

    if (action === 'getPumpFunNewLaunches') {
      var tokens = await fetchPumpFunTokens({
        limit: body.limit || 30,
        offset: 0,
        sort: 'created_timestamp',
        order: 'DESC',
        includeNsfw: false
      });
      return Response.json({ success: true, data: tokens, source: 'pump.fun' });
    }

    if (action === 'getPumpFunKingOfHill') {
      var allTokens = await fetchPumpFunTokens({ limit: 100 });
      var kingTokens = allTokens.filter(function(t) { return t.isKingOfHill; });
      return Response.json({ success: true, data: kingTokens, source: 'pump.fun' });
    }

    if (action === 'getPumpFunToken') {
      if (!body.mint) {
        return Response.json({ success: false, error: 'Mint address required' }, { status: 400 });
      }
      var token = await fetchPumpFunToken(body.mint);
      if (!token) {
        return Response.json({ success: false, error: 'Token not found' }, { status: 404 });
      }
      return Response.json({ success: true, data: token, source: 'pump.fun' });
    }

    // DEXSCREENER ACTIONS - Graduated/Migrated Tokens

    if (action === 'getTrendingTokens') {
      var tokens = await fetchDexScreenerTrending(body.limit || 50);
      return Response.json({ success: true, data: tokens, source: 'dexscreener' });
    }

    if (action === 'getLatestProfiles') {
      var tokens = await fetchDexScreenerLatest();
      return Response.json({ success: true, data: tokens, source: 'dexscreener' });
    }

    if (action === 'getBoostedTokens') {
      var tokens = await fetchDexScreenerBoosted();
      return Response.json({ success: true, data: tokens, source: 'dexscreener' });
    }

    if (action === 'searchTokens') {
      if (!body.query) {
        return Response.json({ success: false, error: 'Search query required' }, { status: 400 });
      }
      var results = await searchDexScreener(body.query);
      return Response.json({ success: true, data: results, source: 'dexscreener' });
    }

    if (action === 'getTokenPair') {
      if (!body.pairAddress) {
        return Response.json({ success: false, error: 'Pair address required' }, { status: 400 });
      }
      var pair = await fetchTokenPair(body.pairAddress);
      if (!pair) {
        return Response.json({ success: false, error: 'Pair not found' }, { status: 404 });
      }
      return Response.json({ success: true, data: pair, source: 'dexscreener' });
    }

    // COMBINED/ALL SOURCES

    if (action === 'getAllMemeCoins') {
      var pumpTokens = await fetchPumpFunTokens({ limit: body.pumpLimit || 30 });
      var dexTrending = await fetchDexScreenerTrending(body.dexLimit || 30);
      return Response.json({
        success: true,
        data: {
          pumpFun: pumpTokens,
          graduated: dexTrending,
          totalPumpFun: pumpTokens.length,
          totalGraduated: dexTrending.length
        }
      });
    }

    // JUPITER SWAP ACTIONS (with 1% commission)

    if (action === 'getSwapQuote') {
      if (!body.inputMint || !body.outputMint || !body.amount) {
        return Response.json({ 
          success: false, 
          error: 'inputMint, outputMint, and amount required' 
        }, { status: 400 });
      }
      var quote = await getSwapQuote({
        inputMint: body.inputMint,
        outputMint: body.outputMint,
        amount: body.amount,
        slippageBps: body.slippageBps
      });
      return Response.json({ success: true, data: quote });
    }

    if (action === 'getSwapTransaction') {
      if (!body.quoteResponse || !body.userPublicKey) {
        return Response.json({ 
          success: false, 
          error: 'quoteResponse and userPublicKey required' 
        }, { status: 400 });
      }
      var swapTx = await getSwapTransaction({
        quoteResponse: body.quoteResponse,
        userPublicKey: body.userPublicKey,
        wrapUnwrapSOL: body.wrapUnwrapSOL,
        feeAccount: body.feeAccount
      });
      return Response.json({ success: true, data: swapTx });
    }

    if (action === 'getTokenPrice') {
      if (!body.mint) {
        return Response.json({ success: false, error: 'Mint address required' }, { status: 400 });
      }
      var price = await getTokenPrice(body.mint);
      return Response.json({ success: true, data: { mint: body.mint, price: price } });
    }

    // CONFIG/INFO

    if (action === 'getConfig') {
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

    // Unknown action
    return Response.json({ 
      success: false, 
      error: 'Unknown action: ' + action + '. Valid actions: getPumpFunTokens, getPumpFunNewLaunches, getPumpFunKingOfHill, getPumpFunToken, getTrendingTokens, getLatestProfiles, getBoostedTokens, searchTokens, getTokenPair, getAllMemeCoins, getSwapQuote, getSwapTransaction, getTokenPrice, getConfig' 
    }, { status: 400 });

  } catch (error) {
    logError('HANDLER_ERROR', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});
