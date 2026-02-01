import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  CheckCircle2, XCircle, Clock, Loader2, Lock, TrendingUp, 
  DollarSign, Settings, Gift, RotateCcw, Zap, Play
} from 'lucide-react';
import StakingPlansAdmin from './StakingPlansAdmin';

const STATUS_COLORS = {
  PENDING_LOCK: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  PENDING_APPROVAL: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  ACTIVE: 'bg-green-500/10 text-green-500 border-green-500/20',
  REJECTED: 'bg-red-500/10 text-red-500 border-red-500/20',
  CANCELLED: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  COMPLETED: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  UNLOCKING: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
};

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

function formatUsdt(val) {
  if (val === null || val === undefined) return '-';
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StakingStatCard({ title, value, icon: Icon, colorClass }) {
  return (
    <Card className={`border ${colorClass} transition-all hover:shadow-md`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className={`p-2 rounded-full bg-white/10 ${colorClass.split(' ')[1]}`}>
            <Icon className="h-5 w-5 opacity-80" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StakingAdminTab({ stakingRequests = [], stakingStats = {}, onRefresh }) {
  const [adminTab, setAdminTab] = useState('requests');
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [destinationPool, setDestinationPool] = useState('Main Staking Pool');
  const [rewardsAdjustment, setRewardsAdjustment] = useState('');
  const [processing, setProcessing] = useState(false);
  
  // Auto-Approve State
  const [autoApproveRunning, setAutoApproveRunning] = useState(false);
  const [autoApproveResult, setAutoApproveResult] = useState(null);
  
  // Accrual State
  const [accrualRunning, setAccrualRunning] = useState(false);
  const [accrualResult, setAccrualResult] = useState(null);

  const pendingRequests = stakingRequests.filter(r => r.status === 'PENDING_APPROVAL');
  const otherRequests = stakingRequests.filter(r => r.status !== 'PENDING_APPROVAL');

  const handleRunAutoApprove = async () => {
    setAutoApproveRunning(true);
    setAutoApproveResult(null);
    try {
      const res = await base44.functions.invoke('stakingAutoApprove', {});
      if (res.data?.ok) {
        const data = res.data.data;
        setAutoApproveResult(data);
        if (data.approvedCount > 0) toast.success(`Auto-approved ${data.approvedCount} positions`);
        onRefresh?.();
      } else {
        toast.error(res.data?.error?.message || 'Auto-approve failed');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAutoApproveRunning(false);
    }
  };

  const handleRunAccrual = async () => {
    setAccrualRunning(true);
    setAccrualResult(null);
    try {
      const res = await base44.functions.invoke('stakingRewardsProcessor', { action: 'processDailyAccrual' });
      if (res.data?.ok) {
        const data = res.data.data;
        setAccrualResult(data);
        if (data.accruedCount > 0) toast.success(`Accrued for ${data.accruedCount} positions`);
        onRefresh?.();
      } else {
        toast.error(res.data?.error?.message || 'Accrual failed');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAccrualRunning(false);
    }
  };

  const handleApprove = async () => {
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('okxAdminHub', {
        action: 'approveStake',
        stakingId: selectedPosition.id,
        destinationPool,
        adminNote,
      });
      if (res.data?.ok) {
        toast.success(`Approved. Rewards: ${res.data.data?.rewardsGranted || 0}`);
        setReviewDialogOpen(false);
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

  const handleReject = async () => {
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('okxAdminHub', {
        action: 'rejectStake',
        stakingId: selectedPosition.id,
        reason: rejectReason || 'Rejected by admin',
        adminNote,
      });
      if (res.data?.ok) {
        toast.success('Rejected');
        setReviewDialogOpen(false);
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

  const handleRetryTransfer = async () => {
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('okxAdminHub', {
        action: 'retryStakeTransfer',
        stakingId: selectedPosition.id,
      });
      if (res.data?.ok) {
        toast.success('Retried');
        setReviewDialogOpen(false);
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

  const handleAdjustRewards = async () => {
    if (!rewardsAdjustment) return;
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('okxAdminHub', {
        action: 'adjustStakeRewards',
        stakingId: selectedPosition.id,
        adjustment: Number(rewardsAdjustment),
        reason: adminNote || 'Admin adjustment',
      });
      if (res.data?.ok) {
        toast.success('Rewards adjusted');
        setReviewDialogOpen(false);
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

  const openReviewDialog = (position, action) => {
    setSelectedPosition(position);
    setReviewAction(action);
    setRejectReason('');
    setAdminNote('');
    setRewardsAdjustment('');
    setReviewDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StakingStatCard title="Pending" value={stakingStats.pending || 0} icon={Clock} colorClass="bg-orange-500/5 border-orange-500/20 text-orange-600" />
        <StakingStatCard title="Active" value={stakingStats.active || 0} icon={TrendingUp} colorClass="bg-green-500/5 border-green-500/20 text-green-600" />
        <StakingStatCard title="Completed" value={stakingStats.completed || 0} icon={CheckCircle2} colorClass="bg-blue-500/5 border-blue-500/20 text-blue-600" />
        <StakingStatCard title="Total Staked" value={`$${formatUsdt(stakingStats.totalStaked)}`} icon={Lock} colorClass="bg-purple-500/5 border-purple-500/20 text-purple-600" />
        <StakingStatCard title="Rewards" value={stakingStats.totalRewardsGranted || 0} icon={Gift} colorClass="bg-amber-500/5 border-amber-500/20 text-amber-600" />
      </div>

      {/* Main Tabs */}
      <Tabs value={adminTab} onValueChange={setAdminTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="requests" className="px-4">Requests {pendingRequests.length > 0 && <span className="ml-2 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingRequests.length}</span>}</TabsTrigger>
            <TabsTrigger value="positions" className="px-4">All Positions</TabsTrigger>
            <TabsTrigger value="plans" className="px-4">Plans</TabsTrigger>
          </TabsList>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRunAccrual} disabled={accrualRunning} className="h-9">
              {accrualRunning ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <DollarSign className="w-3 h-3 mr-2" />}
              Run Accrual
            </Button>
            <Button variant="default" size="sm" onClick={handleRunAutoApprove} disabled={autoApproveRunning} className="h-9">
              {autoApproveRunning ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Zap className="w-3 h-3 mr-2" />}
              Auto-Approve
            </Button>
          </div>
        </div>

        {/* Accrual/Auto-Approve Results */}
        {accrualResult && (
          <div className="p-3 bg-muted/30 border border-border/50 rounded-lg text-sm flex gap-4 animate-in fade-in slide-in-from-top-2">
            <span className="font-semibold text-primary">Accrual Result:</span>
            <span>Processed: {accrualResult.processedCount}</span>
            <span className="text-green-600">Accrued: {accrualResult.accruedCount}</span>
            <span className="text-muted-foreground">Total: ${accrualResult.totalAccrued?.toFixed(6)}</span>
          </div>
        )}
        
        {autoApproveResult && (
          <div className="p-3 bg-muted/30 border border-border/50 rounded-lg text-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex gap-4">
              <span className="font-semibold text-primary">Auto-Approve Result:</span>
              <span>Processed: {autoApproveResult.processedCount}</span>
              <span className="text-green-600">Approved: {autoApproveResult.approvedCount}</span>
              <span className="text-red-600">Failed: {autoApproveResult.failedCount}</span>
            </div>
            {autoApproveResult.details?.length > 0 && (
              <div className="mt-2 text-xs space-y-1 max-h-32 overflow-auto">
                {autoApproveResult.details.map((d, i) => (
                  <div key={i} className="flex gap-2 text-muted-foreground">
                    <span className="font-mono">{d.userEmail || d.id?.slice(0, 8)}</span>
                    <span className={d.status === 'approved' ? 'text-green-500' : 'text-red-500'}>{d.status}</span>
                    {d.reason && <span>({d.reason})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          {pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed border-muted rounded-xl">
              <CheckCircle2 className="h-10 w-10 mb-3 opacity-20" />
              <p>No pending requests</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pendingRequests.map((req) => (
                <Card key={req.id} className="border-l-4 border-l-orange-500 overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-base py-1 px-3 bg-background">{req.planKey}</Badge>
                          <Badge className={STATUS_COLORS[req.status] || ''}>{req.status}</Badge>
                        </div>
                        <div>
                          <h4 className="font-medium text-lg">{req.userEmail}</h4>
                          <p className="text-sm text-muted-foreground font-mono mt-1">
                            Lock Transfer: {req.lockTransferId?.substring(0, 16)}...
                          </p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm bg-muted/30 p-3 rounded-lg border border-border/50">
                          <div>
                            <p className="text-muted-foreground text-xs uppercase tracking-wider">Principal</p>
                            <p className="font-mono font-semibold text-base mt-0.5">{formatUsdt(req.principal)} USDT</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs uppercase tracking-wider">APY</p>
                            <p className="font-semibold text-emerald-500 text-base mt-0.5">{req.apyPercent}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs uppercase tracking-wider">Term</p>
                            <p className="font-semibold text-base mt-0.5">{req.termDays} days</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs uppercase tracking-wider">Est. Rewards</p>
                            <p className="font-semibold text-base mt-0.5 text-amber-500">+{Math.round(req.principal * (req.baseRewardsPerDollar || 10))}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 min-w-[140px]">
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20" onClick={() => openReviewDialog(req, 'approve')}>
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                        </Button>
                        <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => openReviewDialog(req, 'reject')}>
                          <XCircle className="w-4 h-4 mr-2" /> Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Positions Tab */}
        <TabsContent value="positions">
          <Card>
            <CardHeader>
              <CardTitle>Staking Positions</CardTitle>
              <CardDescription>View all historical and active positions</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>APY</TableHead>
                    <TableHead>Rewards</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approval</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {otherRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No positions found</TableCell>
                    </TableRow>
                  ) : (
                    otherRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{req.userEmail}</p>
                        </TableCell>
                        <TableCell className="font-medium">{req.planKey}</TableCell>
                        <TableCell className="font-mono">{formatUsdt(req.principal)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {req.sourceAccount === 'COPY_TRADING' ? 'Copy Trading' : 'Main'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-emerald-600 font-medium">{req.apyPercent}%</TableCell>
                        <TableCell className="font-mono">{req.rewardsGranted || 0}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[req.status] || ''} variant="outline">{req.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {req.approvedByType === 'AUTOMATION' ? <Badge variant="secondary" className="text-[10px]">Auto</Badge> : 'Admin'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openReviewDialog(req, 'manage')}>
                            <Settings className="w-4 h-4" />
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

        <TabsContent value="plans">
          <StakingPlansAdmin onRefresh={onRefresh} />
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve Stake' : 
               reviewAction === 'reject' ? 'Reject Stake' : 
               'Manage Position'}
            </DialogTitle>
            <DialogDescription>
              {selectedPosition?.userEmail} • {formatUsdt(selectedPosition?.principal)} USDT
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {reviewAction === 'approve' && (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <p className="text-sm text-emerald-800 dark:text-emerald-200">
                    This will activate the stake and transfer funds to the main pool.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label>Destination Pool</Label>
                  <Select value={destinationPool} onValueChange={setDestinationPool}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Main Staking Pool">Main Staking Pool</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {reviewAction === 'reject' && (
              <div className="space-y-3">
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    Funds will be returned to the user's trading wallet.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label>Reason</Label>
                  <Textarea 
                    value={rejectReason} 
                    onChange={(e) => setRejectReason(e.target.value)} 
                    placeholder="Why is this being rejected?" 
                  />
                </div>
              </div>
            )}

            {reviewAction === 'manage' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Adjust Rewards (+/-)</Label>
                  <Input 
                    type="number" 
                    value={rewardsAdjustment} 
                    onChange={(e) => setRewardsAdjustment(e.target.value)} 
                    placeholder="e.g. 100 or -50" 
                  />
                </div>
                {selectedPosition?.status === 'PENDING_APPROVAL' && (
                  <Button variant="outline" className="w-full justify-start" onClick={handleRetryTransfer}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Retry Transfer
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label>Admin Note</Label>
              <Textarea 
                value={adminNote} 
                onChange={(e) => setAdminNote(e.target.value)} 
                placeholder="Internal notes..." 
                rows={2} 
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
            {reviewAction === 'approve' && <Button onClick={handleApprove} disabled={processing} className="bg-emerald-600 hover:bg-emerald-700">Confirm Approve</Button>}
            {reviewAction === 'reject' && <Button onClick={handleReject} disabled={processing} variant="destructive">Confirm Reject</Button>}
            {reviewAction === 'manage' && <Button onClick={handleAdjustRewards} disabled={processing}>Save Changes</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}