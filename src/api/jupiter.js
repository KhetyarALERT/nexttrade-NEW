import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';

// Jupiter API v6 configuration
// NOTE: Some hosted preview environments intermittently fail DNS for `quote-api.jup.ag`.
// We keep v6 as the primary, but retry against the newer `api.jup.ag` swap endpoint.
const JUPITER_API_BASES = ['https://quote-api.jup.ag/v6', 'https://api.jup.ag/swap/v1'];

function assertValidMint(label, mint) {
  if (typeof mint !== 'string' || !mint.trim()) {
    throw new Error(`${label} is required`);
  }
  if (mint === 'undefined' || mint === 'null') {
    throw new Error(`${label} is invalid`);
  }
}

async function fetchWithFallback(path, options) {
  /** @type {Error | null} */
  let lastError = null;

  for (const base of JUPITER_API_BASES) {
    try {
      // `path` must start with '/'
      const url = `${base}${path}`;
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error('Failed to fetch Jupiter API');
}
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

// Common token addresses on Solana
export const TOKENS = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  SOL: 'So11111111111111111111111111111111111111112',
};

/**
 * Get a quote for swapping tokens
 * @param {string} inputMint - Input token mint address
 * @param {string} outputMint - Output token mint address
 * @param {number} amount - Amount in smallest unit (e.g., lamports for SOL)
 * @param {number} slippageBps - Slippage in basis points (50 = 0.5%)
 * @returns {Promise<Object>} Quote data
 */
export async function getQuote(inputMint, outputMint, amount, slippageBps = 50) {
  try {
    assertValidMint('inputMint', inputMint);
    assertValidMint('outputMint', outputMint);
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw new Error('amount must be a positive number');
    }

    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
    });

    const response = await fetchWithFallback(`/quote?${params}`);
    if (!response.ok) {
      throw new Error(`Jupiter quote failed: ${response.statusText}`);
    }

    const quote = await response.json();
    return quote;
  } catch (error) {
    console.error('Error fetching Jupiter quote:', error);
    throw error;
  }
}

/**
 * Get swap transaction for a quote
 * @param {Object} quote - Quote object from getQuote
 * @param {string} userPublicKey - User's wallet public key
 * @param {number} feeBps - Platform fee in basis points (100 = 1%)
 * @param {string} feeAccount - Platform fee account (optional)
 * @returns {Promise<string>} Serialized transaction
 */
export async function getSwapTransaction(quote, userPublicKey, feeBps = 0, feeAccount = null) {
  try {
    assertValidMint('userPublicKey', userPublicKey);
    const body = {
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      computeUnitPriceMicroLamports: 'auto',
    };

    // Add platform fee if specified
    if (feeBps > 0 && feeAccount) {
      body.platformFeeBps = feeBps;
      body.feeAccount = feeAccount;
    }

    const response = await fetchWithFallback('/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Jupiter swap failed: ${response.statusText}`);
    }

    const { swapTransaction } = await response.json();
    return swapTransaction;
  } catch (error) {
    console.error('Error getting swap transaction:', error);
    throw error;
  }
}

/**
 * Execute a swap transaction
 * @param {string} swapTransaction - Serialized transaction from getSwapTransaction
 * @param {Object} wallet - Solana wallet adapter
 * @returns {Promise<string>} Transaction signature
 */
export async function executeSwap(swapTransaction, wallet) {
  try {
    if (!wallet || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    // Deserialize the transaction
    const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    // Sign and send transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    
    const connection = new Connection(SOLANA_RPC, 'confirmed');
    const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    // Confirm transaction
    await connection.confirmTransaction(signature, 'confirmed');

    return signature;
  } catch (error) {
    console.error('Error executing swap:', error);
    throw error;
  }
}

/**
 * Get token price in USD
 * @param {string} mintAddress - Token mint address
 * @returns {Promise<number>} Price in USD
 */
export async function getTokenPrice(mintAddress) {
  try {
    // Price API is on a separate domain from swap/quote.
    const response = await fetch(`https://price.jup.ag/v6/price?ids=${mintAddress}`);
    if (!response.ok) {
      throw new Error(`Jupiter price failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data?.[mintAddress]?.price || 0;
  } catch (error) {
    console.error('Error fetching token price:', error);
    return 0;
  }
}

/**
 * Calculate output amount for a given input
 * @param {string} inputMint - Input token mint
 * @param {string} outputMint - Output token mint
 * @param {number} inputAmount - Input amount
 * @param {number} slippageBps - Slippage tolerance
 * @returns {Promise<Object>} Quote with calculated output
 */
export async function calculateSwapOutput(inputMint, outputMint, inputAmount, slippageBps = 50) {
  try {
    const quote = await getQuote(inputMint, outputMint, inputAmount, slippageBps);
    
    return {
      inputAmount: quote.inAmount,
      outputAmount: quote.outAmount,
      priceImpact: quote.priceImpactPct,
      minimumOut: quote.otherAmountThreshold,
      quote,
    };
  } catch (error) {
    console.error('Error calculating swap output:', error);
    return null;
  }
}

/**
 * Helper to convert UI amount to raw amount (with decimals)
 * @param {number} uiAmount - Amount in UI format (e.g., 1.5)
 * @param {number} decimals - Token decimals (e.g., 9 for SOL, 6 for USDC)
 * @returns {number} Raw amount
 */
export function toRawAmount(uiAmount, decimals) {
  return Math.floor(uiAmount * Math.pow(10, decimals));
}

/**
 * Helper to convert raw amount to UI amount
 * @param {number} rawAmount - Raw amount with decimals
 * @param {number} decimals - Token decimals
 * @returns {number} UI amount
 */
export function fromRawAmount(rawAmount, decimals) {
  return rawAmount / Math.pow(10, decimals);
}
