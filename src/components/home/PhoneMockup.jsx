import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, CreditCard, History, PieChart } from "lucide-react";

const content = {
  en: {
    slides: [
      {
        type: "assets",
        title: "Assets",
        subtitle: "Total Balance",
        balance: "$124,580.45",
        change: "+4.8%",
        items: [
          { icon: "💵", name: "US dollar", amount: "2,825.78", value: "$2,825.78" },
          { icon: "₿", name: "BTC", amount: "0.18", value: "+$420.15", pct: "+7.60%", up: true },
          { icon: "◎", name: "SOL", amount: "15.02", value: "-$129.81", pct: "-4.31%", up: false },
          { icon: "Ξ", name: "ETH", amount: "0.9", value: "+$615.93", pct: "+15.72%", up: true },
          { icon: "₮", name: "USDT", amount: "2,260", value: "--", pct: "--", up: true },
        ],
      },
      {
        type: "markets",
        title: "Markets",
        subtitle: "Top Movers",
        items: [
          { symbol: "BTC/USDT", price: "67,420.10", change: "+2.45%", up: true },
          { symbol: "ETH/USDT", price: "3,420.80", change: "+1.12%", up: true },
          { symbol: "SOL/USDT", price: "145.62", change: "-0.68%", up: false },
          { symbol: "BNB/USDT", price: "598.40", change: "+3.21%", up: true },
          { symbol: "XRP/USDT", price: "0.5234", change: "-1.15%", up: false },
        ],
      },
      {
        type: "portfolio",
        title: "Portfolio",
        subtitle: "Performance",
        balance: "+$12,450.00",
        pct: "+12.4%",
        items: [
          { label: "Today", value: "+$1,240", pct: "+1.2%", up: true },
          { label: "This Week", value: "+$4,580", pct: "+4.8%", up: true },
          { label: "This Month", value: "+$12,450", pct: "+12.4%", up: true },
        ],
      },
    ],
  },
  ar: {
    slides: [
      {
        type: "assets",
        title: "الأصول",
        subtitle: "الرصيد الكلي",
        balance: "$124,580.45",
        change: "+4.8%",
        items: [
          { icon: "💵", name: "دولار أمريكي", amount: "2,825.78", value: "$2,825.78" },
          { icon: "₿", name: "BTC", amount: "0.18", value: "+$420.15", pct: "+7.60%", up: true },
          { icon: "◎", name: "SOL", amount: "15.02", value: "-$129.81", pct: "-4.31%", up: false },
          { icon: "Ξ", name: "ETH", amount: "0.9", value: "+$615.93", pct: "+15.72%", up: true },
          { icon: "₮", name: "USDT", amount: "2,260", value: "--", pct: "--", up: true },
        ],
      },
      {
        type: "markets",
        title: "الأسواق",
        subtitle: "أعلى التحركات",
        items: [
          { symbol: "BTC/USDT", price: "67,420.10", change: "+2.45%", up: true },
          { symbol: "ETH/USDT", price: "3,420.80", change: "+1.12%", up: true },
          { symbol: "SOL/USDT", price: "145.62", change: "-0.68%", up: false },
          { symbol: "BNB/USDT", price: "598.40", change: "+3.21%", up: true },
          { symbol: "XRP/USDT", price: "0.5234", change: "-1.15%", up: false },
        ],
      },
      {
        type: "portfolio",
        title: "المحفظة",
        subtitle: "الأداء",
        balance: "+$12,450.00",
        pct: "+12.4%",
        items: [
          { label: "اليوم", value: "+$1,240", pct: "+1.2%", up: true },
          { label: "هذا الأسبوع", value: "+$4,580", pct: "+4.8%", up: true },
          { label: "هذا الشهر", value: "+$12,450", pct: "+12.4%", up: true },
        ],
      },
    ],
  },
};

const navItems = [
  { icon: Wallet, label: "Home" },
  { icon: TrendingUp, label: "Markets" },
  { icon: CreditCard, label: "Trade" },
  { icon: PieChart, label: "Earn" },
  { icon: History, label: "Assets" },
];

export default function PhoneMockup({ language = "en" }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const t = content[language];
  const slides = t.slides;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [slides.length]);

  const slide = slides[currentSlide];

  return (
    <div className="relative">
      {/* Phone Frame */}
      <div className="relative mx-auto w-[260px] sm:w-[280px] md:w-[300px]">
        {/* Phone outer shell */}
        <div className="relative rounded-[40px] bg-gradient-to-b from-slate-800 to-slate-900 p-2 shadow-2xl shadow-black/40">
          {/* Inner bezel */}
          <div className="relative overflow-hidden rounded-[32px] bg-black">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl z-20" />
            
            {/* Screen */}
            <div className="relative bg-slate-950 min-h-[420px] sm:min-h-[460px] pt-8">
              {/* Status bar */}
              <div className="flex items-center justify-between px-6 py-2 text-[10px] text-white/60">
                <span>9:41</span>
                <div className="flex items-center gap-1">
                  <span>●●●●○</span>
                  <span>WiFi</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="px-4 pb-16"
                >
                  {slide.type === "assets" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white font-semibold text-lg">{slide.title}</h3>
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                          <span className="text-white/60 text-xs">↗</span>
                        </div>
                      </div>
                      
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                        <p className="text-white/50 text-xs">{slide.subtitle}</p>
                        <div className="flex items-end gap-2 mt-1">
                          <span className="text-white text-2xl font-bold">{slide.balance}</span>
                          <span className="text-emerald-400 text-sm mb-1">{slide.change}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {slide.items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">
                                {item.icon}
                              </div>
                              <div>
                                <p className="text-white text-sm font-medium">{item.name}</p>
                                <p className="text-white/40 text-xs">{item.amount}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-white text-sm">{item.value}</p>
                              {item.pct && (
                                <p className={`text-xs ${item.up ? "text-emerald-400" : "text-rose-400"}`}>
                                  {item.pct}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {slide.type === "markets" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white font-semibold text-lg">{slide.title}</h3>
                        <p className="text-white/50 text-xs">{slide.subtitle}</p>
                      </div>

                      <div className="space-y-2">
                        {slide.items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl p-3 border border-white/5">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                item.up ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                              }`}>
                                {item.symbol.split("/")[0].slice(0, 2)}
                              </div>
                              <div>
                                <p className="text-white text-sm font-medium">{item.symbol}</p>
                                <p className="text-white/40 text-xs">Perpetual</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-white text-sm font-mono">${item.price}</p>
                              <div className={`flex items-center justify-end gap-0.5 text-xs ${
                                item.up ? "text-emerald-400" : "text-rose-400"
                              }`}>
                                {item.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {item.change}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {slide.type === "portfolio" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white font-semibold text-lg">{slide.title}</h3>
                      </div>

                      <div className="bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-2xl p-4 border border-emerald-500/30">
                        <p className="text-white/60 text-xs">{slide.subtitle}</p>
                        <div className="flex items-end gap-2 mt-1">
                          <span className="text-emerald-400 text-2xl font-bold">{slide.balance}</span>
                          <span className="text-emerald-300 text-sm mb-1">{slide.pct}</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {slide.items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                            <span className="text-white/60 text-sm">{item.label}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${item.up ? "text-emerald-400" : "text-rose-400"}`}>
                                {item.value}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                item.up ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                              }`}>
                                {item.pct}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Mini chart */}
                      <div className="bg-white/5 rounded-xl p-3 h-20 flex items-end gap-1">
                        {[40, 55, 45, 60, 50, 70, 65, 80, 75, 90, 85, 95].map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t"
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Bottom nav */}
              <div className="absolute bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 px-2 py-2 rounded-b-[32px]">
                <div className="flex items-center justify-around">
                  {navItems.map((item, i) => (
                    <button
                      key={i}
                      className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg ${
                        i === currentSlide % navItems.length ? "text-blue-400" : "text-white/40"
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="text-[8px]">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Slide indicators */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === currentSlide ? "bg-blue-500 w-6" : "bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

PhoneMockup.propTypes = {
  language: PropTypes.oneOf(["en", "ar"]),
};