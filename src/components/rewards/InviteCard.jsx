import React, { useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Check, Share2, Gift, Crown, Users, Sparkles, DollarSign, ArrowRight, Zap, Star } from "lucide-react";

const t = {
  en: {
    heroTitle: "Invite Friends",
    heroHighlight: "Earn $10",
    heroSubtitle: "For every friend who joins & deposits",
    yourCode: "Your Invite Code",
    copyLink: "Copy Link",
    copied: "Copied!",
    share: "Share Now",
    step1: "Share Link",
    step2: "Friend Joins",
    step3: "You Earn $10",
    eligibleFriends: "Eligible Friends",
    toNextLevel: "to Level",
    vipActive: "VIP Active",
    unlimited: "No limit on earnings!",
    instantReward: "Instant voucher reward"
  },
  ar: {
    heroTitle: "ادعُ أصدقاءك",
    heroHighlight: "واربح $10",
    heroSubtitle: "لكل صديق ينضم ويودع",
    yourCode: "كود الدعوة الخاص بك",
    copyLink: "نسخ الرابط",
    copied: "تم النسخ!",
    share: "شارك الآن",
    step1: "شارك الرابط",
    step2: "صديقك ينضم",
    step3: "تربح $10",
    eligibleFriends: "أصدقاء مؤهلون",
    toNextLevel: "للمستوى",
    vipActive: "VIP نشط",
    unlimited: "بدون حد للأرباح!",
    instantReward: "قسيمة فورية"
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
      {/* Hero Invite Card */}
      <div className="relative overflow-hidden rounded-3xl">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%23ffffff\" fill-opacity=\"0.05\"%3E%3Cpath d=\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
        
        {/* Floating Elements */}
        <div className="absolute top-4 right-8 w-20 h-20 bg-white/10 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-8 left-4 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-4 w-16 h-16 bg-yellow-400/20 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="relative p-6 sm:p-8">
          {/* VIP Badge */}
          {vipActive && (
            <div className="absolute top-4 right-4">
              <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 gap-1.5 px-3 py-1.5 shadow-lg">
                <Crown className="w-4 h-4" /> {txt.vipActive}
              </Badge>
            </div>
          )}

          {/* Hero Content */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-4">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span className="text-white/90 text-sm font-medium">{txt.unlimited}</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              {txt.heroTitle}
              <span className="block text-yellow-300 mt-1">{txt.heroHighlight}</span>
            </h1>
            <p className="text-white/80 text-lg">{txt.heroSubtitle}</p>
          </div>

          {/* Steps Flow */}
          <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8">
            {[
              { icon: Share2, label: txt.step1, color: "bg-white/20" },
              { icon: Users, label: txt.step2, color: "bg-white/20" },
              { icon: DollarSign, label: txt.step3, color: "bg-yellow-400 text-yellow-900" }
            ].map((step, i) => (
              <React.Fragment key={i}>
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${step.color} flex items-center justify-center shadow-lg backdrop-blur-sm`}>
                    <step.icon className={`w-6 h-6 ${i === 2 ? "" : "text-white"}`} />
                  </div>
                  <span className="text-white/90 text-xs sm:text-sm font-medium">{step.label}</span>
                </div>
                {i < 2 && (
                  <ArrowRight className="w-5 h-5 text-white/40 mt-[-20px]" />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Referral Code Box */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/70 text-sm font-medium">{txt.yourCode}</span>
              <div className="flex items-center gap-1 text-yellow-300">
                <Zap className="w-4 h-4" />
                <span className="text-xs font-medium">{txt.instantReward}</span>
              </div>
            </div>
            
            {/* Code Display */}
            <div className="bg-white/95 rounded-xl px-4 sm:px-6 py-3 sm:py-4 mb-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-xl sm:text-2xl text-emerald-600 tracking-wider">{referralCode || "---"}</span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <Gift className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="font-mono text-xs sm:text-sm text-gray-500 truncate" dir="ltr">{referralLink || "Loading..."}</p>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={handleCopy}
                size="lg"
                className={`h-12 sm:h-14 rounded-xl font-bold text-base transition-all shadow-lg ${
                  copied 
                    ? "bg-white text-emerald-600" 
                    : "bg-white/20 hover:bg-white/30 text-white border-2 border-white/30 hover:border-white/50"
                }`}
              >
                {copied ? <Check className="w-5 h-5 mr-2" /> : <Copy className="w-5 h-5 mr-2" />}
                {copied ? txt.copied : txt.copyLink}
              </Button>
              <Button 
                onClick={onShare}
                size="lg"
                className="h-12 sm:h-14 rounded-xl font-bold text-base bg-white text-emerald-600 hover:bg-white/90 shadow-lg"
              >
                <Share2 className="w-5 h-5 mr-2" /> {txt.share}
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-5 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-300" />
                <span className="text-white font-semibold">{txt.eligibleFriends}</span>
              </div>
              <Badge variant="outline" className="border-white/30 text-white bg-white/10">
                Level {currentLevel}/3
              </Badge>
            </div>
            
            {/* Progress Bar */}
            <div className="relative h-3 bg-white/20 rounded-full overflow-hidden mb-2">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-yellow-400 to-yellow-300 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
              {/* Glow effect */}
              {progressPercent > 0 && (
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-yellow-400 to-yellow-300 rounded-full blur-sm opacity-50"
                  style={{ width: `${progressPercent}%` }}
                />
              )}
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-white">
                <span className="font-bold text-lg text-yellow-300">{eligibleCount}</span>
                <span className="text-white/70"> / {nextLevelTarget}</span>
              </span>
              {remaining > 0 && currentLevel < 3 && (
                <span className="text-white/80">
                  {remaining} more {txt.toNextLevel} {currentLevel + 1}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
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