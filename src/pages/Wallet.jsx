import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import AuthRequiredState from "@/components/AuthRequiredState";
import { createPageUrl } from "@/utils";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  History,
  CreditCard,
  Eye,
  EyeOff,
  RefreshCw,
  ChevronRight,
  Shield,
  AlertCircle,
  CheckCircle2,
  Clock,
  Rocket
} from "lucide-react";

// Sub-page components
import WalletOverview from "@/components/wallet/WalletOverview";
import WalletDeposit from "@/components/wallet/WalletDeposit";
import WalletHistory from "@/components/wallet/WalletHistory";
import OKXTransferModal from "@/components/profile/OKXTransferModal";
import AllocationModal from "@/components/copytrading/AllocationModal";
import PullToRefresh from "@/components/ui/PullToRefresh";
import { useUserVerification } from "@/components/hooks/useUserVerification";

const translations = {
  en: {
    title: "Wallet",
    overview: "Overview",
    deposit: "Deposit",
    withdraw: "Withdraw",
    transfer: "Transfer",
    history: "History",
    buyWithCard: "Buy with Card",
    totalBalance: "Total Balance",
    available: "Available",
    inOrder: "In Orders",
    refresh: "Refresh",
    verifyIdentity: "Verify Your Identity",
    verifyDesc: "Complete KYC verification to unlock all wallet features",
    startKyc: "Start Verification",
    kycPending: "Verification Pending",
    kycPendingDesc: "Your documents are being reviewed. This usually takes 24-48 hours.",
    kycRejected: "Verification Rejected",
    kycRejectedDesc: "Please review the reason and resubmit your documents.",
    resubmit: "Resubmit Documents",
    activateAccount: "Activate Trading Account",
    activateDesc: "Request a trading account to start depositing and trading",
    requestAccount: "Request Account",
    accountPending: "Account Request Pending",
    accountPendingDesc: "Your trading account request is being processed.",
    loginRequired: "Login Required",
    loginDesc: "Please log in to access your wallet",
    login: "Log In",
    backHome: "Back to Home"
  },
  ar: {
    title: "المحفظة",
    overview: "نظرة عامة",
    deposit: "إيداع",
    withdraw: "سحب",
    transfer: "تحويل",
    history: "السجل",
    buyWithCard: "شراء بالبطاقة",
    totalBalance: "الرصيد الكلي",
    available: "المتاح",
    inOrder: "في الأوامر",
    refresh: "تحديث",
    verifyIdentity: "تحقق من هويتك",
    verifyDesc: "أكمل التحقق من الهوية لفتح جميع ميزات المحفظة",
    startKyc: "بدء التحقق",
    kycPending: "التحقق قيد المراجعة",
    kycPendingDesc: "يتم مراجعة مستنداتك. عادة ما يستغرق هذا 24-48 ساعة.",
    kycRejected: "تم رفض التحقق",
    kycRejectedDesc: "يرجى مراجعة السبب وإعادة تقديم مستنداتك.",
    resubmit: "إعادة تقديم المستندات",
    activateAccount: "تفعيل حساب التداول",
    activateDesc: "اطلب حساب تداول للبدء في الإيداع والتداول",
    requestAccount: "طلب حساب",
    accountPending: "طلب الحساب قيد المراجعة",
    accountPendingDesc: "يتم معالجة طلب حساب التداول الخاص بك.",
    loginRequired: "تسجيل الدخول مطلوب",
    loginDesc: "يرجى تسجيل الدخول للوصول إلى محفظتك",
    login: "تسجيل الدخول",
    backHome: "العودة للرئيسية"
  }
};

const SUB_PAGES = [
  { id: "overview", icon: Wallet, labelKey: "overview" },
  { id: "deposit", icon: ArrowDownToLine, labelKey: "deposit" },
  { id: "history", icon: History, labelKey: "history" }
];

export default function WalletPage({ language = "en" }) {
  const t = translations[language] || translations.en;
  const { isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const getSubPage = () => {
    const params = new URLSearchParams(location.search);
    const page = params.get("page");
    if (["overview", "deposit", "history"].includes(page)) return page;
    return "overview";
  };

  const [activePage, setActivePage] = useState(getSubPage);
  const [loading, setLoading] = useState(true);
  const [showBalances, setShowBalances] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { status: verificationStatus, isVerified, verificationData, refresh: refreshVerification } = useUserVerification({ enabled: isAuthenticated });
  
  const [hasOkxAccount, setHasOkxAccount] = useState(false);
  const [accountRequestStatus, setAccountRequestStatus] = useState(null);

  const [wallets, setWallets] = useState([]);
  const [okxBalances, setOkxBalances] = useState(null);
  const [totalBalance, setTotalBalance] = useState(0);
  const [stakingOverlay, setStakingOverlay] = useState(null);
  const [copyTradingWallet, setCopyTradingWallet] = useState(null);
  
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [copyTradingDepositOpen, setCopyTradingDepositOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const setSubPage = useCallback((page) => {
    setActivePage(page);
    const params = new URLSearchParams(location.search);
    params.set("page", page);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    const newPage = getSubPage();
    if (newPage !== activePage) setActivePage(newPage);
  }, [location.search]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    try {
      const user = await base44.auth.me();

      const [okxResult, liveTradingAccounts] = await Promise.all([
        base44.functions.invoke("okxUserAccount", { action: "getMyAccount" }).catch(() => ({ data: { ok: false } })),
        base44.entities.TradingAccount.filter({ user_id: user.id, is_demo: false }, '-created_date', 1)
      ]);
      
      const hasOkx = okxResult.data?.ok && okxResult.data.data?.hasAccount;
      const hasLiveAccount = liveTradingAccounts?.length > 0;
      
      if (hasOkx || hasLiveAccount) {
        setHasOkxAccount(true);
        setOkxBalances(hasOkx ? okxResult.data.data.balances : null);
        setAccountRequestStatus(null);
      } else {
        setHasOkxAccount(false);
        const requests = await base44.entities.LiveAccountRequest.filter({ user_id: user.id }, "-created_date", 1);
        if (requests?.length > 0 && requests[0].status !== "rejected") {
          setAccountRequestStatus(requests[0].status);
        } else {
          setAccountRequestStatus(null);
        }
      }

      const walletsResult = await base44.functions.invoke("wallet", { action: "list" });
      if (walletsResult.data?.success) {
        setWallets(walletsResult.data.data || []);
      }

      try {
        const stakingRes = await base44.functions.invoke("stakingUser", { action: "getWalletOverlay" });
        if (stakingRes.data?.ok) setStakingOverlay(stakingRes.data.data);
      } catch (e) {}

      let copyTradingRes = null;
      try {
        copyTradingRes = await base44.functions.invoke("copyTradingUser", { action: "getWallet" });
        if (copyTradingRes.data?.ok) setCopyTradingWallet(copyTradingRes.data.data);
      } catch (e) {}

      const internalBalance = (walletsResult.data?.data || []).reduce((sum, w) => {
        if (w.currency === "USDT" || w.currency === "USDC") return sum + (w.balance || 0);
        return sum;
      }, 0);
      const okxBalance = okxResult.data?.data?.balances?.totalEquity || 0;
      const ctAvailable = copyTradingRes?.data?.data?.available_balance || 0;
      const ctLocked = copyTradingRes?.data?.data?.locked_balance || 0;
      
      setTotalBalance(internalBalance + okxBalance + ctAvailable + ctLocked);

    } catch (err) {
      console.error("[Wallet] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      loadData();
    } else if (!isLoadingAuth) {
      setLoading(false);
    }
  }, [isLoadingAuth, isAuthenticated, loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), refreshVerification()]);
    setRefreshKey(prev => prev + 1);
    setRefreshing(false);
  };

  if (!isLoadingAuth && !isAuthenticated) {
    return (
      <AuthRequiredState
        title={t.loginRequired}
        description={t.loginDesc}
        primaryActionLabel={t.login}
        secondaryActionLabel={t.backHome}
        secondaryActionHref={createPageUrl("Home")}
        onPrimaryAction={navigateToLogin}
      />
    );
  }

  if (loading || isLoadingAuth) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const isFullyUnlocked = isVerified && hasOkxAccount;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-background pb-20 pt-4 sm:pt-8" dir={language === "ar" ? "rtl" : "ltr"}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage your assets and transactions</p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowBalances(!showBalances)}
                className="rounded-lg border-border/40 h-9"
              >
                {showBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh} 
                disabled={refreshing}
                className="rounded-lg border-border/40 h-9"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {t.refresh}
              </Button>
            </div>
          </div>

          {/* Sub-navigation */}
          <div className="flex items-center gap-1 p-1 bg-muted/30 border border-border/40 rounded-xl w-fit">
            {SUB_PAGES.map((page) => (
              <Button
                key={page.id}
                variant={activePage === page.id ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSubPage(page.id)}
                className={`rounded-lg px-4 h-9 text-xs font-bold transition-all ${activePage === page.id ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              >
                <page.icon className="h-3.5 w-3.5 mr-2" />
                {t[page.labelKey]}
              </Button>
            ))}
          </div>

          {/* Content Area */}
          <div className="space-y-8">
            {/* Gating Notices */}
            {!isVerified && (
              <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-amber-500/10">
                        <Shield className="h-6 w-6 text-amber-500" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold">{t.verifyIdentity}</h3>
                        <p className="text-sm text-muted-foreground">{t.verifyDesc}</p>
                      </div>
                    </div>
                    <Button asChild className="rounded-lg px-6 bg-amber-500 hover:bg-amber-600 text-white border-none">
                      <Link to={createPageUrl("Profile", { tab: "security", openVerification: "true" })}>
                        {t.startKyc}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {isVerified && !hasOkxAccount && (
              <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <Rocket className="h-6 w-6 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold">{t.activateAccount}</h3>
                        <p className="text-sm text-muted-foreground">{t.activateDesc}</p>
                      </div>
                    </div>
                    <Button asChild className="rounded-lg px-6">
                      <Link to={createPageUrl("Profile", { tab: "accounts" })}>
                        {t.requestAccount}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Page Content */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              {activePage === "overview" && (
                <WalletOverview
                  language={language}
                  showBalances={showBalances}
                  wallets={wallets}
                  okxBalances={okxBalances}
                  totalBalance={totalBalance}
                  hasOkxAccount={hasOkxAccount}
                  isFullyUnlocked={isFullyUnlocked}
                  stakingOverlay={stakingOverlay}
                  copyTradingWallet={copyTradingWallet}
                  onDeposit={() => setSubPage("deposit")}
                  onTransfer={() => setTransferModalOpen(true)}
                  onCopyTradingDeposit={() => setCopyTradingDepositOpen(true)}
                  onRefresh={handleRefresh}
                />
              )}

              {activePage === "deposit" && (
                <WalletDeposit
                  language={language}
                  isFullyUnlocked={isFullyUnlocked}
                  onBack={() => setSubPage("overview")}
                />
              )}

              {activePage === "history" && (
                <WalletHistory
                  key={refreshKey}
                  language={language}
                />
              )}
            </div>
          </div>
        </div>

        {/* Modals */}
        <OKXTransferModal
          open={transferModalOpen}
          onOpenChange={setTransferModalOpen}
          language={language}
          onSuccess={loadData}
        />
        <AllocationModal
          open={copyTradingDepositOpen}
          onOpenChange={setCopyTradingDepositOpen}
          language={language}
          onSuccess={loadData}
        />
      </div>
    </PullToRefresh>
  );
}

WalletPage.propTypes = {
  language: PropTypes.oneOf(["en", "ar"])
};
