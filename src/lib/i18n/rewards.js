export const rewardsI18n = {
  en: {
    title: "Rewards",
    subtitle: "Earn more with daily check-in and tasks",
    daily: "Daily Check-In",
    checkIn: "Check in",
    checkedIn: "Checked in",
    streak: "Streak",
    tasks: "Tasks",
    vouchersTitle: "Position Vouchers",
    vouchersSubtitle: "Rewards are issued as position vouchers (UI + Base44 wired).",
    claim: "Claim",
    claimed: "Claimed",
    notEligible: "Not eligible",
    eligible: "Eligible",
  },
  ar: {
    title: "المكافآت",
    subtitle: "اكسب أكثر عبر تسجيل الدخول اليومي والمهام",
    daily: "تسجيل يومي",
    checkIn: "سجّل الآن",
    checkedIn: "تم التسجيل",
    streak: "سلسلة الأيام",
    tasks: "المهام",
    vouchersTitle: "قسائم المراكز",
    vouchersSubtitle: "المكافآت تصدر كقسائم مراكز (واجهة + ربط Base44).",
    claim: "مطالبة",
    claimed: "تمت المطالبة",
    notEligible: "غير مؤهل",
    eligible: "مؤهل",
  },
};

export function tRewards(language) {
  return rewardsI18n[language] || rewardsI18n.en;
}
