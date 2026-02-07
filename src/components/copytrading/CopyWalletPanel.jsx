import { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Lock, TrendingUp, PlusCircle, RefreshCw } from "lucide-react";
import AllocationModal from "./AllocationModal";

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

  const invokeWithRetry = useCallback(async (action, extra = {}, retries = 2) => {
    for (let i = 0; i <= retries; i++) {
      try {
        return await base44.functions.invoke("copyTradingUser", { action, ...extra });
      } catch (err) {
        if (err?.response?.status === 429 && i < retries) {
          await new Promise(r => setTimeout(r, 1000 * (i + 1)));
          continue;
        }
        throw err;
      }
    }
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

  return (
    <div className="h-full overflow-hidden flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
      {loading ? (
        <div className="flex items-center justify-center h-full p-6">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
      {/* Balance Summary */}
      <div className="px-4 py-5 space-y-4 shrink-0 border-b border-border/30">
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
        
        <p className="text-[28px] font-bold text-foreground font-mono tracking-tighter leading-none">
          {formatUsdt(availableBalance)} <span className="text-[11px] font-normal text-muted-foreground/50">USDT</span>
        </p>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 bg-muted/30 px-2.5 py-1.5 rounded-lg">
            <Lock className="w-3 h-3 text-muted-foreground/50" />
            <span className="text-muted-foreground/70 text-[10px]">{labels.locked}</span>
            <span className="font-mono font-semibold text-[11px] text-foreground">{formatUsdt(lockedBalance)}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-muted/30 px-2.5 py-1.5 rounded-lg">
            <TrendingUp className={`w-3 h-3 ${lifetimePnl >= 0 ? "text-emerald-500" : "text-rose-500"}`} />
            <span className={`font-mono font-semibold text-[11px] ${lifetimePnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {lifetimePnl >= 0 ? "+" : ""}{formatUsdt(lifetimePnl)}
            </span>
          </div>
        </div>

        <Button 
          onClick={() => setAllocationModalOpen(true)} 
          className="w-full rounded-xl h-9 text-xs font-semibold shadow-sm shadow-primary/20"
          size="sm"
        >
          <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
          {labels.addFunds}
        </Button>
      </div>

      {/* Tabs for Ledger/Allocations */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="ledger" className="h-full flex flex-col">
          <TabsList className="w-full justify-start px-4 pt-3 bg-transparent border-b border-border/20 rounded-none h-auto pb-0">
            <TabsTrigger value="ledger" className="text-[11px] font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground rounded-none pb-2.5 text-muted-foreground/60">
              Activity
            </TabsTrigger>
            <TabsTrigger value="allocations" className="text-[11px] font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground rounded-none pb-2.5 text-muted-foreground/60">
              {labels.allocations}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ledger" className="flex-1 overflow-y-auto px-3 py-2.5 mt-0">
            {ledgerEntries.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-xs text-muted-foreground/40 font-medium">
                No activity yet
              </div>
            ) : (
              <div className="space-y-1.5">
                {ledgerEntries
                  .filter((entry) => entry.kind !== 'COMMISSION' && entry.kind !== 'COMMISSION_OPEN' && entry.kind !== 'COMMISSION_CLOSE')
                  .map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between bg-muted/20 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/30">
                    <div className="flex flex-col gap-1 min-w-0 flex-1 mr-3">
                      <Badge className={`${ledgerKindColors[entry.kind] || "bg-gray-500/10 text-gray-500"} shrink-0 w-fit rounded-md text-[9px] font-bold`} variant="outline">
                        {getLedgerLabel(entry.kind)}
                      </Badge>
                      <span className="text-muted-foreground/50 text-[10px] font-medium truncate">
                        {formatDate(entry.created_at || entry.created_date)}
                      </span>
                    </div>
                    <span className={`font-mono font-semibold text-[13px] tabular-nums shrink-0 ${
                      entry.kind === 'CREDIT' || entry.kind === 'TOPUP_OKX' || entry.kind === 'TOPUP_ADMIN' || entry.kind === 'PNL' 
                        ? 'text-emerald-500' 
                        : entry.kind === 'DEBIT'
                        ? 'text-rose-500' 
                        : 'text-foreground'
                    }`}>
                      {entry.amount >= 0 ? '+' : ''}{formatUsdt(entry.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="allocations" className="flex-1 overflow-y-auto px-3 py-2.5 mt-0">
            {allocations.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-xs text-muted-foreground/40 font-medium">
                {labels.noAllocations}
              </div>
            ) : (
              <div className="space-y-1.5">
                {allocations.map((alloc) => (
                  <div key={alloc.id} className="flex items-center justify-between bg-muted/20 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Badge className="shrink-0 rounded-md text-[9px] font-bold" variant={alloc.status === 'APPROVED' ? 'success' : alloc.status === 'PENDING' ? 'warning' : 'outline'}>
                        {alloc.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground/50 font-medium">
                        {formatDate(alloc.created_at)}
                      </span>
                    </div>
                    <span className="font-mono text-[13px] font-semibold tabular-nums">
                      {formatUsdt(alloc.amount_usdt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
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