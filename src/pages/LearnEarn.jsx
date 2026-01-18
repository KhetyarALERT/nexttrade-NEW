import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, CheckCircle2, GraduationCap, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "learn_earn_progress_v1";

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export default function LearnEarn({ language = "en" }) {
  const t = useMemo(() => {
    const en = {
      title: "Learn & Earn",
      subtitle: "Short lessons + quick checks. Learn safely and earn points as you go.",
      points: "Points",
      pointsHelp: "Complete lessons and quizzes to earn points and unlock rewards.",
      yourProgress: "Your progress",
      start: "Start",
      continue: "Continue",
      completeLesson: "Mark lesson as done",
      takeQuiz: "Take quick quiz",
      passed: "Passed",
      notYet: "Not yet",
      courseComplete: "Course completed",
      earned: "You earned",
      pts: "pts",
      disclaimer: "Educational content only. Points are demo rewards and may change.",
      lessonsComplete: "Lessons completed",
      courses: {
        basics: {
          title: "Getting Started",
          desc: "Wallets, networks, and how to avoid common beginner mistakes.",
          lessons: [
            "Wallets: hot vs cold (and what you actually need)",
            "Networks & memos: how people lose funds",
            "Spot vs Futures: the one-sentence difference",
            "Fees, spread, and slippage (why price can differ)",
          ],
          quiz: {
            q: "A seed phrase should be shared with:",
            a: ["No one", "Customer support", "A friend"],
            correct: 0,
          },
        },
        security: {
          title: "Security",
          desc: "Protect your account with habits that actually work.",
          lessons: [
            "2FA: authenticator vs SMS (what to use)",
            "Phishing basics: how to spot fake links",
            "Device hygiene: updates, passwords, and backups",
            "Withdrawals: whitelists and test transactions",
          ],
          quiz: {
            q: "The safest way to enable 2FA is:",
            a: ["SMS only", "Authenticator app", "Email codes"],
            correct: 1,
          },
        },
        risk: {
          title: "Futures 101",
          desc: "Leverage, liquidation, and how to size positions without panic.",
          lessons: [
            "Leverage: what it changes (and what it doesn't)",
            "Liquidation: why it happens",
            "TP/SL: how to plan before entering",
            "Position sizing: risk per trade",
          ],
          quiz: {
            q: "Higher leverage generally means:",
            a: ["Lower risk", "Higher risk", "No change"],
            correct: 1,
          },
        },
        earn: {
          title: "Staking & Earning",
          desc: "Understand staking, lockups, and rewards in plain language.",
          lessons: [
            "Staking vs holding: what's the difference?",
            "Lockup periods and what 'APR' actually means",
            "Risks: smart contract risk & platform risk",
          ],
          quiz: {
            q: "APR usually means:",
            a: ["Guaranteed profit", "A yearly rate estimate", "No risk"],
            correct: 1,
          },
        },
      },
    };

    const ar = {
      title: "تعلّم واربح",
      subtitle: "دروس قصيرة + اختبارات سريعة. تعلّم بأمان واكسب نقاطًا أثناء التقدّم.",
      points: "النقاط",
      pointsHelp: "أكمل الدروس والاختبارات لكسب النقاط وفتح المكافآت.",
      yourProgress: "تقدّمك",
      start: "ابدأ",
      continue: "تابع",
      completeLesson: "وضع علامة تم على الدرس",
      takeQuiz: "اختبار سريع",
      passed: "ناجح",
      notYet: "ليس بعد",
      courseComplete: "تم إكمال المسار",
      earned: "لقد ربحت",
      pts: "نقطة",
      disclaimer: "محتوى تعليمي فقط. النقاط تجريبية وقد تتغيّر.",
      lessonsComplete: "الدروس المكتملة",
      courses: {
        basics: {
          title: "البدء من الصفر",
          desc: "المحافظ، الشبكات، وتجنّب أخطاء المبتدئين الشائعة.",
          lessons: [
            "المحافظ: ساخنة مقابل باردة (ماذا تحتاج فعلاً)",
            "الشبكات والميمو: كيف يضيع الناس أموالهم",
            "سبوت مقابل العقود: الفرق بجملة واحدة",
            "الرسوم والسبريد والانزلاق السعري",
          ],
          quiz: {
            q: "يجب مشاركة عبارة الاستعادة (Seed Phrase) مع:",
            a: ["لا أحد", "الدعم الفني", "صديق"],
            correct: 0,
          },
        },
        security: {
          title: "الأمان",
          desc: "احمِ حسابك بعادات عملية وسهلة.",
          lessons: [
            "2FA: تطبيق المصادقة مقابل الرسائل",
            "التصيّد: كيف تميّز الروابط المزيفة",
            "أمان الجهاز: تحديثات وكلمات مرور ونسخ احتياطية",
            "السحب: قائمة العناوين وتحويلة اختبار",
          ],
          quiz: {
            q: "أفضل طريقة لتفعيل 2FA هي:",
            a: ["SMS فقط", "تطبيق المصادقة", "رموز البريد"],
            correct: 1,
          },
        },
        risk: {
          title: "العقود للمبتدئين",
          desc: "الرافعة والتصفية وكيف تحدد حجم صفقة بهدوء.",
          lessons: [
            "الرافعة: ماذا تغيّر؟",
            "التصفية: لماذا تحدث؟",
            "TP/SL: خطّط قبل الدخول",
            "حجم الصفقة: نسبة مخاطرة لكل صفقة",
          ],
          quiz: {
            q: "الرافعة الأعلى تعني غالباً:",
            a: ["مخاطر أقل", "مخاطر أعلى", "لا فرق"],
            correct: 1,
          },
        },
        earn: {
          title: "الربح والرهن",
          desc: "افهم الرهن وفترات القفل والمكافآت بلغة بسيطة.",
          lessons: [
            "الرهن مقابل الاحتفاظ: ما الفرق؟",
            "فترة القفل و APR: ماذا تعني؟",
            "المخاطر: مخاطر العقد الذكي ومخاطر المنصة",
          ],
          quiz: {
            q: "APR تعني غالباً:",
            a: ["ربح مضمون", "تقدير سنوي", "بدون مخاطر"],
            correct: 1,
          },
        },
      },
    };

    return language === "ar" ? ar : en;
  }, [language]);

  const [state, setState] = useState(() => ({ points: 0, courses: {} }));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const save = (next) => {
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const courseKeys = Object.keys(t.courses);

  const getCourseProgress = (key) => {
    const courseState = state.courses?.[key] || { lessonIndex: 0, quizPassed: false };
    const lessonCount = t.courses[key].lessons.length;
    const lessonsDone = Math.min(courseState.lessonIndex, lessonCount);
    const lessonPct = lessonCount ? lessonsDone / lessonCount : 0;
    const quizPct = courseState.quizPassed ? 1 : 0;
    return clamp01((lessonPct * 0.8) + (quizPct * 0.2));
  };

  const markLessonDone = (key) => {
    const lessonCount = t.courses[key].lessons.length;
    const prev = state.courses?.[key] || { lessonIndex: 0, quizPassed: false };
    const nextLessonIndex = Math.min(lessonCount, (prev.lessonIndex || 0) + 1);
    const gained = nextLessonIndex > (prev.lessonIndex || 0) ? 10 : 0;

    const next = {
      ...state,
      points: (state.points || 0) + gained,
      courses: {
        ...(state.courses || {}),
        [key]: { ...prev, lessonIndex: nextLessonIndex },
      },
    };

    save(next);
    if (gained) toast.success(`${t.earned} 10 ${t.pts}`);
  };

  const takeQuiz = (key) => {
    const prev = state.courses?.[key] || { lessonIndex: 0, quizPassed: false };
    if (prev.quizPassed) return;

    const quiz = t.courses[key].quiz;
    const answer = window.prompt(`${quiz.q}\n\n1) ${quiz.a[0]}\n2) ${quiz.a[1]}\n3) ${quiz.a[2]}\n\n${language === "ar" ? "اكتب رقم الإجابة (1-3)" : "Type answer number (1-3)"}`);

    const idx = Number.parseInt(answer || "", 10) - 1;
    const passed = idx === quiz.correct;

    const gained = passed ? 25 : 0;
    const next = {
      ...state,
      points: (state.points || 0) + gained,
      courses: {
        ...(state.courses || {}),
        [key]: { ...prev, quizPassed: passed || prev.quizPassed },
      },
    };

    save(next);

    if (passed) toast.success(`${t.passed} — ${t.earned} 25 ${t.pts}`);
    else toast.error(language === "ar" ? "إجابة غير صحيحة" : "Incorrect answer");
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 pt-8" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-foreground">{t.title}</h1>
              <Badge variant="outline" className="border-border text-muted-foreground">
                <GraduationCap className="h-3.5 w-3.5 mr-1" />
                {t.points}: {state.points || 0}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-2">{t.subtitle}</p>
            <p className="text-xs text-muted-foreground mt-2">{t.pointsHelp}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.disclaimer}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {courseKeys.map((key) => {
            const course = t.courses[key];
            const courseState = state.courses?.[key] || { lessonIndex: 0, quizPassed: false };
            const lessonCount = course.lessons.length;
            const progress = getCourseProgress(key);
            const done = progress >= 0.999;

            const Icon =
              key === "security" ? ShieldCheck :
              key === "risk" ? Sparkles :
              BookOpen;

            return (
              <Card key={key} className="border-border shadow-sm">
                <CardHeader className="border-b border-border">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Icon className="h-5 w-5 text-blue-600" />
                    {course.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <p className="text-sm text-muted-foreground">{course.desc}</p>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t.yourProgress}</span>
                      <span>{Math.round(progress * 100)}%</span>
                    </div>
                    <Progress value={progress * 100} className="h-2" />
                    <div className="text-[11px] text-muted-foreground">
                      {t.lessonsComplete}: {Math.min(courseState.lessonIndex || 0, lessonCount)} / {lessonCount}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="text-muted-foreground font-medium">
                      {language === "ar" ? "الدروس" : "Lessons"}
                    </div>
                    <ul className="space-y-1">
                      {course.lessons.map((lesson, idx) => {
                        const doneLesson = idx < (courseState.lessonIndex || 0);
                        return (
                          <li key={lesson} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                            <span className={doneLesson ? "text-muted-foreground line-through" : "text-foreground"}>{lesson}</span>
                            {doneLesson ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => markLessonDone(key)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={(courseState.lessonIndex || 0) >= lessonCount}
                    >
                      {(courseState.lessonIndex || 0) === 0 ? t.start : t.continue}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => takeQuiz(key)}
                      disabled={(courseState.lessonIndex || 0) < lessonCount}
                    >
                      {t.takeQuiz}
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {language === "ar" ? "الاختبار" : "Quiz"}: {courseState.quizPassed ? t.passed : t.notYet}
                    {done ? ` • ${t.courseComplete}` : ""}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

LearnEarn.propTypes = {
  language: PropTypes.oneOf(["en", "ar"]),
};
