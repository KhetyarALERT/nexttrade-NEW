import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";
import SignalCard from './SignalCard';
import { toast } from 'sonner';

export default function SignalsInbox({ onSignalAccepted }) {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  
  // Accept Form
  const [amount, setAmount] = useState('100');
  const [leverage, setLeverage] = useState('5');
  const [processing, setProcessing] = useState(false);

  const loadSignals = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('copyTradingUser', { action: 'getSignals' });
      if (res.data?.ok) {
        setSignals(res.data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSignals();
    const interval = setInterval(loadSignals, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAcceptClick = (signal) => {
    setSelectedSignal(signal);
    setAcceptDialogOpen(true);
  };

  const handleRejectClick = async (signal) => {
    if(!confirm('Ignore this signal?')) return;
    try {
      await base44.functions.invoke('copyTradingUser', { 
        action: 'rejectSignal', 
        signalId: signal.id 
      });
      setSignals(prev => prev.filter(s => s.id !== signal.id));
      toast.success('Signal ignored');
    } catch(e) {
      toast.error('Failed to reject signal');
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
    return <div className="p-8 text-center text-muted-foreground">Loading signals...</div>;
  }

  if (signals.length === 0) {
    return (
      <div className="p-8 text-center border-2 border-dashed rounded-xl">
        <p className="text-muted-foreground">No active signals right now.</p>
        <p className="text-xs text-muted-foreground mt-1">Wait for experts to publish new opportunities.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        Active Signals 
        <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">{signals.length}</span>
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {signals.map(signal => (
          <SignalCard 
            key={signal.id} 
            signal={signal} 
            onAccept={handleAcceptClick}
            onReject={handleRejectClick}
          />
        ))}
      </div>

      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Signal: {selectedSignal?.symbol}</DialogTitle>
            <DialogDescription>
              Allocate margin to follow this {selectedSignal?.side} signal.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Amount (USDT)</Label>
              <Input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1"> deducted from Copy Trading Balance</p>
            </div>
            <div>
              <Label>Leverage (x)</Label>
              <Input 
                type="number" 
                value={leverage} 
                onChange={e => setLeverage(e.target.value)}
                max={20}
                className="mt-1"
              />
            </div>
            
            <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
              <div className="flex justify-between">
                <span>Entry Price</span>
                <span className="font-mono">{selectedSignal?.entry_price}</span>
              </div>
              <div className="flex justify-between">
                <span>Notional Value</span>
                <span className="font-mono">{(Number(amount) * Number(leverage)).toFixed(2)} USDT</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Est. Commission</span>
                <span className="font-mono">~{(Number(amount) * Number(leverage) * 0.0005).toFixed(2)} USDT</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmAccept} disabled={processing}>
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm & Open
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}