import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { createChart, CrosshairMode } from "lightweight-charts";
import { binanceFuturesStore, INTERVALS } from "@/components/trading/binance/binanceFuturesStore";
import { Settings, TrendingUp, BarChart3, Volume2, Maximize2, Crosshair, RotateCcw } from "lucide-react";
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

function volumeColor(candle, isDark) {
  if (!candle) return isDark ? "rgba(148, 163, 184, 0.35)" : "rgba(100, 116, 139, 0.25)";
  return candle.close >= candle.open 
    ? (isDark ? "rgba(34, 197, 94, 0.4)" : "rgba(22, 163, 74, 0.35)") 
    : (isDark ? "rgba(239, 68, 68, 0.4)" : "rgba(220, 38, 38, 0.35)");
}

// Enhanced chart colors with better light mode contrast
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
    entryLong: "#22c55e",
    entryShort: "#ef4444",
    takeProfit: "#10b981",
    stopLoss: "#f43f5e",
    liquidation: "#f59e0b",
    pending: "#a855f7",
  } : {
    // ENHANCED LIGHT MODE - much better contrast
    background: "#ffffff",
    textColor: "#1e293b",
    gridColor: "#e2e8f0",
    upColor: "#16a34a",
    downColor: "#dc2626",
    borderColor: "#e2e8f0",
    crosshairColor: "#64748b",
    priceLineColor: "#2563eb",
    entryLong: "#15803d",
    entryShort: "#b91c1c",
    takeProfit: "#059669",
    stopLoss: "#be123c",
    liquidation: "#d97706",
    pending: "#7c3aed",
  };
}

const BinanceFuturesChart = React.memo(function BinanceFuturesChart(/** @type {any} */ { symbol, language = "en", onPriceUpdate, positionTrade = null, pendingOrders = [] }) {
  const [timeframe, setTimeframe] = useState("15m");
  const [loading, setLoading] = useState(true);
  const [lastPrice, setLastPrice] = useState(0);
  const [_markPrice, setMarkPrice] = useState(0);
  const [lastTickAt, setLastTickAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Safe UI-only settings (do not affect data pipeline)
  const [chartType, setChartType] = useState("candles");
  const [showGrid, setShowGrid] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [isNarrow, setIsNarrow] = useState(false);
  const [smoothAnimations, setSmoothAnimations] = useState(true);
  const [autoScale, setAutoScale] = useState(true);
  const [crosshairEnabled, setCrosshairEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    () => String(symbol || "").toUpperCase().replace(/[^A-Z0-9-]/g, ""),
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
      resetTitle: isAr ? "إعادة عرض الشارت إلى آخر شمعة" : "Reset view to latest candle with proper zoom",
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
      autoScale: isAr ? "ضبط تلقائي" : "Auto Scale",
      settings: isAr ? "الإعدادات" : "Settings",
      crosshair: isAr ? "الخط المتقاطع" : "Crosshair",
      fullscreen: isAr ? "ملء الشاشة" : "Fullscreen",
    };
  }, [language]);

  // RESET VIEW BUTTON - Manual only, no auto-follow
  const resetView = useCallback(() => {
    if (!chartRef.current) return;
    try {
      // Scroll to latest candle
      chartRef.current.timeScale?.().scrollToRealTime?.();
      // Set comfortable zoom
      chartRef.current.timeScale?.().applyOptions?.({
        rightOffset: 8,
        barSpacing: 8,
      });
      // Fit content vertically
      if (autoScale) {
        chartRef.current.priceScale?.("right")?.applyOptions?.({
          autoScale: true,
        });
      }
    } catch {}
  }, [autoScale]);

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

  // Get text color for axis labels based on background
  const priceLineTextColorForBg = (bg) => {
    const s = String(bg || "").toLowerCase();
    // Yellow/amber backgrounds need dark text
    if (s === "#eab308" || s === "#f59e0b" || s === "#fbbf24" || s === "#d97706") return "#1f2937";
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
    } catch {}
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
    } catch {}
  };

  // Smooth candle animation helper
  const animateCandle = useCallback((targetCandle) => {
    if (!smoothAnimations || !candleSeriesRef.current || disposedRef.current) {
      return;
    }

    const prev = lastCandleRef.current;
    if (!prev || prev.time !== targetCandle.time) {
      lastCandleRef.current = { ...targetCandle };
      return;
    }

    const duration = 120;
    const startTime = Date.now();
    const startValues = { ...prev };

    const animate = () => {
      if (disposedRef.current) return;
      
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
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

  // Chart init
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
        autoScale: true,
      },
      timeScale: { 
        borderVisible: false, 
        timeVisible: true, 
        secondsVisible: false, 
        shiftVisibleRangeOnNewBar: false,
        rightOffset: 8,
        minBarSpacing: 3,
        barSpacing: 8,
      },
      localization: { locale: typeof navigator !== "undefined" ? navigator.language : "en" },
      crosshair: { 
        mode: CrosshairMode.Magnet,
        vertLine: {
          visible: true,
          color: chartColors.crosshairColor,
          width: 1,
          style: 2,
          labelBackgroundColor: chartColors.priceLineColor,
        },
        horzLine: {
          visible: true,
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
      color: chartColors.priceLineColor,
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
      color: isDark ? "rgba(148, 163, 184, 0.35)" : "rgba(100, 116, 139, 0.25)",
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

    return () => {
      try {
        ro.disconnect();
      } catch {}
      try {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
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

    try {
      lineSeriesRef.current?.applyOptions?.({
        color: chartColors.priceLineColor,
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
        crosshair: {
          mode: CrosshairMode.Magnet,
          vertLine: { 
            visible: crosshairEnabled, 
            color: chartColors.crosshairColor, 
            width: 1, 
            style: 2,
            labelBackgroundColor: chartColors.priceLineColor,
          },
          horzLine: { 
            visible: crosshairEnabled, 
            color: chartColors.crosshairColor, 
            width: 1, 
            style: 2,
            labelBackgroundColor: chartColors.priceLineColor,
          },
        },
      });
    } catch {}

    try {
      chart.priceScale?.("right")?.applyOptions?.({
        autoScale: Boolean(autoScale),
      });
    } catch {}

    try {
      candleSeries.applyOptions({ visible: chartType === "candles", lastValueVisible: false, priceLineVisible: false });
      lineSeries.applyOptions({ visible: chartType === "line", lastValueVisible: false, priceLineVisible: false });
    } catch {}

    try {
      volumeSeries.applyOptions({ visible: Boolean(showVolume) });
    } catch {}
  }, [chartType, showGrid, showVolume, autoScale, crosshairEnabled, chartColors]);

  // Seed + WS lifecycle - ONE REST call for snapshot, then WebSocket PUSH
  // Removed style dependencies to prevent re-fetching on theme change
  useEffect(() => {
    let unsubCandle;
    let unsubPrice;
    let unsubTicker;
    let cancelled = false;
    let mounted = true;

    const run = async () => {
      // Ensure we have refs but don't depend on them changing (they shouldn't)
      if (!normalizedSymbol || !candleSeriesRef.current) return;
      setLoading(true);

      try {
        // 1. Fetch initial candle snapshot (REST - only once per symbol/interval)
        const candles = await binanceFuturesStore.fetchCandles(normalizedSymbol, timeframe, 500);
        if (cancelled || !mounted) return;

        // Use CURRENT colors, not from closure
        const currentIsDark = document.documentElement.classList.contains("dark");
        
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
          color: volumeColor(c, currentIsDark),
        }));

        if (candleSeriesRef.current) candleSeriesRef.current.setData(chartCandles);
        if (volumeSeriesRef.current) volumeSeriesRef.current.setData(volumes);
        if (lineSeriesRef.current) lineSeriesRef.current.setData(chartCandles.map((c) => ({ time: c.time, value: c.close })));

        // Reset view after seeding
        setTimeout(() => resetView(), 100);

        const last = candles[candles.length - 1];
        if (last?.close) {
          setLastPrice(last.close);
          setLastTickAt(Date.now());
          onPriceUpdateRef.current?.(last.close);
          lastCandleRef.current = chartCandles[chartCandles.length - 1];
        }

        // 2. Subscribe to WebSocket PUSH events (no polling!)
        
        // Candle updates from WS
        unsubCandle = binanceFuturesStore.subscribe(`candle:${key}`, (c) => {
          if (cancelled || disposedRef.current || !mounted) return;
          if (!c || !candleSeriesRef.current) return;

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

          try { lineSeriesRef.current?.update?.({ time: c.time, value: Number(c.close) }); } catch {}
          
          try {
            // Recalculate color dynamically
            const isDarkNow = document.documentElement.classList.contains("dark");
            volumeSeriesRef.current?.update({
              time: c.time,
              value: Number(c.volume || 0),
              color: volumeColor(c, isDarkNow),
            });
          } catch {}

          if (c.close) {
            setLastPrice(Number(c.close));
            setLastTickAt(Date.now());
            onPriceUpdateRef.current?.(Number(c.close));
          }
        });

        // Price updates from WS ticker (PRIMARY real-time source)
        unsubPrice = binanceFuturesStore.subscribe(`price:${normalizedSymbol}`, (p) => {
          if (cancelled || disposedRef.current || !mounted) return;
          if (!candleSeriesRef.current) return;
          
          const price = Number(p);
          if (!Number.isFinite(price) || price <= 0) return;
          
          setLastPrice(price);
          setLastTickAt(Date.now());
          onPriceUpdateRef.current?.(price);

          // Update price line
          try {
            // Get colors dynamically
            const isDarkNow = document.documentElement.classList.contains("dark");
            const colors = getChartColors(isDarkNow);
            const priceLineColor = colors.priceLineColor;
            
            if (!priceLineRef.current) {
              priceLineRef.current = candleSeriesRef.current.createPriceLine({
                price,
                color: priceLineColor,
                lineWidth: 1,
                lineStyle: 1,
                axisLabelVisible: true,
                axisLabelColor: priceLineColor,
                axisLabelTextColor: "#ffffff",
                title: "",
              });
            } else if (typeof priceLineRef.current.applyOptions === "function") {
              priceLineRef.current.applyOptions({
                price,
                axisLabelVisible: true,
                axisLabelColor: priceLineColor,
                axisLabelTextColor: "#ffffff",
                title: "",
              });
            }
          } catch {}
          
          // Update current candle close in real-time
          const existingCandles = binanceFuturesStore.getCandles(normalizedSymbol, timeframe);
          if (existingCandles?.length > 0) {
            const lastCandle = existingCandles[existingCandles.length - 1];
            if (lastCandle) {
              const updatedCandle = {
                time: lastCandle.time,
                open: Number(lastCandle.open),
                high: Math.max(Number(lastCandle.high), price),
                low: Math.min(Number(lastCandle.low), price),
                close: price,
              };
              try {
                candleSeriesRef.current?.update?.(updatedCandle);
                lineSeriesRef.current?.update?.({ time: lastCandle.time, value: price });
              } catch {}
            }
          }
        });

        // Ticker subscription (redundant backup)
        unsubTicker = binanceFuturesStore.subscribe(`ticker:${normalizedSymbol}`, (ticker) => {
          if (cancelled || disposedRef.current || !mounted) return;
          if (!ticker?.lastPrice) return;
          const p = Number(ticker.lastPrice);
          if (Number.isFinite(p) && p > 0) {
            setLastPrice(p);
            setLastTickAt(Date.now());
            onPriceUpdateRef.current?.(p);
          }
        });

        // 3. Connect WebSocket streams (idempotent - will not duplicate)
        binanceFuturesStore.connectChartStreams({ 
          symbol: normalizedSymbol, 
          interval: timeframe, 
          seeded: true 
        });
        
      } finally {
        if (!cancelled && mounted) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
      mounted = false;
      try { unsubCandle?.(); } catch {}
      try { unsubPrice?.(); } catch {}
      try { unsubTicker?.(); } catch {}
      // NOTE: Don't close WS on unmount - store manages lifecycle
    };
    // Removed isDark, chartColors, smoothAnimations from deps to prevent data refetch on UI changes
  }, [normalizedSymbol, timeframe, key, animateCandle, resetView]);

  // Position trade overlay - NATIVE PRICE LINES ONLY (no HTML labels)
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

    // Entry line - SOLID with clear label
    if (Number.isFinite(entry) && entry > 0) {
      const entryColor = isShort ? chartColors.entryShort : chartColors.entryLong;
      upsertOverlayLine("entry", {
        price: entry,
        color: entryColor,
        lineWidth: 2,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        axisLabelColor: entryColor,
        axisLabelTextColor: "#ffffff",
        title: isShort ? "SHORT" : "LONG",
      });
    } else {
      removeOverlayLine("entry");
    }

    // Take Profit line
    const tp = Number(t.take_profit ?? t.takeProfit ?? t.tp);
    if (Number.isFinite(tp) && tp > 0) {
      upsertOverlayLine("tp", {
        price: tp,
        color: chartColors.takeProfit,
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        axisLabelColor: chartColors.takeProfit,
        axisLabelTextColor: "#ffffff",
        title: "TP",
      });
    } else {
      removeOverlayLine("tp");
    }

    // Stop Loss line
    const sl = Number(t.stop_loss ?? t.stopLoss ?? t.sl);
    if (Number.isFinite(sl) && sl > 0) {
      upsertOverlayLine("sl", {
        price: sl,
        color: chartColors.stopLoss,
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        axisLabelColor: chartColors.stopLoss,
        axisLabelTextColor: "#ffffff",
        title: "SL",
      });
    } else {
      removeOverlayLine("sl");
    }

    // Liquidation line
    const liq = Number(t.liquidation_price);
    if (Number.isFinite(liq) && liq > 0) {
      upsertOverlayLine("liq", {
        price: liq,
        color: chartColors.liquidation,
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        axisLabelColor: chartColors.liquidation,
        axisLabelTextColor: priceLineTextColorForBg(chartColors.liquidation),
        title: "LIQ",
      });
    } else {
      removeOverlayLine("liq");
    }
  }, [positionTrade, chartColors]);

  // Pending order overlays (limit/stop)
  useEffect(() => {
    if (disposedRef.current) return;
    const list = Array.isArray(pendingOrders) ? pendingOrders : [];
    const ids = new Set(list.map((o) => o?.id).filter(Boolean));

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

      const lineColor = orderType === "STOP" ? chartColors.pending : chartColors.liquidation;
      upsertPendingLine(id, {
        price: p,
        color: lineColor,
        lineWidth: 1,
        lineStyle: 3, // Dotted
        axisLabelVisible: true,
        axisLabelColor: lineColor,
        axisLabelTextColor: priceLineTextColorForBg(lineColor),
        title: orderType === "STOP" ? "STOP" : "LIMIT",
      });
    }
  }, [pendingOrders, chartColors]);

  return (
    <div className="w-full h-full min-h-[250px] bg-background text-foreground flex flex-col">
      {/* Professional Chart Toolbar */}
      <div className="bg-card/80 backdrop-blur-sm border-b border-border/40">
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          {/* Timeframe buttons */}
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide min-w-0">
            {INTERVALS.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 text-[11px] rounded-md transition-all font-semibold whitespace-nowrap flex-shrink-0 ${
                  timeframe === tf
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Separator */}
          <div className="w-px h-4 bg-border/40 shrink-0 mx-0.5" />

          {/* Chart type toggle */}
          <button
            type="button"
            onClick={() => setChartType(chartType === "candles" ? "line" : "candles")}
            className={`p-1.5 rounded-md transition-colors shrink-0 ${
              chartType === "candles" ? "text-foreground" : "text-muted-foreground/50 hover:text-foreground"
            }`}
            title={chartType === "candles" ? "Switch to Line" : "Switch to Candles"}
          >
            {chartType === "candles" ? <BarChart3 className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
          </button>

          {/* Crosshair toggle */}
          <button
            type="button"
            onClick={() => setCrosshairEnabled(!crosshairEnabled)}
            className={`p-1.5 rounded-md transition-colors shrink-0 ${
              crosshairEnabled ? "text-foreground" : "text-muted-foreground/40 hover:text-foreground"
            }`}
            title={labels.crosshair}
          >
            <Crosshair className="h-3.5 w-3.5" />
          </button>

          {/* Volume toggle - desktop */}
          <button
            type="button"
            onClick={() => setShowVolume(!showVolume)}
            className={`p-1.5 rounded-md transition-colors shrink-0 hidden sm:flex ${
              showVolume ? "text-foreground" : "text-muted-foreground/40 hover:text-foreground"
            }`}
            title={showVolume ? "Hide Volume" : "Show Volume"}
          >
            <Volume2 className="h-3.5 w-3.5" />
          </button>

          <div className="flex-1" />

          {/* Status indicator */}
          <div className="flex items-center gap-1.5 shrink-0 mr-1">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${now - lastTickAt < 3000 ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`} />
            <span className="text-xs font-mono font-semibold text-foreground tabular-nums" style={{ direction: "ltr" }}>
              {formatPrice(lastPrice)}
            </span>
          </div>

          {/* Reset */}
          <button
            type="button"
            onClick={resetView}
            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
            title={labels.resetTitle}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={() => {
              const el = containerRef.current?.parentElement?.parentElement;
              if (!el) return;
              if (!document.fullscreenElement) {
                el.requestFullscreen?.().catch(() => {});
                setIsFullscreen(true);
              } else {
                document.exitFullscreen?.().catch(() => {});
                setIsFullscreen(false);
              }
            }}
            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
            title={labels.fullscreen}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>

          {/* Settings dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
                title={labels.settings}
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border text-popover-foreground min-w-[180px]">
              <DropdownMenuLabel className="text-xs font-semibold text-foreground">{labels.chartSettings}</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />

              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {labels.chartType}
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup value={chartType} onValueChange={setChartType}>
                <DropdownMenuRadioItem value="candles" className="text-sm text-foreground">
                  {labels.candles}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="line" className="text-sm text-foreground">
                  {labels.line}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>

              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuCheckboxItem checked={showGrid} onCheckedChange={setShowGrid} className="text-sm text-foreground">
                {labels.showGrid}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={showVolume} onCheckedChange={setShowVolume} className="text-sm text-foreground">
                {labels.showVolume}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={crosshairEnabled} onCheckedChange={setCrosshairEnabled} className="text-sm text-foreground">
                {labels.crosshair}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={smoothAnimations} onCheckedChange={setSmoothAnimations} className="text-sm text-foreground">
                {labels.smoothAnimations}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={autoScale} onCheckedChange={setAutoScale} className="text-sm text-foreground">
                {labels.autoScale}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Chart Container */}
      <div ref={containerRef} className="flex-1 min-h-[200px] sm:min-h-[280px] relative">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-20">
            <span className="text-xs text-muted-foreground animate-pulse">{labels.loading}</span>
          </div>
        )}
      </div>
    </div>
  );
}, (/** @type {any} */ prev, /** @type {any} */ next) => {
  // Custom comparison to prevent chart rerenders on PnL/MarkPrice updates
  const posEqual = 
    prev.positionTrade?.id === next.positionTrade?.id &&
    Number(prev.positionTrade?.entry_price || 0) === Number(next.positionTrade?.entry_price || 0) &&
    Number(prev.positionTrade?.avg_entry_price || 0) === Number(next.positionTrade?.avg_entry_price || 0) &&
    Number(prev.positionTrade?.take_profit || prev.positionTrade?.tp || 0) === Number(next.positionTrade?.take_profit || next.positionTrade?.tp || 0) &&
    Number(prev.positionTrade?.stop_loss || prev.positionTrade?.sl || 0) === Number(next.positionTrade?.stop_loss || next.positionTrade?.sl || 0) &&
    Number(prev.positionTrade?.liquidation_price || 0) === Number(next.positionTrade?.liquidation_price || 0);

  return (
    prev.symbol === next.symbol &&
    prev.language === next.language &&
    // Ignore function ref changes if safe, but safer to check ref
    prev.onPriceUpdate === next.onPriceUpdate && 
    prev.pendingOrders === next.pendingOrders &&
    posEqual
  );
});

/** @type {any} */ (BinanceFuturesChart).propTypes = {
  symbol: PropTypes.string.isRequired,
  language: PropTypes.string,
  onPriceUpdate: PropTypes.func,
  positionTrade: PropTypes.object,
  pendingOrders: PropTypes.array,
};

export default BinanceFuturesChart;