import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { ArrowLeft, Lock, RefreshCw, Wifi, WifiOff } from "lucide-react";
import BinanceFuturesChart from "@/components/trading/binance/BinanceFuturesChart";
import BinanceSymbolSelector from "@/components/trading/binance/BinanceSymbolSelector";
import FuturesTradePanel from "@/components/trading/binance/FuturesTradePanel";
import FuturesActivityTabs from "@/components/trading/binance/FuturesActivityTabs";
import { binanceFuturesStore } from "@/components/trading/binance/binanceFuturesStore";
import { useOKXAccount } from "@/components/trading/hooks/useOKXAccount";
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
  
  // Symbol selection with persistence
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    const stored = localStorage.getItem("trading_symbol");
    return normalizeOkxSymbol(stored || "BTC-USDT-SWAP") || "BTC-USDT-SWAP";
  });

  // Market data state
  const [lastPrice, setLastPrice] = useState(0);
  const [changePct, setChangePct] = useState(0);
  const [quoteVolume, setQuoteVolume] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);

  // Demo account state (separate from OKX)
  const [demoAccount, setDemoAccount] = useState(null);
  const [demoTrades, setDemoTrades] = useState([]);

  // Use the OKX account hook for live trading
  const {
    account: liveAccount,
    hasAccount: hasLiveAccount,
    positions: livePositions,
    orders: liveOrders,
    trades: liveTrades,
    totalUnrealizedPnl,
    loading: accountLoading,
    refresh: refreshOKXAccount,
    refreshPositions,
  } = useOKXAccount({ enabled: isAuthenticated && !isLoadingAuth });

  // Track refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Persist symbol selection
  useEffect(() => {
    localStorage.setItem("trading_symbol", selectedSymbol);
  }, [selectedSymbol]);

  // Load demo account
  useEffect(() => {
    if (!isAuthenticated || isLoadingAuth) return;
    
    const loadDemoAccount = async () => {
      try {
        const res = await base44.functions.invoke("tradingAccount", {
          action: "getOrCreate",
          accountType: "demo"
        });
        if (res?.data?.success) {
          setDemoAccount(res.data.data);
          setDemoTrades(res.data.data?.trades || []);
        }
      } catch {}
    };
    
    loadDemoAccount();
  }, [isAuthenticated, isLoadingAuth]);

  // WebSocket connection status
  useEffect(() => {
    const unsubPublic = binanceFuturesStore.subscribe("ws:public:connected", (connected) => {
      setWsConnected(connected);
    });
    const unsubBusiness = binanceFuturesStore.subscribe("ws:business:connected", (connected) => {
      setWsConnected(prev => prev || connected);
    });

    return () => {
      try { unsubPublic?.(); } catch {}
      try { unsubBusiness?.(); } catch {}
    };
  }, []);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      try { binanceFuturesStore.closeChartWs(); } catch {}
    };
  }, []);

  // Responsive chart height
  const chartHeight = useMemo(() => {
    if (typeof window === "undefined") return "h-[400px]";
    const width = window.innerWidth;
    if (width < 640) return "h-[280px]";
    if (width < 768) return "h-[320px]";
    if (width < 1024) return "h-[360px]";
    return "h-[400px]";
  }, []);

  // Stats display
  const stats = useMemo(
    () => [
      { label: language === "ar" ? "السعر" : "Price", value: formatPrice(lastPrice) },
      { label: language === "ar" ? "التغير" : "Change", value: `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`, isPositive: changePct >= 0 },
      { label: language === "ar" ? "الحجم" : "Volume", value: formatCompactNumber(quoteVolume) },
    ],
    [lastPrice, changePct, quoteVolume, language]
  );

  // Symbol change handler
  const handleSymbolChange = useCallback((symbol) => {
    setSelectedSymbol(normalizeOkxSymbol(symbol));
  }, []);

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshOKXAccount();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshOKXAccount]);

  // Close position handler
  const handleCloseLivePosition = useCallback(async (pos) => {
    if (!hasLiveAccount || !pos?.symbol) return;
    
    const posSide = pos.posSide || (pos.side === "SHORT" ? "short" : "long");
    
    try {
      await base44.functions.invoke("okxUserAccount", {
        action: "closePosition",
        instId: pos.symbol || pos.instId,
        posSide,
        size: pos.quantity || pos.size || undefined,
      });
    } finally {
      await refreshPositions();
    }
  }, [hasLiveAccount, refreshPositions]);

  // Callback after trade placed
  const handleTradesChanged = useCallback(async () => {
    await refreshPositions();
  }, [refreshPositions]);

  const handleAccountsChanged = useCallback(async () => {
    await refreshOKXAccount();
  }, [refreshOKXAccount]);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => window.history.back()} className="text-foreground/60 hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
              {language === "ar" ? "التداول" : "Trading"}
            </h1>
            
            {/* Connection status indicator */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
              wsConnected 
                ? "bg-emerald-500/10 text-emerald-500" 
                : "bg-amber-500/10 text-amber-500"
            }`}>
              {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span className="hidden sm:inline">{wsConnected ? "Live" : "Connecting..."}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{language === "ar" ? "تحديث" : "Refresh"}</span>
              </button>
            )}
            
            {!isAuthenticated && !isLoadingAuth && (
              <button
                onClick={navigateToLogin}
                className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Lock className="h-4 w-4" />
                {language === "ar" ? "تسجيل الدخول" : "Login"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden sm:flex-row">
        {/* Chart Section */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Symbol Selector */}
          <div className="border-b border-border px-4 py-3 sm:px-6">
            <BinanceSymbolSelector 
              selectedSymbol={selectedSymbol} 
              onSelectSymbol={handleSymbolChange} 
              language={language} 
            />
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-2 border-b border-border px-4 py-3 sm:gap-4 sm:px-6">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="text-xs font-medium text-foreground/60 sm:text-sm">{stat.label}</div>
                <div className={`text-sm font-semibold sm:text-base ${
                  stat.isPositive !== undefined 
                    ? (stat.isPositive ? "text-emerald-500" : "text-rose-500")
                    : "text-foreground"
                }`}>
                  {stat.value}
                </div>
              </div>
            ))}
            
            {/* Account balance indicator (mobile) */}
            {isAuthenticated && hasLiveAccount && (
              <div className="col-span-3 flex items-center justify-between pt-2 border-t border-border/50 sm:hidden">
                <span className="text-xs text-muted-foreground">
                  {language === "ar" ? "الرصيد المتاح" : "Available"}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {formatCompactNumber(liveAccount?.availableBalance || 0)} USDT
                </span>
              </div>
            )}
          </div>

          {/* Chart */}
          <div className="flex-1 overflow-hidden px-2 py-2 sm:px-4 sm:py-3">
            <div className={`${chartHeight} w-full min-h-[250px]`}>
              <BinanceFuturesChart
                symbol={selectedSymbol}
                language={language}
                onPriceUpdate={(p) => {
                  setLastPrice(p);
                  const ticker = binanceFuturesStore.getTicker?.(selectedSymbol);
                  if (ticker?.priceChangePercent) setChangePct(Number(ticker.priceChangePercent) || 0);
                  if (ticker?.quoteVolume) setQuoteVolume(Number(ticker.quoteVolume) || 0);
                }}
                positionTrade={livePositions.find(p => p.instId === selectedSymbol)}
                pendingOrders={liveOrders.filter(o => o.instId === selectedSymbol)}
              />
            </div>
          </div>

          {/* Activity Tabs (main area) */}
          <div className="border-t border-border">
            <FuturesActivityTabs
              trades={liveTrades}
              symbol={selectedSymbol}
              language={language}
              dataSource="okx"
              accountId={liveAccount?.id}
              onRefresh={handleRefresh}
              onCloseTrade={handleCloseLivePosition}
            />
          </div>
        </div>

        {/* Trade Panel Sidebar */}
        <div className="flex w-full flex-col border-t border-border sm:w-80 sm:flex-col sm:border-l sm:border-t-0">
          {!isAuthenticated ? (
            <div className="flex flex-1 items-center justify-center p-4 text-center">
              <div>
                <Lock className="mx-auto mb-3 h-8 w-8 text-foreground/40" />
                <p className="text-sm text-foreground/60">
                  {language === "ar" ? "يجب تسجيل الدخول للتداول" : "Login required to trade"}
                </p>
                <button
                  onClick={navigateToLogin}
                  className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {language === "ar" ? "تسجيل الدخول" : "Login"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <FuturesTradePanel
                liveAccount={liveAccount}
                demoAccount={demoAccount}
                symbol={selectedSymbol}
                onTradesChanged={handleTradesChanged}
                onAccountsChanged={handleAccountsChanged}
                language={language}
              />
              
              {/* Compact activity tabs in sidebar */}
              <div className="flex-1 overflow-hidden border-t border-border hidden lg:block">
                <FuturesActivityTabs
                  trades={liveTrades}
                  symbol={selectedSymbol}
                  language={language}
                  dataSource="okx"
                  accountId={liveAccount?.id}
                  onRefresh={handleRefresh}
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