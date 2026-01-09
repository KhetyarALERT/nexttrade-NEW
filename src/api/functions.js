import { base44 } from './base44Client';

const ensureFunctionsApi = () => {
  if (typeof base44?.functions?.invoke !== 'function') {
    throw new Error('Base44 functions API is not available.');
  }
  return base44.functions.invoke.bind(base44.functions);
};

const invokeFunction = async (name, payload) => {
  const invoke = ensureFunctionsApi();
  return invoke(name, payload);
};

export const fetchMarketPrices = async (payload) => {
  return invokeFunction('fetchMarketPrices', payload);
};

export const fetchCurrentUser = async () => {
  if (typeof base44?.auth?.me !== 'function') {
    throw new Error('Base44 auth API is not available.');
  }
  return base44.auth.me();
};

export const updateCurrentUser = async (data) => {
  if (typeof base44?.auth?.updateMe !== 'function') {
    throw new Error('Base44 auth API is not available for updates.');
  }
  return base44.auth.updateMe(data);
};

export const fetchPortfolioSnapshot = async (payload) => {
  return invokeFunction('getPortfolioSnapshot', payload);
};

export const fetchWalletBalances = async (payload) => {
  return invokeFunction('getWalletBalances', payload);
};

export const createWalletTransaction = async (payload) => {
  return invokeFunction('createWalletTransaction', payload);
};

export const fetchReferralStats = async (payload) => {
  return invokeFunction('getReferralStats', payload);
};

export const fetchSubscriptionPlans = async (payload) => {
  return invokeFunction('getSubscriptionPlans', payload);
};

// Rewards / vouchers
export const fetchRewardsState = async () => {
  return invokeFunction('rewards', { action: 'getRewardsState' });
};

export const fetchVoucherClaims = async () => {
  return invokeFunction('rewards', { action: 'getVoucherClaims' });
};

export const claimVoucher = async (voucherId, { source = 'manual', meta = {} } = {}) => {
  return invokeFunction('rewards', { action: 'claimVoucher', voucherId, source, meta });
};

// =============================================================================
// MEME COINS API - Pump.fun, DexScreener, Jupiter with 1% commission
// =============================================================================

/**
 * Fetch Pump.fun tokens (pre-DEX, on bonding curve)
 */
export const fetchPumpFunTokens = async (options = {}) => {
  return invokeFunction('memeCoins', { 
    action: 'getPumpFunTokens',
    limit: options.limit || 50,
    offset: options.offset || 0,
    sort: options.sort || 'last_trade_timestamp',
    order: options.order || 'DESC',
    includeNsfw: options.includeNsfw || false
  });
};

/**
 * Fetch newest Pump.fun token launches
 */
export const fetchPumpFunNewLaunches = async (limit = 30) => {
  return invokeFunction('memeCoins', { action: 'getPumpFunNewLaunches', limit });
};

/**
 * Fetch Pump.fun King of the Hill tokens
 */
export const fetchPumpFunKingOfHill = async () => {
  return invokeFunction('memeCoins', { action: 'getPumpFunKingOfHill' });
};

/**
 * Fetch specific Pump.fun token by mint address
 */
export const fetchPumpFunToken = async (mint) => {
  return invokeFunction('memeCoins', { action: 'getPumpFunToken', mint });
};

/**
 * Fetch trending Solana tokens from DexScreener (graduated/migrated)
 */
export const fetchTrendingMemeCoins = async (limit = 50) => {
  return invokeFunction('memeCoins', { action: 'getTrendingTokens', limit });
};

/**
 * Fetch tokens with latest DexScreener profiles
 */
export const fetchLatestTokenProfiles = async () => {
  return invokeFunction('memeCoins', { action: 'getLatestProfiles' });
};

/**
 * Fetch boosted/promoted tokens on DexScreener
 */
export const fetchBoostedTokens = async () => {
  return invokeFunction('memeCoins', { action: 'getBoostedTokens' });
};

/**
 * Search tokens on DexScreener
 */
export const searchMemeCoins = async (query) => {
  return invokeFunction('memeCoins', { action: 'searchTokens', query });
};

/**
 * Fetch all meme coins from all sources (Pump.fun + DexScreener)
 */
export const fetchAllMemeCoins = async (options = {}) => {
  return invokeFunction('memeCoins', { 
    action: 'getAllMemeCoins',
    pumpLimit: options.pumpLimit || 30,
    dexLimit: options.dexLimit || 30
  });
};

/**
 * Get Jupiter swap quote with 1% platform commission
 */
export const getMemeSwapQuote = async (inputMint, outputMint, amount, slippageBps = 50) => {
  return invokeFunction('memeCoins', { 
    action: 'getSwapQuote',
    inputMint,
    outputMint,
    amount,
    slippageBps
  });
};

/**
 * Get Jupiter swap transaction (ready for signing)
 */
export const getMemeSwapTransaction = async (quoteResponse, userPublicKey, options = {}) => {
  return invokeFunction('memeCoins', { 
    action: 'getSwapTransaction',
    quoteResponse,
    userPublicKey,
    wrapUnwrapSOL: options.wrapUnwrapSOL ?? true,
    feeAccount: options.feeAccount
  });
};

/**
 * Get token price from Jupiter
 */
export const getTokenPrice = async (mint) => {
  return invokeFunction('memeCoins', { action: 'getTokenPrice', mint });
};

/**
 * Get meme coins platform config (fee info, etc.)
 */
export const getMemeCoinsConfig = async () => {
  return invokeFunction('memeCoins', { action: 'getConfig' });
};
