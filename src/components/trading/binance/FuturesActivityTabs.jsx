import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { binanceFuturesStore } from "@/components/trading/binance/binanceFuturesStore";
import { base44 } from "@/api/base44Client";
import { Pencil, Plus, X, TrendingUp, TrendingDown, ChevronRight, RefreshCw, Target, ShieldAlert, Loader2 } from "lucide-react";

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

function formatCompactPrice(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return `$${(n/1000).toFixed(2)}K`;
  if (n < 1) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(2)}`;
}

function normalizeSymbol(sym) {
  return String(sym || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

function EmptyState({ title, subtitle, icon: Icon }) {
  return (
    <div className="p-8 text-center flex flex-col items-center justify-center min-h-[200px]">
      {Icon && <Icon className="h-12 w-12 text-muted-foreground mb-4" />}
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="mt-2 text-xs text-muted-foreground max-w-[280px]">{subtitle}</div>
    </div>
  );
}

EmptyState.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  icon: PropTypes.elementType,
};

// Mobile Position Card Component
function PositionCard({ pos, mark, labels: _labels, onSelect, onClose, onEditTpSl, isSelected }) {
  const sym = normalizeSymbol(pos?.symbol);
  const entry = Number(pos?.entry_price);
  const qty = Number(pos?.quantity);
  const margin = Number(pos?.margin);
  const side = String(pos?.side || "LONG").toUpperCase();
  const baseAsset = sym.endsWith("USDT") ? sym.slice(0, -4) : sym;
  
  const pnl = Number.isFinite(mark) && Number.isFinite(entry) && Number.isFinite(qty)
    ? (side === "SHORT" ? (entry - mark) * qty : (mark - entry) * qty)
    : NaN;
  const pnlPct = Number.isFinite(pnl) && Number.isFinite(margin) && margin > 0 ? (pnl / margin) * 100 : NaN;
  const _positionValue = Number.isFinite(mark) && Number.isFinite(qty) ? mark * qty : NaN;
  const liq = Number(pos?.liquidation_price);
  const liqDistPct = Number.isFinite(mark) && mark > 0 && Number.isFinite(liq) && liq > 0
    ? (Math.abs(mark - liq) / mark) * 100
    : NaN;
  
  const isProfit = Number(pnl) >= 0;
  const SideIcon = side === "LONG" ? TrendingUp : TrendingDown;

  return (
    <div
      onClick={() => onSelect?.(pos)}
      className={`relative rounded-2xl border transition-all duration-200 overflow-hidden ${
        isSelected 
          ? "border-blue-500/50 bg-blue-500/5 shadow-lg shadow-blue-500/10" 
          : "border-border bg-gradient-to-br from-card to-card hover:border-border"
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${side === "LONG" ? "bg-emerald-500/15" : "bg-rose-500/15"}`}>
              <SideIcon className={`h-4 w-4 ${side === "LONG" ? "text-emerald-400" : "text-rose-400"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">{sym}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  side === "LONG" 
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" 
                    : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                }`}>
                  {side}
                </span>
                {pos?.leverage && (
                  <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    {pos.leverage}x
                  </span>
                )}
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      
      {/* PnL Banner */}
      <div className={`px-4 py-2.5 ${isProfit ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Unrealized PnL</span>
          <div className="text-right">
            <div className={`text-lg font-bold font-mono ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
              {isProfit ? "+" : ""}{formatNum(pnl, 2)} <span className="text-xs">USDT</span>
              {Number.isFinite(pnlPct) && (
                <span className={`ml-1 text-sm ${isProfit ? "text-emerald-400/80" : "text-rose-400/80"}`}>
                  ({isProfit ? "+" : ""}{pnlPct.toFixed(2)}%)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Entry</div>
          <div className="font-mono text-sm text-foreground">{formatCompactPrice(entry)}</div>
        </div>
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Mark</div>
          <div className="font-mono text-sm text-foreground">{formatCompactPrice(mark)}</div>
        </div>
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Size</div>
          <div className="font-mono text-sm text-foreground">{formatNum(qty, 4)} {baseAsset}</div>
        </div>
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Margin</div>
          <div className="font-mono text-sm text-foreground">{formatNum(margin, 2)} USDT</div>
        </div>
      </div>

      {/* TP/SL Row */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onEditTpSl?.(pos); }}
            className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl border transition-colors ${
              pos?.take_profit 
                ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20" 
                : "bg-muted border-border hover:bg-muted"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Target className={`h-3.5 w-3.5 ${pos?.take_profit ? "text-emerald-400" : "text-muted-foreground"}`} />
              <span className={`text-[10px] font-medium ${pos?.take_profit ? "text-emerald-300" : "text-muted-foreground"}`}>TP</span>
            </div>
            <span className={`font-mono text-xs ${pos?.take_profit ? "text-emerald-300" : "text-muted-foreground"}`}>
              {pos?.take_profit ? formatCompactPrice(pos.take_profit) : "—"}
            </span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEditTpSl?.(pos); }}
            className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl border transition-colors ${
              pos?.stop_loss 
                ? "bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20" 
                : "bg-muted border-border hover:bg-muted"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <ShieldAlert className={`h-3.5 w-3.5 ${pos?.stop_loss ? "text-rose-400" : "text-muted-foreground"}`} />
              <span className={`text-[10px] font-medium ${pos?.stop_loss ? "text-rose-300" : "text-muted-foreground"}`}>SL</span>
            </div>
            <span className={`font-mono text-xs ${pos?.stop_loss ? "text-rose-300" : "text-muted-foreground"}`}>
              {pos?.stop_loss ? formatCompactPrice(pos.stop_loss) : "—"}
            </span>
          </button>
        </div>
      </div>

      {/* Liquidation Warning */}
      {Number.isFinite(liqDistPct) && liqDistPct < 10 && (
        <div className={`px-4 py-2 border-t ${liqDistPct < 3 ? "bg-rose-500/15 border-rose-500/30" : "bg-amber-500/10 border-amber-500/20"}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-medium ${liqDistPct < 3 ? "text-rose-400" : "text-amber-400"}`}>
              ⚠️ Liq. at {formatCompactPrice(liq)}
            </span>
            <span className={`text-[10px] font-mono ${liqDistPct < 3 ? "text-rose-400" : "text-amber-400"}`}>
              {liqDistPct.toFixed(1)}% away
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="p-3 border-t border-border flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1 h-10 rounded-xl border-border text-foreground hover:bg-muted hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); onEditTpSl?.(pos); }}
        >
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          TP/SL
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="flex-1 h-10 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30"
          onClick={(e) => { e.stopPropagation(); onClose?.(pos); }}
        >
          <X className="h-3.5 w-3.5 mr-1.5" />
          Close
        </Button>
      </div>
    </div>
  );
}

PositionCard.propTypes = {
  pos: PropTypes.object.isRequired,
  mark: PropTypes.number,
  labels: PropTypes.object.isRequired,
  onSelect: PropTypes.func,
  onClose: PropTypes.func,
  onEditTpSl: PropTypes.func,
  isSelected: PropTypes.bool,
};

// Mobile Order Card
function OrderCard({ order, onCancel, isBusy, labels }) {
  const sym = normalizeSymbol(order?.symbol);
  const _isConditional = order?.kind === "TP" || order?.kind === "SL";
  
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{sym}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            order?.kind === "TP" ? "bg-emerald-500/15 text-emerald-300" :
            order?.kind === "SL" ? "bg-rose-500/15 text-rose-300" :
            "bg-blue-500/15 text-blue-300"
          }`}>
            {order?.type || order?.kind}
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onCancel?.(order)}
          disabled={isBusy}
        >
          {isBusy ? "..." : labels.common.cancel}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">Price</div>
          <div className="font-mono text-sm text-foreground">{formatCompactPrice(order?.price)}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">Qty</div>
          <div className="font-mono text-sm text-foreground">{order?.qty ? formatNum(order.qty, 4) : "—"}</div>
        </div>
      </div>
    </div>
  );
}

OrderCard.propTypes = {
  order: PropTypes.object.isRequired,
  onCancel: PropTypes.func,
  isBusy: PropTypes.bool,
  labels: PropTypes.object.isRequired,
};

// History Card for Mobile
function HistoryCard({ trade, type }) {
  const sym = normalizeSymbol(trade?.symbol);
  const pnl = trade?.pnl;
  const isProfit = Number(pnl) >= 0;
  
  return (
    <div className="rounded-xl border border-border bg-muted p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{sym}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            trade?.side === "LONG" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
          }`}>
            {trade?.side}
          </span>
        </div>
        {type === "position" && pnl !== undefined && (
          <span className={`font-mono font-semibold ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
            {isProfit ? "+" : ""}{formatNum(pnl, 2)}
          </span>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {trade?.closed_at ? new Date(trade.closed_at).toLocaleString() : 
         trade?.created_at ? new Date(trade.created_at).toLocaleString() : "—"}
      </div>
    </div>
  );
}

HistoryCard.propTypes = {
  trade: PropTypes.object.isRequired,
  type: PropTypes.string,
};

export default function FuturesActivityTabs({
  symbol,
  language,
  trades = [],
  dataSource = "demo",
  accountId = null,
  onRefresh,
  selectedTradeId,
  onSelectTrade,
  onCloseTrade,
}) {
  const [tab, setTab] = useState("positions");
  const isOkx = dataSource === "okx";
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

  const _stepForPrice = (p) => {
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

  const _wheelAdjust = (currentValue, deltaY, step) => {
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

  // Subscribe to price updates for all position symbols
  useEffect(() => {
    const symbols = Array.from(
      new Set(
        (trades || [])
          .map((t) => normalizeSymbol(t?.symbol || t?.instId))
          .filter(Boolean),
      ),
    );

    if (!symbols.length) {
      return;
    }

    const unsubs = symbols.map((s) =>
      okxFuturesStore.subscribe(`price:${s}`, (p) => {
        if (!p || !Number.isFinite(Number(p))) return;
        setMarkBySymbol((prev) => {
          if (prev[s] === Number(p)) return prev;
          return { ...prev, [s]: Number(p) };
        });
      }),
    );

    // Initialize from existing tickers
    symbols.forEach((s) => {
      const t = okxFuturesStore.getTicker(s);
      if (t?.lastPrice) {
        setMarkBySymbol((prev) => ({ ...prev, [s]: Number(t.lastPrice) }));
      }
    });

    return () => {
      unsubs.forEach((u) => {
        try { u?.(); } catch {}
      });
    };
  }, [trades.map(t => t?.symbol || t?.instId).join(",")]);

  const labels = useMemo(() => {
    const isAr = language === "ar";
    return {
      tabs: {
        positions: isAr ? "المراكز" : "Positions",
        openOrders: isAr ? "الأوامر" : "Orders",
        history: isAr ? "السجل" : "History",
      },
      empty: {
        noPositionsTitle: isAr ? "لا توجد مراكز مفتوحة" : "No Open Positions",
        noPositionsSubtitle: isAr
          ? "ابدأ التداول لرؤية مراكزك هنا"
          : "Start trading to see your positions here",
        noOpenOrdersTitle: isAr ? "لا توجد أوامر مفتوحة" : "No Open Orders",
        noOpenOrdersSubtitle: isAr ? "ستظهر الأوامر المعلقة و TP/SL هنا" : "Pending orders and TP/SL will appear here",
        noHistoryTitle: isAr ? "لا يوجد سجل" : "No History Yet",
        noHistorySubtitle: isAr ? "ستظهر الصفقات المغلقة هنا" : "Closed trades will appear here",
      },
      positions: {
        futures: isAr ? "العقود" : "Futures",
        positionValue: isAr ? "المركز/القيمة" : "Position/Value",
        unrealized: isAr ? "الربح غير المحقق" : "Unrealized PnL",
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
    if (isOkx) {
      setTpSlError(labels.common.updateFailed);
      return;
    }
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
    if (isOkx) return;
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
      if (isOkx) {
        if (!accountId || !o?.raw?.instId || !o?.raw?.id) return;
        await base44.functions.invoke("okxTrading", {
          action: "cancelOrder",
          accountId,
          instId: o.raw.instId,
          orderId: o.raw.id,
        });
      } else {
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
      }
    } finally {
      await onRefresh?.();
      setCancelBusyId(null);
    }
  };

  const tradeHistory = useMemo(
    () => (trades || []).filter((t) => String(t?.status || "").toUpperCase() === "CLOSED"),
    [trades],
  );

  return (
    <div className="h-full flex flex-col bg-background border-t border-border">
      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
        {/* Simplified Tab Header */}
        <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-card/50 shrink-0">
          <div className="flex-1 overflow-x-auto scrollbar-hide">
            <TabsList className="bg-muted/50 h-9 p-1 rounded-xl inline-flex w-auto min-w-0">
              <TabsTrigger 
                value="positions" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg text-xs font-medium px-2 sm:px-4"
              >
                {labels.tabs.positions}
                {openPositions.length > 0 && (
                  <span className="ml-1.5 bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                    {openPositions.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="openOrders" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg text-xs font-medium px-2 sm:px-4"
              >
                {labels.tabs.openOrders}
                {openOrders.length > 0 && (
                  <span className="ml-1.5 bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                    {openOrders.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg text-xs font-medium px-2 sm:px-4"
              >
                {labels.tabs.history}
              </TabsTrigger>
            </TabsList>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => onRefresh?.()}
            disabled={!onRefresh}
            title={labels.common.refresh}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Positions Tab - Mobile First */}
        <TabsContent value="positions" className="m-0 flex-1 overflow-y-auto">
          {openPositions.length === 0 ? (
            <EmptyState 
              title={labels.empty.noPositionsTitle} 
              subtitle={labels.empty.noPositionsSubtitle}
              icon={TrendingUp}
            />
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="lg:hidden p-3 space-y-3">
                {openPositions.map((pos) => (
                  <PositionCard
                    key={pos?.id || `${normalizeSymbol(pos?.symbol)}_${pos?.entry_price}`}
                    pos={pos}
                    mark={markBySymbol[normalizeSymbol(pos?.symbol)]}
                    labels={labels}
                    onSelect={onSelectTrade}
                    onClose={onCloseTrade}
                    onEditTpSl={openTpSlDialog}
                    isSelected={pos?.id === selectedTradeId}
                  />
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <Table className="min-w-[1200px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-muted-foreground">{labels.positions.futures}</TableHead>
                      <TableHead className="text-muted-foreground">{labels.positions.positionValue}</TableHead>
                      <TableHead className="text-muted-foreground">{labels.positions.unrealized}</TableHead>
                      <TableHead className="text-muted-foreground">{labels.positions.entry}</TableHead>
                      <TableHead className="text-muted-foreground">{labels.positions.mark}</TableHead>
                      <TableHead className="text-muted-foreground">{labels.positions.liq}</TableHead>
                      <TableHead className="text-muted-foreground">{labels.positions.margin}</TableHead>
                      <TableHead className="text-muted-foreground">{labels.positions.tpSl}</TableHead>
                      <TableHead className="text-muted-foreground">{labels.positions.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openPositions.map((pos) => {
                      const sym = normalizeSymbol(pos?.symbol);
                      const mark = markBySymbol[sym];
                      const entry = Number(pos?.entry_price);
                      const qty = Number(pos?.quantity);
                      const margin = Number(pos?.margin);
                      const side = String(pos?.side || "LONG").toUpperCase();
                      const baseAsset = sym.endsWith("USDT") ? sym.slice(0, -4) : sym;

                      const pnl = Number.isFinite(mark) && Number.isFinite(entry) && Number.isFinite(qty)
                        ? (side === "SHORT" ? (entry - mark) * qty : (mark - entry) * qty)
                        : NaN;
                      const pnlPct = Number.isFinite(pnl) && Number.isFinite(margin) && margin > 0 ? (pnl / margin) * 100 : NaN;
                      const positionValue = Number.isFinite(mark) && Number.isFinite(qty) ? mark * qty : NaN;

                      return (
                        <TableRow
                          key={pos?.id || `${sym}_${entry}_${qty}`}
                          className={`hover:bg-muted/50 ${pos?.id && selectedTradeId === pos.id ? "bg-muted" : ""}`}
                          onClick={() => onSelectTrade?.(pos)}
                          role={onSelectTrade ? "button" : undefined}
                          tabIndex={onSelectTrade ? 0 : undefined}
                        >
                          <TableCell className="text-foreground font-medium">
                            <div className="flex items-center gap-2">
                              <span>{sym}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                side === "LONG"
                                  ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/20"
                                  : "bg-rose-500/15 text-rose-200 border-rose-500/20"
                              }`}>
                                {side}
                              </span>
                              {pos?.leverage && <span className="text-[10px] text-amber-400">{pos.leverage}x</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-foreground">
                            <div className="leading-tight">
                              <div className="font-mono">{formatNum(qty, 4)} {baseAsset}</div>
                              <div className="font-mono text-[11px] text-muted-foreground">{formatNum(positionValue, 2)} USDT</div>
                            </div>
                          </TableCell>
                          <TableCell className={`${Number(pnl) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                            <div className="leading-tight">
                              <div className="font-mono">{Number(pnl) >= 0 ? "+" : ""}{formatNum(pnl, 2)} USDT</div>
                              <div className="font-mono text-[11px] opacity-80">{Number.isFinite(pnlPct) ? `(${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%)` : "—"}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-foreground font-mono">{formatPrice(entry)}</TableCell>
                          <TableCell className="text-foreground font-mono">{formatPrice(mark)}</TableCell>
                          <TableCell className="text-amber-300 font-mono">{formatPrice(pos?.liquidation_price)}</TableCell>
                          <TableCell className="text-foreground font-mono">{formatNum(margin, 2)} USDT</TableCell>
                          <TableCell className="text-foreground">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${pos?.take_profit ? "bg-emerald-500/10 text-emerald-200" : "text-muted-foreground"}`}>
                                TP {pos?.take_profit ? formatPrice(pos.take_profit) : "—"}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${pos?.stop_loss ? "bg-rose-500/10 text-rose-200" : "text-muted-foreground"}`}>
                                SL {pos?.stop_loss ? formatPrice(pos.stop_loss) : "—"}
                              </span>
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-muted"
                                onClick={(e) => { e.stopPropagation(); openTpSlDialog(pos); }}
                              >
                                {pos?.take_profit || pos?.stop_loss ? <Pencil className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                              </button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); openTpSlDialog(pos); }}>
                                {labels.common.tpSl}
                              </Button>
                              <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onCloseTrade?.(pos); }}>
                                {labels.common.close}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="openOrders" className="m-0 flex-1 overflow-y-auto">
          {openOrders.length === 0 ? (
            <EmptyState 
              title={labels.empty.noOpenOrdersTitle} 
              subtitle={labels.empty.noOpenOrdersSubtitle}
              icon={Target}
            />
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="lg:hidden p-3 space-y-3">
                {openOrders.map((o) => (
                  <OrderCard
                    key={o?.id}
                    order={o}
                    onCancel={cancelOpenOrder}
                    isBusy={cancelBusyId === o?.id}
                    labels={labels}
                  />
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-muted-foreground">{labels.common.symbol}</TableHead>
                      <TableHead className="text-muted-foreground">{labels.common.type}</TableHead>
                      <TableHead className="text-muted-foreground">{labels.common.side}</TableHead>
                      <TableHead className="text-muted-foreground text-right">{labels.common.price}</TableHead>
                      <TableHead className="text-muted-foreground text-right">{labels.common.qty}</TableHead>
                      <TableHead className="text-muted-foreground text-right">{labels.common.action}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openOrders.map((o) => (
                      <TableRow key={o?.id}>
                        <TableCell className="text-foreground">{normalizeSymbol(o?.symbol)}</TableCell>
                        <TableCell className="text-foreground">{o?.type}</TableCell>
                        <TableCell className="text-foreground">{o?.side}</TableCell>
                        <TableCell className="text-foreground text-right font-mono">{formatPrice(o?.price)}</TableCell>
                        <TableCell className="text-foreground text-right font-mono">{o?.qty ? formatNum(o.qty, 4) : "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => cancelOpenOrder(o)} disabled={cancelBusyId === o?.id}>
                            {cancelBusyId === o?.id ? labels.common.updating : labels.common.cancel}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="m-0 flex-1 overflow-y-auto">
          {tradeHistory.length === 0 ? (
            <EmptyState 
              title={labels.empty.noHistoryTitle} 
              subtitle={labels.empty.noHistorySubtitle}
              icon={TrendingUp}
            />
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="lg:hidden p-3 space-y-2">
                {tradeHistory.slice(0, 50).map((t) => (
                  <HistoryCard key={t?.id} trade={t} type="position" />
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-muted-foreground">{labels.common.time}</TableHead>
                      <TableHead className="text-muted-foreground">{labels.common.symbol}</TableHead>
                      <TableHead className="text-muted-foreground">{labels.common.side}</TableHead>
                      <TableHead className="text-muted-foreground text-right">{labels.common.pnl}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tradeHistory.slice(0, 50).map((t) => (
                      <TableRow key={t?.id}>
                        <TableCell className="text-foreground">{t?.closed_at ? new Date(t.closed_at).toLocaleString() : "—"}</TableCell>
                        <TableCell className="text-foreground">{normalizeSymbol(t?.symbol)}</TableCell>
                        <TableCell className="text-foreground">{t?.side}</TableCell>
                        <TableCell className={`text-right font-mono ${Number(t?.pnl) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                          {t?.pnl !== undefined ? `${Number(t.pnl) >= 0 ? "+" : ""}${formatNum(t.pnl, 2)} USDT` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* TP/SL Dialog */}
      <Dialog open={tpSlOpen} onOpenChange={(v) => { setTpSlOpen(v); if (!v) { setTpSlTrade(null); setTpSlError(""); setTpSlBusy(false); } }}>
        <DialogContent className="max-w-[400px] bg-background border border-border text-foreground rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">{labels.common.tpSl}</DialogTitle>
          </DialogHeader>

          {tpSlTrade ? (
            <div className="space-y-4">
              {/* Trade Info */}
              <div className="rounded-xl border border-border bg-muted/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-bold text-foreground">{normalizeSymbol(tpSlTrade?.symbol)}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    tpSlTrade?.side === "LONG" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
                  }`}>
                    {tpSlTrade?.side}
                  </span>
                  {tpSlTrade?.leverage && <span className="text-[10px] text-amber-400">{tpSlTrade.leverage}x</span>}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[10px] text-muted-foreground">{labels.common.entry}</div>
                    <div className="font-mono text-foreground">{formatPrice(tpSlTrade?.avg_entry_price ?? tpSlTrade?.entry_price)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">{labels.common.last}</div>
                    <div className="font-mono text-foreground">{formatPrice(markBySymbol[normalizeSymbol(tpSlTrade?.symbol)])}</div>
                  </div>
                </div>
              </div>

              {/* Take Profit */}
              <div className="rounded-xl border border-border bg-card p-4">
                <label className="flex items-center gap-3 mb-3">
                  <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={tpEnabled} onChange={(e) => setTpEnabled(e.target.checked)} />
                  <span className="font-medium text-foreground">{labels.common.takeProfit}</span>
                </label>
                {tpEnabled && (
                  <div>
                    <input
                      value={tpValue}
                      onChange={(e) => setTpValue(e.target.value)}
                      placeholder="—"
                      className="w-full rounded-xl bg-slate-950/30 border border-border px-4 py-3 text-sm text-foreground outline-none"
                      inputMode="decimal"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[10, 25, 50, 100].map((p) => (
                        <button key={`tp_${p}`} type="button" className="px-3 py-1.5 rounded-lg bg-muted text-foreground hover:bg-slate-700 text-xs" onClick={() => { setTpEnabled(true); setTpValue(calcPresetPrice(tpSlTrade, "tp", p)); }}>
                          +{p}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Stop Loss */}
              <div className="rounded-xl border border-border bg-muted/50 p-4">
                <label className="flex items-center gap-3 mb-3">
                  <input type="checkbox" className="h-4 w-4 accent-rose-500" checked={slEnabled} onChange={(e) => setSlEnabled(e.target.checked)} />
                  <span className="font-medium text-foreground">{labels.common.stopLoss}</span>
                </label>
                {slEnabled && (
                  <div>
                    <input
                      value={slValue}
                      onChange={(e) => setSlValue(e.target.value)}
                      placeholder="—"
                      className="w-full rounded-xl bg-slate-950/30 border border-border px-4 py-3 text-sm text-foreground outline-none"
                      inputMode="decimal"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[5, 10, 25, 50].map((p) => (
                        <button key={`sl_${p}`} type="button" className="px-3 py-1.5 rounded-lg bg-muted text-foreground hover:bg-slate-700 text-xs" onClick={() => { setSlEnabled(true); setSlValue(calcPresetPrice(tpSlTrade, "sl", p)); }}>
                          -{p}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {tpSlError && <div className="text-xs text-rose-400">{tpSlError}</div>}

              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="flex-1 h-11 rounded-xl" onClick={() => setTpSlOpen(false)} disabled={tpSlBusy}>
                  {labels.common.cancel}
                </Button>
                <Button type="button" className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-500" onClick={submitTpSl} disabled={tpSlBusy}>
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
  dataSource: PropTypes.string,
  accountId: PropTypes.string,
  onRefresh: PropTypes.func,
  selectedTradeId: PropTypes.string,
  onSelectTrade: PropTypes.func,
  onCloseTrade: PropTypes.func,
};