import React, { useEffect, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toDisplayFormat } from "@/components/utils/symbolFormat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RefreshCw, List, History, Clock } from "lucide-react";
import { marketStore } from "@/components/trading/marketStore";
import TPSLDialog from "@/components/trading/TPSLDialog";

export default function TradingHistory({
  tradingAccountId,
  onRefresh,
  onPositionsUpdate,
  onOpenOrdersUpdate,
  refreshSignal = 0,
}) {
  const [loading, setLoading] = useState(false);
  const [trades, setTrades] = useState([]);
  const [activeTab, setActiveTab] = useState("positions");
  const [prices, setPrices] = useState({});
  const [tpslOpen, setTpslOpen] = useState(false);
  const [selectedPos, setSelectedPos] = useState(null);

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

  // Live price subscription for Mark Price + PnL
  useEffect(() => {
    const unsub = marketStore.subscribe('ticker', ({ symbol, ticker }) => {
      setPrices(prev => ({ ...prev, [symbol]: (ticker.mark ?? ticker.price) || prev[symbol] }));
    });
    return () => unsub();
  }, []);

  // Subscribe tickers for all symbols in positions/orders so mark price updates
  useEffect(() => {
    const symbols = Array.from(new Set(trades.map(t => t.symbol)));
    symbols.forEach(s => marketStore.subscribeToTicker(s));
  }, [trades]);

  const columns = [
    { key: 'opened_at', label: 'Opened', format: (v) => formatDateTime(v) },
    { key: 'symbol', label: 'Symbol', format: (v) => toDisplayFormat(v) },
    { key: 'side', label: 'Side', format: (v) => <span className={v === 'LONG' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{v}</span> },
    { key: 'leverage', label: 'Lev', format: (v) => <span className="text-blue-400 font-medium">{v}x</span> },
    { key: 'quantity', label: 'Size', format: (v) => formatSize(v) },
    { key: 'entry_price', label: 'Entry', render: (row) => formatPrice(row.avg_entry_price ?? row.entry_price) },
    { key: 'exit_price', label: 'Exit', render: (row) => row.status === 'CLOSED' ? formatPrice(row.avg_exit_price ?? row.exit_price) : '-' },
    { key: 'realized_pnl', label: 'P&L', format: formatPnL },
    { key: 'realized_pnl_percent', label: 'ROE%', format: (v) => {
      if (v === undefined || v === null) return '-';
      const n = Number(v);
      return <span className={n >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{n.toFixed(2)}%</span>;
    } },
    { key: 'status', label: 'Status', format: (v) => <Badge variant="outline" className={`text-[10px] uppercase ${v === 'OPEN' ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/5' : 'border-slate-600 text-slate-400'}`}>{v}</Badge> },
  ];

  const openPositions = trades.filter((t) => t.status === "OPEN");
  const pendingOrders = trades.filter((t) => t.status === "PENDING");

  return (
    <div className="h-full flex flex-col bg-[#131722] text-slate-300">
      <div className="flex items-center justify-between px-4 h-10 border-b border-slate-800/50 shrink-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="bg-transparent h-full p-0 gap-6">
            <TabsTrigger value="positions" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:text-white text-xs font-semibold px-0 transition-all">
              Positions <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px]">{openPositions.length}</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:text-white text-xs font-semibold px-0 transition-all">
              Open Orders <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px]">{pendingOrders.length}</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:text-white text-xs font-semibold px-0 transition-all">
              Trade History
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { load(); onRefresh?.(); }}
            className="h-7 px-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-[11px]">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <Tabs value={activeTab} className="h-full">
          <TabsContent value="positions" className="h-full m-0 overflow-auto custom-scrollbar">
            {openPositions.length > 0 ? (
              <div className="p-0">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[#131722] z-10">
                    <tr className="text-[13px] uppercase tracking-wider text-slate-300 border-b border-slate-800/50">
                      <th className="px-4 py-2 font-semibold">Symbol</th>
                      <th className="px-4 py-2 font-semibold">Position Value</th>
                      <th className="px-4 py-2 font-semibold">Entry</th>
                      <th className="px-4 py-2 font-semibold">Breakeven</th>
                      <th className="px-4 py-2 font-semibold">Mark</th>
                      <th className="px-4 py-2 font-semibold">Unrealized PnL</th>
                      <th className="px-4 py-2 font-semibold">ROE%</th>
                      <th className="px-4 py-2 font-semibold">Risk</th>
                      <th className="px-4 py-2 font-semibold">Liq</th>
                      <th className="px-4 py-2 font-semibold">Margin</th>
                      <th className="px-4 py-2 font-semibold">TP/SL</th>
                      <th className="px-4 py-2 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30">
                    {openPositions.map((t) => {
                      const mark = prices[t.symbol] || t.entry_price || 0;
                      const value = mark * t.quantity;
                      const margin = (t.entry_price * t.quantity) / (t.leverage || 1);
                      const pnl = (t.side === 'LONG' ? (mark - t.entry_price) : (t.entry_price - mark)) * t.quantity;
                      const roe = margin ? (pnl / margin) * 100 : 0;
                      const breakeven = t.entry_price; // approximation without fees
                      const riskPct = (t.liquidation_price && mark) ? (Math.abs(mark - t.liquidation_price) / mark) * 100 : null;
                      return (
                        <tr key={t.id} className="hover:bg-slate-800/20 transition-colors group text-[13px]">
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="text-[15px] font-bold text-white">{toDisplayFormat(t.symbol)}</span>
                              <span className="text-[11px] text-slate-500">{t.leverage}x Isolated • {t.side === 'LONG' ? 'Long' : 'Short'} • Size {formatSize(t.quantity)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono">{formatPrice(value)}</td>
                          <td className="px-4 py-3 font-mono">{formatPrice(t.entry_price)}</td>
                          <td className="px-4 py-3 font-mono">{formatPrice(breakeven)}</td>
                          <td className="px-4 py-3 font-mono">{formatPrice(mark)}</td>
                          <td className="px-4 py-3">
                            <span className={`${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-bold`}>{formatPnL(pnl)}</span>
                          </td>
                          <td className={`px-4 py-3 font-mono ${roe>=0?'text-emerald-400':'text-rose-400'}`}>{Number.isFinite(roe) ? roe.toFixed(2) + '%' : '--'}</td>
                          <td className="px-4 py-3 font-mono">{riskPct !== null ? riskPct.toFixed(2) + '%' : '--'}</td>
                          <td className="px-4 py-3 font-mono text-amber-400">{t.liquidation_price ? t.liquidation_price.toFixed(0) : '-'}</td>
                          <td className="px-4 py-3 font-mono">{formatPrice(margin)}</td>
                          <td className="px-4 py-3">
                            {(t.take_profit || t.stop_loss) ? (
                              <div className="text-[12px]">
                                {t.take_profit && <span className="text-emerald-400 font-mono">TP {formatPrice(t.take_profit)}</span>}
                                {t.stop_loss && <span className="ml-2 text-rose-400 font-mono">SL {formatPrice(t.stop_loss)}</span>}
                              </div>
                            ) : <span className="text-slate-500 text-[12px]">--</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" className="h-8 text-[12px] border-slate-700" onClick={() => { setSelectedPos(t); setTpslOpen(true); }}>Add TP/SL</Button>
                              <Button size="sm" variant="outline" className="h-8 text-[12px] border-slate-700">Reverse</Button>
                              <Button size="sm" variant="outline" className="h-8 text-[12px] border-slate-700 hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all">Close</Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={<List className="h-8 w-8" />} message="No open positions" />
            )}
          </TabsContent>

          <TabsContent value="orders" className="h-full m-0 overflow-auto custom-scrollbar">
            {pendingOrders.length > 0 ? (
              <div className="p-0">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[#131722] z-10">
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800/50">
                      <th className="px-4 py-2 font-semibold">Symbol</th>
                      <th className="px-4 py-2 font-semibold">Type</th>
                      <th className="px-4 py-2 font-semibold">Side</th>
                      <th className="px-4 py-2 font-semibold">Price</th>
                      <th className="px-4 py-2 font-semibold">Amount</th>
                      <th className="px-4 py-2 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30">
                    {pendingOrders.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-3 text-sm font-bold text-white">{toDisplayFormat(t.symbol)}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{t.order_type}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold ${t.side === "LONG" ? "text-emerald-400" : "text-rose-400"}`}>{t.side}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-300">{formatPrice(t.limit_price || t.stop_price)}</td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-300">{formatSize(t.quantity)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] text-rose-400 hover:bg-rose-500/10">Cancel</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={<Clock className="h-8 w-8" />} message="No pending orders" />
            )}
          </TabsContent>

          <TabsContent value="history" className="h-full m-0 overflow-auto custom-scrollbar">
            {trades.length > 0 ? (
              <div className="p-0">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[#131722] z-10">
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800/50">
                      {columns.map(col => (
                        <th key={col.key} className="px-4 py-2 font-semibold whitespace-nowrap">{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30">
                    {trades.map(trade => (
                      <tr key={trade.id} className="hover:bg-slate-800/20 transition-colors">
                        {columns.map(col => (
                          <td key={col.key} className="px-4 py-2.5 whitespace-nowrap text-xs">
                            {col.render ? col.render(trade) : col.format ? col.format(trade[col.key]) : (trade[col.key] ?? '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={<History className="h-8 w-8" />} message="No trade history" />
            )}
          </TabsContent>
        </Tabs>
      </div>
      <TPSLDialog open={tpslOpen} onOpenChange={setTpslOpen} position={selectedPos} currentPrice={selectedPos ? (prices[selectedPos.symbol] || 0) : 0} onSuccess={() => { load(); }} />
    </div>
  );

  function EmptyState({ icon, message }) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3 opacity-50">
        {icon}
        <span className="text-xs font-medium">{message}</span>
      </div>
    );
  }

  function formatDateTime(date) {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-AE', { timeZone: 'Asia/Dubai', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function formatPrice(v) { if (v === undefined || v === null || isNaN(Number(v))) return '-'; const n = Number(v); return `$${n.toLocaleString(undefined, { maximumFractionDigits: n >= 1 ? 0 : 6 })}`; }
  function formatPnL(v) { if (v === undefined || v === null) return '-'; const n = Number(v); const cls = n >= 0 ? 'text-emerald-400' : 'text-rose-400'; return <span className={cls}>{n >= 0 ? '+' : ''}{n.toFixed(2)}</span>; }
  function formatSize(v) { if (v === undefined || v === null) return '-'; const n = Number(v); return n.toLocaleString(undefined, { maximumFractionDigits: n >= 1 ? 2 : 6 }); }
}

TradingHistory.propTypes = {
  tradingAccountId: PropTypes.string,
  onRefresh: PropTypes.func,
  onPositionsUpdate: PropTypes.func,
  onOpenOrdersUpdate: PropTypes.func,
  refreshSignal: PropTypes.number,
};