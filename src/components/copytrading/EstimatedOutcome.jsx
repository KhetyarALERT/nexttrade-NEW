import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const labels = {
  en: {
    title: "Estimated Outcome",
    slLabel: "SL distance",
    tpLabel: "TP distance",
    lossLabel: "Max loss",
    profitLabel: "Target profit",
    exposureLabel: "Total exposure",
    disclaimer: "Approx. based on your settings. Final SL/TP depends on each signal entry.",
    reward: "2× reward",
  },
  ar: {
    title: "النتائج التقديرية",
    slLabel: "مسافة وقف الخسارة",
    tpLabel: "مسافة جني الأرباح",
    lossLabel: "أقصى خسارة",
    profitLabel: "الربح المستهدف",
    exposureLabel: "إجمالي التعرض",
    disclaimer: "تقريبي بناءً على إعداداتك. SL/TP النهائي يعتمد على سعر دخول كل إشارة.",
    reward: "مكافأة 2×",
  },
};

/**
 * Pure UI estimate — no execution side-effects.
 *
 * Formulas (all derived, nothing stored):
 *   effectiveMargin  = min(amount, maxPerTrade)
 *   notional         = effectiveMargin × leverage
 *   estSLMove%       = 100 / leverage  (price move that wipes margin)
 *   estTPMove%       = estSLMove% × 2  (2:1 reward-risk)
 *   estLossUSDT      = effectiveMargin (worst-case: entire margin)
 *   estProfitUSDT    = effectiveMargin × 2
 */
export default function EstimatedOutcome({ amount, leverage, maxPerTrade, language = "en" }) {
  const t = labels[language] || labels.en;

  const estimate = useMemo(() => {
    const rawAmt = Number(amount) || 0;
    const lev = Number(leverage) || 0;
    const cap = Number(maxPerTrade) || Infinity;
    if (rawAmt <= 0 || lev <= 0) return null;

    const effectiveMargin = Math.min(rawAmt, cap);
    const notional = effectiveMargin * lev;
    const slMovePct = 100 / lev;
    const rewardMultiple = 2;
    const tpMovePct = slMovePct * rewardMultiple;
    const estLoss = effectiveMargin;
    const estProfit = effectiveMargin * rewardMultiple;

    return {
      slMovePct,
      tpMovePct,
      estLoss,
      estProfit,
      notional,
      effectiveMargin,
      rewardMultiple,
      lev,
    };
  }, [amount, leverage, maxPerTrade]);

  if (!estimate) return null;

  const fmt = (n, d = 2) => Number(n).toFixed(d);

  return (
    <div className="rounded-lg border border-border/40 bg-muted/30 p-2.5 space-y-2 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {t.title}
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="text-muted-foreground/50 hover:text-foreground transition-colors">
              <Info className="w-3 h-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="max-w-[220px] text-[10px] leading-relaxed p-2.5 text-muted-foreground">
            {t.disclaimer}
          </PopoverContent>
        </Popover>
      </div>

      {/* SL / TP row */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {/* SL */}
        <div className="flex items-start gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500/80 shrink-0 mt-1" />
          <div className="min-w-0">
            <span className="text-[10px] text-muted-foreground block leading-tight">{t.slLabel}</span>
            <span className="text-xs font-bold font-mono text-rose-500 tabular-nums">~{fmt(estimate.slMovePct)}%</span>
          </div>
        </div>
        {/* TP */}
        <div className="flex items-start gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shrink-0 mt-1" />
          <div className="min-w-0">
            <span className="text-[10px] text-muted-foreground block leading-tight">{t.tpLabel} <span className="opacity-60">({t.reward})</span></span>
            <span className="text-xs font-bold font-mono text-emerald-500 tabular-nums">~{fmt(estimate.tpMovePct)}%</span>
          </div>
        </div>
      </div>

      {/* Bottom row: loss / profit / exposure */}
      <div className="grid grid-cols-3 gap-1 pt-1 border-t border-border/30">
        <div>
          <span className="text-[9px] text-muted-foreground block">{t.lossLabel}</span>
          <span className="text-[11px] font-mono font-semibold text-rose-500/90 tabular-nums">~${fmt(estimate.estLoss)}</span>
        </div>
        <div>
          <span className="text-[9px] text-muted-foreground block">{t.profitLabel}</span>
          <span className="text-[11px] font-mono font-semibold text-emerald-500/90 tabular-nums">~${fmt(estimate.estProfit)}</span>
        </div>
        <div>
          <span className="text-[9px] text-muted-foreground block">{t.exposureLabel}</span>
          <span className="text-[11px] font-mono font-semibold text-foreground/70 tabular-nums">${fmt(estimate.notional, 0)}</span>
        </div>
      </div>
    </div>
  );
}

EstimatedOutcome.propTypes = {
  amount: PropTypes.number,
  leverage: PropTypes.number,
  maxPerTrade: PropTypes.number,
  language: PropTypes.string,
};