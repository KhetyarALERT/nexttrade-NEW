import { useMemo } from "react";
import PropTypes from "prop-types";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const labels = {
  en: {
    title: "What to Expect",
    slLabel: "SL distance",
    tpLabel: "TP distance",
    lossLabel: "Est. max loss",
    exposureLabel: "Total exposure",
    disclaimer: "Approx. based on your settings. Final SL/TP depends on each signal.",
    reward: "Reward 2×",
  },
  ar: {
    title: "ماذا تتوقع",
    slLabel: "مسافة وقف الخسارة",
    tpLabel: "مسافة جني الأرباح",
    lossLabel: "أقصى خسارة تقديرية",
    exposureLabel: "إجمالي التعرض",
    disclaimer: "تقريبي بناءً على إعداداتك. SL/TP النهائي يعتمد على كل إشارة.",
    reward: "مكافأة 2×",
  },
};

/**
 * Pure derived estimate — no stored state, recomputes on every prop change.
 *
 *   effectiveMargin  = min(amount, maxPerTrade)
 *   notional         = effectiveMargin × leverage
 *   estSLMove%       = 100 / leverage
 *   estTPMove%       = estSLMove% × 2
 *   estLossUSDT      = effectiveMargin
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
    const tpMovePct = slMovePct * 2;
    const estLoss = effectiveMargin;

    return { slMovePct, tpMovePct, estLoss, notional, effectiveMargin };
  }, [amount, leverage, maxPerTrade]);

  if (!estimate) return null;

  const fmt = (n, d = 2) => Number(n).toFixed(d);

  return (
    <div className="rounded-lg border border-border/30 bg-muted/20 p-2.5 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {t.title}
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="text-muted-foreground/40 hover:text-foreground transition-colors">
              <Info className="w-3 h-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="max-w-[220px] text-[10px] leading-relaxed p-2.5 text-muted-foreground">
            {t.disclaimer}
          </PopoverContent>
        </Popover>
      </div>

      {/* SL / TP row */}
      <div className="grid grid-cols-2 gap-x-3">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500/70 shrink-0" />
          <span className="text-[10px] text-muted-foreground">{t.slLabel}</span>
          <span className="text-xs font-semibold font-mono text-rose-500 tabular-nums ml-auto">~{fmt(estimate.slMovePct)}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 shrink-0" />
          <span className="text-[10px] text-muted-foreground">{t.tpLabel}</span>
          <span className="text-xs font-semibold font-mono text-emerald-500 tabular-nums ml-auto">~{fmt(estimate.tpMovePct)}%</span>
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between pt-1.5 border-t border-border/20 text-[10px]">
        <div>
          <span className="text-muted-foreground">{t.lossLabel}: </span>
          <span className="font-mono font-semibold text-rose-500/80 tabular-nums">~${fmt(estimate.estLoss)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">{t.exposureLabel}: </span>
          <span className="font-mono font-semibold text-foreground/60 tabular-nums">${fmt(estimate.notional, 0)}</span>
        </div>
      </div>

      {/* Disclaimer inline */}
      <p className="text-[9px] text-muted-foreground/50 leading-tight">{t.disclaimer}</p>
    </div>
  );
}

EstimatedOutcome.propTypes = {
  amount: PropTypes.number,
  leverage: PropTypes.number,
  maxPerTrade: PropTypes.number,
  language: PropTypes.string,
};