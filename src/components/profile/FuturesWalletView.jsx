import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Search, RefreshCw, ArrowLeftRight, TrendingUp, TrendingDown, Activity, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import CryptoIcon from "@/components/ui/CryptoIcon";
import { base44 } from "@/api/base44Client";
import OKXTransferModal from "./OKXTransferModal";

export default function FuturesWalletView({
  showBalances = true,
  onTransfer,
  onRefresh,
  language = 'en'
}) {
  const t = language === 'ar' ? {
    totalEquity: 'إجمالي الحقوق',
    tradingBalance: 'رصيد التداول',
    availableMargin: 'الهامش المتاح',
    unrealizedPnl: 'الربح غير المحقق',
    transfer: 'تحويل',
    trade: 'تداول',
    search: 'بحث',
    hideSmall: 'إخفاء الأصول الصغيرة',
    noAccount: 'لا يوجد حساب تداول مباشر',
    noAccountDesc: 'تواصل مع الدعم للحصول على حساب تداول.',
    positions: 'المراكز المفتوحة',
    noPositions: 'لا توجد مراكز مفتوحة',
    leverage: 'الرافعة المالية',
    marginMode: 'وضع الهامش',
    cross: 'متقاطع',
    isolated: 'معزول',
    refresh: 'تحديث',
    loading: 'جاري التحميل...',
    fundingBalance: 'رصيد التمويل',
    size: 'الحجم',
    entryPrice: 'سعر الدخول',
    markPrice: 'سعر العلامة',
    liqPrice: 'سعر التصفية',
    pnl: 'الربح/الخسارة'
  } : {
    totalEquity: 'Total Equity',
    tradingBalance: 'Trading Balance',
    availableMargin: 'Available Margin',
    unrealizedPnl: 'Unrealized PnL',
    transfer: 'Transfer',
    trade: 'Trade',
    search: 'Search',
    hideSmall: 'Hide small assets',
    noAccount: 'No Live Trading Account',
    noAccountDesc: 'Contact support to get a live trading account assigned.',
    positions: 'Open Positions',
    noPositions: 'No open positions',
    leverage: 'Leverage',
    marginMode: 'Margin Mode',
    cross: 'Cross',
    isolated: 'Isolated',
    refresh: 'Refresh',
    loading: 'Loading...',
    fundingBalance: 'Funding Balance',
    size: 'Size',
    entryPrice: 'Entry Price',
    markPrice: 'Mark Price',
    liqPrice: 'Liq. Price',
    pnl: 'PnL'
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accountData, setAccountData] = useState(null);
  const [positions, setPositions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [hideSmallAssets, setHideSmallAssets] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

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
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPrice = (val) => {
    if (!showBalances) return "****";
    if (val === null || val === undefined) return "0.00";
    if (val < 1) return val.toFixed(6);
    if (val < 100) return val.toFixed(4);
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate totals from real OKX data
  const totalEquity = accountData?.balances?.totalEquity || 0;
  const tradingUsdt = accountData?.balances?.tradingUsdt || 0;
  const fundingUsdt = accountData?.balances?.fundingUsdt || 0;
  const totalUpl = positions.reduce((sum, p) => sum + (p.upl || 0), 0);
  const marginUsed = positions.reduce((sum, p) => sum + (p.margin || 0), 0);
  const availableMargin = tradingUsdt - marginUsed;
  
  // Get real leverage and margin mode from account config
  const defaultLeverage = accountData?.defaultLeverage || 5;
  const marginMode = accountData?.marginMode || 'cross';

  // Filter positions
  const filteredPositions = positions.filter((pos) => {
    if (searchTerm && !pos.instId?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (hideSmallAssets && Math.abs(pos.upl || 0) < 1) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!accountData?.hasAccount) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-lg font-medium text-foreground">{t.noAccount}</p>
        <p className="text-sm text-muted-foreground mt-1">{t.noAccountDesc}</p>
        <a 
          href="mailto:support@nexttrade.exchange" 
          className="inline-flex items-center gap-1 mt-4 text-sm text-blue-600 hover:text-blue-700"
        >
          Contact Support
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Account Summary Card */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/20 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <span className="text-muted-foreground text-xs block mb-1">{t.totalEquity}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-foreground">
                {showBalances ? formatValue(totalEquity) : "****"}
              </span>
              <span className="text-muted-foreground text-sm">USDT</span>
            </div>
            <div className="text-muted-foreground text-xs mt-1">≈ ${showBalances ? formatValue(totalEquity) : "****"}</div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setTransferModalOpen(true)}
              variant="outline"
              size="sm"
              className="border-border bg-background text-foreground hover:bg-muted/50 rounded-xl"
            >
              <ArrowLeftRight className="w-4 h-4 mr-1.5" /> {t.transfer}
            </Button>
            <Button
              onClick={handleRefresh}
              variant="ghost"
              size="sm"
              disabled={refreshing}
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Balance Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-xl bg-background/60 border border-border/50 p-3">
            <span className="text-muted-foreground text-[10px] uppercase tracking-wider block mb-1">{t.tradingBalance}</span>
            <span className="text-foreground text-lg font-semibold">{showBalances ? formatValue(tradingUsdt) : "****"}</span>
            <span className="text-muted-foreground text-xs ml-1">USDT</span>
          </div>
          <div className="rounded-xl bg-background/60 border border-border/50 p-3">
            <span className="text-muted-foreground text-[10px] uppercase tracking-wider block mb-1">{t.fundingBalance}</span>
            <span className="text-foreground text-lg font-semibold">{showBalances ? formatValue(fundingUsdt) : "****"}</span>
            <span className="text-muted-foreground text-xs ml-1">USDT</span>
          </div>
          <div className="rounded-xl bg-background/60 border border-border/50 p-3">
            <span className="text-muted-foreground text-[10px] uppercase tracking-wider block mb-1">{t.availableMargin}</span>
            <span className="text-foreground text-lg font-semibold">{showBalances ? formatValue(availableMargin) : "****"}</span>
            <span className="text-muted-foreground text-xs ml-1">USDT</span>
          </div>
          <div className="rounded-xl bg-background/60 border border-border/50 p-3">
            <span className="text-muted-foreground text-[10px] uppercase tracking-wider block mb-1">{t.unrealizedPnl}</span>
            <span className={`text-lg font-semibold ${totalUpl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {totalUpl >= 0 ? '+' : ''}{showBalances ? formatValue(totalUpl) : "****"}
            </span>
          </div>
        </div>

        {/* Account Settings */}
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">{t.leverage}:</span>
            <Badge variant="secondary" className="font-mono">{defaultLeverage}x</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">{t.marginMode}:</span>
            <Badge variant="outline" className="capitalize">{marginMode === 'cross' ? t.cross : t.isolated}</Badge>
          </div>
        </div>
      </div>

      {/* Positions Section */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              <h3 className="font-semibold text-foreground">{t.positions}</h3>
              <Badge variant="secondary" className="text-xs">{positions.length}</Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:w-48">
                <Search className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
                <Input
                  placeholder={t.search}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`${language === 'ar' ? 'pr-9' : 'pl-9'} bg-background border-border text-foreground h-9`}
                />
              </div>
              <label className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                <Checkbox checked={hideSmallAssets} onCheckedChange={setHideSmallAssets} className="border-border" />
                {t.hideSmall}
              </label>
            </div>
          </div>
        </div>

        {filteredPositions.length === 0 ? (
          <div className="p-8 text-center">
            <Activity className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-muted-foreground text-sm">{t.noPositions}</p>
            <Link to={createPageUrl("Futures")}>
              <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                <TrendingUp className="w-4 h-4 mr-2" />
                {t.trade}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredPositions.map((pos, idx) => {
              const isLong = pos.posSide === 'long';
              const pnlPercent = pos.margin > 0 ? (pos.upl / pos.margin * 100) : 0;
              
              return (
                <div key={idx} className="p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <CryptoIcon currency={pos.instId?.split('-')[0] || 'BTC'} size="md" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{pos.instId}</span>
                          <Badge className={`text-xs ${isLong ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                            {isLong ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                            {pos.posSide?.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{pos.lever}x</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                          <span>{t.size}: <span className="text-foreground">{pos.size}</span></span>
                          <span>{t.entryPrice}: <span className="text-foreground">${formatPrice(pos.avgPx)}</span></span>
                          {pos.markPx && <span>{t.markPrice}: <span className="text-foreground">${formatPrice(pos.markPx)}</span></span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-semibold ${pos.upl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {pos.upl >= 0 ? '+' : ''}{showBalances ? formatValue(pos.upl) : "****"}
                      </div>
                      <div className={`text-xs ${pos.upl >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                        {pos.upl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                      </div>
                      {pos.liqPx && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {t.liqPrice}: ${formatPrice(pos.liqPx)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Trade Button */}
      <div className="flex justify-center">
        <Link to={createPageUrl("Futures")}>
          <Button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl px-8">
            <TrendingUp className="w-4 h-4 mr-2" />
            {t.trade}
          </Button>
        </Link>
      </div>

      {/* Transfer Modal */}
      <OKXTransferModal
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        language={language}
        onSuccess={() => {
          loadAccountData();
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
}

FuturesWalletView.propTypes = {
  showBalances: PropTypes.bool,
  onTransfer: PropTypes.func,
  onRefresh: PropTypes.func,
  language: PropTypes.string
};