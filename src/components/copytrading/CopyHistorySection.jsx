import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, History, RefreshCw, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function formatUsdt(val) {
  if (val === null || val === undefined || !Number.isFinite(val)) return "0.00";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function relativeTime(dateStr) {
  if (!dateStr) return "-";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function exactDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const t = {
  en: {
    history: "History",
    closed: "Closed",
    deposits: "Deposits",
    noData: "No closed trades yet",
    noDataSub: "Closed positions will appear here",
  },
  ar: {
    history: "السجل",
    closed: "الصفقات المغلقة",
    deposits: "الإيداعات",
    noData: "لا توجد صفقات مغلقة",
    noDataSub: "ستظهر الصفقات المغلقة هنا",
  }
};

export default function CopyHistorySection({ language = "en", defaultOpen = false }) {
  const labels = t[language] || t.en;
  const isRTL = language === "ar";
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState("closed");
  const [loading, setLoading] = useState(false);
  const [closedPositions, setClosedPositions] = useState([]);
  const [ledgerDeposits, setLedgerDeposits] = useState([]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { gated } = await import("@/components/utils/apiGate");
      const [posRes, ledgerRes] = await Promise.all([
        gated("copyHistory:closedPos", () => base44.functions.invoke("copyTradingUser", { action: "getPositions", status: "CLOSED" }), { minIntervalMs: 10000 }).catch(() => null),
        gated("copyHistory:ledger", () => base44.functions.invoke("copyTradingUser", { action: "getLedger", limit: 30 }), { minIntervalMs: 10000 }).catch(() => null),
      ]);
      if (posRes?.data?.ok) setClosedPositions(posRes.data.data || []);
      if (ledgerRes?.data?.ok) {
        const deposits = (ledgerRes.data.data || []).filter(e => 
          e.kind === "CREDIT" || e.kind === "TOPUP_OKX" || e.kind === "TOPUP_ADMIN" || e.kind === "DEBIT"
        );
        setLedgerDeposits(deposits);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && closedPositions.length === 0 && ledgerDeposits.length === 0) {
      loadHistory();
    }
  }, [open]);

  const totalCount = closedPositions.length + ledgerDeposits.length;
  const hasDeposits = ledgerDeposits.length > 0;

  const tabs = [
    { key: "closed", label: labels.closed, count: closedPositions.length },
  ];
  if (hasDeposits) {
    tabs.push({ key: "deposits", label: labels.deposits, count: ledgerDeposits.length });
  }

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span className="text-[12px] font-semibold text-foreground">{labels.history}</span>
              {totalCount > 0 && (
                <span className="bg-muted/50 text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums">
                  {totalCount}
                </span>
              )}
            </div>
            <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-200", open && "rotate-180")} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/20">
            {/* Tabs */}
            {tabs.length > 1 && (
              <div className="flex gap-1 px-3 pt-2.5 pb-1">
                {tabs.map(tb => (
                  <button
                    key={tb.key}
                    onClick={() => setTab(tb.key)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors",
                      tab === tb.key ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-foreground"
                    )}
                  >
                    {tb.label} {tb.count > 0 && <span className="ml-0.5 tabular-nums">({tb.count})</span>}
                  </button>
                ))}
                <div className="flex-1" />
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={loadHistory} disabled={loading}>
                  <RefreshCw className={cn("w-2.5 h-2.5", loading && "animate-spin")} />
                </Button>
              </div>
            )}
            {tabs.length === 1 && (
              <div className="flex justify-end px-3 pt-2">
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={loadHistory} disabled={loading}>
                  <RefreshCw className={cn("w-2.5 h-2.5", loading && "animate-spin")} />
                </Button>
              </div>
            )}

            {/* Content */}
            <div className="max-h-[280px] overflow-y-auto px-3 pb-3 scrollbar-thin">
              {tab === "closed" && (
                closedPositions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <TrendingUp className="w-5 h-5 text-muted-foreground/20 mb-2" />
                    <p className="text-[11px] font-medium text-muted-foreground/50">{labels.noData}</p>
                    <p className="text-[10px] text-muted-foreground/30 mt-0.5">{labels.noDataSub}</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    <TooltipProvider delayDuration={200}>
                      {closedPositions.map(pos => {
                        const pnl = pos.realized_pnl || pos.pnl || 0;
                        const isProfit = pnl >= 0;
                        const pnlPct = pos.realized_pnl_percent || pos.pnl_percent || 0;
                        return (
                          <div key={pos.id} className="flex items-center justify-between rounded-lg bg-muted/15 px-3 py-2.5 hover:bg-muted/25 transition-colors">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0", pos.side === "LONG" ? "bg-emerald-500/10" : "bg-rose-500/10")}>
                                {pos.side === "LONG" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-rose-500" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-semibold truncate">{pos.symbol}</span>
                                  <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-[14px] font-bold border-0 rounded", pos.side === "LONG" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
                                    {pos.side}
                                  </Badge>
                                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-[14px] font-medium border-0 rounded bg-muted/50 text-muted-foreground/60">
                                    {isRTL ? "مغلق" : "Closed"}
                                  </Badge>
                                </div>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-[9px] text-muted-foreground/40 cursor-default">{relativeTime(pos.closed_at || pos.updated_at || pos.updated_date)}</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="text-[10px]">
                                    {exactDate(pos.closed_at || pos.updated_at || pos.updated_date)}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                            <div className="text-right shrink-0" style={{ direction: "ltr", unicodeBidi: "plaintext" }}>
                              <div className={cn("font-mono font-semibold text-[12px] tabular-nums", isProfit ? "text-emerald-500" : "text-rose-500")}>
                                {isProfit ? "+" : ""}{formatUsdt(pnl)}
                              </div>
                              {pnlPct !== 0 && (
                                <div className={cn("text-[9px] font-mono tabular-nums", isProfit ? "text-emerald-500/60" : "text-rose-500/60")}>
                                  {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </TooltipProvider>
                  </div>
                )
              )}

              {tab === "deposits" && (
                <div className="space-y-1.5 pt-1">
                  {ledgerDeposits.map(entry => (
                    <div key={entry.id} className="flex items-center justify-between rounded-lg bg-muted/15 px-3 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <Badge className={cn(
                          "w-fit rounded-md text-[9px] font-bold border-0",
                          entry.kind === "CREDIT" || entry.kind === "TOPUP_OKX" || entry.kind === "TOPUP_ADMIN" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                        )}>
                          {entry.kind === "DEBIT" ? (isRTL ? "سحب" : "Withdraw") : (isRTL ? "إيداع" : "Deposit")}
                        </Badge>
                        <span className="text-[9px] text-muted-foreground/40">{relativeTime(entry.created_at || entry.created_date)}</span>
                      </div>
                      <span className={cn("font-mono font-semibold text-[12px] tabular-nums", 
                        entry.kind === "DEBIT" ? "text-rose-500" : "text-emerald-500"
                      )} style={{ direction: "ltr", unicodeBidi: "plaintext" }}>
                        {entry.amount >= 0 ? "+" : ""}{formatUsdt(entry.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

CopyHistorySection.propTypes = {
  language: PropTypes.string,
  defaultOpen: PropTypes.bool,
};