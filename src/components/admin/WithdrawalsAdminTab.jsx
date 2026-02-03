import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  RefreshCw,
  Eye,
  Copy,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  MessageSquare,
  ArrowUpFromLine
} from "lucide-react";

const STATUS_COLORS = {
  APPROVED: "bg-emerald-500/20 text-emerald-600",
  FAILED: "bg-red-500/20 text-red-600",
  REJECTED: "bg-orange-500/20 text-orange-600",
  CANCELLED: "bg-muted text-muted-foreground"
};

const STATUS_ICONS = {
  APPROVED: CheckCircle2,
  FAILED: XCircle,
  REJECTED: XCircle,
  CANCELLED: Clock
};

export default function WithdrawalsAdminTab({ language = "en" }) {
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState([]);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    failed: 0,
    totalAmount: 0
  });

  const loadWithdrawals = useCallback(async () => {
    setLoading(true);
    try {
      const params = { action: "adminList", limit: 200 };
      if (statusFilter !== "all") params.status = statusFilter;
      if (networkFilter !== "all") params.network = networkFilter;
      if (sourceFilter) params.sourceAccountType = sourceFilter;
      
      const res = await base44.functions.invoke("ledgerWithdrawal", params);
      
      if (res.data?.ok) {
        let data = res.data.data || [];
        
        // Client-side search filter
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          data = data.filter(w => 
            w.user_email?.toLowerCase().includes(q) ||
            w.reference?.toLowerCase().includes(q) ||
            w.address?.toLowerCase().includes(q)
          );
        }
        
        setWithdrawals(data);
        
        // Calculate stats
        const approved = data.filter(w => w.status === "APPROVED");
        const failed = data.filter(w => w.status === "FAILED");
        setStats({
          total: data.length,
          approved: approved.length,
          failed: failed.length,
          totalAmount: approved.reduce((sum, w) => sum + (w.total_debit || 0), 0)
        });
      }
    } catch (e) {
      console.error("Failed to load withdrawals:", e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, networkFilter, sourceFilter, searchQuery]);

  useEffect(() => {
    loadWithdrawals();
  }, [loadWithdrawals]);

  const openDetail = (withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setNoteInput(withdrawal.admin_note || "");
    setDetailOpen(true);
  };

  const saveNote = async () => {
    if (!selectedWithdrawal) return;
    
    setSavingNote(true);
    try {
      await base44.functions.invoke("ledgerWithdrawal", {
        action: "adminAddNote",
        withdrawalId: selectedWithdrawal.id,
        note: noteInput
      });
      
      // Update local state
      setWithdrawals(prev => prev.map(w => 
        w.id === selectedWithdrawal.id ? { ...w, admin_note: noteInput } : w
      ));
      setSelectedWithdrawal(prev => ({ ...prev, admin_note: noteInput }));
    } catch (e) {
      console.error("Failed to save note:", e);
    } finally {
      setSavingNote(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const formatAddress = (addr) => {
    if (!addr) return "-";
    return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <ArrowUpFromLine className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-500/30" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Withdrawn</p>
                <p className="text-2xl font-bold font-mono">${stats.totalAmount.toFixed(2)}</p>
              </div>
              <span className="text-2xl text-primary/30">$</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              {language === "ar" ? "السحوبات" : "Withdrawals"}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={loadWithdrawals}
              disabled={loading}
              className="rounded-xl"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, reference, address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={networkFilter} onValueChange={setNetworkFilter}>
              <SelectTrigger className="w-full sm:w-32 rounded-xl">
                <SelectValue placeholder="Network" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Networks</SelectItem>
                <SelectItem value="TRC20">TRC20</SelectItem>
                <SelectItem value="ERC20">ERC20</SelectItem>
                <SelectItem value="BEP20">BEP20</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter || "all"} onValueChange={(v) => setSourceFilter(v === "all" ? null : v)}>
              <SelectTrigger className="w-full sm:w-32 rounded-xl">
                <SelectValue placeholder="From" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="FUNDING">Funding</SelectItem>
                <SelectItem value="COPY_TRADING">Copy Trading</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="text-center py-12">
              <ArrowUpFromLine className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No withdrawals found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">User</TableHead>
                    <TableHead className="font-semibold">From</TableHead>
                    <TableHead className="font-semibold text-right">Receive</TableHead>
                    <TableHead className="font-semibold text-right">Fee</TableHead>
                    <TableHead className="font-semibold text-right">Total</TableHead>
                    <TableHead className="font-semibold">Network</TableHead>
                    <TableHead className="font-semibold">Address</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Reference</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((w) => {
                    const StatusIcon = STATUS_ICONS[w.status] || Clock;
                    return (
                      <TableRow key={w.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs">
                          {new Date(w.created_date).toLocaleDateString()}
                          <br />
                          <span className="text-muted-foreground">
                            {new Date(w.created_date).toLocaleTimeString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[120px] truncate text-xs" title={w.user_email}>
                            {w.user_email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${
                            w.source_account_type === 'COPY_TRADING' ? 'border-purple-500/30 text-purple-600' : 'border-blue-500/30 text-blue-600'
                          }`}>
                            {w.source_account_type === 'COPY_TRADING' ? 'Copy' : 'Fund'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {w.amount?.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {w.fee?.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium">
                          {w.total_debit?.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {w.network}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => copyToClipboard(w.address)}
                            className="flex items-center gap-1 text-xs font-mono hover:text-primary"
                            title={w.address}
                          >
                            {formatAddress(w.address)}
                            <Copy className="h-3 w-3" />
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${STATUS_COLORS[w.status]} border-0 text-xs`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {w.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => copyToClipboard(w.reference)}
                            className="text-xs font-mono hover:text-primary flex items-center gap-1"
                          >
                            {w.reference}
                            <Copy className="h-3 w-3" />
                          </button>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetail(w)}
                            className="rounded-lg"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Withdrawal Details
              {selectedWithdrawal && (
                <Badge className={`${STATUS_COLORS[selectedWithdrawal.status]} border-0 ml-2`}>
                  {selectedWithdrawal.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Reference</p>
                  <p className="font-mono">{selectedWithdrawal.reference}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Date</p>
                  <p>{new Date(selectedWithdrawal.created_date).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">User</p>
                  <p className="truncate">{selectedWithdrawal.user_email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Network</p>
                  <p>{selectedWithdrawal.network}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">From Account</p>
                  <Badge variant="outline" className={`text-xs ${
                    selectedWithdrawal.source_account_type === 'COPY_TRADING' ? 'border-purple-500/30 text-purple-600' : 'border-blue-500/30 text-blue-600'
                  }`}>
                    {selectedWithdrawal.source_account_type === 'COPY_TRADING' ? 'Copy Trading' : 'Funding'}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Receive Amount</p>
                  <p className="font-mono font-medium">{selectedWithdrawal.amount?.toFixed(2)} USDT</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Fee</p>
                  <p className="font-mono">{selectedWithdrawal.fee?.toFixed(2)} USDT</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Total Deducted</p>
                  <p className="font-mono font-bold text-lg">{selectedWithdrawal.total_debit?.toFixed(2)} USDT</p>
                </div>
              </div>
              
              <div>
                <p className="text-muted-foreground text-xs mb-1">Destination Address</p>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <p className="font-mono text-xs break-all flex-1">{selectedWithdrawal.address}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(selectedWithdrawal.address)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {selectedWithdrawal.mock_tx_hash && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">TX Hash</p>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <p className="font-mono text-xs break-all flex-1">{selectedWithdrawal.mock_tx_hash}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(selectedWithdrawal.mock_tx_hash)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              
              {selectedWithdrawal.failure_reason && (
                <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                  <p className="text-xs text-red-600 font-medium mb-1">Failure Reason</p>
                  <p className="text-sm text-red-700">{selectedWithdrawal.failure_reason}</p>
                </div>
              )}
              
              <div>
                <p className="text-muted-foreground text-xs mb-1">Balance Snapshot</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-muted rounded-lg">
                    <span className="text-muted-foreground">Before: </span>
                    <span className="font-mono">{selectedWithdrawal.wallet_balance_before?.toFixed(2)}</span>
                  </div>
                  <div className="p-2 bg-muted rounded-lg">
                    <span className="text-muted-foreground">After: </span>
                    <span className="font-mono">{selectedWithdrawal.wallet_balance_after?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              {/* Admin Note */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Admin Note</p>
                </div>
                <Textarea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Add internal note..."
                  className="rounded-xl text-sm"
                  rows={3}
                />
                <div className="flex justify-end mt-2">
                  <Button
                    size="sm"
                    onClick={saveNote}
                    disabled={savingNote}
                    className="rounded-xl"
                  >
                    {savingNote ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Save Note
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

WithdrawalsAdminTab.propTypes = {
  language: PropTypes.string
};