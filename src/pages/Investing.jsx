import { useCallback, useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Lock, Clock, ChevronRight, Info, CheckCircle2, 
  AlertCircle, Loader2, RefreshCw, Gift, X, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";

const t = {
  en: {
    title: "Staking",
    subtitle: "Lock USDT for a fixed period. Earn APY + Bonus Rewards.",
    infoStrip: "Approval required → Funds lock immediately → Position activates after approval",
    totalStaked: "Total Staked",
    estEarned: "Est. Earned",
    activePositions: "Active Positions",
    avgApy: "Avg. APY",
    choosePlan: "Choose a Plan",
    recommended: "Recommended",
    disabled: "Unavailable",
    minDeposit: "Min",
    lockPeriod: "Lock",
    days: "days",
    perks: "Perks while active",
    viewAllPerks: "View all perks",
    bonusRewards: "Bonus Rewards",
    bonusTooltip: "Bonus Rewards unlock perks automatically. No action required.",
    step2Title: "Enter Amount",
    availableBalance: "Available",
    amountLabel: "Stake Amount (USDT)",
    youWillGet: "Summary",
    lockPeriodLabel: "Lock Period",
    unlockDate: "Est. Unlock Date",
    apyLabel: "APY",
    rewardsLabel: "Bonus Rewards",
    firstStakeBonus: "First stake bonus available",
    firstStakeBonusInfo: "+50% bonus on first stake (min $100, 60+ days)",
    statusAfterSubmit: "Status after submit",
    pendingApproval: "Pending Approval",
    stakeNow: "Stake Now",
    back: "Back",
    processing: "Processing...",
    myPositions: "My Positions",
    all: "All",
    pending: "Pending",
    active: "Active",
    completed: "Completed",
    rejected: "Rejected",
    noPositions: "No positions yet",
    cancelRequest: "Cancel",
    waitingApproval: "Waiting for approval",
    endsIn: "Ends in",
    howItWorks: "How it works",
    step1: "Choose plan + amount",
    step2: "Funds lock (Trading → Funding)",
    step3: "After approval, stake becomes Active",
    disclaimer: "Rewards are estimates until distribution is implemented.",
    loginRequired: "Login to start staking",
    noTradingAccount: "Activate your trading account first",
    stakeSuccess: "Stake request submitted",
    stakeFailed: "Staking failed",
    insufficientBalance: "Insufficient balance",
    refresh: "Refresh",
    created: "Created",
    amount: "Amount",
    term: "Term",
    status: "Status",
    rewards: "Rewards",
  },
  ar: {
    title: "الستيكنج",
    subtitle: "اقفل USDT لفترة محددة. اربح APY + مكافآت إضافية.",
    infoStrip: "مطلوب موافقة ← الأموال تُقفل فوراً ← المركز يُفعّل بعد الموافقة",
    totalStaked: "إجمالي المستثمر",
    estEarned: "المكتسب التقديري",
    activePositions: "المراكز النشطة",
    avgApy: "متوسط APY",
    choosePlan: "اختر خطة",
    recommended: "موصى به",
    disabled: "غير متاح",
    minDeposit: "الحد الأدنى",
    lockPeriod: "القفل",
    days: "يوم",
    perks: "المزايا أثناء النشاط",
    viewAllPerks: "عرض كل المزايا",
    bonusRewards: "المكافآت الإضافية",
    bonusTooltip: "المكافآت الإضافية تفتح المزايا تلقائياً. لا حاجة لأي إجراء.",
    step2Title: "أدخل المبلغ",
    availableBalance: "المتاح",
    amountLabel: "مبلغ الستيكنج (USDT)",
    youWillGet: "الملخص",
    lockPeriodLabel: "فترة القفل",
    unlockDate: "تاريخ الفتح المتوقع",
    apyLabel: "APY",
    rewardsLabel: "المكافآت الإضافية",
    firstStakeBonus: "مكافأة الستيك الأول متاحة",
    firstStakeBonusInfo: "+50% مكافأة على أول استثمار (حد أدنى $100، 60+ يوم)",
    statusAfterSubmit: "الحالة بعد الإرسال",
    pendingApproval: "بانتظار الموافقة",
    stakeNow: "استثمر الآن",
    back: "رجوع",
    processing: "جارٍ المعالجة...",
    myPositions: "مراكزي",
    all: "الكل",
    pending: "قيد الانتظار",
    active: "نشط",
    completed: "مكتمل",
    rejected: "مرفوض",
    noPositions: "لا توجد مراكز بعد",
    cancelRequest: "إلغاء",
    waitingApproval: "بانتظار الموافقة",
    endsIn: "ينتهي في",
    howItWorks: "كيف يعمل",
    step1: "اختر الخطة + المبلغ",
    step2: "الأموال تُقفل (التداول ← التمويل)",
    step3: "بعد الموافقة، يصبح المركز نشطاً",
    disclaimer: "المكافآت تقديرية حتى يتم تطبيق التوزيع.",
    loginRequired: "سجل الدخول لبدء الستيكنج",
    noTradingAccount: "فعّل حساب التداول أولاً",
    stakeSuccess: "تم تقديم طلب الستيكنج",
    stakeFailed: "فشل الستيكنج",
    insufficientBalance: "رصيد غير كافي",
    refresh: "تحديث",
    created: "تاريخ الإنشاء",
    amount: "المبلغ",
    term: "المدة",
    status: "الحالة",
    rewards: "المكافآت",
  },
};

const STATUS_COLORS = {
  PENDING_LOCK: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  PENDING_APPROVAL: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  ACTIVE: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  REJECTED: "bg-red-500/10 text-red-600 border-red-500/30",
  CANCELLED: "bg-muted text-muted-foreground border-border",
  COMPLETED: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  UNLOCKING: "bg-purple-500/10 text-purple-600 border-purple-500/30",
};

function formatUsdt(val) {
  if (val === null || val === undefined || !Number.isFinite(val)) return "0.00";
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDaysRemaining(endsAt) {
  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

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

// Plan Card Component
function PlanCard({ plan, isSelected, onSelect, labels, isEligibleFirstStake }) {
  const perksToShow = (plan.perks || []).slice(0, 2);
  const hasMorePerks = (plan.perks || []).length > 2;

  return (
    <Card
      className={`relative cursor-pointer transition-all duration-200 hover:shadow-lg ${
        isSelected
          ? "ring-2 ring-primary border-primary shadow-lg"
          : plan.isEnabled
          ? "hover:border-primary/50"
          : "opacity-50 cursor-not-allowed"
      }`}
      onClick={() => plan.isEnabled && onSelect(plan)}
    >
      {plan.isRecommended && (
        <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded-full">
          {labels.recommended}
        </div>
      )}
      {!plan.isEnabled && (
        <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-muted text-muted-foreground text-xs font-medium rounded-full">
          {labels.disabled}
        </div>
      )}

      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">{plan.title}</h3>
            <p className="text-xs text-muted-foreground">{plan.termDays} {labels.days}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{plan.apyPercent}%</div>
            <p className="text-xs text-muted-foreground">APY</p>
          </div>
        </div>

        {/* Min deposit */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{labels.minDeposit}</span>
          <span className="font-medium">${plan.minDeposit}</span>
        </div>

        {/* Bonus Rewards */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1">
            <Gift className="w-3.5 h-3.5 text-primary" />
            <span className="text-muted-foreground">{labels.bonusRewards}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[200px] text-xs">
                  {labels.bonusTooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className="font-medium">+{plan.baseRewardsPerDollar}/$ staked</span>
        </div>

        {/* First stake badge */}
        {isEligibleFirstStake && plan.termDays >= 60 && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs text-amber-700 dark:text-amber-400">{labels.firstStakeBonus}</span>
          </div>
        )}

        {/* Perks */}
        {perksToShow.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1.5">{labels.perks}</p>
            <div className="space-y-1">
              {perksToShow.map((perk, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-foreground">
                  <CheckCircle2 className="w-3 h-3 text-primary flex-shrink-0" />
                  <span>{perk}</span>
                </div>
              ))}
              {hasMorePerks && (
                <p className="text-xs text-primary cursor-pointer hover:underline">
                  {labels.viewAllPerks} →
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Amount Entry Panel Component
function AmountEntryPanel({ 
  plan, 
  amount, 
  setAmount, 
  availableBalance, 
  onStake, 
  onBack, 
  processing, 
  labels, 
  isEligibleFirstStake,
  stakingConfig,
  language
}) {
  if (!plan) return null;

  const amountNum = parseFloat(amount) || 0;
  const isValidAmount = amountNum >= plan.minDeposit && amountNum <= availableBalance;

  // Calculate bonus rewards
  let baseRewards = amountNum * (plan.baseRewardsPerDollar || 0);
  let firstStakeBonus = 0;
  
  if (isEligibleFirstStake && plan.termDays >= (stakingConfig?.first_stake_min_term_days || 60)) {
    const eligibleAmount = Math.min(amountNum, stakingConfig?.first_stake_cap_principal || 300);
    const bonusMultiplier = (stakingConfig?.first_stake_bonus_multiplier || 1.5) - 1;
    firstStakeBonus = eligibleAmount * (plan.baseRewardsPerDollar || 0) * bonusMultiplier;
  }
  
  const totalRewards = Math.round(baseRewards + firstStakeBonus);

  // Estimated unlock date (approval + term)
  const estUnlockDate = new Date();
  estUnlockDate.setDate(estUnlockDate.getDate() + plan.termDays + 1); // +1 for approval delay

  const presets = [50, 100, 250, 500];

  return (
    <div className="space-y-4">
      {/* Plan Summary */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div>
          <p className="font-medium text-foreground">{plan.title}</p>
          <p className="text-xs text-muted-foreground">{plan.termDays} {labels.days} • {plan.apyPercent}% APY</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack} className="text-xs">
          Change
        </Button>
      </div>

      {/* Available Balance */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{labels.availableBalance}</span>
        <span className="font-mono font-medium">{formatUsdt(availableBalance)} USDT</span>
      </div>

      {/* Amount Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{labels.amountLabel}</label>
        <div className="relative">
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(plan.minDeposit)}
            min={plan.minDeposit}
            max={availableBalance}
            className="pr-16 text-lg font-mono"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">USDT</span>
        </div>
        
        {/* Preset chips */}
        <div className="flex gap-2 flex-wrap">
          {presets.map((preset) => (
            <Button
              key={preset}
              variant={parseFloat(amount) === preset ? "default" : "outline"}
              size="sm"
              onClick={() => setAmount(String(preset))}
              className="text-xs"
              disabled={preset > availableBalance}
            >
              ${preset}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAmount(String(Math.floor(availableBalance)))}
            className="text-xs"
            disabled={availableBalance < plan.minDeposit}
          >
            Max
          </Button>
        </div>
      </div>

      {/* Summary Box */}
      {amountNum > 0 && (
        <div className="p-3 border border-border rounded-lg space-y-2 bg-card">
          <p className="text-sm font-medium text-foreground">{labels.youWillGet}</p>
          
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{labels.lockPeriodLabel}</span>
              <span className="font-medium">{plan.termDays} {labels.days}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{labels.unlockDate}</span>
              <span className="font-medium">{formatDate(estUnlockDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{labels.apyLabel}</span>
              <span className="font-medium text-primary">{plan.apyPercent}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{labels.rewardsLabel}</span>
              <div className="text-right">
                <span className="font-medium text-primary">+{totalRewards}</span>
                {firstStakeBonus > 0 && (
                  <span className="ml-1 text-xs text-amber-600">(incl. +{Math.round(firstStakeBonus)} bonus)</span>
                )}
              </div>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-muted-foreground">{labels.statusAfterSubmit}</span>
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                {labels.pendingApproval}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* First stake promo */}
      {isEligibleFirstStake && plan.termDays >= 60 && amountNum >= 100 && (
        <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">{labels.firstStakeBonusInfo}</p>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onBack} className="flex-1" disabled={processing}>
          {labels.back}
        </Button>
        <Button 
          onClick={onStake} 
          disabled={processing || !isValidAmount}
          className="flex-1"
        >
          {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {processing ? labels.processing : labels.stakeNow}
        </Button>
      </div>
    </div>
  );
}

// Position Row Component
function PositionRow({ position, labels, onCancel }) {
  const daysRemaining = formatDaysRemaining(position.endsAt);
  const progressPercent = position.status === "ACTIVE" && position.termDays > 0
    ? Math.min(100, Math.max(0, ((position.termDays - (daysRemaining || 0)) / position.termDays) * 100))
    : 0;

  return (
    <div className="p-3 border border-border rounded-lg bg-card space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold">{formatUsdt(position.principal)} USDT</span>
            <Badge className={`text-xs ${STATUS_COLORS[position.status] || ""}`}>
              {position.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {position.planKey} • {position.apyPercent}% APY • {position.termDays}d
          </p>
        </div>
        
        {position.status === "PENDING_APPROVAL" && onCancel && (
          <Button variant="ghost" size="sm" onClick={() => onCancel(position.id)} className="text-xs text-muted-foreground h-7">
            {labels.cancelRequest}
          </Button>
        )}
      </div>

      {position.status === "ACTIVE" && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{labels.endsIn}: {daysRemaining} {labels.days}</span>
            <span className="text-primary font-medium">+${formatUsdt(position.estimatedEarned)} est.</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      )}

      {position.status === "PENDING_APPROVAL" && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600">
          <Clock className="w-3 h-3" />
          <span>{labels.waitingApproval}</span>
        </div>
      )}

      {position.status === "REJECTED" && position.rejectReason && (
        <p className="text-xs text-red-600">{position.rejectReason}</p>
      )}

      {position.rewardsGranted > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-primary">
          <Gift className="w-3 h-3" />
          <span>+{position.rewardsGranted} {labels.rewards}</span>
        </div>
      )}
    </div>
  );
}

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
  const [isEligibleFirstStake, setIsEligibleFirstStake] = useState(false);

  // Wizard state
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Positions filter
  const [positionsFilter, setPositionsFilter] = useState("all");

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
        const [summaryRes, positionsRes, okxRes] = await Promise.all([
          base44.functions.invoke("stakingUser", { action: "getSummary" }),
          base44.functions.invoke("stakingUser", { action: "getPositions" }),
          base44.functions.invoke("okxUserAccount", { action: "getMyAccount" }),
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
          
          // Check first stake eligibility: no ACTIVE or COMPLETED positions
          const hasCompletedStake = pos.some(p => p.status === "ACTIVE" || p.status === "COMPLETED");
          setIsEligibleFirstStake(!hasCompletedStake);
        }
        
        if (okxRes.data?.ok && okxRes.data.data?.hasAccount) {
          setHasOkxAccount(true);
          setTradingBalance(okxRes.data.data.balances?.tradingUsdt || 0);
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

  const handleStake = async () => {
    if (!selectedPlan || !stakeAmount) return;

    const amount = parseFloat(stakeAmount);
    if (amount < selectedPlan.minDeposit) {
      toast.error(`${labels.minDeposit}: $${selectedPlan.minDeposit}`);
      return;
    }
    if (amount > tradingBalance) {
      toast.error(labels.insufficientBalance);
      return;
    }

    setProcessing(true);
    try {
      const res = await base44.functions.invoke("stakingUser", {
        action: "createStakeRequest",
        planKey: selectedPlan.key,
        amount
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

  const filteredPositions = positions.filter(p => {
    if (positionsFilter === "all") return true;
    if (positionsFilter === "pending") return p.status === "PENDING_APPROVAL" || p.status === "PENDING_LOCK";
    if (positionsFilter === "active") return p.status === "ACTIVE";
    if (positionsFilter === "completed") return p.status === "COMPLETED";
    if (positionsFilter === "rejected") return p.status === "REJECTED" || p.status === "CANCELLED";
    return true;
  });

  const AmountPanel = (
    <AmountEntryPanel
      plan={selectedPlan}
      amount={stakeAmount}
      setAmount={setStakeAmount}
      availableBalance={tradingBalance}
      onStake={handleStake}
      onBack={() => { setSelectedPlan(null); setSheetOpen(false); }}
      processing={processing}
      labels={labels}
      isEligibleFirstStake={isEligibleFirstStake}
      stakingConfig={stakingConfig}
      language={language}
    />
  );

  return (
    <div className="min-h-screen bg-background" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-foreground">{labels.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{labels.subtitle}</p>
          
          {/* Info strip */}
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{labels.infoStrip}</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {/* Summary Cards */}
        {isAuthenticated && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: labels.totalStaked, value: `$${formatUsdt(summary.totalStaked)}`, icon: Lock },
              { label: labels.estEarned, value: `$${formatUsdt(summary.estimatedEarned)}`, icon: Gift },
              { label: labels.activePositions, value: summary.activePositions, icon: CheckCircle2 },
              { label: labels.avgApy, value: `${summary.avgApy.toFixed(1)}%`, icon: Clock },
            ].map((stat, i) => (
              <Card key={i} className="bg-card">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <stat.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Main Content: Plans + Amount Panel */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Plans Grid */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{labels.choosePlan}</h2>
              <Button variant="ghost" size="sm" onClick={loadData} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.key}
                  plan={plan}
                  isSelected={selectedPlan?.key === plan.key}
                  onSelect={handleSelectPlan}
                  labels={labels}
                  isEligibleFirstStake={isEligibleFirstStake}
                />
              ))}
            </div>

            {/* How it works - Compact */}
            <div className="p-4 bg-muted/30 rounded-lg space-y-2">
              <h3 className="text-sm font-medium text-foreground">{labels.howItWorks}</h3>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">1</span> {labels.step1}</span>
                <ChevronRight className="w-4 h-4 hidden sm:block" />
                <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">2</span> {labels.step2}</span>
                <ChevronRight className="w-4 h-4 hidden sm:block" />
                <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">3</span> {labels.step3}</span>
              </div>
              <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {labels.disclaimer}
              </p>
            </div>
          </div>

          {/* Desktop: Right Panel for Amount Entry */}
          {!isMobile && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">{labels.step2Title}</h2>
              {selectedPlan ? (
                AmountPanel
              ) : (
                <Card className="p-6 text-center">
                  <Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    {isAuthenticated ? "Select a plan to continue" : labels.loginRequired}
                  </p>
                  {!isAuthenticated && (
                    <Button className="mt-3" onClick={navigateToLogin}>Login</Button>
                  )}
                </Card>
              )}
            </div>
          )}
        </div>

        {/* My Positions */}
        {isAuthenticated && (
          <div ref={positionsRef} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{labels.myPositions}</h2>
              <Tabs value={positionsFilter} onValueChange={setPositionsFilter} className="w-auto">
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs px-2 h-6">{labels.all}</TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs px-2 h-6">{labels.pending}</TabsTrigger>
                  <TabsTrigger value="active" className="text-xs px-2 h-6">{labels.active}</TabsTrigger>
                  <TabsTrigger value="completed" className="text-xs px-2 h-6">{labels.completed}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {filteredPositions.length === 0 ? (
              <Card className="p-6 text-center border-dashed">
                <Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{labels.noPositions}</p>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filteredPositions.map((pos) => (
                  <PositionRow
                    key={pos.id}
                    position={pos}
                    labels={labels}
                    onCancel={pos.status === "PENDING_APPROVAL" ? handleCancelPosition : null}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile: Bottom Sheet for Amount Entry */}
      {isMobile && (
        <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="border-b border-border pb-3">
              <DrawerTitle>{labels.step2Title}</DrawerTitle>
              <DrawerDescription className="sr-only">Enter staking amount</DrawerDescription>
            </DrawerHeader>
            <div className="p-4 overflow-auto">
              {AmountPanel}
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}

Investing.propTypes = {
  language: PropTypes.oneOf(["en", "ar"]),
};