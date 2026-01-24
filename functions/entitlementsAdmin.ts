// @ts-nocheck
/// <reference lib="deno.ns" />
// Entitlements Admin Backend - Manage config, overrides, and view user entitlements

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
      return Response.json({ ok: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch { return Response.json({ ok: false, error: { code: 'INVALID_JSON' } }, { status: 400 }); }

    const { action, ...params } = body || {};
    if (!action) return Response.json({ ok: false, error: { code: 'MISSING_ACTION' } }, { status: 400 });

    console.log('[ENTITLEMENTS_ADMIN]', action, user.email);

    // GET CONFIG
    if (action === 'getConfig') {
      const configs = await base44.asServiceRole.entities.EntitlementsConfig.filter({ config_key: 'default' });
      return Response.json({ ok: true, data: configs?.[0] || null });
    }

    // SAVE CONFIG
    if (action === 'saveConfig') {
      const { configData } = params;
      const now = new Date().toISOString();
      
      const configs = await base44.asServiceRole.entities.EntitlementsConfig.filter({ config_key: 'default' });
      const existing = configs?.[0];
      
      const data = {
        ...configData,
        config_key: 'default',
        updated_at: now,
        updated_by: user.email
      };

      let result;
      if (existing) {
        // Audit log
        await base44.asServiceRole.entities.EntitlementAuditLog.create({
          entity_type: 'CONFIG',
          entity_id: existing.id,
          action: 'UPDATE',
          changed_by_admin_id: user.id,
          changed_by_admin_email: user.email,
          old_values: existing,
          new_values: data,
          created_at: now
        });
        
        result = await base44.asServiceRole.entities.EntitlementsConfig.update(existing.id, data);
      } else {
        result = await base44.asServiceRole.entities.EntitlementsConfig.create(data);
        
        await base44.asServiceRole.entities.EntitlementAuditLog.create({
          entity_type: 'CONFIG',
          entity_id: result.id,
          action: 'CREATE',
          changed_by_admin_id: user.id,
          changed_by_admin_email: user.email,
          new_values: data,
          created_at: now
        });
      }

      return Response.json({ ok: true, data: result });
    }

    // LIST USERS WITH ENTITLEMENTS
    if (action === 'listUsersWithEntitlements') {
      const { search, limit = 50 } = params;
      
      // Get users
      let users = await base44.asServiceRole.entities.User.list('-created_date', limit);
      
      if (search) {
        const searchLower = search.toLowerCase();
        users = users.filter(u => 
          u.email?.toLowerCase().includes(searchLower) ||
          u.full_name?.toLowerCase().includes(searchLower)
        );
      }

      // Get entitlements for these users
      const userIds = users.map(u => u.id);
      const entitlements = await base44.asServiceRole.entities.UserEntitlement.filter({}, '-updated_at', 500);
      const entitlementsByUser = {};
      for (const e of (entitlements || [])) {
        entitlementsByUser[e.user_id] = e;
      }

      // Get overrides
      const overrides = await base44.asServiceRole.entities.UserEntitlementOverride.filter({}, '-updated_at', 500);
      const overridesByUser = {};
      for (const o of (overrides || [])) {
        overridesByUser[o.user_id] = o;
      }

      // Build response
      const result = users.map(u => {
        const ent = entitlementsByUser[u.id];
        const ovr = overridesByUser[u.id];
        
        return {
          id: u.id,
          email: u.email,
          fullName: u.full_name,
          role: u.role,
          kycVerified: u.verification_status === 'verified',
          entitlement: ent ? {
            copyTradingLevel: ent.copy_trading_level,
            copyTradingSource: ent.copy_trading_source,
            copyTradingReason: ent.copy_trading_reason,
            signalsTier: ent.signals_tier,
            leverageMax: ent.leverage_max,
            totalPointsBalance: ent.total_points_balance,
            lastDepositUsdt: ent.last_deposit_usdt,
            activeStakingPlanKey: ent.active_staking_plan_key,
            evaluatedAt: ent.evaluated_at
          } : null,
          override: ovr ? {
            copyTradingEnabled: ovr.copy_trading_override_enabled,
            copyTradingLevel: ovr.copy_trading_override_level,
            signalsEnabled: ovr.signals_override_enabled,
            signalsTier: ovr.signals_override_tier,
            reason: ovr.reason,
            expiresAt: ovr.expires_at,
            createdBy: ovr.created_by_admin_email
          } : null
        };
      });

      return Response.json({ ok: true, data: result });
    }

    // GET USER ENTITLEMENT DETAILS
    if (action === 'getUserEntitlement') {
      const { userId } = params;
      if (!userId) return Response.json({ ok: false, error: { code: 'MISSING_USER_ID' } }, { status: 400 });

      // Get user
      const users = await base44.asServiceRole.entities.User.filter({ id: userId });
      const targetUser = users?.[0];
      if (!targetUser) return Response.json({ ok: false, error: { code: 'USER_NOT_FOUND' } }, { status: 404 });

      // Get entitlement
      const entitlements = await base44.asServiceRole.entities.UserEntitlement.filter({ user_id: userId });
      const entitlement = entitlements?.[0];

      // Get override
      const overrides = await base44.asServiceRole.entities.UserEntitlementOverride.filter({ user_id: userId });
      const override = overrides?.[0];

      // Get active staking positions
      const positions = await base44.asServiceRole.entities.StakingPosition.filter({
        user_id: userId,
        status: 'ACTIVE'
      });

      // Get points ledger
      const pointsLedger = await base44.asServiceRole.entities.RewardLedger.filter({
        user_id: userId,
        status: 'credited'
      }, '-created_date', 20);

      return Response.json({
        ok: true,
        data: {
          user: {
            id: targetUser.id,
            email: targetUser.email,
            fullName: targetUser.full_name,
            kycVerified: targetUser.verification_status === 'verified'
          },
          entitlement,
          override,
          activePositions: (positions || []).map(p => ({
            id: p.id,
            planKey: p.plan_key,
            principal: p.principal_amount,
            startedAt: p.started_at,
            endsAt: p.ends_at,
            pointsGranted: p.points_granted_total
          })),
          recentPointsLedger: (pointsLedger || []).slice(0, 10).map(l => ({
            id: l.id,
            type: l.type,
            subtype: l.subtype,
            points: l.points,
            description: l.description,
            createdAt: l.created_date
          }))
        }
      });
    }

    // SET OVERRIDE
    if (action === 'setOverride') {
      const { userId, copyTradingEnabled, copyTradingLevel, signalsEnabled, signalsTier, reason, expiresAt } = params;
      if (!userId) return Response.json({ ok: false, error: { code: 'MISSING_USER_ID' } }, { status: 400 });

      const now = new Date().toISOString();

      // Get user for email
      const users = await base44.asServiceRole.entities.User.filter({ id: userId });
      const targetUser = users?.[0];

      // Get existing override
      const overrides = await base44.asServiceRole.entities.UserEntitlementOverride.filter({ user_id: userId });
      const existing = overrides?.[0];

      const data = {
        user_id: userId,
        user_email: targetUser?.email,
        copy_trading_override_enabled: copyTradingEnabled ?? false,
        copy_trading_override_level: copyTradingLevel || 'NONE',
        signals_override_enabled: signalsEnabled ?? false,
        signals_override_tier: signalsTier || 'NONE',
        reason: reason || '',
        expires_at: expiresAt || null,
        created_by_admin_id: user.id,
        created_by_admin_email: user.email,
        updated_at: now
      };

      let result;
      if (existing) {
        await base44.asServiceRole.entities.EntitlementAuditLog.create({
          entity_type: 'OVERRIDE',
          entity_id: existing.id,
          user_id: userId,
          action: 'UPDATE',
          changed_by_admin_id: user.id,
          changed_by_admin_email: user.email,
          old_values: existing,
          new_values: data,
          reason,
          created_at: now
        });
        
        result = await base44.asServiceRole.entities.UserEntitlementOverride.update(existing.id, data);
      } else {
        data.created_at = now;
        result = await base44.asServiceRole.entities.UserEntitlementOverride.create(data);
        
        await base44.asServiceRole.entities.EntitlementAuditLog.create({
          entity_type: 'OVERRIDE',
          entity_id: result.id,
          user_id: userId,
          action: 'CREATE',
          changed_by_admin_id: user.id,
          changed_by_admin_email: user.email,
          new_values: data,
          reason,
          created_at: now
        });
      }

      // Trigger re-evaluation
      try {
        await base44.functions.invoke('entitlementsProcessor', { action: 'reconcileUser', userId });
      } catch (e) {
        console.log('[ENTITLEMENTS_ADMIN] Failed to trigger reconcile:', e.message);
      }

      return Response.json({ ok: true, data: result });
    }

    // DELETE OVERRIDE
    if (action === 'deleteOverride') {
      const { userId } = params;
      if (!userId) return Response.json({ ok: false, error: { code: 'MISSING_USER_ID' } }, { status: 400 });

      const overrides = await base44.asServiceRole.entities.UserEntitlementOverride.filter({ user_id: userId });
      const existing = overrides?.[0];
      
      if (existing) {
        await base44.asServiceRole.entities.EntitlementAuditLog.create({
          entity_type: 'OVERRIDE',
          entity_id: existing.id,
          user_id: userId,
          action: 'DELETE',
          changed_by_admin_id: user.id,
          changed_by_admin_email: user.email,
          old_values: existing,
          created_at: new Date().toISOString()
        });
        
        await base44.asServiceRole.entities.UserEntitlementOverride.delete(existing.id);
      }

      // Trigger re-evaluation
      try {
        await base44.functions.invoke('entitlementsProcessor', { action: 'reconcileUser', userId });
      } catch (e) {
        console.log('[ENTITLEMENTS_ADMIN] Failed to trigger reconcile:', e.message);
      }

      return Response.json({ ok: true, data: { deleted: !!existing } });
    }

    // GET AUDIT LOG
    if (action === 'getAuditLog') {
      const { limit = 50 } = params;
      const logs = await base44.asServiceRole.entities.EntitlementAuditLog.list('-created_at', limit);
      return Response.json({ ok: true, data: logs || [] });
    }

    // RUN RECONCILIATION
    if (action === 'runReconcile') {
      const result = await base44.functions.invoke('entitlementsProcessor', {});
      return Response.json(result.data);
    }

    return Response.json({ ok: false, error: { code: 'INVALID_ACTION' } }, { status: 400 });

  } catch (error) {
    console.error('[ENTITLEMENTS_ADMIN_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});