import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Configuration
const MIN_WITHDRAWAL = 5.00;
const NETWORK_FEES = {
  TRC20: 1.50,
  ERC20: 0,
  BEP20: 0
};
const SUPPORTED_NETWORKS = ['TRC20', 'ERC20', 'BEP20']; // All networks enabled
const VALID_SOURCE_ACCOUNTS = ['FUNDING', 'COPY_TRADING'];
const RATE_LIMIT_SECONDS = 10;

// In-memory rate limiter (per-user)
const rateLimitMap = new Map();

const jsonOk = (data, init = {}) => Response.json({ ok: true, data }, init);
const jsonError = (code, message, status = 400, extra = {}) =>
  Response.json({ ok: false, error: { code, message, ...extra } }, { status });

// Generate reference: WD-YYYYMMDD-XXXXXX
const generateReference = () => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  return `WD-${datePart}-${rand}`;
};

// Generate 64-char hex mock tx hash
const generateMockTxHash = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

// Address validation (network-aware)
const validateAddress = (address, network) => {
  if (!address || typeof address !== 'string') return { valid: false, error: 'Address is required' };
  address = address.trim();
  
  if (network === 'TRC20') {
    // TRC20/TRON addresses: start with T, 34 chars, base58
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
      return { valid: false, error: 'Invalid TRC20 address. Must start with T and be 34 characters.' };
    }
    return { valid: true };
  }
  
  if (network === 'ERC20' || network === 'BEP20') {
    // EVM addresses: 0x + 40 hex chars
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return { valid: false, error: `Invalid ${network} address. Must start with 0x and be 42 characters.` };
    }
    return { valid: true };
  }
  
  return { valid: false, error: 'Unsupported network' };
};

// Rate limit check
const checkRateLimit = (userId) => {
  const now = Date.now();
  const lastRequest = rateLimitMap.get(userId);
  if (lastRequest && (now - lastRequest) < RATE_LIMIT_SECONDS * 1000) {
    const waitSeconds = Math.ceil((RATE_LIMIT_SECONDS * 1000 - (now - lastRequest)) / 1000);
    return { allowed: false, waitSeconds };
  }
  rateLimitMap.set(userId, now);
  return { allowed: true };
};

// Audit log
const audit = (action, userId, data) => {
  console.log(`[LEDGER_WITHDRAWAL] [${new Date().toISOString()}] ${action} | User: ${userId}`, JSON.stringify(data));
};

// Get account balances for a specific source
const getAccountBalance = async (base44, userId, sourceAccountType) => {
  if (sourceAccountType === 'COPY_TRADING') {
    // Get from CopyTradingWallet entity
    const wallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: userId });
    if (!wallets?.length) {
      return { total: 0, locked: 0, reserved: 0, withdrawable: 0, exists: false };
    }
    const wallet = wallets[0];
    const total = wallet.available_balance || 0;
    const locked = wallet.locked_balance || 0;
    const reserved = 0;
    return {
      total: total + locked,
      locked,
      reserved,
      withdrawable: total, // available_balance is already withdrawable
      exists: true,
      walletId: wallet.id
    };
  }
  
  if (sourceAccountType === 'FUNDING') {
    // Get from internal Wallet entity (USDT wallets)
    const wallets = await base44.asServiceRole.entities.Wallet.filter({ user_id: userId, currency: 'USDT' });
    const total = wallets?.reduce((sum, w) => sum + (w.balance || 0), 0) || 0;
    const locked = wallets?.reduce((sum, w) => sum + (w.locked_balance || 0), 0) || 0;
    const staked = wallets?.reduce((sum, w) => sum + (w.staked_balance || 0), 0) || 0;
    const reserved = 0;
    return {
      total,
      locked: locked + staked, // Both locked and staked are not withdrawable
      reserved,
      withdrawable: Math.max(0, total - locked - staked - reserved),
      exists: wallets?.length > 0,
      wallets
    };
  }
  
  return { total: 0, locked: 0, reserved: 0, withdrawable: 0, exists: false };
};

// Deduct balance from source account
const deductBalance = async (base44, userId, sourceAccountType, amount, balanceData) => {
  if (sourceAccountType === 'COPY_TRADING') {
    if (!balanceData.walletId) throw new Error('Copy Trading wallet not found');
    
    const wallet = (await base44.asServiceRole.entities.CopyTradingWallet.filter({ id: balanceData.walletId }))[0];
    const newAvailable = Math.max(0, (wallet.available_balance || 0) - amount);
    
    await base44.asServiceRole.entities.CopyTradingWallet.update(balanceData.walletId, {
      available_balance: newAvailable,
      lifetime_withdrawn: (wallet.lifetime_withdrawn || 0) + amount,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    return true;
  }
  
  if (sourceAccountType === 'FUNDING') {
    // Find primary USDT wallet and deduct
    const wallets = balanceData.wallets || [];
    if (!wallets.length) throw new Error('Funding wallet not found');
    
    // Deduct from first wallet with sufficient balance
    let remaining = amount;
    for (const wallet of wallets) {
      if (remaining <= 0) break;
      const available = (wallet.balance || 0) - (wallet.locked_balance || 0) - (wallet.staked_balance || 0);
      if (available > 0) {
        const deduct = Math.min(available, remaining);
        await base44.asServiceRole.entities.Wallet.update(wallet.id, {
          balance: Math.max(0, (wallet.balance || 0) - deduct),
          total_withdrawn: (wallet.total_withdrawn || 0) + deduct
        });
        remaining -= deduct;
      }
    }
    
    return true;
  }
  
  throw new Error('Invalid source account type');
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return jsonError('UNAUTHORIZED', 'Unauthorized', 401);
    }
    
    const body = await req.json();
    const { action, ...params } = body;
    
    console.log('[LEDGER_WITHDRAWAL]', { action, userId: user.id });

    // ==================== GET BALANCES ====================
    if (action === 'getBalances') {
      const fundingBalance = await getAccountBalance(base44, user.id, 'FUNDING');
      const copyTradingBalance = await getAccountBalance(base44, user.id, 'COPY_TRADING');
      
      return jsonOk({
        FUNDING: {
          total: fundingBalance.total,
          locked: fundingBalance.locked,
          reserved: fundingBalance.reserved,
          withdrawable: fundingBalance.withdrawable,
          exists: fundingBalance.exists
        },
        COPY_TRADING: {
          total: copyTradingBalance.total,
          locked: copyTradingBalance.locked,
          reserved: copyTradingBalance.reserved,
          withdrawable: copyTradingBalance.withdrawable,
          exists: copyTradingBalance.exists
        }
      });
    }

    // ==================== CREATE WITHDRAWAL ====================
    if (action === 'create') {
      const { sourceAccountType, network, address, amount, requestId } = params;
      
      // Rate limit check
      const rateCheck = checkRateLimit(user.id);
      if (!rateCheck.allowed) {
        return jsonError('RATE_LIMITED', `Please wait ${rateCheck.waitSeconds} seconds before submitting another withdrawal`, 429);
      }
      
      // Validate source account type
      if (!sourceAccountType || !VALID_SOURCE_ACCOUNTS.includes(sourceAccountType)) {
        return jsonError('INVALID_SOURCE', `Invalid source account. Must be one of: ${VALID_SOURCE_ACCOUNTS.join(', ')}`, 400);
      }
      
      // Validate network
      if (!network || !SUPPORTED_NETWORKS.includes(network)) {
        return jsonError('INVALID_NETWORK', `Invalid network. Must be one of: ${SUPPORTED_NETWORKS.join(', ')}`, 400);
      }
      
      // Validate address
      const addressValidation = validateAddress(address, network);
      if (!addressValidation.valid) {
        return jsonError('INVALID_ADDRESS', addressValidation.error, 400);
      }
      
      // Validate amount
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum < MIN_WITHDRAWAL) {
        return jsonError('INVALID_AMOUNT', `Minimum withdrawal is ${MIN_WITHDRAWAL} USDT`, 400);
      }
      
      // Round to 2 decimals
      const receiveAmount = Math.round(amountNum * 100) / 100;
      const fee = NETWORK_FEES[network] || 0;
      const totalDebit = receiveAmount + fee;
      
      // Idempotency check
      if (requestId) {
        const existing = await base44.asServiceRole.entities.LedgerWithdrawal.filter({
          user_id: user.id,
          request_id: requestId
        });
        if (existing?.length > 0) {
          return jsonOk(existing[0]);
        }
      }
      
      // Get balance for the selected source account (NOT OKX, purely internal)
      const balanceData = await getAccountBalance(base44, user.id, sourceAccountType);
      
      audit('WITHDRAWAL_ATTEMPT', user.id, { 
        sourceAccountType,
        amount: receiveAmount, 
        fee, 
        totalDebit, 
        balance: balanceData
      });
      
      // Check if sufficient balance
      if (totalDebit > balanceData.withdrawable) {
        const failedWithdrawal = await base44.asServiceRole.entities.LedgerWithdrawal.create({
          user_id: user.id,
          user_email: user.email,
          source_account_type: sourceAccountType,
          asset: 'USDT',
          network,
          address: address.trim(),
          amount: receiveAmount,
          fee,
          total_debit: totalDebit,
          status: 'FAILED',
          reference: generateReference(),
          mock_tx_hash: null,
          failure_reason: `Insufficient withdrawable balance. Needed: ${totalDebit.toFixed(2)} USDT, Available: ${balanceData.withdrawable.toFixed(2)} USDT`,
          request_id: requestId || null,
          wallet_balance_before: balanceData.total,
          wallet_balance_after: balanceData.total
        });
        
        audit('WITHDRAWAL_FAILED', user.id, { 
          withdrawalId: failedWithdrawal.id,
          reason: 'INSUFFICIENT_BALANCE',
          needed: totalDebit,
          available: balanceData.withdrawable
        });
        
        return jsonError('INSUFFICIENT_BALANCE', 
          `Insufficient withdrawable balance. Needed: ${totalDebit.toFixed(2)} USDT, Available: ${balanceData.withdrawable.toFixed(2)} USDT`, 
          400,
          { withdrawalId: failedWithdrawal.id }
        );
      }
      
      // Generate reference and mock tx hash
      const reference = generateReference();
      const mockTxHash = generateMockTxHash();
      
      // ATOMIC: Deduct from source wallet
      try {
        await deductBalance(base44, user.id, sourceAccountType, totalDebit, balanceData);
      } catch (deductError) {
        audit('WITHDRAWAL_DEDUCT_FAILED', user.id, { error: deductError.message });
        return jsonError('DEDUCT_FAILED', `Failed to deduct balance: ${deductError.message}`, 500);
      }
      
      const newTotal = balanceData.total - totalDebit;
      
      // Create APPROVED withdrawal
      const withdrawal = await base44.asServiceRole.entities.LedgerWithdrawal.create({
        user_id: user.id,
        user_email: user.email,
        source_account_type: sourceAccountType,
        asset: 'USDT',
        network,
        address: address.trim(),
        amount: receiveAmount,
        fee,
        total_debit: totalDebit,
        status: 'APPROVED',
        reference,
        mock_tx_hash: mockTxHash,
        note_to_user: `Your withdrawal of ${receiveAmount.toFixed(2)} USDT from ${sourceAccountType.replace('_', ' ')} has been approved. Processing time: 5 minutes to 24 hours.`,
        request_id: requestId || null,
        wallet_balance_before: balanceData.total,
        wallet_balance_after: newTotal
      });
      
      // Create admin notification
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id,
          type: 'system',
          title: 'Withdrawal Approved',
          message: `Withdrawal of ${receiveAmount.toFixed(2)} USDT from ${sourceAccountType.replace('_', ' ')} to ${address.slice(0, 8)}...${address.slice(-6)} has been approved.`,
          priority: 'high',
          data: {
            type: 'WITHDRAWAL_APPROVED',
            withdrawalId: withdrawal.id,
            userId: user.id,
            sourceAccountType,
            amount: receiveAmount,
            fee,
            totalDebit,
            network,
            reference,
            status: 'APPROVED'
          }
        });
      } catch (e) {
        console.error('[LEDGER_WITHDRAWAL] Failed to create notification:', e.message);
      }
      
      audit('WITHDRAWAL_APPROVED', user.id, {
        withdrawalId: withdrawal.id,
        sourceAccountType,
        reference,
        amount: receiveAmount,
        fee,
        totalDebit,
        network,
        address: `${address.slice(0, 8)}...${address.slice(-6)}`
      });
      
      return jsonOk({
        id: withdrawal.id,
        reference,
        mock_tx_hash: mockTxHash,
        status: 'APPROVED',
        source_account_type: sourceAccountType,
        amount: receiveAmount,
        fee,
        total_debit: totalDebit,
        network,
        address: address.trim(),
        note: withdrawal.note_to_user,
        created_at: withdrawal.created_date
      });
    }

    // ==================== LIST MY WITHDRAWALS ====================
    if (action === 'list') {
      const { limit = 50, skip = 0 } = params;
      
      const withdrawals = await base44.asServiceRole.entities.LedgerWithdrawal.filter(
        { user_id: user.id },
        '-created_date',
        limit + skip
      );
      
      const result = (withdrawals || []).slice(skip, skip + limit).map(w => ({
        id: w.id,
        reference: w.reference,
        status: w.status,
        source_account_type: w.source_account_type,
        amount: w.amount,
        fee: w.fee,
        total_debit: w.total_debit,
        network: w.network,
        address: w.address,
        mock_tx_hash: w.mock_tx_hash,
        note_to_user: w.note_to_user,
        failure_reason: w.failure_reason,
        created_date: w.created_date
      }));
      
      return jsonOk(result);
    }

    // ==================== GET WITHDRAWAL CONFIG ====================
    if (action === 'getConfig') {
      return jsonOk({
        min_withdrawal: MIN_WITHDRAWAL,
        networks: SUPPORTED_NETWORKS.map(network => ({
          network,
          fee: NETWORK_FEES[network],
          supported: true
        })),
        source_accounts: VALID_SOURCE_ACCOUNTS,
        rate_limit_seconds: RATE_LIMIT_SECONDS
      });
    }

    // ==================== ADMIN: LIST ALL WITHDRAWALS ====================
    if (action === 'adminList') {
      if (user.role !== 'admin') {
        return jsonError('FORBIDDEN', 'Admin access required', 403);
      }
      
      const { status, network, sourceAccountType, userId, limit = 100, skip = 0 } = params;
      
      let query = {};
      if (status) query.status = status;
      if (network) query.network = network;
      if (sourceAccountType) query.source_account_type = sourceAccountType;
      if (userId) query.user_id = userId;
      
      const withdrawals = await base44.asServiceRole.entities.LedgerWithdrawal.filter(
        query,
        '-created_date',
        limit + skip
      );
      
      return jsonOk((withdrawals || []).slice(skip, skip + limit));
    }

    // ==================== ADMIN: ADD NOTE ====================
    if (action === 'adminAddNote') {
      if (user.role !== 'admin') {
        return jsonError('FORBIDDEN', 'Admin access required', 403);
      }
      
      const { withdrawalId, note } = params;
      
      if (!withdrawalId || !note) {
        return jsonError('INVALID_PARAMS', 'withdrawalId and note required', 400);
      }
      
      const withdrawals = await base44.asServiceRole.entities.LedgerWithdrawal.filter({ id: withdrawalId });
      if (!withdrawals?.length) {
        return jsonError('NOT_FOUND', 'Withdrawal not found', 404);
      }
      
      await base44.asServiceRole.entities.LedgerWithdrawal.update(withdrawalId, {
        admin_note: note
      });
      
      audit('ADMIN_NOTE_ADDED', user.id, { withdrawalId, note });
      
      return jsonOk({ success: true });
    }

    return jsonError('INVALID_ACTION', 'Invalid action', 400);
    
  } catch (error) {
    console.error('[LEDGER_WITHDRAWAL_ERROR]', error.message, error.stack);
    return jsonError('INTERNAL_ERROR', error.message || 'Internal server error', 500);
  }
});