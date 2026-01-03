import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function RecentTransactions({ language = "en" }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('wallet', {
        action: 'getTransactions',
        limit: 10
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
    loadTransactions();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatAmount = (amount) => {
    if (amount === null || amount === undefined) return "****";
    const prefix = amount >= 0 ? "+" : "";
    return `${prefix}${Math.abs(amount).toFixed(2)}`;
  };

  const getTypeLabel = (type) => {
    const labels = {
      deposit: "Deposit",
      withdrawal: "Withdraw",
      trade_margin: "Trade Margin",
      trade_pnl: "Trade P&L",
      internal_transfer_in: "Transfer In",
      internal_transfer_out: "Transfer Out",
      staking_lock: "Stake",
      staking_reward: "Reward",
      staking_unlock: "Unstake",
      fee: "Fee"
    };
    return labels[type] || type;
  };

  const getStatusColor = (status) => {
    if (status === 'completed') return 'text-emerald-400';
    if (status === 'pending') return 'text-amber-400';
    if (status === 'failed') return 'text-red-400';
    return 'text-slate-400';
  };

  return (
    <div className="bg-[#1a1a2e] rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium">Recent Deposits & Withdrawals</h3>
        <button className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
          View asset records <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="w-5 h-5 animate-spin text-slate-500" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          No recent transactions
        </div>
      ) : (
        <ScrollArea className="h-[300px]">
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div 
                key={tx.id} 
                className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0"
              >
                <div>
                  <p className="text-white text-sm">{getTypeLabel(tx.type)}</p>
                  <p className="text-slate-500 text-xs">{formatDate(tx.created_date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-white text-sm font-mono">****</p>
                  <p className={`text-xs capitalize ${getStatusColor(tx.status)}`}>
                    {tx.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

RecentTransactions.propTypes = {
  language: PropTypes.string
};