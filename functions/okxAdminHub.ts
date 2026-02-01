// @ts-nocheck
/// <reference lib="deno.ns" />
// OKX Admin Hub - v2.0.0 - Self-contained admin endpoints for pool management

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

async function encryptSecret(plaintext) {
  const key = await importAesKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(String(plaintext || '')));
  const encryptedBytes = new Uint8Array(encrypted);
  const tag = encryptedBytes.slice(encryptedBytes.length - 16);
  const ciphertext = encryptedBytes.slice(0, -16);
  return { iv: base64Encode(iv), tag: base64Encode(tag), ciphertext: base64Encode(ciphertext) };
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

function getMasterCredentials() {
  const apiKey = getEnv('OKX_MAIN_API_KEY');
  const secretKey = getEnv('OKX_MAIN_SECRET');
  const passphrase = getEnv('OKX_MAIN_PASSPHRASE');
  if (!apiKey || !secretKey || !passphrase) {
    return { ok: false, error: { code: 'CONFIG_ERROR', message: 'Missing OKX credentials' } };
  }
  return { ok: true, data: { apiKey, secretKey, passphrase } };
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

  if (isTradingEndpoint && String(getEnv('OKX_TRADING_MODE') || '').toLowerCase() === 'demo') {
    headers['x-simulated-trading'] = '1';
  }

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

function auditLog(action, userId, details) {
  console.log(`[OKX_AUDIT] [${new Date().toISOString()}] [${action}] User: ${userId}`, JSON.stringify(details));
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
    if (user.role !== 'admin') return Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    
    let body = {};
    try { body = await req.json(); } catch { return Response.json({ ok: false, error: { code: 'INVALID_JSON' } }, { status: 400 }); }
    
    const { action, ...params } = body || {};
    if (!action) return Response.json({ ok: false, error: { code: 'MISSING_ACTION' } }, { status: 400 });

    console.log('[OKX_ADMIN_HUB] Action:', action, 'User:', user.email);

    const masterCredsResult = getMasterCredentials();
    if (!masterCredsResult.ok) return Response.json(masterCredsResult, { status: 500 });

    // LIST POOL
    if (action === 'listPool') {
      const pool = await base44.asServiceRole.entities.OKXSubAccountPool.filter(params.status ? { status: params.status } : {}, '-created_date', 100);
      return Response.json({ ok: true, data: (pool || []).map(p => ({
        id: p.id, subaccountName: p.subaccount_name, apiKey: p.api_key?.substring(0, 8) + '...', status: p.status,
        permissions: p.permissions, assignedToUserId: p.assigned_to_user_id, assignedAt: p.assigned_at,
        lastBalanceUsdt: p.last_balance_usdt, lastBalanceCheck: p.last_balance_check, notes: p.notes,
        createdAt: p.created_at || p.created_date, updatedAt: p.updated_at,
      })) });
    }

    // DASHBOARD STATS
    if (action === 'getDashboardStats') {
      const [pools, accounts, wds, trs] = await Promise.all([
        base44.asServiceRole.entities.OKXSubAccountPool.filter({}, '-created_date', 1000),
        base44.asServiceRole.entities.UserExchangeAccount.filter({ provider: 'OKX' }, '-created_date', 1000),
        base44.asServiceRole.entities.WithdrawalRequest.filter({ provider: 'OKX' }, '-created_date', 1000),
        base44.asServiceRole.entities.ExchangeTransfer.filter({ provider: 'OKX' }, '-created_date', 1000),
      ]);

      return Response.json({ ok: true, data: {
        pool: {
          total: pools?.length || 0, available: pools?.filter(p => p.status === 'AVAILABLE').length || 0,
          assigned: pools?.filter(p => p.status === 'ASSIGNED').length || 0, error: pools?.filter(p => p.status === 'ERROR').length || 0,
          disabled: pools?.filter(p => p.status === 'DISABLED').length || 0,
          totalBalanceUsdt: pools?.reduce((s, p) => s + (p.last_balance_usdt || 0), 0) || 0,
        },
        accounts: { total: accounts?.length || 0, active: accounts?.filter(a => a.status === 'ACTIVE').length || 0, suspended: accounts?.filter(a => a.status === 'SUSPENDED').length || 0 },
        withdrawals: {
          total: wds?.length || 0, pending: wds?.filter(w => ['PENDING_CONFIRM', 'PENDING_REVIEW', 'PROCESSING'].includes(w.status)).length || 0,
          completed: wds?.filter(w => w.status === 'COMPLETED').length || 0, failed: wds?.filter(w => ['REJECTED', 'FAILED', 'CANCELLED'].includes(w.status)).length || 0,
          totalAmountCompleted: wds?.filter(w => w.status === 'COMPLETED').reduce((s, w) => s + (w.amount || 0), 0) || 0,
        },
        transfers: {
          total: trs?.length || 0, completed: trs?.filter(t => t.status === 'COMPLETED').length || 0,
          totalAmountCompleted: trs?.filter(t => t.status === 'COMPLETED').reduce((s, t) => s + (t.amount || 0), 0) || 0,
        },
      } });
    }

    // ADD TO POOL
    if (action === 'addToPool') {
      const { subaccountName, apiKey, secretKey, passphrase, permissions = ['read', 'trade'], notes = '' } = params;
      if (!subaccountName || !apiKey || !secretKey || !passphrase) return Response.json({ ok: false, error: { code: 'MISSING_FIELDS' } }, { status: 400 });

      const existing = await base44.asServiceRole.entities.OKXSubAccountPool.filter({ subaccount_name: subaccountName });
      if (existing?.length) return Response.json({ ok: false, error: { code: 'EXISTS', message: 'Already in pool' } }, { status: 400 });

      let testOk = false, balanceUsdt = 0, testMsg = '';
      try {
        const res = await okxRequest({ credential: { apiKey, secretKey, passphrase }, method: 'GET', path: '/api/v5/account/balance', isTradingEndpoint: true });
        testOk = res.ok;
        testMsg = res.ok ? 'SUCCESS' : (res.error?.okxMsg || 'FAILED');
        if (res.ok) balanceUsdt = parseFloat(res.data?.data?.[0]?.details?.find(d => d.ccy === 'USDT')?.cashBal || '0');
      } catch (e) { testMsg = e.message; }

      const now = new Date().toISOString();
      const pool = await base44.asServiceRole.entities.OKXSubAccountPool.create({
        subaccount_name: subaccountName, api_key: apiKey,
        secret_enc: await encryptSecret(secretKey), passphrase_enc: await encryptSecret(passphrase),
        permissions, status: testOk ? 'AVAILABLE' : 'ERROR',
        last_balance_usdt: balanceUsdt, last_balance_check: now,
        notes: testOk ? notes : `${notes} | ${testMsg}`, created_at: now, updated_at: now,
      });

      auditLog('POOL_ADD', user.id, { subaccountName, status: pool.status });
      return Response.json({ ok: true, data: { id: pool.id, subaccountName, status: pool.status, balanceUsdt, testResult: testMsg } });
    }

    // CHECK POOL BALANCE
    if (action === 'checkPoolBalance') {
      const { poolAccountId } = params;
      if (!poolAccountId) return Response.json({ ok: false, error: { code: 'MISSING_FIELDS' } }, { status: 400 });

      const pools = await base44.asServiceRole.entities.OKXSubAccountPool.filter({ id: poolAccountId });
      if (!pools?.length) return Response.json({ ok: false, error: { code: 'NOT_FOUND' } }, { status: 404 });

      const p = pools[0];
      const cred = { apiKey: p.api_key, secretKey: await decryptSecret(p.secret_enc), passphrase: await decryptSecret(p.passphrase_enc) };
      const [tradingRes, fundingRes] = await Promise.all([
        okxRequest({ credential: cred, method: 'GET', path: '/api/v5/account/balance', isTradingEndpoint: true }),
        okxRequest({ credential: cred, method: 'GET', path: '/api/v5/asset/balances', isTradingEndpoint: false }),
      ]);

      const tradingUsdt = parseFloat(tradingRes.data?.data?.[0]?.details?.find(d => d.ccy === 'USDT')?.cashBal || '0');
      const fundingUsdt = parseFloat((fundingRes.data?.data || []).find(d => d.ccy === 'USDT')?.bal || '0');
      const totalUsdt = tradingUsdt + fundingUsdt;
      const now = new Date().toISOString();

      await base44.asServiceRole.entities.OKXSubAccountPool.update(poolAccountId, {
        last_balance_usdt: totalUsdt, last_balance_check: now, updated_at: now,
        status: p.assigned_to_user_id ? 'ASSIGNED' : (tradingRes.ok || fundingRes.ok ? 'AVAILABLE' : 'ERROR'),
      });

      return Response.json({ ok: true, data: { tradingUsdt, fundingUsdt, totalUsdt, checkedAt: now } });
    }

    // GET POOL ACCOUNT DETAILS
    if (action === 'getPoolAccountDetails') {
      const { poolAccountId } = params;
      if (!poolAccountId) return Response.json({ ok: false, error: { code: 'MISSING_FIELDS' } }, { status: 400 });

      const pools = await base44.asServiceRole.entities.OKXSubAccountPool.filter({ id: poolAccountId });
      if (!pools?.length) return Response.json({ ok: false, error: { code: 'NOT_FOUND' } }, { status: 404 });

      const p = pools[0];
      const cred = { apiKey: p.api_key, secretKey: await decryptSecret(p.secret_enc), passphrase: await decryptSecret(p.passphrase_enc) };
      const [tradingRes, fundingRes, configRes, posRes] = await Promise.all([
        okxRequest({ credential: cred, method: 'GET', path: '/api/v5/account/balance', isTradingEndpoint: true }),
        okxRequest({ credential: cred, method: 'GET', path: '/api/v5/asset/balances', isTradingEndpoint: false }),
        okxRequest({ credential: cred, method: 'GET', path: '/api/v5/account/config', isTradingEndpoint: true }),
        okxRequest({ credential: cred, method: 'GET', path: '/api/v5/account/positions', isTradingEndpoint: true }),
      ]);

      const trading = (tradingRes.data?.data?.[0]?.details || []).map(d => ({ currency: d.ccy, total: parseFloat(d.cashBal || '0'), available: parseFloat(d.availBal || '0') }));
      const funding = (fundingRes.data?.data || []).map(d => ({ currency: d.ccy, total: parseFloat(d.bal || '0'), available: parseFloat(d.availBal || d.bal || '0') }));
      const tradingUsdt = trading.find(b => b.currency === 'USDT')?.total || 0;
      const fundingUsdt = funding.find(b => b.currency === 'USDT')?.total || 0;
      const config = configRes.data?.data?.[0] || {};
      const positions = (posRes.data?.data || []).filter(pos => parseFloat(pos.pos || '0') !== 0).map(pos => ({
        instId: pos.instId, posSide: pos.posSide, pos: parseFloat(pos.pos), avgPx: parseFloat(pos.avgPx || '0'),
        upl: parseFloat(pos.upl || '0'), lever: parseFloat(pos.lever || '0'),
      }));

      return Response.json({ ok: true, data: {
        poolAccount: { id: p.id, subaccountName: p.subaccount_name, status: p.status, permissions: p.permissions, assignedToUserId: p.assigned_to_user_id },
        balances: { trading, funding, tradingUsdt, fundingUsdt, totalUsdt: tradingUsdt + fundingUsdt, totalEquity: parseFloat(tradingRes.data?.data?.[0]?.totalEq || '0') },
        config: { accountLevel: config.acctLv, posMode: config.posMode, autoLoan: config.autoLoan },
        positions,
      } });
    }

    // GET TRANSACTION HISTORY
    if (action === 'getTransactionHistory') {
      const { poolAccountId, limit = 20 } = params;
      if (!poolAccountId) return Response.json({ ok: false, error: { code: 'MISSING_FIELDS' } }, { status: 400 });

      const pools = await base44.asServiceRole.entities.OKXSubAccountPool.filter({ id: poolAccountId });
      if (!pools?.length) return Response.json({ ok: false, error: { code: 'NOT_FOUND' } }, { status: 404 });

      const p = pools[0];
      const cred = { apiKey: p.api_key, secretKey: await decryptSecret(p.secret_enc), passphrase: await decryptSecret(p.passphrase_enc) };
      const [depRes, wdRes, billRes] = await Promise.all([
        okxRequest({ credential: cred, method: 'GET', path: '/api/v5/asset/deposit-history', query: { limit: String(limit) }, isTradingEndpoint: false }),
        okxRequest({ credential: cred, method: 'GET', path: '/api/v5/asset/withdrawal-history', query: { limit: String(limit) }, isTradingEndpoint: false }),
        okxRequest({ credential: cred, method: 'GET', path: '/api/v5/account/bills', query: { limit: String(limit) }, isTradingEndpoint: true }),
      ]);

      return Response.json({ ok: true, data: {
        deposits: (depRes.data?.data || []).map(d => ({ txId: d.txId, chain: d.chain, currency: d.ccy, amount: parseFloat(d.amt || '0'), state: d.state, ts: d.ts })),
        withdrawals: (wdRes.data?.data || []).map(w => ({ wdId: w.wdId, txId: w.txId, chain: w.chain, currency: w.ccy, amount: parseFloat(w.amt || '0'), fee: parseFloat(w.fee || '0'), to: w.to, state: w.state, ts: w.ts })),
        bills: (billRes.data?.data || []).map(b => ({ billId: b.billId, instId: b.instId, subType: b.subType, currency: b.ccy, balChg: parseFloat(b.balChg || '0'), ts: b.ts })),
      } });
    }

    // ASSIGN TO USER
    if (action === 'assignToUser') {
      const { poolAccountId, userId } = params;
      if (!poolAccountId || !userId) return Response.json({ ok: false, error: { code: 'MISSING_FIELDS' } }, { status: 400 });

      const pools = await base44.asServiceRole.entities.OKXSubAccountPool.filter({ id: poolAccountId });
      if (!pools?.length) return Response.json({ ok: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
      const p = pools[0];
      if (p.status === 'ASSIGNED') return Response.json({ ok: false, error: { code: 'ALREADY_ASSIGNED' } }, { status: 400 });

      const users = await base44.asServiceRole.entities.User.filter({ id: userId });
      if (!users?.length) return Response.json({ ok: false, error: { code: 'USER_NOT_FOUND' } }, { status: 404 });

      const existingAccounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({ user_id: userId, provider: 'OKX' });
      if (existingAccounts?.some(a => a.status === 'ACTIVE')) return Response.json({ ok: false, error: { code: 'USER_HAS_ACCOUNT' } }, { status: 400 });

      const now = new Date().toISOString();
      const acc = await base44.asServiceRole.entities.UserExchangeAccount.create({
        user_id: userId, user_email: users[0].email, pool_account_id: poolAccountId, provider: 'OKX',
        external_account_id: p.subaccount_name, account_label: p.subaccount_name, status: 'ACTIVE',
        account_mode: 'futures', margin_mode: 'cross', default_leverage: 10, created_at: now, updated_at: now,
      });

      await base44.asServiceRole.entities.ExchangeCredential.create({
        user_id: userId, user_exchange_account_id: acc.id, pool_account_id: poolAccountId, provider: 'OKX',
        api_key: p.api_key, secret_enc: p.secret_enc, passphrase_enc: p.passphrase_enc,
        permissions: p.permissions || ['read', 'trade'], status: 'ACTIVE', created_at: now, updated_at: now,
      });

      await base44.asServiceRole.entities.OKXSubAccountPool.update(poolAccountId, {
        status: 'ASSIGNED', assigned_to_user_id: userId, assigned_to_account_id: acc.id, assigned_at: now, updated_at: now,
      });

      // Create notification for user about trading account approval
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_id: userId,
          type: 'system',
          title: 'Trading Account Approved! 🎉',
          message: 'Your live trading account has been approved and is ready to use. Deposit funds to start trading!',
          data: { 
            action: 'trading_account_approved',
            link: '/Profile?tab=accounts'
          },
          read: false,
          priority: 'high'
        });
      } catch (e) {
        console.error('Failed to create notification:', e);
      }

      auditLog('POOL_ASSIGN', user.id, { poolAccountId, userId });
      return Response.json({ ok: true, data: { exchangeAccountId: acc.id, userId, userEmail: users[0].email, subaccountName: p.subaccount_name } });
    }

    // UNASSIGN FROM USER
    if (action === 'unassignFromUser') {
      const { poolAccountId } = params;
      if (!poolAccountId) return Response.json({ ok: false, error: { code: 'MISSING_FIELDS' } }, { status: 400 });

      const pools = await base44.asServiceRole.entities.OKXSubAccountPool.filter({ id: poolAccountId });
      if (!pools?.length) return Response.json({ ok: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
      const p = pools[0];
      if (p.status !== 'ASSIGNED') return Response.json({ ok: false, error: { code: 'NOT_ASSIGNED' } }, { status: 400 });

      const now = new Date().toISOString();
      if (p.assigned_to_account_id) {
        await base44.asServiceRole.entities.UserExchangeAccount.update(p.assigned_to_account_id, { status: 'SUSPENDED', updated_at: now });
        const creds = await base44.asServiceRole.entities.ExchangeCredential.filter({ user_exchange_account_id: p.assigned_to_account_id });
        for (const c of creds || []) await base44.asServiceRole.entities.ExchangeCredential.update(c.id, { status: 'REVOKED', updated_at: now });
      }

      await base44.asServiceRole.entities.OKXSubAccountPool.update(poolAccountId, {
        status: 'AVAILABLE', assigned_to_user_id: null, assigned_to_account_id: null, assigned_at: null, updated_at: now,
      });

      auditLog('POOL_UNASSIGN', user.id, { poolAccountId });
      return Response.json({ ok: true, data: { poolAccountId, status: 'AVAILABLE' } });
    }

    // LIST USERS
    if (action === 'listUsers') {
      const allUsers = await base44.asServiceRole.entities.User.filter({}, '-created_date', 100);
      const accounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({ provider: 'OKX' });
      const accMap = {};
      for (const a of accounts || []) accMap[a.user_id] = a;

      return Response.json({ ok: true, data: (allUsers || []).map(u => ({
        id: u.id, email: u.email, fullName: u.full_name, role: u.role,
        hasOkxAccount: !!accMap[u.id], okxAccountStatus: accMap[u.id]?.status || null, okxAccountId: accMap[u.id]?.id || null,
        createdAt: u.created_date,
      })) });
    }

    // LIST USER ACCOUNTS
    if (action === 'listUserAccounts') {
      const accounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({ provider: 'OKX' }, '-created_date', 100);
      return Response.json({ ok: true, data: (accounts || []).map(a => ({
        id: a.id, userId: a.user_id, userEmail: a.user_email, poolAccountId: a.pool_account_id,
        externalAccountId: a.external_account_id, accountLabel: a.account_label, status: a.status,
        lastBalanceUsdt: a.last_balance_usdt, createdAt: a.created_at || a.created_date, updatedAt: a.updated_at,
      })) });
    }

    // LIST WITHDRAWALS
    if (action === 'listWithdrawals') {
      const wds = await base44.asServiceRole.entities.WithdrawalRequest.filter({ provider: 'OKX' }, '-created_date', params.limit || 50);
      return Response.json({ ok: true, data: (wds || []).map(w => ({
        id: w.id, userId: w.user_id, userEmail: w.user_email, currency: w.currency, chain: w.chain,
        address: w.address, amount: w.amount, fee: w.fee, status: w.status, txHash: w.tx_hash,
        createdAt: w.created_at || w.created_date, completedAt: w.completed_at,
      })) });
    }

    // LIST TRANSFERS
    if (action === 'listTransfers') {
      const trs = await base44.asServiceRole.entities.ExchangeTransfer.filter({ provider: 'OKX' }, '-created_date', params.limit || 50);
      return Response.json({ ok: true, data: (trs || []).map(t => ({
        id: t.id, userId: t.user_id, fromAccount: t.from_account, fromAccountType: t.from_account_type,
        toAccount: t.to_account, toAccountType: t.to_account_type,
        currency: t.currency, amount: t.amount, status: t.status, 
        externalTransferId: t.external_transfer_id, errorMessage: t.error_message,
        createdAt: t.created_at || t.created_date, completedAt: t.completed_at,
      })) });
    }

    // LIST ACCOUNT REQUESTS
    if (action === 'listAccountRequests') {
      const requests = await base44.asServiceRole.entities.LiveAccountRequest.filter({}, '-created_date', params.limit || 100);
      return Response.json({ ok: true, data: requests || [] });
    }

    // ADMIN TRANSFER
    if (action === 'adminTransfer') {
      const { direction, poolAccountId, currency = 'USDT', amount } = params;
      if (!direction || !poolAccountId || !amount || amount <= 0) return Response.json({ ok: false, error: { code: 'MISSING_FIELDS' } }, { status: 400 });
      if (!['toSub', 'toMain'].includes(direction)) return Response.json({ ok: false, error: { code: 'INVALID_DIRECTION' } }, { status: 400 });

      const pools = await base44.asServiceRole.entities.OKXSubAccountPool.filter({ id: poolAccountId });
      if (!pools?.length) return Response.json({ ok: false, error: { code: 'NOT_FOUND' } }, { status: 404 });

      const res = await okxRequest({
        credential: masterCredsResult.data, method: 'POST', path: '/api/v5/asset/transfer', isTradingEndpoint: false,
        body: { ccy: currency, amt: String(amount), from: '6', to: '6', type: direction === 'toSub' ? '1' : '2', subAcct: pools[0].subaccount_name },
      });

      const now = new Date().toISOString();
      const tr = await base44.asServiceRole.entities.ExchangeTransfer.create({
        user_id: pools[0].assigned_to_user_id || 'ADMIN', provider: 'OKX',
        from_account: direction === 'toSub' ? 'main' : pools[0].subaccount_name, from_account_type: 'funding',
        to_account: direction === 'toSub' ? pools[0].subaccount_name : 'main', to_account_type: 'funding',
        currency, amount, status: res.ok ? 'COMPLETED' : 'FAILED',
        external_transfer_id: res.data?.data?.[0]?.transId || null,
        error_message: res.ok ? null : (res.error?.okxMsg || 'Failed'), created_at: now, completed_at: res.ok ? now : null,
      });

      auditLog('ADMIN_TRANSFER', user.id, { direction, poolAccountId, amount, status: tr.status });
      if (!res.ok) return Response.json({ ok: false, error: { code: 'TRANSFER_FAILED', message: res.error?.okxMsg || 'Failed' } }, { status: 502 });
      return Response.json({ ok: true, data: { transferId: tr.id, status: 'COMPLETED', direction, amount } });
    }
    
    // ==================== STAKING ADMIN ACTIONS ====================

    // LIST STAKING REQUESTS - Pending approval
    if (action === 'listStakingRequests') {
      const statusFilter = params.status || 'PENDING_APPROVAL';
      const positions = await base44.asServiceRole.entities.StakingPosition.filter(
        statusFilter === 'all' ? {} : { status: statusFilter },
        '-created_date',
        params.limit || 100
      );

      // Enrich with user info
      const userIds = [...new Set((positions || []).map(p => p.user_id))];
      const usersMap = {};
      for (const uid of userIds) {
        try {
          const u = await base44.asServiceRole.entities.User.filter({ id: uid });
          if (u?.length) usersMap[uid] = u[0];
        } catch { /* ignore */ }
      }

      return Response.json({
        ok: true,
        data: (positions || []).map(p => ({
          id: p.id,
          userId: p.user_id,
          userEmail: p.user_email || usersMap[p.user_id]?.email,
          userFullName: usersMap[p.user_id]?.full_name,
          planKey: p.plan_key,
          principal: p.principal_amount,
          currency: p.currency || 'USDT',
          apyPercent: p.apy_percent,
          termDays: p.term_days,
          baseRewardsPerDollar: p.base_rewards_per_dollar || 0,
          rewardsGranted: p.rewards_granted || 0,
          firstStakeBonusApplied: p.first_stake_bonus_applied || false,
          destinationPool: p.destination_pool,
          approvedByType: p.approved_by_type || (p.approved_by ? 'ADMIN' : null),
          approvalNote: p.approval_note,
          status: p.status,
          lockTransferId: p.lock_transfer_id,
          stakeTransferId: p.stake_transfer_id,
          startedAt: p.started_at,
          endsAt: p.ends_at,
          approvedBy: p.approved_by,
          approvedAt: p.approved_at,
          rejectReason: p.reject_reason,
          notes: p.notes,
          createdAt: p.created_at || p.created_date,
          updatedAt: p.updated_at
        }))
      });
    }

    // STAKING DASHBOARD STATS
    if (action === 'getStakingStats') {
      const positions = await base44.asServiceRole.entities.StakingPosition.filter({}, '-created_date', 1000);
      
      const pending = (positions || []).filter(p => p.status === 'PENDING_APPROVAL');
      const active = (positions || []).filter(p => p.status === 'ACTIVE');
      const completed = (positions || []).filter(p => p.status === 'COMPLETED');
      const rejected = (positions || []).filter(p => p.status === 'REJECTED' || p.status === 'CANCELLED');

      const totalStakedActive = active.reduce((sum, p) => sum + (p.principal_amount || 0), 0);
      const totalStakedPending = pending.reduce((sum, p) => sum + (p.principal_amount || 0), 0);
      const totalRewardsGranted = (positions || []).reduce((sum, p) => sum + (p.rewards_granted || 0), 0);

      return Response.json({
        ok: true,
        data: {
          total: positions?.length || 0,
          pending: pending.length,
          active: active.length,
          completed: completed.length,
          rejected: rejected.length,
          totalStakedActive,
          totalStakedPending,
          totalStaked: totalStakedActive + totalStakedPending,
          totalRewardsGranted
        }
      });
    }

    // APPROVE STAKE
    if (action === 'approveStake') {
      const { stakingId, destinationPool = 'Main Staking Pool', adminNote } = params;
      if (!stakingId) return Response.json({ ok: false, error: { code: 'MISSING_STAKING_ID' } }, { status: 400 });

      const positions = await base44.asServiceRole.entities.StakingPosition.filter({ id: stakingId });
      if (!positions?.length) return Response.json({ ok: false, error: { code: 'NOT_FOUND' } }, { status: 404 });

      const position = positions[0];
      if (position.status !== 'PENDING_APPROVAL') {
        return Response.json({ ok: false, error: { code: 'INVALID_STATUS', message: `Cannot approve position with status: ${position.status}` } }, { status: 400 });
      }

      // Default source_account if missing
      if (!position.source_account) position.source_account = 'MAIN';

      // Load staking config for first-stake promo
      let stakingConfig = null;
      try {
        const configs = await base44.asServiceRole.entities.StakingConfig.filter({ config_key: 'default' });
        if (configs?.length) stakingConfig = configs[0];
      } catch (e) {
        console.log('[STAKING_ADMIN] Failed to load staking config:', e.message);
      }

      // Calculate bonus rewards
      const baseRewardsPerDollar = position.base_rewards_per_dollar || 10;
      let baseRewards = Math.round(position.principal_amount * baseRewardsPerDollar);
      let firstStakeBonus = 0;
      let firstStakeBonusApplied = false;

      // Check first-stake eligibility
      if (stakingConfig?.first_stake_enabled) {
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
            position.term_days >= (stakingConfig.first_stake_min_term_days || 60) &&
            position.principal_amount >= (stakingConfig.first_stake_min_amount || 100)) {
          
          const eligibleAmount = Math.min(position.principal_amount, stakingConfig.first_stake_cap_principal || 300);
          const bonusMultiplier = (stakingConfig.first_stake_bonus_multiplier || 1.5) - 1;
          firstStakeBonus = Math.round(eligibleAmount * baseRewardsPerDollar * bonusMultiplier);
          firstStakeBonusApplied = true;
          console.log('[STAKING_ADMIN] First-stake bonus applied:', firstStakeBonus);
        }
      }

      const totalRewardsGranted = baseRewards + firstStakeBonus;

      // Get user's OKX credentials via pool account
      const accounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({
        user_id: position.user_id,
        provider: 'OKX',
        status: 'ACTIVE'
      });

      if (!accounts?.length) {
        return Response.json({ ok: false, error: { code: 'NO_USER_ACCOUNT', message: 'User has no active OKX account' } }, { status: 400 });
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const endsAt = new Date(now.getTime() + position.term_days * 24 * 60 * 60 * 1000).toISOString();
      let stakeTransferId = null;

      if (position.source_account === 'COPY_TRADING') {
        // === COPY TRADING APPROVAL FLOW ===
        const wallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: position.user_id });
        const wallet = wallets?.[0];
        
        if (!wallet) return Response.json({ ok: false, error: { code: 'NO_WALLET', message: 'Wallet not found' } }, { status: 400 });
        if (wallet.available_balance < position.principal_amount) {
          return Response.json({ ok: false, error: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds in copy trading wallet' } }, { status: 400 });
        }

        const idempotencyKey = `stake_lock:${position.id}`;
        
        // Lock funds
        await base44.asServiceRole.entities.CopyTradingWallet.update(wallet.id, {
          available_balance: wallet.available_balance - position.principal_amount,
          locked_balance: wallet.locked_balance + position.principal_amount,
          updated_at: nowIso
        });

        // Ledger entry
        await base44.asServiceRole.entities.CopyTradingLedger.create({
          user_id: position.user_id,
          kind: 'STAKING_LOCK',
          amount: -position.principal_amount,
          currency: 'USDT',
          status: 'POSTED',
          ref_type: 'STAKING',
          ref_id: position.id,
          idempotency_key: idempotencyKey,
          balance_before: wallet.available_balance,
          balance_after: wallet.available_balance - position.principal_amount,
          description: `Locked for staking (${position.plan_key})`,
          created_at: nowIso
        });

      } else {
        // === MAIN (OKX) APPROVAL FLOW ===
        const account = accounts[0];
        const pool = await base44.asServiceRole.entities.OKXSubAccountPool.filter({ id: account.pool_account_id });
        if (!pool?.length) {
          return Response.json({ ok: false, error: { code: 'NO_POOL_ACCOUNT', message: 'Pool account not found' } }, { status: 500 });
        }

        const p = pool[0];
        const credential = {
          apiKey: p.api_key,
          secretKey: await decryptSecret(p.secret_enc),
          passphrase: await decryptSecret(p.passphrase_enc)
        };

        // Transfer from user's Funding to Main (master) staking pool
        try {
          const stakeTransfer = await base44.asServiceRole.entities.ExchangeTransfer.create({
            user_id: position.user_id,
            provider: 'OKX',
            from_account: p.subaccount_name,
            from_account_type: 'funding',
            to_account: 'main',
            to_account_type: 'funding',
            currency: 'USDT',
            amount: position.principal_amount,
            status: 'PENDING',
            created_at: nowIso
          });
          stakeTransferId = stakeTransfer?.id;
          console.log('[STAKING_ADMIN] Created stake transfer record:', stakeTransferId);
        } catch (e) {
          console.log('[STAKING_ADMIN] Failed to create stake transfer record:', e.message);
        }

        // Execute transfer using MASTER credentials (sub -> master)
        const masterCreds = getMasterCredentials();
        if (!masterCreds.ok) {
          return Response.json({ ok: false, error: masterCreds.error }, { status: 500 });
        }

        const transferRes = await okxRequest({
          credential: masterCreds.data,
          method: 'POST',
          path: '/api/v5/asset/transfer',
          body: {
            ccy: 'USDT',
            amt: String(position.principal_amount),
            from: '6',      // Funding
            to: '6',        // Funding
            type: '2',      // Sub-account to master
            subAcct: p.subaccount_name
          },
          isTradingEndpoint: false
        });

        const completedAt = new Date().toISOString();
        const transferResult = transferRes.data?.data?.[0];

        if (!transferRes.ok || (transferResult?.code && transferResult.code !== '0')) {
          const errMsg = transferRes.error?.okxMsg || transferResult?.msg || 'Stake transfer failed';
          
          if (stakeTransferId) {
            try {
              await base44.asServiceRole.entities.ExchangeTransfer.update(stakeTransferId, {
                status: 'FAILED',
                error_message: errMsg,
                completed_at: completedAt
              });
            } catch (e) {
              console.log('[STAKING_ADMIN] Failed to update stake transfer to FAILED:', e.message);
            }
          }
          
          return Response.json({ ok: false, error: { code: 'STAKE_TRANSFER_FAILED', message: errMsg } }, { status: 500 });
        }

        // Update transfer to COMPLETED
        if (stakeTransferId) {
          try {
            await base44.asServiceRole.entities.ExchangeTransfer.update(stakeTransferId, {
              status: 'COMPLETED',
              external_transfer_id: transferResult?.transId || null,
              completed_at: completedAt
            });
          } catch (e) {
            console.log('[STAKING_ADMIN] Failed to update stake transfer to COMPLETED:', e.message);
          }
        }
      }

      // Update position to ACTIVE with rewards
      await base44.asServiceRole.entities.StakingPosition.update(stakingId, {
        status: 'ACTIVE',
        stake_transfer_id: stakeTransferId,
        destination_pool: destinationPool,
        rewards_granted: totalRewardsGranted,
        first_stake_bonus_applied: firstStakeBonusApplied,
        first_stake_bonus_amount: firstStakeBonus,
        started_at: nowIso,
        ends_at: endsAt,
        approved_by: user.email,
        approved_by_type: 'ADMIN',
        approved_at: nowIso,
        approval_note: adminNote || 'Manual approval by admin',
        notes: adminNote || null,
        updated_at: nowIso
      });

      // Notify user
      try {
        const rewardsMsg = totalRewardsGranted > 0 ? ` +${totalRewardsGranted} Bonus Rewards earned!` : '';
        await base44.asServiceRole.entities.Notification.create({
          user_id: position.user_id,
          type: 'staking_reward',
          title: 'Stake Activated! 🎉',
          message: `Your ${position.principal_amount} USDT stake has been activated. Earning ${position.apy_percent}% APY for ${position.term_days} days.${rewardsMsg}`,
          data: { stakingPositionId: stakingId, action: 'stake_activated', rewardsGranted: totalRewardsGranted },
          read: false,
          priority: 'high'
        });
      } catch (e) {
        console.log('[STAKING_ADMIN] Failed to notify user:', e.message);
      }

      auditLog('STAKE_APPROVE', user.id, { stakingId, userId: position.user_id, amount: position.principal_amount, rewardsGranted: totalRewardsGranted, firstStakeBonus });

      return Response.json({
        ok: true,
        data: {
          stakingId,
          status: 'ACTIVE',
          startedAt: nowIso,
          endsAt,
          stakeTransferId,
          rewardsGranted: totalRewardsGranted,
          firstStakeBonusApplied,
          firstStakeBonus
        }
      });
    }

    // RETRY STAKE TRANSFER (idempotent)
    if (action === 'retryStakeTransfer') {
      const { stakingId } = params;
      if (!stakingId) return Response.json({ ok: false, error: { code: 'MISSING_STAKING_ID' } }, { status: 400 });

      const positions = await base44.asServiceRole.entities.StakingPosition.filter({ id: stakingId });
      if (!positions?.length) return Response.json({ ok: false, error: { code: 'NOT_FOUND' } }, { status: 404 });

      const position = positions[0];
      
      // Only allow retry for pending positions with a failed or missing transfer
      if (position.status !== 'PENDING_APPROVAL') {
        return Response.json({ ok: false, error: { code: 'INVALID_STATUS', message: 'Can only retry pending approvals' } }, { status: 400 });
      }

      // Just re-trigger approve logic
      auditLog('STAKE_RETRY_TRANSFER', user.id, { stakingId });
      return Response.json({ ok: true, data: { message: 'Use approveStake action to complete' } });
    }

    // ADJUST STAKE REWARDS (admin override)
    if (action === 'adjustStakeRewards') {
      const { stakingId, adjustment, reason } = params;
      if (!stakingId || adjustment === undefined) {
        return Response.json({ ok: false, error: { code: 'MISSING_FIELDS' } }, { status: 400 });
      }

      const positions = await base44.asServiceRole.entities.StakingPosition.filter({ id: stakingId });
      if (!positions?.length) return Response.json({ ok: false, error: { code: 'NOT_FOUND' } }, { status: 404 });

      const position = positions[0];
      const currentRewards = position.rewards_granted || 0;
      const newRewards = Math.max(0, currentRewards + Number(adjustment));
      const nowIso = new Date().toISOString();

      await base44.asServiceRole.entities.StakingPosition.update(stakingId, {
        rewards_granted: newRewards,
        notes: `${position.notes || ''}\n[${nowIso}] Rewards adjusted by ${adjustment} (${reason || 'Admin'}). New total: ${newRewards}`.trim(),
        updated_at: nowIso
      });

      auditLog('STAKE_ADJUST_REWARDS', user.id, { stakingId, adjustment, reason, oldRewards: currentRewards, newRewards });

      return Response.json({
        ok: true,
        data: {
          stakingId,
          previousRewards: currentRewards,
          adjustment: Number(adjustment),
          newRewards
        }
      });
    }

    // REJECT STAKE - Unlock funds back to user's trading account
    if (action === 'rejectStake') {
      const { stakingId, reason } = params;
      if (!stakingId) return Response.json({ ok: false, error: { code: 'MISSING_STAKING_ID' } }, { status: 400 });

      const positions = await base44.asServiceRole.entities.StakingPosition.filter({ id: stakingId });
      if (!positions?.length) return Response.json({ ok: false, error: { code: 'NOT_FOUND' } }, { status: 404 });

      const position = positions[0];
      if (position.status !== 'PENDING_APPROVAL') {
        return Response.json({ ok: false, error: { code: 'INVALID_STATUS', message: `Cannot reject position with status: ${position.status}` } }, { status: 400 });
      }

      // Get user's OKX credentials
      const accounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({
        user_id: position.user_id,
        provider: 'OKX',
        status: 'ACTIVE'
      });

      if (!accounts?.length) {
        // Just mark as rejected if no account found
        await base44.asServiceRole.entities.StakingPosition.update(stakingId, {
          status: 'REJECTED',
          reject_reason: reason || 'Rejected by admin',
          notes: 'No OKX account found for refund',
          updated_at: new Date().toISOString()
        });
        return Response.json({ ok: true, data: { stakingId, status: 'REJECTED', fundsReturned: false } });
      }

      const account = accounts[0];
      const pool = await base44.asServiceRole.entities.OKXSubAccountPool.filter({ id: account.pool_account_id });
      if (!pool?.length) {
        await base44.asServiceRole.entities.StakingPosition.update(stakingId, {
          status: 'REJECTED',
          reject_reason: reason || 'Rejected by admin',
          notes: 'Pool account not found for refund',
          updated_at: new Date().toISOString()
        });
        return Response.json({ ok: true, data: { stakingId, status: 'REJECTED', fundsReturned: false } });
      }

      const p = pool[0];
      const credential = {
        apiKey: p.api_key,
        secretKey: await decryptSecret(p.secret_enc),
        passphrase: await decryptSecret(p.passphrase_enc)
      };

      const nowIso = new Date().toISOString();

      let unlockTransferId = null;
      let fundsReturned = false;
      let completedAt = new Date().toISOString();

      if (position.source_account === 'COPY_TRADING') {
        // === COPY TRADING REJECT FLOW (No transfer, just unlock) ===
        // Wait, for COPY TRADING we *didn't* lock funds yet on create request.
        // So for REJECT on PENDING_APPROVAL, we do nothing to funds (since they weren't locked).
        // Only if it was ACTIVE/UNLOCKING would we need to refund.
        // The check above says status must be PENDING_APPROVAL.
        fundsReturned = true; // Nothing was taken
        
      } else {
        // === MAIN (OKX) REJECT FLOW ===
        // Funds were moved Trading -> Funding on create. We move them back Funding -> Trading.
        
        try {
          const unlockTransfer = await base44.asServiceRole.entities.ExchangeTransfer.create({
            user_id: position.user_id,
            provider: 'OKX',
            from_account: p.subaccount_name,
            from_account_type: 'funding',
            to_account: p.subaccount_name,
            to_account_type: 'trading',
            currency: 'USDT',
            amount: position.principal_amount,
            status: 'PENDING',
            created_at: nowIso
          });
          unlockTransferId = unlockTransfer?.id;
        } catch (e) {
          console.log('[STAKING_ADMIN] Failed to create unlock transfer record:', e.message);
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

        completedAt = new Date().toISOString();
        fundsReturned = transferRes.ok;

        if (unlockTransferId) {
          try {
            await base44.asServiceRole.entities.ExchangeTransfer.update(unlockTransferId, {
              status: fundsReturned ? 'COMPLETED' : 'FAILED',
              external_transfer_id: transferRes.data?.data?.[0]?.transId || null,
              error_message: fundsReturned ? null : (transferRes.error?.okxMsg || 'Failed'),
              completed_at: completedAt
            });
          } catch (e) {
            console.log('[STAKING_ADMIN] Failed to update unlock transfer:', e.message);
          }
        }
      }

      // Update position to REJECTED
      await base44.asServiceRole.entities.StakingPosition.update(stakingId, {
        status: 'REJECTED',
        unlock_transfer_id: unlockTransferId,
        reject_reason: reason || 'Rejected by admin',
        notes: fundsReturned ? 'Funds returned to trading account' : 'Funds return failed',
        updated_at: completedAt
      });

      // Notify user
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_id: position.user_id,
          type: 'system',
          title: 'Stake Request Rejected',
          message: reason || 'Your staking request was not approved. Funds have been returned to your trading account.',
          data: { stakingPositionId: stakingId, action: 'stake_rejected' },
          read: false,
          priority: 'normal'
        });
      } catch (e) {
        console.log('[STAKING_ADMIN] Failed to notify user:', e.message);
      }

      auditLog('STAKE_REJECT', user.id, { stakingId, userId: position.user_id, reason, fundsReturned });

      return Response.json({
        ok: true,
        data: {
          stakingId,
          status: 'REJECTED',
          fundsReturned,
          unlockTransferId
        }
      });
    }

    return Response.json({ ok: false, error: { code: 'INVALID_ACTION', message: 'Invalid action' } }, { status: 400 });
    
  } catch (error) {
    console.error('[OKX_ADMIN_HUB_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});