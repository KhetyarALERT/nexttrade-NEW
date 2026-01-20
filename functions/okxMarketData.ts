// @ts-nocheck
/// <reference lib="deno.ns" />
// OKX Market Data - Public endpoints for instruments, tickers, candles

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { okResponse } from './okxCore.ts';

const OKX_API_URL = Deno.env.get('OKX_BASE_URL') || 'https://www.okx.com';

// Simple cache
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }
    });
  }
  
  // Allow public access for market data
  let user = null;
  try {
    const base44 = createClientFromRequest(req);
    user = await base44.auth.me().catch(() => null);
  } catch {
    // Public endpoint
  }
  
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, { status: 400 });
    }
    
    const { action, ...params } = body || {};
    
    if (!action) {
      return Response.json({ ok: false, error: { code: 'MISSING_ACTION', message: 'action parameter required' } }, { status: 400 });
    }
    
    // ==================== LIST SWAP INSTRUMENTS ====================
    if (action === 'listInstrumentsSwap') {
      const cacheKey = 'okx_instruments_swap';
      const cached = getCached(cacheKey);
      if (cached) return Response.json({ ok: true, data: cached });
      
      const res = await fetch(`${OKX_API_URL}/api/v5/public/instruments?instType=SWAP`);
      const result = await res.json();
      
      if (result.code !== '0') {
        return Response.json(okResponse(false, null, { code: 'FETCH_FAILED', message: result.msg || 'Failed to fetch instruments' }), { status: 502 });
      }
      
      const instruments = (result.data || []).map(i => ({
        instId: i.instId,
        instType: i.instType,
        baseCcy: i.baseCcy,
        quoteCcy: i.quoteCcy,
        settleCcy: i.settleCcy,
        ctVal: i.ctVal,
        ctMult: i.ctMult,
        minSz: i.minSz,
        tickSz: i.tickSz,
        lever: i.lever,
        state: i.state
      }));
      
      setCache(cacheKey, instruments);
      return Response.json({ ok: true, data: instruments });
    }
    
    // ==================== GET SWAP TICKERS ====================
    if (action === 'getTickersSwap') {
      const cacheKey = 'okx_tickers_swap';
      const cached = getCached(cacheKey);
      if (cached) return Response.json({ ok: true, data: cached });
      
      const res = await fetch(`${OKX_API_URL}/api/v5/market/tickers?instType=SWAP`);
      const result = await res.json();
      
      if (result.code !== '0') {
        return Response.json(okResponse(false, null, { code: 'FETCH_FAILED', message: result.msg || 'Failed to fetch tickers' }), { status: 502 });
      }
      
      const tickers = (result.data || []).map(t => ({
        instId: t.instId,
        last: parseFloat(t.last),
        lastSz: parseFloat(t.lastSz),
        askPx: parseFloat(t.askPx),
        bidPx: parseFloat(t.bidPx),
        open24h: parseFloat(t.open24h),
        high24h: parseFloat(t.high24h),
        low24h: parseFloat(t.low24h),
        vol24h: parseFloat(t.vol24h),
        volCcy24h: parseFloat(t.volCcy24h),
        change24h: parseFloat(t.sodUtc0 || 0)
      }));
      
      setCache(cacheKey, tickers);
      return Response.json({ ok: true, data: tickers });
    }
    
    // ==================== GET CANDLES ====================
    if (action === 'getCandles') {
      const { instId, bar = '15m', limit = 300 } = params;
      
      if (!instId) {
        return Response.json({ ok: false, error: { code: 'MISSING_INST_ID', message: 'instId required' } }, { status: 400 });
      }
      
      const cacheKey = `okx_candles_${instId}_${bar}`;
      const cached = getCached(cacheKey);
      if (cached) return Response.json({ ok: true, data: cached });
      
      const endpoint = `/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`;
      const res = await fetch(`${OKX_API_URL}${endpoint}`);
      const result = await res.json();
      
      if (result.code !== '0') {
        return Response.json(okResponse(false, null, { code: 'FETCH_FAILED', message: result.msg || 'Failed to fetch candles' }), { status: 502 });
      }
      
      const candles = (result.data || []).map(c => ({
        time: parseInt(c[0]) / 1000, // Convert ms to seconds
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        volume: parseFloat(c[5]),
        volCcy: parseFloat(c[6])
      })).reverse(); // OKX returns newest first, we want oldest first
      
      setCache(cacheKey, candles);
      return Response.json({ ok: true, data: candles });
    }

    // ==================== GET MARK PRICE ====================
    if (action === 'getMarkPrice') {
      const { instId } = params;
      if (!instId) {
        return Response.json({ ok: false, error: { code: 'MISSING_INST_ID', message: 'instId required' } }, { status: 400 });
      }

      const cacheKey = `okx_mark_${instId}`;
      const cached = getCached(cacheKey);
      if (cached) return Response.json({ ok: true, data: cached });

      const endpoint = `/api/v5/public/mark-price?instType=SWAP&instId=${instId}`;
      const res = await fetch(`${OKX_API_URL}${endpoint}`);
      const result = await res.json();

      if (result.code !== '0') {
        return Response.json(okResponse(false, null, { code: 'FETCH_FAILED', message: result.msg || 'Failed to fetch mark price' }), { status: 502 });
      }

      const mark = result.data?.[0] || null;
      setCache(cacheKey, mark);
      return Response.json({ ok: true, data: mark });
    }
    
    return Response.json({ ok: false, error: { code: 'INVALID_ACTION', message: 'Invalid action' } }, { status: 400 });
    
  } catch (error) {
    console.error('[OKX_MARKET_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});