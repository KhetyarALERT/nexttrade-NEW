import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ==================== REFERRAL PROGRAM CONFIGURATION ====================
const HOLDING_PERIOD_DAYS = 30;
const THRESHOLD_100 = 100; // USDT for Level 1 eligibility + $10 voucher
const THRESHOLD_200 = 200; // USDT for Level 2/3 eligibility

// Big Deposit Bonus Thresholds
const DEPOSIT_BONUS_TIERS = [
  { threshold: 500, amount: 15, key: '500' },
  { threshold: 1000, amount: 30, key: '1000' },
  { threshold: 2000, amount: 60, key: '2000' }
];

const LEVEL_REQUIREMENTS = {
  1: { count: 5, threshold: THRESHOLD_100 },   // 5 referrals with 100+ USDT
  2: { count: 10, threshold: THRESHOLD_200 },  // 10 referrals with 200+ USDT
  3: { count: 20, threshold: THRESHOLD_200 }   // 20 referrals with 200+ USDT
};

const VOUCHER_AMOUNTS = {
  referral_bonus: 10,   // $10 per eligible referral
  level_2_bonus: 50,    // $50 on Level 2 upgrade
  level_3_bonus: 100    // $100 on Level 3 upgrade
};

// ==================== HELPERS ====================
function daysDiff(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

function nowISO() {
  return new Date().toISOString();
}

// Helper: select canonical L1 attribution per referred_user_id (latest by created_date/registered_at)
function selectCanonicalL1(attrs) {
  const byReferred = new Map();
  for (const a of (attrs || [])) {
    if (a.level !== 1 || !a.referred_user_id) continue;
    const key = a.referred_user_id;
    const prev = byReferred.get(key);
    const aTime = new Date(a.created_date || a.registered_at || 0).getTime();
    const pTime = prev ? new Date(prev.created_date || prev.registered_at || 0).getTime() : -1;
    if (!prev || aTime >= pTime) {
      byReferred.set(key, a);
    }
  }
  return Array.from(byReferred.values());
}

// ==================== MAIN HANDLER ====================
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const body = await req.json().catch(() => ({}));
    const { action, ...params } = body || {};

    // === ADMIN/CRON: Full reconciliation ===
    if (action === 'reconcile' || !action) {
      // Verify admin or allow service calls
      let isAdmin = false;
      try {
        const user = await base44.auth.me();
        isAdmin = user?.role === 'admin';
      } catch (e) {
        // Service call without user context - allow
        isAdmin = true;
      }

      if (!isAdmin && action !== 'reconcile') {
        return Response.json({ success: false, error: 'Admin only' }, { status: 403 });
      }

      const now = nowISO();
      const stats = { processed: 0, vouchersIssued: 0, depositBonusesIssued: 0, tiersUpdated: 0, errors: [] };

      // Get all referral attributions and canonicalize per referred user (L1 only)
      const allRaw = await base44.asServiceRole.entities.ReferralAttribution.filter({ level: 1 });
      const allAttrs = selectCanonicalL1(allRaw);
      
      // Group by referrer
      const byReferrer = {};
      for (const attr of (allAttrs || [])) {
        if (!attr.referred_user_id) continue;
        if (!byReferrer[attr.referrer_user_id]) {
          byReferrer[attr.referrer_user_id] = [];
        }
        byReferrer[attr.referrer_user_id].push(attr);
      }

      // Process each referrer
      for (const [referrerId, attrs] of Object.entries(byReferrer)) {
        try {
          await processReferrer(base44, referrerId, attrs, now, stats);
        } catch (e) {
          stats.errors.push({ referrerId, error: e.message });
        }
      }

      return Response.json({ 
        success: true, 
        data: stats,
        timestamp: now
      });
    }

    // === Get snapshot for UI (authenticated user) ===
    if (action === 'getInviteEarnSnapshot') {
      const user = await base44.auth.me();
      if (!user) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }

      return await getInviteEarnSnapshot(base44, user);
    }

    // === ADMIN: Overview across users ===
    if (action === 'adminOverview') {
      const me = await base44.auth.me();
      if (me?.role !== 'admin') {
        return Response.json({ success: false, error: 'Admin only' }, { status: 403 });
      }
      // Aggregate by referrer
      const users = await base44.asServiceRole.entities.User.list();
      const mapById = new Map(users.map(u => [u.id, u]));
      const attrsRaw = await base44.asServiceRole.entities.ReferralAttribution.list();
      const attrs = selectCanonicalL1(attrsRaw);
      const grouped = {};
      for (const a of (attrs || [])) {
        if (!grouped[a.referrer_user_id]) grouped[a.referrer_user_id] = [];
        grouped[a.referrer_user_id].push(a);
      }
      const rows = [];
      for (const [referrerId, list] of Object.entries(grouped)) {
        const u = mapById.get(referrerId);
        const total = list.length;
        const verified = list.filter(x => !!x.kyc_verified_at).length;
        rows.push({
          referrerId,
          email: u?.email || referrerId,
          fullName: u?.full_name || null,
          referralCode: u?.referral_code || null,
          total,
          verified
        });
      }
      return Response.json({ success: true, data: rows });
    }

    // === ADMIN: Details for a specific referrer ===
    if (action === 'referrerDetails') {
      const me = await base44.auth.me();
      if (me?.role !== 'admin') {
        return Response.json({ success: false, error: 'Admin only' }, { status: 403 });
      }
      const { referrerId } = params || {};
      if (!referrerId) return Response.json({ success: false, error: 'referrerId required' }, { status: 400 });

      const refUserList = await base44.asServiceRole.entities.User.filter({ id: referrerId });
      const refUser = refUserList?.[0] || null;
      if (!refUser) return Response.json({ success: false, error: 'Referrer not found' }, { status: 404 });
      // Who referred this referrer (if any)
      const referredBy = (await base44.asServiceRole.entities.ReferralAttribution.filter({ referred_user_id: referrerId, level: 1 }))?.[0] || null;

      const list = await base44.asServiceRole.entities.ReferralAttribution.filter({ referrer_user_id: referrerId, level: 1 });
      const details = [];
      for (const a of (list || [])) {
        const uv = (await base44.asServiceRole.entities.UserVerification.filter({ user_id: a.referred_user_id }))?.[0] || null;
        const kycStatus = uv?.status || 'unverified';
        const tx = await base44.asServiceRole.entities.WalletTransaction.filter({ user_id: a.referred_user_id });
        const hasDeposit = (tx || []).some(t => t.type === 'deposit' && t.status === 'completed');
        const hasWithdrawal = (tx || []).some(t => t.type === 'withdrawal' && t.status === 'completed');
        const userRec = (await base44.asServiceRole.entities.User.filter({ id: a.referred_user_id }))?.[0] || null;
        const mirror = userRec?.referred_by || null;
        const mismatch = mirror ? (String(mirror).toUpperCase() !== String(a.referrer_code).toUpperCase()) : false;
        details.push({
          id: a.id,
          email: userRec?.email ? maskEmail(userRec.email) : maskEmail(a.referred_email),
          registeredAt: a.registered_at,
          kycStatus,
          hasDeposit,
          hasWithdrawal,
          mirrorReferredBy: mirror,
          canonicalReferrerCode: a.referrer_code,
          mismatch
        });
      }
      return Response.json({ success: true, data: { referrer: { id: referrerId, email: refUser?.email, referralCode: refUser?.referral_code }, referredBy, referrals: details } });
    }

    // === ADMIN: Backfill missing attributions from User.referred_by (idempotent) ===
    if (action === 'backfillMissingAttributions') {
      const me = await base44.auth.me();
      if (me?.role !== 'admin') {
        return Response.json({ success: false, error: 'Admin only' }, { status: 403 });
      }
      const users = await base44.asServiceRole.entities.User.list();
      let created = 0, skipped = 0;
      for (const u of (users || [])) {
        const code = (u.referred_by || '').toUpperCase();
        if (!code) { skipped++; continue; }
        const refUsers = await base44.asServiceRole.entities.User.filter({ referral_code: code });
        if (!refUsers?.length) { skipped++; continue; }
        const referrer = refUsers[0];
        // Check existing attribution
        const exists = await base44.asServiceRole.entities.ReferralAttribution.filter({ referrer_user_id: referrer.id, referred_user_id: u.id, level: 1 });
        if (exists?.length) { skipped++; continue; }
        await base44.asServiceRole.entities.ReferralAttribution.create({
          referrer_user_id: referrer.id,
          referrer_code: code,
          referred_user_id: u.id,
          referred_email: u.email,
          level: 1,
          status: 'registered',
          registered_at: u.created_date || new Date().toISOString()
        });
        created++;
      }
      return Response.json({ success: true, data: { created, skipped } });
    }

    // === ADMIN: Get referral integrity for a specific user ===
    if (action === 'getReferralIntegrity') {
      const me = await base44.auth.me();
      if (me?.role !== 'admin') {
        return Response.json({ success: false, error: 'Admin only' }, { status: 403 });
      }
      const { userId } = params || {};
      if (!userId) return Response.json({ success: false, error: 'userId required' }, { status: 400 });
      const userList = await base44.asServiceRole.entities.User.filter({ id: userId });
      const userRec = userList?.[0] || null;
      if (!userRec) return Response.json({ success: false, error: 'User not found' }, { status: 404 });
      const mirrorCode = userRec?.referred_by || null;
      const attrs = await base44.asServiceRole.entities.ReferralAttribution.filter({ referred_user_id: userId, level: 1 });
      let status = 'MISSING_ATTRIBUTION';
      if ((attrs?.length || 0) > 1) status = 'DUPLICATE_ATTRIBUTION';
      const canonical = selectCanonicalL1(attrs || [])[0] || null;
      if (canonical) {
        if (!mirrorCode) status = 'MISMATCH';
        else status = (String(mirrorCode).toUpperCase() === String(canonical.referrer_code).toUpperCase()) ? 'MATCH' : 'MISMATCH';
      } else if (mirrorCode) {
        status = 'MISSING_ATTRIBUTION';
      }
      let refUser = null;
      if (canonical?.referrer_user_id) {
        refUser = (await base44.asServiceRole.entities.User.filter({ id: canonical.referrer_user_id }))?.[0] || null;
      }
      return Response.json({ success: true, data: {
        user: { id: userRec?.id, email: userRec?.email, referral_code: userRec?.referral_code, referred_by: mirrorCode },
        canonical: canonical ? { id: canonical.id, referrer_user_id: canonical.referrer_user_id, referrer_code: canonical.referrer_code, created_at: canonical.created_date || canonical.registered_at, referrer_email: refUser?.email } : null,
        duplicates: (attrs || []).length,
        status
      }});
    }

    // === ADMIN: Reconcile mirror from canonical ===
    if (action === 'reconcileMirrorFromCanonical') {
      const me = await base44.auth.me();
      if (me?.role !== 'admin') {
        return Response.json({ success: false, error: 'Admin only' }, { status: 403 });
      }
      const { userId } = params;
      if (!userId) return Response.json({ success: false, error: 'userId required' }, { status: 400 });
      const attrs = await base44.asServiceRole.entities.ReferralAttribution.filter({ referred_user_id: userId, level: 1 });
      const canonical = selectCanonicalL1(attrs || [])[0] || null;
      if (!canonical) return Response.json({ success: false, error: 'No canonical attribution found' }, { status: 404 });
      await base44.asServiceRole.entities.User.update(userId, { referred_by: String(canonical.referrer_code).toUpperCase() });
      return Response.json({ success: true });
    }

    // === ADMIN: Backfill canonical from mirror (single user) ===
    if (action === 'backfillCanonicalFromMirror') {
      const me = await base44.auth.me();
      if (me?.role !== 'admin') {
        return Response.json({ success: false, error: 'Admin only' }, { status: 403 });
      }
      const { userId } = params;
      if (!userId) return Response.json({ success: false, error: 'userId required' }, { status: 400 });
      const userRec = (await base44.asServiceRole.entities.User.filter({ id: userId }))?.[0] || null;
      if (!userRec) return Response.json({ success: false, error: 'User not found' }, { status: 404 });
      const code = String(userRec.referred_by || '').trim().toUpperCase();
      if (!code) return Response.json({ success: false, error: 'Mirror code empty' }, { status: 400 });
      const refUsers = await base44.asServiceRole.entities.User.filter({ referral_code: code });
      if (!refUsers?.length) return Response.json({ success: false, error: 'Mirror code not found' }, { status: 404 });
      const referrer = refUsers[0];
      if (referrer.id === userRec.id) return Response.json({ success: false, error: 'Self referral not allowed' }, { status: 400 });
      const exists = await base44.asServiceRole.entities.ReferralAttribution.filter({ referrer_user_id: referrer.id, referred_user_id: userRec.id, level: 1 });
      if (exists?.length) return Response.json({ success: true, status: 'already_exists' });
      await base44.asServiceRole.entities.ReferralAttribution.create({
        referrer_user_id: referrer.id,
        referrer_code: code,
        referred_user_id: userRec.id,
        referred_email: userRec.email,
        level: 1,
        status: 'registered',
        registered_at: userRec.created_date || new Date().toISOString()
      });
      await base44.asServiceRole.entities.User.update(userRec.id, { referred_by: code });
      return Response.json({ success: true, status: 'created' });
    }

    // === ADMIN: Reassign referrer (affects future only) ===
    if (action === 'adminReassignReferrer') {
      const me = await base44.auth.me();
      if (me?.role !== 'admin') {
        return Response.json({ success: false, error: 'Admin only' }, { status: 403 });
      }
      const { userId, newReferrerCode, reason } = params;
      if (!userId || !newReferrerCode) return Response.json({ success: false, error: 'userId and newReferrerCode required' }, { status: 400 });
      const code = String(newReferrerCode).trim().toUpperCase();
      const userRec = (await base44.asServiceRole.entities.User.filter({ id: userId }))?.[0] || null;
      if (!userRec) return Response.json({ success: false, error: 'User not found' }, { status: 404 });
      const refUsers = await base44.asServiceRole.entities.User.filter({ referral_code: code });
      if (!refUsers?.length) return Response.json({ success: false, error: 'Referral code not found' }, { status: 404 });
      const newRef = refUsers[0];
      if (newRef.id === userRec.id) return Response.json({ success: false, error: 'Self referral not allowed' }, { status: 400 });

      // Create new L1 attribution (latest becomes canonical), leave old records for history
      const now = new Date().toISOString();
      const newAttr = await base44.asServiceRole.entities.ReferralAttribution.create({
        referrer_user_id: newRef.id,
        referrer_code: code,
        referred_user_id: userRec.id,
        referred_email: userRec.email,
        level: 1,
        status: 'registered',
        registered_at: now
      });

      // Update mirror
      await base44.asServiceRole.entities.User.update(userRec.id, { referred_by: code });

      // Audit log
      let oldCanonical = null;
      const oldAttrs = await base44.asServiceRole.entities.ReferralAttribution.filter({ referred_user_id: userRec.id, level: 1 });
      const canonical = selectCanonicalL1(oldAttrs || []);
      if (canonical?.length) oldCanonical = canonical[0];
      await base44.asServiceRole.entities.ReferralAttributionAuditLog.create({
        target_user_id: userRec.id,
        old_referrer_user_id: oldCanonical?.referrer_user_id || null,
        old_referrer_code: oldCanonical?.referrer_code || null,
        new_referrer_user_id: newRef.id,
        new_referrer_code: code,
        admin_id: me.id,
        reason: reason || 'admin override',
        changed_at: now
      });

      return Response.json({ success: true, data: { newAttributionId: newAttr.id } });
    }

    // === Manual trigger for single user ===
    if (action === 'reconcileUser') {
      const user = await base44.auth.me();
      if (!user) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }

      const targetUserId = params.userId || user.id;
      
      // Only admin can reconcile other users
      if (targetUserId !== user.id && user.role !== 'admin') {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
      }

      const attrs = await base44.asServiceRole.entities.ReferralAttribution.filter({
        referrer_user_id: targetUserId,
        level: 1
      });

      const stats = { processed: 0, vouchersIssued: 0, depositBonusesIssued: 0, tiersUpdated: 0, errors: [] };
      await processReferrer(base44, targetUserId, attrs || [], nowISO(), stats);

      return Response.json({ success: true, data: stats });
    }

    return Response.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });

  } catch (err) {
    console.error('[REFERRAL_RECONCILER_ERROR]', err);
    return Response.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
});

// ==================== CORE RECONCILIATION LOGIC ====================
async function processReferrer(base44, referrerId, attrs, now, stats) {
  stats.processed++;

  for (const attr of attrs) {
    await updateReferralEligibility(base44, attr, now, stats);
  }

  // Recalculate tier status
  await updateTierStatus(base44, referrerId, attrs, now, stats);
}

async function updateReferralEligibility(base44, attr, now, stats) {
  if (!attr.referred_user_id) return;

  const updates = {};
  let needsUpdate = false;

  // 1. Sync KYC status from UserVerification (single source of truth)
  try {
    const uv = await base44.asServiceRole.entities.UserVerification.filter({ user_id: attr.referred_user_id });
    const isVerified = uv?.[0]?.status === 'verified';
    if (isVerified && !attr.kyc_verified_at) {
      updates.kyc_verified_at = now;
      updates.kyc_at = now;
      if (attr.status === 'registered') {
        updates.status = 'kyc_approved';
      }
      needsUpdate = true;
    }
  } catch (e) {
    console.error('KYC sync error:', e);
  }

  // 2. Calculate net deposit from internal ledger (deposits - withdrawals, EXCLUDING PnL)
  let netDeposit = 0;
  try {
    // Method: Sum completed deposits minus completed withdrawals from WalletTransaction
    const allTxns = await base44.asServiceRole.entities.WalletTransaction.filter({ 
      user_id: attr.referred_user_id 
    });
    
    for (const txn of (allTxns || [])) {
      if (txn.status !== 'completed') continue;
      if (txn.currency !== 'USDT' && txn.currency !== 'USDC') continue;
      
      if (txn.type === 'deposit') {
        netDeposit += txn.amount || 0;
      } else if (txn.type === 'withdrawal') {
        netDeposit -= txn.amount || 0;
      }
    }

    // Also count Copy Trading deposits (lifetime_deposited - lifetime_withdrawn)
    const copyWallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ 
      user_id: attr.referred_user_id 
    });
    if (copyWallets?.length) {
      const cw = copyWallets[0];
      netDeposit += (cw.lifetime_deposited || 0) - (cw.lifetime_withdrawn || 0);
    }

    // Staking principal (counts as "held deposit")
    const stakes = await base44.asServiceRole.entities.StakingPosition.filter({
      user_id: attr.referred_user_id,
      status: 'ACTIVE'
    });
    for (const stake of (stakes || [])) {
      netDeposit += stake.principal_amount || 0;
    }
  } catch (e) {
    console.error('Net deposit calc error:', e);
  }

  // Ensure non-negative
  netDeposit = Math.max(0, netDeposit);

  if (Math.abs((attr.current_net_deposit_usdt || 0) - netDeposit) > 0.01) {
    updates.current_net_deposit_usdt = netDeposit;
    needsUpdate = true;
  }

  const kycVerified = !!(attr.kyc_verified_at || updates.kyc_verified_at);
  const currentNetDeposit = updates.current_net_deposit_usdt ?? attr.current_net_deposit_usdt ?? 0;

  // 3. Eligibility timer for 100 USDT threshold (existing $10 voucher)
  const elig100Updates = processThresholdEligibility(attr, updates, kycVerified, currentNetDeposit, THRESHOLD_100, '100', now);
  if (elig100Updates.changed) needsUpdate = true;
  Object.assign(updates, elig100Updates.updates);

  // 4. Eligibility timer for 200 USDT threshold (existing level requirements)
  const elig200Updates = processThresholdEligibility(attr, updates, kycVerified, currentNetDeposit, THRESHOLD_200, '200', now);
  if (elig200Updates.changed) needsUpdate = true;
  Object.assign(updates, elig200Updates.updates);

  // 5. NEW: Big Deposit Bonus thresholds (500, 1000, 2000)
  for (const tier of DEPOSIT_BONUS_TIERS) {
    const eligUpdates = processThresholdEligibility(attr, updates, kycVerified, currentNetDeposit, tier.threshold, tier.key, now);
    if (eligUpdates.changed) needsUpdate = true;
    Object.assign(updates, eligUpdates.updates);
  }

  // 6. Issue $10 referral voucher when eligible_100_at is set (once per referral)
  const eligible100At = updates.eligible_100_at || attr.eligible_100_at;
  if (eligible100At && !attr.referral_bonus_issued) {
    const voucherKey = `refbonus:${attr.referrer_user_id}:${attr.referred_user_id}`;
    
    // Idempotency check - ANY existing record with this key prevents issuance
    const existing = await base44.asServiceRole.entities.RewardLedger.filter({
      trigger_event_key: voucherKey
    });

    if (!existing?.length) {
      await base44.asServiceRole.entities.RewardLedger.create({
        user_id: attr.referrer_user_id,
        type: 'referral_voucher',
        subtype: 'referral_bonus',
        amount: VOUCHER_AMOUNTS.referral_bonus,
        points: 0,
        currency: 'USDT',
        status: 'redeemable',
        trigger_event_key: voucherKey,
        source_user_id: attr.referred_user_id,
        attribution_id: attr.id,
        meta: { threshold: THRESHOLD_100, referredUserId: attr.referred_user_id },
        description: `$10 voucher for eligible referral`
      });
      stats.vouchersIssued++;
    }

    updates.referral_bonus_issued = true;
    needsUpdate = true;
  }

  // 7. NEW: Issue Big Deposit Bonus vouchers
  for (const tier of DEPOSIT_BONUS_TIERS) {
    const eligAtField = `eligible_${tier.key}_at`;
    const eligAt = updates[eligAtField] || attr[eligAtField];
    
    if (eligAt) {
      const triggerKey = `refdep${tier.key}:${attr.referrer_user_id}:${attr.referred_user_id}`;
      
      // Idempotency: ANY existing record (even revoked) prevents re-issuance
      const existing = await base44.asServiceRole.entities.RewardLedger.filter({
        trigger_event_key: triggerKey
      });

      if (!existing?.length) {
        await base44.asServiceRole.entities.RewardLedger.create({
          user_id: attr.referrer_user_id,
          type: 'referral_deposit_voucher',
          subtype: `tier_${tier.key}`,
          amount: tier.amount,
          points: 0,
          currency: 'USDT',
          status: 'redeemable',
          trigger_event_key: triggerKey,
          source_user_id: attr.referred_user_id,
          attribution_id: attr.id,
          meta: { 
            threshold: tier.threshold, 
            referredUserId: attr.referred_user_id,
            holding_days: HOLDING_PERIOD_DAYS
          },
          description: `$${tier.amount} trade voucher for $${tier.threshold} referral deposit`
        });
        stats.depositBonusesIssued++;
      }
    }
  }

  // Apply updates
  if (needsUpdate && Object.keys(updates).length > 0) {
    await base44.asServiceRole.entities.ReferralAttribution.update(attr.id, updates);
  }
}

// Helper to process threshold eligibility (reusable for 100, 200, 500, 1000, 2000)
function processThresholdEligibility(attr, existingUpdates, kycVerified, currentNetDeposit, threshold, key, now) {
  const startField = `eligible_${key}_start_at`;
  const completedField = `eligible_${key}_at`;
  const updates = {};
  let changed = false;

  if (kycVerified && currentNetDeposit >= threshold) {
    // Start timer if not started
    const currentStart = existingUpdates[startField] || attr[startField];
    if (!currentStart) {
      updates[startField] = now;
      changed = true;
    }
    // Check if 30 days passed
    const startAt = updates[startField] || existingUpdates[startField] || attr[startField];
    const currentCompleted = existingUpdates[completedField] || attr[completedField];
    if (startAt && !currentCompleted && daysDiff(startAt, now) >= HOLDING_PERIOD_DAYS) {
      updates[completedField] = now;
      changed = true;
    }
  } else {
    // Reset start timer if conditions not met (deposit dropped)
    // But DO NOT reset completed field - once achieved, voucher already issued
    if (attr[startField]) {
      updates[startField] = null;
      changed = true;
    }
  }

  return { updates, changed };
}

async function updateTierStatus(base44, referrerId, attrs, now, stats) {
  // Count active eligible referrals
  let activeEligible100Count = 0;
  let activeEligible200Count = 0;

  for (const attr of attrs) {
    // Refresh data after potential updates
    const kycVerified = !!attr.kyc_verified_at;
    const netDeposit = attr.current_net_deposit_usdt || 0;
    
    // Active = eligible_X_at exists AND still maintaining threshold
    if (attr.eligible_100_at && kycVerified && netDeposit >= THRESHOLD_100) {
      activeEligible100Count++;
    }
    if (attr.eligible_200_at && kycVerified && netDeposit >= THRESHOLD_200) {
      activeEligible200Count++;
    }
  }

  // Determine level
  let currentLevel = 0;
  if (activeEligible200Count >= 20) {
    currentLevel = 3;
  } else if (activeEligible200Count >= 10) {
    currentLevel = 2;
  } else if (activeEligible100Count >= 5) {
    currentLevel = 1;
  }

  const vipActive = currentLevel >= 3;

  // Get or create tier status
  let tierStatusRecords = await base44.asServiceRole.entities.ReferralTierStatus.filter({ user_id: referrerId });
  let tierStatus = tierStatusRecords?.[0];

  const tierUpdates = {
    current_level: currentLevel,
    active_eligible_100_count: activeEligible100Count,
    active_eligible_200_count: activeEligible200Count,
    vip_active: vipActive,
    last_reconciled_at: now
  };

  // Issue level-up bonuses
  if (currentLevel >= 2 && (!tierStatus || !tierStatus.level_2_bonus_issued)) {
    const voucherKey = `levelup2:${referrerId}`;
    const existing = await base44.asServiceRole.entities.RewardLedger.filter({ trigger_event_key: voucherKey });
    
    if (!existing?.length) {
      await base44.asServiceRole.entities.RewardLedger.create({
        user_id: referrerId,
        type: 'level_up_voucher',
        subtype: 'level_2_bonus',
        amount: VOUCHER_AMOUNTS.level_2_bonus,
        points: 0,
        currency: 'USDT',
        status: 'redeemable',
        trigger_event_key: voucherKey,
        meta: { level: 2 },
        description: `$50 voucher for reaching Level 2`
      });
      stats.vouchersIssued++;
    }
    tierUpdates.level_2_bonus_issued = true;
  }

  if (currentLevel >= 3 && (!tierStatus || !tierStatus.level_3_bonus_issued)) {
    const voucherKey = `levelup3:${referrerId}`;
    const existing = await base44.asServiceRole.entities.RewardLedger.filter({ trigger_event_key: voucherKey });
    
    if (!existing?.length) {
      await base44.asServiceRole.entities.RewardLedger.create({
        user_id: referrerId,
        type: 'level_up_voucher',
        subtype: 'level_3_bonus',
        amount: VOUCHER_AMOUNTS.level_3_bonus,
        points: 0,
        currency: 'USDT',
        status: 'redeemable',
        trigger_event_key: voucherKey,
        meta: { level: 3 },
        description: `$100 voucher for reaching Level 3`
      });
      stats.vouchersIssued++;
    }
    tierUpdates.level_3_bonus_issued = true;
  }

  if (tierStatus) {
    await base44.asServiceRole.entities.ReferralTierStatus.update(tierStatus.id, tierUpdates);
  } else {
    await base44.asServiceRole.entities.ReferralTierStatus.create({
      user_id: referrerId,
      ...tierUpdates
    });
  }

  stats.tiersUpdated++;
}

// ==================== SNAPSHOT API ====================
async function getInviteEarnSnapshot(base44, user) {
  // Get or create referral code
  let referralCode = user.referral_code;
  if (!referralCode) {
    referralCode = generateReferralCode();
    await base44.asServiceRole.entities.User.update(user.id, { referral_code: referralCode });
  }

  const referralLink = `https://nexttrade.exchange/?ref=${referralCode}`;

  // Get tier status
  const tierStatusRecords = await base44.asServiceRole.entities.ReferralTierStatus.filter({ user_id: user.id });
  const tierStatus = tierStatusRecords?.[0] || {
    current_level: 0,
    active_eligible_100_count: 0,
    active_eligible_200_count: 0,
    vip_active: false
  };

  // Determine KYC requirement from UserVerification (not User)
  const myUv = await base44.asServiceRole.entities.UserVerification.filter({ user_id: user.id });
  const kycRequiredFlag = (myUv?.[0]?.status !== 'verified');

  // Get referral attributions (L1 only)
  const attrs = await base44.asServiceRole.entities.ReferralAttribution.filter({
    referrer_user_id: user.id,
    level: 1
  });

  // Get all rewards for voucher checks
  const allRewards = await base44.asServiceRole.entities.RewardLedger.filter({ user_id: user.id });
  
  // Build trigger key lookup for deposit bonus checks
  const triggerKeySet = new Set((allRewards || []).map(r => r.trigger_event_key));

  // Build referral list with status including deposit bonus progress
  const referralsList = (attrs || []).map(attr => {
    const kycVerified = !!attr.kyc_verified_at;
    const netDeposit = attr.current_net_deposit_usdt || 0;
    
    // Calculate holding days for each threshold
    const now = new Date();
    
    const calcHoldingDays = (startAt) => {
      if (!startAt) return 0;
      return Math.min(30, Math.max(0, daysDiff(startAt, now.toISOString())));
    };

    const holdingDays100 = calcHoldingDays(attr.eligible_100_start_at);
    const holdingDays200 = calcHoldingDays(attr.eligible_200_start_at);
    const holdingDays500 = calcHoldingDays(attr.eligible_500_start_at);
    const holdingDays1000 = calcHoldingDays(attr.eligible_1000_start_at);
    const holdingDays2000 = calcHoldingDays(attr.eligible_2000_start_at);

    // Check if vouchers already issued for this referral
    const voucher500Issued = triggerKeySet.has(`refdep500:${user.id}:${attr.referred_user_id}`);
    const voucher1000Issued = triggerKeySet.has(`refdep1000:${user.id}:${attr.referred_user_id}`);
    const voucher2000Issued = triggerKeySet.has(`refdep2000:${user.id}:${attr.referred_user_id}`);

    // Is currently eligible at each threshold?
    const isEligible100 = !!attr.eligible_100_at && kycVerified && netDeposit >= THRESHOLD_100;
    const isEligible200 = !!attr.eligible_200_at && kycVerified && netDeposit >= THRESHOLD_200;
    const isEligible500 = !!attr.eligible_500_at && kycVerified && netDeposit >= 500;
    const isEligible1000 = !!attr.eligible_1000_at && kycVerified && netDeposit >= 1000;
    const isEligible2000 = !!attr.eligible_2000_at && kycVerified && netDeposit >= 2000;

    return {
      id: attr.id,
      email: maskEmail(attr.referred_email),
      registeredAt: attr.registered_at,
      kycVerified,
      netDeposit: Math.round(netDeposit * 100) / 100,
      
      // Basic eligibility (for $10 voucher)
      holdingDays100,
      isEligible100,
      voucherPaid: attr.referral_bonus_issued || false,
      
      // Level requirements
      holdingDays200,
      isEligible200,
      
      // Big Deposit Bonuses (NEW)
      depositBonuses: {
        tier500: {
          threshold: 500,
          amount: 15,
          holdingDays: holdingDays500,
          isEligible: isEligible500,
          voucherIssued: voucher500Issued,
          startedAt: attr.eligible_500_start_at,
          achievedAt: attr.eligible_500_at
        },
        tier1000: {
          threshold: 1000,
          amount: 30,
          holdingDays: holdingDays1000,
          isEligible: isEligible1000,
          voucherIssued: voucher1000Issued,
          startedAt: attr.eligible_1000_start_at,
          achievedAt: attr.eligible_1000_at
        },
        tier2000: {
          threshold: 2000,
          amount: 60,
          holdingDays: holdingDays2000,
          isEligible: isEligible2000,
          voucherIssued: voucher2000Issued,
          startedAt: attr.eligible_2000_start_at,
          achievedAt: attr.eligible_2000_at
        }
      },
      
      status: attr.status
    };
  }).sort((a, b) => new Date(b.registeredAt || 0) - new Date(a.registeredAt || 0));

  // Categorize vouchers
  const vouchers = (allRewards || [])
    .filter(r => r.type === 'referral_voucher' || r.type === 'level_up_voucher' || r.type === 'referral_deposit_voucher')
    .map(r => ({
      id: r.id,
      type: r.type,
      subtype: r.subtype,
      amount: r.amount,
      status: r.status,
      description: r.description,
      createdAt: r.created_date
    }))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  // Calculate totals by category
  const referralVouchers = vouchers.filter(v => v.type === 'referral_voucher');
  const levelUpVouchers = vouchers.filter(v => v.type === 'level_up_voucher');
  const depositBonusVouchers = vouchers.filter(v => v.type === 'referral_deposit_voucher');

  const totalVoucherValue = vouchers.reduce((sum, v) => sum + (v.amount || 0), 0);
  const redeemableValue = vouchers
    .filter(v => v.status === 'redeemable')
    .reduce((sum, v) => sum + (v.amount || 0), 0);
  
  const totalDepositBonusValue = depositBonusVouchers.reduce((sum, v) => sum + (v.amount || 0), 0);

  // Progress to next level
  let nextLevelTarget = 0;
  let nextLevelRemaining = 0;
  let nextLevelThreshold = 0;
  
  if (tierStatus.current_level === 0) {
    nextLevelTarget = 5;
    nextLevelRemaining = Math.max(0, 5 - tierStatus.active_eligible_100_count);
    nextLevelThreshold = THRESHOLD_100;
  } else if (tierStatus.current_level === 1) {
    nextLevelTarget = 10;
    nextLevelRemaining = Math.max(0, 10 - tierStatus.active_eligible_200_count);
    nextLevelThreshold = THRESHOLD_200;
  } else if (tierStatus.current_level === 2) {
    nextLevelTarget = 20;
    nextLevelRemaining = Math.max(0, 20 - tierStatus.active_eligible_200_count);
    nextLevelThreshold = THRESHOLD_200;
  }

  return Response.json({
    success: true,
    data: {
      referralLink,
      referralCode,
      tierStatus: {
        currentLevel: tierStatus.current_level,
        activeEligible100Count: tierStatus.active_eligible_100_count,
        activeEligible200Count: tierStatus.active_eligible_200_count,
        vipActive: tierStatus.vip_active,
        lastReconciledAt: tierStatus.last_reconciled_at
      },
      progress: {
        nextLevel: tierStatus.current_level + 1,
        nextLevelTarget,
        nextLevelRemaining,
        nextLevelThreshold,
        progressPercent: nextLevelTarget > 0 
          ? Math.min(100, Math.round(((nextLevelTarget - nextLevelRemaining) / nextLevelTarget) * 100))
          : 100
      },
      referrals: referralsList,
      referralsTotal: referralsList.length,
      
      // Voucher categories (NEW structure)
      vouchers,
      vouchersByCategory: {
        referral: referralVouchers,
        levelUp: levelUpVouchers,
        depositBonus: depositBonusVouchers
      },
      
      // Totals
      totalVoucherValue,
      redeemableValue,
      totalDepositBonusValue,
      
      // Big Deposit Bonus config for UI display
      depositBonusTiers: DEPOSIT_BONUS_TIERS,
      
      kycRequired: kycRequiredFlag
    }
  });
}

// ==================== UTILITIES ====================
function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'NEXT-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function maskEmail(email) {
  if (!email) return 'User';
  const [local, domain] = email.split('@');
  if (!domain) return email.slice(0, 2) + '***';
  const maskedLocal = local.slice(0, 2) + '***';
  return `${maskedLocal}@${domain}`;
}