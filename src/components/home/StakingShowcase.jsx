import { useState, useEffect } from "react";
import { CheckCircle, Lock, TrendingUp, Gift, Wallet, Clock } from "lucide-react";

const STEPS = [
  { key: "stake", delay: 0 },
  { key: "lock", delay: 2200 },
  { key: "earn", delay: 4400 },
  { key: "mature", delay: 6600 },
  { key: "claim", delay: 8800 },
];

const CYCLE = 12000;

export default function StakingShowcase({ language = "en", compact = false }) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    let mounted = true;
    const timers = [];

    const runCycle = () => {
      STEPS.forEach((step, i) => {
        const t = setTimeout(() => {
          if (mounted) setActiveStep(i);
        }, step.delay);
        timers.push(t);
      });
    };

    runCycle();
    const interval = setInterval(() => {
      setActiveStep(0);
      runCycle();
    }, CYCLE);

    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
      clearInterval(interval);
    };
  }, []);

  const t = {
    en: {
      amount: "1,000 USDT",
      plan: "30 Days • 25% APY",
      earned: "TOTAL EARNED",
      earnedVal: "68.49",
      claimed: "CLAIMED",
      claimedVal: "20.54",
      available: "AVAILABLE",
      availableVal: "47.95",
      bonus: "+2,500 Bonus Points",
      steps: [
        "Staked 1,000 USDT",
        "Locked for 30 Days",
        "Earning 25% APY Daily",
        "Matured — Ready to Claim",
        "Claimed $68.49 Profit",
      ],
    },
    ar: {
      amount: "1,000 USDT",
      plan: "30 يوم • 25% سنوياً",
      earned: "إجمالي الأرباح",
      earnedVal: "68.49",
      claimed: "تم السحب",
      claimedVal: "20.54",
      available: "متاح",
      availableVal: "47.95",
      bonus: "+2,500 نقطة مكافأة",
      steps: [
        "تم إيداع 1,000 USDT",
        "مقفل لمدة 30 يوم",
        "ربح يومي بنسبة 25%",
        "اكتمل — جاهز للسحب",
        "تم سحب $68.49 ربح",
      ],
    },
  };

  const c = t[language] || t.en;
  const stepIcons = [Wallet, Lock, TrendingUp, Clock, Gift];
  const stepColors = [
    "text-blue-400 bg-blue-500/20",
    "text-amber-400 bg-amber-500/20",
    "text-emerald-400 bg-emerald-500/20",
    "text-primary bg-primary/20",
    "text-green-400 bg-green-500/20",
  ];

  const py = compact ? "p-4" : "p-5";

  // Animated counter for earnings display
  const earnMultiplier = Math.min(activeStep / 4, 1);

  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800/80 to-slate-900/90 backdrop-blur-sm overflow-hidden shadow-2xl shadow-emerald-500/5 ${compact ? "text-xs" : ""}`}>
      {/* Earnings summary header */}
      <div className={`${py} border-b border-white/5`}>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/10">
            <div className="text-[9px] text-emerald-400/70 font-bold uppercase tracking-wider">{c.earned}</div>
            <div className={`font-mono font-bold text-emerald-400 mt-0.5 transition-all duration-700 ${compact ? "text-sm" : "text-base"}`}>
              {activeStep >= 2 ? c.earnedVal : "0.00"}
            </div>
            <div className="text-[9px] text-white/30">USDT</div>
          </div>
          <div className="text-center p-2 rounded-xl bg-white/[0.04] border border-white/5">
            <div className="text-[9px] text-white/40 font-bold uppercase tracking-wider">{c.claimed}</div>
            <div className={`font-mono font-bold text-white/80 mt-0.5 ${compact ? "text-sm" : "text-base"}`}>
              {activeStep >= 4 ? c.claimedVal : "0.00"}
            </div>
            <div className="text-[9px] text-white/30">USDT</div>
          </div>
          <div className="text-center p-2 rounded-xl bg-primary/10 border border-primary/10">
            <div className="text-[9px] text-primary/70 font-bold uppercase tracking-wider">{c.available}</div>
            <div className={`font-mono font-bold text-primary mt-0.5 transition-all duration-700 ${compact ? "text-sm" : "text-base"}`}>
              {activeStep >= 3 ? c.availableVal : "0.00"}
            </div>
            <div className="text-[9px] text-white/30">USDT</div>
          </div>
        </div>

        {/* Position info */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.04] border border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Lock className="w-3 h-3 text-emerald-400" />
            </div>
            <span className="font-bold text-white text-[11px]">{c.amount}</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold">{c.plan}</span>
        </div>
      </div>

      {/* Animated steps */}
      <div className={`${py} space-y-2`}>
        {c.steps.map((label, i) => {
          const Icon = stepIcons[i];
          const isActive = i <= activeStep;
          const isCurrent = i === activeStep;
          return (
            <div
              key={i}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-500 ${
                isCurrent
                  ? "bg-white/[0.08] border border-white/10 scale-[1.02]"
                  : isActive
                  ? "bg-white/[0.03] opacity-70"
                  : "opacity-20"
              }`}
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                isActive ? stepColors[i] : "bg-white/5 text-white/20"
              }`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className={`text-[11px] font-medium transition-all duration-500 ${
                isCurrent ? "text-white" : isActive ? "text-white/60" : "text-white/20"
              }`}>
                {label}
              </span>
              {isActive && (
                <CheckCircle className="w-3 h-3 text-green-500 ml-auto flex-shrink-0" />
              )}
            </div>
          );
        })}

        {/* Bonus bar */}
        <div className={`mt-1 flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-700 ${
          activeStep >= 4 ? "bg-amber-500/10 border border-amber-500/15 opacity-100" : "opacity-0"
        }`}>
          <Gift className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] font-semibold text-amber-400">{c.bonus}</span>
        </div>
      </div>
    </div>
  );
}