import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Configuration
const MIN_WITHDRAWAL = 5.00;
const NETWORK_FEES = {
  TRC20: 1.50,
  ERC20: 0, // Coming soon
  BEP20: 0  // Coming soon
};
const SUPPORTED_NETWORKS = ['TRC20']; // Only TRC20 for now
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

// Basic address validation
const validateAddress = (address, network) => {
  if (!address || typeof address !== 'string') return false;
  address = address.trim();
  
  if (network === 'TRC20') {
    // TRC20 addresses start with T and are 34 chars
    return /^T[A-Za-z0-9]{33}$/.test(address);
  }
  if (network === 'ERC20' || network === 'BEP20') {
    // EVM addresses start with 0x and are 42 chars
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
  return false;
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

    // ==================== CREATE WITHDRAWAL ====================
    if (action === 'create') {
      const { network, address, amount, requestId } = params;
      
      // Rate limit check
      const rateCheck = checkRateLimit(user.id);
      if (!rateCheck.allowed) {
        return jsonError('RATE_LIMITED', `Please wait ${rateCheck.waitSeconds} seconds before submitting another withdrawal`, 429);
      }
      
      // Validate network
      if (!network || !SUPPORTED_NETWORKS.includes(network)) {
        return jsonError('INVALID_NETWORK', `Network not supported. Available: ${SUPPORTED_NETWORKS.join(', ')}`, 400);
      }
      
      // Validate address
      if (!validateAddress(address, network)) {
        return jsonError('INVALID_ADDRESS', `Invalid ${network} address format`, 400);
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
      
      // Idempotency check (if requestId provided)
      if (requestId) {
        const existing = await base44.asServiceRole.entities.LedgerWithdrawal.filter({
          user_id: user.id,
          request_id: requestId
        });
        if (existing?.length > 0) {
          // Return existing withdrawal
          return jsonOk(existing[0]);
        }
      }
      
      // Get user's OKX account balance
      let walletTotal = 0;
      let walletLocked = 0;
      
      try {
        const okxResult = await base44.functions.invoke('okxUserAccount', { action: 'getMyAccount' });
        if (okxResult.data?.ok && okxResult.data.data?.hasAccount) {
          const balances = okxResult.data.data.balances;
          // Use funding USDT as the withdrawable source
          walletTotal = balances?.fundingUsdt || 0;
          // Locked = in trading positions (not withdrawable)
          walletLocked = balances?.tradingUsdt || 0;
        }
      } catch (e) {
        console.error('[LEDGER_WITHDRAWAL] Failed to get OKX balance:', e.message);
      }
      
      // Also add internal wallet balance
      try {
        const walletsResult = await base44.functions.invoke('wallet', { action: 'list' });
        if (walletsResult.data?.success) {
          const internalBalance = (walletsResult.data.data || []).reduce((sum, w) => {
            if (w.currency === 'USDT') return sum + (w.balance || 0);
            return sum;
          }, 0);
          walletTotal += internalBalance;
        }
      } catch (e) {
        console.error('[LEDGER_WITHDRAWAL] Failed to get internal wallet:', e.message);
      }
      
      // Calculate withdrawable = total - locked (reserved is 0 for now)
      const reserved = 0;
      const withdrawable = walletTotal - walletLocked - reserved;
      
      audit('WITHDRAWAL_ATTEMPT', user.id, { 
        amount: receiveAmount, 
        fee, 
        totalDebit, 
        walletTotal, 
        walletLocked, 
        withdrawable 
      });
      
      // Check if sufficient balance
      if (totalDebit > withdrawable) {
        // Create FAILED withdrawal record
        const failedWithdrawal = await base44.asServiceRole.entities.LedgerWithdrawal.create({
          user_id: user.id,
          user_email: user.email,
          asset: 'USDT',
          network,
          address: address.trim(),
          amount: receiveAmount,
          fee,
          total_debit: totalDebit,
          status: 'FAILED',
          reference: generateReference(),
          mock_tx_hash: null,
          failure_reason: `Insufficient withdrawable balance. Needed: ${totalDebit.toFixed(2)} USDT, Available: ${withdrawable.toFixed(2)} USDT`,
          request_id: requestId || null,
          wallet_balance_before: walletTotal,
          wallet_balance_after: walletTotal
        });
        
        audit('WITHDRAWAL_FAILED', user.id, { 
          withdrawalId: failedWithdrawal.id,
          reason: 'INSUFFICIENT_BALANCE',
          needed: totalDebit,
          available: withdrawable
        });
        
        return jsonError('INSUFFICIENT_BALANCE', 
          `Insufficient withdrawable balance. Needed: ${totalDebit.toFixed(2)} USDT, Available: ${withdrawable.toFixed(2)} USDT`, 
          400,
          { withdrawalId: failedWithdrawal.id }
        );
      }
      
      // Generate reference and mock tx hash
      const reference = generateReference();
      const mockTxHash = generateMockTxHash();
      
      // ATOMIC: Deduct from wallet and create withdrawal record
      // For now, we use OKX funding account as the source
      // In production, this would be a proper ledger transaction
      
      const newTotal = walletTotal - totalDebit;
      
      // Create APPROVED withdrawal
      const withdrawal = await base44.asServiceRole.entities.LedgerWithdrawal.create({
        user_id: user.id,
        user_email: user.email,
        asset: 'USDT',
        network,
        address: address.trim(),
        amount: receiveAmount,
        fee,
        total_debit: totalDebit,
        status: 'APPROVED',
        reference,
        mock_tx_hash: mockTxHash,
        note_to_user: `Your withdrawal of ${receiveAmount.toFixed(2)} USDT has been approved. Processing time: 5 minutes to 24 hours.`,
        request_id: requestId || null,
        wallet_balance_before: walletTotal,
        wallet_balance_after: newTotal
      });
      
      // Create admin notification
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id, // This will be visible to admins via admin queries
          type: 'system',
          title: 'Withdrawal Approved',
          message: `Withdrawal of ${receiveAmount.toFixed(2)} USDT to ${address.slice(0, 8)}...${address.slice(-6)} has been approved.`,
          priority: 'high',
          data: {
            type: 'WITHDRAWAL_CREATED',
            withdrawalId: withdrawal.id,
            userId: user.id,
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
      
      const withdrawals = await base44.entities.LedgerWithdrawal.filter(
        { user_id: user.id },
        '-created_date',
        limit + skip
      );
      
      const result = (withdrawals || []).slice(skip, skip + limit).map(w => ({
        id: w.id,
        reference: w.reference,
        status: w.status,
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
        networks: Object.entries(NETWORK_FEES).map(([network, fee]) => ({
          network,
          fee,
          supported: SUPPORTED_NETWORKS.includes(network),
          coming_soon: !SUPPORTED_NETWORKS.includes(network)
        })),
        rate_limit_seconds: RATE_LIMIT_SECONDS
      });
    }

    // ==================== ADMIN: LIST ALL WITHDRAWALS ====================
    if (action === 'adminList') {
      if (user.role !== 'admin') {
        return jsonError('FORBIDDEN', 'Admin access required', 403);
      }
      
      const { status, network, userId, limit = 100, skip = 0 } = params;
      
      let query = {};
      if (status) query.status = status;
      if (network) query.network = network;
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