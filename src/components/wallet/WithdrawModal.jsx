import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
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
  Wallet,
  TrendingUp,
  ArrowLeft,
  Info
} from "lucide-react";
import { useMediaQuery } from "@/components/hooks/useMediaQuery";
import CryptoIcon from "@/components/ui/CryptoIcon";

// ========== STATIC FEE CONFIG ==========
const NETWORK_FEES = {
  TRC20: 1.50,
  BEP20: 0.80,
  ERC20: 6.00
};

const MIN_WITHDRAWAL = 5;

const translations = {
  en: {
    title: "Withdraw",
    fromAccount: "From",
    coin: "Coin",
    address: "Address",
    network: "Network",
    amount: "You Receive",
    fee: "Est. Fee",
    totalDeducted: "Total Deducted",
    available: "Available",
    min: "Min",
    submit: "Withdraw",
    processing: "Processing...",
    successTitle: "Withdrawal Submitted",
    successDesc: "Your withdrawal is being processed.",
    reference: "Reference",
    txHash: "TX Hash",
    processingTime: "Usually completes within 5 min – 24 hrs",
    copied: "Copied!",
    close: "Done",
    viewDetails: "Details",
    newWithdrawal: "New Withdrawal",
    insufficientBalance: "Insufficient balance",
    invalidAddress: "Invalid address",
    minAmount: "Minimum is",
    fundingWallet: "Funding",
    copyTradingWallet: "Copy Trading",
    status: "Status",
    date: "Date",
    back: "Back",
    addressHint: "Enter your external wallet address"
  },
  ar: {
    title: "سحب",
    fromAccount: "من",
    coin: "العملة",
    address: "العنوان",
    network: "الشبكة",
    amount: "ستستلم",
    fee: "الرسوم المقدرة",
    totalDeducted: "إجمالي الخصم",
    available: "متاح",
    min: "الحد الأدنى",
    submit: "سحب",
    processing: "جاري المعالجة...",
    successTitle: "تم تقديم طلب السحب",
    successDesc: "يتم معالجة سحبك.",
    reference: "المرجع",
    txHash: "TX Hash",
    processingTime: "عادة يكتمل خلال 5 دقائق – 24 ساعة",
    copied: "تم النسخ!",
    close: "تم",
    viewDetails: "التفاصيل",
    newWithdrawal: "سحب جديد",
    insufficientBalance: "رصيد غير كافٍ",
    invalidAddress: "عنوان غير صالح",
    minAmount: "الحد الأدنى هو",
    fundingWallet: "التمويل",
    copyTradingWallet: "نسخ التداول",
    status: "الحالة",
    date: "التاريخ",
    back: "رجوع",
    addressHint: "أدخل عنوان محفظتك الخارجية"
  }
};

// ========== ADDRESS VALIDATION ==========
const validateTRC20Address = (address) => {
  if (!address || typeof address !== 'string') return false;
  address = address.trim();
  // TRC20/TRON: starts with T, 34 chars, base58
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return false;
  return true;
};

const validateEVMAddress = (address) => {
  if (!address || typeof address !== 'string') return false;
  address = address.trim();
  // ERC20/BEP20: starts with 0x, 42 chars hex
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return false;
  return true;
};

const validateAddress = (address, network) => {
  if (!address?.trim()) return { valid: false, error: null }; // No error if empty
  
  if (network === 'TRC20') {
    if (!validateTRC20Address(address)) {
      return { valid: false, error: 'Invalid TRC20 address (must start with T, 34 chars)' };
    }
    return { valid: true };
  }
  
  if (network === 'ERC20' || network === 'BEP20') {
    if (!validateEVMAddress(address)) {
      return { valid: false, error: `Invalid ${network} address (must start with 0x, 42 chars)` };
    }
    return { valid: true };
  }
  
  return { valid: false, error: 'Unsupported network' };
};

// Map status to user label
const getStatusLabel = (status, lang) => {
  if (status === 'APPROVED') return lang === 'ar' ? 'نجاح' : 'Success';
  if (status === 'FAILED') return lang === 'ar' ? 'فشل' : 'Failed';
  return status;
};

const getStatusColor = (status) => {
  if (status === 'APPROVED') return 'bg-emerald-500/20 text-emerald-600';
  if (status === 'FAILED' || status === 'REJECTED') return 'bg-red-500/20 text-red-600';
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
  
  // State machine: form | submitting | receipt | details
  const [mode, setMode] = useState("form");
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [balances, setBalances] = useState({ FUNDING: null, COPY_TRADING: null });
  
  // Form
  const [sourceAccount, setSourceAccount] = useState("FUNDING");
  const [network, setNetwork] = useState("TRC20");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [addressError, setAddressError] = useState(null);
  const [error, setError] = useState(null);
  
  // Result
  const [receipt, setReceipt] = useState(null);
  const [copied, setCopied] = useState(null);
  const [needsRefreshAfterClose, setNeedsRefreshAfterClose] = useState(false);

  // Computed
  const currentBalance = balances[sourceAccount] || { withdrawable: 0 };
  const fee = NETWORK_FEES[network] || 1;
  const amountNum = parseFloat(amount) || 0;
  const totalDebit = amountNum + fee;

  // Load balances
  const loadBalances = useCallback(async () => {
    setBalancesLoading(true);
    try {
      const res = await base44.functions.invoke("ledgerWithdrawal", { action: "getBalances" });
      if (res.data?.ok) {
        setBalances(res.data.data);
        // Auto-select account with funds
        const funding = res.data.data.FUNDING;
        const copyTrading = res.data.data.COPY_TRADING;
        if (funding?.withdrawable <= 0 && copyTrading?.withdrawable > 0) {
          setSourceAccount("COPY_TRADING");
        }
      }
    } catch (e) {
      console.error("Failed to load balances:", e);
    } finally {
      setBalancesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && mode === "form") {
      loadBalances();
    }
  }, [open, mode, loadBalances]);

  // Validate address on change
  useEffect(() => {
    if (address.trim()) {
      const validation = validateAddress(address, network);
      setAddressError(validation.error);
    } else {
      setAddressError(null);
    }
  }, [address, network]);

  // Submit handler (NO form submission)
  const handleWithdraw = async () => {
    setError(null);
    
    // Validations
    const addrValidation = validateAddress(address, network);
    if (!addrValidation.valid) {
      setError(addrValidation.error || t.invalidAddress);
      return;
    }
    
    if (amountNum < MIN_WITHDRAWAL) {
      setError(`${t.minAmount} ${MIN_WITHDRAWAL} USDT`);
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
        const wd = res.data.data;
        setReceipt(wd);
        setMode("receipt");
        setNeedsRefreshAfterClose(true);
        
        // Show toast notification
        toast.success(t.successTitle, {
          description: `${amountNum.toFixed(2)} USDT via ${network}`,
          duration: 5000
        });
        
        // Create persistent notification (fire and forget)
        createWithdrawalNotification(wd);
      } else {
        setError(res.data?.error?.message || "Withdrawal failed");
        setMode("form");
      }
    } catch (e) {
      setError(e.message || "Withdrawal failed");
      setMode("form");
    }
  };

  // Create in-app notification
  const createWithdrawalNotification = async (wd) => {
    try {
      const user = await base44.auth.me();
      await base44.entities.Notification.create({
        user_id: user.id,
        type: "withdrawal_confirmed",
        title: language === "ar" ? "تم السحب بنجاح" : "Withdrawal Successful",
        message: language === "ar" 
          ? `تم سحب ${wd.amount?.toFixed(2)} USDT عبر ${wd.network}`
          : `Withdrew ${wd.amount?.toFixed(2)} USDT via ${wd.network}`,
        data: {
          withdrawalId: wd.id,
          amount: wd.amount,
          network: wd.network,
          reference: wd.reference,
          txHash: wd.mock_tx_hash,
          fromAccount: wd.source_account_type
        },
        priority: "normal"
      });
    } catch (e) {
      // Silent fail - notification is not critical
    }
  };

  const copyText = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 1500);
  };

  const resetForm = () => {
    setMode("form");
    setReceipt(null);
    setError(null);
    setAddress("");
    setAmount("");
    setAddressError(null);
  };

  // CRITICAL: Refresh only happens here, after modal closes
  const handleClose = () => {
    const shouldRefresh = needsRefreshAfterClose;
    onOpenChange(false);
    
    setTimeout(() => {
      resetForm();
      setNeedsRefreshAfterClose(false);
      // Trigger soft refresh AFTER modal is closed
      if (shouldRefresh && onSuccess) {
        onSuccess();
      }
    }, 300);
  };

  const getAccountLabel = (type) => {
    if (type === 'FUNDING') return t.fundingWallet;
    if (type === 'COPY_TRADING') return t.copyTradingWallet;
    return type;
  };

  const formatAddr = (addr) => {
    if (!addr) return "";
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  // ==================== VIEWS ====================

  // Receipt View (success)
  const renderReceipt = () => {
    if (!receipt) return null;

    return (
      <div className="space-y-4">
        {/* Success Header */}
        <div className="flex flex-col items-center text-center py-3">
          <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold">{t.successTitle}</h3>
          <p className="text-sm text-muted-foreground">{t.successDesc}</p>
        </div>

        {/* Summary */}
        <div className="p-4 rounded-xl bg-muted/40 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t.status}</span>
            <Badge className={`${getStatusColor(receipt.status)} border-0`}>
              {getStatusLabel(receipt.status, language)}
            </Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t.amount}</span>
            <span className="font-mono font-semibold">{receipt.amount?.toFixed(2)} USDT</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t.fee}</span>
            <span className="font-mono">{receipt.fee?.toFixed(2)} USDT</span>
          </div>
          <div className="flex justify-between text-sm border-t border-border pt-2">
            <span className="text-muted-foreground">{t.totalDeducted}</span>
            <span className="font-mono font-medium">{receipt.total_debit?.toFixed(2)} USDT</span>
          </div>
          <div className="flex justify-between items-center text-sm pt-2">
            <span className="text-muted-foreground">{t.reference}</span>
            <button
              type="button"
              onClick={() => copyText(receipt.reference, 'ref')}
              className="flex items-center gap-1 text-primary font-mono text-xs hover:underline"
            >
              {receipt.reference}
              {copied === 'ref' ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          {receipt.mock_tx_hash && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{t.txHash}</span>
              <button
                type="button"
                onClick={() => copyText(receipt.mock_tx_hash, 'tx')}
                className="flex items-center gap-1 text-primary font-mono text-[10px] hover:underline"
              >
                {formatAddr(receipt.mock_tx_hash)}
                {copied === 'tx' ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          )}
        </div>

        {/* Processing Note */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 text-xs text-blue-600">
          <Clock className="w-4 h-4 flex-shrink-0" />
          {t.processingTime}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={resetForm} type="button">
            {t.newWithdrawal}
          </Button>
          <Button className="flex-1 rounded-xl bg-primary" onClick={handleClose} type="button">
            {t.close}
          </Button>
        </div>
      </div>
    );
  };

  // Form View
  const renderForm = () => {
    const isSubmitting = mode === "submitting";
    const isAddressValid = address.trim() && !addressError;
    const canSubmit = !isSubmitting && !balancesLoading && isAddressValid && 
                      amountNum >= MIN_WITHDRAWAL && totalDebit <= currentBalance.withdrawable;

    return (
      <div className="space-y-4">
        {/* From Account */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t.fromAccount}</Label>
          <Select value={sourceAccount} onValueChange={setSourceAccount} disabled={isSubmitting}>
            <SelectTrigger className="rounded-xl h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FUNDING">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-blue-600" />
                  <span>{t.fundingWallet}</span>
                  {balances.FUNDING && (
                    <span className="text-xs text-emerald-600 font-mono ml-auto">
                      {balances.FUNDING.withdrawable.toFixed(2)}
                    </span>
                  )}
                </div>
              </SelectItem>
              <SelectItem value="COPY_TRADING">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                  <span>{t.copyTradingWallet}</span>
                  {balances.COPY_TRADING && (
                    <span className="text-xs text-emerald-600 font-mono ml-auto">
                      {balances.COPY_TRADING.withdrawable.toFixed(2)}
                    </span>
                  )}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Coin (USDT only for now) */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t.coin}</Label>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
            <CryptoIcon currency="USDT" size="sm" />
            <span className="font-medium">USDT</span>
            <span className="text-xs text-muted-foreground">Tether</span>
          </div>
        </div>

        {/* Address */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t.address}</Label>
          <Input
            data-pf="withdraw-address-input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={network === 'TRC20' ? 'T...' : '0x...'}
            className={`rounded-xl h-12 font-mono text-sm ${addressError ? 'border-red-500' : ''}`}
            disabled={isSubmitting}
          />
          {addressError ? (
            <p className="text-[11px] text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {addressError}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">{t.addressHint}</p>
          )}
        </div>

        {/* Network */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t.network}</Label>
          <Select value={network} onValueChange={setNetwork} disabled={isSubmitting}>
            <SelectTrigger className="rounded-xl h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(NETWORK_FEES).map(([net, netFee]) => (
                <SelectItem key={net} value={net}>
                  <div className="flex items-center gap-2">
                    <span>{net}</span>
                    <span className="text-xs text-muted-foreground ml-2">Fee: {netFee} USDT</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <Label className="text-xs text-muted-foreground">{t.amount}</Label>
            <span className="text-xs text-muted-foreground">
              {t.available}: <span className="font-mono text-foreground">{currentBalance.withdrawable.toFixed(2)}</span> USDT
            </span>
          </div>
          <div className="relative">
            <Input
              data-pf="withdraw-amount-input"
              type="number"
              step="0.01"
              min={MIN_WITHDRAWAL}
              max={Math.max(0, currentBalance.withdrawable - fee)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="rounded-xl h-12 pr-16 font-mono"
              disabled={isSubmitting}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              USDT
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted-foreground">{t.min}: {MIN_WITHDRAWAL} USDT</span>
            <button
              type="button"
              onClick={() => setAmount(Math.max(0, currentBalance.withdrawable - fee).toFixed(2))}
              className="text-[11px] text-primary hover:underline"
              disabled={isSubmitting}
            >
              Max: {Math.max(0, currentBalance.withdrawable - fee).toFixed(2)}
            </button>
          </div>
        </div>

        {/* Fee & Total */}
        {amountNum > 0 && (
          <div className="p-3 rounded-xl bg-muted/40 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.fee} ({network})</span>
              <span className="font-mono">{fee.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between text-sm font-medium border-t border-border pt-2">
              <span>{t.totalDeducted}</span>
              <span className="font-mono">{totalDebit.toFixed(2)} USDT</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive" className="rounded-xl py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {/* Submit */}
        <Button
          type="button"
          onClick={handleWithdraw}
          disabled={!canSubmit}
          className="w-full rounded-xl h-12 bg-primary hover:bg-primary/90"
          data-pf="withdraw-submit"
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
      </div>
    );
  };

  // Main content
  const content = (
    <div className="pb-2">
      {mode === "receipt" ? renderReceipt() : renderForm()}
    </div>
  );

  // Mobile: Drawer
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] flex flex-col rounded-t-2xl">
          <DrawerHeader className="text-left flex-shrink-0 border-b border-border pb-3">
            <DrawerTitle className="flex items-center gap-2">
              <ArrowUpFromLine className="w-5 h-5 text-primary" />
              {t.title}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 overflow-y-auto flex-1 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 p-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpFromLine className="w-5 h-5 text-primary" />
            {t.title}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-5 py-4">{content}</div>
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