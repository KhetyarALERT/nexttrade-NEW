import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const REFERRAL_DOMAIN = 'https://nexttrade.exchange';
const L1_REWARD_AMOUNT = 10; // $10 for L1 referral
const L2_REWARD_AMOUNT = 2;  // $2 for L2 referral

function generateReferralCode(userId) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'NEXT-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const body = await req.json();
    const { action, ...params } = body || {};

    if (!action) {
      return Response.json({ success: false, error: 'Missing action' }, { status: 400 });
    }

    // === PUBLIC: Validate referral code (no auth needed) ===
    if (action === 'validateCode') {
      const code = String(params.code || '').trim().toUpperCase();
      if (!code) {
        return Response.json({ success: false, valid: false, error: 'Code required' });
      }

      // Find user with this referral code
      const users = await base44.asServiceRole.entities.User.filter({ referral_code: code });
      if (!users?.length) {
        return Response.json({ success: true, valid: false });
      }

      return Response.json({ 
        success: true, 
        valid: true, 
        referrer_id: users[0].id 
      });
    }

    // === PUBLIC: Record click (no auth needed) ===
    if (action === 'recordClick') {
      const code = String(params.code || '').trim().toUpperCase();
      if (!code) {
        return Response.json({ success: false, error: 'Code required' }, { status: 400 });
      }

      // Find referrer
      const users = await base44.asServiceRole.entities.User.filter({ referral_code: code });
      if (!users?.length) {
        return Response.json({ success: false, error: 'Invalid code' }, { status: 400 });
      }

      const referrer = users[0];

      // Create click attribution
      await base44.asServiceRole.entities.ReferralAttribution.create({
        referrer_user_id: referrer.id,
        referrer_code: code,
        level: 1,
        status: 'clicked',
        clicked_at: new Date().toISOString()
      });

      return Response.json({ success: true });
    }

    // === AUTHENTICATED ACTIONS ===
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // === Get or create referral code for current user ===
    if (action === 'getMyReferralInfo') {
      let referralCode = user.referral_code;

      // Generate code if missing
      if (!referralCode) {
        referralCode = generateReferralCode(user.id);
        await base44.asServiceRole.entities.User.update(user.id, {
          referral_code: referralCode
        });
      }

      const referralLink = `${REFERRAL_DOMAIN}/r/${referralCode}`;

      // Get stats
      const attributions = await base44.entities.ReferralAttribution.filter({ referrer_user_id: user.id });
      const rewards = await base44.entities.RewardLedger.filter({ user_id: user.id });

      const stats = {
        clicks: attributions?.filter(a => a.status === 'clicked').length || 0,
        signups: attributions?.filter(a => ['registered', 'kyc_approved', 'deposited', 'rewarded'].includes(a.status)).length || 0,
        verified: attributions?.filter(a => ['kyc_approved', 'deposited', 'rewarded'].includes(a.status)).length || 0,
        rewarded: attributions?.filter(a => a.status === 'rewarded').length || 0,
        totalEarned: rewards?.filter(r => r.type.startsWith('referral')).reduce((sum, r) => sum + (r.amount || 0), 0) || 0
      };

      // Recent rewards
      const recentRewards = (rewards || [])
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
        .slice(0, 5);

      return Response.json({
        success: true,
        data: {
          code: referralCode,
          link: referralLink,
          stats,
          recentRewards
        }
      });
    }

    // === Get referral stats ===
    if (action === 'getStats') {
      const attributions = await base44.entities.ReferralAttribution.filter({ referrer_user_id: user.id });
      const rewards = await base44.entities.RewardLedger.filter({ user_id: user.id });

      return Response.json({
        success: true,
        data: {
          attributions: attributions || [],
          rewards: rewards || [],
          summary: {
            totalClicks: attributions?.length || 0,
            signups: attributions?.filter(a => a.referred_user_id).length || 0,
            verified: attributions?.filter(a => a.kyc_at).length || 0,
            deposited: attributions?.filter(a => a.deposited_at).length || 0,
            totalEarned: rewards?.filter(r => r.type.startsWith('referral')).reduce((sum, r) => sum + (r.amount || 0), 0) || 0
          }
        }
      });
    }

    // === ADMIN: Process registration attribution ===
    if (action === 'processRegistration') {
      if (user.role !== 'admin') {
        return Response.json({ success: false, error: 'Admin only' }, { status: 403 });
      }

      const { newUserId, newUserEmail, referralCode } = params;
      if (!newUserId || !referralCode) {
        return Response.json({ success: false, error: 'Missing params' }, { status: 400 });
      }

      // Find referrer
      const referrers = await base44.asServiceRole.entities.User.filter({ referral_code: referralCode.toUpperCase() });
      if (!referrers?.length) {
        return Response.json({ success: false, error: 'Invalid referral code' });
      }

      const referrer = referrers[0];

      // Check for existing attribution
      const existing = await base44.asServiceRole.entities.ReferralAttribution.filter({
        referrer_user_id: referrer.id,
        referred_user_id: newUserId
      });

      if (existing?.length) {
        return Response.json({ success: true, data: existing[0], existing: true });
      }

      // Create L1 attribution
      const attribution = await base44.asServiceRole.entities.ReferralAttribution.create({
        referrer_user_id: referrer.id,
        referrer_code: referralCode.toUpperCase(),
        referred_user_id: newUserId,
        referred_email: newUserEmail,
        level: 1,
        status: 'registered',
        registered_at: new Date().toISOString()
      });

      // Update referred user
      await base44.asServiceRole.entities.User.update(newUserId, {
        referred_by: referralCode.toUpperCase()
      });

      // Create L2 attribution if referrer was also referred
      if (referrer.referred_by) {
        const grandReferrers = await base44.asServiceRole.entities.User.filter({ 
          referral_code: referrer.referred_by 
        });
        if (grandReferrers?.length) {
          await base44.asServiceRole.entities.ReferralAttribution.create({
            referrer_user_id: grandReferrers[0].id,
            referrer_code: referrer.referred_by,
            referred_user_id: newUserId,
            referred_email: newUserEmail,
            level: 2,
            status: 'registered',
            registered_at: new Date().toISOString()
          });
        }
      }

      return Response.json({ success: true, data: attribution });
    }

    // === ADMIN: Process KYC approval ===
    if (action === 'processKycApproval') {
      if (user.role !== 'admin') {
        return Response.json({ success: false, error: 'Admin only' }, { status: 403 });
      }

      const { userId } = params;
      if (!userId) {
        return Response.json({ success: false, error: 'userId required' }, { status: 400 });
      }

      // Find attributions for this user
      const attributions = await base44.asServiceRole.entities.ReferralAttribution.filter({
        referred_user_id: userId
      });

      for (const attr of (attributions || [])) {
        if (attr.status === 'registered') {
          await base44.asServiceRole.entities.ReferralAttribution.update(attr.id, {
            status: 'kyc_approved',
            kyc_at: new Date().toISOString()
          });
        }
      }

      return Response.json({ success: true, updated: attributions?.length || 0 });
    }

    // === ADMIN: Process first deposit and pay rewards ===
    if (action === 'processDeposit') {
      if (user.role !== 'admin') {
        return Response.json({ success: false, error: 'Admin only' }, { status: 403 });
      }

      const { userId } = params;
      if (!userId) {
        return Response.json({ success: false, error: 'userId required' }, { status: 400 });
      }

      // Find attributions for this user
      const attributions = await base44.asServiceRole.entities.ReferralAttribution.filter({
        referred_user_id: userId
      });

      const rewards = [];

      for (const attr of (attributions || [])) {
        // Only pay if KYC approved and not already rewarded
        if (attr.status === 'kyc_approved' && !attr.rewarded_at) {
          const rewardAmount = attr.level === 1 ? L1_REWARD_AMOUNT : L2_REWARD_AMOUNT;
          const rewardType = attr.level === 1 ? 'referral_l1' : 'referral_l2';

          // Check idempotency - no duplicate rewards
          const existingReward = await base44.asServiceRole.entities.RewardLedger.filter({
            user_id: attr.referrer_user_id,
            attribution_id: attr.id
          });

          if (!existingReward?.length) {
            // Create reward
            const reward = await base44.asServiceRole.entities.RewardLedger.create({
              user_id: attr.referrer_user_id,
              type: rewardType,
              amount: rewardAmount,
              currency: 'USDT',
              status: 'credited',
              attribution_id: attr.id,
              meta: {
                referred_user_id: userId,
                code: attr.referrer_code,
                level: attr.level
              },
              description: attr.level === 1 
                ? `L1 Referral reward for ${attr.referred_email || userId}`
                : `L2 Referral reward for ${attr.referred_email || userId}`
            });

            // Update attribution
            await base44.asServiceRole.entities.ReferralAttribution.update(attr.id, {
              status: 'rewarded',
              deposited_at: new Date().toISOString(),
              rewarded_at: new Date().toISOString(),
              reward_amount: rewardAmount
            });

            rewards.push(reward);
          }
        }
      }

      return Response.json({ success: true, rewards });
    }

    return Response.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });

  } catch (err) {
    console.error('[REFERRAL_ERROR]', err);
    return Response.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
});