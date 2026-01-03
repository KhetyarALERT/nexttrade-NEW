import { useEffect, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { createChart, ColorType } from "lightweight-charts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Maximize2, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";

// WebSocket endpoints (PUBLIC - no auth required)
const WS_FUTURES_URL = 'wss://open-api-swap.bingx.com/market';

const TIMEFRAMES = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" }
];

const log = (action, data) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [CHART] ${action}:`, JSON.stringify(data));
};

// Normalize timestamp to seconds (TradingView standard)
const normalizeTime = (t) => {
  if (t > 1e12) return Math.floor(t / 1000); // milliseconds to seconds
  return Math.floor(t); // already seconds
};

export default function ProfessionalChart({ symbol = "BTC-USDT", onPriceUpdate }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const candlesRef = useRef([]); // Store candles for WS updates
  const wsRef = useRef(null);
  const initializedRef = useRef(false);
  
  const [timeframe, setTimeframe] = useState("15m");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [marketData, setMarketData] = useState({
    price: 0,
    change: 0,
    changePercent: 0,
    high: 0,
    low: 0,
    volume: 0
  });

  // Initialize chart ONCE
  useEffect(() => {
    if (!chartContainerRef.current || chartRef.current) return;

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
        vertLine: { color: '#758696', width: 1, style: 3, labelBackgroundColor: '#2962FF' },
        horzLine: { color: '#758696', width: 1, style: 3, labelBackgroundColor: '#2962FF' },
      },
      rightPriceScale: { borderColor: '#2B2B43', scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: { borderColor: '#2B2B43', timeVisible: true, secondsVisible: false, rightOffset: 5, barSpacing: 8 },
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
      if (chartContainerRef.current && chart) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    log('CHART_INIT', { symbol });

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Fetch REST data ONCE, then connect WebSocket
  useEffect(() => {
    let mounted = true;
    initializedRef.current = false;
    
    const loadDataAndConnect = async () => {
      setLoading(true);
      setError(null);
      
      // Close existing WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      try {
        // STEP 1: Fetch REST candles ONCE
        log('REST_FETCH_START', { symbol, timeframe });
        
        const result = await base44.functions.invoke('bingxMarketData', {
          action: 'getKlines',
          params: { symbol, interval: timeframe, limit: 500 }
        });

        if (!mounted) return;

        if (!result.data?.success || !result.data?.data) {
          throw new Error(result.data?.error || 'Failed to fetch klines');
        }

        // STEP 2: Normalize and SORT ascending
        const klines = result.data.data.map(k => ({
          time: normalizeTime(k.time),
          open: parseFloat(k.open),
          high: parseFloat(k.high),
          low: parseFloat(k.low),
          close: parseFloat(k.close),
          volume: parseFloat(k.volume)
        }));
        
        // STRICT ascending sort
        klines.sort((a, b) => a.time - b.time);
        
        // Remove duplicates (keep last)
        const uniqueKlines = [];
        const seenTimes = new Set();
        for (let i = klines.length - 1; i >= 0; i--) {
          if (!seenTimes.has(klines[i].time)) {
            seenTimes.add(klines[i].time);
            uniqueKlines.unshift(klines[i]);
          }
        }
        
        // Store for WS updates
        candlesRef.current = uniqueKlines;
        
        // STEP 3: Set data ONCE
        if (candleSeriesRef.current && volumeSeriesRef.current) {
          candleSeriesRef.current.setData(uniqueKlines);
          
          const volumeData = uniqueKlines.map(k => ({
            time: k.time,
            value: k.volume,
            color: k.close >= k.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
          }));
          volumeSeriesRef.current.setData(volumeData);
        }
        
        // Set market data from last candle
        const lastCandle = uniqueKlines[uniqueKlines.length - 1];
        const firstCandle = uniqueKlines[0];
        
        setMarketData({
          price: lastCandle.close,
          change: lastCandle.close - firstCandle.open,
          changePercent: ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100,
          high: lastCandle.high,
          low: lastCandle.low,
          volume: lastCandle.volume
        });
        
        if (onPriceUpdate) onPriceUpdate(lastCandle.close);
        
        initializedRef.current = true;
        log('REST_FETCH_SUCCESS', { count: uniqueKlines.length, lastTime: lastCandle.time });
        
        // STEP 4: Connect WebSocket for live updates
        connectWebSocket();
        
      } catch (err) {
        if (mounted) {
          log('REST_FETCH_ERROR', { error: err.message });
          setError(err.message);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    const connectWebSocket = () => {
      const ws = new WebSocket(WS_FUTURES_URL);
      wsRef.current = ws;
      
      ws.onopen = () => {
        log('WS_OPEN', { url: WS_FUTURES_URL });
        setWsConnected(true);
        
        // Subscribe to kline stream
        const klineSub = {
          id: `kline_${Date.now()}`,
          reqType: "sub",
          dataType: `${symbol}@kline_${timeframe}`
        };
        ws.send(JSON.stringify(klineSub));
        log('WS_SUBSCRIBE', klineSub);
        
        // Subscribe to trade for real-time price
        const tradeSub = {
          id: `trade_${Date.now()}`,
          reqType: "sub",
          dataType: `${symbol}@trade`
        };
        ws.send(JSON.stringify(tradeSub));
        log('WS_SUBSCRIBE', tradeSub);
      };
      
      ws.onmessage = (event) => {
        if (event.data === 'Pong' || !initializedRef.current) return;
        
        try {
          const msg = JSON.parse(event.data);
          
          // Handle kline update
          if (msg.dataType?.includes('@kline') && msg.data) {
            const k = msg.data;
            const wsCandle = {
              time: normalizeTime(k.T || k.t),
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v || 0)
            };
            
            const candles = candlesRef.current;
            if (candles.length === 0) return;
            
            const lastCandle = candles[candles.length - 1];
            
            if (wsCandle.time === lastCandle.time) {
              // UPDATE current candle
              candles[candles.length - 1] = wsCandle;
              if (candleSeriesRef.current) {
                candleSeriesRef.current.update(wsCandle);
              }
            } else if (wsCandle.time > lastCandle.time) {
              // APPEND new candle
              candles.push(wsCandle);
              if (candleSeriesRef.current) {
                candleSeriesRef.current.update(wsCandle);
              }
            }
            // NEVER insert older candles
            
            setMarketData(prev => ({ ...prev, price: wsCandle.close }));
            if (onPriceUpdate) onPriceUpdate(wsCandle.close);
          }
          
          // Handle trade update for real-time price
          if (msg.dataType?.includes('@trade') && msg.data) {
            const price = parseFloat(msg.data.p);
            if (price > 0) {
              setMarketData(prev => ({ ...prev, price }));
              if (onPriceUpdate) onPriceUpdate(price);
            }
          }
          
        } catch (err) {
          // Ignore parse errors
        }
      };
      
      ws.onclose = (e) => {
        log('WS_CLOSE', { code: e.code });
        setWsConnected(false);
        // Reconnect after 5 seconds if component still mounted
        if (mounted) {
          setTimeout(() => {
            if (mounted && initializedRef.current) connectWebSocket();
          }, 5000);
        }
      };
      
      ws.onerror = () => {
        log('WS_ERROR', { symbol });
      };
      
      // Ping every 20s
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('Ping');
        }
      }, 20000);
      
      ws._pingInterval = pingInterval;
    };
    
    loadDataAndConnect();
    
    return () => {
      mounted = false;
      if (wsRef.current) {
        if (wsRef.current._pingInterval) clearInterval(wsRef.current._pingInterval);
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [symbol, timeframe, onPriceUpdate]);

  const handleRefresh = () => {
    initializedRef.current = false;
    candlesRef.current = [];
    if (wsRef.current) {
      wsRef.current.close();
    }
    // Trigger re-fetch by updating a dummy state
    setLoading(true);
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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2B2B43]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold text-xs">
              {symbol.split('-')[0].substring(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm">{symbol}</span>
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
              <div className="text-[10px] text-gray-500">Perpetual</div>
            </div>
          </div>
          
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono ${isPositive ? 'text-[#26A69A]' : 'text-[#EF5350]'}`}>
              ${formatPrice(marketData.price)}
            </span>
            <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-[#26A69A]' : 'text-[#EF5350]'}`}>
              {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {isPositive ? '+' : ''}{marketData.changePercent.toFixed(2)}%
            </div>
          </div>

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
              <span className="text-gray-500">Vol</span>
              <span className="ml-2 text-white font-mono">{formatVolume(marketData.volume)}</span>
            </div>
          </div>
        </div>

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

      {/* Chart */}
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
      
      <div className="px-4 py-2 border-t border-[#2B2B43] flex items-center justify-between text-[10px] text-gray-500">
        <span>BingX API • {wsConnected ? 'WebSocket Live' : 'Connecting...'}</span>
        <span>TradingView Charts</span>
      </div>
    </Card>
  );
}

ProfessionalChart.propTypes = {
  symbol: PropTypes.string,
  onPriceUpdate: PropTypes.func
};