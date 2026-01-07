// Centralized Rewards/Vouchers configuration (EN/AR)
// Keep this file as the source of truth for voucher definitions.

export function pickLang(language, value) {
  if (value && typeof value === "object" && ("en" in value || "ar" in value)) {
    return language === "ar" ? (value.ar ?? value.en ?? "") : (value.en ?? value.ar ?? "");
  }
  return String(value ?? "");
}

export const POSITION_VOUCHERS = {
  milestones: [
    {
      id: "signup",
      title: { en: "Welcome Position Voucher", ar: "قسيمة مركز ترحيبية" },
      condition: { en: "Sign up", ar: "إنشاء حساب" },
      reward: { en: "Position voucher (starter)", ar: "قسيمة مركز (مبتدئ)" },
      status: "New",
    },
    {
      id: "verify",
      title: { en: "Verified Account Voucher", ar: "قسيمة توثيق الحساب" },
      condition: { en: "Verify account", ar: "توثيق الحساب" },
      reward: { en: "Position voucher (boost)", ar: "قسيمة مركز (تعزيز)" },
      status: "New",
    },
    {
      id: "first_deposit",
      title: { en: "Deposit Voucher", ar: "قسيمة الإيداع" },
      condition: { en: "Make your first deposit", ar: "إتمام أول إيداع" },
      reward: { en: "Position voucher (boost)", ar: "قسيمة مركز (تعزيز)" },
      status: "New",
    },
    {
      id: "first_stake",
      title: { en: "First Stake Voucher", ar: "قسيمة أول رهن" },
      condition: { en: "Stake any amount", ar: "رهن أي مبلغ" },
      reward: { en: "Position voucher (boost)", ar: "قسيمة مركز (تعزيز)" },
      status: "New",
    },
    {
      id: "deposit_500",
      title: { en: "$50 Trading Bonus", ar: "مكافأة تداول $50" },
      condition: { en: "Min. deposit $500", ar: "حد أدنى للإيداع $500" },
      reward: { en: "Position voucher", ar: "قسيمة مركز" },
      expiry: "2026-02-15",
      status: "Active",
    },
    {
      id: "zero_fee_5",
      title: { en: "Zero Fee Trade", ar: "صفقات بدون رسوم" },
      condition: { en: "Valid for 5 trades", ar: "صالحة لـ 5 صفقات" },
      reward: { en: "Position voucher", ar: "قسيمة مركز" },
      expiry: "2026-01-30",
      status: "New",
    },
  ],

  // Staking voucher tiers (reward % issued as position vouchers)
  stakeTiers: {
    amounts: [100, 200, 500, 1000, 2500, 5000, 10000],
    durations: [7, 30, 90],

    // Increased reward percentages (requested: “increase the % rewards”).
    // These are voucher reward percentages, not APY.
    percentByDuration: {
      7: 15,
      30: 22,
      90: 40,
    },
  },
};

// Dashboard uses a compact list.
export const DASHBOARD_VOUCHERS = POSITION_VOUCHERS.milestones.slice(-2);
