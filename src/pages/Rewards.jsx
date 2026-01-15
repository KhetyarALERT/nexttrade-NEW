import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Gift, CalendarCheck2, CheckCircle2, Flame, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { POSITION_VOUCHERS } from "@/lib/rewards-config";
import { pickLang } from "@/lib/rewards-config";
import { tRewards } from "@/lib/i18n/rewards";
import { fetchRewardsState, fetchVoucherClaims, claimVoucher as claimVoucherApi } from "@/api/functions";

const STORAGE_KEYS = {
  lastCheckin: "rewards_last_checkin",
  streak: "rewards_streak",
  tasks: "rewards_tasks",
  // legacy fallback only
  voucherClaims: "rewards_voucher_claims_v1",
};


function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function Rewards({ language = "en" }) {
  const t = tRewards(language);

  const [streak, setStreak] = useState(0);
  const [lastCheckin, setLastCheckin] = useState(null);

  const defaultTasks = useMemo(
    () => [
      {
        id: "deposit",
        title: language === "ar" ? "قم بالإيداع لأول مرة" : "Make your first deposit",
        reward: language === "ar" ? "+10 نقاط" : "+10 pts",
      },
      {
        id: "trade",
        title: language === "ar" ? "نفّذ أول صفقة" : "Execute your first trade",
        reward: language === "ar" ? "+20 نقاط" : "+20 pts",
      },
      {
        id: "enable2fa",
        title: language === "ar" ? "فعّل المصادقة الثنائية" : "Enable 2FA",
        reward: language === "ar" ? "+5 نقاط" : "+5 pts",
      },
    ],
    [language]
  );

  const [tasks, setTasks] = useState(defaultTasks.map((tItem) => ({ ...tItem, done: false })));

  const [voucherClaims, setVoucherClaims] = useState({});
  const [eligibility, setEligibility] = useState({});
  const completedTasks = tasks.filter((task) => task.done).length;
  const taskProgress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const voucherGroups = useMemo(() => ([
    {
      id: "welcome",
      title: language === "ar" ? "مكافآت الترحيب" : "Welcome bonuses",
      ids: ["signup", "verify", "first_deposit", "first_stake"],
    },
    {
      id: "performance",
      title: language === "ar" ? "مكافآت الأداء" : "Performance bonuses",
      ids: ["deposit_500", "zero_fee_5"],
    },
  ]), [language]);

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

      // legacy local claims (fallback only)
      const rawClaims = localStorage.getItem(STORAGE_KEYS.voucherClaims);
      if (rawClaims) {
        const parsedClaims = JSON.parse(rawClaims);
        if (parsedClaims && typeof parsedClaims === "object") setVoucherClaims(parsedClaims);
      }
    } catch {
      // ignore storage errors
    }
  }, [defaultTasks]);

  // Prefer Base44-backed claims/eligibility. If permissions are not ready, UI still works.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [claimsRes, stateRes] = await Promise.all([fetchVoucherClaims(), fetchRewardsState()]);
        if (cancelled) return;

        if (claimsRes?.data?.success && Array.isArray(claimsRes.data.data)) {
          const next = {};
          claimsRes.data.data.forEach((c) => {
            if (c?.voucher_id) {
              next[String(c.voucher_id)] = {
                claimedAt: c.claimed_at || c.created_date || new Date().toISOString(),
              };
            }
          });
          setVoucherClaims(next);
        }

        if (stateRes?.data?.success && stateRes.data.data) {
          setEligibility(stateRes.data.data.milestones || {});
        }
      } catch {
        // ignore - likely permissions not configured yet
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const claimVoucher = async (voucherId) => {
    if (!voucherId) return;
    if (voucherClaims?.[voucherId]) return;

    try {
      const res = await claimVoucherApi(voucherId, { source: "rewards_page" });
      if (res?.data?.success) {
        const next = { ...(voucherClaims || {}), [voucherId]: { claimedAt: new Date().toISOString() } };
        persistVoucherClaims(next);
        toast.success(language === "ar" ? "تمت إضافة القسيمة" : "Voucher claimed");
        return;
      }
    } catch {
      // fall back to local below
    }

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
    <div className="min-h-screen bg-background text-foreground pb-20 pt-8" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-foreground">{t.title}</h1>
              <Badge variant="outline" className="border-border text-muted-foreground">
                <Gift className="h-3.5 w-3.5 mr-1" />
                {t.title}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-2">{t.subtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border-border shadow-sm lg:col-span-1 bg-gradient-to-br from-blue-600/10 via-transparent to-purple-600/10">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                {language === "ar" ? "ملخص المكافآت" : "Rewards snapshot"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-600/10 flex items-center justify-center">
                    <Flame className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t.streak}</p>
                    <p className="text-lg font-semibold">{streak}</p>
                  </div>
                </div>
                <Badge variant="outline" className="border-border text-muted-foreground">
                  {checkedInToday ? t.checkedIn : t.checkIn}
                </Badge>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {language === "ar" ? "تقدم المهام" : "Tasks progress"}
                  </span>
                  <span className="text-foreground font-semibold">{taskProgress}%</span>
                </div>
                <Progress value={taskProgress} />
                <div className="text-xs text-muted-foreground">
                  {language === "ar"
                    ? `أكملت ${completedTasks} من ${tasks.length} مهام.`
                    : `You have completed ${completedTasks} of ${tasks.length} tasks.`}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  {language === "ar" ? "نصائح سريعة" : "Quick tips"}
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>{language === "ar" ? "أكمل أول إيداع لفتح قسيمة ترحيبية." : "Make your first deposit to unlock a welcome voucher."}</li>
                  <li>{language === "ar" ? "نفّذ صفقتك الأولى لرفع فرص المكافآت." : "Execute your first trade to boost rewards."}</li>
                  <li>{language === "ar" ? "فعّل 2FA لتعزيز أمان الحساب." : "Enable 2FA to strengthen account security."}</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Daily */}
          <Card className="border-border shadow-sm lg:col-span-1">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarCheck2 className="h-5 w-5 text-blue-600" />
                {t.daily}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{t.streak}</div>
                <div className="text-lg font-bold text-foreground">{streak}</div>
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
              <p className="text-xs text-muted-foreground">
                {language === "ar"
                  ? "سجّل مرة واحدة يوميًا للحفاظ على سلسلة الأيام."
                  : "Check in once per day to maintain your streak."}
              </p>
            </CardContent>
          </Card>

          {/* Tasks */}
          <Card className="border-border shadow-sm lg:col-span-1">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg">{t.tasks}</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => toggleTask(task.id)}
                  className="w-full flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left hover:bg-muted transition-colors"
                >
                  <span className={`text-sm ${task.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {task.title}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-[10px] rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                      {task.reward}
                    </span>
                    <span className={`text-xs font-medium ${task.done ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {task.done ? (language === "ar" ? "تم" : "Done") : (language === "ar" ? "ابدأ" : "Start")}
                    </span>
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Position vouchers */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg flex items-center gap-2">
                <Gift className="h-5 w-5 text-purple-600" />
                {t.vouchersTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <p className="text-xs text-muted-foreground">
                {t.vouchersSubtitle}
              </p>

              <Accordion type="multiple" defaultValue={voucherGroups.map((g) => g.id)} className="space-y-3">
                {voucherGroups.map((group) => (
                  <AccordionItem key={group.id} value={group.id} className="border-border rounded-xl">
                    <AccordionTrigger className="px-3 py-2 text-sm">
                      {group.title}
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 px-3 pb-3">
                      {POSITION_VOUCHERS.milestones.filter((v) => group.ids.includes(v.id)).map((v) => {
                        const claimed = Boolean(voucherClaims?.[v.id]);
                        const eligible = v.id === "signup" ? true : Boolean(eligibility?.[v.id]);
                        const disabled = claimed || !eligible;
                        return (
                          <div key={v.id} className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-500/10 dark:to-blue-500/10 rounded-lg border border-border">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                              <Gift className="h-6 w-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <p className="font-bold text-foreground">{pickLang(language, v.title)}</p>
                              <p className="text-xs text-muted-foreground">{pickLang(language, v.condition)}</p>
                              <Badge variant="secondary" className="mt-2 text-[10px]">
                                {pickLang(language, v.reward)}
                              </Badge>
                              {v.expiry ? (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {language === "ar" ? "ينتهي:" : "Expires:"} {v.expiry}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={claimed ? "bg-slate-500" : eligible ? (v.status === "New" ? "bg-green-500" : "bg-blue-500") : "bg-slate-400"}>
                                {claimed ? t.claimed : eligible ? (v.status || t.eligible) : t.notEligible}
                              </Badge>
                              <Button
                                size="sm"
                                variant={claimed ? "outline" : "default"}
                                className={claimed ? "" : "bg-blue-600 hover:bg-blue-700"}
                                disabled={disabled}
                                onClick={() => claimVoucher(v.id)}
                              >
                                {claimed ? (
                                  <span className="inline-flex items-center gap-1">
                                    <CheckCircle2 className="h-4 w-4" />
                                    {t.claimed}
                                  </span>
                                ) : t.claim}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
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
