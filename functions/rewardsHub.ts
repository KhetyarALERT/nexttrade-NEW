import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ==================== REWARD CONFIGURATION ====================
const MAX_REFERRAL_DEPTH = 3;

// Payout config per referral level (USDT)
const REFERRAL_PAYOUTS = {
  referred_deposited: { 1: 10, 2: 2, 3: 0.5 },  // On first deposit
  referred_verified: { 1: 0, 2: 0, 3: 0 },       // No immediate payout on KYC (optional future)
  referred_traded: { 1: 0, 2: 0, 3: 0 }          // Future: volume-based
};

// Points rewards
const CHECKIN_POINTS = [10, 15, 20, 25, 35, 50, 100]; // Day 1-7

// ==================== MISSION DEFINITIONS (Single Source of Truth) ====================
const MISSIONS = {
  signup: {
    points: 100,
    title: { en: "Welcome Bonus", ar: "مكافأة الترحيب" },
    desc: { en: "Create your account", ar: "أنشئ حسابك" },
    action: null, // Auto-granted on signup
    checkCompletion: () => true // Always completed if user exists
  },
  kyc_complete: {
    points: 300,
    title: { en: "KYC Verified", ar: "تحقق KYC" },
    desc: { en: "Complete identity verification", ar: "أكمل التحقق من الهوية" },
    action: { label: { en: "Verify Now", ar: "تحقق الآن" }, route: "/Profile?tab=security" },
    checkCompletion: (user) => user.verification_status === 'verified'
  },
  first_deposit: {
    points: 200,
    title: { en: "First Deposit", ar: "أول إيداع" },
    desc: { en: "Make your first deposit", ar: "قم بأول إيداع" },
    action: { label: { en: "Deposit", ar: "إيداع" }, route: "/Wallet?page=deposit" },
    checkCompletion: async (user, base44) => {
      const deposits = await base44.asServiceRole.entities.WalletTransaction.filter({
        user_id: user.id,
        type: 'deposit',
        status: 'completed'
      });
      return deposits?.length > 0;
    }
  },
  first_trade: {
    points: 150,
    title: { en: "First Trade", ar: "أول صفقة" },
    desc: { en: "Execute your first trade", ar: "نفذ أول صفقة" },
    action: { label: { en: "Trade Now", ar: "تداول الآن" }, route: "/Futures" },
    checkCompletion: async (user, base44) => {
      const trades = await base44.asServiceRole.entities.Trade.filter({ user_id: user.id });
      return trades?.length > 0;
    }
  },
  referral_1: {
    points: 500,
    title: { en: "First Referral", ar: "أول إحالة" },
    desc: { en: "Invite your first friend", ar: "ادعُ أول صديق" },
    action: { label: { en: "Invite Friends", ar: "دعوة أصدقاء" }, route: "/Rewards?tab=referrals" },
    checkCompletion: async (user, base44) => {
      const refs = await base44.asServiceRole.entities.ReferralAttribution.filter({
        referrer_user_id: user.id
      });
      return refs?.length > 0;
    }
  },
  stake_first: {
    points: 200,
    title: { en: "First Stake", ar: "أول ستيك" },
    desc: { en: "Stake any amount", ar: "قم بأول ستيك" },
    action: { label: { en: "Stake", ar: "ستيك" }, route: "/Investing" },
    checkCompletion: async (user, base44) => {
      const stakes = await base44.asServiceRole.entities.StakingPosition.filter({ user_id: user.id });
      return stakes?.length > 0;
    }
  }
};

// Legacy compatibility
const MILESTONE_REWARDS = Object.fromEntries(
  Object.entries(MISSIONS).map(([k, v]) => [k, { points: v.points, auto: k === 'signup' }])
);

// ==================== HELPERS ====================
function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ==================== MAIN HANDLER ====================
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const body = await req.json();
    const { action, ...params } = body || {};

    if (!action) {
      return Response.json({ success: false, error: 'Missing action' }, { status: 400 });
    }

    // === PUBLIC: Get reward config (no auth) ===
    if (action === 'getConfig') {
      return Response.json({
        success: true,
        data: {
          maxReferralDepth: MAX_REFERRAL_DEPTH,
          referralPayouts: REFERRAL_PAYOUTS,
          checkinPoints: CHECKIN_POINTS,
          milestoneRewards: MILESTONE_REWARDS
        }
      });
    }

    // === AUTHENTICATED ACTIONS ===
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // === Get full rewards hub summary ===
    if (action === 'getSummary') {
      // Fetch all data in parallel using service role
      const [rewards, attributions, allUserRewards] = await Promise.all([
        base44.asServiceRole.entities.RewardLedger.filter({ user_id: user.id }),
        base44.asServiceRole.entities.ReferralAttribution.filter({ referrer_user_id: user.id }),
        base44.asServiceRole.entities.RewardLedger.filter({ user_id: user.id })
      ]);

      // Get or create referral code
      let referralCode = user.referral_code;
      if (!referralCode) {
        referralCode = generateReferralCode(user.id);
        await base44.asServiceRole.entities.User.update(user.id, { referral_code: referralCode });
      }

      // Calculate balances
      const totalUsdt = (rewards || [])
        .filter(r => r.status === 'credited')
        .reduce((sum, r) => sum + (r.amount || 0), 0);
      const totalPoints = (rewards || [])
        .filter(r => r.status === 'credited')
        .reduce((sum, r) => sum + (r.points || 0), 0);

      // Referral stats by level
      const referralStats = {
        level1: { count: 0, earned: 0 },
        level2: { count: 0, earned: 0 },
        level3: { count: 0, earned: 0 }
      };
      for (const attr of (attributions || [])) {
        const lvl = attr.level || 1;
        if (lvl === 1) {
          referralStats.level1.count++;
          referralStats.level1.earned += attr.reward_amount || 0;
        } else if (lvl === 2) {
          referralStats.level2.count++;
          referralStats.level2.earned += attr.reward_amount || 0;
        } else if (lvl === 3) {
          referralStats.level3.count++;
          referralStats.level3.earned += attr.reward_amount || 0;
        }
      }

      // Check-in state
      const today = todayKey();
      const yesterday = yesterdayKey();
      const checkinToday = (rewards || []).find(r => 
        r.type === 'checkin' && r.trigger_event_key === `checkin:${user.id}:${today}`
      );
      const checkinYesterday = (rewards || []).find(r => 
        r.type === 'checkin' && r.trigger_event_key === `checkin:${user.id}:${yesterday}`
      );

      // Calculate streak
      let streak = 0;
      if (checkinToday) {
        streak = 1;
        let checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - 1);
        for (let i = 0; i < 30; i++) {
          const key = `checkin:${user.id}:${checkDate.toISOString().slice(0, 10)}`;
          const found = (rewards || []).find(r => r.type === 'checkin' && r.trigger_event_key === key);
          if (found) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      } else if (checkinYesterday) {
        streak = 1;
        let checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - 2);
        for (let i = 0; i < 30; i++) {
          const key = `checkin:${user.id}:${checkDate.toISOString().slice(0, 10)}`;
          const found = (rewards || []).find(r => r.type === 'checkin' && r.trigger_event_key === key);
          if (found) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      }

      // Claimed milestones
      const claimedMilestones = (rewards || [])
        .filter(r => r.type === 'milestone')
        .map(r => r.subtype);

      // Recent rewards
      const recentRewards = (rewards || [])
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
        .slice(0, 20);

      // Referral list with details
      const referralList = (attributions || [])
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
        .map(a => ({
          id: a.id,
          email: a.referred_email ? maskEmail(a.referred_email) : 'User',
          level: a.level,
          status: a.status,
          registeredAt: a.registered_at,
          kycAt: a.kyc_at,
          depositedAt: a.deposited_at,
          rewardAmount: a.reward_amount
        }));

      return Response.json({
        success: true,
        data: {
          balances: {
            usdt: totalUsdt,
            points: totalPoints
          },
          referral: {
            code: referralCode,
            link: `https://nexttrade.exchange/?ref=${referralCode}`,
            stats: referralStats,
            list: referralList
          },
          checkin: {
            checkedInToday: !!checkinToday,
            streak,
            nextPoints: CHECKIN_POINTS[Math.min(streak, 6)]
          },
          milestones: {
            claimed: claimedMilestones,
            available: Object.keys(MILESTONE_REWARDS)
          },
          recentRewards
        }
      });
    }

    // === Daily Check-in ===
    if (action === 'checkin') {
      const today = todayKey();
      const triggerKey = `checkin:${user.id}:${today}`;

      // Idempotency check
      const existing = await base44.asServiceRole.entities.RewardLedger.filter({
        user_id: user.id,
        trigger_event_key: triggerKey
      });
      if (existing?.length) {
        return Response.json({ success: true, data: existing[0], existing: true });
      }

      // Calculate streak
      const yesterday = yesterdayKey();
      const yesterdayReward = await base44.asServiceRole.entities.RewardLedger.filter({
        user_id: user.id,
        trigger_event_key: `checkin:${user.id}:${yesterday}`
      });
      
      let streak = yesterdayReward?.length ? 1 : 0;
      if (yesterdayReward?.length) {
        let checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - 2);
        for (let i = 0; i < 30; i++) {
          const key = `checkin:${user.id}:${checkDate.toISOString().slice(0, 10)}`;
          const found = await base44.asServiceRole.entities.RewardLedger.filter({
            user_id: user.id,
            trigger_event_key: key
          });
          if (found?.length) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      }

      const dayIndex = Math.min(streak, 6);
      const pointsToAward = CHECKIN_POINTS[dayIndex];

      const reward = await base44.asServiceRole.entities.RewardLedger.create({
        user_id: user.id,
        type: 'checkin',
        subtype: `checkin_day_${dayIndex + 1}`,
        amount: 0,
        points: pointsToAward,
        status: 'credited',
        trigger_event_key: triggerKey,
        description: `Daily check-in day ${dayIndex + 1}`
      });

      return Response.json({ success: true, data: reward, pointsEarned: pointsToAward, streak: streak + 1 });
    }

    // === Claim Milestone ===
    if (action === 'claimMilestone') {
      const { milestoneId } = params;
      if (!milestoneId || !MILESTONE_REWARDS[milestoneId]) {
        return Response.json({ success: false, error: 'Invalid milestone' }, { status: 400 });
      }

      const triggerKey = `milestone:${user.id}:${milestoneId}`;

      // Idempotency check
      const existing = await base44.asServiceRole.entities.RewardLedger.filter({
        user_id: user.id,
        trigger_event_key: triggerKey
      });
      if (existing?.length) {
        return Response.json({ success: true, data: existing[0], existing: true });
      }

      // Eligibility check (simplified - real implementation would check actual data)
      const milestone = MILESTONE_REWARDS[milestoneId];
      
      // For now, only allow claiming if milestone.auto is true (signup)
      // Other milestones should be triggered by backend events
      if (!milestone.auto) {
        // Check eligibility based on milestone type
        const isEligible = await checkMilestoneEligibility(base44, user, milestoneId);
        if (!isEligible) {
          return Response.json({ success: false, error: 'Milestone not yet achieved' }, { status: 400 });
        }
      }

      const reward = await base44.asServiceRole.entities.RewardLedger.create({
        user_id: user.id,
        type: 'milestone',
        subtype: milestoneId,
        amount: 0,
        points: milestone.points,
        status: 'credited',
        trigger_event_key: triggerKey,
        description: `Milestone: ${milestoneId}`
      });

      return Response.json({ success: true, data: reward, pointsEarned: milestone.points });
    }

    // === Get Reward History (paginated) ===
    if (action === 'getHistory') {
      const { limit = 50, offset = 0, type } = params;
      
      let rewards = await base44.asServiceRole.entities.RewardLedger.filter({ user_id: user.id });
      
      if (type) {
        rewards = rewards.filter(r => r.type === type);
      }
      
      rewards = rewards.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      
      const total = rewards.length;
      const paginated = rewards.slice(offset, offset + limit);

      return Response.json({
        success: true,
        data: {
          rewards: paginated,
          total,
          hasMore: offset + limit < total
        }
      });
    }

    // === ADMIN/SERVICE: Grant referral reward ===
    if (action === 'grantReferralReward') {
      // This should be called by other backend functions when triggers occur
      if (user.role !== 'admin') {
        return Response.json({ success: false, error: 'Admin only' }, { status: 403 });
      }

      const { triggeredUserId, subtype, triggerEventKey } = params;
      if (!triggeredUserId || !subtype || !triggerEventKey) {
        return Response.json({ success: false, error: 'Missing params' }, { status: 400 });
      }

      const payouts = REFERRAL_PAYOUTS[subtype];
      if (!payouts) {
        return Response.json({ success: false, error: 'Unknown subtype' }, { status: 400 });
      }

      // Find all referral paths for this user
      const attributions = await base44.asServiceRole.entities.ReferralAttribution.filter({
        referred_user_id: triggeredUserId
      });

      const rewards = [];
      for (const attr of (attributions || [])) {
        const depth = attr.level || 1;
        if (depth > MAX_REFERRAL_DEPTH) continue;

        const amount = payouts[depth] || 0;
        if (amount <= 0) continue;

        const rewardTriggerKey = `${triggerEventKey}:L${depth}:${attr.referrer_user_id}`;

        // Idempotency check
        const existing = await base44.asServiceRole.entities.RewardLedger.filter({
          user_id: attr.referrer_user_id,
          trigger_event_key: rewardTriggerKey
        });
        if (existing?.length) continue;

        // Create reward
        const reward = await base44.asServiceRole.entities.RewardLedger.create({
          user_id: attr.referrer_user_id,
          type: `referral_l${depth}`,
          subtype,
          amount,
          points: 0,
          currency: 'USDT',
          status: 'credited',
          trigger_event_key: rewardTriggerKey,
          source_user_id: triggeredUserId,
          depth,
          attribution_id: attr.id,
          description: `Level ${depth} referral reward: ${subtype}`
        });

        // Update attribution reward amount
        await base44.asServiceRole.entities.ReferralAttribution.update(attr.id, {
          reward_amount: (attr.reward_amount || 0) + amount,
          rewarded_at: new Date().toISOString(),
          status: 'rewarded'
        });

        rewards.push(reward);
      }

      return Response.json({ success: true, rewards });
    }

    return Response.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });

  } catch (err) {
    console.error('[REWARDS_HUB_ERROR]', err);
    return Response.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
});

// ==================== UTILITY FUNCTIONS ====================
function generateReferralCode(userId) {
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

async function checkMilestoneEligibility(base44, user, milestoneId) {
  try {
    switch (milestoneId) {
      case 'kyc_complete':
        return user.verification_status === 'verified';
      
      case 'first_deposit': {
        const deposits = await base44.entities.WalletTransaction.filter({ 
          user_id: user.id, 
          type: 'deposit' 
        });
        return deposits?.length > 0;
      }
      
      case 'first_trade': {
        const trades = await base44.entities.Trade.filter({ user_id: user.id });
        return trades?.length > 0;
      }
      
      case 'referral_1': {
        const attrs = await base44.asServiceRole.entities.ReferralAttribution.filter({
          referrer_user_id: user.id
        });
        return attrs?.length > 0;
      }
      
      case 'stake_first': {
        const stakes = await base44.entities.StakingPosition.filter({ user_id: user.id });
        return stakes?.length > 0;
      }
      
      default:
        return false;
    }
  } catch {
    return false;
  }
}