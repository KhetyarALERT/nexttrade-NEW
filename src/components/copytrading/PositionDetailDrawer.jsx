import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { X, ArrowUp, ArrowDown, Clock, Target, ShieldAlert, TrendingUp, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { binanceFuturesStore } from "@/components/trading/binance/binanceFuturesStore";

function formatUsdt(val) {
  if (val === null || val === undefined || !Number.isFinite(val)) return "—";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function formatPrice(p) {
  if (!p || !Number.isFinite(Number(p))) return "—";
  const num = Number(p);
  const digits = num < 1 ? 6 : num < 100 ? 4 : 2;
  return num.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const t = {
  en: {
    positionDetails: "Position Details",
    closed: "Position Closed",
    closedDesc: "This position has been closed.",
    symbol: "Symbol",
    side: "Side",
    leverage: "Leverage",
    size: "Size (USDT)",
    margin: "Margin",
    entryPrice: "Entry Price",
    markPrice: "Mark Price",
    tp1: "Take Profit 1",
    tp2: "Take Profit 2",
    sl: "Stop Loss",
    tpDist: "TP Distance",
    slDist: "SL Distance",
    unrealizedPnl: "Unrealized PnL",
    openedAt: "Opened",
    status: "Status",
    close: "Close",
  },
  ar: {
    positionDetails: "تفاصيل الصفقة",
    closed: "الصفقة مغلقة",
    closedDesc: "تم إغلاق هذه الصفقة.",
    symbol: "الرمز",
    side: "الاتجاه",
    leverage: "الرافعة",
    size: "الحجم (USDT)",
    margin: "الهامش",
    entryPrice: "سعر الدخول",
    markPrice: "السعر الحالي",
    tp1: "جني الأرباح 1",
    tp2: "جني الأرباح 2",
    sl: "وقف الخسارة",
    tpDist: "مسافة TP",
    slDist: "مسافة SL",
    unrealizedPnl: "ربح/خسارة غير محققة",
    openedAt: "تاريخ الفتح",
    status: "الحالة",
    close: "إغلاق",
  }
};

function DetailRow({ label, value, valueClass = "", mono = false }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/20 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${mono ? "font-mono tabular-nums" : ""} ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

export default function PositionDetailDrawer({ position, open, onClose, isMobile = false, language = "en" }) {
  const labels = t[language] || t.en;
  const isRTL = language === "ar";
  const [livePrice, setLivePrice] = useState(0);

  // Subscribe to live price for this position's symbol
  useEffect(() => {
    if (!position?.symbol || !open) return;
    
    const ticker = binanceFuturesStore.getTicker(position.symbol);
    if (ticker?.lastPrice) setLivePrice(Number(ticker.lastPrice));

    const unsub = binanceFuturesStore.subscribe(`price:${position.symbol}`, (price) => {
      if (Number.isFinite(price)) setLivePrice(price);
    });

    return () => { try { unsub?.(); } catch {} };
  }, [position?.symbol, open]);

  // Calculate PnL
  const { pnl, pnlPct, tpDistPct, slDistPct } = useMemo(() => {
    if (!position || !livePrice || !position.entry_price) return { pnl: 0, pnlPct: 0, tpDistPct: null, slDistPct: null };
    
    const entry = Number(position.entry_price);
    const notional = Number(position.notional_usdt) || 0;
    const lev = Number(position.leverage) || 1;
    const margin = notional / lev;
    const qty = entry > 0 ? notional / entry : 0;
    
    const rawPnl = position.side === "LONG"
      ? (livePrice - entry) * qty
      : (entry - livePrice) * qty;
    const rawPct = margin > 0 ? (rawPnl / margin) * 100 : 0;

    let tpD = null;
    let slD = null;
    const tp1 = Number(position.tp1);
    const sl = Number(position.stop_loss);
    if (tp1 && entry) tpD = ((tp1 - entry) / entry * 100);
    if (sl && entry) slD = ((sl - entry) / entry * 100);

    return { pnl: rawPnl, pnlPct: rawPct, tpDistPct: tpD, slDistPct: slD };
  }, [position, livePrice]);

  if (!open) return null;

  const isProfit = pnl >= 0;
  const isClosed = position?.status === "CLOSED" || position?.status === "LIQUIDATED";

  // Overlay + drawer
  const content = (
    <div className="flex flex-col h-full" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/30 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            position?.side === "LONG" ? "bg-emerald-500/10" : "bg-rose-500/10"
          }`}>
            {position?.side === "LONG" 
              ? <ArrowUp className="w-5 h-5 text-emerald-500" /> 
              : <ArrowDown className="w-5 h-5 text-rose-500" />
            }
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-tight">{position?.symbol}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-[18px] font-bold border-0 rounded-md ${
                position?.side === "LONG" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
              }`}>
                {position?.side}
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">{position?.leverage}x</span>
              {isClosed && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-[18px] font-bold border-0 rounded-md bg-amber-500/10 text-amber-500">
                  {position?.status}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* PnL Hero */}
      {!isClosed && (
        <div className={`px-5 py-4 border-b border-border/20 ${isProfit ? "bg-emerald-500/[0.03]" : "bg-rose-500/[0.03]"}`}>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">
            {labels.unrealizedPnl}
          </div>
          <div className="flex items-baseline gap-3">
            <span className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${isProfit ? "text-emerald-500" : "text-rose-500"}`}>
              {isProfit ? "+" : ""}{formatUsdt(pnl)}
            </span>
            <span className={`text-sm font-mono tabular-nums ${isProfit ? "text-emerald-500/70" : "text-rose-500/70"}`}>
              {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {isClosed && (
        <div className="px-5 py-6 text-center border-b border-border/20 bg-muted/20">
          <p className="text-sm font-medium text-foreground">{labels.closed}</p>
          <p className="text-xs text-muted-foreground mt-1">{labels.closedDesc}</p>
        </div>
      )}

      {/* Details */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        <DetailRow label={labels.entryPrice} value={formatPrice(position?.entry_price)} mono />
        {!isClosed && livePrice > 0 && (
          <DetailRow label={labels.markPrice} value={formatPrice(livePrice)} mono />
        )}
        <DetailRow label={labels.size} value={formatUsdt(position?.notional_usdt)} mono />
        <DetailRow label={labels.margin} value={`${formatUsdt(position?.margin_usdt)} USDT`} mono />

        {/* TP/SL section */}
        {(position?.tp1 || position?.stop_loss) && (
          <div className="mt-3 mb-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
              TP / SL
            </div>
            {position?.tp1 && (
              <div className="flex items-center justify-between py-2 border-b border-border/20">
                <div className="flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">{labels.tp1}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono tabular-nums">{formatPrice(position.tp1)}</span>
                  {tpDistPct !== null && (
                    <span className="text-[10px] font-mono text-emerald-500/70">
                      ({tpDistPct >= 0 ? "+" : ""}{tpDistPct.toFixed(2)}%)
                    </span>
                  )}
                </div>
              </div>
            )}
            {!!Number(position?.tp2) && (
              <div className="flex items-center justify-between py-2 border-b border-border/20">
                <div className="flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-emerald-500/60" />
                  <span className="text-xs text-muted-foreground">{labels.tp2}</span>
                </div>
                <span className="text-sm font-mono tabular-nums">{formatPrice(position.tp2)}</span>
              </div>
            )}
            {position?.stop_loss && (
              <div className="flex items-center justify-between py-2 border-b border-border/20">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-xs text-muted-foreground">{labels.sl}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono tabular-nums">{formatPrice(position.stop_loss)}</span>
                  {slDistPct !== null && (
                    <span className="text-[10px] font-mono text-rose-500/70">
                      ({slDistPct >= 0 ? "+" : ""}{slDistPct.toFixed(2)}%)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Meta */}
        <DetailRow 
          label={labels.openedAt} 
          value={formatDate(position?.opened_at || position?.created_date)} 
        />
        <DetailRow label={labels.status} value={position?.status || "OPEN"} />
      </div>
    </div>
  );

  // Mobile: full-screen sheet
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in slide-in-from-bottom duration-200">
        {content}
      </div>
    );
  }

  // Desktop: right drawer with overlay
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-[380px] bg-background border-l border-border/30 shadow-2xl animate-in slide-in-from-right duration-200">
        {content}
      </div>
    </>
  );
}

PositionDetailDrawer.propTypes = {
  position: PropTypes.object,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  isMobile: PropTypes.bool,
  language: PropTypes.string,
};