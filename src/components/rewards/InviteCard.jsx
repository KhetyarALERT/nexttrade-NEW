import React, { useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Check, Share2, Gift, Crown, Sparkles } from "lucide-react";

const t = {
  en: {
    yourLink: "Your Referral Link",
    yourCode: "Code",
    copy: "Copy Link",
    copied: "Copied!",
    share: "Share",
    eligible: "Eligible Referrals",
    toNextLevel: "to Level",
    vipActive: "VIP Active",
    earnPer: "Earn $10 per eligible referral"
  },
  ar: {
    yourLink: "رابط الإحالة الخاص بك",
    yourCode: "الكود",
    copy: "نسخ الرابط",
    copied: "تم النسخ!",
    share: "شارك",
    eligible: "إحالات مؤهلة",
    toNextLevel: "للمستوى",
    vipActive: "VIP نشط",
    earnPer: "اربح $10 لكل إحالة مؤهلة"
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

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success(txt.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  const remaining = Math.max(0, nextLevelTarget - eligibleCount);

  return (
    <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
      
      <CardContent className="relative p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm sm:text-base">{txt.yourLink}</h3>
              <p className="text-white/60 text-xs">{txt.earnPer}</p>
            </div>
          </div>
          {vipActive && (
            <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 gap-1">
              <Crown className="w-3 h-3" /> {txt.vipActive}
            </Badge>
          )}
        </div>

        {/* Referral Link Display */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white/50 text-xs uppercase tracking-wider">{txt.yourCode}:</span>
            <span className="font-mono font-bold text-white text-sm">{referralCode || "---"}</span>
          </div>
          <div className="font-mono text-white/90 text-xs sm:text-sm truncate" dir="ltr">
            {referralLink || "Loading..."}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mb-4">
          <Button 
            onClick={handleCopy}
            className={`flex-1 h-11 rounded-xl font-semibold ${
              copied 
                ? "bg-white text-emerald-700" 
                : "bg-white/20 hover:bg-white/30 text-white border border-white/20"
            }`}
          >
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? txt.copied : txt.copy}
          </Button>
          <Button 
            onClick={onShare}
            className="flex-1 h-11 rounded-xl font-semibold bg-white text-emerald-700 hover:bg-white/90"
          >
            <Share2 className="w-4 h-4 mr-2" /> {txt.share}
          </Button>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-between bg-white/10 backdrop-blur-sm rounded-xl p-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-white/70 text-xs">{txt.eligible}</span>
              <p className="text-white font-bold text-lg">{eligibleCount} <span className="text-white/50 text-sm font-normal">/ {nextLevelTarget}</span></p>
            </div>
          </div>
          {remaining > 0 && currentLevel < 3 && (
            <div className="text-right">
              <span className="text-white/50 text-xs">{remaining} more</span>
              <p className="text-white font-medium text-sm">{txt.toNextLevel} {currentLevel + 1}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
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