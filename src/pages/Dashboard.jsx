import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Zap,
  HelpCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { useUserReadiness } from "@/components/hooks/useUserReadiness";
import PullToRefresh from "@/components/ui/PullToRefresh";

// Dashboard voucher data (inline to avoid missing dependency)
const DASHBOARD_VOUCHERS = [
  { 
    id: 'welcome', 
    title: { en: '10% Fee Discount', ar: 'خصم 10% على الرسوم' },
    condition: { en: 'Complete KYC verification', ar: 'أكمل التحقق من الهوية' },
    status: 'New'
  },
  { 
    id: 'first_trade', 
    title: { en: '$5 Trading Bonus', ar: 'مكافأة تداول $5' },
    condition: { en: 'Execute your first trade', ar: 'نفذ أول صفقة' },
    status: 'Locked'
  }
];

const pickLang = (lang, obj) => (obj && typeof obj === 'object') ? (obj[lang] || obj.en || '') : (obj || '');

const translations = {
  en: {
    title: "Trading Dashboard",
    subtitle: "Your complete financial overview",
    quickActions: "Quick Actions",
    deposit: "Deposit",
    transfer: "Transfer",
    rewards: "Rewards",
    portfolio: "Portfolio",
    performance: "Performance",
    today: "Today",
    viewReport: "View Report",
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
    quickActions: "إجراءات سريعة",
    deposit: "إيداع",
    transfer: "تحويل",
    rewards: "المكافآت",
    portfolio: "المحفظة",
    performance: "الأداء",
    today: "اليوم",
    viewReport: "عرض التقرير",
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

const StatCard = ({ title, value, animatedValue, formatValue, change = undefined, icon: Icon, accent, accentBg, emphasis = false, className = "" }) => (
  <div className={`group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card/80 via-card/70 to-card/80 p-4 sm:p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${emphasis ? "border-primary/25 bg-gradient-to-br from-primary/10 via-card/70 to-cyan-500/10" : ""} ${className}`}>
    <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
      <div className="absolute -right-12 -top-10 h-24 w-24 rounded-full bg-primary/15 blur-2xl" />
    </div>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">{title}</p>
        <p className={`font-semibold text-foreground mt-1 sm:mt-2 truncate ${emphasis ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"}`}>
          {animatedValue !== undefined && formatValue ? (
            <AnimatedNumber value={animatedValue} format={formatValue} />
          ) : (
            value
          )}
        </p>
        {change !== undefined && (
          <div className={`flex items-center gap-1 mt-1 sm:mt-2 text-xs sm:text-sm font-medium ${change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {change >= 0 ? <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4" /> : <ArrowDownRight className="h-3 w-3 sm:h-4 sm:w-4" />}
            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
          </div>
        )}
      </div>
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${accentBg} flex items-center justify-center flex-shrink-0 ${emphasis ? "shadow-lg shadow-primary/20" : ""}`}>
        <Icon className={`h-4 w-4 sm:h-6 sm:w-6 ${accent}`} />
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

const AnimatedNumber = ({ value, format }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    const startValue = prevValue.current;
    const endValue = value;

    if (!Number.isFinite(startValue) || !Number.isFinite(endValue)) {
      setDisplayValue(endValue);
      prevValue.current = endValue;
      return;
    }

    const duration = 700;
    const startTime = performance.now();
    let frameId = null;

    const tick = (now) => {
      const elapsed = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      const nextValue = startValue + (endValue - startValue) * eased;
      setDisplayValue(nextValue);
      if (elapsed < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        prevValue.current = endValue;
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [value]);

  return <span aria-live="polite">{format(displayValue)}</span>;
};

const Sparkline = ({ data }) => {
  const width = 320;
  const height = 90;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((point - min) / range) * height;
    return [x, y];
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point[0].toFixed(2)},${point[1].toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
      <defs>
        <linearGradient id="portfolioLine" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(190 90% 45%)" />
        </linearGradient>
        <linearGradient id="portfolioFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary) / 0.35)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#portfolioFill)" />
      <path d={linePath} fill="none" stroke="url(#portfolioLine)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
};

export default function Dashboard({ language = "en" }) {
  const t = translations[language] || translations.en;
  const { user, isAuthenticated } = useAuth();
  const { nextAction, loading: loadingReadiness } = useUserReadiness({ enabled: isAuthenticated });
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

  const portfolioSeries = useMemo(() => [42, 46, 44, 52, 49, 58, 63, 60, 66, 72, 68, 75], []);
  const portfolioChange = useMemo(() => {
    const first = portfolioSeries[0] || 0;
    const last = portfolioSeries[portfolioSeries.length - 1] || 0;
    if (!first) return 0;
    return ((last - first) / first) * 100;
  }, [portfolioSeries]);

  const quickActions = useMemo(() => [
    {
      label: t.trade,
      icon: Zap,
      href: createPageUrl("Futures"),
      variant: "gradient-primary",
    },
    {
      label: t.deposit,
      icon: ArrowDownRight,
      href: `${createPageUrl("Wallet")}?page=deposit`,
      variant: "outline-glow",
    },
    {
      label: t.transfer,
      icon: ArrowUpRight,
      href: `${createPageUrl("Wallet")}?page=overview`,
      variant: "glass",
    },
    {
      label: t.rewards,
      icon: Gift,
      href: createPageUrl("Rewards"),
      variant: "glass",
    },
  ], [t, language]);

  const loadDashboardData = useCallback(async () => {
    logActivity('LOAD_DASHBOARD', { status: 'started' });
    setLoading(true);
    
    try {
      // Fetch data in parallel - use .catch() for each to prevent one failure from blocking others
      const [walletsRes, tradesRes, stakingRes, okxRes, copyTradingRes] = await Promise.all([
        base44.functions.invoke('wallet', { action: 'list' }).catch(() => ({ data: { success: false } })),
        base44.functions.invoke('tradingAccount', { action: 'getTrades' }).catch(() => ({ data: { success: false } })),
        base44.functions.invoke('wallet', { action: 'getStakingPositions' }).catch(() => ({ data: { success: false } })),
        base44.functions.invoke('okxUserAccount', { action: 'getMyAccount' }).catch(() => ({ data: { ok: false } })),
        base44.functions.invoke('copyTradingUser', { action: 'getWallet' }).catch(() => ({ data: { ok: false } }))
      ]);

      const nextWallets = walletsRes.data?.success ? (walletsRes.data.data || []) : [];
      setWallets(nextWallets);

      // OKX balance
      const okxData = okxRes.data?.ok ? okxRes.data.data : null;
      const okxBalance = okxData?.hasAccount ? (okxData.balances?.totalEquity || okxData.balances?.totalUsdt || 0) : 0;
      
      if (okxData?.hasAccount) {
        setLiveAccount({ hasAccount: true, ...okxData });
      }

      // Copy Trading balance
      const copyTradingData = copyTradingRes.data?.ok ? copyTradingRes.data.data : null;
      const copyTradingAvailable = copyTradingData?.available_balance || 0;
      const copyTradingLocked = copyTradingData?.locked_balance || 0;
      const copyTradingTotal = copyTradingAvailable + copyTradingLocked;

      const usdtWallets = nextWallets.filter((w) => (w.currency || '').toUpperCase() === 'USDT');
      const spot = sum(usdtWallets.map((w) => w.balance));
      const locked = sum(usdtWallets.map((w) => w.locked_balance || 0));
      const staked = sum(usdtWallets.map((w) => w.staked_balance || 0));

      setBalanceData({
        total: spot + locked + staked + okxBalance + copyTradingTotal,
        available: Math.max(0, spot - locked) + okxBalance + copyTradingAvailable, // Including CT available to match user expectations
        inPositions: locked + staked + copyTradingLocked
      });

      const allTrades = tradesRes.data?.success ? (tradesRes.data.data || []) : [];

      // If user has OKX account, fetch OKX positions (already have positions from getMyAccount if needed)
      let okxPositions = [];
      if (okxData?.hasAccount && okxData?.positionCount > 0) {
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
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 text-foreground pb-20 md:pb-8" dir={language === "ar" ? "rtl" : "ltr"}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 md:space-y-8">
        {/* Header - Mobile Optimized */}
        <Card variant="gradient" className="border-border/60">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="eyebrow">{language === "ar" ? "نظرة عامة" : "Overview"}</p>
                <h1 className="page-title mt-3">{t.title}</h1>
                <p className="body-text mt-2">{t.subtitle}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="glass"
                  size="icon"
                  className="h-11 w-11 rounded-xl"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button 
                  asChild={!!nextAction?.route} 
                  disabled={loadingReadiness}
                  variant="gradient-primary"
                  className="h-11 rounded-xl"
                >
                  {nextAction?.route ? (
                    <Link to={nextAction.route} className="flex items-center justify-center gap-2 px-4">
                      <Zap className="h-5 w-5" />
                      <span className="font-semibold">{nextAction.label?.[language] || t.trade}</span>
                    </Link>
                  ) : (
                    <span className="flex items-center justify-center gap-2 px-4">
                      <Zap className="h-5 w-5" />
                      <span className="font-semibold">{t.trade}</span>
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balance Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          <StatCard 
            title={t.totalBalance} 
            value={`$${formatMoney(balanceData.total)}`}
            animatedValue={balanceData.total}
            formatValue={(v) => `$${formatMoney(v)}`}
            icon={Wallet}
            accent="text-blue-600"
            accentBg="bg-blue-500/10"
            emphasis
            className="lg:col-span-2"
          />
          <StatCard 
            title={t.available} 
            value={`$${formatMoney(balanceData.available)}`}
            animatedValue={balanceData.available}
            formatValue={(v) => `$${formatMoney(v)}`}
            icon={CheckCircle}
            accent="text-emerald-600"
            accentBg="bg-emerald-500/10"
          />
          <StatCard 
            title={t.inPositions} 
            value={`$${formatMoney(balanceData.inPositions)}`}
            animatedValue={balanceData.inPositions}
            formatValue={(v) => `$${formatMoney(v)}`}
            icon={Activity}
            accent="text-purple-600"
            accentBg="bg-purple-500/10"
          />
          <StatCard 
            title={t.dailyPnl} 
            value={`$${formatMoney(pnlData.daily)}`}
            animatedValue={pnlData.daily}
            formatValue={(v) => `$${formatMoney(v)}`}
            change={pnlData.daily !== 0 ? (pnlData.daily / Math.max(1, balanceData.total)) * 100 : undefined}
            icon={TrendingUp}
            accent="text-cyan-600"
            accentBg="bg-cyan-500/10"
            emphasis
            className="lg:col-span-2"
          />
        </div>

        {/* Quick Actions + Portfolio */}
        <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
          <Card variant="glass" className="lg:col-span-1 overflow-hidden">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-base font-semibold">{t.quickActions}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    asChild
                    variant={action.variant}
                    className="h-12 rounded-xl text-xs sm:text-sm"
                  >
                    <Link to={action.href} className="flex items-center justify-center gap-2">
                      <action.icon className="h-4 w-4" />
                      <span className="font-semibold">{action.label}</span>
                    </Link>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card variant="gradient" className="lg:col-span-2 overflow-hidden">
            <CardHeader className="border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="section-title text-foreground">{t.portfolio}</CardTitle>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mt-1">{t.performance}</p>
                </div>
                <Button variant="outline-glow" size="sm" asChild>
                  <Link to={createPageUrl("Wallet")}>{t.viewReport}</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="grid sm:grid-cols-[1.2fr,2fr] gap-4 sm:gap-6 items-center">
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t.totalBalance}</p>
                  <div className="text-2xl sm:text-3xl font-semibold text-foreground">
                    <AnimatedNumber value={balanceData.total} format={(v) => `$${formatMoney(v)}`} />
                  </div>
                  <div className={`text-sm font-semibold ${portfolioChange >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {portfolioChange >= 0 ? "+" : ""}{portfolioChange.toFixed(2)}% {t.today}
                  </div>
                </div>
                <div className="h-24 sm:h-28 w-full">
                  <Sparkline data={portfolioSeries} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* PnL Statistics - Compact Mobile */}
        <Card variant="solid" className="overflow-hidden">
          <CardHeader className="border-b border-border/50 py-4 bg-muted/20">
            <CardTitle className="text-base font-semibold">{t.pnl}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: t.dailyPnl, value: pnlData.daily },
                { label: t.weeklyPnl, value: pnlData.weekly },
                { label: t.monthlyPnl, value: pnlData.monthly },
                { label: t.totalPnl, value: pnlData.total }
              ].map((item, i) => (
                <div key={i} className="text-center p-2 sm:p-3 rounded-xl bg-muted/30 border border-border/40">
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-1 truncate">{item.label}</p>
                  <p className={`text-sm sm:text-xl font-bold font-mono truncate ${item.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {item.value >= 0 ? '+' : ''}{formatMoney(item.value)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Positions & Orders - Mobile Cards */}
        <div className="grid lg:grid-cols-2 gap-6 md:gap-8">
          {/* Open Positions */}
          <Card variant="solid" className="overflow-hidden">
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
          <Card variant="solid" className="overflow-hidden">
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

        {/* Quick Actions - Help Center */}
        <Card variant="gradient" className="rounded-2xl">
        <CardContent className="flex items-center justify-between p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <HelpCircle className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{language === 'ar' ? 'تحتاج مساعدة؟' : 'Need Help?'}</h3>
              <p className="text-xs text-muted-foreground">{language === 'ar' ? 'اطلع على أدلة البدء والأسئلة الشائعة' : 'Check our guides and FAQs'}</p>
            </div>
          </div>
          <Button asChild variant="outline" className="rounded-xl">
            <Link to={createPageUrl("Help")}>
              {language === 'ar' ? 'مركز المساعدة' : 'Help Center'}
            </Link>
          </Button>
        </CardContent>
        </Card>

        {/* Referrals & Vouchers */}
        <div className="grid lg:grid-cols-2 gap-6 md:gap-8">
          {/* Referral Program */}
          <Card variant="solid" className="overflow-hidden">
            <CardHeader className="border-b border-border/50 py-3 sm:py-4 bg-muted/20">
              <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
                </div>
                <span className="truncate">{t.referrals}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
                {[
                  { value: '0', label: language === 'ar' ? 'الإجمالي' : 'Total', color: 'text-foreground' },
                  { value: '0', label: language === 'ar' ? 'نشط' : 'Active', color: 'text-emerald-400' },
                  { value: '$0', label: language === 'ar' ? 'العمولة' : 'Earned', color: 'text-blue-400' }
                ].map((stat, i) => (
                  <div key={i} className="text-center p-2 sm:p-3 rounded-xl bg-muted/30 border border-border/40">
                    <p className={`text-base sm:text-xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase truncate">{stat.label}</p>
                  </div>
                ))}
              </div>
              
              <div className="rounded-xl bg-muted/30 border border-border/40 p-2 sm:p-3 space-y-2">
                <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase mb-1 sm:mb-2">{language === 'ar' ? 'كود الإحالة' : 'Referral Code'}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 bg-background border border-border rounded-lg px-2 sm:px-3 py-2 font-mono font-bold text-xs sm:text-sm truncate">
                    {referralCode || '—'}
                  </code>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg flex-shrink-0"
                    onClick={copyReferralCode} 
                    disabled={!referralCode}
                  >
                    <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </div>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground line-clamp-2">{t.referralHint}</p>
              </div>
            </CardContent>
          </Card>

          {/* Vouchers */}
          <Card variant="solid" className="overflow-hidden">
            <CardHeader className="border-b border-border/50 py-3 sm:py-4 bg-muted/20">
              <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                  <Gift className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-500" />
                </div>
                <span className="truncate">{t.vouchers}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3">
              {vouchers.length === 0 ? (
                <div className="py-4 sm:py-6 text-center space-y-2">
                  <Gift className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-muted-foreground/40" />
                  <p className="text-xs sm:text-sm text-muted-foreground px-2">{t.voucherHint}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {vouchers.map(voucher => (
                  <div key={voucher.id} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                      <Gift className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-xs sm:text-sm truncate">{pickLang(language, voucher.title)}</p>
                      <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">{pickLang(language, voucher.condition)}</p>
                    </div>
                    <Badge className={`flex-shrink-0 text-[10px] sm:text-xs ${voucher.status === 'New' ? 'bg-emerald-500' : 'bg-blue-500'}`}>
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
    </PullToRefresh>
  );
}

Dashboard.propTypes = {
  language: PropTypes.oneOf(["en", "ar"])
};