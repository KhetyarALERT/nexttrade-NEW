import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Settings, Users, RefreshCw, Loader2, Search, Edit2, Zap, Play
} from 'lucide-react';

const COPY_LEVELS = ['NONE', 'ACCESS', 'PRIORITY', 'FULL'];
const SIGNALS_TIERS = ['NONE', 'BASIC', 'PRO', 'VIP'];
const DEPOSIT_SOURCES = ['TOTAL_OKX', 'OKX_TRADING', 'OKX_FUNDING', 'INTERNAL_WALLET'];

const levelColors = {
  NONE: 'bg-muted text-muted-foreground',
  ACCESS: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  PRIORITY: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  FULL: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  BASIC: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  PRO: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  VIP: 'bg-amber-500/10 text-amber-500 border-amber-500/20'
};

export default function EntitlementsAdminTab({ onRefresh }) {
  const [activeTab, setActiveTab] = useState('config');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [config, setConfig] = useState(null);
  const [configForm, setConfigForm] = useState(/** @type {any} */ ({}));
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [overrideForm, setOverrideForm] = useState(/** @type {any} */ ({}));
  const [auditLog, setAuditLog] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, usersRes, auditRes] = await Promise.all([
        base44.functions.invoke('entitlementsAdmin', { action: 'getConfig' }),
        base44.functions.invoke('entitlementsAdmin', { action: 'listUsersWithEntitlements', search: searchQuery, limit: 50 }),
        base44.functions.invoke('entitlementsAdmin', { action: 'getAuditLog', limit: 30 })
      ]);

      if (configRes.data?.ok && configRes.data.data) {
        setConfig(configRes.data.data);
        setConfigForm(configRes.data.data);
      }
      if (usersRes.data?.ok) setUsers(usersRes.data.data || []);
      if (auditRes.data?.ok) setAuditLog(auditRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveConfig = async () => {
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('entitlementsAdmin', {
        action: 'saveConfig',
        configData: configForm
      });
      if (res.data?.ok) {
        toast.success('Configuration saved');
        loadData();
      } else {
        throw new Error(res.data?.error?.message);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleRunReconcile = async () => {
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('entitlementsAdmin', { action: 'runReconcile' });
      if (res.data?.ok) {
        toast.success(`Processed ${res.data.data?.processed} users`);
        loadData();
        onRefresh?.();
      } else {
        throw new Error(res.data?.error?.message);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenOverride = (user) => {
    setSelectedUser(user);
    setOverrideForm({
      copyTradingEnabled: user.override?.copyTradingEnabled ?? false,
      copyTradingLevel: user.override?.copyTradingLevel || 'NONE',
      signalsEnabled: user.override?.signalsEnabled ?? false,
      signalsTier: user.override?.signalsTier || 'NONE',
      reason: user.override?.reason || '',
      expiresAt: user.override?.expiresAt ? user.override.expiresAt.split('T')[0] : ''
    });
    setOverrideDialogOpen(true);
  };

  const handleSaveOverride = async () => {
    if (!selectedUser) return;
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('entitlementsAdmin', {
        action: 'setOverride',
        userId: selectedUser.id,
        ...overrideForm,
        expiresAt: overrideForm.expiresAt ? new Date(overrideForm.expiresAt).toISOString() : null
      });
      if (res.data?.ok) {
        toast.success('Override saved');
        setOverrideDialogOpen(false);
        loadData();
      } else {
        throw new Error(res.data?.error?.message);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Entitlements</h2>
          <p className="text-muted-foreground">Manage user access and global rules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button onClick={handleRunReconcile} disabled={processing}>
            <Play className="w-4 h-4 mr-2" /> Reconcile All
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="config" className="px-4">Configuration</TabsTrigger>
          <TabsTrigger value="users" className="px-4">User Overrides</TabsTrigger>
          <TabsTrigger value="audit" className="px-4">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>Global Rules</CardTitle>
              <CardDescription>Default settings applied to all users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Copy Trading Rules */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" /> Copy Trading Eligibility
                </h3>
                <div className="grid md:grid-cols-2 gap-6 p-4 border rounded-xl bg-card">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Global Enable</Label>
                      <p className="text-xs text-muted-foreground">Allow new users to qualify</p>
                    </div>
                    <Switch 
                      checked={configForm.copy_trading_global_enabled}
                      onCheckedChange={(v) => setConfigForm({...configForm, copy_trading_global_enabled: v})}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Require KYC</Label>
                      <p className="text-xs text-muted-foreground">Must be verified</p>
                    </div>
                    <Switch 
                      checked={configForm.copy_trading_require_kyc}
                      onCheckedChange={(v) => setConfigForm({...configForm, copy_trading_require_kyc: v})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Minimum Deposit (USDT)</Label>
                    <Input 
                      type="number" 
                      value={configForm.copy_trading_min_deposit_usdt}
                      onChange={(e) => setConfigForm({...configForm, copy_trading_min_deposit_usdt: Number(e.target.value)})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Deposit Source</Label>
                    <Select 
                      value={configForm.copy_trading_deposit_source}
                      onValueChange={(v) => setConfigForm({...configForm, copy_trading_deposit_source: v})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DEPOSIT_SOURCES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Benefits Valuation (Display Only) */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  🎁 Benefits Valuation (Display Only)
                </h3>
                <div className="grid md:grid-cols-2 gap-6 p-4 border rounded-xl bg-card">
                  <div className="space-y-2">
                    <Label>Benefits Cap (USD)</Label>
                    <Input 
                      type="number" 
                      step="1"
                      value={configForm.benefits_value_cap_usd ?? 54}
                      onChange={(e) => setConfigForm({...configForm, benefits_value_cap_usd: Number(e.target.value)})}
                    />
                    <p className="text-xs text-muted-foreground">Max displayed value (marketing cap)</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Point Value (USD per point)</Label>
                    <Input 
                      type="number" 
                      step="0.001"
                      value={configForm.points_value_usd ?? 0.005}
                      onChange={(e) => setConfigForm({...configForm, points_value_usd: Number(e.target.value)})}
                    />
                    <p className="text-xs text-muted-foreground">Display only — not withdrawable cash</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Label (EN)</Label>
                    <Input 
                      value={configForm.benefits_label_en ?? "Estimated benefits value (up to $54)"}
                      onChange={(e) => setConfigForm({...configForm, benefits_label_en: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Label (AR)</Label>
                    <Input 
                      dir="rtl"
                      value={configForm.benefits_label_ar ?? "قيمة المزايا التقريبية (حتى $54)"}
                      onChange={(e) => setConfigForm({...configForm, benefits_label_ar: e.target.value})}
                    />
                  </div>
                </div>
                {/* Preview */}
                <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                  <p className="font-medium mb-1">Preview:</p>
                  <p>If user has 10,000 points → shows <strong className="text-foreground">${Math.min(10000 * (configForm.points_value_usd || 0.005), configForm.benefits_value_cap_usd || 54).toFixed(2)}</strong> (capped at ${configForm.benefits_value_cap_usd || 54})</p>
                </div>
              </div>

              {/* Defaults */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Defaults
                </h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Default Copy Level</Label>
                    <Select 
                      value={configForm.copy_trading_default_level}
                      onValueChange={(v) => setConfigForm({...configForm, copy_trading_default_level: v})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COPY_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Default Signals Tier</Label>
                    <Select 
                      value={configForm.default_signals_tier}
                      onValueChange={(v) => setConfigForm({...configForm, default_signals_tier: v})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SIGNALS_TIERS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Max Leverage</Label>
                    <Input 
                      type="number"
                      value={configForm.default_leverage_max}
                      onChange={(e) => setConfigForm({...configForm, default_leverage_max: Number(e.target.value)})}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button onClick={handleSaveConfig} disabled={processing} className="min-w-[120px]">
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search users..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="pl-9"
              />
            </div>
            <Button variant="secondary" onClick={loadData}>Search</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Copy Level</TableHead>
                    <TableHead>Signals</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No users found</TableCell>
                    </TableRow>
                  ) : (
                    users.map(u => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="font-medium">{u.email}</div>
                          <div className="text-xs text-muted-foreground">{u.id}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={levelColors[u.entitlement?.copyTradingLevel] || ''}>
                            {u.entitlement?.copyTradingLevel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={levelColors[u.entitlement?.signalsTier] || ''}>
                            {u.entitlement?.signalsTier}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.override ? (
                            <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20">
                              <Zap className="w-3 h-3 mr-1" /> Override
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Default</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenOverride(u)}>
                            <Edit2 className="w-4 h-4" />
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

        <TabsContent value="audit">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLog.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No logs</TableCell>
                      </TableRow>
                    ) : (
                      auditLog.map(log => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                          <TableCell className="text-sm">{log.changed_by_admin_email}</TableCell>
                          <TableCell className="text-xs font-mono max-w-[300px] truncate">
                            {JSON.stringify(log.details || log.reason || {})}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Override Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Override Entitlements</DialogTitle>
            <DialogDescription>{selectedUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between border p-3 rounded-lg">
              <Label>Enable Copy Trading</Label>
              <Switch 
                checked={overrideForm.copyTradingEnabled}
                onCheckedChange={(v) => setOverrideForm({...overrideForm, copyTradingEnabled: v})}
              />
            </div>
            
            {overrideForm.copyTradingEnabled && (
              <div className="space-y-2">
                <Label>Level</Label>
                <Select 
                  value={overrideForm.copyTradingLevel}
                  onValueChange={(v) => setOverrideForm({...overrideForm, copyTradingLevel: v})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COPY_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between border p-3 rounded-lg">
              <Label>Enable Signals</Label>
              <Switch 
                checked={overrideForm.signalsEnabled}
                onCheckedChange={(v) => setOverrideForm({...overrideForm, signalsEnabled: v})}
              />
            </div>

            {overrideForm.signalsEnabled && (
              <div className="space-y-2">
                <Label>Tier</Label>
                <Select 
                  value={overrideForm.signalsTier}
                  onValueChange={(v) => setOverrideForm({...overrideForm, signalsTier: v})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SIGNALS_TIERS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea 
                value={overrideForm.reason}
                onChange={(e) => setOverrideForm({...overrideForm, reason: e.target.value})}
                placeholder="Why override?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveOverride} disabled={processing}>Save Override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}