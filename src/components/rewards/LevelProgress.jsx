import React from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Lock, Crown, TrendingUp } from "lucide-react";

const LEVELS = [
  { 
    level: 1, 
    count: 5,
    requirement: { en: "5 eligible friends", ar: "5 أصدقاء مؤهلين" },
    deposit: { en: "$100+ each", ar: "$100+ لكل منهم" },
    reward: { en: "Unlock referral rewards", ar: "فتح مكافآت الإحالة" },
    bonus: null
  },
  { 
    level: 2, 
    count: 10,
    requirement: { en: "10 eligible friends", ar: "10 أصدقاء مؤهلين" },
    deposit: { en: "$200+ each", ar: "$200+ لكل منهم" },
    reward: { en: "$50 bonus voucher", ar: "قسيمة مكافأة $50" },
    bonus: 50
  },
  { 
    level: 3, 
    count: 20,
    requirement: { en: "20 eligible friends", ar: "20 صديق مؤهل" },
    deposit: { en: "$200+ each", ar: "$200+ لكل منهم" },
    reward: { en: "$100 bonus + VIP AI", ar: "مكافأة $100 + VIP AI" },
    bonus: 100,
    vip: true
  }
];

const t = {
  en: {
    title: "Reward Levels",
    subtitle: "Unlock bigger rewards as you grow",
    level: "Level",
    current: "Current",
    unlocked: "Unlocked",
    locked: "Locked",
    perFriend: "$10 per eligible friend"
  },
  ar: {
    title: "مستويات المكافآت",
    subtitle: "افتح مكافآت أكبر مع نموك",
    level: "المستوى",
    current: "الحالي",
    unlocked: "مفتوح",
    locked: "مقفل",
    perFriend: "$10 لكل صديق مؤهل"
  }
};

export default function LevelProgress({ 
  currentLevel = 0, 
  activeEligible100 = 0,
  activeEligible200 = 0,
  language = "en" 
}) {
  const txt = t[language] || t.en;

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">{txt.title}</CardTitle>
            <p className="text-xs text-muted-foreground">{txt.subtitle}</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-3">
        {/* Per-friend reward */}
        <div className="text-center py-2 px-4 bg-primary/5 rounded-lg border border-primary/10">
          <span className="text-sm font-medium text-primary">{txt.perFriend}</span>
        </div>

        {/* Levels */}
        {LEVELS.map((levelInfo) => {
          const relevantCount = levelInfo.level === 1 ? activeEligible100 : activeEligible200;
          const isCompleted = currentLevel >= levelInfo.level;
          const isCurrent = currentLevel === levelInfo.level - 1;
          const isLocked = currentLevel < levelInfo.level - 1;
          const progress = Math.min(100, (relevantCount / levelInfo.count) * 100);

          return (
            <div 
              key={levelInfo.level}
              className={`p-4 rounded-xl border transition-all ${
                isCompleted 
                  ? "bg-primary/5 border-primary/20" 
                  : isCurrent
                    ? "bg-card border-primary/30 ring-1 ring-primary/20"
                    : "bg-muted/30 border-border opacity-60"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Level indicator */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isCompleted 
                    ? "bg-primary text-white" 
                    : isCurrent
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}>
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : isLocked ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <span className="font-bold">{levelInfo.level}</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground">{txt.level} {levelInfo.level}</span>
                    {isCompleted && (
                      <Badge variant="secondary" className="text-[10px] h-5 bg-primary/10 text-primary">{txt.unlocked}</Badge>
                    )}
                    {isCurrent && (
                      <Badge variant="outline" className="text-[10px] h-5 border-primary/50 text-primary">{txt.current}</Badge>
                    )}
                    {levelInfo.vip && (
                      <Badge className="text-[10px] h-5 bg-amber-500/20 text-amber-600 border-0">
                        <Crown className="w-3 h-3 mr-0.5" /> VIP
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    {levelInfo.requirement[language]} ({levelInfo.deposit[language]})
                  </p>
                  
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-sm font-medium ${isCompleted ? "text-primary" : "text-foreground"}`}>
                      {levelInfo.bonus ? `+$${levelInfo.bonus} ` : ""}{levelInfo.reward[language]}
                    </span>
                  </div>

                  {/* Progress bar for current level */}
                  {isCurrent && (
                    <div className="mt-3">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {relevantCount}/{levelInfo.count} friends
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
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