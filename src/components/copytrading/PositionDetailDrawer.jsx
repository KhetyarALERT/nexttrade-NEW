import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Clock, TrendingUp, Target, ShieldAlert, DollarSign } from "lucide-react";

function formatUsdt(val) {
  if (val === null || val === undefined || !Number.isFinite(val)) return "—";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function formatPrice(p) {
  if (!p || !Number.isFinite(Number(p))) return "—";
  const n = Number(p);
  const digits = n < 1 ? 6 : n < 100 ? 4 : 2;
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const t = {
  en: {
    positionDetails: "Position Details",
    closed: "This position has been closed.",
    symbol: "Symbol",
    side: "Side",
    leverage: "Leverage",
    size: "Notional Size",
    margin: "Margin",
    entryPrice: "Entry Price",
    markPrice: "Mark Price",
    takeProfit: "Take Profit",
    stopLoss: "Stop Loss",
    unrealizedPnl: "Unrealized PnL",
    openedAt: "Opened",
    status: "Status",
    distanceToTp: "Distance to TP",
    distanceToSl: "Distance to SL",
  },
  ar: {
    positionDetails: "تفاصيل المركز",
    closed: "تم إغلاق هذا المركز.",
    symbol: "الرمز",
    side: "الاتجاه",
    leverage: "الرافعة",
    size: "الحجم الاسمي",
    margin: "الهامش",
    entryPrice: "سعر الدخول",
    markPrice: "سعر السوق",
    takeProfit: "جني الأرباح",
    stopLoss: "وقف الخسارة",
    unrealizedPnl: "الربح غير المحقق",
    openedAt: "تاريخ الفتح",
    status: "الحالة",
    distanceToTp: "المسافة إلى TP",
    distanceToSl: "المسافة إلى SL",
  }
};

export default function PositionDetailDrawer({ open, onOpenChange, position, currentPrice, language = "en", isMobile = false }) {
  const labels = t[language] || t.en;
  const isRTL = language === "ar";

  const computed = useMemo(() => {
    if (!position) return null;
    const entry = Number(position.entry_price) || 0;
    const mark = Number(currentPrice) || 0;
    const qty = Number(position.qty_base) || (entry > 0 ? (Number(position.notional_usdt) || 0) / entry : 0);
    const margin = Number(position.margin_usdt) || (Number(position.notional_usdt) || 0) / (Number(position.leverage) || 1);
    const isLong = position.side === "LONG";

    const rawPnl = mark > 0 && entry > 0
      ? (isLong ? (mark - entry) * qty : (entry - mark) * qty)
      : 0;
    const pnlPct = margin > 0 ? (rawPnl / margin) * 100 : 0;

    const tp = Number(position.tp1) || Number(position.take_profit) || 0;
    const sl = Number(position.stop_loss) || 0;

    const tpDistPct = tp > 0 && entry > 0
      ? ((isLong ? tp - mark : mark - tp) / mark) * 100
      : null;
    const slDistPct = sl > 0 && entry > 0
      ? ((isLong ? mark - sl : sl - mark) / mark) * 100
      : null;

    return { entry, mark, margin, rawPnl, pnlPct, tp, sl, tpDistPct, slDistPct, qty };
  }, [position, currentPrice]);

  if (!position) return null;

  const isClosed = position.status === "CLOSED" || position.status === "LIQUIDATED";
  const isLong = position.side === "LONG";
  const isProfit = (computed?.rawPnl || 0) >= 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={`${isMobile ? "h-[85dvh] rounded-t-2xl" : "w-[380px]"} p-0 flex flex-col`}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/30 shrink-0">
          <SheetTitle className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isLong ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
              {isLong ? <ArrowUp className="w-5 h-5 text-emerald-500" /> : <ArrowDown className="w-5 h-5 text-rose-500" />}
            </div>
            <div>
              <div className="text-base font-bold tracking-tight">{position.symbol}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-[18px] font-bold border-0 rounded-md ${isLong ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                  {position.side}
                </Badge>
                <span className="text-[11px] font-mono text-muted-foreground">{position.leverage}x</span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-[18px] font-semibold rounded-md ${isClosed ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary border-primary/20"}`}>
                  {position.status}
                </Badge>
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isClosed && (
            <div className="rounded-xl bg-muted/30 border border-border/40 p-3 text-xs text-muted-foreground text-center">
              {labels.closed}
            </div>
          )}

          {/* PnL Hero */}
          {computed && !isClosed && (
            <div className={`rounded-2xl p-4 border ${isProfit ? "bg-emerald-500/[0.04] border-emerald-500/15" : "bg-rose-500/[0.04] border-rose-500/15"}`}>
              <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-1">{labels.unrealizedPnl}</div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold font-mono tabular-nums ${isProfit ? "text-emerald-500" : "text-rose-500"}`}>
                  {isProfit ? "+" : ""}{formatUsdt(computed.rawPnl)}
                </span>
                <span className={`text-sm font-mono tabular-nums ${isProfit ? "text-emerald-500/70" : "text-rose-500/70"}`}>
                  ({isProfit ? "+" : ""}{computed.pnlPct.toFixed(2)}%)
                </span>
              </div>
            </div>
          )}

          {/* Closed PnL */}
          {isClosed && position.pnl_usdt !== undefined && (
            <div className={`rounded-2xl p-4 border ${(position.pnl_usdt || 0) >= 0 ? "bg-emerald-500/[0.04] border-emerald-500/15" : "bg-rose-500/[0.04] border-rose-500/15"}`}>
              <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-1">Realized PnL</div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold font-mono tabular-nums ${(position.pnl_usdt || 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  {(position.pnl_usdt || 0) >= 0 ? "+" : ""}{formatUsdt(position.pnl_usdt)}
                </span>
                {position.pnl_pct !== undefined && (
                  <span className={`text-sm font-mono tabular-nums ${(position.pnl_pct || 0) >= 0 ? "text-emerald-500/70" : "text-rose-500/70"}`}>
                    ({(position.pnl_pct || 0) >= 0 ? "+" : ""}{Number(position.pnl_pct).toFixed(2)}%)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="space-y-1">
            <DetailRow icon={<DollarSign className="w-3.5 h-3.5" />} label={labels.entryPrice} value={formatPrice(computed?.entry)} />
            {!isClosed && computed?.mark > 0 && (
              <DetailRow icon={<TrendingUp className="w-3.5 h-3.5" />} label={labels.markPrice} value={formatPrice(computed.mark)} highlight />
            )}
            <DetailRow icon={<DollarSign className="w-3.5 h-3.5" />} label={labels.size} value={`${formatUsdt(position.notional_usdt)} USDT`} />
            <DetailRow icon={<DollarSign className="w-3.5 h-3.5" />} label={labels.margin} value={`${formatUsdt(computed?.margin)} USDT`} />
          </div>

          {/* TP/SL Section */}
          {(computed?.tp > 0 || computed?.sl > 0) && (
            <div className="space-y-1">
              {computed.tp > 0 && (
                <DetailRow
                  icon={<Target className="w-3.5 h-3.5 text-emerald-500" />}
                  label={labels.takeProfit}
                  value={formatPrice(computed.tp)}
                  sub={computed.tpDistPct !== null ? `${computed.tpDistPct >= 0 ? "+" : ""}${computed.tpDistPct.toFixed(2)}%` : null}
                  subColor={computed.tpDistPct >= 0 ? "text-emerald-500/60" : "text-rose-500/60"}
                />
              )}
              {computed.sl > 0 && (
                <DetailRow
                  icon={<ShieldAlert className="w-3.5 h-3.5 text-rose-500" />}
                  label={labels.stopLoss}
                  value={formatPrice(computed.sl)}
                  sub={computed.slDistPct !== null ? `${computed.slDistPct >= 0 ? "" : ""}${computed.slDistPct.toFixed(2)}%` : null}
                  subColor={computed.slDistPct >= 0 ? "text-emerald-500/60" : "text-rose-500/60"}
                />
              )}
            </div>
          )}

          {/* Time */}
          <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label={labels.openedAt} value={formatDate(position.opened_at || position.created_date)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({ icon, label, value, sub, subColor, highlight }) {
  return (
    <div className={`flex items-center justify-between py-2.5 px-3 rounded-xl ${highlight ? "bg-muted/30" : "hover:bg-muted/20"} transition-colors`}>
      <div className="flex items-center gap-2 text-muted-foreground/60">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-right">
        <span className={`text-[13px] font-mono font-semibold tabular-nums ${highlight ? "text-primary" : "text-foreground"}`}>{value}</span>
        {sub && <div className={`text-[10px] font-mono tabular-nums ${subColor || "text-muted-foreground/50"}`}>{sub}</div>}
      </div>
    </div>
  );
}

PositionDetailDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  position: PropTypes.object,
  currentPrice: PropTypes.number,
  language: PropTypes.string,
  isMobile: PropTypes.bool,
};