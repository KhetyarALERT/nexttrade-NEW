import { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { ChevronDown, TrendingUp, TrendingDown, ArrowLeftRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";

// BingX USDT-M Perpetual Futures symbols
const FUTURES_SYMBOLS = [
  { symbol: "BTC-USDT", name: "Bitcoin", icon: "₿" },
  { symbol: "ETH-USDT", name: "Ethereum", icon: "Ξ" },
  { symbol: "SOL-USDT", name: "Solana", icon: "◎" },
  { symbol: "BNB-USDT", name: "BNB", icon: "B" },
  { symbol: "XRP-USDT", name: "XRP", icon: "X" },
  { symbol: "DOGE-USDT", name: "Dogecoin", icon: "D" },
  { symbol: "ADA-USDT", name: "Cardano", icon: "A" },
  { symbol: "AVAX-USDT", name: "Avalanche", icon: "A" },
  { symbol: "LINK-USDT", name: "Chainlink", icon: "L" },
  { symbol: "DOT-USDT", name: "Polkadot", icon: "●" },
  { symbol: "MATIC-USDT", name: "Polygon", icon: "M" },
  { symbol: "LTC-USDT", name: "Litecoin", icon: "Ł" },
  { symbol: "SHIB-USDT", name: "Shiba Inu", icon: "S" },
  { symbol: "TRX-USDT", name: "TRON", icon: "T" },
  { symbol: "ATOM-USDT", name: "Cosmos", icon: "⚛" },
  { symbol: "UNI-USDT", name: "Uniswap", icon: "U" },
  { symbol: "APT-USDT", name: "Aptos", icon: "A" },
  { symbol: "ARB-USDT", name: "Arbitrum", icon: "A" },
  { symbol: "OP-USDT", name: "Optimism", icon: "O" },
  { symbol: "NEAR-USDT", name: "NEAR", icon: "N" },
];

export default function Trading({ language = "en" }) {
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    return localStorage.getItem('trading_symbol') || "BTC-USDT";
  });
  const [selectedInterval, setSelectedInterval] = useState(() => {
    return localStorage.getItem('trading_interval') || "15m";
  });
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const [marketData, setMarketData] = useState({});
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const wsRef = useRef(null);

  // Save preferences
  useEffect(() => {
    localStorage.setItem('trading_symbol', selectedSymbol);
  }, [selectedSymbol]);

  useEffect(() => {
    localStorage.setItem('trading_interval', selectedInterval);
  }, [selectedInterval]);

  // Load trading account
  const loadAccount = useCallback(async () => {
    try {
      const result = await base44.functions.invoke('tradingAccount', { 
        action: 'getOrCreate', 
        accountType: 'demo' 
      });
      if (result.data?.success) {
        setAccount(result.data.data);
      }
    } catch (err) {
      console.error("Failed to load account:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  // WebSocket for real-time prices
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket('wss://open-api-ws.bingx.com/market');
        wsRef.current = ws;

        ws.onopen = () => {
          // Subscribe to ticker for all symbols
          FUTURES_SYMBOLS.forEach(({ symbol }) => {
            const subMsg = {
              id: `ticker_${symbol}`,
              reqType: "sub",
              dataType: `${symbol}@ticker`
            };
            ws.send(JSON.stringify(subMsg));
          });
        };

        ws.onmessage = (event) => {
          try {
            if (event.data instanceof Blob) return;
            const data = JSON.parse(event.data);
            
            if (data.dataType?.includes('@ticker') && data.data) {
              const symbol = data.dataType.split('@')[0];
              const tickerData = data.data;
              
              const price = parseFloat(tickerData.c || tickerData.lastPrice || 0);
              const change = parseFloat(tickerData.p || tickerData.priceChangePercent || 0);
              
              setMarketData(prev => ({
                ...prev,
                [symbol]: { price, change }
              }));

              if (symbol === selectedSymbol) {
                setCurrentPrice(price);
                setPriceChange(change);
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        };

        ws.onerror = () => {
          // Set fallback prices
          const fallback = {
            'BTC-USDT': { price: 96850, change: 2.34 },
            'ETH-USDT': { price: 3420, change: 1.89 },
            'SOL-USDT': { price: 198, change: 4.21 },
            'BNB-USDT': { price: 705, change: 0.87 },
            'XRP-USDT': { price: 2.18, change: -1.23 },
            'DOGE-USDT': { price: 0.32, change: 3.45 },
            'ADA-USDT': { price: 0.89, change: 2.11 },
            'AVAX-USDT': { price: 38.50, change: 1.56 }
          };
          setMarketData(fallback);
          if (fallback[selectedSymbol]) {
            setCurrentPrice(fallback[selectedSymbol].price);
            setPriceChange(fallback[selectedSymbol].change);
          }
        };

        ws.onclose = () => {
          setTimeout(connectWebSocket, 3000);
        };
      } catch (e) {
        console.error("WebSocket error:", e);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [selectedSymbol]);

  const handleSymbolSelect = (symbol) => {
    setSelectedSymbol(symbol);
    const data = marketData[symbol];
    if (data) {
      setCurrentPrice(data.price);
      setPriceChange(data.change);
    }
  };

  const handlePriceUpdate = useCallback((price) => {
    setCurrentPrice(price);
  }, []);

  const handleTradeSuccess = useCallback(() => {
    loadAccount();
  }, [loadAccount]);

  const filteredSymbols = FUTURES_SYMBOLS.filter(s => 
    s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedSymbolData = FUTURES_SYMBOLS.find(s => s.symbol === selectedSymbol);
  const balance = account?.is_demo ? (account?.demo_balance || 0) : (account?.balance || 0);

  const t = language === "ar" ? {
    balance: "الرصيد",
    equity: "الأسهم",
    margin: "الهامش",
    transfer: "تحويل",
    perpetual: "دائم"
  } : {
    balance: "Balance",
    equity: "Equity", 
    margin: "Margin",
    transfer: "Transfer",
    perpetual: "Perpetual"
  };

  return (
    <div className="min-h-screen bg-[#0d0d1a]">
      <div className="flex flex-col h-[calc(100vh-80px)]">
        {/* Top Bar with Symbol Selector */}
        <div className="bg-[#1a1a2e] border-b border-slate-700/50 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Symbol Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-10 px-3 text-white hover:bg-slate-700/30 gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold text-xs">
                      {selectedSymbolData?.icon || selectedSymbol.charAt(0)}
                    </div>
                    <span className="font-bold">{selectedSymbol.replace('-', '/')}</span>
                    <Badge variant="outline" className="bg-blue-600/20 text-blue-400 border-blue-500/50 text-[10px]">
                      {t.perpetual}
                    </Badge>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-72 bg-[#1a1a2e] border-slate-700 p-0 max-h-[400px] overflow-hidden">
                  <div className="p-2 border-b border-slate-700">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search symbols..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-8 bg-slate-800 border-slate-600 text-white text-sm"
                      />
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-[300px]">
                    {filteredSymbols.map(({ symbol, name, icon }) => {
                      const data = marketData[symbol] || { price: 0, change: 0 };
                      const isSelected = symbol === selectedSymbol;
                      
                      return (
                        <DropdownMenuItem
                          key={symbol}
                          onClick={() => handleSymbolSelect(symbol)}
                          className={`flex items-center justify-between p-3 cursor-pointer ${
                            isSelected ? 'bg-blue-600/20' : 'hover:bg-slate-700/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold">
                              {icon}
                            </div>
                            <div>
                              <p className="text-white text-sm font-medium">{symbol.replace('-', '/')}</p>
                              <p className="text-slate-400 text-xs">{name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-white text-sm font-mono">
                              ${data.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: data.price < 1 ? 6 : 2 })}
                            </p>
                            <p className={`text-xs ${data.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {data.change >= 0 ? '+' : ''}{data.change?.toFixed(2)}%
                            </p>
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Current Price */}
              <div className="flex items-center gap-3">
                <span className="text-white text-xl font-bold font-mono">
                  ${currentPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: currentPrice < 1 ? 6 : 2 })}
                </span>
                <div className={`flex items-center gap-1 ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {priceChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span className="font-medium">{priceChange >= 0 ? '+' : ''}{priceChange?.toFixed(2)}%</span>
                </div>
              </div>
            </div>

            {/* Account Summary */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-slate-400 text-xs">{t.balance}</span>
                  <p className="text-white font-bold">${balance.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-xs">{t.equity}</span>
                  <p className="text-white font-bold">${(account?.equity || balance).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-xs">{t.margin}</span>
                  <p className="text-amber-400 font-bold">${(account?.margin_used || 0).toFixed(2)}</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setTransferOpen(true)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                <ArrowLeftRight className="h-4 w-4 mr-1" />
                {t.transfer}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chart Section */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 bg-[#131722]">
              <ProfessionalChart
                symbol={selectedSymbol}
                interval={selectedInterval}
                onIntervalChange={setSelectedInterval}
                onPriceUpdate={handlePriceUpdate}
              />
            </div>
          </div>

          {/* Order Panel */}
          <div className="w-80 flex-shrink-0 bg-[#1a1a2e] border-l border-slate-700/50 overflow-y-auto">
            <OrderPanel
              symbol={selectedSymbol}
              currentPrice={currentPrice}
              balance={balance}
              tradingAccountId={account?.id}
              onOrderSuccess={handleTradeSuccess}
              language={language}
            />
          </div>
        </div>
        
        {/* Bottom Panel - Trading History */}
        <TradingHistory 
          tradingAccountId={account?.id}
          currentPrices={
            Object.keys(marketData).reduce((acc, key) => {
              acc[key] = marketData[key].price;
              return acc;
            }, {})
          }
          onRefresh={handleTradeSuccess}
        />
      </div>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="bg-[#1a1a2e] border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Internal Transfer</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-slate-400 mb-4">Transfer funds between your wallets</p>
            <Button 
              onClick={() => {
                setTransferOpen(false);
                window.location.href = createPageUrl("Profile") + "?tab=assets";
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Go to Assets Page
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

Trading.propTypes = {
  language: PropTypes.string
};