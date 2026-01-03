import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const NOWPAYMENTS_API_KEY = Deno.env.get("NOWPAYMENTS_API_KEY");
const NOWPAYMENTS_BASE_URL = "https://api.nowpayments.io/v1";

// Generate unique ID
const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Audit logger
const audit = (action, userId, data) => {
  console.log(`[WALLET_AUDIT] [${new Date().toISOString()}] ${action} | User: ${userId}`, JSON.stringify(data));
};

// NOWPayments API call helper (server-side with API key)
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
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  console.log(`[NOWPAYMENTS] ${method} ${endpoint}`, body ? JSON.stringify(body) : '');
  
  const response = await fetch(`${NOWPAYMENTS_BASE_URL}${endpoint}`, options);
  const data = await response.json();
  
  console.log(`[NOWPAYMENTS] Response:`, JSON.stringify(data));
  
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

    // CHECK API STATUS
    if (action === 'checkStatus') {
      try {
        const status = await nowPaymentsRequest('/status');
        return Response.json({ success: true, data: status });
      } catch (err) {
        return Response.json({ success: false, error: err.message });
      }
    }

    // GET AVAILABLE CURRENCIES
    if (action === 'getCurrencies') {
      try {
        const currencies = await nowPaymentsRequest('/currencies');
        return Response.json({ success: true, data: currencies });
      } catch (err) {
        return Response.json({ success: false, error: err.message });
      }
    }

    // CREATE WALLET FOR TRADING ACCOUNT
    if (action === 'create') {
      const { tradingAccountId, currency = 'usdttrc20' } = params;
      
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
      
      // Check if wallet already exists for this account
      const existingWallets = await base44.entities.Wallet.filter({
        trading_account_id: tradingAccountId
      });
      
      if (existingWallets && existingWallets.length > 0) {
        return Response.json({ success: true, data: existingWallets[0], existing: true });
      }
      
      // Create wallet record first
      const walletId = `W_${generateId()}`;
      const wallet = await base44.asServiceRole.entities.Wallet.create({
        wallet_id: walletId,
        trading_account_id: tradingAccountId,
        user_id: user.id,
        currency: currency.toUpperCase(),
        balance: 0,
        deposit_address: null,
        nowpayments_id: null,
        status: 'active',
        total_deposited: 0,
        total_withdrawn: 0
      });
      
      audit('WALLET_CREATED', user.id, { walletId, tradingAccountId, currency });
      
      return Response.json({ success: true, data: wallet });
    }

    // GET OR CREATE DEPOSIT ADDRESS (creates NOWPayments invoice)
    if (action === 'getDepositAddress') {
      const { walletId, amount = 100 } = params;
      
      if (!walletId) {
        return Response.json({ success: false, error: 'Wallet ID required' }, { status: 400 });
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
      
      // Get the IPN callback URL from environment or construct it
      const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://app.base44.com';
      const ipnCallbackUrl = `${appUrl}/api/functions/walletWebhook`;
      
      // Create a new payment/invoice via NOWPayments API
      // Using the payment endpoint to generate deposit address
      try {
        const paymentData = await nowPaymentsRequest('/invoice', 'POST', {
          price_amount: parseFloat(amount) || 100,
          price_currency: 'usd',
          pay_currency: wallet.currency.toLowerCase(),
          order_id: `deposit_${wallet.wallet_id}_${Date.now()}`,
          order_description: `Deposit to wallet ${wallet.wallet_id}`,
          ipn_callback_url: ipnCallbackUrl,
          success_url: `${appUrl}/Profile?tab=wallet&deposit=success`,
          cancel_url: `${appUrl}/Profile?tab=wallet&deposit=cancelled`
        });
        
        // Update wallet with payment info
        await base44.asServiceRole.entities.Wallet.update(walletId, {
          nowpayments_id: paymentData.id,
          deposit_address: paymentData.pay_address || null
        });
        
        audit('DEPOSIT_ADDRESS_GENERATED', user.id, { 
          walletId, 
          invoiceId: paymentData.id,
          payAddress: paymentData.pay_address
        });
        
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
            expiration_estimate_date: paymentData.expiration_estimate_date
          }
        });
      } catch (err) {
        console.error('NOWPayments invoice error:', err.message);
        return Response.json({ 
          success: false, 
          error: `Failed to create deposit address: ${err.message}` 
        }, { status: 500 });
      }
    }

    // GET PAYMENT STATUS
    if (action === 'getPaymentStatus') {
      const { paymentId } = params;
      
      if (!paymentId) {
        return Response.json({ success: false, error: 'Payment ID required' }, { status: 400 });
      }
      
      try {
        const status = await nowPaymentsRequest(`/payment/${paymentId}`);
        return Response.json({ success: true, data: status });
      } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
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

    // REQUEST WITHDRAWAL
    if (action === 'withdraw') {
      const { walletId, amount, destinationAddress } = params;
      
      if (!walletId || !amount || !destinationAddress) {
        return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }
      
      const withdrawAmount = parseFloat(amount);
      if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
        return Response.json({ success: false, error: 'Invalid amount' }, { status: 400 });
      }
      
      // Minimum withdrawal (NOWPayments typically has minimums)
      if (withdrawAmount < 10) {
        return Response.json({ success: false, error: 'Minimum withdrawal is 10 USDT' }, { status: 400 });
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
      if (withdrawAmount > wallet.balance) {
        return Response.json({ 
          success: false, 
          error: `Insufficient balance. Available: ${wallet.balance.toFixed(2)} USDT` 
        }, { status: 400 });
      }
      
      // Create pending transaction record
      const txId = `TX_W_${generateId()}`;
      await base44.asServiceRole.entities.WalletTransaction.create({
        transaction_id: txId,
        wallet_id: walletId,
        user_id: user.id,
        type: 'withdrawal',
        amount: -withdrawAmount,
        fee: 0,
        status: 'pending',
        destination_address: destinationAddress,
        notes: 'Withdrawal request submitted'
      });
      
      // Request payout from NOWPayments
      try {
        // NOWPayments payout endpoint
        const payoutData = await nowPaymentsRequest('/payout', 'POST', {
          withdrawals: [{
            address: destinationAddress,
            currency: wallet.currency.toLowerCase(),
            amount: withdrawAmount,
            ipn_callback_url: `${Deno.env.get('BASE44_APP_URL') || 'https://app.base44.com'}/api/functions/walletWebhook`
          }]
        });
        
        // Update transaction with NOWPayments payout ID
        const txRecords = await base44.asServiceRole.entities.WalletTransaction.filter({ 
          transaction_id: txId 
        });
        if (txRecords && txRecords.length > 0) {
          await base44.asServiceRole.entities.WalletTransaction.update(txRecords[0].id, {
            nowpayments_id: payoutData.id || payoutData.withdrawals?.[0]?.id,
            status: 'pending'
          });
        }
        
        // Deduct from wallet balance immediately (pending withdrawal)
        await base44.asServiceRole.entities.Wallet.update(walletId, {
          balance: wallet.balance - withdrawAmount
        });
        
        // Update trading account balance
        const accounts = await base44.entities.TradingAccount.filter({ 
          id: wallet.trading_account_id 
        });
        if (accounts && accounts.length > 0) {
          const account = accounts[0];
          await base44.asServiceRole.entities.TradingAccount.update(wallet.trading_account_id, {
            balance: Math.max(0, account.balance - withdrawAmount),
            equity: Math.max(0, account.equity - withdrawAmount)
          });
        }
        
        audit('WITHDRAWAL_REQUESTED', user.id, { 
          walletId, 
          amount: withdrawAmount, 
          destinationAddress, 
          txId,
          payoutId: payoutData.id
        });
        
        return Response.json({ 
          success: true, 
          data: { 
            transactionId: txId, 
            status: 'pending',
            message: 'Withdrawal request submitted. Processing may take up to 24 hours.'
          } 
        });
        
      } catch (err) {
        console.error('NOWPayments payout error:', err.message);
        
        // Mark transaction as failed
        const txRecords = await base44.asServiceRole.entities.WalletTransaction.filter({ 
          transaction_id: txId 
        });
        if (txRecords && txRecords.length > 0) {
          await base44.asServiceRole.entities.WalletTransaction.update(txRecords[0].id, {
            status: 'failed',
            notes: `Payout failed: ${err.message}`
          });
        }
        
        return Response.json({ 
          success: false, 
          error: `Withdrawal failed: ${err.message}` 
        }, { status: 500 });
      }
    }

    // INTERNAL TRANSFER BETWEEN USER'S WALLETS
    if (action === 'transfer') {
      const { fromWalletId, toWalletId, amount } = params;
      
      if (!fromWalletId || !toWalletId || !amount) {
        return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }
      
      const transferAmount = parseFloat(amount);
      if (isNaN(transferAmount) || transferAmount <= 0) {
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
      if (transferAmount > fromWallet.balance) {
        return Response.json({ 
          success: false, 
          error: `Insufficient balance. Available: ${fromWallet.balance.toFixed(2)} USDT` 
        }, { status: 400 });
      }
      
      const transferId = `TRF_${generateId()}`;
      
      // Create outgoing transaction
      await base44.asServiceRole.entities.WalletTransaction.create({
        transaction_id: `${transferId}_OUT`,
        wallet_id: fromWalletId,
        user_id: user.id,
        type: 'internal_transfer_out',
        amount: -transferAmount,
        status: 'completed',
        reference_id: transferId,
        notes: `Transfer to wallet ${toWallet.wallet_id}`
      });
      
      // Create incoming transaction
      await base44.asServiceRole.entities.WalletTransaction.create({
        transaction_id: `${transferId}_IN`,
        wallet_id: toWalletId,
        user_id: user.id,
        type: 'internal_transfer_in',
        amount: transferAmount,
        status: 'completed',
        reference_id: transferId,
        notes: `Transfer from wallet ${fromWallet.wallet_id}`
      });
      
      // Update wallet balances
      await base44.asServiceRole.entities.Wallet.update(fromWalletId, {
        balance: fromWallet.balance - transferAmount
      });
      await base44.asServiceRole.entities.Wallet.update(toWalletId, {
        balance: toWallet.balance + transferAmount
      });
      
      // Update trading account balances
      const fromAccounts = await base44.entities.TradingAccount.filter({ 
        id: fromWallet.trading_account_id 
      });
      const toAccounts = await base44.entities.TradingAccount.filter({ 
        id: toWallet.trading_account_id 
      });
      
      if (fromAccounts?.length) {
        const acc = fromAccounts[0];
        await base44.asServiceRole.entities.TradingAccount.update(fromWallet.trading_account_id, {
          balance: Math.max(0, acc.balance - transferAmount),
          equity: Math.max(0, acc.equity - transferAmount)
        });
      }
      if (toAccounts?.length) {
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

    // MANUAL DEPOSIT (for testing/admin)
    if (action === 'manualDeposit') {
      const { walletId, amount, txid } = params;
      
      // This should ideally be admin-only, but for now allow user to trigger
      if (!walletId || !amount) {
        return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }
      
      const depositAmount = parseFloat(amount);
      if (isNaN(depositAmount) || depositAmount <= 0) {
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
      
      // Create deposit transaction
      const txId = `TX_D_${generateId()}`;
      await base44.asServiceRole.entities.WalletTransaction.create({
        transaction_id: txId,
        wallet_id: walletId,
        user_id: user.id,
        type: 'deposit',
        amount: depositAmount,
        status: 'completed',
        external_txid: txid || null,
        notes: 'Manual deposit'
      });
      
      // Update wallet balance
      const newBalance = wallet.balance + depositAmount;
      await base44.asServiceRole.entities.Wallet.update(walletId, {
        balance: newBalance,
        total_deposited: wallet.total_deposited + depositAmount
      });
      
      // Update trading account balance
      const accounts = await base44.entities.TradingAccount.filter({ 
        id: wallet.trading_account_id 
      });
      if (accounts?.length) {
        const account = accounts[0];
        await base44.asServiceRole.entities.TradingAccount.update(wallet.trading_account_id, {
          balance: account.balance + depositAmount,
          equity: account.equity + depositAmount
        });
      }
      
      audit('MANUAL_DEPOSIT', user.id, { walletId, amount: depositAmount, txId });
      
      return Response.json({ success: true, data: { transactionId: txId, newBalance } });
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