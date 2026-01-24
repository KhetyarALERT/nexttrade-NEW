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
  AlertCircle, DollarSign, Settings, RefreshCw, Gift, RotateCcw
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

  const pendingRequests = stakingRequests.filter(r => r.status === 'PENDING_APPROVAL');
  const otherRequests = stakingRequests.filter(r => r.status !== 'PENDING_APPROVAL');

  const handleApprove = async () => {
    if (!selectedPosition) return;
    
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('okxAdminHub', {
        action: 'approveStake',
        stakingId: selectedPosition.id,
        destinationPool,
        adminNote,
      });
      
      if (res.data?.ok) {
        toast.success(`Stake approved. Rewards granted: ${res.data.data?.rewardsGranted || 0}`);
        setReviewDialogOpen(false);
        setSelectedPosition(null);
        setAdminNote('');
        onRefresh?.();
      } else {
        toast.error(res.data?.error?.message || 'Failed to approve stake');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to approve');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPosition) return;
    
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('okxAdminHub', {
        action: 'rejectStake',
        stakingId: selectedPosition.id,
        reason: rejectReason || 'Rejected by admin',
        adminNote,
      });
      
      if (res.data?.ok) {
        toast.success(res.data.data?.fundsReturned ? 'Rejected - funds returned' : 'Rejected');
        setReviewDialogOpen(false);
        setSelectedPosition(null);
        setRejectReason('');
        setAdminNote('');
        onRefresh?.();
      } else {
        toast.error(res.data?.error?.message || 'Failed to reject stake');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to reject');
    } finally {
      setProcessing(false);
    }
  };

  const handleRetryTransfer = async () => {
    if (!selectedPosition) return;
    
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('okxAdminHub', {
        action: 'retryStakeTransfer',
        stakingId: selectedPosition.id,
      });
      
      if (res.data?.ok) {
        toast.success('Transfer retried');
        setReviewDialogOpen(false);
        onRefresh?.();
      } else {
        toast.error(res.data?.error?.message || 'Retry failed');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleAdjustRewards = async () => {
    if (!selectedPosition || !rewardsAdjustment) return;
    
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
        setRewardsAdjustment('');
        setAdminNote('');
        onRefresh?.();
      } else {
        toast.error(res.data?.error?.message || 'Adjustment failed');
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
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-xl font-bold">{stakingStats.pending || 0}</p>
              </div>
              <Clock className="h-6 w-6 opacity-40 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-xl font-bold">{stakingStats.active || 0}</p>
              </div>
              <TrendingUp className="h-6 w-6 opacity-40 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-xl font-bold">{stakingStats.completed || 0}</p>
              </div>
              <CheckCircle2 className="h-6 w-6 opacity-40 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Staked</p>
                <p className="text-xl font-bold">${formatUsdt(stakingStats.totalStaked)}</p>
              </div>
              <Lock className="h-6 w-6 opacity-40 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Rewards Granted</p>
                <p className="text-xl font-bold">{stakingStats.totalRewardsGranted || 0}</p>
              </div>
              <Gift className="h-6 w-6 opacity-40 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Tabs */}
      <Tabs value={adminTab} onValueChange={setAdminTab}>
        <TabsList>
          <TabsTrigger value="requests" className="relative">
            Requests
            {pendingRequests.length > 0 && (
              <span className="ml-1 w-5 h-5 bg-orange-500 text-white text-xs rounded-full inline-flex items-center justify-center">
                {pendingRequests.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="positions">All Positions</TabsTrigger>
          <TabsTrigger value="plans">Manage Plans</TabsTrigger>
        </TabsList>

        {/* Pending Requests */}
        <TabsContent value="requests" className="space-y-4">
          {pendingRequests.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-muted-foreground">No pending requests</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => (
                <Card key={req.id} className="border-orange-500/30 bg-orange-500/5">
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{req.userEmail}</span>
                          <Badge className={STATUS_COLORS[req.status] || ''}>{req.status}</Badge>
                          <Badge variant="outline">{req.planKey}</Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mt-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Amount</p>
                            <p className="font-mono font-medium">{formatUsdt(req.principal)} USDT</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">APY</p>
                            <p className="font-medium text-emerald-500">{req.apyPercent}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Term</p>
                            <p className="font-medium">{req.termDays} days</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Est. Rewards</p>
                            <p className="font-medium">+{Math.round(req.principal * (req.baseRewardsPerDollar || 10))}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Requested</p>
                            <p className="font-medium">{formatDate(req.createdAt)}</p>
                          </div>
                        </div>

                        {req.lockTransferId && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Lock Transfer: {req.lockTransferId.substring(0, 16)}...
                          </p>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-500/50 hover:bg-green-500/10"
                          onClick={() => openReviewDialog(req, 'approve')}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-500/50 hover:bg-red-500/10"
                          onClick={() => openReviewDialog(req, 'reject')}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* All Positions */}
        <TabsContent value="positions">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>APY</TableHead>
                    <TableHead>Rewards</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pool</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {otherRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No positions yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    otherRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{req.userEmail}</p>
                        </TableCell>
                        <TableCell className="font-medium">{req.planKey}</TableCell>
                        <TableCell className="font-mono">{formatUsdt(req.principal)}</TableCell>
                        <TableCell className="text-emerald-500">{req.apyPercent}%</TableCell>
                        <TableCell className="font-mono">{req.rewardsGranted || 0}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[req.status] || ''}>{req.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{req.destinationPool || '-'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(req.startedAt)}
                          {req.approvedByType && (
                            <Badge variant="outline" className={`ml-1 text-[10px] ${req.approvedByType === 'AUTOMATION' ? 'border-emerald-500/50 text-emerald-600' : ''}`}>
                              {req.approvedByType === 'AUTOMATION' ? 'Auto' : 'Admin'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openReviewDialog(req, 'manage')}
                          >
                            <Settings className="h-4 w-4" />
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

        {/* Plans Management */}
        <TabsContent value="plans">
          <StakingPlansAdmin onRefresh={onRefresh} />
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve Staking Request' : 
               reviewAction === 'reject' ? 'Reject Staking Request' : 
               'Manage Position'}
            </DialogTitle>
            <DialogDescription>
              {selectedPosition?.userEmail} - {formatUsdt(selectedPosition?.principal)} USDT
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedPosition && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <p><strong>Amount:</strong> {formatUsdt(selectedPosition.principal)} USDT</p>
                  <p><strong>APY:</strong> {selectedPosition.apyPercent}%</p>
                  <p><strong>Term:</strong> {selectedPosition.termDays} days</p>
                  <p><strong>Plan:</strong> {selectedPosition.planKey}</p>
                  <p><strong>Status:</strong> {selectedPosition.status}</p>
                  <p><strong>Rewards:</strong> {selectedPosition.rewardsGranted || 0}</p>
                </div>
              </div>
            )}

            {reviewAction === 'approve' && (
              <>
                <div>
                  <Label>Destination Pool</Label>
                  <Select value={destinationPool} onValueChange={setDestinationPool}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Main Staking Pool">Main Staking Pool</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm">
                  <p className="text-green-600 dark:text-green-400">
                    This will transfer funds from user's funding account to the main pool and activate the stake. Rewards will be calculated and granted.
                  </p>
                </div>
              </>
            )}

            {reviewAction === 'reject' && (
              <>
                <div>
                  <Label>Rejection Reason</Label>
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection..."
                  />
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
                  <p className="text-amber-600 dark:text-amber-400">
                    This will return locked funds to user's trading account.
                  </p>
                </div>
              </>
            )}

            {reviewAction === 'manage' && (
              <>
                <div>
                  <Label>Adjust Rewards (+/-)</Label>
                  <Input
                    type="number"
                    value={rewardsAdjustment}
                    onChange={(e) => setRewardsAdjustment(e.target.value)}
                    placeholder="e.g., 100 or -50"
                  />
                </div>
                
                {selectedPosition?.status === 'PENDING_APPROVAL' && (
                  <Button variant="outline" onClick={handleRetryTransfer} disabled={processing} className="w-full">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Re-run Transfer (if stuck)
                  </Button>
                )}
              </>
            )}

            <div>
              <Label>Admin Note (optional)</Label>
              <Textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Internal note..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
            
            {reviewAction === 'approve' && (
              <Button onClick={handleApprove} disabled={processing} className="bg-green-600 hover:bg-green-700">
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Approve & Activate
              </Button>
            )}
            
            {reviewAction === 'reject' && (
              <Button onClick={handleReject} disabled={processing} className="bg-red-600 hover:bg-red-700">
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Reject & Refund
              </Button>
            )}
            
            {reviewAction === 'manage' && rewardsAdjustment && (
              <Button onClick={handleAdjustRewards} disabled={processing}>
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Apply Adjustment
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}