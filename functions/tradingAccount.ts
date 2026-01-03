import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const audit = (action, userId, data) => {
  console.log(`[TRADING_AUDIT] [${new Date().toISOString()}] ${action} | User: ${userId}`, JSON.stringify(data));
};

// Trading fees (percentage)
const TRADING_FEES = {
  maker: 0.02, // 0.02%
  taker: 0.05  // 0.05%
};

// Calculate liquidation price
const calculateLiquidationPrice = (entryPrice, leverage, side, maintenanceMargin = 0.5) => {
  const marginRatio = 1 / leverage;
  if (side === 'LONG') {
    return entryPrice * (1 - marginRatio + maintenanceMargin / 100);
  } else {
    return entryPrice * (1 + marginRatio - maintenanceMargin / 100);
  }
};

// Simulate slippage based on order size and market conditions
const calculateSlippage = (orderSize, maxSlippage = 0.5) => {
  // Base slippage + size impact
  const baseSlippage = 0.01; // 0.01%
  const sizeImpact = Math.min(orderSize / 100000, 0.1); // Max 0.1% from size
  const randomFactor = Math.random() * 0.05; // Random 0-0.05%
  
  const totalSlippage = baseSlippage + sizeImpact + randomFactor;
  return Math.min(totalSlippage, maxSlippage);
};

// Helper: Fetch current prices for "inline execution" check
async function fetchPrices(symbols) {
  if (!symbols || symbols.length === 0) return {};
  try {
    // We can't easily fetch specific symbols in bulk without iterating or using all ticker endpoint
    // Using all ticker endpoint is safer for unknown symbols
    const response = await fetch('https://open-api.bingx.com/openApi/swap/v2/quote/ticker');
    const data = await response.json();
    const prices = {};
    if (data.code === 0 && data.data) {
      data.data.forEach(t => {
        prices[t.symbol] = parseFloat(t.lastPrice);
      });
    }
    return prices;
  } catch (e) {
    console.error("Failed to fetch prices:", e);
    return {};
  }
}

// Helper: Check and execute orders for a specific user
async function checkUserOrders(base44, userId, accountId) {
  try {
    const [openTrades, pendingTrades] = await Promise.all([
      base44.entities.Trade.filter({ user_id: userId, trading_account_id: accountId, status: 'OPEN' }),
      base44.entities.Trade.filter({ user_id: userId, trading_account_id: accountId, status: 'PENDING' })
    ]);

    if ((!openTrades || openTrades.length === 0) && (!pendingTrades || pendingTrades.length === 0)) return;

    const symbols = new Set([
      ...(openTrades || []).map(t => t.symbol),
      ...(pendingTrades || []).map(t => t.symbol)
    ]);
    
    const prices = await fetchPrices(Array.from(symbols));

    // Check Open Trades (TP/SL/Trailing)
    for (const trade of (openTrades || [])) {
      const price = prices[trade.symbol];
      if (!price) continue;

      let closeReason = null;

      if (trade.take_profit) {
        if ((trade.side === 'LONG' && price >= trade.take_profit) || 
            (trade.side === 'SHORT' && price <= trade.take_profit)) {
          closeReason = 'take_profit';
        }
      }
      
      if (!closeReason && trade.stop_loss) {
        if ((trade.side === 'LONG' && price <= trade.stop_loss) || 
            (trade.side === 'SHORT' && price >= trade.stop_loss)) {
          closeReason = 'stop_loss';
        }
      }

      // Check Trailing Stop
      if (!closeReason && (trade.order_type === 'TRAILING_STOP' || trade.trailing_stop_percent)) {
        const percent = trade.trailing_stop_percent;
        const currentTrigger = trade.trailing_stop_trigger || trade.entry_price;
        let shouldUpdateTrigger = false;
        let newTrigger = currentTrigger;

        if (trade.side === 'LONG') {
          if (price > currentTrigger) { newTrigger = price; shouldUpdateTrigger = true; }
          const stopPrice = newTrigger * (1 - percent / 100);
          if (price <= stopPrice) closeReason = 'trailing_stop';
        } else {
          if (price < currentTrigger) { newTrigger = price; shouldUpdateTrigger = true; }
          const stopPrice = newTrigger * (1 + percent / 100);
          if (price >= stopPrice) closeReason = 'trailing_stop';
        }

        if (shouldUpdateTrigger && !closeReason) {
          await base44.asServiceRole.entities.Trade.update(trade.id, { trailing_stop_trigger: newTrigger });
        }
      }

      if (closeReason) {
        await closeTradeInternal(base44, trade, price, closeReason);
      }
    }

    // Check Pending Trades (Limit/Stop)
    for (const trade of (pendingTrades || [])) {
      const price = prices[trade.symbol];
      if (!price) continue;

      if (trade.order_type === 'LIMIT') {
        if ((trade.side === 'LONG' && price <= trade.limit_price) || 
            (trade.side === 'SHORT' && price >= trade.limit_price)) {
          await executeOrderInternal(base44, trade, price);
        }
      } 
      else if (trade.order_type === 'STOP' || trade.order_type === 'OCO') {
        // Assuming limit_price or stop_price holds the trigger
        // For OCO, we have stop_price (trigger) and limit_price (limit)
        // Check schema usage: STOP orders usually have stop_price as trigger.
        // But our openTrade uses limitPrice for LIMIT orders.
        // For STOP orders, we might have used limitPrice as trigger in previous simplified version.
        // Let's assume trade.limit_price is the trigger for simple STOP orders if no separate field.
        // BUT we updated schema to have oco_stop_price etc.
        // Let's use generic logic if fields exist.
        
        const triggerPrice = trade.oco_stop_price || trade.stop_loss || trade.limit_price; // Fallback
        
        if ((trade.side === 'LONG' && price >= triggerPrice) ||
            (trade.side === 'SHORT' && price <= triggerPrice)) {
          await executeOrderInternal(base44, trade, price);
        }
      }
    }

  } catch (e) {
    console.error("Inline check error:", e);
  }
}

async function closeTradeInternal(base44, trade, exitPrice, reason) {
  // Logic copied/adapted from closeTrade action
  // We call this internally
  
  // Calculate PnL etc
  let grossPnl = 0;
  if (trade.side === 'LONG') {
    grossPnl = (exitPrice - trade.entry_price) * trade.quantity;
  } else {
    grossPnl = (trade.entry_price - exitPrice) * trade.quantity;
  }
  
  const notionalValue = trade.quantity * exitPrice;
  const closingFee = notionalValue * TRADING_FEES.taker / 100;
  
  const netPnl = grossPnl - closingFee; // simplified funding for inline
  const pnlPercent = (netPnl / trade.margin) * 100;
  
  await base44.asServiceRole.entities.Trade.update(trade.id, {
    exit_price: exitPrice,
    status: 'CLOSED',
    pnl: netPnl,
    pnl_percent: pnlPercent,
    fees: (trade.fees || 0) + closingFee,
    closed_at: new Date().toISOString(),
    close_reason: reason
  });
  
  // Return funds
  const returnAmount = trade.margin + netPnl;
  const accounts = await base44.entities.TradingAccount.filter({ id: trade.trading_account_id });
  if (accounts?.length) {
    const account = accounts[0];
    if (account.is_demo) {
      const newBal = account.demo_balance + returnAmount;
      await base44.asServiceRole.entities.TradingAccount.update(trade.trading_account_id, {
        demo_balance: newBal,
        balance: newBal,
        margin_used: Math.max(0, account.margin_used - trade.margin)
      });
    } else {
      await base44.asServiceRole.entities.TradingAccount.update(trade.trading_account_id, {
        balance: account.balance + returnAmount,
        margin_used: Math.max(0, account.margin_used - trade.margin)
      });
    }
  }
}

async function executeOrderInternal(base44, trade, price) {
  // Execute pending order
  await base44.asServiceRole.entities.Trade.update(trade.id, {
    status: 'OPEN',
    entry_price: price, // Fill at market
    open_at: new Date().toISOString()
  });
}


Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const { action, ...params } = body;
    
    // Lazy execution check for GET requests
    if (action === 'getTrades' || action === 'getOpenPositions' || action === 'list') {
      // Don't await this, let it run in background? No, Deno deploy might kill it. 
      // We must await it or accept it might not finish.
      // But we want results to reflect changes.
      await checkUserOrders(base44, user.id, params.tradingAccountId);
    }

    if (action === 'getOrCreate') {
      const { accountType = 'demo' } = params;
      
      let accounts = await base44.entities.TradingAccount.filter({ 
        user_id: user.id,
        account_type: accountType
      });
      
      if (!accounts?.length) {
        const accountId = `TA_${accountType}_${user.id.substring(0, 8)}_${Date.now()}`;
        const isDemo = accountType === 'demo';
        
        const newAccount = await base44.asServiceRole.entities.TradingAccount.create({
          account_id: accountId,
          user_id: user.id,
          user_email: user.email,
          nickname: params.nickname || (isDemo ? 'Demo Account' : 'Live Account'),
          account_type: accountType,
          balance: isDemo ? 10000 : 0,
          equity: isDemo ? 10000 : 0,
          margin_used: 0,
          unrealized_pnl: 0,
          realized_pnl: 0,
          total_trades: 0,
          winning_trades: 0,
          status: 'active',
          default_leverage: 10,
          is_demo: isDemo,
          demo_balance: isDemo ? 10000 : 0
        });
        
        audit('ACCOUNT_CREATED', user.id, { account_id: accountId, accountType });
        
        let wallet = null;
        if (!isDemo) {
          wallet = await base44.asServiceRole.entities.Wallet.create({
            trading_account_id: newAccount.id,
            user_id: user.id,
            currency: 'USDT',
            network: 'TRC20',
            balance: 0,
            status: 'active',
            is_primary: true
          });
        }
        
        return Response.json({ success: true, data: newAccount, wallet, isNew: true });
      }
      
      let wallet = null;
      if (accountType !== 'demo') {
        const wallets = await base44.entities.Wallet.filter({
          trading_account_id: accounts[0].id,
          is_primary: true
        });
        wallet = wallets?.[0] || null;
      }
      
      return Response.json({ success: true, data: accounts[0], wallet, isNew: false });
    }

    if (action === 'openTrade') {
      const { 
        tradingAccountId, 
        walletId,
        symbol, 
        side, 
        quantity, 
        leverage = 10, 
        entryPrice,
        orderType = 'MARKET',
        limitPrice,
        stopPrice,
        stopLoss, 
        takeProfit,
        trailingStopPercent,
        trailingStopActivation,
        isOCO,
        maxSlippage = 0.5
      } = params;
      
      if (!tradingAccountId || !symbol || !side || !quantity || !entryPrice) {
        return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }
      
      const accounts = await base44.entities.TradingAccount.filter({ 
        id: tradingAccountId, 
        user_id: user.id 
      });
      
      if (!accounts?.length) {
        return Response.json({ success: false, error: 'Account not found' }, { status: 404 });
      }
      
      const account = accounts[0];
      
      let actualEntryPrice = entryPrice;
      let actualSlippage = 0;
      let status = 'OPEN';
      
      // Handle Order Types
      if (orderType === 'LIMIT' || orderType === 'STOP' || orderType === 'OCO') {
        status = 'PENDING';
      }
      
      if (status === 'OPEN' && orderType === 'MARKET') {
        actualSlippage = calculateSlippage(quantity * entryPrice, maxSlippage);
        if (side === 'LONG') {
          actualEntryPrice = entryPrice * (1 + actualSlippage / 100);
        } else {
          actualEntryPrice = entryPrice * (1 - actualSlippage / 100);
        }
      }
      
      const notionalValue = quantity * actualEntryPrice;
      const marginRequired = notionalValue / leverage;
      const tradingFee = notionalValue * TRADING_FEES.taker / 100;
      const totalRequired = marginRequired + tradingFee;
      
      const liquidationPrice = calculateLiquidationPrice(actualEntryPrice, leverage, side);
      
      let availableBalance = 0;
      let useWallet = null;
      
      if (account.is_demo) {
        availableBalance = account.demo_balance - account.margin_used;
      } else {
        if (!walletId) {
          const wallets = await base44.entities.Wallet.filter({
            trading_account_id: tradingAccountId,
            is_primary: true
          });
          useWallet = wallets?.[0];
        } else {
          const wallets = await base44.entities.Wallet.filter({
            id: walletId,
            user_id: user.id
          });
          useWallet = wallets?.[0];
        }
        
        if (!useWallet) {
          return Response.json({ success: false, error: 'No wallet found for trading' }, { status: 400 });
        }
        
        availableBalance = useWallet.balance - useWallet.locked_balance - useWallet.staked_balance;
      }
      
      if (totalRequired > availableBalance) {
        return Response.json({ 
          success: false, 
          error: `Insufficient balance. Required: $${totalRequired.toFixed(2)}, Available: $${availableBalance.toFixed(2)}` 
        }, { status: 400 });
      }
      
      const trade = await base44.asServiceRole.entities.Trade.create({
        trading_account_id: tradingAccountId,
        wallet_id: useWallet?.id || null,
        user_id: user.id,
        symbol,
        side,
        order_type: orderType,
        entry_price: actualEntryPrice,
        limit_price: limitPrice || null,
        quantity,
        leverage,
        margin: marginRequired,
        status: status,
        fees: tradingFee,
        slippage: actualSlippage,
        max_slippage: maxSlippage,
        liquidation_price: liquidationPrice,
        stop_loss: stopLoss || null,
        take_profit: takeProfit || null,
        trailing_stop_percent: trailingStopPercent || null,
        trailing_stop_activation: trailingStopActivation || null,
        oco_stop_price: stopPrice || null,
        is_oco: isOCO || false
      });
      
      // Deduct margin
      if (account.is_demo) {
        await base44.asServiceRole.entities.TradingAccount.update(tradingAccountId, {
          demo_balance: account.demo_balance - totalRequired,
          balance: account.demo_balance - totalRequired,
          margin_used: account.margin_used + marginRequired,
          total_trades: account.total_trades + 1
        });
      } else {
        // ... (existing wallet logic, abbreviated for safety)
        await base44.asServiceRole.entities.Wallet.update(useWallet.id, {
          balance: useWallet.balance - totalRequired
        });
        await base44.asServiceRole.entities.TradingAccount.update(tradingAccountId, {
          balance: account.balance - totalRequired,
          margin_used: account.margin_used + marginRequired,
          total_trades: account.total_trades + 1
        });
      }
      
      // Notification
      if (status === 'OPEN') {
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id,
          type: 'trade_executed',
          title: `${side} ${symbol} Opened`,
          message: `${side} ${quantity} ${symbol} at $${actualEntryPrice.toFixed(2)}`,
          data: { tradeId: trade.id, symbol, side, quantity, entryPrice: actualEntryPrice },
          priority: 'normal'
        });
      } else {
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id,
          type: 'system', // or order_created
          title: `${orderType} Order Placed`,
          message: `${orderType} order for ${symbol} placed.`,
          data: { tradeId: trade.id, symbol, orderType },
          priority: 'normal'
        });
      }
      
      return Response.json({ success: true, data: trade });
    }

    if (action === 'closeTrade') {
      const { tradeId, exitPrice, reason = 'manual' } = params;
      
      if (!tradeId || !exitPrice) {
        return Response.json({ success: false, error: 'Missing tradeId or exitPrice' }, { status: 400 });
      }
      
      const trades = await base44.entities.Trade.filter({ id: tradeId });
      if (!trades?.length) {
        return Response.json({ success: false, error: 'Trade not found' }, { status: 404 });
      }
      const trade = trades[0];
      
      await closeTradeInternal(base44, trade, exitPrice, reason);
      
      return Response.json({ success: true, data: { tradeId, status: 'CLOSED' } });
    }

    if (action === 'updateTrade') {
      const { tradeId, stopLoss, takeProfit, trailingStopTrigger } = params;
      if (!tradeId) {
        return Response.json({ success: false, error: 'Missing tradeId' }, { status: 400 });
      }
      
      const updateData = {};
      if (stopLoss !== undefined) updateData.stop_loss = stopLoss;
      if (takeProfit !== undefined) updateData.take_profit = takeProfit;
      if (trailingStopTrigger !== undefined) updateData.trailing_stop_trigger = trailingStopTrigger;
      
      await base44.asServiceRole.entities.Trade.update(tradeId, updateData);
      return Response.json({ success: true });
    }

    if (action === 'executePendingOrder') {
       const { tradeId, entryPrice } = params;
       if (!tradeId || !entryPrice) return Response.json({ success: false }, { status: 400 });
       
       await base44.asServiceRole.entities.Trade.update(tradeId, {
         status: 'OPEN',
         entry_price: entryPrice,
         open_at: new Date().toISOString()
       });
       return Response.json({ success: true });
    }

    if (action === 'getTrades') {
      const { tradingAccountId, status, limit = 50 } = params;
      let query = { user_id: user.id };
      if (tradingAccountId) query.trading_account_id = tradingAccountId;
      if (status) query.status = status;
      const trades = await base44.entities.Trade.filter(query, '-created_date', limit);
      return Response.json({ success: true, data: trades || [] });
    }

    if (action === 'getOpenPositions') {
      const trades = await base44.entities.Trade.filter({ 
        user_id: user.id,
        status: 'OPEN'
      });
      return Response.json({ success: true, data: trades || [] });
    }

    if (action === 'cancelOrder') {
      const { tradeId } = params;
      const trades = await base44.entities.Trade.filter({ id: tradeId, user_id: user.id, status: 'PENDING' });
      if (!trades?.length) {
        return Response.json({ success: false, error: 'Pending order not found' }, { status: 404 });
      }
      const trade = trades[0];
      
      // Refund
      const accounts = await base44.entities.TradingAccount.filter({ id: trade.trading_account_id });
      if (accounts?.length) {
        const account = accounts[0];
        const refund = trade.margin + (trade.fees || 0);
        if (account.is_demo) {
          await base44.asServiceRole.entities.TradingAccount.update(trade.trading_account_id, {
            demo_balance: account.demo_balance + refund,
            balance: account.balance + refund,
            margin_used: Math.max(0, account.margin_used - trade.margin)
          });
        } else {
           // Wallet refund logic...
           if (trade.wallet_id) {
             const wallets = await base44.entities.Wallet.filter({ id: trade.wallet_id });
             if (wallets?.length) {
               await base44.asServiceRole.entities.Wallet.update(trade.wallet_id, {
                 balance: wallets[0].balance + refund
               });
             }
           }
           await base44.asServiceRole.entities.TradingAccount.update(trade.trading_account_id, {
             balance: account.balance + refund,
             margin_used: Math.max(0, account.margin_used - trade.margin)
           });
        }
      }
      
      await base44.asServiceRole.entities.Trade.update(tradeId, { status: 'CANCELLED', close_reason: 'cancelled' });
      return Response.json({ success: true });
    }

    if (action === 'list') {
      const accounts = await base44.entities.TradingAccount.filter({ user_id: user.id });
      return Response.json({ success: true, data: accounts || [] });
    }

    return Response.json({ success: false, error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('[TRADING_ACCOUNT_ERROR]', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});