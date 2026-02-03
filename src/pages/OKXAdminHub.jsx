import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Plus, RefreshCw, Users, Wallet, ArrowUpDown, Shield, Loader2, ChevronDown, ChevronUp,
  History, Eye, UserPlus, Unlink, DollarSign, ArrowDownToLine, ArrowUpFromLine, Radio, Zap, Clock
} from 'lucide-react';

import AdminLayout from '@/components/admin/AdminLayout';
import StakingAdminTab from '@/components/admin/StakingAdminTab';
import EntitlementsAdminTab from '@/components/admin/EntitlementsAdminTab';
import CopyTradingAdminTab from '@/components/admin/CopyTradingAdminTab';
import SignalsAdminTab from '@/components/admin/SignalsAdminTab';
import VerificationAdminTab from '@/components/admin/VerificationAdminTab';
import AccountRequestsAdminTab from '@/components/admin/AccountRequestsAdminTab';
import WithdrawalsAdminTab from '@/components/admin/WithdrawalsAdminTab';

const statusColors = {
  AVAILABLE: 'bg-green-500/10 text-green-500 border-green-500/20',
  ASSIGNED: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  DISABLED: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  ERROR: 'bg-red-500/10 text-red-500 border-red-500/20',
  ACTIVE: 'bg-green-500/10 text-green-500 border-green-500/20',
  SUSPENDED: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  PENDING: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  COMPLETED: 'bg-green-500/10 text-green-500 border-green-500/20',
  FAILED: 'bg-red-500/10 text-red-500 border-red-500/20',
};

function StatCard({ title, value, subtitle, icon: Icon, color = 'blue' }) {
  const colors = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-500',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-500',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-500',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-500',
  };
  
  return (
    <Card className={`bg-gradient-to-br ${colors[color]} border`}>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground/80">{title}</p>
            <p className="text-2xl md:text-3xl font-bold mt-1 text-foreground">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {Icon && <Icon className={`h-8 w-8 opacity-60 ${colors[color].split(' ').pop()}`} />}
        </div>
      </CardContent>
    </Card>
  );
}

export default function OKXAdminHub() {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [poolAccounts, setPoolAccounts] = useState([]);
  const [users, setUsers] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  // Referrals tab state
  const [refOverview, setRefOverview] = useState([]);
  const [refDetails, setRefDetails] = useState(null);
  const [loadingRef, setLoadingRef] = useState(false);
  const [selectedReferrer, setSelectedReferrer] = useState(null);
  const [integrity, setIntegrity] = useState(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);
  
  // Sub-data for tabs
  const [accountRequests, setAccountRequests] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [stakingRequests, setStakingRequests] = useState([]);
  const [stakingStats, setStakingStats] = useState({});

  // Dialog states
  const [addPoolDialogOpen, setAddPoolDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedPoolAccount, setSelectedPoolAccount] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Form states
  const [newPool, setNewPool] = useState({ subaccountName: '', apiKey: '', secretKey: '', passphrase: '', notes: '' });
  const [transferForm, setTransferForm] = useState({ direction: 'toSub', amount: '' });

  const isAdmin = user?.role === 'admin';

  const loadDashboard = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [statsRes, poolRes, usersRes, withdrawalsRes, transfersRes, requestsRes, verificationsRes, stakingReqRes, stakingStatsRes] = await Promise.all([
        base44.functions.invoke('okxAdminHub', { action: 'getDashboardStats' }),
        base44.functions.invoke('okxAdminHub', { action: 'listPool' }),
        base44.functions.invoke('okxAdminHub', { action: 'listUsers' }),
        base44.functions.invoke('okxAdminHub', { action: 'listWithdrawals', limit: 50 }),
        base44.functions.invoke('okxAdminHub', { action: 'listTransfers', limit: 50 }),
        base44.functions.invoke('okxAdminHub', { action: 'listAccountRequests', limit: 100 }),
        base44.entities.VerificationRequest.list('-created_date', 100),
        base44.functions.invoke('okxAdminHub', { action: 'listStakingRequests', status: 'all', limit: 100 }),
        base44.functions.invoke('okxAdminHub', { action: 'getStakingStats' }),
      ]);
      
      if (statsRes.data?.ok) setStats(statsRes.data.data);
      if (poolRes.data?.ok) setPoolAccounts(poolRes.data.data || []);
      if (usersRes.data?.ok) setUsers(usersRes.data.data || []);
      if (withdrawalsRes.data?.ok) setWithdrawals(withdrawalsRes.data.data || []);
      if (transfersRes.data?.ok) setTransfers(transfersRes.data.data || []);
      if (requestsRes.data?.ok) setAccountRequests(requestsRes.data.data || []);
      if (verificationsRes) setVerifications(verificationsRes || []);
      if (stakingReqRes.data?.ok) setStakingRequests(stakingReqRes.data.data || []);
      if (stakingStatsRes.data?.ok) setStakingStats(stakingStatsRes.data.data || {});
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) loadDashboard();
  }, [isAuthenticated, isAdmin, loadDashboard]);

  // Load referrals when tab opens
  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    if (activeTab !== 'referrals') return;
    (async () => {
      setLoadingRef(true);
      try {
        const res = await base44.functions.invoke('referralEligibilityReconciler', { action: 'adminOverview' });
        if (res.data?.success) setRefOverview(res.data.data || []);
      } finally { setLoadingRef(false); }
    })();
  }, [activeTab, isAuthenticated, isAdmin]);

  const handleAddToPool = async () => {
    if (!newPool.subaccountName || !newPool.apiKey) {
      toast.error('Required fields missing');
      return;
    }
    try {
      const res = await base44.functions.invoke('okxAdminHub', { action: 'addToPool', ...newPool });
      if (res.data?.ok) {
        toast.success(`Sub-account added: ${res.data.data.status}`);
        setAddPoolDialogOpen(false);
        setNewPool({ subaccountName: '', apiKey: '', secretKey: '', passphrase: '', notes: '' });
        loadDashboard();
      } else {
        toast.error(res.data?.error?.message || 'Failed');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAssignToUser = async () => {
    if (!selectedPoolAccount || !selectedUser) return;
    try {
      const res = await base44.functions.invoke('okxAdminHub', {
        action: 'assignToUser',
        poolAccountId: selectedPoolAccount.id,
        userId: selectedUser,
      });
      if (res.data?.ok) {
        toast.success('Assigned successfully');
        setAssignDialogOpen(false);
        loadDashboard();
      } else {
        toast.error(res.data?.error?.message || 'Failed');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const formatUsdt = (val) => {
    if (val === null || val === undefined) return '-';
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8">
          <div className="flex items-center gap-3 text-red-500">
            <Shield className="h-8 w-8" />
            <div>
              <CardTitle>Access Denied</CardTitle>
              <p className="text-muted-foreground">Admin access required</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Hub</h1>
            <p className="text-muted-foreground">System overview and management console</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadDashboard} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setAddPoolDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Pool Account
            </Button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Pool Accounts"
              value={stats.pool.total}
              subtitle={`${stats.pool.available} available`}
              icon={Wallet}
              color="blue"
            />
            <StatCard
              title="Users"
              value={stats.accounts.total}
              subtitle={`${stats.accounts.active} active`}
              icon={Users}
              color="green"
            />
            <StatCard
              title="Withdrawals"
              value={stats.withdrawals.total}
              subtitle={`${stats.withdrawals.pending} pending`}
              icon={ArrowUpFromLine}
              color="orange"
            />
            <StatCard
              title="Total Balance"
              value={`$${formatUsdt(stats.pool.totalBalanceUsdt)}`}
              subtitle="All pools"
              icon={DollarSign}
              color="purple"
            />
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex-wrap justify-start gap-1 w-full border border-border/50">
            <TabsTrigger value="dashboard" className="rounded-lg px-4 py-2">Overview</TabsTrigger>
            <TabsTrigger value="verification" className="rounded-lg px-4 py-2">
              KYC
              {verifications.filter(v => v.status === 'pending' || v.status === 'needs_help').length > 0 && (
                <span className="ml-2 w-5 h-5 bg-amber-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {verifications.filter(v => v.status === 'pending' || v.status === 'needs_help').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="requests" className="rounded-lg px-4 py-2">
              Requests
              {accountRequests.filter(r => r.status === 'pending').length > 0 && (
                <span className="ml-2 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {accountRequests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="staking" className="rounded-lg px-4 py-2">
              Staking
              {stakingRequests.filter(s => s.status === 'PENDING_APPROVAL').length > 0 && (
                <span className="ml-2 w-5 h-5 bg-purple-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {stakingRequests.filter(s => s.status === 'PENDING_APPROVAL').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="copytrading" className="rounded-lg px-4 py-2">Copy Trading</TabsTrigger>
            <TabsTrigger value="entitlements" className="rounded-lg px-4 py-2">Entitlements</TabsTrigger>
            <TabsTrigger value="signals" className="rounded-lg px-4 py-2">Signals</TabsTrigger>
            <TabsTrigger value="withdrawals" className="rounded-lg px-4 py-2">Withdrawals</TabsTrigger>
            <TabsTrigger value="pool" className="rounded-lg px-4 py-2">Pool</TabsTrigger>
            <TabsTrigger value="users" className="rounded-lg px-4 py-2">Users</TabsTrigger>
            <TabsTrigger value="referrals" className="rounded-lg px-4 py-2">Referrals</TabsTrigger>
            <TabsTrigger value="finance" className="rounded-lg px-4 py-2">Finance</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Pool Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pool Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Available</span>
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">{stats?.pool.available || 0}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Assigned</span>
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">{stats?.pool.assigned || 0}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Error</span>
                    <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">{stats?.pool.error || 0}</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Action Required */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Actions Required</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between hover:bg-muted/50"
                    onClick={() => setActiveTab('verification')}
                  >
                    <span className="text-sm">Pending KYC</span>
                    <Badge variant="secondary">{verifications.filter(v => v.status === 'pending').length}</Badge>
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between hover:bg-muted/50"
                    onClick={() => setActiveTab('requests')}
                  >
                    <span className="text-sm">Account Requests</span>
                    <Badge variant="secondary">{accountRequests.filter(r => r.status === 'pending').length}</Badge>
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between hover:bg-muted/50"
                    onClick={() => setActiveTab('staking')}
                  >
                    <span className="text-sm">Staking Approvals</span>
                    <Badge variant="secondary">{stakingRequests.filter(s => s.status === 'PENDING_APPROVAL').length}</Badge>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="verification">
            <VerificationAdminTab verifications={verifications} onRefresh={loadDashboard} formatDate={formatDate} />
          </TabsContent>

          <TabsContent value="requests">
            <AccountRequestsAdminTab requests={accountRequests} poolAccounts={poolAccounts} onRefresh={loadDashboard} formatDate={formatDate} />
          </TabsContent>

          <TabsContent value="staking">
            <StakingAdminTab stakingRequests={stakingRequests} stakingStats={stakingStats} onRefresh={loadDashboard} />
          </TabsContent>

          <TabsContent value="copytrading">
            <CopyTradingAdminTab onRefresh={loadDashboard} />
          </TabsContent>

          <TabsContent value="entitlements">
            <EntitlementsAdminTab onRefresh={loadDashboard} />
          </TabsContent>

          <TabsContent value="signals">
            <SignalsAdminTab onRefresh={loadDashboard} />
          </TabsContent>

          <TabsContent value="withdrawals">
            <WithdrawalsAdminTab language="en" />
          </TabsContent>

          <TabsContent value="pool">
            <Card>
              <CardHeader>
                <CardTitle>Sub-Account Pool</CardTitle>
                <CardDescription>Manage available trading accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poolAccounts.map((pool) => (
                      <TableRow key={pool.id}>
                        <TableCell className="font-medium">{pool.subaccountName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[pool.status] || ''}>{pool.status}</Badge>
                        </TableCell>
                        <TableCell className="font-mono">{formatUsdt(pool.lastBalanceUsdt)} USDT</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {pool.assignedToUserId ? users.find(u => u.id === pool.assignedToUserId)?.email || pool.assignedToUserId : '-'}
                        </TableCell>
                        <TableCell>
                          {pool.status === 'AVAILABLE' && (
                            <Button size="sm" variant="ghost" onClick={() => {
                              setSelectedPoolAccount(pool);
                              setAssignDialogOpen(true);
                            }}>
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="referrals">
            <Card>
              <CardHeader>
                <CardTitle>Referrals Overview</CardTitle>
                <CardDescription>Per-referrer stats</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingRef ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Verified</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {refOverview.map((r) => (
                        <TableRow key={r.referrerId}>
                          <TableCell>{r.email}</TableCell>
                          <TableCell>{r.referralCode || '—'}</TableCell>
                          <TableCell>{r.total}</TableCell>
                          <TableCell>{r.verified}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={async () => {
                               setSelectedReferrer(r);
                               setRefDetails(null);
                               setLoadingRef(true);
                               try {
                                 const res = await base44.functions.invoke('referralEligibilityReconciler', { action: 'referrerDetails', referrerId: r.referrerId });
                                 if (res.data?.success) {
                                   setRefDetails(res.data.data);
                                 } else {
                                   toast.error(res.data?.error || 'Failed to load details');
                                   return;
                                 }
                               } catch (e) {
                                 toast.error(e?.message || 'Failed to load details');
                                 return;
                               } finally {
                                 setLoadingRef(false);
                               }
                               // Load referral integrity for the referrer themselves (inbound)
                               try {
                                 setIntegrityLoading(true);
                                 const integ = await base44.functions.invoke('referralEligibilityReconciler', { action: 'getReferralIntegrity', userId: r.referrerId });
                                 if (integ.data?.success) setIntegrity(integ.data.data);
                                 else toast.error(integ.data?.error || 'Failed to load integrity');
                               } catch (e) {
                                 toast.error(e?.message || 'Failed to load integrity');
                               } finally {
                                 setIntegrityLoading(false);
                               }
                             }}>
                               <Eye className="h-4 w-4" />
                             </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {refDetails && (
              <>
              {/* Referral Integrity Panel */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Referral Integrity</CardTitle>
                  <CardDescription>Canonical vs Mirror for this user</CardDescription>
                </CardHeader>
                <CardContent>
                  {integrityLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : integrity ? (
                    <div className="space-y-2">
                      <div className="text-sm">
                        <div><span className="text-muted-foreground">User:</span> {integrity.user?.email} ({integrity.user?.id})</div>
                        <div><span className="text-muted-foreground">User.referral_code:</span> {integrity.user?.referral_code || '—'}</div>
                        <div><span className="text-muted-foreground">User.referred_by (mirror):</span> {integrity.user?.referred_by || '—'}</div>
                        <div><span className="text-muted-foreground">Canonical inbound (L1):</span> {integrity.canonical ? `${integrity.canonical.referrer_email || integrity.canonical.referrer_user_id} • ${integrity.canonical.referrer_code}` : '—'}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Integrity Status:</span>
                          <Badge variant={integrity.status === 'MATCH' ? 'success' : 'destructive'}>{integrity.status}</Badge>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline" onClick={async () => {
                          const res = await base44.functions.invoke('referralEligibilityReconciler', { action: 'reconcileMirrorFromCanonical', userId: refDetails.referrer.id });
                          if (res.data?.success) {
                            toast.success('Mirror updated from canonical');
                            const integ = await base44.functions.invoke('referralEligibilityReconciler', { action: 'getReferralIntegrity', userId: refDetails.referrer.id });
                            if (integ.data?.success) setIntegrity(integ.data.data);
                          } else { toast.error(res.data?.error || 'Failed'); }
                        }}>Fix Mirror</Button>
                        <Button size="sm" variant="outline" onClick={async () => {
                          const res = await base44.functions.invoke('referralEligibilityReconciler', { action: 'backfillCanonicalFromMirror', userId: refDetails.referrer.id });
                          if (res.data?.success) {
                            toast.success('Attribution backfilled');
                            const integ = await base44.functions.invoke('referralEligibilityReconciler', { action: 'getReferralIntegrity', userId: refDetails.referrer.id });
                            if (integ.data?.success) setIntegrity(integ.data.data);
                          } else { toast.error(res.data?.error || 'Failed'); }
                        }}>Backfill Attribution</Button>
                        <Button size="sm" onClick={async () => {
                          const code = window.prompt('Enter new referrer code');
                          if (!code) return;
                          const reason = window.prompt('Reason for override (optional)') || 'admin override';
                          const res = await base44.functions.invoke('referralEligibilityReconciler', { action: 'adminReassignReferrer', userId: refDetails.referrer.id, newReferrerCode: code, reason });
                          if (res.data?.success) {
                            toast.success('Referrer reassigned');
                            const integ = await base44.functions.invoke('referralEligibilityReconciler', { action: 'getReferralIntegrity', userId: refDetails.referrer.id });
                            if (integ.data?.success) setIntegrity(integ.data.data);
                            // refresh details
                            const det = await base44.functions.invoke('referralEligibilityReconciler', { action: 'referrerDetails', referrerId: selectedReferrer.referrerId });
                            if (det.data?.success) setRefDetails(det.data.data);
                          } else { toast.error(res.data?.error || 'Failed'); }
                        }}>Reassign Referrer</Button>
                      </div>
                      <p className="text-xs text-muted-foreground">User.referred_by is display-only. Use these tools for authoritative changes.</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No integrity data.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Referrer Details</CardTitle>
                  <CardDescription>{refDetails.referrer?.email} • Code: {refDetails.referrer?.referralCode || '—'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">Referred by: {refDetails.referredBy?.referrer_code || '—'}</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>KYC</TableHead>
                        <TableHead>Deposit</TableHead>
                        <TableHead>Withdraw</TableHead>
                        <TableHead>Mirror</TableHead>
                        <TableHead>Integrity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(refDetails.referrals || []).map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>{d.email}</TableCell>
                          <TableCell>{d.registeredAt ? new Date(d.registeredAt).toLocaleDateString() : '—'}</TableCell>
                          <TableCell><Badge variant="outline" className={d.kycStatus==='verified'?'bg-emerald-500/10 text-emerald-600':'bg-amber-500/10 text-amber-600'}>{d.kycStatus}</Badge></TableCell>
                          <TableCell>{d.hasDeposit ? 'Yes' : 'No'}</TableCell>
                          <TableCell>{d.hasWithdrawal ? 'Yes' : 'No'}</TableCell>
                          <TableCell className="text-xs font-mono">{d.mirrorReferredBy || '—'}</TableCell>
                          <TableCell>{d.mismatch ? <Badge variant="destructive">Mismatch</Badge> : <Badge variant="success">OK</Badge>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>OKX Account</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{u.email}</p>
                            <p className="text-xs text-muted-foreground">{u.fullName}</p>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
                        <TableCell>
                          {u.hasOkxAccount ? <Badge variant="outline" className="bg-green-500/10 text-green-500">Active</Badge> : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="finance">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Withdrawals</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawals.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell className="font-medium">{w.userEmail || w.userId}</TableCell>
                          <TableCell>{formatUsdt(w.amount)} {w.currency}</TableCell>
                          <TableCell><Badge variant="outline" className={statusColors[w.status] || ''}>{w.status}</Badge></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(w.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Internal Transfers</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transfers.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.userId?.slice(0, 8)}...</TableCell>
                          <TableCell className="capitalize">{t.fromAccountType}</TableCell>
                          <TableCell className="capitalize">{t.toAccountType}</TableCell>
                          <TableCell>{formatUsdt(t.amount)} {t.currency}</TableCell>
                          <TableCell><Badge variant="outline" className={statusColors[t.status] || ''}>{t.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Add Pool Dialog */}
        <Dialog open={addPoolDialogOpen} onOpenChange={setAddPoolDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Sub-Account</DialogTitle>
              <DialogDescription>Enter OKX API credentials</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Sub-account name" value={newPool.subaccountName} onChange={(e) => setNewPool({...newPool, subaccountName: e.target.value})} />
              <Input placeholder="API Key" value={newPool.apiKey} onChange={(e) => setNewPool({...newPool, apiKey: e.target.value})} />
              <Input type="password" placeholder="Secret Key" value={newPool.secretKey} onChange={(e) => setNewPool({...newPool, secretKey: e.target.value})} />
              <Input type="password" placeholder="Passphrase" value={newPool.passphrase} onChange={(e) => setNewPool({...newPool, passphrase: e.target.value})} />
              <Textarea placeholder="Notes" value={newPool.notes} onChange={(e) => setNewPool({...newPool, notes: e.target.value})} />
            </div>
            <DialogFooter>
              <Button onClick={handleAddToPool}>Add Account</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Account</DialogTitle>
              <DialogDescription>Assign {selectedPoolAccount?.subaccountName} to a user</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Label>Select User</Label>
              <Select value={selectedUser || ''} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.filter(u => !u.hasOkxAccount).map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button onClick={handleAssignToUser}>Confirm Assignment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}