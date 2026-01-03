import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const NOWPAYMENTS_API_KEY = Deno.env.get("NOWPAYMENTS_API_KEY");
const NOWPAYMENTS_BASE_URL = "https://api.nowpayments.io/v1";

// Supported currencies and networks
const SUPPORTED_CURRENCIES = [
  { currency: 'USDT', network: 'TRC20', nowpaymentsCurrency: 'usdttrc20', minDeposit: 10, minWithdraw: 20 },
  { currency: 'USDT', network: 'ERC20', nowpaymentsCurrency: 'usdterc20', minDeposit: 50, minWithdraw: 100 },
  { currency: 'USDT', network: 'BEP20', nowpaymentsCurrency: 'usdtbsc', minDeposit: 10, minWithdraw: 20 },
  { currency: 'BTC', network: 'BTC', nowpaymentsCurrency: 'btc', minDeposit: 0.0001, minWithdraw: 0.0005 },
  { currency: 'ETH', network: 'ERC20', nowpaymentsCurrency: 'eth', minDeposit: 0.01, minWithdraw: 0.02 },
  { currency: 'BNB', network: 'BEP20', nowpaymentsCurrency: 'bnbbsc', minDeposit: 0.01, minWithdraw: 0.05 },
  { currency: 'SOL', network: 'SOL', nowpaymentsCurrency: 'sol', minDeposit: 0.1, minWithdraw: 0.5 },
  { currency: 'XRP', network: 'XRP', nowpaymentsCurrency: 'xrp', minDeposit: 10, minWithdraw: 25 }
];

const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const audit = (action, userId, data) => {
  console.log(`[WALLET_AUDIT] [${new Date().toISOString()}] ${action} | User: ${userId}`, JSON.stringify(data));
};

const nowPaymentsRequest = async (endpoint, method = 'GET', body = null) => {
  if (!NOWPAYMENTS_API_KEY) {
    throw new Error('NOWPayments API key not configured');
  }
  
  const options = {
    method,
    headers: {
      'x-api-key': NOWPAYMENTS_API_KEY,
      'Content-Type': 'application/json'
    }
  };
  
  if (body) options.body = JSON.stringify(body);
  
  console.log(`[NOWPAYMENTS] ${method} ${endpoint}`);
  const response = await fetch(`${NOWPAYMENTS_BASE_URL}${endpoint}`, options);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || data.error || `NOWPayments API error: ${response.status}`);
  }
  
  return data;
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
    
    console.log('[WALLET]', { action, userId: user.id });

    // GET SUPPORTED CURRENCIES
    if (action === 'getSupportedCurrencies') {
      return Response.json({ success: true, data: SUPPORTED_CURRENCIES });
    }

    // CREATE WALLET
    if (action === 'create') {
      const { tradingAccountId, currency = 'USDT', network = 'TRC20' } = params;
      
      if (!tradingAccountId) {
        return Response.json({ success: false, error: 'Trading account ID required' }, { status: 400 });
      }
      
      // Verify trading account ownership
      const accounts = await base44.entities.TradingAccount.filter({ 
        id: tradingAccountId, 
        user_id: user.id 
      });
      
      if (!accounts?.length) {
        return Response.json({ success: false, error: 'Trading account not found' }, { status: 404 });
      }
      
      // Check if wallet already exists
      const existingWallets = await base44.entities.Wallet.filter({
        trading_account_id: tradingAccountId,
        currency,
        network
      });
      
      if (existingWallets?.length) {
        return Response.json({ success: true, data: existingWallets[0], existing: true });
      }
      
      // Check if this is the first wallet (make it primary)
      const allWallets = await base44.entities.Wallet.filter({ trading_account_id: tradingAccountId });
      const isPrimary = !allWallets?.length;
      
      const walletId = `W_${generateId()}`;
      const wallet = await base44.asServiceRole.entities.Wallet.create({
        wallet_id: walletId,
        trading_account_id: tradingAccountId,
        user_id: user.id,
        currency,
        network,
        balance: 0,
        locked_balance: 0,
        staked_balance: 0,
        status: 'active',
        total_deposited: 0,
        total_withdrawn: 0,
        is_primary: isPrimary
      });
      
      audit('WALLET_CREATED', user.id, { walletId, currency, network });
      
      return Response.json({ success: true, data: wallet });
    }

    // CREATE MULTIPLE WALLETS (all supported currencies)
    if (action === 'createAll') {
      const { tradingAccountId } = params;
      
      if (!tradingAccountId) {
        return Response.json({ success: false, error: 'Trading account ID required' }, { status: 400 });
      }
      
      const accounts = await base44.entities.TradingAccount.filter({ 
        id: tradingAccountId, 
        user_id: user.id 
      });
      
      if (!accounts?.length) {
        return Response.json({ success: false, error: 'Trading account not found' }, { status: 404 });
      }
      
      const createdWallets = [];
      let isFirst = true;
      
      for (const curr of SUPPORTED_CURRENCIES) {
        const existing = await base44.entities.Wallet.filter({
          trading_account_id: tradingAccountId,
          currency: curr.currency,
          network: curr.network
        });
        
        if (existing?.length) {
          createdWallets.push(existing[0]);
          continue;
        }
        
        const walletId = `W_${generateId()}`;
        const wallet = await base44.asServiceRole.entities.Wallet.create({
          wallet_id: walletId,
          trading_account_id: tradingAccountId,
          user_id: user.id,
          currency: curr.currency,
          network: curr.network,
          balance: 0,
          locked_balance: 0,
          staked_balance: 0,
          status: 'active',
          total_deposited: 0,
          total_withdrawn: 0,
          is_primary: isFirst && curr.currency === 'USDT' && curr.network === 'TRC20'
        });
        
        createdWallets.push(wallet);
        isFirst = false;
      }
      
      audit('WALLETS_CREATED_ALL', user.id, { tradingAccountId, count: createdWallets.length });
      
      return Response.json({ success: true, data: createdWallets });
    }

    // LIST USER WALLETS
    if (action === 'list') {
      const { tradingAccountId } = params;
      let query = { user_id: user.id };
      if (tradingAccountId) query.trading_account_id = tradingAccountId;
      
      const wallets = await base44.entities.Wallet.filter(query);
      return Response.json({ success: true, data: wallets || [] });
    }

    // GET DEPOSIT ADDRESS
    if (action === 'getDepositAddress') {
      const { walletId, amount = 100 } = params;
      
      if (!walletId) {
        return Response.json({ success: false, error: 'Wallet ID required' }, { status: 400 });
      }
      
      const wallets = await base44.entities.Wallet.filter({ 
        id: walletId, 
        user_id: user.id 
      });
      
      if (!wallets?.length) {
        return Response.json({ success: false, error: 'Wallet not found' }, { status: 404 });
      }
      
      const wallet = wallets[0];
      const currencyConfig = SUPPORTED_CURRENCIES.find(c => 
        c.currency === wallet.currency && c.network === wallet.network
      );
      
      if (!currencyConfig) {
        return Response.json({ success: false, error: 'Unsupported currency/network' }, { status: 400 });
      }
      
      const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://app.base44.com';
      
      try {
        const paymentData = await nowPaymentsRequest('/invoice', 'POST', {
          price_amount: parseFloat(amount) || 100,
          price_currency: 'usd',
          pay_currency: currencyConfig.nowpaymentsCurrency,
          order_id: `deposit_${wallet.wallet_id}_${Date.now()}`,
          order_description: `Deposit ${wallet.currency} (${wallet.network}) to wallet`,
          ipn_callback_url: `${appUrl}/api/functions/walletWebhook`,
          success_url: `${appUrl}/Profile?tab=wallet&deposit=success`,
          cancel_url: `${appUrl}/Profile?tab=wallet&deposit=cancelled`
        });
        
        await base44.asServiceRole.entities.Wallet.update(walletId, {
          nowpayments_id: paymentData.id,
          deposit_address: paymentData.pay_address || null
        });
        
        audit('DEPOSIT_ADDRESS_GENERATED', user.id, { walletId, invoiceId: paymentData.id });
        
        return Response.json({ 
          success: true, 
          data: {
            invoice_id: paymentData.id,
            invoice_url: paymentData.invoice_url,
            pay_address: paymentData.pay_address,
            pay_currency: paymentData.pay_currency,
            pay_amount: paymentData.pay_amount,
            price_amount: paymentData.price_amount,
            price_currency: paymentData.price_currency,
            expiration_estimate_date: paymentData.expiration_estimate_date,
            min_deposit: currencyConfig.minDeposit
          }
        });
      } catch (err) {
        return Response.json({ success: false, error: `Failed to create deposit: ${err.message}` }, { status: 500 });
      }
    }

    // WITHDRAW
    if (action === 'withdraw') {
      const { walletId, amount, destinationAddress } = params;
      
      if (!walletId || !amount || !destinationAddress) {
        return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }
      
      const withdrawAmount = parseFloat(amount);
      if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
        return Response.json({ success: false, error: 'Invalid amount' }, { status: 400 });
      }
      
      const wallets = await base44.entities.Wallet.filter({ 
        id: walletId, 
        user_id: user.id 
      });
      
      if (!wallets?.length) {
        return Response.json({ success: false, error: 'Wallet not found' }, { status: 404 });
      }
      
      const wallet = wallets[0];
      const currencyConfig = SUPPORTED_CURRENCIES.find(c => 
        c.currency === wallet.currency && c.network === wallet.network
      );
      
      if (withdrawAmount < (currencyConfig?.minWithdraw || 10)) {
        return Response.json({ 
          success: false, 
          error: `Minimum withdrawal is ${currencyConfig?.minWithdraw || 10} ${wallet.currency}` 
        }, { status: 400 });
      }
      
      const availableBalance = wallet.balance - wallet.locked_balance - wallet.staked_balance;
      if (withdrawAmount > availableBalance) {
        return Response.json({ 
          success: false, 
          error: `Insufficient balance. Available: ${availableBalance.toFixed(4)} ${wallet.currency}` 
        }, { status: 400 });
      }
      
      const txId = `TX_W_${generateId()}`;
      await base44.asServiceRole.entities.WalletTransaction.create({
        transaction_id: txId,
        wallet_id: walletId,
        user_id: user.id,
        type: 'withdrawal',
        amount: -withdrawAmount,
        currency: wallet.currency,
        network: wallet.network,
        status: 'pending',
        destination_address: destinationAddress
      });
      
      try {
        const payoutData = await nowPaymentsRequest('/payout', 'POST', {
          withdrawals: [{
            address: destinationAddress,
            currency: currencyConfig.nowpaymentsCurrency,
            amount: withdrawAmount,
            ipn_callback_url: `${Deno.env.get('BASE44_APP_URL') || 'https://app.base44.com'}/api/functions/walletWebhook`
          }]
        });
        
        const txRecords = await base44.asServiceRole.entities.WalletTransaction.filter({ transaction_id: txId });
        if (txRecords?.length) {
          await base44.asServiceRole.entities.WalletTransaction.update(txRecords[0].id, {
            nowpayments_id: payoutData.id || payoutData.withdrawals?.[0]?.id
          });
        }
        
        await base44.asServiceRole.entities.Wallet.update(walletId, {
          balance: wallet.balance - withdrawAmount,
          total_withdrawn: wallet.total_withdrawn + withdrawAmount
        });
        
        audit('WITHDRAWAL_REQUESTED', user.id, { walletId, amount: withdrawAmount, txId });
        
        return Response.json({ success: true, data: { transactionId: txId, status: 'pending' } });
        
      } catch (err) {
        const txRecords = await base44.asServiceRole.entities.WalletTransaction.filter({ transaction_id: txId });
        if (txRecords?.length) {
          await base44.asServiceRole.entities.WalletTransaction.update(txRecords[0].id, {
            status: 'failed',
            notes: err.message
          });
        }
        return Response.json({ success: false, error: `Withdrawal failed: ${err.message}` }, { status: 500 });
      }
    }

    // INTERNAL TRANSFER
    if (action === 'transfer') {
      const { fromWalletId, toWalletId, amount } = params;
      
      if (!fromWalletId || !toWalletId || !amount) {
        return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }
      
      const transferAmount = parseFloat(amount);
      if (isNaN(transferAmount) || transferAmount <= 0) {
        return Response.json({ success: false, error: 'Invalid amount' }, { status: 400 });
      }
      
      const fromWallets = await base44.entities.Wallet.filter({ id: fromWalletId, user_id: user.id });
      const toWallets = await base44.entities.Wallet.filter({ id: toWalletId, user_id: user.id });
      
      if (!fromWallets?.length || !toWallets?.length) {
        return Response.json({ success: false, error: 'Wallet not found' }, { status: 404 });
      }
      
      const fromWallet = fromWallets[0];
      const toWallet = toWallets[0];
      
      // Must be same currency for direct transfer
      if (fromWallet.currency !== toWallet.currency) {
        return Response.json({ success: false, error: 'Currency mismatch. Use conversion for different currencies.' }, { status: 400 });
      }
      
      const availableBalance = fromWallet.balance - fromWallet.locked_balance - fromWallet.staked_balance;
      if (transferAmount > availableBalance) {
        return Response.json({ 
          success: false, 
          error: `Insufficient balance. Available: ${availableBalance.toFixed(4)} ${fromWallet.currency}` 
        }, { status: 400 });
      }
      
      const transferId = `TRF_${generateId()}`;
      
      await base44.asServiceRole.entities.WalletTransaction.create({
        transaction_id: `${transferId}_OUT`,
        wallet_id: fromWalletId,
        user_id: user.id,
        type: 'internal_transfer_out',
        amount: -transferAmount,
        currency: fromWallet.currency,
        status: 'completed',
        reference_id: transferId
      });
      
      await base44.asServiceRole.entities.WalletTransaction.create({
        transaction_id: `${transferId}_IN`,
        wallet_id: toWalletId,
        user_id: user.id,
        type: 'internal_transfer_in',
        amount: transferAmount,
        currency: toWallet.currency,
        status: 'completed',
        reference_id: transferId
      });
      
      await base44.asServiceRole.entities.Wallet.update(fromWalletId, {
        balance: fromWallet.balance - transferAmount
      });
      await base44.asServiceRole.entities.Wallet.update(toWalletId, {
        balance: toWallet.balance + transferAmount
      });
      
      audit('INTERNAL_TRANSFER', user.id, { fromWalletId, toWalletId, amount: transferAmount, transferId });
      
      return Response.json({ success: true, data: { transferId, status: 'completed' } });
    }

    // GET TRANSACTIONS WITH FILTERING
    if (action === 'getTransactions') {
      const { walletId, type, status, startDate, endDate, limit = 50, skip = 0, sortBy = '-created_date' } = params;
      
      let query = { user_id: user.id };
      if (walletId) {
        const wallets = await base44.entities.Wallet.filter({ id: walletId, user_id: user.id });
        if (!wallets?.length) {
          return Response.json({ success: false, error: 'Wallet not found' }, { status: 404 });
        }
        query.wallet_id = walletId;
      }
      if (type) query.type = type;
      if (status) query.status = status;
      
      let transactions = await base44.entities.WalletTransaction.filter(query, sortBy, limit + skip);
      
      // Apply date filtering in memory (Base44 doesn't support date range queries directly)
      if (startDate || endDate) {
        transactions = transactions.filter(tx => {
          const txDate = new Date(tx.created_date);
          if (startDate && txDate < new Date(startDate)) return false;
          if (endDate && txDate > new Date(endDate)) return false;
          return true;
        });
      }
      
      // Apply pagination
      transactions = transactions.slice(skip, skip + limit);
      
      return Response.json({ success: true, data: transactions || [] });
    }

    // STAKE USDT
    if (action === 'stake') {
      const { walletId, amount, lockPeriodDays = 30 } = params;
      
      if (!walletId || !amount) {
        return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }
      
      const stakeAmount = parseFloat(amount);
      if (isNaN(stakeAmount) || stakeAmount < 100) {
        return Response.json({ success: false, error: 'Minimum stake amount is 100 USDT' }, { status: 400 });
      }
      
      const wallets = await base44.entities.Wallet.filter({ id: walletId, user_id: user.id });
      if (!wallets?.length) {
        return Response.json({ success: false, error: 'Wallet not found' }, { status: 404 });
      }
      
      const wallet = wallets[0];
      if (wallet.currency !== 'USDT') {
        return Response.json({ success: false, error: 'Only USDT staking is supported' }, { status: 400 });
      }
      
      const availableBalance = wallet.balance - wallet.locked_balance - wallet.staked_balance;
      if (stakeAmount > availableBalance) {
        return Response.json({ 
          success: false, 
          error: `Insufficient balance. Available: ${availableBalance.toFixed(2)} USDT` 
        }, { status: 400 });
      }
      
      // APY based on lock period
      const apyRates = { 30: 5, 60: 7, 90: 10, 180: 12 };
      const apy = apyRates[lockPeriodDays] || 5;
      
      const positionId = `STK_${generateId()}`;
      const startDate = new Date();
      const unlockDate = new Date(startDate.getTime() + lockPeriodDays * 24 * 60 * 60 * 1000);
      
      await base44.asServiceRole.entities.StakingPosition.create({
        position_id: positionId,
        wallet_id: walletId,
        user_id: user.id,
        currency: 'USDT',
        amount: stakeAmount,
        apy,
        earned_rewards: 0,
        lock_period_days: lockPeriodDays,
        start_date: startDate.toISOString(),
        unlock_date: unlockDate.toISOString(),
        last_reward_date: startDate.toISOString(),
        status: 'active'
      });
      
      await base44.asServiceRole.entities.WalletTransaction.create({
        transaction_id: `TX_STK_${generateId()}`,
        wallet_id: walletId,
        user_id: user.id,
        type: 'staking_lock',
        amount: -stakeAmount,
        currency: 'USDT',
        status: 'completed',
        reference_id: positionId
      });
      
      await base44.asServiceRole.entities.Wallet.update(walletId, {
        staked_balance: wallet.staked_balance + stakeAmount
      });
      
      audit('STAKING_CREATED', user.id, { positionId, amount: stakeAmount, apy, lockPeriodDays });
      
      return Response.json({ 
        success: true, 
        data: { positionId, amount: stakeAmount, apy, unlockDate: unlockDate.toISOString() } 
      });
    }

    // GET STAKING POSITIONS
    if (action === 'getStakingPositions') {
      const positions = await base44.entities.StakingPosition.filter({ user_id: user.id });
      return Response.json({ success: true, data: positions || [] });
    }

    // UNSTAKE
    if (action === 'unstake') {
      const { positionId } = params;
      
      if (!positionId) {
        return Response.json({ success: false, error: 'Position ID required' }, { status: 400 });
      }
      
      const positions = await base44.entities.StakingPosition.filter({ 
        id: positionId, 
        user_id: user.id,
        status: 'active'
      });
      
      if (!positions?.length) {
        return Response.json({ success: false, error: 'Staking position not found' }, { status: 404 });
      }
      
      const position = positions[0];
      const now = new Date();
      const unlockDate = new Date(position.unlock_date);
      
      // Early unstake penalty (50% of rewards)
      let penalty = 0;
      if (now < unlockDate) {
        penalty = position.earned_rewards * 0.5;
      }
      
      const totalReturn = position.amount + position.earned_rewards - penalty;
      
      const wallets = await base44.entities.Wallet.filter({ id: position.wallet_id });
      if (wallets?.length) {
        const wallet = wallets[0];
        
        await base44.asServiceRole.entities.WalletTransaction.create({
          transaction_id: `TX_USTK_${generateId()}`,
          wallet_id: wallet.id,
          user_id: user.id,
          type: 'staking_unlock',
          amount: totalReturn,
          currency: 'USDT',
          status: 'completed',
          reference_id: position.position_id,
          notes: penalty > 0 ? `Early unstake penalty: ${penalty.toFixed(2)} USDT` : null
        });
        
        await base44.asServiceRole.entities.Wallet.update(wallet.id, {
          balance: wallet.balance + totalReturn,
          staked_balance: Math.max(0, wallet.staked_balance - position.amount)
        });
      }
      
      await base44.asServiceRole.entities.StakingPosition.update(positionId, {
        status: 'completed'
      });
      
      audit('STAKING_UNSTAKED', user.id, { positionId, totalReturn, penalty });
      
      return Response.json({ success: true, data: { totalReturn, penalty } });
    }

    // SET PRIMARY WALLET
    if (action === 'setPrimary') {
      const { walletId } = params;
      
      const wallets = await base44.entities.Wallet.filter({ id: walletId, user_id: user.id });
      if (!wallets?.length) {
        return Response.json({ success: false, error: 'Wallet not found' }, { status: 404 });
      }
      
      const wallet = wallets[0];
      
      // Remove primary from other wallets of same account
      const allWallets = await base44.entities.Wallet.filter({ trading_account_id: wallet.trading_account_id });
      for (const w of allWallets || []) {
        if (w.is_primary) {
          await base44.asServiceRole.entities.Wallet.update(w.id, { is_primary: false });
        }
      }
      
      await base44.asServiceRole.entities.Wallet.update(walletId, { is_primary: true });
      
      return Response.json({ success: true });
    }

    return Response.json({ success: false, error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('[WALLET_ERROR]', error.message, error.stack);
    return Response.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
});