import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, Wallet, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import UsdtIcon from "@/components/ui/UsdtIcon";

// Format number with English digits always (even in Arabic UI)
function formatUsdt(val) {
  if (val === null || val === undefined || !Number.isFinite(val)) return "0.00";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

const t = {
  en: {
    title: "Add to Copy Trading",
    subtitle: "Transfer USDT from your Trading Account",
    amount: "Amount",
    from: "From",
    tradingAccount: "Trading Account",
    available: "Available",
    minDeposit: "Minimum",
    max: "MAX",
    presets: "Quick Select",
    cancel: "Cancel",
    confirm: "Confirm",
    processing: "Processing...",
    insufficientBalance: "Insufficient balance",
    belowMinimum: "Amount below minimum",
    enterAmount: "Enter amount",
  },
  ar: {
    title: "إضافة لنسخ التداول",
    subtitle: "حوّل USDT من حساب التداول الخاص بك",
    amount: "المبلغ",
    from: "من",
    tradingAccount: "حساب التداول",
    available: "متاح",
    minDeposit: "الحد الأدنى",
    max: "الحد الأقصى",
    presets: "اختيار سريع",
    cancel: "إلغاء",
    confirm: "تأكيد",
    processing: "جاري المعالجة...",
    insufficientBalance: "رصيد غير كافٍ",
    belowMinimum: "المبلغ أقل من الحد الأدنى",
    enterAmount: "أدخل المبلغ",
  }
};

export default function AllocationModal({ open, onOpenChange, onSuccess, liveAccount, config, language = "en" }) {
  const labels = t[language] || t.en;
  const isRTL = language === "ar";

  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [freshBalance, setFreshBalance] = useState(null);

  // Fetch fresh balance from OKX when modal opens
  const loadFreshBalance = useCallback(async () => {
    setLoadingBalance(true);
    try {
      const res = await base44.functions.invoke("okxUserAccount", { action: "getMyAccount" });
      if (res.data?.ok && res.data.data?.hasAccount) {
        setFreshBalance(res.data.data.balances?.tradingUsdt || 0);
      }
    } catch (err) {
      console.error("Failed to load balance:", err);
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  // Reset amount and load fresh balance when modal opens
  useEffect(() => {
    if (open) {
      setAmount("");
      loadFreshBalance();
    }
  }, [open, loadFreshBalance]);

  // Use fresh balance if available, otherwise fall back to prop
  const availableBalance = freshBalance !== null ? freshBalance : (liveAccount?.tradingBalance || 0);
  const minDeposit = config?.min_deposit_usdt || 50;
  const presets = [50, 100, 250, 500];

  const amountNum = Number(amount) || 0;
  const isInsufficientBalance = amountNum > availableBalance;
  const isBelowMinimum = amountNum > 0 && amountNum < minDeposit;
  const isValid = amountNum >= minDeposit && amountNum <= availableBalance;

  const handleMax = () => {
    // Set to available balance, but respect minimum
    const maxAmount = Math.max(0, availableBalance);
    setAmount(maxAmount > 0 ? String(Math.floor(maxAmount * 100) / 100) : "");
  };

  const handleConfirm = async () => {
    if (!isValid || processing) return;

    setProcessing(true);
    try {
      const res = await base44.functions.invoke("copyTradingUser", {
        action: "depositFunds",
        amount: amountNum
      });

      if (res.data?.ok) {
        const newBalance = res.data.data?.newBalance || amountNum;
        toast.success(
          language === "ar" 
            ? `تم إيداع ${amountNum} USDT بنجاح!` 
            : `Successfully deposited ${amountNum} USDT!`
        );
        onOpenChange(false);
        onSuccess(res.data.data);
      } else {
        const errMsg = res.data?.error?.message || (language === "ar" ? "فشل الإيداع" : "Deposit failed");
        toast.error(errMsg);
      }
    } catch (err) {
      toast.error(err.message || (language === "ar" ? "فشل الإيداع" : "Deposit failed"));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UsdtIcon size="sm" />
            {labels.title}
          </DialogTitle>
          <DialogDescription>{labels.subtitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source Display (Read-only) */}
          <div className="p-3 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{labels.from}:</span>
                <span className="text-sm font-medium text-foreground">{labels.tradingAccount}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={loadFreshBalance}
                disabled={loadingBalance}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingBalance ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{labels.available}:</span>
              {loadingBalance ? (
                <span className="text-xs text-muted-foreground">Loading...</span>
              ) : (
                <span className="text-sm font-bold font-mono text-foreground">{formatUsdt(availableBalance)} USDT</span>
              )}
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">{labels.amount}</Label>
              <span className="text-xs text-muted-foreground">{labels.minDeposit}: {formatUsdt(minDeposit)} USDT</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-input border border-border px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/20">
              <input
                value={amount}
                onChange={(e) => {
                  // Only allow numbers and decimal point
                  const val = e.target.value.replace(/[^0-9.]/g, '');
                  // Prevent multiple decimal points
                  const parts = val.split('.');
                  if (parts.length > 2) return;
                  setAmount(val);
                }}
                placeholder={labels.enterAmount}
                className="w-full bg-transparent outline-none text-lg text-foreground placeholder:text-muted-foreground font-mono"
                inputMode="decimal"
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleMax}
                className="text-xs font-bold text-primary hover:text-primary/80 px-2 py-1 h-auto"
              >
                {labels.max}
              </Button>
              <span className="text-sm font-medium text-muted-foreground px-2 py-1 rounded-md bg-muted">USDT</span>
            </div>

            {/* Validation Messages */}
            {isInsufficientBalance && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5" />
                {labels.insufficientBalance}
              </div>
            )}
            {isBelowMinimum && !isInsufficientBalance && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                <AlertCircle className="w-3.5 h-3.5" />
                {labels.belowMinimum} ({formatUsdt(minDeposit)} USDT)
              </div>
            )}
          </div>

          {/* Presets */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">{labels.presets}</Label>
            <div className="grid grid-cols-4 gap-2">
              {presets.map((val) => {
                const isDisabled = val > availableBalance;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => !isDisabled && setAmount(String(val))}
                    disabled={isDisabled}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                      Number(amount) === val
                        ? "bg-primary text-primary-foreground shadow-md"
                        : isDisabled
                          ? "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
                          : "bg-muted text-foreground hover:bg-secondary"
                    }`}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl">
              {labels.cancel}
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={processing || !isValid}
              className="flex-1 bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90 rounded-xl"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {labels.processing}
                </>
              ) : (
                <>
                  {labels.confirm}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

AllocationModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
  liveAccount: PropTypes.object,
  config: PropTypes.object,
  language: PropTypes.string,
};