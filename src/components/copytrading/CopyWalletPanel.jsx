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
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Balance</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => loadData(true)} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="px-3 py-3 space-y-2 shrink-0 border-b border-border">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-[10px] text-muted-foreground truncate">{labels.available}</span>
            </div>
            <p className="text-lg font-bold text-foreground font-mono truncate">
              {formatUsdt(availableBalance)} <span className="text-[10px] text-muted-foreground">USDT</span>
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Card className="bg-card/50 overflow-hidden">
            <CardContent className="p-2">
              <div className="flex items-center gap-1 mb-1">
                <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-[9px] text-muted-foreground truncate">{labels.locked}</span>
              </div>
              <p className="text-sm font-bold text-foreground font-mono truncate">
                {formatUsdt(lockedBalance)}
              </p>
            </CardContent>
          </Card>

          <Card className={`overflow-hidden ${lifetimePnl >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"}`}>
            <CardContent className="p-2">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className={`w-3 h-3 shrink-0 ${lifetimePnl >= 0 ? "text-emerald-500" : "text-rose-500"}`} />
                <span className="text-[9px] text-muted-foreground truncate">{labels.totalPnl}</span>
              </div>
              <p className={`text-sm font-bold font-mono truncate ${lifetimePnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {lifetimePnl >= 0 ? "+" : ""}{formatUsdt(lifetimePnl)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Button 
          onClick={() => setAllocationModalOpen(true)} 
          className="w-full bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90"
          size="sm"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          {labels.addFunds}
        </Button>
      </div>

      {/* Tabs for Ledger/Allocations */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="ledger" className="h-full flex flex-col">
          <TabsList className="w-full justify-start px-4 pt-2 bg-transparent border-b border-border rounded-none h-auto pb-0">
            <TabsTrigger value="ledger" className="text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2">
              Activity
            </TabsTrigger>
            <TabsTrigger value="allocations" className="text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2">
              {labels.allocations}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ledger" className="flex-1 overflow-y-auto px-3 py-2 mt-0">
            {ledgerEntries.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
                No activity yet
              </div>
            ) : (
              <div className="space-y-2">
                {ledgerEntries
                  .filter((entry) => entry.kind !== 'COMMISSION' && entry.kind !== 'COMMISSION_OPEN' && entry.kind !== 'COMMISSION_CLOSE')
                  .map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2">
                    <div className="flex flex-col gap-1 min-w-0 flex-1 mr-3">
                      <Badge className={`${ledgerKindColors[entry.kind] || "bg-gray-500/10 text-gray-500"} shrink-0 w-fit`} variant="outline">
                        {getLedgerLabel(entry.kind)}
                      </Badge>
                      <span className="text-muted-foreground text-[10px] truncate">
                        {formatDate(entry.created_at || entry.created_date)}
                      </span>
                    </div>
                    <span className={`font-mono font-medium text-sm shrink-0 ${
                      entry.kind === 'CREDIT' || entry.kind === 'TOPUP_OKX' || entry.kind === 'TOPUP_ADMIN' || entry.kind === 'PNL' 
                        ? 'text-green-500' 
                        : entry.kind === 'DEBIT'
                        ? 'text-red-500' 
                        : 'text-foreground'
                    }`}>
                      {entry.amount >= 0 ? '+' : ''}{formatUsdt(entry.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="allocations" className="flex-1 overflow-y-auto px-3 py-2 mt-0">
            {allocations.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
                {labels.noAllocations}
              </div>
            ) : (
              <div className="space-y-2">
                {allocations.map((alloc) => (
                  <Card key={alloc.id} className="bg-card/50 overflow-hidden">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <Badge className="shrink-0" variant={alloc.status === 'APPROVED' ? 'success' : alloc.status === 'PENDING' ? 'warning' : 'outline'}>
                          {alloc.status}
                        </Badge>
                        <span className="font-mono text-sm font-bold truncate">
                          {formatUsdt(alloc.amount_usdt)} USDT
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {formatDate(alloc.created_at)}
                      </div>
                    </CardContent>
                  </Card>
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