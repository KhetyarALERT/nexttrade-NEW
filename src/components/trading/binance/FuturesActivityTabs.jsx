import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { binanceFuturesStore } from "@/components/trading/binance/binanceFuturesStore";

function formatNum(v, digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatPrice(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const digits = n < 1 ? 6 : 2;
  return formatNum(n, digits);
}

function normalizeSymbol(sym) {
  return String(sym || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function EmptyState({ title, subtitle }) {
  return (
    <div className="p-6 text-center">
      <div className="text-sm font-semibold text-slate-200">{title}</div>
      <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
    </div>
  );
}

EmptyState.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
};

export default function FuturesActivityTabs({ symbol, language, trades = [], onRefresh }) {
  const [tab, setTab] = useState("positions");
  const [markBySymbol, setMarkBySymbol] = useState({});

  useEffect(() => {
    const symbols = Array.from(
      new Set(
        (trades || [])
          .map((t) => normalizeSymbol(t?.symbol))
          .filter(Boolean),
      ),
    );

    if (!symbols.length) {
      setMarkBySymbol({});
      return;
    }

    const unsubs = symbols.map((s) =>
      binanceFuturesStore.subscribe(`price:${s}`, (p) => {
        if (!p) return;
        setMarkBySymbol((prev) => ({ ...prev, [s]: Number(p) }));
      }),
    );

    // seed from existing tickers
    setMarkBySymbol((prev) => {
      const next = { ...prev };
      symbols.forEach((s) => {
        const t = binanceFuturesStore.getTicker(s);
        if (t?.lastPrice) next[s] = Number(t.lastPrice);
      });
      return next;
    });

    return () => {
      unsubs.forEach((u) => {
        try {
          u?.();
        } catch {}
      });
    };
  }, [trades]);

  const labels = useMemo(() => {
    const isAr = language === "ar";
    return {
      tabs: {
        positions: isAr ? "المراكز" : "Positions",
        openOrders: isAr ? "الأوامر المفتوحة" : "Open Orders",
        orderHistory: isAr ? "سجل الأوامر" : "Order History",
        tradeHistory: isAr ? "سجل التداول" : "Trade History",
        positionHistory: isAr ? "سجل المراكز" : "Position History",
        transactions: isAr ? "المعاملات" : "Transactions",
      },
      empty: {
        noPositionsTitle: isAr ? "لا توجد مراكز مفتوحة" : "No open positions",
        noPositionsSubtitle: isAr
          ? `ستظهر مراكز ${symbol} هنا عند تفعيل التداول.`
          : `Positions for ${symbol} will appear here once trading is enabled.`,
        noOpenOrdersTitle: isAr ? "لا توجد أوامر مفتوحة" : "No open orders",
        noOpenOrdersSubtitle: isAr ? "ستظهر الأوامر المفتوحة هنا." : "Open orders will appear here.",
        noOrderHistoryTitle: isAr ? "لا يوجد سجل أوامر" : "No order history",
        noOrderHistorySubtitle: isAr ? "ستظهر أوامرك المكتملة/الملغاة هنا." : "Your filled/canceled orders will appear here.",
        noTradesTitle: isAr ? "لا توجد صفقات بعد" : "No trades yet",
        noTradesSubtitle: isAr ? "ستظهر الصفقات المنفذة هنا." : "Executed trades will appear here.",
        noPositionHistoryTitle: isAr ? "لا يوجد سجل مراكز" : "No position history",
        noPositionHistorySubtitle: isAr ? "ستظهر المراكز المغلقة هنا." : "Closed positions will appear here.",
        noTransactionsTitle: isAr ? "لا توجد معاملات" : "No transactions",
        noTransactionsSubtitle: isAr ? "ستظهر الإيداعات/السحوبات/الرسوم والتمويل هنا." : "Deposits, withdrawals, fees, and funding will appear here.",
      },
      positions: {
        futures: isAr ? "العقود" : "Futures",
        positionValue: isAr ? "المركز/القيمة" : "Position/Value",
        unrealized: isAr ? "الربح غير المحقق(%)" : "Unrealized PnL(%)",
        realized: isAr ? "الربح المحقق" : "Realized PnL",
        breakeven: isAr ? "سعر التعادل" : "Breakeven price",
        entry: isAr ? "سعر الدخول" : "Entry Price",
        mark: isAr ? "سعر المارك" : "Mark Price",
        liq: isAr ? "سعر التصفية" : "Est. Liq. Price",
        risk: isAr ? "المخاطرة" : "Risk",
        margin: isAr ? "الهامش" : "Margin",
        tpSl: isAr ? "وقف/هدف" : "Position TP/SL",
      },
      common: {
        time: isAr ? "الوقت" : "Time",
        symbol: isAr ? "الرمز" : "Symbol",
        type: isAr ? "النوع" : "Type",
        side: isAr ? "الجانب" : "Side",
        status: isAr ? "الحالة" : "Status",
        price: isAr ? "السعر" : "Price",
        qty: isAr ? "الكمية" : "Qty",
        action: isAr ? "الإجراء" : "Action",
        pnl: isAr ? "الربح" : "PnL",
        amount: isAr ? "المبلغ" : "Amount",
        asset: isAr ? "الأصل" : "Asset",
        refresh: isAr ? "تحديث" : "Refresh",
      },
    };
  }, [language, symbol]);

  const openPositions = useMemo(
    () => (trades || []).filter((t) => String(t?.status || "").toUpperCase() === "OPEN"),
    [trades],
  );

  const openOrders = useMemo(
    () => (trades || []).filter((t) => String(t?.status || "").toUpperCase() === "PENDING"),
    [trades],
  );

  const orderHistory = useMemo(
    () => (trades || []).filter((t) => ["CANCELLED", "REJECTED", "EXPIRED"].includes(String(t?.status || "").toUpperCase())),
    [trades],
  );

  const tradeHistory = useMemo(
    () => (trades || []).filter((t) => String(t?.status || "").toUpperCase() === "CLOSED"),
    [trades],
  );

  return (
    <div className="bg-[#0f1320] border-t border-slate-800/60">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="p-2 border-b border-slate-800/60 flex items-center gap-2">
          <div className="flex-1 overflow-x-auto">
            <TabsList className="bg-slate-900/40 h-9">
              <TabsTrigger value="positions" className="data-[state=active]:bg-slate-800">{labels.tabs.positions}</TabsTrigger>
              <TabsTrigger value="openOrders" className="data-[state=active]:bg-slate-800">{labels.tabs.openOrders}</TabsTrigger>
              <TabsTrigger value="orderHistory" className="data-[state=active]:bg-slate-800">{labels.tabs.orderHistory}</TabsTrigger>
              <TabsTrigger value="tradeHistory" className="data-[state=active]:bg-slate-800">{labels.tabs.tradeHistory}</TabsTrigger>
              <TabsTrigger value="positionHistory" className="data-[state=active]:bg-slate-800">{labels.tabs.positionHistory}</TabsTrigger>
              <TabsTrigger value="transactions" className="data-[state=active]:bg-slate-800">{labels.tabs.transactions}</TabsTrigger>
            </TabsList>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 text-slate-200"
            onClick={() => onRefresh?.()}
            disabled={!onRefresh}
          >
            {labels.common.refresh}
          </Button>
        </div>

        <TabsContent value="positions" className="m-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-slate-500">{labels.positions.futures}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.positionValue}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.unrealized}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.realized}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.breakeven}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.entry}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.mark}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.liq}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.risk}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.margin}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.tpSl}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openPositions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="p-0">
                      <EmptyState title={labels.empty.noPositionsTitle} subtitle={labels.empty.noPositionsSubtitle} />
                    </TableCell>
                  </TableRow>
                ) : (
                  openPositions.map((pos) => {
                    const sym = normalizeSymbol(pos?.symbol);
                    const mark = markBySymbol[sym];
                    const entry = Number(pos?.entry_price);
                    const qty = Number(pos?.quantity);
                    const margin = Number(pos?.margin);
                    const side = String(pos?.side || "LONG").toUpperCase();

                    const pnl = Number.isFinite(mark) && Number.isFinite(entry) && Number.isFinite(qty)
                      ? (side === "SHORT" ? (entry - mark) * qty : (mark - entry) * qty)
                      : NaN;
                    const pnlPct = Number.isFinite(pnl) && Number.isFinite(margin) && margin > 0 ? (pnl / margin) * 100 : NaN;
                    const positionValue = Number.isFinite(mark) && Number.isFinite(qty) ? mark * qty : NaN;

                    return (
                      <TableRow key={pos?.id || `${sym}_${entry}_${qty}`}
                        className="hover:bg-slate-900/20"
                      >
                        <TableCell className="text-slate-200 font-medium">
                          <div className="flex items-center gap-2">
                            <span>{sym}</span>
                            <span className={`text-[11px] px-2 py-0.5 rounded ${side === "LONG" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                              {side}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-200">
                          {Number.isFinite(qty) && Number.isFinite(positionValue)
                            ? `${formatNum(qty, 6)} / ${formatNum(positionValue, 2)}`
                            : "—"}
                        </TableCell>
                        <TableCell className={`${Number(pnl) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                          {Number.isFinite(pnl) ? `${formatNum(pnl, 2)} (${Number.isFinite(pnlPct) ? pnlPct.toFixed(2) : "—"}%)` : "—"}
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {pos?.realized_pnl !== undefined && pos?.realized_pnl !== null ? formatNum(pos.realized_pnl, 2) : "—"}
                        </TableCell>
                        <TableCell className="text-slate-200">{formatPrice(entry)}</TableCell>
                        <TableCell className="text-slate-200">{formatPrice(entry)}</TableCell>
                        <TableCell className="text-slate-200">{formatPrice(mark)}</TableCell>
                        <TableCell className="text-slate-200">{formatPrice(pos?.liquidation_price)}</TableCell>
                        <TableCell className="text-slate-400">—</TableCell>
                        <TableCell className="text-slate-200">{Number.isFinite(margin) ? formatNum(margin, 2) : "—"}</TableCell>
                        <TableCell className="text-slate-200">
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="text-emerald-300">TP {pos?.take_profit ? formatPrice(pos.take_profit) : "—"}</span>
                            <span className="text-rose-300">SL {pos?.stop_loss ? formatPrice(pos.stop_loss) : "—"}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="openOrders" className="m-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-500">{labels.common.symbol}</TableHead>
                <TableHead className="text-slate-500">{labels.common.type}</TableHead>
                <TableHead className="text-slate-500">{labels.common.side}</TableHead>
                <TableHead className="text-slate-500 text-right">{labels.common.price}</TableHead>
                <TableHead className="text-slate-500 text-right">{labels.common.qty}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {openOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState title={labels.empty.noOpenOrdersTitle} subtitle={labels.empty.noOpenOrdersSubtitle} />
                  </TableCell>
                </TableRow>
              ) : (
                openOrders.map((o) => (
                  <TableRow key={o?.id || String(Math.random())}>
                    <TableCell className="text-slate-200">{normalizeSymbol(o?.symbol)}</TableCell>
                    <TableCell className="text-slate-200">{String(o?.order_type || "—")}</TableCell>
                    <TableCell className="text-slate-200">{String(o?.side || "—")}</TableCell>
                    <TableCell className="text-slate-200 text-right">{formatPrice(o?.limit_price ?? o?.entry_price)}</TableCell>
                    <TableCell className="text-slate-200 text-right">{o?.quantity ? formatNum(o.quantity, 6) : "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="orderHistory" className="m-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-500">{labels.common.time}</TableHead>
                <TableHead className="text-slate-500">{labels.common.symbol}</TableHead>
                <TableHead className="text-slate-500">{labels.common.type}</TableHead>
                <TableHead className="text-slate-500">{labels.common.status}</TableHead>
                <TableHead className="text-slate-500 text-right">{labels.common.qty}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState title={labels.empty.noOrderHistoryTitle} subtitle={labels.empty.noOrderHistorySubtitle} />
                  </TableCell>
                </TableRow>
              ) : (
                orderHistory.slice(0, 100).map((o) => (
                  <TableRow key={o?.id || String(Math.random())}>
                    <TableCell className="text-slate-200">{o?.created_at ? new Date(o.created_at).toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-slate-200">{normalizeSymbol(o?.symbol)}</TableCell>
                    <TableCell className="text-slate-200">{String(o?.order_type || "—")}</TableCell>
                    <TableCell className="text-slate-200">{String(o?.status || "—")}</TableCell>
                    <TableCell className="text-slate-200 text-right">{o?.quantity ? formatNum(o.quantity, 6) : "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="tradeHistory" className="m-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-500">{labels.common.time}</TableHead>
                <TableHead className="text-slate-500">{labels.common.symbol}</TableHead>
                <TableHead className="text-slate-500">{labels.common.side}</TableHead>
                <TableHead className="text-slate-500 text-right">{labels.common.price}</TableHead>
                <TableHead className="text-slate-500 text-right">{labels.common.qty}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tradeHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState title={labels.empty.noTradesTitle} subtitle={labels.empty.noTradesSubtitle} />
                  </TableCell>
                </TableRow>
              ) : (
                tradeHistory.slice(0, 100).map((t) => (
                  <TableRow key={t?.id || String(Math.random())}>
                    <TableCell className="text-slate-200">{t?.closed_at ? new Date(t.closed_at).toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-slate-200">{normalizeSymbol(t?.symbol)}</TableCell>
                    <TableCell className="text-slate-200">{String(t?.side || "—")}</TableCell>
                    <TableCell className="text-slate-200 text-right">{formatPrice(t?.avg_exit_price ?? t?.exit_price ?? t?.entry_price)}</TableCell>
                    <TableCell className="text-slate-200 text-right">{t?.quantity ? formatNum(t.quantity, 6) : "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="positionHistory" className="m-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-500">{labels.common.time}</TableHead>
                <TableHead className="text-slate-500">{labels.common.symbol}</TableHead>
                <TableHead className="text-slate-500">{labels.common.action}</TableHead>
                <TableHead className="text-slate-500 text-right">{labels.common.pnl}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tradeHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="p-0">
                    <EmptyState title={labels.empty.noPositionHistoryTitle} subtitle={labels.empty.noPositionHistorySubtitle} />
                  </TableCell>
                </TableRow>
              ) : (
                tradeHistory.slice(0, 100).map((t) => (
                  <TableRow key={t?.id || String(Math.random())}>
                    <TableCell className="text-slate-200">{t?.closed_at ? new Date(t.closed_at).toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-slate-200">{normalizeSymbol(t?.symbol)}</TableCell>
                    <TableCell className="text-slate-200">{String(t?.close_reason || "closed")}</TableCell>
                    <TableCell className={`text-right ${Number(t?.pnl) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {t?.pnl !== undefined && t?.pnl !== null ? formatNum(t.pnl, 2) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="transactions" className="m-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-500">{labels.common.time}</TableHead>
                <TableHead className="text-slate-500">{labels.common.type}</TableHead>
                <TableHead className="text-slate-500 text-right">{labels.common.amount}</TableHead>
                <TableHead className="text-slate-500">{labels.common.asset}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={4} className="p-0">
                  <EmptyState title={labels.empty.noTransactionsTitle} subtitle={labels.empty.noTransactionsSubtitle} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}

FuturesActivityTabs.propTypes = {
  symbol: PropTypes.string.isRequired,
  language: PropTypes.string,
  trades: PropTypes.array,
  onRefresh: PropTypes.func,
};
