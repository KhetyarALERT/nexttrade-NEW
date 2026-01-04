import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { marketStore } from "@/components/trading/marketStore";

export default function ProfessionalChart({ symbol, onPriceUpdate, positions = [] }) {
  const [price, setPrice] = useState(0);

  useEffect(() => {
    if (!symbol) return;
    // Subscribe to live data for the symbol
    marketStore.subscribeToSymbol(symbol);

    const unsubTicker = marketStore.subscribe(`ticker:${symbol}`, (ticker) => {
      const p = ticker?.price || 0;
      setPrice(p);
      if (onPriceUpdate) onPriceUpdate(p);
    });

    // Initialize with any cached ticker
    const t = marketStore.getAllTickers?.()[symbol];
    if (t?.price) {
      setPrice(t.price);
      if (onPriceUpdate) onPriceUpdate(t.price);
    }

    return () => {
      unsubTicker?.();
      marketStore.unsubscribeFromSymbol(symbol);
    };
  }, [symbol, onPriceUpdate]);

  return (
    <div className="w-full h-full bg-[#0f1220] text-white relative flex items-center justify-center">
      <div className="text-center">
        <div className="text-xs text-slate-400 tracking-wider">{symbol?.replace("-", "/")}</div>
        <div className="text-4xl sm:text-5xl font-mono font-bold">
          {price ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: price < 1 ? 6 : 2 })}` : "--"}
        </div>
        <div className="text-[11px] mt-1 text-slate-500">Live feed · simplified preview</div>
      </div>

      {/* Position markers placeholder to keep props-compatible */}
      {Array.isArray(positions) && positions.length > 0 && (
        <div className="absolute bottom-2 left-2 right-2 text-[10px] text-slate-500 truncate">
          {positions.length} open position{positions.length > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

ProfessionalChart.propTypes = {
  symbol: PropTypes.string,
  onPriceUpdate: PropTypes.func,
  positions: PropTypes.array,
};