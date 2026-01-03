import { useState } from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Wallet, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  Copy, 
  CheckCircle,
  RefreshCw,
  ExternalLink,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

const translations = {
  en: {
    balance: "Balance",
    deposit: "Deposit",
    withdraw: "Withdraw",
    depositAddress: "Deposit Address",
    copyAddress: "Copy Address",
    copied: "Copied!",
    withdrawAmount: "Withdrawal Amount",
    destinationAddress: "Destination Address",
    confirmWithdraw: "Confirm Withdrawal",
    processing: "Processing...",
    totalDeposited: "Total Deposited",
    totalWithdrawn: "Total Withdrawn",
    active: "Active",
    inactive: "Inactive",
    scanQR: "Scan QR code or copy address below",
    minDeposit: "Min deposit: 10 USDT",
    networkFee: "Network fee applies",
    withdrawNote: "Withdrawals are processed within 24 hours"
  },
  ar: {
    balance: "الرصيد",
    deposit: "إيداع",
    withdraw: "سحب",
    depositAddress: "عنوان الإيداع",
    copyAddress: "نسخ العنوان",
    copied: "تم النسخ!",
    withdrawAmount: "مبلغ السحب",
    destinationAddress: "عنوان الوجهة",
    confirmWithdraw: "تأكيد السحب",
    processing: "جاري المعالجة...",
    totalDeposited: "إجمالي الإيداعات",
    totalWithdrawn: "إجمالي السحوبات",
    active: "نشط",
    inactive: "غير نشط",
    scanQR: "امسح رمز QR أو انسخ العنوان أدناه",
    minDeposit: "الحد الأدنى للإيداع: 10 USDT",
    networkFee: "رسوم الشبكة سارية",
    withdrawNote: "تتم معالجة السحوبات خلال 24 ساعة"
  }
};

export default function WalletCard({ wallet, language = "en", onRefresh }) {
  const t = translations[language];
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [depositAmount, setDepositAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [depositData, setDepositData] = useState(null);
  const [depositError, setDepositError] = useState(null);

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return "0.00";
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleCopy = async (text) => {
    if (text) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(t.copied);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGetDepositAddress = async () => {
    setLoading(true);
    setDepositError(null);
    setDepositData(null);
    
    try {
      const result = await base44.functions.invoke('wallet', {
        action: 'getDepositAddress',
        walletId: wallet.id,
        amount: parseFloat(depositAmount) || 100
      });
      
      if (result.data?.success) {
        setDepositData(result.data.data);
      } else {
        setDepositError(result.data?.error || "Failed to create deposit invoice");
      }
    } catch (err) {
      setDepositError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !withdrawAddress) {
      toast.error("Please fill in all fields");
      return;
    }
    
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid amount");
      return;
    }
    
    if (amount > wallet.balance) {
      toast.error(`Insufficient balance. Available: ${wallet.balance} USDT`);
      return;
    }
    
    setLoading(true);
    try {
      const result = await base44.functions.invoke('wallet', {
        action: 'withdraw',
        walletId: wallet.id,
        amount,
        destinationAddress: withdrawAddress
      });
      
      if (result.data?.success) {
        toast.success("Withdrawal request submitted");
        setWithdrawOpen(false);
        setWithdrawAmount("");
        setWithdrawAddress("");
        if (onRefresh) onRefresh();
      } else {
        toast.error(result.data?.error || "Withdrawal failed");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!wallet) return null;

  return (
    <Card className="border-slate-200 shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">{wallet.currency} Wallet</CardTitle>
              <p className="text-xs text-slate-500 font-mono">{wallet.wallet_id?.substring(0, 16)}...</p>
            </div>
          </div>
          <Badge className={wallet.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}>
            {wallet.status === 'active' ? t.active : t.inactive}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-4">
        {/* Balance Display */}
        <div className="text-center mb-6 py-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl">
          <p className="text-xs text-slate-500 uppercase mb-1">{t.balance}</p>
          <p className="text-4xl font-bold text-slate-900">${formatCurrency(wallet.balance)}</p>
          <p className="text-sm text-slate-500 mt-1">USDT</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">{t.totalDeposited}</p>
            <p className="text-lg font-bold text-emerald-600">+${formatCurrency(wallet.total_deposited)}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">{t.totalWithdrawn}</p>
            <p className="text-lg font-bold text-red-500">-${formatCurrency(wallet.total_withdrawn)}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {/* Deposit Dialog */}
          <Dialog open={depositOpen} onOpenChange={(open) => {
            setDepositOpen(open);
            if (!open) {
              setDepositData(null);
              setDepositError(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                <ArrowDownToLine className="w-4 h-4 mr-2" /> {t.deposit}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t.deposit} USDT</DialogTitle>
                <DialogDescription>
                  {depositData ? t.scanQR : "Enter amount to generate deposit invoice"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {!depositData && !loading && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Deposit Amount (USD)</Label>
                      <Input 
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="100"
                        min="10"
                      />
                      <p className="text-xs text-slate-500">{t.minDeposit}</p>
                    </div>
                    {depositError && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {depositError}
                      </div>
                    )}
                    <Button 
                      onClick={handleGetDepositAddress}
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                    >
                      Generate Deposit Address
                    </Button>
                  </div>
                )}
                
                {loading && (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                    <p className="text-sm text-slate-500">Creating deposit invoice...</p>
                  </div>
                )}
                
                {depositData && !loading && (
                  <>
                    {depositData.invoice_url && (
                      <div className="text-center">
                        <a 
                          href={depositData.invoice_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open Payment Page
                        </a>
                        <p className="text-xs text-slate-500 mt-2">
                          Click to complete payment on NOWPayments
                        </p>
                      </div>
                    )}
                    
                    {depositData.pay_address && (
                      <div className="space-y-2 pt-4 border-t">
                        <Label>Or send directly to address ({wallet.currency})</Label>
                        <div className="flex gap-2">
                          <Input 
                            value={depositData.pay_address} 
                            readOnly 
                            className="font-mono text-xs bg-slate-50"
                          />
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={() => handleCopy(depositData.pay_address)}
                          >
                            {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                        {depositData.pay_amount && (
                          <p className="text-sm text-slate-600">
                            Amount: <strong>{depositData.pay_amount} {depositData.pay_currency?.toUpperCase()}</strong>
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div className="text-xs text-slate-500 space-y-1 pt-2">
                      <p>• {t.minDeposit}</p>
                      <p>• {t.networkFee}</p>
                      <p>• Balance updates automatically after confirmation</p>
                    </div>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Withdraw Dialog */}
          <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1">
                <ArrowUpFromLine className="w-4 h-4 mr-2" /> {t.withdraw}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t.withdraw} USDT</DialogTitle>
                <DialogDescription>{t.withdrawNote}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t.withdrawAmount}</Label>
                  <div className="relative">
                    <Input 
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      className="pr-16"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                      USDT
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Available: {formatCurrency(wallet.balance)} USDT
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{t.destinationAddress}</Label>
                  <Input 
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    placeholder="TRC20 address..."
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={handleWithdraw}
                  disabled={loading || !withdrawAmount || !withdrawAddress}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  {loading ? t.processing : t.confirmWithdraw}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

WalletCard.propTypes = {
  wallet: PropTypes.object,
  language: PropTypes.string,
  onRefresh: PropTypes.func
};