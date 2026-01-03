import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { createChart, ColorType } from "lightweight-charts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Maximize2, ArrowUp, ArrowDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { marketStore } from "./marketStore";

const TIMEFRAMES = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" }
];

const normalizeTime = (t) => t > 1e12 ? Math.floor(t / 1000) : Math.floor(t);

export default function ProfessionalChart({ symbol = "BTC-USDT", onPriceUpdate }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  
  const [timeframe, setTimeframe] = useState("15m");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wsConnected, setWsConnected] = useState(marketStore.connected);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);

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
    });

    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor: '#26A69A', downColor: '#EF5350',
      borderUpColor: '#26A69A', borderDownColor: '#EF5350',
      wickUpColor: '#26A69A', wickDownColor: '#EF5350',
    });

    volumeSeriesRef.current = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartRef.current = chart;

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

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Load initial data ONCE, then subscribe to store
  useEffect(() => {
    let unsubCandle = null;
    let unsubConnection = null;
    
    const init = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch REST candles ONCE
        const result = await base44.functions.invoke('bingxMarketData', {
          action: 'getKlines',
          params: { symbol, interval: timeframe, limit: 500 }
        });

        if (!result.data?.success || !result.data?.data) {
          throw new Error(result.data?.error || 'Failed to fetch klines');
        }

        // Normalize, dedupe, sort
        const raw = result.data.data.map(k => ({
          time: normalizeTime(k.time),
          open: parseFloat(k.open),
          high: parseFloat(k.high),
          low: parseFloat(k.low),
          close: parseFloat(k.close),
          volume: parseFloat(k.volume)
        }));
        
        raw.sort((a, b) => a.time - b.time);
        
        const seen = new Set();
        const candles = [];
        for (let i = raw.length - 1; i >= 0; i--) {
          if (!seen.has(raw[i].time)) {
            seen.add(raw[i].time);
            candles.unshift(raw[i]);
          }
        }
        
        // Store candles in marketStore
        marketStore.setCandles(symbol, timeframe, candles);
        
        // Set chart data ONCE
        if (candleSeriesRef.current && volumeSeriesRef.current) {
          candleSeriesRef.current.setData(candles);
          volumeSeriesRef.current.setData(candles.map(k => ({
            time: k.time,
            value: k.volume,
            color: k.close >= k.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
          })));
        }
        
        // Set initial price
        const last = candles[candles.length - 1];
        const first = candles[0];
        setCurrentPrice(last.close);
        setPriceChange(((last.close - first.open) / first.open) * 100);
        if (onPriceUpdate) onPriceUpdate(last.close);
        
        // Subscribe to WebSocket via store
        marketStore.subscribeWS(`${symbol}@kline_${timeframe}`);
        marketStore.subscribeWS(`${symbol}@trade`);
        
        // Subscribe to store updates
        const candleKey = marketStore.getCandleKey(symbol, timeframe);
        unsubCandle = marketStore.subscribe(`candle:${candleKey}`, (candle) => {
          if (candleSeriesRef.current) {
            candleSeriesRef.current.update(candle);
            if (volumeSeriesRef.current) {
              volumeSeriesRef.current.update({
                time: candle.time,
                value: candle.volume,
                color: candle.close >= candle.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
              });
            }
          }
          setCurrentPrice(candle.close);
          if (onPriceUpdate) onPriceUpdate(candle.close);
        });
        
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    // Subscribe to connection status
    unsubConnection = marketStore.subscribe('connected', setWsConnected);
    setWsConnected(marketStore.connected);
    
    init();
    
    return () => {
      if (unsubCandle) unsubCandle();
      if (unsubConnection) unsubConnection();
      marketStore.unsubscribeWS(`${symbol}@kline_${timeframe}`);
      marketStore.unsubscribeWS(`${symbol}@trade`);
    };
  }, [symbol, timeframe, onPriceUpdate]);

  const formatPrice = (p) => {
    if (!p) return '0.00';
    if (p >= 1000) return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return p >= 1 ? p.toFixed(2) : p.toFixed(6);
  };

  const isPositive = priceChange >= 0;

  return (
    <Card className="border-0 shadow-none bg-[#131722] overflow-hidden">
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
              ${formatPrice(currentPrice)}
            </span>
            <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-[#26A69A]' : 'text-[#EF5350]'}`}>
              {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
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
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-[#131722]/80 flex items-center justify-center z-10">
            <Loader2 className="h-8 w-8 text-[#2962FF] animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 bg-[#131722]/80 flex items-center justify-center z-10">
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-[500px]" />
      </div>
      
      <div className="px-4 py-2 border-t border-[#2B2B43] flex items-center justify-between text-[10px] text-gray-500">
        <span>BingX • {wsConnected ? 'Live' : 'Connecting...'}</span>
        <span>TradingView</span>
      </div>
    </Card>
  );
}

ProfessionalChart.propTypes = {
  symbol: PropTypes.string,
  onPriceUpdate: PropTypes.func
};