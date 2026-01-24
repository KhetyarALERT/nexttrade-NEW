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
import { toast } from "sonner";
import { RefreshCw, Save, Wallet, Users, Play, Settings, TrendingUp, Lock } from "lucide-react";

function formatUsdt(val) {
  if (val === null || val === undefined) return "-";
  if (!Number.isFinite(val)) return "-";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("en-US");
}

const statusColors = {
  ACTIVE: "bg-green-500/10 text-green-500 border-green-500/20",
  SUSPENDED: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  CLOSED: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  PENDING: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  FAILED: "bg-red-500/10 text-red-500 border-red-500/20",
  CANCELED: "bg-gray-500/10 text-gray-500 border-gray-500/20"
};

export default function CopyTradingAdminTab({ onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [configForm, setConfigForm] = useState({
    enabled: false,
    min_deposit_usdt: 50,
    require_kyc: true,
    deposit_source: "OKX_FUNDING",
    auto_approve_enabled: true,
    auto_approve_max_amount: 1000,
    auto_approve_min_age_minutes: 5,
    signals_enabled: false,
    pool_wallet_name: "Main Copy Trading Pool"
  });
  const [wallets, setWallets] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [stats, setStats] = useState({ totalWallets: 0, totalBalance: 0, totalAllocated: 0, pendingAllocations: 0 });
  const [savingConfig, setSavingConfig] = useState(false);
  const [runningProcessor, setRunningProcessor] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, statsRes, walletsRes, allocationsRes] = await Promise.all([
        base44.functions.invoke("copyTradingAdmin", { action: "getConfig" }),
        base44.functions.invoke("copyTradingAdmin", { action: "getStats" }),
        base44.functions.invoke("copyTradingAdmin", { action: "listWallets", limit: 50 }),
        base44.functions.invoke("copyTradingAdmin", { action: "listAllocations", limit: 100 }),
      ]);

      if (configRes.data?.ok) {
        const cfg = configRes.data.data;
        setConfig(cfg);
        setConfigForm({
          enabled: cfg?.enabled || false,
          min_deposit_usdt: cfg?.min_deposit_usdt || 50,
          require_kyc: cfg?.require_kyc !== false,
          deposit_source: cfg?.deposit_source || "OKX_FUNDING",
          auto_approve_enabled: cfg?.auto_approve_enabled !== false,
          auto_approve_max_amount: cfg?.auto_approve_max_amount || 1000,
          auto_approve_min_age_minutes: cfg?.auto_approve_min_age_minutes || 5,
          signals_enabled: cfg?.signals_enabled || false,
          pool_wallet_name: cfg?.pool_wallet_name || "Main Copy Trading Pool"
        });
      }

      if (statsRes.data?.ok) {
        setStats(statsRes.data.data);
      }

      if (walletsRes.data?.ok) {
        setWallets(walletsRes.data.data || []);
      }

      if (allocationsRes.data?.ok) {
        setAllocations(allocationsRes.data.data || []);
      }
    } catch (err) {
      console.error("Failed to load copy trading admin data:", err);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        toast.error(res.data?.error?.message || "Failed to save config");
      }
    } catch (err) {
      toast.error("Failed to save config: " + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRunProcessor = async () => {
    setRunningProcessor(true);
    try {
      const res = await base44.functions.invoke("copyTradingAdmin", { action: "runProcessorNow" });
      
      if (res.data?.ok) {
        const data = res.data.data;
        toast.success(`Processed ${data.processedCount || 0} allocations: ${data.approvedCount || 0} approved, ${data.skippedCount || 0} skipped, ${data.failedCount || 0} failed`);
        loadData();
      } else {
        toast.error(res.data?.error?.message || "Processor failed");
      }
    } catch (err) {
      toast.error("Failed to run processor: " + err.message);
    } finally {
      setRunningProcessor(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Wallets</p>
                <p className="text-2xl font-bold">{stats.totalWallets}</p>
              </div>
              <Users className="h-8 w-8 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-2xl font-bold">${formatUsdt(stats.totalBalance)}</p>
              </div>
              <Wallet className="h-8 w-8 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Allocated</p>
                <p className="text-2xl font-bold">${formatUsdt(stats.totalAllocated)}</p>
              </div>
              <Lock className="h-8 w-8 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.pendingAllocations}</p>
              </div>
              <TrendingUp className="h-8 w-8 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-2xl">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="wallets">User Wallets</TabsTrigger>
          <TabsTrigger value="allocations">Allocations</TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Copy Trading Configuration
                  </CardTitle>
                  <CardDescription>Global settings for copy trading feature</CardDescription>
                </div>
                <Button onClick={handleRunProcessor} disabled={runningProcessor} variant="outline">
                  <Play className={`h-4 w-4 mr-2 ${runningProcessor ? "animate-spin" : ""}`} />
                  Run Processor Now
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <Label>Enable Copy Trading</Label>
                  <Switch
                    checked={configForm.enabled}
                    onCheckedChange={(v) => setConfigForm({ ...configForm, enabled: v })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <Label>Require KYC</Label>
                  <Switch
                    checked={configForm.require_kyc}
                    onCheckedChange={(v) => setConfigForm({ ...configForm, require_kyc: v })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <Label>Auto-Approve Enabled</Label>
                  <Switch
                    checked={configForm.auto_approve_enabled}
                    onCheckedChange={(v) => setConfigForm({ ...configForm, auto_approve_enabled: v })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <Label>Signals Enabled (Phase 2)</Label>
                  <Switch
                    checked={configForm.signals_enabled}
                    onCheckedChange={(v) => setConfigForm({ ...configForm, signals_enabled: v })}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Min Deposit (USDT)</Label>
                  <Input
                    type="number"
                    value={configForm.min_deposit_usdt}
                    onChange={(e) => setConfigForm({ ...configForm, min_deposit_usdt: Number(e.target.value) })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Deposit Source</Label>
                  <Select
                    value={configForm.deposit_source}
                    onValueChange={(v) => setConfigForm({ ...configForm, deposit_source: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OKX_FUNDING">OKX Funding</SelectItem>
                      <SelectItem value="OKX_TRADING">OKX Trading</SelectItem>
                      <SelectItem value="TOTAL_OKX">Total OKX</SelectItem>
                      <SelectItem value="INTERNAL_WALLET">Internal Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Auto-Approve Max Amount (USDT)</Label>
                  <Input
                    type="number"
                    value={configForm.auto_approve_max_amount}
                    onChange={(e) => setConfigForm({ ...configForm, auto_approve_max_amount: Number(e.target.value) })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Auto-Approve Min Age (minutes)</Label>
                  <Input
                    type="number"
                    value={configForm.auto_approve_min_age_minutes}
                    onChange={(e) => setConfigForm({ ...configForm, auto_approve_min_age_minutes: Number(e.target.value) })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Pool Wallet Name</Label>
                  <Input
                    value={configForm.pool_wallet_name}
                    onChange={(e) => setConfigForm({ ...configForm, pool_wallet_name: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <Button onClick={handleSaveConfig} disabled={savingConfig} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {savingConfig ? "Saving..." : "Save Configuration"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Wallets Tab */}
        <TabsContent value="wallets" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>User Copy Trading Wallets</CardTitle>
                <Button variant="outline" onClick={loadData} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Locked</TableHead>
                    <TableHead>Lifetime Deposited</TableHead>
                    <TableHead>Lifetime P&L</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No wallets yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    wallets.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{w.user_email}</TableCell>
                        <TableCell className="font-mono">{formatUsdt(w.available_balance)} USDT</TableCell>
                        <TableCell className="font-mono">{formatUsdt(w.locked_balance)} USDT</TableCell>
                        <TableCell className="font-mono">{formatUsdt(w.lifetime_deposited)} USDT</TableCell>
                        <TableCell className={`font-mono ${(w.lifetime_pnl || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {(w.lifetime_pnl || 0) >= 0 ? "+" : ""}{formatUsdt(w.lifetime_pnl)} USDT
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[w.status] || ""} variant="outline">
                            {w.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(w.last_activity_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Allocations Tab */}
        <TabsContent value="allocations" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>All Allocation Requests</CardTitle>
                <Button variant="outline" onClick={loadData} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Retry Count</TableHead>
                    <TableHead>Last Error</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Approved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No allocations yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    allocations.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.user_email}</TableCell>
                        <TableCell className="font-mono">{formatUsdt(a.amount)} USDT</TableCell>
                        <TableCell className="text-sm">{a.deposit_source}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[a.status] || ""} variant="outline">
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{a.retry_count || 0}</TableCell>
                        <TableCell className="text-xs text-red-500 max-w-[200px] truncate">
                          {a.last_error || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(a.created_at || a.created_date)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(a.approved_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

CopyTradingAdminTab.propTypes = {
  onRefresh: () => {}
};