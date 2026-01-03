import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Activity,
  History,
  ChevronDown,
  ChevronUp,
  Menu
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import ProfessionalChart from "@/components/trading/ProfessionalChart";
import SymbolSelector from "@/components/trading/SymbolSelector";
import OrderPanel from "@/components/trading/OrderPanel";
import { base44 } from "@/api/base44Client";

const translations = {
  en: {
    openPositions: "Open Positions",
    tradeHistory: "Order History",
    symbol: "Symbol",
    side: "Side",
    size: "Size",
    entryPrice: "Entry",
    markPrice: "Mark",
    unrealizedPnl: "PnL",
    long: "Long",
    short: "Short"
  },
  ar: {
    openPositions: "المراكز المفتوحة",
    tradeHistory: "سجل الأوامر",
    symbol: "الرمز",
    side: "الجانب",
    size: "الحجم",
    entryPrice: "الدخول",
    markPrice: "السوق",
    unrealizedPnl: "الربح/الخسارة",
    long: "شراء",
    short: "بيع"
  }
};

const PositionsPanel = ({ t, positions = [] }) => (
  <Card className="bg-[#1E222D] border-[#2B2B43] overflow-hidden">
    <CardContent className="p-0">
      {positions.length === 0 ? (
        <div className="p-6 text-center text-gray-500 text-sm">
          No open positions
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#131722]">
              <TableRow className="hover:bg-transparent border-[#2B2B43]">
                <TableHead className="text-[10px] uppercase font-medium text-gray-500">{t.symbol}</TableHead>
                <TableHead className="text-[10px] uppercase font-medium text-gray-500">{t.side}</TableHead>
                <TableHead className="text-[10px] uppercase font-medium text-gray-500">{t.size}</TableHead>
                <TableHead className="text-[10px] uppercase font-medium text-gray-500">{t.entryPrice}</TableHead>
                <TableHead className="text-[10px] uppercase font-medium text-gray-500">{t.unrealizedPnl}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((pos, i) => (
                <TableRow key={i} className="border-[#2B2B43] hover:bg-[#131722]">
                  <TableCell className="font-bold text-xs text-white">{pos.symbol}</TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] h-5 ${pos.side === 'LONG' ? 'bg-[#26A69A]' : 'bg-[#EF5350]'}`}>
                      {pos.side === 'LONG' ? t.long : t.short}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-gray-300">{pos.quantity}</TableCell>
                  <TableCell className="text-xs font-mono text-gray-300">${pos.entry_price?.toFixed(2)}</TableCell>
                  <TableCell className={`text-xs font-bold ${(pos.pnl || 0) >= 0 ? 'text-[#26A69A]' : 'text-[#EF5350]'}`}>
                    {(pos.pnl || 0) >= 0 ? '+' : ''}{(pos.pnl || 0).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </CardContent>
  </Card>
);

const OrderHistoryPanel = ({ t, orders = [] }) => (
  <Card className="bg-[#1E222D] border-[#2B2B43] overflow-hidden">
    <CardContent className="p-0">
      {orders.length === 0 ? (
        <div className="p-6 text-center text-gray-500 text-sm">
          No order history
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#131722]">
              <TableRow className="hover:bg-transparent border-[#2B2B43]">
                <TableHead className="text-[10px] uppercase font-medium text-gray-500">Time</TableHead>
                <TableHead className="text-[10px] uppercase font-medium text-gray-500">{t.symbol}</TableHead>
                <TableHead className="text-[10px] uppercase font-medium text-gray-500">{t.side}</TableHead>
                <TableHead className="text-[10px] uppercase font-medium text-gray-500">PnL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order, i) => (
                <TableRow key={i} className="border-[#2B2B43] hover:bg-[#131722]">
                  <TableCell className="text-xs text-gray-400">
                    {new Date(order.closed_at || order.created_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-bold text-xs text-white">{order.symbol}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-bold ${order.side === 'LONG' ? 'text-[#26A69A]' : 'text-[#EF5350]'}`}>
                      {order.side}
                    </span>
                  </TableCell>
                  <TableCell className={`text-xs font-bold ${(order.pnl || 0) >= 0 ? 'text-[#26A69A]' : 'text-[#EF5350]'}`}>
                    {(order.pnl || 0) >= 0 ? '+' : ''}{(order.pnl || 0).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </CardContent>
  </Card>
);

// Get persisted state
const getPersistedState = () => {
  try {
    const saved = localStorage.getItem('trading_state');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return { symbol: 'BTC-USDT', interval: '15' };
};

const persistState = (state) => {
  try {
    localStorage.setItem('trading_state', JSON.stringify(state));
  } catch (e) {}
};

export default function Trading({ language = "en" }) {
  const t = translations[language] || translations.en;
  const savedState = getPersistedState();
  
  const [symbol, setSymbol] = useState(savedState.symbol);
  const [price, setPrice] = useState(0);
  const [balance, setBalance] = useState(10000);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showMarkets, setShowMarkets] = useState(false);

  // Persist symbol changes
  useEffect(() => {
    persistState({ symbol, interval: savedState.interval });
  }, [symbol]);

  useEffect(() => {
    loadPositions();
    loadBalance();
  }, []);

  const loadPositions = async () => {
    try {
      const result = await base44.functions.invoke('tradingAccount', {
        action: 'getTrades'
      });
      if (result.data?.success) {
        const allTrades = result.data.data || [];
        setPositions(allTrades.filter(t => t.status === 'OPEN'));
        setOrders(allTrades.filter(t => t.status === 'CLOSED').slice(0, 20));
      }
    } catch (error) {
      console.error('Failed to load positions:', error);
    }
  };

  const loadBalance = async () => {
    try {
      const result = await base44.functions.invoke('tradingAccount', {
        action: 'getOrCreate',
        accountType: 'demo'
      });
      if (result.data?.success && result.data.data) {
        setBalance(result.data.data.balance || 10000);
      }
    } catch (error) {
      console.error('Failed to load balance:', error);
    }
  };

  const handleSymbolChange = (newSymbol) => {
    setSymbol(newSymbol);
    setShowMarkets(false);
  };

  const handlePriceUpdate = (newPrice) => {
    setPrice(newPrice);
  };

  const handleOrderSuccess = () => {
    loadPositions();
    loadBalance();
  };

  return (
    <div className="min-h-screen bg-[#131722] overflow-x-hidden" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="max-w-[100vw] p-2">
        {/* Mobile Market Selector Toggle */}
        <div className="lg:hidden mb-2">
          <Button
            variant="outline"
            onClick={() => setShowMarkets(!showMarkets)}
            className="w-full bg-[#1E222D] border-[#2B2B43] text-white justify-between"
          >
            <span className="flex items-center gap-2">
              <Menu className="w-4 h-4" />
              {symbol}
            </span>
            {showMarkets ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          
          <Collapsible open={showMarkets}>
            <CollapsibleContent className="mt-2">
              <div className="max-h-[50vh] overflow-auto">
                <SymbolSelector 
                  selectedSymbol={symbol} 
                  onSymbolChange={handleSymbolChange}
                  compact={true}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="grid gap-2 lg:grid-cols-[240px_1fr_280px]">
          {/* Left Column: Symbol Selector - Hidden on mobile */}
          <div className="hidden lg:block">
            <SymbolSelector 
              selectedSymbol={symbol} 
              onSymbolChange={handleSymbolChange} 
            />
          </div>
          
          {/* Center Column: Chart & Tables */}
          <div className="space-y-2 min-w-0">
            <ProfessionalChart 
              symbol={symbol} 
              onPriceUpdate={handlePriceUpdate}
            />
            
            <Tabs defaultValue="positions" className="w-full">
              <TabsList className="w-full justify-start bg-[#1E222D] border-b border-[#2B2B43] rounded-none h-9">
                <TabsTrigger value="positions" className="text-xs text-gray-400 data-[state=active]:text-white data-[state=active]:bg-transparent">
                  <Activity className="w-3 h-3 mr-1" />
                  {t.openPositions} ({positions.length})
                </TabsTrigger>
                <TabsTrigger value="orders" className="text-xs text-gray-400 data-[state=active]:text-white data-[state=active]:bg-transparent">
                  <History className="w-3 h-3 mr-1" />
                  {t.tradeHistory}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="positions" className="mt-0">
                <PositionsPanel t={t} positions={positions} />
              </TabsContent>
              <TabsContent value="orders" className="mt-0">
                <OrderHistoryPanel t={t} orders={orders} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column: Order Panel */}
          <div className="min-w-0">
            <OrderPanel 
              symbol={symbol} 
              currentPrice={price} 
              balance={balance}
              onOrderSuccess={handleOrderSuccess}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

Trading.propTypes = {
  language: PropTypes.oneOf(["en", "ar"])
};