import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { marketStore } from "@/components/trading/marketStore";
import { createChart, CrosshairMode } from "lightweight-charts";
import { base44 } from "@/api/base44Client";
import { toInternalFormat, toDisplayFormat } from "@/components/utils/symbolFormat";

export default function ProfessionalChart({ symbol, onPriceUpdate, positions = [] }) {
  const [price, setPrice] = useState(0);
  const [timeframe, setTimeframe] = useState('15m');
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const priceLinesRef = useRef([]);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;
    if (chartRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { color: '#0f1220' }, textColor: '#e5e7eb' },
      grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Magnet },
    });
    const candleSeries = chart.addCandlestickSeries({
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
      upColor: '#10b981', downColor: '#ef4444',
      borderDownColor: '#ef4444', borderUpColor: '#10b981',
      wickDownColor: '#ef4444', wickUpColor: '#10b981'
    });

    chartRef.current = chart;
    seriesRef.current = candleSeries;

    // Remove any TradingView branding anchors if injected by the lib
    setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      el.querySelectorAll('a[href*="tradingview"], [class*="tradingview"]').forEach((n) => n.remove());
    }, 0);

    const handleResize = () => {
      chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
    };
    handleResize();
    const obs = new ResizeObserver(handleResize);
    obs.observe(containerRef.current);
    return () => { obs.disconnect(); chart.remove(); chartRef.current = null; seriesRef.current = null; };
  }, []);

  // Subscribe to live ticker and fetch klines when symbol changes
  useEffect(() => {
    const s = toInternalFormat(symbol);
    if (!s || !seriesRef.current) return;

    marketStore.subscribeToSymbol(s);
    marketStore.subscribeToCandles(s, timeframe);
    const key = `${s}_${timeframe}`;
    const unsubCandle = marketStore.subscribe(`candle:${key}`, (candle) => {
      if (seriesRef.current) seriesRef.current.update(candle);
      const p = candle?.close;
      if (p) { setPrice(p); if (onPriceUpdate) onPriceUpdate(p); }
    });
    const unsubTicker = marketStore.subscribe(`ticker:${s}`, (ticker) => {
      const p = ticker?.price || 0;
      setPrice(p);
      if (onPriceUpdate) onPriceUpdate(p);
    });

    // Initial price
    const t = marketStore.getAllTickers?.()[s];
    if (t?.price) { setPrice(t.price); if (onPriceUpdate) onPriceUpdate(t.price); }

    // Load historical klines
    (async () => {
      try {
        const res = await base44.functions.invoke('bingxMarketData', { action: 'getKlines', params: { symbol: s, interval: timeframe, limit: 500 } });
        const candles = res.data?.data || [];
        seriesRef.current.setData(candles);
        marketStore.setCandles?.(s, timeframe, candles);
      } catch (e) {
        console.error('Failed to load klines', e);
      }
    })();

    return () => { unsubTicker?.(); unsubCandle?.(); marketStore.unsubscribeFromSymbol(s); marketStore.unsubscribeWS?.(`${s}@kline_${timeframe}`); };
  }, [symbol, timeframe, onPriceUpdate]);

  // Draw position lines
  useEffect(() => {
    const s = toInternalFormat(symbol);
    if (!seriesRef.current) return;
    // Clear old
    priceLinesRef.current.forEach(line => seriesRef.current.removePriceLine(line));
    priceLinesRef.current = [];

    const symbolPositions = (positions || []).filter(p => toInternalFormat(p.symbol) === s);
    symbolPositions.forEach(pos => {
      if (pos.entry_price) {
        const line = seriesRef.current.createPriceLine({
          price: parseFloat(pos.entry_price),
          color: pos.side === 'LONG' ? '#3b82f6' : '#ef4444',
          lineWidth: 2, lineStyle: 0,
          title: `Entry ${pos.side}`
        });
        priceLinesRef.current.push(line);
      }
      if (pos.take_profit) {
        const line = seriesRef.current.createPriceLine({ price: parseFloat(pos.take_profit), color: '#22c55e', lineWidth: 1, lineStyle: 2, title: 'TP' });
        priceLinesRef.current.push(line);
      }
      if (pos.stop_loss) {
        const line = seriesRef.current.createPriceLine({ price: parseFloat(pos.stop_loss), color: '#ef4444', lineWidth: 1, lineStyle: 2, title: 'SL' });
        priceLinesRef.current.push(line);
      }
      if (pos.liquidation_price) {
        const line = seriesRef.current.createPriceLine({ price: parseFloat(pos.liquidation_price), color: '#f97316', lineWidth: 1, lineStyle: 1, title: 'LIQ' });
        priceLinesRef.current.push(line);
      }
    });
  }, [positions, symbol]);

  return (
    <div className="w-full h-full bg-[#0f1220] text-white flex flex-col">
      <div className="flex gap-1 p-2 bg-gray-900 border-b border-gray-800">
        {['1m','5m','15m','1h','4h','1d','1w'].map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-3 py-1 text-xs rounded ${timeframe===tf ? 'bg-yellow-500 text-black font-bold' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {tf.toUpperCase()}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="flex-1 relative">
        <div className="absolute top-2 left-3 text-xs text-slate-400">{toDisplayFormat(symbol)}</div>
        <div className="absolute top-2 right-3 text-xs font-mono">{price ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: price < 1 ? 6 : 2 })}` : '--'}</div>
      </div>
      {/* Hide TradingView logos/watermarks if any external widget injects them */}
      <style>{`
        .tradingview-widget-copyright,
        .tv-watermark, .tv-logo, .chart-controls-bar a[href*="tradingview"],
        [class*="tradingview-"] a[href*="tradingview"] { display: none !important; opacity:0 !important; visibility:hidden !important; }
      `}</style>
    </div>
  );
}

ProfessionalChart.propTypes = {
  symbol: PropTypes.string,
  onPriceUpdate: PropTypes.func,
  positions: PropTypes.array,
};