import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Generate unique ID
const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Audit logger
const audit = (action, userId, data) => {
  console.log(`[AUDIT] [${new Date().toISOString()}] ${action} | User: ${userId}`, JSON.stringify(data));
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
      
      // Check if user has trading account of this type
      let accounts = await base44.entities.TradingAccount.filter({ 
        user_id: user.id,
        account_type: accountType
      });
      
      if (!accounts || accounts.length === 0) {
        // Create new trading account
        const accountId = `TA_${accountType}_${user.id.substring(0, 8)}_${Date.now()}`;
        const isDemo = accountType === 'demo';
        
        const newAccount = await base44.asServiceRole.entities.TradingAccount.create({
          account_id: accountId,
          user_id: user.id,
          user_email: user.email,
          nickname: params.nickname || (isDemo ? 'Demo Account' : 'Mentor Account'),
          account_type: accountType,
          balance: isDemo ? 10000 : 0, // Demo gets starting balance, mentor starts at 0
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
        
        // For mentor accounts, also create a wallet
        let wallet = null;
        if (!isDemo) {
          try {
            const walletId = `W_${generateId()}`;
            wallet = await base44.asServiceRole.entities.Wallet.create({
              wallet_id: walletId,
              trading_account_id: newAccount.id,
              user_id: user.id,
              currency: 'USDTTRC20',
              balance: 0,
              status: 'active',
              total_deposited: 0,
              total_withdrawn: 0
            });
            audit('WALLET_AUTO_CREATED', user.id, { walletId, accountId });
          } catch (err) {
            console.error('Failed to auto-create wallet:', err.message);
          }
        }
        
        return Response.json({ 
          success: true, 
          data: newAccount,
          wallet,
          isNew: true
        });
      }
      
      // Get wallet for mentor account
      let wallet = null;
      if (accountType === 'mentor') {
        const wallets = await base44.entities.Wallet.filter({
          trading_account_id: accounts[0].id,
          user_id: user.id
        });
        if (wallets && wallets.length > 0) {
          wallet = wallets[0];
        }
      }
      
      return Response.json({ 
        success: true, 
        data: accounts[0],
        wallet,
        isNew: false
      });
    }
    
    // GET ALL USER ACCOUNTS (both demo and mentor)
    if (action === 'getAllAccounts') {
      const accounts = await base44.entities.TradingAccount.filter({ user_id: user.id });
      
      // Get wallets for each account
      const accountsWithWallets = await Promise.all((accounts || []).map(async (account) => {
        if (account.account_type === 'mentor') {
          const wallets = await base44.entities.Wallet.filter({
            trading_account_id: account.id,
            user_id: user.id
          });
          return { ...account, wallet: wallets?.[0] || null };
        }
        return { ...account, wallet: null };
      }));
      
      return Response.json({ success: true, data: accountsWithWallets });
    }

    // LIST USER ACCOUNTS
    if (action === 'list') {
      const accounts = await base44.entities.TradingAccount.filter({ user_id: user.id });
      return Response.json({ success: true, data: accounts || [] });
    }

    // UPDATE ACCOUNT
    if (action === 'update') {
      const { accountId, updates } = params;
      
      // Verify ownership
      const accounts = await base44.entities.TradingAccount.filter({ 
        id: accountId, 
        user_id: user.id 
      });
      
      if (!accounts || accounts.length === 0) {
        return Response.json({ success: false, error: 'Account not found' }, { status: 404 });
      }
      
      // Only allow certain fields to be updated
      const allowedFields = ['nickname', 'default_leverage'];
      const safeUpdates = {};
      for (const key of allowedFields) {
        if (updates[key] !== undefined) safeUpdates[key] = updates[key];
      }
      
      await base44.asServiceRole.entities.TradingAccount.update(accountId, safeUpdates);
      audit('ACCOUNT_UPDATED', user.id, { accountId, updates: safeUpdates });
      
      return Response.json({ success: true });
    }

    // OPEN TRADE
    if (action === 'openTrade') {
      const { tradingAccountId, symbol, side, quantity, leverage = 10, entryPrice, stopLoss, takeProfit } = params;
      
      // Validate inputs
      if (!tradingAccountId || !symbol || !side || !quantity || !entryPrice) {
        return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }
      
      if (!['LONG', 'SHORT'].includes(side)) {
        return Response.json({ success: false, error: 'Invalid side' }, { status: 400 });
      }
      
      // Get account and verify ownership
      const accounts = await base44.entities.TradingAccount.filter({ 
        id: tradingAccountId, 
        user_id: user.id 
      });
      
      if (!accounts || accounts.length === 0) {
        return Response.json({ success: false, error: 'Account not found' }, { status: 404 });
      }
      
      const account = accounts[0];
      
      // Calculate margin required
      const notionalValue = quantity * entryPrice;
      const marginRequired = notionalValue / leverage;
      
      // Check if enough balance
      if (marginRequired > account.balance) {
        return Response.json({ 
          success: false, 
          error: `Insufficient balance. Required: $${marginRequired.toFixed(2)}, Available: $${account.balance.toFixed(2)}` 
        }, { status: 400 });
      }
      
      // Create trade
      const tradeId = `TR_${generateId()}`;
      const trade = await base44.asServiceRole.entities.Trade.create({
        trade_id: tradeId,
        trading_account_id: tradingAccountId,
        user_id: user.id,
        symbol,
        side,
        entry_price: entryPrice,
        quantity,
        leverage,
        margin: marginRequired,
        status: 'OPEN',
        pnl: 0,
        pnl_percent: 0,
        stop_loss: stopLoss || null,
        take_profit: takeProfit || null
      });
      
      // Update account balance and margin
      await base44.asServiceRole.entities.TradingAccount.update(tradingAccountId, {
        balance: account.balance - marginRequired,
        margin_used: account.margin_used + marginRequired,
        total_trades: account.total_trades + 1
      });
      
      audit('TRADE_OPENED', user.id, { 
        tradeId, 
        symbol, 
        side, 
        quantity, 
        entryPrice, 
        marginRequired 
      });
      
      return Response.json({ success: true, data: trade });
    }

    // CLOSE TRADE
    if (action === 'closeTrade') {
      const { tradeId, exitPrice, reason = 'manual' } = params;
      
      if (!tradeId || !exitPrice) {
        return Response.json({ success: false, error: 'Missing tradeId or exitPrice' }, { status: 400 });
      }
      
      // Get trade and verify ownership
      const trades = await base44.entities.Trade.filter({ 
        id: tradeId, 
        user_id: user.id,
        status: 'OPEN'
      });
      
      if (!trades || trades.length === 0) {
        return Response.json({ success: false, error: 'Trade not found or already closed' }, { status: 404 });
      }
      
      const trade = trades[0];
      
      // Calculate PnL
      let pnl = 0;
      const notionalValue = trade.quantity * trade.entry_price;
      
      if (trade.side === 'LONG') {
        pnl = (exitPrice - trade.entry_price) * trade.quantity;
      } else {
        pnl = (trade.entry_price - exitPrice) * trade.quantity;
      }
      
      const pnlPercent = (pnl / trade.margin) * 100;
      const isWinning = pnl > 0;
      
      // Update trade
      await base44.asServiceRole.entities.Trade.update(tradeId, {
        exit_price: exitPrice,
        status: 'CLOSED',
        pnl,
        pnl_percent: pnlPercent,
        closed_at: new Date().toISOString(),
        close_reason: reason
      });
      
      // Get account
      const accounts = await base44.entities.TradingAccount.filter({ 
        id: trade.trading_account_id 
      });
      
      if (accounts && accounts.length > 0) {
        const account = accounts[0];
        
        // Return margin + PnL to balance
        const newBalance = account.balance + trade.margin + pnl;
        const newRealizedPnl = account.realized_pnl + pnl;
        const newWinningTrades = isWinning ? account.winning_trades + 1 : account.winning_trades;
        
        await base44.asServiceRole.entities.TradingAccount.update(trade.trading_account_id, {
          balance: newBalance,
          equity: newBalance + account.unrealized_pnl,
          margin_used: Math.max(0, account.margin_used - trade.margin),
          realized_pnl: newRealizedPnl,
          winning_trades: newWinningTrades
        });
      }
      
      audit('TRADE_CLOSED', user.id, { 
        tradeId, 
        exitPrice, 
        pnl, 
        pnlPercent,
        reason 
      });
      
      return Response.json({ 
        success: true, 
        data: { 
          tradeId, 
          pnl, 
          pnlPercent,
          exitPrice 
        } 
      });
    }

    // GET TRADES
    if (action === 'getTrades') {
      const { tradingAccountId, status } = params;
      
      const query = { user_id: user.id };
      if (tradingAccountId) query.trading_account_id = tradingAccountId;
      if (status) query.status = status;
      
      const trades = await base44.entities.Trade.filter(query);
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

    return Response.json({ success: false, error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('[TRADING_ACCOUNT_ERROR]', error.message, error.stack);
    return Response.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});