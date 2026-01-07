import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Gift, CalendarCheck2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const STORAGE_KEYS = {
  lastCheckin: "rewards_last_checkin",
  streak: "rewards_streak",
  tasks: "rewards_tasks",
  voucherClaims: "rewards_voucher_claims_v1",
};

// Rewards should be issued as position vouchers (UI only for now).
// These are intentionally simple and beginner-friendly.
export const POSITION_VOUCHERS = {
  milestones: [
    {
      id: "signup",
      title: "Welcome Position Voucher",
      condition: "Sign up",
      reward: "Position voucher (starter)",
      status: "New",
    },
    {
      id: "verify",
      title: "Verified Account Voucher",
      condition: "Verify account",
      reward: "Position voucher (boost)",
      status: "New",
    },
    {
      id: "first_deposit",
      title: "Deposit Voucher",
      condition: "Make your first deposit",
      reward: "Position voucher (boost)",
      status: "New",
    },
    {
      id: "first_stake",
      title: "First Stake Voucher",
      condition: "Stake any amount",
      reward: "Position voucher (boost)",
      status: "New",
    },
    {
      id: "deposit_500",
      title: "$50 Trading Bonus",
      condition: "Min. deposit $500",
      reward: "Position voucher",
      expiry: "2026-02-15",
      status: "Active",
    },
    {
      id: "zero_fee_5",
      title: "Zero Fee Trade",
      condition: "Valid for 5 trades",
      reward: "Position voucher",
      expiry: "2026-01-30",
      status: "New",
    },
  ],
  stakeTiers: {
    amounts: [100, 200, 500, 1000, 2500, 5000, 10000],
    durations: [7, 30, 90],
    // Scalable reward percentages by staking duration.
    // (Example values requested: 10%, 14%, 25%)
    percentByDuration: {
      7: 10,
      30: 14,
      90: 25,
    },
  },
};

// Dashboard uses a compact list.
export const DASHBOARD_VOUCHERS = POSITION_VOUCHERS.milestones.slice(-2);

const translations = {
  en: {
    title: "Rewards",
    subtitle: "Earn more with daily check-in and tasks",
    daily: "Daily Check-In",
    checkIn: "Check in",
    checkedIn: "Checked in",
    streak: "Streak",
    tasks: "Tasks",
  },
  ar: {
    title: "المكافآت",
    subtitle: "اكسب أكثر عبر تسجيل الدخول اليومي والمهام",
    daily: "تسجيل يومي",
    checkIn: "سجّل الآن",
    checkedIn: "تم التسجيل",
    streak: "سلسلة الأيام",
    tasks: "المهام",
  },
};

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function Rewards({ language = "en" }) {
  const t = translations[language] || translations.en;

  const [streak, setStreak] = useState(0);
  const [lastCheckin, setLastCheckin] = useState(null);

  const defaultTasks = useMemo(
    () => [
      { id: "deposit", title: language === "ar" ? "قم بالإيداع لأول مرة" : "Make your first deposit" },
      { id: "trade", title: language === "ar" ? "نفّذ أول صفقة" : "Execute your first trade" },
      { id: "enable2fa", title: language === "ar" ? "فعّل المصادقة الثنائية" : "Enable 2FA" },
    ],
    [language]
  );

  const [tasks, setTasks] = useState(defaultTasks.map((tItem) => ({ ...tItem, done: false })));

  const [voucherClaims, setVoucherClaims] = useState({});

  useEffect(() => {
    try {
      const storedStreak = parseInt(localStorage.getItem(STORAGE_KEYS.streak) || "0", 10);
      const storedLast = localStorage.getItem(STORAGE_KEYS.lastCheckin);
      const storedTasks = localStorage.getItem(STORAGE_KEYS.tasks);

      setStreak(Number.isFinite(storedStreak) ? storedStreak : 0);
      setLastCheckin(storedLast ? new Date(storedLast) : null);

      if (storedTasks) {
        const parsed = JSON.parse(storedTasks);
        if (Array.isArray(parsed)) {
          setTasks(
            defaultTasks.map((task) => {
              const saved = parsed.find((p) => p?.id === task.id);
              return { ...task, done: Boolean(saved?.done) };
            })
          );
        }
      }

      const rawClaims = localStorage.getItem(STORAGE_KEYS.voucherClaims);
      if (rawClaims) {
        const parsedClaims = JSON.parse(rawClaims);
        if (parsedClaims && typeof parsedClaims === "object") setVoucherClaims(parsedClaims);
      }
    } catch {
      // ignore storage errors
    }
  }, [defaultTasks]);

  const checkedInToday = lastCheckin ? isSameDay(lastCheckin, new Date()) : false;

  const persist = useCallback(
    (nextStreak, nextLast, nextTasks) => {
      try {
        localStorage.setItem(STORAGE_KEYS.streak, String(nextStreak));
        localStorage.setItem(STORAGE_KEYS.lastCheckin, nextLast ? nextLast.toISOString() : "");
        localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(nextTasks));
      } catch {
        // ignore
      }
    },
    []
  );

  const persistVoucherClaims = useCallback((nextClaims) => {
    setVoucherClaims(nextClaims);
    try {
      localStorage.setItem(STORAGE_KEYS.voucherClaims, JSON.stringify(nextClaims));
    } catch {
      // ignore
    }
  }, []);

  const claimVoucher = (voucherId) => {
    if (!voucherId) return;
    if (voucherClaims?.[voucherId]) return;
    const next = { ...(voucherClaims || {}), [voucherId]: { claimedAt: new Date().toISOString() } };
    persistVoucherClaims(next);
    toast.success(language === "ar" ? "تمت إضافة القسيمة" : "Voucher claimed");
  };

  const handleCheckIn = () => {
    const now = new Date();
    if (checkedInToday) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const nextStreak = lastCheckin && isSameDay(lastCheckin, yesterday) ? streak + 1 : 1;
    setStreak(nextStreak);
    setLastCheckin(now);

    persist(nextStreak, now, tasks);
    toast.success(language === "ar" ? "تم تسجيل اليوم" : "Checked in for today");
  };

  const toggleTask = (taskId) => {
    const nextTasks = tasks.map((task) =>
      task.id === taskId ? { ...task, done: !task.done } : task
    );
    setTasks(nextTasks);
    persist(streak, lastCheckin, nextTasks);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-20 pt-8" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-slate-900">{t.title}</h1>
              <Badge variant="outline" className="border-slate-200 text-slate-700">
                <Gift className="h-3.5 w-3.5 mr-1" />
                {t.title}
              </Badge>
            </div>
            <p className="text-slate-600 mt-2">{t.subtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarCheck2 className="h-5 w-5 text-blue-600" />
                {t.daily}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">{t.streak}</div>
                <div className="text-lg font-bold text-slate-900">{streak}</div>
              </div>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={handleCheckIn}
                disabled={checkedInToday}
              >
                {checkedInToday ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {t.checkedIn}
                  </>
                ) : (
                  t.checkIn
                )}
              </Button>
              <p className="text-xs text-slate-500">
                {language === "ar"
                  ? "سجّل مرة واحدة يوميًا للحفاظ على سلسلة الأيام."
                  : "Check in once per day to maintain your streak."}
              </p>
            </CardContent>
          </Card>

          {/* Tasks */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg">{t.tasks}</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => toggleTask(task.id)}
                  className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className={`text-sm ${task.done ? "text-slate-500 line-through" : "text-slate-900"}`}>
                    {task.title}
                  </span>
                  <span className={`text-xs font-medium ${task.done ? "text-emerald-700" : "text-slate-500"}`}>
                    {task.done ? (language === "ar" ? "تم" : "Done") : (language === "ar" ? "ابدأ" : "Start")}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Position vouchers */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <Gift className="h-5 w-5 text-purple-600" />
                {language === "ar" ? "قسائم المراكز" : "Position Vouchers"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <p className="text-xs text-slate-500">
                {language === "ar"
                  ? "هذه المكافآت تُمنح على شكل قسائم للمراكز (واجهة فقط حالياً)."
                  : "Rewards are issued as position vouchers (UI-only for now)."}
              </p>

              {POSITION_VOUCHERS.milestones.map((v) => {
                const claimed = Boolean(voucherClaims?.[v.id]);
                return (
                  <div key={v.id} className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                      <Gift className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-900">{v.title}</p>
                      <p className="text-xs text-slate-500">{v.condition}</p>
                      {v.expiry ? (
                        <p className="text-xs text-slate-400 mt-1">
                          {language === "ar" ? "ينتهي:" : "Expires:"} {v.expiry}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={claimed ? "bg-slate-500" : v.status === "New" ? "bg-green-500" : "bg-blue-500"}>
                        {claimed ? (language === "ar" ? "مُطالَب" : "Claimed") : v.status}
                      </Badge>
                      <Button
                        size="sm"
                        variant={claimed ? "outline" : "default"}
                        className={claimed ? "" : "bg-blue-600 hover:bg-blue-700"}
                        disabled={claimed}
                        onClick={() => claimVoucher(v.id)}
                      >
                        {claimed ? (language === "ar" ? "تم" : "Done") : (language === "ar" ? "مطالبة" : "Claim")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Stake rewards tiers */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg">
                {language === "ar" ? "مكافآت الرهن (قسائم المراكز)" : "Staking Rewards (Position Vouchers)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-xs text-slate-500 mb-4">
                {language === "ar"
                  ? "اختر مبلغ الرهن ومدة الرهن للحصول على نسبة مكافأة كقسيمة مركز."
                  : "Pick a stake amount and duration to receive a reward % as a position voucher."}
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-xs text-slate-500">
                      <th className="text-left py-2 pr-4">{language === "ar" ? "المبلغ (USDT)" : "Amount (USDT)"}</th>
                      {POSITION_VOUCHERS.stakeTiers.durations.map((d) => (
                        <th key={d} className="text-right py-2 pl-4 whitespace-nowrap">{d}d</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {POSITION_VOUCHERS.stakeTiers.amounts.map((amt) => (
                      <tr key={amt}>
                        <td className="py-2 pr-4 font-semibold text-slate-900">{amt.toLocaleString()}</td>
                        {POSITION_VOUCHERS.stakeTiers.durations.map((d) => {
                          const pct = POSITION_VOUCHERS.stakeTiers.percentByDuration[d];
                          return (
                            <td key={d} className="py-2 pl-4 text-right font-mono text-slate-700">
                              {Number.isFinite(Number(pct)) ? `${pct}%` : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-4 text-xs text-slate-500">
                {language === "ar"
                  ? "ملاحظة: النسب قابلة للتغيير وستتم مزامنتها مع النظام لاحقاً."
                  : "Note: Percentages may change and will be wired to backend later."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

Rewards.propTypes = {
  language: PropTypes.oneOf(["en", "ar"]),
};
