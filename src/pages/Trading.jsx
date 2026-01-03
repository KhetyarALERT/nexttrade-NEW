import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { createChart, ColorType, LineStyle } from "lightweight-charts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Maximize2, ArrowUp, ArrowDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { marketStore } from "@/components/trading/marketStore";

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
  const [lastTime, setLastTime] = useState(0);
  const [markers, setMarkers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [nextId, setNextId] = useState(1);
  const [posSize, setPosSize] = useState(1);
  const [posLeverage, setPosLeverage] = useState(10);

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
        updateOverlays();
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

  // Load initial data, handle timeframe/symbol changes
  useEffect(() => {
    let unsubCandle = null;
    let unsubConnection = null;
    
    const init = async () => {
      setLoading(true);
      setError(null);
      setPositions([]); // Clear on change; toggle if persist needed
      setMarkers([]);
      
      try {
        const result = await base44.functions.invoke('bingxMarketData', {
          action: 'getKlines',
          params: { symbol, interval: timeframe, limit: 500 }
        });

        if (!result.data?.success || !result.data?.data) {
          throw new Error(result.data?.error || 'Failed to fetch klines');
        }

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
        
        marketStore.setCandles(symbol, timeframe, candles);
        
        if (candleSeriesRef.current && volumeSeriesRef.current) {
          candleSeriesRef.current.setData(candles);
          volumeSeriesRef.current.setData(candles.map(k => ({
            time: k.time,
            value: k.volume,
            color: k.close >= k.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
          })));
        }
        
        const last = candles[candles.length - 1] || { close: 0, open: 0 };
        const first = candles[0] || { open: last.open };
        setCurrentPrice(last.close);
        setPriceChange(((last.close - first.open) / first.open) * 100);
        setLastTime(last.time || 0);
        if (onPriceUpdate) onPriceUpdate(last.close);
        
        marketStore.subscribeWS(`${symbol}@kline_${timeframe}`);
        marketStore.subscribeWS(`${symbol}@trade`);
        
        const candleKey = marketStore.getCandleKey(symbol, timeframe);
        unsubCandle = marketStore.subscribe(`candle:${candleKey}`, (candle) => {
          if (candleSeriesRef.current && chartRef.current) {
            try {
              candleSeriesRef.current.update(candle);
              if (volumeSeriesRef.current) {
                volumeSeriesRef.current.update({
                  time: candle.time,
                  value: candle.volume,
                  color: candle.close >= candle.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
                });
              }
              setLastTime(candle.time);
            } catch (e) {}
          }
          setCurrentPrice(candle.close);
          if (onPriceUpdate) onPriceUpdate(candle.close);
          updateOverlays(); // Add here for real-time PNL
        });
        
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
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

  // Update markers
  useEffect(() => {
    if (candleSeriesRef.current) {
      candleSeriesRef.current.setMarkers(markers);
    }
  }, [markers]);

  // Update PNL on price/positions
  useEffect(() => {
    updateOverlays();
  }, [currentPrice, positions]);

  const updateOverlays = () => {
    // Overlays removed - PNL shown in positions list below
  };

  const calculatePNL = (pos, currPrice) => {
    const dir = pos.isLong ? 1 : -1;
    return (currPrice - pos.entryPrice) * pos.size * dir; // Add fees: - (fees * pos.size)
  };

  const addPosition = (isLong) => {
    if (!candleSeriesRef.current || !currentPrice) return;
    
    const entryPrice = currentPrice;
    const tpPrice = isLong ? entryPrice * 1.02 : entryPrice * 0.98;
    const slPrice = isLong ? entryPrice * 0.98 : entryPrice * 1.02;
    const liqPrice = entryPrice - (entryPrice / posLeverage) * (isLong ? 1 : -1);

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
      color: '#26A69A',
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

    const newPos = {
      id: nextId,
      entryPrice,
      size: posSize,
      leverage: posLeverage,
      isLong,
      tpPrice,
      slPrice,
      liqPrice,
      entryLine,
      tpLine,
      slLine,
      liqLine
    };

    setPositions(prev => [...prev, newPos]);
    setNextId(prev => prev + 1);

    setMarkers(prev => [...prev, {
      time: lastTime,
      position: isLong ? 'belowBar' : 'aboveBar',
      shape: isLong ? 'arrowUp' : 'arrowDown',
      color: isLong ? '#26A69A' : '#EF5350',
      text: isLong ? 'Long Open' : 'Short Open',
      size: 1
    }]);
  };

  const closePosition = (id) => {
    setPositions(prev => {
      const pos = prev.find(p => p.id === id);
      if (pos) {
        pos.entryLine?.remove();
        pos.tpLine?.remove();
        pos.slLine?.remove();
        pos.liqLine?.remove();
      }
      return prev.filter(p => p.id !== id);
    });
  };

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
          <div className="flex items-center gap-2 ml-2">
            <Label htmlFor="size" className="text-xs text-gray-400">Size</Label>
            <Input id="size" type="number" value={posSize} onChange={(e) => setPosSize(parseFloat(e.target.value) || 1)} className="w-16 h-7 text-xs" />
            <Label htmlFor="lev" className="text-xs text-gray-400">Lev</Label>
            <Input id="lev" type="number" value={posLeverage} onChange={(e) => setPosLeverage(parseFloat(e.target.value) || 10)} className="w-16 h-7 text-xs" />
          </div>
          <Button variant="ghost" size="sm" onClick={() => addPosition(true)} className="h-7 px-2.5 text-xs text-gray-400 hover:text-white hover:bg-[#2B2B43]">
            Add Long
          </Button>
          <Button variant="ghost" size="sm" onClick={() => addPosition(false)} className="h-7 px-2.5 text-xs text-gray-400 hover:text-white hover:bg-[#2B2B43]">
            Add Short
          </Button>
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
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
          <span>{wsConnected ? 'Live' : 'Reconnecting...'}</span>
        </div>
        <span>NextTrade</span>
      </div>

      {/* Positions list for close */}
      {positions.length > 0 && (
        <div className="px-4 py-2 border-t border-[#2B2B43]">
          <h4 className="text-sm text-white mb-2">Open Positions</h4>
          {positions.map(pos => (
            <div key={pos.id} className="flex justify-between text-xs text-gray-300 mb-1">
              <span>{pos.isLong ? 'Long' : 'Short'} @ {pos.entryPrice.toFixed(2)} (Size: {pos.size}, Lev: {pos.leverage}x)</span>
              <Button variant="ghost" size="sm" onClick={() => closePosition(pos.id)} className="text-red-500">Close</Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

ProfessionalChart.propTypes = {
  symbol: PropTypes.string,
  onPriceUpdate: PropTypes.func
};