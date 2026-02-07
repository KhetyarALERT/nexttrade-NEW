import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Gift, 
  Sparkles, 
  CheckCircle2, 
  Lock,
  ArrowRight
} from "lucide-react";
import UsdtIcon from "@/components/ui/UsdtIcon";
import { cn } from "@/lib/utils";

export default function StakingShowcase({ language = "en" }) {
  const [step, setStep] = useState(0);

  // Simulation steps - keeping simple loop
  const SIMULATION = [
    { type: "plan", isSelected: false },
    { type: "plan", isSelected: true },
    { type: "active", progress: 0 },
    { type: "active", progress: 50 },
    { type: "active", progress: 100 }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev + 1) % SIMULATION.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const current = SIMULATION[step];
  const isPlanView = current.type === "plan";

  const t = {
    en: {
      days: "days",
      bonusRewards: "Bonus Rewards",
      perDollar: "/USDT staked",
      perks: "Perks while active",
      firstStakeBonus: "First stake bonus",
      select: "Select Plan",
      apy: "APY",
      activePosition: "Active Position",
      principal: "Principal",
      accrued: "Accrued Interest",
      status: "Active",
      maturity: "Maturity",
      claim: "Claim Rewards"
    },
    ar: {
      days: "أيام",
      bonusRewards: "مكافآت إضافية",
      perDollar: "/USDT مستثمر",
      perks: "المزايا",
      firstStakeBonus: "مكافأة أول مرة",
      select: "اختر الخطة",
      apy: "العائد",
      activePosition: "صفقة نشطة",
      principal: "رأس المال",
      accrued: "الأرباح المتراكمة",
      status: "نشط",
      maturity: "الاستحقاق",
      claim: "سحب المكافآت"
    }
  };
  const labels = t[language] || t.en;

  if (isPlanView) {
    return (
      <Card className={cn(
        "relative overflow-hidden transition-all duration-300 group h-full border-0 bg-card/50 backdrop-blur-sm",
        current.isSelected 
          ? "ring-2 ring-primary border-primary shadow-xl scale-[1.02]" 
          : "hover:shadow-lg shadow-md"
      )}>
        <CardContent className="p-5 space-y-4">
          {/* Header: Title + APY */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="font-bold text-foreground text-lg tracking-tight">Growth Plus</h3>
              <p className="text-sm text-muted-foreground font-medium">30 {labels.days}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold text-primary tracking-tighter">25%</div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{labels.apy}</p>
            </div>
          </div>

          <div className="h-px bg-border/50" />

          {/* Perks Section - Enhanced visual appeal */}
          <div className="space-y-3">
            {/* First Stake Bonus - Highlighted */}
            <div className="flex items-center gap-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <div className="p-1 bg-amber-500/20 rounded-lg">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-sm text-amber-700 dark:text-amber-400 font-semibold">{labels.firstStakeBonus}</span>
            </div>

            {/* Standard Perks */}
            <div className="space-y-2 pl-1">
              <div className="flex items-center gap-2.5 text-sm font-medium text-foreground/80">
                <CheckCircle2 className="w-4 h-4 text-primary/80" />
                <span>VIP Signal Access</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm font-medium text-foreground/80">
                <Gift className="w-4 h-4 text-primary/80" />
                <span>{labels.bonusRewards} +0.5{labels.perDollar}</span>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <Button 
            variant={current.isSelected ? "default" : "outline"}
            className={cn(
              "w-full mt-2 h-10 font-bold transition-all pointer-events-none rounded-xl",
              current.isSelected ? "shadow-lg shadow-primary/25" : "border-2 bg-transparent"
            )}
          >
            {labels.select}
            {current.isSelected && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Active Position View - Enhanced
  return (
    <Card className="relative overflow-hidden h-full border-primary/20 bg-gradient-to-b from-primary/5 to-transparent backdrop-blur-sm">
      <CardContent className="p-5 space-y-5">
        {/* Active Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">{labels.activePosition}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span className="text-xs font-medium text-primary">{labels.status}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card/50 p-3 rounded-xl border border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-1">{labels.principal}</p>
            <div className="flex items-center gap-1.5">
              <UsdtIcon size="xs" className="opacity-80" />
              <p className="font-mono font-bold text-base">1,000</p>
            </div>
          </div>
          <div className="bg-card/50 p-3 rounded-xl border border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-1">{labels.apy}</p>
            <p className="font-mono font-bold text-base text-primary">25%</p>
          </div>
        </div>

        {/* Progress Section */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-muted-foreground">{labels.maturity}</span>
            <span className="font-mono tabular-nums text-foreground">
              {Math.floor(current.progress * 0.3)} / 30 {labels.days}
            </span>
          </div>
          <div className="h-2.5 bg-secondary rounded-full overflow-hidden p-[2px]">
            <div 
              className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
              style={{ width: `${current.progress}%` }}
            />
          </div>
        </div>

        {/* Rewards Section */}
        <div className={cn(
          "p-4 rounded-xl transition-all duration-500 border",
          current.progress >= 100 
            ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" 
            : "bg-primary/10 border-primary/20"
        )}>
          <div className="flex justify-between items-end">
            <div>
              <p className={cn(
                "text-[10px] uppercase font-bold tracking-wider mb-0.5",
                current.progress >= 100 ? "text-primary-foreground/80" : "text-primary/70"
              )}>
                {labels.accrued}
              </p>
              <p className={cn(
                "font-mono font-extrabold text-xl",
                current.progress >= 100 ? "text-white" : "text-primary"
              )}>
                +{(current.progress * 0.68).toFixed(2)} USDT
              </p>
            </div>
            {current.progress >= 100 && (
              <Button size="sm" variant="secondary" className="h-8 text-xs font-bold shadow-sm pointer-events-none">
                {labels.claim}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}