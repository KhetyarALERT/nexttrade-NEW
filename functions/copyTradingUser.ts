// @ts-nocheck
/// <reference lib="deno.ns" />
// Copy Trading User Functions - Phase 1: Allocation/Funding
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
        deposit_source: 'OKX_FUNDING',
        signals_enabled: false
      };
      return Response.json({ ok: true, data: config });
    }

    // ==================== GET SUMMARY (for user dropdown) ====================
    if (action === 'getSummary') {
      const [configs, wallets, allocations] = await Promise.all([
        base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' }),
        base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: user.id }),
        base44.asServiceRole.entities.CopyTradingAllocation.filter({ user_id: user.id, status: 'PENDING' }),
      ]);

      const config = configs?.[0];
      const wallet = wallets?.[0];
      const pendingCount = allocations?.length || 0;

      return Response.json({
        ok: true,
        data: {
          enabled: config?.enabled || false,
          wallet: wallet ? {
            available: wallet.available_balance || 0,
            locked: wallet.locked_balance || 0,
            lifetimeDeposited: wallet.lifetime_deposited || 0,
            lifetimePnl: wallet.lifetime_pnl || 0,
          } : null,
          pendingAllocationsCount: pendingCount,
          lastActivityAt: wallet?.last_activity_at || null,
        }
      });
    }

    // ==================== GET WALLET ====================
    if (action === 'getWallet') {
      const wallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: user.id });
      const wallet = wallets?.[0] || null;
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

    // ==================== CREATE ALLOCATION ====================
    if (action === 'createAllocation') {
      const { amount, depositSource } = body;
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

      if (amountNum < (config.min_deposit_usdt || 50)) {
        return Response.json({ ok: false, error: { code: 'MIN_AMOUNT', message: `Minimum allocation is ${config.min_deposit_usdt || 50} USDT` } });
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

      // Create allocation request
      const now = new Date().toISOString();
      const idempotencyKey = `alloc:${user.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

      const allocation = await base44.asServiceRole.entities.CopyTradingAllocation.create({
        user_id: user.id,
        user_email: user.email,
        amount: amountNum,
        status: 'PENDING',
        deposit_source: depositSource || config.deposit_source || 'OKX_FUNDING',
        idempotency_key: idempotencyKey,
        retry_count: 0,
        created_at: now,
        updated_at: now
      });

      return Response.json({ ok: true, data: allocation });
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