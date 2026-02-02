import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  ArrowDownToLine,
  Copy,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  QrCode,
  Info,
  ExternalLink,
  ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import CryptoIcon from "@/components/ui/CryptoIcon";

const CHAIN_NAMES = {
  "USDT-TRC20": "Tron (TRC20)",
  "USDT-ERC20": "Ethereum (ERC20)",
  "USDT-Polygon": "Polygon",
  "USDT-Arbitrum One": "Arbitrum",
  "USDT-BNB Smart Chain(BEP20)": "BSC (BEP20)",
  "USDT-Solana": "Solana",
  "BTC-Bitcoin": "Bitcoin",
  "ETH-ERC20": "Ethereum"
};

const CHAIN_FEES = {
  "USDT-TRC20": "~1 USDT",
  "USDT-ERC20": "~15 USDT",
  "USDT-Polygon": "~0.1 USDT",
  "USDT-Arbitrum One": "~0.5 USDT",
  "USDT-BNB Smart Chain(BEP20)": "~0.5 USDT",
  "BTC-Bitcoin": "~0.0001 BTC"
};

const translations = {
  en: {
    title: "Deposit",
    selectCurrency: "Select Currency",
    selectNetwork: "Select Network",
    depositAddress: "Deposit Address",
    copyAddress: "Copy",
    copied: "Copied!",
    minDeposit: "Minimum Deposit",
    networkFee: "Network Fee",
    warning: "Only send {currency} via {network}. Deposits from wrong networks will be lost permanently.",
    loading: "Loading...",
    generateAddress: "Get Deposit Address",
    noAccount: "Trading account required",
    noAccountDesc: "Please activate your trading account first to get a deposit address.",
    recentDeposits: "Recent Deposits",
    noDeposits: "No recent deposits",
    pending: "Pending",
    confirmed: "Confirmed"
  },
  ar: {
    title: "إيداع",
    selectCurrency: "اختر العملة",
    selectNetwork: "اختر الشبكة",
    depositAddress: "عنوان الإيداع",
    copyAddress: "نسخ",
    copied: "تم النسخ!",
    minDeposit: "الحد الأدنى للإيداع",
    networkFee: "رسوم الشبكة",
    warning: "أرسل {currency} عبر شبكة {network} فقط. الإيداعات من شبكات خاطئة ستُفقد نهائياً.",
    loading: "جاري التحميل...",
    generateAddress: "الحصول على عنوان الإيداع",
    noAccount: "حساب التداول مطلوب",
    noAccountDesc: "يرجى تفعيل حساب التداول أولاً للحصول على عنوان إيداع.",
    recentDeposits: "الإيداعات الأخيرة",
    noDeposits: "لا توجد إيداعات حديثة",
    pending: "قيد الانتظار",
    confirmed: "مؤكد"
  }
};

export default function WalletDeposit({ language = "en", hasOkxAccount = false, onRefresh, showBackButton = false }) {
  const t = translations[language] || translations.en;
  const navigate = useNavigate();

  const [selectedCurrency, setSelectedCurrency] = useState("USDT");
  const [selectedChain, setSelectedChain] = useState("");
  const [loading, setLoading] = useState(false);
  const [depositAddresses, setDepositAddresses] = useState({});
  const [depositHistory, setDepositHistory] = useState([]);
  const [copied, setCopied] = useState(false);

  // Load deposit addresses when currency changes
  const loadDepositAddress = async (ccy) => {
    if (!hasOkxAccount) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke("okxUserAccount", {
        action: "getDepositAddress",
        ccy
      });
      if (res.data?.ok && res.data.data) {
        setDepositAddresses((prev) => ({
          ...prev,
          [ccy]: res.data.data
        }));
        // Auto-select first chain (prefer TRC20 for USDT)
        if (res.data.data.length > 0 && !selectedChain) {
          const trc20 = res.data.data.find((a) => a.chain.includes("TRC20"));
          setSelectedChain(trc20?.chain || res.data.data[0].chain);
        }
      }
    } catch (err) {
      console.error("[WalletDeposit] Load address error:", err);
      toast.error(language === "ar" ? "فشل تحميل العنوان" : "Failed to load address");
    } finally {
      setLoading(false);
    }
  };

  // Load deposit history
  const loadDepositHistory = async () => {
    if (!hasOkxAccount) return;
    try {
      const res = await base44.functions.invoke("okxUserAccount", {
        action: "getDepositHistory",
        limit: 5
      });
      if (res.data?.ok) {
        setDepositHistory(res.data.data || []);
      }
    } catch (err) {
      console.error("[WalletDeposit] Load history error:", err);
    }
  };

  useEffect(() => {
    if (hasOkxAccount) {
      loadDepositAddress(selectedCurrency);
      loadDepositHistory();
    }
  }, [hasOkxAccount, selectedCurrency]);

  const handleCurrencyChange = (ccy) => {
    setSelectedCurrency(ccy);
    setSelectedChain("");
    if (!depositAddresses[ccy]) {
      loadDepositAddress(ccy);
    } else {
      const addresses = depositAddresses[ccy];
      if (addresses?.length > 0) {
        const trc20 = addresses.find((a) => a.chain.includes("TRC20"));
        setSelectedChain(trc20?.chain || addresses[0].chain);
      }
    }
  };

  const handleCopy = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(t.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentAddresses = depositAddresses[selectedCurrency] || [];
  const selectedAddress = currentAddresses.find((a) => a.chain === selectedChain);
  const chainDisplayName = CHAIN_NAMES[selectedChain] || selectedChain?.split("-").pop() || selectedChain;

  if (!hasOkxAccount) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
            <ArrowDownToLine className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{t.noAccount}</h3>
          <p className="text-sm text-muted-foreground mt-2">{t.noAccountDesc}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mobile Back Button */}
      {showBackButton && (
        <div className="lg:hidden mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === "ar" ? "رجوع" : "Back"}
          </Button>
        </div>
      )}
      
      {/* Deposit Form */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-primary" />
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Select Currency */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{t.selectCurrency}</label>
            <Select value={selectedCurrency} onValueChange={handleCurrencyChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["USDT", "USDC", "BTC", "ETH"].map((ccy) => (
                  <SelectItem key={ccy} value={ccy}>
                    <div className="flex items-center gap-2">
                      <CryptoIcon currency={ccy} size="sm" />
                      {ccy}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Select Network */}
          {currentAddresses.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t.selectNetwork}</label>
              <Select value={selectedChain} onValueChange={setSelectedChain}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t.selectNetwork} />
                </SelectTrigger>
                <SelectContent>
                  {currentAddresses.map((addr) => (
                    <SelectItem key={addr.chain} value={addr.chain}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{CHAIN_NAMES[addr.chain] || addr.chain.split("-").pop()}</span>
                        {CHAIN_FEES[addr.chain] && (
                          <span className="text-xs text-muted-foreground">
                            Fee: {CHAIN_FEES[addr.chain]}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {/* Deposit Address Display */}
          {selectedAddress && !loading && (
            <div className="space-y-4">
              {/* QR Code Placeholder */}
              <div className="flex justify-center p-4 bg-white rounded-xl">
                <div className="w-32 h-32 flex items-center justify-center bg-muted rounded-lg">
                  <QrCode className="w-full h-full p-3 text-muted-foreground/50" />
                </div>
              </div>

              {/* Address */}
              <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">{t.depositAddress}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(selectedAddress.address)}
                    className="h-7 px-2"
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="ml-1 text-xs">{t.copyAddress}</span>
                  </Button>
                </div>
                <code className="text-sm font-mono text-foreground break-all block">
                  {selectedAddress.address}
                </code>

                {selectedAddress.tag && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Memo/Tag</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(selectedAddress.tag)}
                        className="h-6 px-2"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <code className="text-sm font-mono text-foreground">{selectedAddress.tag}</code>
                  </div>
                )}
              </div>

              {/* Min Deposit & Network Info */}
              <div className="grid grid-cols-2 gap-3">
                {selectedAddress.minDeposit && (
                  <div className="p-3 bg-muted/30 rounded-xl">
                    <span className="text-xs text-muted-foreground block">{t.minDeposit}</span>
                    <span className="font-medium text-foreground">
                      {selectedAddress.minDeposit} {selectedCurrency}
                    </span>
                  </div>
                )}
                {CHAIN_FEES[selectedChain] && (
                  <div className="p-3 bg-muted/30 rounded-xl">
                    <span className="text-xs text-muted-foreground block">{t.networkFee}</span>
                    <span className="font-medium text-foreground">{CHAIN_FEES[selectedChain]}</span>
                  </div>
                )}
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-amber-100/40 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {t.warning
                    .replace("{currency}", selectedCurrency)
                    .replace("{network}", chainDisplayName)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Deposits */}
      {depositHistory.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.recentDeposits}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {depositHistory.map((dep, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <CryptoIcon currency={dep.ccy} size="sm" />
                    <div>
                      <p className="font-medium text-foreground">
                        {dep.amount} {dep.ccy}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {CHAIN_NAMES[dep.chain] || dep.chain}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      dep.state === "2"
                        ? "text-emerald-600 border-emerald-300"
                        : "text-amber-600 border-amber-300"
                    }`}
                  >
                    {dep.state === "2" ? t.confirmed : t.pending}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

WalletDeposit.propTypes = {
  language: PropTypes.string,
  hasOkxAccount: PropTypes.bool,
  onRefresh: PropTypes.func,
  showBackButton: PropTypes.bool
};