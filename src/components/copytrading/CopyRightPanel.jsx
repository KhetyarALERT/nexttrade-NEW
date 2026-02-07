import { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, PlusCircle, RefreshCw, ArrowDownToLine, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import AllocationModal from "./AllocationModal";
import CopyHistorySection from "./CopyHistorySection";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

function formatUsdt(val) {
  if (val === null || val === undefined || !Number.isFinite(val)) return "0.00";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

const t = {
  en: {
    available: "Available Balance",
    unrealizedPnl: "Unrealized PnL",
    addFunds: "Add USDT",
    deposit: "Deposit",
    details: "Details",
    allocated: "Allocated",
    deposited: "Total Deposited",
    totalPnl: "Lifetime P&L",
  },
  ar: {
    available: "الرصيد المتاح",
    unrealizedPnl: "الربح غير المحقق",
    addFunds: "إضافة USDT",
    deposit: "إيداع",
    details: "تفاصيل",
    allocated: "المخصص",
    deposited: "إجمالي الإيداعات",
    totalPnl: "إجمالي الربح",
  },
};

export default function CopyRightPanel({ language = "en", liveAccount, openPositionsCount = 0, unrealizedPnl = 0, onPositionClick }) {
  const labels = t[language] || t.en;
  const isRTL = language === "ar";

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [allocationModalOpen, setAllocationModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const lastLoadTime = useRef(0);

  const invokeWithRetry = useCallback(async (action, extra = {}) => {
    const { gated } = await import("@/components/utils/apiGate");
    const key = `copyRightPanel:${action}`;
    const res = await gated(key, () => base44.functions.invoke("copyTradingUser", { action, ...extra }), { minIntervalMs: 5000 });
    return res;
  }, []);

  const loadData = useCallback(async (force = false) => {
    if (document.hidden && !force) return;
    const now = Date.now();
    if (!force && now - lastLoadTime.current < 3000) return;
    lastLoadTime.current = now;

    setLoading(true);
    try {
      const [configRes, walletRes] = await Promise.all([
        invokeWithRetry("getConfig"),
        invokeWithRetry("getWallet"),
      ]);
      if (configRes?.data?.ok) setConfig(configRes.data.data);
      if (walletRes?.data?.ok) setWallet(walletRes.data.data);
    } catch (err) {
      console.error("[CopyRightPanel]", err);
    } finally {
      setLoading(false);
    }
  }, [invokeWithRetry]);

  useEffect(() => { loadData(true); }, [loadData]);

  const availableBalance = wallet?.available_balance || 0;
  const lockedBalance = wallet?.locked_balance || 0;
  const lifetimePnl = wallet?.lifetime_pnl || 0;
  const lifetimeDeposited = wallet?.lifetime_deposited || 0;
  const hasUnrealizedPnl = unrealizedPnl !== 0 && Number.isFinite(unrealizedPnl);

  return (
    <div className="h-full overflow-y-auto flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
      {loading ? (
        <div className="flex items-center justify-center h-full p-6">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground/40" />
        </div>
      ) : (
        <>
          {/* SECTION 1: Balance Card — Always Visible */}
          <div className="px-4 py-4 space-y-3 shrink-0">
            {/* Header */}
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

            {/* Main Balance */}
            <p className="text-[28px] font-bold text-foreground font-mono tracking-tighter leading-none" style={{ direction: "ltr", unicodeBidi: "plaintext" }}>
              {formatUsdt(availableBalance)} <span className="text-[11px] font-normal text-muted-foreground/50">USDT</span>
            </p>

            {/* Unrealized PnL (if positions exist) */}
            {hasUnrealizedPnl && (
              <div className="flex items-center gap-1.5">
                <TrendingUp className={`w-3 h-3 ${unrealizedPnl >= 0 ? "text-emerald-500" : "text-rose-500"}`} />
                <span className="text-[10px] text-muted-foreground/60">{labels.unrealizedPnl}:</span>
                <span className={`font-mono text-[11px] font-semibold tabular-nums ${unrealizedPnl >= 0 ? "text-emerald-500" : "text-rose-500"}`} style={{ direction: "ltr" }}>
                  {unrealizedPnl >= 0 ? "+" : ""}{formatUsdt(unrealizedPnl)}
                </span>
              </div>
            )}

            {/* Collapsible Details (margin, deposited, lifetime PnL) */}
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                <span>{labels.details}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground/50">{labels.allocated}</span>
                    <span className="font-mono font-semibold text-foreground tabular-nums" style={{ direction: "ltr" }}>{formatUsdt(lockedBalance)} USDT</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground/50">{labels.deposited}</span>
                    <span className="font-mono font-semibold text-foreground tabular-nums" style={{ direction: "ltr" }}>{formatUsdt(lifetimeDeposited)} USDT</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground/50">{labels.totalPnl}</span>
                    <span className={`font-mono font-semibold tabular-nums ${lifetimePnl >= 0 ? "text-emerald-500" : "text-rose-500"}`} style={{ direction: "ltr" }}>
                      {lifetimePnl >= 0 ? "+" : ""}{formatUsdt(lifetimePnl)}
                    </span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Action Buttons */}
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

          {/* SECTION 2: Positions Summary (compact) */}
          {openPositionsCount > 0 && (
            <div className="px-4 py-2.5 border-t border-border/20 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                {isRTL ? "المراكز المفتوحة" : "Open Positions"}
              </span>
              <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 h-[18px] rounded-md bg-primary/10 text-primary border-0 tabular-nums font-mono">
                {openPositionsCount}
              </Badge>
            </div>
          )}

          {/* SECTION 3: History (collapsible, collapsed by default) */}
          <CopyHistorySection language={language} onPositionClick={onPositionClick} />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Allocation Modal */}
          <AllocationModal
            open={allocationModalOpen}
            onOpenChange={setAllocationModalOpen}
            onSuccess={() => setTimeout(() => loadData(true), 1000)}
            liveAccount={liveAccount}
            config={config}
            language={language}
          />
        </>
      )}
    </div>
  );
}

CopyRightPanel.propTypes = {
  language: PropTypes.string,
  liveAccount: PropTypes.object,
  openPositionsCount: PropTypes.number,
  unrealizedPnl: PropTypes.number,
  onPositionClick: PropTypes.func,
};