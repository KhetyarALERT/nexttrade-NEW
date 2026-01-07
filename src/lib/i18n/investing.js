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

    howItWorksTitle: "كيف يعمل",
    howItWorksP1: "اختر محفظة USDT، حدّد المبلغ، ثم اختر مدة القفل لتحصل على عائد سنوي (APY).",
    howItWorksP2: "بعد انتهاء مدة القفل يمكنك سحب المبلغ مع الأرباح.",
    howItWorksNote: "ملاحظة: الإلغاء المبكر قد يخصم جزءًا من الأرباح وفقًا لشروط المنتج.",
  },
};

export function tInvesting(language) {
  return investingI18n[language] || investingI18n.en;
}
