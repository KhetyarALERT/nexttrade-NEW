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

const MarketHeader = ({ t, price, change24h, balance }) => (
  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white font-bold text-sm">₿</div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">BTC/USDT</h2>
            <Badge variant="outline" className="text-[9px] uppercase h-5">Perpetual</Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 pl-4 border-l border-slate-200">
        <div>
          <span className="text-lg font-bold text-emerald-500">${price.toFixed(2)}</span>
          <span className="text-[9px] text-slate-400 uppercase ml-2">{t.lastPrice}</span>
        </div>
        <div className={`text-sm font-bold ${change24h >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
        </div>
      </div>
    </div>

    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg">
        <Wallet className="h-4 w-4 text-slate-600" />
        <span className="text-xs text-slate-600">{t.balance}:</span>
        <span className="text-sm font-bold text-slate-900">{balance.toFixed(2)} USDT</span>
      </div>
      <Button variant="outline" size="sm" className="h-8">
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>
    </div>
  </div>
);



const PositionsPanel = ({ t, positions = [] }) => (
  <Card className="border-slate-200 shadow-sm overflow-hidden">
    <CardHeader className="bg-slate-50/50 py-2 px-4 border-b border-slate-100">
      <CardTitle className="text-sm font-bold flex items-center gap-2">
        <Activity className="h-4 w-4 text-blue-600" />
        {t.openPositions} ({positions.length})
      </CardTitle>
    </CardHeader>
    <CardContent className="p-0">
      {positions.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-sm">
          No open positions
        </div>
      ) : (
        <Table>
          <TableHeader className="bg-slate-50/30">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] uppercase font-bold">{t.symbol}</TableHead>
              <TableHead className="text-[10px] uppercase font-bold">{t.side}</TableHead>
              <TableHead className="text-[10px] uppercase font-bold">{t.size}</TableHead>
              <TableHead className="text-[10px] uppercase font-bold">{t.entryPrice}</TableHead>
              <TableHead className="text-[10px] uppercase font-bold">{t.markPrice}</TableHead>
              <TableHead className="text-[10px] uppercase font-bold">{t.unrealizedPnl}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((pos, i) => (
              <TableRow key={i}>
                <TableCell className="font-bold text-xs">{pos.symbol}</TableCell>
                <TableCell>
                  <Badge className={`text-[10px] h-5 ${pos.side === 'LONG' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                    {pos.side === 'LONG' ? t.long : t.short}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{pos.size}</TableCell>
                <TableCell className="text-xs font-mono">{pos.entryPrice}</TableCell>
                <TableCell className="text-xs font-mono">{pos.markPrice}</TableCell>
                <TableCell className={`text-xs font-bold ${pos.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
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
  <Card className="border-slate-200 shadow-sm overflow-hidden">
    <CardHeader className="bg-slate-50/50 py-2 px-4 border-b border-slate-100">
      <CardTitle className="text-sm font-bold flex items-center gap-2">
        <History className="h-4 w-4 text-slate-600" />
        {t.tradeHistory}
      </CardTitle>
    </CardHeader>
    <CardContent className="p-0">
      {orders.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-sm">
          No order history
        </div>
      ) : (
        <Table>
          <TableHeader className="bg-slate-50/30">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] uppercase font-bold">Time</TableHead>
              <TableHead className="text-[10px] uppercase font-bold">{t.symbol}</TableHead>
              <TableHead className="text-[10px] uppercase font-bold">{t.side}</TableHead>
              <TableHead className="text-[10px] uppercase font-bold">Price</TableHead>
              <TableHead className="text-[10px] uppercase font-bold">Amount</TableHead>
              <TableHead className="text-[10px] uppercase font-bold">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs text-slate-500">{order.time}</TableCell>
                <TableCell className="font-bold text-xs">{order.symbol}</TableCell>
                <TableCell>
                  <span className={`text-xs font-bold ${order.side === 'BUY' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {order.side}
                  </span>
                </TableCell>
                <TableCell className="text-xs">{order.price}</TableCell>
                <TableCell className="text-xs">{order.amount}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[9px]">{order.status}</Badge>
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
    <div className="min-h-screen bg-slate-900" dir={language === "ar" ? "rtl" : "ltr"}>
      <MarketHeader t={t} price={price} change24h={change24h} balance={balance} />
      
      <div className="mx-auto max-w-[1920px] px-2 py-2">
        <div className="grid gap-2 lg:grid-cols-[280px_1fr_320px]">
          
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
              wsClient={wsClient}
            />
            
            <Tabs defaultValue="positions" className="w-full">
              <TabsList className="w-full justify-start bg-slate-800 border-b border-slate-700 rounded-none h-9">
                <TabsTrigger value="positions" className="text-xs text-slate-300 data-[state=active]:text-white">
                  {t.openPositions}
                </TabsTrigger>
                <TabsTrigger value="orders" className="text-xs text-slate-300 data-[state=active]:text-white">
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