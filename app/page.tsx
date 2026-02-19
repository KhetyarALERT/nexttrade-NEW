import Link from "next/link";
import {
  TrendingUp,
  Shield,
  Zap,
  Bot,
  CandlestickChart,
  Wallet,
  ArrowRight,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <TrendingUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">
              NextTrade
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign In
            </Link>
            <Link
              href="/auth/sign-up"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center lg:py-32">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
          <Zap className="h-3.5 w-3.5 text-primary" />
          Live Binance Futures Trading
        </div>
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight text-foreground lg:text-6xl">
          Trade Crypto Futures with Confidence
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
          A beginner-friendly platform with an internal wallet, real-time
          charts, and AI-powered trading assistant. Start with practice funds
          and learn as you go.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/auth/sign-up"
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start Trading
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/auth/login"
            className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/50 bg-card/30 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-4 text-center text-2xl font-bold text-foreground lg:text-3xl">
            Everything you need to trade
          </h2>
          <p className="mx-auto mb-12 max-w-lg text-center text-muted-foreground">
            Built for beginners, powerful enough for experienced traders.
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: CandlestickChart,
                title: "Live Trading Charts",
                desc: "Real-time candlestick charts powered by Binance WebSocket with multiple timeframes and full order book depth.",
              },
              {
                icon: Wallet,
                title: "Internal Wallet",
                desc: "Built-in USDT wallet with instant deposits and withdrawals. Track every transaction in your ledger.",
              },
              {
                icon: Bot,
                title: "AI Assistant",
                desc: "Groq-powered AI that explains trading concepts, helps with analysis, and answers your crypto questions.",
              },
              {
                icon: Shield,
                title: "Secure by Default",
                desc: "Supabase authentication with Row Level Security. Your data is isolated and protected.",
              },
              {
                icon: TrendingUp,
                title: "Futures Trading",
                desc: "Open long and short positions with up to 125x leverage. Set stop loss and take profit levels.",
              },
              {
                icon: Zap,
                title: "Real-time Updates",
                desc: "Live price feeds, order book updates, and position P&L tracking - all streamed via WebSocket.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-card p-6"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
              <TrendingUp className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold text-foreground">
              NextTrade
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Practice trading platform for educational purposes. Not financial
            advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
