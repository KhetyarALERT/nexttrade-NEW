import { useState, useEffect, useCallback } from "react";
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
    cardDepositTitle: "Crypto Deposit",
    cardDepositDesc: "Create a payment and fund your wallet.",
    amountLabel: "Deposit Amount (USD)",
    startDeposit: "Start Deposit",
    openInvoice: "Open Payment Page",
    payAmount: "Pay Amount",
    networkLabel: "Network",
    invoiceReady: "Payment ready — pay to this address or open the page.",
    nowpayUnavailable: "No wallet available for deposits.",
    walletCreateError: "Trading account required to create a wallet.",
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
    cardDepositTitle: "إيداع بالعملات المشفرة",
    cardDepositDesc: "أنشئ دفعة وأودع في محفظتك.",
    amountLabel: "مبلغ الإيداع (دولار)",
    startDeposit: "بدء الإيداع",
    openInvoice: "فتح صفحة الدفع",
    payAmount: "المبلغ المطلوب دفعه",
    networkLabel: "الشبكة",
    invoiceReady: "الدفع جاهز — ادفع لهذا العنوان أو افتح الصفحة.",
    nowpayUnavailable: "لا توجد محفظة متاحة للإيداع.",
    walletCreateError: "يلزم حساب تداول لإنشاء المحفظة.",
    okxSectionTitle: "إيداع عبر OKX",
    okxUnavailable: "حساب OKX غير متاح بعد. استخدم الإيداع بالبطاقة/العملات المشفرة أعلاه."
  }
};

export default function WalletDeposit({ language = "en", hasOkxAccount = false, wallets = [], tradingAccountId, onRefresh, showBackButton = false }) {
  const t = translations[language] || translations.en;
  const navigate = useNavigate();

  const [selectedCurrency, setSelectedCurrency] = useState("USDT");
  const [selectedChain, setSelectedChain] = useState("");
  const [loading, setLoading] = useState(false);
  const [depositAddresses, setDepositAddresses] = useState({});
  const [okxDepositHistory, setOkxDepositHistory] = useState([]);
  const [npDepositHistory, setNpDepositHistory] = useState([]);
  const [copied, setCopied] = useState(false);
  const [fiatAmount, setFiatAmount] = useState("100");
  const [invoice, setInvoice] = useState(null);
  const [npLoading, setNpLoading] = useState(false);
  const [npError, setNpError] = useState(null);
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [depositWalletId, setDepositWalletId] = useState(null);

  const primaryWallet = (wallets || []).find((w) => w.is_primary) || (wallets || [])[0] || null;
  const depositWallet = (wallets || []).find((w) => w.id === depositWalletId) || primaryWallet;

  useEffect(() => {
    if (primaryWallet) {
      setDepositWalletId(primaryWallet.id);
      setSelectedCurrency(primaryWallet.currency || "USDT");
    }
  }, [primaryWallet]);

  const loadInternalDeposits = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("wallet", { action: "getTransactions", type: "deposit", limit: 5 });
      if (res.data?.success) {
        setNpDepositHistory(res.data.data || []);
      }
    } catch (err) {
      console.error("[WalletDeposit] np history error", err);
    }
  }, []);

  const handleCreateWallet = async () => {
    if (!tradingAccountId) {
      setNpError(t.walletCreateError);
      return null;
    }
    setCreatingWallet(true);
    setNpError(null);
    try {
      const res = await base44.functions.invoke("wallet", { action: "createAll", tradingAccountId });
      if (!res.data?.success) {
        throw new Error(res.data?.error || "Failed to create wallet");
      }
      const created = res.data.data || [];
      const primary = created.find((w) => w.is_primary) || created[0];
      if (primary?.id) {
        setDepositWalletId(primary.id);
        setSelectedCurrency(primary.currency || "USDT");
        onRefresh?.();
        return primary.id;
      }
    } catch (err) {
      setNpError(err.message);
      toast.error(err.message);
    } finally {
      setCreatingWallet(false);
    }
    return null;
  };

  const handleCreateInvoice = async () => {
    let walletId = depositWalletId;
    if (!walletId) {
      walletId = await handleCreateWallet();
    }
    if (!walletId) return;
    setNpLoading(true);
    setNpError(null);
    try {
      const amountNumber = Number(fiatAmount) || 100;
      const res = await base44.functions.invoke("wallet", {
        action: "getDepositAddress",
        walletId,
        amount: amountNumber
      });
      if (res.data?.success) {
        setInvoice(res.data.data);
        toast.success(t.invoiceReady);
        onRefresh?.();
        loadInternalDeposits();
      } else {
        throw new Error(res.data?.error || "Failed to create payment");
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
      console.error("[WalletDeposit] Load address error:", err);
      toast.error(language === "ar" ? "فشل تحميل العنوان" : "Failed to load address");
    } finally {
      setLoading(false);
    }
  };

  const loadDepositHistory = async () => {
    if (!hasOkxAccount) return;
    try {
      const res = await base44.functions.invoke("okxUserAccount", { action: "getDepositHistory", limit: 5 });
      if (res.data?.ok) setOkxDepositHistory(res.data.data || []);
    } catch (err) {
      console.error("[WalletDeposit] Load history error:", err);
    }
  };

  useEffect(() => {
    if (hasOkxAccount) {
      loadDepositAddress(selectedCurrency);
      loadDepositHistory();
    }
    loadInternalDeposits();
  }, [hasOkxAccount, selectedCurrency, loadInternalDeposits]);

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
    if (!text) return;
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

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-primary" />
            {t.cardDepositTitle}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{t.cardDepositDesc}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t.amountLabel}</label>
              <Input value={fiatAmount} onChange={(e) => setFiatAmount(e.target.value)} type="number" min="10" step="1" className="w-full" />
              <p className="text-xs text-muted-foreground">{primaryWallet ? `${primaryWallet.currency} • ${primaryWallet.network}` : ""}</p>
            </div>
            <Button onClick={handleCreateInvoice} disabled={npLoading || creatingWallet || !tradingAccountId} className="rounded-xl w-full sm:w-auto">
              {(npLoading || creatingWallet) ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              <span className="ml-2">{t.startDeposit}</span>
            </Button>
          </div>
          {!tradingAccountId && <div className="text-xs text-amber-600">{t.walletCreateError}</div>}
          {!primaryWallet && tradingAccountId && !creatingWallet && <div className="text-sm text-muted-foreground">{t.nowpayUnavailable}</div>}

          {npError && <div className="text-sm text-rose-500 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">{npError}</div>}

          {invoice && (
            <div className="rounded-xl border border-border/70 bg-muted/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">{t.payAmount}</div>
                  <div className="font-semibold text-foreground">{invoice.pay_amount} {invoice.pay_currency}</div>
                </div>
                <Badge variant="outline" className="text-xs">{t.networkLabel}: {depositWallet?.network || invoice.pay_currency?.toUpperCase()}</Badge>
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
                {invoice.invoice_url && (
                  <Button asChild variant="secondary" size="sm" className="rounded-lg">
                    <a href={invoice.invoice_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" /> {t.openInvoice}
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="sm" className="rounded-lg" onClick={onRefresh}>
                  <RefreshCw className="h-4 w-4 mr-2" /> {t.loading}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {npDepositHistory.length > 0 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              {t.recentDeposits}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {npDepositHistory.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted/40">
                    <ArrowDownToLine className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{item.amount} {item.currency}</div>
                    <div className="text-xs text-muted-foreground">{item.network || depositWallet?.network || "—"}</div>
                    {item.nowpayments_id && (
                      <div className="text-[11px] text-muted-foreground mt-1">Payment ID: {item.nowpayments_id}</div>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className={`${item.status === "completed" ? "text-emerald-600" : "text-amber-600"}`}>
                  {item.status === "completed" ? t.confirmed : t.pending}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
                    <SelectTrigger className="w-full" data-pf="deposit-network-select">
                      <SelectValue placeholder={t.selectNetwork} />
                    </SelectTrigger>
                    <SelectContent>
                      {currentAddresses.map((addr) => (
                        <SelectItem key={addr.chain} value={addr.chain}>
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>{CHAIN_NAMES[addr.chain] || addr.chain.split("-").pop()}</span>
                            {CHAIN_FEES[addr.chain] && <span className="text-xs text-muted-foreground">Fee: {CHAIN_FEES[addr.chain]}</span>}
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(selectedAddress.addr || selectedAddress.address)}
                        className="h-7 px-2"
                        data-pf="deposit-address-copy"
                      >
                        {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                        <span className="ml-1 text-xs">{t.copyAddress}</span>
                      </Button>
                    </div>
                    <code className="text-sm font-mono text-foreground break-all block">{selectedAddress.addr || selectedAddress.address}</code>

                    {selectedAddress.tag && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Memo/Tag</span>
                          <Button size="sm" variant="ghost" onClick={() => handleCopy(selectedAddress.tag)} className="h-6 px-2">
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm font-mono text-foreground">{selectedAddress.tag}</code>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {selectedAddress.minDeposit && (
                      <div className="p-3 bg-muted/30 rounded-xl">
                        <span className="text-xs text-muted-foreground block">{t.minDeposit}</span>
                        <span className="font-medium text-foreground">{selectedAddress.minDeposit} {selectedCurrency}</span>
                      </div>
                    )}
                    {CHAIN_FEES[selectedChain] && (
                      <div className="p-3 bg-muted/30 rounded-xl">
                        <span className="text-xs text-muted-foreground block">{t.networkFee}</span>
                        <span className="font-medium text-foreground">{CHAIN_FEES[selectedChain]}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-amber-100/40 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {t.warning.replace("{currency}", selectedCurrency).replace("{network}", chainDisplayName)}
                    </p>
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

      {hasOkxAccount && okxDepositHistory.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.recentDeposits}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {okxDepositHistory.map((item) => (
              <div key={`${item.txId || item.id || item.chain}::${item.chain}`} className="flex items-start justify-between gap-3 rounded-xl border border-border/50 p-4">
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

      {hasOkxAccount && okxDepositHistory.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">{t.noDeposits}</div>}
    </div>
  );
}

WalletDeposit.propTypes = {
  language: PropTypes.string,
  hasOkxAccount: PropTypes.bool,
  wallets: PropTypes.array,
  tradingAccountId: PropTypes.string,
  onRefresh: PropTypes.func,
  showBackButton: PropTypes.bool
};
