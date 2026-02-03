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
    newWithdrawal: "New Withdrawal",
    viewDetails: "View Details",
    back: "Back",
    history: "Recent Activity",
    noHistory: "No withdrawals yet",
    insufficientBalance: "Insufficient balance",
    invalidAddress: "Invalid address format",
    minAmount: "Minimum withdrawal is",
    fundingWallet: "Funding Wallet",
    copyTradingWallet: "Copy Trading Wallet",
    stakedLocked: "Staked (Locked)",
    lockedLabel: "Locked - Cannot withdraw",
    noFunds: "No funds available",
    statusSuccess: "Success",
    statusFailed: "Failed",
    date: "Date",
    destAddress: "Destination"
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
    newWithdrawal: "سحب جديد",
    viewDetails: "عرض التفاصيل",
    back: "رجوع",
    history: "النشاط الأخير",
    noHistory: "لا توجد سحوبات بعد",
    insufficientBalance: "رصيد غير كافٍ",
    invalidAddress: "تنسيق عنوان غير صالح",
    minAmount: "الحد الأدنى للسحب هو",
    fundingWallet: "محفظة التمويل",
    copyTradingWallet: "محفظة نسخ التداول",
    stakedLocked: "مستثمر (مقفل)",
    lockedLabel: "مقفل - لا يمكن السحب",
    noFunds: "لا توجد أموال متاحة",
    statusSuccess: "ناجح",
    statusFailed: "فشل",
    date: "التاريخ",
    destAddress: "الوجهة"
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
const getUserStatusLabel = (status, t) => {
  if (status === 'APPROVED') return t.statusSuccess;
  if (status === 'FAILED' || status === 'REJECTED' || status === 'CANCELLED') return t.statusFailed;
  return status;
};

const getStatusStyle = (status) => {
  if (status === 'APPROVED') return 'bg-emerald-500/20 text-emerald-600';
  if (status === 'FAILED' || status === 'REJECTED' || status === 'CANCELLED') return 'bg-red-500/20 text-red-600';
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
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(null);
  const [history, setHistory] = useState([]);
  
  // Mode: form | submitting | success | details
  const [mode, setMode] = useState("form");
  const [detailsItem, setDetailsItem] = useState(null);

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
      // Reset to form mode when opening
      setMode("form");
      setResult(null);
      setError(null);
      setDetailsItem(null);
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
    
    setMode("submitting");
    
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
        setResult(res.data.data);
        setMode("success");
        // Update history instantly (prepend new item)
        setHistory(prev => [res.data.data, ...prev.slice(0, 4)]);
        // Refresh balances in background
        base44.functions.invoke("ledgerWithdrawal", { action: "getBalances" }).then(r => {
          if (r.data?.ok) setBalances(r.data.data);
        });
        onSuccess?.();
      } else {
        setError(res.data?.error?.message || "Withdrawal failed");
        setMode("form");
      }
    } catch (e) {
      setError(e.message || "Withdrawal failed");
      setMode("form");
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const resetForm = () => {
    setMode("form");
    setResult(null);
    setError(null);
    setAddress("");
    setAmount("");
    setAddressError(null);
    setDetailsItem(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset after close animation
    setTimeout(() => {
      resetForm();
    }, 300);
  };

  const formatAddress = (addr) => {
    if (!addr) return "";
    return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleString(language === "ar" ? "ar-EG" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getAccountLabel = (type) => {
    if (type === 'FUNDING') return t.fundingWallet;
    if (type === 'COPY_TRADING') return t.copyTradingWallet;
    return type;
  };

  const openDetails = (item) => {
    setDetailsItem(item);
    setMode("details");
  };

  // ========== RENDER: Details View ==========
  const renderDetails = (item) => (
    <div className="space-y-4">
      {/* Back button */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => setMode(result ? "success" : "form")}
        className="text-muted-foreground hover:text-foreground -ml-2"
        type="button"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        {t.back}
      </Button>

      {/* Status Header */}
      <div className="flex flex-col items-center text-center py-3">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${
          item.status === 'APPROVED' ? 'bg-emerald-500/20' : 'bg-red-500/20'
        }`}>
          {item.status === 'APPROVED' ? (
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          ) : (
            <XCircle className="w-7 h-7 text-red-500" />
          )}
        </div>
        <Badge className={`${getStatusStyle(item.status)} border-0 text-sm px-3 py-1`}>
          {getUserStatusLabel(item.status, t)}
        </Badge>
      </div>

      {/* Details Card */}
      <div className="space-y-3 p-4 rounded-xl bg-muted/50 border border-border/50">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t.amount}</span>
          <span className="font-mono font-semibold text-lg">{item.amount?.toFixed(2)} USDT</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t.fee}</span>
          <span className="font-mono">{item.fee?.toFixed(2)} USDT</span>
        </div>
        <div className="flex justify-between text-sm border-t border-border pt-2">
          <span className="text-muted-foreground">{t.totalDeducted}</span>
          <span className="font-mono font-medium">{item.total_debit?.toFixed(2)} USDT</span>
        </div>
        
        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t.fromAccount}</span>
            <span>{getAccountLabel(item.source_account_type)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t.network}</span>
            <span>{item.network}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t.date}</span>
            <span className="text-xs">{formatDateTime(item.created_date)}</span>
          </div>
        </div>

        {/* Address */}
        <div className="border-t border-border pt-3">
          <p className="text-xs text-muted-foreground mb-1">{t.destAddress}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-muted/80 px-2 py-1.5 rounded break-all">
              {item.address}
            </code>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 flex-shrink-0"
              onClick={() => copyToClipboard(item.address, 'addr')}
              type="button"
            >
              {copied === 'addr' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Reference */}
        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">{t.reference}</span>
            <button 
              onClick={() => copyToClipboard(item.reference, 'ref')}
              className="flex items-center gap-1.5 text-sm font-mono text-primary hover:text-primary/80 transition-colors"
              type="button"
            >
              {item.reference}
              {copied === 'ref' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* TX Hash */}
        {item.mock_tx_hash && (
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{t.txHash}</span>
              <button 
                onClick={() => copyToClipboard(item.mock_tx_hash, 'tx')}
                className="flex items-center gap-1.5 text-xs font-mono text-primary hover:text-primary/80 transition-colors"
                type="button"
              >
                <span className="max-w-[120px] truncate">{item.mock_tx_hash}</span>
                {copied === 'tx' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Processing Time Note */}
      <Alert className="bg-blue-500/10 border-blue-500/30">
        <Clock className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-xs text-blue-700 dark:text-blue-400">
          {t.processingTime}
        </AlertDescription>
      </Alert>

      {/* Close Button */}
      <Button 
        className="w-full rounded-xl bg-primary h-11" 
        onClick={handleClose}
        type="button"
      >
        {t.close}
      </Button>
    </div>
  );

  // ========== RENDER: Success View ==========
  const renderSuccess = () => (
    <div className="space-y-4">
      {/* Success Header */}
      <div className="flex flex-col items-center text-center py-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{t.successTitle}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t.successDesc}</p>
      </div>
      
      {/* Summary Card */}
      <div className="space-y-3 p-4 rounded-xl bg-muted/50 border border-border/50">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Status</span>
          <Badge className="bg-emerald-500/20 text-emerald-600 border-0">{t.statusSuccess}</Badge>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t.reference}</span>
          <span className="font-mono text-xs">{result?.reference}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t.fromAccount}</span>
          <span>{getAccountLabel(result?.source_account_type)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t.network}</span>
          <span>{result?.network}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t.destAddress}</span>
          <button 
            onClick={() => copyToClipboard(result?.address, 'addr')}
            className="flex items-center gap-1 font-mono text-xs text-primary hover:text-primary/80"
            type="button"
          >
            {formatAddress(result?.address)}
            {copied === 'addr' ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>
        
        <div className="border-t border-border pt-3 mt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t.amount}</span>
            <span className="font-mono font-semibold">{result?.amount?.toFixed(2)} USDT</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t.fee}</span>
            <span className="font-mono">{result?.fee?.toFixed(2)} USDT</span>
          </div>
          <div className="flex justify-between text-sm font-medium">
            <span className="text-foreground">{t.totalDeducted}</span>
            <span className="font-mono">{result?.total_debit?.toFixed(2)} USDT</span>
          </div>
        </div>
        
        {/* TX Hash */}
        {result?.mock_tx_hash && (
          <div className="border-t border-border pt-3 mt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase">{t.txHash}</span>
              <button 
                onClick={() => copyToClipboard(result.mock_tx_hash, 'tx')}
                className="flex items-center gap-1 text-xs font-mono text-primary hover:text-primary/80"
                type="button"
              >
                <span className="max-w-[120px] truncate">{result.mock_tx_hash}</span>
                {copied === 'tx' ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        )}
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
          onClick={() => openDetails(result)}
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
    </div>
  );

  // ========== RENDER: Form View ==========
  const renderForm = () => (
    <div className="space-y-5">
      {/* From Account Selection */}
      <div className="space-y-2">
        <Label>{t.fromAccount}</Label>
        <Select value={sourceAccount} onValueChange={setSourceAccount} disabled={mode === "submitting"}>
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
      <div className="grid grid-cols-3 gap-4 p-5 rounded-xl bg-gradient-to-br from-muted/80 to-muted/50 border border-border/50">
        <div className="text-center">
          <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">{t.withdrawable}</p>
          {balancesLoading ? (
            <div className="h-7 w-16 mx-auto bg-muted-foreground/20 rounded animate-pulse" />
          ) : (
            <p className="font-mono text-xl font-bold text-emerald-600">
              {currentBalance.withdrawable.toFixed(2)}
            </p>
          )}
        </div>
        <div className="text-center border-x border-border/50">
          <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" /> {t.locked}
          </p>
          {balancesLoading ? (
            <div className="h-7 w-16 mx-auto bg-muted-foreground/20 rounded animate-pulse" />
          ) : (
            <p className="font-mono text-lg text-muted-foreground">
              {currentBalance.locked.toFixed(2)}
            </p>
          )}
        </div>
        <div className="text-center">
          <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">{t.pending}</p>
          {balancesLoading ? (
            <div className="h-7 w-16 mx-auto bg-muted-foreground/20 rounded animate-pulse" />
          ) : (
            <p className="font-mono text-lg text-muted-foreground">
              {currentBalance.reserved.toFixed(2)}
            </p>
          )}
        </div>
      </div>
      
      {/* Network Selection */}
      <div className="space-y-2">
        <Label>{t.network}</Label>
        <Select value={network} onValueChange={setNetwork} disabled={mode === "submitting"}>
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {config?.networks?.map(n => (
              <SelectItem key={n.network} value={n.network}>
                <div className="flex items-center gap-2">
                  <span>{n.network}</span>
                  {n.fee > 0 && (
                    <span className="text-xs text-muted-foreground">Fee: {n.fee} USDT</span>
                  )}
                  {n.fee === 0 && (
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
          disabled={mode === "submitting"}
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
            disabled={mode === "submitting"}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            USDT
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAmount(Math.max(0, currentBalance.withdrawable - getFee()).toFixed(2))}
          className="text-xs text-primary hover:underline"
          disabled={mode === "submitting"}
        >
          Max: {Math.max(0, currentBalance.withdrawable - getFee()).toFixed(2)} USDT
        </button>
      </div>
      
      {/* Fee & Total */}
      {amount && parseFloat(amount) > 0 && (
        <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-muted/60 to-muted/30 border border-border">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t.fee} ({network})</span>
            <span className="font-mono font-medium">{getFee().toFixed(2)} USDT</span>
          </div>
          <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
            <span className="text-foreground">{t.totalDeducted}</span>
            <span className="font-mono text-foreground">{getTotalDebit().toFixed(2)} USDT</span>
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
      
      {/* Submit Button */}
      <Button
        type="button"
        onClick={handleWithdraw}
        disabled={mode === "submitting" || configLoading || balancesLoading || !!addressError || currentBalance.withdrawable <= 0}
        className="w-full rounded-xl bg-primary hover:bg-primary/90 h-12"
      >
        {mode === "submitting" ? (
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
      <p className="text-xs text-center text-muted-foreground">
        {t.disclaimer}
      </p>
      
      {/* Recent Activity */}
      {history.length > 0 && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium mb-3">{t.history}</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-thin">
            {history.slice(0, 3).map(w => (
              <button
                key={w.id}
                type="button"
                onClick={() => openDetails(w)}
                className="w-full flex items-center justify-between text-xs p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] ${getStatusStyle(w.status)} border-0`}>
                    {getUserStatusLabel(w.status, t)}
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

  // ========== MAIN RENDER ==========
  const content = (
    <div className="pb-4">
      {mode === "details" && detailsItem ? renderDetails(detailsItem) : 
       mode === "success" && result ? renderSuccess() : 
       renderForm()}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh] flex flex-col">
          <DrawerHeader className="text-left flex-shrink-0 border-b border-border pb-3">
            <DrawerTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              {t.title}
            </DrawerTitle>
            <DrawerDescription>{t.subtitle}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 overflow-y-auto flex-1 scrollbar-thin">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] w-[95vw] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-6 py-4 scrollbar-thin">{content}</div>
      </DialogContent>
    </Dialog>
  );
}

WithdrawModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  language: PropTypes.string,
  onSuccess: PropTypes.func
};