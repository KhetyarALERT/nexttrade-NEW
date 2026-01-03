import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const NOWPAYMENTS_IPN_SECRET = Deno.env.get("NOWPAYMENTS_IPN_SECRET");

// Audit logger
const audit = (action, data) => {
  console.log(`[WALLET_WEBHOOK] [${new Date().toISOString()}] ${action}`, JSON.stringify(data));
};

const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Verify NOWPayments IPN signature
// NOWPayments uses HMAC-SHA512 for IPN verification
async function verifyIPNSignature(payload, signature) {
  if (!NOWPAYMENTS_IPN_SECRET) {
    console.warn('[WALLET_WEBHOOK] IPN secret not configured, skipping verification');
    return true; // Skip verification if no secret (not recommended for production)
  }
  
  if (!signature) {
    console.warn('[WALLET_WEBHOOK] No signature provided');
    return false;
  }
  
  try {
    // Sort the payload keys and create the string to sign
    const sortedPayload = {};
    Object.keys(payload).sort().forEach(key => {
      sortedPayload[key] = payload[key];
    });
    const payloadString = JSON.stringify(sortedPayload);
    
    // Create HMAC-SHA512 signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(NOWPAYMENTS_IPN_SECRET),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payloadString)
    );
    
    // Convert to hex string
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const isValid = computedSignature.toLowerCase() === signature.toLowerCase();
    
    if (!isValid) {
      console.warn('[WALLET_WEBHOOK] Signature mismatch', {
        received: signature.substring(0, 20) + '...',
        computed: computedSignature.substring(0, 20) + '...'
      });
    }
    
    return isValid;
  } catch (err) {
    console.error('[WALLET_WEBHOOK] Signature verification error:', err.message);
    return false;
  }
}

Deno.serve(async (req) => {
  // NOWPayments sends POST webhooks
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  
  const base44 = createClientFromRequest(req);
  
  try {
    // Get the raw body for signature verification
    const bodyText = await req.text();
    let payload;
    
    try {
      payload = JSON.parse(bodyText);
    } catch (e) {
      audit('INVALID_JSON', { body: bodyText.substring(0, 200) });
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    audit('WEBHOOK_RECEIVED', payload);
    
    // Get signature from header
    const signature = req.headers.get('x-nowpayments-sig');
    
    // Verify IPN signature
    const isValidSignature = await verifyIPNSignature(payload, signature);
    if (!isValidSignature && NOWPAYMENTS_IPN_SECRET) {
      audit('INVALID_SIGNATURE', { paymentId: payload.payment_id });
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    const { 
      payment_id,
      payment_status,
      pay_amount,
      actually_paid,
      pay_currency,
      order_id,
      order_description,
      outcome_amount,
      outcome_currency,
      invoice_id
    } = payload;
    
    // Handle different payment statuses
    // NOWPayments statuses: waiting, confirming, confirmed, sending, partially_paid, finished, failed, refunded, expired
    
    if (payment_status === 'finished' || payment_status === 'confirmed') {
      // Payment confirmed - process deposit
      await processDeposit(base44, payload);
    } else if (payment_status === 'partially_paid') {
      // Partial payment - log but don't credit yet
      audit('PARTIAL_PAYMENT', { payment_id, actually_paid, pay_amount });
    } else if (payment_status === 'failed' || payment_status === 'expired') {
      // Payment failed or expired
      audit('PAYMENT_FAILED', { payment_id, status: payment_status });
      
      // If this was a withdrawal, mark it as failed
      await handleFailedWithdrawal(base44, payload);
    }
    
    // Handle payout/withdrawal webhooks
    if (payload.batch_withdrawal_id || payload.withdrawal_id || payload.payout_id) {
      await handleWithdrawalWebhook(base44, payload);
    }
    
    return Response.json({ success: true, message: 'Webhook processed' });
    
  } catch (error) {
    console.error('[WALLET_WEBHOOK_ERROR]', error.message, error.stack);
    return Response.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});

async function processDeposit(base44, payload) {
  const { 
    payment_id, 
    actually_paid, 
    pay_amount, 
    order_id,
    outcome_amount 
  } = payload;
  
  // Use the actual amount paid (in crypto) or outcome amount (converted)
  const depositAmount = parseFloat(outcome_amount || actually_paid || pay_amount || 0);
  
  if (!depositAmount || depositAmount <= 0) {
    audit('INVALID_DEPOSIT_AMOUNT', { payment_id, depositAmount });
    return;
  }
  
  let wallet = null;
  
  // Try to find wallet by nowpayments_payment_id first
  if (payment_id) {
    const walletsByPayment = await base44.asServiceRole.entities.Wallet.filter({ 
      nowpayments_payment_id: String(payment_id)
    });
    if (walletsByPayment && walletsByPayment.length > 0) {
      wallet = walletsByPayment[0];
    }
  }
  
  // If not found, try by order_id pattern (deposit_{wallet.id}_{timestamp})
  if (!wallet && order_id && order_id.startsWith('deposit_')) {
    const parts = order_id.split('_');
    if (parts.length >= 3) {
      const walletEntityId = parts[1];
      const walletsByEntityId = await base44.asServiceRole.entities.Wallet.filter({ id: walletEntityId });
      if (walletsByEntityId?.length) {
        wallet = walletsByEntityId[0];
      }
    }
  }
  
  if (!wallet) {
    audit('WALLET_NOT_FOUND_FOR_DEPOSIT', { payment_id, order_id });
    return;
  }
  
  // Check for duplicate transaction
  const existingTx = await base44.asServiceRole.entities.WalletTransaction.filter({
    nowpayments_id: String(payment_id),
    type: 'deposit'
  });
  
  if (existingTx && existingTx.length > 0) {
    audit('DUPLICATE_DEPOSIT_IGNORED', { payment_id, walletId: wallet.wallet_id });
    return;
  }
  
  // Create deposit transaction
  await base44.asServiceRole.entities.WalletTransaction.create({
    wallet_id: wallet.id,
    user_id: wallet.user_id,
    type: 'deposit',
    amount: depositAmount,
    currency: wallet.currency,
    network: wallet.network,
    status: 'completed',
    nowpayments_id: String(payment_id),
    notes: `Deposit via NOWPayments - Payment ID: ${payment_id}`
  });
  
  // Update wallet balance
  const newBalance = (wallet.balance || 0) + depositAmount;
  const newTotalDeposited = (wallet.total_deposited || 0) + depositAmount;
  
  await base44.asServiceRole.entities.Wallet.update(wallet.id, {
    balance: newBalance,
    total_deposited: newTotalDeposited
  });
  
  // Update trading account balance
  const accounts = await base44.asServiceRole.entities.TradingAccount.filter({ 
    id: wallet.trading_account_id 
  });
  
  if (accounts && accounts.length > 0) {
    const account = accounts[0];
    await base44.asServiceRole.entities.TradingAccount.update(wallet.trading_account_id, {
      balance: (account.balance || 0) + depositAmount,
      equity: (account.equity || 0) + depositAmount
    });
  }
  
  audit('DEPOSIT_PROCESSED', { 
    walletId: wallet.id, 
    amount: depositAmount, 
    newBalance,
    payment_id,
    currency: wallet.currency,
    network: wallet.network
  });
  
  // Create notification for confirmed deposit
  try {
    await base44.asServiceRole.entities.Notification.create({
      user_id: wallet.user_id,
      type: 'deposit_confirmed',
      title: 'Deposit Confirmed',
      message: `${depositAmount} ${wallet.currency} has been credited to your ${wallet.network} wallet.`,
      data: { walletId: wallet.id, amount: depositAmount, currency: wallet.currency },
      priority: 'normal'
    });
  } catch (e) {
    console.log('Failed to create notification:', e.message);
  }
}

async function handleWithdrawalWebhook(base44, payload) {
  const withdrawalId = payload.withdrawal_id || payload.payout_id || payload.id;
  const status = payload.status || payload.payment_status;
  
  if (!withdrawalId) return;
  
  // Find transaction by NOWPayments ID
  const transactions = await base44.asServiceRole.entities.WalletTransaction.filter({
    nowpayments_id: String(withdrawalId),
    type: 'withdrawal'
  });
  
  if (!transactions || transactions.length === 0) {
    audit('WITHDRAWAL_TX_NOT_FOUND', { withdrawalId });
    return;
  }
  
  const tx = transactions[0];
  
  let newStatus = 'pending';
  if (status === 'finished' || status === 'completed' || status === 'FINISHED') {
    newStatus = 'completed';
  } else if (status === 'failed' || status === 'FAILED' || status === 'error') {
    newStatus = 'failed';
  }
  
  await base44.asServiceRole.entities.WalletTransaction.update(tx.id, {
    status: newStatus,
    external_txid: payload.hash || payload.txid || null,
    notes: `Status updated: ${status}`
  });
  
  // If withdrawal failed, refund the amount back to wallet
  if (newStatus === 'failed') {
    const wallets = await base44.asServiceRole.entities.Wallet.filter({ id: tx.wallet_id });
    if (wallets && wallets.length > 0) {
      const wallet = wallets[0];
      const refundAmount = Math.abs(tx.amount);
      
      await base44.asServiceRole.entities.Wallet.update(wallet.id, {
        balance: wallet.balance + refundAmount
      });
      
      // Update trading account
      const accounts = await base44.asServiceRole.entities.TradingAccount.filter({ 
        id: wallet.trading_account_id 
      });
      if (accounts && accounts.length > 0) {
        const account = accounts[0];
        await base44.asServiceRole.entities.TradingAccount.update(wallet.trading_account_id, {
          balance: account.balance + refundAmount,
          equity: account.equity + refundAmount
        });
      }
      
      audit('WITHDRAWAL_REFUNDED', { txId: tx.transaction_id, refundAmount });
    }
  }
  
  audit('WITHDRAWAL_STATUS_UPDATED', { 
    txId: tx.transaction_id, 
    withdrawalId,
    oldStatus: tx.status,
    newStatus 
  });
  
  // Create notification for withdrawal status
  try {
    if (newStatus === 'completed') {
      await base44.asServiceRole.entities.Notification.create({
        user_id: tx.user_id,
        type: 'withdrawal_confirmed',
        title: 'Withdrawal Completed',
        message: `${Math.abs(tx.amount)} ${tx.currency} withdrawal has been completed successfully.`,
        data: { transactionId: tx.id, amount: Math.abs(tx.amount), currency: tx.currency },
        priority: 'normal'
      });
    } else if (newStatus === 'failed') {
      await base44.asServiceRole.entities.Notification.create({
        user_id: tx.user_id,
        type: 'withdrawal_failed',
        title: 'Withdrawal Failed',
        message: `Withdrawal of ${Math.abs(tx.amount)} ${tx.currency} has failed. Funds returned to your wallet.`,
        data: { transactionId: tx.id, amount: Math.abs(tx.amount), currency: tx.currency },
        priority: 'high'
      });
    }
  } catch (e) {
    console.log('Failed to create notification:', e.message);
  }
}

async function handleFailedWithdrawal(base44, payload) {
  // This handles payment failures that might be related to withdrawals
  const paymentId = payload.payment_id;
  if (!paymentId) return;
  
  const transactions = await base44.asServiceRole.entities.WalletTransaction.filter({
    nowpayments_id: String(paymentId),
    status: 'pending'
  });
  
  for (const tx of transactions || []) {
    await base44.asServiceRole.entities.WalletTransaction.update(tx.id, {
      status: 'failed',
      notes: `Payment failed: ${payload.payment_status}`
    });
  }
}