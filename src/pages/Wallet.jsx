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
    // KYC Gating
    verifyIdentity: "Verify Your Identity",
    verifyDesc: "Complete KYC verification to unlock all wallet features",
    startKyc: "Start Verification",
    kycPending: "Verification Pending",
    kycPendingDesc: "Your documents are being reviewed. This usually takes 24-48 hours.",
    kycRejected: "Verification Rejected",
    kycRejectedDesc: "Please review the reason and resubmit your documents.",
    resubmit: "Resubmit Documents",
    // Account Gating
    activateAccount: "Activate Trading Account",
    activateDesc: "Request a trading account to start depositing and trading",
    requestAccount: "Request Account",
    accountPending: "Account Request Pending",
    accountPendingDesc: "Your trading account request is being processed.",
    // Auth
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

// Sub-navigation items
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

  // Get current sub-page from URL
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

  // Account & KYC Status
  const [kycStatus, setKycStatus] = useState(null); // null | 'pending' | 'under_review' | 'approved' | 'rejected'
  const [kycRejectionReason, setKycRejectionReason] = useState(null);
  const [hasOkxAccount, setHasOkxAccount] = useState(false);
  const [accountRequestStatus, setAccountRequestStatus] = useState(null); // null | 'pending' | 'approved' | 'rejected'

  // Wallet Data
  const [wallets, setWallets] = useState([]);
  const [okxBalances, setOkxBalances] = useState(null);
  const [totalBalance, setTotalBalance] = useState(0);
  const [stakingOverlay, setStakingOverlay] = useState(null);
  
  // Transfer Modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  // Update URL when sub-page changes
  const setSubPage = useCallback((page) => {
    setActivePage(page);
    const params = new URLSearchParams(location.search);
    params.set("page", page);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  // Sync URL changes
  useEffect(() => {
    const newPage = getSubPage();
    if (newPage !== activePage) setActivePage(newPage);
  }, [location.search]);

  // Load user status and wallets
  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    try {
      const user = await base44.auth.me();

      // Load KYC status
      const verifications = await base44.entities.VerificationRequest.filter(
        { user_id: user.id },
        "-created_date",
        1
      );
      if (verifications?.length > 0) {
        setKycStatus(verifications[0].status);
        setKycRejectionReason(verifications[0].rejection_reason);
      } else {
        setKycStatus(null);
      }

      // Load OKX account status
      const okxResult = await base44.functions.invoke("okxUserAccount", { action: "getMyAccount" });
      if (okxResult.data?.ok && okxResult.data.data?.hasAccount) {
        setHasOkxAccount(true);
        setOkxBalances(okxResult.data.data.balances);
      } else {
        setHasOkxAccount(false);
        // Check for pending account request
        const requests = await base44.entities.LiveAccountRequest.filter(
          { user_id: user.id },
          "-created_date",
          1
        );
        if (requests?.length > 0 && requests[0].status !== "rejected") {
          setAccountRequestStatus(requests[0].status);
        } else {
          setAccountRequestStatus(null);
        }
      }

      // Load internal wallets
      const walletsResult = await base44.functions.invoke("wallet", { action: "list" });
      if (walletsResult.data?.success) {
        setWallets(walletsResult.data.data || []);
      }

      // Load staking overlay
      try {
        const stakingRes = await base44.functions.invoke("stakingUser", { action: "getWalletOverlay" });
        if (stakingRes.data?.ok) {
          setStakingOverlay(stakingRes.data.data);
        }
      } catch (e) {
        console.log("[Wallet] Failed to load staking overlay:", e);
      }

      // Calculate total balance
      const internalBalance = (walletsResult.data?.data || []).reduce((sum, w) => {
        if (w.currency === "USDT" || w.currency === "USDC") return sum + (w.balance || 0);
        return sum;
      }, 0);
      const okxBalance = okxResult.data?.data?.balances?.totalEquity || 0;
      setTotalBalance(internalBalance + okxBalance);

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
    await loadData();
    setRefreshing(false);
  };

  // Auth Required
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

  // Loading
  if (loading || isLoadingAuth) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-12 w-48 mb-6" />
          <div className="flex gap-6">
            <Skeleton className="hidden lg:block h-[400px] w-64 rounded-2xl" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Determine access level
  const isKycApproved = kycStatus === "approved";
  const isKycPending = kycStatus === "pending" || kycStatus === "under_review";
  const isKycRejected = kycStatus === "rejected";
  const needsKyc = !kycStatus;
  const needsAccount = !hasOkxAccount && !accountRequestStatus;
  const accountPending = !hasOkxAccount && accountRequestStatus === "pending";

  // KYC/Account Gating Component
  const renderGatingCard = () => {
    // Priority: KYC > Account
    if (needsKyc) {
      return (
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="p-3 rounded-2xl bg-amber-500/20">
                <Shield className="h-8 w-8 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground">{t.verifyIdentity}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t.verifyDesc}</p>
              </div>
              <Button
                asChild
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl w-full sm:w-auto"
              >
                <Link to={`${createPageUrl("Profile")}?tab=security&openVerification=true`}>
                  {t.startKyc}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (isKycPending) {
      return (
        <Card className="border-blue-500/30 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-blue-500/20">
                <Clock className="h-8 w-8 text-blue-600 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{t.kycPending}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t.kycPendingDesc}</p>
                <Badge className="mt-2 bg-blue-500/20 text-blue-700 border-0">
                  {language === "ar" ? "قيد المراجعة" : "Under Review"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (isKycRejected) {
      return (
        <Card className="border-rose-500/30 bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/30">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="p-3 rounded-2xl bg-rose-500/20">
                <AlertCircle className="h-8 w-8 text-rose-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground">{t.kycRejected}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t.kycRejectedDesc}</p>
                {kycRejectionReason && (
                  <p className="text-xs text-rose-600 mt-2 p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                    {kycRejectionReason}
                  </p>
                )}
              </div>
              <Button
                asChild
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl w-full sm:w-auto"
              >
                <Link to={`${createPageUrl("Profile")}?tab=security&openVerification=true`}>
                  {t.resubmit}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    // KYC approved but no account
    if (needsAccount && isKycApproved) {
      return (
        <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="p-3 rounded-2xl bg-emerald-500/20">
                <Rocket className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground">{t.activateAccount}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t.activateDesc}</p>
              </div>
              <Button
                asChild
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl w-full sm:w-auto"
              >
                <Link to={`${createPageUrl("Profile")}?tab=accounts`}>
                  {t.requestAccount}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (accountPending) {
      return (
        <Card className="border-blue-500/30 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-blue-500/20">
                <Clock className="h-8 w-8 text-blue-600 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{t.accountPending}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t.accountPendingDesc}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  const gatingCard = renderGatingCard();
  const isFullyUnlocked = isKycApproved && hasOkxAccount;

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8 pt-4 sm:pt-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t.title}</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBalances(!showBalances)}
              className="rounded-xl"
            >
              {showBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-xl"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Gating Card (if applicable) */}
        {gatingCard && <div className="mb-6">{gatingCard}</div>}

        {/* Main Content: Desktop Sidebar + Content */}
        <div className="flex gap-6">
          
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <Card className="sticky top-24 border-border/60">
              <CardContent className="p-4 space-y-2">
                {SUB_PAGES.map((item) => {
                  const isActive = activePage === item.id;
                  const Icon = item.icon;
                  const isDisabled = !isFullyUnlocked && item.id !== "overview";
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => !isDisabled && setSubPage(item.id)}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-lg"
                          : isDisabled
                          ? "text-muted-foreground/50 cursor-not-allowed"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {t[item.labelKey]}
                      {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </aside>

          {/* Mobile Sub-Nav */}
          <div className="lg:hidden fixed bottom-16 left-0 right-0 z-40 bg-background/95 backdrop-blur-lg border-t border-border px-4 py-2 safe-area-bottom">
            <div className="flex items-center justify-around gap-2">
              {SUB_PAGES.map((item) => {
                const isActive = activePage === item.id;
                const Icon = item.icon;
                const isDisabled = !isFullyUnlocked && item.id !== "overview";
                
                return (
                  <button
                    key={item.id}
                    onClick={() => !isDisabled && setSubPage(item.id)}
                    disabled={isDisabled}
                    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : isDisabled
                        ? "text-muted-foreground/40 cursor-not-allowed"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{t[item.labelKey]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
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
                onDeposit={() => setSubPage("deposit")}
                onTransfer={() => setTransferModalOpen(true)}
                onRefresh={handleRefresh}
              />
            )}
            {activePage === "deposit" && (
              <WalletDeposit
                language={language}
                hasOkxAccount={hasOkxAccount}
                onRefresh={handleRefresh}
              />
            )}
            {activePage === "history" && (
              <WalletHistory
                language={language}
                onRefresh={handleRefresh}
              />
            )}
          </main>
        </div>
      </div>
      
      {/* Transfer Modal */}
      <OKXTransferModal
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        language={language}
        onSuccess={handleRefresh}
      />
    </div>
  );
}

WalletPage.propTypes = {
  language: PropTypes.string
};