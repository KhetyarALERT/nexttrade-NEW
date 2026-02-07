import { useCallback, useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Lock, Clock, Info, CheckCircle2, RefreshCw, Gift, TrendingUp, Wallet, ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

// Premium components
import StakingPlanCard from "@/components/staking/StakingPlanCard";
import StakingAmountPanel from "@/components/staking/StakingAmountPanel";
import StakingPositionCard from "@/components/staking/StakingPositionCard";
import StakingEarnedPanel from "@/components/staking/StakingEarnedPanel.jsx";
import UsdtIcon from "@/components/ui/UsdtIcon";
// Shared formatters with Latin digits
function getLocale(lang) {
  return lang === "ar" ? "ar-u-nu-latn" : "en-US";
}

function formatUsdt(val, language = "en") {
  if (val === null || val === undefined || !Number.isFinite(val)) return "0.00";
  return new Intl.NumberFormat(getLocale(language), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function formatPercent(val, language = "en", decimals = 1) {
  if (val === null || val === undefined || !Number.isFinite(val)) return "0%";
  const formatted = new Intl.NumberFormat(getLocale(language), { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(val);
  return `${formatted}%`;
}

// Translations
const t = {
  en: {
    title: "Staking",
    subtitle: "Lock USDT, earn rewards. Funds lock immediately, activates after approval.",
    infoAutoApprove: "Auto-approve enabled",
    infoManualApprove: "Manual approval required",
    totalStaked: "Total Staked",
    earned: "Earned",
    activePositions: "Active",
    avgApy: "Avg. APY",
    estMonthlyReturn: "Est. Monthly Return",
    estMonthlyReturnDesc: "Calculated for min. deposit",
    choosePlan: "Choose a Plan",
    step2Title: "Enter Amount",
    selectPlanFirst: "Select a plan to continue",
    myPositions: "My Positions",
    all: "All",
    pending: "Pending",
    active: "Active",
    completed: "Completed",
    noPositions: "No positions yet",
    noPositionsDesc: "Start staking to earn rewards",
    howItWorks: "How it works",
    step1: "Choose plan & amount",
    step2: "Funds lock instantly",
    step3: "Activates after approval",
    disclaimer: "Rewards accrue daily. Payouts processed manually.",
    loginRequired: "Login to start staking",
    login: "Login",
    noTradingAccount: "Activate your trading account first",
    activateAccount: "Activate Account",
    stakeSuccess: "Stake request submitted!",
    stakeFailed: "Staking failed",
    insufficientBalance: "Insufficient balance",
    transferUsdt: "Transfer USDT",
    refresh: "Refresh"
  },
  ar: {
    title: "الستاكينغ",
    subtitle: "اقفل USDT، واربح مكافآت. الأموال تُقفل فوراً، وتُفعّل بعد الموافقة.",
    infoAutoApprove: "الموافقة التلقائية مفعّلة",
    infoManualApprove: "مطلوب موافقة يدوية",
    totalStaked: "إجمالي المستثمر",
    earned: "المكتسب",
    activePositions: "نشط",
    avgApy: "متوسط APY",
    choosePlan: "اختر خطة",
    step2Title: "أدخل المبلغ",
    selectPlanFirst: "اختر خطة للمتابعة",
    myPositions: "مراكزي",
    all: "الكل",
    pending: "قيد الانتظار",
    active: "نشط",
    completed: "مكتمل",
    noPositions: "لا توجد مراكز بعد",
    noPositionsDesc: "ابدأ الستاكينغ لكسب المكافآت",
    howItWorks: "كيف يعمل",
    step1: "اختر الخطة والمبلغ",
    step2: "الأموال تُقفل فوراً",
    step3: "يُفعّل بعد الموافقة",
    disclaimer: "المكافآت تُحتسب يومياً. الدفعات تُعالج يدوياً.",
    loginRequired: "سجل الدخول لبدء الستاكينغ",
    login: "تسجيل الدخول",
    noTradingAccount: "فعّل حساب التداول أولاً",
    activateAccount: "تفعيل الحساب",
    stakeSuccess: "تم تقديم طلب الستاكينغ!",
    stakeFailed: "فشل الستاكينغ",
    insufficientBalance: "رصيد غير كافي",
    transferUsdt: "حوّل USDT",
    refresh: "تحديث"
  }
};

// Using shared formatUsdt from utils/formatters

function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);
  return matches;
}

// Stats Card component
function StatCard({ icon: Icon, label, value, highlight = false, onClick, actionLabel }) {
  return (
    <Card 
      className={`transition-all ${highlight ? "border-primary/30 bg-primary/5" : ""} ${onClick ? "cursor-pointer hover:shadow-md hover:border-primary/40 active:scale-[0.98]" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`w-4 h-4 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className={`text-lg sm:text-xl font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
          {value}
        </p>
        {actionLabel && (
          <p className="text-[10px] text-primary mt-1 flex items-center gap-0.5">
            {actionLabel} <ArrowRight className="w-3 h-3" />
          </p>
        )}
      </CardContent>
    </Card>
  );
}

StatCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
  highlight: PropTypes.bool,
  onClick: PropTypes.func,
  actionLabel: PropTypes.string
};

export default function Investing({ language = "en" }) {
  const labels = t[language] || t.en;
  const { isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const positionsRef = useRef(null);

  const [plans, setPlans] = useState([]);
  const [stakingConfig, setStakingConfig] = useState(null);
  const [summary, setSummary] = useState({ totalStaked: 0, estimatedEarned: 0, activePositions: 0, avgApy: 0 });
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasOkxAccount, setHasOkxAccount] = useState(false);
  const [tradingBalance, setTradingBalance] = useState(0);
  const [copyTradingBalance, setCopyTradingBalance] = useState(0);
  const [isEligibleFirstStake, setIsEligibleFirstStake] = useState(false);

  // Wizard state
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Positions filter
  const [positionsFilter, setPositionsFilter] = useState("all");
  
  // Earned panel
  const [showEarnedPanel, setShowEarnedPanel] = useState(false);
  const [claimingId, setClaimingId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load plans and config (public)
      const [plansRes, configRes] = await Promise.all([
        base44.functions.invoke("stakingUser", { action: "getPlans" }),
        base44.entities.StakingConfig.filter({ config_key: "default" }),
      ]);

      if (plansRes.data?.ok) {
        setPlans((plansRes.data.data || []).map(p => ({
          ...p,
          isEnabled: p.isEnabled !== false,
          isRecommended: p.isRecommended || false,
        })));
      }
      
      if (configRes?.length) {
        setStakingConfig(configRes[0]);
      }

      if (isAuthenticated) {
        const [summaryRes, positionsRes, okxRes, ctWalletRes] = await Promise.all([
        base44.functions.invoke("stakingUser", { action: "getSummary" }),
        base44.functions.invoke("stakingUser", { action: "getPositions" }),
        base44.functions.invoke("okxUserAccount", { action: "getMyAccount" }),
        base44.functions.invoke("copyTradingUser", { action: "getWallet" }),
        ]);

        if (summaryRes.data?.ok) {
          setSummary(summaryRes.data.data || { totalStaked: 0, estimatedEarned: 0, activePositions: 0, avgApy: 0 });
        }
        
        if (positionsRes.data?.ok) {
          const pos = (positionsRes.data.data || []).map(p => ({
            ...p,
            rewardsGranted: p.rewardsGranted || 0,
          }));
          setPositions(pos);
          
          // Check first stake eligibility
          const hasCompletedStake = pos.some(p => p.status === "ACTIVE" || p.status === "COMPLETED");
          setIsEligibleFirstStake(!hasCompletedStake);
        }
        
        if (okxRes.data?.ok && okxRes.data.data?.hasAccount) {
          setHasOkxAccount(true);
          setTradingBalance(okxRes.data.data.balances?.tradingUsdt || 0);
        }
        if (ctWalletRes.data?.ok) {
          setCopyTradingBalance(ctWalletRes.data.data?.available_balance || 0);
        }
      }
    } catch (err) {
      console.error("Failed to load staking data:", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isLoadingAuth) {
      loadData();
    }
  }, [loadData, isLoadingAuth]);

  const handleSelectPlan = (plan) => {
    if (!plan.isEnabled) return;
    if (!isAuthenticated) {
      navigateToLogin();
      return;
    }
    if (!hasOkxAccount) {
      toast.error(labels.noTradingAccount);
      return;
    }
    setSelectedPlan(plan);
    setStakeAmount("");
    if (isMobile) {
      setSheetOpen(true);
    }
  };

  const handleStake = async (sourceAccount) => {
    if (!selectedPlan || !stakeAmount) return;

    const amount = parseFloat(stakeAmount);
    if (amount < selectedPlan.minDeposit) {
      toast.error(`${labels.minDeposit}: $${selectedPlan.minDeposit}`);
      return;
    }
    
    // Balance check is handled inside StakingAmountPanel/backend now based on source
    setProcessing(true);
    try {
      const res = await base44.functions.invoke("stakingUser", {
        action: "createStakeRequest",
        planKey: selectedPlan.key,
        amount,
        sourceAccount
      });

      if (res.data?.ok) {
        toast.success(labels.stakeSuccess);
        setSheetOpen(false);
        setSelectedPlan(null);
        setStakeAmount("");
        await loadData();
        
        // Scroll to positions
        setTimeout(() => {
          positionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          setPositionsFilter("pending");
        }, 300);
      } else {
        toast.error(res.data?.error?.message || labels.stakeFailed);
      }
    } catch (err) {
      toast.error(err.message || labels.stakeFailed);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelPosition = async (positionId) => {
    try {
      const res = await base44.functions.invoke("stakingUser", {
        action: "cancelStakeRequest",
        positionId
      });
      if (res.data?.ok) {
        toast.success("Request cancelled");
        loadData();
      } else {
        toast.error(res.data?.error?.message || "Failed to cancel");
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleClaimRewards = async (positionId) => {
    setClaimingId(positionId);
    try {
      const res = await base44.functions.invoke("stakingRewardsProcessor", {
        action: "requestPayout",
        position_id: positionId
      });
      if (res.data?.ok) {
        if (res.data.data?.autoProcessed) {
          toast.success(language === "ar" ? "تم تحصيل المكافآت!" : "Rewards collected!");
        } else {
          toast.success(language === "ar" ? "تم تقديم طلب المطالبة!" : "Claim request submitted!");
        }
        await loadData();
      } else {
        toast.error(res.data?.error?.message || "Failed to claim");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setClaimingId(null);
    }
  };

  const handleEarlyClaim = async (positionId) => {
    setClaimingId(positionId);
    try {
      const res = await base44.functions.invoke("stakingRewardsProcessor", {
        action: "requestPayout",
        position_id: positionId,
        early: true
      });
      if (res.data?.ok) {
        toast.success(language === "ar" ? "تم تقديم طلب التحصيل المبكر!" : "Early claim request submitted for admin review!");
        await loadData();
      } else {
        toast.error(res.data?.error?.message || "Failed");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setClaimingId(null);
    }
  };

  const filteredPositions = positions.filter(p => {
    if (positionsFilter === "all") return true;
    if (positionsFilter === "pending") return p.status === "PENDING_APPROVAL" || p.status === "PENDING_LOCK";
    if (positionsFilter === "active") return p.status === "ACTIVE";
    if (positionsFilter === "completed") return p.status === "COMPLETED" || p.status === "REJECTED" || p.status === "CANCELLED";
    return true;
  });

  const isRTL = language === "ar";

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{labels.title}</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">{labels.subtitle}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={loadData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          
          {/* Info strip */}
          <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              {stakingConfig?.auto_approve_enabled ? labels.infoAutoApprove : labels.infoManualApprove}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {/* Summary Cards - Show for authenticated users */}
        {isAuthenticated && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-6 w-16" />
                  </CardContent>
                </Card>
              ))
            ) : (
              <>
                <StatCard icon={Lock} label={labels.totalStaked} value={`${formatUsdt(summary.totalStaked, language)} USDT`} />
                <StatCard 
                  icon={Gift} 
                  label={labels.earned} 
                  value={`${formatUsdt(summary.estimatedEarned, language)} USDT`} 
                  highlight 
                  onClick={() => setShowEarnedPanel(true)}
                  actionLabel={language === "ar" ? "عرض التفاصيل" : "View details"}
                />
                <StatCard icon={CheckCircle2} label={labels.activePositions} value={summary.activePositions} />
                <StatCard icon={TrendingUp} label={labels.avgApy} value={formatPercent(summary.avgApy, language)} />
              </>
            )}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Plans Section */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">{labels.choosePlan}</h2>

            {loading ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-6 w-24" />
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {plans.map((plan) => (
                  <StakingPlanCard
                    key={plan.key}
                    plan={plan}
                    isSelected={selectedPlan?.key === plan.key}
                    onSelect={handleSelectPlan}
                    isEligibleFirstStake={isEligibleFirstStake}
                    language={language}
                    labels={labels}
                  />
                ))}
              </div>
            )}

            {/* How it works */}
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="p-4">
                <h3 className="text-sm font-medium text-foreground mb-3">{labels.howItWorks}</h3>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  {[labels.step1, labels.step2, labels.step3].map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm text-muted-foreground">{step}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground/70 mt-3">{labels.disclaimer}</p>
              </CardContent>
            </Card>
          </div>

          {/* Desktop: Amount Panel */}
          {!isMobile && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">{labels.step2Title}</h2>
              
              {!isAuthenticated ? (
                <Card className="p-6">
                  <div className="text-center space-y-3">
                    <Lock className="w-10 h-10 mx-auto text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">{labels.loginRequired}</p>
                    <Button onClick={navigateToLogin}>{labels.login}</Button>
                  </div>
                </Card>
              ) : !hasOkxAccount ? (
                <Card className="p-6">
                  <div className="text-center space-y-3">
                    <Wallet className="w-10 h-10 mx-auto text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">{labels.noTradingAccount}</p>
                    <Button asChild>
                      <Link to={createPageUrl("Profile") + "?tab=accounts"}>{labels.activateAccount}</Link>
                    </Button>
                  </div>
                </Card>
              ) : selectedPlan ? (
                <Card className="p-4">
                  <StakingAmountPanel
                    plan={selectedPlan}
                    amount={stakeAmount}
                    setAmount={setStakeAmount}
                    availableBalance={tradingBalance}
                    copyTradingBalance={copyTradingBalance}
                    onStake={handleStake}
                    onBack={() => setSelectedPlan(null)}
                    processing={processing}
                    isEligibleFirstStake={isEligibleFirstStake}
                    stakingConfig={stakingConfig}
                    language={language}
                  />
                </Card>
              ) : (
                <Card className="p-6">
                  <div className="text-center space-y-3">
                    <UsdtIcon size="xl" showTooltip language={language} className="mx-auto" />
                    <p className="text-sm text-muted-foreground">{labels.selectPlanFirst}</p>
                    {tradingBalance < 50 && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to={createPageUrl("Wallet") + "?page=deposit"}>{labels.transferUsdt}</Link>
                      </Button>
                    )}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* My Positions */}
        {isAuthenticated && (
          <div ref={positionsRef} className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-semibold text-foreground">{labels.myPositions}</h2>
              <Tabs value={positionsFilter} onValueChange={setPositionsFilter}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs px-3 h-7">{labels.all}</TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs px-3 h-7">{labels.pending}</TabsTrigger>
                  <TabsTrigger value="active" className="text-xs px-3 h-7">{labels.active}</TabsTrigger>
                  <TabsTrigger value="completed" className="text-xs px-3 h-7">{labels.completed}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {loading ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-2 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredPositions.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <Lock className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-muted-foreground">{labels.noPositions}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">{labels.noPositionsDesc}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {filteredPositions.map((pos) => (
                  <StakingPositionCard
                    key={pos.id}
                    position={pos}
                    onCancel={pos.status === "PENDING_APPROVAL" ? handleCancelPosition : null}
                    onClaim={pos.status === "ACTIVE" && (pos.claimableAmount || 0) > 0.01 ? handleClaimRewards : null}
                    language={language}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile: Stake Amount Sheet */}
      {isMobile && (
        <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="border-b border-border pb-3">
              <DrawerTitle>{labels.step2Title}</DrawerTitle>
              <DrawerDescription className="sr-only">Enter staking amount</DrawerDescription>
            </DrawerHeader>
            <div className="p-4 overflow-auto">
              <StakingAmountPanel
                plan={selectedPlan}
                amount={stakeAmount}
                setAmount={setStakeAmount}
                availableBalance={tradingBalance}
                copyTradingBalance={copyTradingBalance}
                onStake={handleStake}
                onBack={() => { setSelectedPlan(null); setSheetOpen(false); }}
                processing={processing}
                isEligibleFirstStake={isEligibleFirstStake}
                stakingConfig={stakingConfig}
                language={language}
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* Earned Details Panel */}
      {isMobile ? (
        <Drawer open={showEarnedPanel} onOpenChange={setShowEarnedPanel}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="border-b border-border pb-3">
              <DrawerTitle>{language === "ar" ? "تفاصيل الأرباح" : "Earnings Breakdown"}</DrawerTitle>
              <DrawerDescription className="sr-only">Earnings details</DrawerDescription>
            </DrawerHeader>
            <div className="p-4 overflow-auto">
              <StakingEarnedPanel
                positions={positions}
                onClaim={handleClaimRewards}
                claimingId={claimingId}
                onClose={() => setShowEarnedPanel(false)}
                language={language}
              />
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={showEarnedPanel} onOpenChange={setShowEarnedPanel}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{language === "ar" ? "تفاصيل الأرباح" : "Earnings Breakdown"}</DialogTitle>
              <DialogDescription>{language === "ar" ? "مكافآتك المستحقة عبر جميع المراكز" : "Your accrued rewards across all positions"}</DialogDescription>
            </DialogHeader>
            <StakingEarnedPanel
              positions={positions}
              onClaim={handleClaimRewards}
              claimingId={claimingId}
              onClose={() => setShowEarnedPanel(false)}
              language={language}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

Investing.propTypes = {
  language: PropTypes.oneOf(["en", "ar"]),
};