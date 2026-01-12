import { useMemo, useState, useEffect } from "react";
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
  DialogFooter } from
"@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import {
  Lock,
  RefreshCw,
  AlertTriangle } from
"lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

// Keep frontend lock periods aligned with backend (functions/wallet.ts)
const stakingPlans = [
  { days: 14, apy: 18, label: "2W", helper: "14D" },
  { days: 30, apy: 28, label: "1M", helper: "30D" },
  { days: 49, apy: 40, label: "7W", helper: "49D", highlight: "200%" },
  { days: 75, apy: 58, label: "2.5M", helper: "75D" },
  { days: 120, apy: 75, label: "4M", helper: "120D" },
];

const MIN_STAKE_USDT = 50;
const MIN_LOCK_DAYS = 14;
const DEMO_TIMER_STORAGE_KEY = "stakingDemoUnlockAt";

function fmtMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "--";
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateTime(dt, language) {
  try {
    const d = dt instanceof Date ? dt : new Date(dt);
    return d.toLocaleString(language === "ar" ? "ar" : undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "--";
  }
}

export default function StakingPanel({ wallets = [], language = "en", onRefresh }) {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stakeOpen, setStakeOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [lockPeriod, setLockPeriod] = useState(String(MIN_LOCK_DAYS));
  const [processing, setProcessing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [demoUnlockAt, setDemoUnlockAt] = useState(null);
  const [demoEnabled, setDemoEnabled] = useState(false);

  const t = language === "ar" ? {
    title: "استثمار USDT",
    activeStakes: "الاستثمارات النشطة",
    stake: "اشتراك",
    stakeNow: "اشتراك",
    unstake: "إلغاء الاستثمار",
    amount: "المبلغ",
    period: "المدة",
    apy: "العائد السنوي",
    earned: "الأرباح المكتسبة",
    unlockDate: "تاريخ الإلغاء",
    progress: "التقدم",
    noStakes: "لا توجد استثمارات",
    minAmount: `الحد الأدنى ${MIN_STAKE_USDT} USDT`,
    minPeriod: `الحد الأدنى لمدة القفل ${MIN_LOCK_DAYS} يوم`,
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
    available: "المتاح",
    percent: "نسبة",
    estRewards: "الأرباح التقديرية",
    estTotal: "الإجمالي عند الاستحقاق",
    estDaily: "ربح/يوم",
    stakedLabel: "مستثمر",
    earnedLabel: "الأرباح",
    countdownTitle: "العد التنازلي لفك القفل",
    timeToUnlock: "باقي حتى فك القفل",
    timerStarts: "يبدأ فور الاشتراك (وضع العرض)",
    demoTimer: "إعادة ضبط مؤقت العرض",
    timelineTitle: "الجدول الزمني",
    tSubscribe: "وقت الاشتراك",
    tStart: "بدء احتساب الأرباح",
    tUnlock: "تاريخ فك القفل",
    tReturn: "استرداد تلقائي إلى الرصيد الفوري",
    internalNote: "الاستثمار يتم من رصيد محفظتك الداخلية (لا يحتاج عنوان إيداع)."
  } : {
    title: "USDT Staking",
    activeStakes: "Active Stakes",
    stake: "Subscribe",
    stakeNow: "Stake now",
    unstake: "Unstake",
    amount: "Amount",
    period: "Lock Period",
    apy: "APY",
    earned: "Earned",
    unlockDate: "Unlock Date",
    progress: "Progress",
    noStakes: "No active stakes",
    minAmount: `Minimum ${MIN_STAKE_USDT} USDT`,
    minPeriod: `Minimum lock period is ${MIN_LOCK_DAYS} days`,
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
    available: "available",
    percent: "Percent",
    estRewards: "Est. rewards",
    estTotal: "Total at maturity",
    estDaily: "Per day",
    stakedLabel: "Staked",
    earnedLabel: "Earned",
    countdownTitle: "Countdown to unlock",
    timeToUnlock: "Time to unlock",
    timerStarts: "Starts immediately after you subscribe (demo)",
    demoTimer: "Reset demo timer",
    timelineTitle: "Timeline",
    tSubscribe: "Subscription time",
    tStart: "Rewards start",
    tUnlock: "Unlock date",
    tReturn: "Auto return to spot balance",
    internalNote: "This stakes from your internal wallet balance (no deposit address needed)."
  };

  const usdtWallets = wallets.filter((w) => w.currency === 'USDT');

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(DEMO_TIMER_STORAGE_KEY);
    if (stored) {
      const parsed = Number(stored);
      if (Number.isFinite(parsed)) setDemoUnlockAt(parsed);
    }
    setDemoEnabled(import.meta.env?.DEV || window.localStorage.getItem("stakingAdmin") === "true");
  }, []);

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

  // Auto-select the only USDT wallet to keep it beginner-friendly.
  useEffect(() => {
    if (selectedWallet) return;
    if (usdtWallets.length === 1) setSelectedWallet(usdtWallets[0].id);
  }, [usdtWallets, selectedWallet]);

  const handleStake = async () => {
    if (!selectedWallet || !stakeAmount) {
      toast.error(t.fillAllFields);
      return;
    }

    const amount = parseFloat(stakeAmount);
    if (amount < MIN_STAKE_USDT) {
      toast.error(t.minAmount);
      return;
    }

    const lockDays = parseInt(lockPeriod);
    if (!Number.isFinite(lockDays) || lockDays < MIN_LOCK_DAYS) {
      toast.error(t.minPeriod);
      return;
    }

    if (demoEnabled) startDemoTimer();
    setProcessing(true);
    try {
      const result = await base44.functions.invoke('wallet', {
        action: 'stake',
        walletId: selectedWallet,
        amount,
        lockPeriodDays: lockDays
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

  const startDemoTimer = () => {
    const lockDays = parseInt(lockPeriod);
    if (!Number.isFinite(lockDays)) return;
    const unlockAt = Date.now() + lockDays * 24 * 60 * 60 * 1000;
    setDemoUnlockAt(unlockAt);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEMO_TIMER_STORAGE_KEY, String(unlockAt));
    }
  };

  const calculateProgress = (startDate, unlockDate) => {
    const start = new Date(startDate).getTime();
    const end = new Date(unlockDate).getTime();
    const now = Date.now();
    return Math.min(100, Math.max(0, (now - start) / (end - start) * 100));
  };

  const selectedPlan = stakingPlans.find((p) => p.days === parseInt(lockPeriod));
  const totalStaked = positions.filter((p) => p.status === 'active').reduce((sum, p) => sum + p.amount, 0);
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
      apy: effectiveApy
    };
  })();

  const selectedWalletObj = usdtWallets.find((w) => w.id === selectedWallet) || null;
  const available = selectedWalletObj ?
  Number(selectedWalletObj.balance - (selectedWalletObj.locked_balance || 0)) :
  0;

  const activePositions = positions.filter((p) => p.status === "active");

  const nextUnlock = useMemo(() => {
    const unlockTimes = activePositions.map((p) => new Date(p.unlock_date).getTime()).filter(Number.isFinite);
    if (demoUnlockAt) unlockTimes.push(demoUnlockAt);
    if (!unlockTimes.length) return null;
    return Math.min(...unlockTimes);
  }, [activePositions, demoUnlockAt]);

  const formatCountdown = (targetMs) => {
    if (!targetMs) return "--";
    const diff = Math.max(0, targetMs - now);
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  };

  const countdownLabel = nextUnlock ? formatCountdown(nextUnlock) : null;

  const setPercentAmount = (pct) => {
    const a = Number(available);
    if (!Number.isFinite(a) || a <= 0) return;
    const v = a * pct / 100;
    setStakeAmount(String(Math.max(0, Math.floor(v * 100) / 100)));
  };

  const timeline = (() => {
    const nowD = new Date();
    const lockDays = parseInt(lockPeriod);
    const start = new Date(nowD.getTime() + 60 * 1000); // ~1 min after subscribe
    const unlock = new Date(nowD.getTime() + lockDays * 24 * 60 * 60 * 1000);
    const ret = new Date(unlock.getTime() + 24 * 60 * 60 * 1000);
    return {
      subscribeAt: nowD,
      startAt: start,
      unlockAt: unlock,
      returnAt: ret
    };
  })();

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-4 text-foreground">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-foreground font-medium">{t.title}</h3>
          </div>
          <Button
            onClick={() => setStakeOpen(true)}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-xs">

            {t.stakeNow}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-muted border border-border rounded-xl">
            <p className="text-[10px] text-muted-foreground">{t.stakedLabel}</p>
            <p className="text-sm font-bold text-foreground">{fmtMoney(totalStaked)} USDT</p>
          </div>
          <div className="p-3 bg-muted border border-border rounded-xl">
            <p className="text-[10px] text-muted-foreground">{t.earnedLabel}</p>
            <p className="text-green-600 text-sm font-bold">{fmtMoney(totalEarned)} USDT</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-muted px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
          <span>{t.countdownTitle}</span>
          <span className="font-mono text-foreground">{countdownLabel || "--"}</span>
        </div>
        
        {loading ?
        <div className="flex justify-center py-4">
            <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
          </div> :
        activePositions.length === 0 ?
        <div className="bg-transparent text-muted-foreground py-4 text-xs text-center">
            {t.noStakes}
          </div> :

        <div className="space-y-2">
                    {activePositions.slice(0, 3).map((pos) => {
            const progress = calculateProgress(pos.start_date, pos.unlock_date);
            return (
              <div key={pos.id} className="p-3 bg-muted border border-border rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-foreground text-sm">{Number(pos.amount).toFixed(0)} USDT</span>
                            <span className="text-emerald-300 text-xs">{pos.apy}% APY</span>
                  </div>
                  <Progress value={progress} className="h-1" />
                  <div className="text-[10px] text-muted-foreground mt-2">
                    {t.timeToUnlock}:{" "}
                    <span className="font-mono text-foreground">{formatCountdown(new Date(pos.unlock_date).getTime())}</span>
                  </div>
                </div>);

          })}
          </div>
        }
      </div>

      {/* Stake Dialog */}
      <Dialog open={stakeOpen} onOpenChange={setStakeOpen}>
        <DialogContent
          className="sm:max-w-lg bg-background border-border text-foreground max-h-[90vh] overflow-y-auto"
          aria-describedby="stake-description"
          dir={language === "ar" ? "rtl" : "ltr"}>

          <DialogHeader>
            <DialogTitle className="text-foreground">
              USDT · {selectedPlan?.label || `${lockPeriod}D`}
            </DialogTitle>
          </DialogHeader>
          <div id="stake-description" className="text-muted-foreground text-sm space-y-2 pb-4 border-b border-border">
            <p className="text-[13px] text-foreground/90">{t.internalNote}</p>
            <p className="text-xs text-muted-foreground">{t.minAmount} • {t.minPeriod} • {t.earlyPenalty}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted-foreground">{t.timerStarts}</span>
              {demoEnabled ? (
                <button
                  type="button"
                  onClick={startDemoTimer}
                  className="text-[11px] text-blue-500 hover:text-blue-400 underline"
                >
                  {t.demoTimer}
                </button>
              ) : null}
            </div>
            {demoUnlockAt ? (
              <div className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground font-mono">
                {formatCountdown(demoUnlockAt)}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            {usdtWallets.length === 0 ?
            <div className="text-center py-4 text-muted-foreground">{t.noWallets}</div> :

            <>
                <div className="space-y-2">
                  <Label className="text-foreground">{t.selectWallet}</Label>
                  <Select value={selectedWallet || ""} onValueChange={setSelectedWallet}>
                    <SelectTrigger className="bg-muted border-border text-foreground">
                      <SelectValue placeholder={t.chooseWallet} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {usdtWallets.map((w) =>
                    <SelectItem key={w.id} value={w.id}>
                          {w.currency} ({w.network}) - {fmtMoney(w.balance - (w.locked_balance || 0))} {t.available}
                        </SelectItem>
                    )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-foreground">{t.amount}</Label>
                    <div className="text-xs text-muted-foreground">
                      {language === "ar" ? "المتاح" : "Available"}: <span className="font-mono text-foreground">{fmtMoney(available)} USDT</span>
                    </div>
                  </div>

                  <div className="relative">
                    <Input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder={String(MIN_STAKE_USDT)}
                    min={String(MIN_STAKE_USDT)}
                    className="bg-muted border-border text-foreground pr-16 font-mono" />

                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">USDT</div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[100, 75, 50, 25].map((p) =>
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPercentAmount(p)}
                    className="h-9 rounded-lg border border-border bg-muted text-foreground text-xs hover:bg-muted/80 transition-colors">

                        {p}%
                      </button>
                  )}
                  </div>

                  <p className="text-xs text-muted-foreground">{t.minAmount}</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">{t.period}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {stakingPlans.map((plan) =>
                  <button
                    key={plan.days}
                    onClick={() => setLockPeriod(String(plan.days))}
                    className={`p-2 rounded-lg border text-center transition-all ${
                    lockPeriod === String(plan.days) ?
                    'border-blue-500/60 bg-blue-600/10' :
                    'border-border hover:bg-muted/80 bg-muted'}`
                    }>

                        <p className="font-bold text-foreground text-xs">{plan.label}</p>
                        <p className="text-[10px] text-muted-foreground">{plan.helper}</p>
                        <p className="text-[10px] text-emerald-300">{plan.apy}%</p>
                        {plan.highlight ? (
                          <span className="mt-1 inline-flex items-center justify-center rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[9px] px-1.5 py-0.5">
                            {plan.highlight}
                          </span>
                        ) : null}
                      </button>
                  )}
                  </div>
                </div>

                {estimate ?
              <div className="p-3 bg-slate-900/40 border border-slate-800/50 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-300 font-medium">{t.estRewards}</div>
                      <div className="text-xs text-emerald-300 font-semibold">{estimate.apy}% APY</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-slate-900/30 border border-slate-800/50 p-2">
                        <div className="text-[10px] text-slate-500">{t.estRewards}</div>
                        <div className="text-sm font-bold text-slate-100 font-mono">{fmtMoney(estimate.profit)} USDT</div>
                      </div>
                      <div className="rounded-lg bg-slate-900/30 border border-slate-800/50 p-2">
                        <div className="text-[10px] text-slate-500">{t.estTotal}</div>
                        <div className="text-sm font-bold text-slate-100 font-mono">{fmtMoney(estimate.total)} USDT</div>
                      </div>
                      <div className="rounded-lg bg-slate-900/30 border border-slate-800/50 p-2">
                        <div className="text-[10px] text-slate-500">{t.estDaily}</div>
                        <div className="text-sm font-bold text-slate-100 font-mono">{fmtMoney(estimate.perDay)} USDT</div>
                      </div>
                    </div>
                  </div> :
              null}

                <div className="bg-indigo-950 p-3 rounded-xl border border-slate-800/50">
                  <div className="text-xs text-slate-300 font-medium mb-2">{t.timelineTitle}</div>
                  <div className="space-y-3 text-xs">
                    {[{
                    k: "sub",
                    label: t.tSubscribe,
                    date: timeline.subscribeAt,
                    active: true
                  }, {
                    k: "start",
                    label: t.tStart,
                    date: timeline.startAt
                  }, {
                    k: "unlock",
                    label: t.tUnlock,
                    date: timeline.unlockAt
                  }, {
                    k: "return",
                    label: t.tReturn,
                    date: timeline.returnAt
                  }].map((it, idx) =>
                  <div key={it.k} className="flex items-start gap-3">
                        <div className="mt-1 flex flex-col items-center">
                          <div className={`h-2.5 w-2.5 rounded-full ${it.active ? "bg-blue-500" : "bg-slate-600"}`} />
                          {idx < 3 ? <div className="w-px h-6 bg-slate-800" /> : null}
                        </div>
                        <div className="flex-1">
                          <div className="text-slate-50">{it.label}</div>
                          <div className="text-slate-500 font-mono">{fmtDateTime(it.date, language)}</div>
                        </div>
                      </div>
                  )}
                  </div>
                </div>

                <div className="bg-amber-500/10 text-slate-950 p-3 text-xs rounded-lg flex items-start gap-2 border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{t.earlyPenalty}</span>
                </div>
              </>
            }
          </div>

          <DialogFooter>
            <Button
              onClick={handleStake}
              disabled={processing || !selectedWallet || !stakeAmount}
              className="w-full bg-blue-600 hover:bg-blue-700">

              {processing ? t.processing : `${t.stake} ${stakeAmount || 0} USDT`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>);

}

StakingPanel.propTypes = {
  wallets: PropTypes.array,
  language: PropTypes.string,
  onRefresh: PropTypes.func
};
