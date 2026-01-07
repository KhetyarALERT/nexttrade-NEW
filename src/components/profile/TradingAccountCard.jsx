import { useState } from "react";
import PropTypes from "prop-types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw
} from "lucide-react";

const translations = {
  en: {
    balance: "Balance",
    equity: "Equity",
    margin: "Margin",
    unrealizedPnl: "Unrealized",
    realizedPnl: "Realized",
    totalTrades: "Trades",
    winRate: "Win Rate",
    leverage: "Leverage",
    active: "Active",
    inactive: "Inactive"
  },
  ar: {
    balance: "الرصيد",
    equity: "رأس المال",
    margin: "الهامش",
    unrealizedPnl: "غير محقق",
    realizedPnl: "محقق",
    totalTrades: "الصفقات",
    winRate: "نسبة الفوز",
    leverage: "الرافعة",
    active: "نشط",
    inactive: "غير نشط"
  }
};

export default function TradingAccountCard({ account, language = "en", onRefresh }) {
  const t = translations[language];
  const [refreshing, setRefreshing] = useState(false);

  const isDemo = Boolean(account?.is_demo) || String(account?.account_type || "").toLowerCase() === "demo";
  const displayBalance = Number(isDemo ? (account?.demo_balance ?? account?.balance) : account?.balance) || 0;
  const marginUsed = Number(account?.margin_used) || 0;
  const unrealized = Number(account?.unrealized_pnl) || 0;
  // Equity should reflect what the user actually has right now.
  // Our backend updates `balance` (available) + `margin_used` (in positions) and tracks `unrealized_pnl`.
  // Older rows may have a stale `equity` (e.g. still 10,000) so we compute it.
  const equityValue = displayBalance + marginUsed + unrealized;

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return "$0.00";
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const winRate = account.total_trades > 0 
    ? ((account.winning_trades / account.total_trades) * 100).toFixed(0) 
    : "0";

  const handleRefresh = async () => {
    setRefreshing(true);
    if (onRefresh) await onRefresh();
    setRefreshing(false);
  };

  return (
    <Card className="border-slate-200 shadow-md hover:shadow-lg transition-shadow overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{account.nickname || "Trading Account"}</h3>
              <Badge className={`text-[10px] ${account.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                {account.status === 'active' ? t.active : t.inactive}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing} className="h-8 w-8">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        {/* Main Balance */}
        <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50">
          <p className="text-xs text-slate-500 mb-1">{t.equity}</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{formatCurrency(equityValue)}</p>
          <div className={`flex items-center gap-1 mt-1 text-sm font-medium ${
            account.unrealized_pnl >= 0 ? 'text-emerald-600' : 'text-red-500'
          }`}>
            {account.unrealized_pnl >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{formatCurrency(account.unrealized_pnl)}</span>
          </div>
        </div>

        {/* Stats Grid - Responsive */}
        <div className="grid grid-cols-2 gap-px bg-slate-100">
          <div className="p-3 bg-white">
            <p className="text-[10px] text-slate-500 uppercase">{t.balance}</p>
            <p className="text-sm font-bold text-slate-900">{formatCurrency(displayBalance)}</p>
          </div>
          <div className="p-3 bg-white">
            <p className="text-[10px] text-slate-500 uppercase">{t.margin}</p>
            <p className="text-sm font-bold text-slate-900">{formatCurrency(account.margin_used)}</p>
          </div>
          <div className="p-3 bg-white">
            <p className="text-[10px] text-slate-500 uppercase">{t.realizedPnl}</p>
            <p className={`text-sm font-bold ${account.realized_pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {account.realized_pnl >= 0 ? '+' : ''}{formatCurrency(account.realized_pnl)}
            </p>
          </div>
          <div className="p-3 bg-white">
            <p className="text-[10px] text-slate-500 uppercase">{t.leverage}</p>
            <p className="text-sm font-bold text-blue-600">{account.default_leverage}x</p>
          </div>
        </div>

        {/* Footer Stats */}
        <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span>{t.totalTrades}: <strong>{account.total_trades}</strong></span>
          <span>{t.winRate}: <strong className="text-emerald-600">{winRate}%</strong></span>
        </div>
      </CardContent>
    </Card>
  );
}

TradingAccountCard.propTypes = {
  account: PropTypes.object.isRequired,
  language: PropTypes.string,
  onRefresh: PropTypes.func
};