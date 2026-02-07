import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, RefreshCw, TrendingUp } from "lucide-react";
import { gated } from "@/components/utils/apiGate";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function formatUsdt(val) {
  if (val === null || val === undefined || !Number.isFinite(val)) return "0.00";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function relativeTime(dateStr, isAr) {
  if (!dateStr) return "-";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isAr ? "الآن" : "now";
  if (mins < 60) return isAr ? `${mins} د` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isAr ? `${hrs} س` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return isAr ? `${days} ي` : `${days}d`;
}

function exactTime(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const t = {
  en: {
    history: "History",
    closed: "Closed",
    deposits: "Deposits/Withdrawals",
    noHistory: "No closed trades yet",
    noDeposits: "No deposit/withdrawal records",
  },
  ar: {
    history: "السجل",
    closed: "الصفقات المغلقة",
    deposits: "الإيداعات/السحوبات",
    noHistory: "لا توجد صفقات مغلقة",
    noDeposits: "لا توجد سجلات",
  },
};

export default function CopyHistorySection({ language = "en", onPositionClick }) {
  const labels = t[language] || t.en;
  const isAr = language === "ar";

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("closed");
  const [closedPositions, setClosedPositions] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [posRes, ledgerRes] = await Promise.all([
        gated("copyHistory:closedPositions", () => base44.functions.invoke("copyTradingUser", { action: "getPositions", status: "CLOSED" }), { minIntervalMs: 10000 }),
        gated("copyHistory:ledger", () => base44.functions.invoke("copyTradingUser", { action: "getLedger", limit: 30 }), { minIntervalMs: 10000 }),
      ]);
      if (posRes?.data?.ok) setClosedPositions(posRes.data.data || []);
      if (ledgerRes?.data?.ok) {
        const entries = (ledgerRes.data.data || []).filter(e => e.kind === "CREDIT" || e.kind === "DEBIT" || e.kind === "TOPUP_OKX" || e.kind === "TOPUP_ADMIN");
        setLedgerEntries(entries);
      }
      setLoaded(true);
    } catch (err) {
      console.error("[CopyHistory]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data only when first expanded
  useEffect(() => {
    if (open && !loaded) loadData();
  }, [open, loaded, loadData]);

  const totalCount = closedPositions.length + ledgerEntries.length;
  const hasDeposits = ledgerEntries.length > 0;

  // Determine which tabs to show
  const tabs = [{ id: "closed", label: labels.closed }];
  if (hasDeposits) tabs.push({ id: "deposits", label: labels.deposits });

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t border-border/20">
      <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-foreground">{labels.history}</span>
          {totalCount > 0 && (
            <span className="bg-muted/40 text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums font-mono">
              {totalCount}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/50" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-3 pb-3">
          {/* Tab bar */}
          {tabs.length > 1 && (
            <div className="flex gap-1 mb-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-colors ${
                    tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <div className="flex-1" />
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg" onClick={loadData} disabled={loading}>
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          )}

          {loading && !loaded ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground/40" />
            </div>
          ) : (
            <>
              {/* Closed Trades */}
              {tab === "closed" && (
                <div className="space-y-1 max-h-[280px] overflow-y-auto">
                  {closedPositions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/40">
                      <TrendingUp className="w-4 h-4 mb-2" />
                      <span className="text-[11px]">{labels.noHistory}</span>
                    </div>
                  ) : (
                    closedPositions.map((pos) => {
                      const pnl = pos.realized_pnl || pos.pnl || 0;
                      const pnlPct = pos.pnl_percent || pos.realized_pnl_percent || 0;
                      const isProfit = pnl >= 0;
                      return (
                        <TooltipProvider key={pos.id} delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                onClick={() => onPositionClick?.(pos)}
                                className="flex items-center justify-between bg-muted/15 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-muted/25 transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="text-[11px] font-semibold text-foreground truncate">{pos.symbol}</span>
                                  <Badge variant="outline" className={`text-[8px] px-1 py-0 h-[14px] font-bold border-0 rounded ${pos.side === "LONG" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                                    {pos.side}
                                  </Badge>
                                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-[14px] font-medium border-0 rounded bg-muted/30 text-muted-foreground/60">
                                    {isAr ? "مغلق" : "Closed"}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="text-right" style={{ direction: "ltr" }}>
                                    <span className={`font-mono text-[11px] font-semibold tabular-nums ${isProfit ? "text-emerald-500" : "text-rose-500"}`}>
                                      {isProfit ? "+" : ""}{formatUsdt(pnl)}
                                    </span>
                                    {pnlPct !== 0 && (
                                      <span className={`font-mono text-[9px] tabular-nums ml-1 ${isProfit ? "text-emerald-500/60" : "text-rose-500/60"}`}>
                                        {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[9px] text-muted-foreground/40 font-medium">{relativeTime(pos.closed_at || pos.updated_date, isAr)}</span>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {exactTime(pos.closed_at || pos.updated_date)}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })
                  )}
                </div>
              )}

              {/* Deposits/Withdrawals */}
              {tab === "deposits" && (
                <div className="space-y-1 max-h-[280px] overflow-y-auto">
                  {ledgerEntries.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground/40">
                      <span className="text-[11px]">{labels.noDeposits}</span>
                    </div>
                  ) : (
                    ledgerEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between bg-muted/15 rounded-xl px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[8px] px-1 py-0 h-[14px] font-bold border-0 rounded ${
                            entry.kind === "CREDIT" || entry.kind === "TOPUP_OKX" || entry.kind === "TOPUP_ADMIN"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-rose-500/10 text-rose-500"
                          }`}>
                            {entry.kind === "CREDIT" || entry.kind === "TOPUP_OKX" || entry.kind === "TOPUP_ADMIN"
                              ? (isAr ? "إيداع" : "Deposit")
                              : (isAr ? "سحب" : "Withdraw")}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground/40 font-medium">{relativeTime(entry.created_at || entry.created_date, isAr)}</span>
                        </div>
                        <span className={`font-mono text-[11px] font-semibold tabular-nums ${
                          entry.amount >= 0 ? "text-emerald-500" : "text-rose-500"
                        }`} style={{ direction: "ltr" }}>
                          {entry.amount >= 0 ? "+" : ""}{formatUsdt(Math.abs(entry.amount))}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

CopyHistorySection.propTypes = {
  language: PropTypes.string,
  onPositionClick: PropTypes.func,
};