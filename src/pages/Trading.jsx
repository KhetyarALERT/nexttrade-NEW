import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { ChevronDown, TrendingUp, TrendingDown, ArrowLeftRight, Search, ArrowLeft, LayoutGrid, History, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import CryptoIcon from "@/components/ui/CryptoIcon";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ProfessionalChart from "@/components/trading/ProfessionalChart";
import OrderPanel from "@/components/trading/OrderPanel";
import TradingHistory from "@/components/trading/TradingHistory";
import ClientExecutionEngine from "@/components/trading/ClientExecutionEngine";
import { marketStore } from "@/components/trading/marketStore";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { toInternalFormat, toDisplayFormat } from "@/components/utils/symbolFormat";
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import CURRENCY_LIST from "@/components/trading/CurrencyList";

// Central list used as fallback
const FUTURES_SYMBOLS = CURRENCY_LIST.map(s => ({ symbol: s, name: s.replace('-USDT','') }));

export default function Trading({ language = "en" }) {
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    const stored = localStorage.getItem('trading_symbol');
    return toInternalFormat(stored || 'BTC-USDT');
  });
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const [marketData, setMarketData] = useState({});
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [positions, setPositions] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [availableSymbols, setAvailableSymbols] = useState(FUTURES_SYMBOLS);
  const [refreshSignal, setRefreshSignal] = useState(0);

  useEffect(() => { localStorage.setItem('trading_symbol', selectedSymbol); }, [selectedSymbol]);

  const loadAccount = useCallback(async () => {
    if (accountLoaded || loading) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('tradingAccount', { action: 'getOrCreate', accountType: 'demo' });
      if (res.data?.success) {
        setAccount(res.data.data);
        setAccountLoaded(true);
      }
    } finally {
      setLoading(false);
    }
  }, [accountLoaded, loading]);

  useEffect(() => { loadAccount(); }, [loadAccount]);

  useEffect(() => {
    if (!selectedSymbol) return;
    const sym = toInternalFormat(selectedSymbol);
    marketStore.subscribeToSymbol(sym);
    return () => marketStore.unsubscribeFromSymbol(sym);
  }, [selectedSymbol]);

  useEffect(() => {
    const handleTicker = ({ symbol, ticker }) => {
      setMarketData(prev => ({ ...prev, [symbol]: { price: ticker.price, change: ticker.change } }));
      if (symbol === selectedSymbol) { setCurrentPrice(ticker.price); setPriceChange(ticker.change); }
    };
    const unsub = marketStore.subscribe('ticker', handleTicker);
    const t = marketStore.getAllTickers?.()[selectedSymbol];
    if (t) { setCurrentPrice(t.price); setPriceChange(t.change); }
    return () => unsub();
  }, [selectedSymbol]);

  const handleSymbolSelect = (symbol) => {
    setSelectedSymbol(symbol);
    const data = marketData[symbol];
    if (data) { setCurrentPrice(data.price); setPriceChange(data.change); }
  };

  const handlePriceUpdate = useCallback((price) => setCurrentPrice(price), []);

  useEffect(() => {
    const unsubTicker = marketStore.subscribe(`ticker:${selectedSymbol}`, (t) => {
      if (t?.price) setCurrentPrice(t.price);
    });
    const unsubPrice = marketStore.subscribe(`price:${selectedSymbol}`, (p) => {
      if (p) setCurrentPrice(p);
    });
    return () => { unsubTicker(); unsubPrice(); };
  }, [selectedSymbol]);

  const handleTradeSuccess = useCallback(() => { loadAccount(); setRefreshSignal(v => v + 1); }, [loadAccount]);

  useEffect(() => {
    const fetchContracts = async () => {
      try {
        const res = await base44.functions.invoke('bingxMarketData', { action: 'getContracts' });
         const list = res.data?.data || [];
         if (list.length) {
           const seen = new Set();
           const symbols = list
             .filter(c => c.symbol?.endsWith('-USDT'))
             .map(c => ({ symbol: String(c.symbol).toUpperCase(), name: c.symbol.replace('-USDT', '') }))
             .filter(({ symbol }) => (seen.has(symbol) ? false : (seen.add(symbol), true)))
             .slice(0, 120);
           setAvailableSymbols(symbols);
         }
      } catch (_) { /* keep fallback */ }
    };
    fetchContracts();
  }, []);

  useEffect(() => {
    const existing = marketStore.getAllTickers?.() || {};
    if (existing && Object.keys(existing).length) {
      setMarketData(prev => ({ ...prev, ...existing }));
    }
    availableSymbols.slice(0, 40).forEach(({ symbol }) => marketStore.subscribeToTicker(symbol));
  }, [availableSymbols]);

  const filteredSymbols = availableSymbols.filter(
    s => s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || (s.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  const balance = account?.is_demo ? (account?.demo_balance || 0) : (account?.balance || 0);

  const t = language === "ar" ? { balance: "الرصيد", equity: "الأسهم", margin: "الهامش", transfer: "تحويل", perpetual: "دائم" } : { balance: "Balance", equity: "Equity", margin: "Margin", transfer: "Transfer", perpetual: "Perpetual" };

  return (
    <div className="h-screen flex flex-col bg-[#0d0d1a] text-slate-200 overflow-hidden">
      {/* Top Bar - Enhanced Design */}
      <header className="h-14 bg-[#1a1a2e] border-b border-slate-700/50 px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <button onClick={() => window.history.back()} className="p-2 hover:bg-slate-700/30 rounded-full transition-colors">
              <ArrowLeft className="h-5 w-5 text-slate-400" />
            </button>
            <div className="h-6 w-[1px] bg-slate-700/50 mx-1" />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-10 px-3 text-white hover:bg-slate-700/30 gap-3 rounded-lg border border-transparent hover:border-slate-700/50 transition-all">
                <CryptoIcon currency={(selectedSymbol || '').replace('/', '-').split('-')[0]} size="sm" />
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base">{toDisplayFormat(selectedSymbol)}</span>
                    <Badge variant="outline" className="bg-blue-600/10 text-blue-400 border-blue-500/30 text-[10px] px-1.5 py-0 h-4 uppercase tracking-wider">{t.perpetual}</Badge>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 bg-[#1a1a2e] border-slate-700 p-0 shadow-2xl rounded-xl overflow-hidden">
              <div className="p-3 sticky top-0 bg-[#1a1a2e] border-b border-slate-700/50 z-10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input 
                    placeholder="Search symbols..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    className="pl-9 h-9 bg-slate-800/50 border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500/50" 
                  />
                </div>
              </div>
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {filteredSymbols.map(({ symbol, name }) => {
                  const tmap = marketStore.getAllTickers?.() || {};
                  const ticker = tmap[symbol] || marketData[symbol] || {};
                  const priceVal = (marketStore.getPrice?.(symbol)) || ticker.price || 0;
                  const changeVal = (ticker.change ?? 0);
                  const isSelected = symbol === selectedSymbol;
                  return (
                    <DropdownMenuItem key={symbol} onClick={() => handleSymbolSelect(symbol)} className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${isSelected ? 'bg-blue-600/10 border-l-2 border-blue-500' : 'hover:bg-slate-700/30 border-l-2 border-transparent'}`}>
                      <div className="flex items-center gap-3">
                        <CryptoIcon currency={symbol.split('-')[0]} size="sm" />
                        <div>
                          <p className="text-white text-sm font-semibold">{toDisplayFormat(symbol)}</p>
                          <p className="text-[10px] text-slate-500 uppercase">{name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white text-sm font-mono font-medium">${priceVal?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: priceVal < 1 ? 6 : 2 })}</p>
                        <p className={`text-[11px] font-medium ${changeVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{changeVal >= 0 ? '+' : ''}{Number(changeVal || 0).toFixed(2)}%</p>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-white text-lg font-bold font-mono leading-none">${currentPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: currentPrice < 1 ? 6 : 2 })}</span>
              <div className={`flex items-center gap-1 ${priceChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                <span className="text-[11px] font-semibold">{priceChange >= 0 ? '+' : ''}{priceChange?.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">{t.balance}</span>
              <p className="text-white font-bold text-sm">${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">{t.equity}</span>
              <p className="text-white font-bold text-sm">${(account?.equity || balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">{t.margin}</span>
              <p className="text-amber-400 font-bold text-sm">${(account?.margin_used || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)} className="h-9 border-slate-700 bg-slate-800/30 text-slate-300 hover:bg-blue-600 hover:text-white hover:border-blue-500 transition-all rounded-lg px-4">
            <ArrowLeftRight className="h-4 w-4 mr-2" />{t.transfer}
          </Button>
        </div>
      </header>

      {/* Main Content - Fixed Layout */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Center Area: Chart + History */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <PanelGroup direction="vertical" className="h-full">
            {/* Chart Panel */}
            <Panel defaultSize={70} minSize={30} className="relative flex flex-col overflow-hidden">
              <div className="flex-1 bg-[#131722] relative overflow-hidden">
                <ProfessionalChart symbol={selectedSymbol} onPriceUpdate={handlePriceUpdate} positions={positions} />
              </div>
            </Panel>
            
            {/* Resize Handle - Enhanced Visibility */}
            <PanelResizeHandle className="h-1.5 bg-[#1a1a2e] hover:bg-blue-500/50 transition-colors cursor-row-resize flex items-center justify-center group z-10">
              <div className="w-12 h-[2px] bg-slate-700 group-hover:bg-blue-400 rounded-full transition-colors" />
            </PanelResizeHandle>
            
            {/* History Panel */}
            <Panel defaultSize={30} minSize={15} className="bg-[#131722] border-t border-slate-800/50 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-hidden">
                <TradingHistory 
                  tradingAccountId={account?.id} 
                  onRefresh={handleTradeSuccess} 
                  onPositionsUpdate={setPositions} 
                  onOpenOrdersUpdate={setOpenOrders} 
                  refreshSignal={refreshSignal} 
                />
              </div>
            </Panel>
          </PanelGroup>
        </div>

        {/* Right Sidebar: Order Panel - Professional Styling */}
        <aside className="w-[320px] shrink-0 bg-[#1a1a2e] border-l border-slate-700/50 flex flex-col z-10">
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <OrderPanel 
              symbol={selectedSymbol} 
              currentPrice={currentPrice} 
              balance={balance} 
              tradingAccountId={account?.id} 
              onOrderSuccess={handleTradeSuccess} 
              language={language} 
            />
          </div>
        </aside>
      </main>

      <ClientExecutionEngine positions={positions} openOrders={openOrders} onTrigger={handleTradeSuccess} userId={account?.user_id} />

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="bg-[#1a1a2e] border-slate-700 text-white rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Internal Transfer</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center mb-2">
              <ArrowLeftRight className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-slate-400 max-w-[280px]">Transfer funds instantly between your trading wallets and main account.</p>
            <Button 
              onClick={() => { setTransferOpen(false); window.location.href = createPageUrl("Profile") + "?tab=assets"; }} 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl shadow-lg shadow-blue-600/20 transition-all"
            >
              Go to Assets Page
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2B2B43;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3b82f6;
        }
        /* Ensure the app takes full height and doesn't scroll the body */
        html, body, #root {
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}

Trading.propTypes = { language: PropTypes.string };
