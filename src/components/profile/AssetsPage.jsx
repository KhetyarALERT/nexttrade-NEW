import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LiveAccountCard from "@/components/profile/LiveAccountCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
import {
  Search,
  RefreshCw,
  Copy,
  CheckCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Info,
  QrCode } from
"lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import CryptoIcon from "@/components/ui/CryptoIcon";
import SpotWalletView from "@/components/profile/SpotWalletView";
import FuturesWalletView from "@/components/profile/FuturesWalletView";

const NETWORK_CONFIG = {
  TRC20: { name: "Tron (TRC20)", fee: "1 USDT", time: "~1 min" },
  ERC20: { name: "Ethereum (ERC20)", fee: "~15 USDT", time: "~5 min" },
  BEP20: { name: "BSC (BEP20)", fee: "~0.5 USDT", time: "~1 min" },
  BTC: { name: "Bitcoin", fee: "~5 USDT", time: "~30 min" },
  SOL: { name: "Solana", fee: "~0.01 SOL", time: "~1 min" },
  XRP: { name: "XRP Ledger", fee: "~0.1 XRP", time: "~5 sec" }
};

const localizations = {
  en: {
    totalBalance: "Total Balance",
    deposit: "Deposit",
    withdraw: "Withdraw",
    transfer: "Transfer",
    funding: "Funding",
    spot: "Spot",
    perpetual: "Perpetual",
    fundingHelp: "Funding wallet is used for deposits, withdrawals, and internal transfers.",
    spotHelp: "Spot wallet is used for exchange trading and spot balances.",
    perpetualHelp: "Perpetual wallet is used for futures/perpetual positions and margin.",
    selectCrypto: "Select crypto",
    selectNetwork: "Select network",
    depositInfo: "Deposit info",
    generateDeposit: "Generate Deposit Address",
    minimum: "Minimum",
    receiving: "Receiving",
    sendOnly: (c, n) => `Send only ${c} via ${n}. Other assets will be lost permanently.`,
    searchPlaceholder: "Search coin",
    hideSmallBalances: "Hide small balances",
    noAssets: "No assets. Click Deposit to add funds.",
    depositAddress: "Deposit Address",
    openPaymentPage: "Open Payment Page to View Address",
    available: "Available",
    internalTransferTitle: "Internal Transfer",
    internalTransferDesc: "Transfer between Funding, Spot, and Perpetual wallets (0 fees)",
    comingSoon: "Coming soon - Transfer between wallet types",
    gettingStartedTitle: "Getting started",
    gettingStartedBody: "New to crypto? Follow these steps to set up your portfolio.",
    stepDepositTitle: "Deposit funds",
    stepDepositDesc: "Add USDT or your preferred assets to Funding.",
    stepTransferTitle: "Move between wallets",
    stepTransferDesc: "Transfer to Spot or Perpetual when you're ready to trade.",
    stepTrackTitle: "Track performance",
    stepTrackDesc: "Review balances, PnL, and open positions here.",
    totalWallets: "Wallets",
    totalAssets: "Assets",
    totalNetworks: "Networks"
  },
  ar: {
    totalBalance: "الرصيد الكلي",
    deposit: "إيداع",
    withdraw: "سحب",
    transfer: "تحويل",
    funding: "تمويل",
    spot: "سبوت",
    perpetual: "عقود دائمة",
    fundingHelp: "محفظة التمويل للإيداع والسحب والتحويل الداخلي.",
    spotHelp: "محفظة السبوت للتداول الفوري وأرصدة السبوت.",
    perpetualHelp: "محفظة العقود الدائمة للمراكز والهامش.",
    selectCrypto: "اختر العملة",
    selectNetwork: "اختر الشبكة",
    depositInfo: "معلومات الإيداع",
    generateDeposit: "توليد عنوان الإيداع",
    minimum: "الحد الأدنى",
    receiving: "الاستلام",
    sendOnly: (c, n) => `أرسل ${c} عبر ${n} فقط. الأصول الأخرى ستفقد نهائياً.`,
    searchPlaceholder: "ابحث عن عملة",
    hideSmallBalances: "إخفاء الأرصدة الصغيرة",
    noAssets: "لا توجد أصول. اضغط إيداع لإضافة أموال.",
    depositAddress: "عنوان الإيداع",
    openPaymentPage: "افتح صفحة الدفع لعرض العنوان",
    available: "المتاح",
    internalTransferTitle: "تحويل داخلي",
    internalTransferDesc: "تحويل بين محافظ التمويل والسبوت والعقود الدائمة (بدون رسوم)",
    comingSoon: "قريباً - تحويل بين أنواع المحافظ",
    gettingStartedTitle: "ابدأ بسهولة",
    gettingStartedBody: "جديد في العملات الرقمية؟ اتبع هذه الخطوات لإعداد محفظتك.",
    stepDepositTitle: "إيداع الأموال",
    stepDepositDesc: "أضف USDT أو أصولك المفضلة إلى محفظة التمويل.",
    stepTransferTitle: "تحويل بين المحافظ",
    stepTransferDesc: "حوّل إلى السبوت أو العقود الدائمة عندما تكون جاهزاً للتداول.",
    stepTrackTitle: "تتبع الأداء",
    stepTrackDesc: "راجع الأرصدة والأرباح والمراكز المفتوحة هنا.",
    totalWallets: "المحافظ",
    totalAssets: "الأصول",
    totalNetworks: "الشبكات"
  }
};

export default function AssetsPage({ wallets = [], language = "en", onRefresh, liveAccount, trades = [], demoAccount }) {
  const location = useLocation();
  const navigate = useNavigate();
  const t = localizations[language] || localizations.en;

  const getSearchParam = (key) => new URLSearchParams(location.search).get(key);

  const normalizeAssetTab = (value) => {
    if (value === "spot" || value === "futures" || value === "main") return value;
    return "main";
  };

  const normalizeModal = (value) => {
    if (value === "deposit" || value === "withdraw" || value === "transfer") return value;
    return null;
  };

  const setSearchParams = (patch) => {
    const params = new URLSearchParams(location.search);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") params.delete(key);
      else params.set(key, String(value));
    });
    const next = params.toString();
    const current = location.search.startsWith("?") ? location.search.slice(1) : location.search;
    if (next !== current) {
      navigate({ pathname: location.pathname, search: next ? `?${next}` : "" }, { replace: true });
    }
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [hideSmallBalances, setHideSmallBalances] = useState(false);
  const [showBalances, setShowBalances] = useState(true);
  const [activeTab, setActiveTab] = useState(() => normalizeAssetTab(getSearchParam("assetTab")));
  const [activeModal, setActiveModal] = useState(() => normalizeModal(getSearchParam("modal")));
  const [selectedCurrency, setSelectedCurrency] = useState("USDT");
  const [selectedNetwork, setSelectedNetwork] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [depositData, setDepositData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [availableCurrencies, setAvailableCurrencies] = useState([]);
  const [addressValid, setAddressValid] = useState(null);
  const [validatingAddress, setValidatingAddress] = useState(false);

  // Fetch available currencies from NOWPayments
  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        const result = await base44.functions.invoke('wallet', { action: 'getSupportedCurrencies' });
        if (result.data?.success) {
          setAvailableCurrencies(result.data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch currencies", err);
      }
    };
    fetchCurrencies();
  }, []);

  // Sync URL params -> local state (enables dropdown shortcuts)
  useEffect(() => {
    const nextTab = normalizeAssetTab(getSearchParam("assetTab"));
    if (nextTab && nextTab !== activeTab) setActiveTab(nextTab);

    const nextModal = normalizeModal(getSearchParam("modal"));
    if (nextModal !== activeModal) setActiveModal(nextModal);
  }, [location.search]);

  // Calculate totals
  const calculateTotal = () => {
    return wallets.reduce((sum, w) => {
      if (w.currency === 'USDT' || w.currency === 'USDC') return sum + (w.balance || 0);
      if (w.currency === 'BTC') return sum + (w.balance || 0) * 95000;
      if (w.currency === 'ETH') return sum + (w.balance || 0) * 3400;
      return sum + (w.balance || 0);
    }, 0);
  };

  // Get unique currencies from available list
  const getUniqueCurrencies = () => {
    const unique = [];
    availableCurrencies.forEach((c) => {
      if (!unique.find((u) => u.currency === c.currency)) {
        unique.push(c);
      }
    });
    return unique;
  };

  // Get networks for currency
  const getNetworksForCurrency = (currency) => {
    return availableCurrencies.filter((c) => c.currency === currency);
  };

  // Filter wallets
  const filteredWallets = wallets.filter((w) => {
    if (searchTerm && !w.currency.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (hideSmallBalances && (w.balance || 0) < 1) return false;
    return true;
  });

  const totalWallets = wallets.length;
  const uniqueAssets = new Set(wallets.map((w) => (w.currency || "").toUpperCase())).size;
  const uniqueNetworks = new Set(wallets.map((w) => w.network).filter(Boolean)).size;

  // Group by currency
  const groupedWallets = filteredWallets.reduce((acc, w) => {
    if (!acc[w.currency]) acc[w.currency] = [];
    acc[w.currency].push(w);
    return acc;
  }, {});

  const handleCopy = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const validateWithdrawAddress = async () => {
    if (!withdrawAddress || !selectedCurrency || !selectedNetwork) return;
    setValidatingAddress(true);
    try {
      const result = await base44.functions.invoke('wallet', {
        action: 'validateAddress',
        address: withdrawAddress,
        currency: selectedCurrency,
        network: selectedNetwork
      });
      setAddressValid(result.data?.data?.valid || false);
    } catch {
      setAddressValid(null);
    } finally {
      setValidatingAddress(false);
    }
  };

  const handleGetDepositAddress = async () => {
    if (!selectedNetwork) {
      toast.error("Please select a network");
      return;
    }
    setLoading(true);
    setDepositData(null);

    try {
      let wallet = wallets.find((w) => w.currency === selectedCurrency && w.network === selectedNetwork);

      if (!wallet && liveAccount) {
        const createResult = await base44.functions.invoke('wallet', {
          action: 'create',
          tradingAccountId: liveAccount.id,
          currency: selectedCurrency,
          network: selectedNetwork
        });
        if (createResult.data?.success) {
          wallet = createResult.data.data;
          if (onRefresh) onRefresh();
        }
      }

      if (!wallet) {
        toast.error("Failed to get wallet");
        return;
      }

      const result = await base44.functions.invoke('wallet', {
        action: 'getDepositAddress',
        walletId: wallet.id,
        amount: 100
      });

      if (result.data?.success) {
        setDepositData(result.data.data);
      } else {
        toast.error(result.data?.error || "Failed to generate address");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!selectedNetwork || !withdrawAddress || !amount) {
      toast.error("Please fill all fields");
      return;
    }

    const wallet = wallets.find((w) => w.currency === selectedCurrency && w.network === selectedNetwork);
    if (!wallet) {
      toast.error("Wallet not found");
      return;
    }

    setLoading(true);
    try {
      const result = await base44.functions.invoke('wallet', {
        action: 'withdraw',
        walletId: wallet.id,
        amount: parseFloat(amount),
        destinationAddress: withdrawAddress
      });

      if (result.data?.success) {
        toast.success(`Withdrawal submitted. Fee: ${result.data.data.fee}`);
        setActiveModal(null);
        resetForm();
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

  const resetForm = () => {
    setAmount("");
    setWithdrawAddress("");
    setAddressValid(null);
    setDepositData(null);
    setSelectedNetwork("");
  };

  const formatBalance = (val) => {
    if (!showBalances) return "****";
    if (val === null || val === undefined) return "0.00";
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const formatUSD = (val) => {
    if (!showBalances) return "****";
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const networks = getNetworksForCurrency(selectedCurrency);

  useEffect(() => {
    if (networks.length > 0 && !selectedNetwork) {
      setSelectedNetwork(networks[0].network);
    }
  }, [selectedCurrency, networks.length]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-border/60 bg-card/70 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-muted-foreground text-sm uppercase tracking-[0.2em]">{t.totalBalance}</span>
                <button onClick={() => setShowBalances(!showBalances)} className="text-muted-foreground hover:text-foreground">
                  {showBalances ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
              <div className="text-2xl sm:text-3xl font-semibold text-foreground">{formatUSD(calculateTotal())}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {language === "ar" ? "لمحة سريعة عن إجمالي أموالك." : "Quick overview of all wallet balances."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => {setActiveModal('deposit');resetForm();}} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex-1 sm:flex-none">
                <ArrowDownToLine className="w-4 h-4 mr-1.5" /> {t.deposit}
              </Button>
              <Button onClick={() => {setActiveModal('withdraw');resetForm();}} variant="outline" className="border-border bg-background text-foreground hover:bg-muted/20 rounded-xl flex-1 sm:flex-none">
                <ArrowUpFromLine className="w-4 h-4 mr-1.5" /> {t.withdraw}
              </Button>
              <Button onClick={() => setActiveModal('transfer')} variant="outline" className="border-border bg-background text-foreground hover:bg-muted/20 rounded-xl flex-1 sm:flex-none">
                <ArrowLeftRight className="w-4 h-4 mr-1.5" /> {t.transfer}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: t.totalWallets, value: totalWallets },
              { label: t.totalAssets, value: uniqueAssets },
              { label: t.totalNetworks, value: uniqueNetworks }
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border/40 bg-muted/30 p-3 text-center">
                <div className="text-lg font-semibold text-foreground">{stat.value}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Getting Started */}
      <div className="rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">{t.gettingStartedTitle}</h2>
            <p className="text-xs text-muted-foreground">{t.gettingStartedBody}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { title: t.stepDepositTitle, description: t.stepDepositDesc, icon: ArrowDownToLine },
            { title: t.stepTransferTitle, description: t.stepTransferDesc, icon: ArrowLeftRight },
            { title: t.stepTrackTitle, description: t.stepTrackDesc, icon: Eye },
          ].map((step) => (
            <div key={step.title} className="rounded-xl border border-border/40 bg-background/40 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <step.icon className="h-4 w-4 text-blue-600" />
                {step.title}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Wallet Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(tab) => {
          setActiveTab(tab);
          setSearchParams({ assetTab: tab });
        }}
        className="w-full"
      >
        <TabsList className="w-full justify-start bg-card/70 p-1 rounded-xl border border-border/60 flex gap-1 overflow-x-auto">
          <TabsTrigger value="main" className="text-sm rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white text-muted-foreground flex-none">
            <Wallet className="w-4 h-4 mr-1.5" /> {t.funding}
          </TabsTrigger>
          <TabsTrigger value="spot" className="text-sm rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white text-muted-foreground flex-none">
            {t.spot}
          </TabsTrigger>
          <TabsTrigger value="futures" className="text-sm rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white text-muted-foreground flex-none">
            {t.perpetual}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="mt-4 space-y-4">
          <div className={`rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground flex items-start gap-2 ${language === 'ar' ? 'flex-row-reverse text-right' : ''}`}>
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
            <span>{t.fundingHelp}</span>
          </div>
          
          <AssetsTable
            wallets={groupedWallets}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            hideSmallBalances={hideSmallBalances}
            setHideSmallBalances={setHideSmallBalances}
            formatBalance={formatBalance}
            formatUSD={formatUSD}
            onDeposit={(currency) => {setSelectedCurrency(currency);setActiveModal('deposit');resetForm();}}
            onWithdraw={(currency) => {setSelectedCurrency(currency);setActiveModal('withdraw');resetForm();}}
            language={language}
            t={t}
          />
        </TabsContent>

        <TabsContent value="spot" className="mt-4">
          <div className={`mb-4 rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground flex items-start gap-2 ${language === 'ar' ? 'flex-row-reverse text-right' : ''}`}>
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
            <span>{t.spotHelp}</span>
          </div>
          <SpotWalletView
            spotBalance={0}
            onDeposit={() => {setActiveModal('deposit');resetForm();}}
            onWithdraw={() => {setActiveModal('withdraw');resetForm();}}
            showBalances={showBalances} language={language} />

        </TabsContent>

        <TabsContent value="futures" className="mt-4">
          <div className={`mb-4 rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground flex items-start gap-2 ${language === 'ar' ? 'flex-row-reverse text-right' : ''}`}>
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
            <span>{t.perpetualHelp}</span>
          </div>
          <FuturesWalletView
            tradingAccount={liveAccount}
            demoAccount={demoAccount}
            trades={trades}
            showBalances={showBalances}
            language={language}
            onTransfer={() => setActiveModal('transfer')}
            onRefresh={onRefresh} />

        </TabsContent>
      </Tabs>

      {/* Deposit Modal */}
      <Dialog
        open={activeModal === 'deposit'}
        onOpenChange={(open) => {
          if (!open) {
            setActiveModal(null);
            setSearchParams({ modal: null });
          }
        }}
      >
        <DialogContent className="sm:max-w-md border border-slate-200 text-slate-900 max-h-[90vh] overflow-y-auto bg-white" aria-describedby="deposit-desc">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-indigo-600" /> {t.deposit}
            </DialogTitle>
          </DialogHeader>
          <p id="deposit-desc" className="sr-only">Deposit cryptocurrency to your wallet</p>
          
          <div className="space-y-5">
            {/* Step 1: Select Crypto */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 flex items-center justify-center text-xs font-bold">1</div>
                <span className="font-medium">{t.selectCrypto}</span>
              </div>
              
              <Select value={selectedCurrency} onValueChange={(v) => {setSelectedCurrency(v);setSelectedNetwork('');setDepositData(null);}}>
                <SelectTrigger className="bg-white border-slate-200 text-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  {getUniqueCurrencies().map((c) =>
                  <SelectItem key={c.currency} value={c.currency} className="text-slate-900 hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <CryptoIcon currency={c.currency} size="sm" />
                        {c.currency}
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              <div className="flex flex-wrap gap-2">
                {getUniqueCurrencies().slice(0, 5).map((c) =>
                <button
                  key={c.currency}
                  onClick={() => {setSelectedCurrency(c.currency);setSelectedNetwork('');setDepositData(null);}}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                  selectedCurrency === c.currency ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}
                  `}>

                    <CryptoIcon currency={c.currency} size="xs" />
                    {c.currency}
                  </button>
                )}
              </div>
            </div>

            {/* Step 2: Select Network */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 flex items-center justify-center text-xs font-bold">2</div>
                <span className="font-medium">{t.selectNetwork}</span>
              </div>
              
              <Select value={selectedNetwork} onValueChange={(v) => {setSelectedNetwork(v);setDepositData(null);}}>
                <SelectTrigger className="bg-white border-slate-200 text-slate-900">
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  {networks.map((n) =>
                  <SelectItem key={n.network} value={n.network} className="text-slate-900 hover:bg-slate-50">
                      {NETWORK_CONFIG[n.network]?.name || n.network}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              {selectedNetwork &&
              <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-200">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{language === 'ar' ? 'تأكد من اختيار نفس الشبكة على منصة السحب.' : 'Ensure you choose the same network on the withdrawal platform.'}</span>
                </div>
              }
            </div>

            {/* Step 3: Deposit Info */}
            {selectedNetwork &&
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">3</div>
                  <span className="font-medium">{t.depositInfo}</span>
                </div>
                
                {!depositData && !loading &&
              <Button onClick={handleGetDepositAddress} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                    {t.generateDeposit}
                  </Button>
              }
                
                {loading &&
              <div className="flex justify-center py-6">
                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                  </div>
              }
                
                {depositData &&
              <div className="space-y-4">
                    {depositData.pay_address &&
                <>
                        <div className="flex justify-center p-4 bg-white rounded-lg">
                          <div className="w-40 h-40 flex items-center justify-center bg-slate-100 rounded-lg">
                            <QrCode className="w-full h-full p-2 text-slate-400" />
                          </div>
                        </div>
                        
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-600 text-sm">{t.depositAddress}</span>
                            <Button variant="ghost" size="sm" onClick={() => handleCopy(depositData.pay_address)} className="text-indigo-600 h-auto p-1">
                              {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                          <code className="text-slate-900 text-xs break-all block">{depositData.pay_address}</code>
                        </div>
                      </>
                }
                    
                    {!depositData.pay_address && depositData.invoice_url &&
                <a
                  href={depositData.invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium">

                        {t.openPaymentPage}
                      </a>
                }
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded border border-slate-200">
                        <span className="text-slate-500 block">{t.minimum}</span>
                        <span className="text-slate-900 font-medium">&ge; {depositData.min_deposit || 1} {selectedCurrency}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded border border-slate-200">
                        <span className="text-slate-500 block">{t.receiving}</span>
                        <span className="text-slate-900 font-medium">Fund Account</span>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2 p-3 bg-amber-100/40 border border-amber-200 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-700">
                        {t.sendOnly(selectedCurrency, NETWORK_CONFIG[selectedNetwork]?.name || selectedNetwork)}
                      </p>
                    </div>
                  </div>
              }
              </div>
            }
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdraw Modal */}
      <Dialog
        open={activeModal === 'withdraw'}
        onOpenChange={(open) => {
          if (!open) {
            setActiveModal(null);
            setSearchParams({ modal: null });
          }
        }}
      >
        <DialogContent className="sm:max-w-md border border-slate-200 text-slate-900 max-h-[90vh] overflow-y-auto bg-white" aria-describedby="withdraw-desc">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <ArrowUpFromLine className="w-5 h-5 text-amber-600" /> {t.withdraw}
            </DialogTitle>
          </DialogHeader>
          <p id="withdraw-desc" className="sr-only">Withdraw cryptocurrency from your wallet</p>
          
          <div className="space-y-4">
            <div>
              <label className="text-slate-600 text-sm mb-1.5 block">Coin</label>
              <Select value={selectedCurrency} onValueChange={(v) => {setSelectedCurrency(v);setSelectedNetwork('');}}>
                <SelectTrigger className="bg-white border-slate-200 text-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  {getUniqueCurrencies().map((c) =>
                  <SelectItem key={c.currency} value={c.currency} className="text-slate-900 hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <CryptoIcon currency={c.currency} size="sm" />
                        {c.currency}
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-slate-600 text-sm mb-1.5 block">Network</label>
              <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
                <SelectTrigger className="bg-white border-slate-200 text-slate-900">
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  {networks.map((n) =>
                  <SelectItem key={n.network} value={n.network} className="text-slate-900 hover:bg-slate-50">
                      {NETWORK_CONFIG[n.network]?.name || n.network}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-slate-600 text-sm mb-1.5 block">Withdrawal address</label>
              <div className="relative">
                <Input
                  value={withdrawAddress}
                  onChange={(e) => {setWithdrawAddress(e.target.value);setAddressValid(null);}}
                  onBlur={validateWithdrawAddress}
                  placeholder="Enter address"
                  className={`bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 pr-10 ${
                  addressValid === true ? 'border-emerald-500' : addressValid === false ? 'border-red-500' : ''}`
                  } />

                {validatingAddress && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
                {!validatingAddress && addressValid === true && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />}
                {!validatingAddress && addressValid === false && <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />}
              </div>
            </div>
            
            <div>
              <label className="text-slate-600 text-sm mb-1.5 block">Amount</label>
              <div className="relative">
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 pr-16" />

                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-600 text-sm"
                  onClick={() => {
                    const wallet = wallets.find((w) => w.currency === selectedCurrency && w.network === selectedNetwork);
                    if (wallet) setAmount(String(wallet.balance || 0));
                  }}>

                  Max
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Available: {formatBalance(wallets.find((w) => w.currency === selectedCurrency && w.network === selectedNetwork)?.balance || 0)} {selectedCurrency}
              </p>
            </div>

            <Button onClick={handleWithdraw} disabled={loading || !withdrawAddress || !amount || !selectedNetwork} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-50">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              {t.withdraw}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Modal */}
      <Dialog
        open={activeModal === 'transfer'}
        onOpenChange={(open) => {
          if (!open) {
            setActiveModal(null);
            setSearchParams({ modal: null });
          }
        }}
      >
        <DialogContent className="sm:max-w-md border border-slate-200 text-slate-900 bg-white" aria-describedby="transfer-desc">
          <DialogHeader>
            <DialogTitle className="text-slate-900">{t.internalTransferTitle}</DialogTitle>
          </DialogHeader>
          <p id="transfer-desc" className="text-slate-600 text-sm">{t.internalTransferDesc}</p>
          
          <div className="space-y-4 py-2">
            <div className="p-4 bg-slate-50 rounded-lg text-center text-slate-500 border border-slate-200">
              {t.comingSoon}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>);

}

// Currency name mapping for display
const CURRENCY_NAMES = {
  USDT: "Tether",
  BTC: "Bitcoin",
  ETH: "Ethereum",
  BNB: "BNB",
  SOL: "Solana",
  XRP: "Ripple",
  TRX: "TRON",
  LTC: "Litecoin",
  DOGE: "Dogecoin",
  USDC: "USD Coin"
};

// Assets Table Component
function AssetsTable({ wallets, searchTerm, setSearchTerm, hideSmallBalances, setHideSmallBalances, formatBalance, formatUSD, onDeposit, onWithdraw, language = 'en', t = null }) {
  // Normalize currency names (remove network suffix like "usdttrc20" -> "USDT")
  const normalizedWallets = {};
  Object.entries(wallets).forEach(([currency, currencyWallets]) => {
    // Normalize currency: usdttrc20 -> USDT, usdterc20 -> USDT, etc.
    let normalizedCurrency = currency.toUpperCase();
    if (normalizedCurrency.startsWith('USDT')) normalizedCurrency = 'USDT';
    if (normalizedCurrency.startsWith('USDC')) normalizedCurrency = 'USDC';

    if (!normalizedWallets[normalizedCurrency]) {
      normalizedWallets[normalizedCurrency] = [];
    }
    normalizedWallets[normalizedCurrency].push(...currencyWallets);
  });
  const assetEntries = Object.entries(normalizedWallets);

  return (
    <div className="rounded-2xl overflow-hidden bg-card/70 border border-border/60 shadow-sm">
      <div className="p-4 border-b border-border/40 bg-muted/10">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
            <Input
              placeholder={t?.searchPlaceholder || 'Search coin'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${language === 'ar' ? 'pr-9' : 'pl-9'} bg-background border-border text-foreground placeholder:text-muted-foreground`} />

          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
            <Checkbox checked={hideSmallBalances} onCheckedChange={setHideSmallBalances} className="border-border" />
            {t?.hideSmallBalances || 'Hide small balances'}
          </label>
        </div>
      </div>

      <div className="sm:hidden space-y-3 p-4">
        {assetEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-muted-foreground text-sm">
            {t?.noAssets || 'No assets. Click Deposit to add funds.'}
          </div>
        ) : (
          assetEntries.map(([currency, currencyWallets]) => {
            const totalAmount = currencyWallets.reduce((sum, w) => sum + (w.balance || 0), 0);
            const usdValue = currency === 'BTC' ? totalAmount * 95000 : currency === 'ETH' ? totalAmount * 3400 : totalAmount;
            return (
              <div key={currency} className="rounded-xl border border-border/50 bg-background p-4 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CryptoIcon currency={currency} size="md" />
                    <div>
                      <div className="text-foreground font-medium">{currency}</div>
                      <div className="text-muted-foreground text-xs">{CURRENCY_NAMES[currency] || currency}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-foreground text-sm font-semibold">{formatBalance(totalAmount)}</div>
                    <div className="text-muted-foreground text-xs">{formatUSD(usdValue)}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => onDeposit(currency)} className="flex-1 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/40">
                    {t?.deposit || 'Deposit'}
                  </button>
                  <button onClick={() => onWithdraw(currency)} className="flex-1 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/40">
                    {t?.withdraw || 'Withdraw'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="overflow-x-hidden hidden sm:block">
        <table className="w-full table-fixed">
          <thead>
            <tr className={`${language === 'ar' ? 'text-right' : 'text-left'} text-xs text-muted-foreground border-b border-border/40`}>
              <th className="px-4 py-3 font-medium">{language === 'ar' ? 'العملة' : 'Coin'}</th>
              <th className="px-4 py-3 font-medium">{language === 'ar' ? 'الرصيد' : 'Balance'}</th>
              <th className="px-4 py-3 font-medium text-right">{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {assetEntries.length === 0 ?
            <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                  {t?.noAssets || 'No assets. Click Deposit to add funds.'}
                </td>
              </tr> :

            assetEntries.map(([currency, currencyWallets]) => {
              const totalAmount = currencyWallets.reduce((sum, w) => sum + (w.balance || 0), 0);
              const usdValue = currency === 'BTC' ? totalAmount * 95000 : currency === 'ETH' ? totalAmount * 3400 : totalAmount;

              return (
                <tr key={currency} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <CryptoIcon currency={currency} size="md" />
                        <div>
                          <div className="text-foreground font-medium">{currency}</div>
                          <div className="text-muted-foreground text-xs">{CURRENCY_NAMES[currency] || currency}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-foreground break-words">{formatBalance(totalAmount)}</div>
                      <div className="text-muted-foreground text-xs break-words">{formatUSD(usdValue)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                        <button onClick={() => onDeposit(currency)} className="text-blue-600 hover:text-blue-700 text-sm">
                          {t?.deposit || 'Deposit'}
                        </button>
                        <button onClick={() => onWithdraw(currency)} className="text-blue-600 hover:text-blue-700 text-sm">
                          {t?.withdraw || 'Withdraw'}
                        </button>
                      </div>
                    </td>
                  </tr>);

            })
            }
          </tbody>
        </table>
      </div>
    </div>);

}

AssetsPage.propTypes = {
  wallets: PropTypes.array,
  language: PropTypes.string,
  onRefresh: PropTypes.func,
  liveAccount: PropTypes.object,
  trades: PropTypes.array,
  demoAccount: PropTypes.object
};

AssetsTable.propTypes = {
  wallets: PropTypes.object,
  searchTerm: PropTypes.string,
  setSearchTerm: PropTypes.func,
  hideSmallBalances: PropTypes.bool,
  setHideSmallBalances: PropTypes.func,
  formatBalance: PropTypes.func,
  formatUSD: PropTypes.func,
  onDeposit: PropTypes.func,
  onWithdraw: PropTypes.func
};
AssetsTable.propTypes.language = PropTypes.string;
AssetsTable.propTypes.t = PropTypes.object;