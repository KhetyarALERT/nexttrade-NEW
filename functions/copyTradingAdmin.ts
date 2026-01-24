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

    // ==================== MANUAL TOP-UP ====================
    if (action === 'manualTopUp') {
      const { userEmail, amount, note } = body;
      
      // Validate inputs
      if (!userEmail || typeof userEmail !== 'string') {
        console.error('[MANUAL_TOPUP] Missing or invalid userEmail');
        return Response.json({ ok: false, error: { code: 'INVALID_INPUT', message: 'User email is required' } });
      }
      
      const topUpAmount = Number(amount);
      if (!Number.isFinite(topUpAmount) || topUpAmount <= 0) {
        console.error('[MANUAL_TOPUP] Invalid amount:', amount);
        return Response.json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Amount must be a positive number' } });
      }

      const normalizedEmail = userEmail.trim().toLowerCase();
      console.log('[MANUAL_TOPUP] Starting top-up for:', { email: normalizedEmail, amount: topUpAmount, adminEmail: user.email });

      // Find user by email
      const users = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
      if (!users || users.length === 0) {
        console.error('[MANUAL_TOPUP] User not found:', normalizedEmail);
        return Response.json({ ok: false, error: { code: 'USER_NOT_FOUND', message: `User with email ${normalizedEmail} not found` } });
      }
      const targetUser = users[0];
      console.log('[MANUAL_TOPUP] Found user:', { userId: targetUser.id, email: targetUser.email });

      // Get or create wallet
      let wallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: targetUser.id });
      let wallet = wallets?.[0];
      
      const now = new Date().toISOString();
      
      if (!wallet) {
        console.log('[MANUAL_TOPUP] Creating new wallet for user:', targetUser.id);
        wallet = await base44.asServiceRole.entities.CopyTradingWallet.create({
          user_id: targetUser.id,
          user_email: targetUser.email,
          available_balance: 0,
          locked_balance: 0,
          lifetime_deposited: 0,
          lifetime_withdrawn: 0,
          lifetime_pnl: 0,
          status: 'ACTIVE',
          created_at: now,
          updated_at: now
        });
        console.log('[MANUAL_TOPUP] Created wallet:', wallet.id);
      }

      const balanceBefore = wallet.available_balance || 0;
      const balanceAfter = balanceBefore + topUpAmount;
      const idempotencyKey = `admin_topup:${targetUser.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

      console.log('[MANUAL_TOPUP] Creating ledger entry:', { balanceBefore, balanceAfter, idempotencyKey });

      // Create ledger entry
      const ledgerEntry = await base44.asServiceRole.entities.CopyTradingLedger.create({
        user_id: targetUser.id,
        kind: 'CREDIT',
        amount: topUpAmount,
        currency: 'USDT',
        status: 'POSTED',
        ref_type: 'ADMIN_ADJUST',
        ref_id: null,
        idempotency_key: idempotencyKey,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: `Admin manual top-up by ${user.email}${note ? ': ' + note : ''}`,
        meta: {
          admin_email: user.email,
          admin_note: note || null,
          timestamp: now
        },
        created_at: now
      });
      console.log('[MANUAL_TOPUP] Created ledger entry:', ledgerEntry.id);

      // Update wallet balance
      await base44.asServiceRole.entities.CopyTradingWallet.update(wallet.id, {
        available_balance: balanceAfter,
        lifetime_deposited: (wallet.lifetime_deposited || 0) + topUpAmount,
        last_activity_at: now,
        updated_at: now
      });
      console.log('[MANUAL_TOPUP] Updated wallet balance:', { walletId: wallet.id, newBalance: balanceAfter });

      return Response.json({
        ok: true,
        data: {
          walletId: wallet.id,
          ledgerEntryId: ledgerEntry.id,
          userEmail: targetUser.email,
          amount: topUpAmount,
          balanceBefore,
          balanceAfter,
          adminEmail: user.email
        }
      });
    }

    // ==================== GET COPY TRADING STATS FOR DASHBOARD ====================
    if (action === 'getCopyTradingStats') {
      const [wallets, allocations] = await Promise.all([
        base44.asServiceRole.entities.CopyTradingWallet.list('-updated_at', 200),
        base44.asServiceRole.entities.CopyTradingAllocation.list('-created_at', 500)
      ]);

      const walls = wallets || [];
      const allocs = allocations || [];

      const totalBalance = walls.reduce((sum, w) => sum + (w.available_balance || 0) + (w.locked_balance || 0), 0);
      const activeWallets = walls.filter(w => w.status === 'ACTIVE').length;
      const suspendedWallets = walls.filter(w => w.status === 'SUSPENDED').length;
      const pendingAllocations = allocs.filter(a => a.status === 'PENDING' || a.status === 'PENDING_SETTLEMENT').length;
      const failedAllocations = allocs.filter(a => a.status === 'FAILED').length;

      return Response.json({
        ok: true,
        data: {
          available: activeWallets,
          assigned: walls.length,
          error: failedAllocations,
          totalBalance,
          pendingAllocations,
          suspendedWallets
        }
      });
    }

    return Response.json({ ok: false, error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` } });

  } catch (error) {
    console.error('[COPY_TRADING_ADMIN_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});