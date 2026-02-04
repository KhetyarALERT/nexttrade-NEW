import { useEffect, useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BookOpen, CheckCircle2, GraduationCap, ShieldCheck, Sparkles, Loader2, Trophy, ArrowRight, PlayCircle, Video } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import VideoModal from "@/components/help/VideoModal";
import { getEnabledVideos } from "@/components/help/helpVideos";

const STORAGE_KEY = "learn_earn_progress_v1";

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export default function LearnEarn({ language = "en" }) {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [state, setState] = useState({ points: 0, courses: {} });
  const [progressRecordId, setProgressRecordId] = useState(null);
  const [activeTab, setActiveTab] = useState("courses");
  const [selectedVideo, setSelectedVideo] = useState(null);

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
      syncing: "Syncing...",
      loginToSave: "Log in to save your progress permanently.",
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
      syncing: "جاري المزامنة...",
      loginToSave: "سجل الدخول لحفظ تقدمك بشكل دائم.",
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

  // Load progress
  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!isAuthenticated || !user?.id) {
        // Fallback to local storage for guests
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw && active) setState(JSON.parse(raw));
        } catch { }
        if (active) setLoading(false);
        return;
      }

      try {
        const records = await base44.entities.UserLearnProgress.filter({ user_id: user.id });
        if (active) {
          if (records.length > 0) {
            const rec = records[0];
            setState({ points: rec.points || 0, courses: rec.courses || {} });
            setProgressRecordId(rec.id);
          } else {
            // Check local storage for merge? Or just start fresh?
            // Let's check local storage to see if we can migrate guest progress
            let initialState = { points: 0, courses: {} };
            try {
              const raw = localStorage.getItem(STORAGE_KEY);
              if (raw) initialState = JSON.parse(raw);
            } catch { }
            
            setState(initialState);
            
            // Create initial record
            const newRec = await base44.entities.UserLearnProgress.create({
              user_id: user.id,
              points: initialState.points,
              courses: initialState.courses,
              last_updated_at: new Date().toISOString()
            });
            setProgressRecordId(newRec.id);
          }
        }
      } catch (err) {
        console.error("Failed to load progress", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [isAuthenticated, user?.id]);

  const saveState = async (nextState) => {
    setState(nextState);
    
    // Always save to local storage as backup/guest
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch { }

    // If logged in, save to DB
    if (isAuthenticated && user?.id) {
      setSyncing(true);
      try {
        if (progressRecordId) {
          await base44.entities.UserLearnProgress.update(progressRecordId, {
            points: nextState.points,
            courses: nextState.courses,
            last_updated_at: new Date().toISOString()
          });
        } else {
          const newRec = await base44.entities.UserLearnProgress.create({
            user_id: user.id,
            points: nextState.points,
            courses: nextState.courses,
            last_updated_at: new Date().toISOString()
          });
          setProgressRecordId(newRec.id);
        }
      } catch (err) {
        console.error("Failed to sync progress", err);
      } finally {
        setSyncing(false);
      }
    }
  };

  const getCourseProgress = useCallback((key) => {
    const courseState = state.courses?.[key] || { lessonIndex: 0, quizPassed: false };
    const lessonCount = t.courses[key].lessons.length;
    const lessonsDone = Math.min(courseState.lessonIndex, lessonCount);
    const lessonPct = lessonCount ? lessonsDone / lessonCount : 0;
    const quizPct = courseState.quizPassed ? 1 : 0;
    return clamp01((lessonPct * 0.8) + (quizPct * 0.2));
  }, [state, t]);

  const markLessonDone = async (key) => {
    const lessonCount = t.courses[key].lessons.length;
    const prev = state.courses?.[key] || { lessonIndex: 0, quizPassed: false };
    const nextLessonIndex = Math.min(lessonCount, (prev.lessonIndex || 0) + 1);
    
    // Only give points if actually progressing
    const gained = nextLessonIndex > (prev.lessonIndex || 0) ? 10 : 0;
    if (gained === 0) return; // Already done

    const next = {
      ...state,
      points: (state.points || 0) + gained,
      courses: {
        ...(state.courses || {}),
        [key]: { ...prev, lessonIndex: nextLessonIndex },
      },
    };

    await saveState(next);
    toast.success(`${t.earned} 10 ${t.pts}`);
  };

  const takeQuiz = async (key) => {
    const prev = state.courses?.[key] || { lessonIndex: 0, quizPassed: false };
    if (prev.quizPassed) return;

    const quiz = t.courses[key].quiz;
    const answer = window.prompt(`${quiz.q}\n\n1) ${quiz.a[0]}\n2) ${quiz.a[1]}\n3) ${quiz.a[2]}\n\n${language === "ar" ? "اكتب رقم الإجابة (1-3)" : "Type answer number (1-3)"}`);

    if (!answer) return;

    const idx = Number.parseInt(answer || "", 10) - 1;
    const passed = idx === quiz.correct;

    if (passed) {
      const gained = 25;
      const next = {
        ...state,
        points: (state.points || 0) + gained,
        courses: {
          ...(state.courses || {}),
          [key]: { ...prev, quizPassed: true },
        },
      };

      await saveState(next);
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#3b82f6', '#f59e0b']
      });
      
      toast.success(`${t.passed} — ${t.earned} 25 ${t.pts}`);
    } else {
      toast.error(language === "ar" ? "إجابة غير صحيحة، حاول مرة أخرى" : "Incorrect answer, try again");
    }
  };

  const courseKeys = Object.keys(t.courses);
  const helpVideos = getEnabledVideos();

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 pt-8" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-8 bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-3xl font-bold text-foreground">{t.title}</h1>
            </div>
            <p className="text-muted-foreground text-lg">{t.subtitle}</p>
            
            {!isAuthenticated && (
              <p className="text-sm text-amber-600 mt-3 font-medium bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg inline-block">
                {t.loginToSave}
              </p>
            )}
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-xl border border-border">
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{t.points}</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{state.points || 0}</p>
              </div>
              <Trophy className="h-8 w-8 text-yellow-500 fill-yellow-500/20" />
            </div>
            {syncing && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" /> {t.syncing}
              </div>
            )}
          </div>
        </div>

        {/* Tabs: Courses / Academy */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="courses" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2">
              <BookOpen className="h-4 w-4 mr-2" />
              {language === "ar" ? "الدورات" : "Courses"}
            </TabsTrigger>
            <TabsTrigger value="academy" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2">
              <Video className="h-4 w-4 mr-2" />
              {language === "ar" ? "الأكاديمية" : "Academy"}
            </TabsTrigger>
          </TabsList>

          {/* Academy Tab Content */}
          <TabsContent value="academy" className="mt-6">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-foreground">
                {language === "ar" ? "فيديوهات تعليمية" : "Help Videos"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {language === "ar" 
                  ? "شروحات خطوة بخطوة لمساعدتك على البدء"
                  : "Step-by-step guides to help you get started"}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {helpVideos.map((video) => (
                <Card 
                  key={video.key}
                  className="border-border hover:border-blue-300 dark:hover:border-blue-700 transition-all hover:shadow-md cursor-pointer group"
                  onClick={() => setSelectedVideo(video)}
                >
                  <CardContent className="p-4">
                    {/* Thumbnail placeholder with play icon */}
                    <div className="relative aspect-video bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                      <div className="absolute inset-0 bg-black/5 group-hover:bg-black/10 transition-colors" />
                      <PlayCircle className="h-12 w-12 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                    </div>
                    
                    {/* Category badge */}
                    <Badge variant="secondary" className="text-[10px] mb-2">
                      {language === "ar" ? video.category_ar : video.category_en}
                    </Badge>
                    
                    {/* Title */}
                    <h3 className="font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {language === "ar" ? video.title_ar : video.title_en}
                    </h3>
                    
                    {/* Watch button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedVideo(video);
                      }}
                    >
                      <PlayCircle className="h-4 w-4 mr-2" />
                      {language === "ar" ? "شاهد" : "Watch"}
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {helpVideos.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  {language === "ar" ? "لا توجد فيديوهات متاحة حالياً" : "No videos available yet"}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Courses Tab Content */}
          <TabsContent value="courses" className="mt-6">
        {/* Content Grid */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 rounded-2xl bg-muted/20 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {courseKeys.map((key) => {
              const course = t.courses[key];
              const courseState = state.courses?.[key] || { lessonIndex: 0, quizPassed: false };
              const lessonCount = course.lessons.length;
              const progress = getCourseProgress(key);
              const done = progress >= 0.999;
              const isStarted = progress > 0;

              const Icon =
                key === "security" ? ShieldCheck :
                key === "risk" ? Sparkles :
                BookOpen;

              return (
                <Card 
                  key={key} 
                  className={cn(
                    "border-border shadow-sm transition-all duration-300 hover:shadow-md",
                    done && "border-emerald-500/50 bg-emerald-50/10 dark:bg-emerald-900/10"
                  )}
                >
                  <CardHeader className="border-b border-border pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          done ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <CardTitle className="text-lg">{course.title}</CardTitle>
                      </div>
                      {done && (
                        <Badge variant="success" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                          {t.courseComplete}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <p className="text-sm text-muted-foreground min-h-[40px]">{course.desc}</p>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                        <span>{t.yourProgress}</span>
                        <span>{Math.round(progress * 100)}%</span>
                      </div>
                      <Progress 
                        value={progress * 100} 
                        className="h-2" 
                        indicatorClassName={cn(done ? "bg-emerald-500" : "bg-blue-600")}
                      />
                      <div className="text-[11px] text-muted-foreground flex justify-between">
                        <span>{t.lessonsComplete}: {Math.min(courseState.lessonIndex || 0, lessonCount)} / {lessonCount}</span>
                        <span>{courseState.quizPassed ? t.passed : t.notYet}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-sm font-medium text-foreground border-b border-border pb-2">
                        {language === "ar" ? "الدروس" : "Lessons"}
                      </div>
                      <ul className="space-y-2">
                        {course.lessons.map((lesson, idx) => {
                          const doneLesson = idx < (courseState.lessonIndex || 0);
                          const isNext = idx === (courseState.lessonIndex || 0);
                          
                          return (
                            <li 
                              key={lesson} 
                              className={cn(
                                "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors",
                                doneLesson 
                                  ? "bg-muted/50 text-muted-foreground" 
                                  : isNext 
                                    ? "bg-card border border-blue-200 dark:border-blue-800 shadow-sm" 
                                    : "bg-card border border-border opacity-60"
                              )}
                            >
                              <span className={cn(doneLesson && "line-through decoration-emerald-500/50")}>{lesson}</span>
                              {doneLesson && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                              {isNext && <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" />}
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <div className="pt-2 grid grid-cols-2 gap-3">
                      <Button
                        onClick={() => markLessonDone(key)}
                        className={cn(
                          "w-full transition-all",
                          done ? "opacity-50" : "hover:scale-[1.02]"
                        )}
                        variant={isStarted ? "default" : "secondary"}
                        disabled={(courseState.lessonIndex || 0) >= lessonCount}
                      >
                        {(courseState.lessonIndex || 0) === 0 ? (
                          <><ArrowRight className="w-4 h-4 mr-2" /> {t.start}</>
                        ) : (
                          <>{t.continue}</>
                        )}
                      </Button>
                      <Button
                        variant={courseState.quizPassed ? "outline" : "default"}
                        onClick={() => takeQuiz(key)}
                        disabled={(courseState.lessonIndex || 0) < lessonCount}
                        className={cn(
                          (courseState.lessonIndex || 0) >= lessonCount && !courseState.quizPassed && "animate-pulse shadow-lg shadow-blue-500/20"
                        )}
                      >
                        {courseState.quizPassed ? (
                          <><CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" /> {t.passed}</>
                        ) : (
                          <>{t.takeQuiz}</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
          </TabsContent>
        </Tabs>

        {/* Video Modal */}
        {selectedVideo && (
          <VideoModal
            open={!!selectedVideo}
            onClose={() => setSelectedVideo(null)}
            youtubeId={selectedVideo.youtube_id}
            title={language === "ar" ? selectedVideo.title_ar : selectedVideo.title_en}
          />
        )}
      </div>
    </div>
  );
}

LearnEarn.propTypes = {
  language: PropTypes.oneOf(["en", "ar"]),
};