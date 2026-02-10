import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, RefreshCw, Search, Zap, Settings, Save } from "lucide-react";

export default function AutoAcceptAdminTab() {
  const [settings, setSettings] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all, enabled, disabled
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingSettings, setEditingSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsRes, usersRes] = await Promise.all([
        base44.entities.CopyTradingSettings.list("-updated_at", 250),
        base44.functions.invoke("okxAdminHub", { action: "listUsers" }),
      ]);
      setSettings(settingsRes || []);
      if (usersRes.data?.ok) setUsers(usersRes.data.data || []);
    } catch (e) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Merge settings with user data
  const rows = useMemo(() => {
    const userMap = {};
    for (const u of users) {
      userMap[u.id] = u;
    }

    // Create a row for each user that has settings
    const settingsMap = {};
    for (const s of settings) {
      settingsMap[s.user_id] = s;
    }

    // All users with their settings (or null)
    const allRows = users.map(u => ({
      user: u,
      settings: settingsMap[u.id] || null,
      autoEnabled: settingsMap[u.id]?.auto_enabled || false,
    }));

    // Filter
    let filtered = allRows;
    if (filter === "enabled") filtered = allRows.filter(r => r.autoEnabled);
    if (filter === "disabled") filtered = allRows.filter(r => !r.autoEnabled);

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(r =>
        (r.user.email || "").toLowerCase().includes(q) ||
        (r.user.fullName || "").toLowerCase().includes(q)
      );
    }

    // Sort: enabled first, then alphabetical
    filtered.sort((a, b) => {
      if (a.autoEnabled && !b.autoEnabled) return -1;
      if (!a.autoEnabled && b.autoEnabled) return 1;
      return (a.user.email || "").localeCompare(b.user.email || "");
    });

    return filtered;
  }, [settings, users, filter, searchQuery]);

  const enabledCount = settings.filter(s => s.auto_enabled).length;

  const openEditDialog = (row) => {
    setEditingUser(row.user);
    setEditingSettings(row.settings ? { ...row.settings } : {
      user_id: row.user.id,
      auto_enabled: false,
      mode: "FIXED_MARGIN",
      fixed_margin_usdt: 5,
      risk_percent_equity: 1,
      leverage_mode: "FOLLOW_SIGNAL_CAP",
      fixed_leverage: 5,
      max_leverage: 20,
      max_margin_per_trade_usdt: 50,
      max_open_positions_total: 5,
      signal_expiry_seconds: 180,
      max_entry_deviation_percent: 0.3,
    });
    setOverrideReason("");
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingSettings || !editingUser) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payload = {
        user_id: editingUser.id,
        auto_enabled: editingSettings.auto_enabled,
        mode: editingSettings.mode,
        fixed_margin_usdt: Number(editingSettings.fixed_margin_usdt) || 5,
        risk_percent_equity: Number(editingSettings.risk_percent_equity) || 1,
        leverage_mode: editingSettings.leverage_mode,
        fixed_leverage: Number(editingSettings.fixed_leverage) || 5,
        max_leverage: Number(editingSettings.max_leverage) || 20,
        max_margin_per_trade_usdt: Number(editingSettings.max_margin_per_trade_usdt) || 50,
        max_open_positions_total: Number(editingSettings.max_open_positions_total) || 5,
        signal_expiry_seconds: Number(editingSettings.signal_expiry_seconds) || 180,
        max_entry_deviation_percent: Number(editingSettings.max_entry_deviation_percent) || 0.3,
        updated_at: now,
      };

      // Find existing record
      const existing = settings.find(s => s.user_id === editingUser.id);
      if (existing?.id) {
        await base44.entities.CopyTradingSettings.update(existing.id, payload);
      } else {
        payload.created_at = now;
        await base44.entities.CopyTradingSettings.create(payload);
      }

      // Log to audit if there was a reason
      if (overrideReason.trim()) {
        try {
          await base44.entities.EntitlementAuditLog.create({
            user_id: editingUser.id,
            action: "ADMIN_AUTO_ACCEPT_OVERRIDE",
            details: JSON.stringify({
              auto_enabled: payload.auto_enabled,
              reason: overrideReason.trim(),
              settings_snapshot: payload,
            }),
            performed_by: "admin",
            created_at: now,
          });
        } catch (e) {
          console.error("Failed to write audit log:", e);
        }
      }

      toast.success("Settings saved for " + editingUser.email);
      setEditDialogOpen(false);
      loadData();
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Auto-Accept Settings</h3>
          <p className="text-sm text-muted-foreground">
            {enabledCount} user{enabledCount !== 1 ? "s" : ""} with auto-accept enabled
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="enabled">Enabled Only</SelectItem>
            <SelectItem value="disabled">Disabled Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Auto-Accept</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Margin</TableHead>
                  <TableHead>Max Lev</TableHead>
                  <TableHead>Max Pos</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No users found</TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.user.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{row.user.fullName || "—"}</p>
                          <p className="text-xs text-muted-foreground truncate">{row.user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.autoEnabled ? (
                          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                            <Zap className="h-3 w-3 mr-1 fill-blue-500" /> ON
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground">OFF</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{row.settings?.mode || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.settings?.mode === "FIXED_MARGIN" ? `${row.settings.fixed_margin_usdt} USDT` : row.settings?.mode === "RISK_BY_SL" ? `${row.settings.risk_percent_equity}%` : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.settings?.max_leverage ? `${row.settings.max_leverage}x` : "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{row.settings?.max_open_positions_total ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.settings?.updated_at ? new Date(row.settings.updated_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEditDialog(row)}>
                          <Settings className="h-3 w-3 mr-1" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Auto-Accept — {editingUser?.email}</DialogTitle>
            <DialogDescription>Configure auto-accept settings for this user</DialogDescription>
          </DialogHeader>

          {editingSettings && (
            <div className="space-y-5 py-2">
              {/* Toggle */}
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Zap className={`h-5 w-5 ${editingSettings.auto_enabled ? "text-blue-600 fill-blue-600" : "text-muted-foreground"}`} />
                  <span className="font-semibold">Auto-Accept</span>
                </div>
                <Switch
                  checked={editingSettings.auto_enabled}
                  onCheckedChange={(v) => setEditingSettings({ ...editingSettings, auto_enabled: v })}
                />
              </div>

              {/* Mode */}
              <div className="space-y-2">
                <Label>Sizing Mode</Label>
                <Select value={editingSettings.mode} onValueChange={(v) => setEditingSettings({ ...editingSettings, mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED_MARGIN">Fixed Margin</SelectItem>
                    <SelectItem value="RISK_BY_SL">Risk % (by SL)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editingSettings.mode === "FIXED_MARGIN" ? (
                <div className="space-y-2">
                  <Label>Margin Amount (USDT)</Label>
                  <Input type="number" value={editingSettings.fixed_margin_usdt} onChange={(e) => setEditingSettings({ ...editingSettings, fixed_margin_usdt: Number(e.target.value) })} />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Risk % of Balance</Label>
                  <div className="flex items-center gap-3">
                    <Slider value={[editingSettings.risk_percent_equity]} min={0.1} max={5} step={0.1} onValueChange={(v) => setEditingSettings({ ...editingSettings, risk_percent_equity: v[0] })} className="flex-1" />
                    <span className="w-12 text-right font-mono text-sm">{editingSettings.risk_percent_equity}%</span>
                  </div>
                </div>
              )}

              {/* Leverage */}
              <div className="space-y-2">
                <Label>Leverage Mode</Label>
                <Select value={editingSettings.leverage_mode} onValueChange={(v) => setEditingSettings({ ...editingSettings, leverage_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FOLLOW_SIGNAL_CAP">Follow Signal (Capped)</SelectItem>
                    <SelectItem value="FIXED">Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editingSettings.leverage_mode === "FIXED" && (
                <div className="space-y-2">
                  <Label>Fixed Leverage</Label>
                  <Input type="number" value={editingSettings.fixed_leverage} onChange={(e) => setEditingSettings({ ...editingSettings, fixed_leverage: Number(e.target.value) })} />
                </div>
              )}

              <div className="space-y-2">
                <Label>Max Leverage Cap</Label>
                <div className="flex items-center gap-3">
                  <Slider value={[editingSettings.max_leverage]} min={1} max={20} step={1} onValueChange={(v) => setEditingSettings({ ...editingSettings, max_leverage: v[0] })} className="flex-1" />
                  <span className="w-12 text-right font-mono text-sm">{editingSettings.max_leverage}x</span>
                </div>
              </div>

              {/* Guardrails */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Max Margin/Trade</Label>
                  <Input type="number" value={editingSettings.max_margin_per_trade_usdt} onChange={(e) => setEditingSettings({ ...editingSettings, max_margin_per_trade_usdt: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Open Positions</Label>
                  <Input type="number" value={editingSettings.max_open_positions_total} onChange={(e) => setEditingSettings({ ...editingSettings, max_open_positions_total: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Signal Expiry (sec)</Label>
                  <Input type="number" value={editingSettings.signal_expiry_seconds} onChange={(e) => setEditingSettings({ ...editingSettings, signal_expiry_seconds: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Price Deviation %</Label>
                  <Input type="number" value={editingSettings.max_entry_deviation_percent} onChange={(e) => setEditingSettings({ ...editingSettings, max_entry_deviation_percent: Number(e.target.value) })} />
                </div>
              </div>

              {/* Override reason */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs text-muted-foreground">Admin Override Reason (optional, logged)</Label>
                <Textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Reason for changes..."
                  className="h-16"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}