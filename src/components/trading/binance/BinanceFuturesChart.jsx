import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { createChart, CrosshairMode } from "lightweight-charts";
import { binanceFuturesStore, INTERVALS } from "@/components/trading/binance/binanceFuturesStore";
import { Settings, RotateCcw, TrendingUp, BarChart3, Grid3X3, Volume2 } from "lucide-react";
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
  const s = n.toFixed(n >= 1 ? 4 : 6);
  return s.replace(/\.0+$/, "").replace(/(\.[0-9]*?)0+$/, "$1");
}

// Get chart colors based on theme
function getChartColors(isDark) {
  return isDark ? {
    background: "#0a0e17",
    textColor: "#e5e7eb",
    gridColor: "#1e293b",
    upColor: "#22c55e",
    downColor: "#ef4444",
    borderColor: "#1e293b",
    crosshairColor: "#64748b",
    priceLineColor: "#3b82f6",
  } : {
    background: "#ffffff",
    textColor: "#1f2937",
    gridColor: "#e5e7eb",
    upColor: "#16a34a",
    downColor: "#dc2626",
    borderColor: "#e5e7eb",
    crosshairColor: "#94a3b8",
    priceLineColor: "#2563eb",
  };
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
  const [smoothAnimations, setSmoothAnimations] = useState(true);

  // Detect dark mode
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return true;
  });

  // Listen for theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const chartColors = useMemo(() => getChartColors(isDark), [isDark]);

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
  
  // Store previous candle for smooth animation interpolation
  const lastCandleRef = useRef(null);
  const animationFrameRef = useRef(null);

  const labels = useMemo(() => {
    const isAr = language === "ar";
    return {
      reset: isAr ? "إعادة ضبط" : "Reset",
      resetTitle: isAr ? "إعادة عرض الشارت إلى آخر شمعة" : "Reset view to the latest candle",
      loading: isAr ? "جارٍ التحميل…" : "Loading…",
      live: isAr ? "مباشر" : "Live",
      idle: isAr ? "متوقف" : "Idle",
      chartSettings: isAr ? "إعدادات الشارت" : "Chart Settings",
      chartType: isAr ? "نوع الشارت" : "Chart Type",
      candles: isAr ? "شموع" : "Candles",
      line: isAr ? "خط" : "Line",
      showGrid: isAr ? "إظهار الشبكة" : "Show Grid",
      showVolume: isAr ? "إظهار الحجم" : "Show Volume",
      smoothAnimations: isAr ? "حركة سلسة" : "Smooth Animations",
      settings: isAr ? "الإعدادات" : "Settings",
    };
  }, [language]);

  const resetView = useCallback(() => {
    try {
      chartRef.current?.timeScale?.()?.scrollToRealTime?.();
    } catch {}
    try {
      chartRef.current?.timeScale?.()?.applyOptions?.({ rightOffset: 5 });
    } catch {}
  }, []);

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
    const s = String(bg || "").toLowerCase();
    if (s === "#eab308" || s === "#f59e0b" || s === "#fbbf24") return "#131722";
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

  // Smooth candle animation helper
  const animateCandle = useCallback((targetCandle) => {
    if (!smoothAnimations || !candleSeriesRef.current || disposedRef.current) {
      return;
    }

    const prev = lastCandleRef.current;
    if (!prev || prev.time !== targetCandle.time) {
      // New candle, no animation needed
      lastCandleRef.current = { ...targetCandle };
      return;
    }

    // Interpolate values for smooth animation
    const duration = 150; // ms
    const startTime = Date.now();
    const startValues = { ...prev };

    const animate = () => {
      if (disposedRef.current) return;
      
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);

      const interpolated = {
        time: targetCandle.time,
        open: startValues.open + (targetCandle.open - startValues.open) * eased,
        high: Math.max(startValues.high, startValues.high + (targetCandle.high - startValues.high) * eased),
        low: Math.min(startValues.low, startValues.low + (targetCandle.low - startValues.low) * eased),
        close: startValues.close + (targetCandle.close - startValues.close) * eased,
      };

      try {
        candleSeriesRef.current?.update?.(interpolated);
      } catch {}

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        lastCandleRef.current = { ...targetCandle };
      }
    };

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [smoothAnimations]);

  // Chart init with theme support
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;

    disposedRef.current = false;

    const chart = createChart(containerRef.current, {
      layout: { 
        background: { color: chartColors.background }, 
        textColor: chartColors.textColor, 
        attributionLogo: false,
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      },
      grid: { 
        vertLines: { color: chartColors.gridColor, style: 1 }, 
        horzLines: { color: chartColors.gridColor, style: 1 } 
      },
      rightPriceScale: { 
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: { 
        borderVisible: false, 
        timeVisible: true, 
        secondsVisible: false, 
        shiftVisibleRangeOnNewBar: false,
        rightOffset: 5,
        minBarSpacing: 3,
      },
      localization: { locale: typeof navigator !== "undefined" ? navigator.language : "en" },
      crosshair: { 
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: chartColors.crosshairColor,
          width: 1,
          style: 2,
          labelBackgroundColor: chartColors.priceLineColor,
        },
        horzLine: {
          color: chartColors.crosshairColor,
          width: 1,
          style: 2,
          labelBackgroundColor: chartColors.priceLineColor,
        },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: chartColors.upColor,
      downColor: chartColors.downColor,
      borderUpColor: chartColors.upColor,
      borderDownColor: chartColors.downColor,
      wickUpColor: chartColors.upColor,
      wickDownColor: chartColors.downColor,
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: { type: "price", precision: 6, minMove: 0.000001 },
    });

    const lineSeries = chart.addLineSeries({
      color: "#3b82f6",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: "price", precision: 6, minMove: 0.000001 },
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });
    lineSeries.applyOptions({ visible: false });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: "rgba(148, 163, 184, 0.35)",
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
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
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
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

  // Update chart colors when theme changes
  useEffect(() => {
    if (disposedRef.current || !chartRef.current) return;
    
    try {
      chartRef.current.applyOptions({
        layout: { 
          background: { color: chartColors.background }, 
          textColor: chartColors.textColor,
        },
        grid: {
          vertLines: { color: chartColors.gridColor },
          horzLines: { color: chartColors.gridColor },
        },
        crosshair: {
          vertLine: { color: chartColors.crosshairColor, labelBackgroundColor: chartColors.priceLineColor },
          horzLine: { color: chartColors.crosshairColor, labelBackgroundColor: chartColors.priceLineColor },
        },
      });
    } catch {}

    try {
      candleSeriesRef.current?.applyOptions?.({
        upColor: chartColors.upColor,
        downColor: chartColors.downColor,
        borderUpColor: chartColors.upColor,
        borderDownColor: chartColors.downColor,
        wickUpColor: chartColors.upColor,
        wickDownColor: chartColors.downColor,
      });
    } catch {}
  }, [chartColors]);

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
          vertLines: { color: chartColors.gridColor, visible: Boolean(showGrid) },
          horzLines: { color: chartColors.gridColor, visible: Boolean(showGrid) },
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
  }, [chartType, showGrid, showVolume, chartColors]);

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
          lastCandleRef.current = chartCandles[chartCandles.length - 1];
        }

        // 2) Subscribe for incremental updates with smooth animation
        unsubCandle = binanceFuturesStore.subscribe(`candle:${key}`, (c) => {
          if (cancelled || disposedRef.current) return;
          if (!c || !candleSeriesRef.current || !volumeSeriesRef.current) return;

          const candleData = {
            time: c.time,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          };

          if (smoothAnimations) {
            animateCandle(candleData);
          } else {
            candleSeriesRef.current.update(candleData);
            lastCandleRef.current = candleData;
          }

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
            const priceLineColor = chartColors.priceLineColor;
            if (!priceLineRef.current) {
              priceLineRef.current = candleSeriesRef.current.createPriceLine({
                price: Number(p),
                color: priceLineColor,
                lineWidth: 1,
                lineStyle: 1,
                axisLabelVisible: true,
                axisLabelColor: priceLineColor,
                axisLabelTextColor: priceLineTextColorForBg(priceLineColor),
                title: "",
              });
            } else if (typeof priceLineRef.current.applyOptions === "function") {
              priceLineRef.current.applyOptions({
                price: Number(p),
                axisLabelVisible: true,
                axisLabelColor: priceLineColor,
                axisLabelTextColor: priceLineTextColorForBg(priceLineColor),
                title: "",
              });
            } else {
              // Fallback: recreate
              try {
                candleSeriesRef.current.removePriceLine(priceLineRef.current);
              } catch {}
              priceLineRef.current = candleSeriesRef.current.createPriceLine({
                price: Number(p),
                color: priceLineColor,
                lineWidth: 1,
                lineStyle: 1,
                axisLabelVisible: true,
                axisLabelColor: priceLineColor,
                axisLabelTextColor: priceLineTextColorForBg(priceLineColor),
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
  }, [normalizedSymbol, timeframe, key, animateCandle, smoothAnimations, chartColors.priceLineColor]);

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
        lineWidth: 2,
        lineStyle: 0, // Solid line for entry
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
  // FIXED: Labels now stay connected to entry price line with a visual connector
  const leftLabelItems = useMemo(() => {
    if (!candleSeriesRef.current) return [];
    const series = candleSeriesRef.current;
    const height = containerRef.current?.clientHeight || 0;
    const width = containerRef.current?.clientWidth || 0;
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
          price: entry,
          tone: pnl >= 0 ? "posUp" : "posDown",
          leftText: `${pnlStr} (${pctStr})`,
          rightText: `${sideStr} ${qtyStr}`,
          isEntry: true,
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
          const distStr = Number.isFinite(dist) ? `${dist.toFixed(digits)}` : "";
          items.push({
            key: "sl",
            y: ysl,
            price: sl,
            tone: "sl",
            leftText: `Stop Loss`,
            rightText: distStr,
          });
        }
      }

      const tp = Number(t?.take_profit ?? t?.takeProfit ?? t?.tp);
      if (Number.isFinite(tp) && tp > 0) {
        let ytp = Number.NaN;
        try {
          ytp = series.priceToCoordinate?.(tp);
        } catch {
          ytp = Number.NaN;
        }
        if (Number.isFinite(ytp)) {
          const dist = Math.abs(tp - entry);
          const digits = entry < 1 ? 6 : 2;
          const distStr = Number.isFinite(dist) ? `${dist.toFixed(digits)}` : "";
          items.push({
            key: "tp",
            y: ytp,
            price: tp,
            tone: "tp",
            leftText: `Take Profit`,
            rightText: distStr,
          });
        }
      }
    }

    const sorted = items.sort((a, b) => a.y - b.y);
    const h = isNarrow ? 24 : 28;
    const gap = isNarrow ? 26 : 30;
    let lastTop = -Infinity;
    return sorted.map((it) => {
      const baseTop = it.y - (isNarrow ? 11 : 13);
      let top = Math.max(6, Math.min(height - h, baseTop));
      if (top < lastTop + gap) top = Math.min(height - h, lastTop + gap);
      lastTop = top;
      return { ...it, top, chartWidth: width };
    });
  }, [positionTrade, lastPrice, markPrice, isNarrow, viewTick]);

  return (
    <div className="w-full h-full bg-background text-foreground flex flex-col">
      {/* Chart Header / Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-card border-b border-border">
        <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar">
          {INTERVALS.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2.5 py-1 text-xs rounded-md transition-all duration-200 font-medium whitespace-nowrap ${
                timeframe === tf
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={resetView}
          className="ml-2 p-1.5 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={labels.resetTitle}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        
        <div className="ml-auto flex items-center gap-2">
          {/* Quick toggles for mobile */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              onClick={() => setChartType(chartType === "candles" ? "line" : "candles")}
              className={`p-1.5 rounded-md transition-colors ${
                chartType === "candles" 
                  ? "bg-primary/10 text-primary" 
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
              title={chartType === "candles" ? "Switch to Line" : "Switch to Candles"}
            >
              {chartType === "candles" ? <BarChart3 className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1.5 rounded-md transition-colors ${
                showGrid 
                  ? "bg-primary/10 text-primary" 
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
              title={showGrid ? "Hide Grid" : "Show Grid"}
            >
              <Grid3X3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowVolume(!showVolume)}
              className={`p-1.5 rounded-md transition-colors ${
                showVolume 
                  ? "bg-primary/10 text-primary" 
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
              title={showVolume ? "Hide Volume" : "Show Volume"}
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Settings dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-1.5 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title={labels.settings}
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border text-foreground min-w-[180px]">
              <DropdownMenuLabel className="text-xs font-semibold">{labels.chartSettings}</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />

              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {labels.chartType}
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup value={chartType} onValueChange={setChartType}>
                <DropdownMenuRadioItem value="candles" className="text-sm">
                  {labels.candles}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="line" className="text-sm">
                  {labels.line}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>

              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuCheckboxItem checked={showGrid} onCheckedChange={setShowGrid} className="text-sm">
                {labels.showGrid}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={showVolume} onCheckedChange={setShowVolume} className="text-sm">
                {labels.showVolume}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={smoothAnimations} onCheckedChange={setSmoothAnimations} className="text-sm">
                {labels.smoothAnimations}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status indicators */}
          <div className="flex items-center gap-2">
            {loading ? (
              <span className="text-xs text-muted-foreground animate-pulse">{labels.loading}</span>
            ) : (
              <span className={`text-[10px] uppercase tracking-wider font-medium flex items-center gap-1 ${
                now - lastTickAt < 3000 ? "text-emerald-500" : "text-muted-foreground"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${now - lastTickAt < 3000 ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
                {now - lastTickAt < 3000 ? labels.live : labels.idle}
              </span>
            )}
            <span className="text-xs font-mono font-semibold text-foreground tabular-nums">
              {formatPrice(lastPrice)}
            </span>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div ref={containerRef} className="flex-1 min-h-0 relative">
        {/* Symbol watermark */}
        <div className="absolute top-3 left-3 text-xs font-medium text-muted-foreground/60 select-none pointer-events-none z-10">
          {normalizedSymbol || symbol}
        </div>

        {/* Position Labels - STICKY TO ENTRY PRICE */}
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
          {leftLabelItems.map((b) => {
            const tone = b.tone;
            const isEntry = b.isEntry;
            
            // Color scheme based on tone
            const colorScheme = {
              sl: {
                bg: "bg-rose-500/20",
                border: "border-rose-500/40",
                text: "text-rose-100 dark:text-rose-200",
                line: "bg-rose-500/40",
                accent: "#ef4444",
              },
              tp: {
                bg: "bg-emerald-500/20",
                border: "border-emerald-500/40",
                text: "text-emerald-100 dark:text-emerald-200",
                line: "bg-emerald-500/40",
                accent: "#22c55e",
              },
              posDown: {
                bg: "bg-rose-500/15",
                border: "border-rose-500/30",
                text: "text-rose-100 dark:text-rose-200",
                line: "bg-rose-500/30",
                accent: "#ef4444",
              },
              posUp: {
                bg: "bg-emerald-500/15",
                border: "border-emerald-500/30",
                text: "text-emerald-100 dark:text-emerald-200",
                line: "bg-emerald-500/30",
                accent: "#22c55e",
              },
            }[tone] || {
              bg: "bg-muted/20",
              border: "border-border",
              text: "text-foreground",
              line: "bg-border",
              accent: "#64748b",
            };

            const labelWidth = isNarrow ? 160 : 200;
            const connectorLength = 12;

            return (
              <div key={b.key} className="absolute left-0" style={{ top: b.top }}>
                {/* Label Card */}
                <div
                  className={`rounded-lg border backdrop-blur-md shadow-lg ${colorScheme.bg} ${colorScheme.border} ${colorScheme.text}`}
                  style={{ width: labelWidth }}
                >
                  {/* Connector line from label to price level */}
                  <div 
                    className={`absolute top-1/2 -translate-y-1/2 h-[2px] ${colorScheme.line}`}
                    style={{
                      left: labelWidth,
                      width: Math.max(0, (b.chartWidth || 0) - labelWidth - 60),
                    }}
                  />
                  
                  {/* Label content */}
                  <div className="px-2.5 py-1.5 flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <div className="text-[11px] leading-tight font-semibold truncate">
                        {b.leftText}
                      </div>
                      {isEntry && (
                        <div className="text-[9px] leading-tight opacity-70 font-medium">
                          Entry @ {formatPrice(b.price)}
                        </div>
                      )}
                    </div>
                    {b.rightText ? (
                      <div className="text-[10px] leading-none font-mono whitespace-nowrap opacity-90 font-medium">
                        {b.rightText}
                      </div>
                    ) : null}
                  </div>
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
