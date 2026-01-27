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
      "overflow-hidden transition-all duration-200 border-l-4 shadow-sm hover:shadow-md",
      isLong ? "border-l-green-500" : "border-l-red-500",
      "bg-card text-card-foreground"
    )}>
      {/* Header Row */}
      <div className="p-3 pb-2 flex justify-between items-center border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-sm sm:text-base truncate">{signal.symbol}</span>
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
        <div className="flex items-center gap-2">
          {signal.max_leverage && (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground whitespace-nowrap">
              {labels.maxLev}: {signal.max_leverage}x
            </span>
          )}
          <div className="flex items-center text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
            <Clock className="w-3 h-3 mr-1" />
            {isExpired ? labels.expired : `${labels.exp}: ${timeStr} ${dateStr}`}
          </div>
        </div>
      </div>

      {/* Body Content */}
      <div className="p-3 pt-2 space-y-2">
        {/* Entry */}
        <div className="flex justify-between items-center text-sm h-6">
          <span className="text-muted-foreground text-xs">{labels.entry}</span>
          <div className="flex items-center">
            <span className="font-mono font-medium tabular-nums tracking-tight">{Number(signal.entry_price) || '--'}</span>
            <span className="text-[10px] text-muted-foreground ml-1 bg-muted px-1 rounded shrink-0">
              {signal.entry_type === 'MARKET' ? 'MKT' : 'LMT'}
            </span>
          </div>
        </div>

        {/* TP / SL Grid - Stacked on super small screens, grid on normal mobile */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 py-1">
          {/* TP1 */}
          <div className="flex justify-between items-center min-w-0">
            <div className="flex items-center gap-1 text-green-600 text-xs shrink-0">
              <Target className="w-3 h-3" />
              <span>{labels.tp1}</span>
            </div>
            <span className="font-mono text-sm tabular-nums text-right truncate ml-2">{signal.tp1}</span>
          </div>
          
          {/* SL */}
          <div className="flex justify-between items-center min-w-0">
            <div className="flex items-center gap-1 text-red-600 text-xs shrink-0">
              <ShieldAlert className="w-3 h-3" />
              <span>{labels.sl}</span>
            </div>
            <span className="font-mono text-sm tabular-nums text-right truncate ml-2">{signal.stop_loss}</span>
          </div>

          {/* TP2 (Optional) */}
          {!!Number(signal.tp2) && (
            <div className="flex justify-between items-center col-span-2 border-t border-dashed border-border/50 mt-1 pt-1 min-w-0">
              <span className="text-[10px] text-muted-foreground shrink-0">{labels.tp2}</span>
              <span className="font-mono text-sm text-green-600/80 tabular-nums text-right truncate ml-2">{signal.tp2}</span>
            </div>
          )}
        </div>

        {/* Notes Expander */}
        {signal.notes && (
          <div className="pt-1">
            <button 
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 w-full"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? labels.hideAnalysis : labels.viewAnalysis}
            </button>
            {expanded && (
              <div className="mt-1 p-2 bg-muted/30 rounded text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1">
                {signal.notes}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 text-xs w-full"
            onClick={() => onReject(signal)}
          >
            <Ban className="w-3 h-3 mr-1.5" />
            {labels.ignore}
          </Button>
          <Button 
            size="sm" 
            className="h-8 text-xs w-full bg-primary hover:bg-primary/90"
            onClick={() => onAccept(signal)}
          >
            <CheckCircle2 className="w-3 h-3 mr-1.5" />
            {labels.accept}
          </Button>
        </div>
      </div>
    </Card>
  );
}