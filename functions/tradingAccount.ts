import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const audit = (action, userId, data) => {
  console.log(`[TRADING_AUDIT] [${new Date().toISOString()}] ${action} | User: ${userId}`, JSON.stringify(data));
};

const TRADING_FEES = { maker: 0.02, taker: 0.05 }; // percentages

const calculateLiquidationPrice = (entryPrice, leverage, side, maintenanceMargin = 0.5) => {
  const marginRatio = 1 / leverage;
  if (side === 'LONG') return entryPrice * (1 - marginRatio + maintenanceMargin / 100);
  return entryPrice * (1 + marginRatio - maintenanceMargin / 100);
};

const calculateSlippage = (orderSize, maxSlippage = 0.5) => {
  const baseSlippage = 0.01;
  const sizeImpact = Math.min(orderSize / 100000, 0.1);
  const randomFactor = Math.random() * 0.05;
  return Math.min(baseSlippage + sizeImpact + randomFactor, maxSlippage);
};

async function closeTradeInternal(base44, trade, exitPrice, reason) {
  let grossPnl = trade.side === 'LONG' 
    ? (exitPrice - trade.entry_price) * trade.quantity
    : (trade.entry_price - exitPrice) * trade.quantity;
  
  const notionalValue = trade.quantity * exitPrice;
  const closingFee = notionalValue * TRADING_FEES.taker / 100;
  const netPnl = grossPnl - closingFee;
  const pnlPercent = (netPnl / trade.margin) * 100;

  const feeTotal = (trade.fee_total ?? trade.fees ?? 0) + closingFee;

  await base44.asServiceRole.entities.Trade.update(trade.id, {
    exit_price: exitPrice,
    avg_exit_price: exitPrice,
    status: 'CLOSED',
    pnl: netPnl,
    pnl_percent: pnlPercent,
    realized_pnl: netPnl,
    realized_pnl_percent: pnlPercent,
    fee_close: closingFee,
    fee_total: feeTotal,
    fees: feeTotal,
    closed_at: new Date().toISOString(),
    close_reason: reason,
    updated_at: new Date().toISOString()
  });
  
  const returnAmount = trade.margin + netPnl;
  const accounts = await base44.entities.TradingAccount.filter({ id: trade.trading_account_id });
  if (accounts?.length) {
    const account = accounts[0];
    if (account.is_demo) {
      const newBal = account.demo_balance + returnAmount;
      await base44.asServiceRole.entities.TradingAccount.update(trade.trading_account_id, {
        demo_balance: newBal, balance: newBal,
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

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    
    const body = await req.json();
    const { action, ...params } = body;

    if (action === 'getOrCreate') {
      const { accountType = 'demo' } = params;
      let accounts = await base44.entities.TradingAccount.filter({ user_id: user.id, account_type: accountType });
      
      if (!accounts?.length) {
        const accountId = `TA_${accountType}_${user.id.substring(0, 8)}_${Date.now()}`;
        const isDemo = accountType === 'demo';
        
        const newAccount = await base44.asServiceRole.entities.TradingAccount.create({
          account_id: accountId, user_id: user.id, user_email: user.email,
          nickname: params.nickname || (isDemo ? 'Demo Account' : 'Live Account'),
          account_type: accountType, balance: isDemo ? 10000 : 0, equity: isDemo ? 10000 : 0,
          margin_used: 0, unrealized_pnl: 0, realized_pnl: 0, total_trades: 0, winning_trades: 0,
          status: 'active', default_leverage: 10, is_demo: isDemo, demo_balance: isDemo ? 10000 : 0
        });
        
        audit('ACCOUNT_CREATED', user.id, { account_id: accountId, accountType });
        
        let wallet = null;
        if (!isDemo) {
          wallet = await base44.asServiceRole.entities.Wallet.create({
            trading_account_id: newAccount.id, user_id: user.id, currency: 'USDT',
            network: 'TRC20', balance: 0, status: 'active', is_primary: true
          });
        }
        return Response.json({ success: true, data: newAccount, wallet, isNew: true });
      }
      
      let wallet = null;
      if (accountType !== 'demo') {
        const wallets = await base44.entities.Wallet.filter({ trading_account_id: accounts[0].id, is_primary: true });
        wallet = wallets?.[0] || null;
      }
      return Response.json({ success: true, data: accounts[0], wallet, isNew: false });
    }

    if (action === 'openTrade') {
      const { 
        tradingAccountId, walletId, symbol, side, quantity, leverage = 10, entryPrice,
        orderType = 'MARKET', limitPrice, stopPrice, stopLoss, takeProfit,
        trailingStopPercent, trailingStopActivation, oco_stop_price, oco_limit_price, isOCO, maxSlippage = 0.5
      } = params;
      
      if (!tradingAccountId || !symbol || !side || !quantity || !entryPrice) {
        return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }
      
      const accounts = await base44.entities.TradingAccount.filter({ id: tradingAccountId, user_id: user.id });
      if (!accounts?.length) return Response.json({ success: false, error: 'Account not found' }, { status: 404 });
      
      const account = accounts[0];
      let actualEntryPrice = entryPrice;
      let actualSlippage = 0;
      let status = 'OPEN';
      
      if (orderType === 'LIMIT' || orderType === 'STOP' || orderType === 'OCO') status = 'PENDING';
      
      if (status === 'OPEN' && orderType === 'MARKET') {
        actualSlippage = calculateSlippage(quantity * entryPrice, maxSlippage);
        actualEntryPrice = side === 'LONG' 
          ? entryPrice * (1 + actualSlippage / 100) 
          : entryPrice * (1 - actualSlippage / 100);
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
        const wallets = await base44.entities.Wallet.filter(
          walletId ? { id: walletId, user_id: user.id } : { trading_account_id: tradingAccountId, is_primary: true }
        );
        useWallet = wallets?.[0];
        if (!useWallet) return Response.json({ success: false, error: 'No wallet found' }, { status: 400 });
        availableBalance = useWallet.balance - (useWallet.locked_balance || 0) - (useWallet.staked_balance || 0);
      }
      
      if (totalRequired > availableBalance) {
        return Response.json({ success: false, error: `Insufficient balance. Need $${totalRequired.toFixed(2)}` }, { status: 400 });
      }
      
      const nowISO = new Date().toISOString();
      const trade = await base44.asServiceRole.entities.Trade.create({
                trading_account_id: tradingAccountId, wallet_id: useWallet?.id || null, user_id: user.id,
                symbol, side, order_type: orderType, entry_price: actualEntryPrice, limit_price: limitPrice || null,
                quantity, leverage, margin: marginRequired, status, slippage: actualSlippage,
                max_slippage: maxSlippage, liquidation_price: liquidationPrice, stop_loss: stopLoss || null,
                take_profit: takeProfit || null, trailing_stop_percent: trailingStopPercent || null,
                trailing_stop_activation: trailingStopActivation || null, oco_stop_price: oco_stop_price || null,
                oco_limit_price: oco_limit_price || null,
                opened_at: status === 'OPEN' ? nowISO : nowISO,
                created_at: nowISO,
                avg_entry_price: actualEntryPrice,
                fee_open: tradingFee,
                fee_total: tradingFee,
                unrealized_pnl: 0,
                realized_pnl: 0,
                realized_pnl_percent: 0
              });
      
      if (account.is_demo) {
        await base44.asServiceRole.entities.TradingAccount.update(tradingAccountId, {
          demo_balance: account.demo_balance - totalRequired, balance: account.demo_balance - totalRequired,
          margin_used: account.margin_used + marginRequired, total_trades: account.total_trades + 1
        });
      } else {
        await base44.asServiceRole.entities.Wallet.update(useWallet.id, { balance: useWallet.balance - totalRequired });
        await base44.asServiceRole.entities.TradingAccount.update(tradingAccountId, {
          balance: account.balance - totalRequired, margin_used: account.margin_used + marginRequired,
          total_trades: account.total_trades + 1
        });
      }
      
      await base44.asServiceRole.entities.Notification.create({
        user_id: user.id, type: status === 'OPEN' ? 'trade_executed' : 'system',
        title: status === 'OPEN' ? `${side} ${symbol} Opened` : `${orderType} Order Placed`,
        message: status === 'OPEN' ? `${side} ${quantity} ${symbol} at $${actualEntryPrice.toFixed(2)}` : `${orderType} order for ${symbol} placed.`,
        data: { tradeId: trade.id, symbol, side, quantity, entryPrice: actualEntryPrice }, priority: 'normal'
      });
      
      return Response.json({ success: true, data: trade });
    }

    if (action === 'closeTrade') {
      const { tradeId, exitPrice, reason = 'manual' } = params;
      if (!tradeId || !exitPrice) return Response.json({ success: false, error: 'Missing tradeId or exitPrice' }, { status: 400 });
      
      const trades = await base44.entities.Trade.filter({ id: tradeId });
      if (!trades?.length) return Response.json({ success: false, error: 'Trade not found' }, { status: 404 });
      
      await closeTradeInternal(base44, trades[0], exitPrice, reason);
      return Response.json({ success: true, data: { tradeId, status: 'CLOSED' } });
    }

    if (action === 'updateTrade') {
      const { tradeId, stopLoss, takeProfit, trailingStopTrigger } = params;
      if (!tradeId) return Response.json({ success: false, error: 'Missing tradeId' }, { status: 400 });
      
      const updateData = {};
      if (stopLoss !== undefined) updateData.stop_loss = stopLoss;
      if (takeProfit !== undefined) updateData.take_profit = takeProfit;
      if (trailingStopTrigger !== undefined) updateData.trailing_stop_trigger = trailingStopTrigger;
      
      updateData.updated_at = new Date().toISOString();
      await base44.asServiceRole.entities.Trade.update(tradeId, updateData);
      return Response.json({ success: true });
    }

    if (action === 'executePendingOrder') {
      const { tradeId, entryPrice } = params;
      if (!tradeId || !entryPrice) return Response.json({ success: false }, { status: 400 });
      await base44.asServiceRole.entities.Trade.update(tradeId, { status: 'OPEN', entry_price: entryPrice, opened_at: new Date().toISOString(), updated_at: new Date().toISOString() });
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
      const trades = await base44.entities.Trade.filter({ user_id: user.id, status: 'OPEN' });
      return Response.json({ success: true, data: trades || [] });
    }

    if (action === 'cancelOrder') {
      const { tradeId } = params;
      const trades = await base44.entities.Trade.filter({ id: tradeId, user_id: user.id, status: 'PENDING' });
      if (!trades?.length) return Response.json({ success: false, error: 'Pending order not found' }, { status: 404 });
      
      const trade = trades[0];
      const accounts = await base44.entities.TradingAccount.filter({ id: trade.trading_account_id });
      if (accounts?.length) {
        const account = accounts[0];
        const refund = trade.margin + (trade.fees || 0);
        if (account.is_demo) {
          await base44.asServiceRole.entities.TradingAccount.update(trade.trading_account_id, {
            demo_balance: account.demo_balance + refund, balance: account.balance + refund,
            margin_used: Math.max(0, account.margin_used - trade.margin)
          });
        } else {
          if (trade.wallet_id) {
            const wallets = await base44.entities.Wallet.filter({ id: trade.wallet_id });
            if (wallets?.length) await base44.asServiceRole.entities.Wallet.update(trade.wallet_id, { balance: wallets[0].balance + refund });
          }
          await base44.asServiceRole.entities.TradingAccount.update(trade.trading_account_id, {
            balance: account.balance + refund, margin_used: Math.max(0, account.margin_used - trade.margin)
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