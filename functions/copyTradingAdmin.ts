// @ts-nocheck
/// <reference lib="deno.ns" />
// Copy Trading Admin Functions - Server-side only (admin role required)
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

    // Admin check
    if (user.role !== 'admin') {
      return Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const { action } = body || {};

    // ==================== GET CONFIG ====================
    if (action === 'getConfig') {
      const configs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
      const config = configs?.[0] || {
        id: null,
        config_key: 'default',
        enabled: false,
        min_deposit_usdt: 50,
        require_kyc: true,
        deposit_source: 'OKX_FUNDING',
        auto_approve_enabled: true,
        auto_approve_max_amount: 1000,
        auto_approve_min_age_minutes: 5,
        signals_enabled: false,
        pool_wallet_name: 'Main Copy Trading Pool'
      };
      return Response.json({ ok: true, data: config });
    }

    // ==================== SAVE CONFIG ====================
    if (action === 'saveConfig') {
      const { configData } = body;
      if (!configData) {
        return Response.json({ ok: false, error: { code: 'MISSING_DATA', message: 'Missing config data' } });
      }

      const now = new Date().toISOString();
      const payload = {
        enabled: Boolean(configData.enabled),
        min_deposit_usdt: Number(configData.min_deposit_usdt) || 50,
        require_kyc: configData.require_kyc !== false,
        deposit_source: configData.deposit_source || 'OKX_FUNDING',
        auto_approve_enabled: configData.auto_approve_enabled !== false,
        auto_approve_max_amount: Number(configData.auto_approve_max_amount) || 1000,
        auto_approve_min_age_minutes: Number(configData.auto_approve_min_age_minutes) || 5,
        signals_enabled: Boolean(configData.signals_enabled),
        pool_wallet_name: configData.pool_wallet_name || 'Main Copy Trading Pool',
        updated_at: now,
        updated_by: user.email
      };

      // Check if config exists
      const configs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
      const existingConfig = configs?.[0];

      let result;
      if (existingConfig?.id) {
        result = await base44.asServiceRole.entities.CopyTradingConfig.update(existingConfig.id, payload);
      } else {
        result = await base44.asServiceRole.entities.CopyTradingConfig.create({
          config_key: 'default',
          ...payload
        });
      }

      return Response.json({ ok: true, data: result });
    }

    // ==================== LIST WALLETS ====================
    if (action === 'listWallets') {
      const { limit = 50 } = body;
      const wallets = await base44.asServiceRole.entities.CopyTradingWallet.list('-updated_at', Math.min(200, Number(limit) || 50));
      return Response.json({ ok: true, data: wallets || [] });
    }

    // ==================== LIST ALLOCATIONS ====================
    if (action === 'listAllocations') {
      const { status, limit = 100 } = body;
      let allocations;
      if (status) {
        allocations = await base44.asServiceRole.entities.CopyTradingAllocation.filter(
          { status },
          '-created_at',
          Math.min(500, Number(limit) || 100)
        );
      } else {
        allocations = await base44.asServiceRole.entities.CopyTradingAllocation.list('-created_at', Math.min(500, Number(limit) || 100));
      }
      return Response.json({ ok: true, data: allocations || [] });
    }

    // ==================== LIST LEDGER ====================
    if (action === 'listLedger') {
      const { user_id, limit = 100 } = body;
      let entries;
      if (user_id) {
        entries = await base44.asServiceRole.entities.CopyTradingLedger.filter(
          { user_id },
          '-created_at',
          Math.min(500, Number(limit) || 100)
        );
      } else {
        // List all ledger entries (POSTED and VOID) for admin visibility
        entries = await base44.asServiceRole.entities.CopyTradingLedger.list(
          '-created_at',
          Math.min(500, Number(limit) || 100)
        );
      }
      return Response.json({ ok: true, data: entries || [] });
    }

    // ==================== GET STATS ====================
    if (action === 'getStats') {
      // Fetch all data with same limits used by list actions to ensure consistency
      const [wallets, ledgerEntries] = await Promise.all([
        base44.asServiceRole.entities.CopyTradingWallet.list('-updated_at', 200),
        base44.asServiceRole.entities.CopyTradingLedger.list('-created_at', 500),
      ]);

      const walls = wallets || [];
      const ledger = ledgerEntries || [];

      // Compute totals from wallet records
      const totalBalance = walls.reduce((sum, w) => sum + (w.available_balance || 0), 0);
      const totalAllocated = walls.reduce((sum, w) => sum + (w.locked_balance || 0), 0);
      const totalLifetimeDeposited = walls.reduce((sum, w) => sum + (w.lifetime_deposited || 0), 0);
      
      // Count ledger entries by status
      const postedCredits = ledger.filter(e => e.status === 'POSTED' && e.kind === 'CREDIT').length;
      const voidCredits = ledger.filter(e => e.status === 'VOID' && e.kind === 'CREDIT').length;

      return Response.json({
        ok: true,
        data: {
          totalWallets: walls.length,
          totalBalance,
          totalAllocated,
          totalLifetimeDeposited,
          postedDeposits: postedCredits,
          failedDeposits: voidCredits,
          // Legacy field for backward compatibility
          pendingAllocations: 0
        }
      });
    }

    // ==================== RUN PROCESSOR NOW ====================
    if (action === 'runProcessorNow') {
      // Call the processor function
      const res = await base44.asServiceRole.functions.invoke('copyTradingAutoApprove', {});
      return Response.json(res);
    }

    return Response.json({ ok: false, error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` } });

  } catch (error) {
    console.error('[COPY_TRADING_ADMIN_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});