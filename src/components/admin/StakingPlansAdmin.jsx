import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Copy, Trash2, Loader2, Settings, RefreshCw, Zap, Play, TrendingUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SIGNALS_TIERS = ['NONE', 'BASIC', 'PRO', 'VIP'];
const COPY_LEVELS = ['NONE', 'ACCESS', 'PRIORITY', 'FULL'];

export default function StakingPlansAdmin({ onRefresh }) {
  const [adminTab, setAdminTab] = useState('plans');
  const [plans, setPlans] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [autoApproveDialogOpen, setAutoApproveDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [runningAutoApprove, setRunningAutoApprove] = useState(false);

  const [form, setForm] = useState({
    key: '',
    title: '',
    short_description: '',
    term_days: 30,
    apy_percent: 10,
    min_deposit: 50,
    base_rewards_per_dollar: 10,
    benefits_cap_usd: 0,
    perks: '',
    signals_tier: 'NONE',
    copy_trading_level: 'ACCESS',
    leverage_max: 5,
    fee_discount_bps: 0,
    mentor_access: false,
    priority_support: false,
    priority: 0,
    is_enabled: true,
    is_recommended: false,
    sort_order: 0,
  });

  const [configForm, setConfigForm] = useState({
    first_stake_enabled: true,
    first_stake_min_term_days: 60,
    first_stake_min_amount: 100,
    first_stake_cap_principal: 300,
    first_stake_bonus_multiplier: 1.5,
    main_staking_pool_name: 'Main Staking Pool',
  });

  const [autoApproveForm, setAutoApproveForm] = useState({
    auto_approve_enabled: false,
    auto_approve_max_amount: 1000,
    auto_approve_plans: '',
    auto_approve_require_kyc: true,
    auto_approve_min_age_minutes: 5,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansRes, configRes] = await Promise.all([
        base44.entities.StakingPlan.list('sort_order', 20),
        base44.entities.StakingConfig.filter({ config_key: 'default' }),
      ]);
      setPlans(plansRes || []);
      if (configRes?.length) {
        setConfig(configRes[0]);
        setConfigForm({
          first_stake_enabled: configRes[0].first_stake_enabled ?? true,
          first_stake_min_term_days: configRes[0].first_stake_min_term_days ?? 60,
          first_stake_min_amount: configRes[0].first_stake_min_amount ?? 100,
          first_stake_cap_principal: configRes[0].first_stake_cap_principal ?? 300,
          first_stake_bonus_multiplier: configRes[0].first_stake_bonus_multiplier ?? 1.5,
          main_staking_pool_name: configRes[0].main_staking_pool_name ?? 'Main Staking Pool',
        });
        setAutoApproveForm({
          auto_approve_enabled: configRes[0].auto_approve_enabled ?? false,
          auto_approve_max_amount: configRes[0].auto_approve_max_amount ?? 1000,
          auto_approve_plans: (configRes[0].auto_approve_plans || []).join(', '),
          auto_approve_require_kyc: configRes[0].auto_approve_require_kyc ?? true,
          auto_approve_min_age_minutes: configRes[0].auto_approve_min_age_minutes ?? 5,
        });
      }
    } catch (err) {
      toast.error('Failed to load staking data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openEditDialog = (plan = null) => {
    if (plan) {
      setEditingPlan(plan);
      setForm({
        key: plan.key,
        title: plan.title,
        short_description: plan.short_description || '',
        term_days: plan.term_days,
        apy_percent: plan.apy_percent,
        min_deposit: plan.min_deposit || 50,
        base_rewards_per_dollar: plan.base_rewards_per_dollar || 10,
        benefits_cap_usd: plan.benefits_cap_usd || 0,
        perks: (plan.perks || []).join('\n'),
        signals_tier: plan.signals_tier || 'NONE',
        copy_trading_level: plan.copy_trading_level || 'ACCESS',
        leverage_max: plan.leverage_max || 5,
        fee_discount_bps: plan.fee_discount_bps || 0,
        mentor_access: plan.mentor_access || false,
        priority_support: plan.priority_support || false,
        priority: plan.priority || 0,
        is_enabled: plan.is_enabled !== false,
        is_recommended: plan.is_recommended || false,
        sort_order: plan.sort_order || 0,
      });
    } else {
      setEditingPlan(null);
      setForm({
        key: '',
        title: '',
        short_description: '',
        term_days: 30,
        apy_percent: 10,
        min_deposit: 50,
        base_rewards_per_dollar: 10,
        benefits_cap_usd: 0,
        perks: '',
        signals_tier: 'NONE',
        copy_trading_level: 'ACCESS',
        leverage_max: 5,
        fee_discount_bps: 0,
        mentor_access: false,
        priority_support: false,
        priority: 0,
        is_enabled: true,
        is_recommended: false,
        sort_order: plans.length + 1,
      });
    }
    setEditDialogOpen(true);
  };

  const handleSavePlan = async () => {
    if (!form.key || !form.title || !form.term_days || !form.apy_percent) {
      toast.error('Key, title, term days, and APY are required');
      return;
    }

    setProcessing(true);
    try {
      const perksArray = form.perks.split('\n').map(p => p.trim()).filter(Boolean);
      const data = {
        key: form.key,
        title: form.title,
        short_description: form.short_description,
        term_days: Number(form.term_days),
        apy_percent: Number(form.apy_percent),
        min_deposit: Number(form.min_deposit),
        base_rewards_per_dollar: Number(form.base_rewards_per_dollar),
        benefits_cap_usd: Number(form.benefits_cap_usd),
        perks: perksArray,
        signals_tier: form.signals_tier,
        copy_trading_level: form.copy_trading_level,
        leverage_max: Number(form.leverage_max),
        fee_discount_bps: Number(form.fee_discount_bps),
        mentor_access: form.mentor_access,
        priority_support: form.priority_support,
        priority: Number(form.priority),
        is_enabled: form.is_enabled,
        is_recommended: form.is_recommended,
        sort_order: Number(form.sort_order),
      };

      if (editingPlan) {
        await base44.entities.StakingPlan.update(editingPlan.id, data);
        toast.success('Plan updated');
      } else {
        await base44.entities.StakingPlan.create(data);
        toast.success('Plan created');
      }

      setEditDialogOpen(false);
      loadData();
      onRefresh?.();
    } catch (err) {
      toast.error(err.message || 'Failed to save plan');
    } finally {
      setProcessing(false);
    }
  };

  const handleDuplicate = async (plan) => {
    setProcessing(true);
    try {
      const newPlan = {
        ...plan,
        key: plan.key + '_copy',
        title: plan.title + ' (Copy)',
        is_enabled: false,
        sort_order: plans.length + 1,
      };
      delete newPlan.id;
      delete newPlan.created_date;
      delete newPlan.updated_date;
      delete newPlan.created_by;

      await base44.entities.StakingPlan.create(newPlan);
      toast.success('Plan duplicated');
      loadData();
    } catch (err) {
      toast.error('Failed to duplicate');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (plan) => {
    if (!confirm(`Delete plan "${plan.title}"? This cannot be undone.`)) return;

    try {
      await base44.entities.StakingPlan.delete(plan.id);
      toast.success('Plan deleted');
      loadData();
      onRefresh?.();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const handleToggleEnabled = async (plan) => {
    try {
      await base44.entities.StakingPlan.update(plan.id, { is_enabled: !plan.is_enabled });
      toast.success(plan.is_enabled ? 'Plan disabled' : 'Plan enabled');
      loadData();
      onRefresh?.();
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const handleSaveConfig = async () => {
    setProcessing(true);
    try {
      const data = {
        ...configForm,
        updated_at: new Date().toISOString(),
      };

      if (config) {
        await base44.entities.StakingConfig.update(config.id, data);
      } else {
        await base44.entities.StakingConfig.create({ ...data, config_key: 'default' });
      }

      toast.success('Config saved');
      setConfigDialogOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to save config');
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveAutoApprove = async () => {
    setProcessing(true);
    try {
      const plansArray = autoApproveForm.auto_approve_plans
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);

      const data = {
        auto_approve_enabled: autoApproveForm.auto_approve_enabled,
        auto_approve_max_amount: Number(autoApproveForm.auto_approve_max_amount),
        auto_approve_plans: plansArray,
        auto_approve_require_kyc: autoApproveForm.auto_approve_require_kyc,
        auto_approve_min_age_minutes: Number(autoApproveForm.auto_approve_min_age_minutes),
        updated_at: new Date().toISOString(),
      };

      if (config) {
        await base44.entities.StakingConfig.update(config.id, data);
      } else {
        await base44.entities.StakingConfig.create({ ...data, config_key: 'default' });
      }

      toast.success('Auto-approve settings saved');
      setAutoApproveDialogOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setProcessing(false);
    }
  };

  const handleRunAutoApprove = async () => {
    setRunningAutoApprove(true);
    try {
      const res = await base44.functions.invoke('stakingAutoApprove', {});
      if (res.data?.ok) {
        const d = res.data.data;
        toast.success(`Auto-approve completed: ${d.approvedCount} approved, ${d.skippedCount} skipped, ${d.failedCount} failed`);
        onRefresh?.();
      } else {
        toast.error(res.data?.error?.message || 'Auto-approve failed');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to run');
    } finally {
      setRunningAutoApprove(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Staking Plans Management</h2>
          <p className="text-sm text-muted-foreground">Create and manage staking plans</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfigDialogOpen(true)}>
            <Settings className="w-4 h-4 mr-1" />
            Promo Settings
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAutoApproveDialogOpen(true)}>
            <Zap className="w-4 h-4 mr-1" />
            Auto-Approve
          </Button>
          <Button size="sm" onClick={() => openEditDialog()}>
            <Plus className="w-4 h-4 mr-1" />
            Add Plan
          </Button>
        </div>
      </div>

      {/* Auto-Approve Status Banner */}
      {config && (
        <Card className={config.auto_approve_enabled ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-muted'}>
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className={`w-5 h-5 ${config.auto_approve_enabled ? 'text-emerald-500' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-sm font-medium">
                  Auto-Approve: {config.auto_approve_enabled ? 'Enabled' : 'Disabled'}
                </p>
                {config.auto_approve_enabled && (
                  <p className="text-xs text-muted-foreground">
                    Max ${config.auto_approve_max_amount} • 
                    {config.auto_approve_require_kyc ? ' KYC required' : ' No KYC'} • 
                    Min age {config.auto_approve_min_age_minutes}min
                    {config.auto_approve_plans?.length > 0 && ` • Plans: ${config.auto_approve_plans.join(', ')}`}
                  </p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRunAutoApprove}
              disabled={runningAutoApprove || !config.auto_approve_enabled}
            >
              {runningAutoApprove ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
              Run Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Plans Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>APY</TableHead>
                <TableHead>Min Deposit</TableHead>
                <TableHead>Rewards/$</TableHead>
                <TableHead>Benefits Cap</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No plans configured
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{plan.title}</span>
                        {plan.is_recommended && (
                          <Badge className="ml-2 text-xs bg-primary/10 text-primary">Recommended</Badge>
                        )}
                        <p className="text-xs text-muted-foreground">{plan.key}</p>
                      </div>
                    </TableCell>
                    <TableCell>{plan.term_days}d</TableCell>
                    <TableCell className="font-mono text-emerald-600">{plan.apy_percent}%</TableCell>
                    <TableCell className="font-mono">${plan.min_deposit}</TableCell>
                    <TableCell className="font-mono">+{plan.base_rewards_per_dollar}</TableCell>
                    <TableCell className="font-mono">${plan.benefits_cap_usd || 0}</TableCell>
                    <TableCell>
                      <Switch
                        checked={plan.is_enabled !== false}
                        onCheckedChange={() => handleToggleEnabled(plan)}
                      />
                    </TableCell>
                    <TableCell>{plan.sort_order}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(plan)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicate(plan)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(plan)}>
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

      {/* First Stake Promo Config Summary */}
      {config && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">First Stake Promo Settings</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Enabled</p>
                <p className="font-medium">{config.first_stake_enabled ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Min Term</p>
                <p className="font-medium">{config.first_stake_min_term_days} days</p>
              </div>
              <div>
                <p className="text-muted-foreground">Min Amount</p>
                <p className="font-medium">${config.first_stake_min_amount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Bonus</p>
                <p className="font-medium">+{((config.first_stake_bonus_multiplier - 1) * 100).toFixed(0)}% (cap ${config.first_stake_cap_principal})</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Plan Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create Plan'}</DialogTitle>
            <DialogDescription>Configure staking plan details</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Key (unique)</Label>
                <Input
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value })}
                  placeholder="e.g., 30d"
                  disabled={!!editingPlan}
                />
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., 30 Days"
                />
              </div>
            </div>

            <div>
              <Label>Short Description</Label>
              <Input
                value={form.short_description}
                onChange={(e) => setForm({ ...form, short_description: e.target.value })}
                placeholder="Brief description"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Term (days)</Label>
                <Input
                  type="number"
                  value={form.term_days}
                  onChange={(e) => setForm({ ...form, term_days: e.target.value })}
                />
              </div>
              <div>
                <Label>APY (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.apy_percent}
                  onChange={(e) => setForm({ ...form, apy_percent: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Min Deposit ($)</Label>
                <Input
                  type="number"
                  value={form.min_deposit}
                  onChange={(e) => setForm({ ...form, min_deposit: e.target.value })}
                />
              </div>
              <div>
                <Label>Rewards per $</Label>
                <Input
                  type="number"
                  value={form.base_rewards_per_dollar}
                  onChange={(e) => setForm({ ...form, base_rewards_per_dollar: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Benefits Cap (USD) — display only</Label>
              <Input
                type="number"
                step="1"
                value={form.benefits_cap_usd}
                onChange={(e) => setForm({ ...form, benefits_cap_usd: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">Max estimated benefits shown to users (e.g. 10, 25, 40, 54)</p>
            </div>

            <div>
              <Label>Perks (one per line)</Label>
              <Textarea
                value={form.perks}
                onChange={(e) => setForm({ ...form, perks: e.target.value })}
                placeholder="Signals Basic&#10;Priority onboarding"
                rows={3}
              />
            </div>

            {/* Entitlements Section */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Plan Entitlements
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Signals Tier</Label>
                  <Select value={form.signals_tier} onValueChange={(v) => setForm({ ...form, signals_tier: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SIGNALS_TIERS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Copy Trading Level</Label>
                  <Select value={form.copy_trading_level} onValueChange={(v) => setForm({ ...form, copy_trading_level: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COPY_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Max Leverage</Label>
                  <Input
                    type="number"
                    value={form.leverage_max}
                    onChange={(e) => setForm({ ...form, leverage_max: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Fee Discount (bps)</Label>
                  <Input
                    type="number"
                    value={form.fee_discount_bps}
                    onChange={(e) => setForm({ ...form, fee_discount_bps: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-3">
                <div className="flex items-center gap-2">
                  <Switch checked={form.mentor_access} onCheckedChange={(v) => setForm({ ...form, mentor_access: v })} />
                  <Label>Mentor Access</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.priority_support} onCheckedChange={(v) => setForm({ ...form, priority_support: v })} />
                  <Label>Priority Support</Label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                />
              </div>
              <div>
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Higher = better</p>
              </div>
              <div className="space-y-2 pt-5">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.is_enabled}
                    onCheckedChange={(v) => setForm({ ...form, is_enabled: v })}
                  />
                  <Label>Enabled</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.is_recommended}
                    onCheckedChange={(v) => setForm({ ...form, is_recommended: v })}
                  />
                  <Label>Recommended</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePlan} disabled={processing}>
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promo Config Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>First Stake Promo Settings</DialogTitle>
            <DialogDescription>Configure the first-stake bonus promotion</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Promo Enabled</Label>
              <Switch
                checked={configForm.first_stake_enabled}
                onCheckedChange={(v) => setConfigForm({ ...configForm, first_stake_enabled: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Min Term (days)</Label>
                <Input
                  type="number"
                  value={configForm.first_stake_min_term_days}
                  onChange={(e) => setConfigForm({ ...configForm, first_stake_min_term_days: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Min Amount ($)</Label>
                <Input
                  type="number"
                  value={configForm.first_stake_min_amount}
                  onChange={(e) => setConfigForm({ ...configForm, first_stake_min_amount: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Eligible Cap ($)</Label>
                <Input
                  type="number"
                  value={configForm.first_stake_cap_principal}
                  onChange={(e) => setConfigForm({ ...configForm, first_stake_cap_principal: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Bonus Multiplier</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={configForm.first_stake_bonus_multiplier}
                  onChange={(e) => setConfigForm({ ...configForm, first_stake_bonus_multiplier: Number(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  1.5 = +50% bonus
                </p>
              </div>
            </div>

            <div>
              <Label>Default Pool Name</Label>
              <Input
                value={configForm.main_staking_pool_name}
                onChange={(e) => setConfigForm({ ...configForm, main_staking_pool_name: e.target.value })}
              />
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

      {/* Auto-Approve Settings Dialog */}
      <Dialog open={autoApproveDialogOpen} onOpenChange={setAutoApproveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Auto-Approve Settings</DialogTitle>
            <DialogDescription>Configure automatic approval of pending stakes (runs every 5 minutes)</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-Approve Enabled</Label>
                <p className="text-xs text-muted-foreground">Automatically approve eligible pending stakes</p>
              </div>
              <Switch
                checked={autoApproveForm.auto_approve_enabled}
                onCheckedChange={(v) => setAutoApproveForm({ ...autoApproveForm, auto_approve_enabled: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max Amount ($)</Label>
                <Input
                  type="number"
                  value={autoApproveForm.auto_approve_max_amount}
                  onChange={(e) => setAutoApproveForm({ ...autoApproveForm, auto_approve_max_amount: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Stakes above this need manual approval</p>
              </div>
              <div>
                <Label>Min Age (minutes)</Label>
                <Input
                  type="number"
                  value={autoApproveForm.auto_approve_min_age_minutes}
                  onChange={(e) => setAutoApproveForm({ ...autoApproveForm, auto_approve_min_age_minutes: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Wait before auto-approving</p>
              </div>
            </div>

            <div>
              <Label>Eligible Plans (comma-separated, empty = all)</Label>
              <Input
                value={autoApproveForm.auto_approve_plans}
                onChange={(e) => setAutoApproveForm({ ...autoApproveForm, auto_approve_plans: e.target.value })}
                placeholder="e.g., 30d, 60d, 90d"
              />
              <p className="text-xs text-muted-foreground mt-1">Leave empty to allow all enabled plans</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Require KYC</Label>
                <p className="text-xs text-muted-foreground">Only auto-approve KYC-verified users</p>
              </div>
              <Switch
                checked={autoApproveForm.auto_approve_require_kyc}
                onCheckedChange={(v) => setAutoApproveForm({ ...autoApproveForm, auto_approve_require_kyc: v })}
              />
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
              <p className="text-amber-700 dark:text-amber-400">
                <strong>Safety:</strong> Auto-approve verifies lock transfer completed, checks funding balance, and prevents duplicate approvals. Failed attempts are logged and admin is notified.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoApproveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAutoApprove} disabled={processing}>
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}