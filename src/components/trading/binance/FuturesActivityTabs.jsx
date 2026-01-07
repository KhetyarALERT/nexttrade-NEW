import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { binanceFuturesStore } from "@/components/trading/binance/binanceFuturesStore";
import { base44 } from "@/api/base44Client";
import { Pencil, Plus } from "lucide-react";

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

export default function FuturesActivityTabs({
  symbol,
  language,
  trades = [],
  onRefresh,
  selectedTradeId,
  onSelectTrade,
  onCloseTrade,
}) {
  const [tab, setTab] = useState("positions");
  const [markBySymbol, setMarkBySymbol] = useState({});

  const [tpSlOpen, setTpSlOpen] = useState(false);
  const [tpSlTrade, setTpSlTrade] = useState(null);
  const [tpEnabled, setTpEnabled] = useState(false);
  const [slEnabled, setSlEnabled] = useState(false);
  const [tpValue, setTpValue] = useState("");
  const [slValue, setSlValue] = useState("");
  const [tpSlBusy, setTpSlBusy] = useState(false);
  const [tpSlError, setTpSlError] = useState("");

  const [cancelBusyId, setCancelBusyId] = useState(null);

  const autoTriggeredRef = useRef(new Set());

  const parseNum = (v) => {
    if (v === "" || v === null || v === undefined) return NaN;
    const n = Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : NaN;
  };

  const stepForPrice = (p) => {
    const n = Number(p);
    if (!Number.isFinite(n) || n <= 0) return 0.01;
    if (n < 0.01) return 0.000001;
    if (n < 0.1) return 0.00001;
    if (n < 1) return 0.0001;
    if (n < 10) return 0.001;
    if (n < 100) return 0.01;
    if (n < 1000) return 0.1;
    return 1;
  };

  const wheelAdjust = (currentValue, deltaY, step) => {
    const curr = parseNum(currentValue);
    const base = Number.isFinite(curr) ? curr : 0;
    const dir = deltaY > 0 ? -1 : 1;
    const next = Math.max(0, base + dir * step);
    const stepStr = String(step);
    const decimals = stepStr.includes(".") ? stepStr.split(".")[1].length : 0;
    return next.toFixed(Math.min(8, decimals));
  };

  const digitsForPrice = (p) => {
    const n = Number(p);
    if (!Number.isFinite(n)) return 2;
    return n < 1 ? 6 : 2;
  };

  const calcPresetPrice = (trade, kind, pct) => {
    const entry = Number(trade?.avg_entry_price ?? trade?.entry_price);
    if (!Number.isFinite(entry) || entry <= 0) return "";
    const side = String(trade?.side || "LONG").toUpperCase();
    const p = Math.max(0, Number(pct) || 0);

    let next = entry;
    if (side === "SHORT") {
      next = kind === "tp" ? entry * (1 - p / 100) : entry * (1 + p / 100);
    } else {
      next = kind === "tp" ? entry * (1 + p / 100) : entry * (1 - p / 100);
    }

    return next.toFixed(digitsForPrice(entry));
  };

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
        actions: isAr ? "إجراءات" : "Actions",
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
        view: isAr ? "عرض" : "View",
        close: isAr ? "إغلاق" : "Close",
        tpSl: isAr ? "هدف/وقف" : "TP/SL",
        edit: isAr ? "تعديل" : "Edit",
        add: isAr ? "إضافة" : "Add",
        confirm: isAr ? "تأكيد" : "Confirm",
        cancel: isAr ? "إلغاء" : "Cancel",
        updating: isAr ? "جارٍ التحديث…" : "Updating…",
        updateFailed: isAr ? "فشل تحديث TP/SL" : "Failed to update TP/SL",
        entry: isAr ? "سعر الدخول" : "Entry Price",
        last: isAr ? "آخر سعر" : "Last Price",
        liq: isAr ? "سعر التصفية" : "Est. Liq. Price",
        takeProfit: isAr ? "جني الربح" : "Take Profit",
        stopLoss: isAr ? "وقف الخسارة" : "Stop Loss",
      },
    };
  }, [language, symbol]);

  const openTpSlDialog = (trade) => {
    if (!trade?.id) return;
    setTpSlError("");
    setTpSlTrade(trade);

    const tp = Number(trade?.take_profit);
    const sl = Number(trade?.stop_loss);
    const hasTp = Number.isFinite(tp) && tp > 0;
    const hasSl = Number.isFinite(sl) && sl > 0;

    setTpEnabled(hasTp);
    setSlEnabled(hasSl);
    setTpValue(hasTp ? String(tp) : "");
    setSlValue(hasSl ? String(sl) : "");
    setTpSlOpen(true);
  };

  const submitTpSl = async () => {
    if (!tpSlTrade?.id) return;
    setTpSlError("");
    setTpSlBusy(true);
    try {
      const tp = parseNum(tpValue);
      const sl = parseNum(slValue);

      const payload = {
        action: "updateTrade",
        tradeId: tpSlTrade.id,
        takeProfit: tpEnabled && Number.isFinite(tp) && tp > 0 ? tp : null,
        stopLoss: slEnabled && Number.isFinite(sl) && sl > 0 ? sl : null,
      };

      const res = await base44.functions.invoke("tradingAccount", payload);
      if (!res?.data?.success) {
        setTpSlError(res?.data?.error || labels.common.updateFailed);
        return;
      }

      setTpSlOpen(false);
      setTpSlTrade(null);
      await onRefresh?.();
    } catch {
      setTpSlError(labels.common.updateFailed);
    } finally {
      setTpSlBusy(false);
    }
  };

  const openPositions = useMemo(
    () => (trades || []).filter((t) => String(t?.status || "").toUpperCase() === "OPEN"),
    [trades],
  );

  // Auto-trigger TP/SL on open positions using live mark prices.
  useEffect(() => {
    if (!openPositions.length) return;

    const toClose = [];

    for (const pos of openPositions) {
      const id = pos?.id;
      if (!id) continue;
      if (autoTriggeredRef.current.has(id)) continue;

      const sym = normalizeSymbol(pos?.symbol);
      const mark = Number(markBySymbol[sym]);
      if (!Number.isFinite(mark) || mark <= 0) continue;

      const side = String(pos?.side || "LONG").toUpperCase();
      const tp = Number(pos?.take_profit);
      const sl = Number(pos?.stop_loss);
      const hasTp = Number.isFinite(tp) && tp > 0;
      const hasSl = Number.isFinite(sl) && sl > 0;

      // Prefer SL if both are crossed at once.
      if (hasSl) {
        const slHit = side === "SHORT" ? mark >= sl : mark <= sl;
        if (slHit) {
          toClose.push({ tradeId: id, exitPrice: sl, reason: "sl_trigger" });
          continue;
        }
      }

      if (hasTp) {
        const tpHit = side === "SHORT" ? mark <= tp : mark >= tp;
        if (tpHit) {
          toClose.push({ tradeId: id, exitPrice: tp, reason: "tp_trigger" });
        }
      }
    }

    if (!toClose.length) return;

    let cancelled = false;

    const run = async () => {
      for (const item of toClose) {
        if (cancelled) return;
        autoTriggeredRef.current.add(item.tradeId);
        try {
          await base44.functions.invoke("tradingAccount", {
            action: "closeTrade",
            tradeId: item.tradeId,
            exitPrice: item.exitPrice,
            reason: item.reason,
          });
        } catch {
          // If it fails, allow retry later.
          autoTriggeredRef.current.delete(item.tradeId);
        }
      }

      await onRefresh?.();
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [openPositions, markBySymbol, onRefresh]);

  const openOrders = useMemo(() => {
    const list = Array.isArray(trades) ? trades : [];

    const pending = list
      .filter((t) => String(t?.status || "").toUpperCase() === "PENDING")
      .map((t) => ({
        kind: "PENDING",
        id: t?.id,
        symbol: t?.symbol,
        type: String(t?.order_type || "PENDING").toUpperCase(),
        side: String(t?.side || "—").toUpperCase(),
        price: t?.limit_price ?? t?.stop_price ?? t?.entry_price,
        qty: t?.quantity,
        raw: t,
      }));

    // Treat TP/SL as conditional open orders for visibility.
    const conditionals = (list
      .filter((t) => String(t?.status || "").toUpperCase() === "OPEN")
      .flatMap((t) => {
        const rows = [];
        const tp = Number(t?.take_profit);
        const sl = Number(t?.stop_loss);

        if (Number.isFinite(tp) && tp > 0) {
          rows.push({
            kind: "TP",
            id: `tp:${t?.id}`,
            tradeId: t?.id,
            symbol: t?.symbol,
            type: "TAKE_PROFIT",
            side: "CLOSE",
            price: tp,
            qty: t?.quantity,
            raw: t,
          });
        }

        if (Number.isFinite(sl) && sl > 0) {
          rows.push({
            kind: "SL",
            id: `sl:${t?.id}`,
            tradeId: t?.id,
            symbol: t?.symbol,
            type: "STOP_LOSS",
            side: "CLOSE",
            price: sl,
            qty: t?.quantity,
            raw: t,
          });
        }

        return rows;
      }))
      .filter(Boolean);

    return [...pending, ...conditionals];
  }, [trades]);

  const cancelOpenOrder = async (o) => {
    const id = o?.id;
    if (!id) return;
    setCancelBusyId(id);
    try {
      if (o.kind === "PENDING") {
        if (!o?.raw?.id) return;
        await base44.functions.invoke("tradingAccount", { action: "cancelOrder", tradeId: o.raw.id });
      } else if (o.kind === "TP") {
        if (!o?.raw?.id) return;
        await base44.functions.invoke("tradingAccount", { action: "updateTrade", tradeId: o.raw.id, takeProfit: null });
      } else if (o.kind === "SL") {
        if (!o?.raw?.id) return;
        await base44.functions.invoke("tradingAccount", { action: "updateTrade", tradeId: o.raw.id, stopLoss: null });
      }
    } finally {
      await onRefresh?.();
      setCancelBusyId(null);
    }
  };

  const orderHistory = useMemo(
    () => (trades || []).filter((t) => ["CANCELLED", "REJECTED", "EXPIRED"].includes(String(t?.status || "").toUpperCase())),
    [trades],
  );

  const tradeHistory = useMemo(
    () => (trades || []).filter((t) => String(t?.status || "").toUpperCase() === "CLOSED"),
    [trades],
  );

  return (
    <div className="bg-background border-t border-border">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="p-2 border-b border-border flex items-center gap-2 bg-card">
          <div className="flex-1 overflow-x-auto">
            <TabsList className="bg-muted h-9">
              <TabsTrigger value="positions" className="data-[state=active]:bg-background">{labels.tabs.positions}</TabsTrigger>
              <TabsTrigger value="openOrders" className="data-[state=active]:bg-background">{labels.tabs.openOrders}</TabsTrigger>
              <TabsTrigger value="orderHistory" className="data-[state=active]:bg-background">{labels.tabs.orderHistory}</TabsTrigger>
              <TabsTrigger value="tradeHistory" className="data-[state=active]:bg-background">{labels.tabs.tradeHistory}</TabsTrigger>
              <TabsTrigger value="positionHistory" className="data-[state=active]:bg-background">{labels.tabs.positionHistory}</TabsTrigger>
              <TabsTrigger value="transactions" className="data-[state=active]:bg-background">{labels.tabs.transactions}</TabsTrigger>
            </TabsList>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground hover:text-foreground"
            onClick={() => onRefresh?.()}
            disabled={!onRefresh}
          >
            {labels.common.refresh}
          </Button>
        </div>

        <TabsContent value="positions" className="m-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1320px]">
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
                  <TableHead className="text-slate-500">{labels.positions.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openPositions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="p-0">
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

                    const baseAsset = sym.endsWith("USDT") ? sym.slice(0, -4) : sym;
                    const breakevenRaw = Number(
                      pos?.breakeven_price ??
                        pos?.break_even_price ??
                        pos?.breakeven ??
                        pos?.breakevenPrice ??
                        pos?.breakEvenPrice,
                    );
                    const breakeven = Number.isFinite(breakevenRaw) && breakevenRaw > 0 ? breakevenRaw : entry;

                    const pnl = Number.isFinite(mark) && Number.isFinite(entry) && Number.isFinite(qty)
                      ? (side === "SHORT" ? (entry - mark) * qty : (mark - entry) * qty)
                      : NaN;
                    const pnlPct = Number.isFinite(pnl) && Number.isFinite(margin) && margin > 0 ? (pnl / margin) * 100 : NaN;
                    const positionValue = Number.isFinite(mark) && Number.isFinite(qty) ? mark * qty : NaN;
                    const liq = Number(pos?.liquidation_price);
                    const liqDistPct =
                      Number.isFinite(mark) && mark > 0 && Number.isFinite(liq) && liq > 0
                        ? (Math.abs(mark - liq) / mark) * 100
                        : NaN;
                    const riskTone =
                      Number.isFinite(liqDistPct)
                        ? liqDistPct < 1
                          ? "text-rose-300"
                          : liqDistPct < 3
                            ? "text-amber-300"
                            : "text-emerald-300"
                        : "text-slate-400";

                    return (
                      <TableRow
                        key={pos?.id || `${sym}_${entry}_${qty}`}
                        className={`hover:bg-slate-900/20 ${pos?.id && selectedTradeId === pos.id ? "bg-slate-900/30" : ""}`}
                        onClick={() => onSelectTrade?.(pos)}
                        role={onSelectTrade ? "button" : undefined}
                        tabIndex={onSelectTrade ? 0 : undefined}
                      >
                        <TableCell className="text-slate-200 font-medium">
                          <div className="flex items-center gap-2">
                            <span>{sym}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                side === "LONG"
                                  ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/20"
                                  : "bg-rose-500/15 text-rose-200 border-rose-500/20"
                              }`}
                            >
                              {side}
                            </span>
                          </div>

                          <div className="mt-1 text-[10px] text-slate-500">
                            {side === "LONG" ? "Long" : "Short"}
                            {pos?.mode ? ` · ${String(pos.mode).toUpperCase()}` : ""}
                            {pos?.leverage ? ` · ${pos.leverage}X` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-200">
                          {Number.isFinite(qty) && Number.isFinite(positionValue) ? (
                            <div className="leading-tight">
                              <div className="font-mono text-slate-200">{formatNum(qty, 6)} {baseAsset}</div>
                              <div className="font-mono text-[11px] text-slate-400">{formatNum(positionValue, 2)} USDT</div>
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell className={`${Number(pnl) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                          {Number.isFinite(pnl) ? (
                            <div className="leading-tight">
                              <div className="font-mono">{formatNum(pnl, 2)} USDT</div>
                              <div className="font-mono text-[11px] opacity-80">{Number.isFinite(pnlPct) ? `${pnlPct.toFixed(2)}%` : "—"}</div>
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {pos?.realized_pnl !== undefined && pos?.realized_pnl !== null ? (
                            <span className="font-mono">{formatNum(pos.realized_pnl, 2)} USDT</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-slate-200">{formatPrice(breakeven)}</TableCell>
                        <TableCell className="text-slate-200">{formatPrice(entry)}</TableCell>
                        <TableCell className="text-slate-200">{formatPrice(mark)}</TableCell>
                        <TableCell className="text-amber-300">{formatPrice(pos?.liquidation_price)}</TableCell>
                        <TableCell className={riskTone}>
                          {Number.isFinite(liqDistPct) ? `${liqDistPct.toFixed(2)}%` : "—"}
                        </TableCell>
                        <TableCell className="text-slate-200">{Number.isFinite(margin) ? <span className="font-mono">{formatNum(margin, 2)} USDT</span> : "—"}</TableCell>
                        <TableCell className="text-slate-200">
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] ${pos?.take_profit ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-200" : "bg-slate-800/40 border-slate-700/60 text-slate-400"}`}>
                              TP {pos?.take_profit ? formatPrice(pos.take_profit) : "—"}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] ${pos?.stop_loss ? "bg-rose-500/10 border-rose-500/20 text-rose-200" : "bg-slate-800/40 border-slate-700/60 text-slate-400"}`}>
                              SL {pos?.stop_loss ? formatPrice(pos.stop_loss) : "—"}
                            </span>

                            <button
                              type="button"
                              className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-full border border-slate-700/70 bg-slate-900/40 text-slate-200 hover:bg-slate-800/60 text-[10px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectTrade?.(pos);
                                openTpSlDialog(pos);
                              }}
                              title={pos?.take_profit || pos?.stop_loss ? labels.common.edit : labels.common.add}
                            >
                              {pos?.take_profit || pos?.stop_loss ? <Pencil className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                            </button>
                          </div>
                        </TableCell>

                        <TableCell className="text-slate-200">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={pos?.id && selectedTradeId === pos.id ? "secondary" : "ghost"}
                              className="h-7 px-2 text-xs rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectTrade?.(pos);
                              }}
                            >
                              {labels.common.view}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              className="h-7 px-2 text-xs rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCloseTrade?.(pos);
                              }}
                            >
                              {labels.common.close}
                            </Button>
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
                <TableHead className="text-slate-500 text-right">{labels.common.action}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {openOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState title={labels.empty.noOpenOrdersTitle} subtitle={labels.empty.noOpenOrdersSubtitle} />
                  </TableCell>
                </TableRow>
              ) : (
                openOrders.map((o) => (
                  <TableRow key={o?.id || String(Math.random())}>
                    <TableCell className="text-slate-200">{normalizeSymbol(o?.symbol)}</TableCell>
                    <TableCell className="text-slate-200">{String(o?.type || "—")}</TableCell>
                    <TableCell className="text-slate-200">{String(o?.side || "—")}</TableCell>
                    <TableCell className="text-slate-200 text-right">{formatPrice(o?.price)}</TableCell>
                    <TableCell className="text-slate-200 text-right">{o?.qty ? formatNum(o.qty, 6) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs rounded-full text-slate-200"
                        onClick={() => cancelOpenOrder(o)}
                        disabled={!onRefresh || cancelBusyId === o?.id}
                      >
                        {cancelBusyId === o?.id ? labels.common.updating : labels.common.cancel}
                      </Button>
                    </TableCell>
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
                      {t?.pnl !== undefined && t?.pnl !== null ? <span className="font-mono">{formatNum(t.pnl, 2)} USDT</span> : "—"}
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

      <Dialog open={tpSlOpen} onOpenChange={(v) => {
        setTpSlOpen(v);
        if (!v) {
          setTpSlTrade(null);
          setTpSlError("");
          setTpSlBusy(false);
        }
      }}>
        <DialogContent className="max-w-[560px] bg-background border border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">{labels.common.tpSl}</DialogTitle>
          </DialogHeader>

          {tpSlTrade ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">
                      {normalizeSymbol(tpSlTrade?.symbol)} {String(tpSlTrade?.side || "LONG").toUpperCase()} {tpSlTrade?.leverage ? `${tpSlTrade.leverage}X` : ""}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{String(tpSlTrade?.order_type || "").toUpperCase()}</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-[11px] text-muted-foreground">{labels.common.entry}</div>
                    <div className="font-mono text-foreground">{formatPrice(tpSlTrade?.avg_entry_price ?? tpSlTrade?.entry_price)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">{labels.common.last}</div>
                    <div className="font-mono text-foreground">{formatPrice(markBySymbol[normalizeSymbol(tpSlTrade?.symbol)])}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">{labels.common.liq}</div>
                    <div className="font-mono text-amber-300">{formatPrice(tpSlTrade?.liquidation_price)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-500"
                    checked={tpEnabled}
                    onChange={(e) => setTpEnabled(e.target.checked)}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-slate-100">{labels.common.takeProfit}</div>
                  </div>
                </label>

                {tpEnabled ? (
                  <div className="mt-3">
                    <div className="grid grid-cols-[1fr,auto] gap-2">
                      <input
                        value={tpValue}
                        onChange={(e) => setTpValue(e.target.value)}
                        onWheelCapture={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const step = stepForPrice(parseNum(tpValue) || markBySymbol[normalizeSymbol(tpSlTrade?.symbol)]);
                          setTpValue((v) => wheelAdjust(v, e.deltaY, step));
                        }}
                        placeholder="—"
                        className="w-full rounded-lg bg-slate-950/30 border border-slate-800 px-3 py-2 text-sm text-slate-100 outline-none"
                        inputMode="decimal"
                      />
                      <div className="rounded-lg bg-slate-950/30 border border-slate-800 px-3 py-2 text-xs text-slate-300 flex items-center">
                        USDT
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {[10, 20, 50, 100].map((p) => (
                        <button
                          key={`tp_${p}`}
                          type="button"
                          className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px]"
                          onClick={() => {
                            if (!tpSlTrade) return;
                            setTpEnabled(true);
                            setTpValue(calcPresetPrice(tpSlTrade, "tp", p));
                          }}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-500"
                    checked={slEnabled}
                    onChange={(e) => setSlEnabled(e.target.checked)}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-slate-100">{labels.common.stopLoss}</div>
                  </div>
                </label>

                {slEnabled ? (
                  <div className="mt-3">
                    <div className="grid grid-cols-[1fr,auto] gap-2">
                      <input
                        value={slValue}
                        onChange={(e) => setSlValue(e.target.value)}
                        onWheelCapture={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const step = stepForPrice(parseNum(slValue) || markBySymbol[normalizeSymbol(tpSlTrade?.symbol)]);
                          setSlValue((v) => wheelAdjust(v, e.deltaY, step));
                        }}
                        placeholder="—"
                        className="w-full rounded-lg bg-slate-950/30 border border-slate-800 px-3 py-2 text-sm text-slate-100 outline-none"
                        inputMode="decimal"
                      />
                      <div className="rounded-lg bg-slate-950/30 border border-slate-800 px-3 py-2 text-xs text-slate-300 flex items-center">
                        USDT
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {[10, 20, 50, 100].map((p) => (
                        <button
                          key={`sl_${p}`}
                          type="button"
                          className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px]"
                          onClick={() => {
                            if (!tpSlTrade) return;
                            setSlEnabled(true);
                            setSlValue(calcPresetPrice(tpSlTrade, "sl", p));
                          }}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {tpSlError ? <div className="text-[11px] text-rose-300">{tpSlError}</div> : null}

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setTpSlOpen(false)}
                  disabled={tpSlBusy}
                >
                  {labels.common.cancel}
                </Button>
                <Button
                  type="button"
                  onClick={submitTpSl}
                  disabled={tpSlBusy}
                  className="bg-blue-600 hover:bg-blue-500"
                >
                  {tpSlBusy ? labels.common.updating : labels.common.confirm}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

FuturesActivityTabs.propTypes = {
  symbol: PropTypes.string.isRequired,
  language: PropTypes.string,
  trades: PropTypes.array,
  onRefresh: PropTypes.func,
  selectedTradeId: PropTypes.string,
  onSelectTrade: PropTypes.func,
  onCloseTrade: PropTypes.func,
};
