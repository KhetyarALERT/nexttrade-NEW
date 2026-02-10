import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Clock, Loader2, AlertCircle } from 'lucide-react';

const statusColors = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  under_review: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  approved: 'bg-green-500/10 text-green-500 border-green-500/20',
  assigned: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
};

export default function AccountRequestsAdminTab({ requests, poolAccounts, onRefresh, formatDate }) {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedPoolAccountId, setSelectedPoolAccountId] = useState('');
  const [processing, setProcessing] = useState(false);

  const pendingRequests = requests.filter(r => r.status === 'pending' || r.status === 'under_review');
  const processedRequests = requests.filter(r => r.status !== 'pending' && r.status !== 'under_review');
  const availablePoolAccounts = poolAccounts.filter(p => p.status === 'AVAILABLE');

  const handleReview = async () => {
    if (!selectedRequest) return;
    setProcessing(true);
    try {
      const user = await base44.auth.me();
      
      if (reviewAction === 'reject') {
        await base44.entities.LiveAccountRequest.update(selectedRequest.id, {
          status: 'rejected',
          rejection_reason: rejectionReason || 'Request declined',
          admin_notes: adminNotes,
          reviewed_by: user.email,
          reviewed_at: new Date().toISOString()
        });
        toast.success('Request rejected');
      } else if (reviewAction === 'approve') {
        await base44.entities.LiveAccountRequest.update(selectedRequest.id, {
          status: 'approved',
          admin_notes: adminNotes,
          reviewed_by: user.email,
          reviewed_at: new Date().toISOString()
        });
        toast.success('Approved! Now assign a pool account.');
        setReviewDialogOpen(false);
        setAssignDialogOpen(true);
        setProcessing(false);
        return;
      }
      
      setReviewDialogOpen(false);
      setSelectedRequest(null);
      setAdminNotes('');
      setRejectionReason('');
      onRefresh();
    } catch (err) {
      toast.error('Failed to process: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedRequest || !selectedPoolAccountId) {
      toast.error('Select a pool account');
      return;
    }
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('okxAdminHub', {
        action: 'assignToUser',
        poolAccountId: selectedPoolAccountId,
        userId: selectedRequest.user_id,
      });
      
      if (res.data?.ok) {
        await base44.entities.LiveAccountRequest.update(selectedRequest.id, {
          status: 'assigned',
          assigned_pool_account_id: selectedPoolAccountId,
          assigned_at: new Date().toISOString()
        });
        toast.success('Account assigned successfully!');
        setAssignDialogOpen(false);
        setSelectedRequest(null);
        setSelectedPoolAccountId('');
        onRefresh();
      } else {
        toast.error(res.data?.error?.message || 'Failed to assign');
      }
    } catch (err) {
      toast.error('Failed to assign: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      <Card className={pendingRequests.length > 0 ? 'border-orange-500/30' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Pending Requests
            {pendingRequests.length > 0 && <Badge variant="secondary" className="ml-2">{pendingRequests.length}</Badge>}
          </CardTitle>
          <CardDescription>Review live trading requests</CardDescription>
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
                <div key={req.id} className="rounded-xl border bg-card p-4 hover:shadow-md transition-all">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{req.user_full_name || 'Unknown'}</span>
                        <Badge className={statusColors[req.status] || ''} variant="outline">
                          {req.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{req.user_email}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Income</p>
                          <p className="font-medium">{req.monthly_income}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Deposit</p>
                          <p className="font-medium">{req.expected_deposit}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Experience</p>
                          <p className="font-medium">{req.trading_experience}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Requested</p>
                          <p className="font-medium">{formatDate(req.created_date)}</p>
                        </div>
                      </div>
                      {req.additional_notes && (
                        <p className="text-xs text-muted-foreground mt-2 bg-muted/30 p-2 rounded">
                          Note: {req.additional_notes}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          setSelectedRequest(req);
                          setReviewAction('approve');
                          setReviewDialogOpen(true);
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedRequest(req);
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

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Income</TableHead>
                <TableHead>Deposit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reviewed By</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No history
                  </TableCell>
                </TableRow>
              ) : (
                processedRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{req.user_full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{req.user_email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{req.monthly_income}</TableCell>
                    <TableCell className="text-sm">{req.expected_deposit}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[req.status] || ''} variant="outline">
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{req.reviewed_by || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(req.reviewed_at || req.created_date)}</TableCell>
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
              {reviewAction === 'approve' ? 'Approve Request' : 'Reject Request'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.user_email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {reviewAction === 'reject' && (
              <div>
                <Label>Rejection Reason</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Why is this request being rejected?"
                />
              </div>
            )}
            <div>
              <Label>Internal Notes</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Optional notes for admins..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleReview}
              disabled={processing}
              className={reviewAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {reviewAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Pool Account</DialogTitle>
            <DialogDescription>
              Select a pool account to assign to this user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {availablePoolAccounts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p>No available pool accounts.</p>
              </div>
            ) : (
              <div>
                <Label>Pool Account</Label>
                <Select value={selectedPoolAccountId} onValueChange={setSelectedPoolAccountId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePoolAccounts.map((pool) => (
                      <SelectItem key={pool.id} value={pool.id}>
                        {pool.subaccountName} (Bal: ${pool.lastBalanceUsdt?.toFixed(2) || '0.00'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={processing || !selectedPoolAccountId}>
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}