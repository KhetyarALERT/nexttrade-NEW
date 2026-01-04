import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { createChart, CrosshairMode } from "lightweight-charts";
import { marketStore } from "@/components/trading/marketStore";
import { toInternalFormat, toDisplayFormat } from "@/components/utils/symbolFormat";

const TF_OPTIONS = ["1m", "5m", "15m", "30m", "1h", "1d"];

export default function ProfessionalChart({ symbol, onPriceUpdate }) {
  const [timeframe, setTimeframe] = useState("15m");
  const [lastPrice, setLastPrice] = useState(0);

  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { color: "#131722" }, textColor: "#e5e7eb" },
      grid: { vertLines: { color: "#1f2937" }, horzLines: { color: "#1f2937" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Magnet },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(containerRef.current);

    return () => {
      try { ro.disconnect(); } catch {}
      try { chartRef.current?.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const s = toInternalFormat(symbol);
    if (!s || !seriesRef.current) return;

    marketStore.subscribeToSymbol(s);
    marketStore.subscribeToCandles(s, timeframe);
    const key = `${s}_${timeframe}`;

    const unsubSeed = marketStore.subscribe(`candles:${key}`, (arr) => {
      if (seriesRef.current && Array.isArray(arr)) {
        seriesRef.current.setData(arr.map(c => ({ time: c.time, open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close) })));
      }
    });

    const unsubCandle = marketStore.subscribe(`candle:${key}`, (c) => {
      if (!c || !seriesRef.current) return;
      seriesRef.current.update({ time: c.time, open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close) });
      if (c.close) { setLastPrice(c.close); onPriceUpdate?.(c.close); }
    });

    const unsubTicker = marketStore.subscribe(`ticker:${s}`, (t) => {
      const p = (t?.mark ?? t?.price) || 0;
      if (p > 0) { setLastPrice(p); onPriceUpdate?.(p); }
    });

    (async () => {
      try {
        await marketStore.preloadCandles(s, timeframe, 500);
        const seeded = marketStore.getCandles(s, timeframe);
        if (Array.isArray(seeded) && seriesRef.current) {
          seriesRef.current.setData(seeded.map(c => ({ time: c.time, open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close) })));
          const last = seeded[seeded.length - 1];
          if (last?.close) { setLastPrice(last.close); onPriceUpdate?.(last.close); }
        }
      } catch {}
    })();

    return () => {
      try { unsubSeed?.(); } catch {}
      try { unsubCandle?.(); } catch {}
      try { unsubTicker?.(); } catch {}
      try { marketStore.unsubscribeFromSymbol(s); } catch {}
      try { marketStore.unsubscribeWS?.(`kline_${timeframe}.${s}`); } catch {}
    };
  }, [symbol, timeframe, onPriceUpdate]);

  return (
    <div className="w-full h-full bg-[#131722] text-white flex flex-col">
      <div className="flex gap-1 p-2 bg-[#1a1a2e] border-b border-slate-800/50">
        {TF_OPTIONS.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-3 py-1 text-xs rounded ${timeframe === tf ? "bg-yellow-500 text-black font-bold" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
          >
            {tf.toUpperCase()}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="flex-1 relative">
        <div className="absolute top-2 left-3 text-xs text-slate-400">{toDisplayFormat(symbol)}</div>
        <div className="absolute top-2 right-3 text-xs font-mono">
          {lastPrice ? `$${lastPrice.toLocaleString(undefined, { minimumFractionDigits: lastPrice < 1 ? 6 : 2, maximumFractionDigits: lastPrice < 1 ? 6 : 2 })}` : "--"}
        </div>
      </div>
    </div>
  );
}

ProfessionalChart.propTypes = {
  symbol: PropTypes.string,
  onPriceUpdate: PropTypes.func,
};