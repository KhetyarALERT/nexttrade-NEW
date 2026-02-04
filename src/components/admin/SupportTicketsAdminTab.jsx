import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RefreshCw, MessageSquare, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const statusColors = {
  open: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  in_progress: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  closed: "bg-green-500/10 text-green-600 border-green-500/20",
};

const priorityColors = {
  low: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  normal: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  high: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function SupportTicketsAdminTab({ onRefresh }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [adminResponse, setAdminResponse] = useState("");
  const [newStatus, setNewStatus] = useState("in_progress");
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const result = await base44.entities.SupportTicket.list("-created_date", 100);
      setTickets(result || []);
    } catch (err) {
      console.error("Failed to load tickets:", err);
      toast.error("Failed to load support tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
  };

  const handleOpenResponse = (ticket) => {
    setSelectedTicket(ticket);
    setAdminResponse(ticket.admin_response || "");
    setNewStatus(ticket.status === "open" ? "in_progress" : ticket.status);
    setResponseDialogOpen(true);
  };

  const handleSubmitResponse = async () => {
    if (!selectedTicket) return;
    setSubmitting(true);
    try {
      const updateData = {
        admin_response: adminResponse,
        status: newStatus,
      };
      if (newStatus === "closed") {
        updateData.resolved_at = new Date().toISOString();
      }
      await base44.entities.SupportTicket.update(selectedTicket.id, updateData);
      
      // Notify user via email
      try {
        await base44.functions.invoke("notifyTicketUpdate", { ticket_id: selectedTicket.id });
      } catch (notifyErr) {
        console.error("Failed to send notification:", notifyErr);
        // Don't fail the whole operation
      }
      
      toast.success("Ticket updated and user notified");
      setResponseDialogOpen(false);
      loadTickets();
      onRefresh?.();
    } catch (err) {
      console.error("Failed to update ticket:", err);
      toast.error("Failed to update ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Support Tickets</h2>
          <Badge variant="outline" className={statusColors.open}>
            {openCount} Open
          </Badge>
          <Badge variant="outline" className={statusColors.in_progress}>
            {inProgressCount} In Progress
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={loadTickets} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mb-2" />
              <p>No support tickets</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id} className={ticket.status === "open" ? "bg-amber-500/5" : ""}>
                    <TableCell>
                      <div className="max-w-[150px]">
                        <p className="text-sm font-medium truncate">{ticket.user_email || "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">{ticket.user_id?.slice(0, 8)}...</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {ticket.category || "general"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm max-w-[180px] truncate" title={ticket.message}>{ticket.message}</p>
                    </TableCell>
                    <TableCell>
                      {ticket.source_route || ticket.page_route ? (
                        <code className="text-xs text-muted-foreground">{ticket.source_route || ticket.page_route}</code>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {ticket.topic_route ? (
                        <a 
                          href={ticket.topic_route} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          {ticket.topic_route}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={priorityColors[ticket.priority] || priorityColors.normal}>
                        {ticket.priority || "normal"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[ticket.status] || statusColors.open}>
                        {ticket.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(ticket.created_date)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => handleOpenResponse(ticket)}>
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Response Dialog - Redesigned for clarity */}
      <Dialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-3">
                Ticket #{selectedTicket?.id?.slice(-6).toUpperCase()}
                <Badge variant="secondary" className="capitalize">
                  {selectedTicket?.category || "general"}
                </Badge>
              </DialogTitle>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogDescription className="text-left">
              <span className="font-medium">{selectedTicket?.user_name || "User"}</span>
              {" · "}
              <span>{selectedTicket?.user_email}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {/* User Message Section */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">User Message</p>
              <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap">
                {selectedTicket?.message}
              </div>
            </div>

            {/* Context Section */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Source Page:</span>
                {selectedTicket?.source_route || selectedTicket?.page_route ? (
                  <a 
                    href={selectedTicket.source_route || selectedTicket.page_route}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-primary hover:underline"
                  >
                    {selectedTicket.source_route || selectedTicket.page_route}
                  </a>
                ) : (
                  <span className="ml-2 text-muted-foreground">Not specified</span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Topic Page:</span>
                {selectedTicket?.topic_route ? (
                  <a 
                    href={selectedTicket.topic_route}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-primary hover:underline"
                  >
                    {selectedTicket.topic_route}
                  </a>
                ) : (
                  <span className="ml-2 text-muted-foreground">Not specified</span>
                )}
              </div>
            </div>
            
            {/* Admin Response Section */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Admin Response</p>
              <Textarea
                value={adminResponse}
                onChange={(e) => setAdminResponse(e.target.value)}
                placeholder="Type your response to the user..."
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                User will be notified by email when you update this ticket.
              </p>
            </div>

            {/* Timestamps */}
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
              <span>Created: {formatDate(selectedTicket?.created_date)}</span>
              {selectedTicket?.resolved_at && (
                <span>Resolved: {formatDate(selectedTicket.resolved_at)}</span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResponseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitResponse} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Update & Notify User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}