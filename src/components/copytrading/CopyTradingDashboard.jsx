import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, TrendingUp, Lock, PlusCircle, RefreshCw, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import AllocationModal from "./AllocationModal";

function formatUsdt(val, language = "en") {
  if (val === null || val === undefined || !Number.isFinite(val)) return "0.00";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

const t = {
  en: {
    title: "Copy Trading",
    subtitle: "Follow expert signals automatically",
    available: "Available Balance",
    allocated: "Allocated to Signals",
    totalPnl: "Total P&L",
    riskProfile: "Risk Profile",
    addFunds: "Add USDT to Copy Trading",
    comingSoon: "Coming Soon",
    signalsPlaceholder: "Expert signals will appear here once enabled.",
    noBalance: "No balance yet",
    addFundsDesc: "Deposit USDT to start copy trading",
    low: "Low Risk",
    medium: "Medium Risk",
    high: "High Risk",
    refresh: "Refresh",
    recentActivity: "Recent Activity",
    noActivity: "No activity yet",
    pending: "Pending",
    active: "Active",
    failed: "Failed",
    allocation: "Allocation",
    withdrawal: "Withdrawal",
  },
  ar: {
    title: "نسخ التداول",
    subtitle: "تابع إشارات الخبراء تلقائياً",
    available: "الرصيد المتاح",
    allocated: "المخصص للإشارات",
    totalPnl: "إجمالي الربح/الخسارة",
    riskProfile: "ملف المخاطر",
    addFunds: "إضافة USDT لنسخ التداول",
    comingSoon: "قريباً",
    signalsPlaceholder: "ستظهر إشارات الخبراء هنا عند التفعيل.",
    noBalance: "لا يوجد رصيد",
    addFundsDesc: "قم بإيداع USDT لبدء نسخ التداول",
    low: "مخاطر منخفضة",
    medium: "مخاطر متوسطة",
    high: "مخاطر عالية",
    refresh: "تحديث",
    recentActivity: "النشاط الأخير",
    noActivity: "لا يوجد نشاط",
    pending: "قيد الانتظار",
    active: "نشط",
    failed: "فشل",
    allocation: "تخصيص",
    withdrawal: "سحب",
  }
};

export default function CopyTradingDashboard({ language = "en", liveAccount }) {
  const labels = t[language] || t.en;
  const isRTL = language === "ar";

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [riskProfile, setRiskProfile] = useState("medium");
  const [allocationModalOpen, setAllocationModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, walletRes, allocationsRes, ledgerRes] = await Promise.all([
        base44.functions.invoke("copyTradingUser", { action: "getConfig" }),
        base44.functions.invoke("copyTradingUser", { action: "getWallet" }),
        base44.functions.invoke("copyTradingUser", { action: "getAllocations" }),
        base44.functions.invoke("copyTradingUser", { action: "getLedger", limit: 10 }),
      ]);

      if (configRes.data?.ok) setConfig(configRes.data.data);
      if (walletRes.data?.ok) setWallet(walletRes.data.data);
      if (allocationsRes.data?.ok) setAllocations(allocationsRes.data.data || []);
      if (ledgerRes.data?.ok) setLedger(ledgerRes.data.data || []);
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
    toast.success(labels.pending);
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
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">{labels.available}</span>
            </div>
            <p className="text-xl font-bold text-foreground font-mono">
              {formatUsdt(availableBalance, language)} <span className="text-xs text-muted-foreground">USDT</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{labels.allocated}</span>
            </div>
            <p className="text-xl font-bold text-foreground font-mono">
              {formatUsdt(lockedBalance, language)} <span className="text-xs text-muted-foreground">USDT</span>
            </p>
          </CardContent>
        </Card>

        <Card className={lifetimePnl >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className={`w-4 h-4 ${lifetimePnl >= 0 ? "text-emerald-500" : "text-rose-500"}`} />
              <span className="text-xs text-muted-foreground">{labels.totalPnl}</span>
            </div>
            <p className={`text-xl font-bold font-mono ${lifetimePnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {lifetimePnl >= 0 ? "+" : ""}{formatUsdt(lifetimePnl, language)} <span className="text-xs">USDT</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Risk Profile + Add Funds */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-2 block">{labels.riskProfile}</label>
          <Select value={riskProfile} onValueChange={setRiskProfile}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">{labels.low}</SelectItem>
              <SelectItem value="medium">{labels.medium}</SelectItem>
              <SelectItem value="high">{labels.high}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 flex items-end">
          <Button 
            onClick={() => setAllocationModalOpen(true)} 
            className="w-full bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            {labels.addFunds}
          </Button>
        </div>
      </div>

      {/* Signals Placeholder */}
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{labels.signalsPlaceholder}</p>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3">{labels.recentActivity}</h3>
          {allocations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">{labels.noActivity}</p>
          ) : (
            <div className="space-y-2">
              {allocations.slice(0, 5).map((alloc) => (
                <div key={alloc.id} className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[alloc.status] || ""} variant="outline">
                      {labels[alloc.status.toLowerCase()] || alloc.status}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {new Date(alloc.created_at || alloc.created_date).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="font-mono font-medium">
                    {formatUsdt(alloc.amount, language)} USDT
                  </span>
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