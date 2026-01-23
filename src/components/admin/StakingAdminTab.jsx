import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  CheckCircle2, XCircle, Clock, Loader2, Lock, TrendingUp, 
  AlertCircle, DollarSign, Users, RefreshCw
} from 'lucide-react';

const statusColors = {
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
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const pendingRequests = stakingRequests.filter(r => r.status === 'PENDING_APPROVAL');
  const otherRequests = stakingRequests.filter(r => r.status !== 'PENDING_APPROVAL');

  const handleApprove = async () => {
    if (!selectedPosition) return;
    
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('okxAdminHub', {
        action: 'approveStake',
        stakingId: selectedPosition.id
      });
      
      if (res.data?.ok) {
        toast.success('Stake approved and activated');
        setReviewDialogOpen(false);
        setSelectedPosition(null);
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
        reason: rejectReason || 'Rejected by admin'
      });
      
      if (res.data?.ok) {
        toast.success(res.data.data?.fundsReturned ? 'Stake rejected - funds returned' : 'Stake rejected');
        setReviewDialogOpen(false);
        setSelectedPosition(null);
        setRejectReason('');
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

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stakingStats.pending || 0}</p>
                <p className="text-xs text-muted-foreground">${formatUsdt(stakingStats.totalStakedPending)} USDT</p>
              </div>
              <Clock className="h-8 w-8 opacity-50 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{stakingStats.active || 0}</p>
                <p className="text-xs text-muted-foreground">${formatUsdt(stakingStats.totalStakedActive)} USDT</p>
              </div>
              <TrendingUp className="h-8 w-8 opacity-50 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{stakingStats.completed || 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 opacity-50 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Staked</p>
                <p className="text-2xl font-bold">${formatUsdt(stakingStats.totalStaked)}</p>
              </div>
              <Lock className="h-8 w-8 opacity-50 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals */}
      <Card className={pendingRequests.length > 0 ? 'border-orange-500/50' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Pending Staking Requests ({pendingRequests.length})
          </CardTitle>
          <CardDescription>Review and approve staking requests</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No pending requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((req) => (
                <div 
                  key={req.id} 
                  className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{req.userFullName || req.userEmail}</span>
                        <Badge className={statusColors[req.status] || ''}>
                          {req.status}
                        </Badge>
                        <Badge variant="outline">{req.planKey}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{req.userEmail}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Amount</p>
                          <p className="font-medium text-foreground">{formatUsdt(req.principal)} {req.currency}</p>
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
                          <p className="text-xs text-muted-foreground">Requested</p>
                          <p className="font-medium">{formatDate(req.createdAt)}</p>
                        </div>
                      </div>

                      {req.lockTransferId && (
                        <p className="text-xs text-muted-foreground">
                          Lock Transfer: {req.lockTransferId.substring(0, 16)}...
                        </p>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-500/50 hover:bg-green-500/10"
                        onClick={() => {
                          setSelectedPosition(req);
                          setReviewAction('approve');
                          setReviewDialogOpen(true);
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-500/50 hover:bg-red-500/10"
                        onClick={() => {
                          setSelectedPosition(req);
                          setReviewAction('reject');
                          setReviewDialogOpen(true);
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Staking Positions */}
      <Card>
        <CardHeader>
          <CardTitle>All Staking Positions ({otherRequests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>APY</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Ends</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {otherRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No staking positions yet
                  </TableCell>
                </TableRow>
              ) : (
                otherRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{req.userFullName || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{req.userEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{req.planKey}</TableCell>
                    <TableCell className="font-mono">{formatUsdt(req.principal)} {req.currency}</TableCell>
                    <TableCell className="text-emerald-500">{req.apyPercent}%</TableCell>
                    <TableCell>
                      <Badge className={statusColors[req.status] || ''}>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(req.startedAt)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(req.endsAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve Staking Request' : 'Reject Staking Request'}
            </DialogTitle>
            <DialogDescription>
              {selectedPosition?.userEmail} - {formatUsdt(selectedPosition?.principal)} USDT ({selectedPosition?.planKey})
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
                </div>
              </div>
            )}

            {reviewAction === 'approve' && (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm">
                <p className="text-green-600 dark:text-green-400">
                  This will transfer the locked funds from user's funding account to the main staking pool and activate the staking position.
                </p>
              </div>
            )}

            {reviewAction === 'reject' && (
              <>
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
                  <p className="text-amber-600 dark:text-amber-400">
                    This will return the locked funds to user's trading account.
                  </p>
                </div>
                <div>
                  <Label>Rejection Reason</Label>
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection..."
                    className="mt-1"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={reviewAction === 'approve' ? handleApprove : handleReject}
              disabled={processing}
              className={reviewAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {reviewAction === 'approve' ? 'Approve & Activate' : 'Reject & Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}