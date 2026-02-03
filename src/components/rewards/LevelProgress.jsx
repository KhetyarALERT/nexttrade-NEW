import React from "react";
import PropTypes from "prop-types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Lock, Crown, Zap, Star, Award } from "lucide-react";

const LEVELS = [
  { 
    level: 1, 
    requirement: { en: "5 eligible referrals", ar: "5 إحالات مؤهلة" },
    threshold: { en: "$100+ deposit each", ar: "$100+ إيداع لكل منهم" },
    reward: { en: "Unlock rewards tier", ar: "فتح مستوى المكافآت" },
    color: "from-blue-500 to-cyan-500",
    icon: Zap
  },
  { 
    level: 2, 
    requirement: { en: "10 eligible referrals", ar: "10 إحالات مؤهلة" },
    threshold: { en: "$200+ deposit each", ar: "$200+ إيداع لكل منهم" },
    reward: { en: "+$50 bonus voucher", ar: "+$50 قسيمة مكافأة" },
    color: "from-purple-500 to-pink-500",
    icon: Star
  },
  { 
    level: 3, 
    requirement: { en: "20 eligible referrals", ar: "20 إحالة مؤهلة" },
    threshold: { en: "$200+ deposit each", ar: "$200+ إيداع لكل منهم" },
    reward: { en: "+$100 bonus + VIP AI", ar: "+$100 مكافأة + VIP AI" },
    color: "from-amber-500 to-orange-500",
    icon: Crown,
    vip: true
  }
];

const t = {
  en: {
    yourProgress: "Your Progress",
    level: "Level",
    requirements: "Requirements",
    reward: "Reward",
    current: "Current",
    completed: "Completed",
    locked: "Locked",
    vipAccess: "VIP AI Access"
  },
  ar: {
    yourProgress: "تقدمك",
    level: "المستوى",
    requirements: "المتطلبات",
    reward: "المكافأة",
    current: "الحالي",
    completed: "مكتمل",
    locked: "مقفل",
    vipAccess: "وصول VIP AI"
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
    <div className="space-y-4">
      {/* Overall Progress Bar */}
      <Card className="border-0 shadow-lg bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">{txt.yourProgress}</span>
            <Badge variant="outline" className="text-xs">
              {txt.level} {currentLevel} / 3
            </Badge>
          </div>
          <Progress value={progressPercent} className="h-2.5 bg-muted" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>L1: {activeEligible100}/5</span>
            <span>L2: {activeEligible200}/10</span>
            <span>L3: {activeEligible200}/20</span>
          </div>
        </CardContent>
      </Card>

      {/* Level Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {LEVELS.map((levelInfo) => {
          const isCompleted = currentLevel >= levelInfo.level;
          const isCurrent = currentLevel === levelInfo.level - 1;
          const isLocked = currentLevel < levelInfo.level - 1;
          const Icon = levelInfo.icon;

          return (
            <Card 
              key={levelInfo.level}
              className={`relative overflow-hidden border-0 transition-all duration-300 ${
                isCompleted 
                  ? "shadow-lg ring-2 ring-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5" 
                  : isCurrent
                    ? "shadow-xl ring-2 ring-primary/30 bg-gradient-to-br from-primary/10 to-primary/5"
                    : "shadow-md bg-card opacity-60"
              }`}
            >
              {levelInfo.vip && isCompleted && vipActive && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-transparent px-3 py-1">
                  <span className="text-[10px] font-bold text-white">{txt.vipAccess}</span>
                </div>
              )}
              
              <CardContent className="p-4">
                {/* Level Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${levelInfo.color}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{txt.level} {levelInfo.level}</span>
                      {isCompleted && (
                        <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0">
                          <Check className="w-3 h-3 mr-0.5" /> {txt.completed}
                        </Badge>
                      )}
                      {isCurrent && (
                        <Badge variant="outline" className="border-primary text-primary text-[10px] px-1.5 py-0">
                          {txt.current}
                        </Badge>
                      )}
                      {isLocked && (
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Requirements */}
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-muted-foreground">{txt.requirements}:</span>
                    <p className={`font-medium ${isLocked ? "text-muted-foreground" : "text-foreground"}`}>
                      {levelInfo.requirement[language]}
                    </p>
                    <p className="text-muted-foreground">{levelInfo.threshold[language]}</p>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <span className="text-muted-foreground">{txt.reward}:</span>
                    <p className={`font-semibold ${
                      isCompleted ? "text-emerald-600" : isCurrent ? "text-primary" : "text-muted-foreground"
                    }`}>
                      {levelInfo.reward[language]}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
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