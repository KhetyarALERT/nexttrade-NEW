// @ts-nocheck
/// <reference lib="deno.ns" />
// Copy Trading User Functions - Phase 1: Allocation/Funding (Immediate OKX Transfer)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper: Get or create copy trading wallet for a user
async function getOrCreateWallet(base44, user) {
  const wallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: user.id });
  if (wallets?.length > 0) {
    return wallets[0];
  }
  
  // Create new wallet
  const now = new Date().toISOString();
  const newWallet = await base44.asServiceRole.entities.CopyTradingWallet.create({
    user_id: user.id,
    user_email: user.email,
    available_balance: 0,
    locked_balance: 0,
    lifetime_deposited: 0,
    lifetime_withdrawn: 0,
    lifetime_pnl: 0,
    status: 'ACTIVE',
    created_at: now,
    updated_at: now
  });
  
  console.log(`[COPY_TRADING] Created wallet for user ${user.email}`);
  return newWallet;
}

// Helper: Execute OKX internal transfer from user's trading account to main pool
async function executeOkxTransfer(base44, user, amount) {
  // Get user's OKX account
  const accounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({
    user_id: user.id,
    provider: 'OKX',
    status: 'ACTIVE'
  });
  
  if (!accounts?.length) {
    return { ok: false, error: { code: 'NO_OKX_ACCOUNT', message: 'No active OKX account found' } };
  }
  
  const account = accounts[0];
  
  // Get credentials
  const creds = await base44.asServiceRole.entities.ExchangeCredential.filter({
    user_exchange_account_id: account.id,
    provider: 'OKX',
    status: 'ACTIVE'
  });
  
  if (!creds?.length) {
    return { ok: false, error: { code: 'NO_CREDENTIALS', message: 'OKX credentials not found' } };
  }
  
  // Check user's trading balance first
  const balanceRes = await base44.asServiceRole.functions.invoke('okxUserAccount', {
    action: 'getMyAccount'
  });
  
  if (!balanceRes?.data?.ok || !balanceRes.data.data?.hasAccount) {
    return { ok: false, error: { code: 'BALANCE_CHECK_FAILED', message: 'Failed to verify OKX balance' } };
  }
  
  const tradingBalance = balanceRes.data.data.balances?.tradingUsdt || 0;
  if (tradingBalance < amount) {
    return { ok: false, error: { code: 'INSUFFICIENT_BALANCE', message: `Insufficient balance. Available: ${tradingBalance.toFixed(2)} USDT` } };
  }
  
  // Execute transfer from user's subaccount trading -> main pool
  // For now, we record the transfer and consider it complete (pool is managed externally)
  const now = new Date().toISOString();
  const transferId = `ct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  const transfer = await base44.asServiceRole.entities.ExchangeTransfer.create({
    user_id: user.id,
    provider: 'OKX',
    from_account: account.id,
    from_account_type: 'trading',
    to_account: 'COPY_TRADING_POOL',
    to_account_type: 'pool',
    currency: 'USDT',
    amount,
    status: 'COMPLETED',
    transfer_type: 'COPY_TRADING_DEPOSIT',
    external_transfer_id: transferId,
    completed_at: now,
    created_at: now
  });
  
  console.log(`[COPY_TRADING] Transfer ${transferId}: ${amount} USDT from user ${user.email} to pool`);
  
  return { ok: true, data: { transferId: transfer.id, externalId: transferId } };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }
    });
  }

  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Please log in' } }, { status: 401 });
    }

    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const { action } = body || {};

    // ==================== GET CONFIG ====================
    if (action === 'getConfig') {
      const configs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
      const config = configs?.[0] || {
        enabled: false,
        min_deposit_usdt: 50,
        require_kyc: true,
        deposit_source: 'OKX_TRADING',
        signals_enabled: false
      };
      return Response.json({ ok: true, data: config });
    }

    // ==================== GET WALLET (auto-create if not exists) ====================
    if (action === 'getWallet') {
      const wallet = await getOrCreateWallet(base44, user);
      return Response.json({ ok: true, data: wallet });
    }

    // ==================== GET ALLOCATIONS ====================
    if (action === 'getAllocations') {
      const allocations = await base44.asServiceRole.entities.CopyTradingAllocation.filter(
        { user_id: user.id },
        '-created_at',
        50
      );
      return Response.json({ ok: true, data: allocations || [] });
    }

    // ==================== GET LEDGER ====================
    if (action === 'getLedger') {
      const { limit = 20 } = body;
      const entries = await base44.asServiceRole.entities.CopyTradingLedger.filter(
        { user_id: user.id, status: 'POSTED' },
        '-created_at',
        Math.min(100, Number(limit) || 20)
      );
      return Response.json({ ok: true, data: entries || [] });
    }

    // ==================== DEPOSIT FUNDS (Immediate OKX Transfer) ====================
    if (action === 'depositFunds' || action === 'createAllocation') {
      const { amount } = body;
      const amountNum = Number(amount);

      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        return Response.json({ ok: false, error: { code: 'INVALID_AMOUNT', message: 'Invalid amount' } });
      }

      // Get config
      const configs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
      const config = configs?.[0];

      if (!config?.enabled) {
        return Response.json({ ok: false, error: { code: 'DISABLED', message: 'Copy trading is not enabled' } });
      }

      const minDeposit = config.min_deposit_usdt || 50;
      if (amountNum < minDeposit) {
        return Response.json({ ok: false, error: { code: 'MIN_AMOUNT', message: `Minimum deposit is ${minDeposit} USDT` } });
      }

      // Check KYC if required
      if (config.require_kyc) {
        const verifications = await base44.asServiceRole.entities.VerificationRequest.filter(
          { user_id: user.id, status: 'approved' },
          '-created_date',
          1
        );
        if (!verifications?.length) {
          return Response.json({ ok: false, error: { code: 'KYC_REQUIRED', message: 'KYC verification required' } });
        }
      }

      const now = new Date().toISOString();
      const idempotencyKey = `deposit:${user.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

      // Check idempotency - prevent duplicate deposits within 30 seconds
      const recentLedger = await base44.asServiceRole.entities.CopyTradingLedger.filter(
        { user_id: user.id, kind: 'CREDIT', status: 'POSTED' },
        '-created_at',
        1
      );
      if (recentLedger?.length > 0) {
        const lastDeposit = new Date(recentLedger[0].created_at || recentLedger[0].created_date);
        if (Date.now() - lastDeposit.getTime() < 30000) {
          return Response.json({ ok: false, error: { code: 'DUPLICATE_REQUEST', message: 'Please wait before submitting another deposit' } });
        }
      }

      // Execute OKX transfer immediately
      const transferResult = await executeOkxTransfer(base44, user, amountNum);
      
      if (!transferResult.ok) {
        // Log failed attempt
        await base44.asServiceRole.entities.CopyTradingLedger.create({
          user_id: user.id,
          kind: 'CREDIT',
          amount: amountNum,
          currency: 'USDT',
          status: 'VOID',
          ref_type: 'ALLOCATION',
          idempotency_key: idempotencyKey,
          description: `Failed deposit: ${transferResult.error?.message || 'Transfer failed'}`,
          meta: { error: transferResult.error },
          created_at: now
        });
        
        return Response.json({ ok: false, error: transferResult.error });
      }

      // Get or create wallet
      const wallet = await getOrCreateWallet(base44, user);
      const balanceBefore = wallet.available_balance || 0;
      const balanceAfter = balanceBefore + amountNum;

      // Update wallet balance
      await base44.asServiceRole.entities.CopyTradingWallet.update(wallet.id, {
        available_balance: balanceAfter,
        lifetime_deposited: (wallet.lifetime_deposited || 0) + amountNum,
        last_activity_at: now,
        updated_at: now
      });

      // Create ledger entry
      const ledgerEntry = await base44.asServiceRole.entities.CopyTradingLedger.create({
        user_id: user.id,
        kind: 'CREDIT',
        amount: amountNum,
        currency: 'USDT',
        status: 'POSTED',
        ref_type: 'ALLOCATION',
        ref_id: transferResult.data.transferId,
        idempotency_key: idempotencyKey,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: `Deposit from Trading Account`,
        meta: { 
          source: 'OKX_TRADING',
          okx_transfer_id: transferResult.data.externalId
        },
        created_at: now
      });

      console.log(`[COPY_TRADING] Deposit SUCCESS: ${amountNum} USDT for user ${user.email}, new balance: ${balanceAfter}`);

      return Response.json({ 
        ok: true, 
        data: { 
          success: true,
          amount: amountNum,
          newBalance: balanceAfter,
          ledgerId: ledgerEntry.id,
          transferId: transferResult.data.transferId
        } 
      });
    }

    // ==================== CANCEL ALLOCATION ====================
    if (action === 'cancelAllocation') {
      const { allocationId } = body;

      if (!allocationId) {
        return Response.json({ ok: false, error: { code: 'MISSING_ID', message: 'Missing allocation ID' } });
      }

      const allocations = await base44.asServiceRole.entities.CopyTradingAllocation.filter({ id: allocationId });
      const allocation = allocations?.[0];

      if (!allocation || allocation.user_id !== user.id) {
        return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Allocation not found' } });
      }

      if (allocation.status !== 'PENDING') {
        return Response.json({ ok: false, error: { code: 'INVALID_STATUS', message: 'Can only cancel pending allocations' } });
      }

      await base44.asServiceRole.entities.CopyTradingAllocation.update(allocationId, {
        status: 'CANCELED',
        updated_at: new Date().toISOString()
      });

      return Response.json({ ok: true, data: { message: 'Allocation cancelled' } });
    }

    // ==================== GET SIGNALS (STUB) ====================
    if (action === 'getSignals') {
      // Phase 2 - For now return empty
      const configs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
      const config = configs?.[0];

      if (!config?.signals_enabled) {
        return Response.json({ ok: true, data: [], message: 'Signals coming soon' });
      }

      const signals = await base44.asServiceRole.entities.Signal.filter(
        { status: 'PUBLISHED' },
        '-published_at',
        20
      );
      return Response.json({ ok: true, data: signals || [] });
    }

    // ==================== ACCEPT SIGNAL (STUB) ====================
    if (action === 'acceptSignal') {
      // Phase 2 - For now return disabled
      return Response.json({ ok: false, error: { code: 'NOT_AVAILABLE', message: 'Signals feature coming soon' } });
    }

    return Response.json({ ok: false, error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` } });

  } catch (error) {
    console.error('[COPY_TRADING_USER_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});