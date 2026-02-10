import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { RefreshCw, Wallet, Users, Play, TrendingUp, FileText, Plus, Loader2 } from "lucide-react";

function formatUsdt(val) {
  if (val === null || val === undefined) return "-";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

const statusColors = {
  ACTIVE: "bg-green-500/10 text-green-500 border-green-500/20",
  SUSPENDED: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  PENDING: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  FAILED: "bg-red-500/10 text-red-500 border-red-500/20"
};

function StatCard({ title, value, icon: Icon, color }) {
  const colors = {
    blue: "bg-blue-500/5 border-blue-500/20 text-blue-600",
    green: "bg-green-500/5 border-green-500/20 text-green-600",
    purple: "bg-purple-500/5 border-purple-500/20 text-purple-600",
    orange: "bg-orange-500/5 border-orange-500/20 text-orange-600"
  };
  
  return (
    <Card className={`border ${colors[color]} transition-all`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          {Icon && <Icon className="h-6 w-6 opacity-60" />}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CopyTradingAdminTab({ onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [configForm, setConfigForm] = useState(/** @type {any} */ ({}));
  const [wallets, setWallets] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [stats, setStats] = useState(/** @type {any} */ ({}));
  const [savingConfig, setSavingConfig] = useState(false);
  const [runningProcessor, setRunningProcessor] = useState(false);
  
  const [topUpDialogOpen, setTopUpDialogOpen] = useState(false);
  const [topUpForm, setTopUpForm] = useState({ userEmail: "", amount: "", note: "" });
  const [topUpLoading, setTopUpLoading] = useState(false);

  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ userEmail: "", amount: "", note: "" });
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, statsRes, walletsRes, allocationsRes, ledgerRes] = await Promise.all([
        base44.functions.invoke("copyTradingAdmin", { action: "getConfig" }),
        base44.functions.invoke("copyTradingAdmin", { action: "getStats" }),
        base44.functions.invoke("copyTradingAdmin", { action: "listWallets", limit: 50 }),
        base44.functions.invoke("copyTradingAdmin", { action: "listAllocations", limit: 100 }),
        base44.functions.invoke("copyTradingAdmin", { action: "listLedger", limit: 100 }),
      ]);

      if (configRes.data?.ok) {
        setConfig(configRes.data.data);
        setConfigForm(configRes.data.data || {});
      }
      if (statsRes.data?.ok) setStats(statsRes.data.data || {});
      if (walletsRes.data?.ok) setWallets(walletsRes.data.data || []);
      if (allocationsRes.data?.ok) setAllocations(allocationsRes.data.data || []);
      if (ledgerRes.data?.ok) setLedgerEntries(ledgerRes.data.data || []);
    } catch (err) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await base44.functions.invoke("copyTradingAdmin", {
        action: "saveConfig",
        configData: configForm
      });
      if (res.data?.ok) {
        toast.success("Configuration saved");
        loadData();
      } else {
        toast.error(res.data?.error?.message || "Failed");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRunProcessor = async () => {
    setRunningProcessor(true);
    try {
      const res = await base44.functions.invoke("copyTradingAdmin", { action: "runProcessorNow" });
      if (res.data?.ok) {
        toast.success(`Processed: ${res.data.data?.processedCount || 0}`);
        loadData();
      } else {
        toast.error("Processor failed");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRunningProcessor(false);
    }
  };

  const handleManualTopUp = async () => {
    if (!topUpForm.userEmail || !topUpForm.amount) return;
    setTopUpLoading(true);
    try {
      const res = await base44.functions.invoke("copyTradingAdmin", {
        action: "manualTopUp",
        userEmail: topUpForm.userEmail.trim(),
        amount: parseFloat(topUpForm.amount),
        note: topUpForm.note
      });
      if (res.data?.ok) {
        toast.success("Top-up successful");
        setTopUpDialogOpen(false);
        setTopUpForm({ userEmail: "", amount: "", note: "" });
        loadData();
      } else {
        toast.error(res.data?.error?.message || "Failed");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTopUpLoading(false);
    }
  };

  const handleAdminWithdraw = async () => {
    if (!withdrawForm.userEmail || !withdrawForm.amount) return;
    setWithdrawLoading(true);
    try {
      const res = await base44.functions.invoke("copyTradingAdmin", {
        action: "withdrawFundsAdmin",
        userEmail: withdrawForm.userEmail.trim(),
        amount: parseFloat(withdrawForm.amount),
        note: withdrawForm.note
      });
      if (res.data?.ok) {
        toast.success("Withdrawal successful");
        setWithdrawDialogOpen(false);
        setWithdrawForm({ userEmail: "", amount: "", note: "" });
        loadData();
      } else {
        toast.error(res.data?.error?.message || "Failed");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setWithdrawLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Wallets" value={stats.totalWallets || 0} icon={Users} color="blue" />
        <StatCard title="Balance" value={`$${formatUsdt(stats.totalBalance)}`} icon={Wallet} color="green" />
        <StatCard title="Deposited" value={`$${formatUsdt(stats.totalLifetimeDeposited)}`} icon={TrendingUp} color="purple" />
        <StatCard title="Deposits (OK/Fail)" value={`${stats.postedDeposits || 0} / ${stats.failedDeposits || 0}`} icon={FileText} color="orange" />
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="config" className="px-4">Configuration</TabsTrigger>
          <TabsTrigger value="wallets" className="px-4">Wallets</TabsTrigger>
          <TabsTrigger value="ledger" className="px-4">Ledger</TabsTrigger>
          <TabsTrigger value="allocations" className="px-4">Allocations</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle>Global Settings</CardTitle>
                <CardDescription>Configure copy trading rules</CardDescription>
              </div>
              <Button variant="outline" onClick={handleRunProcessor} disabled={runningProcessor}>
                {runningProcessor ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                Run Processor
              </Button>
            </CardHeader>
            <CardContent className="pt-6 grid gap-6">
              {/* Toggles */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 border rounded-xl bg-card">
                  <div className="space-y-0.5">
                    <Label>Enable Copy Trading</Label>
                    <p className="text-xs text-muted-foreground">Master switch</p>
                  </div>
                  <Switch checked={configForm.enabled} onCheckedChange={v => setConfigForm({...configForm, enabled: v})} />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-xl bg-card">
                  <div className="space-y-0.5">
                    <Label>Auto-Approve</Label>
                    <p className="text-xs text-muted-foreground">Automatically process deposits</p>
                  </div>
                  <Switch checked={configForm.auto_approve_enabled} onCheckedChange={v => setConfigForm({...configForm, auto_approve_enabled: v})} />
                </div>
              </div>

              {/* Inputs */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Min Deposit (USDT)</Label>
                  <Input type="number" value={configForm.min_deposit_usdt} onChange={e => setConfigForm({...configForm, min_deposit_usdt: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Max Auto-Approve (USDT)</Label>
                  <Input type="number" value={configForm.auto_approve_max_amount} onChange={e => setConfigForm({...configForm, auto_approve_max_amount: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Deposit Source</Label>
                  <Select value={configForm.deposit_source} onValueChange={v => setConfigForm({...configForm, deposit_source: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OKX_FUNDING">OKX Funding</SelectItem>
                      <SelectItem value="INTERNAL_WALLET">Internal Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveConfig} disabled={savingConfig} className="min-w-[140px]">
                  {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Configuration'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallets">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>User Wallets</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setTopUpDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Top Up
                </Button>
                <Button size="sm" variant="outline" onClick={loadData}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Locked</TableHead>
                    <TableHead>Total Deposited</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallets.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No wallets</TableCell></TableRow>
                  ) : (
                    wallets.map(w => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{w.user_email}</TableCell>
                        <TableCell className="font-mono">{formatUsdt(w.available_balance)}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{formatUsdt(w.locked_balance)}</TableCell>
                        <TableCell className="font-mono">{formatUsdt(w.lifetime_deposited)}</TableCell>
                        <TableCell><Badge variant="outline" className={statusColors[w.status] || ''}>{w.status}</Badge></TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => {
                            setWithdrawForm({ userEmail: w.user_email, amount: "", note: "" });
                            setWithdrawDialogOpen(true);
                          }}>
                            Withdraw
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerEntries.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(e.created_at)}</TableCell>
                      <TableCell className="text-sm">{e.user_id?.slice(0, 8)}</TableCell>
                      <TableCell><Badge variant="outline">{e.kind}</Badge></TableCell>
                      <TableCell className={`font-mono ${e.kind === 'CREDIT' ? 'text-green-500' : 'text-red-500'}`}>
                        {e.kind === 'CREDIT' ? '+' : '-'}{formatUsdt(e.amount)}
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{e.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allocations">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.user_email}</TableCell>
                      <TableCell className="font-mono">{formatUsdt(a.amount)}</TableCell>
                      <TableCell className="text-xs">{a.deposit_source}</TableCell>
                      <TableCell><Badge className={statusColors[a.status] || ''}>{a.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(a.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={topUpDialogOpen} onOpenChange={setTopUpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Top-Up</DialogTitle>
            <DialogDescription>Credit a user's copy trading wallet</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>User Email</Label>
              <Input value={topUpForm.userEmail} onChange={e => setTopUpForm({...topUpForm, userEmail: e.target.value})} placeholder="user@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Amount (USDT)</Label>
              <Input type="number" value={topUpForm.amount} onChange={e => setTopUpForm({...topUpForm, amount: e.target.value})} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input value={topUpForm.note} onChange={e => setTopUpForm({...topUpForm, note: e.target.value})} placeholder="Admin reason..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopUpDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleManualTopUp} disabled={topUpLoading}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Withdrawal</DialogTitle>
            <DialogDescription>Deduct funds from user wallet (Admin Only)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>User Email</Label>
              <Input value={withdrawForm.userEmail} disabled readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Amount (USDT)</Label>
              <Input type="number" value={withdrawForm.amount} onChange={e => setWithdrawForm({...withdrawForm, amount: e.target.value})} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input value={withdrawForm.note} onChange={e => setWithdrawForm({...withdrawForm, note: e.target.value})} placeholder="Why is this being deducted?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleAdminWithdraw} disabled={withdrawLoading}>Confirm Withdraw</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}