
import { useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Shield,
  Zap,
  Globe,
  DollarSign,
  LineChart,
  Users,
  CheckCircle,
  ArrowRight,
  BarChart3,
  Coins,
  Sparkles,
  Gift,
  Bell,
  Wallet,
  Bot,
  Activity,
  TrendingDown
} from "lucide-react";
import { motion } from "framer-motion";
import AITradingChat from "../components/home/AITradingChat";
import CryptoPriceTable from "../components/trading/CryptoPriceTable";

export default function Home({ language = "en" }) {
  const [hoveredCard, setHoveredCard] = useState(null);

  const content = {
    en: {
      hero: {
        title: "Trade Crypto Smarter with NextTrade",
        subtitle: "Access real-time crypto markets with intelligent AI-powered automation",
        cta1: "Open Live Account",
        cta2: "Try Demo Account"
      },
      stats: [
        { value: "24/7", label: "Crypto Trading" },
        { value: "0.0", label: "Commission" },
        { value: "Instant", label: "Withdrawals" },
        { value: "<1s", label: "Execution" }],

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
        { icon: Shield, title: "Trusted Broker", desc: "Regulated and secure crypto trading environment" },
        { icon: Zap, title: "Instant Execution", desc: "Lightning-fast order execution in milliseconds" },
        { icon: DollarSign, title: "Zero Commission", desc: "No hidden fees or commission charges" },
        { icon: Globe, title: "Global Access", desc: "Trade from anywhere in the world 24/7" }],

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
        title: "تداول العملات الرقمية بذكاء مع NextTrade",
        subtitle: "احصل على وصول فوري لأسواق العملات الرقمية مع أتمتة ذكية مدعومة بالذكاء الاصطناعي",
        cta1: "فتح حساب حقيقي",
        cta2: "تجربة حساب تجريبي"
      },
      stats: [
        { value: "24/7", label: "تداول العملات الرقمية" },
        { value: "0.0", label: "عمولة" },
        { value: "فوري", label: "سحوبات" },
        { value: "<1s", label: "تنفيذ فوري" }],

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
        { icon: Shield, title: "وسيط موثوق", desc: "بيئة تداول عملات رقمية آمنة ومنظمة" },
        { icon: Zap, title: "تنفيذ فوري", desc: "تنفيذ الأوامر بسرعة البرق في أجزاء من الثانية" },
        { icon: DollarSign, title: "بدون عمولة", desc: "لا رسوم خفية أو عمولات" },
        { icon: Globe, title: "وصول عالمي", desc: "تداول من أي مكان في العالم على مدار الساعة" }],

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

  return (
    <div className="overflow-hidden bg-white">
      {/* Hero Section - Enhanced with AI Chat */}
      <section className="relative min-h-[95vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute w-full h-full" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(59, 130, 246, 0.3) 1px, transparent 0)`,
            backgroundSize: '50px 50px'
          }} />
        </div>

        {/* Background Image Layer */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{
            backgroundImage: 'url(https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6918477c99a4af56630b48a6/1cdf8d782_c7d6b2f5-1e27-4f66-98bd-6e7460b52810.png)'
          }} />


        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-transparent to-cyan-600/20" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/50 to-slate-950" />

        {/* Content Layer */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 z-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}>

              {/* Animated Hero Title */}
              <motion.h1
                className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.2 }}>

                {t.hero.title.split(' ').map((word, idx) =>
                  <motion.span
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 + idx * 0.1 }}
                    className="inline-block mr-3">

                    {word}
                  </motion.span>
                )}
              </motion.h1>

              <motion.p
                className="text-xl md:text-2xl text-gray-300 mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.8 }}>

                {t.hero.subtitle}
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row gap-4 mb-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.2 }}>

                <Button
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 py-6 text-lg font-semibold shadow-xl shadow-blue-500/20 hover:scale-105 transition-all"
                  asChild>
                  <Link to={createPageUrl("Contact")}>{t.hero.cta1}</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10 rounded-full px-8 py-6 text-lg font-semibold backdrop-blur-sm hover:scale-105 transition-all"
                  asChild>
                  <Link to={createPageUrl("Contact")}>{t.hero.cta2}</Link>
                </Button>
              </motion.div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {t.stats.map((stat, idx) =>
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 1.4 + idx * 0.1 }}>
                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                    <div className="text-sm text-gray-400">{stat.label}</div>
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* Right Content - AI Chat Model */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="relative">
              <div className="absolute -inset-4 bg-blue-500/20 blur-3xl rounded-full animate-pulse" />
              <div className="relative bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
                <AITradingChat language={language} />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Exclusive Offers Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-blue-100 text-blue-600 hover:bg-blue-100 border-0 px-4 py-1">
              {language === "en" ? "Limited Time Offer" : "عرض لفترة محدودة"}
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900">
              {t.exclusiveOffers.title}
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
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

                  <Card className="h-full border-0 shadow-xl hover:shadow-2xl transition-all duration-500 group bg-white overflow-hidden">
                    <div className={`h-2 bg-gradient-to-r ${offer.color}`} />
                    <CardContent className="p-8">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${offer.color} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <Badge variant="secondary" className="mb-4 bg-slate-100 text-slate-600">
                        {offer.badge}
                      </Badge>
                      <h3 className="text-xl font-bold mb-3 text-slate-900">{offer.title}</h3>
                      <p className="text-slate-600 leading-relaxed">{offer.desc}</p>
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

            <div className="grid lg:grid-cols-2 gap-12 items-center bg-white rounded-[2.5rem] p-8 md:p-16 shadow-2xl border border-slate-100">
              <div>
                <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                  {language === "en" ? "Why wait? Start your journey today" : "لماذا الانتظار؟ ابدأ رحلتك اليوم"}
                </h3>
                <div className="space-y-6">
                  {[
                    { t: "Instant account approval", a: "موافقة فورية على الحساب" },
                    { t: "Zero deposit fees", a: "بدون رسوم إيداع" },
                    { t: "Personal AI trading coach", a: "مدرب تداول شخصي بالذكاء الاصطناعي" }
                  ].map((item, i) =>
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="text-lg text-slate-700 font-medium">
                        {language === "en" ? item.t : item.a}
                      </span>
                    </div>
                  )}
                </div>
                <Button
                  size="lg"
                  className="mt-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-10 py-7 text-xl font-bold shadow-2xl shadow-blue-500/30 hover:scale-105 transition-all w-full sm:w-auto"
                  asChild>

                  <Link to={createPageUrl("Contact")}>
                    {language === "en" ? "Get Started Now" : "ابدأ الآن"}
                    <ArrowRight className="ml-2 w-6 h-6" />
                  </Link>
                </Button>
              </div>

              <div className="relative">
                <div className="absolute -inset-4 bg-blue-500/10 blur-2xl rounded-full" />
                <Card className="relative border-0 shadow-2xl bg-gradient-to-br from-blue-50 to-white overflow-hidden">
                  <CardContent className="p-8">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between pb-4 border-b border-blue-100">
                        <div className="font-bold text-blue-900">
                          {language === "en" ? "Registration Benefits" : "مميزات التسجيل"}
                        </div>
                        <Badge className="bg-green-500">ACTIVE</Badge>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                            <Bell className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-gray-700 font-medium">{language === "en" ? "Live Trading Signals" : "إشارات تداول حية"}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                            <LineChart className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-gray-700 font-medium">{language === "en" ? "Market Analysis Tools" : "أدوات تحليل السوق"}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0">
                            <Users className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-gray-700 font-medium">{language === "en" ? "Dedicated Account Manager" : "مدير حساب متخصص"}</span>
                        </div>

                        <div className="h-px bg-blue-300 my-2" />

                        <div className="flex items-center justify-center gap-2 bg-green-100 rounded-lg p-2 border border-green-300">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-green-800 font-bold text-sm">
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
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
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

                  <Card className="h-full hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-0 bg-white shadow-lg">
                    <CardContent className="p-6">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center mb-4 shadow-lg">
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <h3 className="text-xl font-bold mb-2 text-gray-900">
                        {feature.title}
                      </h3>
                      <p className="text-gray-600">{feature.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>);

            })}
          </div>
        </div>
      </section>

      {/* Live Crypto Markets Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Crypto Image */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative">

              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <img
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6918477c99a4af56630b48a6/ac624df0c_f51701e3-dbf6-4070-88f9-c4844c0a676e.png"
                  alt="Crypto Trading"
                  className="w-full h-auto" />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />

                {/* Floating Badge */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="absolute bottom-8 left-8 right-8">

                  <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-3xl font-bold text-gray-900">BTC/USD</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {language === "ar" ? "تداول البيتكوين مع فروقات منخفضة" : "Trade Bitcoin with Low Spreads"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-500">$96,654.32</div>
                        <div className="text-sm text-green-500 flex items-center gap-1 justify-end">
                          <TrendingUp className="w-4 h-4" />
                          +2.45%
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Right Side - Real-time Crypto Table */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}>
              <CryptoPriceTable language={language} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900">
                {t.whyChoose.title}
              </h2>
              <p className="text-xl text-slate-600 mb-10">
                {t.whyChoose.subtitle}
              </p>
              <div className="grid sm:grid-cols-2 gap-6">
                {t.whyChoose.reasons.map((reason, idx) =>
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                      <CheckCircle className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-slate-700 font-medium">{reason}</span>
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
                className="relative rounded-3xl shadow-2xl border border-slate-100" />
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
                  <p className="text-gray-400 text-lg leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            )}
          </div>

          <div className="mt-20 text-center">
            <Button
              size="lg"
              className="bg-white text-slate-900 hover:bg-gray-100 rounded-full px-12 py-8 text-xl font-bold shadow-2xl hover:scale-105 transition-all"
              asChild>
              <Link to={createPageUrl("Contact")}>
                {language === "en" ? "Open Your Account Now" : "افتح حسابك الآن"}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>);
}

Home.propTypes = {
  language: PropTypes.string
};
