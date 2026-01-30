export const fetchTrendingSolanaTokens = async () => {
  try {
    const response = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
    const data = await response.json();
    
    const solanaTokens = data.filter(item => item.chainId === 'solana');
    
    const addresses = solanaTokens.map(t => t.tokenAddress).slice(0, 30).join(',');
    if (!addresses) return [];

    const pairsResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addresses}`);
    const pairsData = await pairsResponse.json();
    const pairs = pairsData.pairs || [];

    const uniquePairs = new Map();
    pairs.forEach(pair => {
      if (pair.chainId !== 'solana') return;
      if (!uniquePairs.has(pair.baseToken.address) || pair.liquidity.usd > uniquePairs.get(pair.baseToken.address).liquidity.usd) {
        uniquePairs.set(pair.baseToken.address, pair);
      }
    });

    return Array.from(uniquePairs.values());
  } catch (error) {
    console.error('DexScreener fetch error:', error);
    try {
        const response = await fetch('https://api.dexscreener.com/latest/dex/search?q=solana');
        const data = await response.json();
        const pairs = data.pairs || [];
        const uniquePairs = new Map();
        pairs.forEach(pair => {
            if (pair.chainId === 'solana') {
                if (!uniquePairs.has(pair.baseToken.address) || pair.liquidity.usd > uniquePairs.get(pair.baseToken.address).liquidity.usd) {
                    uniquePairs.set(pair.baseToken.address, pair);
                }
            }
        });
        return Array.from(uniquePairs.values());
    } catch (e) {
        return [];
    }
  }
};