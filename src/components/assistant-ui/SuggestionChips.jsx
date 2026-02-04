import PropTypes from "prop-types";
import { Play, HelpCircle, Headphones, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";

/**
 * Contextual suggestion chips that appear after assistant replies.
 * Maps detected topics to relevant follow-up actions.
 */

// Topic detection keywords → suggestion sets
const TOPIC_SUGGESTIONS = {
  kyc: {
    keywords: ["kyc", "توثيق", "verify", "verification", "identity", "هوية", "document", "وثيقة", "passport", "جواز"],
    suggestions: [
      { key: "watch_kyc_video", label_en: "Watch KYC guide", label_ar: "شاهد شرح التوثيق", type: "video", youtubeId: "R7IeJxSWkP8" },
      { key: "open_security", label_en: "Go to Security", label_ar: "فتح الأمان", type: "route", route: "Profile?tab=security" },
      { key: "kyc_docs", label_en: "What documents?", label_ar: "ما المستندات المطلوبة؟", type: "prompt" },
      { key: "talk_human", label_en: "Talk to support", label_ar: "تحدث مع الدعم", type: "ticket" },
    ],
  },
  deposit: {
    keywords: ["deposit", "إيداع", "add funds", "إضافة رصيد", "تحويل", "transfer in"],
    suggestions: [
      { key: "deposit_steps", label_en: "Deposit steps", label_ar: "خطوات الإيداع", type: "prompt" },
      { key: "open_deposit", label_en: "Go to Deposit", label_ar: "فتح الإيداع", type: "route", route: "Wallet?page=deposit" },
      { key: "deposit_fees", label_en: "Fees & limits", label_ar: "الرسوم والحدود", type: "prompt" },
      { key: "talk_human", label_en: "Talk to support", label_ar: "تحدث مع الدعم", type: "ticket" },
    ],
  },
  withdraw: {
    keywords: ["withdraw", "سحب", "withdrawal", "cash out", "send funds"],
    suggestions: [
      { key: "withdraw_steps", label_en: "Withdraw steps", label_ar: "خطوات السحب", type: "prompt" },
      { key: "open_withdraw", label_en: "Open Withdraw", label_ar: "فتح صفحة السحب", type: "route", route: "Wallet?page=withdraw" },
      { key: "withdraw_status", label_en: "Check pending", label_ar: "حالة السحب", type: "prompt" },
      { key: "talk_human", label_en: "Talk to support", label_ar: "تحدث مع الدعم", type: "ticket" },
    ],
  },
  trading: {
    keywords: ["trade", "تداول", "futures", "عقود", "position", "صفقة", "leverage", "رافعة", "order", "أمر"],
    suggestions: [
      { key: "first_trade", label_en: "How to trade", label_ar: "كيف أتداول؟", type: "prompt" },
      { key: "open_futures", label_en: "Open Futures", label_ar: "فتح العقود", type: "route", route: "Futures" },
      { key: "leverage_help", label_en: "About leverage", label_ar: "عن الرافعة المالية", type: "prompt" },
      { key: "talk_human", label_en: "Talk to support", label_ar: "تحدث مع الدعم", type: "ticket" },
    ],
  },
  copy_trading: {
    keywords: ["copy", "نسخ", "signal", "إشارة", "bot", "auto", "تلقائي"],
    suggestions: [
      { key: "copy_enable", label_en: "Enable Copy Trading", label_ar: "تفعيل نسخ التداول", type: "prompt" },
      { key: "open_copy", label_en: "Go to Copy Trading", label_ar: "فتح نسخ التداول", type: "route", route: "Futures?tab=bots" },
      { key: "copy_settings", label_en: "Copy settings", label_ar: "إعدادات النسخ", type: "prompt" },
      { key: "talk_human", label_en: "Talk to support", label_ar: "تحدث مع الدعم", type: "ticket" },
    ],
  },
  staking: {
    keywords: ["stake", "staking", "ستيكينغ", "earn", "ربح", "apy", "lock"],
    suggestions: [
      { key: "staking_plans", label_en: "View plans", label_ar: "عرض الخطط", type: "route", route: "Investing" },
      { key: "staking_how", label_en: "How staking works", label_ar: "كيف يعمل الستيكينغ؟", type: "prompt" },
      { key: "staking_rewards", label_en: "My rewards", label_ar: "مكافآتي", type: "prompt" },
      { key: "talk_human", label_en: "Talk to support", label_ar: "تحدث مع الدعم", type: "ticket" },
    ],
  },
  rewards: {
    keywords: ["reward", "مكافأة", "bonus", "mission", "مهمة", "points", "نقاط", "voucher"],
    suggestions: [
      { key: "open_rewards", label_en: "Go to Rewards", label_ar: "فتح المكافآت", type: "route", route: "Rewards" },
      { key: "daily_checkin", label_en: "Daily check-in", label_ar: "التسجيل اليومي", type: "prompt" },
      { key: "missions", label_en: "Available missions", label_ar: "المهام المتاحة", type: "prompt" },
      { key: "talk_human", label_en: "Talk to support", label_ar: "تحدث مع الدعم", type: "ticket" },
    ],
  },
  referral: {
    keywords: ["refer", "إحالة", "invite", "دعوة", "friend", "صديق", "commission", "عمولة"],
    suggestions: [
      { key: "open_referrals", label_en: "My Referrals", label_ar: "إحالاتي", type: "route", route: "Rewards?tab=referrals" },
      { key: "referral_link", label_en: "Get my link", label_ar: "رابط الإحالة", type: "prompt" },
      { key: "referral_rewards", label_en: "Referral rewards", label_ar: "مكافآت الإحالة", type: "prompt" },
      { key: "talk_human", label_en: "Talk to support", label_ar: "تحدث مع الدعم", type: "ticket" },
    ],
  },
  password: {
    keywords: ["password", "كلمة المرور", "login", "تسجيل دخول", "security", "أمان", "2fa", "otp"],
    suggestions: [
      { key: "open_security", label_en: "Security settings", label_ar: "إعدادات الأمان", type: "route", route: "Profile?tab=security" },
      { key: "change_password", label_en: "Change password", label_ar: "تغيير كلمة المرور", type: "prompt" },
      { key: "enable_2fa", label_en: "Enable 2FA", label_ar: "تفعيل التحقق", type: "prompt" },
      { key: "talk_human", label_en: "Talk to support", label_ar: "تحدث مع الدعم", type: "prompt" },
    ],
  },
};

// Default suggestions when no topic detected
const DEFAULT_SUGGESTIONS = [
  { key: "help_deposit", label_en: "How to deposit", label_ar: "كيف أودع؟", type: "prompt" },
  { key: "help_trade", label_en: "How to trade", label_ar: "كيف أتداول؟", type: "prompt" },
  { key: "help_withdraw", label_en: "How to withdraw", label_ar: "كيف أسحب؟", type: "prompt" },
  { key: "talk_human", label_en: "Talk to support", label_ar: "تحدث مع الدعم", type: "ticket" },
];

/**
 * Create support ticket via backend function
 */
export async function createTicketDirect(category, message, route, language) {
  try {
    const response = await base44.functions.invoke('createSupportTicket', {
      category: category || 'general',
      message,
      route,
      language,
    });
    return response.data;
  } catch (err) {
    console.error('Failed to create ticket:', err);
    return { ok: false, error: err.message };
  }
}

/**
 * Detect topic from conversation text
 */
function detectTopic(text) {
  if (!text) return null;
  const lowerText = text.toLowerCase();
  
  for (const [topic, config] of Object.entries(TOPIC_SUGGESTIONS)) {
    for (const keyword of config.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return topic;
      }
    }
  }
  return null;
}

/**
 * Get suggestions based on recent conversation
 */
export function getSuggestionsForConversation(messages, currentRoute) {
  // Look at last 3 messages for context
  const recentText = messages
    .slice(-3)
    .map(m => m.content || "")
    .join(" ");
  
  const topic = detectTopic(recentText);
  
  if (topic && TOPIC_SUGGESTIONS[topic]) {
    return TOPIC_SUGGESTIONS[topic].suggestions.slice(0, 4);
  }
  
  return DEFAULT_SUGGESTIONS;
}

export default function SuggestionChips({ 
  suggestions, 
  language = "en", 
  onSelect, 
  onRoute, 
  onVideo,
  onTicket,
  disabled = false 
}) {
  const isRtl = language === "ar";

  if (!suggestions?.length) return null;

  const handleClick = (suggestion) => {
    if (suggestion.type === "route" && onRoute) {
      onRoute(createPageUrl(suggestion.route));
    } else if (suggestion.type === "video" && onVideo) {
      onVideo(suggestion.youtubeId, suggestion.label_en);
    } else if (suggestion.type === "ticket" && onTicket) {
      onTicket();
    } else if (suggestion.type === "prompt" && onSelect) {
      const label = language === "ar" ? suggestion.label_ar : suggestion.label_en;
      onSelect(suggestion.key, label);
    }
  };

  const getIcon = (type, key) => {
    if (key === "talk_human") return Headphones;
    switch (type) {
      case "route": return ArrowRight; // Use arrow instead of external link (SPA navigation)
      case "video": return Play;
      case "ticket": return Headphones;
      default: return HelpCircle;
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-2 py-2", isRtl && "justify-end")}>
      {suggestions.map((suggestion) => {
        const Icon = getIcon(suggestion.type, suggestion.key);
        const label = language === "ar" ? suggestion.label_ar : suggestion.label_en;
        const isTalkHuman = suggestion.key === "talk_human" || suggestion.type === "ticket";
        
        return (
          <button
            key={suggestion.key}
            type="button"
            disabled={disabled}
            onClick={() => handleClick(suggestion)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5",
              "text-xs font-medium transition-all",
              "active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
              isRtl && "flex-row-reverse",
              isTalkHuman 
                ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                : "border-border/60 bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30"
            )}
          >
            <Icon className="h-3 w-3" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

SuggestionChips.propTypes = {
  suggestions: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    label_en: PropTypes.string.isRequired,
    label_ar: PropTypes.string.isRequired,
    type: PropTypes.oneOf(["prompt", "route", "video", "ticket"]).isRequired,
    route: PropTypes.string,
    youtubeId: PropTypes.string,
  })),
  language: PropTypes.oneOf(["en", "ar"]),
  onSelect: PropTypes.func,
  onRoute: PropTypes.func,
  onVideo: PropTypes.func,
  onTicket: PropTypes.func,
  disabled: PropTypes.bool,
};