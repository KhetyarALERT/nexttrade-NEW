import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { 
  Lock, 
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

// Keep frontend lock periods aligned with backend (functions/wallet.ts)
const stakingPlans = [
  { days: 30, apy: 29, label: "30D" },
  { days: 45, apy: 73, label: "45D" },
  { days: 60, apy: 150, label: "60D" },
  { days: 90, apy: 220, label: "90D" },
  { days: 120, apy: 350, label: "120D" },
  { days: 365, apy: 999, label: "365D" },
];

export default function StakingPanel({ wallets = [], language = "en", onRefresh }) {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stakeOpen, setStakeOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [lockPeriod, setLockPeriod] = useState("30");
  const [processing, setProcessing] = useState(false);

  const t = language === "ar" ? {
    title: "استثمار USDT",
    activeStakes: "الاستثمارات النشطة",
    stake: "استثمر",
    unstake: "إلغاء الاستثمار",
    amount: "المبلغ",
    period: "المدة",
    apy: "العائد السنوي",
    earned: "الأرباح المكتسبة",
    unlockDate: "تاريخ الإلغاء",
    progress: "التقدم",
    noStakes: "لا توجد استثمارات",
    minAmount: "الحد الأدنى 100 USDT",
    earlyPenalty: "إلغاء مبكر يخسر 50% من الأرباح",
    fillAllFields: "يرجى تعبئة جميع الحقول",
    confirmUnstake: "هل أنت متأكد؟ الإلغاء المبكر يخسر 50% من الأرباح.",
    processing: "جارٍ التنفيذ...",
    selectWallet: "اختر المحفظة",
    chooseWallet: "اختر محفظة",
    noWallets: "لا توجد محافظ USDT",
    stakeSuccess: "تم الاستثمار بنجاح",
    unstakeSuccess: "تم إلغاء الاستثمار",
    stakingFailed: "فشل الاستثمار",
    unstakeFailed: "فشل الإلغاء",
    estEarnings: "الأرباح التقديرية",
    profit: "الربح المتوقع",
    totalAtMaturity: "الإجمالي عند الاستحقاق",
    daily: "ربح/يوم",
    available: "المتاح",
  } : {
    title: "USDT Staking",
    activeStakes: "Active Stakes",
    stake: "Stake",
    unstake: "Unstake",
    amount: "Amount",
    period: "Lock Period",
    apy: "APY",
    earned: "Earned",
    unlockDate: "Unlock Date",
    progress: "Progress",
    noStakes: "No active stakes",
    minAmount: "Minimum 100 USDT",
    earlyPenalty: "Early unstake loses 50% of rewards",
    fillAllFields: "Please fill in all fields",
    confirmUnstake: "Are you sure? Early unstake will lose 50% of rewards.",
    processing: "Processing...",
    selectWallet: "Select Wallet",
    chooseWallet: "Choose wallet",
    noWallets: "No USDT wallets available",
    stakeSuccess: "Staked successfully",
    unstakeSuccess: "Unstaked successfully",
    stakingFailed: "Staking failed",
    unstakeFailed: "Unstake failed",
    estEarnings: "Est. earnings",
    profit: "Estimated profit",
    totalAtMaturity: "Total at maturity",
    daily: "Per day",
    available: "available",
  };

  const usdtWallets = wallets.filter(w => w.currency === 'USDT');

  const loadPositions = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('wallet', { action: 'getStakingPositions' });
      if (result.data?.success) {
        setPositions(result.data.data || []);
      }
    } catch (err) {
      console.error("Failed to load staking positions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPositions();
  }, []);

  const handleStake = async () => {
    if (!selectedWallet || !stakeAmount) {
      toast.error(t.fillAllFields);
      return;
    }

    const amount = parseFloat(stakeAmount);
    if (amount < 100) {
      toast.error(t.minAmount);
      return;
    }

    setProcessing(true);
    try {
      const result = await base44.functions.invoke('wallet', {
        action: 'stake',
        walletId: selectedWallet,
        amount,
        lockPeriodDays: parseInt(lockPeriod)
      });

      if (result.data?.success) {
        toast.success(t.stakeSuccess);
        setStakeOpen(false);
        setStakeAmount("");
        loadPositions();
        if (onRefresh) onRefresh();
      } else {
        toast.error(result.data?.error || t.stakingFailed);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const calculateProgress = (startDate, unlockDate) => {
    const start = new Date(startDate).getTime();
    const end = new Date(unlockDate).getTime();
    const now = Date.now();
    return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  };

  const selectedPlan = stakingPlans.find(p => p.days === parseInt(lockPeriod));
  const totalStaked = positions.filter(p => p.status === 'active').reduce((sum, p) => sum + p.amount, 0);
  const totalEarned = positions.reduce((sum, p) => sum + (p.earned_rewards || 0), 0);

  const amountNumber = Math.max(0, parseFloat(stakeAmount) || 0);
  const effectiveApy = selectedPlan ? selectedPlan.apy : 0;
  const estimate = (() => {
    if (!selectedPlan || amountNumber <= 0) return null;
    // Simple estimate based on APY pro-rated by lock period.
    const profit = amountNumber * (effectiveApy / 100) * (selectedPlan.days / 365);
    const total = amountNumber + profit;
    const perDay = profit / selectedPlan.days;
    return {
      profit,
      total,
      perDay,
      apy: effectiveApy,
    };
  })();

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-600" />
            <h3 className="text-slate-900 font-medium">{t.title}</h3>
          </div>
          <Button 
            onClick={() => setStakeOpen(true)} 
            size="sm"
            className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-xs"
          >
            {t.stake}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-[10px] text-slate-500">Staked</p>
            <p className="text-sm font-bold text-slate-900">${totalStaked.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-[10px] text-slate-500">Earned</p>
            <p className="text-sm font-bold text-emerald-700">${totalEarned.toFixed(2)}</p>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-4">
            <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
          </div>
        ) : positions.filter(p => p.status === 'active').length === 0 ? (
          <div className="text-center py-4 text-slate-500 text-xs">
            {t.noStakes}
          </div>
        ) : (
          <div className="space-y-2">
                    {positions.filter(p => p.status === 'active').slice(0, 3).map((pos) => {
              const progress = calculateProgress(pos.start_date, pos.unlock_date);
              return (
                <div key={pos.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-900 text-sm">{pos.amount.toFixed(0)} USDT</span>
                            <span className="text-emerald-700 text-xs">{pos.apy}% APY</span>
                  </div>
                  <Progress value={progress} className="h-1" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stake Dialog */}
      <Dialog open={stakeOpen} onOpenChange={setStakeOpen}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 max-h-[90vh] overflow-y-auto" aria-describedby="stake-description">
          <DialogHeader>
            <DialogTitle className="text-slate-900">{t.stake} USDT</DialogTitle>
          </DialogHeader>
          <div id="stake-description" className="text-slate-600 text-sm space-y-2 pb-4 border-b border-slate-200">
            <p>
              {language === "en"
                ? "Stake from your USDT wallet balance to earn rewards. Funds are returned with rewards at the end of the lock period."
                : "استثمر من رصيد محفظة USDT لكسب عوائد. سيتم إرجاع الأموال مع الأرباح عند انتهاء مدة القفل."}
            </p>
            <p className="text-xs">
              {language === "en"
                ? "Early unstaking incurs a 50% penalty on earned rewards."
                : "الإلغاء المبكر يخصم 50% من الأرباح المكتسبة."}
            </p>
            <p className="text-xs text-slate-500">
              {language === "en"
                ? "This is an internal transfer/lock from your main wallet balance. Wallet deposit addresses (NOWPayments) will be integrated later."
                : "هذا قفل/تحويل داخلي من رصيد محفظتك الرئيسية. سيتم ربط عناوين الإيداع (NOWPayments) لاحقًا."}
            </p>
          </div>

          <div className="space-y-4">
            {usdtWallets.length === 0 ? (
              <div className="text-center py-4 text-slate-500">{t.noWallets}</div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-slate-700">{t.selectWallet}</Label>
                  <Select value={selectedWallet || ""} onValueChange={setSelectedWallet}>
                    <SelectTrigger className="bg-white border-slate-200 text-slate-900">
                      <SelectValue placeholder={t.chooseWallet} />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200">
                      {usdtWallets.map(w => (
                        <SelectItem key={w.id} value={w.id} className="text-slate-900">
                          {w.currency} ({w.network}) - {(w.balance - (w.locked_balance || 0) - (w.staked_balance || 0)).toFixed(2)} {t.available}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700">{t.amount}</Label>
                  <Input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="100"
                    min="100"
                    className="bg-white border-slate-200 text-slate-900"
                  />
                  <p className="text-xs text-slate-500">{t.minAmount}</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700">{t.period}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {stakingPlans.map(plan => (
                      <button
                        key={plan.days}
                        onClick={() => setLockPeriod(String(plan.days))}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          lockPeriod === String(plan.days)
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <p className="font-bold text-slate-900 text-xs">{plan.label}</p>
                        <p className="text-[10px] text-slate-500">{plan.days}D</p>
                        <p className="text-[10px] text-emerald-700">{plan.apy}%</p>
                      </button>
                    ))}
                  </div>
                </div>

                {estimate ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-emerald-900 font-medium">{t.estEarnings}</div>
                      <div className="text-xs text-emerald-700 font-semibold">{estimate.apy}% APY</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-white/60 border border-emerald-200 p-2">
                        <div className="text-[10px] text-emerald-800/80">{t.profit}</div>
                        <div className="text-sm font-bold text-emerald-900">${estimate.profit.toFixed(2)}</div>
                      </div>
                      <div className="rounded-lg bg-white/60 border border-emerald-200 p-2">
                        <div className="text-[10px] text-emerald-800/80">{t.totalAtMaturity}</div>
                        <div className="text-sm font-bold text-emerald-900">${estimate.total.toFixed(2)}</div>
                      </div>
                      <div className="rounded-lg bg-white/60 border border-emerald-200 p-2">
                        <div className="text-[10px] text-emerald-800/80">{t.daily}</div>
                        <div className="text-sm font-bold text-emerald-900">${estimate.perDay.toFixed(4)}</div>
                      </div>
                    </div>
                    <div className="text-[11px] text-emerald-800/80">
                      {language === "ar"
                        ? `القفل: ${selectedPlan.label} • ${selectedPlan.days} يوم`
                        : `Lock: ${selectedPlan.label} • ${selectedPlan.days} days`}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-start gap-2 p-3 bg-amber-100/40 border border-amber-200 rounded-lg text-amber-700 text-xs">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{t.earlyPenalty}</span>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={handleStake}
              disabled={processing || !selectedWallet || !stakeAmount}
              className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
            >
              {processing ? t.processing : `${t.stake} ${stakeAmount || 0} USDT`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

StakingPanel.propTypes = {
  wallets: PropTypes.array,
  language: PropTypes.string,
  onRefresh: PropTypes.func
};