import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Plus, Ban, Radio, RefreshCw } from 'lucide-react';

export default function SignalsAdminTab({ onRefresh }) {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // New Signal Form State
  const [formData, setFormData] = useState({
    symbol: 'BTC-USDT-SWAP',
    side: 'LONG',
    entry_type: 'MARKET',
    entry_price: '',
    stop_loss: '',
    tp1: '',
    tp2: '',
    notes: ''
  });

  const loadSignals = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('copyTradingAdmin', { 
        action: 'listSignals',
        limit: 50
      });
      if (res.data?.ok) {
        setSignals(res.data.data || []);
      }
    } catch (err) {
      toast.error('Failed to load signals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSignals();
  }, []);

  const handleCreate = async () => {
    if (!formData.symbol || !formData.entry_price || !formData.stop_loss) {
      toast.error('Please fill required fields (Symbol, Entry, SL)');
      return;
    }

    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('copyTradingAdmin', {
        action: 'createSignal',
        signal: {
          ...formData,
          symbol: formData.symbol.toUpperCase(),
          entry_price: Number(formData.entry_price),
          stop_loss: Number(formData.stop_loss),
          tp1: formData.tp1 ? Number(formData.tp1) : 0,
          tp2: formData.tp2 ? Number(formData.tp2) : 0,
        }
      });

      if (res.data?.ok) {
        toast.success('Signal created successfully');
        setCreateDialogOpen(false);
        loadSignals();
        // Reset form
        setFormData({
          symbol: 'BTC-USDT-SWAP',
          side: 'LONG',
          entry_type: 'MARKET',
          entry_price: '',
          stop_loss: '',
          tp1: '',
          tp2: '',
          notes: ''
        });
      } else {
        toast.error(res.data?.error?.message || 'Failed to create signal');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExpire = async (signalId) => {
    try {
      const res = await base44.functions.invoke('copyTradingAdmin', {
        action: 'expireSignal',
        signalId
      });
      if (res.data?.ok) {
        toast.success('Signal expired');
        loadSignals();
      }
    } catch (err) {
      toast.error('Failed to expire signal');
    }
  };

  const statusColors = {
    ACTIVE: 'bg-green-500/10 text-green-500 border-green-500/20',
    EXPIRED: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    CANCELED: 'bg-red-500/10 text-red-500 border-red-500/20'
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Signals Management</CardTitle>
            <CardDescription>Create and manage trading signals</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadSignals} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Signal
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>TP/SL</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No signals found
                  </TableCell>
                </TableRow>
              ) : (
                signals.map((signal) => (
                  <TableRow key={signal.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(signal.published_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium">{signal.symbol}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={signal.side === 'LONG' ? 'text-green-500 border-green-500/30' : 'text-red-500 border-red-500/30'}>
                        {signal.side}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{signal.entry_type}</TableCell>
                    <TableCell className="font-mono text-xs">{signal.entry_price}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="text-green-500">TP: {signal.tp1}</div>
                      <div className="text-red-500">SL: {signal.stop_loss}</div>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{signal.source}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[signal.status] || ''}>
                        {signal.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {signal.status === 'ACTIVE' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10"
                          onClick={() => handleExpire(signal.id)}
                          title="Expire Signal"
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Signal Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Manual Signal</DialogTitle>
            <DialogDescription>Publish a new signal to all eligible users</DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Symbol</Label>
                <Input 
                  value={formData.symbol} 
                  onChange={(e) => setFormData({...formData, symbol: e.target.value})}
                  placeholder="e.g. BTC-USDT-SWAP"
                />
              </div>
              <div className="space-y-2">
                <Label>Side</Label>
                <Select value={formData.side} onValueChange={(v) => setFormData({...formData, side: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LONG">Long</SelectItem>
                    <SelectItem value="SHORT">Short</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entry Price</Label>
                <Input 
                  type="number" 
                  value={formData.entry_price} 
                  onChange={(e) => setFormData({...formData, entry_price: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Stop Loss</Label>
                <Input 
                  type="number" 
                  value={formData.stop_loss} 
                  onChange={(e) => setFormData({...formData, stop_loss: e.target.value})}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Take Profit 1</Label>
                <Input 
                  type="number" 
                  value={formData.tp1} 
                  onChange={(e) => setFormData({...formData, tp1: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Take Profit 2 (Optional)</Label>
                <Input 
                  type="number" 
                  value={formData.tp2} 
                  onChange={(e) => setFormData({...formData, tp2: e.target.value})}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea 
                value={formData.notes} 
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Optional analysis or instructions..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Publish Signal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}