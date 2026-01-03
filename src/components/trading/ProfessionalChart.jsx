import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { createChart, ColorType, CrosshairMode } from "lightweight-charts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Maximize2, Minimize2, Activity } from "lucide-react";
import { marketStore } from "./marketStore";

export default function ProfessionalChart({ 
  symbol = "BTC-USDT", 
  interval = "15m", 
  onIntervalChange, 
  onPriceUpdate,
  trades = [] // New prop for trades
}) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#131722" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "#1f2937",
      },
      timeScale: {
        borderColor: "#1f2937",
        timeVisible: true,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    
    // Initial resize
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  // Update markers when trades change
  useEffect(() => {
    if (!seriesRef.current || !trades.length) {
      if (seriesRef.current) seriesRef.current.setMarkers([]);
      return;
    }

    const markers = trades
      .filter(t => t.status === 'OPEN' || t.status === 'PENDING')
      .map(t => ({
        time: new Date(t.created_date).getTime() / 1000,
        position: t.side === 'LONG' ? 'belowBar' : 'aboveBar',
        color: t.side === 'LONG' ? '#26a69a' : '#ef5350',
        shape: t.side === 'LONG' ? 'arrowUp' : 'arrowDown',
        text: `${t.side} ${t.quantity} @ ${t.entry_price}`
      }));

    // Sort markers by time as required by lightweight-charts
    markers.sort((a, b) => a.time - b.time);

    try {
      seriesRef.current.setMarkers(markers);
    } catch (e) {
      // Ignore markers errors if time is out of range
      console.log('Markers error', e);
    }
  }, [trades]);

  // Fetch historical data
  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        await marketStore.initSymbol(symbol, interval);
        const data = marketStore.getCandles(symbol);
        if (seriesRef.current && data.length > 0) {
          seriesRef.current.setData(data);
          
          // Update current price from last candle
          const lastCandle = data[data.length - 1];
          if (lastCandle) {
            setCurrentPrice(lastCandle.close);
            if (onPriceUpdate) onPriceUpdate(lastCandle.close);
          }
        }
      } catch (error) {
        console.error("Failed to fetch history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();

    // Subscribe to real-time updates
    const handleUpdate = ({ symbol: updatedSymbol, candle, ticker }) => {
      if (updatedSymbol === symbol) {
        if (seriesRef.current && candle) {
          seriesRef.current.update(candle);
        }
        if (ticker) {
          setCurrentPrice(ticker.price);
          setPriceChange(ticker.change);
          if (onPriceUpdate) onPriceUpdate(ticker.price);
        }
      }
    };

    const unsubscribe = marketStore.subscribe(handleUpdate);
    setWsConnected(true);

    return () => {
      unsubscribe();
    };
  }, [symbol, interval, onPriceUpdate]);

  const toggleFullscreen = () => {
    if (!chartContainerRef.current) return;
    
    if (!isFullscreen) {
      if (chartContainerRef.current.requestFullscreen) {
        chartContainerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  return (
    <Card className="h-full border-0 rounded-none bg-[#131722] flex flex-col relative group">
      {/* Chart Controls */}
      <div className="flex items-center justify-between p-2 border-b border-slate-800 bg-[#131722]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-lg">{symbol.replace('-', '/')}</span>
            <span className="text-xs text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">Perpetual</span>
          </div>
          <div className="flex gap-1">
            {['1m', '5m', '15m', '1h', '4h', '1d'].map((tf) => (
              <button
                key={tf}
                onClick={() => onIntervalChange && onIntervalChange(tf)}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  interval === tf 
                    ? 'text-blue-400 font-medium bg-blue-400/10' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className={`font-mono font-medium ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className={`text-xs ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange}%
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-slate-400 hover:text-white">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Chart Container */}
      <div ref={chartContainerRef} className="flex-1 w-full relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#131722] z-10">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        )}
      </div>

      {/* Connection Status */}
      <div className="absolute bottom-1 right-1 flex items-center gap-1.5 px-2 py-1 bg-black/40 rounded text-[10px] text-slate-400 pointer-events-none">
        <div className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
        {wsConnected ? 'Real-time' : 'Connecting...'}
      </div>
    </Card>
  );
}

ProfessionalChart.propTypes = {
  symbol: PropTypes.string,
  interval: PropTypes.string,
  onIntervalChange: PropTypes.func,
  onPriceUpdate: PropTypes.func,
  trades: PropTypes.array
};