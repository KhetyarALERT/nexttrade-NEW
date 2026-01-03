import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { base44 } from "@/api/base44Client";

const translations = {
  en: {
    title: "Transaction History",
    deposit: "Deposit",
    withdrawal: "Withdrawal",
    tradeMargin: "Trade Margin",
    tradePnl: "Trade P&L",
    transferIn: "Transfer In",
    transferOut: "Transfer Out",
    pending: "Pending",
    completed: "Completed",
    failed: "Failed",
    noTransactions: "No transactions yet",
    refresh: "Refresh"
  },
  ar: {
    title: "سجل المعاملات",
    deposit: "إيداع",
    withdrawal: "سحب",
    tradeMargin: "هامش التداول",
    tradePnl: "ربح/خسارة التداول",
    transferIn: "تحويل وارد",
    transferOut: "تحويل صادر",
    pending: "قيد الانتظار",
    completed: "مكتمل",
    failed: "فشل",
    noTransactions: "لا توجد معاملات بعد",
    refresh: "تحديث"
  }
};

const typeConfig = {
  deposit: { icon: ArrowDownToLine, color: "text-emerald-600", bg: "bg-emerald-100" },
  withdrawal: { icon: ArrowUpFromLine, color: "text-red-600", bg: "bg-red-100" },
  trade_margin: { icon: TrendingDown, color: "text-amber-600", bg: "bg-amber-100" },
  trade_pnl: { icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-100" },
  internal_transfer_in: { icon: ArrowLeftRight, color: "text-purple-600", bg: "bg-purple-100" },
  internal_transfer_out: { icon: ArrowLeftRight, color: "text-purple-600", bg: "bg-purple-100" }
};

const statusColors = {
  pending: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-700"
};

export default function TransactionHistory({ walletId, language = "en" }) {
  const t = translations[language];
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('wallet', {
        action: 'getTransactions',
        walletId,
        limit: 50
      });
      if (result.data?.success) {
        setTransactions(result.data.data || []);
      }
    } catch (err) {
      console.error("Failed to load transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (walletId) {
      loadTransactions();
    }
  }, [walletId]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getTypeLabel = (type) => {
    const labels = {
      deposit: t.deposit,
      withdrawal: t.withdrawal,
      trade_margin: t.tradeMargin,
      trade_pnl: t.tradePnl,
      internal_transfer_in: t.transferIn,
      internal_transfer_out: t.transferOut
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: t.pending,
      completed: t.completed,
      failed: t.failed
    };
    return labels[status] || status;
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{t.title}</CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={loadTransactions}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {t.refresh}
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            {t.noTransactions}
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="divide-y divide-slate-100">
              {transactions.map((tx) => {
                const config = typeConfig[tx.type] || typeConfig.deposit;
                const Icon = config.icon;
                const isPositive = tx.amount > 0;
                
                return (
                  <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{getTypeLabel(tx.type)}</p>
                        <p className="text-xs text-slate-500">{formatDate(tx.created_date)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{tx.amount?.toFixed(2)} USDT
                      </p>
                      <Badge className={`text-[10px] ${statusColors[tx.status]}`}>
                        {getStatusLabel(tx.status)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

TransactionHistory.propTypes = {
  walletId: PropTypes.string,
  language: PropTypes.string
};