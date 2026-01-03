import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, RefreshCw, FileText, Pencil, X, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

export default function TradingHistory({ tradingAccountId, currentPrices = {}, onRefresh, onPositionsUpdate }) {
  const [activeTab, setActiveTab] = useState("positions");
  const [positions, setPositions] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [closingId, setClosingId] = useState(null);
  const [editingTrade, setEditingTrade] = useState(null);
  const [editValues, setEditValues] = useState({ tp: "", sl: "" });
  const [showCurrentPairOnly, setShowCurrentPairOnly] = useState(false);

  const fetchData = useCallback(async () => {
    if (!tradingAccountId) return;
    setLoading(true);
    try {
      const [posRes, ordersRes, historyRes] = await Promise.all([
        base44.functions.invoke('tradingAccount', { action: 'getOpenPositions' }),
        base44.functions.invoke('tradingAccount', { action: 'getTrades', status: 'PENDING' }),
        base44.functions.invoke('tradingAccount', { action: 'getTrades', status: 'CLOSED', limit: 50 })
      ]);

      if (posRes.data?.success) {
        const newPositions = posRes.data.data || [];
        setPositions(newPositions);
        if (onPositionsUpdate) onPositionsUpdate(newPositions);
      }
      if (ordersRes.data?.success) setOpenOrders(ordersRes.data.data || []);
      if (historyRes.data?.success) setOrderHistory(historyRes.data.data || []);
      if (historyRes.data?.success) setTradeHistory(historyRes.data.data || []);

    } catch (err) {
      console.error("Failed to fetch trading data", err);
    } finally {
      setLoading(false);
    }
  }, [tradingAccountId, onPositionsUpdate]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5s for faster updates
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleClosePosition = async (tradeId, symbol) => {
    const price = currentPrices[symbol];
    if (!price) {
      toast.error("Waiting for price data...");
      return;
    }

    if (!confirm("Confirm closing position at market price?")) return;

    setClosingId(tradeId);
    try {
      const result = await base44.functions.invoke('tradingAccount', {
        action: 'closeTrade',
        tradeId,
        exitPrice: price,
        reason: 'manual'
      });

      if (result.data?.success) {
        toast.success(`Position ${symbol} closed`);
        fetchData();
        if (onRefresh) onRefresh();
      } else {
        toast.error(result.data?.error || "Failed to close position");
      }
    } catch (err) {
      toast.error("Failed to close position");
    } finally {
      setClosingId(null);
    }
  };

  const handleCancelOrder = async (tradeId) => {
    setClosingId(tradeId);
    try {
      const result = await base44.functions.invoke('tradingAccount', {
        action: 'cancelOrder',
        tradeId
      });

      if (result.data?.success) {
        toast.success("Order cancelled");
        fetchData();
        if (onRefresh) onRefresh();
      } else {
        toast.error(result.data?.error || "Failed to cancel order");
      }
    } catch (err) {
      toast.error("Failed to cancel order");
    } finally {
      setClosingId(null);
    }
  };

  const handleUpdateTPSL = async () => {
    if (!editingTrade) return;

    try {
      const result = await base44.functions.invoke('tradingAccount', {
        action: 'updateTrade',
        tradeId: editingTrade.id,
        stopLoss: editValues.sl ? parseFloat(editValues.sl) : null,
        takeProfit: editValues.tp ? parseFloat(editValues.tp) : null
      });

      if (result.data?.success) {
        toast.success("TP/SL updated successfully");
        fetchData();
        setEditingTrade(null);
      } else {
        toast.error(result.data?.error || "Failed to update TP/SL");
      }
    } catch (err) {
      toast.error("Failed to update TP/SL");
    }
  };

  const calculatePnl = (pos) => {
    const currentPrice = currentPrices[pos.symbol];
    if (!currentPrice) return { pnl: 0, roe: 0, markPrice: 0 };

    let pnl = 0;
    if (pos.side === 'LONG') {
      pnl = (currentPrice - pos.entry_price) * pos.quantity;
    } else {
      pnl = (pos.entry_price - currentPrice) * pos.quantity;
    }
    
    const roe = (pnl / pos.margin) * 100;
    return { pnl, roe, markPrice: currentPrice };
  };

  return (
    <div className="flex-1 bg-[#1a1a2e] border-t border-slate-700/50 flex flex-col min-h-[300px]">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 border-b border-slate-700/50 bg-[#131722]">
          <TabsList className="bg-transparent h-10 p-0 gap-6">
            <TabsTrigger 
              value="positions" 
              className="bg-transparent border-b-2 border-transparent data-[state=active]:border-[#2962FF] data-[state=active]:text-white text-slate-400 rounded-none px-0 h-full font-medium text-sm transition-colors hover:text-white"
            >
              Positions ({positions.length})
            </TabsTrigger>
            <TabsTrigger 
              value="open-orders" 
              className="bg-transparent border-b-2 border-transparent data-[state=active]:border-[#2962FF] data-[state=active]:text-white text-slate-400 rounded-none px-0 h-full font-medium text-sm transition-colors hover:text-white"
            >
              Open Orders ({openOrders.length})
            </TabsTrigger>
            <TabsTrigger 
              value="order-history" 
              className="bg-transparent border-b-2 border-transparent data-[state=active]:border-[#2962FF] data-[state=active]:text-white text-slate-400 rounded-none px-0 h-full font-medium text-sm transition-colors hover:text-white"
            >
              Order History
            </TabsTrigger>
            <TabsTrigger 
              value="trade-history" 
              className="bg-transparent border-b-2 border-transparent data-[state=active]:border-[#2962FF] data-[state=active]:text-white text-slate-400 rounded-none px-0 h-full font-medium text-sm transition-colors hover:text-white"
            >
              Trade History
            </TabsTrigger>
            <TabsTrigger 
              value="transaction-history" 
              className="bg-transparent border-b-2 border-transparent data-[state=active]:border-[#2962FF] data-[state=active]:text-white text-slate-400 rounded-none px-0 h-full font-medium text-sm transition-colors hover:text-white"
            >
              Transaction History
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Filter Bar */}
        <div className="px-4 py-2 border-b border-slate-700/30 flex items-center gap-6 bg-[#1a1a2e]">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="current-pair" 
              checked={showCurrentPairOnly} 
              onCheckedChange={setShowCurrentPairOnly}
              className="border-slate-600 data-[state=checked]:bg-[#2962FF] data-[state=checked]:border-[#2962FF]"
            />
            <label
              htmlFor="current-pair"
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-300"
            >
              Current pair
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="voucher-pos" 
              className="border-slate-600 data-[state=checked]:bg-[#2962FF] data-[state=checked]:border-[#2962FF]"
            />
            <label
              htmlFor="voucher-pos"
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-300"
            >
              Voucher positions
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#1a1a2e]">
          <TabsContent value="positions" className="m-0 h-full p-0">
            {positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-500 text-sm">
                <FileText className="w-8 h-8 mb-2 opacity-20" />
                <p>No open positions</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500 uppercase sticky top-0 bg-[#1a1a2e] z-10">
                  <tr className="border-b border-slate-800">
                    <th className="px-4 py-3 font-medium">Futures</th>
                    <th className="px-4 py-3 font-medium">Position/Value</th>
                    <th className="px-4 py-3 font-medium">Unrealized PnL(%)</th>
                    <th className="px-4 py-3 font-medium">Position PnL</th>
                    <th className="px-4 py-3 font-medium">Breakeven price</th>
                    <th className="px-4 py-3 font-medium">Entry Price</th>
                    <th className="px-4 py-3 font-medium">Mark Price</th>
                    <th className="px-4 py-3 font-medium">Est. Liq. Price</th>
                    <th className="px-4 py-3 font-medium">Risk</th>
                    <th className="px-4 py-3 font-medium">Margin</th>
                    <th className="px-4 py-3 font-medium">Position TP/SL</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {positions.map((pos) => {
                    const { pnl, roe, markPrice } = calculatePnl(pos);
                    const positionValue = pos.quantity * markPrice;
                    const marginRatio = positionValue > 0 ? (pos.margin / positionValue) * 100 : 0;
                    
                    return (
                      <tr key={pos.id} className="text-slate-300 hover:bg-[#1f2937]/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{pos.symbol}</span>
                            <Badge variant="outline" className={`text-[10px] h-4 px-1 rounded-sm border-0 ${
                              pos.side === 'LONG' 
                                ? 'bg-emerald-500/10 text-emerald-500' 
                                : 'bg-red-500/10 text-red-500'
                            }`}>
                              {pos.side} {pos.leverage}x
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          <div className={pos.side === 'LONG' ? 'text-emerald-500' : 'text-red-500'}>
                            {pos.quantity.toFixed(4)}
                          </div>
                          <div className="text-slate-500 text-[10px]">${positionValue.toFixed(2)}</div>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          <div className={pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                            {pnl >= 0 ? '+' : ''}{pnl.toFixed(4)} USDT
                          </div>
                          <div className={`text-[10px] ${roe >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {roe >= 0 ? '+' : ''}{roe.toFixed(2)}%
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          <span className={pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                            {pnl >= 0 ? '+' : ''}{pnl.toFixed(4)} USDT
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-400">
                          {pos.entry_price.toFixed(4)}
                        </td>
                        <td className="px-4 py-3 font-mono text-white">
                          {pos.entry_price.toFixed(4)}
                        </td>
                        <td className="px-4 py-3 font-mono text-white">
                          {markPrice.toFixed(4)}
                        </td>
                        <td className="px-4 py-3 font-mono text-amber-500 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {pos.liquidation_price?.toFixed(4) || '-'}
                        </td>
                        <td className="px-4 py-3 font-mono text-emerald-500">
                          {marginRatio.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 font-mono text-white">
                          {pos.margin.toFixed(4)} <FileText className="inline w-3 h-3 ml-1 text-slate-500" />
                        </td>
                        <td className="px-4 py-3 font-mono">
                          <div className="flex flex-col text-[10px] text-slate-400">
                            <span>TP: {pos.take_profit || '--'}</span>
                            <span>SL: {pos.stop_loss || '--'}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 text-[10px] mt-1 text-[#2962FF] hover:text-white px-0"
                            onClick={() => {
                              setEditingTrade(pos);
                              setEditValues({ tp: pos.take_profit || "", sl: pos.stop_loss || "" });
                            }}
                          >
                            <Pencil className="w-3 h-3 mr-1" /> Edit
                          </Button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-[#2B2B43] hover:bg-[#383856] text-white border border-slate-600/50"
                            onClick={() => handleClosePosition(pos.id, pos.symbol)}
                            disabled={closingId === pos.id}
                          >
                            {closingId === pos.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Close'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </TabsContent>

          <TabsContent value="open-orders" className="m-0 h-full p-0">
            {openOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-500 text-sm">
                <FileText className="w-8 h-8 mb-2 opacity-20" />
                <p>No open orders</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500 uppercase sticky top-0 bg-[#1a1a2e] z-10">
                  <tr className="border-b border-slate-800">
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Symbol</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Side</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Filled</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {openOrders.map((order) => (
                    <tr key={order.id} className="text-slate-300 hover:bg-[#1f2937]/50">
                      <td className="px-4 py-3 text-slate-500">{format(new Date(order.created_date), 'MM-dd HH:mm:ss')}</td>
                      <td className="px-4 py-3 font-bold text-white">{order.symbol}</td>
                      <td className="px-4 py-3">{order.order_type}</td>
                      <td className={`px-4 py-3 ${order.side === 'LONG' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {order.side}
                      </td>
                      <td className="px-4 py-3 font-mono">${order.limit_price || 'Market'}</td>
                      <td className="px-4 py-3 font-mono">{order.quantity}</td>
                      <td className="px-4 py-3 font-mono">0.00</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-red-500 hover:bg-red-950/30 hover:text-red-400"
                          onClick={() => handleCancelOrder(order.id)}
                          disabled={closingId === order.id}
                        >
                          Cancel
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabsContent>
          
          <TabsContent value="order-history" className="m-0 h-full p-0">
             <div className="flex flex-col items-center justify-center h-32 text-slate-500 text-sm">
                <p>No order history</p>
             </div>
          </TabsContent>

          <TabsContent value="trade-history" className="m-0 h-full p-0">
             <div className="flex flex-col items-center justify-center h-32 text-slate-500 text-sm">
                <p>No trade history</p>
             </div>
          </TabsContent>

          <TabsContent value="transaction-history" className="m-0 h-full p-0">
             <div className="flex flex-col items-center justify-center h-32 text-slate-500 text-sm">
                <p>No transaction history</p>
             </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* TP/SL Edit Dialog */}
      <Dialog open={!!editingTrade} onOpenChange={(open) => !open && setEditingTrade(null)}>
        <DialogContent className="bg-[#1E222D] border-[#2B2B43] text-white sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Edit TP/SL for {editingTrade?.symbol}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="tp" className="text-slate-400">Take Profit</Label>
              <Input
                id="tp"
                type="number"
                value={editValues.tp}
                onChange={(e) => setEditValues({ ...editValues, tp: e.target.value })}
                className="bg-[#131722] border-[#2B2B43] text-white"
                placeholder="Enter TP price"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sl" className="text-slate-400">Stop Loss</Label>
              <Input
                id="sl"
                type="number"
                value={editValues.sl}
                onChange={(e) => setEditValues({ ...editValues, sl: e.target.value })}
                className="bg-[#131722] border-[#2B2B43] text-white"
                placeholder="Enter SL price"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTrade(null)} className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white">
              Cancel
            </Button>
            <Button onClick={handleUpdateTPSL} className="bg-[#2962FF] hover:bg-[#2962FF]/90 text-white">
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

TradingHistory.propTypes = {
  tradingAccountId: PropTypes.string,
  currentPrices: PropTypes.object,
  onRefresh: PropTypes.func,
  onPositionsUpdate: PropTypes.func
};