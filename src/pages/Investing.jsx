import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Lock, TrendingUp, Shield, Clock, Sparkles, CheckCircle2, Zap, Gift, ArrowRight } from "lucide-react";
import StakingPanel from "@/components/profile/StakingPanel";
import { motion } from "framer-motion";
import CryptoIcon from "@/components/ui/CryptoIcon";

const stakingPlans = [
  {
    id: "flex",
    name: { en: "Flexible", ar: "مرن" },
    apy: "5.2%",
    apyValue: 5.2,
    lockPeriod: { en: "No lock", ar: "بدون قفل" },
    minAmount: 50,
    features: { en: ["Withdraw anytime", "Daily rewards", "Auto-compound"], ar: ["سحب في أي وقت", "مكافآت يومية", "تراكم تلقائي"] },
    popular: false,
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    id: "30d",
    name: { en: "30 Days", ar: "30 يوم" },
    apy: "8.5%",
    apyValue: 8.5,
    lockPeriod: { en: "30 days", ar: "30 يوم" },
    minAmount: 100,
    features: { en: ["Higher returns", "Daily rewards", "Principal protected"], ar: ["عوائد أعلى", "مكافآت يومية", "رأس المال محمي"] },
    popular: true,
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    id: "90d",
    name: { en: "90 Days", ar: "90 يوم" },
    apy: "12.8%",
    apyValue: 12.8,
    lockPeriod: { en: "90 days", ar: "90 يوم" },
    minAmount: 500,
    features: { en: ["Maximum returns", "Priority support", "Bonus rewards"], ar: ["أقصى عوائد", "دعم أولوية", "مكافآت إضافية"] },
    popular: false,
    gradient: "from-purple-500 to-pink-500",
  },
  {
    id: "180d",
    name: { en: "180 Days", ar: "180 يوم" },
    apy: "18.5%",
    apyValue: 18.5,
    lockPeriod: { en: "180 days", ar: "180 يوم" },
    minAmount: 1000,
    features: { en: ["Premium APY", "VIP benefits", "Exclusive access"], ar: ["APY مميز", "مزايا VIP", "وصول حصري"] },
    popular: false,
    gradient: "from-orange-500 to-red-500",
  },
];

const t = {
  en: {
    title: "Earn & Invest",
    subtitle: "Put your crypto to work with industry-leading APY rates",
    totalStaked: "Total Staked",
    totalEarned: "Total Earned",
    activePositions: "Active Positions",
    avgApy: "Avg. APY",
    choosePlan: "Choose Your Plan",
    planSubtitle: "Lock your USDT and earn daily rewards",
    minDeposit: "Min. deposit",
    lockPeriod: "Lock period",
    selectPlan: "Select Plan",
    popular: "Most Popular",
    new: "New",
    howItWorks: "How It Works",
    step1Title: "Deposit",
    step1Desc: "Transfer USDT to your account",
    step2Title: "Choose Plan",
    step2Desc: "Select your preferred staking duration",
    step3Title: "Earn",
    step3Desc: "Watch your balance grow daily",
    whyStake: "Why Stake with NextTrade?",
    benefit1: "Institutional-grade security",
    benefit2: "Daily reward distribution",
    benefit3: "No hidden fees",
    benefit4: "24/7 customer support",
    myPositions: "My Staking Positions",
    refresh: "Refresh",
    noWallet: "Connect wallet to start earning",
  },
  ar: {
    title: "الكسب والاستثمار",
    subtitle: "ضع عملاتك الرقمية في العمل مع أفضل معدلات APY في الصناعة",
    totalStaked: "إجمالي المودع",
    totalEarned: "إجمالي المكتسب",
    activePositions: "المراكز النشطة",
    avgApy: "متوسط APY",
    choosePlan: "اختر خطتك",
    planSubtitle: "اقفل USDT الخاص بك واربح مكافآت يومية",
    minDeposit: "الحد الأدنى للإيداع",
    lockPeriod: "فترة القفل",
    selectPlan: "اختر الخطة",
    popular: "الأكثر شعبية",
    new: "جديد",
    howItWorks: "كيف يعمل",
    step1Title: "إيداع",
    step1Desc: "حول USDT إلى حسابك",
    step2Title: "اختر خطة",
    step2Desc: "حدد مدة الستيكنج المفضلة",
    step3Title: "اربح",
    step3Desc: "شاهد رصيدك ينمو يوميًا",
    whyStake: "لماذا الستيكنج مع NextTrade؟",
    benefit1: "أمان بمستوى مؤسسي",
    benefit2: "توزيع المكافآت يوميًا",
    benefit3: "بدون رسوم خفية",
    benefit4: "دعم عملاء على مدار الساعة",
    myPositions: "مراكز الستيكنج الخاصة بي",
    refresh: "تحديث",
    noWallet: "اربط المحفظة لبدء الكسب",
  },
};

export default function Investing({ language = "en" }) {
  const labels = t[language];
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);

  const usdtWallet = wallets.find((w) => w?.currency === "USDT");
  const totalStaked = wallets.reduce((sum, w) => sum + (w?.staked_balance || 0), 0);
  const totalEarned = 0; // Would be calculated from staking positions

  const loadWallets = useCallback(async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke("wallet", { action: "list" });
      if (result.data?.success) {
        setWallets(result.data.data || []);
      }
    } catch {
      setWallets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  return (
    <div className="min-h-screen bg-background text-foreground" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 pt-8 pb-16">
        <div className="absolute inset-0 bg-grid-white/[0.02] [mask-image:linear-gradient(0deg,transparent,white)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <Badge className="mb-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-4 py-1.5">
              <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
              {language === "en" ? "Up to 18.5% APY" : "حتى 18.5% APY"}
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
              {labels.title}
            </h1>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              {labels.subtitle}
            </p>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { label: labels.totalStaked, value: `$${totalStaked.toLocaleString()}`, icon: Lock, gradient: "from-blue-500 to-cyan-500" },
              { label: labels.totalEarned, value: `$${totalEarned.toLocaleString()}`, icon: TrendingUp, gradient: "from-emerald-500 to-teal-500" },
              { label: labels.activePositions, value: wallets.filter(w => w?.staked_balance > 0).length, icon: Sparkles, gradient: "from-purple-500 to-pink-500" },
              { label: labels.avgApy, value: "12.5%", icon: Zap, gradient: "from-orange-500 to-red-500" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                  <CardContent className="p-4 sm:p-6">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center mb-3`}>
                      <stat.icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-white/50 text-xs sm:text-sm">{stat.label}</p>
                    <p className="text-xl sm:text-2xl font-bold text-white mt-1">{stat.value}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Staking Plans */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 -mt-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{labels.choosePlan}</h2>
            <p className="text-muted-foreground">{labels.planSubtitle}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {stakingPlans.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className={`relative overflow-hidden border-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${
                  plan.popular ? "border-emerald-500 shadow-emerald-500/20 shadow-lg" : "border-border hover:border-primary/50"
                }`}>
                  {plan.popular && (
                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                      {labels.popular}
                    </div>
                  )}
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center`}>
                        <CryptoIcon currency="USDT" size="sm" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground">{plan.name[language]}</h3>
                        <p className="text-xs text-muted-foreground">{labels.lockPeriod}: {plan.lockPeriod[language]}</p>
                      </div>
                    </div>

                    <div className="mb-6">
                      <div className={`text-4xl font-bold bg-gradient-to-r ${plan.gradient} bg-clip-text text-transparent`}>
                        {plan.apy}
                      </div>
                      <p className="text-xs text-muted-foreground">APY</p>
                    </div>

                    <ul className="space-y-2 mb-6">
                      {plan.features[language].map((feature, fi) => (
                        <li key={fi} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="text-xs text-muted-foreground mb-4">
                      {labels.minDeposit}: <span className="font-semibold text-foreground">${plan.minAmount}</span>
                    </div>

                    <Button className={`w-full bg-gradient-to-r ${plan.gradient} hover:opacity-90 text-white border-0`}>
                      {labels.selectPlan}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-10">{labels.howItWorks}</h2>
          
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: Lock, title: labels.step1Title, desc: labels.step1Desc, gradient: "from-blue-500 to-cyan-500" },
              { icon: Sparkles, title: labels.step2Title, desc: labels.step2Desc, gradient: "from-emerald-500 to-teal-500" },
              { icon: TrendingUp, title: labels.step3Title, desc: labels.step3Desc, gradient: "from-purple-500 to-pink-500" },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mx-auto mb-4`}>
                  <step.icon className="w-8 h-8 text-white" />
                </div>
                <div className="text-2xl font-bold text-foreground mb-2">0{i + 1}</div>
                <h3 className="font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Stake Section */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-10">{labels.whyStake}</h2>
          
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Shield, text: labels.benefit1 },
              { icon: Clock, text: labels.benefit2 },
              { icon: CheckCircle2, text: labels.benefit3 },
              { icon: Gift, text: labels.benefit4 },
            ].map((benefit, i) => (
              <Card key={i} className="border-border">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <benefit.icon className="w-6 h-6 text-primary" />
                  </div>
                  <span className="font-medium text-foreground">{benefit.text}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* My Positions */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">{labels.myPositions}</h2>
            <Button variant="outline" onClick={loadWallets} disabled={loading} size="sm">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              {labels.refresh}
            </Button>
          </div>
          
          <StakingPanel wallets={wallets} language={language} onRefresh={loadWallets} />
        </div>
      </section>
    </div>
  );
}

Investing.propTypes = {
  language: PropTypes.oneOf(["en", "ar"]),
};