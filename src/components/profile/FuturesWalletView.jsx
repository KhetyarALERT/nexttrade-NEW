import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Search, RefreshCw, ArrowLeftRight, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import CryptoIcon from "@/components/ui/CryptoIcon";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function FuturesWalletView({
  showBalances = true,
  onTransfer,
  onRefresh,
  language = 'en'
}) {
  const t = language === 'ar' ? {
    title: 'حساب العقود الآجلة',
    subtitle: 'OKX Perpetual Futures',
    totalEquity: 'إجمالي الحقوق',
    tradingBalance: 'رصيد التداول',
    fundingBalance: 'رصيد التمويل',
    unrealizedPnl: 'الربح غير المحقق',
    availableMargin: 'الهامش المتاح',
    leverage: 'الرافعة',
    transfer: 'تحويل',
    search: 'بحث',
    hideSmall: 'إخفاء الأصول < 1 USD',
    noAccount: 'لا يوجد حساب تداول مباشر',
    noAccountDesc: 'يرجى التواصل مع الدعم للحصول على حساب.',
    positions: 'المراكز المفتوحة',
    noPositions: 'لا توجد مراكز مفتوحة',
    tradeNow: 'تداول الآن',
    refresh: 'تحديث',
    active: 'نشط',
    lastSync: 'آخر مزامنة'
  } : {
    title: 'Perpetual Account',
    subtitle: 'OKX Perpetual Futures',
    totalEquity: 'Total Equity',
    tradingBalance: 'Trading Balance',
    fundingBalance: 'Funding Balance',
    unrealizedPnl: 'Unrealized P&L',
    availableMargin: 'Available Margin',
    leverage: 'Leverage',
    transfer: 'Transfer',
    search: 'Search',
    hideSmall: 'Hide assets < 1 USD',
    noAccount: 'No live trading account',
    noAccountDesc: 'Contact support to get a live account assigned.',
    positions: 'Open Positions',
    noPositions: 'No open positions',
    tradeNow: 'Trade Now',
    refresh: 'Refresh',
    active: 'Active',
    lastSync: 'Last sync'
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accountData, setAccountData] = useState(null);
  const [positions, setPositions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [hideSmallAssets, setHideSmallAssets] = useState(false);

  const loadAccountData = useCallback(async () => {
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
      console.error('[FuturesWalletView] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccountData();
  }, [loadAccountData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAccountData();
    setRefreshing(false);
    if (onRefresh) onRefresh();
  };

  const formatValue = (val) => {
    if (!showBalances) return "****";
    if (val === null || val === undefined) return "0.00";
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  // Calculate totals from positions
  const totalUpl = positions.reduce((sum, p) => sum + (p.upl || 0), 0);

  // Filter positions by search
  const filteredPositions = positions.filter((pos) => {
    if (searchTerm && !pos.instId?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-20 w-full mb-4" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!accountData?.hasAccount) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <Activity className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-foreground">{t.noAccount}</p>
        <p className="text-xs text-muted-foreground mt-1">{t.noAccountDesc}</p>
      </div>
    );
  }

  const balances = accountData.balances || {};

  return (
    <div className="space-y-4">
      {/* Account Summary Card */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/20 p-5 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-md">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t.title}</h3>
              <p className="text-xs text-muted-foreground">{accountData.accountLabel || accountData.externalAccountId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
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

        {/* Balance Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-4">
            <p className="text-xs text-muted-foreground mb-1">{t.totalEquity}</p>
            <p className="text-2xl font-bold text-foreground">
              ${formatValue(balances.totalEquity || balances.totalUsdt)}
            </p>
          </div>
          <div className="rounded-xl bg-muted/30 border border-border p-4">
            <p className="text-xs text-muted-foreground mb-1">{t.unrealizedPnl}</p>
            <p className={`text-2xl font-bold ${totalUpl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {totalUpl >= 0 ? '+' : ''}{formatValue(totalUpl)}
            </p>
          </div>
        </div>

        {/* Detailed Balances */}
        <div className="rounded-xl bg-muted/20 border border-border/50 p-4 space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t.tradingBalance}</span>
            <span className="font-mono font-medium">${formatValue(balances.tradingUsdt)} USDT</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t.fundingBalance}</span>
            <span className="font-mono font-medium">${formatValue(balances.fundingUsdt)} USDT</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t.availableMargin}</span>
            <span className="font-mono font-medium">${formatValue(balances.availableBalance)} USDT</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-border/50">
            <span className="text-muted-foreground">{t.leverage}</span>
            <span className="font-medium">{accountData.defaultLeverage || 5}x</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={onTransfer}
            className="flex items-center justify-center gap-2 rounded-xl border-border hover:bg-muted"
          >
            <ArrowLeftRight className="h-4 w-4" />
            {t.transfer}
          </Button>
          <Button asChild className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl">
            <Link to={createPageUrl("Futures")}>
              <TrendingUp className="h-4 w-4 mr-2" />
              {t.tradeNow}
            </Link>
          </Button>
        </div>

        {/* Last Sync */}
        {accountData.lastSync && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            {t.lastSync}: {new Date(accountData.lastSync).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
          </p>
        )}
      </div>

      {/* Open Positions */}
      {positions.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-muted/20">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-500" />
                {t.positions} ({positions.length})
              </h4>
              <div className="relative w-40">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t.search}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-8 text-xs bg-background border-border"
                />
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-border/50">
            {filteredPositions.map((pos, idx) => (
              <div key={idx} className="p-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CryptoIcon currency={pos.instId?.split('-')[0] || 'BTC'} size="sm" />
                    <div>
                      <span className="font-medium text-sm text-foreground">{pos.instId}</span>
                      <Badge className={`ml-2 text-xs ${pos.posSide === 'long' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                        {pos.posSide === 'long' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        {pos.posSide?.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <span className={`text-sm font-mono font-medium ${pos.upl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {pos.upl >= 0 ? '+' : ''}{formatValue(pos.upl)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>Size: {pos.size}</span>
                  <span>Entry: ${formatValue(pos.avgPx)}</span>
                  <span>Mark: ${formatValue(pos.markPx)}</span>
                  <span>{pos.lever}x</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {positions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-8 text-center">
          <Activity className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">{t.noPositions}</p>
        </div>
      )}
    </div>
  );
}

FuturesWalletView.propTypes = {
  showBalances: PropTypes.bool,
  onTransfer: PropTypes.func,
  onRefresh: PropTypes.func,
  language: PropTypes.string
};