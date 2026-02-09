import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, Lock, PlusCircle, RefreshCw, ArrowDownToLine } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import AllocationModal from "./AllocationModal";
import AutoTradeSettings from "./AutoTradeSettings";

// Format number with English digits always (even in Arabic UI)
function formatUsdt(val) {
  if (val === null || val === undefined || !Number.isFinite(val)) return "0.00";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function formatDate(dateStr, language = "en") {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString(language === "ar" ? "ar-AE" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

const t = {
  en: {
    title: "Copy Trading",
    subtitle: "Follow expert signals automatically",
    available: "Available Balance",
    allocated: "Allocated to Signals",
    totalPnl: "Total P&L",
    addFunds: "Add USDT",
    refresh: "Refresh",
    recentAllocations: "Allocations",
    noAllocations: "No allocations yet",
    deposited: "Deposited",
  },
  ar: {
    title: "نسخ التداول",
    subtitle: "تابع إشارات الخبراء تلقائياً",
    available: "الرصيد المتاح",
    allocated: "المخصص للإشارات",
    totalPnl: "إجمالي الربح/الخسارة",
    addFunds: "إضافة USDT",
    refresh: "تحديث",
    recentAllocations: "التخصيصات",
    noAllocations: "لا توجد تخصيصات",
    deposited: "إيداع",
  }
};

const ledgerKindLabels = {
  en: {
    CREDIT: "Credit",
    DEBIT: "Debit",
    PNL: "P&L",
    ALLOCATION: "Allocation",
    TRANSFER: "Transfer",
  },
  ar: {
    CREDIT: "إيداع",
    DEBIT: "سحب",
    PNL: "أرباح",
    ALLOCATION: "تخصيص",
    TRANSFER: "تحويل",
  }
};

const ledgerKindColors = {
  CREDIT: "bg-emerald-500/10 text-emerald-500",
  DEBIT: "bg-rose-500/10 text-rose-500",
  PNL: "bg-blue-500/10 text-blue-500",
  ALLOCATION: "bg-amber-500/10 text-amber-600",
  TRANSFER: "bg-slate-500/10 text-slate-500",
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
    return gated(key, () => base44.functions.invoke("copyTradingUser", { action, ...extra }), { minIntervalMs: 5000 });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [walletRes, ledgerRes, configRes] = await Promise.all([
        invokeWithRetry("getWallet"),
        invokeWithRetry("getLedger", { limit: 20 }),
        invokeWithRetry("getConfig"),
      ]);

      setWallet(walletRes?.data?.ok ? walletRes.data.data || null : null);
      setLedgerEntries(Array.isArray(ledgerRes?.data?.data) && ledgerRes?.data?.ok ? ledgerRes.data.data : []);
      if (configRes?.data?.ok) {
        setConfig(configRes.data.data || null);
      }
    } catch (err) {
      console.error("[CopyTradingDashboard] loadData failed", err);
      toast.error(isRTL ? "تعذر تحديث المحفظة" : "Failed to refresh wallet");
    } finally {
      setLoading(false);
    }
  }, [invokeWithRetry, isRTL]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const availableBalance = Number(wallet?.available_balance ?? liveAccount?.availableBalance ?? 0);
  const lockedBalance = Number(wallet?.locked_balance ?? 0);
  const totalEquity = Number.isFinite(Number(wallet?.total_equity))
    ? Number(wallet.total_equity)
    : availableBalance + lockedBalance;
  const lifetimePnl = Number(wallet?.lifetime_pnl ?? liveAccount?.unrealizedPnl ?? 0);
  const lifetimeDeposited = Number(wallet?.lifetime_deposited ?? 0);

  const handleAllocationSuccess = useCallback(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-4xl mx-auto p-5 space-y-5" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">{labels.title}</h2>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{labels.subtitle}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Total Equity - Hero Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1520] via-[#0f1d2a] to-[#0d262d] border border-white/5 p-5 shadow-lg shadow-black/10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">
              {language === "ar" ? "إجمالي الحقوق" : "Total Equity"}
            </span>
          </div>
          <p className="text-[32px] font-bold text-white font-mono tracking-tighter leading-none">
            {formatUsdt(totalEquity)}
            <span className="text-[11px] font-normal text-white/60 ml-1.5">USDT</span>
          </p>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="bg-white/5 backdrop-blur-sm px-2.5 py-1.5 rounded-lg text-[10px] border border-white/10">
              <span className="text-white/60">{labels.available}: </span>
              <span className="font-mono font-semibold text-white">{formatUsdt(availableBalance)}</span>
            </div>
            <div className="bg-white/5 backdrop-blur-sm px-2.5 py-1.5 rounded-lg text-[10px] border border-white/10">
              <span className="text-white/60">{labels.deposited}: </span>
              <span className="font-mono font-semibold text-white">{formatUsdt(lifetimeDeposited)}</span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-card/95 backdrop-blur-sm border border-border/70 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-3.5 h-3.5 text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-semibold">{labels.allocated}</span>
            </div>
            <p className="text-xl font-bold text-foreground font-mono tracking-tight">
              {formatUsdt(lockedBalance)}
            </p>
          </div>

          <div
            className={`rounded-2xl p-4 border shadow-sm ${
              lifetimePnl >= 0 ? "bg-emerald-500/[0.05] border-emerald-500/15" : "bg-rose-500/[0.05] border-rose-500/15"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className={`w-3.5 h-3.5 ${lifetimePnl >= 0 ? "text-emerald-500/70" : "text-rose-500/70"}`} />
              <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-semibold">{labels.totalPnl}</span>
            </div>
            <p
              className={`text-xl font-bold font-mono tracking-tight ${
                lifetimePnl >= 0 ? "text-emerald-500" : "text-rose-500"
              }`}
            >
              {lifetimePnl >= 0 ? "+" : ""}
              {formatUsdt(lifetimePnl)}
            </p>
          </div>
        </div>

        {/* Add Funds + Deposit Buttons */}
        <div className="flex gap-2.5 flex-col sm:flex-row">
          <Button
            onClick={() => setAllocationModalOpen(true)}
            className="flex-1 h-11 rounded-2xl text-[13px] font-semibold shadow-md shadow-black/10"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            {labels.addFunds}
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-2xl text-[13px] font-semibold px-4">
            <Link to={`${createPageUrl("Wallet")}?page=deposit`}>
              <ArrowDownToLine className="w-4 h-4 mr-1.5" />
              {isRTL ? "إيداع" : "Deposit"}
            </Link>
          </Button>
        </div>

        {/* Auto-Trade Settings - Inline */}
        <div className="rounded-2xl border border-border/70 bg-card/95 p-3 shadow-sm">
          <AutoTradeSettings language={language} />
        </div>

        {/* Recent Activity */}
        {ledgerEntries.length > 0 ? (
          <div>
            <h3 className="text-[12px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">
              {labels.recentAllocations}
            </h3>
            <div className="space-y-1.5">
              {ledgerEntries.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between bg-card/90 rounded-xl px-3.5 py-2.5 border border-border/70 shadow-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <Badge
                      className={`${ledgerKindColors[entry.kind] || "bg-gray-500/10 text-gray-500"} rounded-md text-[9px] font-bold`}
                      variant="outline"
                    >
                      {ledgerKindLabels[language]?.[entry.kind] || entry.kind}
                    </Badge>
                    <span className="text-muted-foreground/50 text-[10px] font-medium">
                      {formatDate(entry.created_at || entry.created_date, language)}
                    </span>
                  </div>
                  <span
                    className={`font-mono font-semibold text-[13px] tabular-nums ${
                      entry.kind === "CREDIT" ? "text-emerald-500" : entry.kind === "DEBIT" ? "text-rose-500" : "text-foreground"
                    }`}
                  >
                    {entry.kind === "CREDIT" ? "+" : entry.kind === "DEBIT" ? "-" : ""}
                    {formatUsdt(Math.abs(entry.amount))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-4 text-center text-sm text-muted-foreground/70">
            {labels.noAllocations}
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
    </div>
  );
}

CopyTradingDashboard.propTypes = {
  language: PropTypes.string,
  liveAccount: PropTypes.object,
};
