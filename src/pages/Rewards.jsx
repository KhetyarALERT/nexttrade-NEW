import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Gift, CalendarCheck2, CheckCircle2, Flame, Sparkles, Trophy, Star, Zap, Users, TrendingUp, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

const STORAGE_KEYS = {
  lastCheckin: "rewards_last_checkin",
  streak: "rewards_streak",
  tasks: "rewards_tasks",
  voucherClaims: "rewards_voucher_claims_v2",
};

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const rewardMilestones = [
  { id: "signup", points: 100, title: { en: "Welcome Bonus", ar: "مكافأة الترحيب" }, desc: { en: "Sign up and verify email", ar: "سجل وتحقق من البريد" }, auto: true },
  { id: "first_deposit", points: 200, title: { en: "First Deposit", ar: "أول إيداع" }, desc: { en: "Make your first deposit", ar: "قم بأول إيداع" } },
  { id: "first_trade", points: 150, title: { en: "First Trade", ar: "أول صفقة" }, desc: { en: "Execute your first trade", ar: "نفذ أول صفقة" } },
  { id: "kyc_complete", points: 300, title: { en: "KYC Verified", ar: "تحقق KYC" }, desc: { en: "Complete identity verification", ar: "أكمل التحقق من الهوية" } },
  { id: "referral_1", points: 500, title: { en: "First Referral", ar: "أول إحالة" }, desc: { en: "Invite your first friend", ar: "ادعُ أول صديق" } },
  { id: "trade_volume_1k", points: 250, title: { en: "$1K Volume", ar: "حجم $1K" }, desc: { en: "Trade $1,000 in volume", ar: "تداول بحجم $1,000" } },
  { id: "stake_first", points: 200, title: { en: "First Stake", ar: "أول ستيك" }, desc: { en: "Stake any amount", ar: "قم بأول ستيك" } },
];

const dailyRewards = [
  { day: 1, points: 10 },
  { day: 2, points: 15 },
  { day: 3, points: 20 },
  { day: 4, points: 25 },
  { day: 5, points: 35 },
  { day: 6, points: 50 },
  { day: 7, points: 100, bonus: true },
];

const t = {
  en: {
    title: "Rewards Hub",
    subtitle: "Complete tasks, earn points, and unlock exclusive rewards",
    totalPoints: "Total Points",
    currentStreak: "Current Streak",
    days: "days",
    level: "Level",
    nextReward: "Next Reward",
    dailyCheckin: "Daily Check-in",
    checkinNow: "Check In Now",
    checkedIn: "Checked In!",
    checkinDesc: "Come back daily to earn bonus points",
    milestones: "Milestones",
    milestonesDesc: "Complete actions to earn points",
    claimed: "Claimed",
    claim: "Claim",
    locked: "Locked",
    leaderboard: "Leaderboard",
    yourRank: "Your Rank",
    topEarners: "Top Earners",
    rewardsStore: "Rewards Store",
    comingSoon: "Coming Soon",
    redeemPoints: "Redeem your points for exclusive rewards",
    day: "Day",
    bonus: "BONUS",
    tasks: "Daily Tasks",
    taskDeposit: "Make a deposit",
    taskTrade: "Execute a trade",
    taskRefer: "Invite a friend",
  },
  ar: {
    title: "مركز المكافآت",
    subtitle: "أكمل المهام، اربح نقاط، واحصل على مكافآت حصرية",
    totalPoints: "إجمالي النقاط",
    currentStreak: "السلسلة الحالية",
    days: "أيام",
    level: "المستوى",
    nextReward: "المكافأة التالية",
    dailyCheckin: "تسجيل الدخول اليومي",
    checkinNow: "سجل الآن",
    checkedIn: "تم التسجيل!",
    checkinDesc: "عد يوميًا لكسب نقاط إضافية",
    milestones: "الإنجازات",
    milestonesDesc: "أكمل الإجراءات لكسب النقاط",
    claimed: "تم الاستلام",
    claim: "استلم",
    locked: "مقفل",
    leaderboard: "قائمة المتصدرين",
    yourRank: "ترتيبك",
    topEarners: "أكثر الرابحين",
    rewardsStore: "متجر المكافآت",
    comingSoon: "قريبًا",
    redeemPoints: "استبدل نقاطك بمكافآت حصرية",
    day: "يوم",
    bonus: "مكافأة",
    tasks: "المهام اليومية",
    taskDeposit: "قم بإيداع",
    taskTrade: "نفذ صفقة",
    taskRefer: "ادعُ صديقًا",
  },
};

export default function Rewards({ language = "en" }) {
  const labels = t[language];
  
  const [streak, setStreak] = useState(0);
  const [lastCheckin, setLastCheckin] = useState(null);
  const [totalPoints, setTotalPoints] = useState(100); // Start with signup bonus
  const [claimedMilestones, setClaimedMilestones] = useState(["signup"]);
  const [loading, setLoading] = useState(false);

  const checkedInToday = lastCheckin ? isSameDay(lastCheckin, new Date()) : false;
  const currentLevel = Math.floor(totalPoints / 500) + 1;
  const levelProgress = (totalPoints % 500) / 500 * 100;
  const pointsToNextLevel = 500 - (totalPoints % 500);

  useEffect(() => {
    try {
      const storedStreak = parseInt(localStorage.getItem(STORAGE_KEYS.streak) || "0", 10);
      const storedLast = localStorage.getItem(STORAGE_KEYS.lastCheckin);
      const storedClaims = localStorage.getItem(STORAGE_KEYS.voucherClaims);
      const storedPoints = localStorage.getItem("rewards_total_points");

      if (Number.isFinite(storedStreak)) setStreak(storedStreak);
      if (storedLast) setLastCheckin(new Date(storedLast));
      if (storedClaims) {
        try {
          const parsed = JSON.parse(storedClaims);
          if (Array.isArray(parsed)) setClaimedMilestones(parsed);
        } catch {}
      }
      if (storedPoints) setTotalPoints(parseInt(storedPoints, 10) || 100);
    } catch {}
  }, []);

  const persist = useCallback((nextStreak, nextLast, nextClaims, nextPoints) => {
    try {
      localStorage.setItem(STORAGE_KEYS.streak, String(nextStreak));
      localStorage.setItem(STORAGE_KEYS.lastCheckin, nextLast ? nextLast.toISOString() : "");
      localStorage.setItem(STORAGE_KEYS.voucherClaims, JSON.stringify(nextClaims));
      localStorage.setItem("rewards_total_points", String(nextPoints));
    } catch {}
  }, []);

  const handleCheckIn = useCallback(() => {
    if (checkedInToday) return;
    
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const nextStreak = lastCheckin && isSameDay(lastCheckin, yesterday) ? streak + 1 : 1;
    const dayIndex = Math.min(nextStreak - 1, 6);
    const pointsEarned = dailyRewards[dayIndex].points;
    const nextPoints = totalPoints + pointsEarned;

    setStreak(nextStreak);
    setLastCheckin(now);
    setTotalPoints(nextPoints);
    persist(nextStreak, now, claimedMilestones, nextPoints);
    
    toast.success(language === "ar" ? `+${pointsEarned} نقطة!` : `+${pointsEarned} points!`);
  }, [checkedInToday, lastCheckin, streak, totalPoints, claimedMilestones, persist, language]);

  const claimMilestone = useCallback((id, points) => {
    if (claimedMilestones.includes(id)) return;
    
    const nextClaims = [...claimedMilestones, id];
    const nextPoints = totalPoints + points;
    
    setClaimedMilestones(nextClaims);
    setTotalPoints(nextPoints);
    persist(streak, lastCheckin, nextClaims, nextPoints);
    
    toast.success(language === "ar" ? `+${points} نقطة!` : `+${points} points!`);
  }, [claimedMilestones, totalPoints, streak, lastCheckin, persist, language]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 pt-8 pb-16">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-4">
              <Gift className="w-5 h-5 text-yellow-400" />
              <span className="text-white font-medium">{labels.title}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
              {labels.subtitle}
            </h1>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: labels.totalPoints, value: totalPoints.toLocaleString(), icon: Star, color: "text-yellow-400" },
              { label: labels.currentStreak, value: `${streak} ${labels.days}`, icon: Flame, color: "text-orange-400" },
              { label: labels.level, value: currentLevel, icon: Trophy, color: "text-purple-400" },
              { label: labels.nextReward, value: `${pointsToNextLevel} pts`, icon: Zap, color: "text-cyan-400" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="bg-white/10 border-white/10 backdrop-blur-xl">
                  <CardContent className="p-4">
                    <stat.icon className={`w-6 h-6 ${stat.color} mb-2`} />
                    <p className="text-white/60 text-xs">{stat.label}</p>
                    <p className="text-xl font-bold text-white">{stat.value}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Level Progress */}
          <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-2xl p-4">
            <div className="flex items-center justify-between text-sm text-white/60 mb-2">
              <span>Level {currentLevel}</span>
              <span>Level {currentLevel + 1}</span>
            </div>
            <Progress value={levelProgress} className="h-3 bg-white/20" />
            <p className="text-center text-xs text-white/40 mt-2">
              {pointsToNextLevel} points to next level
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 space-y-8">
        {/* Daily Check-in */}
        <Card className="border-border shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck2 className="w-5 h-5 text-orange-500" />
              {labels.dailyCheckin}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-6">{labels.checkinDesc}</p>
            
            <div className="grid grid-cols-7 gap-2 sm:gap-3 mb-6">
              {dailyRewards.map((reward, i) => {
                const isCompleted = i < streak && checkedInToday ? true : i < streak - 1;
                const isCurrent = i === Math.min(streak, 6) && !checkedInToday;
                const isLocked = i > streak;
                
                return (
                  <div
                    key={i}
                    className={`relative flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl border-2 transition-all ${
                      isCompleted ? "bg-emerald-500/10 border-emerald-500" :
                      isCurrent ? "bg-orange-500/10 border-orange-500 animate-pulse" :
                      "bg-muted/30 border-border"
                    }`}
                  >
                    {reward.bonus && (
                      <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-[8px] px-1.5 py-0.5">
                        {labels.bonus}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{labels.day} {reward.day}</span>
                    <span className={`text-sm sm:text-base font-bold ${isCompleted ? "text-emerald-500" : isCurrent ? "text-orange-500" : "text-foreground"}`}>
                      +{reward.points}
                    </span>
                    {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-1" />}
                  </div>
                );
              })}
            </div>

            <Button
              onClick={handleCheckIn}
              disabled={checkedInToday}
              className={`w-full ${checkedInToday 
                ? "bg-emerald-500 hover:bg-emerald-500" 
                : "bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
              } text-white`}
            >
              {checkedInToday ? (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> {labels.checkedIn}</>
              ) : (
                labels.checkinNow
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Milestones */}
        <Card className="border-border shadow-xl">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-500" />
              {labels.milestones}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <p className="text-sm text-muted-foreground mb-6">{labels.milestonesDesc}</p>
            
            <div className="space-y-3">
              {rewardMilestones.map((milestone) => {
                const isClaimed = claimedMilestones.includes(milestone.id);
                
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
                          <Star className="w-5 h-5 text-primary" />
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
                        <span className="text-xs text-emerald-500 font-medium">{labels.claimed}</span>
                      ) : milestone.auto ? (
                        <Button
                          size="sm"
                          onClick={() => claimMilestone(milestone.id, milestone.points)}
                          className="bg-primary hover:bg-primary/90"
                        >
                          {labels.claim}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">{labels.locked}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Rewards Store Preview */}
        <Card className="border-border shadow-xl overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 sm:p-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-2">{labels.rewardsStore}</h3>
                  <p className="text-white/80 text-sm">{labels.redeemPoints}</p>
                </div>
                <Badge className="bg-white/20 text-white border-0 px-4 py-2">
                  {labels.comingSoon}
                </Badge>
              </div>
              
              <div className="mt-6 grid grid-cols-3 gap-4">
                {[
                  { name: language === "ar" ? "خصم رسوم" : "Fee Discount", points: 500 },
                  { name: language === "ar" ? "مكافأة تداول" : "Trading Bonus", points: 1000 },
                  { name: language === "ar" ? "NFT حصري" : "Exclusive NFT", points: 2500 },
                ].map((item, i) => (
                  <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                    <Gift className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-white/60">{item.points} pts</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

Rewards.propTypes = {
  language: PropTypes.oneOf(["en", "ar"]),
};