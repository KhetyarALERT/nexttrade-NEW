import { base44 } from '@/api/base44Client';
import { VersionedTransaction } from '@solana/web3.js';

export const TOKENS = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  SOL: 'So11111111111111111111111111111111111111112'
};

export const toRawAmount = (amount, decimals) => {
  return Math.floor(amount * Math.pow(10, decimals));
};

export const fromRawAmount = (rawAmount, decimals) => {
  return rawAmount / Math.pow(10, decimals);
};

// Browser-compatible base64 to Uint8Array conversion
const base64ToUint8Array = (base64) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const getQuote = async (inputMint, outputMint, amount, slippageBps) => {
  const { data } = await base44.functions.invoke('jupiterSwap', {
    action: 'getQuote',
    inMint: inputMint,
    outMint: outputMint,
    amountIn: amount,
    slippageBps
  });
  return data?.ok ? data.data : null;
};

export const getSwapTransaction = async (quoteResponse, userPublicKey) => {
  const { data } = await base44.functions.invoke('jupiterSwap', {
    action: 'buildSwapTx',
    quoteResponse: quoteResponse.quoteResponse,
    userPubkey: userPublicKey
  });
  return data?.ok ? data.data.swapTransaction : null;
};

export const executeSwap = async (swapTransactionBase64, wallet, connection) => {
  if (!swapTransactionBase64) throw new Error('Invalid swap transaction');
  
  // Use browser-native decoding instead of Buffer
  const transactionBytes = base64ToUint8Array(swapTransactionBase64);
  const transaction = VersionedTransaction.deserialize(transactionBytes);
  
  const signature = await wallet.sendTransaction(transaction, connection);
  return signature;
};