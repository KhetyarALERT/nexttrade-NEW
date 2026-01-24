import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Settings, RefreshCw, Loader2, Search, UserPlus, Edit2, Trash2, 
  Shield, Copy as CopyIcon, History, CheckCircle2, XCircle, AlertCircle,
  Crown, Zap, TrendingUp, Users
} from 'lucide-react';

const COPY_TRADING_LEVELS = ['NONE', 'ACCESS', 'PRIORITY', 'FULL'];
const SIGNALS_TIERS = ['NONE', 'BASIC', 'PRO', 'VIP'];
const DEPOSIT_SOURCES = ['OKX_TRADING', 'OKX_FUNDING', 'TOTAL_OKX', 'INTERNAL_WALLET'];

const LEVEL_COLORS = {
  NONE: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  ACCESS: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  PRIORITY: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  FULL: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  BASIC: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  PRO: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  VIP: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
};

const SOURCE_COLORS = {
  NONE: 'bg-gray-500/10 text-gray-500',
  OVERRIDE: 'bg-red-500/10 text-red-500',
  GLOBAL: 'bg-green-500/10 text-green-500',
  STAKING: 'bg-purple-500/10 text-purple-500',
};

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

function formatUsdt(val) {
  if (val === null || val === undefined) return '-';
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function EntitlementsAdminTab({ onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [overrides, setOverrides] = useState([]);
  const [entitlements, setEntitlements] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('config');
  
  // Dialog states
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [editingOverride, setEditingOverride] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Config form
  const [configForm, setConfigForm] = useState({
    copy_trading_global_enabled: false,
    copy_trading_min_deposit_usdt: 100,
    copy_trading_require_kyc: false,
    copy_trading_default_level: 'ACCESS',
    copy_trading_deposit_source: 'TOTAL_OKX',
    default_signals_tier: 'NONE',
    default_leverage_max: 10,
  });

  // Override form
  const [overrideForm, setOverrideForm] = useState({
    targetUserId: '',
    targetUserEmail: '',
    copy_trading_override_enabled: false,
    copy_trading_override_level: 'NONE',
    signals_override_enabled: false,
    signals_override_tier: 'NONE',
    leverage_override_enabled: false,
    leverage_override_max: 10,
    reason: '',
    expires_at: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('entitlementsProcessor', {
        action: 'getAdminDashboard',
        search: searchQuery || undefined,
        limit: 100,
      });

      if (res.data?.ok) {
        const data = res.data.data;
        setConfig(data.config);
        setOverrides(data.overrides || []);
        setEntitlements(data.entitlements || []);
        setAuditLogs(data.auditLogs || []);

        if (data.config) {
          setConfigForm({
            copy_trading_global_enabled: data.config.copy_trading_global_enabled ?? false,
            copy_trading_min_deposit_usdt: data.config.copy_trading_min_deposit_usdt ?? 100,
            copy_trading_require_kyc: data.config.copy_trading_require_kyc ?? false,
            copy_trading_default_level: data.config.copy_trading_default_level ?? 'ACCESS',
            copy_trading_deposit_source: data.config.copy_trading_deposit_source ?? 'TOTAL_OKX',
            default_signals_tier: data.config.default_signals_tier ?? 'NONE',
            default_leverage_max: data.config.default_leverage_max ?? 10,
          });
        }
      } else {
        toast.error(res.data?.error?.message || 'Failed to load data');
      }
    } catch (err) {
      toast.error('Failed to load entitlements data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = () => {
    loadData();
  };

  const handleSaveConfig = async () => {
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('entitlementsProcessor', {
        action: 'updateConfig',
        ...configForm,
      });

      if (res.data?.ok) {
        toast.success('Config saved');
        setConfigDialogOpen(false);
        loadData();
        onRefresh?.();
      } else {
        toast.error(res.data?.error?.message || 'Failed to save');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save config');
    } finally {
      setProcessing(false);
    }
  };

  const openOverrideDialog = (override = null) => {
    if (override) {
      setEditingOverride(override);
      setOverrideForm({
        targetUserId: override.user_id,
        targetUserEmail: override.user_email || '',
        copy_trading_override_enabled: override.copy_trading_override_enabled || false,
        copy_trading_override_level: override.copy_trading_override_level || 'NONE',
        signals_override_enabled: override.signals_override_enabled || false,
        signals_override_tier: override.signals_override_tier || 'NONE',
        leverage_override_enabled: override.leverage_override_enabled || false,
        leverage_override_max: override.leverage_override_max || 10,
        reason: override.reason || '',
        expires_at: override.expires_at ? override.expires_at.slice(0, 16) : '',
      });
    } else {
      setEditingOverride(null);
      setOverrideForm({
        targetUserId: '',
        targetUserEmail: '',
        copy_trading_override_enabled: false,
        copy_trading_override_level: 'NONE',
        signals_override_enabled: false,
        signals_override_tier: 'NONE',
        leverage_override_enabled: false,
        leverage_override_max: 10,
        reason: '',
        expires_at: '',
      });
    }
    setOverrideDialogOpen(true);
  };

  const handleSaveOverride = async () => {
    if (!editingOverride && !overrideForm.targetUserId) {
      toast.error('User ID is required');
      return;
    }

    setProcessing(true);
    try {
      const action = editingOverride ? 'updateOverride' : 'createOverride';
      const payload = editingOverride
        ? { action, overrideId: editingOverride.id, ...overrideForm }
        : { action, ...overrideForm };

      if (overrideForm.expires_at) {
        payload.expires_at = new Date(overrideForm.expires_at).toISOString();
      } else {
        payload.expires_at = null;
      }

      const res = await base44.functions.invoke('entitlementsProcessor', payload);

      if (res.data?.ok) {
        toast.success(editingOverride ? 'Override updated' : 'Override created');
        setOverrideDialogOpen(false);
        loadData();
        onRefresh?.();
      } else {
        toast.error(res.data?.error?.message || 'Failed to save');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save override');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteOverride = async (override) => {
    if (!confirm(`Delete override for ${override.user_email || override.user_id}?`)) return;

    try {
      const res = await base44.functions.invoke('entitlementsProcessor', {
        action: 'deleteOverride',
        overrideId: override.id,
      });

      if (res.data?.ok) {
        toast.success('Override deleted');
        loadData();
        onRefresh?.();
      } else {
        toast.error(res.data?.error?.message || 'Failed to delete');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRefreshUser = async (userId) => {
    try {
      const res = await base44.functions.invoke('entitlementsProcessor', {
        action: 'refreshUser',
        userId,
      });

      if (res.data?.ok) {
        toast.success('Entitlements refreshed');
        loadData();
      } else {
        toast.error(res.data?.error?.message || 'Failed to refresh');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRefreshAll = async () => {
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('entitlementsProcessor', {
        action: 'refreshAll',
        limit: 100,
      });

      if (res.data?.ok) {
        const data = res.data.data;
        toast.success(`Refreshed ${data.refreshed} users (${data.errors} errors)`);
        loadData();
        onRefresh?.();
      } else {
        toast.error(res.data?.error?.message || 'Failed to refresh');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            Entitlements & Copy Trading
          </h2>
          <p className="text-sm text-muted-foreground">Manage feature access and user overrides</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={processing}>
            {processing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
            Refresh All Users
          </Button>
          <Button size="sm" onClick={() => setConfigDialogOpen(true)}>
            <Settings className="w-4 h-4 mr-1" />
            Global Config
          </Button>
        </div>
      </div>

      {/* Global Config Summary */}
      {config && (
        <Card className={config.copy_trading_global_enabled ? 'border-green-500/30 bg-green-500/5' : ''}>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.copy_trading_global_enabled ? 'bg-green-500/20' : 'bg-muted'}`}>
                  <CopyIcon className={`w-5 h-5 ${config.copy_trading_global_enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="font-medium">
                    Copy Trading: {config.copy_trading_global_enabled ? 'Globally Enabled' : 'Disabled (Staking/Override only)'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {config.copy_trading_global_enabled && (
                      <>
                        Min deposit: ${formatUsdt(config.copy_trading_min_deposit_usdt)} • 
                        Source: {config.copy_trading_deposit_source} • 
                        {config.copy_trading_require_kyc ? ' KYC required' : ' No KYC required'} • 
                        Default level: {config.copy_trading_default_level}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Signals Tier</p>
                  <Badge className={LEVEL_COLORS[config.default_signals_tier] || ''}>
                    {config.default_signals_tier}
                  </Badge>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Max Leverage</p>
                  <p className="font-mono font-medium">{config.default_leverage_max}x</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users">
            <Users className="w-4 h-4 mr-1" />
            Users ({entitlements.length})
          </TabsTrigger>
          <TabsTrigger value="overrides">
            <Shield className="w-4 h-4 mr-1" />
            Overrides ({overrides.length})
          </TabsTrigger>
          <TabsTrigger value="audit">
            <History className="w-4 h-4 mr-1" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <Input
              placeholder="Search by email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="max-w-sm"
            />
            <Button variant="outline" onClick={handleSearch}>
              <Search className="w-4 h-4" />
            </Button>
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
                    <TableHead>Leverage</TableHead>
                    <TableHead>Staking Plan</TableHead>
                    <TableHead>Deposit</TableHead>
                    <TableHead>Evaluated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entitlements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    entitlements.map((ent) => (
                      <TableRow key={ent.id}>
                        <TableCell>
                          <p className="font-medium text-sm truncate max-w-[180px]">{ent.user_email || ent.user_id}</p>
                        </TableCell>
                        <TableCell>
                          <Badge className={LEVEL_COLORS[ent.copy_trading_level] || ''}>
                            {ent.copy_trading_level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={SOURCE_COLORS[ent.copy_trading_source] || ''}>
                            {ent.copy_trading_source}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={LEVEL_COLORS[ent.signals_tier] || ''}>
                            {ent.signals_tier}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">{ent.leverage_max}x</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ent.active_plan_key || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          ${formatUsdt(ent.last_deposit_usdt)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ent.evaluated_at ? new Date(ent.evaluated_at).toLocaleString() : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleRefreshUser(ent.user_id)}
                              title="Refresh"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setOverrideForm({ ...overrideForm, targetUserId: ent.user_id, targetUserEmail: ent.user_email });
                                openOverrideDialog();
                              }}
                              title="Create Override"
                            >
                              <UserPlus className="w-4 h-4" />
                            </Button>
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

        {/* Overrides Tab */}
        <TabsContent value="overrides" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openOverrideDialog()}>
              <UserPlus className="w-4 h-4 mr-1" />
              Add Override
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Copy Trading</TableHead>
                    <TableHead>Signals</TableHead>
                    <TableHead>Leverage</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overrides.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No overrides configured
                      </TableCell>
                    </TableRow>
                  ) : (
                    overrides.map((ovr) => (
                      <TableRow key={ovr.id} className={!ovr.is_active ? 'opacity-50' : ''}>
                        <TableCell>
                          <p className="font-medium text-sm truncate max-w-[180px]">{ovr.user_email || ovr.user_id}</p>
                          {!ovr.is_active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                        </TableCell>
                        <TableCell>
                          {ovr.copy_trading_override_enabled ? (
                            <Badge className={LEVEL_COLORS[ovr.copy_trading_override_level] || ''}>
                              {ovr.copy_trading_override_level}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {ovr.signals_override_enabled ? (
                            <Badge className={LEVEL_COLORS[ovr.signals_override_tier] || ''}>
                              {ovr.signals_override_tier}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {ovr.leverage_override_enabled ? (
                            <span className="font-mono">{ovr.leverage_override_max}x</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate">
                          {ovr.reason || '-'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ovr.expires_at ? new Date(ovr.expires_at).toLocaleDateString() : 'Never'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
                          {ovr.created_by_admin_email || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openOverrideDialog(ovr)}
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500"
                              onClick={() => handleDeleteOverride(ovr)}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Changes</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {auditLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No audit logs</p>
                ) : (
                  <div className="space-y-3">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          log.action_type === 'CONFIG_UPDATE' ? 'bg-blue-500/20' :
                          log.action_type === 'OVERRIDE_CREATE' ? 'bg-green-500/20' :
                          log.action_type === 'OVERRIDE_DELETE' ? 'bg-red-500/20' :
                          'bg-muted'
                        }`}>
                          {log.action_type === 'CONFIG_UPDATE' && <Settings className="w-4 h-4 text-blue-500" />}
                          {log.action_type === 'OVERRIDE_CREATE' && <UserPlus className="w-4 h-4 text-green-500" />}
                          {log.action_type === 'OVERRIDE_UPDATE' && <Edit2 className="w-4 h-4 text-amber-500" />}
                          {log.action_type === 'OVERRIDE_DELETE' && <Trash2 className="w-4 h-4 text-red-500" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{log.action_type}</Badge>
                            <span className="text-xs text-muted-foreground">{formatDate(log.created_date)}</span>
                          </div>
                          <p className="text-sm mt-1">
                            {log.target_user_email && <span className="font-medium">{log.target_user_email}</span>}
                            {log.note && <span className="text-muted-foreground"> — {log.note}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">by {log.admin_email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Global Config Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Global Entitlements Config</DialogTitle>
            <DialogDescription>Configure default entitlements and copy trading global rule</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Copy Trading Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Copy Trading (Global Rule)</Label>
                  <p className="text-xs text-muted-foreground">Enable for all users meeting deposit requirement</p>
                </div>
                <Switch
                  checked={configForm.copy_trading_global_enabled}
                  onCheckedChange={(v) => setConfigForm({ ...configForm, copy_trading_global_enabled: v })}
                />
              </div>

              {configForm.copy_trading_global_enabled && (
                <div className="pl-4 border-l-2 border-primary/30 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Min Deposit (USDT)</Label>
                      <Input
                        type="number"
                        value={configForm.copy_trading_min_deposit_usdt}
                        onChange={(e) => setConfigForm({ ...configForm, copy_trading_min_deposit_usdt: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Default Level</Label>
                      <Select
                        value={configForm.copy_trading_default_level}
                        onValueChange={(v) => setConfigForm({ ...configForm, copy_trading_default_level: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COPY_TRADING_LEVELS.map((level) => (
                            <SelectItem key={level} value={level}>{level}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Deposit Source</Label>
                      <Select
                        value={configForm.copy_trading_deposit_source}
                        onValueChange={(v) => setConfigForm({ ...configForm, copy_trading_deposit_source: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPOSIT_SOURCES.map((src) => (
                            <SelectItem key={src} value={src}>{src}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between pt-6">
                      <Label>Require KYC</Label>
                      <Switch
                        checked={configForm.copy_trading_require_kyc}
                        onCheckedChange={(v) => setConfigForm({ ...configForm, copy_trading_require_kyc: v })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Defaults Section */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="text-base">Default Entitlements</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Signals Tier</Label>
                  <Select
                    value={configForm.default_signals_tier}
                    onValueChange={(v) => setConfigForm({ ...configForm, default_signals_tier: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SIGNALS_TIERS.map((tier) => (
                        <SelectItem key={tier} value={tier}>{tier}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Max Leverage</Label>
                  <Input
                    type="number"
                    value={configForm.default_leverage_max}
                    onChange={(e) => setConfigForm({ ...configForm, default_leverage_max: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveConfig} disabled={processing}>
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingOverride ? 'Edit Override' : 'Create Override'}</DialogTitle>
            <DialogDescription>
              {editingOverride
                ? `Editing override for ${editingOverride.user_email || editingOverride.user_id}`
                : 'Create a manual override for a specific user'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!editingOverride && (
              <div>
                <Label>User ID</Label>
                <Input
                  value={overrideForm.targetUserId}
                  onChange={(e) => setOverrideForm({ ...overrideForm, targetUserId: e.target.value })}
                  placeholder="User ID"
                />
                <Input
                  className="mt-2"
                  value={overrideForm.targetUserEmail}
                  onChange={(e) => setOverrideForm({ ...overrideForm, targetUserEmail: e.target.value })}
                  placeholder="User Email (optional, for reference)"
                />
              </div>
            )}

            {/* Copy Trading Override */}
            <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between">
                <Label>Override Copy Trading</Label>
                <Switch
                  checked={overrideForm.copy_trading_override_enabled}
                  onCheckedChange={(v) => setOverrideForm({ ...overrideForm, copy_trading_override_enabled: v })}
                />
              </div>
              {overrideForm.copy_trading_override_enabled && (
                <Select
                  value={overrideForm.copy_trading_override_level}
                  onValueChange={(v) => setOverrideForm({ ...overrideForm, copy_trading_override_level: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COPY_TRADING_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Signals Override */}
            <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between">
                <Label>Override Signals Tier</Label>
                <Switch
                  checked={overrideForm.signals_override_enabled}
                  onCheckedChange={(v) => setOverrideForm({ ...overrideForm, signals_override_enabled: v })}
                />
              </div>
              {overrideForm.signals_override_enabled && (
                <Select
                  value={overrideForm.signals_override_tier}
                  onValueChange={(v) => setOverrideForm({ ...overrideForm, signals_override_tier: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIGNALS_TIERS.map((tier) => (
                      <SelectItem key={tier} value={tier}>{tier}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Leverage Override */}
            <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between">
                <Label>Override Max Leverage</Label>
                <Switch
                  checked={overrideForm.leverage_override_enabled}
                  onCheckedChange={(v) => setOverrideForm({ ...overrideForm, leverage_override_enabled: v })}
                />
              </div>
              {overrideForm.leverage_override_enabled && (
                <Input
                  type="number"
                  value={overrideForm.leverage_override_max}
                  onChange={(e) => setOverrideForm({ ...overrideForm, leverage_override_max: Number(e.target.value) })}
                />
              )}
            </div>

            <div>
              <Label>Reason</Label>
              <Textarea
                value={overrideForm.reason}
                onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                placeholder="Reason for override..."
                rows={2}
              />
            </div>

            <div>
              <Label>Expires At (optional)</Label>
              <Input
                type="datetime-local"
                value={overrideForm.expires_at}
                onChange={(e) => setOverrideForm({ ...overrideForm, expires_at: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveOverride} disabled={processing}>
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}