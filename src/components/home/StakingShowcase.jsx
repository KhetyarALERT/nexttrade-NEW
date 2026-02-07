import { useState, useEffect } from "react";
import { Wallet, ShieldCheck, ArrowRight, Coins, Lock } from "lucide-react";

export default function StakingShowcase({ language = "en" }) {
  const [balance, setBalance] = useState(1000.00);
  const [isStaking, setIsStaking] = useState(false);
  
  const isEn = language === "en";

  useEffect(() => {
    let interval;
    const cycle = async () => {
      // Reset
      setBalance(1000.00);
      setIsStaking(false);
      
      await new Promise(r => setTimeout(r, 1500));
      
      // Start Staking
      setIsStaking(true);
      
      // Simulate rapid earnings
      const startTime = Date.now();
      const duration = 4000;
      const targetGain = 145.20;
      
      return new Promise(resolve => {
        interval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Non-linear ease out for realism
          const ease = 1 - Math.pow(1 - progress, 3);
          
          setBalance(1000 + (targetGain * ease));
          
          if (progress >= 1) {
            clearInterval(interval);
            setTimeout(() => {
              resolve();
            }, 3000); // Show final balance for a bit
          }
        }, 30);
      }).then(cycle);
    };

    cycle();
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-[220px] rounded-2xl bg-[#0B0E11] border border-white/10 overflow-hidden flex flex-col shadow-2xl">
      {/* Decorative Gradient Background */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02] relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Coins className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100">{isEn ? "USDT Saver" : "مخزون USDT"}</div>
            <div className="text-[10px] text-emerald-400 font-medium">{isEn ? "Fixed APY" : "عائد ثابت"}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold text-amber-400">25.0%</div>
          <div className="text-[9px] text-slate-500 font-medium">APY</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-5 flex flex-col justify-center relative z-10">
        <div className="text-center mb-6">
          <div className="text-xs text-slate-400 font-medium mb-1.5 flex items-center justify-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-slate-500" />
            {isEn ? "Total Balance" : "إجمالي الرصيد"}
          </div>
          <div className="relative inline-block">
             <div className="text-4xl font-mono font-bold text-white tracking-tight">
               ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
             </div>
             {/* Glowing effect behind numbers when staking */}
             {isStaking && (
               <div className="absolute inset-0 bg-emerald-500/20 blur-xl animate-pulse rounded-full opacity-50" />
             )}
          </div>
          
          <div className={`mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors duration-300 ${isStaking ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-400"}`}>
            {isStaking ? (
              <>
                <TrendingUp className="w-3 h-3" />
                <span>{isEn ? "Earning Rewards..." : "جاري ربح المكافآت..."}</span>
              </>
            ) : (
              <>
                <Lock className="w-3 h-3" />
                <span>{isEn ? "Waiting to Stake" : "بانتظار الإيداع"}</span>
              </>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-white/5 rounded-full h-1.5 mb-2 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-100 ease-out"
            style={{ width: isStaking ? `${((balance - 1000) / 145.20) * 100}%` : '0%' }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 font-medium px-0.5">
          <span>{isEn ? "Start" : "البداية"}</span>
          <span className={isStaking ? "text-emerald-400" : ""}>{isEn ? "Maturity" : "الاستحقاق"}</span>
        </div>
      </div>

      {/* Bottom Action Area */}
      <div className="px-4 py-3 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
         <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
           <ShieldCheck className="w-3 h-3 text-emerald-500" />
           {isEn ? "Principal Protected" : "رأس المال محمي"}
         </div>
         <button className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-300 ${
           balance > 1100 
             ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 translate-y-0" 
             : "bg-white/5 text-slate-500 translate-y-0 cursor-not-allowed"
         }`}>
           {isEn ? "Claim Profit" : "سحب الأرباح"}
           <ArrowRight className="w-3 h-3" />
         </button>
      </div>
    </div>
  );
}