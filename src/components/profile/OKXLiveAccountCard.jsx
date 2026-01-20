import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  RefreshCw, Wallet, TrendingUp, TrendingDown, 
  AlertCircle, CheckCircle2, ExternalLink, Activity 
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function OKXLiveAccountCard({ language = "en", onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [accountData, setAccountData] = useState(null);
  const [positions, setPositions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const t = {
    en: {
      title: "Live Trading Account",
      subtitle: "OKX Futures Account",
      noAccount: "No live account assigned",
      noAccountDesc: "Contact support to get a live trading account assigned to you.",
      balance: "Balance",
      equity: "Total Equity",
      tradingBalance: "Trading",
      fundingBalance: "Funding",
      positions: "Open Positions",
      noPositions: "No open positions",
      tradeNow: "Trade Now",
      refresh: "Refresh",
      active: "Active",
      lastSync: "Last sync",
      leverage: "Leverage",
      unrealizedPnl: "Unrealized P&L"
    },
    ar: {
      title: "حساب التداول المباشر",
      subtitle: "حساب OKX للعقود الآجلة",
      noAccount: "لا يوجد حساب مباشر",
      noAccountDesc: "تواصل مع الدعم للحصول على حساب تداول مباشر.",
      balance: "الرصيد",
      equity: "إجمالي الحقوق",
      tradingBalance: "التداول",
      fundingBalance: "التمويل",
      positions: "المراكز المفتوحة",
      noPositions: "لا توجد مراكز مفتوحة",
      tradeNow: "تداول الآن",
      refresh: "تحديث",
      active: "نشط",
      lastSync: "آخر مزامنة",
      leverage: "الرافعة",
      unrealizedPnl: "الربح غير المحقق"
    }
  }[language] || {};

  const loadAccount = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('okxUserAccount', { action: 'getMyAccount' });
      
      if (res.data?.ok && res.data.data?.hasAccount) {
        setAccountData(res.data.data);
        
        // Load positions
        const posRes = await base44.functions.invoke('okxUserAccount', { action: 'getPositions' });
        if (posRes.data?.ok) {
          setPositions(posRes.data.data || []);
        }
      } else {
        setAccountData(null);
      }
    } catch (err) {
      console.error('[OKXLiveAccountCard] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAccount();
    setRefreshing(false);
    toast.success(language === 'ar' ? 'تم التحديث' : 'Refreshed');
    if (onRefresh) onRefresh();
  };

  const formatUsdt = (val) => {
    if (val === null || val === undefined) return '0.00';
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totalUpl = positions.reduce((sum, p) => sum + (p.upl || 0), 0);

  if (loading) {
    return (
      <Card className="border-border shadow-lg rounded-2xl">
        <CardHeader className="border-b border-border bg-muted/30 p-5">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!accountData?.hasAccount) {
    return (
      <Card className="border-border shadow-lg rounded-2xl">
        <CardHeader className="border-b border-border bg-muted/30 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-md">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-foreground">{t.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{t.subtitle}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div className="text-center py-6">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">{t.noAccount}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.noAccountDesc}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-lg rounded-2xl overflow-hidden">
      <CardHeader className="border-b border-border bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-md">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-foreground">{t.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{accountData.accountLabel || accountData.externalAccountId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-700 border-0">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {t.active}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-5 space-y-4">
        {/* Balance Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-4">
            <p className="text-xs text-muted-foreground mb-1">{t.equity}</p>
            <p className="text-2xl font-bold text-foreground">
              ${formatUsdt(accountData.balances?.totalEquity || accountData.balances?.totalUsdt)}
            </p>
          </div>
          <div className="rounded-xl bg-muted/30 border border-border p-4">
            <p className="text-xs text-muted-foreground mb-1">{t.unrealizedPnl}</p>
            <p className={`text-2xl font-bold ${totalUpl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {totalUpl >= 0 ? '+' : ''}{formatUsdt(totalUpl)}
            </p>
          </div>
        </div>

        {/* Detailed Balances */}
        <div className="rounded-xl bg-muted/20 border border-border/50 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t.tradingBalance}</span>
            <span className="font-mono font-medium">${formatUsdt(accountData.balances?.tradingUsdt)} USDT</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t.fundingBalance}</span>
            <span className="font-mono font-medium">${formatUsdt(accountData.balances?.fundingUsdt)} USDT</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-border/50">
            <span className="text-muted-foreground">{t.leverage}</span>
            <span className="font-medium">{accountData.defaultLeverage || 10}x</span>
          </div>
        </div>

        {/* Positions */}
        {positions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              {t.positions} ({positions.length})
            </h4>
            <div className="space-y-2 max-h-40 overflow-auto">
              {positions.slice(0, 3).map((pos, idx) => (
                <div key={idx} className="rounded-lg bg-muted/30 border border-border/50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{pos.instId}</span>
                      <Badge className={`text-xs ${pos.posSide === 'long' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                        {pos.posSide === 'long' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        {pos.posSide?.toUpperCase()}
                      </Badge>
                    </div>
                    <span className={`text-sm font-mono font-medium ${pos.upl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {pos.upl >= 0 ? '+' : ''}{formatUsdt(pos.upl)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Size: {pos.size}</span>
                    <span>Entry: ${formatUsdt(pos.avgPx)}</span>
                    <span>{pos.lever}x</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button asChild className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl">
            <Link to={createPageUrl("Futures")}>
              <TrendingUp className="h-4 w-4 mr-2" />
              {t.tradeNow}
            </Link>
          </Button>
        </div>

        {/* Last Sync */}
        {accountData.lastSync && (
          <p className="text-xs text-muted-foreground text-center">
            {t.lastSync}: {new Date(accountData.lastSync).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

OKXLiveAccountCard.propTypes = {
  language: PropTypes.string,
  onRefresh: PropTypes.func
};