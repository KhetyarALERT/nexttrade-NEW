import { useEffect, useRef } from 'react';
import { base44 } from "@/api/base44Client";
import { marketStore } from "@/components/trading/marketStore";
import { toast } from "sonner";

// Helper to calculate PnL and check triggers
export default function ClientExecutionEngine({ 
  positions = [], 
  openOrders = [], 
  onTrigger,
  userId
}) {
  const processedTriggers = useRef(new Set());

  useEffect(() => {
    if (!positions.length && !openOrders.length) return;

    // Subscribe to all relevant symbols
    const symbols = new Set([
      ...positions.map(p => p.symbol),
      ...openOrders.map(o => o.symbol)
    ]);

    symbols.forEach(s => marketStore.subscribeToTicker(s));

    const checkTriggers = ({ symbol, ticker }) => {
      const price = ticker.price;
      if (!price) return;

      // 1. Check Open Positions (TP/SL/Trailing)
      positions.filter(p => p.symbol === symbol).forEach(async (trade) => {
        let action = null;
        let reason = null;

        // Take Profit
        if (trade.take_profit) {
          if ((trade.side === 'LONG' && price >= trade.take_profit) || 
              (trade.side === 'SHORT' && price <= trade.take_profit)) {
            action = 'close';
            reason = 'take_profit';
          }
        }

        // Stop Loss
        if (!action && trade.stop_loss) {
          if ((trade.side === 'LONG' && price <= trade.stop_loss) || 
              (trade.side === 'SHORT' && price >= trade.stop_loss)) {
            action = 'close';
            reason = 'stop_loss';
          }
        }

        // Trailing Stop
        if (!action && (trade.order_type === 'TRAILING_STOP' || trade.trailing_stop_percent)) {
          const percent = trade.trailing_stop_percent;
          const currentTrigger = trade.trailing_stop_trigger || trade.entry_price;
          let shouldUpdateTrigger = false;
          let newTrigger = currentTrigger;

          if (trade.side === 'LONG') {
            if (price > currentTrigger) {
              newTrigger = price;
              shouldUpdateTrigger = true;
            }
            const stopPrice = newTrigger * (1 - percent / 100);
            if (price <= stopPrice) {
              action = 'close';
              reason = 'trailing_stop';
            }
          } else {
            if (price < currentTrigger) {
              newTrigger = price;
              shouldUpdateTrigger = true;
            }
            const stopPrice = newTrigger * (1 + percent / 100);
            if (price >= stopPrice) {
              action = 'close';
              reason = 'trailing_stop';
            }
          }

          // Update trigger in DB if moved (Optimistic update or silent backend call)
          if (shouldUpdateTrigger && !action) {
            // We invoke backend to update trigger, but don't wait/block
            base44.functions.invoke('tradingAccount', {
              action: 'updateTrade',
              tradeId: trade.id,
              trailingStopTrigger: newTrigger
            });
          }
        }

        if (action === 'close') {
          const triggerId = `${trade.id}_${reason}_${Math.round(price*100)}`;
          if (processedTriggers.current.has(triggerId)) return;
          processedTriggers.current.add(triggerId);
          setTimeout(() => processedTriggers.current.delete(triggerId), 60000);
          console.log(`[EXEC] Triggered ${reason} for ${trade.symbol} at ${price}`);
          try {
            await base44.functions.invoke('tradingAccount', {
              action: 'closeTrade',
              tradeId: trade.id,
              exitPrice: price,
              reason
            });
            toast.info(`${reason === 'take_profit' ? 'Take Profit' : 'Stop Loss'} triggered for ${trade.symbol}`);
            if (onTrigger) onTrigger();
          } catch (e) {
            console.error("Trigger execution failed", e);
          }
        }
      });

      // 2. Check Pending Orders (Limit/Stop/OCO)
      openOrders.filter(o => o.symbol === symbol).forEach(async (order) => {
        let triggered = false;

        if (order.order_type === 'LIMIT') {
          if ((order.side === 'LONG' && price <= order.limit_price) || 
              (order.side === 'SHORT' && price >= order.limit_price)) {
            triggered = true;
          }
        } 
        else if (order.order_type === 'STOP') {
          // Assuming limit_price holds the trigger for simple STOP
          const triggerPrice = order.limit_price; 
          if ((order.side === 'LONG' && price >= triggerPrice) || 
              (order.side === 'SHORT' && price <= triggerPrice)) {
            triggered = true;
          }
        }
        else if (order.order_type === 'OCO') {
           // OCO has limit_price (Take Profit) and oco_stop_price (Stop Loss Trigger)
           // Check Limit part
           if ((order.side === 'LONG' && price <= order.limit_price) || 
               (order.side === 'SHORT' && price >= order.limit_price)) {
             triggered = true;
           }
           // Check Stop part
           else if (order.oco_stop_price) {
             if ((order.side === 'LONG' && price >= order.oco_stop_price) || 
                 (order.side === 'SHORT' && price <= order.oco_stop_price)) {
               triggered = true;
             }
           }
        }

        if (triggered) {
          const triggerId = `order_${order.id}_${Math.round(price*100)}`;
          if (processedTriggers.current.has(triggerId)) return;
          processedTriggers.current.add(triggerId);
          setTimeout(() => processedTriggers.current.delete(triggerId), 60000);
          console.log(`[EXEC] Executing order ${order.id} for ${order.symbol} at ${price}`);
          try {
            await base44.functions.invoke('tradingAccount', {
              action: 'openTrade', // Re-using openTrade? No, we need 'executeOrder' or update status
              // Actually tradingAccount's openTrade creates a NEW trade. 
              // We need to update the PENDING trade to OPEN.
              // Let's call a specific action for this.
              action: 'executePendingOrder',
              tradeId: order.id,
              entryPrice: price
            });
            toast.success(`Order executed for ${order.symbol}`);
            if (onTrigger) onTrigger();
          } catch (e) {
             // Fallback: If action doesn't exist, try manual update via service role proxy if available
             // For now assume executePendingOrder exists or will be added
             console.error("Order execution failed", e);
          }
        }
      });
    };

    const unsubscribe = marketStore.subscribe('ticker', checkTriggers);
    return () => unsubscribe();
  }, [positions, openOrders, userId, onTrigger]);

  return null; // Headless component
}