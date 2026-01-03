import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Audit logger
const audit = (action, data) => {
  console.log(`[WALLET_WEBHOOK] [${new Date().toISOString()}] ${action}`, JSON.stringify(data));
};

const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

Deno.serve(async (req) => {
  // NOWPayments sends POST webhooks
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  
  const base44 = createClientFromRequest(req);
  
  try {
    const payload = await req.json();
    
    audit('WEBHOOK_RECEIVED', payload);
    
    const { 
      payment_id,
      payment_status,
      pay_amount,
      actually_paid,
      pay_currency,
      order_id,
      outcome_amount,
      outcome_currency
    } = payload;
    
    // Handle deposit confirmation
    if (payment_status === 'finished' || payment_status === 'confirmed') {
      // Find wallet by NOWPayments ID
      const wallets = await base44.asServiceRole.entities.Wallet.filter({ 
        nowpayments_id: payment_id 
      });
      
      if (!wallets || wallets.length === 0) {
        // Try to find by order_id pattern
        if (order_id && order_id.startsWith('wallet_')) {
          const parts = order_id.split('_');
          if (parts.length >= 2) {
            const userId = parts[1];
            const userWallets = await base44.asServiceRole.entities.Wallet.filter({ 
              user_id: userId,
              status: 'active'
            });
            
            if (userWallets && userWallets.length > 0) {
              // Use first active wallet
              const wallet = userWallets[0];
              await processDeposit(base44, wallet, actually_paid || pay_amount, payment_id);
              return Response.json({ success: true });
            }
          }
        }
        
        audit('WALLET_NOT_FOUND', { payment_id, order_id });
        return Response.json({ success: false, error: 'Wallet not found' }, { status: 404 });
      }
      
      const wallet = wallets[0];
      const depositAmount = parseFloat(actually_paid || pay_amount || 0);
      
      await processDeposit(base44, wallet, depositAmount, payment_id);
      
      return Response.json({ success: true });
    }
    
    // Handle withdrawal confirmation
    if (payload.batch_withdrawal_id || payload.withdrawal_id) {
      const withdrawalId = payload.withdrawal_id || payload.id;
      
      // Find transaction by NOWPayments ID
      const transactions = await base44.asServiceRole.entities.WalletTransaction.filter({
        nowpayments_id: String(withdrawalId)
      });
      
      if (transactions && transactions.length > 0) {
        const tx = transactions[0];
        const newStatus = payment_status === 'finished' ? 'completed' : 
                         payment_status === 'failed' ? 'failed' : 'pending';
        
        await base44.asServiceRole.entities.WalletTransaction.update(tx.id, {
          status: newStatus,
          external_txid: payload.hash || null
        });
        
        audit('WITHDRAWAL_STATUS_UPDATED', { transactionId: tx.transaction_id, status: newStatus });
      }
      
      return Response.json({ success: true });
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

async function processDeposit(base44, wallet, depositAmount, paymentId) {
  if (!depositAmount || depositAmount <= 0) {
    audit('INVALID_DEPOSIT_AMOUNT', { walletId: wallet.wallet_id, amount: depositAmount });
    return;
  }
  
  // Check if transaction already exists
  const existingTx = await base44.asServiceRole.entities.WalletTransaction.filter({
    wallet_id: wallet.id,
    nowpayments_id: String(paymentId),
    type: 'deposit'
  });
  
  if (existingTx && existingTx.length > 0) {
    audit('DUPLICATE_DEPOSIT', { walletId: wallet.wallet_id, paymentId });
    return;
  }
  
  // Create transaction record
  const txId = `TX_${generateId()}`;
  await base44.asServiceRole.entities.WalletTransaction.create({
    transaction_id: txId,
    wallet_id: wallet.id,
    user_id: wallet.user_id,
    type: 'deposit',
    amount: depositAmount,
    status: 'completed',
    nowpayments_id: String(paymentId)
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
    walletId: wallet.wallet_id, 
    amount: depositAmount, 
    newBalance,
    paymentId 
  });
}