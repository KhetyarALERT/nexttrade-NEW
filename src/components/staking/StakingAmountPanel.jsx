import React from "react";
import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Sparkles, ArrowRight, ChevronLeft, ChevronRight, Info } from "lucide-react";
import UsdtIcon from "@/components/ui/UsdtIcon";
// Shared formatters with Latin digits
function getLocale(lang) {
  return lang === "ar" ? "ar-u-nu-latn" : "en-US";
}

function formatUsdt(val, language = "en") {
  if (val === null || val === undefined || !Number.isFinite(val)) return "0.00";
  return new Intl.NumberFormat(getLocale(language), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function formatDate(date, language = "en") {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return "-";
  return new Intl.DateTimeFormat(getLocale(language), { month: "short", day: "numeric", year: "numeric" }).format(dateObj);
}

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
    day: "day",
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
    transferFirst: "Transfer USDT to Trading first",
    useCopyTradingBalance: "Use Copy Trading Balance",
    source: "Funding Source",
    mainBalance: "Main Balance",
    copyTradingBalance: "Copy Trading",
    estMonthlyEarnings: "Est. Monthly Earnings",
    estTotalUnlock: "Est. Total at Unlock",
    paidEvery30: "Paid every 30 days"
  },
  ar: {
    step2Title: "أدخل المبلغ",
    available: "الرصيد المتاح",
    amountLabel: "مبلغ الستيكنج",
    usdt: "USDT",
    max: "الأقصى",
    summary: "الملخص",
    lockPeriod: "فترة القفل",
    days: "أيام",
    day: "يوم",
    unlockDate: "تاريخ الفتح المتوقع",
    apy: "عائد سنوي",
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
    transferFirst: "حوّل USDT إلى حساب التداول أولاً",
    useCopyTradingBalance: "استخدم رصيد نسخ التداول",
    source: "مصدر التمويل",
    mainBalance: "الرصيد الرئيسي",
    copyTradingBalance: "نسخ التداول",
    estMonthlyEarnings: "الأرباح الشهرية المتوقعة",
    estTotalUnlock: "الإجمالي المتوقع عند الفتح",
    paidEvery30: "تدفع كل 30 يوم"
  }
};

// Using shared formatters from components/utils/formatters

export default function StakingAmountPanel({ 
  plan, 
  amount, 
  setAmount, 
  availableBalance, // Main/OKX balance
  copyTradingBalance = 0, // Internal CT balance
  onStake, 
  onBack, 
  processing, 
  isEligibleFirstStake,
  stakingConfig,
  language = "en"
}) {
  const labels = t[language] || t.en;
  const [useCopyTrading, setUseCopyTrading] = React.useState(false);

  if (!plan) return null;

  const activeBalance = useCopyTrading ? copyTradingBalance : availableBalance;
  const amountNum = parseFloat(amount) || 0;
  const isBelowMin = amountNum > 0 && amountNum < plan.minDeposit;
  const isAboveBalance = amountNum > activeBalance;
  const isValidAmount = amountNum >= plan.minDeposit && amountNum <= activeBalance;

  // Calculate bonus rewards
  let baseRewards = amountNum * (plan.baseRewardsPerDollar || 0);
  let firstStakeBonus = 0;
  
  if (isEligibleFirstStake && plan.termDays >= (stakingConfig?.first_stake_min_term_days || 60)) {
    const eligibleAmount = Math.min(amountNum, stakingConfig?.first_stake_cap_principal || 300);
    const bonusMultiplier = (stakingConfig?.first_stake_bonus_multiplier || 1.5) - 1;
    firstStakeBonus = eligibleAmount * (plan.baseRewardsPerDollar || 0) * bonusMultiplier;
  }
  
  const totalRewards = Math.round(baseRewards + firstStakeBonus);
  
  // Calculate estimates
  const estMonthlyEarnings = (amountNum * (plan.apyPercent / 100)) / 12;
  const estTotalAtUnlock = amountNum + (amountNum * (plan.apyPercent / 100) * (plan.termDays / 365));

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
            <p className="text-xs text-muted-foreground">
              {language === "ar" 
                ? `${plan.termDays} ${plan.termDays === 1 ? labels.day : labels.days} • ${labels.apy} ${plan.apyPercent}%`
                : `${plan.termDays} ${plan.termDays === 1 ? labels.day : labels.days} • ${plan.apyPercent}% ${labels.apy}`
              }
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack} className="text-xs text-muted-foreground">
          {labels.change}
        </Button>
      </div>

      {/* Source Selector */}
      <div className="bg-card border border-border rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{labels.source}</span>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${!useCopyTrading ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
              {labels.mainBalance}
            </span>
            <Switch checked={useCopyTrading} onCheckedChange={setUseCopyTrading} />
            <span className={`text-xs ${useCopyTrading ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
              {labels.copyTradingBalance}
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm pt-2 border-t border-border/50">
          <span className="text-muted-foreground">{labels.available}</span>
          <div className="flex items-center gap-1.5">
            <UsdtIcon size="xs" language={language} />
            <span className="font-mono font-semibold transition-all">
              {formatUsdt(activeBalance, language)} USDT
            </span>
          </div>
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
            max={activeBalance}
            className="ltr:pl-12 rtl:pr-12 ltr:pr-16 rtl:pl-16 text-lg font-mono h-12"
          />
          <span className="absolute inset-y-0 ltr:right-3 rtl:left-3 flex items-center text-sm text-muted-foreground font-medium">
            {labels.usdt}
          </span>
        </div>

        {/* Validation messages */}
        {isBelowMin && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            {labels.minRequired}: {plan.minDeposit} USDT
          </p>
        )}
        {isAboveBalance && (
          <div className="flex items-center justify-between text-xs text-red-600">
            <span>{labels.insufficientBalance}</span>
            {useCopyTrading && (
              <a href="/Wallet?page=deposit" className="underline hover:text-red-700">Add funds</a>
            )}
          </div>
        )}
        
        {/* Preset chips */}
        <div className="flex gap-2 flex-wrap">
          {presets.map((preset) => (
            <Button
              key={preset}
              variant={parseFloat(amount) === preset ? "default" : "outline"}
              size="sm"
              onClick={() => setAmount(String(preset))}
              className="text-xs h-9 px-3 min-w-[72px]"
              disabled={preset > activeBalance}
            >
              {preset} USDT
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAmount(String(Math.floor(activeBalance * 100) / 100))}
            className="text-xs h-9 px-3"
            disabled={activeBalance < plan.minDeposit}
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
              <span className="font-medium">{plan.termDays} {plan.termDays === 1 ? labels.day : labels.days}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{labels.unlockDate}</span>
              <span className="font-medium">{formatDate(estUnlockDate, language)}</span>
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

            <div className="pt-2 mt-2 border-t border-border/50 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground block mb-0.5">{labels.estMonthlyEarnings}</span>
                <span className="font-mono font-medium text-emerald-500">
                  ~{formatUsdt(estMonthlyEarnings, language)} USDT
                </span>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground block mb-0.5">{labels.estTotalUnlock}</span>
                <span className="font-mono font-medium">
                  ~{formatUsdt(estTotalAtUnlock, language)} USDT
                </span>
              </div>
            </div>
            
            <div className="flex justify-center pt-1">
              <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Info className="w-3 h-3" /> {labels.paidEvery30}
              </span>
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
          onClick={() => onStake(useCopyTrading ? 'COPY_TRADING' : 'MAIN')} 
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