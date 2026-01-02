import PropTypes from "prop-types";
import {
  TrendingUp,
  User
} from "lucide-react";
import nextTradeLogo from "@/assets/nexttrade-logo.png";
import { motion } from "framer-motion";

export default function AITradingChat({ language = "en" }) {
  const messages = language === "ar" ? [
    {
      type: "user",
      text: "مرحباً، هل يمكنك تحليل زوج EUR/USD وإعطائي إشارة تداول؟",
      time: "10:23"
    },
    {
      type: "ai",
      text: "مرحباً! بالتأكيد، دعني أحلل السوق لك...",
      time: "10:23"
    },
    {
      type: "ai",
      text: "بعد تحليل الرسم البياني لزوج EUR/USD على الإطار الزمني H4، لاحظت التالي:\n\n📊 التحليل الفني:\n• السعر يتحرك فوق المتوسط المتحرك 50\n• مؤشر RSI عند 65 (منطقة شراء)\n• كسر مستوى المقاومة 1.0850\n• حجم التداول قوي\n\n💡 إشارة تداول موصى بها:",
      time: "10:24"
    },
    {
      type: "ai",
      signal: {
        pair: "EUR/USD",
        action: "شراء (BUY)",
        entry: "1.0865",
        sl: "1.0820",
        tp1: "1.0920",
        tp2: "1.0970",
        riskReward: "1:2.5"
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
      text: "Hi, can you analyze EUR/USD and give me a trading signal?",
      time: "10:23"
    },
    {
      type: "ai",
      text: "Hello! Sure, let me analyze the market for you...",
      time: "10:23"
    },
    {
      type: "ai",
      text: "After analyzing EUR/USD on H4 timeframe, I've noticed:\n\n📊 Technical Analysis:\n• Price moving above 50 MA\n• RSI at 65 (buy zone)\n• Resistance level 1.0850 broken\n• Strong volume\n\n💡 Recommended Trade Signal:",
      time: "10:24"
    },
    {
      type: "ai",
      signal: {
        pair: "EUR/USD",
        action: "BUY",
        entry: "1.0865",
        sl: "1.0820",
        tp1: "1.0920",
        tp2: "1.0970",
        riskReward: "1:2.5"
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
  ];

  return (
    <div className="bg-gradient-to-br from-slate-50 to-white rounded-3xl p-6 shadow-xl border border-slate-200 h-full flex flex-col">
      {/* Chat Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200 mb-4">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center p-1 shadow-sm">
          <img 
            src={nextTradeLogo}
            alt="NextTrade"
            className="w-full h-full object-contain"
          />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">
            {language === "ar" ? "مساعد التداول بالذكاء الاصطناعي" : "AI Trading Assistant"}
          </h3>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-gray-500">
              {language === "ar" ? "نشط الآن" : "Active now"}
            </span>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2" style={{ maxHeight: '500px' }}>
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
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 p-1 shadow-sm">
                <img 
                  src={nextTradeLogo}
                  alt="NextTrade"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-white" />
              </div>
            )}

            {/* Message Content */}
            <div className={`flex flex-col ${msg.type === 'user' ? 'items-end' : 'items-start'} max-w-[80%]`}>
              {msg.signal ? (
                // Trading Signal Card
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border-2 border-blue-200 shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="font-bold text-gray-900">{msg.signal.pair}</span>
                    <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full font-semibold">
                      {msg.signal.action}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500 text-xs">{language === "ar" ? "نقطة الدخول" : "Entry"}</div>
                      <div className="font-bold text-gray-900">{msg.signal.entry}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">{language === "ar" ? "وقف الخسارة" : "Stop Loss"}</div>
                      <div className="font-bold text-red-600">{msg.signal.sl}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">{language === "ar" ? "هدف 1" : "Target 1"}</div>
                      <div className="font-bold text-green-600">{msg.signal.tp1}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">{language === "ar" ? "هدف 2" : "Target 2"}</div>
                      <div className="font-bold text-green-600">{msg.signal.tp2}</div>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-blue-200 flex items-center justify-between text-xs">
                    <span className="text-gray-600">
                      {language === "ar" ? "نسبة المخاطرة/العائد" : "Risk/Reward"}
                    </span>
                    <span className="font-bold text-blue-600">{msg.signal.riskReward}</span>
                  </div>
                </div>
              ) : (
                // Regular Text Message
                <div className={`rounded-2xl px-4 py-3 ${
                  msg.type === 'ai'
                    ? 'bg-white border border-slate-200 shadow-sm'
                    : 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white'
                }`}>
                  <p className={`text-sm leading-relaxed whitespace-pre-line ${
                    msg.type === 'ai' ? 'text-gray-800' : 'text-white'
                  }`}>
                    {msg.text}
                  </p>
                </div>
              )}
              <span className="text-xs text-gray-400 mt-1 px-2">{msg.time}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Chat Input */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 rounded-full border border-slate-200">
          <input
            type="text"
            placeholder={language === "ar" ? "اكتب رسالتك..." : "Type your message..."}
            className="flex-1 bg-transparent text-sm outline-none text-gray-600"
            disabled
          />
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

AITradingChat.propTypes = {
  language: PropTypes.oneOf(["en", "ar"])
};