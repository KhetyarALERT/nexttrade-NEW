import React from 'react';
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
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SignalCard({ signal, onAccept, onReject, language = 'en' }) {
  const [expanded, setExpanded] = React.useState(false);
  const isLong = signal.side === 'LONG';
  
  // Format expiry nicely
  const expiry = new Date(signal.expires_at);
  const isExpired = expiry < new Date();
  // Shorten date format for mobile
  const timeStr = expiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = expiry.toLocaleDateString([], { month: 'numeric', day: 'numeric' });

  const t = {
    en: {
      maxLev: "Max Lev",
      exp: "Exp",
      expired: "Expired",
      entry: "Entry",
      tp1: "TP1",
      tp2: "TP2",
      sl: "SL",
      viewAnalysis: "View analysis",
      hideAnalysis: "Hide analysis",
      ignore: "Ignore",
      accept: "Accept"
    },
    ar: {
      maxLev: "أقصى رافعة",
      exp: "انتهاء",
      expired: "منتهي",
      entry: "دخول",
      tp1: "هدف 1",
      tp2: "هدف 2",
      sl: "وقف",
      viewAnalysis: "عرض التحليل",
      hideAnalysis: "إخفاء التحليل",
      ignore: "تجاهل",
      accept: "قبول"
    }
  };
  
  const labels = t[language] || t.en;

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-200 shadow-sm hover:shadow-md group",
      "bg-card/80 backdrop-blur-sm text-card-foreground border border-border/60 rounded-2xl"
    )}>
      {/* Header Row */}
      <div className={cn(
        "px-4 py-3 flex justify-between items-center",
        isLong ? "border-b-2 border-b-emerald-500/40" : "border-b-2 border-b-rose-500/40"
      )}>
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-xl shrink-0",
            isLong ? "bg-emerald-500/10" : "bg-rose-500/10"
          )}>
            {isLong ? <ArrowUpRight className="w-4 h-4 text-emerald-500" /> : <ArrowDownRight className="w-4 h-4 text-rose-500" />}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-[13px] tracking-tight truncate">{signal.symbol}</span>
            <div className="flex items-center gap-1.5">
              <Badge 
                variant="outline" 
                className={cn(
                  "px-1.5 py-0 text-[10px] h-[18px] font-bold border-0 rounded-md",
                  isLong ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                )}
              >
                {signal.side}
              </Badge>
              {signal.max_leverage && (
                <span className="text-[10px] font-mono text-muted-foreground/70">{signal.max_leverage}x</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 shrink-0">
          <Clock className="w-3 h-3" />
          <span className={isExpired ? "text-rose-400" : ""}>{isExpired ? labels.expired : timeStr}</span>
        </div>
      </div>

      {/* Body Content */}
      <div className="px-4 py-3 space-y-2.5">
        {/* Entry */}
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-muted-foreground/70 uppercase tracking-wider font-medium">{labels.entry}</span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[13px] font-semibold tabular-nums tracking-tight">{Number(signal.entry_price) || '--'}</span>
            <span className="text-[9px] text-muted-foreground/50 bg-muted/50 px-1 py-0.5 rounded font-medium">
              {signal.entry_type === 'MARKET' ? 'MKT' : 'LMT'}
            </span>
          </div>
        </div>

        {/* TP / SL  */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center min-w-0 h-7 bg-emerald-500/[0.04] rounded-lg px-2.5">
            <div className="flex items-center gap-1.5 text-emerald-500 text-[11px] shrink-0 font-semibold">
              <Target className="w-3 h-3" />
              <span>{labels.tp1}</span>
            </div>
            <span className="font-mono text-[13px] font-medium tabular-nums text-right truncate ml-2">{signal.tp1}</span>
          </div>
          
          <div className="flex justify-between items-center min-w-0 h-7 bg-rose-500/[0.04] rounded-lg px-2.5">
            <div className="flex items-center gap-1.5 text-rose-500 text-[11px] shrink-0 font-semibold">
              <ShieldAlert className="w-3 h-3" />
              <span>{labels.sl}</span>
            </div>
            <span className="font-mono text-[13px] font-medium tabular-nums text-right truncate ml-2">{signal.stop_loss}</span>
          </div>

          {!!Number(signal.tp2) && (
            <div className="flex justify-between items-center min-w-0 h-7 bg-emerald-500/[0.04] rounded-lg px-2.5">
              <div className="flex items-center gap-1.5 text-emerald-500/60 text-[11px] shrink-0">
                <Target className="w-3 h-3" />
                <span>{labels.tp2}</span>
              </div>
              <span className="font-mono text-[13px] font-medium tabular-nums text-right truncate ml-2 text-emerald-500/60">{signal.tp2}</span>
            </div>
          )}
        </div>

        {/* Notes Expander */}
        {signal.notes && (
          <div>
            <button 
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-muted-foreground/60 hover:text-foreground flex items-center gap-1 w-full transition-colors"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? labels.hideAnalysis : labels.viewAnalysis}
            </button>
            {expanded && (
              <div className="mt-1.5 p-2.5 bg-muted/20 rounded-lg text-xs text-muted-foreground leading-relaxed animate-in fade-in slide-in-from-top-1">
                {signal.notes}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 text-xs font-medium w-full rounded-xl border-border/50 hover:bg-muted/50"
            onClick={() => onReject(signal)}
          >
            <Ban className="w-3.5 h-3.5 mr-1.5 opacity-60" />
            {labels.ignore}
          </Button>
          <Button 
            size="sm" 
            className="h-9 text-xs font-semibold w-full rounded-xl bg-primary hover:bg-primary/90 shadow-sm shadow-primary/20"
            onClick={() => onAccept(signal)}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            {labels.accept}
          </Button>
        </div>
      </div>
    </Card>
  );
}