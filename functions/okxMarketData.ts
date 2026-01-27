// @ts-nocheck
/// <reference lib="deno.ns" />
// OKX Market Data - caching + in-flight dedupe + safe upstream parsing (no 429 throttle)

const OKX_API_URL = Deno.env.get("OKX_BASE_URL") || "https://www.okx.com";

// CORS for ALL responses
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

// In-memory cache
const dataCache = new Map();

// Cache TTLs (ms)
const CACHE_TTL = {
  instruments: 300000, // 5 min
  tickers: 3000,       // 3 sec
  ticker: 2000,        // 2 sec
  premium: 5000,       // 5 sec
  candles: 30000,      // 30 sec
  mark: 3000,          // 3 sec
};

function getCached(key, type) {
  const entry = dataCache.get(key);
  if (!entry) return null;

  const ttl = CACHE_TTL[type] ?? 5000;
  if (Date.now() - entry.timestamp > ttl) {
    dataCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  dataCache.set(key, { data, timestamp: Date.now() });
}

// In-flight de-duplication (same cacheKey in parallel => one upstream call)
const inflight = new Map();

class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

// Safe OKX JSON fetch (handles WAF/HTML/non-JSON without crashing)
async function okxGetJson(url) {
  try {
    const res = await fetch(url, { 
      headers: { 
        "accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      } 
    });
    const text = await res.text();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new HttpError(
        502,
        "UPSTREAM_NON_JSON",
        `OKX returned non-JSON (HTTP ${res.status})`,
        { url, sample: text.slice(0, 200) }
      );
    }

    if (!res.ok) {
      throw new HttpError(
        502,
        "UPSTREAM_HTTP",
        `OKX HTTP error (HTTP ${res.status})`,
        { url, upstream: parsed }
      );
    }

    if (parsed?.code !== "0") {
      throw new HttpError(
        502,
        "OKX_ERROR",
        parsed?.msg || "OKX error",
        { url, upstream: parsed }
      );
    }

    return parsed;
  } catch (err) {
    // Handle network errors (connection reset, timeout) gracefully
    if (err instanceof HttpError) throw err;
    throw new HttpError(503, "NETWORK_ERROR", err.message, { url });
  }
}

async function getOrFetch(cacheKey, type, fetcher) {
  const cached = getCached(cacheKey, type);
  if (cached) return { data: cached, cached: true };

  const existing = inflight.get(cacheKey);
  if (existing) return { data: await existing, shared: true };

  const p = (async () => {
    const data = await fetcher();
    setCache(cacheKey, data);
    return data;
  })().finally(() => inflight.delete(cacheKey));

  inflight.set(cacheKey, p);
  return { data: await p };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: { code: "METHOD_NOT_ALLOWED" } }, 405);

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: { code: "INVALID_JSON" } }, 400);
    }

    const { action, ...params } = body || {};
    if (!action) return json({ ok: false, error: { code: "MISSING_ACTION" } }, 400);

    // ==================== LIST SWAP INSTRUMENTS ====================
    if (action === "listInstrumentsSwap") {
      const cacheKey = "instruments_swap";

      const { data, cached, shared } = await getOrFetch(cacheKey, "instruments", async () => {
        const result = await okxGetJson(`${OKX_API_URL}/api/v5/public/instruments?instType=SWAP`);
        return (result.data || []).map((i) => ({
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
          state: i.state,
        }));
      });

      return json({ ok: true, data, cached: !!cached, shared: !!shared });
    }

    // ==================== GET SWAP TICKERS (ALL) ====================
    if (action === "getTickersSwap") {
      const cacheKey = "tickers_swap";

      const { data, cached, shared } = await getOrFetch(cacheKey, "tickers", async () => {
        const result = await okxGetJson(`${OKX_API_URL}/api/v5/market/tickers?instType=SWAP`);
        return (result.data || []).map((t) => ({
          instId: t.instId,
          last: num(t.last),
          lastSz: num(t.lastSz),
          askPx: num(t.askPx),
          bidPx: num(t.bidPx),
          open24h: num(t.open24h),
          high24h: num(t.high24h),
          low24h: num(t.low24h),
          vol24h: num(t.vol24h),
          volCcy24h: num(t.volCcy24h),
          priceChangePercent: t.open24h
            ? (((num(t.last) - num(t.open24h)) / num(t.open24h)) * 100).toFixed(2)
            : "0",
        }));
      });

      return json({ ok: true, data, cached: !!cached, shared: !!shared });
    }

    // ==================== GET SINGLE TICKER ====================
    if (action === "getTicker") {
      const { instId } = params;
      if (!instId) return json({ ok: false, error: { code: "MISSING_INST_ID" } }, 400);

      const cacheKey = `ticker_${instId}`;

      const { data, cached, shared } = await getOrFetch(cacheKey, "ticker", async () => {
        const result = await okxGetJson(
          `${OKX_API_URL}/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`
        );
        const t = result.data?.[0];
        if (!t) throw new HttpError(502, "UPSTREAM_EMPTY", "OKX returned empty ticker", { instId });

        return {
          instId: t.instId,
          last: num(t.last),
          lastSz: num(t.lastSz),
          askPx: num(t.askPx),
          bidPx: num(t.bidPx),
          open24h: num(t.open24h),
          high24h: num(t.high24h),
          low24h: num(t.low24h),
          vol24h: num(t.vol24h),
          volCcy24h: num(t.volCcy24h),
          priceChangePercent: t.open24h
            ? (((num(t.last) - num(t.open24h)) / num(t.open24h)) * 100).toFixed(2)
            : "0",
        };
      });

      return json({ ok: true, data, cached: !!cached, shared: !!shared });
    }

    // ==================== GET PREMIUM INDEX ====================
    if (action === "getPremiumIndex") {
      const { instId } = params;
      if (!instId) return json({ ok: false, error: { code: "MISSING_INST_ID" } }, 400);

      const cacheKey = `premium_${instId}`;

      const { data, cached, shared } = await getOrFetch(cacheKey, "premium", async () => {
        const [markResult, fundingResult] = await Promise.all([
          okxGetJson(
            `${OKX_API_URL}/api/v5/public/mark-price?instType=SWAP&instId=${encodeURIComponent(instId)}`
          ),
          okxGetJson(
            `${OKX_API_URL}/api/v5/public/funding-rate?instId=${encodeURIComponent(instId)}`
          ),
        ]);

        const markData = markResult.data?.[0] || {};
        const fundingData = fundingResult.data?.[0] || {};

        return {
          instId,
          markPrice: num(markData.markPx),
          indexPrice: num(markData.idxPx),
          fundingRate: num(fundingData.fundingRate),
          nextFundingRate: num(fundingData.nextFundingRate),
          fundingTime: fundingData.fundingTime,
        };
      });

      return json({ ok: true, data, cached: !!cached, shared: !!shared });
    }

    // ==================== GET CANDLES ====================
    if (action === "getCandles") {
      const { instId, bar = "15m", limit = 300 } = params;
      if (!instId) return json({ ok: false, error: { code: "MISSING_INST_ID" } }, 400);

      const safeLimit = Math.min(Number(limit) || 300, 300);
      const cacheKey = `candles_${instId}_${bar}_${safeLimit}`;

      const { data, cached, shared } = await getOrFetch(cacheKey, "candles", async () => {
        const endpoint =
          `/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${encodeURIComponent(bar)}&limit=${safeLimit}`;
        const result = await okxGetJson(`${OKX_API_URL}${endpoint}`);

        const candles = (result.data || [])
          .map((c) => ({
            time: Math.floor(Number(c[0]) / 1000),
            open: num(c[1]),
            high: num(c[2]),
            low: num(c[3]),
            close: num(c[4]),
            volume: num(c[5]),
            volCcy: num(c[6]),
          }))
          .reverse();

        return candles;
      });

      return json({ ok: true, data, cached: !!cached, shared: !!shared });
    }

    // ==================== GET MARK PRICE ====================
    if (action === "getMarkPrice") {
      const { instId } = params;
      if (!instId) return json({ ok: false, error: { code: "MISSING_INST_ID" } }, 400);

      const cacheKey = `mark_${instId}`;

      const { data, cached, shared } = await getOrFetch(cacheKey, "mark", async () => {
        const result = await okxGetJson(
          `${OKX_API_URL}/api/v5/public/mark-price?instType=SWAP&instId=${encodeURIComponent(instId)}`
        );
        return result.data?.[0] || null;
      });

      return json({ ok: true, data, cached: !!cached, shared: !!shared });
    }

    return json({ ok: false, error: { code: "INVALID_ACTION" } }, 400);
  } catch (e) {
    if (e instanceof HttpError) {
      return json(
        { ok: false, error: { code: e.code, message: e.message, details: e.details } },
        e.status
      );
    }

    console.error("[OKX_MARKET_FATAL]", e?.message || e);
    return json({ ok: false, error: { code: "INTERNAL_ERROR", message: e?.message || "Unknown error" } }, 500);
  }
});