import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { ArrowLeft } from "lucide-react";
import BinanceFuturesChart from "@/components/trading/binance/BinanceFuturesChart";
import BinanceSymbolSelector from "@/components/trading/binance/BinanceSymbolSelector";
import FuturesTradePanel from "@/components/trading/binance/FuturesTradePanel";
import FuturesActivityTabs from "@/components/trading/binance/FuturesActivityTabs";
import { binanceFuturesStore } from "@/components/trading/binance/binanceFuturesStore";
import { base44 } from "@/api/base44Client";

function formatPrice(p) {
  if (!p || !Number.isFinite(p)) return "--";
  const digits = p < 1 ? 6 : 2;
  return `$${p.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function normalizeBinanceSymbol(sym) {
  return String(sym || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export default function Trading({ language = "en" }) {
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    const stored = localStorage.getItem("trading_symbol");
    const normalized = normalizeBinanceSymbol(stored || "BTCUSDT");
    return normalized || "BTCUSDT";
  });

  const [lastPrice, setLastPrice] = useState(0);
  const [changePct, setChangePct] = useState(0);

  const [liveAccount, setLiveAccount] = useState(null);
  const [demoAccount, setDemoAccount] = useState(null);

  const [trades, setTrades] = useState([]);

  const refreshAccounts = async () => {
    try {
      const [demoResult, liveResult] = await Promise.all([
        base44.functions.invoke("tradingAccount", { action: "getOrCreate", accountType: "demo" }),
        base44.functions.invoke("tradingAccount", { action: "getOrCreate", accountType: "live" }),
      ]);

      if (demoResult?.data?.success) setDemoAccount(demoResult.data.data);
      if (liveResult?.data?.success) setLiveAccount(liveResult.data.data);
    } catch {
      // ignore
    }
  };

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
      } catch (err) {
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

  const refreshTrades = async () => {
    try {
      const res = await base44.functions.invoke("tradingAccount", { action: "getTrades", limit: 200 });
      if (res?.data?.success) setTrades(res.data.data || []);
    } catch {
      setTrades([]);
    }
  };

  const openTradeForSymbol = useMemo(() => {
    const sym = normalizeBinanceSymbol(selectedSymbol);
    if (!sym) return null;
    const demoId = demoAccount?.id;

    const list = Array.isArray(trades) ? trades : [];
    const open = list.filter((t) => t?.status === "OPEN" && normalizeBinanceSymbol(t?.symbol) === sym);
    if (!open.length) return null;

    if (demoId) {
      const demoOpen = open.find((t) => t?.trading_account_id === demoId);
      if (demoOpen) return demoOpen;
    }
    return open[0];
  }, [trades, selectedSymbol, demoAccount?.id]);

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
    });
    const unsubPrice = binanceFuturesStore.subscribe(`price:${selectedSymbol}`, (p) => {
      if (p) setLastPrice(Number(p));
    });
    const existing = binanceFuturesStore.getTicker(selectedSymbol);
    if (existing?.lastPrice) setLastPrice(existing.lastPrice);
    if (existing?.priceChangePercent !== undefined) setChangePct(existing.priceChangePercent);
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
      ? { last: "آخر سعر", change: "تغير 24س" }
      : { last: "Last", change: "24h" };
  }, [language]);

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col bg-[#0d0d1a] text-slate-200 overflow-hidden">
      <header className="h-14 bg-[#1a1a2e] border-b border-slate-700/50 px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => window.history.back()}
            className="p-2 hover:bg-slate-700/30 rounded-full transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5 text-slate-400" />
          </button>
          <div className="h-6 w-[1px] bg-slate-700/50" />

          <div className="min-w-0 flex items-center">
            <BinanceSymbolSelector
              selectedSymbol={selectedSymbol}
              onSelectSymbol={(s) => setSelectedSymbol(normalizeBinanceSymbol(s))}
              language={language}
            />
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">{t.last}</span>
            <span className="text-white font-bold text-sm font-mono">{formatPrice(lastPrice)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">{t.change}</span>
            <span className={`font-bold text-sm ${changePct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {changePct >= 0 ? "+" : ""}
              {Number(changePct).toFixed(2)}%
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <section className="flex-1 min-w-0 flex flex-col bg-[#131722]">
          <div className="flex-1 min-h-0">
            <BinanceFuturesChart
              symbol={selectedSymbol}
              language={language}
              onPriceUpdate={(p) => setLastPrice(p)}
              positionTrade={openTradeForSymbol}
            />
          </div>
          <div className="h-[320px] min-h-[240px] max-h-[50vh]">
            <FuturesActivityTabs symbol={selectedSymbol} language={language} trades={trades} onRefresh={refreshTrades} />
          </div>
        </section>

        <section className="hidden lg:block w-[360px] xl:w-[420px] shrink-0">
          <FuturesTradePanel
            symbol={selectedSymbol}
            language={language}
            liveAccount={liveAccount}
            demoAccount={demoAccount}
            onTradesChanged={refreshTrades}
            onAccountsChanged={refreshAccounts}
          />
        </section>
      </main>
    </div>
  );
}

Trading.propTypes = {
  language: PropTypes.string,
};