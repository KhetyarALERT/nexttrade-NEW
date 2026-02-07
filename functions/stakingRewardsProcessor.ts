// @ts-nocheck
/// <reference lib="deno.ns" />
// Staking Rewards Processor - Daily accrual of APY rewards (NO automatic OKX transfers)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Get today's date key in YYYY-MM-DD format (UTC)
 */
function getTodayDateKey() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Calculate daily accrual for a position
 * daily = principal * (apy/100) / 365
 */
function calculateDailyAccrual(principal, apyPercent) {
  if (!principal || principal <= 0 || !apyPercent || apyPercent <= 0) return 0;
  return (principal * (apyPercent / 100)) / 365;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  const base44 = createClientFromRequest(req);
  const runId = crypto.randomUUID().substring(0, 8);
  const startTime = Date.now();

  let payload = {};
  try {
    payload = await req.json().catch(() => ({}));
  } catch {
    payload = {};
  }

  const { action = 'processDailyAccrual', date_key } = payload;

  console.log(`[STAKING_REWARDS] [${runId}] Action: ${action}`);

  try {
    // ==================== ACTION: processDailyAccrual ====================
    if (action === 'processDailyAccrual') {
      // This can be called by automation or manually by admin
      const targetDateKey = date_key || getTodayDateKey();

      console.log(`[STAKING_REWARDS] [${runId}] Processing accrual for date: ${targetDateKey}`);

      const result = {
        runId,
        dateKey: targetDateKey,
        processedCount: 0,
        accruedCount: 0,
        skippedCount: 0,
        totalAccrued: 0,
        details: []
      };

      // Get all ACTIVE positions
      const activePositions = await base44.asServiceRole.entities.StakingPosition.filter(
        { status: 'ACTIVE' },
        'started_at',
        500
      );

      if (!activePositions?.length) {
        console.log(`[STAKING_REWARDS] [${runId}] No active positions`);
        return Response.json({ ok: true, data: { ...result, message: 'No active positions' } });
      }

      console.log(`[STAKING_REWARDS] [${runId}] Found ${activePositions.length} active positions`);

      for (const position of activePositions) {
        result.processedCount++;
        const detail = {
          positionId: position.id,
          userId: position.user_id,
          principal: position.principal_amount,
          status: 'pending'
        };

        try {
          // IDEMPOTENCY CHECK: Already accrued for this date?
          if (position.last_accrual_date_key === targetDateKey) {
            detail.status = 'skipped';
            detail.reason = 'Already accrued for this date';
            result.skippedCount++;
            result.details.push(detail);
            continue;
          }

          // Double-check via ledger (belt + suspenders)
          const existingLedger = await base44.asServiceRole.entities.StakingRewardsLedger.filter({
            staking_position_id: position.id,
            date_key: targetDateKey,
            kind: 'ACCRUAL',
            status: 'POSTED'
          });

          if (existingLedger?.length > 0) {
            detail.status = 'skipped';
            detail.reason = 'Ledger entry exists';
            result.skippedCount++;
            result.details.push(detail);

            // Fix position if out of sync
            if (position.last_accrual_date_key !== targetDateKey) {
              await base44.asServiceRole.entities.StakingPosition.update(position.id, {
                last_accrual_date_key: targetDateKey,
                last_accrual_at: new Date().toISOString()
              });
            }
            continue;
          }

          // Calculate daily accrual
          const dailyAmount = calculateDailyAccrual(position.principal_amount, position.apy_percent);

          if (dailyAmount <= 0) {
            detail.status = 'skipped';
            detail.reason = 'Zero accrual amount';
            result.skippedCount++;
            result.details.push(detail);
            continue;
          }

          const roundedAmount = Math.round(dailyAmount * 1000000) / 1000000; // 6 decimal precision
          const nowIso = new Date().toISOString();

          // Create ledger entry
          await base44.asServiceRole.entities.StakingRewardsLedger.create({
            user_id: position.user_id,
            staking_position_id: position.id,
            kind: 'ACCRUAL',
            amount: roundedAmount,
            date_key: targetDateKey,
            status: 'POSTED',
            run_id: runId,
            note: `Daily accrual: ${position.apy_percent}% APY on $${position.principal_amount}`,
            created_at: nowIso
          });

          // Update position
          const newAccrued = (position.accrued_amount || 0) + roundedAmount;
          const claimable = newAccrued - (position.paid_amount || 0);
          const newPayoutStatus = claimable > 0.01 ? 'CLAIMABLE' : 'NONE';

          await base44.asServiceRole.entities.StakingPosition.update(position.id, {
            accrued_amount: newAccrued,
            last_accrual_date_key: targetDateKey,
            last_accrual_at: nowIso,
            payout_status: newPayoutStatus,
            updated_at: nowIso
          });

          // === MONTHLY PAYOUT CHECK (every 30 days) ===
          const startedAt = new Date(position.started_at);
          const nowTime = new Date();
          const daysSinceStart = Math.floor((nowTime - startedAt) / (1000 * 60 * 60 * 24));
          
          // Payout triggers on day 30, 60, 90...
          if (daysSinceStart > 0 && daysSinceStart % 30 === 0) {
            // Auto-payout accumulated rewards
            if (claimable > 0.01) {
              const payoutAmount = claimable;
              
              if (position.source_account === 'COPY_TRADING') {
                // Credit Copy Trading Wallet directly
                const wallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: position.user_id });
                if (wallets?.[0]) {
                  const wallet = wallets[0];
                  
                  // Update Wallet
                  await base44.asServiceRole.entities.CopyTradingWallet.update(wallet.id, {
                    available_balance: wallet.available_balance + payoutAmount,
                    updated_at: nowIso
                  });

                  // Wallet Ledger
                  await base44.asServiceRole.entities.CopyTradingLedger.create({
                    user_id: position.user_id,
                    kind: 'STAKING_REWARD',
                    amount: payoutAmount,
                    currency: 'USDT',
                    status: 'POSTED',
                    ref_type: 'STAKING',
                    ref_id: position.id,
                    balance_before: wallet.available_balance,
                    balance_after: wallet.available_balance + payoutAmount,
                    description: `Staking Reward (${daysSinceStart} days)`,
                    created_at: nowIso
                  });

                  // Update Position as PAID
                  await base44.asServiceRole.entities.StakingPosition.update(position.id, {
                    paid_amount: (position.paid_amount || 0) + payoutAmount,
                    payout_status: 'PAID',
                    last_payout_at: nowIso,
                    updated_at: nowIso
                  });

                  // Rewards Ledger
                  await base44.asServiceRole.entities.StakingRewardsLedger.create({
                    user_id: position.user_id,
                    staking_position_id: position.id,
                    kind: 'PAYOUT',
                    amount: -payoutAmount,
                    date_key: targetDateKey,
                    status: 'POSTED',
                    run_id: runId,
                    note: `Auto-payout to Copy Trading Wallet (Day ${daysSinceStart})`,
                    created_at: nowIso
                  });
                  
                  detail.payout = `Paid ${payoutAmount} to CopyTradingWallet`;
                }
              }
              // For MAIN, we keep it accumluating/claimable or use existing payout flow (no auto-credit yet unless requested)
            }
          }

          detail.status = 'accrued';
          detail.amount = roundedAmount;
          detail.newTotal = newAccrued;
          result.accruedCount++;
          result.totalAccrued += roundedAmount;
          result.details.push(detail);

        } catch (err) {
          console.error(`[STAKING_REWARDS] [${runId}] Error processing position ${position.id}:`, err.message);
          detail.status = 'error';
          detail.error = err.message;
          result.details.push(detail);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[STAKING_REWARDS] [${runId}] Completed in ${duration}ms: processed=${result.processedCount}, accrued=${result.accruedCount}, skipped=${result.skippedCount}, total=$${result.totalAccrued.toFixed(6)}`);

      return Response.json({ ok: true, data: { ...result, durationMs: duration } });
    }

    // ==================== ACTION: getMyRewardsSummary ====================
    if (action === 'getMyRewardsSummary') {
      const user = await base44.auth.me();
      if (!user) {
        return Response.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 });
      }

      // Get all user's positions
      const positions = await base44.entities.StakingPosition.filter({ user_id: user.id });

      let totalAccrued = 0;
      let totalPaid = 0;
      const positionSummaries = [];

      for (const pos of (positions || [])) {
        const accrued = pos.accrued_amount || 0;
        const paid = pos.paid_amount || 0;
        const claimable = accrued - paid;

        totalAccrued += accrued;
        totalPaid += paid;

        if (pos.status === 'ACTIVE' || claimable > 0) {
          positionSummaries.push({
            positionId: pos.id,
            planKey: pos.plan_key,
            principal: pos.principal_amount,
            apyPercent: pos.apy_percent,
            status: pos.status,
            accrued,
            paid,
            claimable,
            payoutStatus: pos.payout_status || 'NONE',
            lastAccrualAt: pos.last_accrual_at
          });
        }
      }

      return Response.json({
        ok: true,
        data: {
          totalAccrued,
          totalPaid,
          totalClaimable: totalAccrued - totalPaid,
          positions: positionSummaries
        }
      });
    }

    // ==================== ACTION: requestPayout ====================
    if (action === 'requestPayout') {
      const user = await base44.auth.me();
      if (!user) {
        return Response.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 });
      }

      const { position_id, amount, early } = payload;
      if (!position_id) {
        return Response.json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Missing position_id' } }, { status: 400 });
      }

      // Get position and verify ownership
      const positions = await base44.entities.StakingPosition.filter({ id: position_id, user_id: user.id });
      if (!positions?.length) {
        return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Position not found' } }, { status: 404 });
      }

      const position = positions[0];
      const claimable = (position.accrued_amount || 0) - (position.paid_amount || 0);

      if (claimable < 0.01) {
        return Response.json({ ok: false, error: { code: 'INSUFFICIENT', message: 'No claimable rewards' } }, { status: 400 });
      }

      const requestAmount = amount ? Math.min(amount, claimable) : claimable;
      const nowIso = new Date().toISOString();
      const dateKey = getTodayDateKey();

      // Check if period is finished (mature claim = auto-process)
      const endsAt = position.ends_at ? new Date(position.ends_at) : null;
      const isPeriodFinished = endsAt && endsAt.getTime() <= Date.now();

      if (isPeriodFinished && !early) {
        // === AUTO-PROCESS: Period is over, credit directly ===
        console.log(`[STAKING_REWARDS] [${runId}] Auto-processing mature claim for position ${position.id}: $${requestAmount.toFixed(6)}`);

        // Handle payout destination based on source
        if (position.source_account === 'COPY_TRADING') {
          const wallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: position.user_id });
          if (wallets?.[0]) {
            const wallet = wallets[0];
            await base44.asServiceRole.entities.CopyTradingWallet.update(wallet.id, {
              available_balance: wallet.available_balance + requestAmount,
              updated_at: nowIso
            });
            await base44.asServiceRole.entities.CopyTradingLedger.create({
              user_id: position.user_id,
              kind: 'STAKING_REWARD',
              amount: requestAmount,
              currency: 'USDT',
              status: 'POSTED',
              ref_type: 'STAKING',
              ref_id: position.id,
              balance_before: wallet.available_balance,
              balance_after: wallet.available_balance + requestAmount,
              description: `Mature Staking Reward Claim`,
              created_at: nowIso
            });
          }
        }
        // For MAIN source - credit to internal wallet if exists, otherwise just mark as paid
        // (The admin payout flow handles actual OKX transfers for MAIN)

        // Create payout ledger entry
        await base44.asServiceRole.entities.StakingRewardsLedger.create({
          user_id: position.user_id,
          staking_position_id: position.id,
          kind: 'PAYOUT',
          amount: -requestAmount,
          date_key: dateKey,
          status: 'POSTED',
          run_id: runId,
          note: `Auto-payout (period completed) by ${user.email}`,
          created_at: nowIso
        });

        // Update position
        const newPaid = (position.paid_amount || 0) + requestAmount;
        const remaining = (position.accrued_amount || 0) - newPaid;
        await base44.asServiceRole.entities.StakingPosition.update(position.id, {
          paid_amount: newPaid,
          payout_status: remaining > 0.01 ? 'CLAIMABLE' : 'PAID',
          last_payout_at: nowIso,
          updated_at: nowIso
        });

        // Notify user
        try {
          await base44.asServiceRole.entities.Notification.create({
            user_id: user.id,
            type: 'staking_reward',
            title: 'Staking Rewards Collected! 💰',
            message: `$${requestAmount.toFixed(2)} USDT rewards have been collected from your completed staking position.`,
            data: { stakingPositionId: position.id, amount: requestAmount, action: 'mature_claim' },
            read: false,
            priority: 'normal'
          });
        } catch (e) {
          console.log(`[STAKING_REWARDS] Failed to notify user:`, e.message);
        }

        return Response.json({
          ok: true,
          data: {
            positionId: position.id,
            paidAmount: requestAmount,
            payoutStatus: remaining > 0.01 ? 'CLAIMABLE' : 'PAID',
            autoProcessed: true,
            message: 'Rewards collected automatically (period completed).'
          }
        });
      }

      // === EARLY CLAIM: Period not finished, needs admin approval ===
      // Update position to REQUESTED status
      await base44.entities.StakingPosition.update(position.id, {
        payout_status: 'REQUESTED',
        updated_at: nowIso
      });

      // Notify ALL admins
      try {
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        for (const admin of (admins || []).slice(0, 5)) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: admin.id,
            type: 'system',
            title: 'Early Claim Requested',
            message: `${user.email} requested early claim of $${requestAmount.toFixed(2)} USDT (period still active)`,
            data: { stakingPositionId: position.id, amount: requestAmount, action: 'early_claim_requested', userEmail: user.email },
            read: false,
            priority: 'high'
          });
        }
      } catch (e) {
        console.log(`[STAKING_REWARDS] Failed to notify admin:`, e.message);
      }

      // Notify user (confirmation)
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id,
          type: 'staking_reward',
          title: 'Early Claim Request Submitted',
          message: `Your early claim of $${requestAmount.toFixed(2)} USDT is pending admin approval.`,
          data: { stakingPositionId: position.id, amount: requestAmount, action: 'early_claim_requested' },
          read: false,
          priority: 'normal'
        });
      } catch (e) {
        console.log(`[STAKING_REWARDS] Failed to notify user:`, e.message);
      }

      return Response.json({
        ok: true,
        data: {
          positionId: position.id,
          requestedAmount: requestAmount,
          payoutStatus: 'REQUESTED',
          autoProcessed: false,
          message: 'Early claim request submitted. Admin will review and process.'
        }
      });
    }

    // ==================== ACTION: adminProcessPayout (admin only) ====================
    if (action === 'adminProcessPayout') {
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin only' } }, { status: 403 });
    }

    const { position_id, amount, note } = payload;
    if (!position_id || !amount || amount <= 0) {
      return Response.json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Missing position_id or amount' } }, { status: 400 });
    }

    const positions = await base44.asServiceRole.entities.StakingPosition.filter({ id: position_id });
    if (!positions?.length) {
      return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Position not found' } }, { status: 404 });
    }

    const position = positions[0];
    const claimable = (position.accrued_amount || 0) - (position.paid_amount || 0);

    if (amount > claimable + 0.01) {
      return Response.json({ ok: false, error: { code: 'EXCEEDS_CLAIMABLE', message: `Amount exceeds claimable: ${claimable.toFixed(6)}` } }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const dateKey = getTodayDateKey();

    // Handle payout destination based on source
    if (position.source_account === 'COPY_TRADING') {
      const wallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: position.user_id });
      if (!wallets?.length) return Response.json({ ok: false, error: { code: 'NO_WALLET', message: 'Wallet not found' } }, { status: 400 });
      const wallet = wallets[0];

      // Credit wallet
      await base44.asServiceRole.entities.CopyTradingWallet.update(wallet.id, {
        available_balance: wallet.available_balance + amount,
        updated_at: nowIso
      });

      // Wallet Ledger
      await base44.asServiceRole.entities.CopyTradingLedger.create({
        user_id: position.user_id,
        kind: 'STAKING_REWARD',
        amount: amount,
        currency: 'USDT',
        status: 'POSTED',
        ref_type: 'STAKING',
        ref_id: position.id,
        balance_before: wallet.available_balance,
        balance_after: wallet.available_balance + amount,
        description: `Manual Reward Payout`,
        created_at: nowIso
      });
    }

    // Create payout ledger entry
    await base44.asServiceRole.entities.StakingRewardsLedger.create({
      user_id: position.user_id,
      staking_position_id: position.id,
      kind: 'PAYOUT',
      amount: -amount, // Negative for payout
      date_key: dateKey,
      status: 'POSTED',
      run_id: runId,
      note: note || `Manual payout by ${user.email}`,
      created_at: nowIso
    });

    // Update position
    const newPaid = (position.paid_amount || 0) + amount;
    const newClaimable = (position.accrued_amount || 0) - newPaid;
    const newStatus = newClaimable > 0.01 ? 'CLAIMABLE' : 'PAID';

    await base44.asServiceRole.entities.StakingPosition.update(position.id, {
      paid_amount: newPaid,
      payout_status: newStatus,
      last_payout_at: nowIso,
      updated_at: nowIso
    });

      // Notify user
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_id: position.user_id,
          type: 'staking_reward',
          title: 'Staking Rewards Paid! 💰',
          message: `$${amount.toFixed(2)} USDT has been paid out from your staking rewards.`,
          data: { stakingPositionId: position.id, amount, action: 'payout_processed' },
          read: false,
          priority: 'normal'
        });
      } catch (e) {
        console.log(`[STAKING_REWARDS] Failed to notify user:`, e.message);
      }

      // Notify ALL admins about the payout (audit trail)
      try {
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        for (const admin of (admins || []).slice(0, 5)) {
          if (admin.id === user.id) continue; // Skip the admin who just processed it
          await base44.asServiceRole.entities.Notification.create({
            user_id: admin.id,
            type: 'system',
            title: 'Staking Payout Processed',
            message: `${user.email} paid $${amount.toFixed(2)} USDT to ${position.user_email || position.user_id} from staking rewards`,
            data: { stakingPositionId: position.id, amount, action: 'payout_processed', processedBy: user.email },
            read: false,
            priority: 'normal'
          });
        }
      } catch (e) {
        console.log(`[STAKING_REWARDS] Failed to notify other admins:`, e.message);
      }

      return Response.json({
        ok: true,
        data: {
          positionId: position.id,
          paidAmount: amount,
          newTotalPaid: newPaid,
          remainingClaimable: newClaimable,
          payoutStatus: newStatus
        }
      });
    }

    // ==================== ACTION: getAdminPayoutSummary (admin only) ====================
    if (action === 'getAdminPayoutSummary') {
      const user = await base44.auth.me();
      if (!user || user.role !== 'admin') {
        return Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin only' } }, { status: 403 });
      }

      // Get all positions with claimable rewards
      const allPositions = await base44.asServiceRole.entities.StakingPosition.filter({}, '-accrued_amount', 200);

      let totalClaimable = 0;
      let totalRequested = 0;
      const pendingPayouts = [];

      for (const pos of (allPositions || [])) {
        const claimable = (pos.accrued_amount || 0) - (pos.paid_amount || 0);
        if (claimable > 0.01) {
          totalClaimable += claimable;

          if (pos.payout_status === 'REQUESTED') {
            totalRequested += claimable;
            pendingPayouts.push({
              positionId: pos.id,
              userId: pos.user_id,
              userEmail: pos.user_email,
              planKey: pos.plan_key,
              principal: pos.principal_amount,
              accrued: pos.accrued_amount || 0,
              paid: pos.paid_amount || 0,
              claimable,
              payoutStatus: pos.payout_status,
              lastAccrualAt: pos.last_accrual_at
            });
          }
        }
      }

      return Response.json({
        ok: true,
        data: {
          totalClaimable,
          totalRequested,
          pendingPayoutsCount: pendingPayouts.length,
          pendingPayouts
        }
      });
    }

    // ==================== ACTION: sendAdminReminder (for automation) ====================
    if (action === 'sendAdminReminder') {
      // Get admin payout summary
      const allPositions = await base44.asServiceRole.entities.StakingPosition.filter({}, '-accrued_amount', 500);

      let totalRequested = 0;
      let requestedCount = 0;

      for (const pos of (allPositions || [])) {
        if (pos.payout_status === 'REQUESTED') {
          const claimable = (pos.accrued_amount || 0) - (pos.paid_amount || 0);
          if (claimable > 0.01) {
            totalRequested += claimable;
            requestedCount++;
          }
        }
      }

      if (requestedCount === 0) {
        return Response.json({ ok: true, data: { message: 'No pending payout requests', notificationSent: false } });
      }

      // Check if we already sent a notification today (dedupe)
      const todayKey = getTodayDateKey();
      const existingNotifs = await base44.asServiceRole.entities.Notification.filter({
        type: 'system',
        title: 'Staking Payouts Pending'
      });

      const alreadySentToday = existingNotifs?.some(n => {
        const createdDate = new Date(n.created_date || n.created_at).toISOString().split('T')[0];
        return createdDate === todayKey;
      });

      if (alreadySentToday) {
        return Response.json({ ok: true, data: { message: 'Already notified today', notificationSent: false } });
      }

      // Send notification
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      if (admins?.length) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admins[0].id,
          type: 'system',
          title: 'Staking Payouts Pending',
          message: `${requestedCount} payout request(s) totaling $${totalRequested.toFixed(2)} awaiting manual processing.`,
          data: { action: 'payout_reminder', count: requestedCount, total: totalRequested },
          read: false,
          priority: 'high'
        });
      }

      return Response.json({ ok: true, data: { message: 'Notification sent', notificationSent: true, requestedCount, totalRequested } });
    }

    return Response.json({ ok: false, error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` } }, { status: 400 });

  } catch (error) {
    console.error(`[STAKING_REWARDS] [${runId}] Error:`, error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});