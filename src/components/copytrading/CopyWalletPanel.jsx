import { useState, useEffect, useCallback } from "react";
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
    locked: "Locked",
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
    locked: "مقفل",
    unlocked: "مفتوح",
    commission: "عمولة",
  }
};

const ledgerKindColors = {
  CREDIT: "bg-green-500/10 text-green-500 border-green-500/20",
  DEBIT: "bg-red-500/10 text-red-500 border-red-500/20",
  ALLOCATION_LOCK: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  ALLOCATION_UNLOCK: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  COMMISSION_OPEN: "bg-amber-500/10 text-amber-500 border-amber-500/20",
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, walletRes, ledgerRes, allocationsRes] = await Promise.all([
        base44.functions.invoke("copyTradingUser", { action: "getConfig" }),
        base44.functions.invoke("copyTradingUser", { action: "getWallet" }),
        base44.functions.invoke("copyTradingUser", { action: "getLedger", limit: 20 }),
        base44.functions.invoke("copyTradingUser", { action: "getAllocations" }).catch(() => ({ data: { ok: false } })),
      ]);

      if (configRes.data?.ok) setConfig(configRes.data.data);
      if (walletRes.data?.ok) setWallet(walletRes.data.data);
      if (ledgerRes.data?.ok) setLedgerEntries(ledgerRes.data.data || []);
      if (allocationsRes.data?.ok) setAllocations(allocationsRes.data.data || []);
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
    loadData();
  };

  const availableBalance = wallet?.available_balance || 0;
  const lockedBalance = wallet?.locked_balance || 0;
  const lifetimePnl = wallet?.lifetime_pnl || 0;

  const getLedgerLabel = (kind) => {
    const map = {
      CREDIT: labels.deposit,
      DEBIT: labels.withdraw,
      ALLOCATION_LOCK: labels.locked,
      ALLOCATION_UNLOCK: labels.unlocked,
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
          <h2 className="text-sm font-semibold text-foreground">Copy Trading</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Copy Trading</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="px-4 py-3 space-y-3 shrink-0 border-b border-border">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground">{labels.available}</span>
            </div>
            <p className="text-xl font-bold text-foreground font-mono">
              {formatUsdt(availableBalance)} <span className="text-xs text-muted-foreground">USDT</span>
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Card className="bg-card/50">
            <CardContent className="p-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Lock className="w-3 h-3 text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground">{labels.allocated}</span>
              </div>
              <p className="text-sm font-bold text-foreground font-mono">
                {formatUsdt(lockedBalance)}
              </p>
            </CardContent>
          </Card>

          <Card className={`${lifetimePnl >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"}`}>
            <CardContent className="p-2">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className={`w-3 h-3 ${lifetimePnl >= 0 ? "text-emerald-500" : "text-rose-500"}`} />
                <span className="text-[9px] text-muted-foreground">{labels.totalPnl}</span>
              </div>
              <p className={`text-sm font-bold font-mono ${lifetimePnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
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

          <TabsContent value="ledger" className="flex-1 overflow-y-auto px-4 py-2 mt-0">
            {ledgerEntries.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
                No activity yet
              </div>
            ) : (
              <div className="space-y-2">
                {ledgerEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <Badge className={ledgerKindColors[entry.kind] || "bg-gray-500/10 text-gray-500"} variant="outline">
                        {getLedgerLabel(entry.kind)}
                      </Badge>
                      <span className="text-muted-foreground text-[10px]">
                        {formatDate(entry.created_at || entry.created_date)}
                      </span>
                    </div>
                    <span className={`font-mono font-medium text-sm ${
                      entry.kind === 'CREDIT' || entry.kind === 'TOPUP_OKX' || entry.kind === 'TOPUP_ADMIN' || entry.kind === 'PNL' 
                        ? 'text-green-500' 
                        : entry.kind === 'DEBIT' || entry.kind === 'COMMISSION_OPEN' || entry.kind === 'COMMISSION_CLOSE'
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

          <TabsContent value="allocations" className="flex-1 overflow-y-auto px-4 py-2 mt-0">
            {allocations.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
                {labels.noAllocations}
              </div>
            ) : (
              <div className="space-y-2">
                {allocations.map((alloc) => (
                  <Card key={alloc.id} className="bg-card/50">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={alloc.status === 'APPROVED' ? 'success' : alloc.status === 'PENDING' ? 'warning' : 'outline'}>
                          {alloc.status}
                        </Badge>
                        <span className="font-mono text-sm font-bold">
                          {formatUsdt(alloc.amount_usdt)} USDT
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
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