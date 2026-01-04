import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { createChart, CrosshairMode } from "lightweight-charts";
import { base44 } from "@/api/base44Client";
import { marketStore } from "@/components/trading/marketStore";
import { toInternalFormat, toDisplayFormat } from "@/components/utils/symbolFormat";

// Map UI timeframe labels to BingX intervals
const TF_OPTIONS = ["1m", "5m", "15m", "30m", "1h", "1d"];

export default function ProfessionalChart({ symbol, onPriceUpdate, positions = [] }) {
  const [timeframe, setTimeframe] = useState("15m");
  const [lastPrice, setLastPrice] = useState(0);

  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const priceLinesRef = useRef([]);

  // Init chart once
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

  // Load data + live subscriptions when symbol or timeframe changes
  useEffect(() => {
    const s = toInternalFormat(symbol);
    if (!s || !seriesRef.current) return;

    // Subscribe WS
    marketStore.subscribeToSymbol(s);
    marketStore.subscribeToCandles(s, timeframe);

    const candleKey = `${s}_${timeframe}`;

    const unsubCandle = marketStore.subscribe(`candle:${candleKey}`, (candle) => {
      if (!candle || !seriesRef.current) return;
      seriesRef.current.update({
        time: candle.time,
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close),
      });
      if (candle.close) {
        setLastPrice(candle.close);
        onPriceUpdate?.(candle.close);
      }
    });

    const unsubTicker = marketStore.subscribe(`ticker:${s}`, ({ ticker }) => {
      const p = (ticker?.mark ?? ticker?.price) || 0;
      if (p > 0) {
        setLastPrice(p);
        onPriceUpdate?.(p);
      }
    });

    // Seed from store if already present
    const t = marketStore.getAllTickers?.()[s];
    if (t?.price) {
      setLastPrice(t.price);
      onPriceUpdate?.(t.price);
    }

    // Load historical klines
    (async () => {
      try {
        const res = await base44.functions.invoke("bingxMarketData", {
          action: "getKlines",
          params: { symbol: s, interval: timeframe, limit: 500 },
        });
        const candles = res.data?.data || [];
        if (Array.isArray(candles) && seriesRef.current) {
          seriesRef.current.setData(
            candles.map((c) => ({
              time: c.time,
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close),
            }))
          );
          marketStore.setCandles?.(s, timeframe, candles);
          const last = candles[candles.length - 1];
          if (last?.close) {
            setLastPrice(last.close);
            onPriceUpdate?.(last.close);
          }
        }
      } catch (e) {
        // silent
      }
    })();

    return () => {
      try { unsubCandle?.(); } catch {}
      try { unsubTicker?.(); } catch {}
      try { marketStore.unsubscribeFromSymbol(s); } catch {}
      try { marketStore.unsubscribeWS?.(`kline_${timeframe}.${s}`); } catch {}
    };
  }, [symbol, timeframe, onPriceUpdate]);

  // Optional: draw position lines for current symbol
  useEffect(() => {
    if (!seriesRef.current) return;
    priceLinesRef.current.forEach((l) => {
      try { seriesRef.current.removePriceLine(l); } catch {}
    });
    priceLinesRef.current = [];

    const s = toInternalFormat(symbol);
    (positions || [])
      .filter((p) => toInternalFormat(p.symbol) === s)
      .forEach((p) => {
        if (p.entry_price) {
          const line = seriesRef.current.createPriceLine({
            price: Number(p.entry_price),
            color: p.side === "LONG" ? "#3b82f6" : "#ef4444",
            lineWidth: 2,
            lineStyle: 0,
            title: `Entry ${p.side}`,
          });
          priceLinesRef.current.push(line);
        }
        if (p.take_profit) {
          const line = seriesRef.current.createPriceLine({
            price: Number(p.take_profit),
            color: "#22c55e",
            lineWidth: 1,
            lineStyle: 2,
            title: "TP",
          });
          priceLinesRef.current.push(line);
        }
        if (p.stop_loss) {
          const line = seriesRef.current.createPriceLine({
            price: Number(p.stop_loss),
            color: "#ef4444",
            lineWidth: 1,
            lineStyle: 2,
            title: "SL",
          });
          priceLinesRef.current.push(line);
        }
        if (p.liquidation_price) {
          const line = seriesRef.current.createPriceLine({
            price: Number(p.liquidation_price),
            color: "#f59e0b",
            lineWidth: 1,
            lineStyle: 1,
            title: "LIQ",
          });
          priceLinesRef.current.push(line);
        }
      });
  }, [positions, symbol]);

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
  positions: PropTypes.array,
};