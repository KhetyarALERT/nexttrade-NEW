// @ts-nocheck
/// <reference lib="deno.ns" />
// Meme Terminal - Token discovery, details, watchlist

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Cache for market data
const dataCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

function getCached(key) {
  const entry = dataCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    dataCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  dataCache.set(key, { data, timestamp: Date.now() });
}

// DexScreener API
const DEXSCREENER_BASE = 'https://api.dexscreener.com/latest';

async function fetchDexScreener(endpoint) {
  const res = await fetch(`${DEXSCREENER_BASE}${endpoint}`);
  if (!res.ok) throw new Error(`DexScreener error: ${res.status}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }
    });
  }
  
  let base44 = null;
  let user = null;
  
  try {
    base44 = createClientFromRequest(req);
    user = await base44.auth.me().catch(() => null);
  } catch {
    // Allow unauthenticated access for public data
  }
  
  try {
    const body = await req.json().catch(() => ({}));
    const { action, ...params } = body;
    
    // ==================== LIST TOP TOKENS ====================
    if (action === 'listTopTokens') {
      const cacheKey = 'top_tokens_solana';
      const cached = getCached(cacheKey);
      if (cached) return Response.json({ ok: true, data: cached });
      
      try {
        // Fetch top Solana pairs from DexScreener
        const data = await fetchDexScreener('/dex/tokens/So11111111111111111111111111111111111111112');
        
        const tokens = (data.pairs || []).slice(0, 50).map(pair => ({
          mint: pair.baseToken?.address || '',
          symbol: pair.baseToken?.symbol || '',
          name: pair.baseToken?.name || '',
          priceUsd: parseFloat(pair.priceUsd) || 0,
          priceNative: parseFloat(pair.priceNative) || 0,
          change24h: parseFloat(pair.priceChange?.h24) || 0,
          vol24h: parseFloat(pair.volume?.h24) || 0,
          liquidity: parseFloat(pair.liquidity?.usd) || 0,
          txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
          marketCap: parseFloat(pair.fdv) || 0,
          pairAddress: pair.pairAddress,
          dexId: pair.dexId
        }));
        
        setCache(cacheKey, tokens);
        return Response.json({ ok: true, data: tokens });
      } catch (err) {
        console.error('[MEME_TERMINAL] listTopTokens error:', err.message);
        return Response.json({ ok: false, error: { code: 'FETCH_ERROR', message: err.message } }, { status: 500 });
      }
    }
    
    // ==================== GET TOKEN DETAILS ====================
    if (action === 'getTokenDetails') {
      const { mint } = params;
      if (!mint) return Response.json({ ok: false, error: { code: 'MISSING_MINT', message: 'Mint address required' } }, { status: 400 });
      
      const cacheKey = `token_${mint}`;
      const cached = getCached(cacheKey);
      if (cached) return Response.json({ ok: true, data: cached });
      
      try {
        const data = await fetchDexScreener(`/dex/tokens/${mint}`);
        const pair = data.pairs?.[0];
        
        if (!pair) {
          return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Token not found' } }, { status: 404 });
        }
        
        // Determine stage based on liquidity and DEX
        let stage = 'UNKNOWN';
        if (pair.dexId === 'pumpfun' || pair.liquidity?.usd < 10000) {
          stage = 'PRE_PUMP';
        } else if (pair.liquidity?.usd >= 10000) {
          stage = 'POST_DEX';
        }
        
        // Risk flags
        const riskFlags = [];
        if (pair.liquidity?.usd < 5000) riskFlags.push('LOW_LIQUIDITY');
        if ((pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0) < 100) riskFlags.push('LOW_ACTIVITY');
        
        const tokenDetails = {
          mint: pair.baseToken?.address,
          symbol: pair.baseToken?.symbol,
          name: pair.baseToken?.name,
          priceUsd: parseFloat(pair.priceUsd) || 0,
          priceNative: parseFloat(pair.priceNative) || 0,
          change24h: parseFloat(pair.priceChange?.h24) || 0,
          change6h: parseFloat(pair.priceChange?.h6) || 0,
          change1h: parseFloat(pair.priceChange?.h1) || 0,
          vol24h: parseFloat(pair.volume?.h24) || 0,
          liquidity: parseFloat(pair.liquidity?.usd) || 0,
          marketCap: parseFloat(pair.fdv) || 0,
          txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
          buys24h: pair.txns?.h24?.buys || 0,
          sells24h: pair.txns?.h24?.sells || 0,
          stage,
          source: pair.dexId || 'DEX',
          riskFlags,
          pairAddress: pair.pairAddress,
          quoteToken: pair.quoteToken?.symbol,
          createdAt: pair.pairCreatedAt
        };
        
        setCache(cacheKey, tokenDetails);
        return Response.json({ ok: true, data: tokenDetails });
      } catch (err) {
        console.error('[MEME_TERMINAL] getTokenDetails error:', err.message);
        return Response.json({ ok: false, error: { code: 'FETCH_ERROR', message: err.message } }, { status: 500 });
      }
    }
    
    // ==================== GET CANDLES ====================
    if (action === 'getCandles') {
      const { mint, timeframe = '15m' } = params;
      if (!mint) return Response.json({ ok: false, error: { code: 'MISSING_MINT', message: 'Mint address required' } }, { status: 400 });
      
      // DexScreener doesn't provide candles directly - would need different API
      // Return empty for now with proper structure
      return Response.json({
        ok: true,
        data: {
          candles: [],
          note: 'Candle data requires additional integration (e.g., Birdeye)'
        }
      });
    }
    
    // ==================== WATCHLIST ADD ====================
    if (action === 'watchlistAdd') {
      if (!user) return Response.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Login required' } }, { status: 401 });
      
      const { mint, symbol, name } = params;
      if (!mint) return Response.json({ ok: false, error: { code: 'MISSING_MINT', message: 'Mint address required' } }, { status: 400 });
      
      // Check if already in watchlist
      const existing = await base44.entities.MemeWatchlist.filter({ user_id: user.id, mint });
      if (existing?.length) return Response.json({ ok: true, data: { id: existing[0].id, alreadyExists: true } });
      
      const nowISO = new Date().toISOString();
      const entry = await base44.asServiceRole.entities.MemeWatchlist.create({
        user_id: user.id,
        mint,
        symbol: symbol || '',
        name: name || '',
        added_at: nowISO,
        created_at: nowISO
      });
      
      return Response.json({ ok: true, data: { id: entry.id, alreadyExists: false } });
    }
    
    // ==================== WATCHLIST REMOVE ====================
    if (action === 'watchlistRemove') {
      if (!user) return Response.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Login required' } }, { status: 401 });
      
      const { mint } = params;
      if (!mint) return Response.json({ ok: false, error: { code: 'MISSING_MINT', message: 'Mint address required' } }, { status: 400 });
      
      const existing = await base44.entities.MemeWatchlist.filter({ user_id: user.id, mint });
      if (existing?.length) {
        await base44.asServiceRole.entities.MemeWatchlist.delete(existing[0].id);
      }
      
      return Response.json({ ok: true });
    }
    
    // ==================== WATCHLIST LIST ====================
    if (action === 'watchlistList') {
      if (!user) return Response.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Login required' } }, { status: 401 });
      
      const watchlist = await base44.entities.MemeWatchlist.filter({ user_id: user.id }, '-created_date', 100);
      
      return Response.json({
        ok: true,
        data: (watchlist || []).map(w => ({
          id: w.id,
          mint: w.mint,
          symbol: w.symbol,
          name: w.name,
          priceAtAdd: w.price_at_add,
          notes: w.notes,
          addedAt: w.added_at || w.created_date
        }))
      });
    }
    
    return Response.json({ ok: false, error: { code: 'INVALID_ACTION', message: 'Invalid action' } }, { status: 400 });
    
  } catch (error) {
    console.error('[MEME_TERMINAL_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});