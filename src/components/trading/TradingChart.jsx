import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Maximize2, BarChart3 } from "lucide-react";

export default function TradingChart({ symbol = "BTC-USDT", type = "futures" }) {
  const [timeframe, setTimeframe] = useState("15m");
  const chartRef = useRef(null);

  useEffect(() => {
    // Placeholder for TradingView widget or custom chart
    // In production, integrate TradingView Lightweight Charts or similar
    console.log(`Chart initialized for ${symbol} on ${timeframe}`);
  }, [symbol, timeframe]);

  return (
    <Card className="h-[600px] border-0 rounded-none shadow-none bg-white overflow-hidden relative">
      {/* Chart Controls */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white/90 backdrop-blur p-1 rounded-lg border border-slate-200 shadow-sm">
        {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
          <Button
            key={tf}
            variant="ghost"
            size="sm"
            onClick={() => setTimeframe(tf)}
            className={`h-7 px-3 text-xs ${
              tf === timeframe ? 'bg-blue-100 text-blue-600 font-bold' : 'text-slate-600'
            }`}
          >
            {tf}
          </Button>
        ))}
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <Button variant="ghost" size="sm" className="h-7 px-3 text-xs text-slate-600">
          <BarChart3 className="h-3.5 w-3.5 mr-1" /> Indicators
        </Button>
      </div>

      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8 bg-white">
          <Settings className="h-4 w-4 text-slate-500" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 bg-white">
          <Maximize2 className="h-4 w-4 text-slate-500" />
        </Button>
      </div>

      {/* Chart Container */}
      <div ref={chartRef} className="w-full h-full bg-white">
        {/* Placeholder: Professional trading chart visualization */}
        <div className="w-full h-full flex items-center justify-center text-slate-400">
          <div className="text-center">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-sm font-medium">Live Chart Loading...</p>
            <p className="text-xs mt-1">BingX WebSocket Feed: {symbol}</p>
          </div>
        </div>

        {/* Candlestick placeholder visualization */}
        <div className="absolute inset-0 flex items-end px-4 pb-16 opacity-10 pointer-events-none">
          <div className="flex items-end gap-1 w-full h-64">
            {Array.from({length: 60}).map((_, i) => {
              const height = Math.random() * 100;
              const isGreen = Math.random() > 0.5;
              return (
                <div
                  key={i}
                  className={`w-full ${isGreen ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{height: `${height}%`}}
                />
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

TradingChart.propTypes = {
  symbol: PropTypes.string,
  type: PropTypes.oneOf(['spot', 'futures'])
};