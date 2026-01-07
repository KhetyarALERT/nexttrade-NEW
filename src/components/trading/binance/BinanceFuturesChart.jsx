import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { createChart, CrosshairMode } from "lightweight-charts";
import { binanceFuturesStore, INTERVALS } from "@/components/trading/binance/binanceFuturesStore";

function formatPrice(p) {
  if (!p || !Number.isFinite(p)) return "--";
  const digits = p < 1 ? 6 : 2;
  return `$${p.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function volumeColor(candle) {
  if (!candle) return "rgba(148, 163, 184, 0.35)";
  return candle.close >= candle.open ? "rgba(16, 185, 129, 0.35)" : "rgba(239, 68, 68, 0.35)";
}

export default function BinanceFuturesChart({ symbol, language = "en", onPriceUpdate }) {
  const [timeframe, setTimeframe] = useState("15m");
  const [loading, setLoading] = useState(true);
  const [lastPrice, setLastPrice] = useState(0);
  const [lastTickAt, setLastTickAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const normalizedSymbol = useMemo(
    () => String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
    [symbol],
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const key = useMemo(() => `${normalizedSymbol}_${timeframe}`, [normalizedSymbol, timeframe]);

  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const priceLineRef = useRef(null);
  const autoFollowRef = useRef(true);

  const labels = useMemo(() => {
    const isAr = language === "ar";
    return {
      reset: isAr ? "إعادة ضبط" : "Reset",
      resetTitle: isAr ? "إعادة عرض الشارت إلى آخر شمعة" : "Reset view to the latest candle",
      loading: isAr ? "جارٍ التحميل…" : "Loading…",
      live: isAr ? "مباشر" : "Live",
      idle: isAr ? "متوقف" : "Idle",
    };
  }, [language]);

  const resetView = () => {
    autoFollowRef.current = true;
    try {
      chartRef.current?.applyOptions?.({ timeScale: { shiftVisibleRangeOnNewBar: true } });
    } catch {}
    try {
      chartRef.current?.timeScale?.()?.scrollToRealTime?.();
    } catch {}
    try {
      chartRef.current?.timeScale?.()?.applyOptions?.({ rightOffset: 0 });
    } catch {}
  };

  // Chart init
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { color: "#131722" }, textColor: "#e5e7eb", attributionLogo: false },
      grid: { vertLines: { color: "#1f2937" }, horzLines: { color: "#1f2937" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, shiftVisibleRangeOnNewBar: true },
      localization: { locale: typeof navigator !== "undefined" ? navigator.language : "en" },
      crosshair: { mode: CrosshairMode.Magnet },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
      priceFormat: { type: "price", precision: 6, minMove: 0.000001 },
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: "rgba(148, 163, 184, 0.35)",
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

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

    const disableAutoFollow = () => {
      if (!chartRef.current) return;
      if (!autoFollowRef.current) return;
      autoFollowRef.current = false;
      try {
        chartRef.current.applyOptions({ timeScale: { shiftVisibleRangeOnNewBar: false } });
      } catch {}
    };

    // Any user interaction should stop auto-follow until Reset is pressed.
    const host = containerRef.current;
    host.addEventListener("wheel", disableAutoFollow, { passive: true });
    host.addEventListener("mousedown", disableAutoFollow);
    host.addEventListener("touchstart", disableAutoFollow, { passive: true });

    return () => {
      try {
        ro.disconnect();
      } catch {}
      try {
        host.removeEventListener("wheel", disableAutoFollow);
        host.removeEventListener("mousedown", disableAutoFollow);
        host.removeEventListener("touchstart", disableAutoFollow);
      } catch {}
      try {
        chart.remove();
      } catch {}
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLineRef.current = null;
    };
  }, []);

  // Seed + WS lifecycle
  useEffect(() => {
    let unsubCandle;
    let unsubPrice;
    let cancelled = false;

    const run = async () => {
      if (!normalizedSymbol || !candleSeriesRef.current || !volumeSeriesRef.current) return;
      setLoading(true);

      try {
        // 1) REST seed
        const candles = await binanceFuturesStore.fetchCandles(normalizedSymbol, timeframe, 500);
        if (cancelled) return;

        const chartCandles = candles.map((c) => ({
          time: c.time,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
        }));

        const volumes = candles.map((c) => ({
          time: c.time,
          value: Number(c.volume || 0),
          color: volumeColor(c),
        }));

        candleSeriesRef.current.setData(chartCandles);
        volumeSeriesRef.current.setData(volumes);

        // Default to the latest candles after symbol/timeframe switches.
        // This doesn't lock the view; it only recenters once.
        resetView();

        const last = candles[candles.length - 1];
        if (last?.close) {
          setLastPrice(last.close);
          setLastTickAt(Date.now());
          onPriceUpdate?.(last.close);
        }

        // 2) Subscribe for incremental updates
        unsubCandle = binanceFuturesStore.subscribe(`candle:${key}`, (c) => {
          if (!c || !candleSeriesRef.current || !volumeSeriesRef.current) return;

          candleSeriesRef.current.update({
            time: c.time,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          });
          volumeSeriesRef.current.update({
            time: c.time,
            value: Number(c.volume || 0),
            color: volumeColor(c),
          });

          if (c.close) {
            setLastPrice(Number(c.close));
            setLastTickAt(Date.now());
            onPriceUpdate?.(Number(c.close));
          }
        });

        unsubPrice = binanceFuturesStore.subscribe(`price:${normalizedSymbol}`, (p) => {
          if (!p || !candleSeriesRef.current) return;
          setLastPrice(Number(p));
          setLastTickAt(Date.now());
          onPriceUpdate?.(Number(p));

          // Update price line
          try {
            if (!priceLineRef.current) {
              priceLineRef.current = candleSeriesRef.current.createPriceLine({
                price: Number(p),
                color: "#0099FA",
                lineWidth: 1,
                lineStyle: 1,
                title: `Last ${formatPrice(Number(p))}`,
              });
            } else if (typeof priceLineRef.current.applyOptions === "function") {
              priceLineRef.current.applyOptions({
                price: Number(p),
                title: `Last ${formatPrice(Number(p))}`,
              });
            } else {
              // Fallback: recreate
              try {
                candleSeriesRef.current.removePriceLine(priceLineRef.current);
              } catch {}
              priceLineRef.current = candleSeriesRef.current.createPriceLine({
                price: Number(p),
                color: "#0099FA",
                lineWidth: 1,
                lineStyle: 1,
                title: `Last ${formatPrice(Number(p))}`,
              });
            }
          } catch {
            // ignore
          }
        });

        // 3) WS after seeding
        binanceFuturesStore.connectChartStreams({ symbol: normalizedSymbol, interval: timeframe, seeded: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
      try {
        unsubCandle?.();
      } catch {}
      try {
        unsubPrice?.();
      } catch {}
      try {
        binanceFuturesStore.closeChartWs();
      } catch {}
    };
  }, [normalizedSymbol, timeframe, key, onPriceUpdate, symbol]);

  return (
    <div className="w-full h-full bg-[#131722] text-white flex flex-col">
      <div className="flex items-center gap-1 p-2 bg-[#1a1a2e] border-b border-slate-800/50">
        {INTERVALS.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              timeframe === tf
                ? "bg-yellow-500 text-black font-bold"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {tf.toUpperCase()}
          </button>
        ))}
        <button
          type="button"
          onClick={resetView}
          className="ml-2 px-3 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          title={labels.resetTitle}
        >
          {labels.reset}
        </button>
        <div className="ml-auto flex items-center gap-3">
          {loading ? <span className="text-xs text-slate-400">{labels.loading}</span> : null}
          {!loading ? (
            <span className={`text-[10px] uppercase tracking-wider ${now - lastTickAt < 3000 ? "text-emerald-400" : "text-slate-500"}`}>
              {now - lastTickAt < 3000 ? labels.live : labels.idle}
            </span>
          ) : null}
          <span className="text-xs font-mono text-slate-200">{formatPrice(lastPrice)}</span>
        </div>
      </div>

        <div ref={containerRef} className="flex-1 min-h-0 relative">
        <div className="absolute top-2 left-3 text-xs text-slate-400">{normalizedSymbol || symbol}</div>
      </div>
    </div>
  );
}

BinanceFuturesChart.propTypes = {
  symbol: PropTypes.string.isRequired,
  language: PropTypes.string,
  onPriceUpdate: PropTypes.func,
};
