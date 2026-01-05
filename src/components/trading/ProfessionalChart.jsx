import { useEffect, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { createChart } from "lightweight-charts";
import { marketStore } from "./marketStore";
import { TrendingUp, TrendingDown, Activity, Target } from "lucide-react";

export default function ProfessionalChart({ symbol, onPriceUpdate, positions = [] }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const wsRef = useRef(null);
  const priceLineRef = useRef(null);
  const [lastPrice, setLastPrice] = useState(0);
  const [priceDirection, setPriceDirection] = useState(null);
  const [stats, setStats] = useState({ high: 0, low: 0, volume: 0, change: 0 });
  const positionLinesRef = useRef([]);
  const fibLinesRef = useRef([]);
  const [showFib, setShowFib] = useState(false);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "#0d0d1a" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.05)" },
        horzLines: { color: "rgba(148, 163, 184, 0.05)" },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "#3b82f6",
          width: 1,
          style: 3,
          labelBackgroundColor: "#3b82f6",
        },
        horzLine: {
          color: "#3b82f6",
          width: 1,
          style: 3,
          labelBackgroundColor: "#3b82f6",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.1)",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    // Volume series
    const volumeSeries = chart.addHistogramSeries({
      color: "#3b82f6",
      priceFormat: { type: "volume" },
      priceScaleId: "",
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (wsRef.current) {
        wsRef.current.close();
      }
      chart.remove();
    };
  }, []);

  // Fetch historical data
  useEffect(() => {
    if (!symbol || !candleSeriesRef.current) return;

    const fetchKlines = async () => {
      try {
        const cleanSymbol = symbol.replace("/", "-");
        const response = await fetch(
          `https://open-api.bingx.com/openApi/swap/v2/quote/klines?symbol=${cleanSymbol}&interval=15m&limit=500`
        );
        const data = await response.json();

        if (data.code === 0 && data.data) {
          const candles = data.data.map((k) => ({
            time: Math.floor(k.time / 1000),
            open: parseFloat(k.open),
            high: parseFloat(k.high),
            low: parseFloat(k.low),
            close: parseFloat(k.close),
          }));

          const volumes = data.data.map((k) => ({
            time: Math.floor(k.time / 1000),
            value: parseFloat(k.volume),
            color: parseFloat(k.close) >= parseFloat(k.open) ? "rgba(16, 185, 129, 0.5)" : "rgba(239, 68, 68, 0.5)",
          }));

          candleSeriesRef.current.setData(candles);
          volumeSeriesRef.current.setData(volumes);

          if (candles.length > 0) {
            const lastCandle = candles[candles.length - 1];
            setLastPrice(lastCandle.close);
            onPriceUpdate?.(lastCandle.close);

            // Calculate stats
            const high = Math.max(...candles.slice(-24).map(c => c.high));
            const low = Math.min(...candles.slice(-24).map(c => c.low));
            const totalVolume = volumes.slice(-24).reduce((sum, v) => sum + v.value, 0);
            const priceChange = ((lastCandle.close - candles[candles.length - 24].close) / candles[candles.length - 24].close) * 100;
            
            setStats({ high, low, volume: totalVolume, change: priceChange });
          }

          chartRef.current?.timeScale().fitContent();
        }
      } catch (error) {
        console.error("Failed to fetch klines:", error);
      }
    };

    fetchKlines();
  }, [symbol, onPriceUpdate]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!symbol || !candleSeriesRef.current) return;

    const cleanSymbol = symbol.replace("/", "-");
    const ws = new WebSocket("wss://open-api-swap.bingx.com/swap-market");

    ws.onopen = () => {
      console.log("✅ WebSocket connected to BingX");
      ws.send(
        JSON.stringify({
          id: Date.now(),
          dataType: `${cleanSymbol}@trade`,
        })
      );
      ws.send(
        JSON.stringify({
          id: Date.now() + 1,
          dataType: `${cleanSymbol}@kline_15m`,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Handle trade updates
        if (message.dataType?.includes("@trade")) {
          const price = parseFloat(message.data?.p || message.data?.price);
          if (price && price > 0) {
            setLastPrice((prev) => {
              setPriceDirection(price > prev ? "up" : price < prev ? "down" : null);
              return price;
            });
            onPriceUpdate?.(price);
            marketStore.updatePrice(cleanSymbol, price);

            // Update current price line
            if (priceLineRef.current) {
              candleSeriesRef.current.removePriceLine(priceLineRef.current);
            }
            priceLineRef.current = candleSeriesRef.current.createPriceLine({
              price: price,
              color: "#3b82f6",
              lineWidth: 2,
              lineStyle: 2,
              axisLabelVisible: true,
              title: "Current",
            });
          }
        }

        // Handle kline updates
        if (message.dataType?.includes("@kline")) {
          const k = message.data?.k || message.data;
          if (k) {
            const candle = {
              time: Math.floor(k.t / 1000),
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
            };
            candleSeriesRef.current.update(candle);

            const volume = {
              time: Math.floor(k.t / 1000),
              value: parseFloat(k.v),
              color: candle.close >= candle.open ? "rgba(16, 185, 129, 0.5)" : "rgba(239, 68, 68, 0.5)",
            };
            volumeSeriesRef.current.update(volume);
          }
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    };

    ws.onerror = (error) => console.error("WebSocket error:", error);
    ws.onclose = () => console.log("WebSocket disconnected");

    wsRef.current = ws;

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [symbol, onPriceUpdate]);

  // Draw positions on chart
  useEffect(() => {
    if (!candleSeriesRef.current || !positions) return;

    // Clear old lines
    positionLinesRef.current.forEach(line => {
      try {
        candleSeriesRef.current.removePriceLine(line);
      } catch (e) {}
    });
    positionLinesRef.current = [];

    positions.forEach(pos => {
      if (pos.status === "open" && pos.symbol === symbol) {
        // Entry line
        const entryLine = candleSeriesRef.current.createPriceLine({
          price: parseFloat(pos.entry_price),
          color: pos.side === "BUY" ? "#10b981" : "#ef4444",
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: `${pos.side} ${pos.quantity}`,
        });
        positionLinesRef.current.push(entryLine);

        // TP line
        if (pos.take_profit) {
          const tpLine = candleSeriesRef.current.createPriceLine({
            price: parseFloat(pos.take_profit),
            color: "#10b981",
            lineWidth: 1,
            lineStyle: 3,
            axisLabelVisible: true,
            title: "TP",
          });
          positionLinesRef.current.push(tpLine);
        }

        // SL line
        if (pos.stop_loss) {
          const slLine = candleSeriesRef.current.createPriceLine({
            price: parseFloat(pos.stop_loss),
            color: "#ef4444",
            lineWidth: 1,
            lineStyle: 3,
            axisLabelVisible: true,
            title: "SL",
          });
          positionLinesRef.current.push(slLine);
        }
      }
    });
  }, [positions, symbol]);

  // Fibonacci tool
  const drawFibonacci = useCallback(() => {
    if (!candleSeriesRef.current) return;

    // Clear existing fib lines
    fibLinesRef.current.forEach(line => {
      try {
        candleSeriesRef.current.removePriceLine(line);
      } catch (e) {}
    });
    fibLinesRef.current = [];

    if (!showFib) return;

    // Use recent high/low for fib
    const high = stats.high;
    const low = stats.low;
    const diff = high - low;

    const levels = [
      { ratio: 0, color: "#64748b", label: "0%" },
      { ratio: 0.236, color: "#f59e0b", label: "23.6%" },
      { ratio: 0.382, color: "#eab308", label: "38.2%" },
      { ratio: 0.5, color: "#3b82f6", label: "50%" },
      { ratio: 0.618, color: "#8b5cf6", label: "61.8%" },
      { ratio: 0.786, color: "#ec4899", label: "78.6%" },
      { ratio: 1, color: "#64748b", label: "100%" },
    ];

    levels.forEach(level => {
      const price = high - (diff * level.ratio);
      const line = candleSeriesRef.current.createPriceLine({
        price: price,
        color: level.color,
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: level.label,
      });
      fibLinesRef.current.push(line);
    });
  }, [showFib, stats]);

  useEffect(() => {
    drawFibonacci();
  }, [drawFibonacci]);

  return (
    <div className="relative w-full h-full bg-[#0d0d1a]">
      {/* Top Stats Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-[#0d0d1a] to-transparent px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-400">24h High:</span>
            <span className="text-sm font-bold text-emerald-400">${stats.high.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-400" />
            <span className="text-xs text-slate-400">24h Low:</span>
            <span className="text-sm font-bold text-rose-400">${stats.low.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-slate-400">Volume:</span>
            <span className="text-sm font-bold text-purple-400">{stats.volume.toFixed(0)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFib(!showFib)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              showFib
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "bg-slate-800/50 text-slate-400 hover:bg-slate-700/50"
            }`}
          >
            Fibonacci
          </button>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            stats.change >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"
          }`}>
            {stats.change >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-400" />
            )}
            <span className={`text-sm font-bold ${
              stats.change >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}>
              {stats.change >= 0 ? "+" : ""}{stats.change.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Price Indicator */}
      <div className="absolute top-16 left-4 z-10">
        <div className={`px-4 py-2 rounded-lg backdrop-blur-md transition-all ${
          priceDirection === "up"
            ? "bg-emerald-500/20 border border-emerald-500/30"
            : priceDirection === "down"
            ? "bg-rose-500/20 border border-rose-500/30"
            : "bg-slate-800/60 border border-slate-700/30"
        }`}>
          <div className="text-xs text-slate-400 mb-0.5">Last Price</div>
          <div className={`text-2xl font-bold font-mono ${
            priceDirection === "up"
              ? "text-emerald-400"
              : priceDirection === "down"
              ? "text-rose-400"
              : "text-white"
          }`}>
            ${lastPrice.toLocaleString(undefined, {
              minimumFractionDigits: lastPrice < 1 ? 6 : 2,
              maximumFractionDigits: lastPrice < 1 ? 6 : 2,
            })}
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full h-full" />

      {/* Position Summary Overlay */}
      {positions.filter(p => p.status === "open" && p.symbol === symbol).length > 0 && (
        <div className="absolute bottom-4 right-4 z-10 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/50 p-4 min-w-[280px]">
          <div className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
            Open Positions
          </div>
          {positions
            .filter(p => p.status === "open" && p.symbol === symbol)
            .map((pos, idx) => {
              const pnl = pos.side === "BUY"
                ? (lastPrice - parseFloat(pos.entry_price)) * parseFloat(pos.quantity)
                : (parseFloat(pos.entry_price) - lastPrice) * parseFloat(pos.quantity);
              const pnlPercent = (pnl / (parseFloat(pos.entry_price) * parseFloat(pos.quantity))) * 100;

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg mb-2 ${
                    pos.side === "BUY" ? "bg-emerald-500/10" : "bg-rose-500/10"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      pos.side === "BUY"
                        ? "bg-emerald-500 text-white"
                        : "bg-rose-500 text-white"
                    }`}>
                      {pos.side}
                    </span>
                    <span className="text-xs text-slate-400">
                      {pos.quantity} @ ${parseFloat(pos.entry_price).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">PnL:</span>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        ${pnl.toFixed(2)}
                      </div>
                      <div className={`text-xs ${pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {pnl >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

ProfessionalChart.propTypes = {
  symbol: PropTypes.string.isRequired,
  onPriceUpdate: PropTypes.func,
  positions: PropTypes.array,
};