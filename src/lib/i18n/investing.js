export const investingI18n = {
  en: {
    title: "Investing",
    subtitle: "Earn yield with smart staking strategies",
    staking: "Staking",
    refresh: "Refresh",
    note: "Staking products may vary by wallet and availability.",

    stakingVouchersTitle: "Staking Rewards (Position Vouchers)",
    stakingVouchersSubtitle: "Pick an amount and duration to earn a reward % as a position voucher.",
    amount: "Amount",
    days: "Days",
    reward: "Reward",
    promosTitle: "Bonus boosts",
    promoNewUser: "100% one-time staking bonus for new users",
    promoFiveK: "200% one-time bonus for 5,000 USDT stakes (50–60 days)",
    whatIsTitle: "What is staking/investing?",
    whatIsP1: "Staking locks your USDT for a fixed period so you can earn a predictable reward. Investing lets you grow funds while you stay in control of your risk and timeline.",
    whatIsP2: "Pick a lock period, confirm your amount, and a countdown starts. When the timer ends, you receive your principal plus rewards.",
    whatIsHint: "Beginner tip: Longer lock periods usually unlock higher rewards.",
    countdownLabel: "Countdown to unlock",
    countdownStarts: "Timer starts after confirmation",

    howItWorksTitle: "How it works",
    howItWorksP1: "Choose your USDT wallet, enter an amount, then pick a lock period to earn APY.",
    howItWorksP2: "After the lock period ends, you can withdraw principal plus rewards.",
    howItWorksNote: "Note: Early unstaking may reduce earned rewards per product terms.",
  },
  ar: {
    title: "الاستثمار",
    subtitle: "اكسب عوائد عبر استراتيجيات استثمار ذكية",
    staking: "الاستثمار",
    refresh: "تحديث",
    note: "قد تختلف منتجات الاستثمار حسب المحفظة والتوفر.",

    stakingVouchersTitle: "مكافآت الرهن (قسائم المراكز)",
    stakingVouchersSubtitle: "اختر المبلغ والمدة لتحصل على نسبة مكافأة كقسيمة مركز.",
    amount: "المبلغ",
    days: "يوم",
    reward: "المكافأة",
    promosTitle: "مزايا إضافية",
    promoNewUser: "مكافأة استثمار 100% لمرة واحدة للمستخدمين الجدد",
    promoFiveK: "مكافأة 200% لمرة واحدة لرهان 5,000 USDT لمدة 50–60 يومًا",
    whatIsTitle: "ما هو الاستثمار/الستاكينغ؟",
    whatIsP1: "الستاكينغ يعني قفل USDT لفترة محددة للحصول على مكافأة واضحة. الاستثمار يساعدك على تنمية أموالك مع التحكم في المخاطر والمدة.",
    whatIsP2: "اختر مدة القفل، أكد المبلغ، وسيبدأ عدّاد الوقت. عند انتهاء المؤقت تستلم المبلغ مع الأرباح.",
    whatIsHint: "نصيحة للمبتدئين: كلما زادت مدة القفل زادت المكافآت عادةً.",
    countdownLabel: "الوقت المتبقي حتى فك القفل",
    countdownStarts: "يبدأ المؤقت بعد التأكيد",

    howItWorksTitle: "كيف يعمل",
    howItWorksP1: "اختر محفظة USDT، حدّد المبلغ، ثم اختر مدة القفل لتحصل على عائد سنوي (APY).",
    howItWorksP2: "بعد انتهاء مدة القفل يمكنك سحب المبلغ مع الأرباح.",
    howItWorksNote: "ملاحظة: الإلغاء المبكر قد يخصم جزءًا من الأرباح وفقًا لشروط المنتج.",
  },
};

export function tInvesting(language) {
  return investingI18n[language] || investingI18n.en;
}
