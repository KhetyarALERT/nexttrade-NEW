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

import { useRef } from 'react';

export default function SignalsInbox({ onSignalAccepted, liveAccount, onSymbolFocus, preSelectedSignalId, language = 'en' }) {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const autoOpenedRef = useRef(new Set());
  
  // Accept Form
  const [amount, setAmount] = useState('');
  const [leverage, setLeverage] = useState('5');
  const [processing, setProcessing] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [config, setConfig] = useState(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [maxLevError, setMaxLevError] = useState('');

  // Translations
  const t = {
    en: {
      accept: "Accept",
      openPos: "Open a",
      posFollow: "position following this signal.",
      wallet: "Copy Trading Wallet",
      avail: "Available",
      allocated: "Allocated",
      margin: "Margin",
      enterAmt: "Enter amount",
      leverage: "Leverage",
      max: "Max",
      entryEst: "Entry (Est.)",
      notional: "Notional",
      feeEst: "Fee Details",
      fee: "Estimated Fee",
      insufficient: "Insufficient balance",
      need: "Need",
      missing: "Missing",
      transfer: "Transfer USDT",
      cancel: "Cancel",
      confirm: "Confirm Trade",
      newSignals: "New Signals",
      checking: "Checking signals...",
      noSignals: "No active signals",
      waiting: "Waiting for experts...",
      refresh: "Refresh",
      validAmt: "Please enter a valid amount",
      success: "Signal accepted! Position opened.",
      failed: "Failed to accept signal",
      ignored: "Signal ignored",
      failReject: "Failed to reject"
    },
    ar: {
      accept: "قبول",
      openPos: "فتح صفقة",
      posFollow: "بناءً على هذه الإشارة.",
      wallet: "محفظة النسخ",
      avail: "متاح",
      allocated: "مخصص",
      margin: "الهامش",
      enterAmt: "أدخل المبلغ",
      leverage: "الرافعة المالية",
      max: "الحد الأقصى",
      entryEst: "الدخول (تقديري)",
      notional: "القيمة الاسمية",
      feeEst: "تفاصيل الرسوم",
      fee: "الرسوم التقديرية",
      insufficient: "رصيد غير كافٍ",
      need: "مطلوب",
      missing: "ناقص",
      transfer: "تحويل USDT",
      cancel: "إلغاء",
      confirm: "تأكيد الصفقة",
      newSignals: "إشارات جديدة",
      checking: "جاري التحقق...",
      noSignals: "لا توجد إشارات نشطة",
      waiting: "بانتظار الخبراء...",
      refresh: "تحديث",
      validAmt: "يرجى إدخال مبلغ صحيح",
      success: "تم قبول الإشارة! تم فتح الصفقة.",
      failed: "فشل قبول الإشارة",
      ignored: "تم تجاهل الإشارة",
      failReject: "فشل التجاهل"
    }
  };
  const labels = t[language] || t.en;
  const isRTL = language === "ar";

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
    const interval = setInterval(loadSignals, 30000); // Poll every 30s to prevent rate limits
    return () => clearInterval(interval);
  }, []);

  const handleAcceptClick = (signal) => {
    setSelectedSignal(signal);
    setAmount(''); // Reset amount
    setAcceptDialogOpen(true);
    
    // Focus chart on signal symbol
    if (onSymbolFocus && signal?.symbol) {
      onSymbolFocus(signal.symbol);
    }
  };

  // Auto-open dialog if preSelectedSignalId matches
  useEffect(() => {
    if (preSelectedSignalId && signals.length > 0) {
      const target = signals.find(s => s.id === preSelectedSignalId);
      if (target && !autoOpenedRef.current.has(preSelectedSignalId)) {
        handleAcceptClick(target);
        autoOpenedRef.current.add(preSelectedSignalId);
      }
    }
  }, [signals, preSelectedSignalId]);

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

  const manualRefresh = () => {
    setLoading(true);
    loadSignals();
  };

  return (
    <div className="h-full flex flex-col bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <div className="p-4 border-b border-border/50 shrink-0 bg-background/50 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          {labels.newSignals}
          <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
            {signals.length}
          </span>
        </h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={manualRefresh}>
          <Loader2 className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      
      <ScrollArea className="flex-1 h-full">
        {loading && signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
            <span className="text-sm">{labels.checking}</span>
          </div>
        ) : signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] m-4">
            <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-xl bg-muted/10 w-full max-w-xs">
              <Inbox className="w-10 h-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-foreground">{labels.noSignals}</p>
              <p className="text-xs text-muted-foreground mt-1">{labels.waiting}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={manualRefresh}>
                {labels.refresh}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3 pb-20">
            {signals.map(signal => (
              <SignalCard 
                key={signal.id} 
                signal={signal} 
                onAccept={handleAcceptClick}
                onReject={handleRejectClick}
                language={language}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{labels.accept} {selectedSignal?.symbol}</DialogTitle>
            <DialogDescription>
              {labels.openPos} {selectedSignal?.side} {labels.posFollow}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {/* Wallet Display */}
            <div className="bg-muted/30 border border-border/50 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <WalletIcon className="w-3.5 h-3.5" />
                <span>{labels.wallet}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">{labels.avail}</span>
                <span className="font-mono font-bold text-lg">{(wallet?.available_balance || 0).toFixed(2)} USDT</span>
              </div>
              {wallet?.locked_balance > 0 && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">{labels.allocated}</span>
                  <span className="font-mono">{wallet.locked_balance.toFixed(2)} USDT</span>
                </div>
              )}
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label>{labels.margin} (USDT)</Label>
              <Input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)}
                placeholder={labels.enterAmt}
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
                <Label>{labels.leverage}</Label>
                {(() => {
                  const userMax = config?.user_max_leverage || 20;
                  const signalMax = selectedSignal?.max_leverage || 20;
                  const allowedMax = Math.min(userMax, signalMax, 100);
                  return <span className="text-xs text-muted-foreground">{labels.max}: {allowedMax}x</span>;
                })()}
              </div>
              <Input 
                type="number" 
                value={leverage} 
                onChange={e => {
                  setLeverage(e.target.value);
                  const val = Number(e.target.value);
                  const userMax = config?.user_max_leverage || 20;
                  const signalMax = selectedSignal?.max_leverage || 20;
                  const allowedMax = Math.min(userMax, signalMax, 100);
                  if (val > allowedMax) setMaxLevError(`Max ${allowedMax}x`);
                  else setMaxLevError('');
                }}
                min="1"
                className={`font-mono ${maxLevError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />
              {maxLevError && <p className="text-xs text-red-500">{maxLevError}</p>}
            </div>
            
            {/* Summary */}
            <div className="bg-muted/30 p-3 rounded-lg text-sm space-y-2 border border-border/50">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{labels.entryEst}</span>
                <span className="font-mono">{selectedSignal?.entry_price || '--'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{labels.notional}</span>
                <span className="font-mono font-medium text-foreground">{(Number(amount || 0) * Number(leverage)).toFixed(2)} USDT</span>
              </div>
              
              {/* Fee Details - Collapsible or subtle */}
              <div className="border-t border-border/50 pt-2 mt-2">
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center justify-between">
                    <span>{labels.feeEst}</span>
                    <span className="font-mono text-orange-500">~{Math.max(config?.min_commission_open || 0.05, Number(amount || 0) * Number(leverage) * (config?.commission_open_rate || 0.0005)).toFixed(2)}</span>
                  </summary>
                  <div className="pt-1 text-muted-foreground pl-2">
                    {labels.fee}: {Math.max(config?.min_commission_open || 0.05, Number(amount || 0) * Number(leverage) * (config?.commission_open_rate || 0.0005)).toFixed(4)} USDT
                  </div>
                </details>
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
                        <p className="font-medium">{labels.insufficient}</p>
                        <p>{labels.need} {required.toFixed(2)} USDT ({amtNum.toFixed(2)} {labels.margin})</p>
                        <p>{labels.missing}: {missing.toFixed(2)} USDT</p>
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
                      {labels.transfer}
                    </Button>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          <DialogFooter className={isRTL ? "gap-2" : ""}>
            <Button variant="ghost" onClick={() => setAcceptDialogOpen(false)}>{labels.cancel}</Button>
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
                return processing || amtNum <= 0 || required > available || !!maxLevError;
              })()}
              className="bg-primary"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {labels.confirm}
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