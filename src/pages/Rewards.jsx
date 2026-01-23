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
import { motion } from "framer-motion";
import {
  Gift, Star, Trophy, Flame, Zap, Users, Copy, Check, Share2,
  CalendarCheck2, CheckCircle2, DollarSign, TrendingUp, Clock,
  ChevronDown, ChevronUp, ArrowRight, Wallet, History, Target
} from "lucide-react";

// ==================== TRANSLATIONS ====================
const t = {
  en: {
    title: "Rewards Hub",
    subtitle: "Earn rewards through referrals, daily check-ins, and milestones",
    overview: "Overview",
    referrals: "Referrals",
    checkin: "Check-in",
    milestones: "Milestones",
    history: "History",
    totalEarnings: "Total Earnings",
    totalPoints: "Total Points",
    level: "Level",
    nextReward: "Next Reward",
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
    streak: "Current Streak",
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
    step2: "Friends register and verify KYC",
    step3: "Earn rewards when they deposit",
    earningsBreakdown: "Earnings Breakdown",
    l1Reward: "$10 per Level 1 referral",
    l2Reward: "$2 per Level 2 referral",
    l3Reward: "$0.50 per Level 3 referral",
    accessTitle: "Sign in to access Rewards",
    accessDesc: "Track your earnings, referrals, and complete daily tasks",
    accessPrimary: "Sign In",
    quickActions: "Quick Actions",
    viewWallet: "View Wallet",
    inviteFriends: "Invite Friends",
    registered: "Registered",
    verified: "Verified",
    deposited: "Deposited",
    rewarded: "Rewarded"
  },
  ar: {
    title: "مركز المكافآت",
    subtitle: "اربح مكافآت من الإحالات والتسجيل اليومي والإنجازات",
    overview: "نظرة عامة",
    referrals: "الإحالات",
    checkin: "تسجيل الدخول",
    milestones: "الإنجازات",
    history: "السجل",
    totalEarnings: "إجمالي الأرباح",
    totalPoints: "إجمالي النقاط",
    level: "المستوى",
    nextReward: "المكافأة التالية",
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
    streak: "السلسلة الحالية",
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
    step2: "الأصدقاء يسجلون ويتحققون",
    step3: "اربح عند إيداعهم",
    earningsBreakdown: "تفاصيل الأرباح",
    l1Reward: "$10 لكل إحالة مستوى 1",
    l2Reward: "$2 لكل إحالة مستوى 2",
    l3Reward: "$0.50 لكل إحالة مستوى 3",
    accessTitle: "سجّل للوصول للمكافآت",
    accessDesc: "تتبع أرباحك وإحالاتك وأكمل المهام اليومية",
    accessPrimary: "تسجيل الدخول",
    quickActions: "إجراءات سريعة",
    viewWallet: "عرض المحفظة",
    inviteFriends: "دعوة أصدقاء",
    registered: "مسجّل",
    verified: "موثّق",
    deposited: "أودع",
    rewarded: "مكافأ"
  }
};

const CHECKIN_POINTS = [10, 15, 20, 25, 35, 50, 100];

export default function Rewards({ language = "en" }) {
  const isAr = language === "ar";
  const txt = t[language] || t.en;
  const { isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [missions, setMissions] = useState([]);
  const [missionsLoading, setMissionsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [claimingMilestone, setClaimingMilestone] = useState(null);

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
      loadMissions();
    } else if (!isLoadingAuth) {
      setLoading(false);
    }
  }, [isAuthenticated, isLoadingAuth, loadData, loadMissions]);

  const handleCopy = useCallback(() => {
    if (!data?.referral?.link) return;
    navigator.clipboard.writeText(data.referral.link);
    setCopied(true);
    toast.success(txt.copied);
    setTimeout(() => setCopied(false), 2000);
  }, [data?.referral?.link, txt.copied]);

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
      }
    } catch (err) {
      toast.error(err.message || "Claim failed");
    } finally {
      setClaimingMilestone(null);
    }
  }, [loadData, language]);

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const balances = data?.balances || { usdt: 0, points: 0 };
  const referral = data?.referral || { code: "", link: "", stats: {}, list: [] };
  const checkin = data?.checkin || { checkedInToday: false, streak: 0, nextPoints: 10 };
  const milestones = data?.milestones || { claimed: [], available: [] };
  const recentRewards = data?.recentRewards || [];

  const currentLevel = Math.floor(balances.points / 500) + 1;
  const levelProgress = (balances.points % 500) / 500 * 100;
  const pointsToNextLevel = 500 - (balances.points % 500);

  return (
    <div className="min-h-screen bg-background text-foreground pb-24" dir={isAr ? "rtl" : "ltr"}>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 pt-8 pb-16">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-4">
              <Gift className="w-5 h-5 text-yellow-400" />
              <span className="text-white font-medium">{txt.title}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">{txt.subtitle}</h1>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: txt.totalEarnings, value: `$${balances.usdt.toFixed(2)}`, icon: DollarSign, color: "text-emerald-400" },
              { label: txt.totalPoints, value: balances.points.toLocaleString(), icon: Star, color: "text-yellow-400" },
              { label: txt.level, value: currentLevel, icon: Trophy, color: "text-purple-400" },
              { label: txt.streak, value: `${checkin.streak} ${txt.days}`, icon: Flame, color: "text-orange-400" }
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card className="bg-white/10 border-white/10 backdrop-blur-xl">
                  <CardContent className="p-3 sm:p-4">
                    <stat.icon className={`w-5 h-5 ${stat.color} mb-1`} />
                    <p className="text-white/60 text-xs">{stat.label}</p>
                    <p className="text-lg sm:text-xl font-bold text-white">{stat.value}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Level Progress */}
          <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-white/60 mb-1">
              <span>Level {currentLevel}</span>
              <span>Level {currentLevel + 1}</span>
            </div>
            <Progress value={levelProgress} className="h-2 bg-white/20" />
            <p className="text-center text-xs text-white/40 mt-1">{pointsToNextLevel} points to next level</p>
          </div>
        </div>
      </section>

      {/* Tabs Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-5 bg-card/80 backdrop-blur-sm rounded-xl p-1 mb-6">
            <TabsTrigger value="overview" className="text-xs sm:text-sm rounded-lg">{txt.overview}</TabsTrigger>
            <TabsTrigger value="referrals" className="text-xs sm:text-sm rounded-lg">{txt.referrals}</TabsTrigger>
            <TabsTrigger value="checkin" className="text-xs sm:text-sm rounded-lg">{txt.checkin}</TabsTrigger>
            <TabsTrigger value="milestones" className="text-xs sm:text-sm rounded-lg">{txt.milestones}</TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm rounded-lg">{txt.history}</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Referral Link Card */}
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs font-medium text-muted-foreground mb-2">{txt.yourLink}</p>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 min-w-0 bg-muted/60 rounded-xl px-4 py-2.5">
                    <p className="font-mono text-sm text-foreground truncate" dir="ltr">{referral.link}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCopy} className={`flex-1 h-10 rounded-xl text-sm ${copied ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}>
                    {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                    {copied ? txt.copied : txt.copy}
                  </Button>
                  <Button onClick={() => setShareModalOpen(true)} variant="outline" className="flex-1 h-10 rounded-xl text-sm">
                    <Share2 className="w-4 h-4 mr-1" /> {txt.share}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Level Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: txt.level1, count: referral.stats?.level1?.count || 0, earned: referral.stats?.level1?.earned || 0, color: "from-blue-500/10 to-blue-500/5", textColor: "text-blue-600" },
                { label: txt.level2, count: referral.stats?.level2?.count || 0, earned: referral.stats?.level2?.earned || 0, color: "from-purple-500/10 to-purple-500/5", textColor: "text-purple-600" },
                { label: txt.level3, count: referral.stats?.level3?.count || 0, earned: referral.stats?.level3?.earned || 0, color: "from-orange-500/10 to-orange-500/5", textColor: "text-orange-600" }
              ].map((level, i) => (
                <Card key={i} className={`border-0 shadow-md bg-gradient-to-br ${level.color}`}>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">{level.label}</p>
                    <p className={`text-2xl font-bold ${level.textColor}`}>{level.count}</p>
                    <p className="text-xs text-muted-foreground">${level.earned.toFixed(2)} {txt.earned}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Quick Actions */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">{txt.quickActions}</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button asChild variant="outline" className="h-12 rounded-xl">
                    <a href={createPageUrl("Wallet")}><Wallet className="w-4 h-4 mr-2" /> {txt.viewWallet}</a>
                  </Button>
                  <Button onClick={() => setActiveTab("referrals")} className="h-12 rounded-xl">
                    <Users className="w-4 h-4 mr-2" /> {txt.inviteFriends}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* How it Works */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">{txt.howItWorks}</p>
                <div className="space-y-2">
                  {[
                    { step: "1", text: txt.step1, color: "bg-blue-500" },
                    { step: "2", text: txt.step2, color: "bg-purple-500" },
                    { step: "3", text: txt.step3, color: "bg-emerald-500" }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full ${item.color} flex items-center justify-center text-white text-xs font-bold`}>{item.step}</div>
                      <p className="text-sm text-foreground flex-1">{item.text}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-muted/50 rounded-xl">
                  <p className="text-xs font-medium text-muted-foreground mb-2">{txt.earningsBreakdown}</p>
                  <div className="space-y-1 text-xs text-foreground">
                    <p>• {txt.l1Reward}</p>
                    <p>• {txt.l2Reward}</p>
                    <p>• {txt.l3Reward}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Referrals Tab */}
          <TabsContent value="referrals" className="space-y-4">
            {/* Referral Link Card */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs font-medium text-muted-foreground mb-2">{txt.yourLink}</p>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 min-w-0 bg-background/80 rounded-xl px-4 py-3">
                    <p className="font-mono text-sm text-foreground truncate" dir="ltr">{referral.link}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCopy} className={`flex-1 h-11 rounded-xl ${copied ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}>
                    {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    {copied ? txt.copied : txt.copy}
                  </Button>
                  <Button onClick={() => setShareModalOpen(true)} variant="outline" className="flex-1 h-11 rounded-xl border-2">
                    <Share2 className="w-4 h-4 mr-2" /> {txt.share}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Level Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: txt.level1, count: referral.stats?.level1?.count || 0, earned: referral.stats?.level1?.earned || 0, reward: "$10", color: "from-blue-500/10 to-blue-500/5", textColor: "text-blue-600" },
                { label: txt.level2, count: referral.stats?.level2?.count || 0, earned: referral.stats?.level2?.earned || 0, reward: "$2", color: "from-purple-500/10 to-purple-500/5", textColor: "text-purple-600" },
                { label: txt.level3, count: referral.stats?.level3?.count || 0, earned: referral.stats?.level3?.earned || 0, reward: "$0.50", color: "from-orange-500/10 to-orange-500/5", textColor: "text-orange-600" }
              ].map((level, i) => (
                <Card key={i} className={`border-0 shadow-md bg-gradient-to-br ${level.color}`}>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{level.label}</p>
                    <p className={`text-3xl font-bold ${level.textColor}`}>{level.count}</p>
                    <p className="text-xs text-muted-foreground mt-1">${level.earned.toFixed(2)} {txt.earned}</p>
                    <Badge variant="outline" className="mt-2 text-[10px]">{level.reward}/referral</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Referral List */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" /> {txt.referralList}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {referral.list?.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
                      <Users className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">{txt.noReferrals}</p>
                    <p className="text-xs text-muted-foreground/70">{txt.noReferralsDesc}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {referral.list.map((ref, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white ${
                            ref.level === 1 ? "bg-blue-500" : ref.level === 2 ? "bg-purple-500" : "bg-orange-500"
                          }`}>L{ref.level}</div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{ref.email}</p>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className={`text-[10px] ${
                                ref.status === "rewarded" ? "border-emerald-500 text-emerald-600" :
                                ref.status === "deposited" ? "border-blue-500 text-blue-600" :
                                ref.status === "kyc_approved" ? "border-purple-500 text-purple-600" :
                                "border-muted-foreground/30 text-muted-foreground"
                              }`}>
                                {ref.status === "rewarded" ? txt.rewarded :
                                 ref.status === "deposited" ? txt.deposited :
                                 ref.status === "kyc_approved" ? txt.verified :
                                 txt.registered}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        {ref.rewardAmount > 0 && (
                          <span className="font-bold text-emerald-600">+${ref.rewardAmount}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Check-in Tab */}
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
                
                {/* Streak Display */}
                <div className="flex items-center justify-center gap-2 mb-6 p-4 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 rounded-xl">
                  <Flame className="w-6 h-6 text-orange-500" />
                  <span className="text-2xl font-bold text-foreground">{checkin.streak}</span>
                  <span className="text-muted-foreground">{txt.days} {txt.streak.toLowerCase()}</span>
                </div>

                {/* Days Grid */}
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
                  className={`w-full h-12 ${checkin.checkedInToday 
                    ? "bg-emerald-500 hover:bg-emerald-500" 
                    : "bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
                  } text-white rounded-xl`}
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

          {/* Milestones Tab */}
          <TabsContent value="milestones" className="space-y-4">
            <Card className="border-0 shadow-xl">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-purple-500" />
                  {txt.milestonesTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <p className="text-sm text-muted-foreground mb-6">{txt.milestonesDesc}</p>
                
                <div className="space-y-3">
                  {MILESTONES.map((milestone) => {
                    const isClaimed = milestones.claimed?.includes(milestone.id);
                    
                    return (
                      <div
                        key={milestone.id}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                          isClaimed 
                            ? "bg-emerald-500/5 border-emerald-500/30" 
                            : "bg-card border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isClaimed ? "bg-emerald-500/20" : "bg-primary/10"
                          }`}>
                            {isClaimed ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <Target className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{milestone.title[language]}</p>
                            <p className="text-xs text-muted-foreground">{milestone.desc[language]}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={isClaimed ? "border-emerald-500 text-emerald-500" : ""}>
                            +{milestone.points}
                          </Badge>
                          {isClaimed ? (
                            <span className="text-xs text-emerald-500 font-medium">{txt.claimed}</span>
                          ) : milestone.auto ? (
                            <Button
                              size="sm"
                              onClick={() => handleClaimMilestone(milestone.id, milestone.points)}
                              disabled={claimingMilestone === milestone.id}
                              className="bg-primary hover:bg-primary/90"
                            >
                              {claimingMilestone === milestone.id ? "..." : txt.claim}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">{txt.locked}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
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
                              {reward.type === "referral_l1" ? "Level 1 Referral" :
                               reward.type === "referral_l2" ? "Level 2 Referral" :
                               reward.type === "referral_l3" ? "Level 3 Referral" :
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
        link={referral.link}
        language={language}
      />
    </div>
  );
}

Rewards.propTypes = {
  language: PropTypes.oneOf(["en", "ar"])
};