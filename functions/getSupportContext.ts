import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * getSupportContext
 * Returns safe user context for the support agent.
 * No secrets, no wallet addresses, no internal config.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const { route, tab, language } = payload;

    // Get KYC status
    let kycStatus = 'unverified';
    try {
      const verifications = await base44.entities.UserVerification.filter({ user_id: user.id });
      if (verifications?.length > 0) {
        kycStatus = verifications[0].status || 'unverified';
      }
    } catch {
      // Ignore - default to unverified
    }

    // Get feature statuses
    let features = {};
    try {
      const featureList = await base44.asServiceRole.entities.FeatureStatus.list();
      for (const f of featureList || []) {
        features[f.feature_key] = f.status;
      }
    } catch {
      // Ignore
    }

    // Get safe account summary
    let accountSummary = {
      copy_trading_enabled: false,
      has_pending_withdrawals: false,
      staking_active: false,
      rewards_points: 0,
    };

    try {
      // Copy trading settings
      const ctSettings = await base44.entities.CopyTradingSettings.filter({ user_id: user.id });
      if (ctSettings?.length > 0) {
        accountSummary.copy_trading_enabled = ctSettings[0].auto_enabled === true;
      }
    } catch {
      // Ignore
    }

    try {
      // Check pending withdrawals (user-scoped)
      const withdrawals = await base44.entities.LedgerWithdrawal.filter({ 
        user_id: user.id, 
        status: 'PENDING' 
      });
      accountSummary.has_pending_withdrawals = (withdrawals?.length || 0) > 0;
    } catch {
      // Ignore
    }

    try {
      // Check active staking
      const stakes = await base44.entities.StakingPosition.filter({ 
        user_id: user.id, 
        status: 'ACTIVE' 
      });
      accountSummary.staking_active = (stakes?.length || 0) > 0;
    } catch {
      // Ignore
    }

    try {
      // Get rewards points from UserLearnProgress or RewardLedger sum
      const progress = await base44.entities.UserLearnProgress.filter({ user_id: user.id });
      if (progress?.length > 0) {
        accountSummary.rewards_points = progress[0].points || 0;
      }
    } catch {
      // Ignore
    }

    return Response.json({
      ok: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
        },
        language: language || 'en',
        route: route || null,
        tab: tab || null,
        kyc_status: kycStatus,
        features,
        account_summary: accountSummary,
      },
    });
  } catch (error) {
    console.error('getSupportContext error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});