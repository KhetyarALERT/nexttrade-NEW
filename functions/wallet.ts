import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const NOWPAYMENTS_API_KEY = Deno.env.get("NOWPAYMENTS_API_KEY");
const NOWPAYMENTS_BASE_URL = "https://api.nowpayments.io/v1";

// Generate unique ID
const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Audit logger
const audit = (action, userId, data) => {
  console.log(`[WALLET_AUDIT] [${new Date().toISOString()}] ${action} | User: ${userId}`, JSON.stringify(data));
};

// NOWPayments API call helper
const nowPaymentsRequest = async (endpoint, method = 'GET', body = null) => {
  const options = {
    method,
    headers: {
      'x-api-key': NOWPAYMENTS_API_KEY,
      'Content-Type': 'application/json'
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${NOWPAYMENTS_BASE_URL}${endpoint}`, options);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || `NOWPayments API error: ${response.status}`);
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

    // CREATE WALLET
    if (action === 'create') {
      const { tradingAccountId, currency = 'USDTTRC20' } = params;
      
      if (!tradingAccountId) {
        return Response.json({ success: false, error: 'Trading account ID required' }, { status: 400 });
      }
      
      // Verify trading account ownership
      const accounts = await base44.entities.TradingAccount.filter({ 
        id: tradingAccountId, 
        user_id: user.id 
      });
      
      if (!accounts || accounts.length === 0) {
        return Response.json({ success: false, error: 'Trading account not found' }, { status: 404 });
      }
      
      // Check if wallet already exists
      const existingWallets = await base44.entities.Wallet.filter({
        trading_account_id: tradingAccountId,
        currency
      });
      
      if (existingWallets && existingWallets.length > 0) {
        return Response.json({ success: true, data: existingWallets[0], existing: true });
      }
      
      // Create NOWPayments payment/invoice for deposit address
      let depositAddress = null;
      let nowpaymentsId = null;
      
      try {
        // Create a payment to get deposit address
        const paymentData = await nowPaymentsRequest('/payment', 'POST', {
          price_amount: 1000000, // Large amount to keep address active
          price_currency: 'usd',
          pay_currency: currency.toLowerCase().replace('trc20', '').replace('erc20', ''),
          order_id: `wallet_${user.id}_${Date.now()}`,
          order_description: `Wallet deposit for user ${user.id}`,
          ipn_callback_url: `${Deno.env.get('BASE44_APP_URL') || 'https://app.base44.com'}/api/functions/walletWebhook`
        });
        
        depositAddress = paymentData.pay_address;
        nowpaymentsId = paymentData.payment_id;
      } catch (err) {
        console.error('NOWPayments create payment error:', err.message);
        // Continue without deposit address for now
      }
      
      // Create wallet record
      const walletId = `W_${generateId()}`;
      const wallet = await base44.asServiceRole.entities.Wallet.create({
        wallet_id: walletId,
        trading_account_id: tradingAccountId,
        user_id: user.id,
        currency,
        balance: 0,
        deposit_address: depositAddress,
        nowpayments_id: nowpaymentsId,
        status: 'active',
        total_deposited: 0,
        total_withdrawn: 0
      });
      
      audit('WALLET_CREATED', user.id, { walletId, tradingAccountId, currency, depositAddress });
      
      return Response.json({ success: true, data: wallet });
    }

    // GET USER WALLETS
    if (action === 'list') {
      const wallets = await base44.entities.Wallet.filter({ user_id: user.id });
      return Response.json({ success: true, data: wallets || [] });
    }

    // GET WALLET BY ID
    if (action === 'get') {
      const { walletId } = params;
      
      const wallets = await base44.entities.Wallet.filter({ 
        id: walletId, 
        user_id: user.id 
      });
      
      if (!wallets || wallets.length === 0) {
        return Response.json({ success: false, error: 'Wallet not found' }, { status: 404 });
      }
      
      return Response.json({ success: true, data: wallets[0] });
    }

    // GET DEPOSIT ADDRESS (refresh if needed)
    if (action === 'getDepositAddress') {
      const { walletId } = params;
      
      const wallets = await base44.entities.Wallet.filter({ 
        id: walletId, 
        user_id: user.id 
      });
      
      if (!wallets || wallets.length === 0) {
        return Response.json({ success: false, error: 'Wallet not found' }, { status: 404 });
      }
      
      const wallet = wallets[0];
      
      // If no deposit address, create new payment
      if (!wallet.deposit_address) {
        try {
          const paymentData = await nowPaymentsRequest('/payment', 'POST', {
            price_amount: 1000000,
            price_currency: 'usd',
            pay_currency: wallet.currency.toLowerCase().replace('trc20', '').replace('erc20', ''),
            order_id: `wallet_${user.id}_${Date.now()}`,
            order_description: `Wallet deposit for user ${user.id}`,
            ipn_callback_url: `${Deno.env.get('BASE44_APP_URL') || 'https://app.base44.com'}/api/functions/walletWebhook`
          });
          
          await base44.asServiceRole.entities.Wallet.update(walletId, {
            deposit_address: paymentData.pay_address,
            nowpayments_id: paymentData.payment_id
          });
          
          wallet.deposit_address = paymentData.pay_address;
        } catch (err) {
          console.error('NOWPayments error:', err.message);
          return Response.json({ success: false, error: 'Failed to generate deposit address' }, { status: 500 });
        }
      }
      
      return Response.json({ 
        success: true, 
        data: { 
          address: wallet.deposit_address,
          currency: wallet.currency
        } 
      });
    }

    // REQUEST WITHDRAWAL
    if (action === 'withdraw') {
      const { walletId, amount, destinationAddress } = params;
      
      if (!walletId || !amount || !destinationAddress) {
        return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }
      
      if (amount <= 0) {
        return Response.json({ success: false, error: 'Invalid amount' }, { status: 400 });
      }
      
      // Get wallet and verify ownership
      const wallets = await base44.entities.Wallet.filter({ 
        id: walletId, 
        user_id: user.id 
      });
      
      if (!wallets || wallets.length === 0) {
        return Response.json({ success: false, error: 'Wallet not found' }, { status: 404 });
      }
      
      const wallet = wallets[0];
      
      // Check balance
      if (amount > wallet.balance) {
        return Response.json({ 
          success: false, 
          error: `Insufficient balance. Available: ${wallet.balance} USDT` 
        }, { status: 400 });
      }
      
      // Create transaction record (pending)
      const txId = `TX_${generateId()}`;
      await base44.asServiceRole.entities.WalletTransaction.create({
        transaction_id: txId,
        wallet_id: walletId,
        user_id: user.id,
        type: 'withdrawal',
        amount: -amount,
        status: 'pending',
        destination_address: destinationAddress
      });
      
      // Request withdrawal from NOWPayments
      let nowpaymentsPayoutId = null;
      try {
        const payoutData = await nowPaymentsRequest('/payout', 'POST', {
          withdrawals: [{
            address: destinationAddress,
            currency: wallet.currency.toLowerCase().replace('trc20', '').replace('erc20', ''),
            amount: amount,
            ipn_callback_url: `${Deno.env.get('BASE44_APP_URL') || 'https://app.base44.com'}/api/functions/walletWebhook`
          }]
        });
        
        nowpaymentsPayoutId = payoutData.id;
        
        // Update transaction with NOWPayments ID
        const txRecords = await base44.entities.WalletTransaction.filter({ transaction_id: txId });
        if (txRecords && txRecords.length > 0) {
          await base44.asServiceRole.entities.WalletTransaction.update(txRecords[0].id, {
            nowpayments_id: nowpaymentsPayoutId
          });
        }
      } catch (err) {
        console.error('NOWPayments payout error:', err.message);
        
        // Mark transaction as failed
        const txRecords = await base44.entities.WalletTransaction.filter({ transaction_id: txId });
        if (txRecords && txRecords.length > 0) {
          await base44.asServiceRole.entities.WalletTransaction.update(txRecords[0].id, {
            status: 'failed',
            notes: err.message
          });
        }
        
        return Response.json({ success: false, error: 'Withdrawal request failed' }, { status: 500 });
      }
      
      // Deduct from wallet balance
      await base44.asServiceRole.entities.Wallet.update(walletId, {
        balance: wallet.balance - amount,
        total_withdrawn: wallet.total_withdrawn + amount
      });
      
      // Update trading account balance
      const accounts = await base44.entities.TradingAccount.filter({ 
        id: wallet.trading_account_id 
      });
      if (accounts && accounts.length > 0) {
        const account = accounts[0];
        await base44.asServiceRole.entities.TradingAccount.update(wallet.trading_account_id, {
          balance: Math.max(0, account.balance - amount),
          equity: Math.max(0, account.equity - amount)
        });
      }
      
      audit('WITHDRAWAL_REQUESTED', user.id, { walletId, amount, destinationAddress, txId });
      
      return Response.json({ 
        success: true, 
        data: { transactionId: txId, status: 'pending' } 
      });
    }

    // INTERNAL TRANSFER
    if (action === 'transfer') {
      const { fromWalletId, toWalletId, amount } = params;
      
      if (!fromWalletId || !toWalletId || !amount) {
        return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }
      
      if (amount <= 0) {
        return Response.json({ success: false, error: 'Invalid amount' }, { status: 400 });
      }
      
      // Verify both wallets belong to user
      const fromWallets = await base44.entities.Wallet.filter({ 
        id: fromWalletId, 
        user_id: user.id 
      });
      const toWallets = await base44.entities.Wallet.filter({ 
        id: toWalletId, 
        user_id: user.id 
      });
      
      if (!fromWallets?.length || !toWallets?.length) {
        return Response.json({ success: false, error: 'Wallet not found' }, { status: 404 });
      }
      
      const fromWallet = fromWallets[0];
      const toWallet = toWallets[0];
      
      // Check balance
      if (amount > fromWallet.balance) {
        return Response.json({ 
          success: false, 
          error: `Insufficient balance. Available: ${fromWallet.balance} USDT` 
        }, { status: 400 });
      }
      
      const transferId = `TRF_${generateId()}`;
      
      // Create outgoing transaction
      await base44.asServiceRole.entities.WalletTransaction.create({
        transaction_id: `${transferId}_OUT`,
        wallet_id: fromWalletId,
        user_id: user.id,
        type: 'internal_transfer_out',
        amount: -amount,
        status: 'completed',
        reference_id: transferId
      });
      
      // Create incoming transaction
      await base44.asServiceRole.entities.WalletTransaction.create({
        transaction_id: `${transferId}_IN`,
        wallet_id: toWalletId,
        user_id: user.id,
        type: 'internal_transfer_in',
        amount: amount,
        status: 'completed',
        reference_id: transferId
      });
      
      // Update wallet balances
      await base44.asServiceRole.entities.Wallet.update(fromWalletId, {
        balance: fromWallet.balance - amount
      });
      await base44.asServiceRole.entities.Wallet.update(toWalletId, {
        balance: toWallet.balance + amount
      });
      
      // Update trading account balances
      const fromAccounts = await base44.entities.TradingAccount.filter({ id: fromWallet.trading_account_id });
      const toAccounts = await base44.entities.TradingAccount.filter({ id: toWallet.trading_account_id });
      
      if (fromAccounts?.length) {
        const acc = fromAccounts[0];
        await base44.asServiceRole.entities.TradingAccount.update(fromWallet.trading_account_id, {
          balance: Math.max(0, acc.balance - amount),
          equity: Math.max(0, acc.equity - amount)
        });
      }
      if (toAccounts?.length) {
        const acc = toAccounts[0];
        await base44.asServiceRole.entities.TradingAccount.update(toWallet.trading_account_id, {
          balance: acc.balance + amount,
          equity: acc.equity + amount
        });
      }
      
      audit('INTERNAL_TRANSFER', user.id, { fromWalletId, toWalletId, amount, transferId });
      
      return Response.json({ success: true, data: { transferId } });
    }

    // GET TRANSACTIONS
    if (action === 'getTransactions') {
      const { walletId, limit = 50 } = params;
      
      let query = { user_id: user.id };
      if (walletId) {
        // Verify wallet ownership
        const wallets = await base44.entities.Wallet.filter({ id: walletId, user_id: user.id });
        if (!wallets?.length) {
          return Response.json({ success: false, error: 'Wallet not found' }, { status: 404 });
        }
        query.wallet_id = walletId;
      }
      
      const transactions = await base44.entities.WalletTransaction.filter(query, '-created_date', limit);
      return Response.json({ success: true, data: transactions || [] });
    }

    return Response.json({ success: false, error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('[WALLET_ERROR]', error.message, error.stack);
    return Response.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});