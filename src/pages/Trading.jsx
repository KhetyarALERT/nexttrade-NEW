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
import { normalizeOkxSymbol } from "@/lib/market/okxSymbols";

function formatPrice(p) {
  if (!p || !Number.isFinite(p)) return "--";
  const digits = p < 1 ? 6 : 2;
  return `$${p.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function formatCompactNumber(value) {
  if (!Number.isFinite(value)) return "—";
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

export default function Trading({ language = "en" }) {
  const { isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    const stored = localStorage.getItem("trading_symbol");
    const normalized = normalizeOkxSymbol(stored || "BTC-USDT-SWAP");
    return normalized || "BTC-USDT-SWAP";
  });

  const [lastPrice, setLastPrice] = useState(0);
  const [changePct, setChangePct] = useState(0);
  const [quoteVolume, setQuoteVolume] = useState(0);

  const [liveAccount, setLiveAccount] = useState(null);
  const [demoAccount, setDemoAccount] = useState(null);

  const [liveTrades, setLiveTrades] = useState([]);
  const [demoTrades, setDemoTrades] = useState([]);

  const accountsInFlightRef = useRef(false);
  const refreshLiveTrades = useCallback(async (account) => {
    if (!account?.id) {
      setLiveTrades([]);
      return;
    }
    try {
      const [posRes, orderRes] = await Promise.all([
        base44.functions.invoke("okxTrading", { action: "getPositions", accountId: account.id }),
        base44.functions.invoke("okxTrading", { action: "getOrders", accountId: account.id, status: "open" }),
      ]);

      const positions = posRes?.data?.ok ? posRes.data.data : [];
      const orders = orderRes?.data?.ok ? orderRes.data.data : [];

      const mappedPositions = (positions || []).map((p) => ({
        id: p.id,
        symbol: p.instId,
        side: String(p.posSide || "").toUpperCase() === "SHORT" ? "SHORT" : "LONG",
        quantity: Math.abs(Number(p.size || 0)),
        entry_price: Number(p.entryPrice || 0),
        margin: Number(p.margin || 0),
        leverage: Number(p.leverage || 0),
        status: "OPEN",
        created_at: p.openedAt,
        mark_price: p.markPrice,
      }));

      const mappedOrders = (orders || []).map((o) => ({
        id: o.id,
        instId: o.instId,
        symbol: o.instId,
        side: String(o.side || "").toUpperCase() === "SELL" ? "SHORT" : "LONG",
        quantity: Number(o.size || 0),
        entry_price: Number(o.price || 0),
        order_type: String(o.orderType || "").toUpperCase(),
        status: "PENDING",
        created_at: o.createdAt,
      }));

      setLiveTrades([...mappedPositions, ...mappedOrders]);
    } catch {
      setLiveTrades([]);
    }
  }, []);

  const refreshAccounts = useCallback(async () => {
    if (accountsInFlightRef.current) return;
    accountsInFlightRef.current = true;
    try {
      const [demoResult, liveResult] = await Promise.all([
        base44.functions.invoke("tradingAccount", { action: "getOrCreate", accountType: "demo" }),
        base44.functions.invoke("okxProvisioning", { action: "listSubaccounts" }),
      ]);

      if (demoResult?.data?.success) {
        setDemoAccount(demoResult.data.data);
        setDemoTrades(demoResult.data.data?.trades || []);
      }

      if (liveResult?.data?.ok && Array.isArray(liveResult.data.data)) {
        const active = liveResult.data.data.find((a) => a.status === "ACTIVE") || liveResult.data.data[0];
        setLiveAccount(active || null);
        if (active) await refreshLiveTrades(active);
      }
    } catch {
      // ignore
    } finally {
      accountsInFlightRef.current = false;
    }
  }, [refreshLiveTrades]);

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
    setSelectedSymbol(normalizeOkxSymbol(symbol));
  }, []);

  const handleCloseLivePosition = useCallback(async (pos) => {
    if (!liveAccount?.id || !pos?.symbol) return;
    const posSide = pos.side === "SHORT" ? "short" : "long";
    try {
      await base44.functions.invoke("okxTrading", {
        action: "closePosition",
        accountId: liveAccount.id,
        instId: pos.symbol,
        posSide,
        size: pos.quantity || undefined,
      });
    } finally {
      await refreshLiveTrades(liveAccount);
    }
  }, [liveAccount, refreshLiveTrades]);

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
            <BinanceSymbolSelector selectedSymbol={selectedSymbol} onSelectSymbol={handleSymbolChange} language={language} />
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
            <FuturesActivityTabs
              trades={liveTrades}
              symbol={selectedSymbol}
              language={language}
              dataSource="okx"
              accountId={liveAccount?.id}
              onRefresh={() => refreshLiveTrades(liveAccount)}
              onCloseTrade={handleCloseLivePosition}
            />
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
              <FuturesTradePanel
                liveAccount={liveAccount}
                demoAccount={demoAccount}
                symbol={selectedSymbol}
                onTradesChanged={() => refreshLiveTrades(liveAccount)}
                onAccountsChanged={() => refreshAccounts()}
                language={language}
              />
              <div className="flex-1 overflow-hidden border-t border-border">
                <FuturesActivityTabs
                  trades={liveTrades}
                  symbol={selectedSymbol}
                  language={language}
                  dataSource="okx"
                  accountId={liveAccount?.id}
                  onRefresh={() => refreshLiveTrades(liveAccount)}
                  compact={true}
                  onCloseTrade={handleCloseLivePosition}
                />
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
