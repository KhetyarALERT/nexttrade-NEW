import React, { useEffect, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function TradingHistory({
  tradingAccountId,
  onRefresh,
  onPositionsUpdate,
  onOpenOrdersUpdate,
  refreshSignal = 0,
}) {
  const [loading, setLoading] = useState(false);
  const [trades, setTrades] = useState([]);

  const load = useCallback(async () => {
    if (!tradingAccountId) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke("tradingAccount", {
        action: "getTrades",
        tradingAccountId,
        limit: 100,
      });
      const list = res.data?.data || [];
      setTrades(list);
      onPositionsUpdate?.(list.filter((t) => t.status === "OPEN"));
      onOpenOrdersUpdate?.(list.filter((t) => t.status === "PENDING"));
    } finally {
      setLoading(false);
    }
  }, [tradingAccountId, onPositionsUpdate, onOpenOrdersUpdate]);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  return (
    <div className="h-full w-full bg-[#131722] text-white">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2B2B43]">
        <div className="text-sm font-medium">Positions & Orders</div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-slate-600 text-slate-300">
            {trades.filter((t) => t.status === "OPEN").length} Open
          </Badge>
          <Badge variant="outline" className="border-slate-600 text-slate-300">
            {trades.filter((t) => t.status === "PENDING").length} Orders
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              load();
              onRefresh?.();
            }}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-[#2B2B43] h-[calc(100%-44px)]">
        {/* Open Positions */}
        <div className="p-3 overflow-auto">
          <div className="text-xs text-slate-400 mb-2">Open Positions</div>
          {trades.filter((t) => t.status === "OPEN").map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] px-2 py-0.5 rounded ${t.side === "LONG" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                  {t.side}
                </span>
                <div className="text-sm font-mono">{t.symbol}</div>
              </div>
              <div className="text-right text-xs text-slate-300">
                <div>Entry: ${Number(t.entry_price).toLocaleString()}</div>
                {t.take_profit && <div className="text-emerald-300">TP: ${Number(t.take_profit).toLocaleString()}</div>}
                {t.stop_loss && <div className="text-rose-300">SL: ${Number(t.stop_loss).toLocaleString()}</div>}
              </div>
            </div>
          ))}
          {trades.filter((t) => t.status === "OPEN").length === 0 && (
            <div className="text-xs text-slate-500">No open positions</div>
          )}
        </div>

        {/* Pending Orders */}
        <div className="p-3 overflow-auto">
          <div className="text-xs text-slate-400 mb-2">Pending Orders</div>
          {trades.filter((t) => t.status === "PENDING").map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-500/20 text-slate-300">
                  {t.order_type}
                </span>
                <div className="text-sm font-mono">{t.symbol}</div>
              </div>
              <div className="text-right text-xs text-slate-300">
                {t.limit_price && <div>Limit: ${Number(t.limit_price).toLocaleString()}</div>}
                {t.oco_stop_price && <div>Stop: ${Number(t.oco_stop_price).toLocaleString()}</div>}
              </div>
            </div>
          ))}
          {trades.filter((t) => t.status === "PENDING").length === 0 && (
            <div className="text-xs text-slate-500">No pending orders</div>
          )}
        </div>
      </div>
    </div>
  );
}

TradingHistory.propTypes = {
  tradingAccountId: PropTypes.string,
  onRefresh: PropTypes.func,
  onPositionsUpdate: PropTypes.func,
  onOpenOrdersUpdate: PropTypes.func,
  refreshSignal: PropTypes.number,
};