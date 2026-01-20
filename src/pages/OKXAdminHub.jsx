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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { 
  Plus, RefreshCw, Users, Wallet, ArrowUpDown, AlertCircle, CheckCircle2, 
  XCircle, Clock, Eye, UserPlus, Unlink, DollarSign, ArrowDownToLine, 
  ArrowUpFromLine, Settings, Shield, Loader2, ChevronDown, ChevronUp,
  History, ExternalLink, TrendingUp, TrendingDown
} from 'lucide-react';

const statusColors = {
  AVAILABLE: 'bg-green-500/10 text-green-500 border-green-500/20',
  ASSIGNED: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  DISABLED: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  ERROR: 'bg-red-500/10 text-red-500 border-red-500/20',
  ACTIVE: 'bg-green-500/10 text-green-500 border-green-500/20',
  SUSPENDED: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  PENDING: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  PENDING_CONFIRM: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  PENDING_REVIEW: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  PROCESSING: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  COMPLETED: 'bg-green-500/10 text-green-500 border-green-500/20',
  FAILED: 'bg-red-500/10 text-red-500 border-red-500/20',
  REJECTED: 'bg-red-500/10 text-red-500 border-red-500/20',
  CANCELLED: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

function StatCard({ title, value, subtitle, icon: Icon, color = 'blue' }) {
  const colors = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  };
  
  return (
    <Card className={`bg-gradient-to-br ${colors[color]} border`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {Icon && <Icon className="h-8 w-8 opacity-50" />}
        </div>
      </CardContent>
    </Card>
  );
}

export default function OKXAdminHub({ language = 'en' }) {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [poolAccounts, setPoolAccounts] = useState([]);
  const [userAccounts, setUserAccounts] = useState([]);
  const [users, setUsers] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Dialog states
  const [addPoolDialogOpen, setAddPoolDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedPoolAccount, setSelectedPoolAccount] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [accountDetails, setAccountDetails] = useState(null);
  const [accountHistory, setAccountHistory] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  
  // Form states
  const [newPool, setNewPool] = useState({
    subaccountName: '',
    apiKey: '',
    secretKey: '',
    passphrase: '',
    notes: '',
  });
  const [transferForm, setTransferForm] = useState({
    direction: 'toSub',
    amount: '',
  });

  const isAdmin = user?.role === 'admin';

  const loadDashboard = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [statsRes, poolRes, accountsRes, usersRes, withdrawalsRes, transfersRes] = await Promise.all([
        base44.functions.invoke('okxProvisioning', { action: 'adminDashboardStats' }),
        base44.functions.invoke('okxProvisioning', { action: 'adminListPool' }),
        base44.functions.invoke('okxProvisioning', { action: 'adminListUserAccounts' }),
        base44.functions.invoke('okxProvisioning', { action: 'adminListUsers' }),
        base44.functions.invoke('okxProvisioning', { action: 'adminListWithdrawals', limit: 50 }),
        base44.functions.invoke('okxProvisioning', { action: 'adminListTransfers', limit: 50 }),
      ]);
      
      if (statsRes.data?.ok) setStats(statsRes.data.data);
      if (poolRes.data?.ok) setPoolAccounts(poolRes.data.data || []);
      if (accountsRes.data?.ok) setUserAccounts(accountsRes.data.data || []);
      if (usersRes.data?.ok) setUsers(usersRes.data.data || []);
      if (withdrawalsRes.data?.ok) setWithdrawals(withdrawalsRes.data.data || []);
      if (transfersRes.data?.ok) setTransfers(transfersRes.data.data || []);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      loadDashboard();
    }
  }, [isAuthenticated, isAdmin, loadDashboard]);

  const handleAddToPool = async () => {
    if (!newPool.subaccountName || !newPool.apiKey || !newPool.secretKey || !newPool.passphrase) {
      toast.error('All fields are required');
      return;
    }
    
    try {
      const res = await base44.functions.invoke('okxProvisioning', {
        action: 'adminAddToPool',
        ...newPool,
      });
      
      if (res.data?.ok) {
        toast.success(`Sub-account added: ${res.data.data.status}`);
        setAddPoolDialogOpen(false);
        setNewPool({ subaccountName: '', apiKey: '', secretKey: '', passphrase: '', notes: '' });
        loadDashboard();
      } else {
        toast.error(res.data?.error?.message || 'Failed to add sub-account');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to add sub-account');
    }
  };

  const handleCheckBalance = async (poolAccountId) => {
    try {
      const res = await base44.functions.invoke('okxProvisioning', {
        action: 'adminCheckBalance',
        poolAccountId,
      });
      
      if (res.data?.ok) {
        const d = res.data.data;
        toast.success(`Trading: ${d.tradingUsdt.toFixed(2)} | Funding: ${d.fundingUsdt.toFixed(2)} | Total: ${d.totalUsdt.toFixed(2)} USDT`);
        loadDashboard();
      } else {
        toast.error(res.data?.error?.message || 'Balance check failed');
      }
    } catch (err) {
      toast.error(err.message || 'Balance check failed');
    }
  };

  const handleViewDetails = async (pool) => {
    setSelectedPoolAccount(pool);
    setDetailsDialogOpen(true);
    setLoadingDetails(true);
    setAccountDetails(null);
    setAccountHistory(null);
    
    try {
      const [detailsRes, historyRes] = await Promise.all([
        base44.functions.invoke('okxProvisioning', { action: 'getPoolAccountDetails', poolAccountId: pool.id }),
        base44.functions.invoke('okxProvisioning', { action: 'getTransactionHistory', poolAccountId: pool.id, limit: 20 }),
      ]);
      
      if (detailsRes.data?.ok) {
        setAccountDetails(detailsRes.data.data);
      }
      if (historyRes.data?.ok) {
        setAccountHistory(historyRes.data.data);
      }
    } catch (err) {
      toast.error('Failed to load account details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const toggleRowExpand = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAssignToUser = async () => {
    if (!selectedPoolAccount || !selectedUser) {
      toast.error('Select both pool account and user');
      return;
    }
    
    try {
      const res = await base44.functions.invoke('okxProvisioning', {
        action: 'assignToUser',
        poolAccountId: selectedPoolAccount.id,
        userId: selectedUser,
      });
      
      if (res.data?.ok) {
        toast.success('Account assigned successfully');
        setAssignDialogOpen(false);
        setSelectedPoolAccount(null);
        setSelectedUser(null);
        loadDashboard();
      } else {
        toast.error(res.data?.error?.message || 'Assignment failed');
      }
    } catch (err) {
      toast.error(err.message || 'Assignment failed');
    }
  };

  const handleUnassign = async (poolAccountId) => {
    if (!confirm('Are you sure you want to unassign this account?')) return;
    
    try {
      const res = await base44.functions.invoke('okxProvisioning', {
        action: 'unassignFromUser',
        poolAccountId,
      });
      
      if (res.data?.ok) {
        toast.success('Account unassigned');
        loadDashboard();
      } else {
        toast.error(res.data?.error?.message || 'Unassign failed');
      }
    } catch (err) {
      toast.error(err.message || 'Unassign failed');
    }
  };

  const handleTransfer = async () => {
    if (!selectedPoolAccount || !transferForm.amount || parseFloat(transferForm.amount) <= 0) {
      toast.error('Invalid transfer amount');
      return;
    }
    
    try {
      const res = await base44.functions.invoke('okxProvisioning', {
        action: 'adminTransfer',
        poolAccountId: selectedPoolAccount.id,
        direction: transferForm.direction,
        amount: parseFloat(transferForm.amount),
        currency: 'USDT',
      });
      
      if (res.data?.ok) {
        toast.success(`Transfer completed: ${transferForm.amount} USDT`);
        setTransferDialogOpen(false);
        setSelectedPoolAccount(null);
        setTransferForm({ direction: 'toSub', amount: '' });
        loadDashboard();
      } else {
        toast.error(res.data?.error?.message || 'Transfer failed');
      }
    } catch (err) {
      toast.error(err.message || 'Transfer failed');
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8">
          <CardTitle>Please log in</CardTitle>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">OKX Admin Control Hub</h1>
            <p className="text-muted-foreground">Manage sub-accounts, assignments, withdrawals & transfers</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadDashboard} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setAddPoolDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Sub-Account
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Pool Accounts"
              value={stats.pool.total}
              subtitle={`${stats.pool.available} available`}
              icon={Wallet}
              color="blue"
            />
            <StatCard
              title="User Accounts"
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
              subtitle="Across all pools"
              icon={DollarSign}
              color="purple"
            />
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="pool">Pool</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
            <TabsTrigger value="transfers">Transfers</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Pool Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pool Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Available</span>
                      <span className="font-medium text-green-500">{stats?.pool.available || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Assigned</span>
                      <span className="font-medium text-blue-500">{stats?.pool.assigned || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Error</span>
                      <span className="font-medium text-red-500">{stats?.pool.error || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Disabled</span>
                      <span className="font-medium text-gray-500">{stats?.pool.disabled || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Withdrawal Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pending</span>
                      <span className="font-medium text-yellow-500">{stats?.withdrawals.pending || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Completed</span>
                      <span className="font-medium text-green-500">{stats?.withdrawals.completed || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Failed</span>
                      <span className="font-medium text-red-500">{stats?.withdrawals.failed || 0}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-2">
                      <span className="text-muted-foreground">Total Withdrawn</span>
                      <span className="font-medium">${formatUsdt(stats?.withdrawals.totalAmountCompleted)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Pool Tab */}
          <TabsContent value="pool">
            <Card>
              <CardHeader>
                <CardTitle>Sub-Account Pool</CardTitle>
                <CardDescription>Manage pre-created OKX sub-accounts with full balance & transaction visibility</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>API Key</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Last Check</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poolAccounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No sub-accounts in pool. Add one to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      poolAccounts.map((pool) => (
                        <React.Fragment key={pool.id}>
                          <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRowExpand(pool.id)}>
                            <TableCell>
                              {expandedRows[pool.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </TableCell>
                            <TableCell className="font-medium">{pool.subaccountName}</TableCell>
                            <TableCell className="font-mono text-xs">{pool.apiKey}</TableCell>
                            <TableCell>
                              <Badge className={statusColors[pool.status] || ''}>
                                {pool.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{formatUsdt(pool.lastBalanceUsdt)} USDT</TableCell>
                            <TableCell>
                              {pool.assignedToUserId ? (
                                <span className="text-sm">
                                  {users.find(u => u.id === pool.assignedToUserId)?.email || pool.assignedToUserId}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {pool.lastBalanceCheck ? new Date(pool.lastBalanceCheck).toLocaleString() : '-'}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleViewDetails(pool)}
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCheckBalance(pool.id)}
                                  title="Refresh Balance"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                                {pool.status === 'AVAILABLE' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setSelectedPoolAccount(pool);
                                      setAssignDialogOpen(true);
                                    }}
                                    title="Assign to User"
                                  >
                                    <UserPlus className="h-4 w-4" />
                                  </Button>
                                )}
                                {pool.status === 'ASSIGNED' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setSelectedPoolAccount(pool);
                                        setTransferDialogOpen(true);
                                      }}
                                      title="Transfer Funds"
                                    >
                                      <ArrowUpDown className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleUnassign(pool.id)}
                                      title="Unassign"
                                      className="text-red-500 hover:text-red-600"
                                    >
                                      <Unlink className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          {expandedRows[pool.id] && (
                            <TableRow>
                              <TableCell colSpan={8} className="bg-muted/30 p-4">
                                <div className="grid md:grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground mb-1">Permissions</p>
                                    <div className="flex gap-1 flex-wrap">
                                      {(pool.permissions || ['read', 'trade']).map(p => (
                                        <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground mb-1">Created</p>
                                    <p>{formatDate(pool.createdAt)}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground mb-1">Notes</p>
                                    <p className="text-xs">{pool.notes || '-'}</p>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Users & Assignments</CardTitle>
                <CardDescription>View users and their OKX account assignments</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>OKX Account</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.email}</TableCell>
                        <TableCell>{u.fullName || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.hasOkxAccount ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          {u.okxAccountStatus ? (
                            <Badge className={statusColors[u.okxAccountStatus] || ''}>
                              {u.okxAccountStatus}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(u.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals">
            <Card>
              <CardHeader>
                <CardTitle>Withdrawal History</CardTitle>
                <CardDescription>All withdrawal requests across users</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Chain</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No withdrawals yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      withdrawals.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell className="font-medium">{w.userEmail || w.userId}</TableCell>
                          <TableCell>{formatUsdt(w.amount)} {w.currency}</TableCell>
                          <TableCell className="font-mono text-xs max-w-[150px] truncate">
                            {w.address}
                          </TableCell>
                          <TableCell>{w.chain}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[w.status] || ''}>
                              {w.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(w.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transfers Tab */}
          <TabsContent value="transfers">
            <Card>
              <CardHeader>
                <CardTitle>Transfer History</CardTitle>
                <CardDescription>Internal transfers between main and sub-accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No transfers yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      transfers.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>{t.fromAccount} ({t.fromAccountType})</TableCell>
                          <TableCell>{t.toAccount} ({t.toAccountType})</TableCell>
                          <TableCell>{formatUsdt(t.amount)} {t.currency}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[t.status] || ''}>
                              {t.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(t.createdAt)}
                          </TableCell>
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

      {/* Add Pool Dialog */}
      <Dialog open={addPoolDialogOpen} onOpenChange={setAddPoolDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Sub-Account to Pool</DialogTitle>
            <DialogDescription>
              Enter the OKX sub-account API credentials. The system will test connectivity.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Sub-Account Name</Label>
              <Input
                placeholder="e.g., tasklet"
                value={newPool.subaccountName}
                onChange={(e) => setNewPool({ ...newPool, subaccountName: e.target.value })}
              />
            </div>
            <div>
              <Label>API Key</Label>
              <Input
                placeholder="API Key"
                value={newPool.apiKey}
                onChange={(e) => setNewPool({ ...newPool, apiKey: e.target.value })}
              />
            </div>
            <div>
              <Label>Secret Key</Label>
              <Input
                type="password"
                placeholder="Secret Key"
                value={newPool.secretKey}
                onChange={(e) => setNewPool({ ...newPool, secretKey: e.target.value })}
              />
            </div>
            <div>
              <Label>Passphrase</Label>
              <Input
                type="password"
                placeholder="Passphrase"
                value={newPool.passphrase}
                onChange={(e) => setNewPool({ ...newPool, passphrase: e.target.value })}
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any notes about this account"
                value={newPool.notes}
                onChange={(e) => setNewPool({ ...newPool, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPoolDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddToPool}>Add to Pool</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to User</DialogTitle>
            <DialogDescription>
              Assign "{selectedPoolAccount?.subaccountName}" to a user
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select User</Label>
              <Select value={selectedUser || ''} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter(u => !u.hasOkxAccount)
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.email} {u.fullName ? `(${u.fullName})` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignToUser}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Funds</DialogTitle>
            <DialogDescription>
              Transfer USDT to/from "{selectedPoolAccount?.subaccountName}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Direction</Label>
              <Select
                value={transferForm.direction}
                onValueChange={(v) => setTransferForm({ ...transferForm, direction: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="toSub">
                    <div className="flex items-center gap-2">
                      <ArrowDownToLine className="h-4 w-4" />
                      Main → Sub-Account
                    </div>
                  </SelectItem>
                  <SelectItem value="toMain">
                    <div className="flex items-center gap-2">
                      <ArrowUpFromLine className="h-4 w-4" />
                      Sub-Account → Main
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (USDT)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={transferForm.amount}
                onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleTransfer}>Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              {selectedPoolAccount?.subaccountName} - Account Details
            </DialogTitle>
            <DialogDescription>
              Full balance breakdown, positions, and transaction history
            </DialogDescription>
          </DialogHeader>
          
          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : accountDetails ? (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Balance Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-blue-500/10 border-blue-500/30">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Trading Account</p>
                      <p className="text-xl font-bold">{formatUsdt(accountDetails.balances.tradingUsdt)} USDT</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-500/10 border-green-500/30">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Funding Account</p>
                      <p className="text-xl font-bold">{formatUsdt(accountDetails.balances.fundingUsdt)} USDT</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-purple-500/10 border-purple-500/30">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Total Equity</p>
                      <p className="text-xl font-bold">{formatUsdt(accountDetails.balances.totalEquity || accountDetails.balances.totalUsdt)} USDT</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Account Config */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Settings className="h-4 w-4" /> Account Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Account Level</p>
                        <p className="font-medium">{accountDetails.config.accountLevel || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Position Mode</p>
                        <p className="font-medium">{accountDetails.config.posMode || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Auto Loan</p>
                        <p className="font-medium">{accountDetails.config.autoLoan || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <Badge className={statusColors[selectedPoolAccount?.status] || ''}>{selectedPoolAccount?.status}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Detailed Balances */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Detailed Balances
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Trading Balances */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Trading Account</p>
                        {accountDetails.balances.trading?.length > 0 ? (
                          <div className="space-y-1">
                            {accountDetails.balances.trading.map((b, i) => (
                              <div key={i} className="flex justify-between text-sm bg-muted/30 rounded px-2 py-1">
                                <span>{b.currency}</span>
                                <span className="font-mono">{formatUsdt(b.total)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No balances</p>
                        )}
                      </div>
                      {/* Funding Balances */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Funding Account</p>
                        {accountDetails.balances.funding?.length > 0 ? (
                          <div className="space-y-1">
                            {accountDetails.balances.funding.map((b, i) => (
                              <div key={i} className="flex justify-between text-sm bg-muted/30 rounded px-2 py-1">
                                <span>{b.currency}</span>
                                <span className="font-mono">{formatUsdt(b.total)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No balances</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Positions */}
                {accountDetails.positions?.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" /> Open Positions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Instrument</TableHead>
                            <TableHead>Side</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Entry</TableHead>
                            <TableHead>Leverage</TableHead>
                            <TableHead>UPL</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {accountDetails.positions.map((p, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{p.instId}</TableCell>
                              <TableCell>
                                <Badge className={p.posSide === 'long' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}>
                                  {p.posSide}
                                </Badge>
                              </TableCell>
                              <TableCell>{p.pos}</TableCell>
                              <TableCell>{formatUsdt(p.avgPx)}</TableCell>
                              <TableCell>{p.lever}x</TableCell>
                              <TableCell className={p.upl >= 0 ? 'text-green-500' : 'text-red-500'}>
                                {p.upl >= 0 ? '+' : ''}{formatUsdt(p.upl)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {/* Transaction History */}
                {accountHistory && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <History className="h-4 w-4" /> Transaction History
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Tabs defaultValue="deposits" className="w-full">
                        <TabsList className="grid grid-cols-3 w-full max-w-md">
                          <TabsTrigger value="deposits">Deposits ({accountHistory.deposits?.length || 0})</TabsTrigger>
                          <TabsTrigger value="withdrawals">Withdrawals ({accountHistory.withdrawals?.length || 0})</TabsTrigger>
                          <TabsTrigger value="bills">Bills ({accountHistory.bills?.length || 0})</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="deposits" className="mt-4">
                          {accountHistory.deposits?.length > 0 ? (
                            <div className="space-y-2 max-h-48 overflow-auto">
                              {accountHistory.deposits.map((d, i) => (
                                <div key={i} className="flex justify-between items-center text-sm bg-muted/30 rounded px-3 py-2">
                                  <div>
                                    <span className="font-medium">{d.amount} {d.currency}</span>
                                    <span className="text-muted-foreground ml-2">via {d.chain}</span>
                                  </div>
                                  <div className="text-right">
                                    <Badge variant="outline" className="text-xs">{d.state}</Badge>
                                    <p className="text-xs text-muted-foreground mt-1">{d.ts ? new Date(Number(d.ts)).toLocaleString() : '-'}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">No deposit history</p>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="withdrawals" className="mt-4">
                          {accountHistory.withdrawals?.length > 0 ? (
                            <div className="space-y-2 max-h-48 overflow-auto">
                              {accountHistory.withdrawals.map((w, i) => (
                                <div key={i} className="flex justify-between items-center text-sm bg-muted/30 rounded px-3 py-2">
                                  <div>
                                    <span className="font-medium">{w.amount} {w.currency}</span>
                                    <span className="text-muted-foreground ml-2">Fee: {w.fee}</span>
                                  </div>
                                  <div className="text-right">
                                    <Badge variant="outline" className="text-xs">{w.state}</Badge>
                                    <p className="text-xs text-muted-foreground mt-1">{w.ts ? new Date(Number(w.ts)).toLocaleString() : '-'}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">No withdrawal history</p>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="bills" className="mt-4">
                          {accountHistory.bills?.length > 0 ? (
                            <div className="space-y-2 max-h-48 overflow-auto">
                              {accountHistory.bills.map((b, i) => (
                                <div key={i} className="flex justify-between items-center text-sm bg-muted/30 rounded px-3 py-2">
                                  <div>
                                    <span className="font-medium">{b.instId || b.currency}</span>
                                    <span className="text-muted-foreground ml-2">{b.subType}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className={`font-mono ${b.balChg >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                      {b.balChg >= 0 ? '+' : ''}{formatUsdt(b.balChg)} {b.currency}
                                    </span>
                                    <p className="text-xs text-muted-foreground mt-1">{b.ts ? new Date(Number(b.ts)).toLocaleString() : '-'}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">No bill history</p>
                          )}
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-center text-muted-foreground py-8">Failed to load account details</p>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}