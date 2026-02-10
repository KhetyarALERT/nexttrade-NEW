import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, RefreshCw, Info } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function OKXTransferModal({ open, onOpenChange, language = "en", onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [ccy, setCcy] = useState("USDT");
  const [from, setFrom] = useState("funding");
  const [to, setTo] = useState("trading");
  const [amount, setAmount] = useState("");
  const [balances, setBalances] = useState({ funding: 0, trading: 0 });
  const [transferHistory, setTransferHistory] = useState([]);

  const t = {
    en: {
      title: "Transfer",
      subtitle: "Transfer between your funding and trading accounts",
      asset: "Asset",
      from: "From",
      to: "To",
      amount: "Amount",
      available: "Available",
      inUse: "In use",
      max: "Max",
      transfer: "Transfer",
      transferring: "Transferring...",
      success: "Transfer successful!",
      error: "Transfer failed",
      funding: "Funding",
      trading: "Trading",
      swapAccounts: "Swap accounts",
      recentTransfers: "USDT transfers",
      transferHistory: "Transfer history",
      noTransfers: "No recent transfers"
    },
    ar: {
      title: "تحويل",
      subtitle: "تحويل بين حساب التمويل وحساب التداول",
      asset: "الأصل",
      from: "من",
      to: "إلى",
      amount: "المبلغ",
      available: "المتاح",
      inUse: "قيد الاستخدام",
      max: "الحد الأقصى",
      transfer: "تحويل",
      transferring: "جاري التحويل...",
      success: "تم التحويل بنجاح!",
      error: "فشل التحويل",
      funding: "التمويل",
      trading: "التداول",
      swapAccounts: "تبديل الحسابات",
      recentTransfers: "تحويلات USDT",
      transferHistory: "سجل التحويلات",
      noTransfers: "لا توجد تحويلات حديثة"
    }
  }[language] || {};

  const loadBalances = async () => {
    setLoadingBalances(true);
    try {
      const [fundingRes, tradingRes] = await Promise.all([
        base44.functions.invoke('okxUserAccount', { action: 'getFundingAssets' }),
        base44.functions.invoke('okxUserAccount', { action: 'getTradingAssets' })
      ]);

      const fundingAssets = fundingRes.data?.ok ? (fundingRes.data.data || []) : [];
      const tradingData = tradingRes.data?.ok ? tradingRes.data.data : null;
      const tradingAssets = tradingData?.assets || [];

      const fundingBal = fundingAssets.find(a => a.ccy === ccy)?.available || 0;
      const tradingBal = tradingAssets.find(a => a.ccy === ccy)?.available || 0;

      setBalances({
        funding: fundingBal,
        trading: tradingBal
      });
    } catch (err) {
      console.error('[OKXTransferModal] Load balances error:', err);
    } finally {
      setLoadingBalances(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadBalances();
    }
  }, [open, ccy]);

  const handleSwap = () => {
    const temp = from;
    setFrom(to);
    setTo(temp);
  };

  const handleMaxClick = () => {
    const available = from === 'funding' ? balances.funding : balances.trading;
    setAmount(String(available));
  };

  const handleTransfer = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      toast.error(language === 'ar' ? 'يرجى إدخال مبلغ صالح' : 'Please enter a valid amount');
      return;
    }

    const available = from === 'funding' ? balances.funding : balances.trading;
    if (amountNum > available) {
      toast.error(language === 'ar' ? 'المبلغ يتجاوز الرصيد المتاح' : 'Amount exceeds available balance');
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('okxUserAccount', {
        action: 'transfer',
        ccy,
        amount: amountNum,
        from,
        to
      });

      if (!res.data?.ok) {
        throw new Error(res.data?.error?.message || res.data?.error?.okxMsg || t.error);
      }

      toast.success(t.success);
      setAmount("");
      await loadBalances();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('[OKXTransferModal] Transfer error:', err);
      toast.error(err.message || t.error);
    } finally {
      setLoading(false);
    }
  };

  const formatBalance = (val) => {
    if (val === null || val === undefined) return '0.00';
    return parseFloat(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
  };

  const availableBalance = from === 'funding' ? balances.funding : balances.trading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{t.title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t.subtitle}
          </DialogDescription>
        </DialogHeader>

        {/* Info Banner */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-400">
            {language === 'ar' 
              ? 'هذا تحويل بين حساب التمويل وحساب التداول الخاص بك.'
              : 'This is a sub-account transfer between your funding and trading account.'}
          </p>
        </div>

        <div className="space-y-4 pt-2">
          {/* Asset Selection */}
          <div>
            <Label className="text-sm font-medium">{t.asset}</Label>
            <Select value={ccy} onValueChange={setCcy}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USDT">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">₮</div>
                    USDT
                  </div>
                </SelectItem>
                <SelectItem value="USDC">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">$</div>
                    USDC
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* From/To Selection */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label className="text-sm font-medium">{t.from}</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="funding">{t.funding}</SelectItem>
                  <SelectItem value="trading">{t.trading}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleSwap}
              className="mt-6 rounded-full"
              title={t.swapAccounts}
            >
              <ArrowRightLeft className="h-4 w-4" />
            </Button>

            <div className="flex-1">
              <Label className="text-sm font-medium">{t.to}</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="funding">{t.funding}</SelectItem>
                  <SelectItem value="trading">{t.trading}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <Label className="text-sm font-medium">{t.amount}</Label>
            <div className="mt-1 flex items-center gap-2 rounded-lg bg-muted/30 border border-border px-3 py-2">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="border-0 bg-transparent p-0 text-lg font-medium focus-visible:ring-0"
              />
              <span className="text-sm font-medium text-muted-foreground">{ccy}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleMaxClick}
                className="ml-2 h-7 px-2 text-xs"
              >
                {t.max}
              </Button>
            </div>
            
            {/* Available Balance */}
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t.available}:</span>
              <span className="font-mono text-foreground">
                {loadingBalances ? '...' : `${formatBalance(availableBalance)} ${ccy}`}
              </span>
            </div>
          </div>

          {/* Transfer Button */}
          <Button
            onClick={handleTransfer}
            disabled={loading || !amount || parseFloat(amount) <= 0}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {loading ? (
              <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> {t.transferring}</>
            ) : (
              t.transfer
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

OKXTransferModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  language: PropTypes.string,
  onSuccess: PropTypes.func
};