import React from "react";
import PropTypes from "prop-types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Lock, Crown, Zap, Star, Gift, TrendingUp, Sparkles, ChevronRight } from "lucide-react";

const LEVELS = [
  { 
    level: 1, 
    count: 5,
    threshold: 100,
    requirement: { en: "5 friends", ar: "5 أصدقاء" },
    thresholdText: { en: "$100+ deposit each", ar: "$100+ لكل منهم" },
    reward: { en: "Unlock rewards", ar: "فتح المكافآت" },
    rewardAmount: null,
    gradient: "from-blue-500 to-cyan-400",
    lightBg: "from-blue-500/5 to-cyan-400/5",
    icon: Zap,
    iconBg: "bg-gradient-to-br from-blue-500 to-cyan-400"
  },
  { 
    level: 2, 
    count: 10,
    threshold: 200,
    requirement: { en: "10 friends", ar: "10 أصدقاء" },
    thresholdText: { en: "$200+ deposit each", ar: "$200+ لكل منهم" },
    reward: { en: "Bonus", ar: "مكافأة" },
    rewardAmount: 50,
    gradient: "from-purple-500 to-pink-400",
    lightBg: "from-purple-500/5 to-pink-400/5",
    icon: Star,
    iconBg: "bg-gradient-to-br from-purple-500 to-pink-400"
  },
  { 
    level: 3, 
    count: 20,
    threshold: 200,
    requirement: { en: "20 friends", ar: "20 صديق" },
    thresholdText: { en: "$200+ deposit each", ar: "$200+ لكل منهم" },
    reward: { en: "Bonus + VIP", ar: "مكافأة + VIP" },
    rewardAmount: 100,
    gradient: "from-amber-500 to-orange-400",
    lightBg: "from-amber-500/5 to-orange-400/5",
    icon: Crown,
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-400",
    vip: true
  }
];

const t = {
  en: {
    title: "Unlock Bigger Rewards",
    subtitle: "Level up by inviting more friends",
    level: "Level",
    current: "You're here",
    completed: "Unlocked",
    locked: "Locked",
    perFriend: "per friend",
    vipAi: "VIP AI Access"
  },
  ar: {
    title: "افتح مكافآت أكبر",
    subtitle: "ارتقِ بدعوة المزيد من الأصدقاء",
    level: "المستوى",
    current: "أنت هنا",
    completed: "مفتوح",
    locked: "مقفل",
    perFriend: "لكل صديق",
    vipAi: "VIP AI"
  }
};

export default function LevelProgress({ 
  currentLevel = 0, 
  activeEligible100 = 0,
  activeEligible200 = 0,
  progressPercent = 0,
  vipActive = false,
  language = "en" 
}) {
  const txt = t[language] || t.en;

  return (
    <Card className="border-0 bg-gradient-to-br from-card via-card to-muted/30 shadow-xl overflow-hidden">
      <CardContent className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center shadow-lg">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">{txt.title}</h3>
            <p className="text-sm text-muted-foreground">{txt.subtitle}</p>
          </div>
        </div>

        {/* $10 per friend highlight */}
        <div className="flex items-center justify-center gap-3 py-4 px-5 mb-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border border-emerald-500/20">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Gift className="w-5 h-5 text-white" />
          </div>
          <div className="text-center">
            <span className="text-2xl font-bold text-emerald-600">$10</span>
            <span className="text-muted-foreground ml-2">{txt.perFriend}</span>
          </div>
          <Sparkles className="w-5 h-5 text-emerald-500" />
        </div>

        {/* Level Cards - Horizontal on mobile, still readable */}
        <div className="space-y-3">
          {LEVELS.map((levelInfo, index) => {
            const relevantCount = levelInfo.threshold >= 200 ? activeEligible200 : activeEligible100;
            const isCompleted = currentLevel >= levelInfo.level;
            const isCurrent = currentLevel === levelInfo.level - 1;
            const isLocked = currentLevel < levelInfo.level - 1;
            const Icon = levelInfo.icon;
            const progressToLevel = Math.min(100, (relevantCount / levelInfo.count) * 100);

            return (
              <div 
                key={levelInfo.level}
                className={`relative rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
                  isCompleted 
                    ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5" 
                    : isCurrent
                      ? `border-transparent bg-gradient-to-r ${levelInfo.lightBg} ring-2 ring-offset-2 ring-offset-background ring-primary/30`
                      : "border-border/30 bg-muted/20"
                } ${isLocked ? "opacity-50" : ""}`}
              >
                {/* Connector Line */}
                {index < LEVELS.length - 1 && (
                  <div className="absolute -bottom-3 left-7 w-0.5 h-6 bg-border/50 z-10 hidden sm:block" />
                )}

                <div className="p-4 flex items-center gap-4">
                  {/* Level Badge */}
                  <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                    isCompleted 
                      ? "bg-gradient-to-br from-emerald-500 to-emerald-600" 
                      : levelInfo.iconBg
                  }`}>
                    {isCompleted ? (
                      <Check className="w-7 h-7 text-white" />
                    ) : isLocked ? (
                      <Lock className="w-6 h-6 text-white/60" />
                    ) : (
                      <Icon className="w-7 h-7 text-white" />
                    )}
                    {/* Level number badge */}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-background border-2 border-border flex items-center justify-center">
                      <span className="text-xs font-bold text-foreground">{levelInfo.level}</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-foreground">{txt.level} {levelInfo.level}</span>
                      {isCompleted && (
                        <Badge className="bg-emerald-500 text-white text-[10px] h-5">{txt.completed}</Badge>
                      )}
                      {isCurrent && (
                        <Badge variant="outline" className="border-primary text-primary text-[10px] h-5 animate-pulse">{txt.current}</Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-1">
                      {levelInfo.requirement[language]} • {levelInfo.thresholdText[language]}
                    </p>
                    
                    {/* Progress for current level */}
                    {isCurrent && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${levelInfo.gradient} transition-all duration-500`}
                            style={{ width: `${progressToLevel}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{relevantCount}/{levelInfo.count} friends</p>
                      </div>
                    )}
                  </div>

                  {/* Reward */}
                  <div className={`text-right flex-shrink-0 px-3 py-2 rounded-xl ${
                    isCompleted ? "bg-emerald-500/10" : isCurrent ? "bg-primary/10" : "bg-muted/50"
                  }`}>
                    {levelInfo.rewardAmount && (
                      <span className={`text-lg font-bold block ${
                        isCompleted ? "text-emerald-600" : isCurrent ? "text-primary" : "text-muted-foreground"
                      }`}>
                        +${levelInfo.rewardAmount}
                      </span>
                    )}
                    <span className={`text-xs ${isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                      {levelInfo.reward[language]}
                    </span>
                    {levelInfo.vip && (
                      <Badge className="mt-1 bg-amber-500/20 text-amber-600 border-0 text-[10px]">
                        <Crown className="w-3 h-3 mr-0.5" /> {txt.vipAi}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

LevelProgress.propTypes = {
  currentLevel: PropTypes.number,
  activeEligible100: PropTypes.number,
  activeEligible200: PropTypes.number,
  progressPercent: PropTypes.number,
  vipActive: PropTypes.bool,
  language: PropTypes.string
};