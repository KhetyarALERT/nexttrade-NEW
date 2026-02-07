import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  Target, 
  ShieldAlert, 
  ChevronDown, 
  ChevronUp,
  Ban,
  CheckCircle2,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SignalShowcase({ language = "en" }) {
  const [step, setStep] = useState(0);
  const [expanded, setExpanded] = useState(true);

  // Simulation steps
  const SIMULATION = [
    {
      // Step 0: New Signal
      status: "new",
      price: 96400,
      pnl: 0,
      isAccepted: false
    },
    {
      // Step 1: Accepted (Loading/Pending)
      status: "accepted",
      price: 96420,
      pnl: 0,
      isAccepted: true
    },
    {
      // Step 2: Running Profit
      status: "running",
      price: 96600,
      pnl: 50,
      isAccepted: true
    },
    {
      // Step 3: TP Hit
      status: "closed",
      price: 96773, // TP1 Hit
      pnl: 186.5,
      isAccepted: true
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev + 1) % SIMULATION.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const currentState = SIMULATION[step];

  // Base Signal Data
  const signal = {
    symbol: "BTCUSDT",
    side: "LONG",
    max_leverage: 20,
    entry_price: 96400,
    entry_type: "MARKET",
    tp1: 96773,
    tp2: 97500,
    stop_loss: 95800,
    notes: "Bullish divergence on 4H. expecting quick pump to TP1.",
    expires_at: new Date(Date.now() + 3600000) // 1 hour from now
  };

  const isLong = signal.side === "LONG";
  
  // Render helpers
  const t = {
    en: {
      maxLev: "Max Lev",
      entry: "Entry",
      tp1: "TP1",
      sl: "SL",
      viewAnalysis: "View analysis",
      hideAnalysis: "Hide analysis",
      ignore: "Ignore",
      accept: "Accept",
      live: "Live Trade",
      pnl: "Unrealized PnL"
    },
    ar: {
      maxLev: "أقصى رافعة",
      entry: "دخول",
      tp1: "هدف 1",
      sl: "وقف",
      viewAnalysis: "عرض التحليل",
      hideAnalysis: "إخفاء التحليل",
      ignore: "تجاهل",
      accept: "قبول",
      live: "صفقة حية",
      pnl: "الربح غير المحقق"
    }
  };
  const labels = t[language] || t.en;

  // Visual override for "Accepted/Running" state
  const isRunning = currentState.isAccepted;

  return (
    <div className="relative group">
      {/* Glow effect for active state */}
      {isRunning && (
        <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-xl blur opacity-75 transition duration-1000"></div>
      )}
      
      <Card className={cn(
        "relative overflow-hidden transition-all duration-500 border-l-4 shadow-lg",
        isLong ? "border-l-green-500" : "border-l-red-500",
        "bg-card text-card-foreground"
      )}>
        {/* Header */}
        <div className="p-3 pb-2 flex justify-between items-start border-b border-border/50">
          <div className="flex flex-col gap-1 min-w-0 flex-1 pr-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-sm truncate">{signal.symbol}</span>
              <Badge 
                variant="outline" 
                className={cn(
                  "px-1.5 py-0 text-[10px] h-5 font-semibold border-0 shrink-0",
                  isLong ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                )}
              >
                {isLong ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                {signal.side}
              </Badge>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground whitespace-nowrap">
              {labels.maxLev}: {signal.max_leverage}x
            </span>
            <div className="flex items-center text-[10px] text-muted-foreground whitespace-nowrap">
              <Clock className="w-3 h-3 mr-1" />
              10:45 AM
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-3 pt-2 space-y-2">
          {/* Entry */}
          <div className="flex justify-between items-center text-sm h-6">
            <span className="text-muted-foreground text-xs">{labels.entry}</span>
            <div className="flex items-center">
              <span className="font-mono font-medium tabular-nums tracking-tight">{signal.entry_price.toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground ml-1 bg-muted px-1 rounded shrink-0">
                MKT
              </span>
            </div>
          </div>

          {/* TP / SL */}
          <div className="flex flex-col gap-1 py-1">
            <div className={`flex justify-between items-center min-w-0 h-6 rounded px-1.5 transition-colors duration-300 ${currentState.status === "closed" ? "bg-green-500/20 ring-1 ring-green-500/50" : "bg-green-500/5"}`}>
              <div className="flex items-center gap-1.5 text-green-600 text-xs shrink-0 font-medium">
                <Target className="w-3 h-3" />
                <span>{labels.tp1}</span>
              </div>
              <span className="font-mono text-sm tabular-nums text-right truncate ml-2">
                {signal.tp1.toLocaleString()}
                {currentState.status === "closed" && <CheckCircle2 className="inline w-3 h-3 ml-1 text-green-600" />}
              </span>
            </div>
            
            <div className="flex justify-between items-center min-w-0 h-6 bg-red-500/5 rounded px-1.5">
              <div className="flex items-center gap-1.5 text-red-600 text-xs shrink-0 font-medium">
                <ShieldAlert className="w-3 h-3" />
                <span>{labels.sl}</span>
              </div>
              <span className="font-mono text-sm tabular-nums text-right truncate ml-2">{signal.stop_loss.toLocaleString()}</span>
            </div>
          </div>

          {/* Notes */}
          <div className="pt-1">
            <button 
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 w-full"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? labels.hideAnalysis : labels.viewAnalysis}
            </button>
            {expanded && (
              <div className="mt-1 p-2 bg-muted/30 rounded text-xs text-muted-foreground">
                {signal.notes}
              </div>
            )}
          </div>

          {/* Dynamic Action Area */}
          <div className="pt-2">
            {!isRunning ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs w-full pointer-events-none">
                  <Ban className="w-3 h-3 mr-1.5" />
                  {labels.ignore}
                </Button>
                <Button size="sm" className="h-8 text-xs w-full bg-primary hover:bg-primary/90 pointer-events-none animate-pulse">
                  <CheckCircle2 className="w-3 h-3 mr-1.5" />
                  {labels.accept}
                </Button>
              </div>
            ) : (
              <div className="bg-muted/50 rounded-lg p-2 border border-border/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500" />
                    {labels.live}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {currentState.price.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-[10px] text-muted-foreground">{labels.pnl}</span>
                  <div className={`font-mono font-bold text-sm ${currentState.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {currentState.pnl >= 0 ? "+" : ""}{currentState.pnl.toFixed(2)} USDT
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}