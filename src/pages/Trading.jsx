import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { ChevronDown, TrendingUp, TrendingDown, ArrowLeftRight, Search } from "lucide-react";
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

// Fallback list
const FUTURES_SYMBOLS = [
  { symbol: "BTC-USDT", name: "Bitcoin" },
  { symbol: "ETH-USDT", name: "Ethereum" },
  { symbol: "SOL-USDT", name: "Solana" },
  { symbol: "BNB-USDT", name: "BNB" },
  { symbol: "XRP-USDT", name: "XRP" },
  { symbol: "DOGE-USDT", name: "Dogecoin" },
  { symbol: "ADA-USDT", name: "Cardano" },
  { symbol: "AVAX-USDT", name: "Avalanche" },
  { symbol: "LINK-USDT", name: "Chainlink" },
  { symbol: "DOT-USDT", name: "Polkadot" }
];

export default function Trading({ language = "en" }) {
  const [selectedSymbol, setSelectedSymbol] = useState(() => localStorage.getItem('trading_symbol') || "BTC-USDT");
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const [marketData, setMarketData] = useState({});
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [positions, setPositions] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [availableSymbols, setAvailableSymbols] = useState(FUTURES_SYMBOLS);
  const [refreshSignal, setRefreshSignal] = useState(0);

  useEffect(() => { localStorage.setItem('trading_symbol', selectedSymbol); }, [selectedSymbol]);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('tradingAccount', { action: 'getOrCreate', accountType: 'demo' });
      if (res.data?.success) setAccount(res.data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccount(); }, [loadAccount]);

  // Subscribe only to selected symbol
  useEffect(() => {
    if (!selectedSymbol) return;
    marketStore.subscribeToSymbol(selectedSymbol);
    return () => marketStore.unsubscribeFromSymbol(selectedSymbol);
  }, [selectedSymbol]);

  // Listen to ticker updates
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

  const handleTradeSuccess = useCallback(() => { loadAccount(); setRefreshSignal(v => v + 1); }, [loadAccount]);

  useEffect(() => {
    const fetchContracts = async () => {
      try {
        const res = await base44.functions.invoke('bingxMarketData', { action: 'getContracts' });
        const list = res.data?.data || [];
        if (list.length) {
          const symbols = list.filter(c => c.symbol?.endsWith('-USDT')).slice(0, 80).map(c => ({ symbol: c.symbol, name: c.symbol.replace('-USDT', '') }));
          setAvailableSymbols(symbols);
        }
      } catch (_) { /* keep fallback */ }
    };
    fetchContracts();
  }, []);

  const filteredSymbols = availableSymbols.filter(s => s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
  const balance = account?.is_demo ? (account?.demo_balance || 0) : (account?.balance || 0);

  const t = language === "ar" ? { balance: "الرصيد", equity: "الأسهم", margin: "الهامش", transfer: "تحويل", perpetual: "دائم" } : { balance: "Balance", equity: "Equity", margin: "Margin", transfer: "Transfer", perpetual: "Perpetual" };

  return (
    <div className="min-h-screen bg-[#0d0d1a]">
      <div className="flex flex-col min-h[calc(100vh-80px)]">
        {/* Top Bar */}
        <div className="bg-[#1a1a2e] border-b border-slate-700/50 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-10 px-3 text-white hover:bg-slate-700/30 gap-2">
                    <CryptoIcon currency={selectedSymbol.split('-')[0]} size="sm" />
                    <span className="font-bold">{selectedSymbol.replace('-', '/')}</span>
                    <Badge variant="outline" className="bg-blue-600/20 text-blue-400 border-blue-500/50 text-[10px]">{t.perpetual}</Badge>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-72 bg-[#1a1a2e] border-slate-700 p-0 max-h-[400px] overflow-hidden">
                  <div className="p-2 border-b border-slate-700">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input placeholder="Search symbols..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 bg-slate-800 border-slate-600 text-white text-sm" />
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h[300px]">
                    {filteredSymbols.map(({ symbol, name }) => {
                      const data = marketData[symbol] || { price: 0, change: 0 };
                      const isSelected = symbol === selectedSymbol;
                      return (
                        <DropdownMenuItem key={symbol} onClick={() => handleSymbolSelect(symbol)} className={`flex items-center justify-between p-3 cursor-pointer ${isSelected ? 'bg-blue-600/20' : 'hover:bg-slate-700/50'}`}>
                          <div className="flex items-center gap-2">
                            <CryptoIcon currency={symbol.split('-')[0]} size="sm" />
                            <div>
                              <p className="text-white text-sm font-medium">{symbol.replace('-', '/')}</p>
                              <p className="text-slate-400 text-xs">{name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-white text-sm font-mono">${data.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: data.price < 1 ? 6 : 2 })}</p>
                            <p className={`text-xs ${data.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{data.change >= 0 ? '+' : ''}{data.change?.toFixed(2)}%</p>
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center gap-3">
                <span className="text-white text-xl font-bold font-mono">${currentPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: currentPrice < 1 ? 6 : 2 })}</span>
                <div className={`flex items-center gap-1 ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {priceChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span className="font-medium">{priceChange >= 0 ? '+' : ''}{priceChange?.toFixed(2)}%</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-6 text-sm">
                <div><span className="text-slate-400 text-xs">{t.balance}</span><p className="text-white font-bold">${balance.toFixed(2)}</p></div>
                <div><span className="text-slate-400 text-xs">{t.equity}</span><p className="text-white font-bold">${(account?.equity || balance).toFixed(2)}</p></div>
                <div><span className="text-slate-400 text-xs">{t.margin}</span><p className="text-amber-400 font-bold">${(account?.margin_used || 0).toFixed(2)}</p></div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)} className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white">
                <ArrowLeftRight className="h-4 w-4 mr-1" />{t.transfer}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 grid grid-rows-[1fr_auto] lg:grid-rows-1 lg:grid-cols-[1fr_400px] overflow-hidden">
          <div className="min-h-[300px] lg:min-h-0 lg:h-full bg-[#131722] overflow-hidden">
            <ProfessionalChart symbol={selectedSymbol} onPriceUpdate={handlePriceUpdate} positions={positions} />
          </div>
          <div className="h[350px] lg:h-full bg-[#1E222D] border-t lg:border-t-0 lg:border-l border-[#2B2B43] overflow-y-auto">
            <OrderPanel symbol={selectedSymbol} currentPrice={currentPrice} balance={balance} tradingAccountId={account?.id} onOrderSuccess={handleTradeSuccess} language={language} />
          </div>
        </div>

        {/* Bottom */}
        <div className="flex-none h-[250px] bg-[#131722] border-t border-[#2B2B43] overflow-hidden">
          <TradingHistory tradingAccountId={account?.id} onRefresh={handleTradeSuccess} onPositionsUpdate={setPositions} onOpenOrdersUpdate={setOpenOrders} refreshSignal={refreshSignal} />
        </div>
      </div>

      <ClientExecutionEngine positions={positions} openOrders={openOrders} onTrigger={handleTradeSuccess} userId={account?.user_id} />

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="bg-[#1a1a2e] border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Internal Transfer</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-slate-400 mb-4">Transfer funds between your wallets</p>
            <Button onClick={() => { setTransferOpen(false); window.location.href = createPageUrl("Profile") + "?tab=assets"; }} className="bg-blue-600 hover:bg-blue-700">Go to Assets Page</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

Trading.propTypes = { language: PropTypes.string };