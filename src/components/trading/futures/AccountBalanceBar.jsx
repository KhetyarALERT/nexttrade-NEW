/**
 * AccountBalanceBar - Prominent balance display for futures trading
 * Shows equity, available balance, margin used, and unrealized PnL
 */

import { useMemo } from "react";
import PropTypes from "prop-types";
import { Wallet, TrendingUp, TrendingDown, AlertTriangle, RefreshCw } from "lucide-react";

function formatNumber(v, digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function AccountBalanceBar({ 
  account, 
  totalUnrealizedPnl = 0, 
  language = "en",
  onRefresh,
  isRefreshing = false,
  compact = false,
}) {
  const isAr = language === "ar";

  const labels = useMemo(() => ({
    equity: isAr ? "إجمالي الرصيد" : "Total Equity",
    available: isAr ? "المتاح" : "Available",
    marginUsed: isAr ? "الهامش المستخدم" : "Margin Used",
    unrealizedPnl: isAr ? "الربح غير المحقق" : "Unrealized PnL",
    noAccount: isAr ? "لا يوجد حساب" : "No Account",
    connectAccount: isAr ? "اربط حسابك للتداول" : "Connect your account to trade",
  }), [isAr]);

  const equity = Number(account?.equity || account?.balance || 0);
  const available = Number(account?.availableBalance || 0);
  const marginUsed = Number(account?.marginUsed || 0);
  const unrealizedPnl = Number(totalUnrealizedPnl || account?.unrealizedPnl || 0);

  const isPnlPositive = unrealizedPnl >= 0;
  const marginRatio = equity > 0 ? (marginUsed / equity) * 100 : 0;
  const isHighRisk = marginRatio > 80;

  if (!account?.id) {
    return (
      <div className={`bg-card/50 border border-border rounded-xl ${compact ? "p-2" : "p-3 sm:p-4"}`}>
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Wallet className="h-4 w-4" />
          <span className="text-sm">{labels.noAccount}</span>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="bg-card/60 backdrop-blur-sm border border-border/30 rounded-2xl p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider font-semibold">{labels.equity}</div>
              <div className="font-mono text-[13px] font-bold text-foreground tracking-tight">{formatNumber(equity)} <span className="text-[9px] text-muted-foreground/40">USDT</span></div>
            </div>
            <div className={`text-right ${isPnlPositive ? "text-emerald-500" : "text-rose-500"}`}>
              <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider font-semibold">PnL</div>
              <div className="font-mono text-[13px] font-bold tracking-tight">
                {isPnlPositive ? "+" : ""}{formatNumber(unrealizedPnl)}
              </div>
            </div>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-xl text-muted-foreground/40 hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-card/80 to-card/50 border border-border rounded-xl p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">
            {isAr ? "حساب التداول" : "Trading Account"}
          </span>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Equity */}
        <div className="bg-background/50 rounded-lg p-2.5 sm:p-3">
          <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">{labels.equity}</div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-foreground">
            {formatNumber(equity)}
            <span className="text-xs ml-1 text-muted-foreground">USDT</span>
          </div>
        </div>

        {/* Available Balance */}
        <div className="bg-background/50 rounded-lg p-2.5 sm:p-3">
          <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">{labels.available}</div>
          <div className="mt-1 font-mono text-base sm:text-lg font-semibold text-foreground">
            {formatNumber(available)}
            <span className="text-xs ml-1 text-muted-foreground">USDT</span>
          </div>
        </div>

        {/* Margin Used */}
        <div className={`rounded-lg p-2.5 sm:p-3 ${isHighRisk ? "bg-rose-500/10" : "bg-background/50"}`}>
          <div className="flex items-center gap-1">
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">{labels.marginUsed}</span>
            {isHighRisk && <AlertTriangle className="h-3 w-3 text-rose-400" />}
          </div>
          <div className={`mt-1 font-mono text-base sm:text-lg font-semibold ${isHighRisk ? "text-rose-400" : "text-foreground"}`}>
            {formatNumber(marginUsed)}
            <span className="text-xs ml-1 text-muted-foreground">USDT</span>
          </div>
          {marginRatio > 0 && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              {marginRatio.toFixed(1)}% {isAr ? "مستخدم" : "used"}
            </div>
          )}
        </div>

        {/* Unrealized PnL */}
        <div className={`rounded-lg p-2.5 sm:p-3 ${isPnlPositive ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
          <div className="flex items-center gap-1">
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">{labels.unrealizedPnl}</span>
            {isPnlPositive ? (
              <TrendingUp className="h-3 w-3 text-emerald-400" />
            ) : (
              <TrendingDown className="h-3 w-3 text-rose-400" />
            )}
          </div>
          <div className={`mt-1 font-mono text-base sm:text-lg font-bold ${isPnlPositive ? "text-emerald-400" : "text-rose-400"}`}>
            {isPnlPositive ? "+" : ""}{formatNumber(unrealizedPnl)}
            <span className="text-xs ml-1">USDT</span>
          </div>
        </div>
      </div>

      {/* Margin Bar (visual indicator) */}
      {equity > 0 && (
        <div className="mt-3 sm:mt-4">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                marginRatio > 80 ? "bg-rose-500" : 
                marginRatio > 50 ? "bg-amber-500" : 
                "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(100, marginRatio)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

AccountBalanceBar.propTypes = {
  account: PropTypes.object,
  totalUnrealizedPnl: PropTypes.number,
  language: PropTypes.string,
  onRefresh: PropTypes.func,
  isRefreshing: PropTypes.bool,
  compact: PropTypes.bool,
};