import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpFromLine,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Clock,
  Lock,
  Wallet,
  TrendingUp,
  ArrowLeft,
  XCircle
} from "lucide-react";
import { useMediaQuery } from "@/components/hooks/useMediaQuery";

const translations = {
  en: {
    title: "Withdraw USDT",
    subtitle: "Withdraw to external wallet",
    fromAccount: "From Account",
    network: "Network",
    address: "Wallet Address",
    addressPlaceholder: "Enter your wallet address",
    amount: "You Receive",
    amountPlaceholder: "Enter amount",
    fee: "Network Fee",
    totalDeducted: "Total Deducted",
    withdrawable: "Withdrawable",
    locked: "Locked",
    pending: "Pending",
    min: "Minimum",
    submit: "Withdraw",
    processing: "Processing...",
    successTitle: "Withdrawal Successful",
    successDesc: "Your withdrawal has been approved and is being processed.",
    failedTitle: "Withdrawal Failed",
    reference: "Reference",
    txHash: "TX Hash",
    processingTime: "Processing time: 5 minutes to 24 hours.",
    disclaimer: "This is an internal ledger withdrawal request. Funds are deducted immediately after approval.",
    copied: "Copied!",
    close: "Done",
    viewDetails: "View Details",
    newWithdrawal: "New Withdrawal",
    history: "Recent Withdrawals",
    noHistory: "No withdrawals yet",
    insufficientBalance: "Insufficient balance",
    invalidAddress: "Invalid address format",
    minAmount: "Minimum withdrawal is",
    fundingWallet: "Funding Wallet",
    copyTradingWallet: "Copy Trading Wallet",
    stakedLocked: "Staked (Locked)",
    lockedLabel: "Locked - Cannot withdraw",
    noFunds: "No funds available",
    status: "Status",
    date: "Date",
    back: "Back"
  },
  ar: {
    title: "سحب USDT",
    subtitle: "السحب إلى محفظة خارجية",
    fromAccount: "من الحساب",
    network: "الشبكة",
    address: "عنوان المحفظة",
    addressPlaceholder: "أدخل عنوان محفظتك",
    amount: "ستستلم",
    amountPlaceholder: "أدخل المبلغ",
    fee: "رسوم الشبكة",
    totalDeducted: "إجمالي الخصم",
    withdrawable: "متاح للسحب",
    locked: "مقفل",
    pending: "معلق",
    min: "الحد الأدنى",
    submit: "سحب",
    processing: "جاري المعالجة...",
    successTitle: "تم السحب بنجاح",
    successDesc: "تمت الموافقة على سحبك ويتم معالجته.",
    failedTitle: "فشل السحب",
    reference: "المرجع",
    txHash: "TX Hash",
    processingTime: "وقت المعالجة: 5 دقائق إلى 24 ساعة.",
    disclaimer: "هذا طلب سحب دفتر داخلي. يتم خصم الأموال فوراً بعد الموافقة.",
    copied: "تم النسخ!",
    close: "تم",
    viewDetails: "عرض التفاصيل",
    newWithdrawal: "سحب جديد",
    history: "السحوبات الأخيرة",
    noHistory: "لا توجد سحوبات بعد",
    insufficientBalance: "رصيد غير كافٍ",
    invalidAddress: "تنسيق عنوان غير صالح",
    minAmount: "الحد الأدنى للسحب هو",
    fundingWallet: "محفظة التمويل",
    copyTradingWallet: "محفظة نسخ التداول",
    stakedLocked: "مستثمر (مقفل)",
    lockedLabel: "مقفل - لا يمكن السحب",
    noFunds: "لا توجد أموال متاحة",
    status: "الحالة",
    date: "التاريخ",
    back: "رجوع"
  }
};

// Client-side address validation
const validateAddressClient = (address, network) => {
  if (!address || typeof address !== 'string') return { valid: false, error: 'Address is required' };
  address = address.trim();
  
  if (network === 'TRC20') {
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
      return { valid: false, error: 'Invalid TRC20 address. Must start with T and be 34 characters.' };
    }
    return { valid: true };
  }
  
  if (network === 'ERC20' || network === 'BEP20') {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return { valid: false, error: `Invalid ${network} address. Must start with 0x and be 42 characters.` };
    }
    return { valid: true };
  }
  
  return { valid: false, error: 'Unsupported network' };
};

// Map backend status to user-friendly label
const getUserStatusLabel = (status, language) => {
  if (status === 'APPROVED') return language === 'ar' ? 'نجاح' : 'Success';
  if (status === 'FAILED') return language === 'ar' ? 'فشل' : 'Failed';
  if (status === 'REJECTED') return language === 'ar' ? 'مرفوض' : 'Rejected';
  if (status === 'CANCELLED') return language === 'ar' ? 'ملغى' : 'Cancelled';
  return status;
};

const getStatusStyle = (status) => {
  if (status === 'APPROVED') return 'bg-emerald-500/20 text-emerald-600';
  if (status === 'FAILED' || status === 'REJECTED') return 'bg-red-500/20 text-red-600';
  if (status === 'CANCELLED') return 'bg-muted text-muted-foreground';
  return 'bg-muted text-muted-foreground';
};

export default function WithdrawModal({ 
  open, 
  onOpenChange, 
  language = "en", 
  onSuccess
}) {
  const t = translations[language] || translations.en;
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  // UI State Machine: form | submitting | success | details
  const [mode, setMode] = useState("form");
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [balances, setBalances] = useState({ FUNDING: null, COPY_TRADING: null });
  
  // Form state
  const [sourceAccount, setSourceAccount] = useState("FUNDING");
  const [network, setNetwork] = useState("TRC20");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [addressError, setAddressError] = useState(null);
  const [error, setError] = useState(null);
  
  // Result state
  const [lastWithdrawal, setLastWithdrawal] = useState(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [copied, setCopied] = useState(null);
  const [history, setHistory] = useState([]);

  // Get current account balance
  const currentBalance = balances[sourceAccount] || { total: 0, locked: 0, reserved: 0, withdrawable: 0 };

  // Load config and balances
  const loadData = useCallback(async () => {
    setConfigLoading(true);
    setBalancesLoading(true);
    
    try {
      const [configRes, balancesRes, historyRes] = await Promise.all([
        base44.functions.invoke("ledgerWithdrawal", { action: "getConfig" }),
        base44.functions.invoke("ledgerWithdrawal", { action: "getBalances" }),
        base44.functions.invoke("ledgerWithdrawal", { action: "list", limit: 5 })
      ]);
      
      if (configRes.data?.ok) {
        setConfig(configRes.data.data);
      }
      if (balancesRes.data?.ok) {
        setBalances(balancesRes.data.data);
        // Auto-select account with funds
        const funding = balancesRes.data.data.FUNDING;
        const copyTrading = balancesRes.data.data.COPY_TRADING;
        if (funding?.withdrawable <= 0 && copyTrading?.withdrawable > 0) {
          setSourceAccount("COPY_TRADING");
        }
      }
      if (historyRes.data?.ok) {
        setHistory(historyRes.data.data || []);
      }
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setConfigLoading(false);
      setBalancesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  // Validate address on change
  useEffect(() => {
    if (address.trim()) {
      const validation = validateAddressClient(address, network);
      setAddressError(validation.valid ? null : validation.error);
    } else {
      setAddressError(null);
    }
  }, [address, network]);

  const getFee = () => {
    if (!config) return 0;
    const networkConfig = config.networks?.find(n => n.network === network);
    return networkConfig?.fee || 0;
  };

  const getTotalDebit = () => {
    const amountNum = parseFloat(amount) || 0;
    return amountNum + getFee();
  };

  // CRITICAL: No form submit, no refresh, type="button" handler
  const handleWithdraw = async () => {
    setError(null);
    
    const amountNum = parseFloat(amount);
    const totalDebit = getTotalDebit();
    
    // Client-side validations
    const addressValidation = validateAddressClient(address, network);
    if (!addressValidation.valid) {
      setError(addressValidation.error);
      return;
    }
    
    if (config && amountNum < config.min_withdrawal) {
      setError(`${t.minAmount} ${config.min_withdrawal} USDT`);
      return;
    }
    
    if (totalDebit > currentBalance.withdrawable) {
      setError(t.insufficientBalance);
      return;
    }
    
    // Switch to submitting mode
    setMode("submitting");
    setLoading(true);
    
    try {
      const res = await base44.functions.invoke("ledgerWithdrawal", {
        action: "create",
        sourceAccountType: sourceAccount,
        network,
        address: address.trim(),
        amount: amountNum,
        requestId: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      });
      
      if (res.data?.ok) {
        const withdrawalData = res.data.data;
        setLastWithdrawal(withdrawalData);
        setMode("success");
        // Update history instantly - prepend new item
        setHistory(prev => [withdrawalData, ...prev.filter(w => w.id !== withdrawalData.id).slice(0, 4)]);
        // Callback but NO refresh
        onSuccess?.();
      } else {
        setError(res.data?.error?.message || "Withdrawal failed");
        setMode("form"); // Stay on form with error
      }
    } catch (e) {
      setError(e.message || "Withdrawal failed");
      setMode("form"); // Stay on form with error
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const resetForm = () => {
    setMode("form");
    setLastWithdrawal(null);
    setSelectedWithdrawal(null);
    setError(null);
    setAddress("");
    setAmount("");
    setAddressError(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after animation
    setTimeout(() => {
      resetForm();
    }, 300);
  };

  const formatAddress = (addr) => {
    if (!addr) return "";
    return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
  };

  const getAccountLabel = (type) => {
    if (type === 'FUNDING') return t.fundingWallet;
    if (type === 'COPY_TRADING') return t.copyTradingWallet;
    return type;
  };

  const openDetails = (withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setMode("details");
  };

  // ==================== RENDER VIEWS ====================

  // Details View (user-safe, no admin note)
  const renderDetailsView = () => {
    const w = selectedWithdrawal || lastWithdrawal;
    if (!w) return null;

    const isSuccess = w.status === 'APPROVED';
    
    return (
      <div className="space-y-4">
        {/* Back button */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setMode(lastWithdrawal ? "success" : "form")}
          className="gap-2 -ml-2"
          type="button"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.back}
        </Button>

        {/* Header */}
        <div className="flex flex-col items-center text-center py-3">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${
            isSuccess ? 'bg-emerald-500/20' : 'bg-red-500/20'
          }`}>
            {isSuccess ? (
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            ) : (
              <XCircle className="w-7 h-7 text-red-500" />
            )}
          </div>
          <Badge className={`${getStatusStyle(w.status)} border-0 text-sm px-3 py-1`}>
            {getUserStatusLabel(w.status, language)}
          </Badge>
        </div>

        {/* Details Card */}
        <div className="space-y-3 p-4 rounded-xl bg-muted/50 border border-border/50">
          <DetailRow label={t.reference} value={w.reference} copyable onCopy={() => copyToClipboard(w.reference, 'ref')} copied={copied === 'ref'} />
          <DetailRow label={t.date} value={new Date(w.created_date).toLocaleString()} />
          <DetailRow label={t.fromAccount} value={getAccountLabel(w.source_account_type)} />
          <DetailRow label={t.network} value={w.network} />
          <DetailRow 
            label={t.address} 
            value={formatAddress(w.address)} 
            fullValue={w.address}
            copyable 
            onCopy={() => copyToClipboard(w.address, 'addr')} 
            copied={copied === 'addr'} 
          />
          
          <div className="border-t border-border pt-3 mt-3 space-y-2">
            <DetailRow label={t.amount} value={`${w.amount?.toFixed(2)} USDT`} highlight />
            <DetailRow label={t.fee} value={`${w.fee?.toFixed(2)} USDT`} />
            <DetailRow label={t.totalDeducted} value={`${w.total_debit?.toFixed(2)} USDT`} bold />
          </div>
          
          {w.mock_tx_hash && (
            <div className="border-t border-border pt-3 mt-3">
              <DetailRow 
                label={t.txHash} 
                value={`${w.mock_tx_hash.slice(0, 16)}...${w.mock_tx_hash.slice(-8)}`}
                fullValue={w.mock_tx_hash}
                copyable 
                onCopy={() => copyToClipboard(w.mock_tx_hash, 'tx')} 
                copied={copied === 'tx'}
                mono
              />
            </div>
          )}
        </div>

        {/* Processing note */}
        <Alert className="bg-blue-500/10 border-blue-500/30">
          <Clock className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-xs text-blue-700 dark:text-blue-400">
            {t.processingTime}
          </AlertDescription>
        </Alert>

        {/* Close button */}
        <Button 
          onClick={handleClose} 
          className="w-full rounded-xl h-12 bg-primary"
          type="button"
        >
          {t.close}
        </Button>
      </div>
    );
  };

  // Success View
  const renderSuccessView = () => {
    if (!lastWithdrawal) return null;

    return (
      <div className="space-y-4">
        {/* Success Header */}
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{t.successTitle}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t.successDesc}</p>
        </div>
        
        {/* Quick Summary */}
        <div className="space-y-3 p-4 rounded-xl bg-muted/50 border border-border/50">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t.status}</span>
            <Badge className="bg-emerald-500/20 text-emerald-600 border-0">
              {getUserStatusLabel(lastWithdrawal.status, language)}
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t.amount}</span>
            <span className="font-mono font-semibold text-lg">{lastWithdrawal.amount?.toFixed(2)} USDT</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t.fromAccount}</span>
            <span className="text-sm">{getAccountLabel(lastWithdrawal.source_account_type)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t.network}</span>
            <span className="text-sm">{lastWithdrawal.network}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t.totalDeducted}</span>
            <span className="font-mono font-medium">{lastWithdrawal.total_debit?.toFixed(2)} USDT</span>
          </div>
          
          <div className="border-t border-border pt-3 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{t.reference}</span>
              <button 
                onClick={() => copyToClipboard(lastWithdrawal.reference, 'ref')}
                className="flex items-center gap-1.5 text-sm font-mono text-primary hover:text-primary/80"
                type="button"
              >
                {lastWithdrawal.reference}
                {copied === 'ref' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
        
        {/* Processing Time Note */}
        <Alert className="bg-blue-500/10 border-blue-500/30">
          <Clock className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-xs text-blue-700 dark:text-blue-400">
            {t.processingTime}
          </AlertDescription>
        </Alert>
        
        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button 
            variant="outline" 
            className="flex-1 rounded-xl h-11" 
            onClick={() => openDetails(lastWithdrawal)}
            type="button"
          >
            {t.viewDetails}
          </Button>
          <Button 
            className="flex-1 rounded-xl bg-primary h-11" 
            onClick={handleClose}
            type="button"
          >
            {t.close}
          </Button>
        </div>
        
        {/* New Withdrawal link */}
        <button 
          onClick={resetForm}
          className="w-full text-center text-sm text-primary hover:underline pt-1"
          type="button"
        >
          {t.newWithdrawal}
        </button>
      </div>
    );
  };

  // Form View (default)
  const renderFormView = () => {
    const isSubmitting = mode === "submitting";
    
    return (
      <div className="space-y-5">
        {/* From Account Selection */}
        <div className="space-y-2">
          <Label>{t.fromAccount}</Label>
          <Select value={sourceAccount} onValueChange={setSourceAccount} disabled={isSubmitting}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Funding Wallet */}
              <SelectItem value="FUNDING">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-blue-600" />
                  <span>{t.fundingWallet}</span>
                  {balances.FUNDING && (
                    <span className="text-xs text-emerald-600 font-mono ml-2">
                      {balances.FUNDING.withdrawable.toFixed(2)} USDT
                    </span>
                  )}
                </div>
              </SelectItem>
              
              {/* Copy Trading Wallet */}
              <SelectItem value="COPY_TRADING">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                  <span>{t.copyTradingWallet}</span>
                  {balances.COPY_TRADING && (
                    <span className="text-xs text-emerald-600 font-mono ml-2">
                      {balances.COPY_TRADING.withdrawable.toFixed(2)} USDT
                    </span>
                  )}
                </div>
              </SelectItem>
              
              {/* Staked - Disabled */}
              <SelectItem value="STAKED_LOCKED" disabled>
                <div className="flex items-center gap-2 opacity-50">
                  <Lock className="h-4 w-4 text-amber-600" />
                  <span>{t.stakedLocked}</span>
                  <Badge variant="outline" className="text-[10px] ml-2">{t.lockedLabel}</Badge>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Balance Summary */}
        <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-gradient-to-br from-muted/80 to-muted/40 border border-border/50">
          <div className="text-center">
            <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">{t.withdrawable}</p>
            {balancesLoading ? (
              <div className="h-6 w-16 mx-auto bg-muted-foreground/20 rounded animate-pulse" />
            ) : (
              <p className="font-mono text-lg font-bold text-emerald-600">
                {currentBalance.withdrawable.toFixed(2)}
              </p>
            )}
          </div>
          <div className="text-center border-x border-border/50 px-2">
            <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide flex items-center justify-center gap-1">
              <Lock className="w-2.5 h-2.5" /> {t.locked}
            </p>
            {balancesLoading ? (
              <div className="h-6 w-14 mx-auto bg-muted-foreground/20 rounded animate-pulse" />
            ) : (
              <p className="font-mono text-base text-muted-foreground">
                {currentBalance.locked.toFixed(2)}
              </p>
            )}
          </div>
          <div className="text-center">
            <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">{t.pending}</p>
            {balancesLoading ? (
              <div className="h-6 w-14 mx-auto bg-muted-foreground/20 rounded animate-pulse" />
            ) : (
              <p className="font-mono text-base text-muted-foreground">
                {currentBalance.reserved.toFixed(2)}
              </p>
            )}
          </div>
        </div>
        
        {/* Network Selection */}
        <div className="space-y-2">
          <Label>{t.network}</Label>
          <Select value={network} onValueChange={setNetwork} disabled={isSubmitting}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {config?.networks?.map(n => (
                <SelectItem key={n.network} value={n.network}>
                  <div className="flex items-center gap-2">
                    <span>{n.network}</span>
                    {n.fee > 0 ? (
                      <span className="text-xs text-muted-foreground">Fee: {n.fee} USDT</span>
                    ) : (
                      <span className="text-xs text-emerald-600">No fee</span>
                    )}
                  </div>
                </SelectItem>
              )) || (
                <>
                  <SelectItem value="TRC20">TRC20</SelectItem>
                  <SelectItem value="ERC20">ERC20</SelectItem>
                  <SelectItem value="BEP20">BEP20</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>
        
        {/* Address Input */}
        <div className="space-y-2">
          <Label>{t.address}</Label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={network === 'TRC20' ? 'T...' : '0x...'}
            className={`rounded-xl font-mono text-sm ${addressError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            disabled={isSubmitting}
          />
          {addressError && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {addressError}
            </p>
          )}
        </div>
        
        {/* Amount Input */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>{t.amount}</Label>
            <span className="text-xs text-muted-foreground">
              {t.min}: {config?.min_withdrawal || 5} USDT
            </span>
          </div>
          <div className="relative">
            <Input
              type="number"
              step="0.01"
              min={config?.min_withdrawal || 5}
              max={currentBalance.withdrawable}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t.amountPlaceholder}
              className="rounded-xl pr-16 font-mono"
              disabled={isSubmitting}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              USDT
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAmount(Math.max(0, currentBalance.withdrawable - getFee()).toFixed(2))}
            className="text-xs text-primary hover:underline disabled:opacity-50"
            disabled={isSubmitting}
          >
            Max: {Math.max(0, currentBalance.withdrawable - getFee()).toFixed(2)} USDT
          </button>
        </div>
        
        {/* Fee & Total */}
        {amount && parseFloat(amount) > 0 && (
          <div className="space-y-2 p-4 rounded-xl bg-gradient-to-br from-muted/60 to-muted/30 border border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.fee} ({network})</span>
              <span className="font-mono">{getFee().toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
              <span>{t.totalDeducted}</span>
              <span className="font-mono">{getTotalDebit().toFixed(2)} USDT</span>
            </div>
          </div>
        )}
        
        {/* Error */}
        {error && (
          <Alert variant="destructive" className="rounded-xl">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Submit Button - type="button" to prevent form submission */}
        <Button
          type="button"
          onClick={handleWithdraw}
          disabled={isSubmitting || configLoading || balancesLoading || !!addressError || currentBalance.withdrawable <= 0 || !amount || parseFloat(amount) <= 0}
          className="w-full rounded-xl bg-primary hover:bg-primary/90 h-12"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t.processing}
            </>
          ) : (
            <>
              <ArrowUpFromLine className="w-4 h-4 mr-2" />
              {t.submit}
            </>
          )}
        </Button>
        
        {/* Disclaimer */}
        <p className="text-[11px] text-center text-muted-foreground px-2">
          {t.disclaimer}
        </p>
        
        {/* Recent Withdrawals - max 3 items */}
        {history.length > 0 && (
          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium mb-3">{t.history}</h4>
            <div className="space-y-2">
              {history.slice(0, 3).map(w => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => openDetails(w)}
                  className="flex items-center justify-between text-xs p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] ${getStatusStyle(w.status)} border-0`}>
                      {getUserStatusLabel(w.status, language)}
                    </Badge>
                    <span className="font-mono font-medium">{w.amount?.toFixed(2)} USDT</span>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">{new Date(w.created_date).toLocaleDateString()}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {getAccountLabel(w.source_account_type)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Main content based on mode
  const content = (
    <div className="pb-4">
      {mode === "details" ? renderDetailsView() :
       mode === "success" ? renderSuccessView() :
       renderFormView()}
    </div>
  );

  // Mobile: Bottom drawer
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh] flex flex-col rounded-t-2xl">
          <DrawerHeader className="text-left flex-shrink-0 border-b border-border pb-4">
            <DrawerTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              {t.title}
            </DrawerTitle>
            <DrawerDescription>{t.subtitle}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 overflow-y-auto flex-1 pt-2">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] w-[95vw] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-6 py-4">{content}</div>
      </DialogContent>
    </Dialog>
  );
}

// Helper component for detail rows
function DetailRow({ label, value, fullValue, copyable, onCopy, copied, mono, bold, highlight }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`${mono ? 'font-mono text-xs' : ''} ${bold ? 'font-semibold' : ''} ${highlight ? 'text-emerald-600 font-medium' : ''}`}>
          {value}
        </span>
        {copyable && (
          <button 
            onClick={onCopy} 
            className="text-primary hover:text-primary/80 p-1"
            type="button"
            title={fullValue || value}
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

DetailRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  fullValue: PropTypes.string,
  copyable: PropTypes.bool,
  onCopy: PropTypes.func,
  copied: PropTypes.bool,
  mono: PropTypes.bool,
  bold: PropTypes.bool,
  highlight: PropTypes.bool
};

WithdrawModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  language: PropTypes.string,
  onSuccess: PropTypes.func
};