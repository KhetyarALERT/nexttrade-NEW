import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, Lock, PlusCircle, RefreshCw, Sparkles, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AllocationModal from "./AllocationModal";

// Format number with English digits always (even in Arabic UI)
function formatUsdt(val) {
  if (val === null || val === undefined || !Number.isFinite(val)) return "0.00";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  // Always use English locale for consistent digits
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const t = {
  en: {
    title: "Copy Trading",
    subtitle: "Follow expert signals automatically",
    available: "Available Balance",
    allocated: "Allocated to Signals",
    totalPnl: "Total P&L",
    addFunds: "Add USDT",
    comingSoon: "Coming Soon",
    signalsPlaceholder: "Expert signals will appear here once enabled.",
    noBalance: "No balance yet",
    addFundsDesc: "Deposit USDT to start copy trading",
    refresh: "Refresh",
    recentAllocations: "Allocations",
    noAllocations: "No allocations yet",
    pending: "Pending",
    active: "Active",
    failed: "Failed",
    canceled: "Canceled",
    cancel: "Cancel",
    canceling: "Canceling...",
  },
  ar: {
    title: "نسخ التداول",
    subtitle: "تابع إشارات الخبراء تلقائياً",
    available: "الرصيد المتاح",
    allocated: "المخصص للإشارات",
    totalPnl: "إجمالي الربح/الخسارة",
    addFunds: "إضافة USDT",
    comingSoon: "قريباً",
    signalsPlaceholder: "ستظهر إشارات الخبراء هنا عند التفعيل.",
    noBalance: "لا يوجد رصيد",
    addFundsDesc: "قم بإيداع USDT لبدء نسخ التداول",
    refresh: "تحديث",
    recentAllocations: "التخصيصات",
    noAllocations: "لا توجد تخصيصات",
    pending: "قيد الانتظار",
    active: "نشط",
    failed: "فشل",
    canceled: "ملغي",
    cancel: "إلغاء",
    canceling: "جاري الإلغاء...",
  }
};

export default function CopyTradingDashboard({ language = "en", liveAccount }) {
  const labels = t[language] || t.en;
  const isRTL = language === "ar";

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [allocationModalOpen, setAllocationModalOpen] = useState(false);
  const [cancelingId, setCancelingId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, walletRes, allocationsRes] = await Promise.all([
        base44.functions.invoke("copyTradingUser", { action: "getConfig" }),
        base44.functions.invoke("copyTradingUser", { action: "getWallet" }),
        base44.functions.invoke("copyTradingUser", { action: "getAllocations" }),
      ]);

      if (configRes.data?.ok) setConfig(configRes.data.data);
      if (walletRes.data?.ok) setWallet(walletRes.data.data);
      if (allocationsRes.data?.ok) setAllocations(allocationsRes.data.data || []);
    } catch (err) {
      console.error("Failed to load copy trading data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAllocationSuccess = () => {
    setAllocationModalOpen(false);
    loadData();
    toast.success(language === "ar" ? "تم إنشاء طلب التخصيص" : "Allocation request created");
  };

  const handleCancelAllocation = async (allocationId) => {
    setCancelingId(allocationId);
    try {
      const res = await base44.functions.invoke("copyTradingUser", {
        action: "cancelAllocation",
        allocationId
      });

      if (res.data?.ok) {
        toast.success(language === "ar" ? "تم إلغاء التخصيص" : "Allocation cancelled");
        loadData();
      } else {
        toast.error(res.data?.error?.message || "Failed to cancel");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCancelingId(null);
    }
  };

  const availableBalance = wallet?.available_balance || 0;
  const lockedBalance = wallet?.locked_balance || 0;
  const lifetimePnl = wallet?.lifetime_pnl || 0;

  const statusColors = {
    PENDING: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    ACTIVE: "bg-green-500/10 text-green-500 border-green-500/20",
    FAILED: "bg-red-500/10 text-red-500 border-red-500/20",
    CANCELED: "bg-gray-500/10 text-gray-500 border-gray-500/20"
  };

  const statusLabels = {
    PENDING: labels.pending,
    ACTIVE: labels.active,
    FAILED: labels.failed,
    CANCELED: labels.canceled
  };

  if (!config?.enabled) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Card className="max-w-md w-full border-dashed">
          <CardContent className="p-8 text-center">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">{labels.comingSoon}</h3>
            <p className="text-sm text-muted-foreground">{labels.signalsPlaceholder}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">{labels.title}</h2>
          <p className="text-xs text-muted-foreground">{labels.subtitle}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">{labels.available}</span>
            </div>
            <p className="text-2xl font-bold text-foreground font-mono">
              {formatUsdt(availableBalance)} <span className="text-xs text-muted-foreground">USDT</span>
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-3 h-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">{labels.allocated}</span>
              </div>
              <p className="text-lg font-bold text-foreground font-mono">
                {formatUsdt(lockedBalance)}
              </p>
            </CardContent>
          </Card>

          <Card className={lifetimePnl >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className={`w-3 h-3 ${lifetimePnl >= 0 ? "text-emerald-500" : "text-rose-500"}`} />
                <span className="text-[11px] text-muted-foreground">{labels.totalPnl}</span>
              </div>
              <p className={`text-lg font-bold font-mono ${lifetimePnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {lifetimePnl >= 0 ? "+" : ""}{formatUsdt(lifetimePnl)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Funds Button */}
      <Button 
        onClick={() => setAllocationModalOpen(true)} 
        className="w-full bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90"
      >
        <PlusCircle className="w-4 h-4 mr-2" />
        {labels.addFunds}
      </Button>

      {/* Signals Placeholder */}
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Sparkles className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">{labels.signalsPlaceholder}</p>
        </CardContent>
      </Card>

      {/* Allocations */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3">{labels.recentAllocations}</h3>
          {allocations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">{labels.noAllocations}</p>
          ) : (
            <div className="space-y-2">
              {allocations.slice(0, 10).map((alloc) => (
                <div key={alloc.id} className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[alloc.status] || ""} variant="outline">
                      {statusLabels[alloc.status] || alloc.status}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(alloc.created_at || alloc.created_date, language)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">
                      {formatUsdt(alloc.amount)} USDT
                    </span>
                    {alloc.status === "PENDING" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleCancelAllocation(alloc.id)}
                        disabled={cancelingId === alloc.id}
                      >
                        {cancelingId === alloc.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Allocation Modal */}
      <AllocationModal
        open={allocationModalOpen}
        onOpenChange={setAllocationModalOpen}
        onSuccess={handleAllocationSuccess}
        liveAccount={liveAccount}
        config={config}
        language={language}
      />
    </div>
  );
}

CopyTradingDashboard.propTypes = {
  language: PropTypes.string,
  liveAccount: PropTypes.object,
};