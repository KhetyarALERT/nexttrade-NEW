import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  TrendingUp, 
  Clock, 
  Gift,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

const stakingPlans = [
  { days: 30, apy: 5, label: "30 Days", description: "Flexible staking" },
  { days: 60, apy: 7, label: "60 Days", description: "Standard staking" },
  { days: 90, apy: 10, label: "90 Days", description: "Premium staking" },
  { days: 180, apy: 12, label: "180 Days", description: "Maximum rewards" }
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
    earlyPenalty: "إلغاء مبكر يخسر 50% من الأرباح"
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
    earlyPenalty: "Early unstake loses 50% of rewards"
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
      toast.error("Please fill in all fields");
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
        toast.success(`Staked ${amount} USDT at ${result.data.data.apy}% APY`);
        setStakeOpen(false);
        setStakeAmount("");
        loadPositions();
        if (onRefresh) onRefresh();
      } else {
        toast.error(result.data?.error || "Staking failed");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleUnstake = async (positionId) => {
    if (!confirm("Are you sure? Early unstake will lose 50% of rewards.")) return;

    setProcessing(true);
    try {
      const result = await base44.functions.invoke('wallet', {
        action: 'unstake',
        positionId
      });

      if (result.data?.success) {
        toast.success(`Unstaked! Returned: ${result.data.data.totalReturn.toFixed(2)} USDT`);
        loadPositions();
        if (onRefresh) onRefresh();
      } else {
        toast.error(result.data?.error || "Unstake failed");
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
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <Lock className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <CardTitle className="text-lg">{t.title}</CardTitle>
                <p className="text-xs text-slate-500">Earn up to 12% APY</p>
              </div>
            </div>
            <Button onClick={() => setStakeOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
              <Lock className="w-4 h-4 mr-2" /> {t.stake}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-indigo-50 rounded-lg">
              <p className="text-xs text-indigo-600">Total Staked</p>
              <p className="text-xl font-bold text-indigo-900">${totalStaked.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-green-600">Total Earned</p>
              <p className="text-xl font-bold text-green-900">${totalEarned.toFixed(2)}</p>
            </div>
          </div>

          {/* Active Positions */}
          <h4 className="text-sm font-semibold text-slate-700 mb-3">{t.activeStakes}</h4>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : positions.filter(p => p.status === 'active').length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              {t.noStakes}
            </div>
          ) : (
            <div className="space-y-3">
              {positions.filter(p => p.status === 'active').map((pos) => {
                const progress = calculateProgress(pos.start_date, pos.unlock_date);
                const isUnlocked = progress >= 100;

                return (
                  <div key={pos.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="font-bold text-slate-900">{pos.amount.toFixed(2)} USDT</span>
                        <Badge className="ml-2 bg-indigo-100 text-indigo-700">{pos.apy}% APY</Badge>
                      </div>
                      <Button
                        size="sm"
                        variant={isUnlocked ? "default" : "outline"}
                        onClick={() => handleUnstake(pos.id)}
                        disabled={processing}
                        className={isUnlocked ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        <Unlock className="w-3 h-3 mr-1" /> {t.unstake}
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">{t.progress}</span>
                        <span className="text-slate-700">{progress.toFixed(0)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{t.earned}: <span className="text-green-600 font-medium">${(pos.earned_rewards || 0).toFixed(4)}</span></span>
                        <span>{t.unlockDate}: {formatDate(pos.unlock_date)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stake Dialog */}
      <Dialog open={stakeOpen} onOpenChange={setStakeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.stake} USDT</DialogTitle>
            <DialogDescription>Lock your USDT to earn rewards</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {usdtWallets.length === 0 ? (
              <div className="text-center py-4 text-slate-500">
                No USDT wallets available
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Select Wallet</Label>
                  <Select value={selectedWallet || ""} onValueChange={setSelectedWallet}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose wallet" />
                    </SelectTrigger>
                    <SelectContent>
                      {usdtWallets.map(w => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.currency} ({w.network}) - {(w.balance - (w.locked_balance || 0) - (w.staked_balance || 0)).toFixed(2)} available
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t.amount}</Label>
                  <Input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="100"
                    min="100"
                  />
                  <p className="text-xs text-slate-500">{t.minAmount}</p>
                </div>

                <div className="space-y-2">
                  <Label>{t.period}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {stakingPlans.map(plan => (
                      <button
                        key={plan.days}
                        onClick={() => setLockPeriod(String(plan.days))}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          lockPeriod === String(plan.days)
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <p className="font-bold text-slate-900">{plan.label}</p>
                        <p className="text-sm text-indigo-600">{plan.apy}% APY</p>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedPlan && stakeAmount && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-700">
                      Estimated earnings: <strong>${((parseFloat(stakeAmount) || 0) * selectedPlan.apy / 100 * (selectedPlan.days / 365)).toFixed(2)}</strong> after {selectedPlan.days} days
                    </p>
                  </div>
                )}

                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg text-amber-700 text-xs">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{t.earlyPenalty}</span>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={handleStake}
              disabled={processing || !selectedWallet || !stakeAmount}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              {processing ? "Processing..." : `Stake ${stakeAmount || 0} USDT`}
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