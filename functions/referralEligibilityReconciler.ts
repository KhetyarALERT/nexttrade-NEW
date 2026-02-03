import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ==================== REFERRAL PROGRAM CONFIGURATION ====================
const HOLDING_PERIOD_DAYS = 30;
const THRESHOLD_100 = 100; // USDT for Level 1 eligibility
const THRESHOLD_200 = 200; // USDT for Level 2/3 eligibility

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
      const stats = { processed: 0, vouchersIssued: 0, tiersUpdated: 0, errors: [] };

      // Get all referral attributions (L1 only for tier calculation)
      const allAttrs = await base44.asServiceRole.entities.ReferralAttribution.filter({ level: 1 });
      
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

      const stats = { processed: 0, vouchersIssued: 0, tiersUpdated: 0, errors: [] };
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

  // 1. Sync KYC status from referred user
  try {
    const referredUsers = await base44.asServiceRole.entities.User.filter({ id: attr.referred_user_id });
    const referredUser = referredUsers?.[0];
    
    if (referredUser?.verification_status === 'verified' && !attr.kyc_verified_at) {
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

  // 2. Calculate net deposit from internal ledger
  let netDeposit = 0;
  try {
    // Copy Trading Wallet balance
    const copyWallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ 
      user_id: attr.referred_user_id 
    });
    if (copyWallets?.length) {
      netDeposit += (copyWallets[0].available_balance || 0) + (copyWallets[0].locked_balance || 0);
    }

    // Staking positions (locked funds)
    const stakes = await base44.asServiceRole.entities.StakingPosition.filter({
      user_id: attr.referred_user_id,
      status: 'ACTIVE'
    });
    for (const stake of (stakes || [])) {
      netDeposit += stake.principal_amount || 0;
    }

    // Standard wallet balance
    const wallets = await base44.asServiceRole.entities.Wallet.filter({ 
      user_id: attr.referred_user_id 
    });
    for (const w of (wallets || [])) {
      if (w.currency === 'USDT') {
        netDeposit += (w.balance || 0) + (w.staked_balance || 0);
      }
    }
  } catch (e) {
    console.error('Net deposit calc error:', e);
  }

  if (Math.abs((attr.current_net_deposit_usdt || 0) - netDeposit) > 0.01) {
    updates.current_net_deposit_usdt = netDeposit;
    needsUpdate = true;
  }

  const kycVerified = !!(attr.kyc_verified_at || updates.kyc_verified_at);
  const currentNetDeposit = updates.current_net_deposit_usdt ?? attr.current_net_deposit_usdt ?? 0;

  // 3. Eligibility timer for 100 USDT threshold
  if (kycVerified && currentNetDeposit >= THRESHOLD_100) {
    // Start timer if not started
    if (!attr.eligible_100_start_at && !updates.eligible_100_start_at) {
      updates.eligible_100_start_at = now;
      needsUpdate = true;
    }
    // Check if 30 days passed
    const startAt = updates.eligible_100_start_at || attr.eligible_100_start_at;
    if (startAt && !attr.eligible_100_at && daysDiff(startAt, now) >= HOLDING_PERIOD_DAYS) {
      updates.eligible_100_at = now;
      needsUpdate = true;
    }
  } else {
    // Reset if conditions not met
    if (attr.eligible_100_start_at || attr.eligible_100_at) {
      updates.eligible_100_start_at = null;
      // Don't reset eligible_100_at - once qualified, stays qualified for voucher purposes
      // But we track "currently eligible" separately
      needsUpdate = true;
    }
  }

  // 4. Eligibility timer for 200 USDT threshold
  if (kycVerified && currentNetDeposit >= THRESHOLD_200) {
    if (!attr.eligible_200_start_at && !updates.eligible_200_start_at) {
      updates.eligible_200_start_at = now;
      needsUpdate = true;
    }
    const startAt = updates.eligible_200_start_at || attr.eligible_200_start_at;
    if (startAt && !attr.eligible_200_at && daysDiff(startAt, now) >= HOLDING_PERIOD_DAYS) {
      updates.eligible_200_at = now;
      needsUpdate = true;
    }
  } else {
    if (attr.eligible_200_start_at) {
      updates.eligible_200_start_at = null;
      needsUpdate = true;
    }
  }

  // 5. Issue $10 referral voucher when eligible_100_at is set (once per referral)
  const eligible100At = updates.eligible_100_at || attr.eligible_100_at;
  if (eligible100At && !attr.referral_bonus_issued) {
    const voucherKey = `refbonus:${attr.referrer_user_id}:${attr.referred_user_id}`;
    
    // Idempotency check
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

  // Apply updates
  if (needsUpdate && Object.keys(updates).length > 0) {
    await base44.asServiceRole.entities.ReferralAttribution.update(attr.id, updates);
  }
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

  // Get referral attributions (L1 only)
  const attrs = await base44.asServiceRole.entities.ReferralAttribution.filter({
    referrer_user_id: user.id,
    level: 1
  });

  // Build referral list with status
  const referralsList = (attrs || []).map(attr => {
    const kycVerified = !!attr.kyc_verified_at;
    const netDeposit = attr.current_net_deposit_usdt || 0;
    
    // Calculate holding days
    let holdingDays100 = 0;
    let holdingDays200 = 0;
    const now = new Date();
    
    if (attr.eligible_100_start_at) {
      holdingDays100 = Math.min(30, daysDiff(attr.eligible_100_start_at, now.toISOString()));
    }
    if (attr.eligible_200_start_at) {
      holdingDays200 = Math.min(30, daysDiff(attr.eligible_200_start_at, now.toISOString()));
    }

    // Is currently eligible at each threshold?
    const isEligible100 = !!attr.eligible_100_at && kycVerified && netDeposit >= THRESHOLD_100;
    const isEligible200 = !!attr.eligible_200_at && kycVerified && netDeposit >= THRESHOLD_200;

    return {
      id: attr.id,
      email: maskEmail(attr.referred_email),
      registeredAt: attr.registered_at,
      kycVerified,
      netDeposit: Math.round(netDeposit * 100) / 100,
      holdingDays100,
      holdingDays200,
      isEligible100,
      isEligible200,
      voucherPaid: attr.referral_bonus_issued || false,
      status: attr.status
    };
  }).sort((a, b) => new Date(b.registeredAt || 0) - new Date(a.registeredAt || 0));

  // Get voucher ledger
  const allRewards = await base44.asServiceRole.entities.RewardLedger.filter({ user_id: user.id });
  const vouchers = (allRewards || [])
    .filter(r => r.type === 'referral_voucher' || r.type === 'level_up_voucher')
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

  // Calculate totals
  const totalVoucherValue = vouchers.reduce((sum, v) => sum + (v.amount || 0), 0);
  const redeemableValue = vouchers
    .filter(v => v.status === 'redeemable')
    .reduce((sum, v) => sum + (v.amount || 0), 0);

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
      vouchers,
      totalVoucherValue,
      redeemableValue,
      kycRequired: user.verification_status !== 'verified'
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