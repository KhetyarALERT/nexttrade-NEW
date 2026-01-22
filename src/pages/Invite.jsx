import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import AuthRequiredState from "@/components/AuthRequiredState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Copy,
  CheckCircle,
  Share2,
  Users,
  Gift,
  DollarSign,
  MousePointer,
  UserCheck,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageCircle,
  Send
} from "lucide-react";
import { toast } from "sonner";

const t = {
  en: {
    title: "Invite & Earn",
    subtitle: "Share your link and earn rewards when friends trade",
    yourLink: "Your Referral Link",
    copy: "Copy",
    copied: "Copied!",
    share: "Share",
    shareWhatsApp: "WhatsApp",
    shareTelegram: "Telegram",
    shareMore: "More",
    howItWorks: "How it Works",
    step1Title: "Share Your Link",
    step1Desc: "Send your unique referral link to friends",
    step2Title: "Friend Signs Up",
    step2Desc: "They register and verify their identity",
    step3Title: "You Earn Rewards",
    step3Desc: "Get $10 when they make their first deposit",
    progress: "Your Progress",
    clicks: "Clicks",
    signups: "Signups",
    verified: "Verified",
    earned: "Earned",
    recentRewards: "Recent Rewards",
    noRewards: "No rewards yet. Start inviting friends!",
    faq: "Frequently Asked Questions",
    faq1Q: "When do I get paid?",
    faq1A: "You receive $10 after your friend completes KYC verification and makes their first deposit.",
    faq2Q: "Can I invite more than one friend?",
    faq2A: "Yes! There's no limit. Invite as many friends as you want and earn for each one.",
    faq3Q: "Why is verification required?",
    faq3A: "Verification ensures a safe trading environment and prevents fraud. It's quick and easy.",
    accessTitle: "Log in to access referrals",
    accessDesc: "Please log in to get your unique referral link and start earning.",
    accessPrimary: "Log In",
    accessSecondary: "Back to Home"
  },
  ar: {
    title: "ادعُ واربح",
    subtitle: "شارك رابطك واربح عندما يتداول أصدقاؤك",
    yourLink: "رابط الإحالة الخاص بك",
    copy: "نسخ",
    copied: "تم النسخ!",
    share: "مشاركة",
    shareWhatsApp: "واتساب",
    shareTelegram: "تيليجرام",
    shareMore: "المزيد",
    howItWorks: "كيف يعمل",
    step1Title: "شارك رابطك",
    step1Desc: "أرسل رابط الإحالة لأصدقائك",
    step2Title: "صديقك يسجّل",
    step2Desc: "يسجّل ويتحقق من هويته",
    step3Title: "تكسب المكافآت",
    step3Desc: "احصل على $10 عند أول إيداع له",
    progress: "تقدمك",
    clicks: "النقرات",
    signups: "التسجيلات",
    verified: "موثقون",
    earned: "الأرباح",
    recentRewards: "المكافآت الأخيرة",
    noRewards: "لا مكافآت بعد. ابدأ بدعوة أصدقائك!",
    faq: "الأسئلة الشائعة",
    faq1Q: "متى أحصل على المكافأة؟",
    faq1A: "تحصل على $10 بعد أن يكمل صديقك التحقق ويُجري أول إيداع.",
    faq2Q: "هل يمكنني دعوة أكثر من صديق؟",
    faq2A: "نعم! لا حدود. ادعُ من تشاء واربح على كل واحد.",
    faq3Q: "لماذا التحقق مطلوب؟",
    faq3A: "التحقق يضمن بيئة تداول آمنة ويمنع الاحتيال. سريع وسهل.",
    accessTitle: "سجّل الدخول للوصول للإحالات",
    accessDesc: "سجّل الدخول للحصول على رابط الإحالة الخاص بك وابدأ بالربح.",
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

  const handleShare = useCallback(async (platform) => {
    if (!referralData?.link) return;

    const shareText = isAr
      ? `انضم إلى NextTrade واربح مكافآت! استخدم رابطي:`
      : `Join NextTrade and earn rewards! Use my link:`;
    const fullText = `${shareText} ${referralData.link}`;

    if (platform === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(fullText)}`, "_blank");
    } else if (platform === "telegram") {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(referralData.link)}&text=${encodeURIComponent(shareText)}`, "_blank");
    } else if (platform === "native" && navigator.share) {
      try {
        await navigator.share({
          title: "NextTrade",
          text: shareText,
          url: referralData.link
        });
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  }, [referralData?.link, isAr, handleCopy]);

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
      <div className="min-h-screen bg-background p-4 sm:p-8" dir={isAr ? "rtl" : "ltr"}>
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const stats = referralData?.stats || { clicks: 0, signups: 0, verified: 0, totalEarned: 0 };
  const recentRewards = referralData?.recentRewards || [];

  // Truncate link for display
  const displayLink = referralData?.link || "";
  const truncatedLink = displayLink.length > 35 
    ? displayLink.slice(0, 25) + "..." + displayLink.slice(-8)
    : displayLink;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20" dir={isAr ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white px-4 py-8 sm:py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4">
            <Gift className="h-8 w-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{txt.title}</h1>
          <p className="text-white/80 text-sm sm:text-base">{txt.subtitle}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-6 space-y-4 sm:space-y-6">
        {/* Referral Link Card */}
        <Card className="shadow-xl border-0 rounded-2xl overflow-hidden">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">{txt.yourLink}</p>
            
            {/* Link Display */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 bg-muted rounded-xl px-3 sm:px-4 py-3 font-mono text-xs sm:text-sm truncate">
                {truncatedLink}
              </div>
              <Button
                onClick={handleCopy}
                className={`rounded-xl px-3 sm:px-4 h-12 ${copied ? "bg-emerald-600" : "bg-blue-600 hover:bg-blue-700"} text-white`}
              >
                {copied ? <CheckCircle className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                <span className="hidden sm:inline ml-2">{copied ? txt.copied : txt.copy}</span>
              </Button>
            </div>

            {/* Share Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => handleShare("whatsapp")}
                className="flex-1 min-w-[100px] rounded-xl h-11 bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                {txt.shareWhatsApp}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleShare("telegram")}
                className="flex-1 min-w-[100px] rounded-xl h-11 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                <Send className="h-4 w-4 mr-2" />
                {txt.shareTelegram}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleShare("native")}
                className="flex-1 min-w-[80px] rounded-xl h-11"
              >
                <Share2 className="h-4 w-4 mr-2" />
                {txt.shareMore}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* How it Works */}
        <Card className="shadow-lg border-0 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg font-semibold">{txt.howItWorks}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {[
                { icon: Share2, title: txt.step1Title, desc: txt.step1Desc, color: "from-blue-500 to-blue-600" },
                { icon: UserCheck, title: txt.step2Title, desc: txt.step2Desc, color: "from-indigo-500 to-indigo-600" },
                { icon: DollarSign, title: txt.step3Title, desc: txt.step3Desc, color: "from-emerald-500 to-emerald-600" }
              ].map((step, i) => (
                <div key={i} className="text-center">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mx-auto mb-2`}>
                    <step.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <p className="font-semibold text-xs sm:text-sm text-foreground">{step.title}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 leading-tight">{step.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Progress Stats */}
        <Card className="shadow-lg border-0 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg font-semibold">{txt.progress}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="grid grid-cols-4 gap-2 sm:gap-4">
              {[
                { icon: MousePointer, label: txt.clicks, value: stats.clicks, color: "text-blue-600", bg: "bg-blue-100" },
                { icon: Users, label: txt.signups, value: stats.signups, color: "text-indigo-600", bg: "bg-indigo-100" },
                { icon: ShieldCheck, label: txt.verified, value: stats.verified, color: "text-purple-600", bg: "bg-purple-100" },
                { icon: DollarSign, label: txt.earned, value: `$${stats.totalEarned}`, color: "text-emerald-600", bg: "bg-emerald-100" }
              ].map((stat, i) => (
                <div key={i} className="text-center p-2 sm:p-3 rounded-xl bg-muted/50">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${stat.bg} flex items-center justify-center mx-auto mb-1.5`}>
                    <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                  </div>
                  <p className="text-base sm:text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-[9px] sm:text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Rewards */}
        <Card className="shadow-lg border-0 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg font-semibold">{txt.recentRewards}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {recentRewards.length === 0 ? (
              <div className="text-center py-6">
                <Gift className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{txt.noRewards}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentRewards.map((reward, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {reward.type === 'referral_l1' ? 'L1 Referral' : 
                           reward.type === 'referral_l2' ? 'L2 Referral' : reward.type}
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

        {/* FAQ */}
        <Card className="shadow-lg border-0 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg font-semibold">{txt.faq}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 space-y-2">
            {[
              { q: txt.faq1Q, a: txt.faq1A },
              { q: txt.faq2Q, a: txt.faq2A },
              { q: txt.faq3Q, a: txt.faq3A }
            ].map((item, i) => (
              <div 
                key={i} 
                className="border border-border rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-3 sm:p-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="font-medium text-sm text-foreground">{item.q}</span>
                  {expandedFaq === i ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                {expandedFaq === i && (
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                    <p className="text-sm text-muted-foreground">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

Invite.propTypes = {
  language: PropTypes.string
};