import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Entitlements Processor
 * 
 * Actions:
 * - refreshUser: Refresh entitlements for a single user
 * - refreshAll: Refresh entitlements for all users with recent staking changes
 * - grantStakingPoints: Grant points when stake becomes ACTIVE (idempotent)
 * - getConfig: Get current entitlements config
 * - updateConfig: Update entitlements config (admin)
 * - createOverride: Create user override (admin)
 * - updateOverride: Update user override (admin)
 * - deleteOverride: Delete user override (admin)
 * - getUserEntitlement: Get computed entitlement for a user
 */

// Tier priority (higher = better)
const SIGNALS_PRIORITY = { NONE: 0, BASIC: 1, PRO: 2, VIP: 3 };
const COPY_TRADING_PRIORITY = { NONE: 0, ACCESS: 1, PRIORITY: 2, FULL: 3 };

function maxTier(a, b, priority) {
  return (priority[a] || 0) >= (priority[b] || 0) ? a : b;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action } = body;

    // Get config (cached for request)
    async function getConfig() {
      const configs = await base44.asServiceRole.entities.EntitlementsConfig.filter({ config_key: 'default' });
      if (configs.length > 0) return configs[0];
      // Create default config if not exists
      const newConfig = await base44.asServiceRole.entities.EntitlementsConfig.create({
        config_key: 'default',
        copy_trading_global_enabled: false,
        copy_trading_min_deposit_usdt: 100,
        copy_trading_require_kyc: false,
        copy_trading_default_level: 'ACCESS',
        copy_trading_deposit_source: 'TOTAL_OKX',
        default_signals_tier: 'NONE',
        default_leverage_max: 10,
        updated_at: new Date().toISOString(),
      });
      return newConfig;
    }

    // Check if override is active
    function isOverrideActive(override) {
      if (!override || !override.is_active) return false;
      if (override.expires_at && new Date(override.expires_at) < new Date()) return false;
      return true;
    }

    // Compute entitlements for a user
    async function computeEntitlements(userId, userEmail, config, override, activePositions, plans, depositUsdt = 0, isKycVerified = false) {
      const now = new Date().toISOString();
      
      // Start with defaults
      let result = {
        user_id: userId,
        user_email: userEmail,
        signals_tier: config.default_signals_tier || 'NONE',
        copy_trading_level: 'NONE',
        copy_trading_source: 'NONE',
        copy_trading_reason: null,
        leverage_max: config.default_leverage_max || 10,
        fee_discount_bps: 0,
        mentor_access: false,
        priority_support: false,
        active_plan_key: null,
        active_position_id: null,
        perks_display: [],
        last_deposit_usdt: depositUsdt,
        last_deposit_check_at: now,
        evaluated_at: now,
        evaluation_note: 'Default entitlements',
      };

      // 1) Check override first
      if (isOverrideActive(override)) {
        if (override.copy_trading_override_enabled) {
          result.copy_trading_level = override.copy_trading_override_level || 'NONE';
          result.copy_trading_source = 'OVERRIDE';
          result.copy_trading_reason = override.reason || 'Admin override';
        }
        if (override.signals_override_enabled) {
          result.signals_tier = override.signals_override_tier || 'NONE';
        }
        if (override.leverage_override_enabled) {
          result.leverage_max = override.leverage_override_max || 10;
        }
        result.evaluation_note = 'Override applied';
      }

      // 2) Check global rule (if no override for copy trading)
      if (result.copy_trading_source === 'NONE' && config.copy_trading_global_enabled) {
        const meetsDeposit = depositUsdt >= (config.copy_trading_min_deposit_usdt || 0);
        const meetsKyc = !config.copy_trading_require_kyc || isKycVerified;
        
        if (meetsDeposit && meetsKyc) {
          result.copy_trading_level = config.copy_trading_default_level || 'ACCESS';
          result.copy_trading_source = 'GLOBAL';
          result.copy_trading_reason = `Deposit ≥ ${config.copy_trading_min_deposit_usdt} USDT`;
        }
      }

      // 3) Check staking plans
      if (activePositions.length > 0) {
        // Build plan lookup
        const planMap = {};
        for (const p of plans) {
          planMap[p.key] = p;
        }

        // Sort positions by plan priority (higher = better), then by principal
        const sortedPositions = [...activePositions].sort((a, b) => {
          const planA = planMap[a.plan_key] || {};
          const planB = planMap[b.plan_key] || {};
          const prioA = planA.priority || planA.term_days || 0;
          const prioB = planB.priority || planB.term_days || 0;
          if (prioB !== prioA) return prioB - prioA;
          return (b.principal_amount || 0) - (a.principal_amount || 0);
        });

        const bestPosition = sortedPositions[0];
        const bestPlan = planMap[bestPosition.plan_key];

        if (bestPlan) {
          result.active_plan_key = bestPlan.key;
          result.active_position_id = bestPosition.id;

          // Merge staking entitlements (take best)
          result.signals_tier = maxTier(result.signals_tier, bestPlan.signals_tier || 'NONE', SIGNALS_PRIORITY);
          
          // Only upgrade copy trading from staking if not already from override
          if (result.copy_trading_source !== 'OVERRIDE') {
            const stakingCopyLevel = bestPlan.copy_trading_level || 'NONE';
            if (COPY_TRADING_PRIORITY[stakingCopyLevel] > COPY_TRADING_PRIORITY[result.copy_trading_level]) {
              result.copy_trading_level = stakingCopyLevel;
              result.copy_trading_source = 'STAKING';
              result.copy_trading_reason = `${bestPlan.title} staking`;
            }
          }

          result.leverage_max = Math.max(result.leverage_max, bestPlan.leverage_max || 10);
          result.fee_discount_bps = Math.max(result.fee_discount_bps, bestPlan.fee_discount_bps || 0);
          result.mentor_access = result.mentor_access || bestPlan.mentor_access || false;
          result.priority_support = result.priority_support || bestPlan.priority_support || false;
          result.perks_display = bestPlan.perks_display || bestPlan.perks || [];
          result.evaluation_note = `Staking: ${bestPlan.title}`;
        }
      }

      return result;
    }

    // ACTION: getConfig
    if (action === 'getConfig') {
      const config = await getConfig();
      return Response.json({ ok: true, data: config });
    }

    // ACTION: updateConfig (admin only)
    if (action === 'updateConfig') {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ ok: false, error: { message: 'Admin access required' } }, { status: 403 });
      }

      const config = await getConfig();
      const oldValue = { ...config };

      const updates = {};
      const allowedFields = [
        'copy_trading_global_enabled', 'copy_trading_min_deposit_usdt', 'copy_trading_require_kyc',
        'copy_trading_default_level', 'copy_trading_deposit_source', 'default_signals_tier', 'default_leverage_max'
      ];
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates[field] = body[field];
        }
      }
      updates.updated_at = new Date().toISOString();
      updates.updated_by = user.email;

      await base44.asServiceRole.entities.EntitlementsConfig.update(config.id, updates);

      // Log audit
      await base44.asServiceRole.entities.EntitlementAuditLog.create({
        action_type: 'CONFIG_UPDATE',
        admin_user_id: user.id,
        admin_email: user.email,
        old_value: oldValue,
        new_value: updates,
        note: body.note || null,
      });

      return Response.json({ ok: true, data: { ...config, ...updates } });
    }

    // ACTION: createOverride (admin only)
    if (action === 'createOverride') {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ ok: false, error: { message: 'Admin access required' } }, { status: 403 });
      }

      const { targetUserId, targetUserEmail, ...overrideData } = body;
      if (!targetUserId) {
        return Response.json({ ok: false, error: { message: 'targetUserId required' } }, { status: 400 });
      }

      // Check if override already exists
      const existing = await base44.asServiceRole.entities.UserEntitlementOverride.filter({ user_id: targetUserId });
      if (existing.length > 0) {
        return Response.json({ ok: false, error: { message: 'Override already exists for this user' } }, { status: 400 });
      }

      const override = await base44.asServiceRole.entities.UserEntitlementOverride.create({
        user_id: targetUserId,
        user_email: targetUserEmail,
        copy_trading_override_enabled: overrideData.copy_trading_override_enabled || false,
        copy_trading_override_level: overrideData.copy_trading_override_level || 'NONE',
        signals_override_enabled: overrideData.signals_override_enabled || false,
        signals_override_tier: overrideData.signals_override_tier || 'NONE',
        leverage_override_enabled: overrideData.leverage_override_enabled || false,
        leverage_override_max: overrideData.leverage_override_max || 10,
        reason: overrideData.reason || '',
        expires_at: overrideData.expires_at || null,
        is_active: true,
        created_by_admin_id: user.id,
        created_by_admin_email: user.email,
      });

      // Log audit
      await base44.asServiceRole.entities.EntitlementAuditLog.create({
        action_type: 'OVERRIDE_CREATE',
        target_user_id: targetUserId,
        target_user_email: targetUserEmail,
        admin_user_id: user.id,
        admin_email: user.email,
        new_value: override,
        note: overrideData.reason || null,
      });

      return Response.json({ ok: true, data: override });
    }

    // ACTION: updateOverride (admin only)
    if (action === 'updateOverride') {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ ok: false, error: { message: 'Admin access required' } }, { status: 403 });
      }

      const { overrideId, ...updates } = body;
      if (!overrideId) {
        return Response.json({ ok: false, error: { message: 'overrideId required' } }, { status: 400 });
      }

      const existing = await base44.asServiceRole.entities.UserEntitlementOverride.filter({ id: overrideId });
      if (existing.length === 0) {
        return Response.json({ ok: false, error: { message: 'Override not found' } }, { status: 404 });
      }
      const oldValue = existing[0];

      const allowedFields = [
        'copy_trading_override_enabled', 'copy_trading_override_level',
        'signals_override_enabled', 'signals_override_tier',
        'leverage_override_enabled', 'leverage_override_max',
        'reason', 'expires_at', 'is_active'
      ];
      const updateData = {};
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          updateData[field] = updates[field];
        }
      }

      await base44.asServiceRole.entities.UserEntitlementOverride.update(overrideId, updateData);

      // Log audit
      await base44.asServiceRole.entities.EntitlementAuditLog.create({
        action_type: 'OVERRIDE_UPDATE',
        target_user_id: oldValue.user_id,
        target_user_email: oldValue.user_email,
        admin_user_id: user.id,
        admin_email: user.email,
        old_value: oldValue,
        new_value: updateData,
        note: updates.reason || null,
      });

      return Response.json({ ok: true, data: { ...oldValue, ...updateData } });
    }

    // ACTION: deleteOverride (admin only)
    if (action === 'deleteOverride') {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ ok: false, error: { message: 'Admin access required' } }, { status: 403 });
      }

      const { overrideId } = body;
      if (!overrideId) {
        return Response.json({ ok: false, error: { message: 'overrideId required' } }, { status: 400 });
      }

      const existing = await base44.asServiceRole.entities.UserEntitlementOverride.filter({ id: overrideId });
      if (existing.length === 0) {
        return Response.json({ ok: false, error: { message: 'Override not found' } }, { status: 404 });
      }
      const oldValue = existing[0];

      await base44.asServiceRole.entities.UserEntitlementOverride.delete(overrideId);

      // Log audit
      await base44.asServiceRole.entities.EntitlementAuditLog.create({
        action_type: 'OVERRIDE_DELETE',
        target_user_id: oldValue.user_id,
        target_user_email: oldValue.user_email,
        admin_user_id: user.id,
        admin_email: user.email,
        old_value: oldValue,
        note: body.reason || null,
      });

      return Response.json({ ok: true });
    }

    // ACTION: getUserEntitlement
    if (action === 'getUserEntitlement') {
      const { userId } = body;
      let targetUserId = userId;

      // If no userId provided, get current user
      if (!targetUserId) {
        const currentUser = await base44.auth.me();
        if (!currentUser) {
          return Response.json({ ok: false, error: { message: 'Not authenticated' } }, { status: 401 });
        }
        targetUserId = currentUser.id;
      }

      // Get existing entitlement
      const entitlements = await base44.asServiceRole.entities.UserEntitlement.filter({ user_id: targetUserId });
      if (entitlements.length > 0) {
        return Response.json({ ok: true, data: entitlements[0] });
      }

      return Response.json({ ok: true, data: null });
    }

    // ACTION: refreshUser
    if (action === 'refreshUser') {
      const { userId, depositUsdt, isKycVerified } = body;
      let targetUserId = userId;
      let userEmail = body.userEmail;

      // If no userId provided, get current user
      if (!targetUserId) {
        const currentUser = await base44.auth.me();
        if (!currentUser) {
          return Response.json({ ok: false, error: { message: 'Not authenticated' } }, { status: 401 });
        }
        targetUserId = currentUser.id;
        userEmail = currentUser.email;
      }

      // Get all required data
      const [config, overrides, positions, plans, users] = await Promise.all([
        getConfig(),
        base44.asServiceRole.entities.UserEntitlementOverride.filter({ user_id: targetUserId }),
        base44.asServiceRole.entities.StakingPosition.filter({ user_id: targetUserId, status: 'ACTIVE' }),
        base44.asServiceRole.entities.StakingPlan.filter({ is_enabled: true }),
        userEmail ? [] : base44.asServiceRole.entities.User.filter({ id: targetUserId }),
      ]);

      const override = overrides.length > 0 ? overrides[0] : null;
      if (!userEmail && users.length > 0) {
        userEmail = users[0].email;
      }

      // Get KYC status if not provided
      let kycVerified = isKycVerified;
      if (kycVerified === undefined) {
        const userRecords = await base44.asServiceRole.entities.User.filter({ id: targetUserId });
        kycVerified = userRecords.length > 0 && userRecords[0].verification_status === 'verified';
      }

      // Compute entitlements
      const computed = await computeEntitlements(
        targetUserId,
        userEmail,
        config,
        override,
        positions,
        plans,
        depositUsdt || 0,
        kycVerified
      );

      // Upsert entitlement
      const existing = await base44.asServiceRole.entities.UserEntitlement.filter({ user_id: targetUserId });
      let entitlement;
      if (existing.length > 0) {
        await base44.asServiceRole.entities.UserEntitlement.update(existing[0].id, computed);
        entitlement = { ...existing[0], ...computed };
      } else {
        entitlement = await base44.asServiceRole.entities.UserEntitlement.create(computed);
      }

      return Response.json({ ok: true, data: entitlement });
    }

    // ACTION: refreshAll (admin only, for automation)
    if (action === 'refreshAll') {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ ok: false, error: { message: 'Admin access required' } }, { status: 403 });
      }

      const { limit = 100 } = body;

      // Get users with recent staking activity (ACTIVE positions or recently changed)
      const activePositions = await base44.asServiceRole.entities.StakingPosition.filter(
        { status: 'ACTIVE' },
        '-updated_date',
        limit
      );

      // Get unique user IDs
      const userIds = [...new Set(activePositions.map(p => p.user_id))];

      const [config, plans] = await Promise.all([
        getConfig(),
        base44.asServiceRole.entities.StakingPlan.filter({ is_enabled: true }),
      ]);

      let refreshed = 0;
      let errors = 0;

      for (const userId of userIds) {
        try {
          const [overrides, userPositions, users] = await Promise.all([
            base44.asServiceRole.entities.UserEntitlementOverride.filter({ user_id: userId }),
            base44.asServiceRole.entities.StakingPosition.filter({ user_id: userId, status: 'ACTIVE' }),
            base44.asServiceRole.entities.User.filter({ id: userId }),
          ]);

          const override = overrides.length > 0 ? overrides[0] : null;
          const userEmail = users.length > 0 ? users[0].email : null;
          const kycVerified = users.length > 0 && users[0].verification_status === 'verified';

          const computed = await computeEntitlements(
            userId,
            userEmail,
            config,
            override,
            userPositions,
            plans,
            0, // TODO: fetch deposit from OKX cache
            kycVerified
          );

          const existing = await base44.asServiceRole.entities.UserEntitlement.filter({ user_id: userId });
          if (existing.length > 0) {
            await base44.asServiceRole.entities.UserEntitlement.update(existing[0].id, computed);
          } else {
            await base44.asServiceRole.entities.UserEntitlement.create(computed);
          }
          refreshed++;
        } catch (err) {
          console.error(`Failed to refresh entitlements for ${userId}:`, err);
          errors++;
        }
      }

      return Response.json({ ok: true, data: { refreshed, errors, total: userIds.length } });
    }

    // ACTION: grantStakingPoints (called when stake becomes ACTIVE)
    if (action === 'grantStakingPoints') {
      const { positionId } = body;
      if (!positionId) {
        return Response.json({ ok: false, error: { message: 'positionId required' } }, { status: 400 });
      }

      // Get position
      const positions = await base44.asServiceRole.entities.StakingPosition.filter({ id: positionId });
      if (positions.length === 0) {
        return Response.json({ ok: false, error: { message: 'Position not found' } }, { status: 404 });
      }
      const position = positions[0];

      // Only grant for ACTIVE positions
      if (position.status !== 'ACTIVE') {
        return Response.json({ ok: true, data: { skipped: true, reason: 'Not ACTIVE' } });
      }

      // Idempotency check
      const activationKey = `stake:${positionId}:points:activation`;
      if (position.last_points_grant_key === activationKey) {
        return Response.json({ ok: true, data: { skipped: true, reason: 'Already granted' } });
      }

      // Check if ledger entry already exists
      const existingLedger = await base44.asServiceRole.entities.RewardLedger.filter({ trigger_event_key: activationKey });
      if (existingLedger.length > 0) {
        // Update position to mark as granted
        await base44.asServiceRole.entities.StakingPosition.update(positionId, {
          last_points_grant_key: activationKey,
          last_points_grant_at: new Date().toISOString(),
          points_granted_total: existingLedger[0].points,
        });
        return Response.json({ ok: true, data: { skipped: true, reason: 'Ledger exists' } });
      }

      // Get plan for rewards rate
      const plans = await base44.asServiceRole.entities.StakingPlan.filter({ key: position.plan_key });
      const plan = plans.length > 0 ? plans[0] : null;
      const rewardsPerDollar = plan?.base_rewards_per_dollar || position.base_rewards_per_dollar || 0;

      // Calculate points
      const basePoints = Math.round(position.principal_amount * rewardsPerDollar);
      let promoPoints = 0;

      // Check for first-stake promo bonus
      if (position.first_stake_bonus_applied && position.first_stake_bonus_amount > 0) {
        promoPoints = Math.round(position.first_stake_bonus_amount);
      }

      const totalPoints = basePoints + promoPoints;

      // Create ledger entry
      await base44.asServiceRole.entities.RewardLedger.create({
        user_id: position.user_id,
        type: 'staking_points',
        subtype: 'activation',
        amount: 0, // Points only, no USDT
        points: totalPoints,
        status: 'credited',
        trigger_event_key: activationKey,
        source_ref_id: positionId,
        meta: {
          plan_key: position.plan_key,
          term_days: position.term_days,
          apy_percent: position.apy_percent,
          principal_amount: position.principal_amount,
          base_points: basePoints,
          promo_points: promoPoints,
        },
        description: `Staking points for ${plan?.title || position.plan_key}`,
      });

      // Update position
      await base44.asServiceRole.entities.StakingPosition.update(positionId, {
        last_points_grant_key: activationKey,
        last_points_grant_at: new Date().toISOString(),
        points_granted_total: totalPoints,
        rewards_granted: totalPoints, // Also update legacy field
      });

      return Response.json({ ok: true, data: { granted: true, points: totalPoints, basePoints, promoPoints } });
    }

    // ACTION: getAdminDashboard (admin only)
    if (action === 'getAdminDashboard') {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ ok: false, error: { message: 'Admin access required' } }, { status: 403 });
      }

      const { search, limit = 50 } = body;

      const [config, overrides, entitlements, auditLogs] = await Promise.all([
        getConfig(),
        base44.asServiceRole.entities.UserEntitlementOverride.list('-created_date', 100),
        search
          ? base44.asServiceRole.entities.UserEntitlement.filter({ user_email: { $regex: search, $options: 'i' } }, '-evaluated_at', limit)
          : base44.asServiceRole.entities.UserEntitlement.list('-evaluated_at', limit),
        base44.asServiceRole.entities.EntitlementAuditLog.list('-created_date', 50),
      ]);

      return Response.json({
        ok: true,
        data: {
          config,
          overrides,
          entitlements,
          auditLogs,
        },
      });
    }

    return Response.json({ ok: false, error: { message: `Unknown action: ${action}` } }, { status: 400 });

  } catch (error) {
    console.error('Entitlements processor error:', error);
    return Response.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
});