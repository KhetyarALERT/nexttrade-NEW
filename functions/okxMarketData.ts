// @ts-nocheck
/// <reference lib="deno.ns" />
// OKX Market Data - Public endpoints with aggressive caching

const OKX_API_URL = Deno.env.get('OKX_BASE_URL') || 'https://www.okx.com';

// In-memory cache with longer TTLs
const dataCache = new Map();

// Cache TTLs by type (in ms)
const CACHE_TTL = {
  instruments: 300000,  // 5 minutes - rarely changes
  tickers: 3000,        // 3 seconds - fast moving
  ticker: 2000,         // 2 seconds - single ticker
  premium: 5000,        // 5 seconds - funding rate
  candles: 30000,       // 30 seconds - historical data
  mark: 3000,           // 3 seconds - mark price
};

function getCached(key, type = 'default') {
  const entry = dataCache.get(key);
  if (!entry) return null;
  
  const ttl = CACHE_TTL[type] || 5000;
  if (Date.now() - entry.timestamp > ttl) {
    dataCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  dataCache.set(key, { data, timestamp: Date.now() });
}

// Rate limiting - track request times
const requestTimes = new Map();
const MIN_REQUEST_INTERVAL = 500; // 500ms minimum between same requests

function shouldThrottle(key) {
  const lastTime = requestTimes.get(key);
  if (lastTime && Date.now() - lastTime < MIN_REQUEST_INTERVAL) {
    return true;
  }
  requestTimes.set(key, Date.now());
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Methods': 'POST, OPTIONS', 
        'Access-Control-Allow-Headers': 'Content-Type, Authorization' 
      }
    });
  }
  
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, error: { code: 'INVALID_JSON' } }, { status: 400 });
    }
    
    const { action, ...params } = body || {};
    
    if (!action) {
      return Response.json({ ok: false, error: { code: 'MISSING_ACTION' } }, { status: 400 });
    }

    // ==================== LIST SWAP INSTRUMENTS ====================
    if (action === 'listInstrumentsSwap') {
      const cacheKey = 'instruments_swap';
      const cached = getCached(cacheKey, 'instruments');
      if (cached) {
        return Response.json({ ok: true, data: cached, cached: true });
      }
      
      if (shouldThrottle(cacheKey)) {
        return Response.json({ ok: false, error: { code: 'RATE_LIMITED' } }, { status: 429 });
      }
      
      const res = await fetch(`${OKX_API_URL}/api/v5/public/instruments?instType=SWAP`);
      const result = await res.json();
      
      if (result.code !== '0') {
        return Response.json({ ok: false, error: { code: 'FETCH_FAILED', message: result.msg } }, { status: 502 });
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
        lotSz: i.lotSz,
        tickSz: i.tickSz,
        lever: i.lever,
        state: i.state
      }));
      
      setCache(cacheKey, instruments);
      return Response.json({ ok: true, data: instruments });
    }
    
    // ==================== GET SWAP TICKERS (ALL) ====================
    if (action === 'getTickersSwap') {
      const cacheKey = 'tickers_swap';
      const cached = getCached(cacheKey, 'tickers');
      if (cached) {
        return Response.json({ ok: true, data: cached, cached: true });
      }
      
      if (shouldThrottle(cacheKey)) {
        return Response.json({ ok: false, error: { code: 'RATE_LIMITED' } }, { status: 429 });
      }
      
      const res = await fetch(`${OKX_API_URL}/api/v5/market/tickers?instType=SWAP`);
      const result = await res.json();
      
      if (result.code !== '0') {
        return Response.json({ ok: false, error: { code: 'FETCH_FAILED', message: result.msg } }, { status: 502 });
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
        priceChangePercent: t.open24h ? (((parseFloat(t.last) - parseFloat(t.open24h)) / parseFloat(t.open24h)) * 100).toFixed(2) : '0'
      }));
      
      setCache(cacheKey, tickers);
      return Response.json({ ok: true, data: tickers });
    }
    
    // ==================== GET SINGLE TICKER ====================
    if (action === 'getTicker') {
      const { instId } = params;
      if (!instId) {
        return Response.json({ ok: false, error: { code: 'MISSING_INST_ID' } }, { status: 400 });
      }
      
      const cacheKey = `ticker_${instId}`;
      const cached = getCached(cacheKey, 'ticker');
      if (cached) {
        return Response.json({ ok: true, data: cached, cached: true });
      }
      
      if (shouldThrottle(cacheKey)) {
        return Response.json({ ok: false, error: { code: 'RATE_LIMITED' } }, { status: 429 });
      }
      
      const res = await fetch(`${OKX_API_URL}/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`);
      const result = await res.json();
      
      if (result.code !== '0' || !result.data?.[0]) {
        return Response.json({ ok: false, error: { code: 'FETCH_FAILED', message: result.msg } }, { status: 502 });
      }
      
      const t = result.data[0];
      const ticker = {
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
        priceChangePercent: t.open24h ? (((parseFloat(t.last) - parseFloat(t.open24h)) / parseFloat(t.open24h)) * 100).toFixed(2) : '0'
      };
      
      setCache(cacheKey, ticker);
      return Response.json({ ok: true, data: ticker });
    }
    
    // ==================== GET PREMIUM INDEX ====================
    if (action === 'getPremiumIndex') {
      const { instId } = params;
      if (!instId) {
        return Response.json({ ok: false, error: { code: 'MISSING_INST_ID' } }, { status: 400 });
      }
      
      const cacheKey = `premium_${instId}`;
      const cached = getCached(cacheKey, 'premium');
      if (cached) {
        return Response.json({ ok: true, data: cached, cached: true });
      }
      
      if (shouldThrottle(cacheKey)) {
        return Response.json({ ok: false, error: { code: 'RATE_LIMITED' } }, { status: 429 });
      }
      
      const [markRes, fundingRes] = await Promise.all([
        fetch(`${OKX_API_URL}/api/v5/public/mark-price?instType=SWAP&instId=${encodeURIComponent(instId)}`),
        fetch(`${OKX_API_URL}/api/v5/public/funding-rate?instId=${encodeURIComponent(instId)}`)
      ]);
      
      const [markResult, fundingResult] = await Promise.all([markRes.json(), fundingRes.json()]);
      
      const markData = markResult.data?.[0] || {};
      const fundingData = fundingResult.data?.[0] || {};
      
      const premium = {
        instId,
        markPrice: parseFloat(markData.markPx || '0'),
        indexPrice: parseFloat(markData.idxPx || '0'),
        fundingRate: parseFloat(fundingData.fundingRate || '0'),
        nextFundingRate: parseFloat(fundingData.nextFundingRate || '0'),
        fundingTime: fundingData.fundingTime
      };
      
      setCache(cacheKey, premium);
      return Response.json({ ok: true, data: premium });
    }
    
    // ==================== GET CANDLES ====================
    if (action === 'getCandles') {
      const { instId, bar = '15m', limit = 300 } = params;
      
      if (!instId) {
        return Response.json({ ok: false, error: { code: 'MISSING_INST_ID' } }, { status: 400 });
      }
      
      const cacheKey = `candles_${instId}_${bar}`;
      const cached = getCached(cacheKey, 'candles');
      if (cached) {
        return Response.json({ ok: true, data: cached, cached: true });
      }
      
      if (shouldThrottle(cacheKey)) {
        return Response.json({ ok: false, error: { code: 'RATE_LIMITED' } }, { status: 429 });
      }
      
      const endpoint = `/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${bar}&limit=${Math.min(limit, 300)}`;
      const res = await fetch(`${OKX_API_URL}${endpoint}`);
      const result = await res.json();
      
      if (result.code !== '0') {
        return Response.json({ ok: false, error: { code: 'FETCH_FAILED', message: result.msg } }, { status: 502 });
      }
      
      const candles = (result.data || []).map(c => ({
        time: parseInt(c[0]) / 1000,
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        volume: parseFloat(c[5]),
        volCcy: parseFloat(c[6])
      })).reverse();
      
      setCache(cacheKey, candles);
      return Response.json({ ok: true, data: candles });
    }

    // ==================== GET MARK PRICE ====================
    if (action === 'getMarkPrice') {
      const { instId } = params;
      if (!instId) {
        return Response.json({ ok: false, error: { code: 'MISSING_INST_ID' } }, { status: 400 });
      }

      const cacheKey = `mark_${instId}`;
      const cached = getCached(cacheKey, 'mark');
      if (cached) {
        return Response.json({ ok: true, data: cached, cached: true });
      }

      if (shouldThrottle(cacheKey)) {
        return Response.json({ ok: false, error: { code: 'RATE_LIMITED' } }, { status: 429 });
      }

      const endpoint = `/api/v5/public/mark-price?instType=SWAP&instId=${encodeURIComponent(instId)}`;
      const res = await fetch(`${OKX_API_URL}${endpoint}`);
      const result = await res.json();

      if (result.code !== '0') {
        return Response.json({ ok: false, error: { code: 'FETCH_FAILED', message: result.msg } }, { status: 502 });
      }

      const mark = result.data?.[0] || null;
      setCache(cacheKey, mark);
      return Response.json({ ok: true, data: mark });
    }
    
    return Response.json({ ok: false, error: { code: 'INVALID_ACTION' } }, { status: 400 });
    
  } catch (error) {
    console.error('[OKX_MARKET_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});