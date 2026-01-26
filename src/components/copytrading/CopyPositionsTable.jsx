import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CopyPositionsTable({ refreshTrigger }) {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadPositions = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('copyTradingUser', { action: 'getPositions', status: 'OPEN' });
      if (res.data?.ok) {
        setPositions(res.data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPositions();
  }, [refreshTrigger]);

  if (loading && positions.length === 0) return <div className="p-4 text-center text-muted-foreground">Loading positions...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Copy Positions (Paper)</h3>
        <Button variant="ghost" size="sm" onClick={loadPositions}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Size (Notional)</TableHead>
              <TableHead>Entry</TableHead>
              <TableHead>TP/SL</TableHead>
              <TableHead>PnL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No open copy positions
                </TableCell>
              </TableRow>
            ) : (
              positions.map(pos => (
                <TableRow key={pos.id}>
                  <TableCell className="font-medium">{pos.symbol}</TableCell>
                  <TableCell>
                    <Badge className={pos.side === 'LONG' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}>
                      {pos.side} {pos.leverage}x
                    </Badge>
                  </TableCell>
                  <TableCell>{pos.notional_usdt.toFixed(2)} USDT</TableCell>
                  <TableCell>{pos.entry_price}</TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <div className="text-green-500">TP: {pos.tp1}</div>
                      <div className="text-red-500">SL: {pos.stop_loss}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={pos.pnl_usdt >= 0 ? 'text-green-500' : 'text-red-500'}>
                      {pos.pnl_usdt ? `${pos.pnl_usdt > 0 ? '+' : ''}${pos.pnl_usdt} USDT` : '--'}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}