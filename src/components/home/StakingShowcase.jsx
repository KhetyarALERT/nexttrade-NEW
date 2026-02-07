import { useState, useEffect } from "react";
import { CheckCircle, Lock, TrendingUp, Gift, Wallet, Clock } from "lucide-react";

const STEP_DURATION = 2800;
const STEP_COUNT = 5;

export default function StakingShowcase({ language = "en", compact = false }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => (s + 1) % STEP_COUNT);
    }, STEP_DURATION);
    return () => clearInterval(interval);
  }, []);

  const isEn = language === "en";

  const sz = compact
    ? { title: "text-sm", sub: "text-[10px]", label: "text-[8px]", val: "text-[11px]" }
    : { title: "text-base", sub: "text-xs", label: "text-[10px]", val: "text-sm" };

  const screens = [
    // 0 — Deposit / stake
    () => (
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <p className={`font-bold text-white ${sz.title}`}>{isEn ? "Stake 1,000 USDT" : "إيداع 1,000 USDT"}</p>
          <p className={`text-white/40 mt-0.5 ${sz.sub}`}>{isEn ? "Select a staking plan" : "اختر خطة الستاكينغ"}</p>
        </div>
        <div className="w-full rounded-xl bg-blue-500/10 border border-blue-500/15 p-3 flex items-center justify-between">
          <span className={`text-blue-300 font-semibold ${sz.sub}`}>{isEn ? "30 Days • 25% APY" : "30 يوم • 25%"}</span>
          <span className={`font-mono font-bold text-white ${sz.val}`}>1,000 USDT</span>
        </div>
      </div>
    ),
    // 1 — Locked
    () => (
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <Lock className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <p className={`font-bold text-white ${sz.title}`}>{isEn ? "Funds Locked" : "الأموال مقفلة"}</p>
          <p className={`text-white/40 mt-0.5 ${sz.sub}`}>{isEn ? "Earning rewards daily" : "ربح مكافآت يومياً"}</p>
        </div>
        <div className="w-full rounded-xl bg-white/5 border border-white/5 p-3">
          <div className="flex justify-between mb-2">
            <span className={`text-white/40 ${sz.label}`}>{isEn ? "Progress" : "التقدم"}</span>
            <span className={`text-amber-400 font-bold ${sz.label}`}>Day 15 / 30</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all" />
          </div>
        </div>
      </div>
    ),
    // 2 — Earning
    () => (
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <p className={`font-bold text-white ${sz.title}`}>{isEn ? "Earning Daily" : "ربح يومي"}</p>
          <p className={`text-white/40 mt-0.5 ${sz.sub}`}>{isEn ? "25% APY compounding" : "25% فائدة مركبة"}</p>
        </div>
        <div className="w-full grid grid-cols-2 gap-2 mt-1">
          <div className="rounded-lg bg-emerald-500/10 p-2.5 text-center">
            <div className={`text-emerald-400/60 ${sz.label}`}>{isEn ? "Total Earned" : "إجمالي"}</div>
            <div className={`font-mono font-bold text-emerald-400 ${compact ? "text-lg" : "text-xl"}`}>$68.49</div>
          </div>
          <div className="rounded-lg bg-white/5 p-2.5 text-center">
            <div className={`text-white/40 ${sz.label}`}>{isEn ? "Daily" : "يومياً"}</div>
            <div className={`font-mono font-bold text-white ${compact ? "text-lg" : "text-xl"}`}>$2.28</div>
          </div>
        </div>
      </div>
    ),
    // 3 — Matured
    () => (
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Clock className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className={`font-bold text-white ${sz.title}`}>{isEn ? "Matured!" : "!اكتمل"}</p>
          <p className={`text-white/40 mt-0.5 ${sz.sub}`}>{isEn ? "30 days complete — ready to claim" : "30 يوم اكتملت — جاهز للسحب"}</p>
        </div>
        <div className="w-full rounded-xl bg-primary/10 border border-primary/15 p-4 text-center">
          <div className={`text-primary/60 ${sz.label}`}>{isEn ? "Available to Claim" : "متاح للسحب"}</div>
          <div className="font-mono font-extrabold text-primary text-2xl mt-0.5">$68.49</div>
          <div className={`text-primary/40 mt-1 ${sz.label}`}>{isEn ? "+ 1,000 USDT Principal" : "+ 1,000 USDT أصل"}</div>
        </div>
      </div>
    ),
    // 4 — Claimed
    () => (
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
          <Gift className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <p className={`font-bold text-white ${sz.title}`}>{isEn ? "Claimed!" : "!تم السحب"}</p>
          <p className={`text-white/40 mt-0.5 ${sz.sub}`}>{isEn ? "Rewards sent to wallet" : "المكافآت أُرسلت للمحفظة"}</p>
        </div>
        <div className="w-full rounded-xl bg-green-500/10 border border-green-500/15 p-4 text-center">
          <div className={`text-green-400/60 ${sz.label}`}>{isEn ? "Total Received" : "إجمالي المستلم"}</div>
          <div className="font-mono font-extrabold text-green-400 text-2xl mt-0.5">$1,068.49</div>
        </div>
        <div className="w-full rounded-lg bg-amber-500/10 border border-amber-500/10 px-3 py-2 flex items-center justify-center gap-1.5">
          <Gift className="w-3 h-3 text-amber-400" />
          <span className={`text-amber-400 font-semibold ${sz.sub}`}>{isEn ? "+2,500 Bonus Points" : "+2,500 نقطة مكافأة"}</span>
        </div>
      </div>
    ),
  ];

  const pad = compact ? "p-4" : "p-5";

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800/80 to-slate-900/90 backdrop-blur-sm overflow-hidden shadow-2xl shadow-emerald-500/5">
      {/* Top bar */}
      <div className={`${pad} pb-3 flex items-center justify-between border-b border-white/5`}>
        <div className="flex items-center gap-2">
          <Lock className={`text-emerald-400 ${compact ? "w-4 h-4" : "w-5 h-5"}`} />
          <span className={`font-bold text-white ${compact ? "text-[11px]" : "text-sm"}`}>{isEn ? "Staking" : "الستاكينغ"}</span>
        </div>
        <span className={`text-emerald-400 font-bold ${compact ? "text-[9px]" : "text-[10px]"}`}>25% APY</span>
      </div>

      {/* Progress dots */}
      <div className={`${pad} py-2 flex items-center justify-center gap-1.5`}>
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-500 ${
              i === step
                ? "w-5 h-1.5 bg-emerald-400"
                : i < step
                ? "w-1.5 h-1.5 bg-emerald-400/40"
                : "w-1.5 h-1.5 bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* Card content — one screen at a time */}
      <div className={`${pad} pt-1 min-h-[180px] flex items-center justify-center`}>
        <div key={step} className="w-full animate-[fadeInStake_0.4s_ease-out]">
          {screens[step]()}
        </div>
      </div>

      <style>{`
        @keyframes fadeInStake {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}