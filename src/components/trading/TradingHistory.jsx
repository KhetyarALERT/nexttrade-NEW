import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileText, Pencil, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { marketStore } from "@/components/trading/marketStore";
import TPSLDialog from "@/components/trading/TPSLDialog";
import { toast } from "sonner";
import { format } from "date-fns";

export default function TradingHistory({ tradingAccountId, onRefresh, onPositionsUpdate, onOpenOrdersUpdate }) {
  const [activeTab, setActiveTab] = useState("positions");
  const [positions, setPositions] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [closingId, setClosingId] = useState(null);
  const [livePrices, setLivePrices] = useState({});
  
  // TP/SL Dialog
  const [tpslOpen, setTpslOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);

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
      if (ordersRes.data?.success) {
        const newOrders = ordersRes.data.data || [];
        setOpenOrders(newOrders);
        if (onOpenOrdersUpdate) onOpenOrdersUpdate(newOrders);
      }
      if (historyRes.data?.success) {
        setTradeHistory(historyRes.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch trading data", err);
    } finally {
      setLoading(false);
    }
  }, [tradingAccountId, onPositionsUpdate, onOpenOrdersUpdate]);

  useEffect(() => {
    fetchData(); // initial load only
  }, [fetchData]);

  // Real-time price subscription via WebSocket only
  useEffect(() => {
    if (positions.length === 0) return;

    const symbols = new Set(positions.map(p => p.symbol));
    symbols.forEach(s => marketStore.subscribeToTicker(s));

    const handlePrice = ({ symbol, ticker }) => {
      setLivePrices(prev => ({
        ...prev,
        [symbol]: ticker.price
      }));
    };

    const unsubscribe = marketStore.subscribe('ticker', handlePrice);
    
    // Get initial prices from store
    const initialPrices = {};
    symbols.forEach(s => {
      const t = marketStore.tickers[s];
      if (t?.price) initialPrices[s] = t.price;
    });
    if (Object.keys(initialPrices).length) setLivePrices(prev => ({ ...prev, ...initialPrices }));

    return () => unsubscribe();
  }, [positions]);

  const handleClosePosition = async (tradeId, symbol) => {
    const price = livePrices[symbol] || marketStore.getPrice(symbol);
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
        toast.success(`Position closed`);
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

  const openTPSLDialog = (pos) => {
    setEditingPosition(pos);
    setTpslOpen(true);
  };

  const calculatePnl = (pos) => {
    const currentPrice = livePrices[pos.symbol] || marketStore.getPrice(pos.symbol);
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
    <div className="h-full min-h-[200px] bg-[#131722] border-t border-[#2B2B43] flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 border-b border-[#2B2B43] bg-[#1a1a2e]">
          <TabsList className="bg-transparent h-10 p-0 gap-6">
            {[
              { value: "positions", label: `Positions (${positions.length})` },
              { value: "open-orders", label: `Open Orders (${openOrders.length})` },
              { value: "trade-history", label: "Trade History" }
            ].map(tab => (
              <TabsTrigger 
                key={tab.value}
                value={tab.value} 
                className="bg-transparent border-b-2 border-transparent data-[state=active]:border-[#2962FF] data-[state=active]:text-white text-slate-400 rounded-none px-0 h-full font-medium text-xs"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="positions" className="m-0 h-full">
            {positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm">
                <FileText className="w-8 h-8 mb-2 opacity-20" />
                <p>No open positions</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500 uppercase sticky top-0 bg-[#131722] z-10">
                  <tr className="border-b border-[#2B2B43]">
                    <th className="px-3 py-2 font-medium">Symbol</th>
                    <th className="px-3 py-2 font-medium">Size</th>
                    <th className="px-3 py-2 font-medium">Entry</th>
                    <th className="px-3 py-2 font-medium">Mark</th>
                    <th className="px-3 py-2 font-medium">PnL (ROE%)</th>
                    <th className="px-3 py-2 font-medium">Liq. Price</th>
                    <th className="px-3 py-2 font-medium">Margin</th>
                    <th className="px-3 py-2 font-medium">TP/SL</th>
                    <th className="px-3 py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2B2B43]/50">
                  {positions.map((pos) => {
                    const { pnl, roe, markPrice } = calculatePnl(pos);
                    
                    return (
                      <tr key={pos.id} className="text-slate-300 hover:bg-[#1f2937]/30">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-white">{pos.symbol}</span>
                            <Badge variant="outline" className={`text-[9px] h-4 px-1 border-0 ${
                              pos.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {pos.side} {pos.leverage}x
                            </Badge>
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono">{pos.quantity?.toFixed(4)}</td>
                        <td className="px-3 py-2 font-mono">{pos.entry_price?.toFixed(2)}</td>
                        <td className="px-3 py-2 font-mono text-white">{markPrice?.toFixed(2) || '--'}</td>
                        <td className="px-3 py-2 font-mono">
                          <span className={pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                          </span>
                          <span className={`ml-1 text-[10px] ${roe >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            ({roe >= 0 ? '+' : ''}{roe.toFixed(2)}%)
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-amber-400">
                          <div className="flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {pos.liquidation_price?.toFixed(2) || '--'}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono">{pos.margin?.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <div className="text-[10px] text-slate-500">
                            <div>TP: {pos.take_profit || '--'}</div>
                            <div>SL: {pos.stop_loss || '--'}</div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 text-[10px] text-[#2962FF] hover:text-white px-0 mt-0.5"
                            onClick={() => openTPSLDialog(pos)}
                          >
                            <Pencil className="w-3 h-3 mr-1" /> Edit
                          </Button>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            className="h-6 text-[10px] bg-[#2B2B43] hover:bg-[#383856] text-white"
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
                <FileText className="w-8 h-8 mb-2 opacity-20" />
                <p>No open orders</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500 uppercase sticky top-0 bg-[#131722] z-10">
                  <tr className="border-b border-[#2B2B43]">
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Symbol</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Side</th>
                    <th className="px-3 py-2 font-medium">Price</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2B2B43]/50">
                  {openOrders.map((order) => (
                    <tr key={order.id} className="text-slate-300 hover:bg-[#1f2937]/30">
                      <td className="px-3 py-2 text-slate-500">{format(new Date(order.created_date), 'MM-dd HH:mm')}</td>
                      <td className="px-3 py-2 font-medium text-white">{order.symbol}</td>
                      <td className="px-3 py-2">{order.order_type}</td>
                      <td className={`px-3 py-2 ${order.side === 'LONG' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {order.side}
                      </td>
                      <td className="px-3 py-2 font-mono">${order.limit_price || 'Market'}</td>
                      <td className="px-3 py-2 font-mono">{order.quantity}</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-red-400 hover:bg-red-950/30"
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
          
          <TabsContent value="trade-history" className="m-0 h-full">
            {tradeHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm">
                <FileText className="w-8 h-8 mb-2 opacity-20" />
                <p>No trade history</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500 uppercase sticky top-0 bg-[#131722] z-10">
                  <tr className="border-b border-[#2B2B43]">
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Symbol</th>
                    <th className="px-3 py-2 font-medium">Side</th>
                    <th className="px-3 py-2 font-medium">Entry</th>
                    <th className="px-3 py-2 font-medium">Exit</th>
                    <th className="px-3 py-2 font-medium">PnL</th>
                    <th className="px-3 py-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2B2B43]/50">
                  {tradeHistory.map((trade) => (
                    <tr key={trade.id} className="text-slate-300 hover:bg-[#1f2937]/30">
                      <td className="px-3 py-2 text-slate-500">{format(new Date(trade.closed_at || trade.created_date), 'MM-dd HH:mm')}</td>
                      <td className="px-3 py-2 font-medium text-white">{trade.symbol}</td>
                      <td className={`px-3 py-2 ${trade.side === 'LONG' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {trade.side}
                      </td>
                      <td className="px-3 py-2 font-mono">${trade.entry_price?.toFixed(2)}</td>
                      <td className="px-3 py-2 font-mono">${trade.exit_price?.toFixed(2)}</td>
                      <td className={`px-3 py-2 font-mono ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {trade.pnl >= 0 ? '+' : ''}{trade.pnl?.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-slate-500 capitalize">{trade.close_reason || 'manual'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* TP/SL Dialog */}
      <TPSLDialog 
        open={tpslOpen}
        onOpenChange={setTpslOpen}
        position={editingPosition}
        currentPrice={editingPosition ? (livePrices[editingPosition.symbol] || 0) : 0}
        onSuccess={() => {
          fetchData();
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
}

TradingHistory.propTypes = {
  tradingAccountId: PropTypes.string,
  onRefresh: PropTypes.func,
  onPositionsUpdate: PropTypes.func,
  onOpenOrdersUpdate: PropTypes.func
};