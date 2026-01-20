import { useEffect, useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { ArrowLeft, Lock, RefreshCw, Wifi, WifiOff } from "lucide-react";
import BinanceFuturesChart from "@/components/trading/binance/BinanceFuturesChart";
import BinanceSymbolSelector from "@/components/trading/binance/BinanceSymbolSelector";
import FuturesTradePanel from "@/components/trading/binance/FuturesTradePanel";
import FuturesActivityTabs from "@/components/trading/binance/FuturesActivityTabs";
import AccountBalanceBar from "@/components/trading/futures/AccountBalanceBar";
import MobileTradeView from "@/components/trading/futures/MobileTradeView";
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
  const isAr = language === "ar";
  
  // Responsive breakpoint detection
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  
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
  const [markPrices, setMarkPrices] = useState({});

  // Demo account state (separate from OKX)
  const [demoAccount, setDemoAccount] = useState(null);

  // Closing position state
  const [closingPositionId, setClosingPositionId] = useState(null);

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
        }
      } catch {}
    };
    
    loadDemoAccount();
  }, [isAuthenticated, isLoadingAuth]);

  // WebSocket connection status - check both public and business WS
  useEffect(() => {
    const updateConnectionStatus = () => {
      const publicConnected = binanceFuturesStore.wsConnected?.public === true;
      const businessConnected = binanceFuturesStore.wsConnected?.business === true;
      setWsConnected(publicConnected || businessConnected);
    };

    const unsubPublic = binanceFuturesStore.subscribe("ws:public:connected", (connected) => {
      if (connected === true) {
        setWsConnected(true);
      }
      updateConnectionStatus();
    });
    const unsubBusiness = binanceFuturesStore.subscribe("ws:business:connected", (connected) => {
      if (connected === true) {
        setWsConnected(true);
      }
      updateConnectionStatus();
    });
    
    // Also subscribe to price updates as a secondary indicator
    const unsubPrice = binanceFuturesStore.subscribe(`price:${selectedSymbol}`, () => {
      // If we're receiving prices, we're definitely connected
      setWsConnected(true);
    });

    // Check initial state after a short delay
    const timer = setTimeout(updateConnectionStatus, 500);

    return () => {
      clearTimeout(timer);
      try { unsubPublic?.(); } catch {}
      try { unsubBusiness?.(); } catch {}
      try { unsubPrice?.(); } catch {}
    };
  }, [selectedSymbol]);

  // Subscribe to mark prices for all positions
  useEffect(() => {
    if (!livePositions.length) return;

    const symbols = [...new Set(livePositions.map(p => p.instId || p.symbol).filter(Boolean))];
    
    const unsubs = symbols.map(sym => 
      binanceFuturesStore.subscribe(`price:${sym}`, (price) => {
        if (Number.isFinite(price)) {
          setMarkPrices(prev => ({ ...prev, [sym]: price }));
        }
      })
    );

    // Initialize from tickers
    symbols.forEach(sym => {
      const ticker = binanceFuturesStore.getTicker(sym);
      if (ticker?.lastPrice) {
        setMarkPrices(prev => ({ ...prev, [sym]: Number(ticker.lastPrice) }));
      }
    });

    return () => {
      unsubs.forEach(u => { try { u?.(); } catch {} });
    };
  }, [livePositions.map(p => p.instId).join(",")]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      try { binanceFuturesStore.closeChartWs(); } catch {}
    };
  }, []);

  // Stats display
  const stats = useMemo(
    () => [
      { label: isAr ? "السعر" : "Price", value: formatPrice(lastPrice) },
      { label: isAr ? "التغير" : "Change", value: `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`, isPositive: changePct >= 0 },
      { label: isAr ? "الحجم" : "Volume", value: formatCompactNumber(quoteVolume) },
    ],
    [lastPrice, changePct, quoteVolume, isAr]
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
    if (!hasLiveAccount || !pos) return;
    
    const id = pos?.id || `${pos?.instId}_${pos?.posSide}`;
    const posSide = pos.posSide || (pos.side === "SHORT" ? "short" : "long");
    
    setClosingPositionId(id);
    
    try {
      await base44.functions.invoke("okxUserAccount", {
        action: "closePosition",
        instId: pos.instId || pos.symbol,
        posSide,
        size: pos.size || pos.quantity || undefined,
      });
      await refreshPositions();
    } catch (err) {
      console.error("Failed to close position:", err);
    } finally {
      setClosingPositionId(null);
    }
  }, [hasLiveAccount, refreshPositions]);

  // Callback after trade placed
  const handleTradesChanged = useCallback(async () => {
    await refreshPositions();
  }, [refreshPositions]);

  const handleAccountsChanged = useCallback(async () => {
    await refreshOKXAccount();
  }, [refreshOKXAccount]);

  // Price update handler
  const handlePriceUpdate = useCallback((p) => {
    setLastPrice(p);
    const ticker = binanceFuturesStore.getTicker?.(selectedSymbol);
    if (ticker?.priceChangePercent) setChangePct(Number(ticker.priceChangePercent) || 0);
    if (ticker?.quoteVolume) setQuoteVolume(Number(ticker.quoteVolume) || 0);
  }, [selectedSymbol]);

  // Chart component (shared between mobile and desktop)
  const chartComponent = (
    <div className="h-full w-full min-h-[250px]">
      <BinanceFuturesChart
        symbol={selectedSymbol}
        language={language}
        onPriceUpdate={handlePriceUpdate}
        positionTrade={livePositions.find(p => p.instId === selectedSymbol)}
        pendingOrders={liveOrders.filter(o => o.instId === selectedSymbol)}
      />
    </div>
  );

  // Trade panel component
  const tradePanelComponent = (
    <FuturesTradePanel
      liveAccount={liveAccount}
      demoAccount={demoAccount}
      symbol={selectedSymbol}
      onTradesChanged={handleTradesChanged}
      onAccountsChanged={handleAccountsChanged}
      language={language}
    />
  );

  // Activity component
  const activityComponent = (
    <FuturesActivityTabs
      trades={liveTrades}
      symbol={selectedSymbol}
      language={language}
      dataSource="okx"
      accountId={liveAccount?.id}
      onRefresh={handleRefresh}
      onCloseTrade={handleCloseLivePosition}
    />
  );

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="flex h-screen flex-col bg-background">
        {/* Mobile Header */}
        <div className="border-b border-border px-3 py-2.5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => window.history.back()} className="text-foreground/60 hover:text-foreground transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <BinanceSymbolSelector 
                selectedSymbol={selectedSymbol} 
                onSelectSymbol={handleSymbolChange} 
                language={language}
                height="compact"
              />
            </div>
            
            <div className="flex items-center gap-2">
              {/* Connection status */}
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                wsConnected ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
              }`}>
                {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              </div>
              
              {!isAuthenticated && !isLoadingAuth && (
                <button
                  onClick={navigateToLogin}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  <Lock className="h-3 w-3" />
                  {isAr ? "دخول" : "Login"}
                </button>
              )}
            </div>
          </div>
          
          {/* Price stats row */}
          <div className="flex items-center gap-4 mt-2">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">{stat.label}:</span>
                <span className={`text-xs font-semibold ${
                  stat.isPositive !== undefined 
                    ? (stat.isPositive ? "text-emerald-500" : "text-rose-500")
                    : "text-foreground"
                }`}>
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Trade View */}
        {!isAuthenticated ? (
          <div className="flex flex-1 items-center justify-center p-4 text-center">
            <div>
              <Lock className="mx-auto mb-3 h-10 w-10 text-foreground/40" />
              <p className="text-sm text-foreground/60 mb-4">
                {isAr ? "يجب تسجيل الدخول للتداول" : "Login required to trade"}
              </p>
              <button
                onClick={navigateToLogin}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              >
                {isAr ? "تسجيل الدخول" : "Login"}
              </button>
            </div>
          </div>
        ) : (
          <MobileTradeView
            account={liveAccount}
            positions={livePositions}
            orders={liveOrders}
            markPrices={markPrices}
            totalUnrealizedPnl={totalUnrealizedPnl}
            language={language}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            onClosePosition={handleCloseLivePosition}
            closingPositionId={closingPositionId}
            chartComponent={chartComponent}
            tradePanelComponent={tradePanelComponent}
            activityComponent={activityComponent}
          />
        )}
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* Desktop Header - Compact */}
      <div className="border-b border-border px-4 py-2 shrink-0 bg-card/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => window.history.back()} className="text-foreground/60 hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-foreground">
              {isAr ? "التداول" : "Trading"}
            </h1>
            
            {/* Connection status */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
              wsConnected ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"
            }`}>
              {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span>{wsConnected ? "Live" : "Connecting"}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{isAr ? "تحديث" : "Refresh"}</span>
              </button>
            )}
            
            {!isAuthenticated && !isLoadingAuth && (
              <button
                onClick={navigateToLogin}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Lock className="h-3.5 w-3.5" />
                {isAr ? "دخول" : "Login"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chart + Activity */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Symbol Selector + Stats - Compact */}
          <div className="border-b border-border px-4 py-2 bg-card/30">
            <div className="flex items-center justify-between gap-3">
              <BinanceSymbolSelector 
                selectedSymbol={selectedSymbol} 
                onSelectSymbol={handleSymbolChange} 
                language={language} 
              />
              
              <div className="flex items-center gap-4 lg:gap-6">
                {stats.map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                    <div className={`text-xs lg:text-sm font-semibold font-mono ${
                      stat.isPositive !== undefined 
                        ? (stat.isPositive ? "text-emerald-500" : "text-rose-500")
                        : "text-foreground"
                    }`}>
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Balance Bar (Desktop) - Compact */}
          {isAuthenticated && hasLiveAccount && (
            <div className="px-4 py-2 border-b border-border bg-card/20">
              <AccountBalanceBar
                account={liveAccount}
                totalUnrealizedPnl={totalUnrealizedPnl}
                language={language}
                onRefresh={handleRefresh}
                isRefreshing={isRefreshing}
                compact={true}
              />
            </div>
          )}

          {/* Chart - Optimized height */}
          <div className="flex-1 overflow-hidden px-3 py-2 min-h-0">
            <div className="h-full min-h-[250px]">
              {chartComponent}
            </div>
          </div>

          {/* Activity Tabs - Optimized height */}
          <div className="border-t border-border h-[240px] lg:h-[260px] overflow-hidden shrink-0">
            {activityComponent}
          </div>
        </div>

        {/* Right: Trade Panel */}
        <div className="w-[320px] lg:w-[360px] border-l border-border flex flex-col overflow-hidden shrink-0">
          {!isAuthenticated ? (
            <div className="flex flex-1 items-center justify-center p-4 text-center">
              <div>
                <Lock className="mx-auto mb-3 h-8 w-8 text-foreground/40" />
                <p className="text-sm text-foreground/60">
                  {isAr ? "يجب تسجيل الدخول للتداول" : "Login required to trade"}
                </p>
                <button
                  onClick={navigateToLogin}
                  className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {isAr ? "تسجيل الدخول" : "Login"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Trade Panel */}
              <div className="flex-1 overflow-auto">
                {tradePanelComponent}
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