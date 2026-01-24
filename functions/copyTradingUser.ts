// @ts-nocheck
/// <reference lib="deno.ns" />
// Copy Trading User Functions - Phase 1: Immediate OKX Transfer Funding
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper: Get or create CopyTradingWallet for user (ensures wallet always exists)
async function getOrCreateWallet(base44, user) {
  const wallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: user.id });
  if (wallets?.length > 0) {
    return wallets[0];
  }
  
  // Create new wallet with zero balance
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

// Helper: Get user's OKX trading balance
async function getOkxTradingBalance(base44, userId) {
  try {
    // Check if user has OKX account
    const accounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({
      user_id: userId,
      provider: 'OKX',
      status: 'ACTIVE'
    });
    
    if (!accounts?.length) {
      return { ok: false, balance: 0, error: 'No OKX account' };
    }
    
    // Get cached balance from account record
    const account = accounts[0];
    const tradingBalance = account.trading_balance || account.tradingBalance || 0;
    
    return { ok: true, balance: tradingBalance };
  } catch (err) {
    console.error('[COPY_TRADING] Failed to get OKX balance:', err.message);
    return { ok: false, balance: 0, error: err.message };
  }
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

    // ==================== GET WALLET (auto-create if missing) ====================
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

    // ==================== DEPOSIT FUNDS (Immediate for OKX_TRADING) ====================
    if (action === 'createAllocation' || action === 'depositFunds') {
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

      // Get OKX trading balance to validate
      const balanceCheck = await getOkxTradingBalance(base44, user.id);
      if (!balanceCheck.ok) {
        return Response.json({ ok: false, error: { code: 'NO_OKX_ACCOUNT', message: 'Please set up your trading account first' } });
      }

      if (balanceCheck.balance < amountNum) {
        return Response.json({ ok: false, error: { code: 'INSUFFICIENT_BALANCE', message: `Insufficient balance. Available: ${balanceCheck.balance.toFixed(2)} USDT` } });
      }

      // Idempotency check - prevent duplicate deposits within 30 seconds
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

      const now = new Date().toISOString();
      const idempotencyKey = `deposit:${user.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

      // Get or create wallet
      const wallet = await getOrCreateWallet(base44, user);
      const balanceBefore = wallet.available_balance || 0;
      const balanceAfter = balanceBefore + amountNum;

      // Update wallet balance IMMEDIATELY (no pending state)
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
        idempotency_key: idempotencyKey,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: 'Deposit from Trading Account',
        meta: { source: 'OKX_TRADING' },
        created_at: now
      });

      // Also create an allocation record for admin visibility (ACTIVE immediately)
      await base44.asServiceRole.entities.CopyTradingAllocation.create({
        user_id: user.id,
        user_email: user.email,
        amount: amountNum,
        status: 'ACTIVE',
        deposit_source: 'OKX_TRADING',
        idempotency_key: idempotencyKey,
        approved_at: now,
        approved_by: 'SYSTEM',
        approved_by_type: 'AUTOMATION',
        created_at: now,
        updated_at: now
      });

      console.log(`[COPY_TRADING] Deposit SUCCESS: ${amountNum} USDT for user ${user.email}, new balance: ${balanceAfter}`);

      return Response.json({ 
        ok: true, 
        data: { 
          success: true,
          amount: amountNum,
          newBalance: balanceAfter,
          ledgerId: ledgerEntry.id
        } 
      });
    }

    // ==================== CANCEL ALLOCATION (Phase 2 - Signal allocations only) ====================
    if (action === 'cancelAllocation') {
      // This is for canceling signal allocations in Phase 2
      // Deposits are immediate and cannot be cancelled
      return Response.json({ ok: false, error: { code: 'NOT_SUPPORTED', message: 'Deposits cannot be cancelled. Use withdrawal instead.' } });
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