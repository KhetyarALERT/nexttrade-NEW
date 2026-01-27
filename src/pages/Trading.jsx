import { useEffect, useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { ArrowLeft, Lock, RefreshCw, Wifi, WifiOff } from "lucide-react";
import BinanceFuturesChart from "@/components/trading/binance/BinanceFuturesChart";
import BinanceSymbolSelector from "@/components/trading/binance/BinanceSymbolSelector";
import FuturesTradePanel from "@/components/trading/binance/FuturesTradePanel";
import FuturesActivityTabs from "@/components/trading/binance/FuturesActivityTabs";
import AccountBalanceBar from "@/components/trading/futures/AccountBalanceBar";
import MobileTradeView from "@/components/trading/futures/MobileTradeView";
import OrderBookPanel from "@/components/trading/futures/OrderBookPanel";
import TradeTapePanel from "@/components/trading/futures/TradeTapePanel";
import { binanceFuturesStore } from "@/components/trading/binance/binanceFuturesStore";
import { useOKXAccount } from "@/components/trading/hooks/useOKXAccount";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { normalizeOkxSymbol } from "@/lib/market/okxSymbols";
import { useUserReadiness } from "@/components/hooks/useUserReadiness";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Shield as ShieldIcon, XCircle, Clock as ClockIcon, ArrowRight } from "lucide-react";

function formatPrice(p) {
  if (!p || !Number.isFinite(p)) return "--";
  const digits = p < 1 ? 6 : 2;
  return `$${p.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function formatCompactNumber(value) {
  if (!Number.isFinite(value)) return "—";
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

import { useLocation } from "react-router-dom";
import CopyTradingDashboard from "@/components/copytrading/CopyTradingDashboard";
import CopyWalletPanel from "@/components/copytrading/CopyWalletPanel";
import SignalsInbox from "@/components/copytrading/SignalsInbox";
import CopyPositionsTable from "@/components/copytrading/CopyPositionsTable";
import NotificationBell from "@/components/notifications/NotificationBell";

export default function Trading({ language = "en" }) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isCopyMode = searchParams.get("tab") === "bots";
  
  // Deep-link handling: instId and positionId from URL params
  const urlInstId = searchParams.get("instId");
  const urlPositionId = searchParams.get("positionId");
  const urlSignalId = searchParams.get("signalId");

  const { isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();

  const toggleMode = (mode) => {
    const newParams = new URLSearchParams(searchParams);
    if (mode === 'bots') {
      newParams.set('tab', 'bots');
    } else {
      newParams.delete('tab'); // default to trade
    }
    setSearchParams(newParams);
  };
  const { isReady, nextAction, loading: loadingReadiness } = useUserReadiness({ enabled: isAuthenticated && !isLoadingAuth });
  const isAr = language === "ar";
  
  // Responsive breakpoint detection
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  
  // Symbol selection with persistence + deep-link override
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    if (urlInstId) return normalizeOkxSymbol(urlInstId);
    const stored = localStorage.getItem("trading_symbol");
    return normalizeOkxSymbol(stored || "BTC-USDT-SWAP") || "BTC-USDT-SWAP";
  });
  
  // Apply deep-link instId on mount if present
  useEffect(() => {
    if (urlInstId) {
      const normalized = normalizeOkxSymbol(urlInstId);
      if (normalized) setSelectedSymbol(normalized);
    }
  }, [urlInstId]);

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

  // Copy Trading State
  const [paperPositions, setPaperPositions] = useState([]);
  
  useEffect(() => {
    if (isCopyMode && isAuthenticated) {
      const loadPaperPositions = async () => {
        try {
          const res = await base44.functions.invoke('copyTradingUser', { action: 'getPositions', status: 'OPEN' });
          if (res.data?.ok) setPaperPositions(res.data.data || []);
        } catch (e) { console.error(e); }
      };
      loadPaperPositions();
      // Poll every 10s
      const interval = setInterval(loadPaperPositions, 10000);
      return () => clearInterval(interval);
    }
  }, [isCopyMode, isAuthenticated, isRefreshing]);

  // Persist symbol selection
  useEffect(() => {
    localStorage.setItem("trading_symbol", selectedSymbol);
  }, [selectedSymbol]);

  // Load demo account via backend function (service role creates if needed)
  useEffect(() => {
    if (!isAuthenticated || isLoadingAuth) return;
    
    let mounted = true;
    const loadDemoAccount = async () => {
      try {
        const res = await base44.functions.invoke("tradingAccount", {
          action: "getOrCreate",
          accountType: "demo"
        });
        if (mounted && res?.data?.success) {
          setDemoAccount(res.data.data);
        }
      } catch (err) {
        console.error("Failed to load demo account:", err);
      }
    };
    
    loadDemoAccount();
    return () => { mounted = false; };
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

  // Cleanup WebSocket ONLY when leaving trading page entirely
  useEffect(() => {
    return () => {
      // Close WS connections when user navigates away from trading
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
  // In Copy Mode, show paper position on chart. In Live Mode, show real position.
  const activePosition = isCopyMode 
    ? paperPositions.find(p => p.symbol === selectedSymbol)
    : livePositions.find(p => p.instId === selectedSymbol);

  const chartComponent = (
    <div className="h-full w-full min-h-[250px]">
      <BinanceFuturesChart
        symbol={selectedSymbol}
        language={language}
        onPriceUpdate={handlePriceUpdate}
        positionTrade={activePosition}
        pendingOrders={isCopyMode ? [] : liveOrders.filter(o => o.instId === selectedSymbol)}
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

  // Note: Removed blocking gate - Futures page is always accessible
  // Users without accounts can view charts/prices and see prompts to complete onboarding
  // The hasLiveAccount check in the UI will show/hide trading controls appropriately
  
  // Mobile Layout - Full screen
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

  // Copy Mode Mobile State
  const [copyMobileTab, setCopyMobileTab] = useState('signals'); // signals | chart | positions
  const [walletOpen, setWalletOpen] = useState(false);

  // Copy Mode Layout
  if (isCopyMode) {
    // MOBILE COPY MODE
    if (isMobile) {
      return (
        <div className="flex h-screen flex-col bg-background overflow-hidden">
          {/* Mobile Header with Mode Toggle */}
          <div className="border-b border-border px-3 py-2 shrink-0 bg-background/80 backdrop-blur z-20">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => window.history.back()} className="text-foreground/60">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex bg-muted/50 p-1 rounded-lg">
                <button
                  onClick={() => toggleMode('trade')}
                  className={`px-3 py-1 rounded text-[10px] font-medium transition-all ${!isCopyMode ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                >
                  Trade
                </button>
                <button
                  onClick={() => toggleMode('bots')}
                  className={`px-3 py-1 rounded text-[10px] font-medium transition-all ${isCopyMode ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground'}`}
                >
                  Signals
                </button>
              </div>
              <div className="flex items-center gap-1">
                {isAuthenticated && <NotificationBell />}
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setWalletOpen(true)}>
                  <ShieldIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Segmented Control */}
            <div className="grid grid-cols-3 gap-1 bg-muted/30 p-1 rounded-lg">
              {['signals', 'chart', 'positions'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setCopyMobileTab(tab)}
                  className={`py-1.5 text-xs font-medium rounded-md capitalize transition-all ${
                    copyMobileTab === tab 
                      ? 'bg-background text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden relative">
            {copyMobileTab === 'signals' && (
              <div className="h-full overflow-hidden">
                <SignalsInbox 
                  onSignalAccepted={() => { 
                    handleRefresh(); 
                    setCopyMobileTab('positions'); 
                  }} 
                  liveAccount={liveAccount}
                  onSymbolFocus={(symbol) => {
                    setSelectedSymbol(symbol);
                    setCopyMobileTab('chart');
                  }}
                />
              </div>
            )}
            
            {copyMobileTab === 'chart' && (
              <div className="h-full w-full">
                <BinanceSymbolSelector 
                  selectedSymbol={selectedSymbol} 
                  onSelectSymbol={handleSymbolChange} 
                  language={language} 
                />
                <div className="h-[calc(100%-50px)]">
                  {chartComponent}
                </div>
              </div>
            )}

            {copyMobileTab === 'positions' && (
              <div className="h-full overflow-y-auto">
                <CopyPositionsTable 
                  refreshTrigger={isRefreshing} 
                  isMobile={true}
                  onPositionClick={(pos) => {
                    if (pos?.symbol) {
                      setSelectedSymbol(pos.symbol);
                      setCopyMobileTab('chart');
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Wallet Drawer/Sheet Stub (using simple absolute overlay for now to save complexity, or could use Sheet) */}
          {walletOpen && (
            <div className="absolute inset-0 z-50 bg-background flex flex-col animate-in slide-in-from-bottom-full duration-200">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="font-semibold">Copy Trading Wallet</h2>
                <Button variant="ghost" size="icon" onClick={() => setWalletOpen(false)}>
                  <XCircle className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <CopyTradingDashboard language={language} liveAccount={liveAccount} />
              </div>
            </div>
          )}
        </div>
      );
    }

    // DESKTOP COPY MODE
    return (
      <div className="flex h-screen flex-col bg-background overflow-hidden">
        {/* Header */}
        <div className="border-b border-border/50 px-4 py-2.5 shrink-0 glass-panel bg-blue-500/5">
          <div className="flex items-center justify-between">
            <button onClick={() => window.history.back()} className="text-foreground/60 hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>

            {/* Mode Switcher - Centered */}
            <div className="flex items-center gap-3 flex-1 justify-center">
              <div className="flex bg-muted/50 p-1 rounded-lg">
                <button
                  onClick={() => toggleMode('trade')}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${!isCopyMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Trade
                </button>
                <button
                  onClick={() => toggleMode('bots')}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${isCopyMode ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Copy Trading
                </button>
              </div>
              <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">PAPER MODE</span>
            </div>

            <div className="flex items-center gap-2">
              {isAuthenticated && <NotificationBell />}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Grid Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Signals Inbox */}
          <div className="w-[320px] xl:w-[360px] border-r border-border/50 flex flex-col bg-muted/5 shrink-0">
            <SignalsInbox 
              onSignalAccepted={handleRefresh} 
              liveAccount={liveAccount}
              onSymbolFocus={(symbol) => setSelectedSymbol(symbol)}
            />
          </div>

          {/* Center: Chart (Top) + Positions (Bottom) */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Symbol Selector Bar - Fixed row above chart */}
            <div className="border-b border-border/50 px-3 py-2 bg-card shrink-0">
              <BinanceSymbolSelector 
                selectedSymbol={selectedSymbol} 
                onSelectSymbol={handleSymbolChange} 
                language={language} 
              />
            </div>
            
            {/* Chart Area - No overlay conflicts */}
            <div className="flex-1 border-b border-border/50">
              {chartComponent}
            </div>
            <div className="h-[250px] shrink-0 bg-background">
              <CopyPositionsTable 
                refreshTrigger={isRefreshing}
                onPositionClick={(pos) => {
                  // When clicking position, switch chart to that symbol
                  if (pos?.symbol) {
                    setSelectedSymbol(pos.symbol);
                  }
                }}
              />
            </div>
          </div>

          {/* Right: Wallet Panel */}
          <div className="w-[280px] border-l border-border/50 bg-background flex flex-col shrink-0">
             <CopyWalletPanel language={language} liveAccount={liveAccount} />
          </div>
        </div>
      </div>
    );
  }

  // Standard Trading Layout
  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* Desktop Header - Glass Effect */}
      <div className="border-b border-border/50 px-4 py-2 shrink-0 glass-panel">
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

          {/* Mode Switcher */}
          <div className="flex bg-muted/50 p-1 rounded-lg mx-4">
            <button
              onClick={() => toggleMode('trade')}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${!isCopyMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Trade
            </button>
            <button
              onClick={() => toggleMode('bots')}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${isCopyMode ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Copy Trading
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            {isAuthenticated && <NotificationBell />}
            
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
        {/* Left Sidebar: Order Book + Trade Tape */}
        <div className="hidden xl:flex w-[200px] flex-col border-r border-border/50 overflow-hidden shrink-0">
          <div className="flex-1 overflow-hidden p-2">
            <OrderBookPanel symbol={selectedSymbol} language={language} />
          </div>
          <div className="h-[240px] overflow-hidden p-2 border-t border-border/50">
            <TradeTapePanel symbol={selectedSymbol} language={language} />
          </div>
        </div>

        {/* Center: Chart + Activity */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Symbol Selector + Stats - Glass Panel */}
          <div className="border-b border-border/50 px-4 py-2 glass-panel">
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

          {/* Balance Bar (Desktop) - Glass */}
          {isAuthenticated && hasLiveAccount && (
            <div className="px-4 py-2 border-b border-border/50 glass-panel">
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

          {/* Activity Tabs - Glass Panel */}
          <div className="border-t border-border/50 h-[240px] lg:h-[260px] overflow-hidden shrink-0 glass-panel">
            {activityComponent}
          </div>
        </div>

        {/* Right: Trade Panel - Glass */}
        <div className="w-[320px] lg:w-[360px] border-l border-border/50 flex flex-col overflow-hidden shrink-0 glass-panel">
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