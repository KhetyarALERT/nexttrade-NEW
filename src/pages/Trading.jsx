import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { ArrowLeft, Lock, ChevronUp, ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
import BinanceFuturesChart from "@/components/trading/binance/BinanceFuturesChart";
import BinanceSymbolSelector from "@/components/trading/binance/BinanceSymbolSelector";
import MobileFuturesTradePanel from "@/components/trading/mobile/MobileFuturesTradePanel";
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

  // Mobile-specific state
  const [mobileView, setMobileView] = useState("chart"); // "chart" | "trade" | "positions"
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
    binanceFuturesStore.startTickerPolling?.(7000);
    return () => {
      try { binanceFuturesStore.stopTickerPolling?.(); } catch {}
      try { binanceFuturesStore.stopPremiumPolling?.(); } catch {}
      try { binanceFuturesStore.closeChartWs?.(); } catch {}
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
    };
    loadAccounts();
    return () => { cancelled = true; };
  }, [isAuthenticated, isLoadingAuth, refreshAccounts]);

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

  const isUp = changePct >= 0;

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground">
        {/* Compact Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <button onClick={() => window.history.back()} className="p-1.5 rounded-lg hover:bg-muted">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <BinanceSymbolSelector 
              selectedSymbol={selectedSymbol} 
              onSelectSymbol={handleSymbolChange} 
              language={language}
              compact
            />
          </div>
          {!isAuthenticated && (
            <button onClick={navigateToLogin} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
              <Lock className="h-3.5 w-3.5" />
              {language === "ar" ? "دخول" : "Login"}
            </button>
          )}
        </div>

        {/* Price Info Bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tabular-nums">{formatPrice(lastPrice)}</span>
            <span className={`flex items-center gap-0.5 text-sm font-medium ${isUp ? "text-emerald-500" : "text-rose-500"}`}>
              {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {changePct.toFixed(2)}%
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Vol: {formatCompactNumber(quoteVolume)}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {mobileView === "chart" && (
            <div className="flex-1 min-h-0">
              <BinanceFuturesChart
                symbol={selectedSymbol}
                onPriceUpdate={setLastPrice}
                onChangeUpdate={setChangePct}
                onVolumeUpdate={setQuoteVolume}
              />
            </div>
          )}

          {mobileView === "trade" && (
            <div className="flex-1 overflow-auto p-3">
              {!isAuthenticated ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <Lock className="h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">{language === "ar" ? "سجل دخول للتداول" : "Login to trade"}</p>
                  <button onClick={navigateToLogin} className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold">
                    {language === "ar" ? "تسجيل الدخول" : "Login"}
                  </button>
                </div>
              ) : (
                <MobileFuturesTradePanel
                  liveAccount={liveAccount}
                  demoAccount={demoAccount}
                  symbol={selectedSymbol}
                  lastPrice={lastPrice}
                  onTradesChanged={() => refreshLiveTrades(liveAccount)}
                  onAccountsChanged={refreshAccounts}
                  language={language}
                />
              )}
            </div>
          )}

          {mobileView === "positions" && (
            <div className="flex-1 overflow-auto">
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
          )}
        </div>

        {/* Mobile Bottom Tabs */}
        <div className="flex items-center border-t border-border bg-card safe-area-bottom">
          {[
            { id: "chart", label: language === "ar" ? "الرسم" : "Chart", icon: "📈" },
            { id: "trade", label: language === "ar" ? "تداول" : "Trade", icon: "💹" },
            { id: "positions", label: language === "ar" ? "المراكز" : "Positions", icon: "📊" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMobileView(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                mobileView === tab.id 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => window.history.back()} className="text-foreground/60 hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{language === "ar" ? "التداول" : "Trading"}</h1>
          </div>
          {!isAuthenticated && !isLoadingAuth && (
            <button
              onClick={navigateToLogin}
              className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Lock className="h-4 w-4" />
              {language === "ar" ? "دخول" : "Login"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-border px-4 py-3 sm:px-6">
            <BinanceSymbolSelector selectedSymbol={selectedSymbol} onSelectSymbol={handleSymbolChange} language={language} />
          </div>

          <div className="grid grid-cols-3 gap-2 border-b border-border px-4 py-3 sm:gap-4 sm:px-6">
            <div>
              <div className="text-xs font-medium text-foreground/60 sm:text-sm">{language === "ar" ? "السعر" : "Price"}</div>
              <div className="text-sm font-semibold text-foreground sm:text-base">{formatPrice(lastPrice)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-foreground/60 sm:text-sm">{language === "ar" ? "التغير" : "Change"}</div>
              <div className={`text-sm font-semibold sm:text-base ${isUp ? "text-emerald-500" : "text-rose-500"}`}>{changePct.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-xs font-medium text-foreground/60 sm:text-sm">{language === "ar" ? "الحجم" : "Volume"}</div>
              <div className="text-sm font-semibold text-foreground sm:text-base">{formatCompactNumber(quoteVolume)}</div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden p-2 sm:p-4">
            <div className="h-full w-full min-h-[300px]">
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

        <div className="hidden lg:flex w-80 flex-col border-l border-border">
          {!isAuthenticated ? (
            <div className="flex flex-1 items-center justify-center p-4 text-center">
              <div>
                <Lock className="mx-auto mb-3 h-8 w-8 text-foreground/40" />
                <p className="text-sm text-foreground/60">{language === "ar" ? "سجل دخول للتداول" : "Login to trade"}</p>
                <button onClick={navigateToLogin} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                  {language === "ar" ? "دخول" : "Login"}
                </button>
              </div>
            </div>
          ) : (
            <FuturesTradePanel
              liveAccount={liveAccount}
              demoAccount={demoAccount}
              symbol={selectedSymbol}
              onTradesChanged={() => refreshLiveTrades(liveAccount)}
              onAccountsChanged={refreshAccounts}
              language={language}
            />
          )}
        </div>
      </div>
    </div>
  );
}

Trading.propTypes = {
  language: PropTypes.string,
};