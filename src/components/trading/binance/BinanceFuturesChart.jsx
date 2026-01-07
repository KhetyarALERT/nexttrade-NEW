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

function formatQty(qty) {
  const n = Number(qty);
  if (!Number.isFinite(n)) return "—";
  // Keep it compact; trim trailing zeros.
  const s = n.toFixed(n >= 1 ? 4 : 6);
  return s.replace(/\.0+$/, "").replace(/(\.[0-9]*?)0+$/, "$1");
}

function formatPnl(pnl) {
  const n = Number(pnl);
  if (!Number.isFinite(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

function compactPrice(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return "—";
  const digits = n < 1 ? 6 : 2;
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function BinanceFuturesChart({ symbol, language = "en", onPriceUpdate, positionTrade = null, pendingOrders = [] }) {
  const [timeframe, setTimeframe] = useState("15m");
  const [loading, setLoading] = useState(true);
  const [lastPrice, setLastPrice] = useState(0);
  const [lastTickAt, setLastTickAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const [overlayBadges, setOverlayBadges] = useState({});

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
  const badgeLayerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const priceLineRef = useRef(null);

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

  const removeOverlayLine = (key) => {
    try {
      if (overlayLinesRef.current?.[key] && candleSeriesRef.current?.removePriceLine) {
        candleSeriesRef.current.removePriceLine(overlayLinesRef.current[key]);
      }
    } catch {}
    if (overlayLinesRef.current) overlayLinesRef.current[key] = null;
  };

  const removeOverlayBadge = (key) => {
    setOverlayBadges((prev) => {
      if (!prev?.[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const upsertOverlayBadge = (key, badge) => {
    setOverlayBadges((prev) => ({ ...prev, [key]: badge }));
  };

  const upsertOverlayLine = (key, opts) => {
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
    try {
      const line = pendingLinesRef.current.get(id);
      if (line && candleSeriesRef.current?.removePriceLine) {
        candleSeriesRef.current.removePriceLine(line);
      }
    } catch {}
    try {
      pendingLinesRef.current.delete(id);
    } catch {}
    removeOverlayBadge(`pending:${id}`);
  };

  const upsertPendingLine = (id, opts) => {
    if (!id || !candleSeriesRef.current) return;
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

    return () => {
      try {
        ro.disconnect();
      } catch {}

      // Important: null refs first so any late-running effects/interval ticks
      // won't call into disposed lightweight-charts objects.
      chartRef.current = null;
      candleSeriesRef.current = null;
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
            onPriceUpdateRef.current?.(Number(c.close));
          }
        });

        unsubPrice = binanceFuturesStore.subscribe(`price:${normalizedSymbol}`, (p) => {
          if (!p || !candleSeriesRef.current) return;
          setLastPrice(Number(p));
          setLastTickAt(Date.now());
          onPriceUpdateRef.current?.(Number(p));

          // Update price line (hide axis label; we render our own compact right label)
          try {
            if (!priceLineRef.current) {
              priceLineRef.current = candleSeriesRef.current.createPriceLine({
                price: Number(p),
                color: "#0099FA",
                lineWidth: 1,
                lineStyle: 1,
                axisLabelVisible: false,
                title: "",
              });
            } else if (typeof priceLineRef.current.applyOptions === "function") {
              priceLineRef.current.applyOptions({
                price: Number(p),
                axisLabelVisible: false,
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
                axisLabelVisible: false,
                title: "",
              });
            }
          } catch {
            // ignore
          }

          // Custom right-side label (short)
          upsertOverlayBadge("last", {
            price: Number(p),
            tone: "last",
            label: "Last",
          });
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
    const t = positionTrade;
    if (!t || !candleSeriesRef.current) {
      removeOverlayLine("entry");
      removeOverlayLine("tp");
      removeOverlayLine("sl");
      removeOverlayLine("liq");

      // Do NOT clear all badges here (we keep Last + pending-order labels).
      removeOverlayBadge("entry");
      removeOverlayBadge("tp");
      removeOverlayBadge("sl");
      removeOverlayBadge("liq");
      return;
    }

    const mark = Number(lastPrice);
    const entry = Number(t.avg_entry_price ?? t.entry_price);
    const qty = Number(t.quantity) || 0;
    const side = String(t.side || "LONG").toUpperCase();
    const isShort = side === "SHORT";

    const hasQty = Number.isFinite(qty) && qty > 0;
    const pnl =
      hasQty && Number.isFinite(mark) && Number.isFinite(entry)
        ? (isShort ? (entry - mark) * qty : (mark - entry) * qty)
        : Number.NaN;

    const entryTitle = `${isShort ? "Short" : "Long"} ${formatQty(qty)} PnL ${formatPnl(pnl)}`;

    if (Number.isFinite(entry) && entry > 0) {
      upsertOverlayLine("entry", {
        price: entry,
        color: isShort ? "#ef4444" : "#22c55e",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: "",
      });

      upsertOverlayBadge("entry", {
        price: entry,
        tone: isShort ? "short" : "long",
        label: entryTitle,
      });
    } else {
      removeOverlayLine("entry");
      removeOverlayBadge("entry");
    }

    const tp = Number(t.take_profit ?? t.takeProfit ?? t.tp);
    if (Number.isFinite(tp) && tp > 0) {
      const tpPnl = hasQty && Number.isFinite(entry) ? (isShort ? (entry - tp) * qty : (tp - entry) * qty) : Number.NaN;
      upsertOverlayLine("tp", {
        price: tp,
        color: "#22c55e",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: "",
      });

      upsertOverlayBadge("tp", {
        price: tp,
        tone: "tp",
        label: `TP ${formatPnl(tpPnl)}`,
      });
    } else {
      removeOverlayLine("tp");
      removeOverlayBadge("tp");
    }

    const sl = Number(t.stop_loss ?? t.stopLoss ?? t.sl);
    if (Number.isFinite(sl) && sl > 0) {
      const slPnl = hasQty && Number.isFinite(entry) ? (isShort ? (entry - sl) * qty : (sl - entry) * qty) : Number.NaN;
      upsertOverlayLine("sl", {
        price: sl,
        color: "#ef4444",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: "",
      });

      upsertOverlayBadge("sl", {
        price: sl,
        tone: "sl",
        label: `SL ${formatPnl(slPnl)}`,
      });
    } else {
      removeOverlayLine("sl");
      removeOverlayBadge("sl");
    }

    const liq = Number(t.liquidation_price);
    if (Number.isFinite(liq) && liq > 0) {
      upsertOverlayLine("liq", {
        price: liq,
        color: "#f59e0b",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: "",
      });

      upsertOverlayBadge("liq", {
        price: liq,
        tone: "liq",
        label: "Liq",
      });
    } else {
      removeOverlayLine("liq");
      removeOverlayBadge("liq");
    }
  }, [positionTrade, lastPrice, now]);

  // Pending order overlays (limit/stop)
  useEffect(() => {
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
      const side = String(o?.side || "LONG").toUpperCase();
      const isShort = side === "SHORT";

      const p = Number(o?.limit_price ?? o?.stop_price ?? o?.entry_price);
      if (!Number.isFinite(p) || p <= 0) {
        removePendingLine(id);
        continue;
      }

      const qty = Number(o?.quantity);
      const typeLabel = orderType === "STOP" ? "Stop" : "Limit";
      const sideLabel = isShort ? "Sell" : "Buy";

      upsertPendingLine(id, {
        price: p,
        color: orderType === "STOP" ? "#a855f7" : "#eab308",
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: false,
        title: "",
      });

      upsertOverlayBadge(`pending:${id}`, {
        price: p,
        tone: orderType === "STOP" ? "pendingStop" : "pendingLimit",
        label: `${typeLabel} ${sideLabel}${Number.isFinite(qty) && qty > 0 ? ` ${formatQty(qty)}` : ""}`,
      });
    }
  }, [pendingOrders, now, lastPrice]);

  // Position the HTML badges on the right side of the chart
  const overlayBadgeItems = useMemo(() => {
    if (!overlayBadges || !candleSeriesRef.current) return [];
    const series = candleSeriesRef.current;
    const height = containerRef.current?.clientHeight || 0;
    const items = Object.entries(overlayBadges)
      .map(([key, b]) => {
        let y = Number.NaN;
        try {
          y = series.priceToCoordinate?.(Number(b?.price));
        } catch {
          // series might be disposed during unmount
          y = Number.NaN;
        }
        if (!Number.isFinite(y)) return null;
        return { key, y, ...b };
      })
      .filter(Boolean)
      .sort((a, b) => a.y - b.y);

    // Avoid overlap: enforce minimum vertical spacing between badges.
    const minGap = 28;
    let lastTop = -Infinity;
    const clamped = items.map((it) => {
      const baseTop = it.y - 12;
      const boundedTop = height
        ? Math.max(6, Math.min(height - 28, baseTop))
        : Math.max(6, baseTop);
      const top = Math.max(boundedTop, lastTop + minGap);
      lastTop = top;
      return { ...it, top };
    });

    // If we pushed some beyond the bottom, shift up as a group.
    if (height) {
      const overflow = clamped.length ? clamped[clamped.length - 1].top - (height - 28) : 0;
      if (overflow > 0) {
        return clamped.map((it) => ({ ...it, top: Math.max(6, it.top - overflow) }));
      }
    }

    return clamped;
  }, [overlayBadges, now, lastPrice]);

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

        <div ref={badgeLayerRef} className="absolute inset-0 pointer-events-none z-20">
          {overlayBadgeItems.map((b) => {
            const tone = b.tone;
            const isLong = tone === "long";
            const isShort = tone === "short";
            const isTp = tone === "tp";
            const isSl = tone === "sl";
            const isLiq = tone === "liq";
            const isPendingLimit = tone === "pendingLimit";
            const isPendingStop = tone === "pendingStop";
            const isLast = tone === "last";
            const cls = isTp
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-100"
              : isSl
                ? "bg-rose-500/15 border-rose-500/30 text-rose-100"
                : isLiq
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-100"
                  : isPendingLimit
                    ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-100"
                    : isPendingStop
                      ? "bg-fuchsia-500/15 border-fuchsia-500/30 text-fuchsia-100"
                      : isLast
                        ? "bg-sky-500/15 border-sky-500/30 text-sky-100"
                  : isShort
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-100"
                    : isLong
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-100"
                      : "bg-slate-500/10 border-slate-500/20 text-slate-100";

            const tailCls = isTp
              ? "border-r-emerald-500/30"
              : isSl
                ? "border-r-rose-500/30"
                : isLiq
                  ? "border-r-amber-500/30"
                  : isPendingLimit
                    ? "border-r-yellow-500/30"
                    : isPendingStop
                      ? "border-r-fuchsia-500/30"
                      : isLast
                        ? "border-r-sky-500/30"
                        : isShort
                          ? "border-r-rose-500/20"
                          : isLong
                            ? "border-r-emerald-500/20"
                            : "border-r-slate-500/20";

            return (
              <div
                key={b.key}
                className={`absolute right-2 px-2 py-0.5 rounded-lg border backdrop-blur-sm shadow-sm ${cls}`}
                style={{ top: Number.isFinite(b.top) ? b.top : Math.max(6, b.y - 12) }}
              >
                <div className={`absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-r-[8px] ${tailCls}`} />
                <div className="text-[10px] leading-none font-semibold">
                  {b.label}
                </div>
                <div className="mt-0.5 text-[9px] leading-none opacity-90 font-mono">{compactPrice(b.price)}</div>
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
