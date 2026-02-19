"use client";

import { useEffect, useRef } from "react";
import { createChart, type IChartApi, type ISeriesApi, ColorType, CrosshairMode } from "lightweight-charts";
import type { CandleData } from "@/lib/types";

interface TradingChartProps {
  candles: CandleData[];
  loading?: boolean;
}

export function TradingChart({ candles, loading }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "hsl(220, 18%, 7%)" },
        textColor: "hsl(220, 10%, 55%)",
        fontFamily: "var(--font-geist-sans), sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "hsl(220, 14%, 12%)" },
        horzLines: { color: "hsl(220, 14%, 12%)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "hsl(220, 14%, 25%)", width: 1, style: 2 },
        horzLine: { color: "hsl(220, 14%, 25%)", width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: "hsl(220, 14%, 16%)",
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: "hsl(220, 14%, 16%)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "hsl(142, 70%, 45%)",
      downColor: "hsl(0, 72%, 51%)",
      borderDownColor: "hsl(0, 72%, 51%)",
      borderUpColor: "hsl(142, 70%, 45%)",
      wickDownColor: "hsl(0, 72%, 45%)",
      wickUpColor: "hsl(142, 70%, 40%)",
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    seriesRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, []);

  // Update data
  useEffect(() => {
    if (!seriesRef.current || !volumeRef.current || candles.length === 0) return;

    const candleData = candles.map((c) => ({
      time: c.time as import("lightweight-charts").UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumeData = candles.map((c) => ({
      time: c.time as import("lightweight-charts").UTCTimestamp,
      value: c.volume,
      color:
        c.close >= c.open
          ? "rgba(38, 166, 91, 0.3)"
          : "rgba(239, 68, 68, 0.3)",
    }));

    seriesRef.current.setData(candleData);
    volumeRef.current.setData(volumeData);
  }, [candles]);

  return (
    <div className="relative h-full w-full" ref={containerRef}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  );
}
