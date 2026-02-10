import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const translations = {
  en: {
    recentDeposits: "Recent Deposits",
    noDeposits: "No deposits yet",
    pending: "Processing",
    pendingSettlement: "Settling",
    active: "Settled",
    failed: "Failed",
    canceled: "Canceled"
  },
  ar: {
    recentDeposits: "الإيداعات الأخيرة",
    noDeposits: "لا توجد إيداعات",
    pending: "قيد المعالجة",
    pendingSettlement: "قيد التسوية",
    active: "مكتمل",
    failed: "فشل",
    canceled: "ملغى"
  }
};

function formatRelativeTime(dateStr, language) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return language === "ar" ? "الآن" : "Just now";
  if (diffMins < 60) return language === "ar" ? `منذ ${diffMins} د` : `${diffMins}m ago`;
  if (diffHours < 24) return language === "ar" ? `منذ ${diffHours} س` : `${diffHours}h ago`;
  if (diffDays < 7) return language === "ar" ? `منذ ${diffDays} ي` : `${diffDays}d ago`;
  return date.toLocaleDateString(language === "ar" ? "ar-AE" : "en-US", { month: "short", day: "numeric" });
}

function getStatusConfig(status, t) {
  const configs = {
    PENDING: { label: t.pending, icon: Loader2, className: "bg-amber-100 text-amber-700", spin: true },
    PENDING_SETTLEMENT: { label: t.pendingSettlement, icon: Clock, className: "bg-blue-100 text-blue-700", spin: false },
    ACTIVE: { label: t.active, icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700", spin: false },
    FAILED: { label: t.failed, icon: XCircle, className: "bg-rose-100 text-rose-700", spin: false },
    CANCELED: { label: t.canceled, icon: XCircle, className: "bg-gray-100 text-gray-600", spin: false }
  };
  return configs[status] || configs.PENDING;
}

export default function CopyTradingDepositHistory({ language = "en", limit = 5 }) {
  const t = translations[language] || translations.en;
  const [loading, setLoading] = useState(true);
  const [deposits, setDeposits] = useState([]);

  const loadDeposits = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("copyTradingUser", { action: "getAllocations" });
      const allocations = res.data?.ok ? (res.data.data || []) : [];
      // Sort by date descending
      allocations.sort((a, b) => new Date(b.created_at || b.created_date).getTime() - new Date(a.created_at || a.created_date).getTime());
      setDeposits(allocations.slice(0, limit));
    } catch (err) {
      console.error("Failed to load deposits:", err);
      setDeposits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeposits();
  }, [limit]);

  // Subscribe to allocation changes for real-time updates
  useEffect(() => {
    const unsubscribe = base44.entities.CopyTradingAllocation.subscribe((event) => {
      loadDeposits();
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2 mt-3">
        <p className="text-xs font-medium text-slate-500">{t.recentDeposits}</p>
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (deposits.length === 0) {
    return (
      <div className="mt-3 p-3 rounded-lg bg-slate-50 text-center">
        <p className="text-xs text-slate-500">{t.noDeposits}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{t.recentDeposits}</p>
        <Button variant="ghost" size="sm" onClick={loadDeposits} className="h-6 w-6 p-0">
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
      {deposits.map((deposit) => {
        const statusConfig = getStatusConfig(deposit.status, t);
        const StatusIcon = statusConfig.icon;
        return (
          <div
            key={deposit.id}
            className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <StatusIcon className={`h-4 w-4 ${statusConfig.spin ? 'animate-spin' : ''} ${statusConfig.className.includes('emerald') ? 'text-emerald-600' : statusConfig.className.includes('rose') ? 'text-rose-600' : statusConfig.className.includes('blue') ? 'text-blue-600' : 'text-amber-600'}`} />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  +{deposit.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT
                </p>
                <p className="text-[10px] text-slate-500">{formatRelativeTime(deposit.created_at || deposit.created_date, language)}</p>
              </div>
            </div>
            <Badge variant="outline" className={`text-[9px] ${statusConfig.className}`}>
              {statusConfig.label}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

CopyTradingDepositHistory.propTypes = {
  language: PropTypes.string,
  limit: PropTypes.number
};