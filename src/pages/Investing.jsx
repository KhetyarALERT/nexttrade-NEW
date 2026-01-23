import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { RefreshCw, Lock, TrendingUp, Shield, Clock, Sparkles, CheckCircle2, Zap, Gift, ArrowRight, AlertTriangle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import CryptoIcon from "@/components/ui/CryptoIcon";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";

const t = {
  en: {
    title: "Earn & Invest",
    subtitle: "Put your crypto to work with industry-leading APY rates",
    totalStaked: "Total Staked",
    totalEarned: "Est. Earned",
    activePositions: "Active Positions",
    avgApy: "Avg. APY",
    choosePlan: "Choose Your Plan",
    planSubtitle: "Lock your USDT and earn daily rewards",
    minDeposit: "Min. deposit",
    lockPeriod: "Lock period",
    selectPlan: "Select Plan",
    popular: "Most Popular",
    comingSoon: "Coming Soon",
    howItWorks: "How It Works",
    step1Title: "Deposit",
    step1Desc: "Transfer USDT to your trading account",
    step2Title: "Stake",
    step2Desc: "Select your preferred staking duration",
    step3Title: "Earn",
    step3Desc: "Watch your balance grow daily",
    whyStake: "Why Stake with NextTrade?",
    benefit1: "Institutional-grade security",
    benefit2: "Daily reward distribution",
    benefit3: "No hidden fees",
    benefit4: "24/7 customer support",
    myPositions: "My Staking Positions",
    refresh: "Refresh",
    noPositions: "No staking positions yet",
    stakeNow: "Stake Now",
    amount: "Amount (USDT)",
    confirm: "Confirm Stake",
    cancel: "Cancel",
    processing: "Processing...",
    minAmount: "Minimum",
    pendingApproval: "Pending Approval",
    active: "Active",
    rejected: "Rejected",
    completed: "Completed",
    cancelled: "Cancelled",
    days: "days",
    endsIn: "Ends in",
    estEarned: "Est. Earned",
    loginRequired: "Login to start earning",
    noTradingAccount: "Activate your trading account to start staking",
    stakeSuccess: "Stake request submitted! Awaiting approval.",
    stakeFailed: "Staking failed",
    insufficientBalance: "Insufficient balance",
  },
  ar: {
    title: "الكسب والاستثمار",
    subtitle: "ضع عملاتك الرقمية في العمل مع أفضل معدلات APY في الصناعة",
    totalStaked: "إجمالي المودع",
    totalEarned: "المكتسب التقديري",
    activePositions: "المراكز النشطة",
    avgApy: "متوسط APY",
    choosePlan: "اختر خطتك",
    planSubtitle: "اقفل USDT الخاص بك واربح مكافآت يومية",
    minDeposit: "الحد الأدنى للإيداع",
    lockPeriod: "فترة القفل",
    selectPlan: "اختر الخطة",
    popular: "الأكثر شعبية",
    comingSoon: "قريباً",
    howItWorks: "كيف يعمل",
    step1Title: "إيداع",
    step1Desc: "حول USDT إلى حساب التداول",
    step2Title: "استثمر",
    step2Desc: "حدد مدة الستيكنج المفضلة",
    step3Title: "اربح",
    step3Desc: "شاهد رصيدك ينمو يوميًا",
    whyStake: "لماذا الستيكنج مع NextTrade؟",
    benefit1: "أمان بمستوى مؤسسي",
    benefit2: "توزيع المكافآت يوميًا",
    benefit3: "بدون رسوم خفية",
    benefit4: "دعم عملاء على مدار الساعة",
    myPositions: "مراكز الستيكنج الخاصة بي",
    refresh: "تحديث",
    noPositions: "لا توجد مراكز استثمار بعد",
    stakeNow: "استثمر الآن",
    amount: "المبلغ (USDT)",
    confirm: "تأكيد الاستثمار",
    cancel: "إلغاء",
    processing: "جارٍ المعالجة...",
    minAmount: "الحد الأدنى",
    pendingApproval: "بانتظار الموافقة",
    active: "نشط",
    rejected: "مرفوض",
    completed: "مكتمل",
    cancelled: "ملغي",
    days: "يوم",
    endsIn: "ينتهي في",
    estEarned: "المكتسب التقديري",
    loginRequired: "سجل الدخول لبدء الكسب",
    noTradingAccount: "فعّل حساب التداول لبدء الاستثمار",
    stakeSuccess: "تم تقديم طلب الاستثمار! بانتظار الموافقة.",
    stakeFailed: "فشل الاستثمار",
    insufficientBalance: "رصيد غير كافي",
  },
};

const statusColors = {
  PENDING_LOCK: "bg-yellow-500/10 text-yellow-500",
  PENDING_APPROVAL: "bg-orange-500/10 text-orange-500",
  ACTIVE: "bg-green-500/10 text-green-500",
  REJECTED: "bg-red-500/10 text-red-500",
  CANCELLED: "bg-gray-500/10 text-gray-500",
  COMPLETED: "bg-blue-500/10 text-blue-500",
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

export default function Investing({ language = "en" }) {
  const labels = t[language];
  const { isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();
  
  const [plans, setPlans] = useState([]);
  const [summary, setSummary] = useState({ totalStaked: 0, estimatedEarned: 0, activePositions: 0, avgApy: 0 });
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasOkxAccount, setHasOkxAccount] = useState(false);
  
  // Stake dialog
  const [stakeDialogOpen, setStakeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [tradingBalance, setTradingBalance] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load plans (public)
      const plansRes = await base44.functions.invoke("stakingUser", { action: "getPlans" });
      if (plansRes.data?.ok) {
        setPlans(plansRes.data.data || []);
      }

      if (isAuthenticated) {
        // Load user data
        const [summaryRes, positionsRes, okxRes] = await Promise.all([
          base44.functions.invoke("stakingUser", { action: "getSummary" }),
          base44.functions.invoke("stakingUser", { action: "getPositions" }),
          base44.functions.invoke("okxUserAccount", { action: "getMyAccount" }),
        ]);

        if (summaryRes.data?.ok) {
          setSummary(summaryRes.data.data || { totalStaked: 0, estimatedEarned: 0, activePositions: 0, avgApy: 0 });
        }
        if (positionsRes.data?.ok) {
          setPositions(positionsRes.data.data || []);
        }
        if (okxRes.data?.ok && okxRes.data.data?.hasAccount) {
          setHasOkxAccount(true);
          setTradingBalance(okxRes.data.data.balances?.tradingUsdt || 0);
        }
      }
    } catch (err) {
      console.error("Failed to load investing data:", err);
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
    setStakeDialogOpen(true);
  };

  const handleStake = async () => {
    if (!selectedPlan || !stakeAmount) return;
    
    const amount = parseFloat(stakeAmount);
    if (amount < selectedPlan.minDeposit) {
      toast.error(`${labels.minAmount}: ${selectedPlan.minDeposit} USDT`);
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
        setStakeDialogOpen(false);
        setSelectedPlan(null);
        setStakeAmount("");
        loadData();
      } else {
        toast.error(res.data?.error?.message || labels.stakeFailed);
      }
    } catch (err) {
      toast.error(err.message || labels.stakeFailed);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusLabel = (status) => {
    const map = {
      PENDING_LOCK: labels.pendingApproval,
      PENDING_APPROVAL: labels.pendingApproval,
      ACTIVE: labels.active,
      REJECTED: labels.rejected,
      COMPLETED: labels.completed,
      CANCELLED: labels.cancelled,
    };
    return map[status] || status;
  };

  return (
    <div className="min-h-screen bg-background text-foreground" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 pt-8 pb-16">
        <div className="absolute inset-0 bg-grid-white/[0.02] [mask-image:linear-gradient(0deg,transparent,white)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <Badge className="mb-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-4 py-1.5">
              <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
              {language === "en" ? "Up to 18.5% APY" : "حتى 18.5% APY"}
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
              {labels.title}
            </h1>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              {labels.subtitle}
            </p>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { label: labels.totalStaked, value: `$${formatUsdt(summary.totalStaked)}`, icon: Lock, gradient: "from-blue-500 to-cyan-500" },
              { label: labels.totalEarned, value: `$${formatUsdt(summary.estimatedEarned)}`, icon: TrendingUp, gradient: "from-emerald-500 to-teal-500" },
              { label: labels.activePositions, value: summary.activePositions, icon: Sparkles, gradient: "from-purple-500 to-pink-500" },
              { label: labels.avgApy, value: `${summary.avgApy.toFixed(1)}%`, icon: Zap, gradient: "from-orange-500 to-red-500" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                  <CardContent className="p-4 sm:p-6">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center mb-3`}>
                      <stat.icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-white/50 text-xs sm:text-sm">{stat.label}</p>
                    <p className="text-xl sm:text-2xl font-bold text-white mt-1">{stat.value}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Staking Plans */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 -mt-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{labels.choosePlan}</h2>
            <p className="text-muted-foreground">{labels.planSubtitle}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className={`relative overflow-hidden border-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${
                  plan.isPopular ? "border-emerald-500 shadow-emerald-500/20 shadow-lg" : "border-border hover:border-primary/50"
                } ${!plan.isEnabled ? "opacity-60" : ""}`}>
                  {plan.isPopular && (
                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                      {labels.popular}
                    </div>
                  )}
                  {!plan.isEnabled && (
                    <div className="absolute top-0 right-0 bg-gray-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                      {labels.comingSoon}
                    </div>
                  )}
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center`}>
                        <CryptoIcon currency="USDT" size="sm" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground">{plan.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {labels.lockPeriod}: {plan.termDays === 0 ? (language === "en" ? "No lock" : "بدون قفل") : `${plan.termDays} ${labels.days}`}
                        </p>
                      </div>
                    </div>

                    <div className="mb-6">
                      <div className={`text-4xl font-bold bg-gradient-to-r ${plan.gradient} bg-clip-text text-transparent`}>
                        {plan.apyPercent}%
                      </div>
                      <p className="text-xs text-muted-foreground">APY</p>
                    </div>

                    <ul className="space-y-2 mb-6">
                      {(plan.features || []).map((feature, fi) => (
                        <li key={fi} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="text-xs text-muted-foreground mb-4">
                      {labels.minDeposit}: <span className="font-semibold text-foreground">${plan.minDeposit}</span>
                    </div>

                    <Button 
                      className={`w-full bg-gradient-to-r ${plan.gradient} hover:opacity-90 text-white border-0`}
                      onClick={() => handleSelectPlan(plan)}
                      disabled={!plan.isEnabled}
                    >
                      {labels.selectPlan}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-10">{labels.howItWorks}</h2>
          
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: Lock, title: labels.step1Title, desc: labels.step1Desc, gradient: "from-blue-500 to-cyan-500" },
              { icon: Sparkles, title: labels.step2Title, desc: labels.step2Desc, gradient: "from-emerald-500 to-teal-500" },
              { icon: TrendingUp, title: labels.step3Title, desc: labels.step3Desc, gradient: "from-purple-500 to-pink-500" },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mx-auto mb-4`}>
                  <step.icon className="w-8 h-8 text-white" />
                </div>
                <div className="text-2xl font-bold text-foreground mb-2">0{i + 1}</div>
                <h3 className="font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Stake Section */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-10">{labels.whyStake}</h2>
          
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Shield, text: labels.benefit1 },
              { icon: Clock, text: labels.benefit2 },
              { icon: CheckCircle2, text: labels.benefit3 },
              { icon: Gift, text: labels.benefit4 },
            ].map((benefit, i) => (
              <Card key={i} className="border-border">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <benefit.icon className="w-6 h-6 text-primary" />
                  </div>
                  <span className="font-medium text-foreground">{benefit.text}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* My Positions */}
      {isAuthenticated && (
        <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">{labels.myPositions}</h2>
              <Button variant="outline" onClick={loadData} disabled={loading} size="sm">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                {labels.refresh}
              </Button>
            </div>
            
            {positions.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">{labels.noPositions}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {positions.map((pos) => {
                  const daysRemaining = formatDaysRemaining(pos.endsAt);
                  return (
                    <Card key={pos.id} className="border-border">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                              <Lock className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-lg">{formatUsdt(pos.principal)} USDT</span>
                                <Badge className={statusColors[pos.status] || ""}>
                                  {getStatusLabel(pos.status)}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {pos.planKey} • {pos.apyPercent}% APY • {pos.termDays} {labels.days}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6 text-sm">
                            {pos.status === "ACTIVE" && daysRemaining !== null && (
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground">{labels.endsIn}</p>
                                <p className="font-bold text-foreground">{daysRemaining} {labels.days}</p>
                              </div>
                            )}
                            {pos.status === "ACTIVE" && (
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground">{labels.estEarned}</p>
                                <p className="font-bold text-emerald-500">+${formatUsdt(pos.estimatedEarned)}</p>
                              </div>
                            )}
                            {pos.status === "REJECTED" && pos.rejectReason && (
                              <p className="text-sm text-red-500">{pos.rejectReason}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Stake Dialog */}
      <Dialog open={stakeDialogOpen} onOpenChange={setStakeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {labels.stakeNow} - {selectedPlan?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedPlan?.apyPercent}% APY • {selectedPlan?.termDays} {labels.days}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{labels.amount}</Label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder={String(selectedPlan?.minDeposit || 100)}
                  min={selectedPlan?.minDeposit}
                  className="pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">USDT</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {labels.minAmount}: {selectedPlan?.minDeposit} USDT • Balance: {formatUsdt(tradingBalance)} USDT
              </p>
            </div>

            {stakeAmount && parseFloat(stakeAmount) >= (selectedPlan?.minDeposit || 0) && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{labels.estEarned} ({selectedPlan?.termDays} {labels.days})</span>
                  <span className="font-bold text-emerald-500">
                    +${formatUsdt(parseFloat(stakeAmount) * (selectedPlan?.apyPercent || 0) / 100 * (selectedPlan?.termDays || 30) / 365)}
                  </span>
                </div>
              </div>
            )}

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {language === "en" 
                  ? "Funds will be locked for the duration of the staking period. Early withdrawal may not be available." 
                  : "سيتم قفل الأموال طوال فترة الاستثمار. قد لا يكون السحب المبكر متاحاً."}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setStakeDialogOpen(false)} disabled={processing}>
              {labels.cancel}
            </Button>
            <Button 
              onClick={handleStake} 
              disabled={processing || !stakeAmount || parseFloat(stakeAmount) < (selectedPlan?.minDeposit || 0)}
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {processing ? labels.processing : labels.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

Investing.propTypes = {
  language: PropTypes.oneOf(["en", "ar"]),
};