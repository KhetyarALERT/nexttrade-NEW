import { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { RefreshCw, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ProfessionalChart from "@/components/trading/ProfessionalChart";
import OrderPanel from "@/components/trading/OrderPanel";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const TOP_SYMBOLS = [
  { symbol: "BTC-USDT", name: "Bitcoin" },
  { symbol: "ETH-USDT", name: "Ethereum" },
  { symbol: "SOL-USDT", name: "Solana" },
  { symbol: "BNB-USDT", name: "BNB" },
  { symbol: "XRP-USDT", name: "XRP" },
  { symbol: "DOGE-USDT", name: "Dogecoin" },
  { symbol: "ADA-USDT", name: "Cardano" },
  { symbol: "AVAX-USDT", name: "Avalanche" }
];

export default function Trading({ language = "en" }) {
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    return localStorage.getItem('trading_symbol') || "BTC-USDT";
  });
  const [selectedInterval, setSelectedInterval] = useState(() => {
    return localStorage.getItem('trading_interval') || "1h";
  });
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const [marketData, setMarketData] = useState({});
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [marketsOpen, setMarketsOpen] = useState(true);
  const wsRef = useRef(null);

  // Save preferences
  useEffect(() => {
    localStorage.setItem('trading_symbol', selectedSymbol);
  }, [selectedSymbol]);

  useEffect(() => {
    localStorage.setItem('trading_interval', selectedInterval);
  }, [selectedInterval]);

  // Load trading account
  useEffect(() => {
    const loadAccount = async () => {
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
    };
    loadAccount();
  }, []);

  // WebSocket for real-time prices
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket('wss://open-api-ws.bingx.com/market');
      wsRef.current = ws;

      ws.onopen = () => {
        // Subscribe to ticker for all symbols
        TOP_SYMBOLS.forEach(({ symbol }) => {
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
          let data;
          if (event.data instanceof Blob) {
            return; // Skip blob messages for now
          }
          data = JSON.parse(event.data);
          
          if (data.dataType?.includes('@ticker') && data.data) {
            const symbol = data.dataType.split('@')[0];
            const tickerData = data.data;
            
            setMarketData(prev => ({
              ...prev,
              [symbol]: {
                price: parseFloat(tickerData.c || tickerData.lastPrice || 0),
                change: parseFloat(tickerData.p || tickerData.priceChangePercent || 0)
              }
            }));

            if (symbol === selectedSymbol) {
              setCurrentPrice(parseFloat(tickerData.c || tickerData.lastPrice || 0));
              setPriceChange(parseFloat(tickerData.p || tickerData.priceChangePercent || 0));
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {
        // Set fallback prices
        setMarketData({
          'BTC-USDT': { price: 96850, change: 2.34 },
          'ETH-USDT': { price: 3420, change: 1.89 },
          'SOL-USDT': { price: 198, change: 4.21 },
          'BNB-USDT': { price: 705, change: 0.87 },
          'XRP-USDT': { price: 2.18, change: -1.23 },
          'DOGE-USDT': { price: 0.32, change: 3.45 },
          'ADA-USDT': { price: 0.89, change: 2.11 },
          'AVAX-USDT': { price: 38.50, change: 1.56 }
        });
        if (selectedSymbol === 'BTC-USDT') {
          setCurrentPrice(96850);
          setPriceChange(2.34);
        }
      };

      ws.onclose = () => {
        setTimeout(connectWebSocket, 3000);
      };
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

  const handleTradeSuccess = useCallback(async () => {
    // Refresh account data
    try {
      const result = await base44.functions.invoke('tradingAccount', { 
        action: 'getOrCreate', 
        accountType: 'demo' 
      });
      if (result.data?.success) {
        setAccount(result.data.data);
      }
    } catch (err) {
      console.error("Failed to refresh account:", err);
    }
  }, []);

  const t = language === "ar" ? {
    markets: "الأسواق",
    balance: "الرصيد",
    equity: "الأسهم",
    margin: "الهامش"
  } : {
    markets: "Markets",
    balance: "Balance",
    equity: "Equity", 
    margin: "Margin"
  };

  return (
    <div className="min-h-screen bg-[#0d0d1a]">
      <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)]">
        {/* Markets Panel - Collapsible on mobile */}
        <Collapsible open={marketsOpen} onOpenChange={setMarketsOpen} className="lg:w-64 flex-shrink-0">
          <div className="bg-[#1a1a2e] border-b lg:border-r border-slate-700/50">
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full flex items-center justify-between p-3 text-white hover:bg-slate-700/30 lg:hidden"
              >
                <span className="font-medium">{t.markets}</span>
                {marketsOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <div className="hidden lg:block p-3 border-b border-slate-700/50">
              <h3 className="text-white font-medium text-sm">{t.markets}</h3>
            </div>
          </div>
          
          <CollapsibleContent className="lg:block">
            <div className="bg-[#1a1a2e] lg:h-full overflow-y-auto max-h-[300px] lg:max-h-none">
              {TOP_SYMBOLS.map(({ symbol, name }) => {
                const data = marketData[symbol] || { price: 0, change: 0 };
                const isSelected = symbol === selectedSymbol;
                
                return (
                  <button
                    key={symbol}
                    onClick={() => handleSymbolSelect(symbol)}
                    className={`w-full flex items-center justify-between p-3 transition-colors ${
                      isSelected ? 'bg-blue-600/20 border-l-2 border-blue-500' : 'hover:bg-slate-700/30'
                    }`}
                  >
                    <div className="text-left">
                      <p className="text-white text-sm font-medium">{symbol.replace('-', '/')}</p>
                      <p className="text-slate-400 text-xs">{name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-sm font-mono">
                        ${data.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className={`text-xs font-medium ${data.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {data.change >= 0 ? '+' : ''}{data.change?.toFixed(2)}%
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Main Content */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Chart Section */}
          <div className="flex-1 flex flex-col min-h-[400px] lg:min-h-0">
            {/* Price Header */}
            <div className="bg-[#1a1a2e] border-b border-slate-700/50 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-white text-lg font-bold">{selectedSymbol.replace('-', '/')}</h2>
                  <Badge variant="outline" className="bg-blue-600/20 text-blue-400 border-blue-500/50">
                    Perpetual
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-white text-xl font-bold font-mono">
                      ${currentPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className={`flex items-center justify-end gap-1 ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {priceChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      <span className="text-sm font-medium">{priceChange >= 0 ? '+' : ''}{priceChange?.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="flex-1 bg-[#0d0d1a]">
              <ProfessionalChart
                symbol={selectedSymbol}
                interval={selectedInterval}
                onIntervalChange={setSelectedInterval}
                onPriceUpdate={handlePriceUpdate}
              />
            </div>
          </div>

          {/* Order Panel */}
          <div className="w-full lg:w-80 flex-shrink-0 bg-[#1a1a2e] border-t lg:border-t-0 lg:border-l border-slate-700/50 overflow-y-auto">
            {/* Account Summary */}
            {account && (
              <div className="p-3 border-b border-slate-700/50">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-slate-400 text-[10px]">{t.balance}</p>
                    <p className="text-white text-sm font-bold">${(account.demo_balance || account.balance || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px]">{t.equity}</p>
                    <p className="text-white text-sm font-bold">${(account.equity || account.demo_balance || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px]">{t.margin}</p>
                    <p className="text-amber-400 text-sm font-bold">${(account.margin_used || 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}

            <OrderPanel
              symbol={selectedSymbol}
              currentPrice={currentPrice}
              account={account}
              onTradeSuccess={handleTradeSuccess}
              language={language}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

Trading.propTypes = {
  language: PropTypes.string
};