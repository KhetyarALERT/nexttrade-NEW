// @ts-nocheck
/// <reference lib="deno.ns" />
// Staking Auto-Approve Processor - Scheduled automation to auto-approve pending stakes

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

function getMasterCredentials() {
  const apiKey = getEnv('OKX_MAIN_API_KEY');
  const secretKey = getEnv('OKX_MAIN_SECRET');
  const passphrase = getEnv('OKX_MAIN_PASSPHRASE');
  if (!apiKey || !secretKey || !passphrase) {
    return { ok: false, error: { code: 'CONFIG_ERROR', message: 'Missing OKX credentials' } };
  }
  return { ok: true, data: { apiKey, secretKey, passphrase } };
}

// ==================== MAIN HANDLER ====================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }
    });
  }

  const base44 = createClientFromRequest(req);
  const runId = crypto.randomUUID().substring(0, 8);
  const startTime = Date.now();

  console.log(`[STAKING_AUTO_APPROVE] [${runId}] Starting auto-approval job`);

  const result = {
    runId,
    processedCount: 0,
    approvedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    details: []
  };

  try {
    // STEP 1: Load config
    const configs = await base44.asServiceRole.entities.StakingConfig.filter({ config_key: 'default' });
    const config = configs?.[0];

    if (!config || !config.auto_approve_enabled) {
      console.log(`[STAKING_AUTO_APPROVE] [${runId}] Auto-approval disabled`);
      return Response.json({ ok: true, data: { ...result, message: 'Auto-approval disabled' } });
    }

    const {
      auto_approve_max_amount = 1000,
      auto_approve_plans = [],
      auto_approve_require_kyc = true,
      auto_approve_min_age_minutes = 5,
      main_staking_pool_name = 'Main Staking Pool',
      first_stake_enabled,
      first_stake_min_term_days,
      first_stake_min_amount,
      first_stake_cap_principal,
      first_stake_bonus_multiplier
    } = config;

    console.log(`[STAKING_AUTO_APPROVE] [${runId}] Config: maxAmt=${auto_approve_max_amount}, plans=${JSON.stringify(auto_approve_plans)}, requireKyc=${auto_approve_require_kyc}, minAge=${auto_approve_min_age_minutes}min`);

    // STEP 2: Get enabled plans
    const allPlans = await base44.asServiceRole.entities.StakingPlan.filter({ is_enabled: true });
    const planKeySet = new Set(allPlans.map(p => p.key));
    const eligiblePlanKeys = auto_approve_plans.length > 0
      ? auto_approve_plans.filter(k => planKeySet.has(k))
      : Array.from(planKeySet);

    if (eligiblePlanKeys.length === 0) {
      console.log(`[STAKING_AUTO_APPROVE] [${runId}] No eligible plans`);
      return Response.json({ ok: true, data: { ...result, message: 'No eligible plans configured' } });
    }

    // STEP 3: Get pending positions
    const pendingPositions = await base44.asServiceRole.entities.StakingPosition.filter(
      { status: 'PENDING_APPROVAL' },
      'created_at',
      100
    );

    if (!pendingPositions?.length) {
      console.log(`[STAKING_AUTO_APPROVE] [${runId}] No pending positions`);
      return Response.json({ ok: true, data: { ...result, message: 'No pending positions' } });
    }

    console.log(`[STAKING_AUTO_APPROVE] [${runId}] Found ${pendingPositions.length} pending positions`);

    const now = new Date();
    const minAgeMs = auto_approve_min_age_minutes * 60 * 1000;
    const masterCreds = getMasterCredentials();

    if (!masterCreds.ok) {
      console.error(`[STAKING_AUTO_APPROVE] [${runId}] Missing master credentials`);
      return Response.json({ ok: false, error: masterCreds.error }, { status: 500 });
    }

    // Pre-fetch all user KYC statuses if needed
    const userKycMap = {};
    if (auto_approve_require_kyc) {
      const userIds = [...new Set(pendingPositions.map(p => p.user_id))];
      for (const userId of userIds) {
        try {
          const verifications = await base44.asServiceRole.entities.VerificationRequest.filter(
            { user_id: userId, status: 'approved' },
            '-created_date',
            1
          );
          userKycMap[userId] = verifications?.length > 0;
        } catch {
          userKycMap[userId] = false;
        }
      }
    }

    // STEP 4: Process each position
    for (const position of pendingPositions) {
      result.processedCount++;
      const posDetail = { id: position.id, userEmail: position.user_email, amount: position.principal_amount, status: 'pending' };

      try {
        // Check: already processed (idempotency)
        if (position.status !== 'PENDING_APPROVAL') {
          posDetail.status = 'skipped';
          posDetail.reason = 'Status changed';
          result.skippedCount++;
          result.details.push(posDetail);
          continue;
        }

        // Check: plan eligibility
        if (!eligiblePlanKeys.includes(position.plan_key)) {
          posDetail.status = 'skipped';
          posDetail.reason = `Plan ${position.plan_key} not eligible`;
          result.skippedCount++;
          result.details.push(posDetail);
          continue;
        }

        // Check: amount limit
        if (position.principal_amount > auto_approve_max_amount) {
          posDetail.status = 'skipped';
          posDetail.reason = `Amount ${position.principal_amount} exceeds max ${auto_approve_max_amount}`;
          result.skippedCount++;
          result.details.push(posDetail);
          continue;
        }

        // Check: minimum age
        const createdAt = new Date(position.created_at || position.created_date);
        const ageMs = now.getTime() - createdAt.getTime();
        if (ageMs < minAgeMs) {
          posDetail.status = 'skipped';
          posDetail.reason = `Too new: ${Math.round(ageMs / 60000)}min < ${auto_approve_min_age_minutes}min`;
          result.skippedCount++;
          result.details.push(posDetail);
          continue;
        }

        // Check: KYC
        if (auto_approve_require_kyc && !userKycMap[position.user_id]) {
          posDetail.status = 'skipped';
          posDetail.reason = 'KYC not approved';
          result.skippedCount++;
          result.details.push(posDetail);
          continue;
        }

        // Check: lock transfer completed
        if (position.lock_transfer_id) {
          const transfers = await base44.asServiceRole.entities.ExchangeTransfer.filter({ id: position.lock_transfer_id });
          if (transfers?.length && transfers[0].status !== 'COMPLETED') {
            posDetail.status = 'skipped';
            posDetail.reason = `Lock transfer not completed: ${transfers[0].status}`;
            result.skippedCount++;
            result.details.push(posDetail);
            continue;
          }
        }

        // Check: user has OKX account
        const userAccounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({
          user_id: position.user_id,
          provider: 'OKX',
          status: 'ACTIVE'
        });
        if (!userAccounts?.length) {
          posDetail.status = 'skipped';
          posDetail.reason = 'No active OKX account';
          result.skippedCount++;
          result.details.push(posDetail);
          continue;
        }

        const account = userAccounts[0];
        const pools = await base44.asServiceRole.entities.OKXSubAccountPool.filter({ id: account.pool_account_id });
        if (!pools?.length) {
          posDetail.status = 'skipped';
          posDetail.reason = 'Pool account not found';
          result.skippedCount++;
          result.details.push(posDetail);
          continue;
        }

        const pool = pools[0];
        const credential = {
          apiKey: pool.api_key,
          secretKey: await decryptSecret(pool.secret_enc),
          passphrase: await decryptSecret(pool.passphrase_enc)
        };

        // Check: funding balance sufficient
        const fundingRes = await okxRequest({
          credential,
          method: 'GET',
          path: '/api/v5/asset/balances',
          isTradingEndpoint: false
        });

        if (!fundingRes.ok) {
          posDetail.status = 'skipped';
          posDetail.reason = `Failed to check funding balance: ${fundingRes.error?.okxMsg}`;
          result.skippedCount++;
          result.details.push(posDetail);
          continue;
        }

        const fundingUsdt = parseFloat((fundingRes.data?.data || []).find(d => d.ccy === 'USDT')?.bal || '0');
        if (fundingUsdt < position.principal_amount) {
          posDetail.status = 'skipped';
          posDetail.reason = `Insufficient funding balance: ${fundingUsdt} < ${position.principal_amount}`;
          result.skippedCount++;
          result.details.push(posDetail);
          continue;
        }

        // ========== APPROVE THE STAKE ==========
        console.log(`[STAKING_AUTO_APPROVE] [${runId}] Approving position ${position.id}`);

        // Re-check status (concurrency guard)
        const freshPositions = await base44.asServiceRole.entities.StakingPosition.filter({ id: position.id });
        if (!freshPositions?.length || freshPositions[0].status !== 'PENDING_APPROVAL') {
          posDetail.status = 'skipped';
          posDetail.reason = 'Status changed during processing';
          result.skippedCount++;
          result.details.push(posDetail);
          continue;
        }

        const nowIso = new Date().toISOString();
        const endsAt = new Date(Date.now() + position.term_days * 24 * 60 * 60 * 1000).toISOString();

        // Calculate rewards (same logic as okxAdminHub.approveStake)
        const baseRewardsPerDollar = position.base_rewards_per_dollar || 10;
        let baseRewards = Math.round(position.principal_amount * baseRewardsPerDollar);
        let firstStakeBonus = 0;
        let firstStakeBonusApplied = false;

        if (first_stake_enabled) {
          const existingActive = await base44.asServiceRole.entities.StakingPosition.filter({
            user_id: position.user_id,
            status: 'ACTIVE'
          });
          const existingCompleted = await base44.asServiceRole.entities.StakingPosition.filter({
            user_id: position.user_id,
            status: 'COMPLETED'
          });

          const hasCompletedStake = (existingActive?.length || 0) > 0 || (existingCompleted?.length || 0) > 0;

          if (!hasCompletedStake &&
              position.term_days >= (first_stake_min_term_days || 60) &&
              position.principal_amount >= (first_stake_min_amount || 100)) {
            const eligibleAmount = Math.min(position.principal_amount, first_stake_cap_principal || 300);
            const bonusMultiplier = (first_stake_bonus_multiplier || 1.5) - 1;
            firstStakeBonus = Math.round(eligibleAmount * baseRewardsPerDollar * bonusMultiplier);
            firstStakeBonusApplied = true;
          }
        }

        const totalRewardsGranted = baseRewards + firstStakeBonus;

        // Create stake transfer record
        let stakeTransferId = null;
        try {
          const stakeTransfer = await base44.asServiceRole.entities.ExchangeTransfer.create({
            user_id: position.user_id,
            provider: 'OKX',
            from_account: pool.subaccount_name,
            from_account_type: 'funding',
            to_account: 'main',
            to_account_type: 'funding',
            currency: 'USDT',
            amount: position.principal_amount,
            status: 'PENDING',
            created_at: nowIso
          });
          stakeTransferId = stakeTransfer?.id;
        } catch (e) {
          console.log(`[STAKING_AUTO_APPROVE] [${runId}] Failed to create transfer record:`, e.message);
        }

        // Execute transfer to main pool
        const transferRes = await okxRequest({
          credential: masterCreds.data,
          method: 'POST',
          path: '/api/v5/asset/transfer',
          body: {
            ccy: 'USDT',
            amt: String(position.principal_amount),
            from: '6',
            to: '6',
            type: '2',
            subAcct: pool.subaccount_name
          },
          isTradingEndpoint: false
        });

        const transferResult = transferRes.data?.data?.[0];
        const completedAt = new Date().toISOString();

        if (!transferRes.ok || (transferResult?.code && transferResult.code !== '0')) {
          const errMsg = transferRes.error?.okxMsg || transferResult?.msg || 'Transfer failed';

          if (stakeTransferId) {
            await base44.asServiceRole.entities.ExchangeTransfer.update(stakeTransferId, {
              status: 'FAILED',
              error_message: errMsg,
              completed_at: completedAt
            });
          }

          // Update position with error
          await base44.asServiceRole.entities.StakingPosition.update(position.id, {
            last_auto_attempt_at: completedAt,
            last_auto_error: errMsg,
            updated_at: completedAt
          });

          posDetail.status = 'failed';
          posDetail.reason = errMsg;
          result.failedCount++;
          result.details.push(posDetail);

          // Notify admin (dedupe by position + error)
          try {
            const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
            if (admins?.length) {
              await base44.asServiceRole.entities.Notification.create({
                user_id: admins[0].id,
                type: 'system',
                title: 'Auto-Approve Failed',
                message: `Failed to auto-approve stake ${position.id}: ${errMsg}`,
                data: { stakingPositionId: position.id, error: errMsg, action: 'auto_approve_failed' },
                read: false,
                priority: 'high'
              });
            }
          } catch (e) {
            console.log(`[STAKING_AUTO_APPROVE] [${runId}] Failed to notify admin:`, e.message);
          }

          continue;
        }

        // Update transfer to COMPLETED
        if (stakeTransferId) {
          await base44.asServiceRole.entities.ExchangeTransfer.update(stakeTransferId, {
            status: 'COMPLETED',
            external_transfer_id: transferResult?.transId || null,
            completed_at: completedAt
          });
        }

        // Update position to ACTIVE
        await base44.asServiceRole.entities.StakingPosition.update(position.id, {
          status: 'ACTIVE',
          stake_transfer_id: stakeTransferId,
          destination_pool: main_staking_pool_name,
          rewards_granted: totalRewardsGranted,
          first_stake_bonus_applied: firstStakeBonusApplied,
          first_stake_bonus_amount: firstStakeBonus,
          started_at: nowIso,
          ends_at: endsAt,
          approved_by: 'AUTOMATION',
          approved_by_type: 'AUTOMATION',
          approved_at: nowIso,
          approval_note: `Auto-approved by scheduled job (run: ${runId})`,
          last_auto_attempt_at: null,
          last_auto_error: null,
          updated_at: nowIso
        });

        // Notify user
        try {
          await base44.asServiceRole.entities.Notification.create({
            user_id: position.user_id,
            type: 'staking_reward',
            title: 'Stake Activated! 🎉',
            message: `Your ${position.principal_amount} USDT stake has been activated. Earning ${position.apy_percent}% APY for ${position.term_days} days.${totalRewardsGranted > 0 ? ` +${totalRewardsGranted} Bonus Rewards!` : ''}`,
            data: { stakingPositionId: position.id, action: 'stake_activated', rewardsGranted: totalRewardsGranted },
            read: false,
            priority: 'high'
          });
        } catch (e) {
          console.log(`[STAKING_AUTO_APPROVE] [${runId}] Failed to notify user:`, e.message);
        }

        // Notify admin
        try {
          const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
          if (admins?.length) {
            await base44.asServiceRole.entities.Notification.create({
              user_id: admins[0].id,
              type: 'system',
              title: 'Auto-Approved Stake',
              message: `Auto-approved ${position.principal_amount} USDT stake for ${position.user_email}`,
              data: { stakingPositionId: position.id, action: 'auto_approve_success' },
              read: false,
              priority: 'normal'
            });
          }
        } catch (e) {
          console.log(`[STAKING_AUTO_APPROVE] [${runId}] Failed to notify admin:`, e.message);
        }

        posDetail.status = 'approved';
        posDetail.rewardsGranted = totalRewardsGranted;
        result.approvedCount++;
        result.details.push(posDetail);

        console.log(`[STAKING_AUTO_APPROVE] [${runId}] Approved position ${position.id}, rewards: ${totalRewardsGranted}`);

      } catch (err) {
        console.error(`[STAKING_AUTO_APPROVE] [${runId}] Error processing position ${position.id}:`, err.message);
        posDetail.status = 'error';
        posDetail.reason = err.message;
        result.failedCount++;
        result.details.push(posDetail);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[STAKING_AUTO_APPROVE] [${runId}] Completed in ${duration}ms: processed=${result.processedCount}, approved=${result.approvedCount}, skipped=${result.skippedCount}, failed=${result.failedCount}`);

    return Response.json({ ok: true, data: { ...result, durationMs: duration } });

  } catch (error) {
    console.error(`[STAKING_AUTO_APPROVE] [${runId}] Fatal error:`, error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});