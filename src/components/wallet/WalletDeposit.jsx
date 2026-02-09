import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  ArrowLeft,
  History
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
    confirmed: "Confirmed",
    cardDepositTitle: "Card/Crypto Deposit (NOWPayments)",
    cardDepositDesc: "Generate a payment link and fund your wallet via NOWPayments.",
    amountLabel: "Deposit Amount (USD)",
    generateInvoice: "Generate Invoice",
    openInvoice: "Open Invoice",
    payAmount: "Pay Amount",
    networkLabel: "Network",
    invoiceReady: "Invoice ready — pay to this address or open the invoice.",
    nowpayUnavailable: "No wallet available for deposits. Please contact support.",
    okxSectionTitle: "Exchange Deposit (OKX Address)",
    okxUnavailable: "OKX trading account not available. Use the card/crypto deposit above."
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
    confirmed: "مؤكد",
    cardDepositTitle: "إيداع بالبطاقة / العملات المشفرة (NOWPayments)",
    cardDepositDesc: "أنشئ رابط دفع وأودع في محفظتك عبر NOWPayments.",
    amountLabel: "مبلغ الإيداع (دولار)",
    generateInvoice: "إنشاء فاتورة",
    openInvoice: "فتح الفاتورة",
    payAmount: "المبلغ المطلوب دفعه",
    networkLabel: "الشبكة",
    invoiceReady: "الفاتورة جاهزة — ادفع لهذا العنوان أو افتح الفاتورة.",
    nowpayUnavailable: "لا توجد محفظة متاحة للإيداع. يرجى التواصل مع الدعم.",
    okxSectionTitle: "إيداع عبر OKX",
    okxUnavailable: "حساب OKX غير متاح بعد. استخدم الإيداع بالبطاقة/العملات المشفرة أعلاه."
  }
};

export default function WalletDeposit({ language = "en", hasOkxAccount = false, wallets = [], onRefresh, showBackButton = false }) {
  const t = translations[language] || translations.en;
  const navigate = useNavigate();

  const [selectedCurrency, setSelectedCurrency] = useState("USDT");
  const [selectedChain, setSelectedChain] = useState("");
  const [loading, setLoading] = useState(false);
  const [depositAddresses, setDepositAddresses] = useState({});
  const [depositHistory, setDepositHistory] = useState([]);
  const [copied, setCopied] = useState(false);
  const [fiatAmount, setFiatAmount] = useState("100");
  const [invoice, setInvoice] = useState(null);
  const [npLoading, setNpLoading] = useState(false);
  const [npError, setNpError] = useState(null);
  const [depositWalletId, setDepositWalletId] = useState(null);

  const primaryWallet = (wallets || []).find((w) => w.is_primary) || (wallets || [])[0] || null;

  useEffect(() => {
    if (primaryWallet) {
      setDepositWalletId(primaryWallet.id);
      setSelectedCurrency(primaryWallet.currency || "USDT");
    }
  }, [primaryWallet?.id]);

  const handleCreateInvoice = async () => {
    if (!depositWalletId) {
      setNpError(t.nowpayUnavailable);
      return;
    }
    setNpLoading(true);
    setNpError(null);
    try {
      const amountNumber = Number(fiatAmount) || 100;
      const res = await base44.functions.invoke("wallet", {
        action: "getDepositAddress",
        walletId: depositWalletId,
        amount: amountNumber
      });
      if (res.data?.success) {
        setInvoice(res.data.data);
        toast.success(t.invoiceReady);
        onRefresh?.();
      } else {
        throw new Error(res.data?.error || "Failed to create invoice");
      }
    } catch (err) {
      setNpError(err.message);
      toast.error(err.message);
    } finally {
      setNpLoading(false);
    }
  };

  const loadDepositAddress = async (ccy) => {
    if (!hasOkxAccount) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke("okxUserAccount", { action: "getDepositAddress", ccy });
      if (res.data?.ok && res.data.data) {
        setDepositAddresses((prev) => ({ ...prev, [ccy]: res.data.data }));
        if (res.data.data.length > 0 && !selectedChain) {
          const trc20 = res.data.data.find((a) => a.chain.includes("TRC20"));
          setSelectedChain(trc20?.chain || res.data.data[0].chain);
        }
      }
    } catch (err) {
      toast.error(language === "ar" ? "فشل تحميل العنوان" : "Failed to load address");
    } finally {
      setLoading(false);
    }
  };

  const loadDepositHistory = async () => {
    if (!hasOkxAccount) return;
    try {
      const res = await base44.functions.invoke("okxUserAccount", { action: "getDepositHistory", limit: 5 });
      if (res.data?.ok) setDepositHistory(res.data.data || []);
    } catch (err) {
      console.error("[WalletDeposit] history error", err);
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

  return (
    <div className="space-y-6">
      {showBackButton && (
        <div className="lg:hidden mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === "ar" ? "رجوع" : "Back"}
          </Button>
        </div>
      )}

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-primary" />
            {t.cardDepositTitle}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{t.cardDepositDesc}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {depositWalletId ? (
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t.amountLabel}</label>
                <Input value={fiatAmount} onChange={(e) => setFiatAmount(e.target.value)} type="number" min="10" step="1" className="w-full" />
                <p className="text-xs text-muted-foreground">{primaryWallet ? `${primaryWallet.currency} • ${primaryWallet.network}` : ""}</p>
              </div>
              <Button onClick={handleCreateInvoice} disabled={npLoading} className="rounded-xl w-full sm:w-auto">
                {npLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                <span className="ml-2">{t.generateInvoice}</span>
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">{t.nowpayUnavailable}</div>
          )}

          {npError && <div className="text-sm text-rose-500 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">{npError}</div>}

          {invoice && (
            <div className="rounded-xl border border-border/70 bg-muted/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">{t.payAmount}</div>
                  <div className="font-semibold text-foreground">{invoice.pay_amount} {invoice.pay_currency}</div>
                </div>
                <Badge variant="outline" className="text-xs">{t.networkLabel}: {invoice.pay_currency?.toUpperCase()}</Badge>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">{t.depositAddress}</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all text-xs bg-background px-3 py-2 rounded-lg border border-border/60">{invoice.pay_address}</code>
                  <Button variant="outline" size="sm" onClick={() => handleCopy(invoice.pay_address)}>
                    {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="secondary" size="sm" className="rounded-lg">
                  <a href={invoice.invoice_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" /> {t.openInvoice}
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="rounded-lg" onClick={onRefresh}>
                  <RefreshCw className="h-4 w-4 mr-2" /> {t.loading}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-primary" />
            {t.okxSectionTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasOkxAccount && <div className="text-sm text-muted-foreground">{t.okxUnavailable}</div>}

          {hasOkxAccount && (
            <>
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

              {currentAddresses.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t.selectNetwork}</label>
                  <Select value={selectedChain} onValueChange={setSelectedChain}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currentAddresses.map((addr) => (
                        <SelectItem key={addr.chain} value={addr.chain}>
                          <div className="flex items-center justify-between gap-2">
                            <span>{CHAIN_NAMES[addr.chain] || addr.chain}</span>
                            <Badge variant="outline" className="text-[10px]">{CHAIN_FEES[addr.chain] || "Low fee"}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}

              {selectedAddress && !loading && (
                <div className="space-y-4">
                  <div className="flex justify-center p-4 bg-white rounded-xl">
                    <div className="w-32 h-32 flex items-center justify-center bg-muted rounded-lg">
                      <QrCode className="w-full h-full p-3 text-muted-foreground/50" />
                    </div>
                  </div>

                  <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">{t.depositAddress}</span>
                      <Button variant="ghost" size="sm" onClick={() => handleCopy(selectedAddress.addr)} className="h-8">
                        {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <code className="block break-all text-xs bg-background px-3 py-2 rounded-lg border border-border/60">{selectedAddress.addr}</code>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/20 border border-border/50 p-3">
                      <div className="text-xs text-muted-foreground">{t.minDeposit}</div>
                      <div className="text-sm font-semibold text-foreground">{selectedAddress.minDeposit || "—"}</div>
                    </div>
                    <div className="rounded-lg bg-muted/20 border border-border/50 p-3">
                      <div className="text-xs text-muted-foreground">{t.networkFee}</div>
                      <div className="text-sm font-semibold text-foreground">{CHAIN_FEES[selectedAddress.chain] || "—"}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/40 p-4 text-sm text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="h-5 w-5 mt-0.5" />
                    <span>{t.warning.replace("{currency}", selectedCurrency).replace("{network}", chainDisplayName)}</span>
                  </div>
                </div>
              )}

              {!selectedAddress && !loading && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/20 border border-dashed border-border/60 rounded-xl p-4">
                  <Info className="h-4 w-4" />
                  <span>{language === "ar" ? "اختر عملة وشبكة للحصول على العنوان." : "Select a currency and network to get a deposit address."}</span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {hasOkxAccount && depositHistory.length > 0 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              {t.recentDeposits}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {depositHistory.map((item) => (
              <div key={`${item.txId || item.txId}::${item.chain}`} className="flex items-start justify-between gap-3 rounded-xl border border-border/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted/40">
                    <ArrowDownToLine className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{item.amt || item.amount} {item.ccy || item.currency}</div>
                    <div className="text-xs text-muted-foreground">{CHAIN_NAMES[item.chain] || item.chain}</div>
                  </div>
                </div>
                <Badge variant="outline" className={`${(item.state || item.status) === "2" || (item.state || item.status) === "success" ? "text-emerald-600" : "text-amber-600"}`}>
                  {(item.state || item.status) === "2" || (item.state || item.status) === "success" ? t.confirmed : t.pending}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {hasOkxAccount && depositHistory.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">{t.noDeposits}</div>}
    </div>
  );
}

WalletDeposit.propTypes = {
  language: PropTypes.oneOf(["en", "ar"]),
  hasOkxAccount: PropTypes.bool,
  wallets: PropTypes.array,
  onRefresh: PropTypes.func,
  showBackButton: PropTypes.bool
};