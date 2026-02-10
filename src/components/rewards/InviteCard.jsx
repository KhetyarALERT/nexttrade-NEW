import { useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Check, Share2, Gift, Eye, EyeOff, Shield } from "lucide-react";

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
  const [linkRevealed, setLinkRevealed] = useState(false);

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success(txt.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  const remaining = Math.max(0, nextLevelTarget - eligibleCount);
  const progressPercent = nextLevelTarget > 0 ? Math.min(100, (eligibleCount / nextLevelTarget) * 100) : 0;

  const maskedLink = referralLink ? `${"•".repeat(Math.max(8, Math.min(16, referralLink.length - 8)))}...` : "";
  const displayLink = linkRevealed ? (referralLink || "Loading...") : (maskedLink || "Loading...");

  return (
    <Card className="border border-border/70 bg-card/95 rounded-3xl shadow-md overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#0b1626] via-[#102133] to-[#0e2b2f] px-5 py-6 sm:px-6 sm:py-7 border-b border-white/5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shadow-inner shadow-black/20">
                <Gift className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white">{txt.title}</h2>
                <p className="text-white/75 text-sm leading-relaxed max-w-[260px]">{txt.subtitle}</p>
              </div>
            </div>
            <Badge className="bg-white/12 text-white border-white/20 text-[11px] px-3 py-1 rounded-xl shadow-sm">
              $10 / friend
            </Badge>
          </div>
          
          {/* Reward highlight */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-3">
              <p className="text-white/70 text-[11px] tracking-wide uppercase">{txt.progress}</p>
              <p className="text-white font-semibold text-lg mt-1">{eligibleCount}/{nextLevelTarget} {txt.friends}</p>
              {remaining > 0 && (
                <p className="text-white/60 text-xs">{remaining} {txt.toLevel} {currentLevel + 1}</p>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-3 sm:col-span-2">
              <p className="text-white/70 text-[11px] tracking-wide uppercase">Your reward</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-bold text-white">$10</span>
                <span className="text-white/60 text-sm">per friend</span>
              </div>
            </div>
          </div>
        </div>

        {/* Code & actions */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Referral Code */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <Shield className="w-3 h-3" />
                {txt.yourCode}
              </div>
              <Badge variant="secondary" className="text-[11px] px-2 py-1 rounded-lg">
                Level {currentLevel}
              </Badge>
            </div>

            <div className="bg-muted/20 border border-border/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="font-mono text-xl sm:text-2xl font-bold text-foreground tracking-wider">
                  {referralCode || "---"}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-xs rounded-lg"
                    onClick={() => setLinkRevealed((v) => !v)}
                  >
                    {linkRevealed ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                    {linkRevealed ? (language === "ar" ? "إخفاء" : "Hide link") : (language === "ar" ? "إظهار" : "Reveal link")}
                  </Button>
                  <Button
                    onClick={handleCopy}
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-xs rounded-lg"
                  >
                    {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                    {copied ? txt.copied : txt.copyLink}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-background/70 border border-border/60 rounded-xl px-3 py-2">
                <p className="font-mono text-xs text-muted-foreground flex-1 truncate" dir="ltr">
                  {displayLink}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button 
              onClick={handleCopy}
              variant={copied ? "default" : "outline"}
              size="lg"
              className="h-11 rounded-xl font-semibold"
            >
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? txt.copied : txt.copyLink}
            </Button>
            <Button 
              onClick={onShare}
              size="lg"
              className="h-11 rounded-xl font-semibold"
            >
              <Share2 className="w-4 h-4 mr-2" /> {txt.share}
            </Button>
          </div>

          {/* Progress */}
          <div className="bg-card/90 border border-border/70 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="text-sm font-medium text-foreground">{txt.progress}</span>
              <span className="text-sm text-muted-foreground">
                {eligibleCount}/{nextLevelTarget} {txt.friends}
              </span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden border border-border/60">
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
          <div className="pt-1 space-y-3">
            {[txt.step1, txt.step2, txt.step3].map((step, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/20">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                  {idx + 1}
                </div>
                <span className="text-sm text-foreground flex-1 leading-snug">{step}</span>
              </div>
            ))}
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