import { useEffect, useMemo, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { fetchGeckoOhlcv } from '@/lib/market/geckoterminal';

const TIMEFRAMES = [
  { label: '1m', timeframe: 'minute', aggregate: 1 },
  { label: '5m', timeframe: 'minute', aggregate: 5 },
  { label: '15m', timeframe: 'minute', aggregate: 15 },
  { label: '1h', timeframe: 'hour', aggregate: 1 },
  { label: '4h', timeframe: 'hour', aggregate: 4 },
  { label: '1d', timeframe: 'day', aggregate: 1 },
];

const parseOhlcv = (rows) =>
  rows
    .map(([time, open, high, low, close, volume]) => {
      const timestamp = time > 1e12 ? Math.floor(time / 1000) : time;
      return {
        time: timestamp,
        open,
        high,
        low,
        close,
        volume,
      };
    })
    .filter((row) => Number.isFinite(row.time));

const getSeriesColors = (isDark) => ({
  upColor: isDark ? '#16a34a' : '#10b981',
  downColor: isDark ? '#f97316' : '#ef4444',
  wickUpColor: isDark ? '#22c55e' : '#10b981',
  wickDownColor: isDark ? '#fb7185' : '#ef4444',
});

const getChartTheme = (isDark) => ({
  layout: {
    background: { color: 'transparent' },
    textColor: isDark ? '#e5e7eb' : '#1f2937',
    fontSize: 12,
  },
  grid: {
    vertLines: { color: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(148,163,184,0.2)' },
    horzLines: { color: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(148,163,184,0.2)' },
  },
  timeScale: {
    timeVisible: true,
    secondsVisible: false,
    borderVisible: false,
  },
  rightPriceScale: {
    borderVisible: false,
  },
  crosshair: {
    mode: 1,
  },
});

/**
 * @param {{ poolAddress?: string, fallbackUrl?: string, t: any, isRtl: boolean }} props
 */
export default function MemeChart({ poolAddress, fallbackUrl, t, isRtl }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[0]);
  const [dataState, setDataState] = useState({ status: 'idle', data: null });

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const chartOptions = useMemo(() => getChartTheme(isDark), [isDark]);
  const seriesColors = useMemo(() => getSeriesColors(isDark), [isDark]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const chart = createChart(containerRef.current, {
      ...chartOptions,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });
    const candleSeries = chart.addCandlestickSeries(seriesColors);
    const volumeSeries = chart.addHistogramSeries({
      color: 'rgba(148,163,184,0.4)',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current) return;
      chart.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [chartOptions, seriesColors]);

  useEffect(() => {
    if (!poolAddress) {
      setDataState({ status: 'empty', data: null });
      return;
    }
    let mounted = true;
    setDataState((prev) => (prev.data ? { ...prev, status: 'stale' } : { status: 'loading', data: null }));

    fetchGeckoOhlcv({
      poolAddress,
      timeframe: timeframe.timeframe,
      aggregate: timeframe.aggregate,
      limit: 180,
      onUpdate: (fresh) => {
        if (!mounted) return;
        const parsed = parseOhlcv(fresh?.data?.attributes?.ohlcv_list ?? []);
        setDataState({ status: 'ready', data: parsed });
      },
    })
      .then((result) => {
        if (!mounted) return;
        const parsed = parseOhlcv(result?.data?.attributes?.ohlcv_list ?? []);
        setDataState(parsed.length ? { status: 'ready', data: parsed } : { status: 'empty', data: null });
      })
      .catch(() => {
        if (!mounted) return;
        setDataState({ status: 'error', data: null });
      });

    return () => {
      mounted = false;
    };
  }, [poolAddress, timeframe]);

  useEffect(() => {
    if (!dataState.data || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    const candles = dataState.data.map((row) => ({
      time: row.time,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    }));
    const volumes = dataState.data.map((row) => ({
      time: row.time,
      value: row.volume,
      color: row.close >= row.open ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)',
    }));
    candleSeriesRef.current.setData(candles);
    volumeSeriesRef.current.setData(volumes);
    chartRef.current?.timeScale().fitContent();
  }, [dataState]);

  if (dataState.status === 'error' && fallbackUrl) {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/50 bg-background">
        <div className="border-b border-border/50 px-3 py-2 text-xs text-muted-foreground">
          {t.chartFallback}
        </div>
        <iframe
          title={t.chartTitle}
          className="h-full w-full border-0"
          src={fallbackUrl}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/50 bg-background">
      <div className={cn('flex flex-wrap items-center gap-2 border-b border-border/50 px-3 py-2', isRtl && 'flex-row-reverse')}>
        <span className="text-xs text-muted-foreground">{t.timeframeLabel}</span>
        {TIMEFRAMES.map((item) => (
          <Tooltip key={item.label}>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={timeframe.label === item.label ? 'default' : 'outline'}
                className="h-7 px-2 text-xs"
                onClick={() => setTimeframe(item)}
                title={t.timeframeHelp.replace('{timeframe}', item.label)}
                aria-label={t.timeframeHelp.replace('{timeframe}', item.label)}
              >
                {item.label}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.timeframeHelp.replace('{timeframe}', item.label)}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="relative flex-1 min-h-0">
        {dataState.status === 'loading' ? (
          <Skeleton className="h-full w-full" />
        ) : null}
        {dataState.status === 'empty' ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t.chartUnavailable}
          </div>
        ) : null}
        <div className={cn('h-full w-full', dataState.status === 'loading' || dataState.status === 'empty' ? 'invisible' : 'visible')}>
          <div ref={containerRef} className="h-full w-full" />
        </div>
      </div>
    </div>
  );
}
