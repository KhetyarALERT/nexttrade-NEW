// @ts-nocheck
/// <reference lib="deno.ns" />

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Rewards / vouchers wiring.
// Notes:
// - This function expects the Base44 entities below to exist (create them in Base44 console):
//   - VoucherClaim: { user_id, voucher_id, claimed_at, source?, meta? }
// - Permissions can be tightened later; we use service role writes but always scope by user_id.

const audit = (action: string, userId: string, data: unknown) => {
  console.log(`[REWARDS_AUDIT] [${new Date().toISOString()}] ${action} | User: ${userId}`, JSON.stringify(data));
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, ...params } = body || {};

    if (!action) {
      return Response.json({ success: false, error: 'Missing action' }, { status: 400 });
    }

    // List voucher claims
    if (action === 'getVoucherClaims') {
      const claims = await base44.entities.VoucherClaim.filter({ user_id: user.id });
      return Response.json({ success: true, data: claims || [] });
    }

    // Claim a voucher (idempotent)
    if (action === 'claimVoucher') {
      const voucherId = String(params.voucherId || params.voucher_id || '').trim();
      if (!voucherId) {
        return Response.json({ success: false, error: 'voucherId is required' }, { status: 400 });
      }

      const existing = await base44.entities.VoucherClaim.filter({ user_id: user.id, voucher_id: voucherId });
      if (existing?.length) {
        return Response.json({ success: true, data: existing[0], existing: true });
      }

      const record = await base44.asServiceRole.entities.VoucherClaim.create({
        user_id: user.id,
        voucher_id: voucherId,
        claimed_at: new Date().toISOString(),
        source: String(params.source || 'manual'),
        meta: params.meta ?? {},
      });

      audit('VOUCHER_CLAIMED', user.id, { voucherId, claimId: record.id });
      return Response.json({ success: true, data: record });
    }

    // Compute eligibility state for milestone vouchers
    if (action === 'getRewardsState') {
      const verificationStatus = String((user as any)?.verificationStatus || '').toLowerCase();
      const isVerified = verificationStatus === 'verified';

      // Deposits
      const deposits = await base44.entities.WalletTransaction.filter({ user_id: user.id, type: 'deposit' });
      const depositTotal = (deposits || []).reduce((sum: number, tx: any) => sum + (Number(tx?.amount) || 0), 0);

      // Stakes
      const stakes = await base44.entities.StakingPosition.filter({ user_id: user.id });
      const hasStake = Boolean(stakes?.length);

      const milestones = {
        signup: true,
        verify: isVerified,
        first_deposit: depositTotal > 0,
        first_stake: hasStake,
        deposit_500: depositTotal >= 500,
        zero_fee_5: true,
      };

      return Response.json({
        success: true,
        data: {
          milestones,
          depositTotal,
          hasStake,
          isVerified,
        },
      });
    }

    return Response.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[REWARDS_ERROR]', message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
});
