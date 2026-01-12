export type TokenSummary = {
  address: string;
  symbol: string;
  name: string;
  chainId: string;
  imageUrl?: string | null;
  pairAddress?: string | null;
  dexId?: string | null;
  priceUsd?: number | null;
  priceChange24h?: number | null;
  volume24h?: number | null;
  liquidityUsd?: number | null;
  marketCap?: number | null;
  pairCreatedAt?: number | null;
  websites?: Array<{ url: string }>;
  socials?: Array<{ type: string; url: string }>;
  txns24h?: { buys?: number; sells?: number } | null;
};

export type PairDetails = {
  pairAddress: string;
  chainId: string;
  dexId?: string | null;
  url?: string | null;
  baseToken: { address: string; symbol: string; name: string; decimals?: number | null };
  quoteToken: { address: string; symbol: string; name: string; decimals?: number | null };
  priceUsd?: number | null;
  priceChange24h?: number | null;
  volume24h?: number | null;
  liquidityUsd?: number | null;
  marketCap?: number | null;
  pairCreatedAt?: number | null;
  txns24h?: { buys?: number; sells?: number } | null;
  info?: {
    imageUrl?: string | null;
    websites?: Array<{ url: string }>;
    socials?: Array<{ type: string; url: string }>;
  };
};

export type QuoteModel = {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct?: string;
  otherAmountThreshold?: string;
};
