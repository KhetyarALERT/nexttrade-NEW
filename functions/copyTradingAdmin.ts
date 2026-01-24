// @ts-nocheck
/// <reference lib="deno.ns" />
// Copy Trading Admin API - Server-side only
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
    if (!user || user.role !== 'admin') {
      return Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const { action } = body || {};

    // ==================== GET CONFIG ====================
    if (action === 'getConfig') {
      const configs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
      const config = configs?.[0] || {
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
        return Response.json({ ok: false, error: { code: 'INVALID_DATA', message: 'Missing config data' } });
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

      const existingConfigs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
      let config;

      if (existingConfigs?.[0]?.id) {
        await base44.asServiceRole.entities.CopyTradingConfig.update(existingConfigs[0].id, payload);
        config = { ...existingConfigs[0], ...payload };
      } else {
        config = await base44.asServiceRole.entities.CopyTradingConfig.create({
          config_key: 'default',
          ...payload
        });
      }

      return Response.json({ ok: true, data: config });
    }

    // ==================== LIST WALLETS ====================
    if (action === 'listWallets') {
      const wallets = await base44.asServiceRole.entities.CopyTradingWallet.list('-updated_at', 100);
      return Response.json({ ok: true, data: wallets || [] });
    }

    // ==================== LIST ALLOCATIONS ====================
    if (action === 'listAllocations') {
      const { status } = body;
      let allocations;
      if (status) {
        allocations = await base44.asServiceRole.entities.CopyTradingAllocation.filter({ status }, '-created_at', 200);
      } else {
        allocations = await base44.asServiceRole.entities.CopyTradingAllocation.list('-created_at', 200);
      }
      return Response.json({ ok: true, data: allocations || [] });
    }

    // ==================== LIST LEDGER ====================
    if (action === 'listLedger') {
      const { userId, limit = 100 } = body;
      let entries;
      if (userId) {
        entries = await base44.asServiceRole.entities.CopyTradingLedger.filter(
          { user_id: userId },
          '-created_at',
          Math.min(500, Number(limit))
        );
      } else {
        entries = await base44.asServiceRole.entities.CopyTradingLedger.list('-created_at', Math.min(500, Number(limit)));
      }
      return Response.json({ ok: true, data: entries || [] });
    }

    // ==================== RUN PROCESSOR NOW ====================
    if (action === 'runProcessorNow') {
      // Inline processor logic for immediate admin-triggered run
      const runId = crypto.randomUUID().substring(0, 8);
      const startTime = Date.now();
      console.log(`[COPY_TRADING_ADMIN] [${runId}] Admin triggered processor run`);

      const result = {
        runId,
        processedCount: 0,
        approvedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        details: []
      };

      try {
        const configs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
        const config = configs?.[0];

        if (!config?.enabled) {
          return Response.json({ ok: true, data: { ...result, message: 'Copy trading disabled' } });
        }

        const {
          auto_approve_max_amount = 1000,
          auto_approve_min_age_minutes = 5,
          require_kyc = true,
          pool_wallet_name = 'Main Copy Trading Pool'
        } = config;

        const pendingAllocations = await base44.asServiceRole.entities.CopyTradingAllocation.filter(
          { status: 'PENDING' },
          'created_at',
          100
        );

        if (!pendingAllocations?.length) {
          return Response.json({ ok: true, data: { ...result, message: 'No pending allocations' } });
        }

        const now = new Date();
        const minAgeMs = auto_approve_min_age_minutes * 60 * 1000;

        // Pre-fetch KYC
        const userKycMap = {};
        if (require_kyc) {
          const userIds = [...new Set(pendingAllocations.map(a => a.user_id))];
          for (const uid of userIds) {
            try {
              const verifications = await base44.asServiceRole.entities.VerificationRequest.filter(
                { user_id: uid, status: 'approved' },
                '-created_date',
                1
              );
              userKycMap[uid] = verifications?.length > 0;
            } catch {
              userKycMap[uid] = false;
            }
          }
        }

        for (const allocation of pendingAllocations) {
          result.processedCount++;
          const detail = { id: allocation.id, userEmail: allocation.user_email, amount: allocation.amount, status: 'pending' };

          try {
            if (allocation.status !== 'PENDING') {
              detail.status = 'skipped';
              detail.reason = 'Status changed';
              result.skippedCount++;
              result.details.push(detail);
              continue;
            }

            if (allocation.amount > auto_approve_max_amount) {
              detail.status = 'skipped';
              detail.reason = `Amount exceeds max ${auto_approve_max_amount}`;
              result.skippedCount++;
              result.details.push(detail);
              continue;
            }

            const createdAt = new Date(allocation.created_at || allocation.created_date);
            const ageMs = now.getTime() - createdAt.getTime();
            if (ageMs < minAgeMs) {
              detail.status = 'skipped';
              detail.reason = `Too new (${Math.round(ageMs / 60000)}min)`;
              result.skippedCount++;
              result.details.push(detail);
              continue;
            }

            if (require_kyc && !userKycMap[allocation.user_id]) {
              detail.status = 'skipped';
              detail.reason = 'KYC not approved';
              result.skippedCount++;
              result.details.push(detail);
              continue;
            }

            // For Phase 1 with INTERNAL_WALLET source, approve immediately
            // For OKX sources, mark as AWAITING_OKX_TRANSFER (manual intervention needed)
            const source = allocation.deposit_source || 'OKX_FUNDING';
            const nowIso = now.toISOString();

            if (source !== 'INTERNAL_WALLET') {
              // Mark as awaiting manual OKX transfer
              await base44.asServiceRole.entities.CopyTradingAllocation.update(allocation.id, {
                status: 'AWAITING_OKX_TRANSFER',
                note: 'Requires manual OKX transfer by admin',
                updated_at: nowIso
              });

              // Notify admin
              try {
                await base44.asServiceRole.entities.Notification.create({
                  user_id: user.id,
                  type: 'system',
                  title: 'Manual OKX Transfer Required',
                  message: `Copy Trading allocation ${allocation.id} for ${allocation.user_email} (${allocation.amount} USDT) requires manual OKX transfer.`,
                  data: { allocationId: allocation.id, action: 'copy_trading_manual_transfer' },
                  read: false,
                  priority: 'high'
                });
              } catch {}

              detail.status = 'awaiting_transfer';
              detail.reason = 'Marked for manual OKX transfer';
              result.skippedCount++;
              result.details.push(detail);
              continue;
            }

            // INTERNAL_WALLET: Approve immediately
            let wallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: allocation.user_id });
            let wallet = wallets?.[0];

            if (!wallet) {
              wallet = await base44.asServiceRole.entities.CopyTradingWallet.create({
                user_id: allocation.user_id,
                user_email: allocation.user_email,
                available_balance: 0,
                locked_balance: 0,
                lifetime_deposited: 0,
                lifetime_withdrawn: 0,
                lifetime_pnl: 0,
                status: 'ACTIVE',
                created_at: nowIso,
                updated_at: nowIso
              });
            }

            const balanceBefore = wallet.available_balance || 0;
            const balanceAfter = balanceBefore + allocation.amount;

            // Idempotent ledger entry
            const ledgerKey = `alloc:${allocation.id}:credit`;
            const existingLedger = await base44.asServiceRole.entities.CopyTradingLedger.filter({ idempotency_key: ledgerKey });

            if (!existingLedger?.length) {
              await base44.asServiceRole.entities.CopyTradingLedger.create({
                user_id: allocation.user_id,
                kind: 'CREDIT',
                amount: allocation.amount,
                currency: 'USDT',
                status: 'POSTED',
                ref_type: 'ALLOCATION',
                ref_id: allocation.id,
                idempotency_key: ledgerKey,
                balance_before: balanceBefore,
                balance_after: balanceAfter,
                description: `Copy trading allocation of ${allocation.amount} USDT`,
                created_at: nowIso
              });
            }

            await base44.asServiceRole.entities.CopyTradingWallet.update(wallet.id, {
              available_balance: balanceAfter,
              lifetime_deposited: (wallet.lifetime_deposited || 0) + allocation.amount,
              last_activity_at: nowIso,
              updated_at: nowIso
            });

            await base44.asServiceRole.entities.CopyTradingAllocation.update(allocation.id, {
              status: 'ACTIVE',
              approved_at: nowIso,
              approved_by: user.email,
              approved_by_type: 'ADMIN',
              last_error: null,
              updated_at: nowIso
            });

            // Notify user
            try {
              await base44.asServiceRole.entities.Notification.create({
                user_id: allocation.user_id,
                type: 'system',
                title: 'Copy Trading Funded! 🎉',
                message: `${allocation.amount} USDT has been added to your Copy Trading balance.`,
                data: { allocationId: allocation.id, action: 'copy_trading_funded' },
                read: false,
                priority: 'high'
              });
            } catch {}

            detail.status = 'approved';
            result.approvedCount++;
            result.details.push(detail);

          } catch (err) {
            detail.status = 'error';
            detail.reason = err.message;
            result.failedCount++;
            result.details.push(detail);
          }
        }

        const duration = Date.now() - startTime;
        console.log(`[COPY_TRADING_ADMIN] [${runId}] Completed: ${result.approvedCount} approved, ${result.skippedCount} skipped, ${result.failedCount} failed`);
        return Response.json({ ok: true, data: { ...result, durationMs: duration } });

      } catch (procErr) {
        console.error(`[COPY_TRADING_ADMIN] [${runId}] Processor error:`, procErr.message);
        return Response.json({ ok: false, error: { code: 'PROCESSOR_ERROR', message: procErr.message } });
      }
    }

    // ==================== GET STATS ====================
    if (action === 'getStats') {
      const [wallets, allocations] = await Promise.all([
        base44.asServiceRole.entities.CopyTradingWallet.list('-updated_at', 1000),
        base44.asServiceRole.entities.CopyTradingAllocation.list('-created_at', 1000),
      ]);

      const totalBalance = (wallets || []).reduce((sum, w) => sum + (w.available_balance || 0), 0);
      const totalAllocated = (wallets || []).reduce((sum, w) => sum + (w.locked_balance || 0), 0);
      const pendingAllocations = (allocations || []).filter(a => a.status === 'PENDING').length;
      const awaitingTransfer = (allocations || []).filter(a => a.status === 'AWAITING_OKX_TRANSFER').length;

      return Response.json({
        ok: true,
        data: {
          totalWallets: (wallets || []).length,
          totalBalance,
          totalAllocated,
          pendingAllocations,
          awaitingTransfer
        }
      });
    }

    return Response.json({ ok: false, error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` } });

  } catch (error) {
    console.error('[COPY_TRADING_ADMIN_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});