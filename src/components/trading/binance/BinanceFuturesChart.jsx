import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { createChart, CrosshairMode } from "lightweight-charts";
import { binanceFuturesStore, INTERVALS } from "@/components/trading/binance/binanceFuturesStore";
import { Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatPrice(p) {
  if (!p || !Number.isFinite(p)) return "--";
  const digits = p < 1 ? 6 : 2;
  return `$${p.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function volumeColor(candle) {
  if (!candle) return "rgba(148, 163, 184, 0.35)";
  return candle.close >= candle.open ? "rgba(16, 185, 129, 0.35)" : "rgba(239, 68, 68, 0.35)";
}

function formatQty(qty) {
  const n = Number(qty);
  if (!Number.isFinite(n)) return "—";
  // Keep it compact; trim trailing zeros.
  const s = n.toFixed(n >= 1 ? 4 : 6);
  return s.replace(/\.0+$/, "").replace(/(\.[0-9]*?)0+$/, "$1");
}

export default function BinanceFuturesChart({ symbol, language = "en", onPriceUpdate, positionTrade = null, pendingOrders = [] }) {
  const [timeframe, setTimeframe] = useState("15m");
  const [loading, setLoading] = useState(true);
  const [lastPrice, setLastPrice] = useState(0);
  const [markPrice, setMarkPrice] = useState(0);
  const [lastTickAt, setLastTickAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [viewTick, setViewTick] = useState(0);

  // Safe UI-only settings (do not affect data pipeline)
  const [chartType, setChartType] = useState("candles");
  const [showGrid, setShowGrid] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [isNarrow, setIsNarrow] = useState(false);

  const onPriceUpdateRef = useRef(onPriceUpdate);
  useEffect(() => {
    onPriceUpdateRef.current = onPriceUpdate;
  }, [onPriceUpdate]);

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
  const lineSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const priceLineRef = useRef(null);

  const disposedRef = useRef(false);

  const overlayLinesRef = useRef({ entry: null, tp: null, sl: null, liq: null });
  const pendingLinesRef = useRef(new Map());

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
    // One-time jump to the latest candle; does NOT enable auto-follow.
    try {
      chartRef.current?.timeScale?.()?.scrollToRealTime?.();
    } catch {}
    try {
      chartRef.current?.timeScale?.()?.applyOptions?.({ rightOffset: 0 });
    } catch {}
  };

  // Keep mark price (premium index) in sync for correct PnL math.
  useEffect(() => {
    if (!normalizedSymbol) return;
    const unsubPremium = binanceFuturesStore.subscribe(`premium:${normalizedSymbol}`, (p) => {
      const mp = Number(p?.markPrice || 0);
      if (Number.isFinite(mp) && mp > 0) setMarkPrice(mp);
    });
    const prem = binanceFuturesStore.getPremiumIndex?.(normalizedSymbol);
    if (prem?.markPrice) setMarkPrice(Number(prem.markPrice));
    return () => {
      try {
        unsubPremium?.();
      } catch {}
    };
  }, [normalizedSymbol]);

  const removeOverlayLine = (key) => {
    try {
      if (overlayLinesRef.current?.[key] && candleSeriesRef.current?.removePriceLine) {
        candleSeriesRef.current.removePriceLine(overlayLinesRef.current[key]);
      }
    } catch {}
    if (overlayLinesRef.current) overlayLinesRef.current[key] = null;
  };

  const priceLineTextColorForBg = (bg) => {
    // Keep it simple: use dark text for bright yellows/oranges, otherwise white.
    const s = String(bg || "").toLowerCase();
    if (s === "#eab308" || s === "#f59e0b") return "#131722";
    return "#ffffff";
  };

  const upsertOverlayLine = (key, opts) => {
    if (disposedRef.current) return;
    if (!candleSeriesRef.current) return;
    try {
      const existing = overlayLinesRef.current?.[key];
      if (existing && typeof existing.applyOptions === "function") {
        existing.applyOptions(opts);
        return;
      }
      if (existing) {
        removeOverlayLine(key);
      }
      overlayLinesRef.current[key] = candleSeriesRef.current.createPriceLine(opts);
    } catch {
      // ignore
    }
  };

  const removePendingLine = (id) => {
    if (!id) return;
    if (disposedRef.current) {
      try {
        pendingLinesRef.current.delete(id);
      } catch {}
      return;
    }
    try {
      const line = pendingLinesRef.current.get(id);
      if (line && candleSeriesRef.current?.removePriceLine) {
        candleSeriesRef.current.removePriceLine(line);
      }
    } catch {}
    try {
      pendingLinesRef.current.delete(id);
    } catch {}
  };

  const upsertPendingLine = (id, opts) => {
    if (!id || !candleSeriesRef.current) return;
    if (disposedRef.current) return;
    try {
      const existing = pendingLinesRef.current.get(id);
      if (existing && typeof existing.applyOptions === "function") {
        existing.applyOptions(opts);
        return;
      }
      if (existing) {
        removePendingLine(id);
      }
      const line = candleSeriesRef.current.createPriceLine(opts);
      pendingLinesRef.current.set(id, line);
    } catch {
      // ignore
    }
  };

  // Chart init
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;

    disposedRef.current = false;

    const chart = createChart(containerRef.current, {
      layout: { background: { color: "#131722" }, textColor: "#e5e7eb", attributionLogo: false },
      grid: { vertLines: { color: "#1f2937" }, horzLines: { color: "#1f2937" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, shiftVisibleRangeOnNewBar: false },
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
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: { type: "price", precision: 6, minMove: 0.000001 },
    });

    const lineSeries = chart.addLineSeries({
      color: "#60a5fa",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: "price", precision: 6, minMove: 0.000001 },
    });
    // Default view is candlesticks
    lineSeries.applyOptions({ visible: false });

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
    lineSeriesRef.current = lineSeries;
    volumeSeriesRef.current = volumeSeries;

    const resize = () => {
      if (!containerRef.current || !chartRef.current) return;
      if (disposedRef.current) return;
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
      setIsNarrow(containerRef.current.clientWidth < 520);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(containerRef.current);

    // Force a fast re-render on pan/zoom so HTML labels stay glued to their price lines.
    let raf = 0;
    const bumpView = () => {
      if (disposedRef.current) return;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setViewTick((v) => v + 1);
      });
    };

    try {
      chart.timeScale?.()?.subscribeVisibleTimeRangeChange?.(bumpView);
    } catch {}
    try {
      chart.timeScale?.()?.subscribeVisibleLogicalRangeChange?.(bumpView);
    } catch {}
    try {
      chart.subscribeCrosshairMove?.(bumpView);
    } catch {}

    return () => {
      try {
        ro.disconnect();
      } catch {}

      try {
        if (raf) cancelAnimationFrame(raf);
      } catch {}

      try {
        chart.timeScale?.()?.unsubscribeVisibleTimeRangeChange?.(bumpView);
      } catch {}
      try {
        chart.timeScale?.()?.unsubscribeVisibleLogicalRangeChange?.(bumpView);
      } catch {}
      try {
        chart.unsubscribeCrosshairMove?.(bumpView);
      } catch {}

      // Important: null refs first so any late-running effects/interval ticks
      // won't call into disposed lightweight-charts objects.
      disposedRef.current = true;
      chartRef.current = null;
      candleSeriesRef.current = null;
      lineSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLineRef.current = null;
      try {
        pendingLinesRef.current = new Map();
      } catch {}

      try {
        chart.remove();
      } catch {}
    };
  }, []);

  // Apply UI-only settings
  useEffect(() => {
    if (disposedRef.current) return;
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const lineSeries = lineSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries || !lineSeries || !volumeSeries) return;

    try {
      chart.applyOptions({
        grid: {
          vertLines: { color: "#1f2937", visible: Boolean(showGrid) },
          horzLines: { color: "#1f2937", visible: Boolean(showGrid) },
        },
      });
    } catch {}

    try {
      candleSeries.applyOptions({ visible: chartType === "candles", lastValueVisible: false, priceLineVisible: false });
      lineSeries.applyOptions({ visible: chartType === "line", lastValueVisible: false, priceLineVisible: false });
    } catch {}

    try {
      volumeSeries.applyOptions({ visible: Boolean(showVolume) });
    } catch {}
  }, [chartType, showGrid, showVolume]);

  // Seed + WS lifecycle
  useEffect(() => {
    let unsubCandle;
    let unsubPrice;
    let cancelled = false;

    const run = async () => {
      if (!normalizedSymbol || !candleSeriesRef.current || !volumeSeriesRef.current || !lineSeriesRef.current) return;
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
        lineSeriesRef.current.setData(chartCandles.map((c) => ({ time: c.time, value: c.close })));

        // Jump to latest once after seeding (no auto-follow).
        resetView();

        const last = candles[candles.length - 1];
        if (last?.close) {
          setLastPrice(last.close);
          setLastTickAt(Date.now());
          onPriceUpdateRef.current?.(last.close);
        }

        // 2) Subscribe for incremental updates
        unsubCandle = binanceFuturesStore.subscribe(`candle:${key}`, (c) => {
          if (cancelled || disposedRef.current) return;
          if (!c || !candleSeriesRef.current || !volumeSeriesRef.current) return;

          candleSeriesRef.current.update({
            time: c.time,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          });
          lineSeriesRef.current?.update?.({
            time: c.time,
            value: Number(c.close),
          });
          volumeSeriesRef.current.update({
            time: c.time,
            value: Number(c.volume || 0),
            color: volumeColor(c),
          });

          if (c.close) {
            setLastPrice(Number(c.close));
            setLastTickAt(Date.now());
            onPriceUpdateRef.current?.(Number(c.close));
          }
        });

        unsubPrice = binanceFuturesStore.subscribe(`price:${normalizedSymbol}`, (p) => {
          if (cancelled || disposedRef.current) return;
          if (!p || !candleSeriesRef.current) return;
          setLastPrice(Number(p));
          setLastTickAt(Date.now());
          onPriceUpdateRef.current?.(Number(p));

          // Update last price line with native colored axis label (no text badge)
          try {
            if (!priceLineRef.current) {
              priceLineRef.current = candleSeriesRef.current.createPriceLine({
                price: Number(p),
                color: "#0099FA",
                lineWidth: 1,
                lineStyle: 1,
                axisLabelVisible: true,
                axisLabelColor: "#0099FA",
                axisLabelTextColor: priceLineTextColorForBg("#0099FA"),
                title: "",
              });
            } else if (typeof priceLineRef.current.applyOptions === "function") {
              priceLineRef.current.applyOptions({
                price: Number(p),
                axisLabelVisible: true,
                axisLabelColor: "#0099FA",
                axisLabelTextColor: priceLineTextColorForBg("#0099FA"),
                title: "",
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
                axisLabelVisible: true,
                axisLabelColor: "#0099FA",
                axisLabelTextColor: priceLineTextColorForBg("#0099FA"),
                title: "",
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
  }, [normalizedSymbol, timeframe, key]);

  // Backend trade overlay (Bots/demo trades)
  useEffect(() => {
    if (disposedRef.current) return;
    const t = positionTrade;
    if (!t || !candleSeriesRef.current) {
      removeOverlayLine("entry");
      removeOverlayLine("tp");
      removeOverlayLine("sl");
      removeOverlayLine("liq");
      return;
    }
    const entry = Number(t.avg_entry_price ?? t.entry_price);
    const side = String(t.side || "LONG").toUpperCase();
    const isShort = side === "SHORT";

    if (Number.isFinite(entry) && entry > 0) {
      upsertOverlayLine("entry", {
        price: entry,
        color: isShort ? "#ef4444" : "#22c55e",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        axisLabelColor: isShort ? "#ef4444" : "#22c55e",
        axisLabelTextColor: priceLineTextColorForBg(isShort ? "#ef4444" : "#22c55e"),
        title: "",
      });
    } else {
      removeOverlayLine("entry");
    }

    const tp = Number(t.take_profit ?? t.takeProfit ?? t.tp);
    if (Number.isFinite(tp) && tp > 0) {
      upsertOverlayLine("tp", {
        price: tp,
        color: "#22c55e",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        axisLabelColor: "#22c55e",
        axisLabelTextColor: priceLineTextColorForBg("#22c55e"),
        title: "",
      });
    } else {
      removeOverlayLine("tp");
    }

    const sl = Number(t.stop_loss ?? t.stopLoss ?? t.sl);
    if (Number.isFinite(sl) && sl > 0) {
      upsertOverlayLine("sl", {
        price: sl,
        color: "#ef4444",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        axisLabelColor: "#ef4444",
        axisLabelTextColor: priceLineTextColorForBg("#ef4444"),
        title: "",
      });
    } else {
      removeOverlayLine("sl");
    }

    const liq = Number(t.liquidation_price);
    if (Number.isFinite(liq) && liq > 0) {
      upsertOverlayLine("liq", {
        price: liq,
        color: "#f59e0b",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        axisLabelColor: "#f59e0b",
        axisLabelTextColor: priceLineTextColorForBg("#f59e0b"),
        title: "",
      });
    } else {
      removeOverlayLine("liq");
    }
  }, [positionTrade]);

  // Pending order overlays (limit/stop)
  useEffect(() => {
    if (disposedRef.current) return;
    const list = Array.isArray(pendingOrders) ? pendingOrders : [];
    const ids = new Set(list.map((o) => o?.id).filter(Boolean));

    // remove stale
    for (const id of Array.from(pendingLinesRef.current.keys())) {
      if (!ids.has(id)) removePendingLine(id);
    }

    for (const o of list) {
      const id = o?.id;
      if (!id) continue;

      const orderType = String(o?.order_type || "").toUpperCase();

      const p = Number(o?.limit_price ?? o?.stop_price ?? o?.entry_price);
      if (!Number.isFinite(p) || p <= 0) {
        removePendingLine(id);
        continue;
      }

      const lineColor = orderType === "STOP" ? "#a855f7" : "#eab308";
      upsertPendingLine(id, {
        price: p,
        color: lineColor,
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        axisLabelColor: lineColor,
        axisLabelTextColor: priceLineTextColorForBg(lineColor),
        title: "",
      });
    }
  }, [pendingOrders]);

  // Left-side labels: show position info + unrealized PNL (synced with positions table), and avoid overlap.
  const leftLabelItems = useMemo(() => {
    if (!candleSeriesRef.current) return [];
    const series = candleSeriesRef.current;
    const height = containerRef.current?.clientHeight || 0;
    if (!height) return [];

    const items = [];

    const t = positionTrade;
    const entry = Number(t?.avg_entry_price ?? t?.entry_price);
    const side = String(t?.side || "LONG").toUpperCase();
    const isShort = side === "SHORT";
    const qty = Number(t?.qty ?? t?.quantity ?? t?.positionAmt);
    const margin = Number(t?.margin);

    const mark = Number(markPrice || lastPrice || 0);

    if (Number.isFinite(entry) && entry > 0 && Number.isFinite(qty) && qty !== 0 && Number.isFinite(mark) && mark > 0) {
      const absQty = Math.abs(qty);
      // Match FuturesActivityTabs: (mark-entry)*qty (or reverse for shorts)
      const pnl = (isShort ? (entry - mark) : (mark - entry)) * absQty;
      const pnlPct = Number.isFinite(margin) && margin > 0 ? (pnl / margin) * 100 : NaN;

      const pnlStr = `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} USDT`;
      const pctStr = Number.isFinite(pnlPct) ? `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : "—";
      const sideStr = isShort ? "Short" : "Long";
      const qtyStr = formatQty(absQty);

      let y = Number.NaN;
      try {
        y = series.priceToCoordinate?.(entry);
      } catch {
        y = Number.NaN;
      }
      if (Number.isFinite(y)) {
        items.push({
          key: "pos",
          y,
          tone: pnl >= 0 ? "posUp" : "posDown",
          leftText: `${pnlStr} (${pctStr})`,
          rightText: `${sideStr} ${qtyStr}`,
        });
      }

      const sl = Number(t?.stop_loss ?? t?.stopLoss ?? t?.sl);
      if (Number.isFinite(sl) && sl > 0) {
        let ysl = Number.NaN;
        try {
          ysl = series.priceToCoordinate?.(sl);
        } catch {
          ysl = Number.NaN;
        }
        if (Number.isFinite(ysl)) {
          const dist = Math.abs(entry - sl);
          const digits = entry < 1 ? 6 : 2;
          const distStr = Number.isFinite(dist) ? `${dist >= 0 ? "+" : ""}${dist.toFixed(digits)}` : "";
          items.push({
            key: "sl",
            y: ysl,
            tone: "sl",
            leftText: `Stop Loss ${distStr}`.trim(),
            rightText: "",
          });
        }
      }
    }

    const sorted = items.sort((a, b) => a.y - b.y);
    const h = isNarrow ? 22 : 26;
    const gap = isNarrow ? 24 : 28;
    let lastTop = -Infinity;
    return sorted.map((it) => {
      const baseTop = it.y - (isNarrow ? 10 : 12);
      let top = Math.max(6, Math.min(height - h, baseTop));
      if (top < lastTop + gap) top = Math.min(height - h, lastTop + gap);
      lastTop = top;
      return { ...it, top };
    });
  }, [positionTrade, lastPrice, markPrice, isNarrow, viewTick]);

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="px-2 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                title={language === "ar" ? "الإعدادات" : "Settings"}
              >
                <Settings className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#0f1320] border-slate-800 text-slate-200">
              <DropdownMenuLabel>{language === "ar" ? "إعدادات الشارت" : "Chart Settings"}</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-800" />

              <DropdownMenuLabel className="text-xs text-slate-400">
                {language === "ar" ? "نوع الشارت" : "Chart Type"}
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup value={chartType} onValueChange={setChartType}>
                <DropdownMenuRadioItem value="candles">
                  {language === "ar" ? "شموع" : "Candles"}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="line">
                  {language === "ar" ? "خط" : "Line"}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>

              <DropdownMenuSeparator className="bg-slate-800" />
              <DropdownMenuCheckboxItem checked={showGrid} onCheckedChange={setShowGrid}>
                {language === "ar" ? "إظهار الشبكة" : "Show Grid"}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={showVolume} onCheckedChange={setShowVolume}>
                {language === "ar" ? "إظهار الحجم" : "Show Volume"}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

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

        <div className="absolute inset-0 pointer-events-none z-20">
          {leftLabelItems.map((b) => {
            const tone = b.tone;
            const cls =
              tone === "sl"
                ? "bg-rose-500/15 border-rose-500/30 text-rose-100"
                : tone === "posDown"
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-100"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-100";

            const tailCls =
              tone === "sl"
                ? "border-l-rose-500/30"
                : tone === "posDown"
                  ? "border-l-rose-500/20"
                  : "border-l-emerald-500/20";

            return (
              <div
                key={b.key}
                className={`absolute left-0 rounded-md border backdrop-blur-sm shadow-sm ${cls}`}
                style={{
                  top: Number.isFinite(b.top) ? b.top : Math.max(6, b.y - 12),
                  width: isNarrow ? 176 : 220,
                }}
              >
                <div className={`absolute -right-2 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[5px] border-y-transparent border-l-[7px] ${tailCls}`} />
                <div className="px-2 py-1 flex items-center justify-between gap-2">
                  <div className="text-[10px] leading-none font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                    {b.leftText}
                  </div>
                  {b.rightText ? (
                    <div className="text-[10px] leading-none font-mono whitespace-nowrap opacity-90">
                      {b.rightText}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

BinanceFuturesChart.propTypes = {
  symbol: PropTypes.string.isRequired,
  language: PropTypes.string,
  onPriceUpdate: PropTypes.func,
  positionTrade: PropTypes.object,
  pendingOrders: PropTypes.array,
};
