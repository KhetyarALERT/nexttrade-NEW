import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const NOWPAYMENTS_API_KEY = Deno.env.get("NOWPAYMENTS_API_KEY");
const NOWPAYMENTS_BASE_URL = "https://api.nowpayments.io/v1";

// Supported currencies and networks with NOWPayments tickers
const SUPPORTED_CURRENCIES = [
  { currency: 'USDT', network: 'TRC20', nowpaymentsCurrency: 'usdttrc20', minDeposit: 10, minWithdraw: 20, withdrawFee: 1 },
  { currency: 'USDT', network: 'ERC20', nowpaymentsCurrency: 'usdterc20', minDeposit: 50, minWithdraw: 100, withdrawFee: 15 },
  { currency: 'USDT', network: 'BEP20', nowpaymentsCurrency: 'usdtbsc', minDeposit: 10, minWithdraw: 20, withdrawFee: 0.5 },
  { currency: 'BTC', network: 'BTC', nowpaymentsCurrency: 'btc', minDeposit: 0.0001, minWithdraw: 0.0005, withdrawFee: 0.0001 },
  { currency: 'ETH', network: 'ERC20', nowpaymentsCurrency: 'eth', minDeposit: 0.01, minWithdraw: 0.02, withdrawFee: 0.005 },
  { currency: 'BNB', network: 'BEP20', nowpaymentsCurrency: 'bnbbsc', minDeposit: 0.01, minWithdraw: 0.05, withdrawFee: 0.001 },
  { currency: 'SOL', network: 'SOL', nowpaymentsCurrency: 'sol', minDeposit: 0.1, minWithdraw: 0.5, withdrawFee: 0.01 },
  { currency: 'XRP', network: 'XRP', nowpaymentsCurrency: 'xrp', minDeposit: 10, minWithdraw: 25, withdrawFee: 0.1 },
  { currency: 'TRX', network: 'TRC20', nowpaymentsCurrency: 'trx', minDeposit: 50, minWithdraw: 100, withdrawFee: 1 }
];

const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const audit = (action, userId, data) => {
  console.log(`[WALLET_AUDIT] [${new Date().toISOString()}] ${action} | User: ${userId}`, JSON.stringify(data));
};

// NOWPayments API helper
const nowPaymentsRequest = async (endpoint, method = 'GET', body = null, authToken = null) => {
  if (!NOWPAYMENTS_API_KEY) {
    throw new Error('NOWPayments API key not configured');
  }
  
  const headers = {
    'x-api-key': NOWPAYMENTS_API_KEY,
    'Content-Type': 'application/json'
  };
  
  // Add JWT token for payout endpoints
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  
  console.log(`[NOWPAYMENTS] ${method} ${endpoint}`);
  const response = await fetch(`${NOWPAYMENTS_BASE_URL}${endpoint}`, options);
  const data = await response.json();
  
  if (!response.ok) {
    console.error('[NOWPAYMENTS_ERROR]', data);
    throw new Error(data.message || data.error || `NOWPayments API error: ${response.status}`);
  }
  
  return data;
};

// Get JWT token for payout operations
const getPayoutAuthToken = async () => {
  const email = Deno.env.get("NOWPAYMENTS_EMAIL");
  const password = Deno.env.get("NOWPAYMENTS_PASSWORD");
  
  if (!email || !password) {
    // If no credentials, payouts will require manual verification
    return null;
  }
  
  try {
    const response = await fetch(`${NOWPAYMENTS_BASE_URL}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    return data.token;
  } catch (err) {
    console.error('[NOWPAYMENTS_AUTH_ERROR]', err.message);
    return null;
  }
};

// Validate withdrawal address
const validateAddress = async (address, currency) => {
  try {
    const result = await nowPaymentsRequest('/payout/validate-address', 'POST', {
      address,
      currency,
      extra_id: null
    });
    return result.status !== false;
  } catch (err) {
    // If validation fails, we might still allow it but warn
    console.warn('[ADDRESS_VALIDATION]', err.message);
    return true; // Allow by default, NOWPayments will reject invalid addresses
  }
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

    // CHECK NOWPAYMENTS STATUS
    if (action === 'checkStatus') {
      try {
        const status = await nowPaymentsRequest('/status');
        return Response.json({ success: true, data: status });
      } catch (err) {
        return Response.json({ success: false, error: err.message });
      }
    }

    // GET AVAILABLE CURRENCIES FROM NOWPAYMENTS
    if (action === 'getAvailableCurrencies') {
      try {
        const currencies = await nowPaymentsRequest('/currencies');
        return Response.json({ success: true, data: currencies });
      } catch (err) {
        return Response.json({ success: false, error: err.message });
      }
    }

    // GET MINIMUM PAYMENT AMOUNT
    if (action === 'getMinAmount') {
      const { currency } = params;
      try {
        const result = await nowPaymentsRequest(`/min-amount?currency_from=${currency}&currency_to=usd`);
        return Response.json({ success: true, data: result });
      } catch (err) {
        return Response.json({ success: false, error: err.message });
      }
    }

    // CREATE WALLET
    if (action === 'create') {
      const { tradingAccountId, currency = 'USDT', network = 'TRC20' } = params;
      
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
      
      const existingWallets = await base44.entities.Wallet.filter({
        trading_account_id: tradingAccountId,
        currency,
        network
      });
      
      if (existingWallets?.length) {
        return Response.json({ success: true, data: existingWallets[0], existing: true });
      }
      
      const allWallets = await base44.entities.Wallet.filter({ trading_account_id: tradingAccountId });
      const isPrimary = !allWallets?.length;
      
      const wallet = await base44.asServiceRole.entities.Wallet.create({
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
      
      audit('WALLET_CREATED', user.id, { walletId: wallet.id, currency, network });
      return Response.json({ success: true, data: wallet });
    }

    // CREATE ALL SUPPORTED WALLETS
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
        
        const wallet = await base44.asServiceRole.entities.Wallet.create({
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
          is_primary: createdWallets.length === 0 && curr.currency === 'USDT' && curr.network === 'TRC20'
        });
        
        createdWallets.push(wallet);
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

    // GET DEPOSIT ADDRESS (creates NOWPayments invoice)
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
        // Create payment/invoice via NOWPayments
        const paymentData = await nowPaymentsRequest('/invoice', 'POST', {
          price_amount: parseFloat(amount) || 100,
          price_currency: 'usd',
          pay_currency: currencyConfig.nowpaymentsCurrency,
          order_id: `deposit_${wallet.id}_${Date.now()}`,
          order_description: `Deposit ${wallet.currency} (${wallet.network}) to NextTrade wallet`,
          ipn_callback_url: `${appUrl}/api/functions/walletWebhook`,
          success_url: `${appUrl}/Profile?tab=wallet&deposit=success`,
          cancel_url: `${appUrl}/Profile?tab=wallet&deposit=cancelled`
        });
        
        await base44.asServiceRole.entities.Wallet.update(walletId, {
          nowpayments_payment_id: String(paymentData.id),
          deposit_address: paymentData.pay_address || null,
          address_generated_at: new Date().toISOString()
        });
        
        audit('DEPOSIT_INVOICE_CREATED', user.id, { walletId, invoiceId: paymentData.id });
        
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

    // VALIDATE WITHDRAWAL ADDRESS
    if (action === 'validateAddress') {
      const { address, currency, network } = params;
      
      if (!address || !currency) {
        return Response.json({ success: false, error: 'Address and currency required' }, { status: 400 });
      }
      
      const currencyConfig = SUPPORTED_CURRENCIES.find(c => 
        c.currency === currency && (!network || c.network === network)
      );
      
      if (!currencyConfig) {
        return Response.json({ success: false, error: 'Unsupported currency' }, { status: 400 });
      }
      
      try {
        const result = await nowPaymentsRequest('/payout/validate-address', 'POST', {
          address,
          currency: currencyConfig.nowpaymentsCurrency,
          extra_id: null
        });
        
        return Response.json({ 
          success: true, 
          data: { 
            valid: result.status !== false,
            message: result.message || 'Address is valid'
          } 
        });
      } catch (err) {
        return Response.json({ 
          success: false, 
          data: { valid: false, message: err.message }
        });
      }
    }

    // WITHDRAW (with proper NOWPayments payout flow)
    if (action === 'withdraw') {
      const { walletId, amount, destinationAddress, extraId } = params;
      
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
      
      if (!currencyConfig) {
        return Response.json({ success: false, error: 'Unsupported currency' }, { status: 400 });
      }
      
      // Check minimum withdrawal
      if (withdrawAmount < currencyConfig.minWithdraw) {
        return Response.json({ 
          success: false, 
          error: `Minimum withdrawal is ${currencyConfig.minWithdraw} ${wallet.currency}` 
        }, { status: 400 });
      }
      
      // Calculate total with fee
      const totalDeduction = withdrawAmount + currencyConfig.withdrawFee;
      const availableBalance = wallet.balance - (wallet.locked_balance || 0);
      
      if (totalDeduction > availableBalance) {
        return Response.json({ 
          success: false, 
          error: `Insufficient balance. Need ${totalDeduction.toFixed(6)} ${wallet.currency} (incl. ${currencyConfig.withdrawFee} fee), Available: ${availableBalance.toFixed(6)} ${wallet.currency}` 
        }, { status: 400 });
      }
      
      // Validate address first
      const isValidAddress = await validateAddress(destinationAddress, currencyConfig.nowpaymentsCurrency);
      if (!isValidAddress) {
        return Response.json({ success: false, error: 'Invalid withdrawal address' }, { status: 400 });
      }
      
      const txId = `TX_W_${generateId()}`;
      const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://app.base44.com';
      
      // Create pending transaction
      const txRecord = await base44.asServiceRole.entities.WalletTransaction.create({
        wallet_id: walletId,
        user_id: user.id,
        type: 'withdrawal',
        amount: -withdrawAmount,
        fee: currencyConfig.withdrawFee,
        currency: wallet.currency,
        network: wallet.network,
        status: 'pending',
        destination_address: destinationAddress,
        notes: 'Withdrawal pending verification'
      });
      
      // Lock the amount
      await base44.asServiceRole.entities.Wallet.update(walletId, {
        locked_balance: (wallet.locked_balance || 0) + totalDeduction
      });
      
      try {
        // Get auth token for payout
        const authToken = await getPayoutAuthToken();
        
        // Create payout via NOWPayments
        const payoutData = await nowPaymentsRequest('/payout', 'POST', {
          payout_description: `NextTrade withdrawal - ${txId}`,
          ipn_callback_url: `${appUrl}/api/functions/walletWebhook`,
          withdrawals: [{
            address: destinationAddress,
            currency: currencyConfig.nowpaymentsCurrency,
            amount: withdrawAmount,
            extra_id: extraId || null,
            unique_external_id: txId,
            ipn_callback_url: `${appUrl}/api/functions/walletWebhook`
          }]
        }, authToken);
        
        const payoutId = payoutData.id || payoutData.withdrawals?.[0]?.id;
        const batchId = payoutData.id;
        
        // Update transaction with payout info
        await base44.asServiceRole.entities.WalletTransaction.update(txRecord.id, {
          nowpayments_id: String(payoutId),
          notes: `Payout created. Batch ID: ${batchId}. Status: ${payoutData.withdrawals?.[0]?.status || 'WAITING'}. Requires verification if 2FA enabled.`
        });
        
        audit('WITHDRAWAL_CREATED', user.id, { 
          walletId, 
          amount: withdrawAmount,
          fee: currencyConfig.withdrawFee,
          payoutId,
          batchId,
          txId: txRecord.id
        });
        
        // Create notification for withdrawal
        try {
          await base44.asServiceRole.entities.Notification.create({
            user_id: user.id,
            type: 'system',
            title: 'Withdrawal Submitted',
            message: `Withdrawal of ${withdrawAmount} ${wallet.currency} has been submitted. Processing may take up to 24 hours.`,
            data: { walletId, amount: withdrawAmount, currency: wallet.currency, transactionId: txRecord.id },
            priority: 'normal'
          });
        } catch (e) {
          console.log('Failed to create notification:', e.message);
        }
        
        return Response.json({ 
          success: true, 
          data: { 
            transactionId: txRecord.id, 
            payoutId,
            batchId,
            status: 'pending',
            message: 'Withdrawal submitted. May require 2FA verification.',
            fee: currencyConfig.withdrawFee
          } 
        });
        
      } catch (err) {
        // Unlock on failure
        await base44.asServiceRole.entities.Wallet.update(walletId, {
          locked_balance: Math.max(0, (wallet.locked_balance || 0))
        });
        
        await base44.asServiceRole.entities.WalletTransaction.update(txRecord.id, {
          status: 'failed',
          notes: `Payout failed: ${err.message}`
        });
        
        return Response.json({ success: false, error: `Withdrawal failed: ${err.message}` }, { status: 500 });
      }
    }

    // GET PAYOUT STATUS
    if (action === 'getPayoutStatus') {
      const { payoutId } = params;
      
      if (!payoutId) {
        return Response.json({ success: false, error: 'Payout ID required' }, { status: 400 });
      }
      
      try {
        const status = await nowPaymentsRequest(`/payout/${payoutId}`);
        return Response.json({ success: true, data: status });
      } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // INTERNAL TRANSFER
    if (action === 'transfer') {
      const { fromWalletId, toWalletId, amount } = params;
      
      if (!fromWalletId || !toWalletId || !amount) {
        return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }
      
      if (fromWalletId === toWalletId) {
        return Response.json({ success: false, error: 'Cannot transfer to same wallet' }, { status: 400 });
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
      
      if (fromWallet.currency !== toWallet.currency) {
        return Response.json({ success: false, error: 'Currency mismatch. Use conversion for different currencies.' }, { status: 400 });
      }
      
      const availableBalance = fromWallet.balance - (fromWallet.locked_balance || 0);
      if (transferAmount > availableBalance) {
        return Response.json({ 
          success: false, 
          error: `Insufficient balance. Available: ${availableBalance.toFixed(6)} ${fromWallet.currency}` 
        }, { status: 400 });
      }
      
      const transferId = `TRF_${generateId()}`;
      
      // Create transactions
      await base44.asServiceRole.entities.WalletTransaction.create({
        wallet_id: fromWalletId,
        user_id: user.id,
        type: 'internal_transfer_out',
        amount: -transferAmount,
        currency: fromWallet.currency,
        network: fromWallet.network,
        status: 'completed',
        reference_id: transferId,
        notes: `Transfer to ${toWallet.currency} (${toWallet.network})`
      });
      
      await base44.asServiceRole.entities.WalletTransaction.create({
        wallet_id: toWalletId,
        user_id: user.id,
        type: 'internal_transfer_in',
        amount: transferAmount,
        currency: toWallet.currency,
        network: toWallet.network,
        status: 'completed',
        reference_id: transferId,
        notes: `Transfer from ${fromWallet.currency} (${fromWallet.network})`
      });
      
      // Update balances
      await base44.asServiceRole.entities.Wallet.update(fromWalletId, {
        balance: fromWallet.balance - transferAmount
      });
      await base44.asServiceRole.entities.Wallet.update(toWalletId, {
        balance: toWallet.balance + transferAmount
      });
      
      // Sync trading account balances
      const fromAccounts = await base44.entities.TradingAccount.filter({ id: fromWallet.trading_account_id });
      const toAccounts = await base44.entities.TradingAccount.filter({ id: toWallet.trading_account_id });
      
      if (fromAccounts?.length && fromWallet.trading_account_id !== toWallet.trading_account_id) {
        const acc = fromAccounts[0];
        await base44.asServiceRole.entities.TradingAccount.update(fromWallet.trading_account_id, {
          balance: Math.max(0, acc.balance - transferAmount),
          equity: Math.max(0, acc.equity - transferAmount)
        });
      }
      if (toAccounts?.length && fromWallet.trading_account_id !== toWallet.trading_account_id) {
        const acc = toAccounts[0];
        await base44.asServiceRole.entities.TradingAccount.update(toWallet.trading_account_id, {
          balance: acc.balance + transferAmount,
          equity: acc.equity + transferAmount
        });
      }
      
      audit('INTERNAL_TRANSFER', user.id, { fromWalletId, toWalletId, amount: transferAmount, transferId });
      
      return Response.json({ success: true, data: { transferId, status: 'completed' } });
    }

    // GET TRANSACTIONS
    if (action === 'getTransactions') {
      const { walletId, type, status, limit = 50, skip = 0 } = params;
      
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
      
      let transactions = await base44.entities.WalletTransaction.filter(query, '-created_date', limit + skip);
      transactions = transactions.slice(skip, skip + limit);
      
      return Response.json({ success: true, data: transactions || [] });
    }

    // STAKE USDT
    if (action === 'stake') {
      const { walletId, amount, lockPeriodDays = 14 } = params;
      
      if (!walletId || !amount) {
        return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }
      
      const stakeAmount = parseFloat(amount);
      if (isNaN(stakeAmount) || stakeAmount < 50) {
        return Response.json({ success: false, error: 'Minimum stake amount is 50 USDT' }, { status: 400 });
      }

      const lockDays = Number(lockPeriodDays);
      if (!Number.isFinite(lockDays) || lockDays < 14) {
        return Response.json({ success: false, error: 'Minimum lock period is 14 days' }, { status: 400 });
      }
      
      const wallets = await base44.entities.Wallet.filter({ id: walletId, user_id: user.id });
      if (!wallets?.length) {
        return Response.json({ success: false, error: 'Wallet not found' }, { status: 404 });
      }
      
      const wallet = wallets[0];
      if (wallet.currency !== 'USDT') {
        return Response.json({ success: false, error: 'Only USDT staking is supported' }, { status: 400 });
      }
      
      const availableBalance = wallet.balance - (wallet.locked_balance || 0);
      if (stakeAmount > availableBalance) {
        return Response.json({ 
          success: false, 
          error: `Insufficient balance. Available: ${availableBalance.toFixed(2)} USDT` 
        }, { status: 400 });
      }
      
      const apyRates = { 14: 18, 30: 28, 49: 40, 75: 58, 120: 75 };
      const apy = apyRates[lockDays] || 18;
      
      const startDate = new Date();
      const unlockDate = new Date(startDate.getTime() + lockDays * 24 * 60 * 60 * 1000);
      
      const position = await base44.asServiceRole.entities.StakingPosition.create({
        wallet_id: walletId,
        user_id: user.id,
        currency: 'USDT',
        amount: stakeAmount,
        apy,
        earned_rewards: 0,
        lock_period_days: lockDays,
        start_date: startDate.toISOString(),
        unlock_date: unlockDate.toISOString(),
        last_reward_date: startDate.toISOString(),
        status: 'active'
      });
      
      await base44.asServiceRole.entities.WalletTransaction.create({
        wallet_id: walletId,
        user_id: user.id,
        type: 'staking_lock',
        amount: -stakeAmount,
        currency: 'USDT',
        status: 'completed',
        reference_id: position.id,
        notes: `Staked ${stakeAmount} USDT for ${lockDays} days at ${apy}% APY`
      });
      
      await base44.asServiceRole.entities.Wallet.update(walletId, {
        staked_balance: (wallet.staked_balance || 0) + stakeAmount
      });
      
      audit('STAKING_CREATED', user.id, { positionId: position.id, amount: stakeAmount, apy, lockPeriodDays: lockDays });
      
      // Create notification for staking
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id,
          type: 'staking_reward',
          title: 'Staking Position Created',
          message: `Staked ${stakeAmount} USDT for ${lockDays} days at ${apy}% APY. Unlock date: ${unlockDate.toLocaleDateString()}`,
          data: { positionId: position.id, amount: stakeAmount, apy, lockPeriodDays: lockDays },
          priority: 'normal'
        });
      } catch (e) {
        console.log('Failed to create notification:', e.message);
      }
      
      return Response.json({ 
        success: true, 
        data: { positionId: position.id, amount: stakeAmount, apy, unlockDate: unlockDate.toISOString() } 
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
      
      let penalty = 0;
      if (now < unlockDate) {
        penalty = (position.earned_rewards || 0) * 0.5;
      }
      
      const totalReturn = position.amount + (position.earned_rewards || 0) - penalty;
      
      const wallets = await base44.entities.Wallet.filter({ id: position.wallet_id });
      if (wallets?.length) {
        const wallet = wallets[0];
        
        await base44.asServiceRole.entities.WalletTransaction.create({
          wallet_id: wallet.id,
          user_id: user.id,
          type: 'staking_unlock',
          amount: totalReturn,
          currency: 'USDT',
          network: wallet.network,
          status: 'completed',
          reference_id: positionId,
          notes: penalty > 0 ? `Early unstake penalty: ${penalty.toFixed(2)} USDT` : `Unstaked ${position.amount} USDT + ${position.earned_rewards || 0} rewards`
        });
        
        await base44.asServiceRole.entities.Wallet.update(wallet.id, {
          balance: wallet.balance + totalReturn,
          staked_balance: Math.max(0, (wallet.staked_balance || 0) - position.amount)
        });
      }
      
      await base44.asServiceRole.entities.StakingPosition.update(positionId, { status: 'completed' });
      
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
      const allWallets = await base44.entities.Wallet.filter({ trading_account_id: wallet.trading_account_id });
      
      for (const w of allWallets || []) {
        if (w.is_primary) {
          await base44.asServiceRole.entities.Wallet.update(w.id, { is_primary: false });
        }
      }
      
      await base44.asServiceRole.entities.Wallet.update(walletId, { is_primary: true });
      
      return Response.json({ success: true });
    }

    // GET ESTIMATED PRICE
    if (action === 'getEstimate') {
      const { amount, currencyFrom, currencyTo } = params;
      
      try {
        const estimate = await nowPaymentsRequest(
          `/estimate?amount=${amount}&currency_from=${currencyFrom}&currency_to=${currencyTo}`
        );
        return Response.json({ success: true, data: estimate });
      } catch (err) {
        return Response.json({ success: false, error: err.message });
      }
    }

    return Response.json({ success: false, error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('[WALLET_ERROR]', error.message, error.stack);
    return Response.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
});