import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, Lock, PlusCircle, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import AllocationModal from "./AllocationModal";
import AutoTradeSettings from "./AutoTradeSettings";

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

  }
};

export default function CopyTradingDashboard({ language = "en", liveAccount }) {
  const labels = t[language] || t.en;
  const isRTL = language === "ar";

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [allocationModalOpen, setAllocationModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, walletRes, ledgerRes] = await Promise.all([
        base44.functions.invoke("copyTradingUser", { action: "getConfig" }),
        base44.functions.invoke("copyTradingUser", { action: "getWallet" }),
        base44.functions.invoke("copyTradingUser", { action: "getLedger", limit: 10 }),
      ]);

      if (configRes.data?.ok) setConfig(configRes.data.data);
      if (walletRes.data?.ok) setWallet(walletRes.data.data);
      if (ledgerRes.data?.ok) setLedgerEntries(ledgerRes.data.data || []);
    } catch (err) {
      console.error("Failed to load copy trading data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data once on mount - no interval to prevent spam
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAllocationSuccess = (data) => {
    // Modal already closed by AllocationModal, just refresh data
    loadData();
  };



  const availableBalance = wallet?.available_balance || 0;
  const lockedBalance = wallet?.locked_balance || 0;
  const totalEquity = availableBalance + lockedBalance;
  const lifetimePnl = wallet?.lifetime_pnl || 0;

  const ledgerKindColors = {
    CREDIT: "bg-green-500/10 text-green-500 border-green-500/20",
    DEBIT: "bg-red-500/10 text-red-500 border-red-500/20",
    ALLOCATION_LOCK: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    ALLOCATION_UNLOCK: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    PNL: "bg-amber-500/10 text-amber-500 border-amber-500/20"
  };

  const ledgerKindLabels = {
    en: { CREDIT: "Deposit", DEBIT: "Withdraw", ALLOCATION_LOCK: "Locked", ALLOCATION_UNLOCK: "Unlocked", PNL: "P&L" },
    ar: { CREDIT: "إيداع", DEBIT: "سحب", ALLOCATION_LOCK: "مقفل", ALLOCATION_UNLOCK: "مفتوح", PNL: "ربح/خسارة" }
  };

  // Always show Copy Trading - even if config not loaded yet or disabled
  // Users can see their wallet but features may be limited
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
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
        {/* Total Equity Card (Primary) */}
        <Card className="bg-gradient-to-br from-primary/15 to-primary/5 border-primary/20 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-foreground/80">{language === "ar" ? "إجمالي الحقوق" : "Total Equity"}</span>
              </div>
              <Badge variant="outline" className="bg-background/50 text-[10px] font-normal">USDT</Badge>
            </div>
            <p className="text-3xl font-bold text-foreground font-mono tracking-tight">
              ${formatUsdt(totalEquity)}
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>{labels.available}: <span className="font-mono text-foreground">{formatUsdt(availableBalance)}</span></span>
              <span>•</span>
              <span>{language === "ar" ? "إيداع" : "Dep"}: <span className="font-mono text-foreground">{formatUsdt(wallet?.lifetime_deposited || 0)}</span></span>
            </div>
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

      {/* Auto-Trade Settings - Inline */}
      <AutoTradeSettings language={language} />

      {/* Recent Activity - Show ledger entries */}
      {ledgerEntries.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">{labels.recentAllocations}</h3>
            <div className="space-y-2">
              {ledgerEntries.slice(0, 5).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge className={ledgerKindColors[entry.kind] || "bg-gray-500/10 text-gray-500"} variant="outline">
                      {ledgerKindLabels[language]?.[entry.kind] || entry.kind}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(entry.created_at || entry.created_date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-medium ${entry.kind === 'CREDIT' ? 'text-green-500' : entry.kind === 'DEBIT' ? 'text-red-500' : ''}`}>
                      {entry.kind === 'CREDIT' ? '+' : entry.kind === 'DEBIT' ? '-' : ''}{formatUsdt(Math.abs(entry.amount))} USDT
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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