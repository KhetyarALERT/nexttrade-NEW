import { useEffect, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { createChart, ColorType } from "lightweight-charts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Maximize2, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";

const TIMEFRAMES = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
  { label: "1M", value: "1M" }
];

// Activity logger
const log = (action, data) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [CHART] ${action}:`, data);
};

export default function ProfessionalChart({ symbol = "BTC-USDT", onPriceUpdate }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  
  const [timeframe, setTimeframe] = useState("15m");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [marketData, setMarketData] = useState({
    price: 0,
    change: 0,
    changePercent: 0,
    high: 0,
    low: 0,
    volume: 0
  });

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#787B86',
      },
      grid: {
        vertLines: { color: '#1f2937', style: 1 },
        horzLines: { color: '#1f2937', style: 1 },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#758696',
          width: 1,
          style: 3,
          labelBackgroundColor: '#2962FF',
        },
        horzLine: {
          color: '#758696',
          width: 1,
          style: 3,
          labelBackgroundColor: '#2962FF',
        },
      },
      rightPriceScale: {
        borderColor: '#2B2B43',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#2B2B43',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 8,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26A69A',
      downColor: '#EF5350',
      borderUpColor: '#26A69A',
      borderDownColor: '#EF5350',
      wickUpColor: '#26A69A',
      wickDownColor: '#EF5350',
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    log('CHART_INITIALIZED', { symbol });

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      log('CHART_DESTROYED', { symbol });
    };
  }, []);

  // Fetch real kline data from BingX
  const fetchKlineData = useCallback(async () => {
    setLoading(true);
    setError(null);
    log('FETCH_KLINES_START', { symbol, timeframe });

    try {
      const result = await base44.functions.invoke('bingxMarketData', {
        action: 'getKlines',
        params: { symbol, interval: timeframe, limit: 200 }
      });

      if (result.data?.success && result.data?.data) {
        const klines = result.data.data;
        
        if (candleSeriesRef.current && volumeSeriesRef.current) {
          candleSeriesRef.current.setData(klines);
          
          const volumeData = klines.map(k => ({
            time: k.time,
            value: k.volume,
            color: k.close >= k.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
          }));
          volumeSeriesRef.current.setData(volumeData);
          
          // Set current price from last candle
          const lastCandle = klines[klines.length - 1];
          const firstCandle = klines[0];
          const change = lastCandle.close - firstCandle.open;
          const changePercent = (change / firstCandle.open) * 100;
          
          setMarketData({
            price: lastCandle.close,
            change,
            changePercent,
            high: lastCandle.high,
            low: lastCandle.low,
            volume: lastCandle.volume
          });
          
          if (onPriceUpdate) onPriceUpdate(lastCandle.close);
          
          log('FETCH_KLINES_SUCCESS', { count: klines.length, lastPrice: lastCandle.close });
        }
      } else {
        throw new Error(result.data?.error || 'Failed to fetch data');
      }
    } catch (err) {
      log('FETCH_KLINES_ERROR', { error: err.message });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe, onPriceUpdate]);

  // Fetch 24h ticker for header stats
  const fetchTickerData = useCallback(async () => {
    try {
      const result = await base44.functions.invoke('bingxMarketData', {
        action: 'getTicker24h',
        params: { symbol }
      });

      if (result.data?.success && result.data?.data) {
        const ticker = result.data.data;
        setMarketData(prev => ({
          ...prev,
          price: ticker.lastPrice,
          change: ticker.priceChange,
          changePercent: ticker.priceChangePercent,
          high: ticker.highPrice,
          low: ticker.lowPrice,
          volume: ticker.quoteVolume
        }));
        
        if (onPriceUpdate) onPriceUpdate(ticker.lastPrice);
        log('FETCH_TICKER_SUCCESS', ticker);
      }
    } catch (err) {
      log('FETCH_TICKER_ERROR', { error: err.message });
    }
  }, [symbol, onPriceUpdate]);

  // WebSocket for real-time price updates
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;
    
    const connectWebSocket = () => {
      // BingX WebSocket for real-time kline updates
      const wsSymbol = symbol.replace('-', '');
      ws = new WebSocket(`wss://open-api-swap.bingx.com/swap-market`);
      
      ws.onopen = () => {
        log('WS_CONNECTED', { symbol });
        // Subscribe to kline stream
        ws.send(JSON.stringify({
          id: Date.now().toString(),
          reqType: "sub",
          dataType: `${symbol}@kline_${timeframe}`
        }));
      };
      
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.data && candleSeriesRef.current) {
            const k = msg.data;
            const candle = {
              time: Math.floor(k.T / 1000),
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c)
            };
            
            candleSeriesRef.current.update(candle);
            setMarketData(prev => ({
              ...prev,
              price: candle.close
            }));
            
            if (onPriceUpdate) onPriceUpdate(candle.close);
          }
        } catch (err) {
          // Ignore parse errors for ping/pong
        }
      };
      
      ws.onclose = () => {
        log('WS_DISCONNECTED', { symbol });
        // Reconnect after 3 seconds
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      };
      
      ws.onerror = (err) => {
        log('WS_ERROR', { error: err.message || 'WebSocket error' });
      };
    };
    
    // Load initial kline data first, then connect WebSocket
    fetchKlineData().then(() => {
      connectWebSocket();
    });
    
    // Fetch ticker once for 24h stats (not repeatedly)
    fetchTickerData();
    
    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [symbol, timeframe]); // Only reconnect when symbol or timeframe changes

  const handleRefresh = () => {
    fetchKlineData();
    fetchTickerData();
  };

  const formatPrice = (price) => {
    if (!price) return '0.00';
    if (price >= 1000) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(2);
    return price.toFixed(6);
  };

  const formatVolume = (vol) => {
    if (!vol) return '0';
    if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
    if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
    if (vol >= 1e3) return (vol / 1e3).toFixed(2) + 'K';
    return vol.toFixed(2);
  };

  const isPositive = marketData.changePercent >= 0;

  return (
    <Card className="border-0 shadow-none bg-[#131722] overflow-hidden">
      {/* Chart Header - BingX Style */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2B2B43]">
        <div className="flex items-center gap-6">
          {/* Symbol & Price */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold text-xs">
              {symbol.split('-')[0].substring(0, 2)}
            </div>
            <div>
              <div className="text-white font-bold text-sm">{symbol}</div>
              <div className="text-[10px] text-gray-500">Perpetual</div>
            </div>
          </div>
          
          {/* Price Display */}
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono ${isPositive ? 'text-[#26A69A]' : 'text-[#EF5350]'}`}>
              ${formatPrice(marketData.price)}
            </span>
            <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-[#26A69A]' : 'text-[#EF5350]'}`}>
              {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {isPositive ? '+' : ''}{marketData.changePercent.toFixed(2)}%
            </div>
          </div>

          {/* Stats */}
          <div className="hidden md:flex items-center gap-4 text-xs">
            <div>
              <span className="text-gray-500">24h High</span>
              <span className="ml-2 text-white font-mono">${formatPrice(marketData.high)}</span>
            </div>
            <div>
              <span className="text-gray-500">24h Low</span>
              <span className="ml-2 text-white font-mono">${formatPrice(marketData.low)}</span>
            </div>
            <div>
              <span className="text-gray-500">24h Vol</span>
              <span className="ml-2 text-white font-mono">${formatVolume(marketData.volume)}</span>
            </div>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map(tf => (
            <Button
              key={tf.value}
              variant="ghost"
              size="sm"
              onClick={() => setTimeframe(tf.value)}
              className={`h-7 px-2.5 text-xs font-medium ${
                tf.value === timeframe 
                  ? 'bg-[#2962FF] text-white hover:bg-[#2962FF]' 
                  : 'text-gray-400 hover:text-white hover:bg-[#2B2B43]'
              }`}
            >
              {tf.label}
            </Button>
          ))}
          <div className="w-px h-5 bg-[#2B2B43] mx-1" />
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-gray-400 hover:text-white"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-[#131722]/80 flex items-center justify-center z-10">
            <Loader2 className="h-8 w-8 text-[#2962FF] animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 bg-[#131722]/80 flex items-center justify-center z-10">
            <div className="text-center">
              <p className="text-red-500 text-sm mb-2">{error}</p>
              <Button size="sm" onClick={handleRefresh}>Retry</Button>
            </div>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-[500px]" />
      </div>
      
      {/* Footer */}
      <div className="px-4 py-2 border-t border-[#2B2B43] flex items-center justify-between text-[10px] text-gray-500">
        <span>Powered by BingX API</span>
        <span>TradingView Lightweight Charts</span>
      </div>
    </Card>
  );
}

ProfessionalChart.propTypes = {
  symbol: PropTypes.string,
  onPriceUpdate: PropTypes.func
};