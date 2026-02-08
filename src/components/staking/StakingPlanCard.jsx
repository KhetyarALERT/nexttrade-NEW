import PropTypes from "prop-types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Gift, Info, Sparkles, ChevronRight } from "lucide-react";
import UsdtIcon from "@/components/ui/UsdtIcon";

const t = {
  en: {
    recommended: "Recommended",
    unavailable: "Unavailable",
    days: "days",
    day: "day",
    min: "Min",
    bonusRewards: "Bonus Rewards",
    bonusTooltip: "Benefits are in-app advantages like discounts, priority, and bonuses. Withdrawals work normally and are not affected.",
    perDollar: "/USDT staked",
    perks: "Perks while active",
    viewAllPerks: "View all perks",
    firstStakeBonus: "First stake bonus",
    select: "Select Plan",
    apy: "APY",
    benefitsValue: "Extra benefits up to"
  },
  ar: {
    recommended: "موصى به",
    unavailable: "غير متاح",
    days: "أيام",
    day: "يوم",
    min: "الحد الأدنى",
    bonusRewards: "المكافآت الإضافية",
    bonusTooltip: "المزايا فوائد داخل NextTrade مثل خصومات وأولوية ومكافآت. السحب يعمل بشكل طبيعي ولا يتأثر.",
    perDollar: "/USDT مستثمر",
    perks: "المزايا أثناء النشاط",
    viewAllPerks: "عرض كل المزايا",
    firstStakeBonus: "مكافأة الستيك الأول",
    select: "اختر الخطة",
    apy: "عائد سنوي",
    benefitsValue: "مزايا إضافية حتى"
  }
};

export default function StakingPlanCard({ 
  plan, 
  isSelected, 
  onSelect, 
  isEligibleFirstStake,
  language = "en"
}) {
  const labels = t[language] || t.en;
  const perksToShow = (plan.perks || []).slice(0, 2);
  const hasMorePerks = (plan.perks || []).length > 2;

  const handleSelect = () => {
    if (plan.isEnabled) {
      onSelect(plan);
    }
  };

  return (
    <Card
      className={`relative cursor-pointer transition-all duration-200 overflow-hidden group ${
        isSelected
          ? "ring-2 ring-primary border-primary shadow-lg scale-[1.02]"
          : plan.isEnabled
          ? "hover:border-primary/50 hover:shadow-md"
          : "opacity-60 cursor-not-allowed"
      }`}
      onClick={handleSelect}
    >
      {/* Top badge */}
      {plan.isRecommended && plan.isEnabled && (
        <div className="absolute -top-px inset-x-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary" />
      )}
      
      {plan.isRecommended && (
        <Badge className="absolute top-2 ltr:left-2 rtl:right-2 bg-primary text-primary-foreground text-[10px] px-2 py-0.5">
          {labels.recommended}
        </Badge>
      )}
      
      {!plan.isEnabled && (
        <Badge variant="secondary" className="absolute top-2 ltr:left-2 rtl:right-2 text-[10px] px-2 py-0.5">
          {labels.unavailable}
        </Badge>
      )}

      <CardContent className="p-4 space-y-3">
        {/* Header: Title + APY */}
        <div className="flex items-start justify-between pt-1">
          <div>
            <h3 className="font-semibold text-foreground text-base">{plan.title}</h3>
            <p className="text-xs text-muted-foreground">{plan.termDays} {plan.termDays === 1 ? labels.day : labels.days}</p>
          </div>
          <div className={language === "ar" ? "text-left" : "text-right"}>
            <div className="text-2xl font-bold text-primary">{plan.apyPercent}%</div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{labels.apy}</p>
          </div>
        </div>

        {/* Min deposit with USDT icon */}
        <div className="flex items-center justify-between text-sm py-2 border-y border-border/50">
          <span className="text-muted-foreground">{labels.min}</span>
          <div className="flex items-center gap-1.5">
            <UsdtIcon size="xs" showTooltip language={language} />
            <span className="font-mono font-medium">{plan.minDeposit} USDT</span>
          </div>
        </div>

        {/* Bonus Rewards */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <Gift className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">{labels.bonusRewards}</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[240px] text-xs">
                    <span dangerouslySetInnerHTML={{ __html: labels.bonusTooltip }} />
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="font-medium text-primary">+{plan.baseRewardsPerDollar}{labels.perDollar}</span>
          </div>
          {plan.benefitsCapUsd > 0 && plan.baseRewardsPerDollar > 0 && (
            <div className="text-[11px] text-muted-foreground/80 ltr:pl-5.5 rtl:pr-5.5" style={{ paddingInlineStart: '1.375rem' }}>
              {labels.benefitsValue} <bdi dir="ltr">${plan.benefitsCapUsd}</bdi>
            </div>
          )}
        </div>

        {/* First stake bonus badge */}
        {isEligibleFirstStake && plan.termDays >= 60 && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">{labels.firstStakeBonus}</span>
          </div>
        )}

        {/* Perks */}
        {perksToShow.length > 0 && (
          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-1.5">{labels.perks}</p>
            <div className="space-y-1">
              {perksToShow.map((perk, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-1">{perk}</span>
                </div>
              ))}
              {hasMorePerks && (
                <button 
                  type="button"
                  className="text-xs text-primary hover:underline flex items-center gap-0.5"
                  onClick={(e) => { e.stopPropagation(); }}
                >
                  {labels.viewAllPerks}
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Select CTA (visible on hover or always on mobile) */}
        <Button 
          variant={isSelected ? "default" : "outline"}
          size="sm"
          className={`w-full mt-2 transition-all ${
            isSelected 
              ? "" 
              : "md:opacity-0 md:group-hover:opacity-100"
          }`}
          disabled={!plan.isEnabled}
        >
          {isSelected ? <CheckCircle2 className="w-4 h-4 ltr:mr-1 rtl:ml-1" /> : null}
          {labels.select}
        </Button>
      </CardContent>
    </Card>
  );
}

StakingPlanCard.propTypes = {
  plan: PropTypes.shape({
    key: PropTypes.string,
    title: PropTypes.string,
    termDays: PropTypes.number,
    apyPercent: PropTypes.number,
    minDeposit: PropTypes.number,
    baseRewardsPerDollar: PropTypes.number,
    perks: PropTypes.arrayOf(PropTypes.string),
    isEnabled: PropTypes.bool,
    isRecommended: PropTypes.bool
  }).isRequired,
  isSelected: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  isEligibleFirstStake: PropTypes.bool,
  language: PropTypes.oneOf(["en", "ar"])
};