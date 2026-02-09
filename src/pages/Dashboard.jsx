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

// Dashboard voucher data
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
    monthlyPnl: "الشهري",
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

const StatCard = ({ title, value, change = undefined, icon: Icon, accent, accentBg, emphasis = false, className = "" }) => (
  <Card className={`overflow-hidden border-border/40 bg-card/50 backdrop-blur-md transition-all duration-300 hover:shadow-md ${emphasis ? "border-primary/20 bg-gradient-to-br from-primary/5 to-transparent" : ""} ${className}`}>
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
          <p className={`font-bold tracking-tight text-foreground ${emphasis ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"}`}>{value}</p>
          {change !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-bold ${change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </div>
          )}
        </div>
        <div className={`p-2.5 rounded-xl ${accentBg} border border-border/40`}>
          <Icon className={`h-5 w-5 ${accent}`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

const PositionCard = ({ position, language }) => {
  const pnl = safeNumber(position.unrealized_pnl ?? position.pnl);
  const isProfit = pnl >= 0;
  const SideIcon = position.side === 'LONG' ? TrendingUp : TrendingDown;
  
  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-4 hover:bg-card/50 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${position.side === 'LONG' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
            <SideIcon className={`h-4 w-4 ${position.side === 'LONG' ? 'text-emerald-500' : 'text-rose-500'}`} />
          </div>
          <div>
            <span className="font-bold text-foreground">{position.symbol}</span>
            <Badge variant="outline" className={`ml-2 text-[10px] border-none ${
              position.side === 'LONG' 
                ? 'bg-emerald-500/10 text-emerald-500' 
                : 'bg-rose-500/10 text-rose-500'
            }`}>
              {position.side}
            </Badge>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{language === 'ar' ? 'الحجم' : 'Size'}</div>
          <div className="font-mono text-sm font-semibold">{formatNum(position.quantity, 4)}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{language === 'ar' ? 'الدخول' : 'Entry'}</div>
          <div className="font-mono text-sm font-semibold">${formatNum(position.entry_price, 2)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{language === 'ar' ? 'الربح' : 'PnL'}</div>
          <div className={`font-mono text-sm font-bold ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
            {isProfit ? '+' : ''}{formatNum(pnl, 2)}
          </div>
        </div>
      </div>
    </div>
  );
};

const OrderCard = ({ order, language: _language }) => {
  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground">{order.symbol}</span>
          <Badge variant="outline" className="text-[10px] border-border/40">{order.order_type || 'LIMIT'}</Badge>
        </div>
        <Badge variant="outline" className={`text-[10px] border-none ${
          order.side === 'LONG' || order.side === 'BUY'
            ? 'bg-emerald-500/10 text-emerald-500'
            : 'bg-rose-500/10 text-rose-500'
        }`}>
          {order.side}
        </Badge>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="font-mono text-muted-foreground">
          {order.quantity && <span>{formatNum(order.quantity, 4)}</span>}
          {order.limit_price && <span className="ml-2">@ ${formatNum(order.limit_price, 2)}</span>}
        </div>
        <span className="text-[10px] font-medium text-muted-foreground/60">
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

const formatNum = (v, digits = 2) => {
  const n = safeNumber(v);
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export default function Dashboard({ language = "en" }) {
  const t = translations[language] || translations.en;
  const { user, isAuthenticated } = useAuth();
  const { nextAction, loading: loadingReadiness } = useUserReadiness({ enabled: isAuthenticated });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [balanceData, setBalanceData] = useState({ total: 0, available: 0, inPositions: 0 });
  const [pnlData, setPnlData] = useState({ daily: 0, weekly: 0, monthly: 0, total: 0 });
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  
  const vouchers = DASHBOARD_VOUCHERS;

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [okxRes, tradesRes] = await Promise.all([
        base44.functions.invoke("okxUserAccount", { action: "getMyAccount" }).catch(() => ({ data: { ok: false } })),
        base44.entities.Trade.filter({ user_id: user.id }, '-opened_at', 50)
      ]);

      if (okxRes.data?.ok) {
        const b = okxRes.data.data.balances || {};
        setBalanceData({
          total: b.totalEquity || 0,
          available: b.fundingUsdt || 0,
          inPositions: b.tradingUsdt || 0
        });
        setPositions(okxRes.data.data.positions || []);
        setOrders(okxRes.data.data.orders || []);
      }

      if (tradesRes) {
        const closed = tradesRes.filter(t => t.status === 'CLOSED');
        const totalPnl = closed.reduce((acc, t) => acc + (t.pnl || 0), 0);
        setPnlData(prev => ({ ...prev, total: totalPnl }));
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isAuthenticated) loadDashboardData();
  }, [isAuthenticated, loadDashboardData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-background pb-20 pt-4 sm:pt-8" dir={language === "ar" ? "rtl" : "ltr"}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">{t.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh} 
                disabled={refreshing}
                className="rounded-lg border-border/40 h-9"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {t.refresh}
              </Button>
              <Button asChild size="sm" className="rounded-lg h-9 px-6">
                <Link to={createPageUrl("Futures")}>
                  <Zap className="h-3.5 w-3.5 mr-2 fill-current" />
                  {t.trade}
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              title={t.totalBalance} 
              value={`$${formatNum(balanceData.total)}`} 
              icon={Wallet} 
              accent="text-primary" 
              accentBg="bg-primary/10"
              emphasis
            />
            <StatCard 
              title={t.totalPnl} 
              value={`$${formatNum(pnlData.total)}`} 
              change={pnlData.total > 0 ? 2.5 : -1.2}
              icon={Activity} 
              accent="text-blue-500" 
              accentBg="bg-blue-500/10"
            />
            <StatCard 
              title={t.available} 
              value={`$${formatNum(balanceData.available)}`} 
              icon={Clock} 
              accent="text-amber-500" 
              accentBg="bg-amber-500/10"
            />
            <StatCard 
              title={t.inPositions} 
              value={`$${formatNum(balanceData.inPositions)}`} 
              icon={TrendingUp} 
              accent="text-purple-500" 
              accentBg="bg-purple-500/10"
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Main Content: Positions & Orders */}
            <div className="lg:col-span-2 space-y-8">
              {/* Positions */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    {t.positions}
                  </h2>
                  {positions.length > 0 && (
                    <Button variant="ghost" size="sm" asChild className="text-xs font-bold text-primary hover:text-primary hover:bg-primary/5">
                      <Link to={createPageUrl("Futures")}>{t.viewAll}</Link>
                    </Button>
                  )}
                </div>
                
                {loading ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Skeleton className="h-32 rounded-xl" />
                    <Skeleton className="h-32 rounded-xl" />
                  </div>
                ) : positions.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {positions.map((pos, i) => (
                      <PositionCard key={i} position={pos} language={language} />
                    ))}
                  </div>
                ) : (
                  <Card className="border-dashed border-border/60 bg-transparent">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="p-4 rounded-full bg-muted/30 mb-4">
                        <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                      <p className="font-bold text-foreground">{t.noPositions}</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-[200px]">{t.positionsHint}</p>
                    </CardContent>
                  </Card>
                )}
              </section>

              {/* Orders */}
              <section className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t.orders}
                </h2>
                {loading ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Skeleton className="h-24 rounded-xl" />
                    <Skeleton className="h-24 rounded-xl" />
                  </div>
                ) : orders.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {orders.map((order, i) => (
                      <OrderCard key={i} order={order} language={language} />
                    ))}
                  </div>
                ) : (
                  <Card className="border-dashed border-border/60 bg-transparent">
                    <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                      <p className="font-bold text-foreground">{t.noOrders}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t.ordersHint}</p>
                    </CardContent>
                  </Card>
                )}
              </section>
            </div>

            {/* Sidebar: Referrals & Vouchers */}
            <div className="space-y-8">
              {/* Referrals */}
              <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    {t.referrals}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{t.referralHint}</p>
                  <div className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Your Code</span>
                      <span className="font-mono font-bold text-foreground">NEXT-782</span>
                    </div>
                    <Button variant="outline" size="sm" className="w-full rounded-lg border-border/40 h-8 text-xs">
                      <Copy className="h-3 w-3 mr-2" /> Copy Link
                    </Button>
                  </div>
                  <Button asChild variant="secondary" className="w-full rounded-lg h-9 text-xs font-bold">
                    <Link to={createPageUrl("Rewards")}>View Rewards Hub</Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Vouchers */}
              <section className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  {t.vouchers}
                </h2>
                <div className="space-y-3">
                  {vouchers.map((v) => (
                    <div key={v.id} className="p-4 rounded-xl border border-border/40 bg-card/30 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate text-foreground">{pickLang(language, v.title)}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{pickLang(language, v.condition)}</p>
                      </div>
                      <Badge variant={v.status === 'New' ? 'default' : 'secondary'} className="text-[10px] font-bold rounded-md px-2 py-0.5">
                        {v.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </section>

              {/* Help Card */}
              <Card className="bg-muted/30 border-border/40">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-background border border-border/40">
                    <HelpCircle className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">Need Help?</p>
                    <p className="text-xs text-muted-foreground">Check our trading guides</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PullToRefresh>
  );
}

Dashboard.propTypes = {
  language: PropTypes.oneOf(["en", "ar"])
};
