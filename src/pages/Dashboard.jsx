import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Wallet,
  TrendingUp,
  Activity,
  Clock,
  Gift,
  Users,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
  CheckCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const translations = {
  en: {
    title: "Trading Dashboard",
    subtitle: "Your complete financial overview",
    balance: "Account Balance",
    totalBalance: "Total Balance",
    available: "Available",
    inPositions: "In Positions",
    pnl: "PnL Statistics",
    dailyPnl: "Daily PnL",
    weeklyPnl: "Weekly PnL",
    monthlyPnl: "Monthly PnL",
    totalPnl: "Total PnL",
    positions: "Open Positions",
    orders: "Recent Orders",
    referrals: "Referral Program",
    vouchers: "Available Vouchers",
    noPositions: "No open positions",
    noOrders: "No recent orders",
    refresh: "Refresh",
    trade: "Start Trading",
    viewAll: "View All"
  },
  ar: {
    title: "لوحة التداول",
    subtitle: "نظرة شاملة على حسابك المالي",
    balance: "رصيد الحساب",
    totalBalance: "الرصيد الإجمالي",
    available: "المتاح",
    inPositions: "في المراكز",
    pnl: "إحصائيات الربح والخسارة",
    dailyPnl: "الربح اليومي",
    weeklyPnl: "الربح الأسبوعي",
    monthlyPnl: "الربح الشهري",
    totalPnl: "إجمالي الربح",
    positions: "المراكز المفتوحة",
    orders: "الأوامر الأخيرة",
    referrals: "برنامج الإحالة",
    vouchers: "القسائم المتاحة",
    noPositions: "لا توجد مراكز مفتوحة",
    noOrders: "لا توجد أوامر حديثة",
    refresh: "تحديث",
    trade: "ابدأ التداول",
    viewAll: "عرض الكل"
  }
};

// Activity Logger
const logActivity = (action, details) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    action,
    details,
    userId: 'current-user'
  };
  console.log(`[${timestamp}] [DASHBOARD] ${action}:`, details);
  
  // Store in localStorage for persistence
  const logs = JSON.parse(localStorage.getItem('dashboardLogs') || '[]');
  logs.push(logEntry);
  if (logs.length > 1000) logs.shift();
  localStorage.setItem('dashboardLogs', JSON.stringify(logs));
  
  return logEntry;
};

const StatCard = ({ title, value, change = undefined, icon: Icon, color }) => (
  <Card className="border-slate-200 shadow-sm">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {change !== undefined && (
            <div className={`flex items-center gap-1 mt-1 text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function Dashboard({ language = "en" }) {
  const t = translations[language] || translations.en;
  const [_loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [balanceData, setBalanceData] = useState({
    total: 10000,
    available: 7500,
    inPositions: 2500
  });
  
  const [pnlData, _setPnlData] = useState({
    daily: 245.50,
    dailyPercent: 2.45,
    weekly: 1250.00,
    weeklyPercent: 12.5,
    monthly: 4500.00,
    monthlyPercent: 45.0,
    total: 15000.00,
    totalPercent: 150.0
  });
  
  const [positions, setPositions] = useState([]);
  const [orders, _setOrders] = useState([]);
  const [referralData, _setReferralData] = useState({
    code: "NEXT-7829",
    link: "https://nexttrade.app/ref/NEXT-7829",
    totalReferrals: 12,
    activeReferrals: 8,
    totalCommission: 1450.20
  });
  
  const [vouchers, _setVouchers] = useState([
    { id: 1, title: "$50 Trading Bonus", condition: "Min. deposit $500", expiry: "2026-02-15", status: "Active" },
    { id: 2, title: "Zero Fee Trade", condition: "Valid for 5 trades", expiry: "2026-01-30", status: "New" }
  ]);

  const loadDashboardData = useCallback(async () => {
    logActivity('LOAD_DASHBOARD', { status: 'started' });
    setLoading(true);
    
    try {
      // Load positions from BingX
      const positionsResult = await base44.functions.invoke('bingxRest', {
        action: 'futures.getPositions',
        params: {}
      });
      
      if (positionsResult.data?.success) {
        setPositions(positionsResult.data.data || []);
        logActivity('LOAD_POSITIONS', { count: positionsResult.data.data?.length || 0 });
      }
      
      // Load balance
      const balanceResult = await base44.functions.invoke('bingxRest', {
        action: 'futures.getBalance',
        params: {}
      });
      
      if (balanceResult.data?.success && balanceResult.data.data) {
        const usdtBalance = balanceResult.data.data.find(b => b.asset === 'USDT');
        if (usdtBalance) {
          setBalanceData({
            total: parseFloat(usdtBalance.balance) || 10000,
            available: parseFloat(usdtBalance.availableBalance) || 7500,
            inPositions: parseFloat(usdtBalance.balance) - parseFloat(usdtBalance.availableBalance) || 2500
          });
          logActivity('LOAD_BALANCE', { balance: usdtBalance.balance });
        }
      }
      
      logActivity('LOAD_DASHBOARD', { status: 'completed' });
    } catch (error) {
      logActivity('LOAD_DASHBOARD', { status: 'error', error: error.message });
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    logActivity('DASHBOARD_MOUNTED', { timestamp: new Date().toISOString() });
    
    return () => {
      logActivity('DASHBOARD_UNMOUNTED', { timestamp: new Date().toISOString() });
    };
  }, [loadDashboardData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    logActivity('REFRESH_TRIGGERED', { timestamp: new Date().toISOString() });
    await loadDashboardData();
    setRefreshing(false);
    toast.success('Dashboard refreshed');
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(referralData.code);
    logActivity('COPY_REFERRAL', { code: referralData.code });
    toast.success('Referral code copied!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-20 pt-8" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t.title}</h1>
            <p className="text-slate-600 mt-1">{t.subtitle}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {t.refresh}
            </Button>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link to={createPageUrl("Futures")}>
                <Activity className="h-4 w-4 mr-2" />
                {t.trade}
              </Link>
            </Button>
          </div>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
            title={t.totalBalance} 
            value={`$${balanceData.total.toLocaleString()}`}
            icon={Wallet}
            color="bg-gradient-to-br from-blue-600 to-blue-700"
          />
          <StatCard 
            title={t.available} 
            value={`$${balanceData.available.toLocaleString()}`}
            icon={CheckCircle}
            color="bg-gradient-to-br from-green-500 to-green-600"
          />
          <StatCard 
            title={t.inPositions} 
            value={`$${balanceData.inPositions.toLocaleString()}`}
            icon={Activity}
            color="bg-gradient-to-br from-purple-500 to-purple-600"
          />
          <StatCard 
            title={t.dailyPnl} 
            value={`$${pnlData.daily.toLocaleString()}`}
            change={pnlData.dailyPercent}
            icon={TrendingUp}
            color="bg-gradient-to-br from-cyan-500 to-cyan-600"
          />
        </div>

        {/* PnL Statistics */}
        <Card className="mb-8 border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-lg">{t.pnl}</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-slate-500 uppercase mb-1">{t.dailyPnl}</p>
                <p className={`text-xl font-bold ${pnlData.daily >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {pnlData.daily >= 0 ? '+' : ''}${pnlData.daily.toFixed(2)}
                </p>
                <p className={`text-sm ${pnlData.dailyPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {pnlData.dailyPercent >= 0 ? '+' : ''}{pnlData.dailyPercent.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase mb-1">{t.weeklyPnl}</p>
                <p className={`text-xl font-bold ${pnlData.weekly >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {pnlData.weekly >= 0 ? '+' : ''}${pnlData.weekly.toFixed(2)}
                </p>
                <p className={`text-sm ${pnlData.weeklyPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {pnlData.weeklyPercent >= 0 ? '+' : ''}{pnlData.weeklyPercent.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase mb-1">{t.monthlyPnl}</p>
                <p className={`text-xl font-bold ${pnlData.monthly >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {pnlData.monthly >= 0 ? '+' : ''}${pnlData.monthly.toFixed(2)}
                </p>
                <p className={`text-sm ${pnlData.monthlyPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {pnlData.monthlyPercent >= 0 ? '+' : ''}{pnlData.monthlyPercent.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase mb-1">{t.totalPnl}</p>
                <p className={`text-xl font-bold ${pnlData.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {pnlData.total >= 0 ? '+' : ''}${pnlData.total.toFixed(2)}
                </p>
                <p className={`text-sm ${pnlData.totalPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {pnlData.totalPercent >= 0 ? '+' : ''}{pnlData.totalPercent.toFixed(2)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Positions & Orders */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Open Positions */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{t.positions}</CardTitle>
                <Badge variant="outline">{positions.length} Active</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {positions.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>{t.noPositions}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Side</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>PnL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.map((pos, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-bold">{pos.symbol}</TableCell>
                        <TableCell>
                          <Badge className={pos.side === 'LONG' ? 'bg-green-500' : 'bg-red-500'}>
                            {pos.side}
                          </Badge>
                        </TableCell>
                        <TableCell>{pos.size}</TableCell>
                        <TableCell className={pos.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {pos.pnl}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Recent Orders */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{t.orders}</CardTitle>
                <Button variant="ghost" size="sm" className="text-blue-600">
                  {t.viewAll}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {orders.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>{t.noOrders}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Side</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs text-slate-500">{order.time}</TableCell>
                        <TableCell className="font-bold">{order.symbol}</TableCell>
                        <TableCell>{order.side}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{order.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Referrals & Vouchers */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Referral Program */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                {t.referrals}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-900">{referralData.totalReferrals}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{referralData.activeReferrals}</p>
                  <p className="text-xs text-slate-500">Active</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">${referralData.totalCommission.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">Commission</p>
                </div>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-2">Your Referral Code</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-slate-200 rounded px-3 py-2 font-mono font-bold">
                    {referralData.code}
                  </code>
                  <Button variant="outline" size="icon" onClick={copyReferralCode}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vouchers */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <Gift className="h-5 w-5 text-purple-600" />
                {t.vouchers}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {vouchers.map(voucher => (
                <div key={voucher.id} className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg mb-3 last:mb-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <Gift className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-900">{voucher.title}</p>
                    <p className="text-xs text-slate-500">{voucher.condition}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span className="text-xs text-slate-400">Expires: {voucher.expiry}</span>
                    </div>
                  </div>
                  <Badge className={voucher.status === 'New' ? 'bg-green-500' : 'bg-blue-500'}>
                    {voucher.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

Dashboard.propTypes = {
  language: PropTypes.oneOf(["en", "ar"])
};