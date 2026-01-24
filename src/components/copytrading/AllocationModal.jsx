import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import UsdtIcon from "@/components/ui/UsdtIcon";

// Format number with English digits always
function formatUsdt(val) {
  if (val === null || val === undefined || !Number.isFinite(val)) return "0.00";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

const t = {
  en: {
    title: "Add to Copy Trading",
    subtitle: "Transfer USDT to your copy trading balance",
    amount: "Amount (USDT)",
    source: "Source",
    available: "Available",
    minDeposit: "Min",
    presets: "Quick Select",
    cancel: "Cancel",
    confirm: "Confirm Allocation",
    processing: "Processing...",
    insufficientBalance: "Insufficient balance",
    belowMinimum: "Below minimum",
    okxFunding: "OKX Funding Account",
    okxTrading: "OKX Trading Account",
    totalOkx: "Total OKX Balance",
    internalWallet: "Internal Wallet",
  },
  ar: {
    title: "إضافة لنسخ التداول",
    subtitle: "حوّل USDT إلى رصيد نسخ التداول",
    amount: "المبلغ (USDT)",
    source: "المصدر",
    available: "متاح",
    minDeposit: "الحد الأدنى",
    presets: "اختيار سريع",
    cancel: "إلغاء",
    confirm: "تأكيد التخصيص",
    processing: "جاري المعالجة...",
    insufficientBalance: "رصيد غير كافٍ",
    belowMinimum: "أقل من الحد الأدنى",
    okxFunding: "حساب التمويل OKX",
    okxTrading: "حساب التداول OKX",
    totalOkx: "إجمالي رصيد OKX",
    internalWallet: "المحفظة الداخلية",
  }
};

export default function AllocationModal({ open, onOpenChange, onSuccess, liveAccount, config, language = "en" }) {
  const labels = t[language] || t.en;
  const isRTL = language === "ar";

  const [amount, setAmount] = useState("");
  const [depositSource, setDepositSource] = useState("OKX_FUNDING");
  const [processing, setProcessing] = useState(false);
  const [availableBalance, setAvailableBalance] = useState(0);

  const minDeposit = config?.min_deposit_usdt || 50;
  const presets = [50, 100, 250, 500, 1000];

  useEffect(() => {
    if (open && liveAccount) {
      // Set available balance based on source
      if (depositSource === "OKX_FUNDING") {
        setAvailableBalance(liveAccount.fundingBalance || 0);
      } else if (depositSource === "OKX_TRADING") {
        setAvailableBalance(liveAccount.tradingBalance || 0);
      } else if (depositSource === "TOTAL_OKX") {
        setAvailableBalance((liveAccount.fundingBalance || 0) + (liveAccount.tradingBalance || 0));
      } else {
        setAvailableBalance(0); // Internal wallet not implemented yet
      }
    }
  }, [open, depositSource, liveAccount]);

  const handleConfirm = async () => {
    const amountNum = Number(amount);

    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error(labels.belowMinimum);
      return;
    }

    if (amountNum < minDeposit) {
      toast.error(`${labels.minDeposit}: ${minDeposit} USDT`);
      return;
    }

    if (amountNum > availableBalance) {
      toast.error(labels.insufficientBalance);
      return;
    }

    setProcessing(true);
    try {
      const res = await base44.functions.invoke("copyTradingUser", {
        action: "createAllocation",
        amount: amountNum,
        depositSource
      });

      if (res.data?.ok) {
        onSuccess();
      } else {
        toast.error(res.data?.error?.message || "Failed to create allocation");
      }
    } catch (err) {
      toast.error(err.message || "Failed to create allocation");
    } finally {
      setProcessing(false);
    }
  };

  const sourceLabels = {
    OKX_FUNDING: labels.okxFunding,
    OKX_TRADING: labels.okxTrading,
    TOTAL_OKX: labels.totalOkx,
    INTERNAL_WALLET: labels.internalWallet
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
          {/* Source Selection */}
          <div>
            <Label className="text-xs">{labels.source}</Label>
            <Select value={depositSource} onValueChange={setDepositSource}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OKX_FUNDING">{sourceLabels.OKX_FUNDING}</SelectItem>
                <SelectItem value="OKX_TRADING">{sourceLabels.OKX_TRADING}</SelectItem>
                <SelectItem value="TOTAL_OKX">{sourceLabels.TOTAL_OKX}</SelectItem>
              </SelectContent>
            </Select>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{labels.available}:</span>
              <span className="font-mono font-medium">{formatUsdt(availableBalance)} USDT</span>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <Label className="text-xs">{labels.amount}</Label>
            <div className="mt-1 flex items-center gap-2 rounded-lg bg-input border border-border px-3 py-2.5">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`${labels.minDeposit}: ${minDeposit}`}
                className="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground font-mono"
                inputMode="decimal"
                autoFocus
              />
              <span className="text-xs px-2 py-1 rounded-md bg-muted text-foreground">USDT</span>
            </div>
          </div>

          {/* Presets */}
          <div>
            <Label className="text-xs mb-2 block">{labels.presets}</Label>
            <div className="grid grid-cols-5 gap-2">
              {presets.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(String(val))}
                  className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                    Number(amount) === val
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              {labels.cancel}
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={processing || !amount || Number(amount) < minDeposit}
              className="flex-1 bg-gradient-to-r from-primary to-blue-500"
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