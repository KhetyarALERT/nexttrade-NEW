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

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const { action, ...params } = body;
    
    console.log('[TRADING_ACCOUNT]', { action, userId: user.id });

    // GET OR CREATE TRADING ACCOUNT
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
        
        // Create default USDT wallet for live accounts
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

    // GET ALL ACCOUNTS
    if (action === 'getAllAccounts') {
      const accounts = await base44.entities.TradingAccount.filter({ user_id: user.id });
      
      const accountsWithWallets = await Promise.all((accounts || []).map(async (account) => {
        if (!account.is_demo) {
          const wallets = await base44.entities.Wallet.filter({
            trading_account_id: account.id,
            user_id: user.id
          });
          return { ...account, wallets: wallets || [] };
        }
        return { ...account, wallets: [] };
      }));
      
      return Response.json({ success: true, data: accountsWithWallets });
    }

    // OPEN TRADE (with slippage, order types, margin validation)
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
        stopLoss, 
        takeProfit,
        maxSlippage = 0.5
      } = params;
      
      if (!tradingAccountId || !symbol || !side || !quantity || !entryPrice) {
        return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }
      
      if (!['LONG', 'SHORT'].includes(side)) {
        return Response.json({ success: false, error: 'Invalid side' }, { status: 400 });
      }
      
      if (!['MARKET', 'LIMIT'].includes(orderType)) {
        return Response.json({ success: false, error: 'Invalid order type' }, { status: 400 });
      }
      
      if (leverage < 1 || leverage > 125) {
        return Response.json({ success: false, error: 'Leverage must be between 1 and 125' }, { status: 400 });
      }
      
      const accounts = await base44.entities.TradingAccount.filter({ 
        id: tradingAccountId, 
        user_id: user.id 
      });
      
      if (!accounts?.length) {
        return Response.json({ success: false, error: 'Account not found' }, { status: 404 });
      }
      
      const account = accounts[0];
      
      // Calculate slippage for market orders
      let actualEntryPrice = entryPrice;
      let actualSlippage = 0;
      
      if (orderType === 'MARKET') {
        actualSlippage = calculateSlippage(quantity * entryPrice, maxSlippage);
        
        if (actualSlippage > maxSlippage) {
          return Response.json({ 
            success: false, 
            error: `Slippage ${actualSlippage.toFixed(2)}% exceeds maximum ${maxSlippage}%` 
          }, { status: 400 });
        }
        
        // Apply slippage
        if (side === 'LONG') {
          actualEntryPrice = entryPrice * (1 + actualSlippage / 100);
        } else {
          actualEntryPrice = entryPrice * (1 - actualSlippage / 100);
        }
      }
      
      // Calculate margin and fees
      const notionalValue = quantity * actualEntryPrice;
      const marginRequired = notionalValue / leverage;
      const tradingFee = notionalValue * TRADING_FEES.taker / 100;
      const totalRequired = marginRequired + tradingFee;
      
      // Calculate liquidation price
      const liquidationPrice = calculateLiquidationPrice(actualEntryPrice, leverage, side);
      
      // Get available balance
      let availableBalance = 0;
      let useWallet = null;
      
      if (account.is_demo) {
        availableBalance = account.demo_balance - account.margin_used;
      } else {
        if (!walletId) {
          // Get primary wallet
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
      
      // Margin validation - prevent over-leveraging
      const maxPositionValue = availableBalance * leverage;
      if (notionalValue > maxPositionValue) {
        return Response.json({ 
          success: false, 
          error: `Position too large. Max position: $${maxPositionValue.toFixed(2)} with ${leverage}x leverage` 
        }, { status: 400 });
      }
      
      if (totalRequired > availableBalance) {
        return Response.json({ 
          success: false, 
          error: `Insufficient balance. Required: $${totalRequired.toFixed(2)} (margin: $${marginRequired.toFixed(2)} + fee: $${tradingFee.toFixed(2)}), Available: $${availableBalance.toFixed(2)}` 
        }, { status: 400 });
      }
      
      // Create trade
      const trade = await base44.asServiceRole.entities.Trade.create({
        trading_account_id: tradingAccountId,
        wallet_id: useWallet?.id || null,
        user_id: user.id,
        symbol,
        side,
        order_type: orderType,
        entry_price: actualEntryPrice,
        limit_price: orderType === 'LIMIT' ? limitPrice : null,
        quantity,
        leverage,
        margin: marginRequired,
        status: orderType === 'LIMIT' ? 'PENDING' : 'OPEN',
        fees: tradingFee,
        slippage: actualSlippage,
        max_slippage: maxSlippage,
        liquidation_price: liquidationPrice,
        stop_loss: stopLoss || null,
        take_profit: takeProfit || null
      });
      
      // Deduct margin and fees
      if (account.is_demo) {
        await base44.asServiceRole.entities.TradingAccount.update(tradingAccountId, {
          demo_balance: account.demo_balance - totalRequired,
          balance: account.demo_balance - totalRequired,
          margin_used: account.margin_used + marginRequired,
          total_trades: account.total_trades + 1
        });
      } else {
        // Create wallet transactions
        await base44.asServiceRole.entities.WalletTransaction.create({
          wallet_id: useWallet.id,
          user_id: user.id,
          type: 'trade_margin',
          amount: -marginRequired,
          currency: useWallet.currency,
          network: useWallet.network,
          status: 'completed',
          reference_id: trade.id,
          notes: `Margin locked for ${symbol} ${side} trade`
        });
        
        await base44.asServiceRole.entities.WalletTransaction.create({
          wallet_id: useWallet.id,
          user_id: user.id,
          type: 'fee',
          amount: -tradingFee,
          currency: useWallet.currency,
          network: useWallet.network,
          status: 'completed',
          reference_id: trade.id,
          notes: `Trading fee for ${symbol}`
        });
        
        await base44.asServiceRole.entities.Wallet.update(useWallet.id, {
          balance: useWallet.balance - totalRequired
        });
        
        await base44.asServiceRole.entities.TradingAccount.update(tradingAccountId, {
          balance: account.balance - totalRequired,
          margin_used: account.margin_used + marginRequired,
          total_trades: account.total_trades + 1
        });
      }
      
      audit('TRADE_OPENED', user.id, { 
        tradeId: trade.id, symbol, side, quantity, 
        entryPrice: actualEntryPrice, 
        marginRequired, tradingFee, 
        slippage: actualSlippage,
        liquidationPrice
      });
      
      return Response.json({ 
        success: true, 
        data: {
          ...trade,
          actualSlippage,
          tradingFee,
          liquidationPrice
        }
      });
    }

    // CLOSE TRADE (with fees and funding calculation)
    if (action === 'closeTrade') {
      const { tradeId, exitPrice, reason = 'manual' } = params;
      
      if (!tradeId || !exitPrice) {
        return Response.json({ success: false, error: 'Missing tradeId or exitPrice' }, { status: 400 });
      }
      
      const trades = await base44.entities.Trade.filter({ 
        id: tradeId, 
        user_id: user.id,
        status: 'OPEN'
      });
      
      if (!trades?.length) {
        return Response.json({ success: false, error: 'Trade not found or already closed' }, { status: 404 });
      }
      
      const trade = trades[0];
      
      // Calculate closing slippage
      const closingSlippage = calculateSlippage(trade.quantity * exitPrice, trade.max_slippage || 0.5);
      let actualExitPrice = exitPrice;
      
      if (trade.side === 'LONG') {
        actualExitPrice = exitPrice * (1 - closingSlippage / 100);
      } else {
        actualExitPrice = exitPrice * (1 + closingSlippage / 100);
      }
      
      // Calculate PnL
      let grossPnl = 0;
      if (trade.side === 'LONG') {
        grossPnl = (actualExitPrice - trade.entry_price) * trade.quantity;
      } else {
        grossPnl = (trade.entry_price - actualExitPrice) * trade.quantity;
      }
      
      // Calculate closing fee
      const notionalValue = trade.quantity * actualExitPrice;
      const closingFee = notionalValue * TRADING_FEES.taker / 100;
      
      // Calculate funding fees (simulated based on holding time)
      const holdingHours = (Date.now() - new Date(trade.created_date).getTime()) / (1000 * 60 * 60);
      const fundingRate = 0.01; // 0.01% per 8 hours
      const fundingPeriods = Math.floor(holdingHours / 8);
      const fundingFees = notionalValue * (fundingRate / 100) * fundingPeriods;
      
      // Net PnL after all fees
      const totalFees = (trade.fees || 0) + closingFee + fundingFees;
      const netPnl = grossPnl - closingFee - fundingFees;
      const pnlPercent = (netPnl / trade.margin) * 100;
      const isWinning = netPnl > 0;
      
      // Update trade
      await base44.asServiceRole.entities.Trade.update(tradeId, {
        exit_price: actualExitPrice,
        status: 'CLOSED',
        pnl: netPnl,
        pnl_percent: pnlPercent,
        fees: totalFees,
        funding_fees: fundingFees,
        slippage: trade.slippage + closingSlippage,
        closed_at: new Date().toISOString(),
        close_reason: reason
      });
      
      // Return margin + PnL to account
      const returnAmount = trade.margin + netPnl;
      
      const accounts = await base44.entities.TradingAccount.filter({ id: trade.trading_account_id });
      
      if (accounts?.length) {
        const account = accounts[0];
        const newRealizedPnl = account.realized_pnl + netPnl;
        const newWinningTrades = isWinning ? account.winning_trades + 1 : account.winning_trades;
        
        if (account.is_demo) {
          const newDemoBalance = account.demo_balance + returnAmount;
          await base44.asServiceRole.entities.TradingAccount.update(trade.trading_account_id, {
            demo_balance: newDemoBalance,
            balance: newDemoBalance,
            equity: newDemoBalance,
            margin_used: Math.max(0, account.margin_used - trade.margin),
            realized_pnl: newRealizedPnl,
            winning_trades: newWinningTrades
          });
        } else {
          // Update wallet
          if (trade.wallet_id) {
            const wallets = await base44.entities.Wallet.filter({ id: trade.wallet_id });
            if (wallets?.length) {
              const wallet = wallets[0];
              
              await base44.asServiceRole.entities.WalletTransaction.create({
                wallet_id: wallet.id,
                user_id: user.id,
                type: 'trade_pnl',
                amount: returnAmount,
                fee: closingFee + fundingFees,
                currency: wallet.currency,
                network: wallet.network,
                status: 'completed',
                reference_id: trade.id,
                notes: `Closed ${trade.symbol} ${trade.side}: ${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)} USDT (fees: ${totalFees.toFixed(2)})`
              });
              
              await base44.asServiceRole.entities.Wallet.update(wallet.id, {
                balance: wallet.balance + returnAmount
              });
            }
          }
          
          const newBalance = account.balance + returnAmount;
          await base44.asServiceRole.entities.TradingAccount.update(trade.trading_account_id, {
            balance: newBalance,
            equity: newBalance + account.unrealized_pnl,
            margin_used: Math.max(0, account.margin_used - trade.margin),
            realized_pnl: newRealizedPnl,
            winning_trades: newWinningTrades
          });
        }
      }
      
      audit('TRADE_CLOSED', user.id, { 
        tradeId, 
        exitPrice: actualExitPrice, 
        grossPnl,
        netPnl, 
        totalFees,
        fundingFees,
        reason 
      });
      
      return Response.json({ 
        success: true, 
        data: { 
          tradeId, 
          pnl: netPnl,
          grossPnl,
          pnlPercent,
          fees: totalFees,
          fundingFees,
          exitPrice: actualExitPrice 
        } 
      });
    }

    // GET TRADES
    if (action === 'getTrades') {
      const { tradingAccountId, status, limit = 50 } = params;
      
      let query = { user_id: user.id };
      if (tradingAccountId) query.trading_account_id = tradingAccountId;
      if (status) query.status = status;
      
      const trades = await base44.entities.Trade.filter(query, '-created_date', limit);
      return Response.json({ success: true, data: trades || [] });
    }

    // GET OPEN POSITIONS
    if (action === 'getOpenPositions') {
      const trades = await base44.entities.Trade.filter({ 
        user_id: user.id,
        status: 'OPEN'
      });
      return Response.json({ success: true, data: trades || [] });
    }

    // CANCEL PENDING ORDER
    if (action === 'cancelOrder') {
      const { tradeId } = params;
      
      const trades = await base44.entities.Trade.filter({ 
        id: tradeId, 
        user_id: user.id,
        status: 'PENDING'
      });
      
      if (!trades?.length) {
        return Response.json({ success: false, error: 'Pending order not found' }, { status: 404 });
      }
      
      const trade = trades[0];
      
      // Return locked margin
      const accounts = await base44.entities.TradingAccount.filter({ id: trade.trading_account_id });
      if (accounts?.length) {
        const account = accounts[0];
        
        if (account.is_demo) {
          await base44.asServiceRole.entities.TradingAccount.update(trade.trading_account_id, {
            demo_balance: account.demo_balance + trade.margin + trade.fees,
            balance: account.balance + trade.margin + trade.fees,
            margin_used: Math.max(0, account.margin_used - trade.margin)
          });
        } else if (trade.wallet_id) {
          const wallets = await base44.entities.Wallet.filter({ id: trade.wallet_id });
          if (wallets?.length) {
            await base44.asServiceRole.entities.Wallet.update(trade.wallet_id, {
              balance: wallets[0].balance + trade.margin + trade.fees
            });
          }
          await base44.asServiceRole.entities.TradingAccount.update(trade.trading_account_id, {
            balance: account.balance + trade.margin + trade.fees,
            margin_used: Math.max(0, account.margin_used - trade.margin)
          });
        }
      }
      
      await base44.asServiceRole.entities.Trade.update(tradeId, {
        status: 'CANCELLED',
        close_reason: 'cancelled'
      });
      
      audit('ORDER_CANCELLED', user.id, { tradeId });
      
      return Response.json({ success: true });
    }

    // LIST USER ACCOUNTS
    if (action === 'list') {
      const accounts = await base44.entities.TradingAccount.filter({ user_id: user.id });
      return Response.json({ success: true, data: accounts || [] });
    }

    return Response.json({ success: false, error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('[TRADING_ACCOUNT_ERROR]', error.message, error.stack);
    return Response.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
});