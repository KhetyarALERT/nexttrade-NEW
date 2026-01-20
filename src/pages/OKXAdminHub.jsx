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
  const [selectedPoolAccount, setSelectedPoolAccount] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  
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
        base44.functions.invoke('okxAdmin', { action: 'getDashboardStats' }),
        base44.functions.invoke('okxAdmin', { action: 'listPool' }),
        base44.functions.invoke('okxAdmin', { action: 'listUserAccounts' }),
        base44.functions.invoke('okxAdmin', { action: 'listUsers' }),
        base44.functions.invoke('okxAdmin', { action: 'listWithdrawals', limit: 50 }),
        base44.functions.invoke('okxAdmin', { action: 'listTransfers', limit: 50 }),
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
      const res = await base44.functions.invoke('okxAdmin', {
        action: 'addToPool',
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
      const res = await base44.functions.invoke('okxAdmin', {
        action: 'checkPoolBalance',
        poolAccountId,
      });
      
      if (res.data?.ok) {
        toast.success(`Balance: ${res.data.data.totalUsdt.toFixed(2)} USDT`);
        loadDashboard();
      } else {
        toast.error(res.data?.error?.message || 'Balance check failed');
      }
    } catch (err) {
      toast.error(err.message || 'Balance check failed');
    }
  };

  const handleAssignToUser = async () => {
    if (!selectedPoolAccount || !selectedUser) {
      toast.error('Select both pool account and user');
      return;
    }
    
    try {
      const res = await base44.functions.invoke('okxAdmin', {
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
      const res = await base44.functions.invoke('okxAdmin', {
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
      const res = await base44.functions.invoke('okxAdmin', {
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
                <CardDescription>Manage pre-created OKX sub-accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>API Key</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poolAccounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No sub-accounts in pool. Add one to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      poolAccounts.map((pool) => (
                        <TableRow key={pool.id}>
                          <TableCell className="font-medium">{pool.subaccountName}</TableCell>
                          <TableCell className="font-mono text-xs">{pool.apiKey}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[pool.status] || ''}>
                              {pool.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatUsdt(pool.lastBalanceUsdt)} USDT</TableCell>
                          <TableCell>
                            {pool.assignedToUserId ? (
                              <span className="text-sm">
                                {users.find(u => u.id === pool.assignedToUserId)?.email || pool.assignedToUserId}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCheckBalance(pool.id)}
                                title="Check Balance"
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
    </div>
  );
}