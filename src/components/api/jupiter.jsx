import { base44 } from '@/api/base44Client';
import { VersionedTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';

// Ensure Buffer is available in browser environment
if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}

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
  
  const transaction = VersionedTransaction.deserialize(
    Buffer.from(swapTransactionBase64, 'base64')
  );
  
  const signature = await wallet.sendTransaction(transaction, connection);
  return signature;
};