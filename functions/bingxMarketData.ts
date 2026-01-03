import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * BingX Market Data API - Fetches real kline/candlestick data
 * Documentation: https://bingx-api.github.io/docs/#/en-us/swapV2/market-api.html
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, params } = await req.json();
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [BINGX_MARKET] Action: ${action}, Params:`, params);

    let result;

    switch (action) {
      case 'getKlines':
        result = await fetchKlines(params);
        break;
      case 'getTickers':
        result = await fetchTickers(params);
        break;
      case 'getContracts':
        result = await fetchContracts();
        break;
      case 'getTicker24h':
        result = await fetchTicker24h(params);
        break;
      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    console.log(`[${timestamp}] [BINGX_MARKET] Success: ${action}`);
    return Response.json({ success: true, data: result, timestamp });

  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [BINGX_MARKET] Error:`, error.message);
    return Response.json({ 
      success: false, 
      error: error.message,
      timestamp 
    }, { status: 500 });
  }
});

// Fetch K-Line/Candlestick data
async function fetchKlines({ symbol, interval = '15m', limit = 200 }) {
  // BingX uses format like BTC-USDT
  const formattedSymbol = symbol.includes('-') ? symbol : symbol.replace('USDT', '-USDT');
  
  // Map interval to BingX format
  const intervalMap = {
    '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
    '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w', '1M': '1M'
  };
  
  const bingxInterval = intervalMap[interval] || '15m';
  
  const url = `https://open-api.bingx.com/openApi/swap/v3/quote/klines?symbol=${formattedSymbol}&interval=${bingxInterval}&limit=${limit}`;
  
  console.log(`[BINGX] Fetching klines: ${url}`);
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.code !== 0) {
    throw new Error(data.msg || 'Failed to fetch klines');
  }
  
  // Transform to standard format: [{time, open, high, low, close, volume}]
  return data.data.map(k => ({
    time: Math.floor(k.time / 1000), // Convert to seconds
    open: parseFloat(k.open),
    high: parseFloat(k.high),
    low: parseFloat(k.low),
    close: parseFloat(k.close),
    volume: parseFloat(k.volume)
  }));
}

// Fetch all tickers
async function fetchTickers() {
  const url = 'https://open-api.bingx.com/openApi/swap/v2/quote/ticker';
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.code !== 0) {
    throw new Error(data.msg || 'Failed to fetch tickers');
  }
  
  return data.data.map(t => ({
    symbol: t.symbol,
    lastPrice: parseFloat(t.lastPrice),
    priceChange: parseFloat(t.priceChange),
    priceChangePercent: parseFloat(t.priceChangePercent),
    highPrice: parseFloat(t.highPrice),
    lowPrice: parseFloat(t.lowPrice),
    volume: parseFloat(t.volume),
    quoteVolume: parseFloat(t.quoteVolume)
  }));
}

// Fetch available contracts
async function fetchContracts() {
  const url = 'https://open-api.bingx.com/openApi/swap/v2/quote/contracts';
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.code !== 0) {
    throw new Error(data.msg || 'Failed to fetch contracts');
  }
  
  return data.data.map(c => ({
    symbol: c.symbol,
    asset: c.asset,
    currency: c.currency,
    contractId: c.contractId,
    size: parseFloat(c.size),
    pricePrecision: c.pricePrecision,
    quantityPrecision: c.quantityPrecision,
    feeRate: parseFloat(c.feeRate),
    status: c.status
  }));
}

// Fetch 24h ticker for specific symbol
async function fetchTicker24h({ symbol }) {
  const formattedSymbol = symbol.includes('-') ? symbol : symbol.replace('USDT', '-USDT');
  const url = `https://open-api.bingx.com/openApi/swap/v2/quote/ticker?symbol=${formattedSymbol}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.code !== 0) {
    throw new Error(data.msg || 'Failed to fetch ticker');
  }
  
  const t = data.data;
  return {
    symbol: t.symbol,
    lastPrice: parseFloat(t.lastPrice),
    priceChange: parseFloat(t.priceChange),
    priceChangePercent: parseFloat(t.priceChangePercent),
    highPrice: parseFloat(t.highPrice),
    lowPrice: parseFloat(t.lowPrice),
    volume: parseFloat(t.volume),
    quoteVolume: parseFloat(t.quoteVolume),
    openPrice: parseFloat(t.openPrice)
  };
}