import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import AuthRequiredState from "@/components/AuthRequiredState";
import ShareModal from "@/components/invite/ShareModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Copy,
  Check,
  Share2,
  Users,
  Gift,
  DollarSign,
  MousePointer,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  TrendingUp,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";

const t = {
  en: {
    title: "Invite & Earn",
    subtitle: "Share. They trade. You earn.",
    yourLink: "Your Referral Link",
    copy: "Copy",
    copied: "Copied!",
    share: "Share",
    earnings: "Earnings",
    totalEarned: "Total Earned",
    thisWeek: "This Week",
    stats: "Your Progress",
    clicks: "Clicks",
    signups: "Signups",
    verified: "Verified",
    deposited: "Deposited",
    recentRewards: "Recent Rewards",
    noRewards: "No rewards yet",
    noRewardsDesc: "Invite friends to start earning",
    howItWorks: "How it Works",
    step1: "Share your unique link",
    step2: "Friend registers & verifies",
    step3: "Earn $10 on their first deposit",
    faq: "FAQ",
    faq1Q: "When do I get paid?",
    faq1A: "Rewards are credited immediately after your friend completes KYC and makes their first deposit.",
    faq2Q: "Is there a limit?",
    faq2A: "No limit! Invite as many friends as you want.",
    faq3Q: "How do I track progress?",
    faq3A: "Your stats update in real-time on this page.",
    accessTitle: "Sign in to start earning",
    accessDesc: "Get your unique referral link and earn rewards when friends join.",
    accessPrimary: "Sign In",
    accessSecondary: "Back to Home"
  },
  ar: {
    title: "ادعُ واربح",
    subtitle: "شارك. يتداولون. تربح.",
    yourLink: "رابط الإحالة",
    copy: "نسخ",
    copied: "تم النسخ!",
    share: "شارك",
    earnings: "الأرباح",
    totalEarned: "إجمالي الأرباح",
    thisWeek: "هذا الأسبوع",
    stats: "تقدمك",
    clicks: "نقرات",
    signups: "تسجيلات",
    verified: "موثقون",
    deposited: "أودعوا",
    recentRewards: "آخر المكافآت",
    noRewards: "لا مكافآت بعد",
    noRewardsDesc: "ادعُ أصدقاءك لتبدأ الربح",
    howItWorks: "كيف يعمل",
    step1: "شارك رابطك الخاص",
    step2: "صديقك يسجّل ويتحقق",
    step3: "اربح $10 عند أول إيداع له",
    faq: "أسئلة شائعة",
    faq1Q: "متى أحصل على المكافأة؟",
    faq1A: "تُضاف المكافأة فوراً بعد إتمام صديقك للتحقق وأول إيداع.",
    faq2Q: "هل هناك حد أقصى؟",
    faq2A: "لا حدود! ادعُ من تشاء.",
    faq3Q: "كيف أتابع التقدم؟",
    faq3A: "إحصائياتك تتحدث لحظياً في هذه الصفحة.",
    accessTitle: "سجّل الدخول لتبدأ الربح",
    accessDesc: "احصل على رابط الإحالة الخاص بك واربح عند انضمام أصدقائك.",
    accessPrimary: "تسجيل الدخول",
    accessSecondary: "العودة للرئيسية"
  }
};

export default function Invite({ language = "en" }) {
  const isAr = language === "ar";
  const txt = t[language] || t.en;
  const { isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [referralData, setReferralData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);

  const loadReferralInfo = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("referral", { action: "getMyReferralInfo" });
      if (res.data?.success) {
        setReferralData(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load referral info:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !isLoadingAuth) {
      loadReferralInfo();
    } else if (!isLoadingAuth) {
      setLoading(false);
    }
  }, [isAuthenticated, isLoadingAuth, loadReferralInfo]);

  const handleCopy = useCallback(() => {
    if (!referralData?.link) return;
    navigator.clipboard.writeText(referralData.link);
    setCopied(true);
    toast.success(txt.copied);
    setTimeout(() => setCopied(false), 2000);
  }, [referralData?.link, txt.copied]);

  // Not authenticated
  if (!isLoadingAuth && !isAuthenticated) {
    return (
      <AuthRequiredState
        title={txt.accessTitle}
        description={txt.accessDesc}
        primaryActionLabel={txt.accessPrimary}
        secondaryActionLabel={txt.accessSecondary}
        secondaryActionHref={createPageUrl("Home")}
        onPrimaryAction={navigateToLogin}
      />
    );
  }

  // Loading
  if (loading || isLoadingAuth) {
    return (
      <div className="min-h-screen bg-background p-4 pt-20" dir={isAr ? "rtl" : "ltr"}>
        <div className="max-w-lg mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const stats = referralData?.stats || { clicks: 0, signups: 0, verified: 0, rewarded: 0, totalEarned: 0 };
  const recentRewards = referralData?.recentRewards || [];
  const link = referralData?.link || "";

  // Truncate link for display (middle truncation)
  const truncateLink = (url) => {
    if (!url || url.length <= 40) return url;
    return `${url.slice(0, 28)}...${url.slice(-10)}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24" dir={isAr ? "rtl" : "ltr"}>
      {/* Compact Header */}
      <div className="px-4 pt-20 pb-6 sm:pt-24 sm:pb-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Gift className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">{txt.title}</h1>
              <p className="text-sm text-muted-foreground">{txt.subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 space-y-4">
        {/* Primary: Referral Link Card */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-card/80 overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs font-medium text-muted-foreground mb-3">{txt.yourLink}</p>
            
            {/* Link Pill */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 min-w-0 bg-muted/60 rounded-xl px-4 py-3">
                <p className="font-mono text-sm text-foreground truncate" dir="ltr">
                  {truncateLink(link)}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleCopy}
                className={`flex-1 h-12 rounded-xl text-sm font-semibold transition-all ${
                  copied 
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white" 
                    : "bg-primary hover:bg-primary/90 text-primary-foreground"
                }`}
              >
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? txt.copied : txt.copy}
              </Button>
              <Button
                onClick={() => setShareModalOpen(true)}
                variant="outline"
                className="flex-1 h-12 rounded-xl text-sm font-semibold border-2"
              >
                <Share2 className="w-4 h-4 mr-2" />
                {txt.share}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Earnings Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span className="text-xs text-muted-foreground">{txt.totalEarned}</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">${stats.totalEarned}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-500/10 to-blue-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-muted-foreground">{txt.thisWeek}</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">$0</p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Stats Row */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">{txt.stats}</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: MousePointer, label: txt.clicks, value: stats.clicks, color: "text-slate-600" },
                { icon: Users, label: txt.signups, value: stats.signups, color: "text-blue-600" },
                { icon: ShieldCheck, label: txt.verified, value: stats.verified, color: "text-purple-600" },
                { icon: Sparkles, label: txt.deposited, value: stats.rewarded, color: "text-emerald-600" }
              ].map((stat, i) => (
                <button
                  key={i}
                  className="text-center p-2 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <stat.icon className={`w-4 h-4 mx-auto mb-1 ${stat.color}`} />
                  <p className="text-lg font-bold text-foreground">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Rewards */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">{txt.recentRewards}</p>
            {recentRewards.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
                  <Gift className="w-5 h-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">{txt.noRewards}</p>
                <p className="text-xs text-muted-foreground/70">{txt.noRewardsDesc}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentRewards.slice(0, 5).map((reward, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {reward.type === "referral_l1" ? "Level 1 Referral" : 
                           reward.type === "referral_l2" ? "Level 2 Referral" : 
                           reward.description || reward.type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(reward.created_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-emerald-600">+${reward.amount}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* How it Works */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-4">{txt.howItWorks}</p>
            <div className="space-y-3">
              {[
                { step: "1", text: txt.step1, color: "bg-blue-500" },
                { step: "2", text: txt.step2, color: "bg-purple-500" },
                { step: "3", text: txt.step3, color: "bg-emerald-500" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full ${item.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {item.step}
                  </div>
                  <p className="text-sm text-foreground">{item.text}</p>
                  {i < 2 && <ArrowRight className="w-4 h-4 text-muted-foreground/30 ml-auto hidden sm:block" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* FAQ Accordion */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">{txt.faq}</p>
            <div className="space-y-2">
              {[
                { q: txt.faq1Q, a: txt.faq1A },
                { q: txt.faq2Q, a: txt.faq2A },
                { q: txt.faq3Q, a: txt.faq3A }
              ].map((item, i) => (
                <div key={i} className="rounded-xl border border-border overflow-hidden">
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground">{item.q}</span>
                    {expandedFaq === i ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>
                  {expandedFaq === i && (
                    <div className="px-3 pb-3">
                      <p className="text-sm text-muted-foreground">{item.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        link={link}
        language={language}
      />
    </div>
  );
}

Invite.propTypes = {
  language: PropTypes.string
};