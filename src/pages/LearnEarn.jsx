import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BookOpen, CheckCircle2, GraduationCap, Lock, Play, Star, Trophy, 
  Zap, ChevronRight, Award, Target, Flame, Gift, ArrowRight, Volume2, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import confetti from "canvas-confetti";

const COURSES = [
  {
    id: "crypto-basics",
    icon: "🪙",
    color: "from-blue-500 to-cyan-500",
    lessons: [
      { id: "cb-1", title: { en: "What is Cryptocurrency?", ar: "ما هي العملة الرقمية؟" }, duration: "3 min", points: 10 },
      { id: "cb-2", title: { en: "Blockchain Explained", ar: "شرح البلوكشين" }, duration: "4 min", points: 15 },
      { id: "cb-3", title: { en: "Wallets: Hot vs Cold", ar: "المحافظ: ساخنة مقابل باردة" }, duration: "3 min", points: 10 },
      { id: "cb-4", title: { en: "Private Keys & Security", ar: "المفاتيح الخاصة والأمان" }, duration: "5 min", points: 20 },
    ],
    quiz: {
      id: "cb-quiz",
      questions: [
        { q: { en: "A seed phrase should be shared with:", ar: "يجب مشاركة عبارة الاستعادة مع:" }, 
          options: { en: ["No one", "Customer support", "A friend"], ar: ["لا أحد", "الدعم الفني", "صديق"] }, 
          correct: 0 },
        { q: { en: "Hot wallets are:", ar: "المحافظ الساخنة هي:" }, 
          options: { en: ["Connected to internet", "Offline storage", "Paper wallets"], ar: ["متصلة بالإنترنت", "تخزين غير متصل", "محافظ ورقية"] }, 
          correct: 0 },
      ],
      points: 50,
    }
  },
  {
    id: "trading-101",
    icon: "📈",
    color: "from-emerald-500 to-teal-500",
    lessons: [
      { id: "t1-1", title: { en: "Spot vs Futures Trading", ar: "تداول سبوت مقابل العقود" }, duration: "4 min", points: 15 },
      { id: "t1-2", title: { en: "Understanding Order Types", ar: "فهم أنواع الأوامر" }, duration: "5 min", points: 20 },
      { id: "t1-3", title: { en: "Reading Charts Basics", ar: "أساسيات قراءة الرسوم" }, duration: "6 min", points: 25 },
      { id: "t1-4", title: { en: "Risk Management 101", ar: "إدارة المخاطر 101" }, duration: "5 min", points: 20 },
    ],
    quiz: {
      id: "t1-quiz",
      questions: [
        { q: { en: "A limit order:", ar: "أمر محدد:" }, 
          options: { en: ["Executes at specified price", "Executes immediately", "Never expires"], ar: ["ينفذ بسعر محدد", "ينفذ فوراً", "لا ينتهي أبداً"] }, 
          correct: 0 },
        { q: { en: "Stop loss helps:", ar: "وقف الخسارة يساعد في:" }, 
          options: { en: ["Limit losses", "Maximize profit", "Both"], ar: ["تحديد الخسائر", "تعظيم الربح", "كلاهما"] }, 
          correct: 0 },
      ],
      points: 50,
    }
  },
  {
    id: "futures-advanced",
    icon: "🚀",
    color: "from-purple-500 to-pink-500",
    lessons: [
      { id: "fa-1", title: { en: "Leverage Explained", ar: "شرح الرافعة المالية" }, duration: "5 min", points: 25 },
      { id: "fa-2", title: { en: "Liquidation & Margin", ar: "التصفية والهامش" }, duration: "6 min", points: 30 },
      { id: "fa-3", title: { en: "Position Sizing", ar: "حجم المركز" }, duration: "5 min", points: 25 },
      { id: "fa-4", title: { en: "TP/SL Strategies", ar: "استراتيجيات TP/SL" }, duration: "7 min", points: 35 },
    ],
    quiz: {
      id: "fa-quiz",
      questions: [
        { q: { en: "Higher leverage means:", ar: "الرافعة الأعلى تعني:" }, 
          options: { en: ["Higher risk", "Lower risk", "No change"], ar: ["مخاطر أعلى", "مخاطر أقل", "لا تغيير"] }, 
          correct: 0 },
        { q: { en: "Liquidation happens when:", ar: "تحدث التصفية عندما:" }, 
          options: { en: ["Margin depleted", "Profit target hit", "Order expires"], ar: ["نفاد الهامش", "تحقق هدف الربح", "انتهاء الأمر"] }, 
          correct: 0 },
      ],
      points: 75,
    }
  },
  {
    id: "security",
    icon: "🛡️",
    color: "from-amber-500 to-orange-500",
    lessons: [
      { id: "sec-1", title: { en: "2FA Setup Guide", ar: "دليل إعداد 2FA" }, duration: "3 min", points: 15 },
      { id: "sec-2", title: { en: "Spotting Phishing", ar: "اكتشاف التصيد" }, duration: "4 min", points: 20 },
      { id: "sec-3", title: { en: "Secure Withdrawals", ar: "سحب آمن" }, duration: "3 min", points: 15 },
    ],
    quiz: {
      id: "sec-quiz",
      questions: [
        { q: { en: "Best 2FA method:", ar: "أفضل طريقة 2FA:" }, 
          options: { en: ["Authenticator app", "SMS", "Email"], ar: ["تطبيق المصادقة", "SMS", "البريد"] }, 
          correct: 0 },
      ],
      points: 40,
    }
  },
];

const COURSE_TITLES = {
  "crypto-basics": { en: "Crypto Basics", ar: "أساسيات الكريبتو" },
  "trading-101": { en: "Trading 101", ar: "التداول 101" },
  "futures-advanced": { en: "Futures Advanced", ar: "العقود المتقدمة" },
  "security": { en: "Security", ar: "الأمان" },
};

const XP_PER_LEVEL = 500;

export default function LearnEarn({ language = "en" }) {
  const { isAuthenticated, user } = useAuth();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCourse, setActiveCourse] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizCourse, setQuizCourse] = useState(null);
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState([]);

  const t = useMemo(() => ({
    title: language === "ar" ? "تعلّم واربح" : "Learn & Earn",
    subtitle: language === "ar" ? "أكمل الدروس واربح نقاط حقيقية" : "Complete lessons and earn real rewards",
    level: language === "ar" ? "المستوى" : "Level",
    points: language === "ar" ? "النقاط" : "Points",
    streak: language === "ar" ? "السلسلة" : "Streak",
    days: language === "ar" ? "أيام" : "days",
    startCourse: language === "ar" ? "ابدأ الدورة" : "Start Course",
    continueCourse: language === "ar" ? "استمر" : "Continue",
    completed: language === "ar" ? "مكتمل" : "Completed",
    lessons: language === "ar" ? "دروس" : "lessons",
    quiz: language === "ar" ? "اختبار" : "Quiz",
    takeQuiz: language === "ar" ? "ابدأ الاختبار" : "Take Quiz",
    watchLesson: language === "ar" ? "شاهد الدرس" : "Watch Lesson",
    completeLesson: language === "ar" ? "أكمل الدرس" : "Complete Lesson",
    nextLesson: language === "ar" ? "الدرس التالي" : "Next Lesson",
    earnPoints: language === "ar" ? "اربح نقاط" : "Earn",
    locked: language === "ar" ? "مقفل" : "Locked",
    passed: language === "ar" ? "ناجح" : "Passed",
    submit: language === "ar" ? "إرسال" : "Submit",
    correct: language === "ar" ? "صحيح!" : "Correct!",
    wrong: language === "ar" ? "خطأ" : "Wrong",
    quizComplete: language === "ar" ? "أحسنت!" : "Well done!",
    loginToStart: language === "ar" ? "سجل دخول للبدء" : "Login to start earning",
  }), [language]);

  const loadProgress = useCallback(async () => {
    if (!isAuthenticated) {
      setProgress({ total_points: 0, level: 1, xp: 0, streak_days: 0, completed_lessons: [], completed_quizzes: [] });
      setLoading(false);
      return;
    }
    try {
      const u = await base44.auth.me();
      const results = await base44.entities.UserProgress.filter({ user_id: u.id });
      if (results?.length > 0) {
        setProgress(results[0]);
      } else {
        const newProgress = await base44.entities.UserProgress.create({ user_id: u.id, total_points: 100, level: 1, xp: 100, streak_days: 0, completed_lessons: [], completed_quizzes: [] });
        setProgress(newProgress);
      }
    } catch {
      setProgress({ total_points: 0, level: 1, xp: 0, streak_days: 0, completed_lessons: [], completed_quizzes: [] });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const updateProgress = useCallback(async (updates) => {
    if (!progress?.id) return;
    const newData = { ...progress, ...updates };
    // Calculate level
    const totalXp = newData.xp || 0;
    newData.level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
    
    setProgress(newData);
    try {
      await base44.entities.UserProgress.update(progress.id, updates);
    } catch {}
  }, [progress]);

  const completeLesson = useCallback(async (lessonId, points) => {
    if (!progress || progress.completed_lessons?.includes(lessonId)) return;
    
    const newLessons = [...(progress.completed_lessons || []), lessonId];
    const newPoints = (progress.total_points || 0) + points;
    const newXp = (progress.xp || 0) + points;
    
    await updateProgress({
      completed_lessons: newLessons,
      total_points: newPoints,
      xp: newXp,
    });

    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    toast.success(`+${points} ${t.points}!`);
  }, [progress, updateProgress, t.points]);

  const completeQuiz = useCallback(async (quizId, points, correctCount, totalCount) => {
    if (!progress || progress.completed_quizzes?.includes(quizId)) return;
    
    const passed = correctCount >= Math.ceil(totalCount / 2);
    if (!passed) {
      toast.error(t.wrong);
      return;
    }

    const newQuizzes = [...(progress.completed_quizzes || []), quizId];
    const newPoints = (progress.total_points || 0) + points;
    const newXp = (progress.xp || 0) + points;

    await updateProgress({
      completed_quizzes: newQuizzes,
      total_points: newPoints,
      xp: newXp,
    });

    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    toast.success(`${t.quizComplete} +${points} ${t.points}!`);
    setQuizOpen(false);
  }, [progress, updateProgress, t]);

  const getCourseProgress = (course) => {
    if (!progress) return { completed: 0, total: course.lessons.length, percent: 0, quizPassed: false };
    const completed = course.lessons.filter(l => progress.completed_lessons?.includes(l.id)).length;
    const quizPassed = progress.completed_quizzes?.includes(course.quiz.id);
    return {
      completed,
      total: course.lessons.length,
      percent: Math.round((completed / course.lessons.length) * 100),
      quizPassed,
    };
  };

  const levelProgress = progress ? ((progress.xp || 0) % XP_PER_LEVEL) / XP_PER_LEVEL * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 pt-8 pb-16">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        
        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-4">
              <GraduationCap className="w-5 h-5 text-yellow-400" />
              <span className="text-white font-medium">{t.title}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">{t.subtitle}</h1>
          </motion.div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Card className="bg-white/10 border-white/20 backdrop-blur">
              <CardContent className="p-4 text-center">
                <Trophy className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{progress?.level || 1}</div>
                <div className="text-xs text-white/60">{t.level}</div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 border-white/20 backdrop-blur">
              <CardContent className="p-4 text-center">
                <Star className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{(progress?.total_points || 0).toLocaleString()}</div>
                <div className="text-xs text-white/60">{t.points}</div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 border-white/20 backdrop-blur">
              <CardContent className="p-4 text-center">
                <Flame className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{progress?.streak_days || 0}</div>
                <div className="text-xs text-white/60">{t.streak} {t.days}</div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 border-white/20 backdrop-blur">
              <CardContent className="p-4 text-center">
                <Zap className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">
                  {COURSES.reduce((acc, c) => acc + getCourseProgress(c).completed, 0)}/{COURSES.reduce((acc, c) => acc + c.lessons.length, 0)}
                </div>
                <div className="text-xs text-white/60">{t.lessons}</div>
              </CardContent>
            </Card>
          </div>

          {/* Level Progress */}
          <div className="mt-6 bg-white/10 backdrop-blur rounded-2xl p-4">
            <div className="flex items-center justify-between text-sm text-white/60 mb-2">
              <span>{t.level} {progress?.level || 1}</span>
              <span>{t.level} {(progress?.level || 1) + 1}</span>
            </div>
            <Progress value={levelProgress} className="h-3 bg-white/20" />
          </div>
        </div>
      </section>

      {/* Course Grid */}
      <div className="max-w-6xl mx-auto px-4 -mt-8">
        <div className="grid sm:grid-cols-2 gap-4">
          {COURSES.map((course, i) => {
            const prog = getCourseProgress(course);
            const isComplete = prog.completed === prog.total && prog.quizPassed;
            
            return (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card 
                  className={`overflow-hidden cursor-pointer transition-all hover:shadow-xl hover:scale-[1.02] ${
                    isComplete ? "border-emerald-500/50" : "border-border"
                  }`}
                  onClick={() => setActiveCourse(course)}
                >
                  <div className={`h-2 bg-gradient-to-r ${course.color}`} />
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${course.color} flex items-center justify-center text-2xl shadow-lg`}>
                        {course.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-foreground truncate">
                            {COURSE_TITLES[course.id][language]}
                          </h3>
                          {isComplete && <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {prog.completed}/{prog.total} {t.lessons} • {prog.quizPassed ? t.passed : t.quiz}
                        </p>
                        <Progress value={prog.percent} className="h-2" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span>{course.lessons.reduce((a, l) => a + l.points, 0) + course.quiz.points} pts</span>
                      </div>
                      <Button size="sm" className={`bg-gradient-to-r ${course.color} text-white border-0`}>
                        {prog.completed === 0 ? t.startCourse : t.continueCourse}
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Course Detail Modal */}
      <Dialog open={!!activeCourse} onOpenChange={() => setActiveCourse(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {activeCourse && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${activeCourse.color} flex items-center justify-center text-xl`}>
                    {activeCourse.icon}
                  </div>
                  <DialogTitle>{COURSE_TITLES[activeCourse.id][language]}</DialogTitle>
                </div>
              </DialogHeader>

              <div className="space-y-3 mt-4">
                {activeCourse.lessons.map((lesson, i) => {
                  const isCompleted = progress?.completed_lessons?.includes(lesson.id);
                  const prevCompleted = i === 0 || progress?.completed_lessons?.includes(activeCourse.lessons[i - 1].id);
                  const isLocked = !prevCompleted && !isCompleted;

                  return (
                    <div
                      key={lesson.id}
                      onClick={() => !isLocked && !isCompleted && setActiveLesson({ ...lesson, courseId: activeCourse.id })}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        isCompleted 
                          ? "bg-emerald-500/10 border-emerald-500/30" 
                          : isLocked 
                            ? "bg-muted/30 border-border opacity-50 cursor-not-allowed"
                            : "bg-card border-border hover:border-primary cursor-pointer"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isCompleted ? "bg-emerald-500 text-white" : isLocked ? "bg-muted" : `bg-gradient-to-br ${activeCourse.color} text-white`
                      }`}>
                        {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : isLocked ? <Lock className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${isCompleted ? "text-emerald-600" : "text-foreground"}`}>
                          {lesson.title[language]}
                        </p>
                        <p className="text-xs text-muted-foreground">{lesson.duration}</p>
                      </div>
                      <Badge variant="outline" className={isCompleted ? "border-emerald-500 text-emerald-500" : ""}>
                        +{lesson.points}
                      </Badge>
                    </div>
                  );
                })}

                {/* Quiz Section */}
                {(() => {
                  const allLessonsComplete = activeCourse.lessons.every(l => progress?.completed_lessons?.includes(l.id));
                  const quizPassed = progress?.completed_quizzes?.includes(activeCourse.quiz.id);
                  
                  return (
                    <div
                      onClick={() => allLessonsComplete && !quizPassed && (() => { setQuizCourse(activeCourse); setQuizOpen(true); setQuizStep(0); setQuizAnswers([]); })()}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                        quizPassed 
                          ? "bg-emerald-500/10 border-emerald-500" 
                          : allLessonsComplete 
                            ? "bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500 cursor-pointer hover:shadow-lg"
                            : "bg-muted/30 border-border opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        quizPassed ? "bg-emerald-500 text-white" : allLessonsComplete ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white" : "bg-muted"
                      }`}>
                        {quizPassed ? <Trophy className="w-5 h-5" /> : <Target className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold ${quizPassed ? "text-emerald-600" : "text-foreground"}`}>
                          {t.quiz}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {quizPassed ? t.passed : `${activeCourse.quiz.questions.length} questions`}
                        </p>
                      </div>
                      <Badge className={quizPassed ? "bg-emerald-500" : "bg-gradient-to-r from-purple-500 to-pink-500"}>
                        +{activeCourse.quiz.points}
                      </Badge>
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Lesson Modal */}
      <Dialog open={!!activeLesson} onOpenChange={() => setActiveLesson(null)}>
        <DialogContent className="max-w-md">
          {activeLesson && (
            <div className="text-center py-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-6">
                <BookOpen className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-xl font-bold mb-2">{activeLesson.title[language]}</h2>
              <p className="text-muted-foreground mb-6">{activeLesson.duration}</p>
              
              <div className="bg-muted/30 rounded-xl p-4 mb-6 text-left">
                <p className="text-sm text-muted-foreground">
                  {language === "ar" 
                    ? "في هذا الدرس ستتعلم المفاهيم الأساسية وأفضل الممارسات. شاهد المحتوى بعناية ثم أكمل الدرس لكسب النقاط."
                    : "In this lesson, you'll learn key concepts and best practices. Watch carefully and complete to earn points."}
                </p>
              </div>

              <Button
                onClick={() => {
                  completeLesson(activeLesson.id, activeLesson.points);
                  setActiveLesson(null);
                }}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
              >
                {t.completeLesson} (+{activeLesson.points} pts)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quiz Modal */}
      <Dialog open={quizOpen} onOpenChange={setQuizOpen}>
        <DialogContent className="max-w-md">
          {quizCourse && (
            <div>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-500" />
                  {t.quiz}: {COURSE_TITLES[quizCourse.id][language]}
                </DialogTitle>
              </DialogHeader>

              <div className="mt-4">
                <Progress value={((quizStep + 1) / quizCourse.quiz.questions.length) * 100} className="h-2 mb-6" />
                
                {quizStep < quizCourse.quiz.questions.length ? (
                  <div>
                    <p className="font-medium mb-4">{quizCourse.quiz.questions[quizStep].q[language]}</p>
                    <div className="space-y-2">
                      {quizCourse.quiz.questions[quizStep].options[language].map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            const newAnswers = [...quizAnswers, i];
                            setQuizAnswers(newAnswers);
                            if (quizStep + 1 < quizCourse.quiz.questions.length) {
                              setQuizStep(quizStep + 1);
                            } else {
                              const correctCount = newAnswers.filter((a, idx) => a === quizCourse.quiz.questions[idx].correct).length;
                              completeQuiz(quizCourse.quiz.id, quizCourse.quiz.points, correctCount, quizCourse.quiz.questions.length);
                            }
                          }}
                          className="w-full p-4 text-left rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Login CTA */}
      {!isAuthenticated && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-12 pb-6 px-4">
          <div className="max-w-md mx-auto">
            <Button className="w-full py-6 text-lg bg-gradient-to-r from-indigo-600 to-purple-600">
              {t.loginToStart}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

LearnEarn.propTypes = {
  language: PropTypes.oneOf(["en", "ar"]),
};