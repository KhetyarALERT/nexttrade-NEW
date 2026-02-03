import React from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Lock, Crown, Zap, Star, Gift, TrendingUp } from "lucide-react";

const LEVELS = [
  { 
    level: 1, 
    count: 5,
    threshold: 100,
    requirement: { en: "5 eligible friends", ar: "5 أصدقاء مؤهلين" },
    thresholdText: { en: "Each deposits $100+", ar: "كل منهم يودع $100+" },
    reward: { en: "Unlock rewards", ar: "فتح المكافآت" },
    rewardAmount: null,
    color: "from-blue-500 to-cyan-500",
    bgColor: "from-blue-500/10 to-cyan-500/10",
    borderColor: "border-blue-500/30",
    icon: Zap
  },
  { 
    level: 2, 
    count: 10,
    threshold: 200,
    requirement: { en: "10 eligible friends", ar: "10 أصدقاء مؤهلين" },
    thresholdText: { en: "Each deposits $200+", ar: "كل منهم يودع $200+" },
    reward: { en: "Bonus voucher", ar: "قسيمة مكافأة" },
    rewardAmount: 50,
    color: "from-purple-500 to-pink-500",
    bgColor: "from-purple-500/10 to-pink-500/10",
    borderColor: "border-purple-500/30",
    icon: Star
  },
  { 
    level: 3, 
    count: 20,
    threshold: 200,
    requirement: { en: "20 eligible friends", ar: "20 صديق مؤهل" },
    thresholdText: { en: "Each deposits $200+", ar: "كل منهم يودع $200+" },
    reward: { en: "Bonus + VIP AI", ar: "مكافأة + VIP AI" },
    rewardAmount: 100,
    color: "from-amber-500 to-orange-500",
    bgColor: "from-amber-500/10 to-orange-500/10",
    borderColor: "border-amber-500/30",
    icon: Crown,
    vip: true
  }
];

const t = {
  en: {
    title: "Reward Levels",
    subtitle: "Unlock bigger rewards as you invite more friends",
    level: "Level",
    requirements: "Requirements",
    reward: "Reward",
    current: "Current",
    completed: "Unlocked",
    locked: "Locked",
    vipAccess: "VIP AI",
    perFriend: "per eligible friend",
    progress: "Progress",
    friends: "friends"
  },
  ar: {
    title: "مستويات المكافآت",
    subtitle: "افتح مكافآت أكبر بدعوة المزيد من الأصدقاء",
    level: "المستوى",
    requirements: "المتطلبات",
    reward: "المكافأة",
    current: "الحالي",
    completed: "مفتوح",
    locked: "مقفل",
    vipAccess: "VIP AI",
    perFriend: "لكل صديق مؤهل",
    progress: "التقدم",
    friends: "أصدقاء"
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
    <Card className="border border-border/50 bg-card shadow-lg overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-muted/50 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">{txt.title}</CardTitle>
            <p className="text-xs text-muted-foreground">{txt.subtitle}</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 pt-2">
        {/* Per-friend reward highlight */}
        <div className="flex items-center justify-center gap-2 py-3 px-4 mb-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
          <Gift className="w-5 h-5 text-emerald-500" />
          <span className="font-bold text-emerald-600 text-lg">$10</span>
          <span className="text-muted-foreground text-sm">{txt.perFriend}</span>
        </div>

        {/* Level Cards */}
        <div className="space-y-3">
          {LEVELS.map((levelInfo) => {
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
                    ? "border-emerald-500/50 bg-gradient-to-r from-emerald-500/5 to-emerald-500/10" 
                    : isCurrent
                      ? `${levelInfo.borderColor} bg-gradient-to-r ${levelInfo.bgColor}`
                      : "border-border/50 bg-muted/20 opacity-60"
                }`}
              >
                {/* VIP Badge */}
                {levelInfo.vip && isCompleted && vipActive && (
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-amber-500/80 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                    {txt.vipAccess}
                  </div>
                )}
                
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Level Icon */}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                      isCompleted 
                        ? "bg-gradient-to-br from-emerald-500 to-emerald-600" 
                        : `bg-gradient-to-br ${levelInfo.color}`
                    } shadow-lg`}>
                      {isCompleted ? (
                        <Check className="w-7 h-7 text-white" />
                      ) : isLocked ? (
                        <Lock className="w-6 h-6 text-white/70" />
                      ) : (
                        <Icon className="w-7 h-7 text-white" />
                      )}
                    </div>

                    {/* Level Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-foreground">{txt.level} {levelInfo.level}</h4>
                        {isCompleted && (
                          <Badge className="bg-emerald-500 text-white text-[10px] px-2 py-0">
                            {txt.completed}
                          </Badge>
                        )}
                        {isCurrent && (
                          <Badge variant="outline" className={`${levelInfo.borderColor} text-[10px] px-2 py-0`}>
                            {txt.current}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Requirements */}
                      <p className="text-sm text-foreground mb-0.5">{levelInfo.requirement[language]}</p>
                      <p className="text-xs text-muted-foreground mb-2">{levelInfo.thresholdText[language]}</p>
                      
                      {/* Progress Bar for Current Level */}
                      {isCurrent && (
                        <div className="mb-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>{txt.progress}</span>
                            <span>{relevantCount} / {levelInfo.count} {txt.friends}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full bg-gradient-to-r ${levelInfo.color} transition-all duration-500`}
                              style={{ width: `${progressToLevel}%` }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Reward */}
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                        isCompleted 
                          ? "bg-emerald-500/15 text-emerald-600" 
                          : isCurrent 
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}>
                        <Gift className="w-4 h-4" />
                        <span className="font-semibold text-sm">
                          {levelInfo.rewardAmount ? `+$${levelInfo.rewardAmount}` : ''} {levelInfo.reward[language]}
                        </span>
                      </div>
                    </div>
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