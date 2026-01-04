import { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { createChart, CrosshairMode } from "lightweight-charts";
import { base44 } from "@/api/base44Client";
import { marketStore } from "@/components/trading/marketStore";

export default function ProfessionalChart({ symbol = "BTC-USDT", onPriceUpdate, positions = [] }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const priceLinesRef = useRef([]);

  // Init chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { color: "#131722" }, textColor: "#D1D5DB" },
      grid: { vertLines: { color: "#1F2937" }, horzLines: { color: "#1F2937" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#26A69A",
      downColor: "#EF5350",
      wickUpColor: "#26A69A",
      wickDownColor: "#EF5350",
      borderUpColor: "#26A69A",
      borderDownColor: "#EF5350",
    });

    chartRef.current = chart;
    candleSeriesRef.current = series;

    const handleResize = () => chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      // Cleanup price lines
      priceLinesRef.current.forEach((line) => { try { candleSeriesRef.current?.removePriceLine(line); } catch (_) {} });
      priceLinesRef.current = [];
      candleSeriesRef.current = null;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, []);

  // Load candles when symbol changes
  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const res = await base44.functions.invoke("bingxMarketData", { action: "getKlines", params: { symbol, interval: "15m", limit: 200 } });
        const data = res.data?.data || [];
        if (!isActive || !candleSeriesRef.current) return;
        candleSeriesRef.current.setData(data);
      } catch (_) {}
    };
    load();
    return () => { isActive = false; };
  }, [symbol]);

  // Subscribe to ticker for live last price + callback
  useEffect(() => {
    const onTick = ({ symbol: s, ticker }) => {
      if (s !== symbol || !ticker?.price || !candleSeriesRef.current) return;
      const time = Math.floor(Date.now() / 1000);
      const price = parseFloat(ticker.price);
      // Update last bar visually using close price
      candleSeriesRef.current.update({ time, open: price, high: price, low: price, close: price });
      if (onPriceUpdate) onPriceUpdate(price);
    };
    const unsub = marketStore.subscribe("ticker", onTick);
    marketStore.subscribeToTicker(symbol);
    const t = marketStore.tickers?.[symbol];
    if (t?.price && onPriceUpdate) onPriceUpdate(t.price);
    return () => {
      unsub();
      marketStore.unsubscribeFromSymbol(symbol);
    };
  }, [symbol, onPriceUpdate]);

  // Draw position lines
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    // Clear existing
    priceLinesRef.current.forEach((line) => { try { candleSeriesRef.current?.removePriceLine(line); } catch (_) {} });
    priceLinesRef.current = [];

    positions.filter((p) => p.symbol === symbol).forEach((pos) => {
      if (pos.entry_price) {
        const entry = candleSeriesRef.current.createPriceLine({ price: pos.entry_price, color: "#ffffff", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `Entry ${pos.side}` });
        priceLinesRef.current.push(entry);
      }
      if (pos.take_profit) {
        const tp = candleSeriesRef.current.createPriceLine({ price: pos.take_profit, color: "#26A69A", lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: "TP" });
        priceLinesRef.current.push(tp);
      }
      if (pos.stop_loss) {
        const sl = candleSeriesRef.current.createPriceLine({ price: pos.stop_loss, color: "#EF5350", lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: "SL" });
        priceLinesRef.current.push(sl);
      }
      if (pos.liquidation_price) {
        const liq = candleSeriesRef.current.createPriceLine({ price: pos.liquidation_price, color: "#F59E0B", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "LIQ" });
        priceLinesRef.current.push(liq);
      }
    });
  }, [positions, symbol]);

  return <div ref={containerRef} className="w-full h-full" />;
}

ProfessionalChart.propTypes = {
  symbol: PropTypes.string,
  onPriceUpdate: PropTypes.func,
  positions: PropTypes.array,
};