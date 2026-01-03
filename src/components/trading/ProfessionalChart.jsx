import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { createChart, ColorType } from "lightweight-charts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Maximize2, TrendingUp, TrendingDown } from "lucide-react";

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

export default function ProfessionalChart({ 
  symbol = "BTC-USDT", 
  onPriceUpdate,
  wsClient 
}) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const [timeframe, setTimeframe] = useState("15m");
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#3b82f6',
          width: 1,
          style: 2,
          labelBackgroundColor: '#3b82f6',
        },
        horzLine: {
          color: '#3b82f6',
          width: 1,
          style: 2,
          labelBackgroundColor: '#3b82f6',
        },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    // Volume series
    const volumeSeries = chart.addHistogramSeries({
      color: '#3b82f6',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Generate initial demo data
    generateDemoData(candleSeries, volumeSeries);

    // Handle resize
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

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Generate demo candlestick data
  const generateDemoData = (candleSeries, volumeSeries) => {
    const basePrice = symbol.includes('BTC') ? 94250 : 
                      symbol.includes('ETH') ? 3450 : 
                      symbol.includes('SOL') ? 185 : 100;
    
    const data = [];
    const volumeData = [];
    const now = Math.floor(Date.now() / 1000);
    const interval = getIntervalSeconds(timeframe);
    
    for (let i = 200; i >= 0; i--) {
      const time = now - (i * interval);
      const volatility = basePrice * 0.002;
      const open = basePrice + (Math.random() - 0.5) * volatility * 10;
      const close = open + (Math.random() - 0.5) * volatility * 5;
      const high = Math.max(open, close) + Math.random() * volatility * 2;
      const low = Math.min(open, close) - Math.random() * volatility * 2;
      
      data.push({ time, open, high, low, close });
      volumeData.push({
        time,
        value: Math.random() * 1000000 + 500000,
        color: close >= open ? '#22c55e40' : '#ef444440'
      });
    }
    
    candleSeries.setData(data);
    volumeSeries.setData(volumeData);
    
    // Set current price from last candle
    const lastCandle = data[data.length - 1];
    setCurrentPrice(lastCandle.close);
    setPriceChange(((lastCandle.close - data[0].open) / data[0].open) * 100);
    
    if (onPriceUpdate) {
      onPriceUpdate(lastCandle.close);
    }
  };

  const getIntervalSeconds = (tf) => {
    const intervals = {
      '1m': 60, '5m': 300, '15m': 900, '1h': 3600,
      '4h': 14400, '1d': 86400, '1w': 604800, '1M': 2592000
    };
    return intervals[tf] || 900;
  };

  // Update data when timeframe changes
  useEffect(() => {
    if (candleSeriesRef.current && volumeSeriesRef.current) {
      generateDemoData(candleSeriesRef.current, volumeSeriesRef.current);
    }
  }, [timeframe, symbol]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (!candleSeriesRef.current) return;
      
      const change = (Math.random() - 0.5) * currentPrice * 0.0005;
      const newPrice = currentPrice + change;
      setCurrentPrice(newPrice);
      
      const now = Math.floor(Date.now() / 1000);
      candleSeriesRef.current.update({
        time: now,
        open: currentPrice,
        high: Math.max(currentPrice, newPrice),
        low: Math.min(currentPrice, newPrice),
        close: newPrice
      });
      
      if (onPriceUpdate) {
        onPriceUpdate(newPrice);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [currentPrice, onPriceUpdate]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      chartContainerRef.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <Card className="border-0 shadow-none bg-slate-900 overflow-hidden relative">
      {/* Chart Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/50 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-lg">{symbol}</span>
            <span className={`text-sm font-bold flex items-center gap-1 ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {priceChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
          </div>
          <div className="text-white font-mono text-xl">
            ${currentPrice.toFixed(symbol.includes('BTC') ? 2 : symbol.includes('ETH') ? 2 : 4)}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {TIMEFRAMES.map(tf => (
            <Button
              key={tf.value}
              variant="ghost"
              size="sm"
              onClick={() => setTimeframe(tf.value)}
              className={`h-7 px-3 text-xs ${
                tf.value === timeframe 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {tf.label}
            </Button>
          ))}
          <div className="w-px h-5 bg-slate-600 mx-2" />
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white">
            <Settings className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-slate-400 hover:text-white"
            onClick={toggleFullscreen}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chart Container */}
      <div 
        ref={chartContainerRef} 
        className={`w-full ${isFullscreen ? 'h-screen' : 'h-[500px]'}`}
      />
    </Card>
  );
}

ProfessionalChart.propTypes = {
  symbol: PropTypes.string,
  onPriceUpdate: PropTypes.func,
  wsClient: PropTypes.object
};