import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  ChevronDown,
  Maximize2,
  Settings,
  Eye,
  History,
  Info,
  AlertCircle,
  ExternalLink,
  BarChart3,
  LayoutGrid,
  List
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const translations = {
  en: {
    lastPrice: "Last Price",
    change24h: "24h Change",
    high24h: "24h High",
    low24h: "24h Low",
    volume24h: "24h Volume",
    openPositions: "Open Positions",
    tradeHistory: "Trade History",
    spectateMode: "Live Trade Spectate",
    spectateActive: "Trade Active",
    spectateIdle: "Waiting for Trade",
    disclaimer: "Risk Disclosure: Trading involves significant risk. Market movements can be unpredictable. Risk management is educational.",
    symbol: "Symbol",
    side: "Side",
    size: "Size",
    entryPrice: "Entry Price",
    markPrice: "Mark Price",
    unrealizedPnl: "Unrealized PnL",
    status: "Status",
    duration: "Duration",
    result: "Result",
    date: "Date",
    long: "Long",
    short: "Short",
    open: "Open",
    closed: "Closed"
  },
  ar: {
    lastPrice: "آخر سعر",
    change24h: "تغيير 24 ساعة",
    high24h: "أعلى 24 ساعة",
    low24h: "أدنى 24 ساعة",
    volume24h: "حجم 24 ساعة",
    openPositions: "المراكز المفتوحة",
    tradeHistory: "سجل التداولات",
    spectateMode: "مراقبة التداول المباشر",
    spectateActive: "تداول نشط",
    spectateIdle: "في انتظار تداول",
    disclaimer: "إخلاء المسؤولية عن المخاطر: ينطوي التداول على مخاطر كبيرة. يمكن أن تكون تحركات السوق غير متوقعة. إدارة المخاطر تعليمية.",
    symbol: "الرمز",
    side: "الجانب",
    size: "الحجم",
    entryPrice: "سعر الدخول",
    markPrice: "سعر السوق",
    unrealizedPnl: "الربح/الخسارة غير المحقق",
    status: "الحالة",
    duration: "المدة",
    result: "النتيجة",
    date: "التاريخ",
    long: "شراء",
    short: "بيع",
    open: "مفتوح",
    closed: "مغلق"
  }
};

const MarketHeader = ({ t }) => (
  <div className="flex flex-wrap items-center gap-6 border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
    <div className="flex items-center gap-3 pr-6 border-r border-slate-100">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white font-bold">₿</div>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900">BTC/USDT</h2>
          <Badge variant="outline" className="text-[10px] uppercase">Bitcoin</Badge>
        </div>
        <p className="text-xs text-slate-500">Perpetual</p>
      </div>
      <ChevronDown className="h-4 w-4 text-slate-400 ml-2" />
    </div>

    <div className="flex flex-col">
      <span className="text-xl font-bold text-emerald-500">43,250.40</span>
      <span className="text-[10px] text-slate-400 uppercase tracking-wider">{t.lastPrice}</span>
    </div>

    <div className="flex flex-col">
      <span className="text-sm font-bold text-emerald-500">+2.45%</span>
      <span className="text-[10px] text-slate-400 uppercase tracking-wider">{t.change24h}</span>
    </div>

    <div className="hidden sm:flex flex-col">
      <span className="text-sm font-bold text-slate-700">44,120.00</span>
      <span className="text-[10px] text-slate-400 uppercase tracking-wider">{t.high24h}</span>
    </div>

    <div className="hidden sm:flex flex-col">
      <span className="text-sm font-bold text-slate-700">41,850.00</span>
      <span className="text-[10px] text-slate-400 uppercase tracking-wider">{t.low24h}</span>
    </div>

    <div className="hidden lg:flex flex-col">
      <span className="text-sm font-bold text-slate-700">1.2B USDT</span>
      <span className="text-[10px] text-slate-400 uppercase tracking-wider">{t.volume24h}</span>
    </div>
  </div>
);

const TradingChart = () => (
  <Card className="h-[500px] border-0 rounded-none shadow-none bg-slate-50 overflow-hidden relative">
    <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white/80 backdrop-blur p-1 rounded-lg border border-slate-200">
      {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
        <Button key={tf} variant="ghost" size="sm" className={`h-7 px-2 text-xs ${tf === '15m' ? 'bg-slate-100 text-blue-600' : 'text-slate-500'}`}>
          {tf}
        </Button>
      ))}
      <div className="w-px h-4 bg-slate-200 mx-1" />
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500">
        <BarChart3 className="h-3.5 w-3.5 mr-1" /> Indicators
      </Button>
    </div>
    
    <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
      <Button variant="outline" size="icon" className="h-8 w-8 bg-white">
        <Settings className="h-4 w-4 text-slate-500" />
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8 bg-white">
        <Maximize2 className="h-4 w-4 text-slate-500" />
      </Button>
    </div>

    <div className="w-full h-full flex items-center justify-center text-slate-300 flex-col gap-4">
      <Activity className="h-12 w-12 animate-pulse" />
      <p className="text-sm font-medium">Connecting to WebSocket feed...</p>
      {/* Placeholder for TradingView or custom canvas chart */}
      <div className="absolute inset-0 flex items-end px-4 pb-8 opacity-20 pointer-events-none">
        <div className="flex items-end gap-1 w-full h-32">
          {Array.from({length: 40}).map((_, i) => (
            <div key={i} className="bg-blue-500 w-full" style={{height: `${Math.random() * 100}%`}} />
          ))}
        </div>
      </div>
    </div>
  </Card>
);

const PositionsPanel = ({ t }) => (
  <Card className="border-slate-200 shadow-sm overflow-hidden">
    <CardHeader className="bg-slate-50/50 py-3 px-6 border-b border-slate-100">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-blue-600" />
          {t.openPositions} (2)
        </CardTitle>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100">Live Streaming</Badge>
      </div>
    </CardHeader>
    <CardContent className="p-0">
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
          <TableRow>
            <TableCell className="font-bold text-xs">BTC/USDT</TableCell>
            <TableCell><Badge className="bg-emerald-500 text-[10px] h-5">{t.long}</Badge></TableCell>
            <TableCell className="text-xs">0.25 BTC</TableCell>
            <TableCell className="text-xs font-mono">42,850.00</TableCell>
            <TableCell className="text-xs font-mono">43,250.40</TableCell>
            <TableCell className="text-xs font-bold text-emerald-600">+$100.10 (0.93%)</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-bold text-xs">ETH/USDT</TableCell>
            <TableCell><Badge className="bg-rose-500 text-[10px] h-5">{t.short}</Badge></TableCell>
            <TableCell className="text-xs">2.50 ETH</TableCell>
            <TableCell className="text-xs font-mono">2,280.15</TableCell>
            <TableCell className="text-xs font-mono">2,245.30</TableCell>
            <TableCell className="text-xs font-bold text-emerald-600">+$87.12 (1.52%)</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);

const SpectatePanel = ({ t }) => (
  <Card className="border-slate-200 shadow-sm overflow-hidden">
    <CardHeader className="bg-slate-900 text-white py-3 px-6">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Eye className="h-4 w-4 text-blue-400" />
          {t.spectateMode}
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider">{t.spectateActive}</span>
        </div>
      </div>
    </CardHeader>
    <CardContent className="p-6 space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Current Strategy</span>
          <Badge variant="secondary" className="text-[10px]">Trend Following</Badge>
        </div>
        <div className="relative pl-6 border-l-2 border-slate-100 space-y-6">
          <div className="relative">
            <div className="absolute -left-[25px] top-0 h-4 w-4 rounded-full bg-blue-600 border-4 border-white shadow-sm" />
            <p className="text-xs font-bold text-slate-900">Trade Opened</p>
            <p className="text-[10px] text-slate-400">BTC/USDT Long @ 42,850.00 • 14:22:05</p>
          </div>
          <div className="relative">
            <div className="absolute -left-[25px] top-0 h-4 w-4 rounded-full bg-slate-200 border-4 border-white shadow-sm" />
            <p className="text-xs font-bold text-slate-900">TP / SL Updated</p>
            <p className="text-[10px] text-slate-400">TP: 44,500.00 | SL: 41,200.00 • 14:45:12</p>
          </div>
          <div className="relative opacity-40">
            <div className="absolute -left-[25px] top-0 h-4 w-4 rounded-full bg-slate-200 border-4 border-white shadow-sm" />
            <p className="text-xs font-bold text-slate-900">Trade Closed</p>
            <p className="text-[10px] text-slate-400">Pending market conditions...</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-[10px] leading-relaxed text-amber-800">
            {t.disclaimer}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const SummaryPanel = ({ t }) => (
  <Card className="border-slate-200 shadow-sm">
    <CardHeader className="py-4 px-6 border-b border-slate-100">
      <CardTitle className="text-sm font-bold flex items-center gap-2">
        <Info className="h-4 w-4 text-slate-400" />
        Position Summary
      </CardTitle>
    </CardHeader>
    <CardContent className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Allocated Amount</p>
          <p className="text-sm font-bold text-slate-900">$5,000.00</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Position Size</p>
          <p className="text-sm font-bold text-slate-900">2.5x Leverage</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Est. PnL</p>
          <p className="text-sm font-bold text-emerald-600">+$187.22</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Risk Level</p>
          <Badge className="bg-amber-500 text-[10px] h-5">Moderate</Badge>
        </div>
      </div>
      
      <div className="pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-slate-400 uppercase">Margin Usage</span>
          <span className="text-[10px] font-bold text-slate-700">45%</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full" style={{width: '45%'}} />
        </div>
      </div>
    </CardContent>
  </Card>
);

const HistoryPanel = ({ t }) => (
  <Card className="border-slate-200 shadow-sm overflow-hidden">
    <CardHeader className="bg-slate-50/50 py-3 px-6 border-b border-slate-100">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <History className="h-4 w-4 text-slate-600" />
          {t.tradeHistory}
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-7 text-[10px] text-slate-500">
          View All <ExternalLink className="ml-1 h-3 w-3" />
        </Button>
      </div>
    </CardHeader>
    <CardContent className="p-0">
      <Table>
        <TableHeader className="bg-slate-50/30">
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-[10px] uppercase font-bold">{t.symbol}</TableHead>
            <TableHead className="text-[10px] uppercase font-bold">{t.side}</TableHead>
            <TableHead className="text-[10px] uppercase font-bold">{t.result}</TableHead>
            <TableHead className="text-[10px] uppercase font-bold">{t.duration}</TableHead>
            <TableHead className="text-right text-[10px] uppercase font-bold">{t.date}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { symbol: "BTC/USDT", side: "Long", result: "+$450.20", duration: "4h 12m", date: "2023-12-30" },
            { symbol: "SOL/USDT", side: "Short", result: "-$120.50", duration: "1h 45m", date: "2023-12-29" },
            { symbol: "ETH/USDT", side: "Long", result: "+$85.10", duration: "12h 30m", date: "2023-12-28" }
          ].map((trade, i) => (
            <TableRow key={i}>
              <TableCell className="font-bold text-xs">{trade.symbol}</TableCell>
              <TableCell><span className={`text-xs ${trade.side === 'Long' ? 'text-emerald-600' : 'text-rose-600'}`}>{trade.side}</span></TableCell>
              <TableCell className={`text-xs font-bold ${trade.result.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}`}>{trade.result}</TableCell>
              <TableCell className="text-xs text-slate-500">{trade.duration}</TableCell>
              <TableCell className="text-right text-xs text-slate-400">{trade.date}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);

export default function Trading({ language = "en" }) {
  const t = translations[language] || translations.en;

  return (
    <div className="min-h-screen bg-slate-50 pb-12" dir={language === "ar" ? "rtl" : "ltr"}>
      <MarketHeader t={t} />
      
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
          
          {/* Left Column: Chart & Positions */}
          <div className="space-y-6">
            <TradingChart />
            
            <div className="grid gap-6 md:grid-cols-1">
              <PositionsPanel t={t} />
              <HistoryPanel t={t} />
            </div>
          </div>

          {/* Right Column: Spectate & Summary */}
          <div className="space-y-6">
            <SpectatePanel t={t} />
            <SummaryPanel t={t} />
            
            <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
              <CardContent className="p-6">
                <h3 className="font-bold mb-2">Ready to Trade?</h3>
                <p className="text-xs text-blue-100 mb-4">Connect your account to start executing trades with ultra-low latency.</p>
                <Button className="w-full bg-white text-blue-600 hover:bg-blue-50 font-bold">
                  Connect Wallet
                </Button>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}

Trading.propTypes = {
  language: PropTypes.oneOf(["en", "ar"])
};
