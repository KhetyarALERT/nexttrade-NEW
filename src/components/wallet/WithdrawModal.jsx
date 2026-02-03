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
  Info,
  Wallet,
  TrendingUp
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
    success: "Withdrawal Approved",
    successDesc: "Your withdrawal has been approved and is being processed.",
    reference: "Reference",
    txHash: "TX Hash",
    processingTime: "Processing time: 5 minutes to 24 hours.",
    disclaimer: "This is an internal ledger withdrawal request. Funds are deducted immediately after approval.",
    copied: "Copied!",
    close: "Close",
    history: "Recent Withdrawals",
    noHistory: "No withdrawals yet",
    insufficientBalance: "Insufficient balance",
    invalidAddress: "Invalid address format",
    minAmount: "Minimum withdrawal is",
    fundingWallet: "Funding Wallet",
    copyTradingWallet: "Copy Trading Wallet",
    stakedLocked: "Staked (Locked)",
    okxTrading: "OKX Trading (Read-only)",
    lockedLabel: "Locked - Cannot withdraw",
    readOnlyLabel: "External custody - Not withdrawable here",
    noFunds: "No funds available"
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
    success: "تمت الموافقة على السحب",
    successDesc: "تمت الموافقة على سحبك ويتم معالجته.",
    reference: "المرجع",
    txHash: "TX Hash",
    processingTime: "وقت المعالجة: 5 دقائق إلى 24 ساعة.",
    disclaimer: "هذا طلب سحب دفتر داخلي. يتم خصم الأموال فوراً بعد الموافقة.",
    copied: "تم النسخ!",
    close: "إغلاق",
    history: "السحوبات الأخيرة",
    noHistory: "لا توجد سحوبات بعد",
    insufficientBalance: "رصيد غير كافٍ",
    invalidAddress: "تنسيق عنوان غير صالح",
    minAmount: "الحد الأدنى للسحب هو",
    fundingWallet: "محفظة التمويل",
    copyTradingWallet: "محفظة نسخ التداول",
    stakedLocked: "مستثمر (مقفل)",
    okxTrading: "تداول OKX (للقراءة فقط)",
    lockedLabel: "مقفل - لا يمكن السحب",
    readOnlyLabel: "حفظ خارجي - غير قابل للسحب هنا",
    noFunds: "لا توجد أموال متاحة"
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

export default function WithdrawModal({ 
  open, 
  onOpenChange, 
  language = "en", 
  onSuccess
}) {
  const t = translations[language] || translations.en;
  const isMobile = useMediaQuery("(max-width: 768px)");
  
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
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(null);
  const [history, setHistory] = useState([]);
  const [mode, setMode] = useState("form"); // form | success

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

  const handleSubmit = async (e) => {
    e.preventDefault();
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
        setResult(res.data.data);
        setMode("success");
        // Update history instantly
        setHistory(prev => [res.data.data, ...prev.slice(0, 4)]);
        onSuccess?.();
      } else {
        setError(res.data?.error?.message || "Withdrawal failed");
      }
    } catch (e) {
      setError(e.message || "Withdrawal failed");
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
    setResult(null);
    setError(null);
    setAddress("");
    setAmount("");
    setAddressError(null);
  };

  const formatAddress = (addr) => {
    if (!addr) return "";
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  const getAccountLabel = (type) => {
    if (type === 'FUNDING') return t.fundingWallet;
    if (type === 'COPY_TRADING') return t.copyTradingWallet;
    return type;
  };

  const getAccountIcon = (type) => {
    if (type === 'FUNDING') return Wallet;
    if (type === 'COPY_TRADING') return TrendingUp;
    return Wallet;
  };

  const content = (
    <div className="space-y-5 pb-4">
      {/* Success State */}
      {mode === "success" && result ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{t.success}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t.successDesc}</p>
          </div>
          
          <div className="space-y-3 p-4 rounded-xl bg-muted/50">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <Badge className="bg-emerald-500/20 text-emerald-600 border-0">APPROVED</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.fromAccount}</span>
              <span>{getAccountLabel(result.source_account_type)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.amount}</span>
              <span className="font-mono font-medium">{result.amount?.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.fee}</span>
              <span className="font-mono">{result.fee?.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.totalDeducted}</span>
              <span className="font-mono font-medium text-foreground">{result.total_debit?.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.network}</span>
              <span>{result.network}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.address}</span>
              <span className="font-mono text-xs">{formatAddress(result.address)}</span>
            </div>
            
            <div className="border-t border-border pt-3 mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t.reference}</span>
                <button 
                  onClick={() => copyToClipboard(result.reference, 'ref')}
                  className="flex items-center gap-1.5 text-sm font-mono text-primary hover:text-primary/80 transition-colors"
                  type="button"
                >
                  {result.reference}
                  {copied === 'ref' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t.txHash}</span>
                <button 
                  onClick={() => copyToClipboard(result.mock_tx_hash, 'tx')}
                  className="flex items-center gap-1.5 text-xs font-mono text-primary hover:text-primary/80 transition-colors group"
                  type="button"
                >
                  <span className="max-w-[140px] truncate">{result.mock_tx_hash}</span>
                  {copied === 'tx' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                </button>
              </div>
            </div>
          </div>
          
          <Alert className="bg-blue-500/10 border-blue-500/30">
            <Clock className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-xs text-blue-700 dark:text-blue-400">
              {t.processingTime}
            </AlertDescription>
          </Alert>
          
          <div className="flex gap-3 pt-2">
            <Button 
              variant="outline" 
              className="flex-1 rounded-xl h-11" 
              onClick={resetForm}
              type="button"
            >
              New Withdrawal
            </Button>
            <Button 
              className="flex-1 rounded-xl bg-primary h-11" 
              onClick={() => {
                onOpenChange(false);
                setTimeout(() => {
                  setMode("form");
                  setResult(null);
                  setError(null);
                  setAddress("");
                  setAmount("");
                }, 300);
              }}
              type="button"
            >
              {t.close}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* From Account Selection */}
          <div className="space-y-2">
            <Label>{t.fromAccount}</Label>
            <Select value={sourceAccount} onValueChange={setSourceAccount}>
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
          
          {/* Balance Summary for Selected Account */}
          <div className="grid grid-cols-3 gap-4 p-5 rounded-xl bg-gradient-to-br from-muted/80 to-muted/50 border border-border/50">
            <div className="text-center">
              <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">{t.withdrawable}</p>
              {balancesLoading ? (
                <div className="h-7 w-full bg-muted-foreground/20 rounded animate-pulse" />
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
                <div className="h-7 w-full bg-muted-foreground/20 rounded animate-pulse" />
              ) : (
                <p className="font-mono text-lg text-muted-foreground">
                  {currentBalance.locked.toFixed(2)}
                </p>
              )}
            </div>
            <div className="text-center">
              <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">{t.pending}</p>
              {balancesLoading ? (
                <div className="h-7 w-full bg-muted-foreground/20 rounded animate-pulse" />
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
            <Select value={network} onValueChange={setNetwork}>
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
              className={`rounded-xl font-mono text-sm ${addressError ? 'border-red-500' : ''}`}
            />
            {addressError && (
              <p className="text-xs text-red-500">{addressError}</p>
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
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                USDT
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAmount(Math.max(0, currentBalance.withdrawable - getFee()).toFixed(2))}
              className="text-xs text-primary hover:underline"
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
          
          {/* Submit */}
          <Button
            type="submit"
            disabled={loading || configLoading || balancesLoading || !!addressError || currentBalance.withdrawable <= 0}
            className="w-full rounded-xl bg-primary hover:bg-primary/90 h-12"
          >
            {loading ? (
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
          
          {/* Recent Withdrawals */}
          {history.length > 0 && (
            <div className="pt-4 border-t border-border">
              <h4 className="text-sm font-medium mb-3">{t.history}</h4>
              <div className="space-y-2 max-h-36 overflow-y-auto scrollbar-thin">
                {history.map(w => (
                  <div key={w.id} className="flex items-center justify-between text-xs p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                    <div className="flex items-center gap-2">
                      <Badge 
                        className={`text-[10px] ${
                          w.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-600' :
                          w.status === 'FAILED' ? 'bg-red-500/20 text-red-600' :
                          'bg-muted text-muted-foreground'
                        } border-0`}
                      >
                        {w.status}
                      </Badge>
                      <span className="font-mono font-medium">{w.amount?.toFixed(2)} USDT</span>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">{new Date(w.created_date).toLocaleDateString()}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {w.source_account_type === 'COPY_TRADING' ? 'Copy Trading' : 'Funding'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh] flex flex-col">
          <DrawerHeader className="text-left flex-shrink-0">
            <DrawerTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              {t.title}
            </DrawerTitle>
            <DrawerDescription>{t.subtitle}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 overflow-y-auto flex-1">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] w-[95vw] max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-1">{content}</div>
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