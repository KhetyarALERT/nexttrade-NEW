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
      if (!isAuthenticated || isLoadingAuth) {
        setLiveAccount(null);
        setDemoAccount(null);
        return;
      }

      await refreshAccounts();

      if (cancelled) return;
    };

    loadAccounts();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoadingAuth, refreshAccounts]);

  const allTrades = useMemo(() => {
    const live = (liveAccount?.trades || []).map((t) => ({ ...t, accountType: "live" }));
    const demo = (demoAccount?.trades || []).map((t) => ({ ...t, accountType: "demo" }));
    return [...live, ...demo].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
  }, [liveAccount, demoAccount]);

  const chartHeight = useMemo(() => {
    if (typeof window === "undefined") return "h-[320px]";
    const width = window.innerWidth;
    if (width < 768) return "h-[200px]";
    if (width < 1024) return "h-[240px]";
    return "h-[320px]";
  }, []);

  const stats = useMemo(
    () => [
      { label: language === "fa" ? "قیمت" : "Price", value: formatPrice(lastPrice) },
      { label: language === "fa" ? "تغیر" : "Change", value: `${changePct.toFixed(2)}%` },
      { label: language === "fa" ? "حجم" : "Volume", value: formatCompactNumber(quoteVolume) },
    ],
    [lastPrice, changePct, quoteVolume, language]
  );

  const handleSymbolChange = useCallback((symbol) => {
    setSelectedSymbol(normalizeBinanceSymbol(symbol));
  }, []);

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => window.history.back()} className="text-foreground/60 hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{language === "fa" ? "معاملات" : "Trading"}</h1>
          </div>
          {!isAuthenticated && !isLoadingAuth && (
            <button
              onClick={navigateToLogin}
              className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Lock className="h-4 w-4" />
              {language === "fa" ? "ورود" : "Login"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden sm:flex-row">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-border px-4 py-3 sm:px-6">
            <BinanceSymbolSelector value={selectedSymbol} onChange={handleSymbolChange} language={language} />
          </div>

          <div className="grid grid-cols-3 gap-2 border-b border-border px-4 py-3 sm:gap-4 sm:px-6">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="text-xs font-medium text-foreground/60 sm:text-sm">{stat.label}</div>
                <div className="text-sm font-semibold text-foreground sm:text-base">{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-hidden px-4 py-3 sm:px-6">
            <div className={`h-full ${chartHeight} w-full`}>
              <BinanceFuturesChart
                symbol={selectedSymbol}
                onPriceUpdate={setLastPrice}
                onChangeUpdate={setChangePct}
                onVolumeUpdate={setQuoteVolume}
              />
            </div>
          </div>

          <div className="border-t border-border">
            <FuturesActivityTabs trades={allTrades} symbol={selectedSymbol} language={language} />
          </div>
        </div>

        <div className="flex w-full flex-col border-t border-border sm:w-80 sm:flex-col sm:border-l sm:border-t-0">
          {!isAuthenticated ? (
            <div className="flex flex-1 items-center justify-center p-4 text-center">
              <div>
                <Lock className="mx-auto mb-3 h-8 w-8 text-foreground/40" />
                <p className="text-sm text-foreground/60">
                  {language === "fa" ? "برای معاملات باید وارد شوید" : "Login required to trade"}
                </p>
                <button
                  onClick={navigateToLogin}
                  className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {language === "fa" ? "ورود" : "Login"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <FuturesTradePanel account={liveAccount} symbol={selectedSymbol} onTradeCreated={() => refreshAccounts()} language={language} />
              <div className="flex-1 overflow-hidden border-t border-border">
                <FuturesActivityTabs trades={allTrades} symbol={selectedSymbol} language={language} compact={true} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

Trading.propTypes = {
  language: PropTypes.string,
};