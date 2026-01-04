import React, { useEffect, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toDisplayFormat } from "@/components/utils/symbolFormat";

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

  const columns = [
    { key: 'opened_at', label: 'Opened', format: (v) => formatDateTime(v) },
    { key: 'closed_at', label: 'Closed', format: (v) => v ? formatDateTime(v) : '-' },
    { key: 'symbol', label: 'Symbol', format: (v) => toDisplayFormat(v) },
    { key: 'side', label: 'Side', format: (v) => <span className={v === 'LONG' ? 'text-emerald-500' : 'text-red-500'}>{v}</span> },
    { key: 'leverage', label: 'Lev', format: (v) => <span className="text-purple-400">{v}x</span> },
    { key: 'order_type', label: 'Type' },
    { key: 'quantity', label: 'Size' },
    { key: 'avg_entry_price', label: 'Entry', format: formatPrice },
    { key: 'avg_exit_price', label: 'Exit', format: formatPrice },
    { key: 'realized_pnl', label: 'P&L', format: formatPnL },
    { key: 'realized_pnl_percent', label: 'ROE%', format: (v) => {
      if (v === undefined || v === null) return '-';
      const n = Number(v);
      return <span className={n >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{n.toFixed(2)}%</span>;
    } },
    { key: 'fee_total', label: 'Fee', format: (v) => v === undefined || v === null ? '-' : <span className="text-yellow-500">-${Number(v).toFixed(4)}</span> },
    { key: 'close_reason', label: 'Close Reason', format: formatCloseReason },
    { key: 'status', label: 'Status' },
  ];

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
            onClick={() => { load(); onRefresh?.(); }}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-[#2B2B43]">
        {/* Open Positions */}
        <div className="p-3 overflow-auto max-h-48 md:max-h-none">
          <div className="text-xs text-slate-400 mb-2">Open Positions</div>
          {trades.filter((t) => t.status === "OPEN").map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] px-2 py-0.5 rounded ${t.side === "LONG" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                  {t.side}
                </span>
                <div className="text-sm font-mono">{toDisplayFormat(t.symbol)}</div>
              </div>
              <div className="text-right text-xs text-slate-300">
                <div>Entry: {formatPrice(t.entry_price)}</div>
                {t.take_profit && <div className="text-emerald-300">TP: {formatPrice(t.take_profit)}</div>}
                {t.stop_loss && <div className="text-rose-300">SL: {formatPrice(t.stop_loss)}</div>}
              </div>
            </div>
          ))}
          {trades.filter((t) => t.status === "OPEN").length === 0 && (
            <div className="text-xs text-slate-500">No open positions</div>
          )}
        </div>

        {/* Pending Orders */}
        <div className="p-3 overflow-auto max-h-48 md:max-h-none">
          <div className="text-xs text-slate-400 mb-2">Pending Orders</div>
          {trades.filter((t) => t.status === "PENDING").map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-500/20 text-slate-300">
                  {t.order_type}
                </span>
                <div className="text-sm font-mono">{toDisplayFormat(t.symbol)}</div>
              </div>
              <div className="text-right text-xs text-slate-300">
                {t.limit_price && <div>Limit: {formatPrice(t.limit_price)}</div>}
                {t.oco_stop_price && <div>Stop: {formatPrice(t.oco_stop_price)}</div>}
              </div>
            </div>
          ))}
          {trades.filter((t) => t.status === "PENDING").length === 0 && (
            <div className="text-xs text-slate-500">No pending orders</div>
          )}
        </div>
      </div>

      {/* Full Trade History Table */}
      <div className="p-3 overflow-auto">
        <div className="text-xs text-slate-400 mb-2">Trade History</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                {columns.map(col => (
                  <th key={col.key} className="px-2 py-2 text-left whitespace-nowrap">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map(trade => (
                <tr key={trade.id} className="border-b border-slate-800 hover:bg-slate-800/40">
                  {columns.map(col => (
                    <td key={col.key} className="px-2 py-2 whitespace-nowrap">
                      {col.format ? col.format(trade[col.key]) : (trade[col.key] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  function formatCloseReason(reason) {
    if (!reason) return '-';
    const map = {
      manual: { text: 'Manual Close', cls: 'text-blue-400' },
      take_profit: { text: 'TP Hit', cls: 'text-emerald-400' },
      stop_loss: { text: 'SL Hit', cls: 'text-rose-400' },
      liquidation: { text: 'Liquidated', cls: 'text-orange-400' },
      trailing_stop: { text: 'Trailing Stop', cls: 'text-cyan-400' },
      cancelled: { text: 'Cancelled', cls: 'text-slate-400' },
    };
    const cfg = map[reason] || { text: reason, cls: 'text-slate-300' };
    return <span className={cfg.cls}>{cfg.text}</span>;
  }
  function formatDateTime(date) {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-AE', { timeZone: 'Asia/Dubai', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function formatPrice(v) { if (v === undefined || v === null) return '-'; return `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 6 })}`; }
  function formatPnL(v) { if (v === undefined || v === null) return '-'; const n = Number(v); const cls = n >= 0 ? 'text-emerald-400' : 'text-rose-400'; return <span className={cls}>{n >= 0 ? '+' : ''}{n.toFixed(2)}</span>; }
}

TradingHistory.propTypes = {
  tradingAccountId: PropTypes.string,
  onRefresh: PropTypes.func,
  onPositionsUpdate: PropTypes.func,
  onOpenOrdersUpdate: PropTypes.func,
  refreshSignal: PropTypes.number,
};