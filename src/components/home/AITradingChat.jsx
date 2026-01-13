import React from "react";
import PropTypes from "prop-types";
import {
  Check,
  Clock,
  Image as ImageIcon,
  Rocket,
  TrendingUp,
  User,
  X
} from "lucide-react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import nextTradeLogo from "../../assets/nexttrade-logo.png";

export default function AITradingChat({ language = "en" }) {
  const locale = language === "ar" ? "ar-EG" : "en-US";
  const formatTime = React.useCallback(
    (value) => {
      if (!value) return "";
      if (typeof value === "string" && /\d{1,2}:\d{2}/.test(value)) return value;
      const date = typeof value === "string" ? new Date(value) : value;
      if (!date || Number.isNaN(date.getTime?.())) return "";
      return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date);
    },
    [locale]
  );

  const formatFileSize = React.useCallback((bytes = 0) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }, []);

  const initialMessages = React.useMemo(() => (language === "ar" ? [
    {
      type: "user",
      text: "مرحباً، هل يمكنك تحليل زوج BTC/USDT وإعطائي إشارة تداول؟",
      time: "10:23"
    },
    {
      type: "ai",
      text: "مرحباً! بالتأكيد، دعني أحلل السوق لك...",
      time: "10:23"
    },
    {
      type: "ai",
      text: "بعد تحليل الرسم البياني لزوج BTC/USDT على الإطار الزمني H4، لاحظت التالي:\n\n📊 التحليل الفني:\n• السعر يتحرك فوق المتوسط المتحرك 50\n• مؤشر RSI عند 65 (منطقة شراء)\n• كسر مستوى المقاومة $92,000\n• حجم التداول قوي\n\n💡 إشارة تداول موصى بها:",
      time: "10:24"
    },
    {
      type: "ai",
      signal: {
        pair: "BTC/USDT",
        action: "شراء (BUY)",
        entry: "$94,250",
        sl: "$91,500",
        tp1: "$97,800",
        tp2: "$101,200",
        riskReward: "1:2.5"
      },
      time: "10:24"
    },
    {
      type: "ai",
      approvalCard: {
        id: "approval-card-deploy",
        title: "Deploy to Production?",
        description: "This will push the latest changes to all users.",
        icon: "rocket",
        confirmLabel: "Deploy",
        cancelLabel: "Cancel"
      },
      time: "10:24"
    },
    {
      type: "ai",
      imageCard: {
        id: "image-preview-source",
        assetId: "image-source",
        src: "https://images.unsplash.com/photo-1504548840739-580b10ae7715?w=1200&auto=format&fit=crop",
        alt: "Vintage mainframe with blinking lights",
        title: "From mainframes to microchips",
        description:
          "A snapshot of when rooms were computers — not just what ran inside them.",
        domain: "unsplash.com",
        ratio: "4:3",
        fileSizeBytes: 2457600,
        createdAt: "2025-02-10T15:30:00.000Z",
        source: {
          label: "Computing archives",
          iconUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=archives",
          url: "https://assistant-ui.com/tools/alignment"
        }
      },
      time: "10:24"
    },
    {
      type: "user",
      text: "شكراً جزيلاً! سأتابع هذه الإشارة",
      time: "10:25"
    },
    {
      type: "ai",
      text: "بالتوفيق! 🚀 تذكر دائماً إدارة المخاطر واستخدام وقف الخسارة. سأراقب السوق وأخبرك بأي تحديثات.",
      time: "10:25"
    }
  ] : [
    {
      type: "user",
      text: "Hi, can you analyze BTC/USDT and give me a trading signal?",
      time: "10:23"
    },
    {
      type: "ai",
      text: "Hello! Sure, let me analyze the market for you...",
      time: "10:23"
    },
    {
      type: "ai",
      text: "After analyzing BTC/USDT on H4 timeframe, I've noticed:\n\n📊 Technical Analysis:\n• Price moving above 50 MA\n• RSI at 65 (buy zone)\n• Resistance level $92,000 broken\n• Strong volume\n\n💡 Recommended Trade Signal:",
      time: "10:24"
    },
    {
      type: "ai",
      signal: {
        pair: "BTC/USDT",
        action: "BUY",
        entry: "$94,250",
        sl: "$91,500",
        tp1: "$97,800",
        tp2: "$101,200",
        riskReward: "1:2.5"
      },
      time: "10:24"
    },
    {
      type: "ai",
      approvalCard: {
        id: "approval-card-deploy",
        title: "Deploy to Production?",
        description: "This will push the latest changes to all users.",
        icon: "rocket",
        confirmLabel: "Deploy",
        cancelLabel: "Cancel"
      },
      time: "10:24"
    },
    {
      type: "ai",
      imageCard: {
        id: "image-preview-source",
        assetId: "image-source",
        src: "https://images.unsplash.com/photo-1504548840739-580b10ae7715?w=1200&auto=format&fit=crop",
        alt: "Vintage mainframe with blinking lights",
        title: "From mainframes to microchips",
        description:
          "A snapshot of when rooms were computers — not just what ran inside them.",
        domain: "unsplash.com",
        ratio: "4:3",
        fileSizeBytes: 2457600,
        createdAt: "2025-02-10T15:30:00.000Z",
        source: {
          label: "Computing archives",
          iconUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=archives",
          url: "https://assistant-ui.com/tools/alignment"
        }
      },
      time: "10:24"
    },
    {
      type: "user",
      text: "Thank you! I'll follow this signal",
      time: "10:25"
    },
    {
      type: "ai",
      text: "Good luck! 🚀 Always remember risk management and use stop loss. I'll monitor the market and update you.",
      time: "10:25"
    }
  ]), [language]);

  const [messages, setMessages] = React.useState(initialMessages);
  const [composerText, setComposerText] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [sendError, setSendError] = React.useState("");
  const conversationRef = React.useRef(null);

  React.useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const handleSend = async () => {
    const trimmed = composerText.trim();
    if (!trimmed || isSending) return;
    setComposerText("");
    setSendError("");
    const createdAt = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { type: "user", text: trimmed, createdAt }
    ]);

    setIsSending(true);
    try {
      if (!base44?.agents?.createConversation || !base44?.agents?.addMessage) {
        throw new Error("Base44 agents SDK is not available.");
      }
      let conversation = conversationRef.current;
      if (!conversation) {
        conversation = await base44.agents.createConversation({
          agent_name: "tradingAssistant",
          metadata: {
            source: "ai-trading-chat"
          }
        });
        conversationRef.current = conversation;
      }
      await base44.agents.addMessage(conversation, {
        role: "user",
        content: trimmed
      });
      setMessages((prev) => [
        ...prev,
        {
          type: "ai",
          text:
            language === "ar"
              ? "تم إرسال رسالتك إلى المساعد. سأعود إليك بأقرب تحديث."
              : "Message delivered to tradingAssistant. I’ll follow up with updates shortly.",
          createdAt: new Date().toISOString(),
          status: true
        }
      ]);
    } catch (error) {
      const fallback =
        language === "ar"
          ? "تعذر إرسال الرسالة حالياً. يرجى المحاولة مرة أخرى."
          : "Unable to send the message right now. Please try again.";
      setSendError(error?.message || fallback);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-slate-100 rounded-[28px] p-6 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.45)] border border-slate-200/80 h-full flex flex-col">
      {/* Chat Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200/80 mb-4">
        <div className="w-11 h-11 rounded-full flex items-center justify-center border border-slate-200/70 bg-transparent">
          <img src={nextTradeLogo} alt="NextTrade" className="w-9 h-9 object-contain" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 text-base">
            {language === "ar" ? "مساعد التداول بالذكاء الاصطناعي" : "AI Trading Assistant"}
          </h3>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
            <span className="text-xs text-slate-500">
              {language === "ar" ? "نشط الآن" : "Active now"}
            </span>
            <span className="text-[11px] text-slate-400">•</span>
            <span className="text-xs text-slate-500">
              {language === "ar" ? "مساعد Base44" : "Base44 agent"}
            </span>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-5 pr-2" style={{ maxHeight: "500px" }}>
        {messages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`flex gap-3 ${msg.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            {msg.type === 'ai' ? (
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border border-slate-200/70 bg-transparent">
                <img src={nextTradeLogo} alt="NextTrade" className="w-7 h-7 object-contain" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 flex items-center justify-center flex-shrink-0 shadow-sm">
                <User className="w-4 h-4 text-white" />
              </div>
            )}

            {/* Message Content */}
            <div className={`flex flex-col ${msg.type === 'user' ? 'items-end' : 'items-start'} max-w-[80%]`}>
              {msg.signal ? (
                <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-[20px] p-4 border border-slate-200/80 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.5)]">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    <span className="font-semibold text-slate-900">{msg.signal.pair}</span>
                    <span className="px-2.5 py-1 bg-emerald-500 text-white text-xs rounded-full font-semibold">
                      {msg.signal.action}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-slate-500 text-xs">{language === "ar" ? "نقطة الدخول" : "Entry"}</div>
                      <div className="font-semibold text-slate-900">{msg.signal.entry}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs">{language === "ar" ? "وقف الخسارة" : "Stop Loss"}</div>
                      <div className="font-semibold text-rose-600">{msg.signal.sl}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs">{language === "ar" ? "هدف 1" : "Target 1"}</div>
                      <div className="font-semibold text-emerald-600">{msg.signal.tp1}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs">{language === "ar" ? "هدف 2" : "Target 2"}</div>
                      <div className="font-semibold text-emerald-600">{msg.signal.tp2}</div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="text-slate-600">
                      {language === "ar" ? "نسبة المخاطرة/العائد" : "Risk/Reward"}
                    </span>
                    <span className="font-semibold text-slate-700">{msg.signal.riskReward}</span>
                  </div>
                </div>
              ) : msg.approvalCard ? (
                <div className="rounded-[22px] border border-slate-200/80 bg-white/90 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.55)] px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                      <Rocket className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{msg.approvalCard.title}</div>
                      <p className="text-xs text-slate-500 mt-1">{msg.approvalCard.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
                    >
                      <Check className="h-4 w-4" />
                      {msg.approvalCard.confirmLabel}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                    >
                      <X className="h-4 w-4" />
                      {msg.approvalCard.cancelLabel}
                    </button>
                  </div>
                </div>
              ) : msg.imageCard ? (
                <div className="rounded-[22px] border border-slate-200/80 bg-white/95 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.6)] overflow-hidden">
                  <div className="relative">
                    <img
                      src={msg.imageCard.src}
                      alt={msg.imageCard.alt}
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute top-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow">
                      {msg.imageCard.ratio}
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <ImageIcon className="h-4 w-4" />
                        {msg.imageCard.domain}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {formatFileSize(msg.imageCard.fileSizeBytes)}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-slate-900">{msg.imageCard.title}</div>
                    <p className="text-xs text-slate-500 leading-relaxed">{msg.imageCard.description}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
                      <div className="flex items-center gap-2">
                        <img
                          src={msg.imageCard.source.iconUrl}
                          alt={msg.imageCard.source.label}
                          className="h-6 w-6 rounded-full border border-slate-200"
                        />
                        <div>
                          <div className="text-xs font-semibold text-slate-700">{msg.imageCard.source.label}</div>
                          <div className="text-[11px] text-slate-400">
                            {formatTime(msg.imageCard.createdAt)}
                          </div>
                        </div>
                      </div>
                      <a
                        href={msg.imageCard.source.url}
                        className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {language === "ar" ? "عرض المصدر" : "View source"}
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`rounded-[20px] px-4 py-3 ${
                  msg.type === 'ai'
                    ? 'bg-white border border-slate-200/80 shadow-[0_14px_35px_-28px_rgba(15,23,42,0.6)]'
                    : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white shadow-[0_12px_30px_-24px_rgba(15,23,42,0.6)]'
                }`}>
                  <p className={`text-sm leading-relaxed whitespace-pre-line ${
                    msg.type === 'ai' ? 'text-slate-800' : 'text-white'
                  }`}>
                    {msg.text}
                  </p>
                </div>
              )}
              <span className="text-xs text-slate-400 mt-1 px-2 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(msg.time || msg.createdAt)}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Chat Input */}
      <div className="mt-4 pt-4 border-t border-slate-200/80">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-3 px-4 py-3 bg-white rounded-[999px] border border-slate-200/80 shadow-[0_14px_35px_-30px_rgba(15,23,42,0.5)] focus-within:ring-2 focus-within:ring-slate-900/10"
        >
          <input
            type="text"
            value={composerText}
            onChange={(event) => setComposerText(event.target.value)}
            placeholder={
              language === "ar"
                ? "اكتب رسالتك لـ tradingAssistant..."
                : "Message tradingAssistant..."
            }
            className="flex-1 bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={isSending || !composerText.trim()}
            className="h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-sm transition hover:bg-slate-800 disabled:bg-slate-300"
            aria-label={language === "ar" ? "إرسال" : "Send"}
          >
            {isSending ? (
              <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
        {sendError ? (
          <p className="mt-2 text-xs text-rose-500">{sendError}</p>
        ) : null}
      </div>
    </div>
  );
}

AITradingChat.propTypes = {
  language: PropTypes.oneOf(["en", "ar"])
};
