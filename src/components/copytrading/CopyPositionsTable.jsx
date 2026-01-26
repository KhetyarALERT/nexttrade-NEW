import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function CopyPositionsTable({ refreshTrigger, isMobile = false }) {
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
  
  // Subscribe to live prices for PnL updates
  useEffect(() => {
    if (!positions.length) return;
    
    const symbols = [...new Set(positions.map(p => p.symbol).filter(Boolean))];
    const unsubs = [];
    
    // Fetch initial prices
    symbols.forEach(async (sym) => {
      try {
        const res = await base44.functions.invoke('okxMarketData', { action: 'getTicker', instId: sym });
        if (res.data?.ok && res.data.data?.last) {
          setLivePrices(prev => ({ ...prev, [sym]: res.data.data.last }));
        }
      } catch (e) {}
    });
    
    // Poll for updates every 3 seconds
    const interval = setInterval(() => {
      symbols.forEach(async (sym) => {
        try {
          const res = await base44.functions.invoke('okxMarketData', { action: 'getTicker', instId: sym });
          if (res.data?.ok && res.data.data?.last) {
            setLivePrices(prev => ({ ...prev, [sym]: res.data.data.last }));
          }
        } catch (e) {}
      });
    }, 3000);
    
    return () => {
      clearInterval(interval);
      unsubs.forEach(u => { try { u?.(); } catch {} });
    };
  }, [positions.map(p => p.symbol).join(',')]);

  if (loading && positions.length === 0) {
    return <div className="p-4 text-center text-muted-foreground text-xs">Loading positions...</div>;
  }

  // Mobile List View
  if (isMobile) {
    if (positions.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/5 rounded-lg border border-dashed border-border/50 mx-4">
          <p className="text-sm">No open positions</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 pb-20 p-4">
        {positions.map(pos => (
          <Card key={pos.id} className="p-3 border-l-4 border-l-primary/50">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold">{pos.symbol}</span>
                <Badge variant="outline" className={pos.side === 'LONG' ? 'text-green-500 border-green-500/20' : 'text-red-500 border-red-500/20'}>
                  {pos.side} {pos.leverage}x
                </Badge>
              </div>
              <div className="text-right">
                <div className={pos.pnl_usdt >= 0 ? 'text-green-500 font-mono font-medium' : 'text-red-500 font-mono font-medium'}>
                  {pos.pnl_usdt ? `${pos.pnl_usdt > 0 ? '+' : ''}${pos.pnl_usdt}` : '--'}
                </div>
                <div className="text-[10px] text-muted-foreground">USDT PnL</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground block">Size</span>
                <span className="font-mono">{pos.notional_usdt.toFixed(0)} USDT</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Entry</span>
                <span className="font-mono">{pos.entry_price}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-green-600/80">TP</span>
                <span className="font-mono">{pos.tp1}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-red-600/80">SL</span>
                <span className="font-mono">{pos.stop_loss}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // Desktop Table View
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-background/50 backdrop-blur shrink-0 sticky top-0 z-10">
        <h3 className="text-sm font-semibold">Open Positions</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={loadPositions}>
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 text-xs w-[120px]">Symbol</TableHead>
              <TableHead className="h-8 text-xs w-[80px]">Side</TableHead>
              <TableHead className="h-8 text-xs text-right">Size</TableHead>
              <TableHead className="h-8 text-xs text-right">Entry</TableHead>
              <TableHead className="h-8 text-xs text-center w-[100px]">TP/SL</TableHead>
              <TableHead className="h-8 text-xs text-right w-[100px]">PnL (USDT)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                  No open positions
                </TableCell>
              </TableRow>
            ) : (
              positions.map(pos => (
                <TableRow key={pos.id} className="text-xs">
                  <TableCell className="font-medium">{pos.symbol}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`px-1.5 py-0 text-[10px] h-5 border-0 ${pos.side === 'LONG' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {pos.side} {pos.leverage}x
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{pos.notional_usdt.toFixed(0)}</TableCell>
                  <TableCell className="text-right font-mono">{pos.entry_price}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col text-[10px] leading-tight">
                      <span className="text-green-500">{pos.tp1}</span>
                      <span className="text-red-500">{pos.stop_loss}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={pos.pnl_usdt >= 0 ? 'text-green-500' : 'text-red-500'}>
                      {pos.pnl_usdt ? `${pos.pnl_usdt > 0 ? '+' : ''}${pos.pnl_usdt}` : '--'}
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