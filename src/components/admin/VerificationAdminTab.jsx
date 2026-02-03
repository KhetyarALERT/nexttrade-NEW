import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  CheckCircle2, XCircle, FileText, Image, MessageSquare, ExternalLink, HelpCircle, Loader2, Settings, Shield
} from 'lucide-react';

const statusColors = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  under_review: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  approved: 'bg-green-500/10 text-green-500 border-green-500/20',
  rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
  needs_help: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
};

export default function VerificationAdminTab({ verifications, onRefresh, formatDate }) {
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminResponse, setAdminResponse] = useState('');
  const [processing, setProcessing] = useState(false);
  const [runningCleanup, setRunningCleanup] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [overrideUserId, setOverrideUserId] = useState('');
  const [overrideStatus, setOverrideStatus] = useState('verified');
  const [overrideReason, setOverrideReason] = useState('');
  const [editForm, setEditForm] = useState({
    full_name: '',
    date_of_birth: '',
    country: '',
    document_type: 'passport'
  });

  // Filter out superseded requests
  const activeVerifications = verifications.filter(v => v.status !== 'superseded');
  
  const pendingVerifications = activeVerifications.filter(v => 
    v.status === 'pending' || v.status === 'under_review' || v.status === 'needs_help'
  );
  const processedVerifications = activeVerifications.filter(v => 
    v.status !== 'pending' && v.status !== 'under_review' && v.status !== 'needs_help'
  );
  
  const runCleanup = async (dryRun = false) => {
    if (!dryRun && !confirm('Run cleanup to fix duplicate KYC requests? This will consolidate data into UserVerification. Help requests will NOT be affected.')) return;
    
    setRunningCleanup(true);
    try {
      const res = await base44.functions.invoke("verificationService", { action: "runCleanup", dryRun });
      if (res.data?.ok) {
        const d = res.data.data;
        const msg = dryRun 
          ? `[DRY RUN] Would process ${d.users_processed} users, supersede ${d.kyc_requests_superseded} KYC requests, create ${d.user_verifications_created} UV records, update ${d.user_verifications_updated} UV records`
          : `Cleanup complete: ${d.users_processed} users, ${d.kyc_requests_superseded} KYC superseded, ${d.user_verifications_created} UV created, ${d.user_verifications_updated} UV updated`;
        toast.success(msg);
        if (!dryRun) onRefresh();
      } else {
        throw new Error(res.data?.error || "Cleanup failed");
      }
    } catch (err) {
      toast.error('Cleanup failed: ' + err.message);
    } finally {
      setRunningCleanup(false);
    }
  };

  const handleAdminOverride = async () => {
    if (!overrideUserId || !overrideStatus) {
      toast.error('User ID and status required');
      return;
    }

    setProcessing(true);
    try {
      const res = await base44.functions.invoke("verificationService", {
        action: "adminSetStatus",
        userId: overrideUserId,
        newStatus: overrideStatus,
        reason: overrideReason || "Admin override"
      });
      
      if (!res.data?.ok) {
        throw new Error(res.data?.error || "Failed to set status");
      }

      toast.success(`User ${overrideUserId} status set to ${overrideStatus}`);
      setOverrideDialogOpen(false);
      setOverrideUserId('');
      setOverrideReason('');
      onRefresh();
    } catch (err) {
      toast.error('Override failed: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReview = async () => {
    if (!selectedVerification) return;
    
    setProcessing(true);
    try {
      if (reviewAction === 'approve') {
        // Use verificationService for proper status update
        const res = await base44.functions.invoke("verificationService", {
          action: "adminApprove",
          requestId: selectedVerification.id
        });
        if (!res.data?.ok) {
          throw new Error(res.data?.error || "Failed to approve");
        }
      } else if (reviewAction === 'reject') {
        // Use verificationService for proper status update
        const res = await base44.functions.invoke("verificationService", {
          action: "adminReject",
          requestId: selectedVerification.id,
          reason: rejectionReason || 'Verification declined'
        });
        if (!res.data?.ok) {
          throw new Error(res.data?.error || "Failed to reject");
        }
      } else if (reviewAction === 'respond') {
        // Use verificationService adminRespond action (doesn't change verification status)
        const res = await base44.functions.invoke("verificationService", {
          action: "adminRespond",
          requestId: selectedVerification.id,
          response: adminResponse
        });
        if (!res.data?.ok) {
          throw new Error(res.data?.error || "Failed to respond");
        }
      }
      
      // Notify user
      try {
        await base44.functions.invoke("notifyAdminVerification", {
          action: "notifyUser",
          verificationId: selectedVerification.id
        });
      } catch (e) {
        console.error("Failed to notify user:", e);
      }
      
      toast.success('Processed successfully');
      setReviewDialogOpen(false);
      setSelectedVerification(null);
      setRejectionReason('');
      setAdminResponse('');
      onRefresh();
    } catch (err) {
      toast.error('Failed to process: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleEditDetails = async () => {
    if (!selectedVerification) return;
    
    setProcessing(true);
    try {
      const user = await base44.auth.me();
      
      await base44.entities.VerificationRequest.update(selectedVerification.id, {
        full_name: editForm.full_name,
        date_of_birth: editForm.date_of_birth || null,
        country: editForm.country || null,
        document_type: editForm.document_type,
        reviewed_by: user.email,
        updated_at: new Date().toISOString()
      });
      
      toast.success('Verification details updated');
      setEditDialogOpen(false);
      setSelectedVerification(null);
      onRefresh();
    } catch (err) {
      toast.error('Failed to update: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const openEditDialog = (verification) => {
    setSelectedVerification(verification);
    setEditForm({
      full_name: verification.full_name || '',
      date_of_birth: verification.date_of_birth || '',
      country: verification.country || '',
      document_type: verification.document_type || 'passport'
    });
    setEditDialogOpen(true);
  };

  const handleDeleteVerification = async (verificationId) => {
    if (!confirm('Are you sure you want to delete this verification? This action cannot be undone.')) return;
    
    setProcessing(true);
    try {
      await base44.entities.VerificationRequest.delete(verificationId);
      toast.success('Verification deleted successfully');
      onRefresh();
    } catch (err) {
      toast.error('Failed to delete: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleChangeStatus = async (newStatus) => {
    if (!selectedVerification) return;
    setProcessing(true);
    try {
      if (newStatus === 'approved') {
        // Use verificationService for proper status update
        const res = await base44.functions.invoke("verificationService", {
          action: "adminApprove",
          requestId: selectedVerification.id
        });
        if (!res.data?.ok) {
          throw new Error(res.data?.error || "Failed to approve");
        }
      } else if (newStatus === 'rejected') {
        // Use verificationService for proper status update
        const res = await base44.functions.invoke("verificationService", {
          action: "adminReject",
          requestId: selectedVerification.id,
          reason: "Changed by admin"
        });
        if (!res.data?.ok) {
          throw new Error(res.data?.error || "Failed to reject");
        }
      } else {
        // For other statuses (pending), direct update
        const adminUser = await base44.auth.me();
        await base44.entities.VerificationRequest.update(selectedVerification.id, {
          status: newStatus,
          reviewed_by: adminUser.email,
          reviewed_at: new Date().toISOString()
        });
      }
      
      try {
        await base44.functions.invoke("notifyAdminVerification", {
          action: "notifyUser",
          verificationId: selectedVerification.id
        });
      } catch (e) {
        console.error("Failed to notify user:", e);
      }
      toast.success(`Status changed to ${newStatus}`);
      setReviewDialogOpen(false);
      setSelectedVerification(null);
      onRefresh();
    } catch (err) {
      toast.error('Failed to change status');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Tools */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Cleanup Tool */}
        <Card className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <p className="font-semibold text-foreground mb-1">Data Cleanup Tool</p>
            <p className="text-xs text-muted-foreground mb-3">Fix duplicate KYC requests and sync UserVerification status</p>
            <div className="flex gap-2">
              <Button
                onClick={() => runCleanup(true)}
                disabled={runningCleanup}
                variant="outline"
                size="sm"
                className="border-amber-600 text-amber-600 hover:bg-amber-50"
              >
                {runningCleanup ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Settings className="h-4 w-4 mr-2" />}
                Dry Run
              </Button>
              <Button
                onClick={() => runCleanup(false)}
                disabled={runningCleanup}
                variant="outline"
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white border-0"
              >
                {runningCleanup ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Settings className="h-4 w-4 mr-2" />}
                Run Cleanup
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Admin Override Tool */}
        <Card className="border-blue-500/30 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <p className="font-semibold text-foreground mb-1">Manual Status Override</p>
            <p className="text-xs text-muted-foreground mb-3">Directly set UserVerification status for any user</p>
            <Button
              onClick={() => setOverrideDialogOpen(true)}
              variant="outline"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white border-0"
            >
              <Shield className="h-4 w-4 mr-2" />
              Override Status
            </Button>
          </CardContent>
        </Card>
      </div>
      
      {/* Pending/Help Requests */}
      <Card className={pendingVerifications.length > 0 ? 'border-orange-500/30' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-500" />
            Pending Verifications
            {pendingVerifications.length > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingVerifications.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>Review KYC submissions and help requests</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingVerifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No pending verifications</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingVerifications.map((v) => (
                <div 
                  key={v.id} 
                  className={`rounded-xl border p-4 transition-all hover:shadow-md ${
                    v.status === 'needs_help' 
                      ? 'border-amber-500/30 bg-amber-500/5' 
                      : 'bg-card'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{v.full_name || 'Unknown'}</span>
                        <Badge className={statusColors[v.status] || ''} variant="outline">
                          {v.status === 'needs_help' && <HelpCircle className="h-3 w-3 mr-1" />}
                          {v.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{v.user_email}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Document</p>
                          <p className="font-medium capitalize">{v.document_type?.replace(/_/g, ' ')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Country</p>
                          <p className="font-medium">{v.country || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">DOB</p>
                          <p className="font-medium">{v.date_of_birth || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Submitted</p>
                          <p className="font-medium">{formatDate(v.submitted_at || v.created_date)}</p>
                        </div>
                      </div>

                      {v.status === 'needs_help' && v.help_message && (
                        <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="h-4 w-4 text-amber-600 mt-0.5" />
                            <div>
                              <p className="text-xs font-medium text-amber-700">Help Request:</p>
                              <p className="text-sm text-amber-600 mt-1">{v.help_message}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 mt-2 flex-wrap">
                        {[
                          { url: v.document_front_url, label: "Front" },
                          { url: v.document_back_url, label: "Back" },
                          { url: v.selfie_url, label: "Selfie" }
                        ].map((doc, i) => doc.url && (
                          <Button key={i} size="sm" variant="outline" onClick={() => setImagePreviewUrl(doc.url)} className="text-xs h-8">
                            <Image className="h-3 w-3 mr-1" />
                            {doc.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(v)}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      
                      {v.status === 'needs_help' ? (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => {
                            setSelectedVerification(v);
                            setReviewAction('respond');
                            setReviewDialogOpen(true);
                          }}
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Respond
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => {
                              setSelectedVerification(v);
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
                              setSelectedVerification(v);
                              setReviewAction('reject');
                              setReviewDialogOpen(true);
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processed Verifications */}
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reviewed By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedVerifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No history
                  </TableCell>
                </TableRow>
              ) : (
                processedVerifications.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{v.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{v.user_email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{v.document_type?.replace(/_/g, ' ')}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[v.status] || ''} variant="outline">
                        {v.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.reviewed_by || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(v.reviewed_at || v.created_date)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setSelectedVerification(v);
                            setReviewAction('changeStatus');
                            setReviewDialogOpen(true);
                          }}
                        >
                          <Settings className="h-4 w-4" />
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

      {/* Dialogs reused from logic, just cleaner */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve Verification' : 
               reviewAction === 'reject' ? 'Reject Verification' : 
               reviewAction === 'changeStatus' ? 'Change Status' :
               'Respond to Request'}
            </DialogTitle>
            <DialogDescription>
              {selectedVerification?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {reviewAction === 'reject' && (
              <div>
                <Label>Reason</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Reason for rejection..."
                />
              </div>
            )}
            {reviewAction === 'respond' && (
              <div>
                <Label>Response</Label>
                <Textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  placeholder="Type your response..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
            {reviewAction === 'changeStatus' ? (
              <div className="flex gap-2">
                <Button onClick={() => handleChangeStatus('approved')} className="bg-green-600">Verified</Button>
                <Button onClick={() => handleChangeStatus('rejected')} variant="destructive">Rejected</Button>
                <Button onClick={() => handleChangeStatus('pending')} variant="outline">Pending</Button>
              </div>
            ) : (
              <Button 
                onClick={handleReview}
                disabled={processing}
                className={reviewAction === 'reject' ? 'bg-red-600' : 'bg-green-600'}
              >
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Country</Label>
              <Input
                value={editForm.country}
                onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditDetails} disabled={processing}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Override Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manual Status Override</DialogTitle>
            <DialogDescription>Directly set UserVerification status for any user</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>User ID</Label>
              <Input
                value={overrideUserId}
                onChange={(e) => setOverrideUserId(e.target.value)}
                placeholder="Enter user ID"
              />
            </div>
            <div>
              <Label>New Status</Label>
              <Select value={overrideStatus} onValueChange={setOverrideStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {overrideStatus === 'rejected' && (
              <div>
                <Label>Reason (optional)</Label>
                <Textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Reason for rejection..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdminOverride} disabled={processing || !overrideUserId}>
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Set Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview */}
      <Dialog open={!!imagePreviewUrl} onOpenChange={() => setImagePreviewUrl(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/90 border-none" aria-describedby={undefined}>
          <DialogHeader className="sr-only">
            <DialogTitle>Document Preview</DialogTitle>
          </DialogHeader>
          {imagePreviewUrl && (
            <div className="relative flex justify-center items-center h-[80vh]">
              <img src={imagePreviewUrl} alt="Document" className="max-h-full max-w-full object-contain" />
              <Button 
                variant="secondary" 
                size="sm" 
                className="absolute bottom-4 right-4"
                onClick={() => window.open(imagePreviewUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Original
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}