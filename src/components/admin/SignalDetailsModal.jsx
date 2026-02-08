import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, ChevronRight, ChevronDown, X, ArrowUpRight, ArrowDownRight, Info } from "lucide-react";
import { toast } from "sonner";

/**
 * Reuses EstimatedOutcome logic inline (no import needed for admin context).
 * Pure calc: effectiveMargin = min(amount, maxPerTrade), notional = effectiveMargin * leverage,
 * slMovePct = 100 / leverage, tpMovePct = slMovePct * 2, estLoss = effectiveMargin.
 */
function computeEstimate(margin, leverage, maxPerTrade) {
  const rawAmt = Number(margin) || 0;
  const lev = Number(leverage) || 0;
  const cap = Number(maxPerTrade) || Infinity;
  if (rawAmt <= 0 || lev <= 0) return null;
  const effectiveMargin = Math.min(rawAmt, cap);
  const notional = effectiveMargin * lev;
  const slMovePct = 100 / lev;
  const tpMovePct = slMovePct * 2;
  const estLoss = effectiveMargin;
  return { slMovePct, tpMovePct, estLoss, notional, effectiveMargin };
}

function fmt(n, d = 2) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return Number(n).toFixed(d);
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

// Position detail drawer (inline)
function PositionDetailPanel({ position, userSettings, signal, onClose }) {
  if (!position) return null;

  const margin = position.margin ?? (position.notional_usdt && position.leverage ? position.notional_usdt / position.leverage : null);
  const estimate = userSettings
    ? computeEstimate(margin, position.leverage, userSettings.max_margin_per_trade_usdt)
    : null;

  // Compute actual SL/TP distance if signal has prices
  const entry = position.entryPrice || position.entry_price;
  const slDistance = signal?.stop_loss && entry
    ? Math.abs((signal.stop_loss - entry) / entry * 100)
    : null;
  const tpDistance = signal?.tp1 && entry
    ? Math.abs((signal.tp1 - entry) / entry * 100)
    : null;

  // Estimated SL/TP PnL from actual signal prices
  const notional = margin && position.leverage ? margin * position.leverage : null;
  const estSlPnl = slDistance !== null && notional ? -(slDistance / 100) * notional : null;
  const estTpPnl = tpDistance !== null && notional ? (tpDistance / 100) * notional : null;

  return (
    <div className="border-t border-border mt-4 pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Position Details</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground text-xs">Symbol</span>
          <p className="font-medium">{position.symbol}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Side</span>
          <p className="font-medium">
            <Badge variant="outline" className={position.side === "LONG" ? "text-green-500 border-green-500/20" : "text-red-500 border-red-500/20"}>
              {position.side}
            </Badge>
          </p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Leverage</span>
          <p className="font-mono">{position.leverage}x</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Margin</span>
          <p className="font-mono">{fmt(margin)} USDT</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Entry Price</span>
          <p className="font-mono">{fmt(entry)}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Status</span>
          <Badge variant={position.status === "OPEN" ? "default" : "secondary"}>{position.status}</Badge>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Opened</span>
          <p className="text-xs">{formatDate(position.openedAt || position.opened_at)}</p>
        </div>
        {position.status !== "OPEN" && (
          <div>
            <span className="text-muted-foreground text-xs">Closed</span>
            <p className="text-xs">{formatDate(position.closedAt || position.closed_at)}</p>
          </div>
        )}
        <div>
          <span className="text-muted-foreground text-xs">Current PnL</span>
          <p className={`font-mono font-semibold ${(position.pnl ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
            {position.pnl !== null && position.pnl !== undefined ? fmt(position.pnl) + " USDT" : "—"}
          </p>
        </div>
      </div>

      {/* Estimate block - reuse EstimatedOutcome logic */}
      {(estimate || slDistance !== null) && (
        <div className="rounded-lg border border-border/30 bg-muted/20 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            <Info className="w-3 h-3" /> Estimate (from user settings)
          </div>

          {userSettings && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <span>Mode: {userSettings.mode} • Margin: {userSettings.fixed_margin_usdt} USDT • Lev: {userSettings.leverage_mode === "FIXED" ? `${userSettings.fixed_leverage}x fixed` : `Follow signal (cap ${userSettings.max_leverage}x)`}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">SL distance</span>
              <p className="font-mono font-semibold text-rose-500">
                {slDistance !== null ? `~${fmt(slDistance)}%` : estimate ? `~${fmt(estimate.slMovePct)}%` : "—"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">TP distance</span>
              <p className="font-mono font-semibold text-emerald-500">
                {tpDistance !== null ? `~${fmt(tpDistance)}%` : estimate ? `~${fmt(estimate.tpMovePct)}%` : "—"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Est. SL loss</span>
              <p className="font-mono font-semibold text-rose-500">
                {estSlPnl !== null ? `~${fmt(estSlPnl)}` : estimate ? `~-${fmt(estimate.estLoss)}` : "—"} USDT
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Est. TP profit</span>
              <p className="font-mono font-semibold text-emerald-500">
                {estTpPnl !== null ? `~+${fmt(estTpPnl)}` : "—"} USDT
              </p>
            </div>
          </div>
        </div>
      )}

      {!userSettings && (
        <p className="text-xs text-muted-foreground italic">No auto-accept settings found for this user.</p>
      )}
    </div>
  );
}

export default function SignalDetailsModal({ open, onOpenChange, signalId, onForceCloseAll, onForceCloseUser }) {
  const [signalDetails, setSignalDetails] = React.useState(null);
  const [loadingDetails, setLoadingDetails] = React.useState(false);
  const [expandedUsers, setExpandedUsers] = useState({});
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [userSettingsMap, setUserSettingsMap] = useState({});
  const [loadingSettings, setLoadingSettings] = useState({});

  // Load details when opened
  React.useEffect(() => {
    if (!open || !signalId) return;
    setSelectedPosition(null);
    setExpandedUsers({});
    loadDetails();
  }, [open, signalId]);

  const loadDetails = async () => {
    setLoadingDetails(true);
    try {
      const res = await base44.functions.invoke("copyTradingAdmin", { action: "getSignalDetails", signalId });
      if (res.data?.ok) {
        setSignalDetails(res.data.data);
        // Preload settings for all users
        const userIds = [...new Set((res.data.data.rows || []).map(r => r.userId))];
        preloadUserSettings(userIds);
      }
    } catch (e) {
      toast.error("Failed to load details");
    } finally {
      setLoadingDetails(false);
    }
  };

  const preloadUserSettings = async (userIds) => {
    // Batch load all CopyTradingSettings for these users
    try {
      const allSettings = await base44.entities.CopyTradingSettings.list("-updated_at", 250);
      const map = {};
      for (const s of (allSettings || [])) {
        map[s.user_id] = s;
      }
      setUserSettingsMap(map);
    } catch (e) {
      console.error("Failed to load user settings:", e);
    }
  };

  // Group rows by user
  const userGroups = useMemo(() => {
    if (!signalDetails?.rows) return [];
    const groups = {};
    for (const row of signalDetails.rows) {
      const key = row.userId || row.email || "unknown";
      if (!groups[key]) {
        groups[key] = {
          userId: row.userId,
          email: row.email,
          name: row.name,
          positions: [],
          totalMargin: 0,
          totalPnl: 0,
          hasOpen: false,
        };
      }
      const margin = row.margin || 0;
      groups[key].positions.push(row);
      groups[key].totalMargin += margin;
      groups[key].totalPnl += row.pnl || 0;
      if (row.status === "OPEN") groups[key].hasOpen = true;
    }

    // Sort: users with OPEN positions first, then by name
    return Object.values(groups).sort((a, b) => {
      if (a.hasOpen && !b.hasOpen) return -1;
      if (!a.hasOpen && b.hasOpen) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [signalDetails?.rows]);

  const toggleUser = (userId) => {
    setExpandedUsers(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const signal = signalDetails?.signal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Signal Details</DialogTitle>
          <DialogDescription>
            {signal?.symbol} {signal?.side} — Entry: {fmt(signal?.entry_price)} | SL: {fmt(signal?.stop_loss)} | TP: {fmt(signal?.tp1)}
          </DialogDescription>
        </DialogHeader>

        {loadingDetails ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex flex-wrap justify-between items-center bg-muted/20 p-3 rounded-lg gap-3">
              <div className="flex gap-6">
                <div>
                  <span className="text-xs text-muted-foreground">Users</span>
                  <p className="text-xl font-bold">{userGroups.length}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Positions</span>
                  <p className="text-xl font-bold">{signalDetails?.rows?.length || 0}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Open</span>
                  <p className="text-xl font-bold text-green-500">
                    {(signalDetails?.rows || []).filter(r => r.status === "OPEN").length}
                  </p>
                </div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => onForceCloseAll?.(signalId)}>
                Force Close All
              </Button>
            </div>

            {/* Grouped user list */}
            <div className="space-y-1">
              {userGroups.map((group) => {
                const isExpanded = expandedUsers[group.userId];
                return (
                  <Collapsible key={group.userId} open={isExpanded} onOpenChange={() => toggleUser(group.userId)}>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{group.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{group.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Positions</p>
                            <p className="text-sm font-mono">{group.positions.length}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Margin</p>
                            <p className="text-sm font-mono">{fmt(group.totalMargin)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">PnL</p>
                            <p className={`text-sm font-mono font-semibold ${group.totalPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {fmt(group.totalPnl)}
                            </p>
                          </div>
                          {group.hasOpen && (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px]">OPEN</Badge>
                          )}
                        </div>
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="ml-7 mr-2 mb-2 border border-border/50 rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="text-xs">Opened</TableHead>
                              <TableHead className="text-xs">Entry</TableHead>
                              <TableHead className="text-xs">Lev</TableHead>
                              <TableHead className="text-xs">Margin</TableHead>
                              <TableHead className="text-xs">PnL</TableHead>
                              <TableHead className="text-xs">Status</TableHead>
                              <TableHead className="text-xs text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.positions
                              .sort((a, b) => {
                                // OPEN first, then newest
                                if (a.status === "OPEN" && b.status !== "OPEN") return -1;
                                if (a.status !== "OPEN" && b.status === "OPEN") return 1;
                                return new Date(b.openedAt || 0) - new Date(a.openedAt || 0);
                              })
                              .map((pos) => (
                                <TableRow
                                  key={pos.positionId}
                                  className={`cursor-pointer hover:bg-muted/30 ${selectedPosition?.positionId === pos.positionId ? "bg-primary/5" : ""}`}
                                  onClick={() => setSelectedPosition(selectedPosition?.positionId === pos.positionId ? null : pos)}
                                >
                                  <TableCell className="text-xs">{new Date(pos.openedAt).toLocaleString()}</TableCell>
                                  <TableCell className="font-mono text-xs">{fmt(pos.entryPrice)}</TableCell>
                                  <TableCell className="font-mono text-xs">{pos.leverage}x</TableCell>
                                  <TableCell className="font-mono text-xs">{fmt(pos.margin)}</TableCell>
                                  <TableCell className={`font-mono text-xs font-semibold ${(pos.pnl || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                                    {pos.pnl !== null && pos.pnl !== undefined ? fmt(pos.pnl) : "—"}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={pos.status === "OPEN" ? "default" : "secondary"} className="text-[10px]">
                                      {pos.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {pos.status === "OPEN" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[10px]"
                                        onClick={(e) => { e.stopPropagation(); onForceCloseUser?.(pos.userId, signalId); }}
                                      >
                                        Close
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}

              {userGroups.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">No acceptances yet</div>
              )}
            </div>

            {/* Position detail panel */}
            {selectedPosition && (
              <PositionDetailPanel
                position={selectedPosition}
                userSettings={userSettingsMap[selectedPosition.userId]}
                signal={signal}
                onClose={() => setSelectedPosition(null)}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}