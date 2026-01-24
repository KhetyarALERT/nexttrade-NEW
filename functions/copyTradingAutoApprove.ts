// @ts-nocheck
/// <reference lib="deno.ns" />
// Copy Trading Settlement Processor - Runs via automation every 5 minutes
// Handles Step2: Funding(subaccount) → Funding(main) using master API
// Then credits user's internal Copy Trading Wallet
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

async function okxRequest({ credential, method, path, query, body }) {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }
    });
  }

  const base44 = createClientFromRequest(req);
  const runId = crypto.randomUUID().substring(0, 8);
  const startTime = Date.now();

  console.log(`[COPY_TRADING_SETTLEMENT] [${runId}] Starting settlement processor`);

  const result = {
    runId,
    processedCount: 0,
    approvedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    details: []
  };

  try {
    // Load config
    const configs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
    const config = configs?.[0];

    if (!config?.enabled || !config?.auto_approve_enabled) {
      console.log(`[COPY_TRADING_SETTLEMENT] [${runId}] Auto-settlement disabled`);
      return Response.json({ ok: true, data: { ...result, message: 'Auto-settlement disabled' } });
    }

    const {
      auto_approve_max_amount = 1000,
      auto_approve_min_age_minutes = 5,
      require_kyc = true,
      pool_wallet_name = 'Main Copy Trading Pool'
    } = config;

    // Get allocations pending step2 settlement (Funding subaccount → Funding main)
    const pendingAllocations = await base44.asServiceRole.entities.CopyTradingAllocation.filter(
      { status: 'PENDING_SETTLEMENT' },
      'created_at',
      100
    );

    if (!pendingAllocations?.length) {
      console.log(`[COPY_TRADING_SETTLEMENT] [${runId}] No pending settlement allocations`);
      return Response.json({ ok: true, data: { ...result, message: 'No pending settlement allocations' } });
    }

    console.log(`[COPY_TRADING_SETTLEMENT] [${runId}] Found ${pendingAllocations.length} pending settlement allocations`);

    const now = new Date();
    const minAgeMs = auto_approve_min_age_minutes * 60 * 1000;
    const MAX_RETRIES = 5;

    // Get master credentials for step2 transfer
    const masterApiKey = getEnv('OKX_MAIN_API_KEY');
    const masterSecret = getEnv('OKX_MAIN_SECRET');
    const masterPassphrase = getEnv('OKX_MAIN_PASSPHRASE');

    if (!masterApiKey || !masterSecret || !masterPassphrase) {
      console.error(`[COPY_TRADING_SETTLEMENT] [${runId}] Missing master OKX credentials`);
      return Response.json({ ok: false, error: { code: 'CONFIG_ERROR', message: 'Missing OKX master credentials' } }, { status: 500 });
    }

    const masterCredential = { apiKey: masterApiKey, secretKey: masterSecret, passphrase: masterPassphrase };

    // Pre-fetch KYC statuses
    const userKycMap = {};
    if (require_kyc) {
      const userIds = [...new Set(pendingAllocations.map(a => a.user_id))];
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

    // Process each allocation
    for (const allocation of pendingAllocations) {
      result.processedCount++;
      const detail = { id: allocation.id, userEmail: allocation.user_email, amount: allocation.amount, status: 'pending' };

      try {
        // Idempotency check - skip if already has step2_transfer_id
        if (allocation.step2_transfer_id) {
          detail.status = 'skipped';
          detail.reason = 'Already has step2 transfer';
          result.skippedCount++;
          result.details.push(detail);
          continue;
        }

        // Status check
        if (allocation.status !== 'PENDING_SETTLEMENT') {
          detail.status = 'skipped';
          detail.reason = 'Status changed';
          result.skippedCount++;
          result.details.push(detail);
          continue;
        }

        // Amount check
        if (allocation.amount > auto_approve_max_amount) {
          detail.status = 'skipped';
          detail.reason = `Amount ${allocation.amount} exceeds max ${auto_approve_max_amount}`;
          result.skippedCount++;
          result.details.push(detail);
          continue;
        }

        // Age check
        const createdAt = new Date(allocation.created_at || allocation.created_date);
        const ageMs = now.getTime() - createdAt.getTime();
        if (ageMs < minAgeMs) {
          detail.status = 'skipped';
          detail.reason = `Too new: ${Math.round(ageMs / 60000)}min < ${auto_approve_min_age_minutes}min`;
          result.skippedCount++;
          result.details.push(detail);
          continue;
        }

        // KYC check
        if (require_kyc && !userKycMap[allocation.user_id]) {
          detail.status = 'skipped';
          detail.reason = 'KYC not approved';
          result.skippedCount++;
          result.details.push(detail);
          continue;
        }

        // Retry limit check - mark as FAILED after max retries
        if ((allocation.retry_count || 0) >= MAX_RETRIES) {
          await base44.asServiceRole.entities.CopyTradingAllocation.update(allocation.id, {
            status: 'FAILED',
            failed_at: now.toISOString(),
            last_error: 'Max retries exceeded',
            updated_at: now.toISOString()
          });

          // Notify admin and user
          try {
            const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
            if (admins?.length) {
              await base44.asServiceRole.entities.Notification.create({
                user_id: admins[0].id,
                type: 'system',
                title: 'Copy Trading Settlement Failed',
                message: `Settlement failed for ${allocation.user_email}: ${allocation.amount} USDT after ${MAX_RETRIES} retries`,
                data: { allocationId: allocation.id, action: 'copy_trading_settlement_failed' },
                read: false,
                priority: 'high'
              });
            }
            await base44.asServiceRole.entities.Notification.create({
              user_id: allocation.user_id,
              type: 'system',
              title: 'Copy Trading Deposit Failed',
              message: `Your deposit of ${allocation.amount} USDT could not be processed. Please contact support.`,
              data: { allocationId: allocation.id },
              read: false,
              priority: 'high'
            });
          } catch {}

          detail.status = 'failed';
          detail.reason = 'Max retries exceeded - marked as FAILED';
          result.failedCount++;
          result.details.push(detail);
          continue;
        }

        // Get user's OKX account
        const userAccounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({
          user_id: allocation.user_id,
          provider: 'OKX',
          status: 'ACTIVE'
        });

        if (!userAccounts?.length) {
          detail.status = 'skipped';
          detail.reason = 'No active OKX account';
          result.skippedCount++;
          result.details.push(detail);
          continue;
        }

        const account = userAccounts[0];
        const pools = await base44.asServiceRole.entities.OKXSubAccountPool.filter({ id: account.pool_account_id });
        if (!pools?.length) {
          detail.status = 'skipped';
          detail.reason = 'Pool account not found';
          result.skippedCount++;
          result.details.push(detail);
          continue;
        }

        const pool = pools[0];
        const subAccountName = pool.subaccount_name;

        // Verify funding balance in subaccount using pool credentials
        const credential = {
          apiKey: pool.api_key,
          secretKey: await decryptSecret(pool.secret_enc),
          passphrase: await decryptSecret(pool.passphrase_enc)
        };

        const fundingRes = await okxRequest({
          credential,
          method: 'GET',
          path: '/api/v5/asset/balances'
        });

        if (!fundingRes.ok) {
          await base44.asServiceRole.entities.CopyTradingAllocation.update(allocation.id, {
            retry_count: (allocation.retry_count || 0) + 1,
            last_retry_at: now.toISOString(),
            last_error: `Balance check failed: ${fundingRes.error?.okxMsg}`,
            updated_at: now.toISOString()
          });
          detail.status = 'failed';
          detail.reason = `Balance check failed: ${fundingRes.error?.okxMsg}`;
          result.failedCount++;
          result.details.push(detail);
          continue;
        }

        const fundingUsdt = parseFloat((fundingRes.data?.data || []).find(d => d.ccy === 'USDT')?.bal || '0');
        if (fundingUsdt < allocation.amount) {
          detail.status = 'skipped';
          detail.reason = `Insufficient funding balance: ${fundingUsdt} < ${allocation.amount}`;
          result.skippedCount++;
          result.details.push(detail);
          continue;
        }

        // ========== STEP 2: TRANSFER Funding(subaccount) → Funding(main) ==========
        console.log(`[COPY_TRADING_SETTLEMENT] [${runId}] Settling allocation ${allocation.id} - ${subAccountName} → main`);

        // Re-check status
        const freshAllocs = await base44.asServiceRole.entities.CopyTradingAllocation.filter({ id: allocation.id });
        if (!freshAllocs?.length || freshAllocs[0].status !== 'PENDING_SETTLEMENT') {
          detail.status = 'skipped';
          detail.reason = 'Status changed during processing';
          result.skippedCount++;
          result.details.push(detail);
          continue;
        }

        const nowIso = now.toISOString();

        // Create step2 transfer record BEFORE OKX call
        let step2TransferId = null;
        try {
          const step2Transfer = await base44.asServiceRole.entities.ExchangeTransfer.create({
            user_id: allocation.user_id,
            provider: 'OKX',
            from_account: subAccountName,
            from_account_type: 'funding',
            to_account: 'main',
            to_account_type: 'funding',
            currency: 'USDT',
            amount: allocation.amount,
            status: 'PENDING',
            created_at: nowIso
          });
          step2TransferId = step2Transfer?.id;
        } catch (e) {
          console.log(`[COPY_TRADING_SETTLEMENT] [${runId}] Failed to create step2 transfer record:`, e.message);
        }

        // Execute OKX transfer: Funding(subaccount) → Funding(main) using MASTER credentials
        const transferRes = await okxRequest({
          credential: masterCredential,
          method: 'POST',
          path: '/api/v5/asset/transfer',
          body: {
            ccy: 'USDT',
            amt: String(allocation.amount),
            from: '6',  // Funding
            to: '6',    // Funding
            type: '2',  // Sub-account to main (master-initiated)
            subAcct: subAccountName
          }
        });

        const transferResult = transferRes.data?.data?.[0];
        const completedAt = new Date().toISOString();

        if (!transferRes.ok || (transferResult?.code && transferResult.code !== '0')) {
          const errMsg = transferRes.error?.okxMsg || transferResult?.msg || 'Step2 transfer failed';

          if (step2TransferId) {
            await base44.asServiceRole.entities.ExchangeTransfer.update(step2TransferId, {
              status: 'FAILED',
              error_message: errMsg,
              completed_at: completedAt
            });
          }

          await base44.asServiceRole.entities.CopyTradingAllocation.update(allocation.id, {
            retry_count: (allocation.retry_count || 0) + 1,
            last_retry_at: completedAt,
            last_error: errMsg,
            updated_at: completedAt
          });

          detail.status = 'failed';
          detail.reason = errMsg;
          result.failedCount++;
          result.details.push(detail);
          continue;
        }

        // Update step2 transfer to COMPLETED
        if (step2TransferId) {
          await base44.asServiceRole.entities.ExchangeTransfer.update(step2TransferId, {
            status: 'COMPLETED',
            external_transfer_id: transferResult?.transId || null,
            completed_at: completedAt
          });
        }

        // ========== Credit user's Copy Trading Wallet ==========
        let wallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: allocation.user_id });
        let wallet = wallets?.[0];

        if (!wallet) {
          wallet = await base44.asServiceRole.entities.CopyTradingWallet.create({
            user_id: allocation.user_id,
            user_email: allocation.user_email,
            available_balance: 0,
            locked_balance: 0,
            lifetime_deposited: 0,
            lifetime_withdrawn: 0,
            lifetime_pnl: 0,
            status: 'ACTIVE',
            created_at: nowIso,
            updated_at: nowIso
          });
        }

        const balanceBefore = wallet.available_balance || 0;
        const balanceAfter = balanceBefore + allocation.amount;

        // Create ledger entry (idempotent)
        const ledgerKey = `alloc:${allocation.id}:credit`;
        const existingLedger = await base44.asServiceRole.entities.CopyTradingLedger.filter({ idempotency_key: ledgerKey });
        
        if (!existingLedger?.length) {
          await base44.asServiceRole.entities.CopyTradingLedger.create({
            user_id: allocation.user_id,
            kind: 'CREDIT',
            amount: allocation.amount,
            currency: 'USDT',
            status: 'POSTED',
            ref_type: 'ALLOCATION',
            ref_id: allocation.id,
            idempotency_key: ledgerKey,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            description: `Copy trading deposit of ${allocation.amount} USDT settled`,
            meta: { step2_transfer_id: step2TransferId },
            created_at: completedAt
          });
        }

        // Update wallet balance
        await base44.asServiceRole.entities.CopyTradingWallet.update(wallet.id, {
          available_balance: balanceAfter,
          lifetime_deposited: (wallet.lifetime_deposited || 0) + allocation.amount,
          last_activity_at: completedAt,
          updated_at: completedAt
        });

        // Update allocation to ACTIVE with settlement info
        await base44.asServiceRole.entities.CopyTradingAllocation.update(allocation.id, {
          status: 'ACTIVE',
          step2_transfer_id: step2TransferId,
          settled_at: completedAt,
          approved_at: nowIso,
          approved_by: 'AUTOMATION',
          approved_by_type: 'AUTOMATION',
          last_error: null,
          updated_at: completedAt
        });

        // Notify user
        try {
          await base44.asServiceRole.entities.Notification.create({
            user_id: allocation.user_id,
            type: 'system',
            title: 'Copy Trading Deposit Settled! 🎉',
            message: `${allocation.amount} USDT has been credited to your Copy Trading balance.`,
            data: { allocationId: allocation.id, action: 'copy_trading_settled' },
            read: false,
            priority: 'high'
          });
        } catch (e) {
          console.log(`[COPY_TRADING_SETTLEMENT] [${runId}] Failed to notify user:`, e.message);
        }

        detail.status = 'settled';
        result.approvedCount++;
        result.details.push(detail);

        console.log(`[COPY_TRADING_SETTLEMENT] [${runId}] Settled allocation ${allocation.id}`);

      } catch (err) {
        console.error(`[COPY_TRADING_SETTLEMENT] [${runId}] Error processing allocation ${allocation.id}:`, err.message);
        detail.status = 'error';
        detail.reason = err.message;
        result.failedCount++;
        result.details.push(detail);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[COPY_TRADING_SETTLEMENT] [${runId}] Completed in ${duration}ms: processed=${result.processedCount}, settled=${result.approvedCount}, skipped=${result.skippedCount}, failed=${result.failedCount}`);

    return Response.json({ ok: true, data: { ...result, durationMs: duration } });

  } catch (error) {
    console.error(`[COPY_TRADING_SETTLEMENT] [${runId}] Fatal error:`, error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});