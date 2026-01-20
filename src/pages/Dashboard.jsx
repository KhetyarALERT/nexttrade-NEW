import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  Gift,
  Users,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
  CheckCircle,
  ChevronRight,
  Zap
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
    orders: "Pending Orders",
    referrals: "Referral Program",
    vouchers: "Available Vouchers",
    noPositions: "No open positions",
    noOrders: "No pending orders",
    refresh: "Refresh",
    trade: "Trade",
    viewAll: "View All",
    size: "Size",
    entry: "Entry",
    pnlLabel: "PnL",
    price: "Price",
    qty: "Qty",
    positionsHint: "Place your first trade to see open positions.",
    ordersHint: "Set a limit or trigger order to track it here.",
    referralHint: "Share your link to earn rewards when friends trade.",
    voucherHint: "Complete tasks to unlock vouchers for trading boosts."
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
    orders: "الأوامر المعلقة",
    referrals: "برنامج الإحالة",
    vouchers: "القسائم المتاحة",
    noPositions: "لا توجد مراكز مفتوحة",
    noOrders: "لا توجد أوامر معلقة",
    refresh: "تحديث",
    trade: "تداول",
    viewAll: "عرض الكل",
    size: "الحجم",
    entry: "الدخول",
    pnlLabel: "الربح",
    price: "السعر",
    qty: "الكمية",
    positionsHint: "نفّذ أول صفقة لرؤية المراكز المفتوحة.",
    ordersHint: "ضع أمرًا محددًا أو تفعيلًا لمتابعته هنا.",
    referralHint: "شارك رابطك لتكسب مكافآت عندما يتداول الأصدقاء.",
    voucherHint: "أكمل المهام لفتح قسائم تعزز التداول."
  }
};

const logActivity = (action, details) => {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, action, details, userId: 'current-user' };
  console.log(`[${timestamp}] [DASHBOARD] ${action}:`, details);
  const logs = JSON.parse(localStorage.getItem('dashboardLogs') || '[]');
  logs.push(logEntry);
  if (logs.length > 1000) logs.shift();
  localStorage.setItem('dashboardLogs', JSON.stringify(logs));
  return logEntry;
};

const StatCard = ({ title, value, change = undefined, icon: Icon, accent, accentBg, emphasis = false, className = "" }) => (
  <div className={`rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm transition-shadow hover:shadow-md ${emphasis ? "bg-gradient-to-br from-blue-500/10 via-transparent to-cyan-500/10 border-blue-500/20" : ""} ${className}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className={`font-semibold text-foreground mt-2 ${emphasis ? "text-3xl" : "text-2xl"}`}>{value}</p>
        {change !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {change >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
          </div>
        )}
      </div>
      <div className={`w-12 h-12 rounded-xl ${accentBg} flex items-center justify-center ${emphasis ? "shadow-lg shadow-blue-500/20" : ""}`}>
        <Icon className={`h-6 w-6 ${accent}`} />
      </div>
    </div>
  </div>
);

// Mobile-friendly Position Card
const PositionCard = ({ position, language }) => {
  const pnl = safeNumber(position.unrealized_pnl ?? position.pnl);
  const isProfit = pnl >= 0;
  const SideIcon = position.side === 'LONG' ? TrendingUp : TrendingDown;
  
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 hover:bg-card/80 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${position.side === 'LONG' ? 'bg-emerald-500/15' : 'bg-rose-500/15'}`}>
            <SideIcon className={`h-4 w-4 ${position.side === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`} />
          </div>
          <div>
            <span className="font-bold text-foreground">{position.symbol}</span>
            <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full font-medium ${
              position.side === 'LONG' 
                ? 'bg-emerald-500/15 text-emerald-400' 
                : 'bg-rose-500/15 text-rose-400'
            }`}>
              {position.side}
            </span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">{language === 'ar' ? 'الحجم' : 'Size'}</div>
          <div className="font-mono text-sm text-foreground">{formatNum(position.quantity, 4)}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">{language === 'ar' ? 'الدخول' : 'Entry'}</div>
          <div className="font-mono text-sm text-foreground">${formatNum(position.entry_price, 2)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground uppercase">{language === 'ar' ? 'الربح' : 'PnL'}</div>
          <div className={`font-mono text-sm font-semibold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isProfit ? '+' : ''}{formatNum(pnl, 2)}
          </div>
        </div>
      </div>
    </div>
  );
};

// Mobile-friendly Order Card
const OrderCard = ({ order, language: _language }) => {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground">{order.symbol}</span>
          <Badge variant="outline" className="text-[10px]">{order.order_type || 'LIMIT'}</Badge>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          order.side === 'LONG' || order.side === 'BUY'
            ? 'bg-emerald-500/15 text-emerald-400'
            : 'bg-rose-500/15 text-rose-400'
        }`}>
          {order.side}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          {order.quantity && <span className="font-mono">{formatNum(order.quantity, 4)}</span>}
          {order.limit_price && <span className="font-mono ml-2">@ ${formatNum(order.limit_price, 2)}</span>}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {order.created_at ? new Date(order.created_at).toLocaleDateString() : ''}
        </span>
      </div>
    </div>
  );
};

const safeNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const sum = (arr) => arr.reduce((acc, n) => acc + safeNumber(n), 0);

const formatMoney = (v) => {
  const n = safeNumber(v);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatNum = (v, digits = 2) => {
  const n = safeNumber(v);
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export default function Dashboard({ language = "en" }) {
  const t = translations[language] || translations.en;
  const { user } = useAuth();
  const [_loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [balanceData, setBalanceData] = useState({ total: 0, available: 0, inPositions: 0 });
  const [pnlData, setPnlData] = useState({ daily: 0, weekly: 0, monthly: 0, total: 0 });
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [, setWallets] = useState([]);
  const [, setStakingPositions] = useState([]);
  const [, setLiveAccount] = useState(null);
  
  const vouchers = DASHBOARD_VOUCHERS;

  const loadDashboardData = useCallback(async () => {
    logActivity('LOAD_DASHBOARD', { status: 'started' });
    setLoading(true);
    
    try {
      const [liveRes, walletsRes, tradesRes, stakingRes, okxRes] = await Promise.all([
        base44.functions.invoke('tradingAccount', { action: 'getOrCreate', accountType: 'live' }),
        base44.functions.invoke('wallet', { action: 'list' }),
        base44.functions.invoke('tradingAccount', { action: 'getTrades' }),
        base44.functions.invoke('wallet', { action: 'getStakingPositions' }),
        base44.functions.invoke('okxUserAccount', { action: 'getMyAccount' })
      ]);

      if (liveRes.data?.success) setLiveAccount(liveRes.data.data);

      const nextWallets = walletsRes.data?.success ? (walletsRes.data.data || []) : [];
      setWallets(nextWallets);

      // OKX balance
      const okxData = okxRes.data?.ok ? okxRes.data.data : null;
      const okxBalance = okxData?.hasAccount ? (okxData.balances?.totalEquity || okxData.balances?.totalUsdt || 0) : 0;

      const usdtWallets = nextWallets.filter((w) => (w.currency || '').toUpperCase() === 'USDT');
      const spot = sum(usdtWallets.map((w) => w.balance));
      const locked = sum(usdtWallets.map((w) => w.locked_balance || 0));
      const staked = sum(usdtWallets.map((w) => w.staked_balance || 0));

      setBalanceData({
        total: spot + locked + staked + okxBalance,
        available: Math.max(0, spot - locked) + okxBalance,
        inPositions: locked + staked
      });

      const allTrades = tradesRes.data?.success ? (tradesRes.data.data || []) : [];

      // If user has OKX account, fetch OKX positions
      let okxPositions = [];
      if (okxData?.hasAccount) {
        try {
          const posRes = await base44.functions.invoke('okxUserAccount', { action: 'getPositions' });
          if (posRes.data?.ok) {
            okxPositions = (posRes.data.data || []).map(p => ({
              id: `okx_${p.instId}_${p.posSide}`,
              symbol: p.instId,
              side: String(p.posSide || '').toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG',
              quantity: Math.abs(p.size || 0),
              entry_price: p.avgPx || 0,
              unrealized_pnl: p.upl || 0,
              leverage: p.lever || 0,
              status: 'OPEN',
              source: 'OKX'
            }));
          }
        } catch { /* ignore */ }
      }

      const openTrades = [...allTrades.filter((tr) => tr.status === 'OPEN'), ...okxPositions];
      const pendingTrades = allTrades.filter((tr) => tr.status === 'PENDING');

      setPositions(openTrades);
      setOrders(pendingTrades);
      logActivity('LOAD_TRADES', { open: openTrades.length, pending: pendingTrades.length, okxPositions: okxPositions.length });

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
  const _referralLink = referralCode ? `https://nexttrade.app/ref/${referralCode}` : '';

  const copyReferralCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    logActivity('COPY_REFERRAL', { code: referralCode });
    toast.success(language === 'ar' ? 'تم نسخ كود الإحالة' : 'Referral code copied!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 text-foreground pb-24" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header - Mobile Optimized */}
        <Card className="border-border/60 bg-card/70 shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{language === "ar" ? "نظرة عامة" : "Overview"}</p>
                <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mt-2">{t.title}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t.subtitle}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-11 w-11 rounded-xl"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button asChild className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
                  <Link to={createPageUrl("Futures")} className="flex items-center justify-center gap-2 px-4">
                    <Zap className="h-5 w-5" />
                    <span className="font-semibold">{t.trade}</span>
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balance Cards - Mobile Scroll */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard 
            title={t.totalBalance} 
            value={`$${formatMoney(balanceData.total)}`}
            icon={Wallet}
            accent="text-blue-600"
            accentBg="bg-blue-500/10"
            emphasis
            className="lg:col-span-2"
          />
          <StatCard 
            title={t.available} 
            value={`$${formatMoney(balanceData.available)}`}
            icon={CheckCircle}
            accent="text-emerald-600"
            accentBg="bg-emerald-500/10"
          />
          <StatCard 
            title={t.inPositions} 
            value={`$${formatMoney(balanceData.inPositions)}`}
            icon={Activity}
            accent="text-purple-600"
            accentBg="bg-purple-500/10"
          />
          <StatCard 
            title={t.dailyPnl} 
            value={`$${formatMoney(pnlData.daily)}`}
            change={pnlData.daily !== 0 ? (pnlData.daily / Math.max(1, balanceData.total)) * 100 : undefined}
            icon={TrendingUp}
            accent="text-cyan-600"
            accentBg="bg-cyan-500/10"
            emphasis
            className="lg:col-span-2"
          />
        </div>

        {/* PnL Statistics - Compact Mobile */}
        <Card className="border-border/50 shadow-sm bg-card/70 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-border/50 py-4 bg-muted/20">
            <CardTitle className="text-base font-semibold">{t.pnl}</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: t.dailyPnl, value: pnlData.daily },
                { label: t.weeklyPnl, value: pnlData.weekly },
                { label: t.monthlyPnl, value: pnlData.monthly },
                { label: t.totalPnl, value: pnlData.total }
              ].map((item, i) => (
                <div key={i} className="text-center p-3 rounded-xl bg-muted/30 border border-border/40">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{item.label}</p>
                  <p className={`text-lg sm:text-xl font-bold font-mono ${item.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {item.value >= 0 ? '+' : ''}{formatMoney(item.value)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Positions & Orders - Mobile Cards */}
        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Open Positions */}
          <Card className="border-border/50 shadow-sm bg-card/70 backdrop-blur-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/50 py-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">{t.positions}</CardTitle>
                <Badge variant="secondary" className="rounded-full px-2.5">
                  {positions.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
              {positions.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <Activity className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">{t.noPositions}</p>
                  <p className="text-xs text-muted-foreground">{t.positionsHint}</p>
                  <Button asChild size="sm" className="mt-2 bg-blue-600 hover:bg-blue-700">
                    <Link to={createPageUrl("Futures")}>{t.trade}</Link>
                  </Button>
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="lg:hidden space-y-3">
                    {positions.slice(0, 5).map((pos, i) => (
                      <PositionCard key={i} position={pos} language={language} />
                    ))}
                  </div>
                  
                  {/* Desktop Table View */}
                  <div className="hidden lg:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Side</TableHead>
                          <TableHead>{t.size}</TableHead>
                          <TableHead>{t.pnlLabel}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {positions.slice(0, 5).map((pos, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-bold">{pos.symbol}</TableCell>
                            <TableCell>
                              <Badge className={pos.side === 'LONG' ? 'bg-emerald-500' : 'bg-rose-500'}>
                                {pos.side}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">{formatNum(pos.quantity, 4)}</TableCell>
                            <TableCell className={`font-mono ${safeNumber(pos.unrealized_pnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {safeNumber(pos.unrealized_pnl) >= 0 ? '+' : ''}{formatNum(pos.unrealized_pnl, 2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Pending Orders */}
          <Card className="border-border/50 shadow-sm bg-card/70 backdrop-blur-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/50 py-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">{t.orders}</CardTitle>
                <Badge variant="secondary" className="rounded-full px-2.5">
                  {orders.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
              {orders.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">{t.noOrders}</p>
                  <p className="text-xs text-muted-foreground">{t.ordersHint}</p>
                  <Button asChild size="sm" variant="outline">
                    <Link to={createPageUrl("Futures")}>{t.trade}</Link>
                  </Button>
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="lg:hidden space-y-3">
                    {orders.slice(0, 5).map((order, i) => (
                      <OrderCard key={i} order={order} language={language} />
                    ))}
                  </div>
                  
                  {/* Desktop Table View */}
                  <div className="hidden lg:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Side</TableHead>
                          <TableHead>{t.price}</TableHead>
                          <TableHead>{t.qty}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.slice(0, 5).map((order, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-bold">{order.symbol}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{order.side}</Badge>
                            </TableCell>
                            <TableCell className="font-mono">{formatNum(order.limit_price, 2)}</TableCell>
                            <TableCell className="font-mono">{formatNum(order.quantity, 4)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Referrals & Vouchers */}
        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Referral Program */}
          <Card className="border-border/50 shadow-sm bg-card/70 backdrop-blur-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/50 py-4 bg-muted/20">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                  <Users className="h-4 w-4 text-blue-500" />
                </div>
                {t.referrals}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { value: '0', label: language === 'ar' ? 'الإجمالي' : 'Total', color: 'text-foreground' },
                  { value: '0', label: language === 'ar' ? 'نشط' : 'Active', color: 'text-emerald-400' },
                  { value: '$0', label: language === 'ar' ? 'العمولة' : 'Earned', color: 'text-blue-400' }
                ].map((stat, i) => (
                  <div key={i} className="text-center p-3 rounded-xl bg-muted/30 border border-border/40">
                    <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{stat.label}</p>
                  </div>
                ))}
              </div>
              
              <div className="rounded-xl bg-muted/30 border border-border/40 p-3 space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase mb-2">{language === 'ar' ? 'كود الإحالة' : 'Referral Code'}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 font-mono font-bold text-sm">
                    {referralCode || '—'}
                  </code>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="h-10 w-10 rounded-lg shrink-0"
                    onClick={copyReferralCode} 
                    disabled={!referralCode}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">{t.referralHint}</p>
              </div>
            </CardContent>
          </Card>

          {/* Vouchers */}
          <Card className="border-border/50 shadow-sm bg-card/70 backdrop-blur-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/50 py-4 bg-muted/20">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                  <Gift className="h-4 w-4 text-purple-500" />
                </div>
                {t.vouchers}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {vouchers.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <Gift className="h-10 w-10 mx-auto text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">{t.voucherHint}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {vouchers.map(voucher => (
                  <div key={voucher.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
                      <Gift className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{pickLang(language, voucher.title)}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{pickLang(language, voucher.condition)}</p>
                    </div>
                    <Badge className={`shrink-0 ${voucher.status === 'New' ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                      {voucher.status}
                    </Badge>
                  </div>
                  ))}
                </div>
              )}
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