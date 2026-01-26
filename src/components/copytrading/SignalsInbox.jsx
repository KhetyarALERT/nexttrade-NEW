import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Inbox } from "lucide-react";
import SignalCard from './SignalCard';
import { toast } from 'sonner';
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SignalsInbox({ onSignalAccepted }) {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  
  // Accept Form
  const [amount, setAmount] = useState('100');
  const [leverage, setLeverage] = useState('5');
  const [processing, setProcessing] = useState(false);
  const [balance, setBalance] = useState(0);

  const loadSignals = async () => {
    // Silent update if we already have data
    if(signals.length === 0) setLoading(true);
    try {
      const [sigsRes, walletRes] = await Promise.all([
        base44.functions.invoke('copyTradingUser', { action: 'getSignals' }),
        base44.functions.invoke('copyTradingUser', { action: 'getWallet' })
      ]);
      
      if (sigsRes.data?.ok) {
        setSignals(sigsRes.data.data || []);
      }
      if (walletRes.data?.ok) {
        setBalance(walletRes.data.data?.available_balance || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSignals();
    const interval = setInterval(loadSignals, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

  const handleAcceptClick = (signal) => {
    setSelectedSignal(signal);
    setAcceptDialogOpen(true);
  };

  const handleRejectClick = async (signal) => {
    // Optimistic UI
    const originalSignals = [...signals];
    setSignals(prev => prev.filter(s => s.id !== signal.id));
    
    try {
      const res = await base44.functions.invoke('copyTradingUser', { 
        action: 'rejectSignal', 
        signalId: signal.id 
      });
      if(res.data?.ok) {
        toast.success('Signal ignored');
      } else {
        throw new Error(res.data?.error?.message);
      }
    } catch(e) {
      setSignals(originalSignals); // Revert
      toast.error('Failed to reject');
    }
  };

  const handleConfirmAccept = async () => {
    if (!selectedSignal || !amount) return;
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('copyTradingUser', {
        action: 'acceptSignal',
        signalId: selectedSignal.id,
        amount: Number(amount),
        leverage: Number(leverage)
      });

      if (res.data?.ok) {
        toast.success('Signal accepted! Position opening...');
        setAcceptDialogOpen(false);
        setSignals(prev => prev.filter(s => s.id !== selectedSignal.id));
        if(onSignalAccepted) onSignalAccepted();
      } else {
        toast.error(res.data?.error?.message || 'Failed to accept signal');
      }
    } catch (e) {
      toast.error('Failed to accept signal: ' + e.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading && signals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <span className="text-sm">Checking signals...</span>
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 border border-dashed rounded-xl m-4 bg-muted/10">
        <Inbox className="w-8 h-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm font-medium text-foreground">No active signals</p>
        <p className="text-xs text-muted-foreground mt-1">Waiting for experts...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border/50 shrink-0 bg-background/50 backdrop-blur-sm sticky top-0 z-10">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          New Signals
          <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
            {signals.length}
          </span>
        </h3>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {signals.map(signal => (
            <SignalCard 
              key={signal.id} 
              signal={signal} 
              onAccept={handleAcceptClick}
              onReject={handleRejectClick}
            />
          ))}
        </div>
      </ScrollArea>

      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Accept {selectedSignal?.symbol}</DialogTitle>
            <DialogDescription>
              Open a {selectedSignal?.side} position following this signal.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (USDT)</Label>
                <Input 
                  type="number" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)}
                  className="font-mono"
                />
                <div className="text-[10px] text-muted-foreground text-right">
                  Avail: <span className="font-mono text-foreground">{balance.toFixed(2)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Leverage (x)</Label>
                <Input 
                  type="number" 
                  value={leverage} 
                  onChange={e => setLeverage(e.target.value)}
                  max={20}
                  className="font-mono"
                />
                <div className="text-[10px] text-muted-foreground text-right">
                  Max: 20x
                </div>
              </div>
            </div>
            
            <div className="bg-muted/30 p-3 rounded-lg text-sm space-y-2 border border-border/50">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Entry Price</span>
                <span className="font-mono">{selectedSignal?.entry_price}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Est. Notional</span>
                <span className="font-mono font-medium text-foreground">{(Number(amount) * Number(leverage)).toFixed(2)} USDT</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Fee (Est.)</span>
                <span className="font-mono text-orange-500">~{(Number(amount) * Number(leverage) * 0.0005).toFixed(2)}</span>
              </div>
            </div>

            {Number(amount) > balance && (
              <div className="text-xs text-red-500 bg-red-500/10 p-2 rounded flex items-center gap-2">
                <span>Insufficient balance.</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAcceptDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleConfirmAccept} 
              disabled={processing || Number(amount) > balance || Number(amount) <= 0}
              className="bg-primary"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Trade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}