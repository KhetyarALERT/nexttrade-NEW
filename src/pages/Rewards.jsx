import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import AuthRequiredState from "@/components/AuthRequiredState";
import ShareModal from "@/components/invite/ShareModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  Gift, Star, Trophy, Flame, Zap, Users, Copy, Check, Share2,
  CalendarCheck2, CheckCircle2, DollarSign, TrendingUp, Clock,
  ArrowRight, Wallet, History, Target, ExternalLink, RefreshCw, 
  Lock, Crown, AlertCircle, Sparkles
} from "lucide-react";

// Components
import InviteCard from "@/components/rewards/InviteCard";
import LevelProgress from "@/components/rewards/LevelProgress";
import ReferralStatusTable from "@/components/rewards/ReferralStatusTable";
import VoucherLedger from "@/components/rewards/VoucherLedger";

// ==================== TRANSLATIONS ====================
const t = {
  en: {
    title: "Invite & Earn",
    subtitle: "Earn vouchers by inviting friends to trade",
    overview: "Overview",
    referrals: "Invite & Earn",
    checkin: "Check-in",
    milestones: "Milestones",
    history: "History",
    totalEarnings: "Voucher Value",
    totalPoints: "Total Points",
    level: "Level",
    streak: "Streak",
    yourLink: "Your Referral Link",
    copy: "Copy",
    copied: "Copied!",
    share: "Share",
    referralStats: "Referral Stats",
    level1: "Level 1",
    level2: "Level 2", 
    level3: "Level 3",
    directReferrals: "Direct Referrals",
    indirectReferrals: "Indirect Referrals",
    earned: "Earned",
    referralList: "Your Referrals",
    noReferrals: "No referrals yet",
    noReferralsDesc: "Share your link to start earning",
    dailyCheckin: "Daily Check-in",
    checkinDesc: "Come back daily to earn bonus points",
    checkinNow: "Check In Now",
    checkedIn: "Checked In!",
    day: "Day",
    bonus: "BONUS",
    days: "days",
    milestonesTitle: "Milestones",
    milestonesDesc: "Complete actions to earn points",
    claimed: "Claimed",
    claim: "Claim",
    locked: "Locked",
    rewardHistory: "Reward History",
    noHistory: "No rewards yet",
    type: "Type",
    amount: "Amount",
    date: "Date",
    status: "Status",
    howItWorks: "How it Works",
    step1: "Share your unique referral link",
    step2: "Friends deposit $100+ and complete KYC",
    step3: "Earn $10 voucher per eligible referral",
    earningsBreakdown: "Voucher Rewards",
    l1Reward: "$10 per eligible referral (100+ USDT, 30 days)",
    l2Reward: "+$50 bonus when you reach Level 2",
    l3Reward: "+$100 bonus + VIP AI at Level 3",
    accessTitle: "Sign in to access Rewards",
    accessDesc: "Track your earnings, referrals, and complete daily tasks",
    accessPrimary: "Sign In",
    quickActions: "Quick Actions",
    viewWallet: "View Wallet",
    inviteFriends: "Invite Friends",
    kycRequired: "KYC Required",
    kycRequiredDesc: "Complete identity verification to unlock referral rewards",
    verifyNow: "Verify Now",
    refreshing: "Refreshing...",
    refresh: "Refresh"
  },
  ar: {
    title: "ادعُ واربح",
    subtitle: "اربح قسائم بدعوة أصدقائك للتداول",
    overview: "نظرة عامة",
    referrals: "ادعُ واربح",
    checkin: "تسجيل الدخول",
    milestones: "الإنجازات",
    history: "السجل",
    totalEarnings: "قيمة القسائم",
    totalPoints: "إجمالي النقاط",
    level: "المستوى",
    streak: "التتابع",
    yourLink: "رابط الإحالة",
    copy: "نسخ",
    copied: "تم النسخ!",
    share: "شارك",
    referralStats: "إحصائيات الإحالة",
    level1: "المستوى 1",
    level2: "المستوى 2",
    level3: "المستوى 3",
    directReferrals: "إحالات مباشرة",
    indirectReferrals: "إحالات غير مباشرة",
    earned: "المكتسب",
    referralList: "إحالاتك",
    noReferrals: "لا إحالات بعد",
    noReferralsDesc: "شارك رابطك لتبدأ الربح",
    dailyCheckin: "تسجيل الدخول اليومي",
    checkinDesc: "عد يوميًا لكسب نقاط إضافية",
    checkinNow: "سجل الآن",
    checkedIn: "تم التسجيل!",
    day: "يوم",
    bonus: "مكافأة",
    days: "أيام",
    milestonesTitle: "الإنجازات",
    milestonesDesc: "أكمل الإجراءات لكسب النقاط",
    claimed: "تم الاستلام",
    claim: "استلم",
    locked: "مقفل",
    rewardHistory: "سجل المكافآت",
    noHistory: "لا مكافآت بعد",
    type: "النوع",
    amount: "المبلغ",
    date: "التاريخ",
    status: "الحالة",
    howItWorks: "كيف يعمل",
    step1: "شارك رابط الإحالة الخاص بك",
    step2: "الأصدقاء يودعون $100+ ويكملون KYC",
    step3: "اربح قسيمة $10 لكل إحالة مؤهلة",
    earningsBreakdown: "مكافآت القسائم",
    l1Reward: "$10 لكل إحالة مؤهلة (100+ USDT، 30 يوم)",
    l2Reward: "+$50 مكافأة عند الوصول للمستوى 2",
    l3Reward: "+$100 مكافأة + VIP AI في المستوى 3",
    accessTitle: "سجّل للوصول للمكافآت",
    accessDesc: "تتبع أرباحك وإحالاتك وأكمل المهام اليومية",
    accessPrimary: "تسجيل الدخول",
    quickActions: "إجراءات سريعة",
    viewWallet: "عرض المحفظة",
    inviteFriends: "دعوة أصدقاء",
    kycRequired: "التحقق من الهوية مطلوب",
    kycRequiredDesc: "أكمل التحقق من الهوية لفتح مكافآت الإحالة",
    verifyNow: "تحقق الآن",
    refreshing: "جاري التحديث...",
    refresh: "تحديث"
  }
};

const CHECKIN_POINTS = [10, 15, 20, 25, 35, 50, 100];

export default function Rewards({ language = "en" }) {
  const isAr = language === "ar";
  const txt = t[language] || t.en;
  const { isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get("tab") || "referrals";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [inviteEarnData, setInviteEarnData] = useState(null);
  const [missions, setMissions] = useState([]);
  const [missionsLoading, setMissionsLoading] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [claimingMilestone, setClaimingMilestone] = useState(null);

  // Load main rewards data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("rewardsHub", { action: "getSummary" });
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load rewards data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Invite & Earn snapshot (new API)
  const loadInviteEarnData = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("referralEligibilityReconciler", { 
        action: "getInviteEarnSnapshot" 
      });
      if (res.data?.success) {
        setInviteEarnData(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load invite earn data:", err);
    }
  }, []);

  // Load missions
  const loadMissions = useCallback(async () => {
    setMissionsLoading(true);
    try {
      const res = await base44.functions.invoke("rewardsHub", { action: "getMissionStatus" });
      if (res.data?.success) {
        setMissions(res.data.data.missions || []);
      }
    } catch (err) {
      console.error("Failed to load missions:", err);
    } finally {
      setMissionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !isLoadingAuth) {
      loadData();
      loadInviteEarnData();
      loadMissions();
    } else if (!isLoadingAuth) {
      setLoading(false);
    }
  }, [isAuthenticated, isLoadingAuth, loadData, loadInviteEarnData, loadMissions]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadData(), loadInviteEarnData(), loadMissions()]);
    setRefreshing(false);
    toast.success(language === "ar" ? "تم التحديث" : "Refreshed");
  }, [loadData, loadInviteEarnData, loadMissions, language]);

  const handleCheckin = useCallback(async () => {
    if (data?.checkin?.checkedInToday) return;
    setCheckinLoading(true);
    try {
      const res = await base44.functions.invoke("rewardsHub", { action: "checkin" });
      if (res.data?.success) {
        toast.success(`+${res.data.pointsEarned} ${language === "ar" ? "نقطة" : "points"}!`);
        loadData();
      }
    } catch (err) {
      toast.error(err.message || "Check-in failed");
    } finally {
      setCheckinLoading(false);
    }
  }, [data?.checkin?.checkedInToday, loadData, language]);

  const handleClaimMilestone = useCallback(async (milestoneId, points) => {
    setClaimingMilestone(milestoneId);
    try {
      const res = await base44.functions.invoke("rewardsHub", { action: "claimMilestone", milestoneId });
      if (res.data?.success) {
        if (!res.data.existing) {
          toast.success(`+${points} ${language === "ar" ? "نقطة" : "points"}!`);
        }
        loadData();
        loadMissions();
      } else if (res.data?.error === 'NOT_COMPLETED') {
        toast.error(language === "ar" ? "أكمل المهمة أولاً" : "Complete the task first");
      }
    } catch (err) {
      toast.error(err.message || "Claim failed");
    } finally {
      setClaimingMilestone(null);
    }
  }, [loadData, loadMissions, language]);

  // Not authenticated
  if (!isLoadingAuth && !isAuthenticated) {
    return (
      <AuthRequiredState
        title={txt.accessTitle}
        description={txt.accessDesc}
        primaryActionLabel={txt.accessPrimary}
        secondaryActionLabel={language === "ar" ? "العودة للرئيسية" : "Back to Home"}
        secondaryActionHref={createPageUrl("Home")}
        onPrimaryAction={navigateToLogin}
      />
    );
  }

  // Loading
  if (loading || isLoadingAuth) {
    return (
      <div className="min-h-screen bg-background p-4 pt-20" dir={isAr ? "rtl" : "ltr"}>
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-48 rounded-2xl" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const balances = data?.balances || { usdt: 0, points: 0 };
  const referral = data?.referral || { code: "", link: "", stats: {}, list: [] };
  const checkin = data?.checkin || { checkedInToday: false, streak: 0, nextPoints: 10 };
  const recentRewards = data?.recentRewards || [];

  // Invite & Earn data
  const ieData = inviteEarnData || {};
  const tierStatus = ieData.tierStatus || { currentLevel: 0, activeEligible100Count: 0, activeEligible200Count: 0, vipActive: false };
  const progress = ieData.progress || { nextLevelTarget: 5, nextLevelRemaining: 5, progressPercent: 0 };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24" dir={isAr ? "rtl" : "ltr"}>
      {/* Compact Header */}
      <section className="bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 pt-6 pb-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Gift className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">{txt.title}</h1>
                <p className="text-white/60 text-xs sm:text-sm">{txt.subtitle}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? txt.refreshing : txt.refresh}
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {[
              { label: txt.totalEarnings, value: `$${ieData.totalVoucherValue || 0}`, icon: DollarSign, color: "text-emerald-400" },
              { label: txt.totalPoints, value: balances.points.toLocaleString(), icon: Star, color: "text-yellow-400" },
              { label: txt.level, value: tierStatus.currentLevel || 0, icon: Trophy, color: "text-purple-400" },
              { label: txt.streak, value: `${checkin.streak}d`, icon: Flame, color: "text-orange-400" }
            ].map((stat, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-2 sm:p-3 text-center">
                <stat.icon className={`w-4 h-4 ${stat.color} mx-auto mb-1`} />
                <p className="text-white font-bold text-sm sm:text-lg">{stat.value}</p>
                <p className="text-white/50 text-[10px] sm:text-xs truncate">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-4 bg-card/90 backdrop-blur-sm rounded-xl p-1 mb-6 shadow-lg">
            <TabsTrigger value="referrals" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
              <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              <span className="hidden sm:inline">{txt.referrals}</span>
              <span className="sm:hidden">Invite</span>
            </TabsTrigger>
            <TabsTrigger value="checkin" className="text-xs sm:text-sm rounded-lg">
              <CalendarCheck2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              <span className="hidden sm:inline">{txt.checkin}</span>
              <span className="sm:hidden">Check</span>
            </TabsTrigger>
            <TabsTrigger value="milestones" className="text-xs sm:text-sm rounded-lg">
              <Trophy className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              <span className="hidden sm:inline">{txt.milestones}</span>
              <span className="sm:hidden">Tasks</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm rounded-lg">
              <History className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              <span className="hidden sm:inline">{txt.history}</span>
              <span className="sm:hidden">Log</span>
            </TabsTrigger>
          </TabsList>

          {/* ==================== INVITE & EARN TAB ==================== */}
          <TabsContent value="referrals" className="space-y-4 sm:space-y-6">
            {/* KYC Warning */}
            {ieData.kycRequired && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{txt.kycRequired}</p>
                    <p className="text-sm text-muted-foreground">{txt.kycRequiredDesc}</p>
                  </div>
                  <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
                    <Link to={createPageUrl("Profile") + "?tab=security"}>{txt.verifyNow}</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Invite Card */}
            <InviteCard
              referralLink={ieData.referralLink || referral.link}
              referralCode={ieData.referralCode || referral.code}
              eligibleCount={tierStatus.activeEligible100Count}
              nextLevelTarget={progress.nextLevelTarget}
              currentLevel={tierStatus.currentLevel}
              vipActive={tierStatus.vipActive}
              onShare={() => setShareModalOpen(true)}
              language={language}
            />

            {/* Level Progress */}
            <LevelProgress
              currentLevel={tierStatus.currentLevel}
              activeEligible100={tierStatus.activeEligible100Count}
              activeEligible200={tierStatus.activeEligible200Count}
              progressPercent={progress.progressPercent}
              vipActive={tierStatus.vipActive}
              language={language}
            />

            {/* Referral Status Table */}
            <ReferralStatusTable
              referrals={ieData.referrals || []}
              language={language}
            />

            {/* Voucher Ledger */}
            <VoucherLedger
              vouchers={ieData.vouchers || []}
              totalValue={ieData.totalVoucherValue || 0}
              redeemableValue={ieData.redeemableValue || 0}
              language={language}
            />

            {/* How it Works */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">{txt.howItWorks}</p>
                <div className="space-y-3">
                  {[
                    { step: "1", text: txt.step1, color: "bg-blue-500" },
                    { step: "2", text: txt.step2, color: "bg-purple-500" },
                    { step: "3", text: txt.step3, color: "bg-emerald-500" }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg ${item.color} flex items-center justify-center text-white text-xs font-bold`}>{item.step}</div>
                      <p className="text-sm text-foreground flex-1">{item.text}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-muted/50 rounded-xl">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">{txt.earningsBreakdown}</p>
                  <div className="space-y-1 text-xs text-foreground">
                    <p className="flex items-center gap-2"><Gift className="w-3 h-3 text-emerald-500" /> {txt.l1Reward}</p>
                    <p className="flex items-center gap-2"><Crown className="w-3 h-3 text-purple-500" /> {txt.l2Reward}</p>
                    <p className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-amber-500" /> {txt.l3Reward}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== CHECK-IN TAB ==================== */}
          <TabsContent value="checkin" className="space-y-4">
            <Card className="border-0 shadow-xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2">
                  <CalendarCheck2 className="w-5 h-5 text-orange-500" />
                  {txt.dailyCheckin}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <p className="text-sm text-muted-foreground mb-4">{txt.checkinDesc}</p>
                
                <div className="flex items-center justify-center gap-2 mb-6 p-4 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 rounded-xl">
                  <Flame className="w-6 h-6 text-orange-500" />
                  <span className="text-2xl font-bold text-foreground">{checkin.streak}</span>
                  <span className="text-muted-foreground">{txt.days}</span>
                </div>

                <div className="grid grid-cols-7 gap-2 sm:gap-3 mb-6">
                  {CHECKIN_POINTS.map((points, i) => {
                    const isCompleted = i < checkin.streak && checkin.checkedInToday ? true : i < checkin.streak - 1;
                    const isCurrent = i === Math.min(checkin.streak, 6) && !checkin.checkedInToday;
                    const isToday = i === checkin.streak && checkin.checkedInToday;
                    
                    return (
                      <div
                        key={i}
                        className={`relative flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl border-2 transition-all ${
                          isCompleted || isToday ? "bg-emerald-500/10 border-emerald-500" :
                          isCurrent ? "bg-orange-500/10 border-orange-500 animate-pulse" :
                          "bg-muted/30 border-border"
                        }`}
                      >
                        {i === 6 && (
                          <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-[8px] px-1.5 py-0.5">
                            {txt.bonus}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{txt.day} {i + 1}</span>
                        <span className={`text-sm sm:text-base font-bold ${
                          isCompleted || isToday ? "text-emerald-500" : isCurrent ? "text-orange-500" : "text-foreground"
                        }`}>+{points}</span>
                        {(isCompleted || isToday) && <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-1" />}
                      </div>
                    );
                  })}
                </div>

                <Button
                  onClick={handleCheckin}
                  disabled={checkin.checkedInToday || checkinLoading}
                  className={`w-full h-12 rounded-xl ${checkin.checkedInToday 
                    ? "bg-emerald-500 hover:bg-emerald-500" 
                    : "bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
                  } text-white`}
                >
                  {checkinLoading ? (
                    <span className="animate-pulse">...</span>
                  ) : checkin.checkedInToday ? (
                    <><CheckCircle2 className="w-4 h-4 mr-2" /> {txt.checkedIn}</>
                  ) : (
                    <>{txt.checkinNow} (+{checkin.nextPoints} pts)</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== MILESTONES TAB ==================== */}
          <TabsContent value="milestones" className="space-y-4">
            <Card className="border-0 shadow-xl">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-purple-500" />
                    {txt.milestonesTitle}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loadMissions()}
                    disabled={missionsLoading}
                    className="h-8 w-8 p-0"
                  >
                    <RefreshCw className={`w-4 h-4 ${missionsLoading ? "animate-spin" : ""}`} />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <p className="text-sm text-muted-foreground mb-6">{txt.milestonesDesc}</p>
                
                {missionsLoading && missions.length === 0 ? (
                  <div className="space-y-3">
                    {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {missions.map((mission) => {
                      const isClaimed = mission.status === 'claimed';
                      const isReadyToClaim = mission.status === 'ready_to_claim';
                      const isLocked = mission.status === 'locked';
                      
                      return (
                        <div
                          key={mission.key}
                          className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                            isClaimed 
                              ? "bg-emerald-500/5 border-emerald-500/30" 
                              : isReadyToClaim
                                ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                                : "bg-card border-border"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              isClaimed ? "bg-emerald-500/20" : isReadyToClaim ? "bg-primary/20" : "bg-muted"
                            }`}>
                              {isClaimed ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                              ) : isReadyToClaim ? (
                                <Target className="w-5 h-5 text-primary" />
                              ) : (
                                <Lock className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <p className={`font-medium ${isLocked ? "text-muted-foreground" : "text-foreground"}`}>
                                {mission.title?.[language] || mission.title?.en}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {mission.description?.[language] || mission.description?.en}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={
                              isClaimed ? "border-emerald-500 text-emerald-500" : 
                              isReadyToClaim ? "border-primary text-primary" : ""
                            }>
                              +{mission.points}
                            </Badge>
                            
                            {isClaimed ? (
                              <span className="text-xs text-emerald-500 font-medium px-2">{txt.claimed}</span>
                            ) : isReadyToClaim ? (
                              <Button
                                size="sm"
                                onClick={() => handleClaimMilestone(mission.key, mission.points)}
                                disabled={claimingMilestone === mission.key}
                                className="bg-primary hover:bg-primary/90 min-w-[70px]"
                              >
                                {claimingMilestone === mission.key ? "..." : txt.claim}
                              </Button>
                            ) : mission.action ? (
                              <Button
                                size="sm"
                                variant="outline"
                                asChild
                                className="gap-1"
                              >
                                <Link to={createPageUrl(mission.action.route.split('?')[0].replace('/', '')) + (mission.action.route.includes('?') ? '?' + mission.action.route.split('?')[1] : '')}>
                                  {mission.action.label?.[language] || mission.action.label?.en}
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground px-2">{txt.locked}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== HISTORY TAB ==================== */}
          <TabsContent value="history" className="space-y-4">
            <Card className="border-0 shadow-xl">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-500" />
                  {txt.rewardHistory}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {recentRewards.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <Gift className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">{txt.noHistory}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentRewards.map((reward, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            reward.type.startsWith("referral") ? "bg-emerald-500/10" :
                            reward.type === "checkin" ? "bg-orange-500/10" :
                            reward.type === "milestone" ? "bg-purple-500/10" :
                            "bg-blue-500/10"
                          }`}>
                            {reward.type.startsWith("referral") ? <Users className="w-5 h-5 text-emerald-600" /> :
                             reward.type === "checkin" ? <CalendarCheck2 className="w-5 h-5 text-orange-600" /> :
                             reward.type === "milestone" ? <Trophy className="w-5 h-5 text-purple-600" /> :
                             <Gift className="w-5 h-5 text-blue-600" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {reward.type === "referral_l1" ? "Referral Bonus" :
                               reward.type === "referral_voucher" ? "Referral Voucher" :
                               reward.type === "level_up_voucher" ? "Level Up Bonus" :
                               reward.type === "checkin" ? "Daily Check-in" :
                               reward.type === "milestone" ? `Milestone: ${reward.subtype}` :
                               reward.description || reward.type}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(reward.created_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {reward.amount > 0 && (
                            <span className="font-bold text-emerald-600 block">+${reward.amount}</span>
                          )}
                          {reward.points > 0 && (
                            <span className="text-xs text-yellow-600">+{reward.points} pts</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        link={ieData.referralLink || referral.link}
        language={language}
      />
    </div>
  );
}

Rewards.propTypes = {
  language: PropTypes.oneOf(["en", "ar"])
};