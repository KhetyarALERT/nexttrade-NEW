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
  History, ExternalLink, TrendingUp, TrendingDown, FileText, UserCheck,
  HelpCircle, MessageSquare, Image, Trash2, Lock
} from 'lucide-react';
import StakingAdminTab from '@/components/admin/StakingAdminTab';

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

// Verification Tab Component
function VerificationTab({ verifications, onRefresh, formatDate }) {
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminResponse, setAdminResponse] = useState('');
  const [processing, setProcessing] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    date_of_birth: '',
    country: '',
    document_type: 'passport'
  });

  const pendingVerifications = verifications.filter(v => 
    v.status === 'pending' || v.status === 'under_review' || v.status === 'needs_help'
  );
  const processedVerifications = verifications.filter(v => 
    v.status !== 'pending' && v.status !== 'under_review' && v.status !== 'needs_help'
  );

  const handleReview = async () => {
    if (!selectedVerification) return;
    
    setProcessing(true);
    try {
      const adminUser = await base44.auth.me();
      
      const updateData = {
        reviewed_by: adminUser.email,
        reviewed_at: new Date().toISOString()
      };

      if (reviewAction === 'approve') {
        updateData.status = 'approved';
      } else if (reviewAction === 'reject') {
        updateData.status = 'rejected';
        updateData.rejection_reason = rejectionReason || 'Verification declined';
      } else if (reviewAction === 'respond') {
        updateData.admin_response = adminResponse;
        updateData.admin_responded_at = new Date().toISOString();
        updateData.status = 'under_review';
      }

      await base44.entities.VerificationRequest.update(selectedVerification.id, updateData);
      
      // Notify the user of the status change (this also updates User entity via backend)
      try {
        await base44.functions.invoke("notifyAdminVerification", {
          action: "notifyUser",
          verificationId: selectedVerification.id
        });
      } catch (e) {
        console.error("Failed to notify user:", e);
      }
      
      toast.success(reviewAction === 'approve' ? 'Verification approved - User notified' : 
                    reviewAction === 'reject' ? 'Verification rejected - User notified' : 
                    'Response sent - User notified');
      
      setReviewDialogOpen(false);
      setSelectedVerification(null);
      setAdminNotes('');
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
      const adminUser = await base44.auth.me();
      
      await base44.entities.VerificationRequest.update(selectedVerification.id, {
        status: newStatus,
        reviewed_by: adminUser.email,
        reviewed_at: new Date().toISOString()
      });
      
      // Notify the user of the status change (this also updates User entity via backend)
      try {
        await base44.functions.invoke("notifyAdminVerification", {
          action: "notifyUser",
          verificationId: selectedVerification.id
        });
      } catch (e) {
        console.error("Failed to notify user:", e);
      }
      
      toast.success(`Status changed to ${newStatus} - User notified`);
      setReviewDialogOpen(false);
      setSelectedVerification(null);
      onRefresh();
    } catch (err) {
      toast.error('Failed to change status: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const DOC_TYPE_LABELS = {
    passport: 'Passport',
    national_id: 'National ID',
    drivers_license: "Driver's License"
  };

  const STATUS_LABELS = {
    pending: 'Pending',
    under_review: 'Under Review',
    approved: 'Approved',
    rejected: 'Rejected',
    needs_help: 'Needs Help'
  };

  return (
    <div className="space-y-6">
      {/* Pending/Help Requests */}
      <Card className={pendingVerifications.length > 0 ? 'border-orange-500/50' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-500" />
            Pending Verifications ({pendingVerifications.length})
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
                  className={`rounded-xl border p-4 ${
                    v.status === 'needs_help' 
                      ? 'border-amber-500/50 bg-amber-500/5' 
                      : 'border-blue-500/30 bg-blue-500/5'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{v.full_name || 'Unknown'}</span>
                        <Badge className={
                          v.status === 'needs_help' 
                            ? 'bg-amber-500/20 text-amber-600 border-amber-500/30'
                            : statusColors[v.status] || ''
                        }>
                          {v.status === 'needs_help' && <HelpCircle className="h-3 w-3 mr-1" />}
                          {STATUS_LABELS[v.status] || v.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{v.user_email}</p>
                      <p className="text-xs text-muted-foreground">User ID: {v.user_id}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Document</p>
                          <p className="font-medium">{DOC_TYPE_LABELS[v.document_type] || v.document_type}</p>
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

                      {/* Help Message */}
                      {v.status === 'needs_help' && v.help_message && (
                        <div className="mt-3 p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="h-4 w-4 text-amber-600 mt-0.5" />
                            <div>
                              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Help Request:</p>
                              <p className="text-sm text-amber-600 dark:text-amber-300 mt-1">{v.help_message}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Document Preview Links */}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {v.document_front_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setImagePreviewUrl(v.document_front_url)}
                            className="text-xs"
                          >
                            <Image className="h-3 w-3 mr-1" />
                            Front
                          </Button>
                        )}
                        {v.document_back_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setImagePreviewUrl(v.document_back_url)}
                            className="text-xs"
                          >
                            <Image className="h-3 w-3 mr-1" />
                            Back
                          </Button>
                        )}
                        {v.selfie_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setImagePreviewUrl(v.selfie_url)}
                            className="text-xs"
                          >
                            <Image className="h-3 w-3 mr-1" />
                            Selfie
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      {/* Edit Button - Always available */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-slate-600 border-slate-500/50 hover:bg-slate-500/10"
                        onClick={() => openEditDialog(v)}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      {v.status === 'needs_help' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-blue-600 border-blue-500/50 hover:bg-blue-500/10"
                          onClick={() => {
                            setSelectedVerification(v);
                            setReviewAction('respond');
                            setReviewDialogOpen(true);
                          }}
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Respond
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-500/50 hover:bg-green-500/10"
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
                        variant="outline"
                        className="text-red-600 border-red-500/50 hover:bg-red-500/10"
                        onClick={() => {
                          setSelectedVerification(v);
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

      {/* Processed Verifications */}
      <Card>
        <CardHeader>
          <CardTitle>Processed Verifications ({processedVerifications.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reviewed By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedVerifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No processed verifications yet
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
                    <TableCell>{DOC_TYPE_LABELS[v.document_type] || v.document_type}</TableCell>
                    <TableCell>{v.country || '-'}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[v.status?.toUpperCase()] || ''}>
                        {STATUS_LABELS[v.status] || v.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.reviewed_by || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(v.reviewed_at || v.created_date)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setSelectedVerification(v);
                            setReviewAction('changeStatus');
                            setReviewDialogOpen(true);
                          }}
                          title="Change Status"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                          onClick={() => handleDeleteVerification(v.id)}
                          title="Delete"
                        >
                          <XCircle className="h-4 w-4" />
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

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve Verification' : 
               reviewAction === 'reject' ? 'Reject Verification' : 
               reviewAction === 'changeStatus' ? 'Change Verification Status' :
               'Respond to Help Request'}
            </DialogTitle>
            <DialogDescription>
              {selectedVerification?.full_name} ({selectedVerification?.user_email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedVerification && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p><strong>Document:</strong> {DOC_TYPE_LABELS[selectedVerification.document_type]}</p>
                <p><strong>Country:</strong> {selectedVerification.country || '-'}</p>
                {selectedVerification.help_message && (
                  <div className="mt-2 p-2 bg-amber-100 dark:bg-amber-900/30 rounded">
                    <p className="text-xs font-medium text-amber-700">Help Request:</p>
                    <p className="text-sm">{selectedVerification.help_message}</p>
                  </div>
                )}
              </div>
            )}
            
            {reviewAction === 'reject' && (
              <div>
                <Label>Rejection Reason</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a reason for rejection..."
                  className="mt-1"
                />
              </div>
            )}
            
            {reviewAction === 'respond' && (
              <div>
                <Label>Your Response</Label>
                <Textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  placeholder="Type your response to help the user..."
                  className="mt-1"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
            {reviewAction === 'changeStatus' ? (
              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={() => handleChangeStatus('approved')}
                  disabled={processing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Verified
                </Button>
                <Button 
                  onClick={() => handleChangeStatus('rejected')}
                  disabled={processing}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Rejected
                </Button>
                <Button 
                  onClick={() => handleChangeStatus('pending')}
                  disabled={processing}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  Pending
                </Button>
                <Button 
                  onClick={() => handleChangeStatus('under_review')}
                  disabled={processing}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Under Review
                </Button>
              </div>
            ) : (
              <Button 
                onClick={handleReview}
                disabled={processing || (reviewAction === 'reject' && !rejectionReason) || (reviewAction === 'respond' && !adminResponse)}
                className={reviewAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 
                          reviewAction === 'reject' ? 'bg-red-600 hover:bg-red-700' : 
                          'bg-blue-600 hover:bg-blue-700'}
              >
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {reviewAction === 'approve' ? 'Approve' : reviewAction === 'reject' ? 'Reject' : 'Send Response'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Details Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Verification Details</DialogTitle>
            <DialogDescription>
              Update user verification information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                placeholder="Full name as on ID"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Date of Birth</Label>
              <Input
                type="text"
                value={editForm.date_of_birth}
                onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                placeholder="YYYY-MM-DD"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Country</Label>
              <Input
                value={editForm.country}
                onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                placeholder="Country of residence"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Document Type</Label>
              <Select 
                value={editForm.document_type} 
                onValueChange={(val) => setEditForm({ ...editForm, document_type: val })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passport">Passport</SelectItem>
                  <SelectItem value="national_id">National ID</SelectItem>
                  <SelectItem value="drivers_license">Driver's License</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleEditDetails}
              disabled={processing || !editForm.full_name}
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!imagePreviewUrl} onOpenChange={() => setImagePreviewUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
          </DialogHeader>
          {imagePreviewUrl && (
            <div className="flex justify-center">
              <img src={imagePreviewUrl} alt="Document" className="max-h-[70vh] object-contain rounded-lg" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImagePreviewUrl(null)}>Close</Button>
            <Button asChild>
              <a href={imagePreviewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Full Size
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Account Requests Tab Component
function AccountRequestsTab({ requests, users, poolAccounts, onRefresh, formatDate }) {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState(null); // 'approve' or 'reject'
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedPoolAccountId, setSelectedPoolAccountId] = useState('');
  const [processing, setProcessing] = useState(false);

  const pendingRequests = requests.filter(r => r.status === 'pending' || r.status === 'under_review');
  const processedRequests = requests.filter(r => r.status !== 'pending' && r.status !== 'under_review');

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
        toast.success('Request approved - Now assign a pool account');
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
      toast.error('Failed to process request: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedRequest || !selectedPoolAccountId) {
      toast.error('Please select a pool account');
      return;
    }
    
    setProcessing(true);
    try {
      // Assign the pool account to the user
      const res = await base44.functions.invoke('okxAdminHub', {
        action: 'assignToUser',
        poolAccountId: selectedPoolAccountId,
        userId: selectedRequest.user_id,
      });
      
      if (res.data?.ok) {
        // Update the request status
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
        toast.error(res.data?.error?.message || 'Failed to assign account');
      }
    } catch (err) {
      toast.error('Failed to assign: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const availablePoolAccounts = poolAccounts.filter(p => p.status === 'AVAILABLE');

  const INCOME_LABELS = {
    under_1000: 'Under $1,000',
    '1000_5000': '$1,000 - $5,000',
    '5000_10000': '$5,000 - $10,000',
    '10000_50000': '$10,000 - $50,000',
    over_50000: 'Over $50,000'
  };

  const DEPOSIT_LABELS = {
    under_500: 'Under $500',
    '500_1000': '$500 - $1,000',
    '1000_5000': '$1,000 - $5,000',
    '5000_10000': '$5,000 - $10,000',
    over_10000: 'Over $10,000'
  };

  const EXPERIENCE_LABELS = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    professional: 'Professional'
  };

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      <Card className={pendingRequests.length > 0 ? 'border-orange-500/50' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Pending Requests ({pendingRequests.length})
          </CardTitle>
          <CardDescription>Review and approve live trading account requests</CardDescription>
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
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{req.user_full_name || 'Unknown'}</span>
                        <Badge className={statusColors[req.status] || ''}>
                          {req.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{req.user_email}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Monthly Income</p>
                          <p className="font-medium">{INCOME_LABELS[req.monthly_income] || req.monthly_income}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Expected Deposit</p>
                          <p className="font-medium">{DEPOSIT_LABELS[req.expected_deposit] || req.expected_deposit}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Experience</p>
                          <p className="font-medium">{EXPERIENCE_LABELS[req.trading_experience] || req.trading_experience}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Requested</p>
                          <p className="font-medium">{formatDate(req.created_date)}</p>
                        </div>
                      </div>
                      {req.previous_platforms && (
                        <p className="text-xs text-muted-foreground">
                          Previous platforms: {req.previous_platforms}
                        </p>
                      )}
                      {req.additional_notes && (
                        <p className="text-xs text-muted-foreground">
                          Notes: {req.additional_notes}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-500/50 hover:bg-green-500/10"
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
                        variant="outline"
                        className="text-red-600 border-red-500/50 hover:bg-red-500/10"
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

      {/* Processed Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Processed Requests ({processedRequests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Income</TableHead>
                <TableHead>Deposit</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reviewed By</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No processed requests yet
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
                    <TableCell className="text-sm">{INCOME_LABELS[req.monthly_income] || req.monthly_income}</TableCell>
                    <TableCell className="text-sm">{DEPOSIT_LABELS[req.expected_deposit] || req.expected_deposit}</TableCell>
                    <TableCell className="text-sm">{EXPERIENCE_LABELS[req.trading_experience] || req.trading_experience}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[req.status] || ''}>
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
              {reviewAction === 'approve' 
                ? 'Approve this live trading account request?' 
                : 'Are you sure you want to reject this request?'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRequest && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p><strong>User:</strong> {selectedRequest.user_full_name} ({selectedRequest.user_email})</p>
                <p><strong>Income:</strong> {INCOME_LABELS[selectedRequest.monthly_income]}</p>
                <p><strong>Expected Deposit:</strong> {DEPOSIT_LABELS[selectedRequest.expected_deposit]}</p>
              </div>
            )}
            
            {reviewAction === 'reject' && (
              <div>
                <Label>Rejection Reason</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a reason for rejection..."
                  className="mt-1"
                />
              </div>
            )}
            
            <div>
              <Label>Admin Notes (optional)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Internal notes..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleReview}
              disabled={processing || (reviewAction === 'reject' && !rejectionReason)}
              className={reviewAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {reviewAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Pool Account Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Pool Account</DialogTitle>
            <DialogDescription>
              Select a pool account to assign to {selectedRequest?.user_full_name || selectedRequest?.user_email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {availablePoolAccounts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p>No available pool accounts</p>
                <p className="text-sm">Add more sub-accounts to the pool first</p>
              </div>
            ) : (
              <div>
                <Label>Select Pool Account</Label>
                <Select value={selectedPoolAccountId} onValueChange={setSelectedPoolAccountId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePoolAccounts.map((pool) => (
                      <SelectItem key={pool.id} value={pool.id}>
                        {pool.subaccountName} - ${pool.lastBalanceUsdt?.toFixed(2) || '0.00'} USDT
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleAssign}
              disabled={processing || !selectedPoolAccountId}
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
  const [accountRequests, setAccountRequests] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [stakingRequests, setStakingRequests] = useState([]);
  const [stakingStats, setStakingStats] = useState({});
  
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
      const [statsRes, poolRes, accountsRes, usersRes, withdrawalsRes, transfersRes, requestsRes, verificationsRes, stakingReqRes, stakingStatsRes] = await Promise.all([
        base44.functions.invoke('okxAdminHub', { action: 'getDashboardStats' }),
        base44.functions.invoke('okxAdminHub', { action: 'listPool' }),
        base44.functions.invoke('okxAdminHub', { action: 'listUserAccounts' }),
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
      if (accountsRes.data?.ok) setUserAccounts(accountsRes.data.data || []);
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
      const res = await base44.functions.invoke('okxAdminHub', {
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
      const res = await base44.functions.invoke('okxAdminHub', {
                    action: 'checkPoolBalance',
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
        base44.functions.invoke('okxAdminHub', { action: 'getPoolAccountDetails', poolAccountId: pool.id }),
                      base44.functions.invoke('okxAdminHub', { action: 'getTransactionHistory', poolAccountId: pool.id, limit: 20 }),
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
      const res = await base44.functions.invoke('okxAdminHub', {
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
      const res = await base44.functions.invoke('okxAdminHub', {
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
      const res = await base44.functions.invoke('okxAdminHub', {
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
          <TabsList className="grid grid-cols-8 w-full max-w-5xl">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="verification" className="relative">
              KYC
              {verifications.filter(v => v.status === 'pending' || v.status === 'needs_help').length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center">
                  {verifications.filter(v => v.status === 'pending' || v.status === 'needs_help').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="requests" className="relative">
              Requests
              {accountRequests.filter(r => r.status === 'pending' || r.status === 'under_review').length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {accountRequests.filter(r => r.status === 'pending' || r.status === 'under_review').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="staking" className="relative">
              Staking
              {stakingRequests.filter(s => s.status === 'PENDING_APPROVAL').length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 text-white text-xs rounded-full flex items-center justify-center">
                  {stakingRequests.filter(s => s.status === 'PENDING_APPROVAL').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="pool">Pool</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
            <TabsTrigger value="transfers">Transfers</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid md:grid-cols-4 gap-4">
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

              {/* KYC Verification Summary */}
              <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-600/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-amber-500" />
                    KYC Verification
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pending</span>
                      <span className="font-medium text-yellow-500">
                        {verifications.filter(v => v.status === 'pending').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Needs Help</span>
                      <span className="font-medium text-amber-500">
                        {verifications.filter(v => v.status === 'needs_help').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Approved</span>
                      <span className="font-medium text-green-500">
                        {verifications.filter(v => v.status === 'approved').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rejected</span>
                      <span className="font-medium text-red-500">
                        {verifications.filter(v => v.status === 'rejected').length}
                      </span>
                    </div>
                  </div>
                  {(verifications.filter(v => v.status === 'pending' || v.status === 'needs_help').length > 0) && (
                    <Button 
                      size="sm" 
                      className="w-full mt-3 bg-amber-600 hover:bg-amber-700" 
                      onClick={() => setActiveTab('verification')}
                    >
                      Review KYC
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Account Requests Summary */}
              <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-orange-600/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-orange-500" />
                    Account Requests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pending</span>
                      <span className="font-medium text-yellow-500">
                        {accountRequests.filter(r => r.status === 'pending').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Under Review</span>
                      <span className="font-medium text-blue-500">
                        {accountRequests.filter(r => r.status === 'under_review').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Approved</span>
                      <span className="font-medium text-green-500">
                        {accountRequests.filter(r => r.status === 'approved' || r.status === 'assigned').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rejected</span>
                      <span className="font-medium text-red-500">
                        {accountRequests.filter(r => r.status === 'rejected').length}
                      </span>
                    </div>
                  </div>
                  {accountRequests.filter(r => r.status === 'pending').length > 0 && (
                    <Button 
                      size="sm" 
                      className="w-full mt-3" 
                      onClick={() => setActiveTab('requests')}
                    >
                      Review Pending Requests
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Withdrawal Stats */}
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
          
          {/* Verification Tab */}
          <TabsContent value="verification">
            <VerificationTab
              verifications={verifications}
              onRefresh={loadDashboard}
              formatDate={formatDate}
            />
          </TabsContent>

          {/* Account Requests Tab */}
          <TabsContent value="requests">
            <AccountRequestsTab 
              requests={accountRequests}
              users={users}
              poolAccounts={poolAccounts}
              onRefresh={loadDashboard}
              formatDate={formatDate}
            />
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
                <CardDescription>Internal transfers (funding ↔ trading) across all users</CardDescription>
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
                      <TableHead>Trans ID</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No transfers yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      transfers.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-sm">
                            {users.find(u => u.id === t.userId)?.email || t.userId?.substring(0, 8) || 'ADMIN'}
                          </TableCell>
                          <TableCell className="capitalize">{t.fromAccountType || t.fromAccount}</TableCell>
                          <TableCell className="capitalize">{t.toAccountType || t.toAccount}</TableCell>
                          <TableCell className="font-mono">{formatUsdt(t.amount)} {t.currency}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[t.status] || ''}>
                              {t.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground max-w-[100px] truncate">
                            {t.externalTransferId || '-'}
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