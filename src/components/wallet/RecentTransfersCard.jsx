import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Lock,
  ChevronRight
} from "lucide-react";
import { base44 } from "@/api/base44Client";

const translations = {
  en: {
    recentTransfers: "Recent Transfers",
    noTransfers: "No recent transfers",
    deposit: "Deposit",
    withdrawal: "Withdrawal",
    transfer: "Transfer",
    staking: "Staking",
    copyTrading: "Copy Trading",
    pending: "Processing",
    pendingSettlement: "Settling",
    completed: "Completed",
    active: "Active",
    failed: "Failed",
    canceled: "Canceled",
    viewAll: "View All",
    fundingToTrading: "Funding → Trading",
    tradingToFunding: "Trading → Funding",
    toMainPool: "To Main Pool"
  },
  ar: {
    recentTransfers: "التحويلات الأخيرة",
    noTransfers: "لا توجد تحويلات حديثة",
    deposit: "إيداع",
    withdrawal: "سحب",
    transfer: "تحويل",
    staking: "ستيكنج",
    copyTrading: "نسخ التداول",
    pending: "قيد المعالجة",
    pendingSettlement: "قيد التسوية",
    completed: "مكتمل",
    active: "نشط",
    failed: "فشل",
    canceled: "ملغى",
    viewAll: "عرض الكل",
    fundingToTrading: "تمويل ← تداول",
    tradingToFunding: "تداول ← تمويل",
    toMainPool: "إلى المحفظة الرئيسية"
  }
};

// Format date relative to now
function formatRelativeTime(dateStr, language) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return language === "ar" ? "الآن" : "Just now";
  if (diffMins < 60) return language === "ar" ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`;
  if (diffHours < 24) return language === "ar" ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
  if (diffDays < 7) return language === "ar" ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
  return date.toLocaleDateString(language === "ar" ? "ar-AE" : "en-US", { month: "short", day: "numeric" });
}

function getTransferIcon(item) {
  if (item.type === "copyTrading") return TrendingUp;
  if (item.type === "staking") return Lock;
  if (item.direction === "in") return ArrowDownToLine;
  if (item.direction === "out") return ArrowUpFromLine;
  return ArrowLeftRight;
}

function getStatusBadge(status, t) {
  const configs = {
    PENDING: { label: t.pending, className: "bg-amber-100 text-amber-700 border-amber-200" },
    PENDING_SETTLEMENT: { label: t.pendingSettlement, className: "bg-blue-100 text-blue-700 border-blue-200" },
    PENDING_APPROVAL: { label: t.pending, className: "bg-amber-100 text-amber-700 border-amber-200" },
    PROCESSING: { label: t.pending, className: "bg-amber-100 text-amber-700 border-amber-200" },
    COMPLETED: { label: t.completed, className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    ACTIVE: { label: t.active, className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    FAILED: { label: t.failed, className: "bg-rose-100 text-rose-700 border-rose-200" },
    CANCELED: { label: t.canceled, className: "bg-gray-100 text-gray-700 border-gray-200" },
    CANCELLED: { label: t.canceled, className: "bg-gray-100 text-gray-700 border-gray-200" }
  };
  const config = configs[status] || { label: status, className: "bg-gray-100 text-gray-700" };
  return <Badge variant="outline" className={`text-[10px] ${config.className}`}>{config.label}</Badge>;
}

export default function RecentTransfersCard({ language = "en", limit = 5, onViewAll }) {
  const t = translations[language] || translations.en;
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState([]);

  const loadTransfers = async () => {
    setLoading(true);
    try {
      // Fetch all recent activities in parallel (reuse existing functions)
      const [copyTradingRes, stakingRes, walletDeposits, walletWithdrawals, ledgerRes] = await Promise.all([
        base44.functions.invoke("copyTradingUser", { action: "getAllocations" }),
        base44.functions.invoke("stakingUser", { action: "getPositions" }),
        base44.functions.invoke("wallet", { action: "getTransactions", type: "deposit", status: "completed", limit: 20 }),
        base44.functions.invoke("wallet", { action: "getTransactions", type: "withdrawal", limit: 20 }),
        base44.functions.invoke("ledgerWithdrawal", { action: "list", limit: 20 })
      ]);

      const items = [];

      // Copy trading allocations
      const allocations = copyTradingRes.data?.ok ? (copyTradingRes.data.data || []) : [];
      for (const alloc of allocations.slice(0, 10)) {
        items.push({
          id: `ct_${alloc.id}`,
          type: "copyTrading",
          direction: "in",
          amount: alloc.amount,
          currency: "USDT",
          status: alloc.status,
          label: t.copyTrading,
          sublabel: alloc.status === "PENDING_SETTLEMENT" ? t.pendingSettlement : (alloc.status === "ACTIVE" ? t.toMainPool : ""),
          date: alloc.created_at || alloc.created_date,
          settledAt: alloc.settled_at
        });
      }

      // Staking positions
      const positions = stakingRes.data?.ok ? (stakingRes.data.positions || []) : [];
      for (const pos of positions.slice(0, 10)) {
        items.push({
          id: `stk_${pos.id}`,
          type: "staking",
          direction: "in",
          amount: pos.principal_amount,
          currency: pos.currency || "USDT",
          status: pos.status,
          label: t.staking,
          sublabel: pos.plan_key,
          date: pos.created_at || pos.created_date
        });
      }

      // Wallet deposits
      const deposits = walletDeposits.data?.success ? (walletDeposits.data.data || []) : [];
      for (const tx of deposits.slice(0, 10)) {
        items.push({
          id: `wdp_${tx.id}`,
          type: "wallet",
          direction: "in",
          amount: tx.amount,
          currency: tx.currency || "USDT",
          status: (tx.status || '').toUpperCase(),
          label: t.deposit,
          sublabel: tx.network || '',
          date: tx.created_date
        });
      }

      // Wallet withdrawals (pending/failed/completed)
      const withdrawals = walletWithdrawals.data?.success ? (walletWithdrawals.data.data || []) : [];
      for (const tx of withdrawals.slice(0, 10)) {
        items.push({
          id: `wwd_${tx.id}`,
          type: "wallet",
          direction: "out",
          amount: Math.abs(tx.amount),
          currency: tx.currency || "USDT",
          status: (tx.status || '').toUpperCase(),
          label: t.withdrawal,
          sublabel: tx.network || '',
          date: tx.created_date
        });
      }

      // Ledger withdrawals (insider ledger mechanism) -> map APPROVED to COMPLETED for UI
      const ledger = ledgerRes.data?.ok ? (ledgerRes.data.data || ledgerRes.data || []) : [];
      for (const w of ledger.slice(0, 10)) {
        items.push({
          id: `lwd_${w.id}`,
          type: "wallet",
          direction: "out",
          amount: w.amount,
          currency: w.asset || "USDT",
          status: (w.status === 'APPROVED' ? 'COMPLETED' : (w.status || '')).toUpperCase(),
          label: t.withdrawal,
          sublabel: w.network || '',
          date: w.created_date
        });
      }

      // Sort by date descending
      items.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransfers(items.slice(0, limit));
    } catch (err) {
      console.error("Failed to load transfers:", err);
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransfers();
  }, [limit]);

  // Subscribe to copy trading allocation changes
  useEffect(() => {
    const unsubscribe = base44.entities.CopyTradingAllocation.subscribe((event) => {
      // Refresh on any change
      loadTransfers();
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-blue-600" />
            {t.recentTransfers}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-blue-600" />
            {t.recentTransfers}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={loadTransfers} className="h-8 w-8 p-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {transfers.length === 0 ? (
          <div className="text-center py-8">
            <ArrowLeftRight className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">{t.noTransfers}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transfers.map((item) => {
              const Icon = getTransferIcon(item);
              const iconBg = item.type === "copyTrading" ? "bg-blue-100 text-blue-600" :
                            item.type === "staking" ? "bg-amber-100 text-amber-600" :
                            item.direction === "in" ? "bg-emerald-100 text-emerald-600" :
                            "bg-rose-100 text-rose-600";

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${iconBg}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground text-sm">{item.label}</span>
                      {getStatusBadge(item.status, t)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{formatRelativeTime(item.date, language)}</span>
                      {item.sublabel && (
                        <>
                          <span className="text-muted-foreground/50">•</span>
                          <span>{item.sublabel}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium font-mono text-sm ${item.direction === "in" ? "text-emerald-600" : "text-rose-600"}`}>
                      {item.direction === "in" ? "+" : "-"}{item.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.currency}</p>
                  </div>
                </div>
              );
            })}
            {onViewAll && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onViewAll}
                className="w-full mt-2 text-muted-foreground hover:text-foreground"
              >
                {t.viewAll}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

RecentTransfersCard.propTypes = {
  language: PropTypes.string,
  limit: PropTypes.number,
  onViewAll: PropTypes.func
};