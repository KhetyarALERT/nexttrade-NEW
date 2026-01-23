import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const REFERRAL_DOMAIN = 'https://nexttrade.exchange';
const L1_REWARD_AMOUNT = 10; // $10 for L1 referral
const L2_REWARD_AMOUNT = 2;  // $2 for L2 referral
const L3_REWARD_AMOUNT = 0.5; // $0.50 for L3 referral

// Valid referral code pattern: 4-32 chars, alphanumeric + hyphen
const REFERRAL_CODE_REGEX = /^[A-Z0-9-]{4,32}$/i;

function generateReferralCode(userId) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'NEXT-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function isValidReferralCode(code) {
  return REFERRAL_CODE_REGEX.test(code);
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

    // === PUBLIC: Record click (no auth needed) - lightweight, just validates ===
    if (action === 'recordClick') {
      const code = String(params.code || '').trim().toUpperCase();
      if (!code || !isValidReferralCode(code)) {
        return Response.json({ success: false, error: 'Invalid code format' }, { status: 400 });
      }

      // Find referrer - just validate the code exists
      const users = await base44.asServiceRole.entities.User.filter({ referral_code: code });
      if (!users?.length) {
        return Response.json({ success: false, error: 'Invalid code' }, { status: 400 });
      }

      // Don't create attribution here - wait until user actually registers
      // This prevents orphan click records
      return Response.json({ success: true, valid: true });
    }

    // === AUTHENTICATED: Finalize referral attribution after login ===
    if (action === 'finalizeReferral') {
      const user = await base44.auth.me();
      if (!user) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }

      const code = String(params.code || '').trim().toUpperCase();
      if (!code || !isValidReferralCode(code)) {
        return Response.json({ ok: false, status: 'invalid_code', error: 'Invalid code format' });
      }

      // Find referrer by code
      const referrers = await base44.asServiceRole.entities.User.filter({ referral_code: code });
      if (!referrers?.length) {
        return Response.json({ ok: false, status: 'invalid_code', error: 'Code not found' });
      }

      const referrer = referrers[0];

      // Block self-referral
      if (referrer.id === user.id) {
        return Response.json({ ok: false, status: 'self_referral', error: 'Cannot refer yourself' });
      }

      // Idempotency: Check if user already has ANY attribution (as referred user)
      const existingAttrs = await base44.asServiceRole.entities.ReferralAttribution.filter({
        referred_user_id: user.id
      });
      if (existingAttrs?.length > 0) {
        return Response.json({ ok: true, status: 'already_attributed' });
      }

      // Also check for duplicate referrer+referred pair
      const duplicateCheck = await base44.asServiceRole.entities.ReferralAttribution.filter({
        referrer_user_id: referrer.id,
        referred_user_id: user.id
      });
      if (duplicateCheck?.length > 0) {
        return Response.json({ ok: true, status: 'already_attributed' });
      }

      const now = new Date().toISOString();

      // Create L1 attribution
      await base44.asServiceRole.entities.ReferralAttribution.create({
        referrer_user_id: referrer.id,
        referrer_code: code,
        referred_user_id: user.id,
        referred_email: user.email,
        level: 1,
        status: 'registered',
        clicked_at: now,
        registered_at: now
      });

      // Update referred user with referral info
      await base44.asServiceRole.entities.User.update(user.id, {
        referred_by: code
      });

      // Create L2 attribution if referrer was also referred
      if (referrer.referred_by) {
        const l2Referrers = await base44.asServiceRole.entities.User.filter({ 
          referral_code: referrer.referred_by 
        });
        if (l2Referrers?.length) {
          const l2Referrer = l2Referrers[0];
          
          // Prevent self-referral loop
          if (l2Referrer.id !== user.id) {
            await base44.asServiceRole.entities.ReferralAttribution.create({
              referrer_user_id: l2Referrer.id,
              referrer_code: referrer.referred_by,
              referred_user_id: user.id,
              referred_email: user.email,
              level: 2,
              status: 'registered',
              registered_at: now
            });

            // Create L3 attribution if L2 referrer was also referred
            if (l2Referrer.referred_by) {
              const l3Referrers = await base44.asServiceRole.entities.User.filter({ 
                referral_code: l2Referrer.referred_by 
              });
              if (l3Referrers?.length) {
                const l3Referrer = l3Referrers[0];
                // Prevent loops
                if (l3Referrer.id !== user.id && l3Referrer.id !== referrer.id) {
                  await base44.asServiceRole.entities.ReferralAttribution.create({
                    referrer_user_id: l3Referrer.id,
                    referrer_code: l2Referrer.referred_by,
                    referred_user_id: user.id,
                    referred_email: user.email,
                    level: 3,
                    status: 'registered',
                    registered_at: now
                  });
                }
              }
            }
          }
        }
      }

      return Response.json({ ok: true, status: 'created' });
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

      // Use query param format that works with Base44 routing
      const referralLink = `${REFERRAL_DOMAIN}/?ref=${referralCode}`;

      // Get stats - use service role since ReferralAttribution has restricted RLS
      const attributions = await base44.asServiceRole.entities.ReferralAttribution.filter({ referrer_user_id: user.id });
      const rewards = await base44.asServiceRole.entities.RewardLedger.filter({ user_id: user.id });

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
      const attributions = await base44.asServiceRole.entities.ReferralAttribution.filter({ referrer_user_id: user.id });
      const rewards = await base44.asServiceRole.entities.RewardLedger.filter({ user_id: user.id });

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

      // Find attributions for this user (L1, L2, L3)
      const attributions = await base44.asServiceRole.entities.ReferralAttribution.filter({
        referred_user_id: userId
      });

      const rewards = [];
      const triggerKey = `deposit_first:${userId}`;

      for (const attr of (attributions || [])) {
        // Only pay if KYC approved and not already rewarded for deposit
        if (attr.status === 'kyc_approved' && !attr.rewarded_at) {
          let rewardAmount = 0;
          let rewardType = 'referral_l1';
          
          if (attr.level === 1) {
            rewardAmount = L1_REWARD_AMOUNT;
            rewardType = 'referral_l1';
          } else if (attr.level === 2) {
            rewardAmount = L2_REWARD_AMOUNT;
            rewardType = 'referral_l2';
          } else if (attr.level === 3) {
            rewardAmount = L3_REWARD_AMOUNT;
            rewardType = 'referral_l3';
          }

          if (rewardAmount <= 0) continue;

          const rewardTriggerKey = `${triggerKey}:L${attr.level}:${attr.referrer_user_id}`;

          // Check idempotency - no duplicate rewards
          const existingReward = await base44.asServiceRole.entities.RewardLedger.filter({
            user_id: attr.referrer_user_id,
            trigger_event_key: rewardTriggerKey
          });

          if (!existingReward?.length) {
            // Create reward
            const reward = await base44.asServiceRole.entities.RewardLedger.create({
              user_id: attr.referrer_user_id,
              type: rewardType,
              subtype: 'referred_deposited',
              amount: rewardAmount,
              points: 0,
              currency: 'USDT',
              status: 'credited',
              trigger_event_key: rewardTriggerKey,
              source_user_id: userId,
              depth: attr.level,
              attribution_id: attr.id,
              meta: {
                referred_user_id: userId,
                code: attr.referrer_code,
                level: attr.level
              },
              description: `L${attr.level} Referral reward for ${attr.referred_email || userId}`
            });

            // Update attribution
            await base44.asServiceRole.entities.ReferralAttribution.update(attr.id, {
              status: 'rewarded',
              deposited_at: new Date().toISOString(),
              rewarded_at: new Date().toISOString(),
              reward_amount: (attr.reward_amount || 0) + rewardAmount
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