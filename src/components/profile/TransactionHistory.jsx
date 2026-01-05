import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Lock,
  Gift,
  Unlock,
  Receipt,
  Search
} from "lucide-react";
import { base44 } from "@/api/base44Client";

const typeConfig = {
  deposit: { icon: ArrowDownToLine, color: "text-emerald-600", bg: "bg-emerald-100", label: "Deposit" },
  withdrawal: { icon: ArrowUpFromLine, color: "text-red-600", bg: "bg-red-100", label: "Withdrawal" },
  trade_margin: { icon: TrendingDown, color: "text-amber-600", bg: "bg-amber-100", label: "Trade Margin" },
  trade_pnl: { icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-100", label: "Trade P&L" },
  internal_transfer_in: { icon: ArrowLeftRight, color: "text-purple-600", bg: "bg-purple-100", label: "Transfer In" },
  internal_transfer_out: { icon: ArrowLeftRight, color: "text-purple-600", bg: "bg-purple-100", label: "Transfer Out" },
  staking_lock: { icon: Lock, color: "text-indigo-600", bg: "bg-indigo-100", label: "Stake" },
  staking_reward: { icon: Gift, color: "text-green-600", bg: "bg-green-100", label: "Stake Reward" },
  staking_unlock: { icon: Unlock, color: "text-teal-600", bg: "bg-teal-100", label: "Unstake" },
  fee: { icon: Receipt, color: "text-slate-600", bg: "bg-slate-100", label: "Fee" },
  conversion: { icon: ArrowLeftRight, color: "text-cyan-600", bg: "bg-cyan-100", label: "Conversion" }
};

const statusColors = {
  pending: "bg-amber-100 text-amber-700",
  confirming: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-700"
};

export default function TransactionHistory({ walletId, language = "en" }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    search: ''
  });
  const [sortBy, setSortBy] = useState('-created_date');

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params = {
        action: 'getTransactions',
        limit: 100,
        sortBy
      };
      if (walletId) params.walletId = walletId;
      if (filters.type !== 'all') params.type = filters.type;
      if (filters.status !== 'all') params.status = filters.status;
      
      const result = await base44.functions.invoke('wallet', params);
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
    loadTransactions();
  }, [walletId, filters.type, filters.status, sortBy]);

  const filteredTransactions = transactions.filter(tx => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return (
        tx.transaction_id?.toLowerCase().includes(search) ||
        tx.external_txid?.toLowerCase().includes(search) ||
        tx.notes?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg">Transaction History</CardTitle>
          <Button variant="ghost" size="sm" onClick={loadTransactions} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-2 pt-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search transactions..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-9 h-9"
            />
          </div>
          <Select value={filters.type} onValueChange={(v) => setFilters({ ...filters, type: v })}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="deposit">Deposits</SelectItem>
              <SelectItem value="withdrawal">Withdrawals</SelectItem>
              <SelectItem value="trade_margin">Trade Margin</SelectItem>
              <SelectItem value="trade_pnl">Trade P&L</SelectItem>
              <SelectItem value="internal_transfer_in">Transfer In</SelectItem>
              <SelectItem value="internal_transfer_out">Transfer Out</SelectItem>
              <SelectItem value="staking_lock">Staking</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="-created_date">Newest First</SelectItem>
              <SelectItem value="created_date">Oldest First</SelectItem>
              <SelectItem value="-amount">Highest Amount</SelectItem>
              <SelectItem value="amount">Lowest Amount</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No transactions found
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="divide-y divide-slate-100">
              {filteredTransactions.map((tx) => {
                const config = typeConfig[tx.type] || typeConfig.deposit;
                const Icon = config.icon;
                const isPositive = tx.amount > 0;
                
                return (
                  <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{config.label}</p>
                        <p className="text-xs text-slate-500">{formatDate(tx.created_date)}</p>
                        {tx.notes && <p className="text-xs text-slate-400 mt-0.5 max-w-[200px] truncate">{tx.notes}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{tx.amount?.toFixed(4)} {tx.currency || 'USDT'}
                      </p>
                      {tx.fee > 0 && <p className="text-xs text-slate-400">Fee: {tx.fee.toFixed(4)}</p>}
                      <Badge className={`text-[10px] ${statusColors[tx.status]}`}>
                        {tx.status}
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