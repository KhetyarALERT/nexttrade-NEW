import PropTypes from "prop-types";
import { Shield, Wallet, ArrowDownToLine, TrendingUp, Copy, Landmark, Gift, Key, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  { key: "kyc_start", icon: Shield, label_ar: "توثيق الحساب", label_en: "Verify Account" },
  { key: "deposit_usdt", icon: ArrowDownToLine, label_ar: "إيداع", label_en: "Deposit" },
  { key: "withdraw_usdt", icon: Wallet, label_ar: "سحب", label_en: "Withdraw" },
  { key: "first_trade", icon: TrendingUp, label_ar: "أول صفقة", label_en: "First Trade" },
  { key: "copy_trading_enable", icon: Copy, label_ar: "نسخ التداول", label_en: "Copy Trading" },
  { key: "staking_start", icon: Landmark, label_ar: "الستيكينغ", label_en: "Staking" },
  { key: "rewards_hub", icon: Gift, label_ar: "المكافآت", label_en: "Rewards" },
  { key: "password_change", icon: Key, label_ar: "كلمة المرور", label_en: "Password" },
  { key: "referrals", icon: Users, label_ar: "الإحالات", label_en: "Referrals" },
];

export default function QuickActions({ language = "en", onSelect, disabled = false }) {
  const isRtl = language === "ar";

  return (
    <div className={cn("flex flex-wrap gap-2 py-3", isRtl && "justify-end")}>
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        const label = language === "ar" ? action.label_ar : action.label_en;
        return (
          <button
            key={action.key}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(action.key, label)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/50 px-3 py-1.5",
              "text-xs font-medium text-muted-foreground transition-all",
              "hover:bg-primary/10 hover:text-primary hover:border-primary/30",
              "active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
              isRtl && "flex-row-reverse"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

QuickActions.propTypes = {
  language: PropTypes.oneOf(["en", "ar"]),
  onSelect: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export { QUICK_ACTIONS };