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

  const invokeWithRetry = useCallback(async (action, extra = {}) => {
    const { gated } = await import("@/components/utils/apiGate");
    const key = `copyTradingUser:${action}`;
    const res = await gated(key, () => base44.functions.invoke("copyTradingUser", { action, ...extra }), { minIntervalMs: 5000 });
    return res;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Stagger to avoid 429: config+wallet first, then ledger
      const [configRes, walletRes] = await Promise.all([
        invokeWithRetry("getConfig"),
        invokeWithRetry("getWallet"),
      ]);

      if (configRes?.data?.ok) setConfig(configRes.data.data);
      if (walletRes?.data?.ok) setWallet(walletRes.data.data);

      const ledgerRes = await invokeWithRetry("getLedger", { limit: 10 });
      if (ledgerRes?.data?.ok) setLedgerEntries(ledgerRes.data.data || []);
    } catch (err) {
      console.error("Failed to load copy trading data:", err);
    } finally {
      setLoading(false);
    }
  }, [invokeWithRetry]);

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
    <div className="h-full overflow-auto p-5 space-y-5" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground tracking-tight">{labels.title}</h2>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">{labels.subtitle}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Total Equity - Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-transparent border border-primary/10 p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">{language === "ar" ? "إجمالي الحقوق" : "Total Equity"}</span>
        </div>
        <p className="text-[32px] font-bold text-foreground font-mono tracking-tighter leading-none">
          {formatUsdt(totalEquity)}
          <span className="text-[11px] font-normal text-muted-foreground/40 ml-1.5">USDT</span>
        </p>
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-background/60 backdrop-blur-sm px-2.5 py-1.5 rounded-lg text-[10px]">
            <span className="text-muted-foreground/60">{labels.available}: </span>
            <span className="font-mono font-semibold text-foreground">{formatUsdt(availableBalance)}</span>
          </div>
          <div className="bg-background/60 backdrop-blur-sm px-2.5 py-1.5 rounded-lg text-[10px]">
            <span className="text-muted-foreground/60">{language === "ar" ? "إيداع" : "Deposited"}: </span>
            <span className="font-mono font-semibold text-foreground">{formatUsdt(wallet?.lifetime_deposited || 0)}</span>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card/80 backdrop-blur-sm border border-border/40 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">{labels.allocated}</span>
          </div>
          <p className="text-xl font-bold text-foreground font-mono tracking-tight">
            {formatUsdt(lockedBalance)}
          </p>
        </div>

        <div className={`rounded-2xl p-4 border ${lifetimePnl >= 0 ? "bg-emerald-500/[0.04] border-emerald-500/10" : "bg-rose-500/[0.04] border-rose-500/10"}`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className={`w-3.5 h-3.5 ${lifetimePnl >= 0 ? "text-emerald-500/60" : "text-rose-500/60"}`} />
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">{labels.totalPnl}</span>
          </div>
          <p className={`text-xl font-bold font-mono tracking-tight ${lifetimePnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            {lifetimePnl >= 0 ? "+" : ""}{formatUsdt(lifetimePnl)}
          </p>
        </div>
      </div>

      {/* Add Funds Button */}
      <Button 
        onClick={() => setAllocationModalOpen(true)} 
        className="w-full h-11 rounded-2xl text-[13px] font-semibold shadow-md shadow-primary/20"
      >
        <PlusCircle className="w-4 h-4 mr-2" />
        {labels.addFunds}
      </Button>

      {/* Auto-Trade Settings - Inline */}
      <AutoTradeSettings language={language} />

      {/* Recent Activity */}
      {ledgerEntries.length > 0 && (
        <div>
          <h3 className="text-[12px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-3">{labels.recentAllocations}</h3>
          <div className="space-y-1.5">
            {ledgerEntries.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between bg-muted/20 rounded-xl px-3.5 py-2.5 transition-colors hover:bg-muted/30">
                <div className="flex items-center gap-2.5">
                  <Badge className={`${ledgerKindColors[entry.kind] || "bg-gray-500/10 text-gray-500"} rounded-md text-[9px] font-bold`} variant="outline">
                    {ledgerKindLabels[language]?.[entry.kind] || entry.kind}
                  </Badge>
                  <span className="text-muted-foreground/40 text-[10px] font-medium">
                    {formatDate(entry.created_at || entry.created_date)}
                  </span>
                </div>
                <span className={`font-mono font-semibold text-[13px] tabular-nums ${entry.kind === 'CREDIT' ? 'text-emerald-500' : entry.kind === 'DEBIT' ? 'text-rose-500' : 'text-foreground'}`}>
                  {entry.kind === 'CREDIT' ? '+' : entry.kind === 'DEBIT' ? '-' : ''}{formatUsdt(Math.abs(entry.amount))}
                </span>
              </div>
            ))}
          </div>
        </div>
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