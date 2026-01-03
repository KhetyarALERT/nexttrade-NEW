import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// BingX API for prices
const TICKER_URL = 'https://open-api.bingx.com/openApi/swap/v2/quote/ticker';

async function fetchPrices() {
  const response = await fetch(TICKER_URL);
  const data = await response.json();
  const prices = {};
  if (data.code === 0 && data.data) {
    data.data.forEach(t => {
      prices[t.symbol] = parseFloat(t.lastPrice);
    });
  }
  return prices;
}

// Re-implement close logic or call tradingAccount? 
// Calling tradingAccount is safer for consistency.
async function closeTrade(base44, tradeId, price, reason) {
  try {
    await base44.functions.invoke('tradingAccount', {
      action: 'closeTrade',
      tradeId,
      exitPrice: price,
      reason
    });
    console.log(`[CHECK_ORDERS] Closed trade ${tradeId} at ${price} (${reason})`);
  } catch (e) {
    console.error(`[CHECK_ORDERS] Failed to close trade ${tradeId}:`, e.message);
  }
}

async function executeOrder(base44, trade, price) {
  // Convert PENDING to OPEN
  try {
    // We update directly here as it's a simple status change + entry price update?
    // Or we should call a dedicated action.
    // Let's call a new action 'executeOrder' in tradingAccount to handle margin locks etc if not locked yet?
    // For LIMIT orders, margin is usually locked on creation.
    
    await base44.asServiceRole.entities.Trade.update(trade.id, {
      status: 'OPEN',
      entry_price: price, // Fill at market price or limit price? usually limit price for limit orders, but slippage?
      // If it's a limit order, we fill at trade.limit_price or better. 
      // For simplicity in this demo, fill at current market price if it satisfies limit.
      open_at: new Date().toISOString()
    });
    
    // Send notification
    await base44.asServiceRole.entities.Notification.create({
      user_id: trade.user_id,
      type: 'trade_executed',
      title: 'Order Filled',
      message: `Your ${trade.order_type} order for ${trade.symbol} was filled at ${price}`,
      data: { tradeId: trade.id, price }
    });
    
    console.log(`[CHECK_ORDERS] Executed order ${trade.id} at ${price}`);
  } catch (e) {
    console.error(`[CHECK_ORDERS] Failed to execute order ${trade.id}:`, e.message);
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  // This function might be called by scheduler, so user might not be present or is system
  // We use service role for everything
  
  try {
    console.log('[CHECK_ORDERS] Starting check...');
    const prices = await fetchPrices();
    
    // 1. Check OPEN trades for TP/SL and Trailing Stop
    const openTrades = await base44.asServiceRole.entities.Trade.filter({ status: 'OPEN' }, undefined, 1000); // Limit 1000 active trades
    
    for (const trade of openTrades) {
      const price = prices[trade.symbol];
      if (!price) continue;
      
      // TP/SL Check
      if (trade.take_profit) {
        if (trade.side === 'LONG' && price >= trade.take_profit) {
          await closeTrade(base44, trade.id, price, 'take_profit');
          continue;
        } else if (trade.side === 'SHORT' && price <= trade.take_profit) {
          await closeTrade(base44, trade.id, price, 'take_profit');
          continue;
        }
      }
      
      if (trade.stop_loss) {
        if (trade.side === 'LONG' && price <= trade.stop_loss) {
          await closeTrade(base44, trade.id, price, 'stop_loss');
          continue;
        } else if (trade.side === 'SHORT' && price >= trade.stop_loss) {
          await closeTrade(base44, trade.id, price, 'stop_loss');
          continue;
        }
      }
      
      // Trailing Stop Check
      if (trade.order_type === 'TRAILING_STOP' || trade.trailing_stop_percent) {
        const percent = trade.trailing_stop_percent;
        const currentTrigger = trade.trailing_stop_trigger || trade.entry_price;
        
        if (trade.side === 'LONG') {
          // Update highest price
          if (price > currentTrigger) {
            await base44.asServiceRole.entities.Trade.update(trade.id, { trailing_stop_trigger: price });
          }
          
          // Check trigger
          const stopPrice = (trade.trailing_stop_trigger || price) * (1 - percent / 100);
          if (price <= stopPrice) {
            await closeTrade(base44, trade.id, price, 'trailing_stop');
            continue;
          }
        } else { // SHORT
          // Update lowest price
          if (price < currentTrigger) {
            await base44.asServiceRole.entities.Trade.update(trade.id, { trailing_stop_trigger: price });
          }
          
          // Check trigger
          const stopPrice = (trade.trailing_stop_trigger || price) * (1 + percent / 100);
          if (price >= stopPrice) {
            await closeTrade(base44, trade.id, price, 'trailing_stop');
            continue;
          }
        }
      }
      
      // Liquidation Check
      if (trade.liquidation_price) {
        if (trade.side === 'LONG' && price <= trade.liquidation_price) {
          await closeTrade(base44, trade.id, price, 'liquidation');
          continue;
        } else if (trade.side === 'SHORT' && price >= trade.liquidation_price) {
          await closeTrade(base44, trade.id, price, 'liquidation');
          continue;
        }
      }
    }
    
    // 2. Check PENDING trades (Limit/Stop orders)
    const pendingTrades = await base44.asServiceRole.entities.Trade.filter({ status: 'PENDING' }, undefined, 1000);
    
    for (const trade of pendingTrades) {
      const price = prices[trade.symbol];
      if (!price) continue;
      
      if (trade.order_type === 'LIMIT') {
        // Buy Limit: Price <= Limit Price
        if (trade.side === 'LONG' && price <= trade.limit_price) {
          await executeOrder(base44, trade, price);
        }
        // Sell Limit: Price >= Limit Price
        else if (trade.side === 'SHORT' && price >= trade.limit_price) {
          await executeOrder(base44, trade, price);
        }
      } 
      else if (trade.order_type === 'STOP') {
        // Buy Stop: Price >= Stop Price (usually handled as trigger)
        // Here assuming limit_price stores the trigger for STOP orders in this simple schema
        // Or entry_price if it was set as trigger
        const triggerPrice = trade.limit_price; // Using limit_price as trigger for simplicity
        
        if (trade.side === 'LONG' && price >= triggerPrice) {
          await executeOrder(base44, trade, price);
        }
        else if (trade.side === 'SHORT' && price <= triggerPrice) {
          await executeOrder(base44, trade, price);
        }
      }
    }

    return Response.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[CHECK_ORDERS] Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});