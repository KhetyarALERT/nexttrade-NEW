import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ArrowUp, ArrowDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { binanceFuturesStore } from "@/components/trading/binance/binanceFuturesStore";
import { gated } from "@/components/utils/apiGate";

export default function CopyPositionsTable({ refreshTrigger, isMobile = false, onPositionClick, selectedPositionId, language = "en" }) {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [livePrices, setLivePrices] = useState({});
  const isAr = language === "ar";

  const t = {
    size: isAr ? "الحجم" : "Size",
    entry: isAr ? "الدخول" : "Entry",
    tp: "TP",
    sl: "SL",
    noPositions: isAr ? "لا توجد مراكز مفتوحة" : "No open positions",
    pnl: isAr ? "الربح" : "PnL",
    loading: isAr ? "جار التحميل..." : "Loading positions...",
  };

  const loadPositions = async () => {
    setLoading(true);
    try {
      const { gated } = await import("@/components/utils/apiGate");
      const res = await gated("copyTradingUser:getPositions", () => base44.functions.invoke('copyTradingUser', { action: 'getPositions', status: 'OPEN' }), { minIntervalMs: 8000 });
      if (res?.data?.ok) {
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
    
    // Use WebSocket store for live prices instead of polling okxMarketData
    // Fetch initial prices from store
    symbols.forEach((sym) => {
      const ticker = binanceFuturesStore.getTicker(sym);
      if (ticker?.lastPrice) {
        setLivePrices(prev => ({ ...prev, [sym]: Number(ticker.lastPrice) }));
      }
    });
    
    // Subscribe to WebSocket price updates instead of HTTP polling
    symbols.forEach((sym) => {
      const unsub = binanceFuturesStore.subscribe(`price:${sym}`, (price) => {
        if (Number.isFinite(price)) {
          setLivePrices(prev => ({ ...prev, [sym]: price }));
        }
      });
      unsubs.push(unsub);
    });
    
    // Fallback poll only every 30s using gated API (NOT 3s)
    const interval = setInterval(() => {
      if (document.hidden) return;
      symbols.forEach(async (sym) => {
        try {
          const res = await gated(`okxMarketData:ticker:${sym}`, () => base44.functions.invoke('okxMarketData', { action: 'getTicker', instId: sym }), { minIntervalMs: 30000 });
          if (res?.data?.ok && res.data.data?.last) {
            setLivePrices(prev => ({ ...prev, [sym]: res.data.data.last }));
          }
        } catch (e) {}
      });
    }, 30000);
    
    return () => {
      clearInterval(interval);
      unsubs.forEach(u => { try { u?.(); } catch {} });
    };
  }, [positions.map(p => p.symbol).join(',')]);
  
  // Calculate live PnL
  const calculatePnL = (pos) => {
    const currentPrice = livePrices[pos.symbol];
    if (!currentPrice || !pos.entry_price) return { pnl: 0, pnlPct: 0 };
    
    const qty = pos.notional_usdt / pos.entry_price;
    const rawPnl = pos.side === 'LONG' 
      ? (currentPrice - pos.entry_price) * qty
      : (pos.entry_price - currentPrice) * qty;
    
    const margin = pos.notional_usdt / pos.leverage;
    const pnlPct = (rawPnl / margin) * 100;
    
    return { pnl: rawPnl, pnlPct };
  };

  if (loading && positions.length === 0) {
    return <div className="p-6 text-center text-muted-foreground/60 text-xs font-medium">{t.loading}</div>;
  }

  // Mobile List View
  if (isMobile) {
    if (positions.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50 mx-4">
          <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-muted-foreground/30" />
          </div>
          <p className="text-[13px] font-medium text-muted-foreground/60">{t.noPositions}</p>
        </div>
      );
    }

    return (
      <div className="space-y-2.5 pb-20 px-3 py-3" dir={isAr ? "rtl" : "ltr"}>
        {positions.map(pos => {
          const { pnl, pnlPct } = calculatePnL(pos);
          const isProfit = pnl >= 0;
          return (
            <Card 
              key={pos.id} 
              className="p-0 cursor-pointer hover:bg-muted/30 transition-all overflow-hidden rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm active:scale-[0.99]"
              onClick={() => onPositionClick?.(pos)}
            >
              <div className="px-4 py-3">
                <div className="flex justify-between items-center mb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-xl shrink-0 ${pos.side === 'LONG' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                      {pos.side === 'LONG' ? <ArrowUp className="w-4 h-4 text-emerald-500" /> : <ArrowDown className="w-4 h-4 text-rose-500" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-[13px] tracking-tight truncate">{pos.symbol}</span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-[16px] font-bold border-0 rounded-md ${pos.side === 'LONG' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                          {pos.side}
                        </Badge>
                        <span className="text-[10px] font-mono text-muted-foreground/50">{pos.leverage}x</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-mono font-semibold text-[13px] tabular-nums ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isProfit ? '+' : ''}{pnl.toFixed(2)}
                    </div>
                    <div className={`text-[10px] font-mono tabular-nums ${isProfit ? 'text-emerald-500/60' : 'text-rose-500/60'}`}>
                      {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              
                <div className="grid grid-cols-4 gap-2">
                  <div className="min-w-0">
                    <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider font-medium block">{t.size}</span>
                    <span className="font-mono text-[12px] font-medium tabular-nums block truncate">{pos.notional_usdt?.toFixed(0) || '0'}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider font-medium block">{t.entry}</span>
                    <span className="font-mono text-[12px] font-medium tabular-nums block truncate">{pos.entry_price}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] text-emerald-500/50 uppercase tracking-wider font-medium block">{t.tp}</span>
                    <span className="font-mono text-[12px] font-medium tabular-nums block truncate">{pos.tp1 || '—'}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] text-rose-500/50 uppercase tracking-wider font-medium block">{t.sl}</span>
                    <span className="font-mono text-[12px] font-medium tabular-nums block truncate">{pos.stop_loss || '—'}</span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  // Desktop Table View
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-background/80 backdrop-blur-sm shrink-0 sticky top-0 z-10">
        <h3 className="text-[13px] font-semibold tracking-tight">Open Positions</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={loadPositions}>
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border/30">
              <TableHead className="h-8 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/50 w-[120px]">Symbol</TableHead>
              <TableHead className="h-8 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/50 w-[80px]">Side</TableHead>
              <TableHead className="h-8 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/50 text-right">Size</TableHead>
              <TableHead className="h-8 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/50 text-right">Entry</TableHead>
              <TableHead className="h-8 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/50 text-center w-[100px]">TP/SL</TableHead>
              <TableHead className="h-8 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/50 text-right w-[120px]">PnL (USDT)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground/40 text-xs font-medium">
                  No open positions
                </TableCell>
              </TableRow>
            ) : (
              positions.map(pos => {
                const { pnl, pnlPct } = calculatePnL(pos);
                const isProfit = pnl >= 0;
                return (
                  <TableRow 
                    key={pos.id} 
                    className="text-xs cursor-pointer hover:bg-muted/30 transition-colors border-b border-border/20"
                    onClick={() => onPositionClick?.(pos)}
                  >
                    <TableCell className="font-semibold text-[12px] tracking-tight">{pos.symbol}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`px-1.5 py-0 text-[10px] h-[18px] font-bold border-0 rounded-md ${pos.side === 'LONG' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                        {pos.side} {pos.leverage}x
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-[12px] tabular-nums">{pos.notional_usdt.toFixed(0)}</TableCell>
                    <TableCell className="text-right font-mono text-[12px] tabular-nums">{pos.entry_price}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col gap-0.5 text-[10px] font-mono tabular-nums">
                        <span className="text-emerald-500">{pos.tp1}</span>
                        <span className="text-rose-500">{pos.stop_loss}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className={`font-mono font-semibold text-[12px] tabular-nums ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {isProfit ? '+' : ''}{pnl.toFixed(2)}
                        </span>
                        <span className={`font-mono text-[10px] tabular-nums ${isProfit ? 'text-emerald-500/60' : 'text-rose-500/60'}`}>
                          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}