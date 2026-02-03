import React, { useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Check, Share2, Gift, Crown, Users, ArrowRight, Sparkles } from "lucide-react";

const t = {
  en: {
    inviteTitle: "Invite Friends & Earn",
    inviteSubtitle: "Share your link and earn rewards when friends join",
    yourCode: "Your Referral Code",
    copyLink: "Copy Link",
    copied: "Copied!",
    share: "Share",
    howItWorks: "How It Works",
    step1Title: "Share Your Link",
    step1Desc: "Send your unique link to friends",
    step2Title: "Friends Join",
    step2Desc: "They deposit $100+ and verify KYC",
    step3Title: "Earn Rewards",
    step3Desc: "Get $10 voucher per eligible friend",
    yourProgress: "Your Progress",
    eligibleFriends: "Eligible Friends",
    toNextLevel: "to reach Level",
    vipActive: "VIP Active",
    viewDetails: "View Details"
  },
  ar: {
    inviteTitle: "ادعُ أصدقاءك واربح",
    inviteSubtitle: "شارك رابطك واربح مكافآت عندما ينضم الأصدقاء",
    yourCode: "كود الإحالة الخاص بك",
    copyLink: "نسخ الرابط",
    copied: "تم النسخ!",
    share: "شارك",
    howItWorks: "كيف يعمل",
    step1Title: "شارك رابطك",
    step1Desc: "أرسل رابطك الفريد للأصدقاء",
    step2Title: "الأصدقاء ينضمون",
    step2Desc: "يودعون $100+ ويكملون التحقق",
    step3Title: "اربح المكافآت",
    step3Desc: "احصل على قسيمة $10 لكل صديق مؤهل",
    yourProgress: "تقدمك",
    eligibleFriends: "أصدقاء مؤهلون",
    toNextLevel: "للوصول للمستوى",
    vipActive: "VIP نشط",
    viewDetails: "عرض التفاصيل"
  }
};

export default function InviteCard({ 
  referralLink, 
  referralCode, 
  eligibleCount = 0, 
  nextLevelTarget = 5,
  currentLevel = 0,
  vipActive = false,
  onShare,
  language = "en" 
}) {
  const txt = t[language] || t.en;
  const [copied, setCopied] = useState(false);
  const isAr = language === "ar";

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success(txt.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  const remaining = Math.max(0, nextLevelTarget - eligibleCount);
  const progressPercent = nextLevelTarget > 0 ? Math.min(100, (eligibleCount / nextLevelTarget) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Main Invite Card */}
      <Card className="relative overflow-hidden border border-border/50 bg-gradient-to-br from-card via-card to-primary/5 shadow-xl">
        <CardContent className="p-5 sm:p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center shadow-lg shadow-primary/25">
                <Gift className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground">{txt.inviteTitle}</h2>
                <p className="text-sm text-muted-foreground">{txt.inviteSubtitle}</p>
              </div>
            </div>
            {vipActive && (
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 gap-1 px-3 py-1">
                <Crown className="w-3.5 h-3.5" /> {txt.vipActive}
              </Badge>
            )}
          </div>

          {/* Referral Code Section */}
          <div className="bg-muted/50 rounded-2xl p-4 mb-5 border border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">{txt.yourCode}</p>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 bg-background rounded-xl px-4 py-3 border border-border">
                <span className="font-mono font-bold text-lg text-primary tracking-wider">{referralCode || "---"}</span>
              </div>
            </div>
            <div className="bg-background/50 rounded-xl px-4 py-2.5 border border-border/50 mb-4">
              <p className="font-mono text-sm text-foreground/80 truncate" dir="ltr">{referralLink || "Loading..."}</p>
            </div>
            
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={handleCopy}
                size="lg"
                className={`h-12 rounded-xl font-semibold text-base transition-all ${
                  copied 
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white" 
                    : "bg-primary hover:bg-primary/90 text-primary-foreground"
                }`}
              >
                {copied ? <Check className="w-5 h-5 mr-2" /> : <Copy className="w-5 h-5 mr-2" />}
                {copied ? txt.copied : txt.copyLink}
              </Button>
              <Button 
                onClick={onShare}
                size="lg"
                variant="outline"
                className="h-12 rounded-xl font-semibold text-base border-2 hover:bg-muted"
              >
                <Share2 className="w-5 h-5 mr-2" /> {txt.share}
              </Button>
            </div>
          </div>

          {/* Progress Section */}
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl p-4 border border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">{txt.yourProgress}</span>
              </div>
              <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                Level {currentLevel} / 3
              </Badge>
            </div>
            
            {/* Progress Bar */}
            <div className="relative h-3 bg-muted rounded-full overflow-hidden mb-3">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="text-muted-foreground">{txt.eligibleFriends}: </span>
                <span className="font-bold text-foreground">{eligibleCount}</span>
                <span className="text-muted-foreground"> / {nextLevelTarget}</span>
              </div>
              {remaining > 0 && currentLevel < 3 && (
                <span className="text-primary font-medium">
                  {remaining} {isAr ? txt.toNextLevel : "more"} {!isAr && txt.toNextLevel} {currentLevel + 1}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How It Works - Horizontal Steps */}
      <Card className="border border-border/50 bg-card shadow-lg">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">{txt.howItWorks}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Share2, title: txt.step1Title, desc: txt.step1Desc, color: "from-blue-500 to-cyan-500" },
              { icon: Users, title: txt.step2Title, desc: txt.step2Desc, color: "from-purple-500 to-pink-500" },
              { icon: Gift, title: txt.step3Title, desc: txt.step3Desc, color: "from-emerald-500 to-teal-500" }
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${step.color} flex-shrink-0`}>
                  <step.icon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground text-sm">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

InviteCard.propTypes = {
  referralLink: PropTypes.string,
  referralCode: PropTypes.string,
  eligibleCount: PropTypes.number,
  nextLevelTarget: PropTypes.number,
  currentLevel: PropTypes.number,
  vipActive: PropTypes.bool,
  onShare: PropTypes.func,
  language: PropTypes.string
};