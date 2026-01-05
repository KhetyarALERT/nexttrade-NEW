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
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  Copy, 
  CheckCircle,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Star
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

const currencyIcons = {
  USDT: "💵",
  BTC: "₿",
  ETH: "Ξ",
  BNB: "🔶",
  SOL: "◎",
  XRP: "✕"
};

export default function WalletCard({ wallet, language = "en", onRefresh, compact = false }) {
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [depositAmount, setDepositAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [depositData, setDepositData] = useState(null);
  const [depositError, setDepositError] = useState(null);

  const t = language === "ar" ? {
    balance: "الرصيد",
    available: "متاح",
    locked: "مقفل",
    staked: "مستثمر",
    deposit: "إيداع",
    withdraw: "سحب",
    copied: "تم النسخ!",
    processing: "جاري المعالجة...",
    primary: "رئيسي",
    active: "نشط"
  } : {
    balance: "Balance",
    available: "Available",
    locked: "Locked",
    staked: "Staked",
    deposit: "Deposit",
    withdraw: "Withdraw",
    copied: "Copied!",
    processing: "Processing...",
    primary: "Primary",
    active: "Active"
  };

  const formatBalance = (val, decimals = 4) => {
    if (val === null || val === undefined) return "0";
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: decimals });
  };

  const handleCopy = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(t.copied);
    setTimeout(() => setCopied(false), 2000);
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
        setDepositError(result.data?.error || "Failed to create deposit");
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
    
    setLoading(true);
    try {
      const result = await base44.functions.invoke('wallet', {
        action: 'withdraw',
        walletId: wallet.id,
        amount: parseFloat(withdrawAmount),
        destinationAddress: withdrawAddress
      });
      
      if (result.data?.success) {
        toast.success("Withdrawal submitted");
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

  const availableBalance = wallet.balance - (wallet.locked_balance || 0) - (wallet.staked_balance || 0);
  const icon = currencyIcons[wallet.currency] || "💰";

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">{wallet.currency}</span>
              <span className="text-xs text-slate-500">{wallet.network}</span>
              {wallet.is_primary && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
            </div>
            <p className="text-sm text-slate-600">{formatBalance(availableBalance)} {t.available}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setDepositOpen(true)}>
            <ArrowDownToLine className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setWithdrawOpen(true)}>
            <ArrowUpFromLine className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{icon}</span>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {wallet.currency}
                  <Badge variant="outline" className="text-xs">{wallet.network}</Badge>
                  {wallet.is_primary && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                </CardTitle>
              </div>
            </div>
            <Badge className={wallet.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}>
              {t.active}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-center py-3 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg">
            <p className="text-xs text-slate-500 uppercase">{t.balance}</p>
            <p className="text-2xl font-bold text-slate-900">{formatBalance(wallet.balance)}</p>
            <p className="text-xs text-slate-500">{wallet.currency}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 bg-emerald-50 rounded">
              <p className="text-emerald-600 font-medium">{formatBalance(availableBalance, 2)}</p>
              <p className="text-slate-500">{t.available}</p>
            </div>
            <div className="p-2 bg-amber-50 rounded">
              <p className="text-amber-600 font-medium">{formatBalance(wallet.locked_balance || 0, 2)}</p>
              <p className="text-slate-500">{t.locked}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded">
              <p className="text-blue-600 font-medium">{formatBalance(wallet.staked_balance || 0, 2)}</p>
              <p className="text-slate-500">{t.staked}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setDepositOpen(true)}
            >
              <ArrowDownToLine className="w-4 h-4 mr-1" /> {t.deposit}
            </Button>
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setWithdrawOpen(true)}
            >
              <ArrowUpFromLine className="w-4 h-4 mr-1" /> {t.withdraw}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Deposit Dialog */}
      <Dialog open={depositOpen} onOpenChange={(open) => {
        setDepositOpen(open);
        if (!open) { setDepositData(null); setDepositError(null); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.deposit} {wallet.currency} ({wallet.network})</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!depositData && !loading && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Amount (USD)</Label>
                  <Input 
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="100"
                    min="10"
                  />
                </div>
                {depositError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {depositError}
                  </div>
                )}
                <Button onClick={handleGetDepositAddress} className="w-full bg-emerald-600 hover:bg-emerald-700">
                  Generate Address
                </Button>
              </div>
            )}
            
            {loading && (
              <div className="flex flex-col items-center justify-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
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
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open Payment Page
                    </a>
                  </div>
                )}
                
                {depositData.pay_address && (
                  <div className="space-y-2 pt-4 border-t">
                    <Label>Send to Address</Label>
                    <div className="flex gap-2">
                      <Input value={depositData.pay_address} readOnly className="font-mono text-xs" />
                      <Button variant="outline" size="icon" onClick={() => handleCopy(depositData.pay_address)}>
                        {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    {depositData.pay_amount && (
                      <p className="text-sm">Amount: <strong>{depositData.pay_amount} {wallet.currency}</strong></p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.withdraw} {wallet.currency}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input 
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-slate-500">Available: {formatBalance(availableBalance)} {wallet.currency}</p>
            </div>
            <div className="space-y-2">
              <Label>Destination Address ({wallet.network})</Label>
              <Input 
                value={withdrawAddress}
                onChange={(e) => setWithdrawAddress(e.target.value)}
                placeholder="Enter address..."
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleWithdraw} disabled={loading} className="w-full bg-red-600 hover:bg-red-700">
              {loading ? t.processing : `Withdraw ${wallet.currency}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

WalletCard.propTypes = {
  wallet: PropTypes.object,
  language: PropTypes.string,
  onRefresh: PropTypes.func,
  compact: PropTypes.bool
};