import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, RefreshCw, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

export default function TradingHistory({ tradingAccountId, currentPrices = {}, onRefresh }) {
  const [activeTab, setActiveTab] = useState("positions");
  const [positions, setPositions] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [closingId, setClosingId] = useState(null);

  const fetchData = useCallback(async () => {
    if (!tradingAccountId) return;
    setLoading(true);
    try {
      const [posRes, ordersRes, historyRes] = await Promise.all([
        base44.functions.invoke('tradingAccount', { action: 'getOpenPositions' }),
        base44.functions.invoke('tradingAccount', { action: 'getTrades', status: 'PENDING' }),
        base44.functions.invoke('tradingAccount', { action: 'getTrades', status: 'CLOSED', limit: 50 })
      ]);

      if (posRes.data?.success) setPositions(posRes.data.data || []);
      if (ordersRes.data?.success) setOpenOrders(ordersRes.data.data || []);
      if (historyRes.data?.success) setOrderHistory(historyRes.data.data || []);
      // For now, trade history and order history are similar in our simple backend
      if (historyRes.data?.success) setTradeHistory(historyRes.data.data || []);

    } catch (err) {
      console.error("Failed to fetch trading data", err);
    } finally {
      setLoading(false);
    }
  }, [tradingAccountId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleClosePosition = async (tradeId, symbol) => {
    const price = currentPrices[symbol];
    if (!price) {
      toast.error("Waiting for price data...");
      return;
    }

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

  const handleCloseAll = async () => {
    if (!positions.length) return;
    if (!confirm("Are you sure you want to close all positions?")) return;

    for (const pos of positions) {
      await handleClosePosition(pos.id, pos.symbol);
    }
  };

  const calculatePnl = (pos) => {
    const currentPrice = currentPrices[pos.symbol];
    if (!currentPrice) return { pnl: 0, roe: 0 };

    let pnl = 0;
    if (pos.side === 'LONG') {
      pnl = (currentPrice - pos.entry_price) * pos.quantity;
    } else {
      pnl = (pos.entry_price - currentPrice) * pos.quantity;
    }
    
    const roe = (pnl / pos.margin) * 100;
    return { pnl, roe };
  };

  return (
    <div className="flex-1 bg-[#1a1a2e] border-t border-slate-700/50 flex flex-col min-h-[300px]">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 border-b border-slate-700/50">
          <TabsList className="bg-transparent h-12 p-0 gap-6">
            <TabsTrigger 
              value="positions" 
              className="bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-500 text-slate-400 rounded-none px-0 h-full font-medium text-sm"
            >
              Positions ({positions.length})
            </TabsTrigger>
            <TabsTrigger 
              value="open-orders" 
              className="bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-500 text-slate-400 rounded-none px-0 h-full font-medium text-sm"
            >
              Open Orders ({openOrders.length})
            </TabsTrigger>
            <TabsTrigger 
              value="order-history" 
              className="bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-500 text-slate-400 rounded-none px-0 h-full font-medium text-sm"
            >
              Order History
            </TabsTrigger>
            <TabsTrigger 
              value="trade-history" 
              className="bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-500 text-slate-400 rounded-none px-0 h-full font-medium text-sm"
            >
              Trade History
            </TabsTrigger>
            <TabsTrigger 
              value="transactions" 
              className="bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-500 text-slate-400 rounded-none px-0 h-full font-medium text-sm"
            >
              Transaction History
            </TabsTrigger>
            <TabsTrigger 
              value="vouchers" 
              className="bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-500 text-slate-400 rounded-none px-0 h-full font-medium text-sm"
            >
              Voucher Positions
            </TabsTrigger>
          </TabsList>
          
          {activeTab === 'positions' && positions.length > 0 && (
            <Button 
              variant="destructive" 
              size="sm" 
              className="h-7 text-xs"
              onClick={handleCloseAll}
            >
              Close All
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4">
          <TabsContent value="positions" className="m-0 h-full">
            {positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm">
                <p>No open positions</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500 text-xs uppercase sticky top-0 bg-[#1a1a2e]">
                  <tr>
                    <th className="pb-4 font-medium">Symbol</th>
                    <th className="pb-4 font-medium">Size</th>
                    <th className="pb-4 font-medium">Entry Price</th>
                    <th className="pb-4 font-medium">Mark Price</th>
                    <th className="pb-4 font-medium">Liq. Price</th>
                    <th className="pb-4 font-medium">Margin Ratio</th>
                    <th className="pb-4 font-medium">Margin</th>
                    <th className="pb-4 font-medium">PNL (ROE%)</th>
                    <th className="pb-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {positions.map((pos) => {
                    const { pnl, roe } = calculatePnl(pos);
                    const markPrice = currentPrices[pos.symbol] || 0;
                    
                    return (
                      <tr key={pos.id} className="text-slate-300 hover:bg-slate-800/30">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{pos.symbol}</span>
                            <Badge variant="outline" className={`text-[10px] h-4 px-1 ${
                              pos.side === 'LONG' ? 'text-emerald-500 border-emerald-500/30' : 'text-red-500 border-red-500/30'
                            }`}>
                              {pos.side} {pos.leverage}x
                            </Badge>
                          </div>
                        </td>
                        <td className="py-3 font-mono">
                          <div className={pos.side === 'LONG' ? 'text-emerald-500' : 'text-red-500'}>
                            {pos.quantity}
                          </div>
                        </td>
                        <td className="py-3 font-mono">${pos.entry_price.toFixed(4)}</td>
                        <td className="py-3 font-mono">${markPrice.toFixed(4)}</td>
                        <td className="py-3 font-mono text-amber-500">${pos.liquidation_price?.toFixed(4) || '-'}</td>
                        <td className="py-3 font-mono">
                          {((pos.margin / (pos.margin + pnl)) * 100).toFixed(2)}%
                        </td>
                        <td className="py-3 font-mono">${pos.margin.toFixed(2)}</td>
                        <td className="py-3 font-mono">
                          <div className={pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                            <span className="text-xs ml-1 opacity-70">
                              ({pnl >= 0 ? '+' : ''}{roe.toFixed(2)}%)
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs border border-slate-600 hover:bg-slate-700 hover:text-white"
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

          <TabsContent value="open-orders" className="m-0 h-full">
            {openOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm">
                <p>No open orders</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500 text-xs uppercase sticky top-0 bg-[#1a1a2e]">
                  <tr>
                    <th className="pb-4 font-medium">Time</th>
                    <th className="pb-4 font-medium">Symbol</th>
                    <th className="pb-4 font-medium">Type</th>
                    <th className="pb-4 font-medium">Side</th>
                    <th className="pb-4 font-medium">Price</th>
                    <th className="pb-4 font-medium">Amount</th>
                    <th className="pb-4 font-medium">Filled</th>
                    <th className="pb-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {openOrders.map((order) => (
                    <tr key={order.id} className="text-slate-300 hover:bg-slate-800/30">
                      <td className="py-3 text-slate-500">{format(new Date(order.created_date), 'HH:mm:ss')}</td>
                      <td className="py-3 font-bold text-white">{order.symbol}</td>
                      <td className="py-3">{order.order_type}</td>
                      <td className={`py-3 ${order.side === 'LONG' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {order.side}
                      </td>
                      <td className="py-3 font-mono">${order.limit_price || 'Market'}</td>
                      <td className="py-3 font-mono">{order.quantity}</td>
                      <td className="py-3 font-mono">0.00</td>
                      <td className="py-3 text-right">
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

          <TabsContent value="order-history" className="m-0 h-full">
            <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm min-h-[100px]">
              {orderHistory.length === 0 ? "No order history" : (
                <table className="w-full text-left text-sm">
                  <thead className="text-slate-500 text-xs uppercase sticky top-0 bg-[#1a1a2e]">
                    <tr>
                      <th className="pb-4 font-medium">Time</th>
                      <th className="pb-4 font-medium">Symbol</th>
                      <th className="pb-4 font-medium">Side</th>
                      <th className="pb-4 font-medium">Price</th>
                      <th className="pb-4 font-medium">Filled</th>
                      <th className="pb-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {orderHistory.map((order) => (
                      <tr key={order.id} className="text-slate-300 hover:bg-slate-800/30">
                        <td className="py-3 text-slate-500">{format(new Date(order.created_date), 'MM-dd HH:mm')}</td>
                        <td className="py-3 font-bold">{order.symbol}</td>
                        <td className={`py-3 ${order.side === 'LONG' ? 'text-emerald-500' : 'text-red-500'}`}>
                          {order.side}
                        </td>
                        <td className="py-3 font-mono">${order.entry_price?.toFixed(4)}</td>
                        <td className="py-3 font-mono">{order.quantity}</td>
                        <td className="py-3">
                          <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-600">
                            {order.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="trade-history" className="m-0 h-full">
            <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm min-h-[100px]">
              {tradeHistory.length === 0 ? "No trade history" : (
                <table className="w-full text-left text-sm">
                  <thead className="text-slate-500 text-xs uppercase sticky top-0 bg-[#1a1a2e]">
                    <tr>
                      <th className="pb-4 font-medium">Time</th>
                      <th className="pb-4 font-medium">Symbol</th>
                      <th className="pb-4 font-medium">Side</th>
                      <th className="pb-4 font-medium">Entry Price</th>
                      <th className="pb-4 font-medium">Exit Price</th>
                      <th className="pb-4 font-medium">PNL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {tradeHistory.filter(t => t.status === 'CLOSED').map((trade) => (
                      <tr key={trade.id} className="text-slate-300 hover:bg-slate-800/30">
                        <td className="py-3 text-slate-500">{format(new Date(trade.closed_at || trade.created_date), 'MM-dd HH:mm')}</td>
                        <td className="py-3 font-bold">{trade.symbol}</td>
                        <td className={`py-3 ${trade.side === 'LONG' ? 'text-emerald-500' : 'text-red-500'}`}>
                          {trade.side}
                        </td>
                        <td className="py-3 font-mono">${trade.entry_price?.toFixed(4)}</td>
                        <td className="py-3 font-mono">${trade.exit_price?.toFixed(4)}</td>
                        <td className={`py-3 font-mono ${trade.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {trade.pnl?.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="m-0 h-full">
             <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm min-h-[100px]">
                <p>No transaction history</p>
             </div>
          </TabsContent>

          <TabsContent value="vouchers" className="m-0 h-full">
             <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm min-h-[100px]">
                <p>No voucher positions</p>
             </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

TradingHistory.propTypes = {
  tradingAccountId: PropTypes.string,
  currentPrices: PropTypes.object,
  onRefresh: PropTypes.func
};