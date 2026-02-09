import React from "react";
import PropTypes from "prop-types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Lock, Crown, ChevronRight } from "lucide-react";

const t = {
  en: {
    howItWorks: "How You Earn",
    step1: "Share your invite link",
    step2: "Friend signs up & deposits",
    step3: "You get $10 voucher",
    levels: "Bonus Levels",
    level: "Level",
    current: "Current",
    unlocked: "Unlocked",
    friends: "friends",
    deposit: "deposit",
    each: "each",
    bonus: "Bonus",
    vipAccess: "VIP Access",
    yourProgress: "Your Progress"
  },
  ar: {
    howItWorks: "كيف تربح",
    step1: "شارك رابط الدعوة",
    step2: "صديقك يسجل ويودع",
    step3: "تحصل على قسيمة $10",
    levels: "مستويات المكافآت",
    level: "المستوى",
    current: "الحالي",
    unlocked: "مفتوح",
    friends: "صديق",
    deposit: "إيداع",
    each: "لكل صديق",
    bonus: "مكافأة",
    vipAccess: "VIP",
    yourProgress: "تقدمك"
  }
};

const LEVELS = [
  { level: 1, friends: 5, minDeposit: 100, bonus: null },
  { level: 2, friends: 10, minDeposit: 200, bonus: 50 },
  { level: 3, friends: 20, minDeposit: 200, bonus: 100, vip: true }
];

export default function LevelProgress({ 
  currentLevel = 0, 
  activeEligible100 = 0,
  activeEligible200 = 0,
  language = "en" 
}) {
  const txt = t[language] || t.en;

  return (
    <div className="space-y-4">
      {/* How It Works - Simple 3 Steps */}
      <Card className="border border-border/70 bg-card/95 rounded-2xl shadow-sm">
        <CardContent className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{txt.howItWorks}</h3>
          {[
            { num: 1, text: txt.step1 },
            { num: 2, text: txt.step2 },
            { num: 3, text: txt.step3, highlight: true }
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shadow-sm ${
                step.highlight ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {step.num}
              </div>
              <span className={`text-sm ${step.highlight ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                {step.text}
              </span>
              {step.highlight && (
                <Badge className="ml-auto bg-primary/12 text-primary border-primary/20 rounded-md">$10</Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Bonus Levels */}
      <Card className="border border-border/70 bg-card/95 rounded-2xl shadow-sm">
        <CardContent className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{txt.levels}</h3>
          {LEVELS.map((lvl) => {
            const relevantCount = lvl.level === 1 ? activeEligible100 : activeEligible200;
            const isCompleted = currentLevel >= lvl.level;
            const isCurrent = currentLevel === lvl.level - 1;
            const isLocked = currentLevel < lvl.level - 1;
            const progress = Math.min(100, (relevantCount / lvl.friends) * 100);

            return (
              <div 
                key={lvl.level}
                className={`p-4 rounded-xl border transition-colors ${
                  isCompleted 
                    ? "bg-primary/6 border-primary/25" 
                    : isCurrent
                      ? "bg-muted/20 border-primary/25 ring-1 ring-primary/15"
                      : "bg-muted/10 border-border/60"
                }`}
              >
                  {/* Level Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-sm ${
                        isCompleted ? "bg-primary text-primary-foreground" : 
                        isCurrent ? "bg-primary/15 text-primary" : 
                        "bg-muted text-muted-foreground"
                      }`}>
                        {isCompleted ? <Check className="w-4 h-4" /> : 
                         isLocked ? <Lock className="w-3 h-3" /> : 
                         <span className="text-sm font-bold">{lvl.level}</span>}
                      </div>
                      <span className="font-semibold text-foreground">{txt.level} {lvl.level}</span>
                      {isCurrent && (
                        <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">{txt.current}</Badge>
                      )}
                      {isCompleted && (
                        <Badge className="text-[10px] bg-primary/10 text-primary border-0">{txt.unlocked}</Badge>
                      )}
                    </div>
                    
                    {/* Reward */}
                    <div className="text-right">
                      {lvl.bonus && (
                        <span className={`text-lg font-bold ${isCompleted || isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                          +${lvl.bonus}
                        </span>
                      )}
                      {lvl.vip && (
                        <Badge className="ml-2 bg-amber-500/16 text-amber-600 border-0 text-[10px] rounded-md">
                          <Crown className="w-3 h-3 mr-0.5" /> {txt.vipAccess}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Requirements - Clean List */}
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ChevronRight className="w-3 h-3" />
                      <span>{lvl.friends} {txt.friends}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ChevronRight className="w-3 h-3" />
                      <span>${lvl.minDeposit}+ {txt.deposit} {txt.each}</span>
                    </div>
                  </div>

                  {/* Progress for current level */}
                  {isCurrent && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                        <span>{txt.yourProgress}</span>
                        <span className="font-medium">{relevantCount}/{lvl.friends}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden border border-border/50">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
            );
          })}
        </CardContent>
      </Card>
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