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

export default function SignalCard({ signal, onAccept, onReject }) {
  const [expanded, setExpanded] = React.useState(false);
  const isLong = signal.side === 'LONG';
  
  // Format expiry nicely
  const expiry = new Date(signal.expires_at);
  const isExpired = expiry < new Date();
  const timeStr = expiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = expiry.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-200 border-l-4 shadow-sm hover:shadow-md",
      isLong ? "border-l-green-500" : "border-l-red-500",
      "bg-card text-card-foreground"
    )}>
      {/* Header Row */}
      <div className="p-3 pb-2 flex justify-between items-center border-b border-border/50">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="font-bold text-base truncate">{signal.symbol}</span>
          <Badge 
            variant="outline" 
            className={cn(
              "px-1.5 py-0 text-[10px] h-5 font-semibold border-0",
              isLong ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
            )}
          >
            {isLong ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            {signal.side}
          </Badge>
        </div>
        <div className="flex items-center text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
          <Clock className="w-3 h-3 mr-1" />
          {isExpired ? 'Expired' : `Exp: ${timeStr} ${dateStr}`}
        </div>
      </div>

      {/* Body Content */}
      <div className="p-3 pt-2 space-y-2">
        {/* Entry */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground text-xs">Entry</span>
          <div className="flex items-center">
            <span className="font-mono font-medium">{signal.entry_price}</span>
            <span className="text-[10px] text-muted-foreground ml-1 bg-muted px-1 rounded">
              {signal.entry_type === 'MARKET' ? 'MKT' : 'LMT'}
            </span>
          </div>
        </div>

        {/* TP / SL Grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 py-1">
          {/* TP1 */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1 text-green-600 text-xs">
              <Target className="w-3 h-3" />
              <span>TP1</span>
            </div>
            <span className="font-mono text-sm">{signal.tp1}</span>
          </div>
          
          {/* SL */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1 text-red-600 text-xs">
              <ShieldAlert className="w-3 h-3" />
              <span>SL</span>
            </div>
            <span className="font-mono text-sm">{signal.stop_loss}</span>
          </div>

          {/* TP2 (Optional) */}
          {signal.tp2 && (
            <div className="flex justify-between items-center col-span-2 border-t border-dashed border-border/50 mt-1 pt-1">
              <span className="text-[10px] text-muted-foreground">TP2</span>
              <span className="font-mono text-sm text-green-600/80">{signal.tp2}</span>
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
              {expanded ? "Hide analysis" : "View analysis"}
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
            Ignore
          </Button>
          <Button 
            size="sm" 
            className="h-8 text-xs w-full bg-primary hover:bg-primary/90"
            onClick={() => onAccept(signal)}
          >
            <CheckCircle2 className="w-3 h-3 mr-1.5" />
            Accept
          </Button>
        </div>
      </div>
    </Card>
  );
}