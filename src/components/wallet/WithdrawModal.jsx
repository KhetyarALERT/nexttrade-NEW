import { useState, useEffect } from "react";
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
  Wallet
} from "lucide-react";
import { useMediaQuery } from "@/components/hooks/useMediaQuery";

const translations = {
  en: {
    title: "Withdraw USDT",
    subtitle: "Withdraw to external wallet",
    network: "Network",
    address: "Wallet Address",
    addressPlaceholder: "Enter your wallet address",
    amount: "You Receive",
    amountPlaceholder: "Enter amount",
    fee: "Network Fee",
    totalDeducted: "Total Deducted",
    withdrawable: "Withdrawable",
    locked: "Locked (In Positions)",
    pending: "Pending",
    min: "Minimum",
    submit: "Withdraw",
    processing: "Processing...",
    success: "Withdrawal Approved",
    successDesc: "Your withdrawal has been approved and is being processed.",
    reference: "Reference",
    txHash: "TX Hash (Mock)",
    processingTime: "Processing time: 5 minutes to 24 hours.",
    disclaimer: "This is an internal ledger withdrawal request. Funds are deducted immediately after approval.",
    copied: "Copied!",
    close: "Close",
    history: "Recent Withdrawals",
    noHistory: "No withdrawals yet",
    comingSoon: "Coming Soon",
    insufficientBalance: "Insufficient balance",
    invalidAddress: "Invalid address format",
    minAmount: "Minimum withdrawal is",
    networkFee: "Network fees apply"
  },
  ar: {
    title: "سحب USDT",
    subtitle: "السحب إلى محفظة خارجية",
    network: "الشبكة",
    address: "عنوان المحفظة",
    addressPlaceholder: "أدخل عنوان محفظتك",
    amount: "ستستلم",
    amountPlaceholder: "أدخل المبلغ",
    fee: "رسوم الشبكة",
    totalDeducted: "إجمالي الخصم",
    withdrawable: "متاح للسحب",
    locked: "مقفل (في الصفقات)",
    pending: "معلق",
    min: "الحد الأدنى",
    submit: "سحب",
    processing: "جاري المعالجة...",
    success: "تمت الموافقة على السحب",
    successDesc: "تمت الموافقة على سحبك ويتم معالجته.",
    reference: "المرجع",
    txHash: "TX Hash (وهمي)",
    processingTime: "وقت المعالجة: 5 دقائق إلى 24 ساعة.",
    disclaimer: "هذا طلب سحب دفتر داخلي. يتم خصم الأموال فوراً بعد الموافقة.",
    copied: "تم النسخ!",
    close: "إغلاق",
    history: "السحوبات الأخيرة",
    noHistory: "لا توجد سحوبات بعد",
    comingSoon: "قريباً",
    insufficientBalance: "رصيد غير كافٍ",
    invalidAddress: "تنسيق عنوان غير صالح",
    minAmount: "الحد الأدنى للسحب هو",
    networkFee: "تطبق رسوم الشبكة"
  }
};

export default function WithdrawModal({ 
  open, 
  onOpenChange, 
  language = "en", 
  onSuccess,
  walletData = {}
}) {
  const t = translations[language] || translations.en;
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [network, setNetwork] = useState("TRC20");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(null);
  const [history, setHistory] = useState([]);

  // Wallet balances from props
  const withdrawable = walletData.withdrawable || 0;
  const locked = walletData.locked || 0;
  const pending = walletData.pending || 0;

  // Load config on mount
  useEffect(() => {
    if (open) {
      loadConfig();
      loadHistory();
    }
  }, [open]);

  const loadConfig = async () => {
    setConfigLoading(true);
    try {
      const res = await base44.functions.invoke("ledgerWithdrawal", { action: "getConfig" });
      if (res.data?.ok) {
        setConfig(res.data.data);
      }
    } catch (e) {
      console.error("Failed to load config:", e);
    } finally {
      setConfigLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await base44.functions.invoke("ledgerWithdrawal", { action: "list", limit: 5 });
      if (res.data?.ok) {
        setHistory(res.data.data || []);
      }
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  };

  const getFee = () => {
    if (!config) return 0;
    const networkConfig = config.networks.find(n => n.network === network);
    return networkConfig?.fee || 0;
  };

  const getTotalDebit = () => {
    const amountNum = parseFloat(amount) || 0;
    return amountNum + getFee();
  };

  const isNetworkSupported = () => {
    if (!config) return false;
    const networkConfig = config.networks.find(n => n.network === network);
    return networkConfig?.supported;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    const amountNum = parseFloat(amount);
    const totalDebit = getTotalDebit();
    
    // Validations
    if (!isNetworkSupported()) {
      setError(`${network} ${t.comingSoon}`);
      return;
    }
    
    if (!address.trim()) {
      setError(t.invalidAddress);
      return;
    }
    
    if (config && amountNum < config.min_withdrawal) {
      setError(`${t.minAmount} ${config.min_withdrawal} USDT`);
      return;
    }
    
    if (totalDebit > withdrawable) {
      setError(t.insufficientBalance);
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await base44.functions.invoke("ledgerWithdrawal", {
        action: "create",
        network,
        address: address.trim(),
        amount: amountNum,
        requestId: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      });
      
      if (res.data?.ok) {
        setResult(res.data.data);
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
    setResult(null);
    setError(null);
    setAddress("");
    setAmount("");
    loadHistory();
  };

  const formatAddress = (addr) => {
    if (!addr) return "";
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  const content = (
    <div className="space-y-6 pb-4">
      {/* Success State */}
      {result ? (
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
            
            <div className="border-t border-border pt-3 mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t.reference}</span>
                <button 
                  onClick={() => copyToClipboard(result.reference, 'ref')}
                  className="flex items-center gap-1 text-xs font-mono text-primary hover:underline"
                >
                  {result.reference}
                  <Copy className="w-3 h-3" />
                  {copied === 'ref' && <span className="text-emerald-500">✓</span>}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t.txHash}</span>
                <button 
                  onClick={() => copyToClipboard(result.mock_tx_hash, 'tx')}
                  className="flex items-center gap-1 text-xs font-mono text-primary hover:underline max-w-[180px] truncate"
                >
                  {result.mock_tx_hash?.slice(0, 16)}...
                  <Copy className="w-3 h-3 flex-shrink-0" />
                  {copied === 'tx' && <span className="text-emerald-500">✓</span>}
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
          
          <Alert className="bg-muted border-border">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs text-muted-foreground">
              {t.disclaimer}
            </AlertDescription>
          </Alert>
          
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 rounded-xl" 
              onClick={resetForm}
            >
              New Withdrawal
            </Button>
            <Button 
              className="flex-1 rounded-xl bg-primary" 
              onClick={() => onOpenChange(false)}
            >
              {t.close}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Balance Summary */}
          <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-muted/50">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">{t.withdrawable}</p>
              <p className="font-mono font-semibold text-emerald-600">{withdrawable.toFixed(2)}</p>
            </div>
            <div className="text-center border-x border-border">
              <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" /> {t.locked}
              </p>
              <p className="font-mono text-sm text-muted-foreground">{locked.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">{t.pending}</p>
              <p className="font-mono text-sm text-muted-foreground">{pending.toFixed(2)}</p>
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
                  <SelectItem key={n.network} value={n.network} disabled={!n.supported}>
                    <div className="flex items-center gap-2">
                      <span>{n.network}</span>
                      {!n.supported && (
                        <Badge variant="outline" className="text-xs">{t.comingSoon}</Badge>
                      )}
                      {n.supported && n.fee > 0 && (
                        <span className="text-xs text-muted-foreground">Fee: {n.fee} USDT</span>
                      )}
                    </div>
                  </SelectItem>
                )) || (
                  <SelectItem value="TRC20">TRC20</SelectItem>
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
              placeholder={t.addressPlaceholder}
              className="rounded-xl font-mono text-sm"
            />
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
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t.amountPlaceholder}
                className="rounded-xl pr-16 font-mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                USDT
              </span>
            </div>
          </div>
          
          {/* Fee & Total */}
          {amount && parseFloat(amount) > 0 && (
            <div className="space-y-2 p-3 rounded-xl bg-muted/30 border border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t.fee} ({network})</span>
                <span className="font-mono">{getFee().toFixed(2)} USDT</span>
              </div>
              <div className="flex justify-between text-sm font-medium pt-2 border-t border-border">
                <span>{t.totalDeducted}</span>
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
            disabled={loading || configLoading || !isNetworkSupported()}
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
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {history.map(w => (
                  <div key={w.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30">
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
                      <span className="font-mono">{w.amount?.toFixed(2)}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {new Date(w.created_date).toLocaleDateString()}
                    </span>
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
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              {t.title}
            </DrawerTitle>
            <DrawerDescription>{t.subtitle}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 overflow-y-auto">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

WithdrawModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  language: PropTypes.string,
  onSuccess: PropTypes.func,
  walletData: PropTypes.shape({
    withdrawable: PropTypes.number,
    locked: PropTypes.number,
    pending: PropTypes.number
  })
};