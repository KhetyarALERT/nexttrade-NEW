import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { ArrowLeft, Lock, RefreshCw, Wifi, WifiOff, Wallet as WalletIcon } from "lucide-react";
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
import PositionDetailDrawer from "@/components/copytrading/PositionDetailDrawer";
import CopyRightPanel from "@/components/copytrading/CopyRightPanel";
import ResizableSplitter from "@/components/copytrading/ResizableSplitter";
// NotificationBell is rendered in Layout - no duplicate needed here

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
    // Use replace to avoid stacking history entries when switching modes
    setSearchParams(newParams, { replace: true });
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
  
  // Apply deep-link instId on mount if present (no navigation side effects)
  useEffect(() => {
    if (urlInstId) {
      const normalized = normalizeOkxSymbol(urlInstId);
      if (normalized && normalized !== selectedSymbol) {
        setSelectedSymbol(normalized);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlInstId]); // Only run when urlInstId changes, not selectedSymbol

  // Market data state
  const [lastPrice, setLastPrice] = useState(0);
  const [changePct, setChangePct] = useState(0);
  const [quoteVolume, setQuoteVolume] = useState(0);
  const [highPrice, setHighPrice] = useState(0);
  const [lowPrice, setLowPrice] = useState(0);
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
  const [selectedCopyPosition, setSelectedCopyPosition] = useState(null);
  const [copyDetailOpen, setCopyDetailOpen] = useState(false);

  // Handler: clicking a copy position opens detail drawer AND switches chart
  const handleCopyPositionClick = useCallback((pos) => {
    setSelectedCopyPosition(pos);
    setCopyDetailOpen(true);
    if (pos?.symbol) {
      setSelectedSymbol(pos.symbol);
      // Update URL with positionId for deep-link
      const newParams = new URLSearchParams(searchParams);
      newParams.set("positionId", pos.id);
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // When drawer closes, remove positionId from URL
  const handleCopyDetailClose = useCallback((open) => {
    setCopyDetailOpen(open);
    if (!open) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("positionId");
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Deep-link: auto-open position detail if positionId in URL
  useEffect(() => {
    if (urlPositionId && isCopyMode && paperPositions.length > 0 && !copyDetailOpen) {
      const pos = paperPositions.find(p => p.id === urlPositionId);
      if (pos) {
        setSelectedCopyPosition(pos);
        setCopyDetailOpen(true);
        if (pos.symbol) setSelectedSymbol(pos.symbol);
      }
    }
  }, [urlPositionId, isCopyMode, paperPositions.length]);

  const copyPositionsPollRef = useRef({
    timeoutId: null,
    inFlight: false,
    errorCount: 0,
  });

  const refreshCopyPositions = useCallback(async () => {
    if (copyPositionsPollRef.current.inFlight) return;
    copyPositionsPollRef.current.inFlight = true;
    try {
      const { gated } = await import("@/components/utils/apiGate");
      const res = await gated("copyTradingUser:getPositions", () => base44.functions.invoke('copyTradingUser', { action: 'getPositions', status: 'OPEN' }), { minIntervalMs: 10000 });
      if (res?.data?.ok) {
        setPaperPositions(res.data.data || []);
        copyPositionsPollRef.current.errorCount = 0;
      } else if (res === null) {
        // Throttled/backoff - keep existing data
      } else {
        copyPositionsPollRef.current.errorCount += 1;
      }
    } catch (e) {
      copyPositionsPollRef.current.errorCount += 1;
      console.error(e);
    } finally {
      copyPositionsPollRef.current.inFlight = false;
    }
  }, []);

  useEffect(() => {
    if (!isCopyMode || !isAuthenticated) return;
    let mounted = true;

    const scheduleNext = (delayMs) => {
      if (!mounted) return;
      if (copyPositionsPollRef.current.timeoutId) {
        clearTimeout(copyPositionsPollRef.current.timeoutId);
      }
      copyPositionsPollRef.current.timeoutId = setTimeout(runPoll, delayMs);
    };

    const runPoll = async (force = false) => {
      if (!mounted) return;
      if (document.hidden && !force) {
        scheduleNext(45000);
        return;
      }
      await refreshCopyPositions();
      const backoff = Math.min(3, copyPositionsPollRef.current.errorCount);
      const nextDelay = 45000 * (backoff ? 1 + backoff * 0.5 : 1);
      scheduleNext(nextDelay);
    };

    const handleVisibility = () => {
      if (!document.hidden) runPoll(true);
    };

    runPoll(true);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (copyPositionsPollRef.current.timeoutId) {
        clearTimeout(copyPositionsPollRef.current.timeoutId);
      }
    };
  }, [isCopyMode, isAuthenticated, refreshCopyPositions]);

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

  useEffect(() => {
    const updateTickerStats = (ticker) => {
      if (!ticker) return;
      if (ticker?.priceChangePercent) setChangePct(Number(ticker.priceChangePercent) || 0);
      if (ticker?.quoteVolume) setQuoteVolume(Number(ticker.quoteVolume) || 0);
      if (ticker?.highPrice) setHighPrice(Number(ticker.highPrice) || 0);
      if (ticker?.lowPrice) setLowPrice(Number(ticker.lowPrice) || 0);
    };

    const unsubTicker = binanceFuturesStore.subscribe(`ticker:${selectedSymbol}`, (ticker) => {
      updateTickerStats(ticker);
    });

    const existing = binanceFuturesStore.getTicker?.(selectedSymbol);
    updateTickerStats(existing);

    return () => {
      try { unsubTicker?.(); } catch {}
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
      { label: isAr ? "الأعلى" : "High", value: highPrice ? formatPrice(highPrice) : "—" },
      { label: isAr ? "الأدنى" : "Low", value: lowPrice ? formatPrice(lowPrice) : "—" },
      { label: isAr ? "الحجم" : "Volume", value: formatCompactNumber(quoteVolume) },
    ],
    [lastPrice, changePct, quoteVolume, highPrice, lowPrice, isAr]
  );

  const mobileStats = useMemo(
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
  }, [selectedSymbol]);

  // Chart component (shared between mobile and desktop)
  // In Copy Mode, show paper position on chart. In Live Mode, show real position.
  // When deep-linked to a specific positionId, use that; otherwise match symbol+side
  const activePosition = useMemo(() => {
    if (isCopyMode) {
      // Priority: selectedCopyPosition (from click) > urlPositionId > symbol match
      let pos = null;
      if (selectedCopyPosition?.symbol === selectedSymbol) pos = selectedCopyPosition;
      if (!pos && urlPositionId) pos = paperPositions.find(p => p.id === urlPositionId);
      if (!pos) pos = paperPositions.find(p => p.symbol === selectedSymbol);
      // Normalize copy position fields so chart overlay finds TP/SL
      if (pos) {
        return {
          ...pos,
          take_profit: pos.take_profit ?? pos.tp1 ?? null,
          tp: pos.tp1 ?? null,
          stop_loss: pos.stop_loss ?? null,
          sl: pos.stop_loss ?? null,
          entry_price: pos.entry_price,
          avg_entry_price: pos.entry_price,
        };
      }
      return null;
    }
    if (urlPositionId) {
      const exact = livePositions.find(p => p.id === urlPositionId);
      if (exact) return exact;
    }
    return livePositions.find(p => p.instId === selectedSymbol);
  }, [isCopyMode, selectedSymbol, paperPositions, livePositions, urlPositionId, selectedCopyPosition]);

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
  
  // Copy Mode Mobile State
  const [copyMobileTab, setCopyMobileTab] = useState('signals'); // signals | chart | positions
  const [walletOpen, setWalletOpen] = useState(false);

  // RENDER LOGIC: Strict Separation of Modes
  
  // 1. COPY TRADING MODE
  if (isCopyMode) {
    // 1A. MOBILE COPY TRADING
    if (isMobile) {
      return (
        <div className="flex h-[100dvh] flex-col bg-background overflow-hidden copy-trading-page">
          <style>{`
            .copy-trading-page ::-webkit-scrollbar { width: 4px; height: 4px; }
            .copy-trading-page ::-webkit-scrollbar-track { background: transparent; }
            .copy-trading-page ::-webkit-scrollbar-thumb { background: hsl(var(--muted-foreground) / 0.15); border-radius: 4px; }
            .copy-trading-page ::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.3); }
            .copy-trading-page { scrollbar-width: thin; scrollbar-color: hsl(var(--muted-foreground) / 0.15) transparent; }
          `}</style>
          {/* Mobile Header */}
          <div className="border-b border-border/30 px-3 pb-2.5 pt-[calc(0.5rem+env(safe-area-inset-top))] shrink-0 bg-background/95 backdrop-blur-md z-50 sticky top-0">
           <div className="flex items-center justify-between mb-2.5">
             <Link 
               to={createPageUrl("Dashboard")} 
               className="text-foreground/40 p-1.5 -ml-1 active:bg-accent rounded-xl touch-manipulation"
               style={{ touchAction: 'manipulation' }}
             >
               <ArrowLeft className="h-5 w-5" />
             </Link>

             {/* Mode Toggle */}
             <div className="flex bg-muted/30 p-[3px] rounded-xl">
               <button
                 onClick={() => toggleMode('trade')}
                 className={`h-8 min-w-[68px] px-4 rounded-[10px] text-[11px] font-semibold transition-all touch-manipulation flex items-center justify-center ${!isCopyMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground/60'}`}
                 style={{ touchAction: 'manipulation' }}
               >
                 {isAr ? "تداول" : "Trade"}
               </button>
               <button
                 onClick={() => toggleMode('bots')}
                 className={`h-8 min-w-[68px] px-4 rounded-[10px] text-[11px] font-semibold transition-all touch-manipulation flex items-center justify-center ${isCopyMode ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20' : 'text-muted-foreground/60'}`}
                 style={{ touchAction: 'manipulation' }}
               >
                 {isAr ? "نسخ" : "Copy"}
               </button>
             </div>

             <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-xl" onClick={() => setWalletOpen(true)}>
               <WalletIcon className="h-4 w-4" />
             </Button>
           </div>

           {/* Segmented Control */}
           <div className="grid grid-cols-3 gap-1 bg-muted/20 p-[3px] rounded-xl">
             {[
               { id: 'signals', label: isAr ? 'الإشارات' : 'Signals' },
               { id: 'chart', label: isAr ? 'الرسم البياني' : 'Chart' },
               { id: 'positions', label: isAr ? 'الصفقات' : 'Positions' }
             ].map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setCopyMobileTab(tab.id)}
                 className={`py-1.5 text-[11px] font-semibold rounded-[10px] transition-all ${
                   copyMobileTab === tab.id 
                     ? 'bg-background text-foreground shadow-sm' 
                     : 'text-muted-foreground/50'
                 }`}
               >
                 {tab.label}
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
                    refreshCopyPositions();
                    setCopyMobileTab('positions'); 
                  }} 
                  liveAccount={liveAccount}
                  preSelectedSignalId={urlSignalId}
                  onSymbolFocus={(symbol) => {
                    setSelectedSymbol(symbol);
                    // Do not switch tab on mobile when focusing for accept dialog
                  }}
                  language={language}
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
              <div className="h-full overflow-y-auto pb-4">
                <CopyPositionsTable 
                  refreshTrigger={isRefreshing} 
                  isMobile={true}
                  language={language}
                  onPositionClick={handleCopyPositionClick}
                />
              </div>
            )}
          </div>

          {/* Position Detail Sheet (mobile: bottom sheet) */}
          <PositionDetailDrawer
            open={copyDetailOpen}
            onOpenChange={handleCopyDetailClose}
            position={selectedCopyPosition}
            currentPrice={selectedCopyPosition?.symbol === selectedSymbol ? lastPrice : 0}
            language={language}
            isMobile={true}
          />

          {/* Wallet Drawer/Sheet */}
          {walletOpen && (
            <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in slide-in-from-bottom-full duration-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
                <h2 className="font-semibold text-sm">{isAr ? "محفظة نسخ التداول" : "Copy Trading Wallet"}</h2>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWalletOpen(false)}>
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
      <div className="flex h-screen flex-col bg-background overflow-hidden copy-trading-page">
        <style>{`
          .copy-trading-page ::-webkit-scrollbar { width: 4px; height: 4px; }
          .copy-trading-page ::-webkit-scrollbar-track { background: transparent; }
          .copy-trading-page ::-webkit-scrollbar-thumb { background: hsl(var(--muted-foreground) / 0.15); border-radius: 4px; }
          .copy-trading-page ::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.3); }
          .copy-trading-page { scrollbar-width: thin; scrollbar-color: hsl(var(--muted-foreground) / 0.15) transparent; }
        `}</style>
        {/* Header */}
        <div className="border-b border-border/10 px-4 py-2 shrink-0 bg-background/95 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl("Dashboard")} className="text-foreground/40 hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>

            {/* Mode Switcher - Centered */}
            <div className="flex items-center gap-3 flex-1 justify-center">
              <div className="flex bg-muted/20 p-[2px] rounded-xl">
                <button
                  onClick={() => toggleMode('trade')}
                  className={`px-5 py-1.5 rounded-[10px] text-[11px] font-semibold transition-all ${!isCopyMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground/40 hover:text-foreground'}`}
                >
                  {isAr ? "تداول" : "Trade"}
                </button>
                <button
                  onClick={() => toggleMode('bots')}
                  className={`px-5 py-1.5 rounded-[10px] text-[11px] font-semibold transition-all ${isCopyMode ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20' : 'text-muted-foreground/40 hover:text-foreground'}`}
                >
                  {isAr ? "نسخ التداول" : "Copy Trading"}
                </button>
              </div>
            </div>

            <div className="w-5" />
          </div>
        </div>

        {/* Desktop 3-Column Grid: Left(wallet) | Center(chart+positions) | Right(settings+signals) */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT SIDEBAR: Wallet Summary + Activity Preview */}
          <div className="w-[280px] xl:w-[300px] border-r border-border/10 flex flex-col shrink-0 overflow-hidden bg-background">
            <CopyWalletPanel language={language} liveAccount={liveAccount} />
          </div>

          {/* CENTER: Chart (dominant) + Positions table */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Symbol Selector Bar */}
            <div className="border-b border-border/10 px-3 py-1.5 bg-background shrink-0">
              <BinanceSymbolSelector 
                selectedSymbol={selectedSymbol} 
                onSelectSymbol={handleSymbolChange} 
                language={language} 
              />
            </div>
            
            {/* Chart Area */}
            <div className="flex-1 min-h-0">
              {chartComponent}
            </div>

            {/* Positions Table */}
            <div className="h-[220px] xl:h-[250px] shrink-0 border-t border-border/10 overflow-hidden">
              <CopyPositionsTable 
                refreshTrigger={isRefreshing}
                language={language}
                onPositionClick={handleCopyPositionClick}
                selectedPositionId={selectedCopyPosition?.id}
              />
            </div>
          </div>

          {/* RIGHT SIDEBAR: Settings + Signals */}
          <div className="w-[320px] xl:w-[350px] border-l border-border/10 flex flex-col shrink-0 overflow-hidden bg-background">
            <SignalsInbox 
              onSignalAccepted={() => {
                handleRefresh();
                refreshCopyPositions();
              }} 
              liveAccount={liveAccount}
              preSelectedSignalId={urlSignalId}
              onSymbolFocus={(symbol) => setSelectedSymbol(symbol)}
              language={language}
            />
          </div>
        </div>

        {/* Position Detail Drawer (desktop: right side) */}
        <PositionDetailDrawer
          open={copyDetailOpen}
          onOpenChange={handleCopyDetailClose}
          position={selectedCopyPosition}
          currentPrice={selectedCopyPosition?.symbol === selectedSymbol ? lastPrice : 0}
          language={language}
          isMobile={false}
        />
      </div>
    );
  }

  // Standard Trading Layout
  
  // 2. TRADE MODE MOBILE
  if (isMobile) {
    return (
      <div className="flex h-screen flex-col bg-background">
        {/* Mobile Header */}
        <div className="border-b border-border/30 px-3 py-2.5 shrink-0 bg-background/95 backdrop-blur-md">
          <div className="flex items-center justify-between mb-2">
            <Link to={createPageUrl("Dashboard")} className="text-foreground/40 hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            
            {/* Mode Toggle - Mobile */}
            <div className="flex bg-muted/25 p-[3px] rounded-xl">
              <button
                onClick={() => toggleMode('trade')}
                className={`h-8 px-4 rounded-[10px] text-[11px] font-semibold transition-all touch-manipulation ${!isCopyMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground/50'}`}
                style={{ touchAction: 'manipulation' }}
              >
                {isAr ? "تداول" : "Trade"}
              </button>
              <button
                onClick={() => toggleMode('bots')}
                className={`h-8 px-4 rounded-[10px] text-[11px] font-semibold transition-all touch-manipulation ${isCopyMode ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20' : 'text-muted-foreground/50'}`}
                style={{ touchAction: 'manipulation' }}
              >
                {isAr ? "نسخ" : "Copy"}
              </button>
            </div>
            
            <div className="flex items-center gap-1">
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
          
          {/* Symbol + Price stats row */}
          <div className="flex items-center justify-between">
            <BinanceSymbolSelector 
              selectedSymbol={selectedSymbol} 
              onSelectSymbol={handleSymbolChange} 
              language={language}
              height="compact"
            />
            <div className="flex items-center gap-3">
              {mobileStats.map((stat) => (
                <div key={stat.label} className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground">{stat.label}:</span>
                  <span className={`text-[10px] font-semibold ${
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

  // 3. TRADE MODE DESKTOP
  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* Desktop Header */}
      <div className="border-b border-border/20 px-4 py-2.5 shrink-0 bg-background/95 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={createPageUrl("Dashboard")} className="text-foreground/40 hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-[15px] font-semibold text-foreground tracking-tight">
              {isAr ? "التداول" : "Trading"}
            </h1>
            
            {/* Connection status */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-semibold ${
              wsConnected ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
            }`}>
              {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span>{wsConnected ? "Live" : "Connecting"}</span>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-muted/25 p-[3px] rounded-xl mx-4">
            <button
              onClick={() => toggleMode('trade')}
              className={`px-4 py-1.5 rounded-[10px] text-[11px] font-semibold transition-all ${!isCopyMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground/50 hover:text-foreground'}`}
            >
              {isAr ? "تداول" : "Trade"}
            </button>
            <button
              onClick={() => toggleMode('bots')}
              className={`px-4 py-1.5 rounded-[10px] text-[11px] font-semibold transition-all ${isCopyMode ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20' : 'text-muted-foreground/50 hover:text-foreground'}`}
            >
              {isAr ? "نسخ التداول" : "Copy Trading"}
            </button>
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
        {/* Symbol Selector + Stats */}
        <div className="border-b border-border/20 px-4 py-2.5 bg-background/95 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <BinanceSymbolSelector 
              selectedSymbol={selectedSymbol} 
              onSelectSymbol={handleSymbolChange} 
              language={language} 
            />

            <div className="flex items-center gap-5 lg:gap-7">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider font-semibold">{stat.label}</div>
                  <div className={`text-xs lg:text-[13px] font-bold font-mono tabular-nums tracking-tight ${
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

        {/* Balance Bar (Desktop) */}
        {isAuthenticated && hasLiveAccount && (
          <div className="px-4 py-2 border-b border-border/50">
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

        {/* Chart */}
        <div className="flex-1 overflow-hidden px-3 py-2 min-h-0">
          <div className="h-full min-h-[250px]">
            {chartComponent}
          </div>
        </div>

        {/* Activity Tabs */}
        <div className="border-t border-border/50 h-[240px] lg:h-[260px] overflow-hidden shrink-0">
          {activityComponent}
        </div>
        </div>

        {/* Right: Trade Panel */}
        <div className="w-[320px] lg:w-[360px] border-l border-border/50 flex flex-col overflow-hidden shrink-0">
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