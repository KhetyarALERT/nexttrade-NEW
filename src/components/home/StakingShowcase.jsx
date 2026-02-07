import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Gift, 
  Info, 
  Sparkles, 
  CheckCircle2, 
  ChevronRight,
  Wallet,
  Lock,
  ArrowRight
} from "lucide-react";
import UsdtIcon from "@/components/ui/UsdtIcon";
import { cn } from "@/lib/utils";

export default function StakingShowcase({ language = "en" }) {
  const [step, setStep] = useState(0);

  // Simulation steps
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
      recommended: "Recommended",
      days: "days",
      bonusRewards: "Bonus Rewards",
      perDollar: "/USDT staked",
      perks: "Perks while active",
      viewAllPerks: "View all perks",
      firstStakeBonus: "First stake bonus",
      select: "Select Plan",
      apy: "APY",
      min: "Min",
      activePosition: "Active Position",
      principal: "Principal",
      accrued: "Accrued Interest",
      term: "30 Days",
      status: "Active",
      maturity: "Maturity",
      claim: "Claim Rewards"
    },
    ar: {
      recommended: "موصى به",
      days: "أيام",
      bonusRewards: "مكافآت إضافية",
      perDollar: "/USDT مستثمر",
      perks: "المزايا",
      viewAllPerks: "عرض الكل",
      firstStakeBonus: "مكافأة أول مرة",
      select: "اختر الخطة",
      apy: "العائد",
      min: "الحد الأدنى",
      activePosition: "صفقة نشطة",
      principal: "رأس المال",
      accrued: "الأرباح المتراكمة",
      term: "30 يوم",
      status: "نشط",
      maturity: "الاستحقاق",
      claim: "سحب المكافآت"
    }
  };
  const labels = t[language] || t.en;

  if (isPlanView) {
    return (
      <Card className={cn(
        "relative overflow-hidden transition-all duration-300 group h-full",
        current.isSelected 
          ? "ring-2 ring-primary border-primary shadow-xl scale-[1.02]" 
          : "hover:border-primary/50 hover:shadow-md"
      )}>
        {/* Recommended Badge */}
        <div className="absolute -top-px inset-x-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary" />
        <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] px-2 py-0.5">
          {labels.recommended}
        </Badge>

        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between pt-1">
            <div>
              <h3 className="font-semibold text-foreground text-base">Growth Plus</h3>
              <p className="text-xs text-muted-foreground">30 {labels.days}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">25%</div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{labels.apy}</p>
            </div>
          </div>

          {/* Min Deposit */}
          <div className="flex items-center justify-between text-sm py-2 border-y border-border/50">
            <span className="text-muted-foreground">{labels.min}</span>
            <div className="flex items-center gap-1.5">
              <UsdtIcon size="xs" />
              <span className="font-mono font-medium">1,000 USDT</span>
            </div>
          </div>

          {/* Bonus */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <Gift className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">{labels.bonusRewards}</span>
            </div>
            <span className="font-medium text-primary">+0.5{labels.perDollar}</span>
          </div>

          {/* First Stake Bonus */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">{labels.firstStakeBonus}</span>
          </div>

          {/* Perks */}
          <div className="pt-1 space-y-1">
            <p className="text-xs text-muted-foreground mb-1">{labels.perks}</p>
            <div className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
              <span>VIP Signal Access</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
              <span>Fee Discounts</span>
            </div>
          </div>

          {/* CTA */}
          <Button 
            variant={current.isSelected ? "default" : "outline"}
            size="sm"
            className="w-full mt-2 transition-all pointer-events-none"
          >
            {current.isSelected && <CheckCircle2 className="w-4 h-4 mr-1" />}
            {labels.select}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Active Position View
  return (
    <Card className="relative overflow-hidden h-full border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-primary/20">
            <Lock className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{labels.activePosition}</h3>
            <p className="text-[10px] text-primary">{labels.status}: Active</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-background/50 p-2 rounded-lg">
            <p className="text-[10px] text-muted-foreground">{labels.principal}</p>
            <p className="font-mono font-bold text-sm">1,000 USDT</p>
          </div>
          <div className="bg-background/50 p-2 rounded-lg">
            <p className="text-[10px] text-muted-foreground">{labels.apy}</p>
            <p className="font-mono font-bold text-sm text-primary">25%</p>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{labels.maturity}</span>
            <span className="font-mono">Day {Math.floor(current.progress * 0.3)} / 30</span>
          </div>
          <div className="h-2 bg-background/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-1000 ease-out" 
              style={{ width: `${current.progress}%` }}
            />
          </div>
        </div>

        <div className="bg-primary/10 p-3 rounded-lg border border-primary/20">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] text-primary/80 uppercase">{labels.accrued}</p>
              <p className="font-mono font-bold text-lg text-primary">
                +{(current.progress * 0.68).toFixed(2)} USDT
              </p>
            </div>
            {current.progress >= 100 && (
              <Button size="sm" className="h-7 text-xs animate-pulse pointer-events-none">
                {labels.claim}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}