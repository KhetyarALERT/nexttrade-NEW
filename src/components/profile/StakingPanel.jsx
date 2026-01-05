import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Unlock, 
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

const STAKING_ADDRESS = "TMXcLXQoEipgYhMMfksxgR6hu1DamSP8zd";

const stakingPlans = [
  { days: 30, apy: 29, label: "30D" },
  { days: 45, apy: 73, label: "45D" },
  { days: 60, apy: 150, label: "60D" },
  { days: 90, apy: 220, label: "90D" },
  { days: 120, apy: 350, label: "120D" },
  { days: 365, apy: 999, label: "1Y" }
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
    stakingAddressLabel: "عنوان الاستثمار",
    stakeSuccess: "تم الاستثمار بنجاح",
    unstakeSuccess: "تم إلغاء الاستثمار",
    stakingFailed: "فشل الاستثمار",
    unstakeFailed: "فشل الإلغاء",
    estEarnings: "الأرباح التقديرية"
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
    stakingAddressLabel: "Staking address",
    stakeSuccess: "Staked successfully",
    unstakeSuccess: "Unstaked successfully",
    stakingFailed: "Staking failed",
    unstakeFailed: "Unstake failed",
    estEarnings: "Est. earnings"
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

  const handleUnstake = async (positionId) => {
    if (!confirm(t.confirmUnstake)) return;

    setProcessing(true);
    try {
      const result = await base44.functions.invoke('wallet', {
        action: 'unstake',
        positionId
      });

      if (result.data?.success) {
        toast.success(t.unstakeSuccess);
        loadPositions();
        if (onRefresh) onRefresh();
      } else {
        toast.error(result.data?.error || t.unstakeFailed);
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

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const selectedPlan = stakingPlans.find(p => p.days === parseInt(lockPeriod));
  const totalStaked = positions.filter(p => p.status === 'active').reduce((sum, p) => sum + p.amount, 0);
  const totalEarned = positions.reduce((sum, p) => sum + (p.earned_rewards || 0), 0);

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
                ? "Lock your USDT to earn staking rewards. Funds are returned with rewards at the end of the lock period."
                : "قم بقفل USDT لكسب عوائد الاستثمار. سيتم إرجاع الأموال مع الأرباح عند انتهاء مدة القفل."}
            </p>
            <p className="text-xs">
              {language === "en"
                ? "Early unstaking incurs a 50% penalty on earned rewards."
                : "الإلغاء المبكر يخصم 50% من الأرباح المكتسبة."}
            </p>
            <p className="text-xs text-indigo-600">
              {t.stakingAddressLabel}: {STAKING_ADDRESS}
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
                          {w.currency} ({w.network}) - {(w.balance - (w.locked_balance || 0) - (w.staked_balance || 0)).toFixed(2)} available
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
                        <p className="text-[10px] text-emerald-700">{plan.apy}%</p>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedPlan && stakeAmount && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-sm text-emerald-900">
                      {t.estEarnings}: <strong>${((parseFloat(stakeAmount) || 0) * selectedPlan.apy / 100 * (selectedPlan.days / 365)).toFixed(2)}</strong>
                    </p>
                  </div>
                )}

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