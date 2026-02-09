import { useState } from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw,
  Activity,
  BarChart3,
  Shield
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
  const displayBalance = Number(
    isDemo
      ? (account?.demo_balance ?? account?.balance ?? account?.equity)
      : (account?.balance ?? account?.equity)
  ) || 0;
  const marginUsed = Number(account?.margin_used) || 0;
  const unrealized = Number(account?.unrealized_pnl) || 0;
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
    <Card className="border-border/40 bg-card/30 overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border/40 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{account.nickname || "Trading Account"}</CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className={`text-[10px] font-bold border-none ${account.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                  {account.status === 'active' ? t.active : t.inactive}
                </Badge>
                {isDemo && <Badge variant="outline" className="text-[10px] font-bold border-none bg-amber-500/10 text-amber-500">DEMO</Badge>}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing} className="h-8 w-8 p-0 rounded-lg">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="p-6 bg-gradient-to-br from-primary/5 to-transparent">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{t.equity}</p>
          <p className="text-3xl font-bold font-mono text-foreground">{formatCurrency(equityValue)}</p>
          <div className={`flex items-center gap-1.5 mt-2 text-sm font-bold ${unrealized >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {unrealized >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{formatCurrency(unrealized)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border/40 border-t border-border/40">
          <div className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{t.balance}</p>
            <p className="text-sm font-bold font-mono">{formatCurrency(displayBalance)}</p>
          </div>
          <div className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{t.margin}</p>
            <p className="text-sm font-bold font-mono">{formatCurrency(marginUsed)}</p>
          </div>
          <div className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{t.realizedPnl}</p>
            <p className={`text-sm font-bold font-mono ${account.realized_pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {account.realized_pnl >= 0 ? '+' : ''}{formatCurrency(account.realized_pnl)}
            </p>
          </div>
          <div className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{t.leverage}</p>
            <p className="text-sm font-bold text-primary">{account.default_leverage}x</p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="bg-muted/10 border-t border-border/40 p-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{t.totalTrades}: <span className="text-foreground">{account.total_trades}</span></span>
          <span>{t.winRate}: <span className="text-emerald-500">{winRate}%</span></span>
        </div>
        <div className="flex items-center gap-1">
          <Shield className="h-3 w-3" />
          <span>Secured</span>
        </div>
      </CardFooter>
    </Card>
  );
}

TradingAccountCard.propTypes = {
  account: PropTypes.object.isRequired,
  language: PropTypes.string,
  onRefresh: PropTypes.func
};
