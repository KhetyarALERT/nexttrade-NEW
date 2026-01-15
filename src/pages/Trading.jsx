import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { ArrowLeft, Lock } from "lucide-react";
import BinanceFuturesChart from "@/components/trading/binance/BinanceFuturesChart";
import BinanceSymbolSelector from "@/components/trading/binance/BinanceSymbolSelector";
import FuturesTradePanel from "@/components/trading/binance/FuturesTradePanel";
import FuturesActivityTabs from "@/components/trading/binance/FuturesActivityTabs";
import { binanceFuturesStore } from "@/components/trading/binance/binanceFuturesStore";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

function formatPrice(p) {
  if (!p || !Number.isFinite(p)) return "--";
  const digits = p < 1 ? 6 : 2;
  return `$${p.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function formatCompactNumber(value) {
  if (!Number.isFinite(value)) return "—";
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

function normalizeBinanceSymbol(sym) {
  return String(sym || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export default function Trading({ language = "en" }) {
  const { isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    const stored = localStorage.getItem("trading_symbol");
    const normalized = normalizeBinanceSymbol(stored || "BTCUSDT");
    return normalized || "BTCUSDT";
  });

  const [lastPrice, setLastPrice] = useState(0);
  const [changePct, setChangePct] = useState(0);
  const [quoteVolume, setQuoteVolume] = useState(0);

  const [liveAccount, setLiveAccount] = useState(null);
  const [demoAccount, setDemoAccount] = useState(null);

  const [trades, setTrades] = useState([]);

  const accountsInFlightRef = useRef(false);
  const refreshAccounts = useCallback(async () => {
    if (accountsInFlightRef.current) return;
    accountsInFlightRef.current = true;
    try {
      const [demoResult, liveResult] = await Promise.all([
        base44.functions.invoke("tradingAccount", { action: "getOrCreate", accountType: "demo" }),
        base44.functions.invoke("tradingAccount", { action: "getOrCreate", accountType: "live" }),
      ]);

      if (demoResult?.data?.success) setDemoAccount(demoResult.data.data);
      if (liveResult?.data?.success) setLiveAccount(liveResult.data.data);
    } catch {
      // ignore
    } finally {
      accountsInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("trading_symbol", selectedSymbol);
  }, [selectedSymbol]);

  useEffect(() => {
    // Ensure background tasks are active while this page is mounted
    binanceFuturesStore.startTickerPolling?.(7000);
    return () => {
      try {
        binanceFuturesStore.stopTickerPolling?.();
      } catch {}
      try {
        binanceFuturesStore.stopPremiumPolling?.();
      } catch {}
      try {
        binanceFuturesStore.closeChartWs?.();
      } catch {}
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadAccounts = async () => {
      try {
        await refreshAccounts();
      } catch {
        // Not logged in or backend unavailable.
        if (!cancelled) {
          setDemoAccount(null);
          setLiveAccount(null);
        }
      }
    };

    loadAccounts();
    return () => {
      cancelled = true;
    };
  }, []);

  const tradesInFlightRef = useRef(false);
  const refreshTrades = useCallback(async () => {
    if (tradesInFlightRef.current) return;
    tradesInFlightRef.current = true;
    try {
      const res = await base44.functions.invoke("tradingAccount", { action: "getTrades", limit: 200 });
      if (res?.data?.success) setTrades(res.data.data || []);
    } catch {
      // keep last known trades to avoid UI flicker
    } finally {
      tradesInFlightRef.current = false;
    }
  }, []);

  const [selectedTradeId, setSelectedTradeId] = useState(null);

  const [mobileView, setMobileView] = useState("chart"); // 'chart' | 'trade'

  const closeTrade = async (tradeId, tradeSymbol) => {
    if (!tradeId) return;
    const sym = normalizeBinanceSymbol(tradeSymbol);

    const ticker = sym ? binanceFuturesStore.getTicker(sym) : null;
    const exitPrice = Number(ticker?.lastPrice ?? (sym === normalizeBinanceSymbol(selectedSymbol) ? lastPrice : 0));
    if (!Number.isFinite(exitPrice) || exitPrice <= 0) return;

    try {
      await base44.functions.invoke("tradingAccount", {
        action: "closeTrade",
        tradeId,
        exitPrice,
        reason: "manual_table",
      });
    } finally {
      await refreshTrades();
      await refreshAccounts();
    }
  };

  const openTradeForSymbol = useMemo(() => {
    const sym = normalizeBinanceSymbol(selectedSymbol);
    if (!sym) return null;
    const demoId = demoAccount?.id;

    const list = Array.isArray(trades) ? trades : [];
    const open = list.filter((t) => t?.status === "OPEN" && normalizeBinanceSymbol(t?.symbol) === sym);
    if (!open.length) return null;

    if (selectedTradeId) {
      const chosen = open.find((t) => t?.id === selectedTradeId);
      if (chosen) return chosen;
    }

    if (demoId) {
      const demoOpen = open.find((t) => t?.trading_account_id === demoId);
      if (demoOpen) return demoOpen;
    }
    return open[0];
  }, [trades, selectedSymbol, demoAccount?.id, selectedTradeId, lastPrice]);

  const pendingOrdersForSymbol = useMemo(() => {
    const sym = normalizeBinanceSymbol(selectedSymbol);
    return (Array.isArray(trades) ? trades : []).filter(
      (t) => String(t?.status || "").toUpperCase() === "PENDING" && normalizeBinanceSymbol(t?.symbol) === sym,
    );
  }, [trades, selectedSymbol]);

  useEffect(() => {
    // If the selected trade is no longer open, clear the selection.
    if (!selectedTradeId) return;
    const stillOpen = (Array.isArray(trades) ? trades : []).some((t) => t?.id === selectedTradeId && t?.status === "OPEN");
    if (!stillOpen) setSelectedTradeId(null);
  }, [trades, selectedTradeId]);

  useEffect(() => {
    // Keep the activity panel up-to-date.
    let timer;
    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      await refreshTrades();
    };

    run();
    timer = setInterval(run, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Chart overlays are driven directly by `openTradeForSymbol`.


  useEffect(() => {
    const unsubTicker = binanceFuturesStore.subscribe(`ticker:${selectedSymbol}`, (t) => {
      if (!t) return;
      if (t.lastPrice) setLastPrice(t.lastPrice);
      if (t.priceChangePercent !== undefined) setChangePct(t.priceChangePercent);
      if (t.quoteVolume !== undefined) setQuoteVolume(t.quoteVolume);
    });
    const unsubPrice = binanceFuturesStore.subscribe(`price:${selectedSymbol}`, (p) => {
      if (p) setLastPrice(Number(p));
    });
    const existing = binanceFuturesStore.getTicker(selectedSymbol);
    if (existing?.lastPrice) setLastPrice(existing.lastPrice);
    if (existing?.priceChangePercent !== undefined) setChangePct(existing.priceChangePercent);
    if (existing?.quoteVolume !== undefined) setQuoteVolume(existing.quoteVolume);
    return () => {
      try {
        unsubTicker?.();
      } catch {}
      try {
        unsubPrice?.();
      } catch {}
    };
  }, [selectedSymbol]);

  const t = useMemo(() => {
    return language === "ar"
      ? { last: "آخر سعر", change: "تغير 24س", authTitle: "سجّل الدخول لبيانات مباشرة", authBody: "سجّل الدخول لعرض الرسم البياني الحقيقي وتنفيذ الأوامر.", authAction: "تسجيل الدخول" }
      : { last: "Last", change: "24h", authTitle: "Log in for live data", authBody: "Log in to view real-time charts and place orders.", authAction: "Log in" };
  }, [language]);

  return (
    <div className="min-h-[calc(100vh-5rem)] flex flex-col bg-gradient-to-b from-background via-background to-background/80 text-foreground overflow-x-hidden">
      <header className="border-b border-border/60 px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 shrink-0 z-20 bg-card/80 backdrop-blur">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => window.history.back()}
            className="p-2 hover:bg-muted rounded-full transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="h-6 w-[1px] bg-border" />

          <div className="min-w-0 flex items-center">
            <BinanceSymbolSelector
              selectedSymbol={selectedSymbol}
              onSelectSymbol={(s) => setSelectedSymbol(normalizeBinanceSymbol(s))}
              language={language}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:gap-6">
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {language === "ar" ? "بيانات مباشرة" : "Live markets"}
          </div>
          <div className="flex flex-col items-start lg:items-end">
            <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold">{t.last}</span>
            <span className="text-foreground font-bold text-sm lg:text-base font-mono">{formatPrice(lastPrice)}</span>
          </div>
          <div className="flex flex-col items-start lg:items-end">
            <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold">{t.change}</span>
            <span className={`font-bold text-sm ${changePct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {changePct >= 0 ? "+" : ""}
              {Number(changePct).toFixed(2)}%
            </span>
          </div>
          <div className="flex flex-col items-start lg:items-end">
            <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold">
              {language === "ar" ? "حجم 24س" : "24h Vol"}
            </span>
            <span className="text-foreground font-semibold text-sm">{formatCompactNumber(quoteVolume)}</span>
          </div>
        </div>
      </header>

      {/* Mobile view toggle */}
      <div className="lg:hidden border-b border-border/60 bg-background/70 px-4 py-2 flex gap-2 shrink-0 sticky top-0 z-10 backdrop-blur">
        <button
          type="button"
          onClick={() => setMobileView("chart")}
          className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors border ${
            mobileView === "chart"
              ? "bg-foreground text-background border-foreground shadow-md"
              : "bg-transparent text-foreground border-border/60"
          }`}
        >
          {language === "ar" ? "الرسم" : "Chart"}
        </button>
        <button
          type="button"
          onClick={() => setMobileView("trade")}
          className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors border ${
            mobileView === "trade"
              ? "bg-foreground text-background border-foreground shadow-md"
              : "bg-transparent text-foreground border-border/60"
          }`}
        >
          {language === "ar" ? "تداول" : "Trade"}
        </button>
      </div>

      <main className="flex-1 flex flex-col lg:flex-row gap-4 px-4 pb-4 overflow-x-hidden overflow-y-auto touch-pan-y">
        {/* Chart column */}
        <section
          className={`flex-1 min-w-0 flex flex-col min-h-0 ${
            mobileView === "trade" ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="relative flex-1 min-h-0 rounded-2xl border border-border/60 bg-card/40 shadow-lg overflow-hidden">
            <BinanceFuturesChart
              symbol={selectedSymbol}
              language={language}
              onPriceUpdate={(p) => setLastPrice(p)}
              positionTrade={openTradeForSymbol}
              pendingOrders={pendingOrdersForSymbol}
            />
            {!isLoadingAuth && !isAuthenticated ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <div className="max-w-md text-center space-y-3 p-6 rounded-2xl border border-border/60 bg-card/90 shadow-lg">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                    <Lock className="h-6 w-6 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{t.authTitle}</h3>
                  <p className="text-sm text-muted-foreground">{t.authBody}</p>
                  <button
                    type="button"
                    onClick={navigateToLogin}
                    className="mt-2 inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    {t.authAction}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="h-[320px] min-h-[240px] max-h-[50vh] mt-4 rounded-2xl border border-border/60 bg-card/40 shadow-lg overflow-hidden">
            <FuturesActivityTabs
              symbol={selectedSymbol}
              language={language}
              trades={trades}
              onRefresh={refreshTrades}
              selectedTradeId={selectedTradeId}
              onSelectTrade={(t) => setSelectedTradeId(t?.id || null)}
              onCloseTrade={(t) => closeTrade(t?.id, t?.symbol)}
            />
          </div>
        </section>

        {/* Trade panel */}
        <section
          className={`w-full lg:w-[380px] xl:w-[440px] lg:shrink-0 flex flex-col min-h-0 ${
            mobileView === "chart" ? "hidden lg:block" : "block"
          }`}
        >
          <div className="lg:hidden px-4 py-3 border border-border/60 rounded-2xl flex items-center justify-between bg-card/70 backdrop-blur shadow-md">
            <div className="text-sm font-semibold text-foreground">{language === "ar" ? "لوحة التداول" : "Trading Panel"}</div>
            <button
              type="button"
              onClick={() => setMobileView("chart")}
              className="text-xs font-semibold text-muted-foreground border border-border/60 rounded-lg px-3 py-1.5 hover:bg-muted"
            >
              {language === "ar" ? "الرسم" : "Chart"}
            </button>
          </div>
          <div className="relative flex-1 min-h-0 mt-4">
            <FuturesTradePanel
              symbol={selectedSymbol}
              language={language}
              liveAccount={liveAccount}
              demoAccount={demoAccount}
              onTradesChanged={refreshTrades}
              onAccountsChanged={refreshAccounts}
            />
            {!isLoadingAuth && !isAuthenticated ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/85 backdrop-blur-sm rounded-2xl">
                <div className="max-w-xs text-center space-y-2 p-5 rounded-2xl border border-border/60 bg-card/90 shadow-lg">
                  <h3 className="text-base font-semibold text-foreground">{t.authTitle}</h3>
                  <p className="text-xs text-muted-foreground">{t.authBody}</p>
                  <button
                    type="button"
                    onClick={navigateToLogin}
                    className="mt-1 inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    {t.authAction}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

Trading.propTypes = {
  language: PropTypes.string,
};
