import { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Inbox, Wallet as WalletIcon, AlertCircle, RefreshCw, Search } from "lucide-react";
import SignalCard from './SignalCard';
import { toast } from 'sonner';
import { ScrollArea } from "@/components/ui/scroll-area";
import AllocationModal from './AllocationModal';
import AutoTradeSettings from './AutoTradeSettings';

import { useRef } from 'react';

export default function SignalsInbox({ onSignalAccepted, liveAccount, onSymbolFocus, preSelectedSignalId, language = 'en' }) {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [detailSignal, setDetailSignal] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [symbolFilter, setSymbolFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const autoOpenedRef = useRef(new Set());
  const inFlightRef = useRef(false);
  const pollTimeoutRef = useRef(null);
  const pollErrorRef = useRef(0);
  const signalsRef = useRef(signals);
  const actionStateRef = useRef(new Map());
  const [actionState, setActionState] = useState({});
  
  // Accept Form
  const [amount, setAmount] = useState('');
  const [leverage, setLeverage] = useState('5');
  const [processing, setProcessing] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [config, setConfig] = useState(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [maxLevError, setMaxLevError] = useState('');
  const authRef = useRef({ checked: false, authed: false });

  // Translations
  const t = {
    en: {
      accept: "Accept Signal",
      openPos: "Open Position",
      posFollow: "Configure your trade parameters below.",
      wallet: "Wallet",
      avail: "Avail",
      allocated: "Allocated",
      margin: "Margin (USDT)",
      enterAmt: "Amount",
      leverage: "Leverage (x)",
      max: "Max",
      entryEst: "Entry",
      notional: "Size",
      feeEst: "Fee",
      fee: "Est. Fee",
      insufficient: "Low Balance",
      need: "Req",
      missing: "Missing",
      transfer: "Deposit",
      cancel: "Cancel",
      confirm: "Confirm",
      newSignals: "Signals",
      checking: "Loading...",
      noSignals: "No signals",
      waiting: "Waiting for experts...",
      refresh: "Refresh",
      validAmt: "Invalid amount",
      success: "Trade Opened!",
      failed: "Failed",
      ignored: "Ignored",
      failReject: "Error",
      estimates: "Est. PnL",
      roi: "ROI",
      details: "Details",
      filters: "Filters",
      all: "All",
      active: "Active",
      history: "History",
      search: "Search symbol",
      autoTitle: "Copy Trading (Signals)",
      autoDesc: "Auto-accept executes new signals using your saved rules."
    },
    ar: {
      accept: "قبول الإشارة",
      openPos: "فتح صفقة",
      posFollow: "قم بإعداد تفاصيل الصفقة أدناه.",
      wallet: "المحفظة",
      avail: "متاح",
      allocated: "مخصص",
      margin: "الهامش (USDT)",
      enterAmt: "المبلغ",
      leverage: "الرافعة (x)",
      max: "أقصى",
      entryEst: "الدخول",
      notional: "الحجم",
      feeEst: "الرسوم",
      fee: "الرسوم التقديرية",
      insufficient: "رصيد منخفض",
      need: "مطلوب",
      missing: "ناقص",
      transfer: "إيداع",
      cancel: "إلغاء",
      confirm: "تأكيد",
      newSignals: "الإشارات",
      checking: "تحميل...",
      noSignals: "لا توجد إشارات",
      waiting: "بانتظار الإشارات...",
      refresh: "تحديث",
      validAmt: "مبلغ غير صحيح",
      success: "تم فتح الصفقة!",
      failed: "فشل",
      ignored: "تجاهل",
      failReject: "خطأ",
      estimates: "الربح المتوقع",
      roi: "العائد",
      details: "تفاصيل",
      filters: "فلاتر",
      all: "الكل",
      active: "نشطة",
      history: "سجل",
      search: "بحث عن الرمز",
      autoTitle: "نسخ التداول (الإشارات)",
      autoDesc: "القبول التلقائي ينفذ الإشارات الجديدة حسب إعداداتك."
    }
  };
  const labels = t[language] || t.en;
  const isRTL = language === "ar";

  useEffect(() => {
    signalsRef.current = signals;
  }, [signals]);

  const invokeWithRetry = async (action, extra = {}) => {
    const { gated } = await import("@/components/utils/apiGate");
    const key = `copyTradingUser:${action}`;
    // For user actions (acceptSignal, rejectSignal), use short interval so they execute immediately
    const isUserAction = action === 'acceptSignal' || action === 'rejectSignal';
    const res = await gated(key, () => base44.functions.invoke('copyTradingUser', { action, ...extra }), { minIntervalMs: isUserAction ? 500 : 5000 });
    return res;
  };

  const checkAuth = useCallback(async () => {
    if (authRef.current.checked) return authRef.current.authed;
    try {
      const user = await base44.auth.me().catch(() => null);
      const authed = Boolean(user);
      authRef.current = { checked: true, authed };
      return authed;
    } catch {
      authRef.current = { checked: true, authed: false };
      return false;
    }
  }, []);

  const loadSignals = useCallback(async () => {
    if (signalsRef.current.length === 0) setLoading(true);
    let success = false;
    try {
      // Stagger: signals first, then wallet+config
      const sigsRes = await invokeWithRetry('getSignals');
      if (sigsRes?.data?.ok) {
        setSignals(sigsRes.data.data || []);
        success = true;
      }

      const [walletRes, configRes] = await Promise.all([
        invokeWithRetry('getWallet'),
        invokeWithRetry('getConfig')
      ]);
      if (walletRes?.data?.ok) setWallet(walletRes.data.data || null);
      if (configRes?.data?.ok) setConfig(configRes.data.data || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
    return success;
  }, []);

  const scheduleNextPoll = useCallback((delayMs) => {
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    pollTimeoutRef.current = setTimeout(() => runPoll(), delayMs);
  }, []);

  const runPoll = useCallback(async (force = false) => {
    if (document.hidden && !force) {
      scheduleNextPoll(60000);
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const authed = await checkAuth();
      if (!authed) return;
      const ok = await loadSignals();
      pollErrorRef.current = ok ? 0 : pollErrorRef.current + 1;
    } catch (e) {
      console.error(e);
      pollErrorRef.current += 1;
    } finally {
      inFlightRef.current = false;
      const backoff = Math.min(3, pollErrorRef.current);
      scheduleNextPoll(60000 * (backoff ? 1 + backoff * 0.5 : 1));
    }
  }, [checkAuth, loadSignals, scheduleNextPoll]);

  useEffect(() => {
    runPoll(true);
    const handleVisibility = () => {
      if (!document.hidden) runPoll(true);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [runPoll]);

  const updateActionState = (signalId, next) => {
    actionStateRef.current.set(signalId, next);
    setActionState(Object.fromEntries(actionStateRef.current.entries()));
  };

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
    if (preSelectedSignalId) {
      // If signals loaded but target not found, maybe we need to refresh (rare race condition)
      if (signals.length > 0) {
        const target = signals.find(s => s.id === preSelectedSignalId);
        if (target) {
          if (!autoOpenedRef.current.has(preSelectedSignalId)) {
            handleAcceptClick(target);
            autoOpenedRef.current.add(preSelectedSignalId);
          }
        } else if (!loading) {
          // Signal ID in URL but not in list? Maybe expired or not delivered yet?
          // We could try force refresh once
          if (!autoOpenedRef.current.has('refresh_' + preSelectedSignalId)) {
            autoOpenedRef.current.add('refresh_' + preSelectedSignalId);
            runPoll(true);
          }
        }
      } else if (!loading) {
        const emptyKey = `empty_${preSelectedSignalId}`;
        if (!autoOpenedRef.current.has(emptyKey)) {
          autoOpenedRef.current.add(emptyKey);
          runPoll(true);
        }
      }
    }
  }, [signals, preSelectedSignalId, loading, runPoll]);

  const handleRejectClick = async (signal) => {
    // Optimistic UI
    const originalSignals = [...signals];
    setSignals(prev => prev.filter(s => s.id !== signal.id));
    updateActionState(signal.id, { rejecting: true });
    
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
    } finally {
      updateActionState(signal.id, { rejecting: false });
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
    updateActionState(selectedSignal.id, { accepting: true });
    try {
      const res = await base44.functions.invoke('copyTradingUser', {
        action: 'acceptSignal',
        signalId: selectedSignal.id,
        amount: amtNum,
        leverage: Number(leverage)
      });

      if (res.data?.ok) {
        // Show balance summary in toast
        const trade = res.data.trade;
        const summaryMsg = trade 
          ? (language === 'ar' 
            ? `استخدام: ${trade.margin} USDT · المتبقي: ${trade.balanceAfter?.toFixed(2)} USDT`
            : `Used: ${trade.margin} USDT · Remaining: ${trade.balanceAfter?.toFixed(2)} USDT`)
          : (language === 'ar' ? 'تم فتح الصفقة!' : 'Position opened!');
        toast.success(summaryMsg);
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
      updateActionState(selectedSignal.id, { accepting: false });
    }
  };

  const manualRefresh = () => {
    setLoading(true);
    runPoll(true);
  };

  const filters = [
    { key: "all", label: labels.all },
    { key: "new", label: labels.newSignals },
    { key: "active", label: labels.active },
    { key: "history", label: labels.history },
  ];

  const filteredSignals = useMemo(() => {
    const query = symbolFilter.trim().toUpperCase();
    return signals.filter((signal) => {
      const status = String(signal.status || "NEW").toUpperCase();
      const matchesSymbol = query ? String(signal.symbol || "").toUpperCase().includes(query) : true;
      if (!matchesSymbol) return false;
      if (statusFilter === "all") return true;
      if (statusFilter === "new") return ["NEW", "PENDING", "OPEN"].includes(status);
      if (statusFilter === "active") return ["ACTIVE", "EXECUTED"].includes(status);
      if (statusFilter === "history") return ["EXPIRED", "REJECTED", "CANCELED", "CLOSED", "FILLED"].includes(status);
      return true;
    });
  }, [signals, symbolFilter, statusFilter]);

  return (
    <div className="h-full flex flex-col bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <div className="px-4 py-3.5 border-b border-border/70 shrink-0 bg-card/95 backdrop-blur-md sticky top-0 z-10 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2.5">
          <div>
            <h3 className="text-[13px] font-semibold tracking-tight">{labels.autoTitle}</h3>
            <p className="text-[10px] text-muted-foreground/70">{labels.autoDesc}</p>
          </div>
          {filteredSignals.length > 0 && (
            <span className="bg-primary/90 text-primary-foreground text-[10px] px-2 py-0.5 rounded-lg min-w-[1.25rem] text-center font-bold shadow-sm shadow-primary/20">
              {filteredSignals.length}
            </span>
          )}
        </div>
        <button 
          onClick={manualRefresh} 
          disabled={loading}
          type="button"
          className="text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-50 p-1.5 rounded-lg hover:bg-muted/30"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      
      <ScrollArea className="flex-1 h-full">
        {/* Auto-Trade Settings - always visible at top */}
        <div className="p-4 pb-0">
          <AutoTradeSettings language={language} />
        </div>

        <div className="px-4 pt-4 space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-card/90 border border-border/70 px-3 py-2 shadow-sm">
            <Search className="h-4 w-4 text-muted-foreground/60" />
            <Input
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              placeholder={labels.search}
              className="h-7 border-0 bg-transparent p-0 text-xs focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {filters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setStatusFilter(filter.key)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-colors border ${
                  statusFilter === filter.key
                    ? "bg-primary/15 text-primary border-primary/30 shadow-sm"
                    : "bg-muted/30 text-muted-foreground border-border/60 hover:text-foreground"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {loading && signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground/50">
            <Loader2 className="w-7 h-7 animate-spin mb-3 text-primary/60" />
            <span className="text-[12px] font-medium">{labels.checking}</span>
          </div>
        ) : filteredSignals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] m-4">
            <div className="flex flex-col items-center justify-center py-10 w-full max-w-xs">
              <div className="w-14 h-14 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
                <Inbox className="w-6 h-6 text-muted-foreground/30" />
              </div>
              <p className="text-[13px] font-semibold text-foreground/70">{labels.noSignals}</p>
              <p className="text-[11px] text-muted-foreground/40 mt-1">{labels.waiting}</p>
              <Button variant="outline" size="sm" className="mt-5 rounded-xl text-[11px] h-8" onClick={manualRefresh}>
                {labels.refresh}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3 pb-20">
            {filteredSignals.map(signal => (
              <SignalCard 
                key={signal.id} 
                signal={signal} 
                onAccept={handleAcceptClick}
                onReject={handleRejectClick}
                onView={(s) => {
                  setDetailSignal(s);
                  setDetailsOpen(true);
                }}
                isAccepting={Boolean(actionState[signal.id]?.accepting)}
                isRejecting={Boolean(actionState[signal.id]?.rejecting)}
                language={language}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 gap-0" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader className="px-5 pt-5 pb-2 shrink-0">
            <DialogTitle className="text-base">{labels.accept} {selectedSignal?.symbol}</DialogTitle>
            <DialogDescription className="text-xs">
              {labels.openPos} {selectedSignal?.side} {labels.posFollow}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-5 py-2 space-y-4">
            {/* Wallet Display */}
            <div className="bg-muted/30 border border-border/50 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider">
                <WalletIcon className="w-3 h-3" />
                <span>{labels.wallet}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-muted-foreground">{labels.avail}</span>
                <span className="font-mono font-bold text-lg text-foreground">{(wallet?.available_balance || 0).toFixed(2)} <span className="text-xs font-normal text-muted-foreground">USDT</span></span>
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{labels.margin}</Label>
              <div className="relative">
                <Input 
                  type="number" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)}
                  placeholder={labels.enterAmt}
                  className="font-mono text-lg h-11 pr-12 rtl:pr-3 rtl:pl-12"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none rtl:right-auto rtl:left-3">USDT</div>
              </div>
              
              {/* Presets - Tappable and nice */}
              <div className="grid grid-cols-5 gap-2 mt-2">
                {[25, 50, 75].map(pct => {
                  const val = ((wallet?.available_balance || 0) * pct / 100).toFixed(2);
                  return (
                    <button
                      key={pct}
                      onClick={() => setAmount(val)}
                      className="py-1.5 text-[10px] rounded-md bg-muted/50 hover:bg-muted text-foreground font-medium transition-colors border border-transparent hover:border-border"
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
                    let maxMargin = available;
                    for(let i = 0; i < 10; i++) {
                      const comm = Math.max(minComm, maxMargin * levNum * commRate);
                      const required = maxMargin + comm;
                      if (required <= available) break;
                      maxMargin = maxMargin * 0.95; 
                    }
                    setAmount(Math.max(0, maxMargin).toFixed(2));
                  }}
                  className="py-1.5 text-[10px] rounded-md bg-primary/10 text-primary hover:bg-primary/20 font-bold transition-colors"
                >
                  MAX
                </button>
                <button
                  onClick={() => setAmount('10')}
                  className="py-1.5 text-[10px] rounded-md bg-muted/50 hover:bg-muted text-foreground font-medium transition-colors border border-transparent hover:border-border"
                >
                  10
                </button>
              </div>
            </div>
            
            {/* Leverage Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">{labels.leverage}</Label>
                {(() => {
                  const userMax = config?.user_max_leverage || 50;
                  const signalMax = selectedSignal?.max_leverage || 20;
                  const allowedMax = Math.min(userMax, signalMax, 100);
                  return <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{labels.max}: {allowedMax}x</span>;
                })()}
              </div>
              <div className="relative">
                <Input 
                  type="number" 
                  value={leverage} 
                  onChange={e => {
                    const val = e.target.value;
                    setLeverage(val);
                    const numVal = Number(val);
                    const userMax = config?.user_max_leverage || 50;
                    const signalMax = selectedSignal?.max_leverage || 20;
                    const allowedMax = Math.min(userMax, signalMax, 100);
                    if (numVal > allowedMax) setMaxLevError(`Max ${allowedMax}x`);
                    else setMaxLevError('');
                  }}
                  min="1"
                  max={(() => {
                    const userMax = config?.user_max_leverage || 50;
                    const signalMax = selectedSignal?.max_leverage || 20;
                    return Math.min(userMax, signalMax, 100);
                  })()}
                  inputMode="decimal"
                  className={`font-mono h-9 ${maxLevError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">x</div>
              </div>
              {maxLevError && <p className="text-[10px] text-red-500 font-medium animate-pulse">{maxLevError}</p>}
            </div>
            
            {/* Compact PnL Estimates */}
            {(() => {
              const entry = Number(selectedSignal?.entry_price) || 0;
              const side = selectedSignal?.side || 'LONG';
              const m = Number(amount) || 0;
              const l = Number(leverage) || 1;
              const notional = m * l;
              const qty = entry > 0 ? notional / entry : 0;

              const calcPnL = (targetPrice) => {
                if (!targetPrice || !qty) return null;
                const pnl = side === 'LONG' ? (targetPrice - entry) * qty : (entry - targetPrice) * qty;
                const roi = m > 0 ? (pnl / m) * 100 : 0;
                return { pnl, roi };
              };

              const tp1Est = calcPnL(selectedSignal?.tp1);
              const tp2Est = calcPnL(selectedSignal?.tp2);
              const slEst = calcPnL(selectedSignal?.stop_loss);

              if (!tp1Est && !slEst) return null;

              return (
                <div className="grid grid-cols-3 gap-2 py-1">
                  {tp1Est && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded p-1.5 text-center">
                      <div className="text-[10px] text-green-600/70 mb-0.5">TP1</div>
                      <div className="text-xs font-mono font-medium text-green-600">+{tp1Est.pnl.toFixed(1)}</div>
                      <div className="text-[10px] text-green-600/80">+{tp1Est.roi.toFixed(0)}%</div>
                    </div>
                  )}
                  {tp2Est && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-1.5 text-center">
                      <div className="text-[10px] text-emerald-600/70 mb-0.5">TP2</div>
                      <div className="text-xs font-mono font-medium text-emerald-600">+{tp2Est.pnl.toFixed(1)}</div>
                      <div className="text-[10px] text-emerald-600/80">+{tp2Est.roi.toFixed(0)}%</div>
                    </div>
                  )}
                  {slEst && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded p-1.5 text-center">
                      <div className="text-[10px] text-red-600/70 mb-0.5">SL</div>
                      <div className="text-xs font-mono font-medium text-red-600">{slEst.pnl.toFixed(1)}</div>
                      <div className="text-[10px] text-red-600/80">{slEst.roi.toFixed(0)}%</div>
                    </div>
                  )}
                </div>
              );
            })()}
            
            {/* Info Row (Entry, Size, Fee) */}
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2">
              <div className="flex gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] opacity-70">{labels.entryEst}</span>
                  <span className="font-mono">{selectedSignal?.entry_price}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] opacity-70">{labels.notional}</span>
                  <span className="font-mono">{(Number(amount || 0) * Number(leverage)).toFixed(0)}</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] opacity-70">{labels.fee}</span>
                <span className="font-mono text-orange-500/80">~{Math.max(config?.min_commission_open || 0.05, Number(amount || 0) * Number(leverage) * (config?.commission_open_rate || 0.0005)).toFixed(2)}</span>
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

          <div className="p-5 border-t border-border/50 mt-auto bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className={`flex gap-3 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
              <Button variant="outline" className="flex-1" onClick={() => setAcceptDialogOpen(false)}>{labels.cancel}</Button>
              <Button 
                className="flex-[2] bg-primary" 
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
              >
                {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {labels.confirm}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 gap-0" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader className="px-5 pt-5 pb-2 shrink-0">
            <DialogTitle className="text-base">{labels.details} {detailSignal?.symbol}</DialogTitle>
            <DialogDescription className="text-xs">
              {detailSignal?.side} · {detailSignal?.status || "NEW"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>{labels.entryEst}</span>
              <span className="font-mono text-foreground">{detailSignal?.entry_price || "--"}</span>
            </div>
            <div className="flex justify-between">
              <span>TP1</span>
              <span className="font-mono text-emerald-500">{detailSignal?.tp1 || "--"}</span>
            </div>
            {!!Number(detailSignal?.tp2) && (
              <div className="flex justify-between">
                <span>TP2</span>
                <span className="font-mono text-emerald-500/70">{detailSignal?.tp2}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>SL</span>
              <span className="font-mono text-rose-500">{detailSignal?.stop_loss || "--"}</span>
            </div>
            {detailSignal?.notes && (
              <div className="rounded-lg bg-muted/30 border border-border/30 p-3 text-[11px] text-foreground/80">
                {detailSignal.notes}
              </div>
            )}
          </div>
          <DialogFooter className="p-5 border-t border-border/50 mt-auto bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className={`flex gap-3 w-full ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  if (!detailSignal) return;
                  setDetailsOpen(false);
                  handleRejectClick(detailSignal);
                }}
                disabled={detailSignal ? Boolean(actionState[detailSignal.id]?.rejecting) : false}
              >
                {detailSignal && actionState[detailSignal.id]?.rejecting && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {labels.ignored}
              </Button>
              <Button
                className="flex-[2] bg-primary"
                onClick={() => {
                  if (!detailSignal) return;
                  setDetailsOpen(false);
                  handleAcceptClick(detailSignal);
                }}
                disabled={detailSignal ? Boolean(actionState[detailSignal.id]?.accepting) : false}
              >
                {detailSignal && actionState[detailSignal.id]?.accepting && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {labels.accept}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Modal */}
      <AllocationModal
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        onSuccess={async () => {
          // Reload wallet after transfer
          await runPoll(true);
          toast.success('Funds transferred successfully');
        }}
        liveAccount={liveAccount}
        config={config}
      />
    </div>
  );
}