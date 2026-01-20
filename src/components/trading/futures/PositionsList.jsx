/**
 * PositionsList - Displays open positions with real-time PnL
 * Mobile-optimized cards with desktop table view
 */

import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  X, 
  Target, 
  ShieldAlert, 
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Loader2
} from "lucide-react";

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
  if (n >= 1000) return `$${(n / 1000).toFixed(2)}K`;
  if (n < 1) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(2)}`;
}

function PositionCard({ 
  position, 
  markPrice, 
  language, 
  onClose, 
  isClosing,
  expanded,
  onToggleExpand 
}) {
  const isAr = language === "ar";
  
  const symbol = position?.instId || position?.symbol || "—";
  const side = String(position?.side || position?.posSide || "long").toUpperCase();
  const isLong = side === "LONG" || side === "NET" && Number(position?.size) > 0;
  const actualSide = isLong ? "LONG" : "SHORT";
  
  const entry = Number(position?.avgPx || position?.entry_price || 0);
  const mark = Number(markPrice || position?.markPx || position?.mark_price || 0);
  const size = Math.abs(Number(position?.size || position?.quantity || 0));
  const margin = Number(position?.margin || 0);
  const leverage = Number(position?.lever || position?.leverage || 1);
  const liqPrice = Number(position?.liqPx || position?.liquidation_price || 0);
  
  // Calculate PnL
  let pnl = Number(position?.upl || position?.unrealized_pnl || 0);
  if (mark > 0 && entry > 0 && size > 0) {
    pnl = actualSide === "SHORT" ? (entry - mark) * size : (mark - entry) * size;
  }
  
  const pnlPct = margin > 0 ? (pnl / margin) * 100 : 0;
  const isPnlPositive = pnl >= 0;
  
  // Liquidation distance
  const liqDistPct = mark > 0 && liqPrice > 0 ? (Math.abs(mark - liqPrice) / mark) * 100 : 0;
  const isLiqNear = liqDistPct > 0 && liqDistPct < 10;

  const baseAsset = symbol.replace(/-USDT.*$/, "").replace(/USDT.*$/, "");

  const labels = useMemo(() => ({
    entry: isAr ? "سعر الدخول" : "Entry",
    mark: isAr ? "سعر المارك" : "Mark",
    size: isAr ? "الحجم" : "Size",
    margin: isAr ? "الهامش" : "Margin",
    pnl: isAr ? "الربح" : "PnL",
    liq: isAr ? "سعر التصفية" : "Liq. Price",
    close: isAr ? "إغلاق" : "Close",
    closing: isAr ? "جارٍ الإغلاق..." : "Closing...",
    liqWarning: isAr ? "قريب من التصفية" : "Near liquidation",
  }), [isAr]);

  return (
    <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${
      isLiqNear 
        ? "border-rose-500/50 bg-rose-500/5" 
        : "border-border bg-card hover:border-border"
    }`}>
      {/* Header - Always visible */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full px-3 py-2.5 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-lg ${isLong ? "bg-emerald-500/15" : "bg-rose-500/15"}`}>
            {isLong ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
            )}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm text-foreground">{symbol}</span>
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                isLong ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
              }`}>
                {actualSide}
              </span>
              <span className="text-[9px] font-medium text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded">
                {leverage}x
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`font-mono text-sm font-semibold ${isPnlPositive ? "text-emerald-400" : "text-rose-400"}`}>
              {isPnlPositive ? "+" : ""}{formatNum(pnl, 2)}
            </div>
            <div className={`text-[10px] font-mono ${isPnlPositive ? "text-emerald-400/70" : "text-rose-400/70"}`}>
              {isPnlPositive ? "+" : ""}{pnlPct.toFixed(2)}%
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-border/50">
          {/* Stats Grid */}
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div className="bg-background/50 rounded-lg p-2">
              <div className="text-[10px] text-muted-foreground">{labels.entry}</div>
              <div className="font-mono text-sm text-foreground">{formatCompactPrice(entry)}</div>
            </div>
            <div className="bg-background/50 rounded-lg p-2">
              <div className="text-[10px] text-muted-foreground">{labels.mark}</div>
              <div className="font-mono text-sm text-foreground">{formatCompactPrice(mark)}</div>
            </div>
            <div className="bg-background/50 rounded-lg p-2">
              <div className="text-[10px] text-muted-foreground">{labels.size}</div>
              <div className="font-mono text-sm text-foreground">{formatNum(size, 4)} {baseAsset}</div>
            </div>
            <div className="bg-background/50 rounded-lg p-2">
              <div className="text-[10px] text-muted-foreground">{labels.margin}</div>
              <div className="font-mono text-sm text-foreground">{formatNum(margin, 2)} USDT</div>
            </div>
          </div>

          {/* Liquidation Warning */}
          {isLiqNear && (
            <div className="mt-2.5 flex items-center gap-2 px-2.5 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
              <div className="flex-1">
                <span className="text-[10px] text-rose-300">{labels.liqWarning}</span>
                <span className="ml-2 text-[10px] font-mono text-rose-400">
                  {formatCompactPrice(liqPrice)} ({liqDistPct.toFixed(1)}%)
                </span>
              </div>
            </div>
          )}

          {/* TP/SL Indicators */}
          {(position?.take_profit || position?.stop_loss) && (
            <div className="mt-2.5 flex gap-2">
              {position?.take_profit && (
                <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <Target className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] text-emerald-300">TP</span>
                  <span className="ml-auto font-mono text-[10px] text-emerald-300">
                    {formatCompactPrice(position.take_profit)}
                  </span>
                </div>
              )}
              {position?.stop_loss && (
                <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  <ShieldAlert className="h-3 w-3 text-rose-400" />
                  <span className="text-[10px] text-rose-300">SL</span>
                  <span className="ml-auto font-mono text-[10px] text-rose-300">
                    {formatCompactPrice(position.stop_loss)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Close Button */}
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="w-full mt-3 h-9 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30"
            onClick={() => onClose?.(position)}
            disabled={isClosing}
          >
            {isClosing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                {labels.closing}
              </>
            ) : (
              <>
                <X className="h-3.5 w-3.5 mr-1.5" />
                {labels.close}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

PositionCard.propTypes = {
  position: PropTypes.object.isRequired,
  markPrice: PropTypes.number,
  language: PropTypes.string,
  onClose: PropTypes.func,
  isClosing: PropTypes.bool,
  expanded: PropTypes.bool,
  onToggleExpand: PropTypes.func,
};

export default function PositionsList({
  positions = [],
  markPrices = {},
  language = "en",
  onClosePosition,
  closingPositionId = null,
}) {
  const isAr = language === "ar";
  const [expandedId, setExpandedId] = useState(null);

  const labels = useMemo(() => ({
    noPositions: isAr ? "لا توجد مراكز مفتوحة" : "No Open Positions",
    noPositionsHint: isAr ? "افتح صفقة لبدء التداول" : "Open a trade to get started",
    positions: isAr ? "المراكز" : "Positions",
  }), [isAr]);

  if (!positions.length) {
    return (
      <div className="p-6 text-center">
        <TrendingUp className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
        <div className="text-sm font-medium text-foreground">{labels.noPositions}</div>
        <div className="text-xs text-muted-foreground mt-1">{labels.noPositionsHint}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {positions.map((pos) => {
        const id = pos?.id || `${pos?.instId}_${pos?.posSide}`;
        const symbol = pos?.instId || pos?.symbol || "";
        const mark = markPrices[symbol] || pos?.markPx || pos?.mark_price;
        
        return (
          <PositionCard
            key={id}
            position={pos}
            markPrice={mark}
            language={language}
            onClose={onClosePosition}
            isClosing={closingPositionId === id}
            expanded={expandedId === id}
            onToggleExpand={() => setExpandedId(expandedId === id ? null : id)}
          />
        );
      })}
    </div>
  );
}

PositionsList.propTypes = {
  positions: PropTypes.array,
  markPrices: PropTypes.object,
  language: PropTypes.string,
  onClosePosition: PropTypes.func,
  closingPositionId: PropTypes.string,
};