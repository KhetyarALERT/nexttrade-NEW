import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { ArrowLeft } from "lucide-react";
import BinanceFuturesChart from "@/components/trading/binance/BinanceFuturesChart";
import BinanceSymbolSelector from "@/components/trading/binance/BinanceSymbolSelector";
import FuturesTradePanel from "@/components/trading/binance/FuturesTradePanel";
import FuturesActivityTabs from "@/components/trading/binance/FuturesActivityTabs";
import { binanceFuturesStore } from "@/components/trading/binance/binanceFuturesStore";

function formatPrice(p) {
  if (!p || !Number.isFinite(p)) return "--";
  const digits = p < 1 ? 6 : 2;
  return `$${p.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export default function Trading({ language = "en" }) {
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    const stored = localStorage.getItem("trading_symbol");
    return stored ? String(stored).toUpperCase() : "BTCUSDT";
  });

  const [lastPrice, setLastPrice] = useState(0);
  const [changePct, setChangePct] = useState(0);

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
      ? { market: "السوق", last: "آخر سعر", change: "تغير 24س" }
      : { market: "Market", last: "Last", change: "24h" };
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
            <div className="mr-3 hidden sm:block">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{t.market}</div>
              <div className="text-[11px] text-slate-500">Binance USDT‑M</div>
            </div>
            <BinanceSymbolSelector
              selectedSymbol={selectedSymbol}
              onSelectSymbol={(s) => setSelectedSymbol(s)}
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
            <BinanceFuturesChart symbol={selectedSymbol} language={language} onPriceUpdate={(p) => setLastPrice(p)} />
          </div>
          <div className="h-[320px] min-h-[240px] max-h-[50vh]">
            <FuturesActivityTabs symbol={selectedSymbol} language={language} />
          </div>
        </section>

        <section className="hidden lg:block w-[360px] xl:w-[420px] shrink-0">
          <FuturesTradePanel symbol={selectedSymbol} language={language} />
        </section>
      </main>
    </div>
  );
}

Trading.propTypes = {
  language: PropTypes.string,
};