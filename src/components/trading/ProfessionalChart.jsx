import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { createChart, CrosshairMode } from "lightweight-charts";
import { marketStore } from "@/components/trading/marketStore";
import { toInternalFormat, toDisplayFormat } from "@/components/utils/symbolFormat";

const TF_OPTIONS = ["1m", "5m", "15m", "30m", "1h", "1d"];

export default function ProfessionalChart({ symbol, onPriceUpdate, positions = [] }) {
  const [timeframe, setTimeframe] = useState("15m");
  const [lastPrice, setLastPrice] = useState(0);

  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const priceLinesRef = useRef([]);
  const markLineRef = useRef(null);
  const lastMarkUpdateRef = useRef(0);

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

  // Draw entry/TP/SL price lines for current symbol (native price-scale labels; stable on scroll/zoom)
  useEffect(() => {
    const s = toInternalFormat(symbol);
    const series = seriesRef.current;
    if (!series || !s) return;

    // Clear existing entry/tp/sl lines (but keep mark line separate)
    if (priceLinesRef.current.length) {
      try { priceLinesRef.current.forEach(l => series.removePriceLine(l)); } catch {}
      priceLinesRef.current = [];
    }

    const symPositions = (positions || []).filter(p => toInternalFormat(p.symbol) === s && p.status === 'OPEN');
    symPositions.forEach(pos => {
      const entry = Number(pos.entry_price || 0);
      if (!Number.isFinite(entry) || entry <= 0) return;
      const sideLong = pos.side === 'LONG';

      const entryLine = series.createPriceLine({
        price: entry,
        color: sideLong ? '#3b82f6' : '#ef4444',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: "",
      });
      priceLinesRef.current.push(entryLine);

      if (pos.take_profit) {
        const tp = Number(pos.take_profit);
        if (Number.isFinite(tp) && tp > 0) {
          const tpLine = series.createPriceLine({
            price: tp,
            color: '#22c55e',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: "",
          });
          priceLinesRef.current.push(tpLine);
        }
      }

      if (pos.stop_loss) {
        const sl = Number(pos.stop_loss);
        if (Number.isFinite(sl) && sl > 0) {
          const slLine = series.createPriceLine({
            price: sl,
            color: '#ef4444',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: "",
          });
          priceLinesRef.current.push(slLine);
        }
      }
    });

    return () => {
      try { priceLinesRef.current.forEach(l => series.removePriceLine(l)); } catch {}
      priceLinesRef.current = [];
    };
  }, [positions, symbol]);

  // Mark price line: update with throttling (avoid recreating all lines each tick).
  useEffect(() => {
    const s = toInternalFormat(symbol);
    const series = seriesRef.current;
    if (!series || !s) return;

    const updateMarkLine = (mark) => {
      if (!Number.isFinite(mark) || mark <= 0) return;
      const now = Date.now();
      if (now - lastMarkUpdateRef.current < 250) return;
      lastMarkUpdateRef.current = now;

      try {
        if (markLineRef.current) series.removePriceLine(markLineRef.current);
      } catch {}

      const digits = mark < 1 ? 6 : 2;
      markLineRef.current = series.createPriceLine({
        price: mark,
        color: '#0099FA',
        lineWidth: 1,
        lineStyle: 1,
        title: `MARK ${mark.toFixed(digits)}`,
      });
    };

    // Seed from existing store values (immediate)
    try {
      const existing = marketStore.tickers?.[s];
      const seed = (existing?.mark ?? existing?.price) || marketStore.getPrice?.(s) || 0;
      if (seed) updateMarkLine(Number(seed));
    } catch {}

    const unsub = marketStore.subscribe(`ticker:${s}`, (t) => {
      const mark = Number((t?.mark ?? t?.price) || 0);
      if (mark) updateMarkLine(mark);
    });

    return () => {
      try { unsub?.(); } catch {}
      try {
        if (markLineRef.current) series.removePriceLine(markLineRef.current);
      } catch {}
      markLineRef.current = null;
    };
  }, [symbol]);

  return (
    <div className="w-full h-full bg-background text-foreground flex flex-col">
      <div className="flex gap-1 p-2 bg-card border-b border-border">
        {TF_OPTIONS.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-3 py-1 text-xs rounded ${timeframe === tf ? "bg-yellow-500 text-black font-bold" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {tf.toUpperCase()}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="flex-1 relative">
        <div className="absolute top-2 left-3 text-xs text-muted-foreground">{toDisplayFormat(symbol)}</div>
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