import { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, PlusCircle, RefreshCw, ArrowDownToLine, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import AllocationModal from "./AllocationModal";
import CopyHistorySection from "./CopyHistorySection";

function formatUsdt(val) {
  if (val === null || val === undefined || !Number.isFinite(val)) return "0.00";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const t = {
  en: {
    wallet: "Wallet",
    allocations: "Allocations",
    available: "Available Balance",
    allocated: "Allocated to Signals",
    totalPnl: "Total P&L",
    addFunds: "Add USDT",
    noAllocations: "No allocations yet",
    pending: "Pending",
    active: "Active",
    deposit: "Deposit",
    withdraw: "Withdraw",
    locked: "In Trade",
    unlocked: "Unlocked",
    commission: "Commission",
  },
  ar: {
    wallet: "المحفظة",
    allocations: "التخصيصات",
    available: "الرصيد المتاح",
    allocated: "المخصص للإشارات",
    totalPnl: "إجمالي الربح/الخسارة",
    addFunds: "إضافة USDT",
    noAllocations: "لا توجد تخصيصات",
    pending: "قيد الانتظار",
    active: "نشط",
    deposit: "إيداع",
    withdraw: "سحب",
    locked: "قيد التداول",
    unlocked: "مفتوح",
    commission: "عمولة",
  }
};

const ledgerKindColors = {
  CREDIT: "bg-green-500/10 text-green-500 border-green-500/20",
  DEBIT: "bg-red-500/10 text-red-500 border-red-500/20",
  MARGIN_LOCK: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  ALLOCATION_LOCK: "bg-blue-500/10 text-blue-500 border-blue-500/20", // Legacy support
  ALLOCATION_UNLOCK: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  COMMISSION: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  COMMISSION_OPEN: "bg-amber-500/10 text-amber-500 border-amber-500/20", // Legacy support
  COMMISSION_CLOSE: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  PNL: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  TOPUP_OKX: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  TOPUP_ADMIN: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

export default function CopyWalletPanel({ language = "en", liveAccount }) {
  const labels = t[language] || t.en;
  const isRTL = language === "ar";

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [allocationModalOpen, setAllocationModalOpen] = useState(false);
  const lastLoadTime = useRef(0);

  const invokeWithRetry = useCallback(async (action, extra = {}) => {
    const { gated } = await import("@/components/utils/apiGate");
    const key = `copyTradingUser:${action}`;
    const res = await gated(key, () => base44.functions.invoke("copyTradingUser", { action, ...extra }), { minIntervalMs: 5000 });
    return res;
  }, []);

  const loadData = useCallback(async (force = false) => {
    if (document.hidden && !force) return;
    
    try {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return;
    } catch { return; }

    const now = Date.now();
    if (!force && now - lastLoadTime.current < 3000) return;
    lastLoadTime.current = now;

    setLoading(true);
    try {
      // Stagger calls to avoid 429: batch 1 then batch 2
      const [configRes, walletRes] = await Promise.all([
        invokeWithRetry("getConfig"),
        invokeWithRetry("getWallet"),
      ]);

      if (configRes?.data?.ok) setConfig(configRes.data.data);
      if (walletRes?.data?.ok) setWallet(walletRes.data.data);

      const [ledgerRes, allocationsRes] = await Promise.all([
        invokeWithRetry("getLedger", { limit: 20 }),
        invokeWithRetry("getAllocations").catch(() => ({ data: { ok: false } })),
      ]);

      if (ledgerRes?.data?.ok) setLedgerEntries(ledgerRes.data.data || []);
      if (allocationsRes?.data?.ok) setAllocations(allocationsRes.data.data || []);
    } catch (err) {
      console.error("Failed to load copy trading data:", err);
    } finally {
      setLoading(false);
    }
  }, [invokeWithRetry]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  const handleAllocationSuccess = () => {
    setTimeout(() => loadData(true), 1000);
  };

  const availableBalance = wallet?.available_balance || 0;
  const lockedBalance = wallet?.locked_balance || 0;
  const lifetimePnl = wallet?.lifetime_pnl || 0;

  const getLedgerLabel = (kind) => {
    const map = {
      CREDIT: labels.deposit,
      DEBIT: labels.withdraw,
      MARGIN_LOCK: labels.locked,
      ALLOCATION_LOCK: labels.locked,
      ALLOCATION_UNLOCK: labels.unlocked,
      COMMISSION: labels.commission,
      COMMISSION_OPEN: labels.commission,
      COMMISSION_CLOSE: labels.commission,
      PNL: "P&L",
      TOPUP_OKX: labels.deposit,
      TOPUP_ADMIN: labels.deposit,
    };
    return map[kind] || kind;
  };

  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div className="h-full overflow-hidden flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
      {loading ? (
        <div className="flex items-center justify-center h-full p-6">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
      {/* Balance Card - Clean */}
      <div className="px-4 py-5 space-y-3.5 shrink-0 border-b border-border/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">{labels.available}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => loadData(true)} disabled={loading}>
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        
        <p className="text-[28px] font-bold text-foreground font-mono tracking-tighter leading-none" style={{ direction: "ltr", unicodeBidi: "plaintext" }}>
          {formatUsdt(availableBalance)} <span className="text-[11px] font-normal text-muted-foreground/50">USDT</span>
        </p>

        {/* Unrealized PnL */}
        <div className="flex items-center gap-1.5">
          <TrendingUp className={`w-3 h-3 ${lifetimePnl >= 0 ? "text-emerald-500" : "text-rose-500"}`} />
          <span className="text-[10px] text-muted-foreground/60">{labels.totalPnl}</span>
          <span className={`font-mono font-semibold text-[12px] tabular-nums ${lifetimePnl >= 0 ? "text-emerald-500" : "text-rose-500"}`} style={{ direction: "ltr", unicodeBidi: "plaintext" }}>
            {lifetimePnl >= 0 ? "+" : ""}{formatUsdt(lifetimePnl)}
          </span>
        </div>

        {/* Collapsible details for advanced users */}
        {lockedBalance > 0 && (
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <button type="button" className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                <span>{isRTL ? "تفاصيل" : "Details"}</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", detailsOpen && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex items-center gap-3 mt-2 text-[10px]">
                <div className="flex items-center gap-1.5 bg-muted/20 px-2 py-1 rounded-md">
                  <span className="text-muted-foreground/60">{isRTL ? "مستخدم" : "Used Margin"}</span>
                  <span className="font-mono font-semibold text-foreground tabular-nums" style={{ direction: "ltr", unicodeBidi: "plaintext" }}>{formatUsdt(lockedBalance)}</span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={() => setAllocationModalOpen(true)} 
            className="flex-1 rounded-xl h-9 text-xs font-semibold shadow-sm shadow-primary/20"
            size="sm"
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
            {labels.addFunds}
          </Button>
          <Button 
            asChild
            variant="outline"
            className="rounded-xl h-9 text-xs font-semibold px-3"
            size="sm"
          >
            <Link to={`${createPageUrl("Wallet")}?page=deposit`}>
              <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5" />
              {labels.deposit}
            </Link>
          </Button>
        </div>
      </div>

      {/* Collapsible History Section */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <CopyHistorySection language={language} defaultOpen={false} />
      </div>

      <AllocationModal
        open={allocationModalOpen}
        onOpenChange={setAllocationModalOpen}
        onSuccess={handleAllocationSuccess}
        liveAccount={liveAccount}
        config={config}
        language={language}
      />
        </>
      )}
    </div>
  );
}

CopyWalletPanel.propTypes = {
  language: PropTypes.string,
  liveAccount: PropTypes.object,
};