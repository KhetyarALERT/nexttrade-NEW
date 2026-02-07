import { useState, useEffect } from "react";
import { ArrowUpRight, TrendingUp, Activity, Timer, DollarSign, Share2 } from "lucide-react";

export default function SignalShowcase({ language = "en" }) {
  const [state, setState] = useState("idle"); // idle, open, running, profit, closed
  const [pnl, setPnl] = useState(0);
  const [price, setPrice] = useState(96400);
  
  const isEn = language === "en";

  useEffect(() => {
    let interval;
    const cycle = async () => {
      // Reset
      setState("idle");
      setPnl(0);
      setPrice(96400);
      
      await new Promise(r => setTimeout(r, 1500));
      
      // Open Trade
      setState("open");
      await new Promise(r => setTimeout(r, 1000));
      
      // Running - PnL ticks up
      setState("running");
      const startTime = Date.now();
      const duration = 3000;
      
      return new Promise(resolve => {
        interval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Randomize movement slightly but trending up
          const randomNoise = (Math.random() - 0.3) * 50; 
          const targetPnl = 186.50;
          const currentPnl = (targetPnl * progress) + randomNoise;
          
          setPnl(Math.max(currentPnl, -10)); // Don't go too negative
          setPrice(96400 + (currentPnl * 2)); // Correlate price to PnL
          
          if (progress >= 1) {
            clearInterval(interval);
            setState("profit");
            setPnl(186.50);
            setPrice(96773);
            setTimeout(() => {
              setState("closed");
              setTimeout(resolve, 2500); // Hold closed state
            }, 1000);
          }
        }, 50);
      }).then(cycle);
    };

    cycle();
    return () => clearInterval(interval);
  }, []);

  const getPnlColor = () => {
    if (state === "idle") return "text-slate-400";
    if (pnl >= 0) return "text-emerald-400";
    return "text-rose-400";
  };

  const pnlPercent = (pnl / 200) * 100; // Assuming $200 margin roughly

  return (
    <div className="relative w-full h-[220px] rounded-2xl bg-[#0B0E11] border border-white/10 overflow-hidden flex flex-col shadow-2xl">
      {/* Header - Exchange Style */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded bg-orange-500/20 text-orange-400">
            <span className="font-bold text-[10px]">₿</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-100">BTCUSDT</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-400 font-medium">Perp</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              {isEn ? "LONG" : "شراء"}
            </span>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">20x</span>
          </div>
        </div>
      </div>

      {/* Main Trading Area */}
      <div className="flex-1 p-4 flex flex-col justify-center relative">
        {state === "idle" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0B0E11]/80 backdrop-blur-sm z-10">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 animate-pulse">
              <Activity className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-medium text-blue-400">
                {isEn ? "Waiting for Signal..." : "بانتظار الإشارة..."}
              </span>
            </div>
          </div>
        ) : null}

        {/* PnL Display */}
        <div className="text-center space-y-1 mb-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            {isEn ? "Unrealized PNL (USDT)" : "الربح غير المحقق"}
          </div>
          <div className={`text-4xl font-mono font-bold tracking-tight transition-colors duration-200 ${getPnlColor()}`}>
            {pnl > 0 ? "+" : ""}{pnl.toFixed(2)}
          </div>
          <div className={`text-sm font-mono font-medium ${getPnlColor()}`}>
            {pnlPercent > 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
          </div>
        </div>

        {/* Trade Details Grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/5 rounded-lg p-2">
            <div className="text-[10px] text-slate-500 mb-0.5">{isEn ? "Size" : "الحجم"}</div>
            <div className="text-xs font-mono text-slate-200">0.05 BTC</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2">
            <div className="text-[10px] text-slate-500 mb-0.5">{isEn ? "Entry" : "الدخول"}</div>
            <div className="text-xs font-mono text-slate-200">96,400.0</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2">
            <div className="text-[10px] text-slate-500 mb-0.5">{isEn ? "Mark" : "السعر"}</div>
            <div className={`text-xs font-mono transition-colors ${price > 96400 ? "text-emerald-400" : "text-slate-200"}`}>
              {price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </div>
          </div>
        </div>

        {/* TP Hit Overlay */}
        {state === "closed" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-emerald-500/10 backdrop-blur-[2px] animate-in fade-in duration-300">
             <div className="bg-[#0B0E11] border border-emerald-500/30 rounded-xl p-4 shadow-2xl shadow-emerald-500/20 flex flex-col items-center gap-2 transform scale-110">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center mb-1">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div className="text-emerald-400 font-bold text-lg">{isEn ? "TP Hit!" : "هدف محقق"}</div>
                <div className="text-white font-mono text-sm">+$186.50</div>
             </div>
          </div>
        )}
      </div>

      {/* Footer Actions (Visual Only) */}
      <div className="px-4 py-3 bg-white/[0.02] border-t border-white/5 flex gap-2">
        <button className="flex-1 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-xs font-medium text-slate-400 transition-colors">
          {isEn ? "Close Position" : "إغلاق الصفقة"}
        </button>
        <button className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400">
          <Share2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}