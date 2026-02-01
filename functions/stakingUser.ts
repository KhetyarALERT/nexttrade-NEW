// @ts-nocheck
/// <reference lib="deno.ns" />
// Staking User Backend - Phase 1: Real locking + positions + estimated earnings

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ==================== CRYPTO UTILITIES ====================
const DEFAULT_OKX_BASE_URL = 'https://www.okx.com';

function base64Encode(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64Decode(text) {
  const bin = atob(text);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function getEnv(key) {
  return Deno.env.get(key);
}

function getOkxBaseUrl() {
  return getEnv('OKX_BASE_URL') || DEFAULT_OKX_BASE_URL;
}

async function importAesKey() {
  const raw = getEnv('APP_ENCRYPTION_KEY');
  if (!raw) throw new Error('Missing APP_ENCRYPTION_KEY');
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(raw));
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function decryptSecret(payload) {
  if (!payload) return '';
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const iv = base64Decode(parsed.iv);
  const tag = base64Decode(parsed.tag);
  const ciphertext = base64Decode(parsed.ciphertext);
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);
  const key = await importAesKey();
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, combined);
  return new TextDecoder().decode(decrypted);
}

async function generateOkxSignature(timestamp, method, requestPath, body, secretKey) {
  const prehash = timestamp + method.toUpperCase() + requestPath + body;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const msgData = encoder.encode(prehash);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return base64Encode(new Uint8Array(signature));
}

function buildRequestPath(path, query) {
  if (!query || Object.keys(query).length === 0) return path;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function okxRequest({ credential, method, path, query, body, isTradingEndpoint = false }) {
  const timestamp = new Date().toISOString();
  const requestPath = buildRequestPath(path, query);
  const bodyStr = body ? JSON.stringify(body) : '';
  const signature = await generateOkxSignature(timestamp, method, requestPath, bodyStr, credential.secretKey);

  const headers = {
    'OK-ACCESS-KEY': credential.apiKey,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': credential.passphrase,
    'Content-Type': 'application/json',
  };

  const url = `${getOkxBaseUrl()}${requestPath}`;

  try {
    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers,
      body: method.toUpperCase() === 'GET' ? undefined : (bodyStr || undefined),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || (data?.code && data.code !== '0')) {
      return { ok: false, error: { httpStatus: res.status, okxCode: data?.code, okxMsg: data?.msg } };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: { okxMsg: error?.message || 'Network error' } };
  }
}

// Get user's OKX credential
async function getUserOkxCredential(base44, userId) {
  const accounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({
    user_id: userId,
    provider: 'OKX',
    status: 'ACTIVE'
  });

  if (!accounts?.length) {
    return { ok: false, error: { code: 'NO_OKX_ACCOUNT', message: 'No active OKX account found' } };
  }

  const account = accounts[0];
  const creds = await base44.asServiceRole.entities.ExchangeCredential.filter({
    user_exchange_account_id: account.id,
    status: 'ACTIVE'
  });

  if (!creds?.length) {
    return { ok: false, error: { code: 'NO_CREDENTIALS', message: 'No active credentials found' } };
  }

  const cred = creds[0];
  return {
    ok: true,
    data: {
      account,
      credential: {
        apiKey: cred.api_key,
        secretKey: await decryptSecret(cred.secret_enc),
        passphrase: await decryptSecret(cred.passphrase_enc)
      }
    }
  };
}

// Get accrued amount - use real accrued_amount from daily processor
function getAccruedAmount(position) {
  // Return real accrued amount if available, otherwise 0
  return position.accrued_amount || 0;
}

// Claimable = accrued - paid
function getClaimableAmount(position) {
  return (position.accrued_amount || 0) - (position.paid_amount || 0);
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
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch { return Response.json({ ok: false, error: { code: 'INVALID_JSON' } }, { status: 400 }); }

    const { action, ...params } = body || {};
    if (!action) return Response.json({ ok: false, error: { code: 'MISSING_ACTION' } }, { status: 400 });

    console.log('[STAKING_USER] Action:', action, 'User:', user.email);

    // GET PLANS - Returns enabled staking plans
    if (action === 'getPlans') {
      const plans = await base44.entities.StakingPlan.filter({ is_enabled: true }, 'sort_order', 10);
      return Response.json({
        ok: true,
        data: (plans || []).map(p => ({
          key: p.key,
          title: p.title,
          shortDescription: p.short_description,
          termDays: p.term_days,
          apyPercent: p.apy_percent,
          minDeposit: p.min_deposit,
          baseRewardsPerDollar: p.base_rewards_per_dollar || 10,
          perks: p.perks || [],
          features: p.features || [],
          isEnabled: p.is_enabled !== false,
          isRecommended: p.is_recommended || false,
          isPopular: p.is_popular
        }))
      });
    }

    // GET SUMMARY - Returns user's staking summary
    if (action === 'getSummary') {
      const positions = await base44.entities.StakingPosition.filter({ user_id: user.id }, '-created_date', 100);
      
      // Calculate totals
      const activePositions = (positions || []).filter(p => p.status === 'ACTIVE' || p.status === 'PENDING_APPROVAL');
      const totalStaked = activePositions.reduce((sum, p) => sum + (p.principal_amount || 0), 0);
      const activeCount = (positions || []).filter(p => p.status === 'ACTIVE').length;
      
      // Weighted average APY
      let weightedApySum = 0;
      let totalActiveStaked = 0;
      for (const p of (positions || []).filter(pos => pos.status === 'ACTIVE')) {
        weightedApySum += (p.principal_amount || 0) * (p.apy_percent || 0);
        totalActiveStaked += (p.principal_amount || 0);
      }
      const avgApy = totalActiveStaked > 0 ? weightedApySum / totalActiveStaked : 0;
      
      // Real accrued and claimable (from daily processor)
      let totalAccrued = 0;
      let totalClaimable = 0;
      for (const p of (positions || []).filter(pos => pos.status === 'ACTIVE')) {
        totalAccrued += getAccruedAmount(p);
        totalClaimable += getClaimableAmount(p);
      }

      return Response.json({
        ok: true,
        data: {
          totalStaked,
          activePositions: activeCount,
          pendingPositions: activePositions.filter(p => p.status === 'PENDING_APPROVAL').length,
          avgApy: Math.round(avgApy * 100) / 100,
          estimatedEarned: Math.round(totalAccrued * 100) / 100, // Now real accrued
          totalAccrued: Math.round(totalAccrued * 100) / 100,
          totalClaimable: Math.round(totalClaimable * 100) / 100
        }
      });
    }

    // GET WALLET OVERLAY - Returns staking data for Wallet page display
    // ACCOUNTING: PENDING_APPROVAL funds are still in user's OKX (funding), ACTIVE funds are in main pool
    if (action === 'getWalletOverlay') {
      const positions = await base44.entities.StakingPosition.filter({ user_id: user.id }, '-created_date', 100);
      
      // Separate pending vs active
      const pendingPositions = (positions || []).filter(p => p.status === 'PENDING_APPROVAL');
      const activePositions = (positions || []).filter(p => p.status === 'ACTIVE');
      
      // Build locked amounts by currency
      const pendingLockedByCcy = {};
      const activeLockedByCcy = {};
      
      for (const p of pendingPositions) {
        const ccy = p.currency || 'USDT';
        pendingLockedByCcy[ccy] = (pendingLockedByCcy[ccy] || 0) + (p.principal_amount || 0);
      }
      
      for (const p of activePositions) {
        const ccy = p.currency || 'USDT';
        activeLockedByCcy[ccy] = (activeLockedByCcy[ccy] || 0) + (p.principal_amount || 0);
      }
      
      // Find next unlock date (earliest ends_at among ACTIVE)
      let nextUnlockAt = null;
      for (const p of activePositions) {
        if (p.ends_at) {
          if (!nextUnlockAt || new Date(p.ends_at) < new Date(nextUnlockAt)) {
            nextUnlockAt = p.ends_at;
          }
        }
      }
      
      // Last stake created
      const allStakes = [...pendingPositions, ...activePositions].sort((a, b) => 
        new Date(b.created_at || b.created_date || 0).getTime() - new Date(a.created_at || a.created_date || 0).getTime()
      );
      const lastStakeCreatedAt = allStakes.length > 0 ? (allStakes[0].created_at || allStakes[0].created_date) : null;
      
      // Preview of active positions (top 3)
      const activePositionsPreview = activePositions.slice(0, 3).map(p => ({
        id: p.id,
        amount: p.principal_amount,
        currency: p.currency || 'USDT',
        startedAt: p.started_at,
        endsAt: p.ends_at,
        apyPercent: p.apy_percent,
        status: p.status,
        accruedAmount: getAccruedAmount(p),
        claimableAmount: getClaimableAmount(p),
        lastAccrualAt: p.last_accrual_at
      }));
      
      // Real accrued total (from daily processor)
      let totalAccrued = 0;
      for (const p of activePositions) {
        totalAccrued += getAccruedAmount(p);
      }

      return Response.json({
        ok: true,
        data: {
          pendingLockedByCcy,
          activeLockedByCcy,
          pendingCount: pendingPositions.length,
          activeCount: activePositions.length,
          nextUnlockAt,
          lastStakeCreatedAt,
          activePositionsPreview,
          totalEstimatedEarned: Math.round(totalAccrued * 100) / 100 // Now real accrued
        }
      });
    }

    // GET POSITIONS - Returns user's staking positions
    if (action === 'getPositions') {
      const positions = await base44.entities.StakingPosition.filter({ user_id: user.id }, '-created_date', 50);
      
      return Response.json({
        ok: true,
        data: (positions || []).map(p => ({
          id: p.id,
          planKey: p.plan_key,
          principal: p.principal_amount,
          currency: p.currency || 'USDT',
          apyPercent: p.apy_percent,
          termDays: p.term_days,
          baseRewardsPerDollar: p.base_rewards_per_dollar || 0,
          rewardsGranted: p.rewards_granted || 0,
          firstStakeBonusApplied: p.first_stake_bonus_applied || false,
          status: p.status,
          startedAt: p.started_at,
          endsAt: p.ends_at,
          // Real accrued values from daily processor
          accruedAmount: getAccruedAmount(p),
          paidAmount: p.paid_amount || 0,
          claimableAmount: getClaimableAmount(p),
          payoutStatus: p.payout_status || 'NONE',
          lastAccrualAt: p.last_accrual_at,
          // Legacy field - now returns real accrued
          estimatedEarned: getAccruedAmount(p),
          createdAt: p.created_at || p.created_date,
          rejectReason: p.reject_reason,
          destinationPool: p.destination_pool,
          sourceAccount: p.source_account || 'MAIN'
        }))
      });
    }

    // CREATE STAKE REQUEST - Lock funds and create pending position
    if (action === 'createStakeRequest') {
      const { planKey, amount, sourceAccount, source_account } = params;
      const finalSourceAccount = sourceAccount || source_account || 'MAIN';

      if (!planKey || !amount || amount <= 0) {
        return Response.json({ ok: false, error: { code: 'INVALID_PARAMS', message: 'Plan key and amount required' } }, { status: 400 });
      }

      // Get plan
      const plans = await base44.entities.StakingPlan.filter({ key: planKey, is_enabled: true });
      if (!plans?.length) {
        return Response.json({ ok: false, error: { code: 'PLAN_NOT_FOUND', message: 'Plan not found or disabled' } }, { status: 400 });
      }
      const plan = plans[0];

      if (amount < plan.min_deposit) {
        return Response.json({ ok: false, error: { code: 'MIN_DEPOSIT', message: `Minimum deposit is ${plan.min_deposit} USDT` } }, { status: 400 });
      }

      const now = new Date().toISOString();
      let lockTransferId = null;

      // === COPY TRADING WALLET LOGIC ===
      if (finalSourceAccount === 'COPY_TRADING') {
        const wallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: user.id });
        const wallet = wallets?.[0];
        
        if (!wallet) {
          return Response.json({ ok: false, error: { code: 'NO_WALLET', message: 'Copy Trading wallet not found' } }, { status: 400 });
        }

        if (wallet.available_balance < amount) {
          return Response.json({ ok: false, error: { code: 'INSUFFICIENT_BALANCE', message: `Insufficient balance: ${wallet.available_balance.toFixed(2)} USDT` } }, { status: 400 });
        }

        // Don't lock yet (per instructions: lock on admin approve)
      } else {
        // === MAIN (OKX) LOGIC ===
        // Get user's OKX credential
        const credResult = await getUserOkxCredential(base44, user.id);
        if (!credResult.ok) {
          return Response.json({ ok: false, error: credResult.error }, { status: 400 });
        }

        const { account, credential } = credResult.data;

        // Check trading account balance
        const balanceRes = await okxRequest({
          credential,
          method: 'GET',
          path: '/api/v5/account/balance',
          isTradingEndpoint: true
        });

        if (!balanceRes.ok) {
          return Response.json({ ok: false, error: { code: 'BALANCE_CHECK_FAILED', message: balanceRes.error?.okxMsg || 'Failed to check balance' } }, { status: 500 });
        }

        const tradingUsdt = parseFloat(balanceRes.data?.data?.[0]?.details?.find(d => d.ccy === 'USDT')?.availBal || '0');
        if (tradingUsdt < amount) {
          return Response.json({ ok: false, error: { code: 'INSUFFICIENT_BALANCE', message: `Insufficient trading balance. Available: ${tradingUsdt.toFixed(2)} USDT` } }, { status: 400 });
        }

        // STEP 1: Create PENDING transfer record
        try {
          const lockTransfer = await base44.asServiceRole.entities.ExchangeTransfer.create({
            user_id: user.id,
            provider: 'OKX',
            from_account: account.external_account_id || 'self',
            from_account_type: 'trading',
            to_account: account.external_account_id || 'self',
            to_account_type: 'funding',
            currency: 'USDT',
            amount: parseFloat(amount),
            status: 'PENDING',
            created_at: now
          });
          lockTransferId = lockTransfer?.id;
          console.log('[STAKING] Created lock transfer record:', lockTransferId);
        } catch (e) {
          console.log('[STAKING] Failed to create lock transfer record (non-blocking):', e.message);
        }

        // STEP 2: Execute OKX transfer: Trading(18) -> Funding(6)
        const transferRes = await okxRequest({
          credential,
          method: 'POST',
          path: '/api/v5/asset/transfer',
          body: {
            ccy: 'USDT',
            amt: String(amount),
            from: '18', // Trading
            to: '6',    // Funding
            type: '0'   // Within account
          },
          isTradingEndpoint: false
        });

        const transferResult = transferRes.data?.data?.[0];
        const completedAt = new Date().toISOString();

        if (!transferRes.ok || (transferResult?.code && transferResult.code !== '0')) {
          const errMsg = transferRes.error?.okxMsg || transferResult?.msg || 'Lock transfer failed';
          
          // Update transfer to FAILED
          if (lockTransferId) {
            try {
              await base44.asServiceRole.entities.ExchangeTransfer.update(lockTransferId, {
                status: 'FAILED',
                error_message: errMsg,
                completed_at: completedAt
              });
            } catch (e) {
              console.log('[STAKING] Failed to update lock transfer to FAILED:', e.message);
            }
          }
          
          return Response.json({ ok: false, error: { code: 'LOCK_FAILED', message: errMsg } }, { status: 500 });
        }

        // Update transfer to COMPLETED
        if (lockTransferId) {
          try {
            await base44.asServiceRole.entities.ExchangeTransfer.update(lockTransferId, {
              status: 'COMPLETED',
              external_transfer_id: transferResult?.transId || null,
              completed_at: completedAt
            });
            console.log('[STAKING] Updated lock transfer to COMPLETED:', lockTransferId);
          } catch (e) {
            console.log('[STAKING] Failed to update lock transfer to COMPLETED:', e.message);
          }
        }
      }

      // STEP 3: Create staking position with status PENDING_APPROVAL
      const position = await base44.asServiceRole.entities.StakingPosition.create({
        user_id: user.id,
        user_email: user.email,
        plan_key: planKey,
        principal_amount: parseFloat(amount),
        currency: 'USDT',
        apy_percent: plan.apy_percent,
        term_days: plan.term_days,
        base_rewards_per_dollar: plan.base_rewards_per_dollar || 10,
        status: 'PENDING_APPROVAL',
        source_account: finalSourceAccount,
        lock_transfer_id: lockTransferId,
        created_at: now,
        updated_at: now
      });

      console.log('[STAKING] Created position:', position.id, 'Status: PENDING_APPROVAL', 'Source:', finalSourceAccount);

      // Notify admins (best effort)
      try {
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        for (const admin of (admins || []).slice(0, 5)) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: admin.id,
            type: 'system',
            title: 'New Staking Request',
            message: `${user.email} requested to stake ${amount} USDT (${plan.title})`,
            data: { stakingPositionId: position.id, action: 'staking_request' },
            read: false,
            priority: 'high'
          });
        }
      } catch (e) {
        console.log('[STAKING] Failed to notify admins:', e.message);
      }

      return Response.json({
        ok: true,
        data: {
          positionId: position.id,
          status: 'PENDING_APPROVAL',
          lockTransferId,
          amount: parseFloat(amount),
          planKey,
          message: 'Funds locked. Awaiting admin approval.'
        }
      });
    }

    // CANCEL STAKE REQUEST - User can cancel if still PENDING_APPROVAL
    if (action === 'cancelStakeRequest') {
      const { positionId } = params;

      if (!positionId) {
        return Response.json({ ok: false, error: { code: 'MISSING_POSITION_ID' } }, { status: 400 });
      }

      const positions = await base44.entities.StakingPosition.filter({ id: positionId, user_id: user.id });
      if (!positions?.length) {
        return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Position not found' } }, { status: 404 });
      }

      const position = positions[0];
      if (position.status !== 'PENDING_APPROVAL') {
        return Response.json({ ok: false, error: { code: 'CANNOT_CANCEL', message: 'Can only cancel pending positions' } }, { status: 400 });
      }

      const credResult = await getUserOkxCredential(base44, user.id);
      if (!credResult.ok) {
        return Response.json({ ok: false, error: credResult.error }, { status: 400 });
      }

      const { account, credential } = credResult.data;
      const now = new Date().toISOString();

      // Transfer back: Funding(6) -> Trading(18)
      let unlockTransferId = null;
      try {
        const unlockTransfer = await base44.asServiceRole.entities.ExchangeTransfer.create({
          user_id: user.id,
          provider: 'OKX',
          from_account: account.external_account_id || 'self',
          from_account_type: 'funding',
          to_account: account.external_account_id || 'self',
          to_account_type: 'trading',
          currency: 'USDT',
          amount: position.principal_amount,
          status: 'PENDING',
          created_at: now
        });
        unlockTransferId = unlockTransfer?.id;
      } catch (e) {
        console.log('[STAKING] Failed to create unlock transfer record:', e.message);
      }

      const transferRes = await okxRequest({
        credential,
        method: 'POST',
        path: '/api/v5/asset/transfer',
        body: {
          ccy: 'USDT',
          amt: String(position.principal_amount),
          from: '6',  // Funding
          to: '18',   // Trading
          type: '0'
        },
        isTradingEndpoint: false
      });

      const completedAt = new Date().toISOString();

      if (unlockTransferId) {
        try {
          await base44.asServiceRole.entities.ExchangeTransfer.update(unlockTransferId, {
            status: transferRes.ok ? 'COMPLETED' : 'FAILED',
            external_transfer_id: transferRes.data?.data?.[0]?.transId || null,
            error_message: transferRes.ok ? null : (transferRes.error?.okxMsg || 'Failed'),
            completed_at: completedAt
          });
        } catch (e) {
          console.log('[STAKING] Failed to update unlock transfer:', e.message);
        }
      }

      // Update position to CANCELLED
      await base44.asServiceRole.entities.StakingPosition.update(positionId, {
        status: 'CANCELLED',
        unlock_transfer_id: unlockTransferId,
        notes: 'Cancelled by user',
        updated_at: completedAt
      });

      return Response.json({
        ok: true,
        data: {
          positionId,
          status: 'CANCELLED',
          fundsReturned: transferRes.ok
        }
      });
    }

    return Response.json({ ok: false, error: { code: 'INVALID_ACTION', message: 'Invalid action' } }, { status: 400 });

  } catch (error) {
    console.error('[STAKING_USER_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});