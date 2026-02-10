import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  History,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  RefreshCw,
  ExternalLink,
  Clock,
  ArrowLeft
} from "lucide-react";
import CryptoIcon from "@/components/ui/CryptoIcon";

const translations = {
  en: {
    title: "Transaction History",
    all: "All",
    deposits: "Deposits",
    withdrawals: "Withdrawals",
    transfers: "Transfers",
    noTransactions: "No transactions yet",
    pending: "Pending",
    processing: "Processing",
    completed: "Completed",
    failed: "Failed",
    viewOnChain: "View on Explorer",
    loading: "Loading..."
  },
  ar: {
    title: "سجل المعاملات",
    all: "الكل",
    deposits: "إيداعات",
    withdrawals: "سحوبات",
    transfers: "تحويلات",
    noTransactions: "لا توجد معاملات",
    pending: "قيد الانتظار",
    processing: "قيد المعالجة",
    completed: "مكتمل",
    failed: "فشل",
    viewOnChain: "عرض على المستكشف",
    loading: "جاري التحميل..."
  }
};

const STATUS_CONFIG = {
  pending: { color: "text-amber-600 border-amber-300 bg-amber-500/10", label: "pending" },
  confirming: { color: "text-blue-600 border-blue-300 bg-blue-500/10", label: "processing" },
  completed: { color: "text-emerald-600 border-emerald-300 bg-emerald-500/10", label: "completed" },
  failed: { color: "text-rose-600 border-rose-300 bg-rose-500/10", label: "failed" },
  cancelled: { color: "text-slate-600 border-slate-300 bg-slate-500/10", label: "failed" }
};

// User-friendly status labels
const getStatusLabel = (status, t) => {
  const config = STATUS_CONFIG[status];
  if (!config) return status;
  return t[config.label] || status;
};

export default function WalletHistory({ language = "en", onRefresh, showBackButton = false, refreshKey = 0 }) {
  const t = translations[language] || translations.en;
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      
      // Load ONLY user deposits and withdrawals (not internal ledger movements)
      const [walletTxs, ledgerWithdrawals] = await Promise.all([
        // Wallet transactions: filter only deposits/withdrawals
        base44.entities.WalletTransaction.filter(
          { user_id: user.id },
          "-created_date",
          50
        ),
        // Ledger withdrawals (user-initiated)
        base44.entities.LedgerWithdrawal.filter(
          { user_id: user.id },
          "-created_date",
          30
        )
      ]);
      
      // Filter wallet transactions to only show deposits and withdrawals
      const filteredWalletTxs = (walletTxs || []).filter(tx => 
        tx.type === 'deposit' || tx.type === 'withdrawal'
      );
      
      // Convert ledger withdrawals to unified format
      const withdrawalTxs = (ledgerWithdrawals || []).map(wd => ({
        id: wd.id,
        type: 'withdrawal',
        amount: wd.amount,
        currency: 'USDT',
        network: wd.network,
        status: wd.status === 'APPROVED' ? 'completed' : 
                wd.status === 'FAILED' ? 'failed' : 'pending',
        external_txid: wd.mock_tx_hash,
        created_date: wd.created_date,
        reference: wd.reference,
        source: 'ledger'
      }));
      
      // Merge and deduplicate (prefer ledger withdrawals)
      const ledgerIds = new Set(withdrawalTxs.map(tx => tx.reference));
      const uniqueWalletTxs = filteredWalletTxs.filter(tx => 
        tx.type !== 'withdrawal' || !ledgerIds.has(tx.reference_id)
      );
      
      // Combine and sort by date
      const combined = [...uniqueWalletTxs, ...withdrawalTxs];
      combined.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
      
      setTransactions(combined.slice(0, 50));
    } catch (err) {
      console.error("[WalletHistory] Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [refreshKey]);

  const filteredTransactions = transactions.filter((tx) => {
    if (activeTab === "all") return true;
    if (activeTab === "deposits") return tx.type === "deposit";
    if (activeTab === "withdrawals") return tx.type === "withdrawal";
    if (activeTab === "transfers") return tx.type?.includes("transfer");
    return true;
  });

  const getStatusConfig = (status) => {
    return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getTypeIcon = (type) => {
    if (type === "deposit") return ArrowDownToLine;
    if (type === "withdrawal") return ArrowUpFromLine;
    return ArrowLeftRight;
  };

  if (loading) {
    return (
      <Card className="border-border/60">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile Back Button */}
      {showBackButton && (
        <div className="lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === "ar" ? "رجوع" : "Back"}
          </Button>
        </div>
      )}
      
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          {t.title}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadHistory}
          className="rounded-xl"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {/* Filter Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start bg-muted/30 p-1 rounded-xl mb-4">
            <TabsTrigger value="all" className="rounded-lg text-xs">
              {t.all}
            </TabsTrigger>
            <TabsTrigger value="deposits" className="rounded-lg text-xs">
              {t.deposits}
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="rounded-lg text-xs">
              {t.withdrawals}
            </TabsTrigger>
            <TabsTrigger value="transfers" className="rounded-lg text-xs">
              {t.transfers}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">{t.noTransactions}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransactions.map((tx, idx) => {
                  const TypeIcon = getTypeIcon(tx.type);
                  const statusConfig = getStatusConfig(tx.status);
                  
                  return (
                    <div
                      key={tx.id || idx}
                      className="flex items-center justify-between p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${
                          tx.type === "deposit" 
                            ? "bg-emerald-500/10 text-emerald-600" 
                            : tx.type === "withdrawal"
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-blue-500/10 text-blue-600"
                        }`}>
                          <TypeIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CryptoIcon currency={tx.currency} size="xs" />
                            <span className="font-medium text-foreground">
                              {tx.type === "deposit" ? "+" : "-"}{tx.amount} {tx.currency}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(tx.created_date)}
                            {tx.network && <span className="ml-1 text-muted-foreground/70">• {tx.network}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                        variant="outline"
                        className={`text-xs ${statusConfig.color}`}
                        >
                        {getStatusLabel(tx.status, t)}
                        </Badge>
                        {tx.external_txid && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              // Open block explorer
                              const explorerUrl = tx.network === "TRC20" 
                                ? `https://tronscan.org/#/transaction/${tx.external_txid}`
                                : tx.network === "ERC20"
                                ? `https://etherscan.io/tx/${tx.external_txid}`
                                : null;
                              if (explorerUrl) window.open(explorerUrl, "_blank");
                            }}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      </Card>
    </div>
  );
}

WalletHistory.propTypes = {
  language: PropTypes.string,
  onRefresh: PropTypes.func,
  showBackButton: PropTypes.bool,
  refreshKey: PropTypes.number
};