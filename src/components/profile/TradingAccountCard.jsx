import { useState } from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Settings,
  RefreshCw
} from "lucide-react";

const translations = {
  en: {
    balance: "Balance",
    equity: "Equity",
    margin: "Margin Used",
    unrealizedPnl: "Unrealized P&L",
    realizedPnl: "Realized P&L",
    totalTrades: "Total Trades",
    winRate: "Win Rate",
    leverage: "Leverage",
    active: "Active",
    inactive: "Inactive"
  },
  ar: {
    balance: "الرصيد",
    equity: "رأس المال",
    margin: "الهامش المستخدم",
    unrealizedPnl: "الربح غير المحقق",
    realizedPnl: "الربح المحقق",
    totalTrades: "إجمالي الصفقات",
    winRate: "نسبة الفوز",
    leverage: "الرافعة المالية",
    active: "نشط",
    inactive: "غير نشط"
  }
};

export default function TradingAccountCard({ account, language = "en", onRefresh }) {
  const t = translations[language];
  const [refreshing, setRefreshing] = useState(false);

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return "$0.00";
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const winRate = account.total_trades > 0 
    ? ((account.winning_trades / account.total_trades) * 100).toFixed(1) 
    : "0.0";

  const handleRefresh = async () => {
    setRefreshing(true);
    if (onRefresh) await onRefresh();
    setRefreshing(false);
  };

  return (
    <Card className="border-slate-200 shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">{account.nickname || "Trading Account"}</CardTitle>
              <p className="text-xs text-slate-500 font-mono">{account.account_id?.substring(0, 20)}...</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={account.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}>
              {account.status === 'active' ? t.active : t.inactive}
            </Badge>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-8 w-8"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-4">
        {/* Main Balance Display */}
        <div className="text-center mb-6 py-4 bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl">
          <p className="text-xs text-slate-500 uppercase mb-1">{t.equity}</p>
          <p className="text-4xl font-bold text-slate-900">{formatCurrency(account.equity)}</p>
          <div className={`flex items-center justify-center gap-1 mt-2 text-sm font-medium ${
            account.unrealized_pnl >= 0 ? 'text-emerald-600' : 'text-red-500'
          }`}>
            {account.unrealized_pnl >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {formatCurrency(account.unrealized_pnl)} {t.unrealizedPnl}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">{t.balance}</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(account.balance)}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">{t.margin}</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(account.margin_used)}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">{t.realizedPnl}</p>
            <p className={`text-lg font-bold ${account.realized_pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {account.realized_pnl >= 0 ? '+' : ''}{formatCurrency(account.realized_pnl)}
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">{t.leverage}</p>
            <p className="text-lg font-bold text-blue-600">{account.default_leverage}x</p>
          </div>
        </div>

        {/* Trade Stats */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-600">{t.totalTrades}: <strong>{account.total_trades}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-sm text-slate-600">{t.winRate}: <strong>{winRate}%</strong></span>
          </div>
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