import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, Clock, Target, ShieldAlert } from "lucide-react";

export default function SignalCard({ signal, onAccept, onReject }) {
  const isLong = signal.side === 'LONG';
  
  return (
    <Card className="bg-card border-border overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-bold text-base">
              {signal.symbol}
            </Badge>
            <Badge className={isLong ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}>
              {isLong ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
              {signal.side}
            </Badge>
            <span className="text-xs text-muted-foreground ml-1">{signal.timeframe}</span>
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="w-3 h-3 mr-1" />
            {new Date(signal.expires_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <span className="text-xs text-muted-foreground block mb-1">Entry</span>
            <span className="font-mono font-medium">{signal.entry_price}</span>
            <span className="text-[10px] text-muted-foreground ml-1 capitalize">({signal.entry_type.toLowerCase()})</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block mb-1">Stop Loss</span>
            <div className="flex items-center text-red-500">
              <ShieldAlert className="w-3 h-3 mr-1" />
              <span className="font-mono font-medium">{signal.stop_loss}</span>
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block mb-1">Take Profit 1</span>
            <div className="flex items-center text-green-500">
              <Target className="w-3 h-3 mr-1" />
              <span className="font-mono font-medium">{signal.tp1}</span>
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block mb-1">Take Profit 2</span>
            <div className="flex items-center text-green-500">
              <Target className="w-3 h-3 mr-1" />
              <span className="font-mono font-medium">{signal.tp2 || '-'}</span>
            </div>
          </div>
        </div>

        {signal.notes && (
          <div className="bg-muted/30 p-2 rounded text-xs text-muted-foreground mb-4">
            {signal.notes}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => onReject(signal)}>
            Ignore
          </Button>
          <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={() => onAccept(signal)}>
            Accept Signal
          </Button>
        </div>
      </div>
    </Card>
  );
}