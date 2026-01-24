import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import UsdtIcon from "@/components/ui/UsdtIcon";

const t = {
  en: {
    step2Title: "Enter Amount",
    available: "Available Balance",
    amountLabel: "Stake Amount",
    usdt: "USDT",
    max: "Max",
    summary: "Summary",
    lockPeriod: "Lock Period",
    days: "days",
    unlockDate: "Est. Unlock",
    apy: "APY",
    bonusRewards: "Bonus Rewards",
    firstStakeBonusIncl: "incl. first stake bonus",
    statusAfterSubmit: "Status after submit",
    pendingApproval: "Pending Approval",
    back: "Back",
    stakeNow: "Stake Now",
    processing: "Processing...",
    minRequired: "Minimum required",
    insufficientBalance: "Insufficient balance",
    change: "Change",
    transferFirst: "Transfer USDT to Trading first"
  },
  ar: {
    step2Title: "أدخل المبلغ",
    available: "الرصيد المتاح",
    amountLabel: "مبلغ الستيكنج",
    usdt: "USDT",
    max: "الحد الأقصى",
    summary: "الملخص",
    lockPeriod: "فترة القفل",
    days: "يوم",
    unlockDate: "تاريخ الفتح المتوقع",
    apy: "APY",
    bonusRewards: "المكافآت الإضافية",
    firstStakeBonusIncl: "شامل مكافأة الستيك الأول",
    statusAfterSubmit: "الحالة بعد الإرسال",
    pendingApproval: "بانتظار الموافقة",
    back: "رجوع",
    stakeNow: "استثمر الآن",
    processing: "جارٍ المعالجة...",
    minRequired: "الحد الأدنى المطلوب",
    insufficientBalance: "رصيد غير كافي",
    change: "تغيير",
    transferFirst: "حوّل USDT إلى حساب التداول أولاً"
  }
};

function formatDate(date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function StakingAmountPanel({ 
  plan, 
  amount, 
  setAmount, 
  availableBalance, 
  onStake, 
  onBack, 
  processing, 
  isEligibleFirstStake,
  stakingConfig,
  language = "en"
}) {
  const labels = t[language] || t.en;

  if (!plan) return null;

  const amountNum = parseFloat(amount) || 0;
  const isBelowMin = amountNum > 0 && amountNum < plan.minDeposit;
  const isAboveBalance = amountNum > availableBalance;
  const isValidAmount = amountNum >= plan.minDeposit && amountNum <= availableBalance;

  // Calculate bonus rewards
  let baseRewards = amountNum * (plan.baseRewardsPerDollar || 0);
  let firstStakeBonus = 0;
  
  if (isEligibleFirstStake && plan.termDays >= (stakingConfig?.first_stake_min_term_days || 60)) {
    const eligibleAmount = Math.min(amountNum, stakingConfig?.first_stake_cap_principal || 300);
    const bonusMultiplier = (stakingConfig?.first_stake_bonus_multiplier || 1.5) - 1;
    firstStakeBonus = eligibleAmount * (plan.baseRewardsPerDollar || 0) * bonusMultiplier;
  }
  
  const totalRewards = Math.round(baseRewards + firstStakeBonus);

  // Estimated unlock date
  const estUnlockDate = new Date();
  estUnlockDate.setDate(estUnlockDate.getDate() + plan.termDays + 1);

  const presets = [50, 100, 250, 500];

  const BackIcon = language === "ar" ? ChevronRight : ChevronLeft;

  return (
    <div className="space-y-4">
      {/* Selected Plan Summary */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
        <div className="flex items-center gap-3">
          <UsdtIcon size="md" language={language} />
          <div>
            <p className="font-semibold text-foreground">{plan.title}</p>
            <p className="text-xs text-muted-foreground">{plan.termDays} {labels.days} • {plan.apyPercent}% APY</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack} className="text-xs text-muted-foreground">
          {labels.change}
        </Button>
      </div>

      {/* Available Balance */}
      <div className="flex items-center justify-between text-sm px-1">
        <span className="text-muted-foreground">{labels.available}</span>
        <div className="flex items-center gap-1.5">
          <UsdtIcon size="xs" language={language} />
          <span className="font-mono font-semibold">
            {availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Amount Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">{labels.amountLabel}</label>
        <div className="relative">
          <div className="absolute inset-y-0 ltr:left-3 rtl:right-3 flex items-center pointer-events-none">
            <UsdtIcon size="sm" language={language} />
          </div>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(plan.minDeposit)}
            min={plan.minDeposit}
            max={availableBalance}
            className="ltr:pl-12 rtl:pr-12 ltr:pr-16 rtl:pl-16 text-lg font-mono h-12"
          />
          <span className="absolute inset-y-0 ltr:right-3 rtl:left-3 flex items-center text-sm text-muted-foreground font-medium">
            {labels.usdt}
          </span>
        </div>

        {/* Validation messages */}
        {isBelowMin && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            {labels.minRequired}: ${plan.minDeposit}
          </p>
        )}
        {isAboveBalance && (
          <p className="text-xs text-red-600">
            {labels.insufficientBalance}
          </p>
        )}
        
        {/* Preset chips */}
        <div className="flex gap-2 flex-wrap">
          {presets.map((preset) => (
            <Button
              key={preset}
              variant={parseFloat(amount) === preset ? "default" : "outline"}
              size="sm"
              onClick={() => setAmount(String(preset))}
              className="text-xs h-8 px-3"
              disabled={preset > availableBalance}
            >
              ${preset}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAmount(String(Math.floor(availableBalance * 100) / 100))}
            className="text-xs h-8 px-3"
            disabled={availableBalance < plan.minDeposit}
          >
            {labels.max}
          </Button>
        </div>
      </div>

      {/* Summary Box */}
      {amountNum >= plan.minDeposit && (
        <div className="p-4 border border-border rounded-xl space-y-3 bg-card">
          <p className="text-sm font-semibold text-foreground">{labels.summary}</p>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{labels.lockPeriod}</span>
              <span className="font-medium">{plan.termDays} {labels.days}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{labels.unlockDate}</span>
              <span className="font-medium">{formatDate(estUnlockDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{labels.apy}</span>
              <span className="font-semibold text-primary">{plan.apyPercent}%</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground">{labels.bonusRewards}</span>
              <div className="text-right">
                <span className="font-semibold text-primary">+{totalRewards}</span>
                {firstStakeBonus > 0 && (
                  <p className="text-[10px] text-amber-600 flex items-center gap-0.5 justify-end">
                    <Sparkles className="w-3 h-3" />
                    {labels.firstStakeBonusIncl}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-muted-foreground">{labels.statusAfterSubmit}</span>
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                {labels.pendingApproval}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* CTA Buttons */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} disabled={processing} className="flex-1 h-11">
          <BackIcon className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
          {labels.back}
        </Button>
        <Button 
          onClick={onStake} 
          disabled={processing || !isValidAmount}
          className="flex-1 h-11"
        >
          {processing ? (
            <>
              <Loader2 className="w-4 h-4 ltr:mr-2 rtl:ml-2 animate-spin" />
              {labels.processing}
            </>
          ) : (
            <>
              {labels.stakeNow}
              <ArrowRight className="w-4 h-4 ltr:ml-2 rtl:mr-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

StakingAmountPanel.propTypes = {
  plan: PropTypes.object,
  amount: PropTypes.string,
  setAmount: PropTypes.func.isRequired,
  availableBalance: PropTypes.number,
  onStake: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  processing: PropTypes.bool,
  isEligibleFirstStake: PropTypes.bool,
  stakingConfig: PropTypes.object,
  language: PropTypes.oneOf(["en", "ar"])
};