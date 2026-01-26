import React, { useState, useEffect } from 'react';
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
import { Plus, Radio, ArrowUpRight, ArrowDownRight, Clock, Ban, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

export default function SignalsAdminTab({ onRefresh }) {
  const [signals, setSignals] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, accepted: 0 });
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [newSignal, setNewSignal] = useState({
    symbol: 'BTC-USDT-SWAP',
    side: 'LONG',
    entry_type: 'MARKET',
    entry_price: '',
    stop_loss: '',
    tp1: '',
    tp2: '',
    notes: ''
  });

  const [livePrice, setLivePrice] = useState(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);

  // Popular OKX Perpetual Swaps
  const POPULAR_SYMBOLS = [
    "BTC-USDT-SWAP",
    "ETH-USDT-SWAP",
    "SOL-USDT-SWAP",
    "XRP-USDT-SWAP",
    "DOGE-USDT-SWAP",
    "ADA-USDT-SWAP",
    "AVAX-USDT-SWAP",
    "DOT-USDT-SWAP",
    "MATIC-USDT-SWAP",
    "LINK-USDT-SWAP",
    "LTC-USDT-SWAP",
    "SHIB-USDT-SWAP",
    "TRX-USDT-SWAP",
    "UNI-USDT-SWAP",
    "ATOM-USDT-SWAP",
    "ETC-USDT-SWAP",
    "FIL-USDT-SWAP",
    "NEAR-USDT-SWAP",
    "ALGO-USDT-SWAP",
    "APE-USDT-SWAP"
  ];

  const fetchLivePrice = async (instId) => {
    setFetchingPrice(true);
    try {
      // Use OKX public API via proxy or direct if CORS allows (it usually doesn't). 
      // Using existing backend function if available or just a public aggregation.
      // Better: use the market data function available in the project.
      const res = await base44.functions.invoke("okxMarketData", { action: "getTicker", instId });
      if (res.data?.ok && res.data?.data?.last) {
        setLivePrice(Number(res.data.data.last));
      } else {
        // Fallback or clear
        setLivePrice(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingPrice(false);
    }
  };

  useEffect(() => {
    if (createDialogOpen && newSignal.symbol) {
      fetchLivePrice(newSignal.symbol);
    }
  }, [createDialogOpen, newSignal.symbol]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        base44.functions.invoke('signals', { action: 'listSignals', limit: 50 }),
        base44.functions.invoke('signals', { action: 'getSignalStats' })
      ]);

      if (listRes.data?.ok) setSignals(listRes.data.data || []);
      if (statsRes.data?.ok) setStats(statsRes.data.data || { total: 0, active: 0, expired: 0, accepted: 0 });
    } catch (err) {
      toast.error('Failed to load signals');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!newSignal.symbol || !newSignal.entry_price || !newSignal.stop_loss) {
      toast.error('Missing required fields (Symbol, Entry, SL)');
      return;
    }

    setProcessing(true);
    try {
      const res = await base44.functions.invoke('signals', {
        action: 'createSignal',
        signal: newSignal
      });

      if (res.data?.ok) {
        toast.success('Signal created successfully');
        setCreateDialogOpen(false);
        setNewSignal({
          symbol: 'BTC-USDT',
          side: 'LONG',
          entry_type: 'MARKET',
          entry_price: '',
          stop_loss: '',
          tp1: '',
          tp2: '',
          notes: ''
        });
        loadData();
      } else {
        toast.error(res.data?.error?.message || 'Failed to create signal');
      }
    } catch (err) {
      toast.error('Failed to create signal: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleStatusUpdate = async (signalId, status) => {
    try {
      const res = await base44.functions.invoke('signals', {
        action: 'updateSignalStatus',
        signalId,
        status
      });
      if (res.data?.ok) {
        toast.success(`Signal ${status}`);
        loadData();
      }
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const statusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'EXPIRED': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      case 'CANCELED': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Signals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Now</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Accepted (Total)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.accepted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">{stats.expired}</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Signals Management</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Signal
          </Button>
        </div>
      </div>

      {/* Signals Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>TP/SL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No signals found
                  </TableCell>
                </TableRow>
              ) : (
                signals.map((signal) => (
                  <TableRow key={signal.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(signal.published_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-bold">{signal.symbol}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={signal.side === 'LONG' ? 'text-green-500 border-green-500/20' : 'text-red-500 border-red-500/20'}>
                        {signal.side === 'LONG' ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                        {signal.side}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-mono">{signal.entry_price}</span>
                        <span className="text-[10px] text-muted-foreground">{signal.entry_type}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs font-mono">
                        <span className="text-green-500">TP: {signal.tp1}</span>
                        <span className="text-red-500">SL: {signal.stop_loss}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor(signal.status)}>
                        {signal.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{signal.source}</TableCell>
                    <TableCell className="text-right">
                      {signal.status === 'ACTIVE' && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500" onClick={() => handleStatusUpdate(signal.id, 'EXPIRED')} title="Expire">
                            <Clock className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleStatusUpdate(signal.id, 'CANCELED')} title="Cancel">
                            <Ban className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Manual Signal</DialogTitle>
            <DialogDescription>Publish a new signal to copy trading users</DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Symbol (instId)</Label>
                <div className="relative">
                  <Select 
                    value={newSignal.symbol} 
                    onValueChange={(v) => setNewSignal({...newSignal, symbol: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Symbol" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {POPULAR_SYMBOLS.map(sym => (
                        <SelectItem key={sym} value={sym}>{sym}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {livePrice && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    Live Mark: <span className="font-mono text-emerald-500">${livePrice}</span>
                    {fetchingPrice && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Side</Label>
                <Select value={newSignal.side} onValueChange={(v) => setNewSignal({...newSignal, side: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LONG">LONG</SelectItem>
                    <SelectItem value="SHORT">SHORT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entry Price</Label>
                <Input 
                  type="number" 
                  value={newSignal.entry_price}
                  onChange={(e) => setNewSignal({...newSignal, entry_price: e.target.value})}
                  placeholder="0.00" 
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newSignal.entry_type} onValueChange={(v) => setNewSignal({...newSignal, entry_type: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKET">MARKET</SelectItem>
                    <SelectItem value="LIMIT">LIMIT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label className="text-red-500">Stop Loss</Label>
                <Input 
                  type="number" 
                  value={newSignal.stop_loss}
                  onChange={(e) => setNewSignal({...newSignal, stop_loss: e.target.value})}
                  placeholder="0.00" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-green-500">TP 1</Label>
                <Input 
                  type="number" 
                  value={newSignal.tp1}
                  onChange={(e) => setNewSignal({...newSignal, tp1: e.target.value})}
                  placeholder="0.00" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-green-500">TP 2 (Opt)</Label>
                <Input 
                  type="number" 
                  value={newSignal.tp2}
                  onChange={(e) => setNewSignal({...newSignal, tp2: e.target.value})}
                  placeholder="0.00" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea 
                value={newSignal.notes}
                onChange={(e) => setNewSignal({...newSignal, notes: e.target.value})}
                placeholder="Analysis or comments..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={processing}>
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Publish Signal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}