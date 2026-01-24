// @ts-nocheck
/// <reference lib="deno.ns" />
// Entitlements Processor - Grants points on activation, refreshes entitlements
// Runs via automation every 5 minutes

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Signal tier priority
const SIGNALS_PRIORITY = { NONE: 0, BASIC: 1, PRO: 2, VIP: 3 };
const COPY_TRADING_PRIORITY = { NONE: 0, ACCESS: 1, PRIORITY: 2, FULL: 3 };

function maxTier(current, incoming, priorityMap) {
  return (priorityMap[incoming] || 0) > (priorityMap[current] || 0) ? incoming : current;
}

// ==================== MAIN HANDLER ====================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }
    });
  }

  const base44 = createClientFromRequest(req);

  try {
    // Admin-only
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch { body = {}; }

    const { action, userId } = body || {};
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log('[ENTITLEMENTS] Action:', action || 'reconcileAll', 'RunID:', runId);

    // GET CONFIG
    const configs = await base44.asServiceRole.entities.EntitlementsConfig.filter({ config_key: 'default' });
    const config = configs?.[0] || {
      copy_trading_global_enabled: false,
      copy_trading_min_deposit_usdt: 100,
      copy_trading_require_kyc: true,
      copy_trading_default_level: 'ACCESS',
      copy_trading_deposit_source: 'TOTAL_OKX',
      default_signals_tier: 'NONE',
      default_leverage_max: 5
    };

    // GET ALL PLANS
    const plans = await base44.asServiceRole.entities.StakingPlan.filter({ is_enabled: true });
    const plansByKey = {};
    for (const p of (plans || [])) {
      plansByKey[p.key] = p;
    }

    // RECONCILE SINGLE USER
    if (action === 'reconcileUser' && userId) {
      const result = await reconcileUserEntitlements(base44, userId, config, plansByKey, runId);
      return Response.json({ ok: true, data: result });
    }

    // RECONCILE ALL (for automation)
    const stats = { processed: 0, pointsGranted: 0, entitlementsUpdated: 0, errors: 0 };
    
    // 1) Grant points to ACTIVE positions that haven't received them yet
    const activePositions = await base44.asServiceRole.entities.StakingPosition.filter({ status: 'ACTIVE' }, '-started_at', 500);
    
    for (const pos of (activePositions || [])) {
      // Skip if points already granted
      if (pos.points_granted_total > 0 || pos.last_points_grant_key) {
        continue;
      }

      try {
        const grantKey = `stake:${pos.id}:points:activation`;
        
        // Calculate points
        const plan = plansByKey[pos.plan_key];
        const baseRewards = pos.base_rewards_per_dollar || plan?.base_rewards_per_dollar || 0;
        const basePoints = Math.round((pos.principal_amount || 0) * baseRewards);
        
        // First stake bonus (already calculated in rewards_granted)
        const promoBonus = pos.first_stake_bonus_amount || 0;
        const totalPoints = basePoints + Math.round(promoBonus);
        
        if (totalPoints > 0) {
          // Write to RewardLedger
          await base44.asServiceRole.entities.RewardLedger.create({
            user_id: pos.user_id,
            type: 'milestone',
            subtype: 'staking_activation_points',
            amount: 0, // Points, not USDT
            points: totalPoints,
            currency: 'POINTS',
            status: 'credited',
            trigger_event_key: grantKey,
            meta: {
              staking_position_id: pos.id,
              plan_key: pos.plan_key,
              principal_amount: pos.principal_amount,
              base_rewards_per_dollar: baseRewards,
              first_stake_bonus: promoBonus
            },
            description: `Bonus points for staking ${pos.principal_amount} USDT (${pos.plan_key})`
          });

          // Update position
          await base44.asServiceRole.entities.StakingPosition.update(pos.id, {
            points_granted_total: totalPoints,
            last_points_grant_key: grantKey,
            last_points_grant_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

          stats.pointsGranted++;
          console.log(`[ENTITLEMENTS] Granted ${totalPoints} points to position ${pos.id}`);
        }
      } catch (e) {
        console.error(`[ENTITLEMENTS] Error granting points to ${pos.id}:`, e.message);
        stats.errors++;
      }
    }

    // 2) Get users with recent staking activity (last 24h) or no entitlement record
    const recentPositions = await base44.asServiceRole.entities.StakingPosition.filter(
      { status: 'ACTIVE' },
      '-updated_at',
      200
    );
    
    const userIds = new Set();
    for (const pos of (recentPositions || [])) {
      userIds.add(pos.user_id);
    }

    // Also get users with overrides
    const overrides = await base44.asServiceRole.entities.UserEntitlementOverride.filter({}, '-updated_at', 100);
    for (const ov of (overrides || [])) {
      userIds.add(ov.user_id);
    }

    // Process each user
    for (const uid of userIds) {
      try {
        await reconcileUserEntitlements(base44, uid, config, plansByKey, runId);
        stats.entitlementsUpdated++;
        stats.processed++;
      } catch (e) {
        console.error(`[ENTITLEMENTS] Error reconciling user ${uid}:`, e.message);
        stats.errors++;
      }
    }

    console.log('[ENTITLEMENTS] Reconciliation complete:', stats);
    return Response.json({ ok: true, data: stats });

  } catch (error) {
    console.error('[ENTITLEMENTS_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});

async function reconcileUserEntitlements(base44, userId, config, plansByKey, runId) {
  const now = new Date().toISOString();
  
  // Get user info (for KYC check)
  const users = await base44.asServiceRole.entities.User.filter({ id: userId });
  const user = users?.[0];
  const isKycVerified = user?.verification_status === 'verified';

  // Get user's active staking positions
  const positions = await base44.asServiceRole.entities.StakingPosition.filter({ 
    user_id: userId, 
    status: 'ACTIVE' 
  });

  // Get override
  const overrides = await base44.asServiceRole.entities.UserEntitlementOverride.filter({ user_id: userId });
  const override = overrides?.[0];
  const overrideActive = override?.copy_trading_override_enabled && 
    (!override.expires_at || new Date(override.expires_at) > new Date());

  // Get existing entitlement
  const entitlements = await base44.asServiceRole.entities.UserEntitlement.filter({ user_id: userId });
  const existing = entitlements?.[0];

  // Start with defaults
  let signalsTier = config.default_signals_tier || 'NONE';
  let copyTradingLevel = 'NONE';
  let copyTradingSource = 'NONE';
  let copyTradingReason = '';
  let leverageMax = config.default_leverage_max || 5;
  let feeDiscountBps = 0;
  let mentorAccess = false;
  let prioritySupport = false;
  let sourcePositionId = null;
  let activeStakingPlanKey = null;

  // Calculate total points from ledger
  const pointsLedger = await base44.asServiceRole.entities.RewardLedger.filter({
    user_id: userId,
    status: 'credited'
  });
  const totalPointsBalance = (pointsLedger || []).reduce((sum, entry) => sum + (entry.points || 0), 0);

  // Get last deposit for deposit-based rules
  let lastDepositUsdt = existing?.last_deposit_usdt || 0;
  
  // Try to get OKX balance if needed
  if (config.copy_trading_global_enabled) {
    try {
      const accounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({
        user_id: userId,
        provider: 'OKX',
        status: 'ACTIVE'
      });
      if (accounts?.length > 0) {
        lastDepositUsdt = accounts[0].last_balance_usdt || 0;
      }
    } catch (e) {
      console.log(`[ENTITLEMENTS] Could not fetch OKX balance for ${userId}`);
    }
  }

  // 1) Check override first
  if (overrideActive) {
    copyTradingLevel = override.copy_trading_override_level || 'NONE';
    copyTradingSource = 'OVERRIDE';
    copyTradingReason = override.reason || 'Admin override';
    
    if (override.signals_override_enabled) {
      signalsTier = override.signals_override_tier || signalsTier;
    }
  }
  // 2) Check global rule
  else if (config.copy_trading_global_enabled) {
    const meetsDeposit = lastDepositUsdt >= (config.copy_trading_min_deposit_usdt || 0);
    const meetsKyc = !config.copy_trading_require_kyc || isKycVerified;
    
    if (meetsDeposit && meetsKyc) {
      copyTradingLevel = config.copy_trading_default_level || 'ACCESS';
      copyTradingSource = 'GLOBAL';
      copyTradingReason = `Deposit ${lastDepositUsdt.toFixed(2)} USDT meets minimum`;
    }
  }

  // 3) Check staking - merge with existing (staking can upgrade beyond global/override)
  if (positions?.length > 0) {
    // Find best position by priority
    let bestPlan = null;
    let bestPosition = null;
    
    for (const pos of positions) {
      const plan = plansByKey[pos.plan_key];
      if (!plan) continue;
      
      if (!bestPlan || (plan.priority || 0) > (bestPlan.priority || 0)) {
        bestPlan = plan;
        bestPosition = pos;
      } else if ((plan.priority || 0) === (bestPlan.priority || 0) && plan.term_days > bestPlan.term_days) {
        bestPlan = plan;
        bestPosition = pos;
      }
    }

    if (bestPlan && bestPosition) {
      // Merge entitlements (take max)
      signalsTier = maxTier(signalsTier, bestPlan.signals_tier || 'NONE', SIGNALS_PRIORITY);
      
      // For copy trading, staking can upgrade level but not downgrade
      const stakingCopyLevel = bestPlan.copy_trading_level || 'ACCESS'; // Default ACCESS for any stake
      if (COPY_TRADING_PRIORITY[stakingCopyLevel] > COPY_TRADING_PRIORITY[copyTradingLevel]) {
        copyTradingLevel = stakingCopyLevel;
        copyTradingSource = 'STAKING';
        copyTradingReason = `${bestPlan.title} plan`;
      }
      
      leverageMax = Math.max(leverageMax, bestPlan.leverage_max || 5);
      feeDiscountBps = Math.max(feeDiscountBps, bestPlan.fee_discount_bps || 0);
      mentorAccess = mentorAccess || bestPlan.mentor_access || false;
      prioritySupport = prioritySupport || bestPlan.priority_support || false;
      sourcePositionId = bestPosition.id;
      activeStakingPlanKey = bestPlan.key;
    }
  }

  // Build entitlement data
  const entitlementData = {
    user_id: userId,
    signals_tier: signalsTier,
    copy_trading_level: copyTradingLevel,
    copy_trading_source: copyTradingSource,
    copy_trading_reason: copyTradingReason,
    leverage_max: leverageMax,
    fee_discount_bps: feeDiscountBps,
    mentor_access: mentorAccess,
    priority_support: prioritySupport,
    source_position_id: sourcePositionId,
    active_staking_plan_key: activeStakingPlanKey,
    total_points_balance: totalPointsBalance,
    last_deposit_usdt: lastDepositUsdt,
    last_deposit_check_at: now,
    kyc_verified: isKycVerified,
    updated_at: now,
    evaluated_at: now
  };

  // Create or update
  if (existing) {
    await base44.asServiceRole.entities.UserEntitlement.update(existing.id, entitlementData);
  } else {
    await base44.asServiceRole.entities.UserEntitlement.create(entitlementData);
  }

  return {
    userId,
    copyTradingLevel,
    copyTradingSource,
    signalsTier,
    totalPointsBalance
  };
}