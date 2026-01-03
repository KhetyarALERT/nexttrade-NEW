import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  History,
  Wallet,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import BingXWebSocketClient from "@/components/trading/BingXWebSocket";
import ProfessionalChart from "@/components/trading/ProfessionalChart";
import SymbolSelector from "@/components/trading/SymbolSelector";
import OrderPanel from "@/components/trading/OrderPanel";
import { base44 } from "@/api/base44Client";

const translations = {
  en: {
    lastPrice: "Last Price",
    change24h: "24h Change",
    openPositions: "Open Positions",
    tradeHistory: "Order History",
    balance: "Balance",
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
    lastPrice: "آخر سعر",
    change24h: "تغيير 24 ساعة",
    openPositions: "المراكز المفتوحة",
    tradeHistory: "سجل الأوامر",
    balance: "الرصيد",
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

// Header removed - integrated into chart component for cleaner design



const PositionsPanel = ({ t, positions = [] }) => (
  <Card className="bg-[#1E222D] border-[#2B2B43] overflow-hidden">
    <CardContent className="p-0">
      {positions.length === 0 ? (
        <div className="p-8 text-center text-gray-500 text-sm">
          No open positions
        </div>
      ) : (
        <Table>
          <TableHeader className="bg-[#131722]">
            <TableRow className="hover:bg-transparent border-[#2B2B43]">
              <TableHead className="text-[10px] uppercase font-medium text-gray-500">{t.symbol}</TableHead>
              <TableHead className="text-[10px] uppercase font-medium text-gray-500">{t.side}</TableHead>
              <TableHead className="text-[10px] uppercase font-medium text-gray-500">{t.size}</TableHead>
              <TableHead className="text-[10px] uppercase font-medium text-gray-500">{t.entryPrice}</TableHead>
              <TableHead className="text-[10px] uppercase font-medium text-gray-500">{t.markPrice}</TableHead>
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
                <TableCell className="text-xs text-gray-300">{pos.size}</TableCell>
                <TableCell className="text-xs font-mono text-gray-300">{pos.entryPrice}</TableCell>
                <TableCell className="text-xs font-mono text-gray-300">{pos.markPrice}</TableCell>
                <TableCell className={`text-xs font-bold ${pos.pnl >= 0 ? 'text-[#26A69A]' : 'text-[#EF5350]'}`}>
                  {pos.pnl >= 0 ? '+' : ''}{pos.pnl}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardContent>
  </Card>
);





const OrderHistoryPanel = ({ t, orders = [] }) => (
  <Card className="bg-[#1E222D] border-[#2B2B43] overflow-hidden">
    <CardContent className="p-0">
      {orders.length === 0 ? (
        <div className="p-8 text-center text-gray-500 text-sm">
          No order history
        </div>
      ) : (
        <Table>
          <TableHeader className="bg-[#131722]">
            <TableRow className="hover:bg-transparent border-[#2B2B43]">
              <TableHead className="text-[10px] uppercase font-medium text-gray-500">Time</TableHead>
              <TableHead className="text-[10px] uppercase font-medium text-gray-500">{t.symbol}</TableHead>
              <TableHead className="text-[10px] uppercase font-medium text-gray-500">{t.side}</TableHead>
              <TableHead className="text-[10px] uppercase font-medium text-gray-500">Price</TableHead>
              <TableHead className="text-[10px] uppercase font-medium text-gray-500">Amount</TableHead>
              <TableHead className="text-[10px] uppercase font-medium text-gray-500">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order, i) => (
              <TableRow key={i} className="border-[#2B2B43] hover:bg-[#131722]">
                <TableCell className="text-xs text-gray-400">{order.time}</TableCell>
                <TableCell className="font-bold text-xs text-white">{order.symbol}</TableCell>
                <TableCell>
                  <span className={`text-xs font-bold ${order.side === 'BUY' ? 'text-[#26A69A]' : 'text-[#EF5350]'}`}>
                    {order.side}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-gray-300">{order.price}</TableCell>
                <TableCell className="text-xs text-gray-300">{order.amount}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[9px] border-gray-600 text-gray-400">{order.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardContent>
  </Card>
);

// Activity Logger
const logActivity = (action, details) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [TRADING] ${action}:`, details);
  const logs = JSON.parse(localStorage.getItem('tradingLogs') || '[]');
  logs.push({ timestamp, action, details });
  if (logs.length > 1000) logs.shift();
  localStorage.setItem('tradingLogs', JSON.stringify(logs));
};

export default function Trading({ language = "en" }) {
  const t = translations[language] || translations.en;
  const [symbol, setSymbol] = useState("BTC-USDT");
  const [price, setPrice] = useState(94250);
  const [change24h, setChange24h] = useState(3.15);
  const [balance, setBalance] = useState(10000);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [wsClient, setWsClient] = useState(null);

  useEffect(() => {
    logActivity('PAGE_LOAD', { symbol, timestamp: new Date().toISOString() });
    
    // Initialize WebSocket
    const client = new BingXWebSocketClient('futures');
    client.connect().then(() => {
      logActivity('WS_CONNECTED', { symbol });
      client.subscribe(symbol, 'trade');
      client.on('*', (msg) => {
        if (msg.data && msg.data.p) {
          setPrice(parseFloat(msg.data.p));
        }
      });
    }).catch(err => {
      logActivity('WS_ERROR', { error: err.message });
    });
    
    setWsClient(client);
    loadPositions();
    loadBalance();

    return () => {
      if (client) {
        client.disconnect();
        logActivity('WS_DISCONNECTED', { symbol });
      }
    };
  }, [symbol]);

  const loadPositions = async () => {
    try {
      logActivity('LOAD_POSITIONS', { status: 'started' });
      const result = await base44.functions.invoke('bingxRest', {
        action: 'futures.getPositions',
        params: { symbol }
      });
      if (result.data.success) {
        setPositions(result.data.data || []);
        logActivity('LOAD_POSITIONS', { status: 'success', count: result.data.data?.length || 0 });
      }
    } catch (error) {
      logActivity('LOAD_POSITIONS', { status: 'error', error: error.message });
    }
  };

  const loadBalance = async () => {
    try {
      logActivity('LOAD_BALANCE', { status: 'started' });
      const result = await base44.functions.invoke('bingxRest', {
        action: 'futures.getBalance',
        params: {}
      });
      if (result.data.success && result.data.data) {
        const usdtBalance = result.data.data.find(b => b.asset === 'USDT');
        if (usdtBalance) {
          setBalance(parseFloat(usdtBalance.balance));
          logActivity('LOAD_BALANCE', { status: 'success', balance: usdtBalance.balance });
        }
      }
    } catch (error) {
      logActivity('LOAD_BALANCE', { status: 'error', error: error.message });
    }
  };

  const handleSymbolChange = (newSymbol) => {
    logActivity('SYMBOL_CHANGE', { from: symbol, to: newSymbol });
    setSymbol(newSymbol);
  };

  const handlePriceUpdate = (newPrice) => {
    setPrice(newPrice);
  };

  return (
    <div className="min-h-screen bg-[#131722]" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-[1920px] p-2">
        <div className="grid gap-2 lg:grid-cols-[260px_1fr_300px]">
          
          {/* Left Column: Symbol Selector */}
          <div className="hidden lg:block">
            <SymbolSelector 
              selectedSymbol={symbol} 
              onSymbolChange={handleSymbolChange} 
            />
          </div>
          
          {/* Center Column: Chart & Tables */}
          <div className="space-y-2">
            <ProfessionalChart 
              symbol={symbol} 
              onPriceUpdate={handlePriceUpdate}
            />
            
            <Tabs defaultValue="positions" className="w-full">
              <TabsList className="w-full justify-start bg-[#1E222D] border-b border-[#2B2B43] rounded-none h-9">
                <TabsTrigger value="positions" className="text-xs text-gray-400 data-[state=active]:text-white data-[state=active]:bg-transparent">
                  {t.openPositions}
                </TabsTrigger>
                <TabsTrigger value="orders" className="text-xs text-gray-400 data-[state=active]:text-white data-[state=active]:bg-transparent">
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
          <div>
            <OrderPanel 
              symbol={symbol} 
              currentPrice={price} 
              balance={balance}
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