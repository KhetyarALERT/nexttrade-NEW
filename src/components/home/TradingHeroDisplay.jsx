import PropTypes from "prop-types";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

const content = {
  en: {
    title: "Market Snapshot",
    subtitle: "Institutional-grade signals with live pricing and risk controls.",
    live: "Live",
    account: "Portfolio Balance",
    equity: "$124,580.45",
    change: "+4.8% today",
    cards: [
      { label: "BTC/USDT", value: "67,420.10", change: "+2.4%", direction: "up" },
      { label: "ETH/USDT", value: "3,420.80", change: "+1.1%", direction: "up" },
      { label: "SOL/USDT", value: "145.62", change: "-0.6%", direction: "down" },
    ],
    positionsTitle: "Active Positions",
    positions: [
      { pair: "BTC-PERP", size: "1.2 BTC", pnl: "+$3,420", status: "Trailing" },
      { pair: "ETH-PERP", size: "18 ETH", pnl: "+$1,180", status: "Protected" },
      { pair: "SOL-PERP", size: "260 SOL", pnl: "-$320", status: "Hedged" },
    ],
    ticketTitle: "NextTrade Pro Desk",
    ticketSubtitle: "Route orders with AI-assisted risk checks.",
    primaryCta: "Execute Strategy",
  },
  ar: {
    title: "لمحة السوق",
    subtitle: "إشارات بمستوى مؤسسي مع تسعير مباشر وضوابط مخاطر.",
    live: "مباشر",
    account: "رصيد المحفظة",
    equity: "$124,580.45",
    change: "+4.8% اليوم",
    cards: [
      { label: "BTC/USDT", value: "67,420.10", change: "+2.4%", direction: "up" },
      { label: "ETH/USDT", value: "3,420.80", change: "+1.1%", direction: "up" },
      { label: "SOL/USDT", value: "145.62", change: "-0.6%", direction: "down" },
    ],
    positionsTitle: "المراكز النشطة",
    positions: [
      { pair: "BTC-PERP", size: "1.2 BTC", pnl: "+$3,420", status: "Trailing" },
      { pair: "ETH-PERP", size: "18 ETH", pnl: "+$1,180", status: "Protected" },
      { pair: "SOL-PERP", size: "260 SOL", pnl: "-$320", status: "Hedged" },
    ],
    ticketTitle: "مكتب NextTrade الاحترافي",
    ticketSubtitle: "تنفيذ الأوامر مع فحص مخاطر ذكي.",
    primaryCta: "تنفيذ الاستراتيجية",
  },
};

export default function TradingHeroDisplay({ language = "en" }) {
  const t = content[language];

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-border bg-white/80 p-6 shadow-[0_32px_90px_-50px_rgba(15,23,42,0.6)] backdrop-blur-xl dark:bg-slate-950/80">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/10" />
      <div className="relative space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
              <Sparkles className="h-4 w-4" />
              {t.title}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {t.live}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/80 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t.account}
              </p>
              <div className="mt-2 text-3xl font-bold text-foreground">{t.equity}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-emerald-600">{t.change}</div>
              <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
                24h volatility: 1.8%
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {t.cards.map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-border/70 bg-card px-3 py-3 text-center"
              >
                <div className="text-xs text-muted-foreground">{card.label}</div>
                <div className="mt-1 text-sm font-semibold text-foreground">{card.value}</div>
                <div
                  className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    card.direction === "up"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {card.direction === "up" ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {card.change}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/90 p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">{t.positionsTitle}</div>
            <div className="text-xs text-muted-foreground">Risk engine: Balanced</div>
          </div>
          <div className="mt-4 space-y-3">
            {t.positions.map((position) => (
              <div
                key={position.pair}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-card/70 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-semibold text-foreground">{position.pair}</div>
                  <div className="text-xs text-muted-foreground">{position.size}</div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-sm font-semibold ${
                      position.pnl.startsWith("-") ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {position.pnl}
                  </div>
                  <div className="text-xs text-muted-foreground">{position.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">{t.ticketTitle}</div>
              <p className="mt-1 text-xs text-white/70">{t.ticketSubtitle}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70">
            <span>Order flow: 2.4x</span>
            <span>Latency: 42ms</span>
            <span>Slippage: 0.08%</span>
          </div>
          <button
            type="button"
            className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-white/10 transition hover:bg-slate-100"
          >
            {t.primaryCta}
          </button>
        </div>
      </div>
    </div>
  );
}

TradingHeroDisplay.propTypes = {
  language: PropTypes.oneOf(["en", "ar"]),
};
