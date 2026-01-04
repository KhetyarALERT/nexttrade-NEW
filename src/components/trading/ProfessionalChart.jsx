import React, { useEffect, useMemo, useRef, useState } from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';

const QX_BG = '#181c2b';
const QX_GRID = 'rgba(255,255,255,0.07)';

const QX_BLUE = '#0099FA';

// Hover pills (time + price) should be grey (not blue).
const QX_PILL_BG = '#3b4258';
const QX_PILL_BORDER = '#3b4258';

// Fixed empty space to keep on the right side (in candle bars).
// This is a hard cap: the right-side blank area won't grow beyond this.
const RIGHT_SPACE_BARS = 46;

// Default number of bars to keep visible when auto-following the latest candle.
// Smaller = more zoomed-in.
const DEFAULT_VISIBLE_BARS = 114;

// Clamp zoom so the chart can't become unusably tight/wide.
const MIN_VISIBLE_BARS = 28;
const MAX_VISIBLE_BARS = 305;

const tfToSec = (tf) => {
  switch ((tf || 'M1').toString().toUpperCase()) {
    case 'M1':
      return 60;
    case 'M5':
      return 5 * 60;
    case 'M15':
      return 15 * 60;
    case 'M30':
      return 30 * 60;
    case 'H1':
      return 60 * 60;
    case 'D1':
      return 24 * 60 * 60;
    default:
      return 60;
  }
};

const rightSpaceMs = (tfSec, visibleBars) => {
  const sec = Number(tfSec);
  if (!Number.isFinite(sec) || sec <= 0) return 0;

  // Keep right-side space, but shrink it when the user zooms in hard.
  // This ensures that on M1, max zoom can reach a 1-minute window.
  const vb = Number(visibleBars);
  const baseBars = Number.isFinite(vb) && vb > 0 ? vb : DEFAULT_VISIBLE_BARS;
  const dynamicBars = Math.max(1, Math.floor(baseBars * 0.45));
  const bars = Math.min(RIGHT_SPACE_BARS, dynamicBars);
  return sec * bars * 1000;
};

const PRICE_DECIMALS = 2;
const PRICE_STEP = 0.01;

const clampPrice = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return n;
  return Number(n.toFixed(PRICE_DECIMALS));
};

const formatLastPriceLabel = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  try {
    return n.toLocaleString('en-US', {
      minimumFractionDigits: PRICE_DECIMALS,
      maximumFractionDigits: PRICE_DECIMALS,
    });
  } catch {
    return n.toFixed(PRICE_DECIMALS);
  }
};

export default function HighchartsCandleChart({ candles = [], timeframe = 'M1' }) {
  const chartComponentRef = useRef(null);
  const containerRef = useRef(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const [visibleBars, setVisibleBars] = useState(DEFAULT_VISIBLE_BARS);

  const derivedRef = useRef(null);

  const [isPointerInside, setIsPointerInside] = useState(false);

  const lastPointerEventRef = useRef(null);
  const isPointerInsideRef = useRef(false);

  const rafRef = useRef(0);
  const [hoverPrice, setHoverPrice] = useState(null);
  const [priceMarks, setPriceMarks] = useState([]);

  const [animatedLastClose, setAnimatedLastClose] = useState(null);
  const animatedLastCloseRef = useRef(null);
  const priceAnimTimerRef = useRef(0);

  const lastCandleBaseRef = useRef({ x: null, open: null, high: null, low: null });

  const getMainSeries = () => {
    const chart = chartComponentRef.current?.chart;
    if (!chart) return null;
    const byId = chart.get?.('price-series');
    if (byId) return byId;
    return chart.series?.[0] || null;
  };

  // When timeframe changes, return to auto-follow by default.
  useEffect(() => {
    setAutoFollow(true);
    setVisibleBars(DEFAULT_VISIBLE_BARS);
  }, [timeframe]);

  const derived = useMemo(() => {
    const ohlc = (candles || [])
      .filter((c) => c && typeof c.time === 'number')
      .map((c) => [
        c.time * 1000, // Highcharts expects ms
        Number(c.open),
        Number(c.high),
        Number(c.low),
        Number(c.close),
      ]);

    const tfSec = tfToSec(timeframe);
    const futureMs = rightSpaceMs(tfSec, visibleBars);

    const last = ohlc.length ? ohlc[ohlc.length - 1][0] : null;
    const lastClose = ohlc.length ? ohlc[ohlc.length - 1][4] : null;
    const to = last != null ? last + futureMs : undefined;
    const desiredFrom = to != null ? to - tfSec * visibleBars * 1000 : undefined;
    const first = ohlc.length ? ohlc[0][0] : null;
    const from =
      typeof desiredFrom === 'number' && Number.isFinite(desiredFrom) && typeof first === 'number' && Number.isFinite(first)
        ? Math.max(first, desiredFrom)
        : desiredFrom;

    return { ohlc, tfSec, futureMs, last, lastClose, from, to };
  }, [candles, timeframe, visibleBars]);

  useEffect(() => {
    derivedRef.current = derived;
  }, [derived]);

  // Cache the base OHLC values for the latest candle so we can animate only the close
  // without losing the candle's open/high/low.
  useEffect(() => {
    const last = derived.ohlc.length ? derived.ohlc[derived.ohlc.length - 1] : null;
    if (!last) return;

    const x = last[0];
    const open = Number(last[1]);
    const high = Number(last[2]);
    const low = Number(last[3]);

    if (typeof x !== 'number' || !Number.isFinite(x)) return;
    if (![open, high, low].every((n) => Number.isFinite(n))) return;

    lastCandleBaseRef.current = { x, open, high, low };
  }, [derived.ohlc]);

  // Keep the Highcharts series in sync without replacing the whole series on every tick.
  // We only call setData when a candle is added/removed (or timeframe changes), otherwise
  // we let the animated-close effect drive the last candle visuals.
  useEffect(() => {
    const chart = chartComponentRef.current?.chart;
    const series = getMainSeries();
    if (!chart || !series || typeof series.setData !== 'function') return;

    const next = Array.isArray(derived.ohlc) ? derived.ohlc : [];
    const nextLen = next.length;
    const nextLastX = nextLen ? next[nextLen - 1][0] : null;

    const curLen = Array.isArray(series.xData) ? series.xData.length : series.data?.length || 0;
    const curLastX = curLen ? (Array.isArray(series.xData) ? series.xData[curLen - 1] : series.data[curLen - 1]?.x) : null;

    const needsFullSync = curLen !== nextLen || (typeof nextLastX === 'number' && nextLastX !== curLastX);
    if (needsFullSync) {
      try {
        series.setData(next, true, false, false);
      } catch {
        // ignore
      }
      return;
    }

    // Same candle structure: keep base OHLC in sync (open/high/low) but do not override
    // the close here (that is driven by animatedLastClose).
    const base = lastCandleBaseRef.current;
    const points = series.points;
    const lastPoint = Array.isArray(points) && points.length ? points[points.length - 1] : null;
    if (!lastPoint) return;

    if (typeof base?.x === 'number' && Number.isFinite(base.x) && typeof lastPoint.x === 'number' && base.x === lastPoint.x) {
      const open = Number.isFinite(base.open) ? base.open : Number(lastPoint.open);
      const close = Number(lastPoint.close);
      const highBase = Number.isFinite(base.high) ? base.high : Number(lastPoint.high);
      const lowBase = Number.isFinite(base.low) ? base.low : Number(lastPoint.low);
      const high = Number.isFinite(highBase) ? Math.max(highBase, close) : close;
      const low = Number.isFinite(lowBase) ? Math.min(lowBase, close) : close;

      try {
        lastPoint.update({ open, high, low }, false, false);
        chart.redraw(false);
      } catch {
        // ignore
      }
    }
  }, [derived.ohlc]);

  // Animate last price label in 0.01 steps (e.g., 91,480.00 -> 91,480.30).
  useEffect(() => {
    const targetRaw = Number(derived.lastClose);
    if (!Number.isFinite(targetRaw)) return;
    const target = clampPrice(targetRaw);

    // Stop any in-flight animation.
    if (priceAnimTimerRef.current) {
      try {
        clearInterval(priceAnimTimerRef.current);
      } catch {
        // ignore
      }
      priceAnimTimerRef.current = 0;
    }

    const currentRaw = animatedLastCloseRef.current;
    const current = Number.isFinite(currentRaw) ? clampPrice(currentRaw) : target;

    if (!Number.isFinite(current) || current === target) {
      animatedLastCloseRef.current = target;
      setAnimatedLastClose(target);
      return;
    }

    const diff = target - current;
    const stepsNeeded = Math.round(Math.abs(diff) / PRICE_STEP);
    const MAX_STEPWISE_UPDATES = 400;
    const STEP_INTERVAL_MS = 16;

    // If the diff is huge, stepwise would take too long.
    if (!Number.isFinite(stepsNeeded) || stepsNeeded > MAX_STEPWISE_UPDATES) {
      const start = current;
      const durationMs = 500;
      const startedAt = Date.now();

      const tick = () => {
        const t = Math.min(1, (Date.now() - startedAt) / durationMs);
        const eased = 1 - (1 - t) ** 3; // easeOutCubic
        const next = clampPrice(start + (target - start) * eased);
        animatedLastCloseRef.current = next;
        setAnimatedLastClose(next);
        if (t >= 1) return;
        setTimeout(tick, STEP_INTERVAL_MS);
      };

      tick();
      return;
    }

    const dir = diff > 0 ? 1 : -1;
    let nextValue = current;

    priceAnimTimerRef.current = setInterval(() => {
      nextValue = clampPrice(nextValue + dir * PRICE_STEP);
      const done = dir > 0 ? nextValue >= target : nextValue <= target;
      const applied = done ? target : nextValue;
      animatedLastCloseRef.current = applied;
      setAnimatedLastClose(applied);

      if (done) {
        try {
          clearInterval(priceAnimTimerRef.current);
        } catch {
          // ignore
        }
        priceAnimTimerRef.current = 0;
      }
    }, STEP_INTERVAL_MS);

    return () => {
      if (priceAnimTimerRef.current) {
        try {
          clearInterval(priceAnimTimerRef.current);
        } catch {
          // ignore
        }
        priceAnimTimerRef.current = 0;
      }
    };
  }, [derived.lastClose]);

  // Drive the last candle body/wick smoothly by updating only the last point's close.
  // This avoids the "jumping" effect you get when the whole series is replaced.
  useEffect(() => {
    const vRaw = Number(animatedLastClose);
    if (!Number.isFinite(vRaw)) return;

    const chart = chartComponentRef.current?.chart;
    const yAxis = chart?.yAxis?.[0];
    const series = getMainSeries();
    if (!yAxis || !series) return;

    const v = clampPrice(vRaw);

    // --- Fix: Always update last price plotLine label live ---
    try {
      // Remove and re-add the plotLine to force label update if needed
      yAxis.removePlotLine('last-price');
    } catch {}
    try {
      yAxis.addPlotLine({
        id: 'last-price',
        value: v,
        color: QX_BLUE,
        width: 1,
        dashStyle: 'Dash',
        zIndex: 5,
        label: {
          useHTML: true,
          text: `<span style="display:inline-block;padding:3px 8px;border-radius:8px;background:${QX_BLUE};border:1px solid ${QX_BLUE};color:#ffffff;font-weight:700;font-size:11px;">${formatLastPriceLabel(v)}</span>`,
          align: 'right',
          verticalAlign: 'middle',
          x: 0,
          y: 0,
        },
      });
    } catch {}

    // --- End fix ---

    const base = lastCandleBaseRef.current;
    const points = series?.points;
    const lastPoint = Array.isArray(points) && points.length ? points[points.length - 1] : null;
    if (!lastPoint) {
      try {
        chart?.redraw?.(false);
      } catch {
        // ignore
      }
      return;
    }

    // If the chart's last point doesn't match the latest candle x, don't try to animate it.
    if (typeof base?.x === 'number' && Number.isFinite(base.x) && typeof lastPoint.x === 'number' && base.x !== lastPoint.x) {
      try {
        chart?.redraw?.(false);
      } catch {
        // ignore
      }
      return;
    }

    const open = Number.isFinite(base?.open) ? base.open : Number(lastPoint.open);
    const highBase = Number.isFinite(base?.high) ? base.high : Number(lastPoint.high);
    const lowBase = Number.isFinite(base?.low) ? base.low : Number(lastPoint.low);
    const high = Number.isFinite(highBase) ? Math.max(highBase, v) : v;
    const low = Number.isFinite(lowBase) ? Math.min(lowBase, v) : v;

    try {
      lastPoint.update(
        {
          x: lastPoint.x,
          open,
          high,
          low,
          close: v,
        },
        false,
        false
      );
      chart?.redraw?.(false);
    } catch {
      // ignore
    }
  }, [animatedLastClose]);

  // Keep mark plotLines in sync imperatively so React option updates don't clear the series.
  useEffect(() => {
    const chart = chartComponentRef.current?.chart;
    const yAxis = chart?.yAxis?.[0];
    if (!yAxis) return;

    const nextValues = (priceMarks || [])
      .filter((v) => typeof v === 'number' && Number.isFinite(v))
      .map((v) => clampPrice(v));

    // Normalize IDs to be stable across renders.
    const nextIds = new Set(nextValues.map((v) => `mark-${v.toFixed(6)}`));

    try {
      const bands = Array.isArray(yAxis.plotLinesAndBands) ? yAxis.plotLinesAndBands : [];
      // Remove marks that no longer exist.
      for (const band of bands) {
        if (!band?.id || typeof band.id !== 'string') continue;
        if (!band.id.startsWith('mark-')) continue;
        if (!nextIds.has(band.id)) {
          try {
            yAxis.removePlotLine(band.id);
          } catch {
            // ignore
          }
        }
      }

      // Add missing marks.
      for (const v of nextValues) {
        const id = `mark-${v.toFixed(6)}`;
        const exists = Array.isArray(yAxis.plotLinesAndBands)
          ? yAxis.plotLinesAndBands.some((b) => b && b.id === id)
          : false;
        if (exists) continue;
        try {
          yAxis.addPlotLine({
            id,
            value: v,
            color: 'rgba(0, 153, 250, 0.55)',
            width: 1,
            dashStyle: 'Dash',
            zIndex: 4,
          });
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }, [priceMarks]);

  // Keep chart pinned to the latest candle (with future space) unless user pans away.
  useEffect(() => {
    if (!autoFollow) return;
    if (typeof derived.from !== 'number' || typeof derived.to !== 'number') return;

    const chart = chartComponentRef.current?.chart;
    const axis = chart?.xAxis?.[0];
    if (!axis?.setExtremes) return;

    try {
      axis.setExtremes(derived.from, derived.to, true, false, { trigger: 'autoFollow' });
    } catch {
      // ignore
    }
  }, [autoFollow, derived.from, derived.to]);

  // Always keep a fixed right-side empty space and cap the axis max to the latest candle + future space.
  // This prevents "zooming out" from removing the right padding.
  useEffect(() => {
    if (typeof derived.to !== 'number' || typeof derived.futureMs !== 'number') return;
    const chart = chartComponentRef.current?.chart;
    const axis = chart?.xAxis?.[0];
    if (!axis?.update) return;

    try {
      axis.update(
        {
          overscroll: derived.futureMs,
          max: derived.to,
          // Prevent zooming in below one candle for the current timeframe.
          minRange: Math.max(1, Number(derived.tfSec) || 1) * 1000,
        },
        false
      );
      chart?.redraw?.(false);
    } catch {
      // ignore
    }
  }, [derived.to, derived.futureMs, derived.tfSec]);

  // Keep Highcharts sized to its container (sidebars/layout changes may not trigger
  // a window resize).
  useEffect(() => {
    const chart = chartComponentRef.current?.chart;
    if (!chart) return;

    const reflow = () => {
      try {
        chart.reflow();
      } catch {
        // ignore
      }
    };

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      try {
        resizeObserver = new ResizeObserver(() => reflow());
        resizeObserver.observe(containerRef.current);
      } catch {
        // ignore
      }
    }

    // Run once after mount.
    setTimeout(reflow, 0);
    return () => {
      try {
        resizeObserver?.disconnect?.();
      } catch {
        // ignore
      }
    };
  }, []);

  // Force crosshair to follow the mouse everywhere inside the plot area,
  // not only when hovering an exact candle/point.
  useEffect(() => {
    const chart = chartComponentRef.current?.chart;
    if (!chart) return;

    const drawAtLastPosition = () => {
      if (!isPointerInsideRef.current) return;
      const e = lastPointerEventRef.current;
      if (!e) return;
      try {
        chart.xAxis?.[0]?.drawCrosshair?.(e);
        chart.yAxis?.[0]?.drawCrosshair?.(e);
      } catch {
        // ignore
      }
    };

    const onMove = (ev) => {
      try {
        const e = chart.pointer?.normalize ? chart.pointer.normalize(ev) : ev;

        // Cache the last pointer position so we can keep the crosshair label
        // visible even when the chart redraws due to live updates.
        lastPointerEventRef.current = e;
        isPointerInsideRef.current = true;

        chart.xAxis?.[0]?.drawCrosshair?.(e);
        chart.yAxis?.[0]?.drawCrosshair?.(e);

        // Track hovered price for the right-side control.
        const yAxis = chart.yAxis?.[0];
        if (yAxis?.toValue) {
          const plotY = typeof chart.plotTop === 'number' ? e.chartY - chart.plotTop : e.chartY;
          const v = yAxis.toValue(plotY, true);
          if (Number.isFinite(v)) {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
              setHoverPrice(v);
            });
          }
        }
      } catch {
        // ignore
      }
    };

    const onContainerEnter = () => {
      isPointerInsideRef.current = true;
      setIsPointerInside(true);
      drawAtLastPosition();
    };

    const onContainerLeave = () => {
      isPointerInsideRef.current = false;
      setIsPointerInside(false);
      lastPointerEventRef.current = null;
      setHoverPrice(null);
      if (rafRef.current) {
        try {
          cancelAnimationFrame(rafRef.current);
        } catch {
          // ignore
        }
        rafRef.current = 0;
      }
      try {
        chart.xAxis?.[0]?.hideCrosshair?.();
        chart.yAxis?.[0]?.hideCrosshair?.();
      } catch {
        // ignore
      }
    };

    const onRedraw = () => {
      drawAtLastPosition();
    };

    const chartEl = chart.container;
    const containerEl = containerRef.current;
    if (!chartEl || !containerEl) return;

    chartEl.addEventListener('mousemove', onMove);
    containerEl.addEventListener('mouseenter', onContainerEnter);
    containerEl.addEventListener('mouseleave', onContainerLeave);

    // Re-draw crosshair after live data updates or other redraws.
    try {
      Highcharts.addEvent(chart, 'redraw', onRedraw);
    } catch {
      // ignore
    }

    return () => {
      try {
        chartEl.removeEventListener('mousemove', onMove);
        containerEl.removeEventListener('mouseenter', onContainerEnter);
        containerEl.removeEventListener('mouseleave', onContainerLeave);

        try {
          Highcharts.removeEvent(chart, 'redraw', onRedraw);
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
    };
  }, []);

  const options = useMemo(() => {
    return {
      chart: {
        backgroundColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [
            [0, '#1b2031'],
            [1, '#151a28'],
          ],
        },
        // Give the bottom time axis a bit more room.
        spacing: [0, 0, 14, 0],
        // Stock charts typically pan by dragging. Enable explicit panning to avoid
        // feeling "stuck" when the chart is live-updating.
        panning: {
          enabled: true,
          type: 'x',
        },
        zooming: {
          mouseWheel: {
            // Disable wheel zoom so "zoom out" doesn't change the chart/padding.
            enabled: false,
          },
        },
      },
      time: {
        useUTC: true,
      },
      credits: {
        enabled: false,
      },
      exporting: {
        enabled: false,
      },
      rangeSelector: {
        enabled: false,
      },
      navigator: {
        enabled: false,
      },
      scrollbar: {
        enabled: false,
      },
      title: {
        text: '',
      },
      xAxis: {
        type: 'datetime',
        gridLineWidth: 1,
        gridLineColor: QX_GRID,
        // Remove the baseline line above the time labels (QX-like).
        lineWidth: 0,
        tickWidth: 0,
        tickLength: 0,
        minorGridLineWidth: 0,
        minorTickLength: 0,
        crosshair: {
          color: 'rgba(255,255,255,0.25)',
          width: 1,
          dashStyle: 'Dash',
          snap: false,
          label: {
            enabled: true,
            // Use a plain rectangle shape (no callout pointer/triangle).
            shape: 'rect',
            // Show only time, styled like the blue last-price pill.
            formatter: function (value) {
              const v = Number(value);
              if (!Number.isFinite(v)) return '';
              return Highcharts.dateFormat('%H:%M', v);
            },
            backgroundColor: QX_PILL_BG,
            borderColor: QX_PILL_BORDER,
            borderRadius: 8,
            padding: 6,
            style: {
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: '700',
              textOutline: 'none',
            },
            y: 8,
          },
        },
        // Initial right-side space (kept in sync imperatively too).
        overscroll: rightSpaceMs(tfToSec(timeframe)),
        events: {
          // Disable auto-follow when user pans/zooms away from the right edge.
          setExtremes: function (e) {
            if (!e || e.trigger === 'autoFollow') return;
            const d = derivedRef.current;
            if (!d || typeof d.last !== 'number' || typeof d.futureMs !== 'number') return;
            if (typeof e.max !== 'number') return;

            const desiredMax = d.last + d.futureMs;
            const snapThreshold = desiredMax - d.tfSec * 5 * 1000;
            setAutoFollow(e.max >= snapThreshold);
          },
        },
        labels: {
          formatter: function () {
            const tf = (timeframe || 'M1').toString().toUpperCase();
            const v = Number(this.value);
            if (!Number.isFinite(v)) return '';

            // Keep daily labels readable; otherwise force 24h time.
            if (tf === 'D1') return Highcharts.dateFormat('%e %b', v);
            return Highcharts.dateFormat('%H:%M', v);
          },
          style: {
            color: '#a0a8b8',
            fontSize: '11px',
          },
        },
      },
      yAxis: {
        gridLineColor: QX_GRID,
        // Reduce horizontal grid density (roughly removes every other line).
        tickPixelInterval: 140,
        minorGridLineWidth: 0,
        minorTickLength: 0,
        crosshair: {
          color: 'rgba(255,255,255,0.12)',
          width: 1,
          dashStyle: 'Dash',
          snap: false,
        },
        labels: {
          align: 'right',
          x: -18,
          y: -8,
          style: {
            color: '#a0a8b8',
            fontSize: '11px',
          },
        },
        title: {
          text: '',
        },
      },
      tooltip: {
        enabled: false,
        backgroundColor: 'rgba(28, 32, 46, 0.98)',
        borderColor: 'rgba(255,255,255,0.10)',
        style: {
          color: '#ffffff',
        },
      },
      plotOptions: {
        candlestick: {
          color: '#ff4757',
          upColor: '#00d4aa',
          lineColor: '#ff4757',
          upLineColor: '#00d4aa',
          pointPadding: 0.08,
          groupPadding: 0.10,
        },
        series: {
          animation: {
            duration: 300,
          },
          dataGrouping: {
            enabled: false,
          },
        },
      },
      series: [
        {
          id: 'price-series',
          type: 'candlestick',
          name: 'Price',
          data: [],
          // Encourage QX-like spacing for timeframes.
          pointRange: tfToSec(timeframe) * 1000,
        },
      ],
    };
  }, [timeframe]);

  const rightControl = useMemo(() => {
    if (!isPointerInside) return null;
    const chart = chartComponentRef.current?.chart;
    const yAxis = chart?.yAxis?.[0];
    const base = Number.isFinite(animatedLastClose) ? animatedLastClose : derived.lastClose;
    const v = Number.isFinite(hoverPrice) ? hoverPrice : base;
    if (!yAxis?.toPixels || typeof v !== 'number' || !Number.isFinite(v)) return null;

    let topPx;
    try {
      const plotPx = yAxis.toPixels(v, true);
      topPx = (chart?.plotTop || 0) + plotPx;
    } catch {
      return null;
    }

    const label = formatLastPriceLabel(v);
    if (!label) return null;

    const onBellClick = () => {
      setPriceMarks((prev) => {
        const next = Array.isArray(prev) ? [...prev] : [];
        // Avoid stacking near-duplicates.
        const eps = Math.max(1e-9, Math.abs(v) * 1e-9);
        if (next.some((x) => typeof x === 'number' && Math.abs(x - v) <= eps)) return next;
        next.push(v);
        return next;
      });
    };

    return {
      topPx,
      label,
      onBellClick,
    };
  }, [animatedLastClose, hoverPrice, derived.lastClose, isPointerInside]);

  const zoomIn = () => {
    setAutoFollow(true);
    setVisibleBars((prev) => {
      const current = Number.isFinite(prev) ? prev : DEFAULT_VISIBLE_BARS;
      if (current <= MIN_VISIBLE_BARS) return MIN_VISIBLE_BARS;
      const next = Math.max(MIN_VISIBLE_BARS, Math.round(current * 0.8));
      return Math.min(MAX_VISIBLE_BARS, Math.max(MIN_VISIBLE_BARS, next));
    });
  };

  const zoomOut = () => {
    setAutoFollow(true);
    setVisibleBars((prev) => {
      const current = Number.isFinite(prev) ? prev : DEFAULT_VISIBLE_BARS;
      const next = Math.min(MAX_VISIBLE_BARS, Math.round(current * 1.25));
      return Math.min(MAX_VISIBLE_BARS, Math.max(MIN_VISIBLE_BARS, next));
    });
  };

  const canZoomIn = visibleBars > MIN_VISIBLE_BARS;
  const canZoomOut = visibleBars < MAX_VISIBLE_BARS;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          pointerEvents: 'auto',
        }}
      >
        <button
          type="button"
          onClick={canZoomIn ? zoomIn : undefined}
          onMouseDown={(e) => e.preventDefault()}
          title="Zoom in"
          disabled={!canZoomIn}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            border: `1px solid ${QX_PILL_BORDER}`,
            background: QX_PILL_BG,
            color: '#ffffff',
            cursor: canZoomIn ? 'pointer' : 'not-allowed',
            opacity: canZoomIn ? 1 : 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            lineHeight: 1,
            outline: 'none',
            boxShadow: 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          +
        </button>

        <button
          type="button"
          onClick={zoomOut}
          onMouseDown={(e) => e.preventDefault()}
          title="Zoom out"
          disabled={!canZoomOut}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            border: `1px solid ${QX_PILL_BORDER}`,
            background: QX_PILL_BG,
            color: '#ffffff',
            cursor: canZoomOut ? 'pointer' : 'not-allowed',
            opacity: canZoomOut ? 1 : 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            lineHeight: 1,
            outline: 'none',
            boxShadow: 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          −
        </button>
      </div>

      {rightControl && (
        <div
          style={{
            position: 'absolute',
            right: '0px',
            top: `${rightControl.topPx}px`,
            transform: 'translateY(-50%)',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            pointerEvents: 'auto',
          }}
        >
          <button
            type="button"
            onClick={rightControl.onBellClick}
            onMouseDown={(e) => e.preventDefault()}
            title="Price mark"
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '8px',
              border: `1px solid ${QX_PILL_BORDER}`,
              background: QX_PILL_BG,
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              lineHeight: 1,
              outline: 'none',
              boxShadow: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <i className="fas fa-bell" />
          </button>

          <div
            style={{
              display: 'inline-block',
              padding: '3px 8px',
              borderRadius: '8px',
              background: QX_PILL_BG,
              border: `1px solid ${QX_PILL_BORDER}`,
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '11px',
              userSelect: 'none',
            }}
          >
            {rightControl.label}
          </div>
        </div>
      )}

      <HighchartsReact
        ref={chartComponentRef}
        highcharts={Highcharts}
        constructorType="stockChart"
        options={options}
        containerProps={{ style: { width: '100%', height: '100%' } }}
        // Prevent live React renders from calling chart.update (which can clear series data).
        allowChartUpdate={false}
      />
    </div>
  );
}
