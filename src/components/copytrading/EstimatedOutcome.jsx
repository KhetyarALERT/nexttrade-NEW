import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const labels = {
  en: {
    title: "Estimated Outcome",
    slLabel: "Approx. SL distance",
    tpLabel: "Approx. TP distance",
    lossLabel: "Est. max loss",
    moveAgainst: "move against you",
    moveFor: "move in your favor",
    disclaimer: "Final SL/TP depends on the signal entry and market conditions.",
    reward: "Reward",
  },
  ar: {
    title: "النتائج التقديرية",
    slLabel: "مسافة وقف الخسارة التقريبية",
    tpLabel: "مسافة جني الأرباح التقريبية",
    lossLabel: "أقصى خسارة تقديرية",
    moveAgainst: "ضدك",
    moveFor: "لصالحك",
    disclaimer: "SL/TP النهائي يعتمد على سعر الدخول وظروف السوق.",
    reward: "المكافأة",
  },
};

/**
 * Pure UI estimate — no execution side-effects.
 *
 * Formulas:
 *   notional         = amount × leverage
 *   riskPercent      = fixed at 100% of margin (max loss = margin)
 *   estLossUSDT      = amount  (worst-case: entire margin)
 *   estSLMove%       = (amount / notional) × 100  =  100 / leverage
 *   estTPMove%       = estSLMove% × rewardMultiple
 */
export default function EstimatedOutcome({ amount, leverage, language = "en" }) {
  const t = labels[language] || labels.en;

  const estimate = useMemo(() => {
    const amt = Number(amount);
    const lev = Number(leverage);
    if (!amt || amt <= 0 || !lev || lev <= 0) return null;

    const notional = amt * lev;
    // SL move % = margin / notional × 100 = 100 / leverage
    const slMovePct = (amt / notional) * 100;
    // Reward multiples
    const rewardMultiple = 2;
    const tpMovePct = slMovePct * rewardMultiple;
    const estLoss = amt; // max loss capped at margin

    return {
      slMovePct: slMovePct.toFixed(2),
      tpMovePct: tpMovePct.toFixed(2),
      estLoss: estLoss.toFixed(2),
      notional: notional.toFixed(0),
      rewardMultiple,
    };
  }, [amount, leverage]);

  if (!estimate) return null;

  return (
    <div className="rounded-lg border border-border/40 bg-muted/30 p-2.5 space-y-1.5">
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

      {/* Values */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {/* SL */}
        <div className="flex items-baseline gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500/80 shrink-0 mt-[3px]" />
          <div>
            <span className="text-[10px] text-muted-foreground">{t.slLabel}</span>
            <p className="text-xs font-semibold font-mono text-rose-500">
              ~{estimate.slMovePct}%
            </p>
          </div>
        </div>
        {/* TP */}
        <div className="flex items-baseline gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shrink-0 mt-[3px]" />
          <div>
            <span className="text-[10px] text-muted-foreground">{t.tpLabel} ({t.reward} {estimate.rewardMultiple}x)</span>
            <p className="text-xs font-semibold font-mono text-emerald-500">
              ~{estimate.tpMovePct}%
            </p>
          </div>
        </div>
      </div>

      {/* Max loss line */}
      <div className="flex items-center justify-between pt-0.5 border-t border-border/30">
        <span className="text-[10px] text-muted-foreground">{t.lossLabel}</span>
        <span className="text-[11px] font-mono font-semibold text-rose-500/90">~${estimate.estLoss}</span>
      </div>
    </div>
  );
}

EstimatedOutcome.propTypes = {
  amount: PropTypes.number,
  leverage: PropTypes.number,
  language: PropTypes.string,
};