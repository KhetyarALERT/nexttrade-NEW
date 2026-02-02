import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// DexScreener API - provides rich token data with images, socials, price changes
const DEXSCREENER_API = 'https://api.dexscreener.com';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'getTrending';

    if (action === 'getTrending') {
      // Fetch latest boosted tokens (these are active/trending)
      const [boostsRes, profilesRes] = await Promise.all([
        fetch(`${DEXSCREENER_API}/token-boosts/top/v1`),
        fetch(`${DEXSCREENER_API}/token-profiles/latest/v1`)
      ]);

      const boosts = await boostsRes.json();
      const profiles = await profilesRes.json();

      // Build profile lookup map
      const profileMap = new Map();
      if (Array.isArray(profiles)) {
        profiles.forEach(p => {
          if (p.chainId === 'solana') {
            profileMap.set(p.tokenAddress, p);
          }
        });
      }

      // Get Solana tokens from boosts
      const solanaTokens = (Array.isArray(boosts) ? boosts : [boosts])
        .filter(t => t && t.chainId === 'solana')
        .slice(0, 50);

      // Fetch detailed pair data for each token
      const tokenDataPromises = solanaTokens.map(async (token) => {
        try {
          const pairRes = await fetch(`${DEXSCREENER_API}/token-pairs/v1/solana/${token.tokenAddress}`);
          const pairs = await pairRes.json();
          
          if (!Array.isArray(pairs) || pairs.length === 0) return null;
          
          // Get the most liquid pair
          const pair = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
          
          const profile = profileMap.get(token.tokenAddress);
          
          // Extract socials
          const socials = pair.info?.socials || [];
          const twitter = socials.find(s => s.platform === 'twitter')?.handle;
          const telegram = socials.find(s => s.platform === 'telegram')?.handle;
          const website = pair.info?.websites?.[0]?.url;

          return {
            mint: token.tokenAddress,
            symbol: pair.baseToken?.symbol || 'UNKNOWN',
            name: pair.baseToken?.name || 'Unknown Token',
            image_url: pair.info?.imageUrl || profile?.icon || token.icon || '',
            price_usd: parseFloat(pair.priceUsd) || 0,
            market_cap: pair.marketCap || pair.fdv || 0,
            liquidity: pair.liquidity?.usd || 0,
            volume24h: pair.volume?.h24 || 0,
            volume5m: pair.volume?.m5 || 0,
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
            holders: 0, // DexScreener doesn't provide holders
            twitter: twitter ? `https://twitter.com/${twitter}` : null,
            telegram: telegram ? `https://t.me/${telegram}` : null,
            website: website || null,
            dexId: pair.dexId,
            pairAddress: pair.pairAddress,
            createdAt: pair.pairCreatedAt || Date.now(),
            bonding_curve_status: pair.dexId === 'pumpfun' ? 'bonding_curve' : 'migrated',
            boostAmount: token.totalAmount || 0
          };
        } catch (e) {
          console.error(`Error fetching pair for ${token.tokenAddress}:`, e);
          return null;
        }
      });

      const tokens = (await Promise.all(tokenDataPromises)).filter(Boolean);

      return Response.json({
        ok: true,
        data: tokens,
        meta: { source: 'dexscreener', timestamp: Date.now() }
      });
    }

    if (action === 'getToken') {
      const { mint } = body;
      if (!mint) {
        return Response.json({ ok: false, error: 'mint required' }, { status: 400 });
      }

      const pairRes = await fetch(`${DEXSCREENER_API}/token-pairs/v1/solana/${mint}`);
      const pairs = await pairRes.json();

      if (!Array.isArray(pairs) || pairs.length === 0) {
        return Response.json({ ok: false, error: 'Token not found' }, { status: 404 });
      }

      const pair = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      
      const socials = pair.info?.socials || [];
      const twitter = socials.find(s => s.platform === 'twitter')?.handle;
      const telegram = socials.find(s => s.platform === 'telegram')?.handle;
      const website = pair.info?.websites?.[0]?.url;

      return Response.json({
        ok: true,
        data: {
          mint,
          symbol: pair.baseToken?.symbol || 'UNKNOWN',
          name: pair.baseToken?.name || 'Unknown Token',
          image_url: pair.info?.imageUrl || '',
          price_usd: parseFloat(pair.priceUsd) || 0,
          market_cap: pair.marketCap || pair.fdv || 0,
          liquidity: pair.liquidity?.usd || 0,
          volume24h: pair.volume?.h24 || 0,
          volume5m: pair.volume?.m5 || 0,
          priceChange5m: pair.priceChange?.m5 || 0,
          priceChange1h: pair.priceChange?.h1 || 0,
          priceChange6h: pair.priceChange?.h6 || 0,
          priceChange24h: pair.priceChange?.h24 || 0,
          buys_5m: pair.txns?.m5?.buys || 0,
          sells_5m: pair.txns?.m5?.sells || 0,
          buys_1h: pair.txns?.h1?.buys || 0,
          sells_1h: pair.txns?.h1?.sells || 0,
          twitter: twitter ? `https://twitter.com/${twitter}` : null,
          telegram: telegram ? `https://t.me/${telegram}` : null,
          website: website || null,
          dexId: pair.dexId,
          pairAddress: pair.pairAddress,
          createdAt: pair.pairCreatedAt || Date.now(),
          bonding_curve_status: pair.dexId === 'pumpfun' ? 'bonding_curve' : 'migrated'
        }
      });
    }

    if (action === 'searchTokens') {
      const { query } = body;
      if (!query) {
        return Response.json({ ok: false, error: 'query required' }, { status: 400 });
      }

      const searchRes = await fetch(`${DEXSCREENER_API}/latest/dex/search?q=${encodeURIComponent(query)}`);
      const searchData = await searchRes.json();

      const solanaPairs = (searchData.pairs || [])
        .filter(p => p.chainId === 'solana')
        .slice(0, 20);

      const tokens = solanaPairs.map(pair => {
        const socials = pair.info?.socials || [];
        const twitter = socials.find(s => s.platform === 'twitter')?.handle;
        const telegram = socials.find(s => s.platform === 'telegram')?.handle;
        const website = pair.info?.websites?.[0]?.url;

        return {
          mint: pair.baseToken?.address,
          symbol: pair.baseToken?.symbol || 'UNKNOWN',
          name: pair.baseToken?.name || 'Unknown Token',
          image_url: pair.info?.imageUrl || '',
          price_usd: parseFloat(pair.priceUsd) || 0,
          market_cap: pair.marketCap || pair.fdv || 0,
          liquidity: pair.liquidity?.usd || 0,
          volume24h: pair.volume?.h24 || 0,
          priceChange5m: pair.priceChange?.m5 || 0,
          priceChange1h: pair.priceChange?.h1 || 0,
          buys_5m: pair.txns?.m5?.buys || 0,
          sells_5m: pair.txns?.m5?.sells || 0,
          twitter: twitter ? `https://twitter.com/${twitter}` : null,
          telegram: telegram ? `https://t.me/${telegram}` : null,
          website: website || null,
          dexId: pair.dexId,
          pairAddress: pair.pairAddress,
          createdAt: pair.pairCreatedAt || Date.now(),
          bonding_curve_status: pair.dexId === 'pumpfun' ? 'bonding_curve' : 'migrated'
        };
      });

      return Response.json({
        ok: true,
        data: tokens
      });
    }

    return Response.json({ ok: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('memeTokens error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});