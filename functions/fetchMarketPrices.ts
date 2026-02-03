// @ts-nocheck
// deno-lint-ignore-file

// Public endpoint - market prices are public data, no auth required

Deno.serve(async (req) => {
  try {
    const FMP_API_KEY = Deno.env.get('FMP_API_KEY');
    
    if (!FMP_API_KEY) {
      return Response.json({ error: 'FMP API key not configured' }, { status: 500 });
    }

    const { symbols } = await req.json();
    
    // Default symbols if none provided
    const defaultSymbols = [
      'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD',
      'BTCUSD', 'ETHUSD',
      'AAPL', 'GOOGL', 'MSFT', 'AMZN'
    ];
    
    const symbolsToFetch = symbols || defaultSymbols;
    
    // Fetch quotes for all symbols
    const symbolsParam = symbolsToFetch.join(',');
    const response = await fetch(
      `https://financialmodelingprep.com/api/v3/quote/${symbolsParam}?apikey=${FMP_API_KEY}`
    );
    
    if (!response.ok) {
      return Response.json({ 
        error: 'Failed to fetch market data',
        status: response.status 
      }, { status: response.status });
    }
    
    const data = await response.json();
    
    // Transform the data to a cleaner format
    const prices = data.map(item => ({
      symbol: item.symbol,
      name: item.name,
      price: item.price,
      change: item.change,
      changesPercentage: item.changesPercentage,
      dayLow: item.dayLow,
      dayHigh: item.dayHigh,
      volume: item.volume,
      timestamp: item.timestamp
    }));
    
    return Response.json({ 
      success: true,
      data: prices,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return Response.json({ 
      error: error.message,
      success: false
    }, { status: 500 });
  }
});