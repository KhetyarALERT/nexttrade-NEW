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
import { DASHBOARD_VOUCHERS, pickLang } from "@/lib/rewards-config";
import { useAuth } from "@/lib/AuthContext";

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
  <Card className="border-border shadow-sm">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
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

const safeNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const sum = (arr) => arr.reduce((acc, n) => acc + safeNumber(n), 0);

const formatMoney = (v) => {
  const n = safeNumber(v);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function Dashboard({ language = "en" }) {
  const t = translations[language] || translations.en;
  const { user } = useAuth();
  const [_loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [balanceData, setBalanceData] = useState({
    total: 0,
    available: 0,
    inPositions: 0
  });
  
  const [pnlData, setPnlData] = useState({ daily: 0, weekly: 0, monthly: 0, total: 0 });
  
  const [positions, setPositions] = useState([]); // tradingAccount OPEN
  const [orders, setOrders] = useState([]); // tradingAccount PENDING
  const [, setWallets] = useState([]);
  const [, setStakingPositions] = useState([]);
  const [, setLiveAccount] = useState(null);
  
  const vouchers = DASHBOARD_VOUCHERS;

  const loadDashboardData = useCallback(async () => {
    logActivity('LOAD_DASHBOARD', { status: 'started' });
    setLoading(true);
    
    try {
      // Use the same sources as Profile: tradingAccount + wallet + staking.
      const [liveRes, walletsRes, tradesRes, stakingRes] = await Promise.all([
        base44.functions.invoke('tradingAccount', { action: 'getOrCreate', accountType: 'live' }),
        base44.functions.invoke('wallet', { action: 'list' }),
        base44.functions.invoke('tradingAccount', { action: 'getTrades' }),
        base44.functions.invoke('wallet', { action: 'getStakingPositions' })
      ]);

      if (liveRes.data?.success) setLiveAccount(liveRes.data.data);

      const nextWallets = walletsRes.data?.success ? (walletsRes.data.data || []) : [];
      setWallets(nextWallets);

      const usdtWallets = nextWallets.filter((w) => (w.currency || '').toUpperCase() === 'USDT');
      const spot = sum(usdtWallets.map((w) => w.balance));
      const locked = sum(usdtWallets.map((w) => w.locked_balance || 0));
      const staked = sum(usdtWallets.map((w) => w.staked_balance || 0));

      // Backend semantics: staking reduces `balance` and increases `staked_balance`.
      // So available is balance minus locked only (NOT minus staked).
      setBalanceData({
        total: spot + locked + staked,
        available: Math.max(0, spot - locked),
        inPositions: locked + staked
      });

      const allTrades = tradesRes.data?.success ? (tradesRes.data.data || []) : [];
      const openTrades = allTrades.filter((tr) => tr.status === 'OPEN');
      const pendingTrades = allTrades.filter((tr) => tr.status === 'PENDING');

      setPositions(openTrades);
      setOrders(pendingTrades);
      logActivity('LOAD_TRADES', { open: openTrades.length, pending: pendingTrades.length });

      const nextStakingPositions = stakingRes.data?.success ? (stakingRes.data.data || []) : [];
      setStakingPositions(nextStakingPositions);

      const closedTrades = allTrades.filter((tr) => tr.status === 'CLOSED');
      const now = Date.now();
      const within = (iso, days) => {
        const t0 = new Date(iso || 0).getTime();
        if (!Number.isFinite(t0) || t0 <= 0) return false;
        return now - t0 <= days * 24 * 60 * 60 * 1000;
      };
      const tradePnl = (tr) => safeNumber(tr.realized_pnl ?? tr.pnl ?? 0);
      setPnlData({
        daily: sum(closedTrades.filter((tr) => within(tr.closed_at, 1)).map(tradePnl)),
        weekly: sum(closedTrades.filter((tr) => within(tr.closed_at, 7)).map(tradePnl)),
        monthly: sum(closedTrades.filter((tr) => within(tr.closed_at, 30)).map(tradePnl)),
        total: sum(closedTrades.map(tradePnl))
      });
      
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

  const referralCode = user?.referralCode || user?.referral_code || '';
  const referralLink = referralCode ? `https://nexttrade.app/ref/${referralCode}` : '';

  const copyReferralCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    logActivity('COPY_REFERRAL', { code: referralCode });
    toast.success(language === 'ar' ? 'تم نسخ كود الإحالة' : 'Referral code copied!');
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 pt-8" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t.title}</h1>
            <p className="text-muted-foreground mt-1">{t.subtitle}</p>
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
            value={`$${formatMoney(balanceData.total)}`}
            icon={Wallet}
            color="bg-gradient-to-br from-blue-600 to-blue-700"
          />
          <StatCard 
            title={t.available} 
            value={`$${formatMoney(balanceData.available)}`}
            icon={CheckCircle}
            color="bg-gradient-to-br from-green-500 to-green-600"
          />
          <StatCard 
            title={t.inPositions} 
            value={`$${formatMoney(balanceData.inPositions)}`}
            icon={Activity}
            color="bg-gradient-to-br from-purple-500 to-purple-600"
          />
          <StatCard 
            title={t.dailyPnl} 
            value={`$${formatMoney(pnlData.daily)}`}
            icon={TrendingUp}
            color="bg-gradient-to-br from-cyan-500 to-cyan-600"
          />
        </div>

        {/* PnL Statistics */}
        <Card className="mb-8 border-border shadow-sm">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg">{t.pnl}</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">{t.dailyPnl}</p>
                <p className={`text-xl font-bold ${pnlData.daily >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {pnlData.daily >= 0 ? '+' : ''}${formatMoney(pnlData.daily)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">{t.weeklyPnl}</p>
                <p className={`text-xl font-bold ${pnlData.weekly >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {pnlData.weekly >= 0 ? '+' : ''}${formatMoney(pnlData.weekly)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">{t.monthlyPnl}</p>
                <p className={`text-xl font-bold ${pnlData.monthly >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {pnlData.monthly >= 0 ? '+' : ''}${formatMoney(pnlData.monthly)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">{t.totalPnl}</p>
                <p className={`text-xl font-bold ${pnlData.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {pnlData.total >= 0 ? '+' : ''}${formatMoney(pnlData.total)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Positions & Orders */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Open Positions */}
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{t.positions}</CardTitle>
                <Badge variant="outline">{positions.length} Active</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {positions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
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
                        <TableCell>{safeNumber(pos.quantity).toLocaleString()}</TableCell>
                        <TableCell className={safeNumber(pos.unrealized_pnl) >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {safeNumber(pos.unrealized_pnl).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Recent Orders */}
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{t.orders}</CardTitle>
                <Button variant="ghost" size="sm" className="text-blue-600">
                  {t.viewAll}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {orders.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
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
                        <TableCell className="text-xs text-muted-foreground">{order.created_at ? new Date(order.created_at).toLocaleString() : '—'}</TableCell>
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
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                {t.referrals}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">0</p>
                  <p className="text-xs text-muted-foreground">{language === 'ar' ? 'الإجمالي' : 'Total'}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">0</p>
                  <p className="text-xs text-muted-foreground">{language === 'ar' ? 'نشط' : 'Active'}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">$0.00</p>
                  <p className="text-xs text-muted-foreground">{language === 'ar' ? 'العمولة' : 'Commission'}</p>
                </div>
              </div>
              
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-2">{language === 'ar' ? 'كود الإحالة' : 'Your Referral Code'}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background border border-border rounded px-3 py-2 font-mono font-bold">
                    {referralCode || '—'}
                  </code>
                  <Button variant="outline" size="icon" onClick={copyReferralCode} disabled={!referralCode}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {referralLink ? (
                  <p className="text-[11px] text-muted-foreground mt-2 break-all">{referralLink}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Vouchers */}
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg flex items-center gap-2">
                <Gift className="h-5 w-5 text-purple-600" />
                {t.vouchers}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {vouchers.map(voucher => (
                <div key={voucher.id} className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg mb-3 last:mb-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <Gift className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-foreground">{pickLang(language, voucher.title)}</p>
                    <p className="text-xs text-muted-foreground">{pickLang(language, voucher.condition)}</p>
                    {voucher.expiry ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{language === "ar" ? "ينتهي:" : "Expires:"} {voucher.expiry}</span>
                      </div>
                    ) : null}
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