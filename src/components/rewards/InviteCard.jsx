import React, { useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Check, Share2, Gift, Users, ArrowRight } from "lucide-react";

const t = {
  en: {
    title: "Invite Friends & Earn",
    subtitle: "Get $10 for every friend who joins",
    yourCode: "Your Referral Code",
    copyLink: "Copy Link",
    copied: "Copied!",
    share: "Share",
    step1: "Share your link",
    step2: "Friend signs up & deposits $100+",
    step3: "You earn $10 voucher",
    progress: "Your Progress",
    friends: "friends invited",
    toLevel: "to reach Level"
  },
  ar: {
    title: "ادعُ أصدقاءك واربح",
    subtitle: "احصل على $10 لكل صديق ينضم",
    yourCode: "كود الدعوة الخاص بك",
    copyLink: "نسخ الرابط",
    copied: "تم النسخ!",
    share: "شارك",
    step1: "شارك رابطك",
    step2: "صديقك يسجل ويودع $100+",
    step3: "تحصل على قسيمة $10",
    progress: "تقدمك",
    friends: "صديق مدعو",
    toLevel: "للوصول للمستوى"
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
  const progressPercent = nextLevelTarget > 0 ? Math.min(100, (eligibleCount / nextLevelTarget) * 100) : 0;

  return (
    <Card className="border border-border bg-card overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700/95 via-emerald-600/90 to-teal-600/85 p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">{txt.title}</h2>
              <p className="text-white/80 text-sm">{txt.subtitle}</p>
            </div>
          </div>
          
          {/* Reward highlight */}
          <div className="flex items-center justify-center py-3">
            <span className="text-4xl sm:text-5xl font-bold text-white">$10</span>
            <span className="text-white/80 text-lg ml-2">/ friend</span>
          </div>
        </div>

        {/* Code Section */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Referral Code */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              {txt.yourCode}
            </label>
            <div className="bg-muted/50 border border-border rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xl sm:text-2xl font-bold text-primary tracking-wider">
                  {referralCode || "---"}
                </span>
                <Badge variant="secondary" className="text-xs">
                  Level {currentLevel}
                </Badge>
              </div>
              <p className="font-mono text-xs text-muted-foreground mt-2 truncate" dir="ltr">
                {referralLink || "Loading..."}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              onClick={handleCopy}
              variant={copied ? "default" : "outline"}
              size="lg"
              className="h-12 rounded-xl font-semibold"
            >
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? txt.copied : txt.copyLink}
            </Button>
            <Button 
              onClick={onShare}
              size="lg"
              className="h-12 rounded-xl font-semibold"
            >
              <Share2 className="w-4 h-4 mr-2" /> {txt.share}
            </Button>
          </div>

          {/* Progress */}
          <div className="bg-muted/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">{txt.progress}</span>
              <span className="text-sm text-muted-foreground">
                {eligibleCount}/{nextLevelTarget} {txt.friends}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {remaining > 0 && currentLevel < 3 && (
              <p className="text-xs text-muted-foreground mt-2">
                {remaining} more {txt.toLevel} {currentLevel + 1}
              </p>
            )}
          </div>

          {/* How it works */}
          <div className="pt-2">
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1 flex-1">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</div>
                <span className="text-muted-foreground text-xs">{txt.step1}</span>
              </div>
              <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
              <div className="flex items-center gap-1 flex-1">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</div>
                <span className="text-muted-foreground text-xs">{txt.step2}</span>
              </div>
              <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
              <div className="flex items-center gap-1 flex-1">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">3</div>
                <span className="text-muted-foreground text-xs">{txt.step3}</span>
              </div>
            </div>
          </div>
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