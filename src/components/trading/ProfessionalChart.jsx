import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { createChart, ColorType, LineStyle } from "lightweight-charts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const overlayContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  
  const [timeframe, setTimeframe] = useState("15m");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wsConnected, setWsConnected] = useState(marketStore.connected);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const [lastTime, setLastTime] = useState(0);
  const [markers, setMarkers] = useState([]);
  const [positions, setPositions] = useState([]); // [{id, entryPrice, size, leverage, isLong, tpPrice, slPrice, liqPrice}]
  const [nextId, setNextId] = useState(1);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current || chartRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#787B86',
        attributionLogo: false,
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
      if (chartContainerRef.current && chartRef.current) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
        updateOverlays(); // Reposition on resize
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      positions.forEach(pos => {
        pos.entryLine?.remove();
        pos.tpLine?.remove();
        pos.slLine?.remove();
        pos.liqLine?.remove();
      });
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, [positions]);

  // Load data, handle timeframe
  useEffect(() => {
    // ... (same as your original, with additions below)
    // In init(), after setting candles:
    setPositions([]); // Clear positions on timeframe change
    setMarkers([]);

    // In unsubCandle callback:
    // Add updateOverlays() after setCurrentPrice
  }, [symbol, timeframe, onPriceUpdate]);

  // Update markers
  useEffect(() => {
    if (candleSeriesRef.current) {
      candleSeriesRef.current.setMarkers(markers);
    }
  }, [markers]);

  // Update PNL badges on price change
  useEffect(() => {
    updateOverlays();
  }, [currentPrice, positions]);

  const updateOverlays = () => {
    if (!chartRef.current || !overlayContainerRef.current) return;
    const priceScale = chartRef.current.priceScale('right');
    const timeScale = chartRef.current.timeScale();
    const containerBounds = chartContainerRef.current.getBoundingClientRect();

    positions.forEach(pos => {
      if (pos.badgeRef.current) {
        const y = priceScale.priceToCoordinate(pos.entryPrice);
        if (y === null) return;
        const pnl = calculatePNL(pos, currentPrice);
        pos.badgeRef.current.style.top = `${y + containerBounds.top}px`;
        pos.badgeRef.current.style.right = '10px'; // Align to right edge
        pos.badgeRef.current.innerText = `PNL: ${pnl.toFixed(2)} (${((pnl / (pos.size * pos.entryPrice / pos.leverage)) * 100).toFixed(2)}%)`;
        pos.badgeRef.current.style.backgroundColor = pnl >= 0 ? '#26A69A' : '#EF5350';
      }
    });
  };

  const calculatePNL = (pos, currPrice) => {
    const dir = pos.isLong ? 1 : -1;
    return (currPrice - pos.entryPrice) * pos.size * dir; // Adjust for leverage/fees as needed
  };

  const addPosition = (isLong) => {
    if (!candleSeriesRef.current || !currentPrice) return;
    
    // Example defaults; use form inputs in prod
    const entryPrice = currentPrice;
    const size = 1; // e.g., from input
    const leverage = 10;
    const tpPrice = isLong ? entryPrice * 1.02 : entryPrice * 0.98;
    const slPrice = isLong ? entryPrice * 0.98 : entryPrice * 1.02;
    const liqPrice = entryPrice - (entryPrice / leverage) * (isLong ? 1 : -1); // Simplified

    const entryLine = candleSeriesRef.current.createPriceLine({
      price: entryPrice,
      color: '#2962FF',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: 'Entry'
    });

    const tpLine = candleSeriesRef.current.createPriceLine({
      price: tpPrice,
      color: '#EF5350',
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: 'TP'
    });

    const slLine = candleSeriesRef.current.createPriceLine({
      price: slPrice,
      color: '#EF5350',
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: 'SL'
    });

    const liqLine = candleSeriesRef.current.createPriceLine({
      price: liqPrice,
      color: '#FFFFFF',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: 'Liq'
    });

    const badgeRef = useRef(null); // Create div in render

    setPositions(prev => [...prev, {
      id: nextId,
      entryPrice,
      size,
      leverage,
      isLong,
      tpPrice,
      slPrice,
      liqPrice,
      entryLine,
      tpLine,
      slLine,
      liqLine,
      badgeRef
    }]);
    setNextId(prev => prev + 1);

    // Add marker at open
    setMarkers(prev => [...prev, {
      time: lastTime,
      position: isLong ? 'belowBar' : 'aboveBar',
      shape: isLong ? 'arrowUp' : 'arrowDown',
      color: isLong ? '#26A69A' : '#EF5350',
      text: isLong ? 'Long Open' : 'Short Open',
      size: 1
    }]);
  };

  // ... (formatPrice, isPositive same)

  return (
    <Card className="border-0 shadow-none bg-[#131722] overflow-hidden">
      {/* Header same, add buttons */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2B2B43]">
        {/* ... */}
        <div className="flex items-center gap-1">
          {/* Timeframes same */}
          <Button variant="ghost" size="sm" onClick={() => addPosition(true)} className="h-7 px-2.5 text-xs text-gray-400 hover:text-white hover:bg-[#2B2B43]">
            Add Long Pos
          </Button>
          <Button variant="ghost" size="sm" onClick={() => addPosition(false)} className="h-7 px-2.5 text-xs text-gray-400 hover:text-white hover:bg-[#2B2B43]">
            Add Short Pos
          </Button>
          {/* Maximize same */}
        </div>
      </div>

      <div className="relative">
        {/* Loading/error same */}
        <div ref={chartContainerRef} className="w-full h-[500px]" />
        <div ref={overlayContainerRef} className="absolute top-0 left-0 w-full h-full pointer-events-none">
          {positions.map(pos => (
            <div
              key={pos.id}
              ref={pos.badgeRef}
              className="absolute px-2 py-1 text-xs font-bold text-white rounded bg-opacity-80"
              style={{ position: 'absolute', zIndex: 10 }}
            />
          ))}
        </div>
      </div>
      
      {/* Footer same */}
    </Card>
  );
}

ProfessionalChart.propTypes = {
  symbol: PropTypes.string,
  onPriceUpdate: PropTypes.func
};