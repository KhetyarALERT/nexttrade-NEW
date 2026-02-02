import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Zap,
  Globe,
  DollarSign,
  LineChart,
  Users,
  CheckCircle,
  ArrowRight,
  Gift,
  Bell,
  Wallet,
  Bot,
  Lock,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import { motion, useReducedMotion, MotionConfig } from "framer-motion";
import PhoneMockup from "../components/home/PhoneMockup";
import CryptoPriceTable from "../components/trading/CryptoPriceTable";
import { useUserReadiness } from "@/components/hooks/useUserReadiness";
import { useAuth } from "@/lib/AuthContext";
import { useReferralCapture } from "@/components/hooks/useReferralCapture";

export default function Home({ language = "en" }) {
  const shouldReduceMotion = useReducedMotion();
  const { isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();
  const { nextAction, loading: loadingReadiness } = useUserReadiness({ enabled: isAuthenticated });
  
  // Capture referral code from URL and finalize after auth
  useReferralCapture({ isAuthenticated, isLoadingAuth });
  
  const content = {
    en: {
      hero: {
        title: "AI-Enhanced Trading & Investing with Smart Rewards.",
        subtitle: "Trade spot and futures with real-time insights, invest securely, and earn structured rewards — all with full control of your funds.",
        offerings: [
          { icon: LineChart, title: "Live Trading", desc: "Up to 100x leverage on futures with AI signals." },
          { icon: Shield, title: "Secured Investing", desc: "Clear rewards system with transparent risk controls." },
          { icon: Wallet, title: "Flexible Rewards", desc: "Grow balances with structured rewards and easy access." }
        ],
        cta1: "Go to Trading",
        cta2: "Open Dashboard"
      },
      withdrawal: {
        title: "Your Assets, Your Control",
        subtitle: "Unlike other platforms that hold your funds hostage, NextTrade ensures instant liquidity. Deposit and withdraw 24/7 with official network fees.",
        features: [
          { title: "Non-Custodial Feel", desc: "We handle the security, you handle the keys. Your assets are never locked." },
          { title: "Instant Liquidity", desc: "Withdraw USDT, BTC, or ETH instantly to any wallet. No manual approvals." },
          { title: "Fair Fees", desc: "Only pay official blockchain network fees. No hidden platform markups." }
        ]
      },
      exclusiveOffers: {
        title: "Exclusive Registration Bonuses",
        subtitle: "Get premium features when you open your account today",
        offers: [
          {
            icon: Gift,
            title: "Welcome Bonus",
            desc: "Up to $500 trading bonus on your first deposit",
            badge: "Limited Time",
            color: "from-orange-500 to-red-500"
          },
          {
            icon: Bot,
            title: "AI Trading Assistant",
            desc: "Free access to our advanced AI-powered trading advisor",
            badge: "Premium Feature",
            color: "from-indigo-500 to-purple-500"
          },
          {
            icon: Bell,
            title: "Live Trade Signals",
            desc: "Receive real-time trading signals from expert analysts",
            badge: "Free Forever",
            color: "from-green-500 to-emerald-500"
          },
          {
            icon: Wallet,
            title: "Instant Withdrawals",
            desc: "Withdraw your profits instantly 24/7 with zero fees",
            badge: "No Limits",
            color: "from-blue-500 to-cyan-500"
          }]

      },
      features: [
        { icon: Shield, title: "Trusted Security", desc: "Bank-grade encryption and secure crypto trading environment" },
        { icon: Zap, title: "Lightning Speed", desc: "Ultra-fast order execution in milliseconds" },
        { icon: DollarSign, title: "Zero Commission", desc: "No hidden fees or commission charges on trades" },
        { icon: Globe, title: "24/7 Trading", desc: "Trade cryptocurrencies from anywhere, anytime" }],

      whyChoose: {
        title: "Why Choose NextTrade?",
        subtitle: "AI-enhanced crypto trading built by traders, for traders",
        reasons: [
          "Ultra-low spreads on major crypto pairs",
          "Dedicated account manager for personalized support",
          "Advanced AI-powered trading signals",
          "Instant deposits and withdrawals 24/7",
          "Comprehensive educational resources",
          "Secure cold storage for digital assets"]

      },
      steps: {
        title: "Start Trading in 4 Easy Steps",
        items: [
          { title: "Register", desc: "Create your account in minutes" },
          { title: "Verify", desc: "Upload your documents" },
          { title: "Fund", desc: "Deposit with multiple payment methods" },
          { title: "Trade", desc: "Start trading top cryptocurrencies" }]

      }
    },
    ar: {
      hero: {
        title: "تداول واستثمار مدعوم بالذكاء الاصطناعي مع أرباح مؤمّنة.",
        subtitle: "تداول فوري ومشتقات برؤى لحظية، استثمار آمن، وعوائد منظمة — مع تحكم كامل بأموالك.",
        offerings: [
          { icon: LineChart, title: "تداول مباشر", desc: "رافعة مالية حتى 100x على العقود بإشارات ذكية." },
          { icon: Shield, title: "استثمار آمن", desc: "نظام مكافآت واضح مع إدارة مخاطر شفافة." },
          { icon: Wallet, title: "عوائد مرنة", desc: "نمِّ رصيدك بعوائد منظمة مع مرونة السحب." }
        ],
        cta1: "الانتقال للتداول",
        cta2: "فتح لوحة التحكم"
      },
      withdrawal: {
        title: "أصولك، تحت تحكمك",
        subtitle: "على عكس المنصات الأخرى التي تحتجز أموالك، تضمن NextTrade سيولة فورية. أودع واسحب على مدار الساعة طوال أيام الأسبوع برسوم الشبكة الرسمية.",
        features: [
          { title: "تحكم كامل", desc: "نحن نتولى الأمان، وأنت تتحكم في الأصول. أصولك لا تُقفل أبداً." },
          { title: "سيولة فورية", desc: "اسحب USDT أو BTC أو ETH فوراً إلى أي محفظة. لا موافقات يدوية." },
          { title: "رسوم عادلة", desc: "ادفع فقط رسوم شبكة البلوكشين الرسمية. لا رسوم إضافية مخفية." }
        ]
      },
      exclusiveOffers: {
        title: "مكافآت التسجيل الحصرية",
        subtitle: "احصل على ميزات مميزة عند فتح حسابك اليوم",
        offers: [
          {
            icon: Gift,
            title: "مكافأة الترحيب",
            desc: "ما يصل إلى 500 دولار مكافأة تداول على إيداعك الأول",
            badge: "عرض محدود",
            color: "from-orange-500 to-red-500"
          },
          {
            icon: Bot,
            title: "مساعد التداول بالذكاء الاصطناعي",
            desc: "وصول مجاني لمستشار التداول المتقدم بالذكاء الاصطناعي",
            badge: "ميزة مميزة",
            color: "from-indigo-500 to-purple-500"
          },
          {
            icon: Bell,
            title: "إشارات التداول المباشرة",
            desc: "احصل على إشارات تداول فورية من محللين خبراء",
            badge: "مجاني للأبد",
            color: "from-green-500 to-emerald-500"
          },
          {
            icon: Wallet,
            title: "سحب فوري",
            desc: "اسحب أرباحك فوراً على مدار الساعة بدون رسوم",
            badge: "بدون حدود",
            color: "from-blue-500 to-cyan-500"
          }]

      },
      features: [
        { icon: Shield, title: "أمان موثوق", desc: "تشفير بمستوى البنوك وبيئة تداول عملات رقمية آمنة" },
        { icon: Zap, title: "سرعة البرق", desc: "تنفيذ فائق السرعة للأوامر في أجزاء من الثانية" },
        { icon: DollarSign, title: "بدون عمولة", desc: "لا رسوم خفية أو عمولات على الصفقات" },
        { icon: Globe, title: "تداول 24/7", desc: "تداول العملات الرقمية من أي مكان، في أي وقت" }],

      whyChoose: {
        title: "لماذا NextTrade؟",
        subtitle: "تداول عملات رقمية معزز بالذكاء الاصطناعي صُنع بواسطة متداولين، للمتداولين",
        reasons: [
          "فروقات أسعار منخفضة جداً على أزواج العملات الرقمية الرئيسية",
          "مدير حساب متخصص لدعم شخصي",
          "إشارات تداول متقدمة مدعومة بالذكاء الاصطناعي",
          "إيداعات وسحوبات فورية على مدار الساعة",
          "موارد تعليمية شاملة",
          "تخزين بارد آمن للأصول الرقمية"]

      },
      steps: {
        title: "ابدأ التداول في 4 خطوات سهلة",
        items: [
          { title: "التسجيل", desc: "أنشئ حسابك في دقائق" },
          { title: "التحقق", desc: "قم برفع مستنداتك" },
          { title: "التمويل", desc: "أودع بطرق دفع متعددة" },
          { title: "التداول", desc: "ابدأ تداول أفضل العملات الرقمية" }]

      }
    }
  };

  const t = content[language];

  // Animation variants that respect reduced motion
  const fadeInUp = shouldReduceMotion 
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };
  
  const fadeInScale = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 } };

  return (
    <MotionConfig reducedMotion="user">
    <div className="overflow-hidden bg-background text-foreground">
      {/* Mobile Hero (Minimal, No Phone Mockup) */}
      <section className="md:hidden relative bg-slate-950 pt-24 pb-12 px-4 overflow-hidden flex flex-col justify-center min-h-[60vh] max-h-[80vh]">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-950" />
        
        <div className="relative z-10 flex flex-col gap-6">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-white tracking-tight leading-tight">
              {language === 'en' ? "Smart AI Trading." : "تداول ذكي بالذكاء الاصطناعي."}
            </h1>
            <p className="text-base text-white/60 leading-normal line-clamp-2">
              {t.hero.subtitle}
            </p>
          </div>

          <div className="flex gap-3 w-full">
            <Button
              className="flex-1 bg-white text-slate-900 hover:bg-white/90 rounded-lg h-12 text-sm font-semibold"
              asChild={isAuthenticated && !!nextAction?.route}
              onClick={!isAuthenticated ? navigateToLogin : undefined}
              disabled={loadingReadiness}
            >
              {isAuthenticated && nextAction?.route ? (
                <Link to={nextAction.route}>
                  {nextAction.label?.[language] || t.hero.cta1}
                </Link>
              ) : (
                <span>{t.hero.cta1}</span>
              )}
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-white/20 text-white hover:bg-white/10 rounded-lg h-12 text-sm font-semibold bg-transparent"
              asChild
            >
              <Link to={createPageUrl("Dashboard")}>{t.hero.cta2}</Link>
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-medium text-white/50">
            <div className="px-2 py-1 rounded-md bg-white/5 border border-white/10 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              {language === 'en' ? "Secure" : "آمن"}
            </div>
            <div className="px-2 py-1 rounded-md bg-white/5 border border-white/10 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {language === 'en' ? "Fast" : "سريع"}
            </div>
            <div className="px-2 py-1 rounded-md bg-white/5 border border-white/10 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {language === 'en' ? "24/7" : "24/7"}
            </div>
          </div>

          {/* Flat Preview Card - No Device Frame */}
          <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-orange-500">B</span>
                </div>
                <div>
                  <div className="font-semibold text-white text-sm leading-none">BTC/USDT</div>
                  <div className="text-[10px] text-white/40 mt-0.5">Bitcoin</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-emerald-400 text-sm font-mono font-medium">+2.45%</div>
                <div className="text-[10px] text-white/40">$67,420.10</div>
              </div>
            </div>
            {/* Simple sparkline visualization */}
            <div className="h-12 flex items-end gap-1 opacity-50 px-1">
              {[35, 45, 40, 60, 55, 75, 65, 85, 80, 95, 70, 85, 90, 100].map((h, i) => (
                <div key={i} className="flex-1 bg-emerald-500/50 rounded-t-[1px]" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Desktop Hero Section (Hidden on Mobile) */}
      <section className="hidden md:flex relative min-h-[85vh] items-center overflow-hidden bg-slate-950">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
        
        {/* Content */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 z-10 w-full">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            {/* Left Content - Text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="order-2 lg:order-1 text-center lg:text-left"
            >
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 leading-[1.1] tracking-tight">
                {t.hero.title}
              </h1>

              <p className="text-base sm:text-lg text-white/60 mb-6 sm:mb-8 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                {t.hero.subtitle}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start mb-8 sm:mb-12">
                <Button
                  size="lg"
                  className="bg-white text-slate-900 hover:bg-white/90 rounded-lg px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg font-semibold transition-all hover:scale-[1.02]"
                  asChild={isAuthenticated && !!nextAction?.route}
                  onClick={!isAuthenticated ? navigateToLogin : undefined}
                  disabled={loadingReadiness}
                >
                  {isAuthenticated && nextAction?.route ? (
                    <Link to={nextAction.route}>
                      {nextAction.label?.[language] || t.hero.cta1}
                    </Link>
                  ) : (
                    <span>{t.hero.cta1}</span>
                  )}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10 rounded-lg px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg font-semibold transition-all"
                  asChild
                >
                  <Link to={createPageUrl("Dashboard")}>{t.hero.cta2}</Link>
                </Button>
              </div>

              {/* Trust indicators - minimal */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-4 sm:gap-6 text-white/40 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span>{language === "en" ? "Secure" : "آمن"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  <span>{language === "en" ? "Fast" : "سريع"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  <span>{language === "en" ? "24/7" : "على مدار الساعة"}</span>
                </div>
              </div>
            </motion.div>

            {/* Right Content - Phone Mockup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="order-1 lg:order-2 flex justify-center"
            >
              <PhoneMockup language={language} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Live Crypto Markets Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              {language === "en" ? "Real-Time Market Pulse" : "نبض السوق المباشر"}
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {language === "en" ? "Institutional-grade data streaming directly from global exchanges." : "بيانات بمستوى مؤسسي تتدفق مباشرة من البورصات العالمية."}
            </p>
          </div>
          <div className="w-full">
            {/* Full Width Crypto Table */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}>
              <CryptoPriceTable language={language} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Instant Withdrawal & Asset Control Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-background relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Badge className="mb-4 bg-blue-50 text-blue-600 border-blue-100 px-4 py-1.5 text-sm font-bold">
                {language === "en" ? "Unmatched Liquidity" : "سيولة لا مثيل لها"}
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground leading-tight">
                {t.withdrawal.title}
              </h2>
              <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
                {t.withdrawal.subtitle}
              </p>
              
              <div className="space-y-8">
                {t.withdrawal.features.map((feature, idx) => (
                  <div key={idx} className="flex gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {idx === 0 ? <Lock className="w-6 h-6 text-primary" /> : 
                       idx === 1 ? <Zap className="w-6 h-6 text-primary" /> : 
                       <DollarSign className="w-6 h-6 text-primary" />}
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-foreground mb-2">{feature.title}</h4>
                      <p className="text-muted-foreground">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative"
            >
              {/* Visual Demo of Withdrawal */}
              <Card className="border-0 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] bg-slate-900 text-white overflow-hidden rounded-[2rem]">
                <CardContent className="p-0">
                  <div className="p-8 border-b border-white/5 bg-white/5">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                        </div>
                        <span className="font-bold text-lg tracking-tight">Withdrawal Portal</span>
                      </div>
                      <Badge variant="outline" className="border-white/20 text-white/60">Mainnet</Badge>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-white/60 text-sm font-medium">Asset to Withdraw</span>
                          <span className="text-xs text-blue-400 font-bold">Balance: 12,450.00 USDT</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center font-bold text-xs">T</div>
                            <span className="font-bold text-xl">USDT</span>
                          </div>
                          <span className="text-2xl font-bold tabular-nums">5,000.00</span>
                        </div>
                      </div>

                      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <span className="text-white/60 text-sm font-medium block mb-4">Destination Wallet</span>
                        <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                          <span className="text-xs font-mono text-white/40 truncate max-w-[200px]">0x71C7656EC7ab88b098defB751B7401B5f6d8976F</span>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        </div>
                      </div>

                      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-8 rounded-2xl text-lg font-bold shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3">
                        Confirm Instant Withdrawal
                        <ArrowUpRight className="w-5 h-5" />
                      </Button>
                      
                      <div className="flex items-center justify-center gap-6 text-[11px] text-white/40 font-bold uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-3 h-3" />
                          Processing: ~30s
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield className="w-3 h-3" />
                          Network Fee: $1.20
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Floating Success Badge */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute -bottom-6 -right-6 bg-card p-6 rounded-3xl shadow-2xl border border-border flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <div className="text-foreground font-bold">Withdrawal Success</div>
                  <div className="text-muted-foreground text-sm font-medium">5,000 USDT Sent</div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Exclusive Offers Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-background relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-blue-100 text-blue-600 hover:bg-blue-100 border-0 px-4 py-1">
              {language === "en" ? "Limited Time Offer" : "عرض لفترة محدودة"}
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              {t.exclusiveOffers.title}
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t.exclusiveOffers.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {t.exclusiveOffers.offers.map((offer, idx) => {
              const Icon = offer.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}>

                  <Card className="h-full border-0 shadow-xl hover:shadow-2xl transition-all duration-500 group bg-card overflow-hidden rounded-3xl">
                    <div className={`h-2 bg-gradient-to-r ${offer.color}`} />
                    <CardContent className="p-8">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${offer.color} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <Badge variant="secondary" className="mb-4 bg-muted text-muted-foreground">
                        {offer.badge}
                      </Badge>
                      <h3 className="text-xl font-bold mb-3 text-foreground">{offer.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{offer.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>);

            })}
          </div>

          {/* Registration Preview Card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-20">

            <div className="grid lg:grid-cols-2 gap-12 items-center bg-muted/30 rounded-[3rem] p-8 md:p-16 shadow-2xl border border-border">
              <div>
                <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                  {language === "en" ? "Why wait? Start your journey today" : "لماذا الانتظار؟ ابدأ رحلتك اليوم"}
                </h3>
                <div className="space-y-6">
                  {[
                    { t: "Instant account approval", a: "موافقة فورية على الحساب" },
                    { t: "Zero deposit fees", a: "بدون رسوم إيداع" },
                    { t: "Personal AI trading coach", a: "مدرب تداول شخصي بالذكاء الاصطناعي" }
                  ].map((item, i) =>
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="text-lg text-foreground font-medium">
                        {language === "en" ? item.t : item.a}
                      </span>
                    </div>
                  )}
                </div>
                <Button
                  size="lg"
                  className="mt-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-10 py-7 text-xl font-bold shadow-2xl shadow-blue-500/30 hover:scale-105 transition-all w-full sm:w-auto"
                  asChild={isAuthenticated && !!nextAction?.route}
                  onClick={!isAuthenticated ? navigateToLogin : undefined}
                  disabled={loadingReadiness}
                >
                  {isAuthenticated && nextAction?.route ? (
                    <Link to={nextAction.route}>
                      {nextAction.label?.[language] || (language === "en" ? "Get Started Now" : "ابدأ الآن")}
                      <ArrowRight className="ml-2 w-6 h-6" />
                    </Link>
                  ) : (
                    <span>
                      {language === "en" ? "Get Started Now" : "ابدأ الآن"}
                      <ArrowRight className="ml-2 w-6 h-6" />
                    </span>
                  )}
                </Button>
              </div>

              <div className="relative">
                <div className="absolute -inset-4 bg-blue-500/10 blur-2xl rounded-full" />
                <Card className="relative border-0 shadow-2xl bg-card overflow-hidden rounded-[2rem]">
                  <CardContent className="p-8">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between pb-4 border-b border-border">
                        <div className="font-bold text-foreground">
                          {language === "en" ? "Registration Benefits" : "مميزات التسجيل"}
                        </div>
                        <Badge className="bg-green-500">ACTIVE</Badge>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                            <Bell className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-foreground font-medium">{language === "en" ? "Live Trading Signals" : "إشارات تداول حية"}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                            <LineChart className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-foreground font-medium">{language === "en" ? "Market Analysis Tools" : "أدوات تحليل السوق"}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0">
                            <Users className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-foreground font-medium">{language === "en" ? "Dedicated Account Manager" : "مدير حساب متخصص"}</span>
                        </div>

                        <div className="h-px bg-border my-2" />

                        <div className="flex items-center justify-center gap-2 bg-emerald-500/10 rounded-lg p-2 border border-emerald-500/20">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-emerald-600 font-bold text-sm">
                            {language === "en" ? "All FREE on Registration" : "كلها مجانية عند التسجيل"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {t.features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}>

                  <Card className="h-full hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-0 bg-card shadow-lg rounded-3xl">
                    <CardContent className="p-6">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center mb-4 shadow-lg">
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <h3 className="text-xl font-bold mb-2 text-foreground">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground">{feature.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>);

            })}
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
                {t.whyChoose.title}
              </h2>
              <p className="text-xl text-muted-foreground mb-10">
                {t.whyChoose.subtitle}
              </p>
              <div className="grid sm:grid-cols-2 gap-6">
                {t.whyChoose.reasons.map((reason, idx) =>
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                      <CheckCircle className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-foreground font-medium">{reason}</span>
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative">
              <div className="absolute -inset-4 bg-blue-500/10 blur-3xl rounded-full" />
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6918477c99a4af56630b48a6/960fe71f0_c32b0808-8445-4776-a5ac-79a60d1d694a.png"
                alt="AI Trading Platform"
                className="relative rounded-[2.5rem] shadow-2xl border border-border" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute w-full h-full" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(59, 130, 246, 0.3) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }} />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">{t.steps.title}</h2>
            <div className="w-24 h-1.5 bg-blue-600 mx-auto rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {t.steps.items.map((step, idx) =>
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="relative group">
                {idx < 3 && (
                  <div className="hidden lg:block absolute top-10 left-full w-full h-0.5 bg-gradient-to-r from-blue-600 to-transparent z-0" />
                )}
                <div className="relative z-10">
                  <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center text-3xl font-bold mb-8 shadow-xl shadow-blue-600/20 group-hover:scale-110 transition-transform duration-500">
                    {idx + 1}
                  </div>
                  <h3 className="text-2xl font-bold mb-4">{step.title}</h3>
                  <p className="text-white/70 text-lg leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            )}
          </div>

          <div className="mt-20 text-center">
            <Button
              size="lg"
              className="bg-white text-slate-900 hover:bg-gray-100 rounded-full px-12 py-8 text-xl font-bold shadow-2xl hover:scale-105 transition-all"
              asChild={isAuthenticated && !!nextAction?.route}
              onClick={!isAuthenticated ? navigateToLogin : undefined}
              disabled={loadingReadiness}
            >
              {isAuthenticated && nextAction?.route ? (
                <Link to={nextAction.route}>
                  {nextAction.label?.[language] || (language === "en" ? "Open Your Account Now" : "افتح حسابك الآن")}
                </Link>
              ) : (
                <span>
                  {language === "en" ? "Open Your Account Now" : "افتح حسابك الآن"}
                </span>
              )}
            </Button>
          </div>
        </div>
      </section>
    </div>);
}

Home.propTypes = {
  language: PropTypes.string
};