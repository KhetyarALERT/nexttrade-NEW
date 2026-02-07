import { useState, useEffect } from "react";
import { CheckCircle, ArrowUpRight, TrendingUp, Zap, DollarSign, Bot } from "lucide-react";

const STEP_DURATION = 2800;
const STEP_COUNT = 5;

export default function SignalShowcase({ language = "en", compact = false }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => (s + 1) % STEP_COUNT);
    }, STEP_DURATION);
    return () => clearInterval(interval);
  }, []);

  const isEn = language === "en";

  // Each step is a full card "screen"
  const screens = [
    // 0 — Signal arrives
    () => (
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <Zap className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <p className={`font-bold text-white ${sz.title}`}>{isEn ? "New Signal" : "إشارة جديدة"}</p>
          <p className={`text-white/40 mt-0.5 ${sz.sub}`}>{isEn ? "BTC-USDT • LONG • 5x" : "BTC-USDT • شراء • 5x"}</p>
        </div>
        <div className="w-full grid grid-cols-3 gap-2 mt-1">
          <div className="rounded-lg bg-white/5 p-2 text-center">
            <div className={`text-white/40 ${sz.label}`}>{isEn ? "Entry" : "دخول"}</div>
            <div className={`font-mono font-bold text-white ${sz.val}`}>76,438</div>
          </div>
          <div className="rounded-lg bg-green-500/10 p-2 text-center">
            <div className={`text-green-400/60 ${sz.label}`}>TP1</div>
            <div className={`font-mono font-bold text-green-400 ${sz.val}`}>79,438</div>
          </div>
          <div className="rounded-lg bg-red-500/10 p-2 text-center">
            <div className={`text-red-400/60 ${sz.label}`}>SL</div>
            <div className={`font-mono font-bold text-red-400 ${sz.val}`}>75,438</div>
          </div>
        </div>
      </div>
    ),
    // 1 — Auto accept
    () => (
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <p className={`font-bold text-white ${sz.title}`}>{isEn ? "Auto-Accept ON" : "قبول تلقائي"}</p>
          <p className={`text-white/40 mt-0.5 ${sz.sub}`}>{isEn ? "Signal accepted automatically" : "تم قبول الإشارة تلقائياً"}</p>
        </div>
        <div className="w-full rounded-xl bg-emerald-500/10 border border-emerald-500/15 p-3 flex items-center justify-between">
          <span className={`text-emerald-400 font-semibold ${sz.sub}`}>{isEn ? "Copy Trading Bot" : "بوت نسخ التداول"}</span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>
        </div>
      </div>
    ),
    // 2 — Trade opened
    () => (
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <ArrowUpRight className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <p className={`font-bold text-white ${sz.title}`}>{isEn ? "Trade Opened" : "الصفقة مفتوحة"}</p>
          <p className={`text-white/40 mt-0.5 ${sz.sub}`}>BTC-USDT-SWAP • LONG</p>
        </div>
        <div className="w-full grid grid-cols-2 gap-2 mt-1">
          <div className="rounded-lg bg-white/5 p-2.5 text-center">
            <div className={`text-white/40 ${sz.label}`}>{isEn ? "Size" : "الحجم"}</div>
            <div className={`font-mono font-bold text-white ${sz.val}`}>$2,000</div>
          </div>
          <div className="rounded-lg bg-white/5 p-2.5 text-center">
            <div className={`text-white/40 ${sz.label}`}>{isEn ? "Leverage" : "رافعة"}</div>
            <div className={`font-mono font-bold text-white ${sz.val}`}>5x</div>
          </div>
        </div>
      </div>
    ),
    // 3 — TP Hit
    () => (
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <p className={`font-bold text-white ${sz.title}`}>{isEn ? "TP1 Hit!" : "!TP1 تم الوصول"}</p>
          <p className={`text-white/40 mt-0.5 ${sz.sub}`}>79,438 USDT</p>
        </div>
        <div className="w-full rounded-xl bg-green-500/10 border border-green-500/15 p-4 text-center">
          <div className={`text-green-400/60 ${sz.label}`}>{isEn ? "Profit" : "الربح"}</div>
          <div className="font-mono font-extrabold text-green-400 text-2xl mt-0.5">+$186.00</div>
        </div>
      </div>
    ),
    // 4 — Balance updated
    () => (
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className={`font-bold text-white ${sz.title}`}>{isEn ? "Balance Updated" : "الرصيد محدّث"}</p>
          <p className={`text-white/40 mt-0.5 ${sz.sub}`}>{isEn ? "Profit added to wallet" : "الربح أُضيف للمحفظة"}</p>
        </div>
        <div className="w-full rounded-xl bg-primary/10 border border-primary/15 p-4 text-center">
          <div className={`text-primary/60 ${sz.label}`}>{isEn ? "New Balance" : "الرصيد الجديد"}</div>
          <div className="font-mono font-extrabold text-primary text-2xl mt-0.5">$2,186.00</div>
        </div>
      </div>
    ),
  ];

  const sz = compact
    ? { title: "text-sm", sub: "text-[10px]", label: "text-[8px]", val: "text-[11px]" }
    : { title: "text-base", sub: "text-xs", label: "text-[10px]", val: "text-sm" };

  const pad = compact ? "p-4" : "p-5";

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800/80 to-slate-900/90 backdrop-blur-sm overflow-hidden shadow-2xl shadow-blue-500/5">
      {/* Top bar */}
      <div className={`${pad} pb-3 flex items-center justify-between border-b border-white/5`}>
        <div className="flex items-center gap-2">
          <Bot className={`text-blue-400 ${compact ? "w-4 h-4" : "w-5 h-5"}`} />
          <span className={`font-bold text-white ${compact ? "text-[11px]" : "text-sm"}`}>{isEn ? "Copy Trading" : "نسخ التداول"}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className={`text-green-400 font-bold ${compact ? "text-[9px]" : "text-[10px]"}`}>LIVE</span>
        </div>
      </div>

      {/* Progress dots */}
      <div className={`${pad} py-2 flex items-center justify-center gap-1.5`}>
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-500 ${
              i === step
                ? "w-5 h-1.5 bg-blue-400"
                : i < step
                ? "w-1.5 h-1.5 bg-blue-400/40"
                : "w-1.5 h-1.5 bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* Card content — one screen at a time */}
      <div className={`${pad} pt-1 min-h-[180px] flex items-center justify-center`}>
        <div key={step} className="w-full animate-[fadeIn_0.4s_ease-out]">
          {screens[step]()}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}