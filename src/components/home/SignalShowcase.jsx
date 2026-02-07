import { useState, useEffect } from "react";
import { CheckCircle, ArrowUpRight, TrendingUp, Zap, DollarSign } from "lucide-react";

const STEPS = [
  { key: "signal", delay: 0 },
  { key: "auto", delay: 2200 },
  { key: "open", delay: 4400 },
  { key: "profit", delay: 6600 },
  { key: "balance", delay: 8800 },
];

const CYCLE = 12000;

export default function SignalShowcase({ language = "en", compact = false }) {
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
      title: "BTC-USDT-SWAP",
      badge: "LONG",
      lev: "Lev: 5x",
      entry: "Entry",
      tp: "TP1",
      sl: "SL",
      steps: [
        "Signal Received",
        "Auto-Accept ON",
        "Trade Opened",
        "TP1 Hit — +$186",
        "Balance: $2,186",
      ],
    },
    ar: {
      title: "BTC-USDT-SWAP",
      badge: "شراء",
      lev: "رافعة: 5x",
      entry: "الدخول",
      tp: "TP1",
      sl: "SL",
      steps: [
        "إشارة مستلمة",
        "القبول التلقائي مفعّل",
        "الصفقة مفتوحة",
        "TP1 — +$186",
        "الرصيد: $2,186",
      ],
    },
  };

  const c = t[language] || t.en;
  const stepIcons = [Zap, CheckCircle, ArrowUpRight, TrendingUp, DollarSign];
  const stepColors = [
    "text-blue-400 bg-blue-500/20",
    "text-emerald-400 bg-emerald-500/20",
    "text-amber-400 bg-amber-500/20",
    "text-green-400 bg-green-500/20",
    "text-primary bg-primary/20",
  ];

  const py = compact ? "p-4" : "p-5";

  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800/80 to-slate-900/90 backdrop-blur-sm overflow-hidden shadow-2xl shadow-blue-500/5 ${compact ? "text-xs" : ""}`}>
      {/* Signal header */}
      <div className={`${py} border-b border-white/5`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`font-bold text-white ${compact ? "text-sm" : "text-base"}`}>{c.title}</span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">{c.badge}</span>
          </div>
          <span className="text-[10px] text-white/40 font-mono">{c.lev}</span>
        </div>
        
        {/* Price levels */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-white/50 text-[11px]">{c.entry}</span>
            <span className="font-mono font-bold text-white text-sm">76,438</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-green-400">{c.tp}</span>
            </span>
            <span className="font-mono font-bold text-green-400 text-sm">79,438</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-red-400">{c.sl}</span>
            </span>
            <span className="font-mono font-bold text-red-400 text-sm">75,438</span>
          </div>
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
      </div>
    </div>
  );
}