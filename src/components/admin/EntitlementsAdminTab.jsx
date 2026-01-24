import React, { useState, useEffect, useCallback } from 'react';
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
  Settings, Users, Shield, RefreshCw, Loader2, Search, Edit2, Trash2, 
  CheckCircle2, XCircle, Clock, History, Zap, Play
} from 'lucide-react';

const COPY_LEVELS = ['NONE', 'ACCESS', 'PRIORITY', 'FULL'];
const SIGNALS_TIERS = ['NONE', 'BASIC', 'PRO', 'VIP'];
const DEPOSIT_SOURCES = ['TOTAL_OKX', 'OKX_TRADING', 'OKX_FUNDING', 'INTERNAL_WALLET'];

const levelColors = {
  NONE: 'bg-gray-500/10 text-gray-500',
  ACCESS: 'bg-blue-500/10 text-blue-500',
  PRIORITY: 'bg-purple-500/10 text-purple-500',
  FULL: 'bg-emerald-500/10 text-emerald-500',
  BASIC: 'bg-blue-500/10 text-blue-500',
  PRO: 'bg-purple-500/10 text-purple-500',
  VIP: 'bg-amber-500/10 text-amber-500'
};

const sourceColors = {
  NONE: 'bg-gray-500/10 text-gray-500',
  OVERRIDE: 'bg-amber-500/10 text-amber-600',
  GLOBAL: 'bg-blue-500/10 text-blue-600',
  STAKING: 'bg-emerald-500/10 text-emerald-600'
};

export default function EntitlementsAdminTab({ onRefresh }) {
  const [activeTab, setActiveTab] = useState('config');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Config state
  const [config, setConfig] = useState(null);
  const [configForm, setConfigForm] = useState({
    copy_trading_global_enabled: false,
    copy_trading_min_deposit_usdt: 100,
    copy_trading_require_kyc: true,
    copy_trading_default_level: 'ACCESS',
    copy_trading_deposit_source: 'TOTAL_OKX',
    default_signals_tier: 'NONE',
    default_leverage_max: 5
  });

  // Users state
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Override form
  const [overrideForm, setOverrideForm] = useState({
    copyTradingEnabled: false,
    copyTradingLevel: 'NONE',
    signalsEnabled: false,
    signalsTier: 'NONE',
    reason: '',
    expiresAt: ''
  });

  // Audit log
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
        setConfigForm({
          copy_trading_global_enabled: configRes.data.data.copy_trading_global_enabled ?? false,
          copy_trading_min_deposit_usdt: configRes.data.data.copy_trading_min_deposit_usdt ?? 100,
          copy_trading_require_kyc: configRes.data.data.copy_trading_require_kyc ?? true,
          copy_trading_default_level: configRes.data.data.copy_trading_default_level || 'ACCESS',
          copy_trading_deposit_source: configRes.data.data.copy_trading_deposit_source || 'TOTAL_OKX',
          default_signals_tier: configRes.data.data.default_signals_tier || 'NONE',
          default_leverage_max: configRes.data.data.default_leverage_max ?? 5
        });
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
        toast.success('Config saved');
        loadData();
      } else {
        toast.error(res.data?.error?.message || 'Failed to save');
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
        toast.success(`Reconciliation complete: ${res.data.data?.processed || 0} users processed`);
        loadData();
        onRefresh?.();
      } else {
        toast.error(res.data?.error?.message || 'Failed');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleViewDetails = async (userId) => {
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('entitlementsAdmin', {
        action: 'getUserEntitlement',
        userId
      });
      if (res.data?.ok) {
        setUserDetails(res.data.data);
        setDetailsDialogOpen(true);
      }
    } catch (err) {
      toast.error('Failed to load details');
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
        toast.error(res.data?.error?.message || 'Failed');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteOverride = async (userId) => {
    if (!confirm('Remove this override?')) return;
    try {
      await base44.functions.invoke('entitlementsAdmin', { action: 'deleteOverride', userId });
      toast.success('Override removed');
      loadData();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Entitlements & Copy Trading
          </h2>
          <p className="text-sm text-muted-foreground">Configure access rules and manage user overrides</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={handleRunReconcile} disabled={processing}>
            {processing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
            Reconcile Now
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="config">
            <Settings className="w-4 h-4 mr-1" />
            Global Config
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="w-4 h-4 mr-1" />
            Users & Overrides
          </TabsTrigger>
          <TabsTrigger value="audit">
            <History className="w-4 h-4 mr-1" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* CONFIG TAB */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Copy Trading Global Rules</CardTitle>
              <CardDescription>Enable copy trading for all users meeting deposit requirements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Global Copy Trading Enabled</Label>
                  <p className="text-xs text-muted-foreground">Enable for everyone meeting min deposit</p>
                </div>
                <Switch
                  checked={configForm.copy_trading_global_enabled}
                  onCheckedChange={(v) => setConfigForm({ ...configForm, copy_trading_global_enabled: v })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Min Deposit (USDT)</Label>
                  <Input
                    type="number"
                    value={configForm.copy_trading_min_deposit_usdt}
                    onChange={(e) => setConfigForm({ ...configForm, copy_trading_min_deposit_usdt: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Deposit Source</Label>
                  <Select
                    value={configForm.copy_trading_deposit_source}
                    onValueChange={(v) => setConfigForm({ ...configForm, copy_trading_deposit_source: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEPOSIT_SOURCES.map(s => (
                        <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Default Level</Label>
                  <Select
                    value={configForm.copy_trading_default_level}
                    onValueChange={(v) => setConfigForm({ ...configForm, copy_trading_default_level: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COPY_LEVELS.map(l => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={configForm.copy_trading_require_kyc}
                    onCheckedChange={(v) => setConfigForm({ ...configForm, copy_trading_require_kyc: v })}
                  />
                  <Label>Require KYC</Label>
                </div>
              </div>

              <div className="border-t pt-4">
                <CardTitle className="text-base mb-3">Default Entitlements</CardTitle>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Default Signals Tier</Label>
                    <Select
                      value={configForm.default_signals_tier}
                      onValueChange={(v) => setConfigForm({ ...configForm, default_signals_tier: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SIGNALS_TIERS.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Default Max Leverage</Label>
                    <Input
                      type="number"
                      value={configForm.default_leverage_max}
                      onChange={(e) => setConfigForm({ ...configForm, default_leverage_max: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveConfig} disabled={processing}>
                  {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Config
                </Button>
              </div>
            </CardContent>
          </Card>

          {config && (
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  Last updated: {formatDate(config.updated_at)} by {config.updated_by || 'System'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={loadData}>Search</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Copy Trading</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Signals</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Override</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{u.fullName || u.email}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                            {u.kycVerified && (
                              <Badge variant="outline" className="text-[10px] mt-1">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                KYC
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={levelColors[u.entitlement?.copyTradingLevel] || levelColors.NONE}>
                            {u.entitlement?.copyTradingLevel || 'NONE'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={sourceColors[u.entitlement?.copyTradingSource] || ''}>
                            {u.entitlement?.copyTradingSource || 'NONE'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={levelColors[u.entitlement?.signalsTier] || levelColors.NONE}>
                            {u.entitlement?.signalsTier || 'NONE'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          {u.entitlement?.totalPointsBalance?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell>
                          {u.override?.copyTradingEnabled ? (
                            <Badge className="bg-amber-500/10 text-amber-600">
                              <Zap className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewDetails(u.id)}>
                              <Search className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenOverride(u)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            {u.override && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDeleteOverride(u.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUDIT TAB */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit Log</CardTitle>
              <CardDescription>Recent changes to config and overrides</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Changed By</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLog.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No audit entries
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditLog.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs">{formatDate(log.created_at)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.entity_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={log.action === 'DELETE' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{log.changed_by_admin_email}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {log.reason || (log.user_id ? `User: ${log.user_id}` : '-')}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Override: {selectedUser?.email}</DialogTitle>
            <DialogDescription>Override entitlements for this user</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Copy Trading Override</Label>
              <Switch
                checked={overrideForm.copyTradingEnabled}
                onCheckedChange={(v) => setOverrideForm({ ...overrideForm, copyTradingEnabled: v })}
              />
            </div>

            {overrideForm.copyTradingEnabled && (
              <div>
                <Label>Level</Label>
                <Select
                  value={overrideForm.copyTradingLevel}
                  onValueChange={(v) => setOverrideForm({ ...overrideForm, copyTradingLevel: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COPY_LEVELS.map(l => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label>Signals Override</Label>
                <Switch
                  checked={overrideForm.signalsEnabled}
                  onCheckedChange={(v) => setOverrideForm({ ...overrideForm, signalsEnabled: v })}
                />
              </div>

              {overrideForm.signalsEnabled && (
                <Select
                  value={overrideForm.signalsTier}
                  onValueChange={(v) => setOverrideForm({ ...overrideForm, signalsTier: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SIGNALS_TIERS.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label>Reason</Label>
              <Textarea
                value={overrideForm.reason}
                onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                placeholder="Reason for override..."
              />
            </div>

            <div>
              <Label>Expires (optional)</Label>
              <Input
                type="date"
                value={overrideForm.expiresAt}
                onChange={(e) => setOverrideForm({ ...overrideForm, expiresAt: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveOverride} disabled={processing}>
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Entitlement Details</DialogTitle>
            <DialogDescription>{userDetails?.user?.email}</DialogDescription>
          </DialogHeader>
          {userDetails && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                {/* Current Entitlement */}
                {userDetails.entitlement && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Current Entitlement</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Copy Trading</p>
                          <Badge className={levelColors[userDetails.entitlement.copy_trading_level]}>
                            {userDetails.entitlement.copy_trading_level}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            via {userDetails.entitlement.copy_trading_source}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Signals</p>
                          <Badge className={levelColors[userDetails.entitlement.signals_tier]}>
                            {userDetails.entitlement.signals_tier}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Points</p>
                          <p className="font-mono font-medium">
                            {userDetails.entitlement.total_points_balance?.toLocaleString() || 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Active Staking */}
                {userDetails.activePositions?.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Active Staking</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {userDetails.activePositions.map((p) => (
                          <div key={p.id} className="flex justify-between text-sm bg-muted/30 rounded px-3 py-2">
                            <div>
                              <span className="font-medium">{p.planKey}</span>
                              <span className="text-muted-foreground ml-2">${p.principal} USDT</span>
                            </div>
                            <div className="text-muted-foreground">
                              +{p.pointsGranted || 0} pts
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Points */}
                {userDetails.recentPointsLedger?.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Recent Points Activity</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {userDetails.recentPointsLedger.map((l) => (
                          <div key={l.id} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{l.description || l.subtype}</span>
                            <span className="font-mono text-emerald-600">+{l.points}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}