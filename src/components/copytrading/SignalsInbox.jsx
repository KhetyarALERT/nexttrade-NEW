import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Inbox, Wallet as WalletIcon, AlertCircle } from "lucide-react";
import SignalCard from './SignalCard';
import { toast } from 'sonner';
import { ScrollArea } from "@/components/ui/scroll-area";
import AllocationModal from './AllocationModal';

export default function SignalsInbox({ onSignalAccepted, liveAccount }) {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  
  // Accept Form
  const [amount, setAmount] = useState('');
  const [leverage, setLeverage] = useState('5');
  const [processing, setProcessing] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [config, setConfig] = useState(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  const loadSignals = async () => {
    // Silent update if we already have data
    if(signals.length === 0) setLoading(true);
    try {
      const [sigsRes, walletRes, configRes] = await Promise.all([
        base44.functions.invoke('copyTradingUser', { action: 'getSignals' }),
        base44.functions.invoke('copyTradingUser', { action: 'getWallet' }),
        base44.functions.invoke('copyTradingUser', { action: 'getConfig' })
      ]);
      
      if (sigsRes.data?.ok) {
        setSignals(sigsRes.data.data || []);
      }
      if (walletRes.data?.ok) {
        setWallet(walletRes.data.data || null);
      }
      if (configRes.data?.ok) {
        setConfig(configRes.data.data || null);
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
    setAmount(''); // Reset amount
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
    
    const amtNum = Number(amount);
    if (!amtNum || amtNum <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('copyTradingUser', {
        action: 'acceptSignal',
        signalId: selectedSignal.id,
        amount: amtNum,
        leverage: Number(leverage)
      });

      if (res.data?.ok) {
        toast.success('Signal accepted! Position opened.');
        setAcceptDialogOpen(false);
        setSignals(prev => prev.filter(s => s.id !== selectedSignal.id));
        
        // Update wallet from response
        if (res.data.wallet) {
          setWallet(prev => ({
            ...prev,
            available_balance: res.data.wallet.available,
            locked_balance: res.data.wallet.locked
          }));
        }
        
        if(onSignalAccepted) onSignalAccepted();
      } else {
        const errCode = res.data?.error?.code;
        const errMsg = res.data?.error?.message || 'Failed to accept signal';
        
        if (errCode === 'INSUFFICIENT_BALANCE') {
          toast.error(errMsg, {
            action: {
              label: 'Top-up',
              onClick: () => {
                setAcceptDialogOpen(false);
                setTransferModalOpen(true);
              }
            }
          });
        } else {
          toast.error(errMsg);
        }
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
            {/* Wallet Display */}
            <div className="bg-muted/30 border border-border/50 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <WalletIcon className="w-3.5 h-3.5" />
                <span>Copy Trading Wallet</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Available</span>
                <span className="font-mono font-bold text-lg">{(wallet?.available_balance || 0).toFixed(2)} USDT</span>
              </div>
              {wallet?.locked_balance > 0 && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Allocated</span>
                  <span className="font-mono">{wallet.locked_balance.toFixed(2)} USDT</span>
                </div>
              )}
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label>Margin (USDT)</Label>
              <Input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="font-mono text-lg"
                step="0.01"
                min="0"
              />
              
              {/* Presets */}
              <div className="grid grid-cols-5 gap-1.5">
                {[25, 50, 75].map(pct => {
                  const val = ((wallet?.available_balance || 0) * pct / 100).toFixed(2);
                  return (
                    <button
                      key={pct}
                      onClick={() => setAmount(val)}
                      className="py-1 text-xs rounded bg-muted hover:bg-secondary transition-colors font-medium"
                    >
                      {pct}%
                    </button>
                  );
                })}
                <button
                  onClick={() => {
                    const available = wallet?.available_balance || 0;
                    const levNum = Number(leverage) || 5;
                    const commRate = config?.commission_open_rate || 0.0005;
                    const minComm = config?.min_commission_open || 0.05;
                    
                    // Max calculation: available = margin + commission
                    // commission = max(minComm, margin * lev * commRate)
                    // Solve for margin
                    let maxMargin = available;
                    for(let i = 0; i < 10; i++) {
                      const comm = Math.max(minComm, maxMargin * levNum * commRate);
                      const required = maxMargin + comm;
                      if (required <= available) break;
                      maxMargin = maxMargin * 0.95; // reduce by 5%
                    }
                    setAmount(Math.max(0, maxMargin).toFixed(2));
                  }}
                  className="py-1 text-xs rounded bg-primary/90 hover:bg-primary text-primary-foreground transition-colors font-bold"
                >
                  MAX
                </button>
                <button
                  onClick={() => setAmount('10')}
                  className="py-1 text-xs rounded bg-muted hover:bg-secondary transition-colors font-medium"
                >
                  10
                </button>
              </div>
            </div>
            
            {/* Leverage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Leverage</Label>
                <span className="text-xs text-muted-foreground">Max: {config?.max_leverage || 20}x</span>
              </div>
              <Input 
                type="number" 
                value={leverage} 
                onChange={e => setLeverage(e.target.value)}
                max={config?.max_leverage || 20}
                min="1"
                className="font-mono"
              />
            </div>
            
            {/* Summary */}
            <div className="bg-muted/30 p-3 rounded-lg text-sm space-y-2 border border-border/50">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Entry (Est.)</span>
                <span className="font-mono">{selectedSignal?.entry_price || '--'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Notional</span>
                <span className="font-mono font-medium text-foreground">{(Number(amount || 0) * Number(leverage)).toFixed(2)} USDT</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Fee (Est.)</span>
                <span className="font-mono text-orange-500">~{Math.max(config?.min_commission_open || 0.05, Number(amount || 0) * Number(leverage) * (config?.commission_open_rate || 0.0005)).toFixed(2)} USDT</span>
              </div>
            </div>

            {/* Validation Errors */}
            {(() => {
              const amtNum = Number(amount || 0);
              const available = wallet?.available_balance || 0;
              const levNum = Number(leverage) || 5;
              const commRate = config?.commission_open_rate || 0.0005;
              const minComm = config?.min_commission_open || 0.05;
              const comm = Math.max(minComm, amtNum * levNum * commRate);
              const required = amtNum + comm;
              const missing = required - available;
              
              if (amtNum > 0 && required > available) {
                return (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2 text-xs text-red-600">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-medium">Insufficient balance</p>
                        <p>Need {required.toFixed(2)} USDT ({amtNum.toFixed(2)} margin + {comm.toFixed(2)} fee)</p>
                        <p>Missing: {missing.toFixed(2)} USDT</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="w-full"
                      onClick={() => {
                        setAcceptDialogOpen(false);
                        setTransferModalOpen(true);
                      }}
                    >
                      <WalletIcon className="w-3.5 h-3.5 mr-2" />
                      Transfer USDT
                    </Button>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAcceptDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleConfirmAccept} 
              disabled={(() => {
                const amtNum = Number(amount || 0);
                const available = wallet?.available_balance || 0;
                const levNum = Number(leverage) || 5;
                const commRate = config?.commission_open_rate || 0.0005;
                const minComm = config?.min_commission_open || 0.05;
                const comm = Math.max(minComm, amtNum * levNum * commRate);
                const required = amtNum + comm;
                return processing || amtNum <= 0 || required > available;
              })()}
              className="bg-primary"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Trade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Modal */}
      <AllocationModal
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        onSuccess={async () => {
          // Reload wallet after transfer
          await loadSignals();
          toast.success('Funds transferred successfully');
        }}
        liveAccount={liveAccount}
        config={config}
      />
    </div>
  );
}