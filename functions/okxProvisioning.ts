// @ts-nocheck
/// <reference lib="deno.ns" />
// OKX Provisioning - Sub-accounts, API keys, pool management v2

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import {
  auditLog,
  decryptSecret,
  encryptSecret,
  generateSubAcctName,
  getMasterCredentials,
  okResponse,
  okxRequest,
} from './okxCore.ts';

async function loadCredential(base44, account) {
  const credentials = await base44.asServiceRole.entities.ExchangeCredential.filter({
    user_exchange_account_id: account.id,
    provider: 'OKX',
    status: 'ACTIVE',
  });

  if (credentials?.length) {
    const cred = credentials[0];
    if (cred.secret_enc || cred.passphrase_enc) {
      return okResponse(true, cred);
    }
  }

  const metadata = account.metadata || {};
  if (metadata.okx_api_key && metadata.okx_api_secret && metadata.okx_api_passphrase) {
    const secretEnc = await encryptSecret(metadata.okx_api_secret);
    const passphraseEnc = await encryptSecret(metadata.okx_api_passphrase);
    const nowISO = new Date().toISOString();

    const created = await base44.asServiceRole.entities.ExchangeCredential.create({
      user_id: account.user_id,
      user_exchange_account_id: account.id,
      provider: 'OKX',
      api_key: metadata.okx_api_key,
      secret_enc: secretEnc,
      passphrase_enc: passphraseEnc,
      permissions_json: JSON.stringify(metadata.okx_permissions || ['read_only', 'trade']),
      status: 'ACTIVE',
      created_at: nowISO,
    });

    const cleanedMetadata = { ...metadata };
    delete cleanedMetadata.okx_api_secret;
    delete cleanedMetadata.okx_api_passphrase;
    delete cleanedMetadata.okx_api_key;
    delete cleanedMetadata.okx_permissions;

    await base44.asServiceRole.entities.UserExchangeAccount.update(account.id, {
      metadata: cleanedMetadata,
    });

    return okResponse(true, created);
  }

  return okResponse(false, null, { code: 'NO_CREDENTIALS', message: 'Account credentials not found' });
}

async function buildOkxCredential(credential) {
  const secretKey = await decryptSecret(credential.secret_enc || credential.secretEnc);
  const passphrase = await decryptSecret(credential.passphrase_enc || credential.passphraseEnc);
  return {
    apiKey: credential.api_key || credential.apiKey,
    secretKey,
    passphrase,
  };
}

async function fetchDepositAddresses(base44, exchangeAccount, credential) {
  const addresses = {};
  const currencies = ['USDT', 'BTC', 'ETH'];

  for (const ccy of currencies) {
    const result = await okxRequest({
      credential,
      method: 'GET',
      path: '/api/v5/asset/deposit-address',
      query: { ccy },
      isTradingEndpoint: false,
    });

    if (result.ok && result.data?.data?.length) {
      addresses[ccy] = result.data.data.map((d) => ({
        chain: d.chain || d.ccy,
        address: d.addr,
        tag: d.tag || d.memo || null,
        to: d.to,
        selected: d.selected,
      }));
    } else if (!result.ok) {
      addresses[ccy] = { error: result.error?.okxMsg || result.error?.okxCode || 'FAILED' };
    }
  }

  await base44.asServiceRole.entities.UserExchangeAccount.update(exchangeAccount.id, {
    deposit_addresses_json: addresses,
    deposit_addresses_fetched_at: new Date().toISOString(),
  });

  return addresses;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }
    });
  }
  
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    
    let body = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, { status: 400 });
    }
    
    const { action, ...params } = body || {};
    
    if (!action) {
      return Response.json({ ok: false, error: { code: 'MISSING_ACTION', message: 'action parameter required' } }, { status: 400 });
    }

    console.log('[OKX_PROVISION] Action:', action, 'User:', user.id, 'Role:', user.role);
    
    const masterCredsResult = getMasterCredentials();
    if (!masterCredsResult.ok) {
      return Response.json(masterCredsResult, { status: 500 });
    }

    // ==================== ADMIN: LIST POOL ====================
    if (action === 'adminListPool') {
      if (user.role !== 'admin') return Response.json({ ok: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
      const pool = await base44.asServiceRole.entities.OKXSubAccountPool.filter(params.status ? { status: params.status } : {}, '-created_date', 100);
      return Response.json({ ok: true, data: (pool || []).map(p => ({
        id: p.id, subaccountName: p.subaccount_name, apiKey: p.api_key?.substring(0, 8) + '...', status: p.status,
        permissions: p.permissions, assignedToUserId: p.assigned_to_user_id, assignedAt: p.assigned_at,
        lastBalanceUsdt: p.last_balance_usdt, lastBalanceCheck: p.last_balance_check, notes: p.notes,
        createdAt: p.created_at || p.created_date, updatedAt: p.updated_at,
      })) });
    }

    // ==================== ADMIN: DASHBOARD STATS ====================
    if (action === 'adminDashboardStats') {
      if (user.role !== 'admin') return Response.json({ ok: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
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
          totalBalanceUsdt: pools?.reduce((s, p) => s + (p.last_balance_usdt || 0), 0) || 0,
        },
        accounts: { total: accounts?.length || 0, active: accounts?.filter(a => a.status === 'ACTIVE').length || 0, suspended: accounts?.filter(a => a.status === 'SUSPENDED').length || 0 },
        withdrawals: {
          total: wds?.length || 0, pending: wds?.filter(w => ['PENDING_CONFIRM', 'PENDING_REVIEW', 'PROCESSING'].includes(w.status)).length || 0,
          completed: wds?.filter(w => w.status === 'COMPLETED').length || 0,
          totalAmountCompleted: wds?.filter(w => w.status === 'COMPLETED').reduce((s, w) => s + (w.amount || 0), 0) || 0,
        },
        transfers: {
          total: trs?.length || 0, completed: trs?.filter(t => t.status === 'COMPLETED').length || 0,
          totalAmountCompleted: trs?.filter(t => t.status === 'COMPLETED').reduce((s, t) => s + (t.amount || 0), 0) || 0,
        },
      } });
    }

    // ==================== ADMIN: ADD TO POOL ====================
    if (action === 'adminAddToPool') {
      if (user.role !== 'admin') return Response.json({ ok: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
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

    // ==================== ADMIN: CHECK BALANCE ====================
    if (action === 'adminCheckBalance') {
      if (user.role !== 'admin') return Response.json({ ok: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
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

    // ==================== ADMIN: GET DETAILS ====================
    if (action === 'adminGetDetails') {
      if (user.role !== 'admin') return Response.json({ ok: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
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

    // ==================== ADMIN: GET HISTORY ====================
    if (action === 'adminGetHistory') {
      if (user.role !== 'admin') return Response.json({ ok: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
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

    // ==================== ADMIN: ASSIGN ====================
    if (action === 'adminAssign') {
      if (user.role !== 'admin') return Response.json({ ok: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
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

      auditLog('POOL_ASSIGN', user.id, { poolAccountId, userId });
      return Response.json({ ok: true, data: { exchangeAccountId: acc.id, userId, userEmail: users[0].email, subaccountName: p.subaccount_name } });
    }

    // ==================== ADMIN: UNASSIGN ====================
    if (action === 'adminUnassign') {
      if (user.role !== 'admin') return Response.json({ ok: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
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

    // ==================== ADMIN: LIST USERS ====================
    if (action === 'adminListUsers') {
      if (user.role !== 'admin') return Response.json({ ok: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
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

    // ==================== ADMIN: LIST USER ACCOUNTS ====================
    if (action === 'adminListUserAccounts') {
      if (user.role !== 'admin') return Response.json({ ok: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
      const accounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({ provider: 'OKX' }, '-created_date', 100);
      return Response.json({ ok: true, data: (accounts || []).map(a => ({
        id: a.id, userId: a.user_id, userEmail: a.user_email, poolAccountId: a.pool_account_id,
        externalAccountId: a.external_account_id, accountLabel: a.account_label, status: a.status,
        lastBalanceUsdt: a.last_balance_usdt, createdAt: a.created_at || a.created_date, updatedAt: a.updated_at,
      })) });
    }

    // ==================== ADMIN: LIST WITHDRAWALS ====================
    if (action === 'adminListWithdrawals') {
      if (user.role !== 'admin') return Response.json({ ok: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
      const wds = await base44.asServiceRole.entities.WithdrawalRequest.filter({ provider: 'OKX' }, '-created_date', params.limit || 50);
      return Response.json({ ok: true, data: (wds || []).map(w => ({
        id: w.id, userId: w.user_id, userEmail: w.user_email, currency: w.currency, chain: w.chain,
        address: w.address, amount: w.amount, fee: w.fee, status: w.status, txHash: w.tx_hash,
        createdAt: w.created_at || w.created_date, completedAt: w.completed_at,
      })) });
    }

    // ==================== ADMIN: LIST TRANSFERS ====================
    if (action === 'adminListTransfers') {
      if (user.role !== 'admin') return Response.json({ ok: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
      const trs = await base44.asServiceRole.entities.ExchangeTransfer.filter({ provider: 'OKX' }, '-created_date', params.limit || 50);
      return Response.json({ ok: true, data: (trs || []).map(t => ({
        id: t.id, userId: t.user_id, fromAccount: t.from_account, toAccount: t.to_account,
        currency: t.currency, amount: t.amount, status: t.status, createdAt: t.created_at || t.created_date,
      })) });
    }

    // ==================== ADMIN: TRANSFER ====================
    if (action === 'adminTransfer') {
      if (user.role !== 'admin') return Response.json({ ok: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
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
    
    // ====================ENSURE USER ACCOUNT (Idempotent) ====================
    if (action === 'ensureUserAccount') {
      auditLog('ENSURE_ACCOUNT_START', user.id, { email: user.email });
      
      const existing = await base44.entities.UserExchangeAccount.filter({ user_id: user.id, provider: 'OKX' });
      const activeAccount = existing?.find(a => a.status === 'ACTIVE');
      
      if (activeAccount) {
        auditLog('ENSURE_ACCOUNT_EXISTS', user.id, { accountId: activeAccount.id });

        const credentialResult = await loadCredential(base44, activeAccount);
        if (!credentialResult.ok) {
          return Response.json(credentialResult, { status: 400 });
        }

        const okxCredential = await buildOkxCredential(credentialResult.data);
        const depositCheck = await fetchDepositAddresses(base44, activeAccount, okxCredential);

        return Response.json({
          ok: true,
          data: {
            accountId: activeAccount.id,
            externalAccountId: activeAccount.external_account_id,
            status: activeAccount.status,
            depositAddresses: depositCheck,
            isNew: false,
          },
        });
      }
      
      const subAcctName = generateSubAcctName(user.id);
      let okxSubAcct = null;
      let okxApiKey = null;
      let okxApiSecret = null;
      let okxApiPassphrase = null;

      const createResult = await okxRequest({
        credential: masterCredsResult.data,
        method: 'POST',
        path: '/api/v5/users/subaccount/create',
        body: {
          subAcct: subAcctName,
          label: (user.full_name || user.email || 'User').substring(0, 20),
        },
        isTradingEndpoint: false,
      });

      if (!createResult.ok) {
        console.error('[OKX] Provision error:', createResult.error?.okxMsg);
        console.log('[OKX] Create subaccount result:', createResult.error?.okxData || createResult.error);
        
        if (createResult.error?.okxCode === '50035') {
          return Response.json(
            okResponse(false, null, {
              code: 'OKX_IP_BINDING_ERROR',
              message: 'OKX API key requires IP whitelist configuration. Please update your OKX API key settings to allow access from cloud servers, or disable IP restrictions.',
              okxCode: createResult.error?.okxCode,
              okxMsg: createResult.error?.okxMsg,
            }),
            { status: 503 }
          );
        }
        
        return Response.json(
          okResponse(false, null, {
            code: 'PROVISION_FAILED',
            message: createResult.error?.okxMsg || 'Subaccount creation failed',
            okxCode: createResult.error?.okxCode,
            okxMsg: createResult.error?.okxMsg,
          }),
          { status: 502 }
        );
      }

      okxSubAcct = createResult.data?.data?.[0]?.subAcct;
      if (!okxSubAcct) {
        return Response.json(okResponse(false, null, { code: 'PROVISION_FAILED', message: 'No subaccount ID returned' }), { status: 502 });
      }

      const generatedPassphrase = `Sub${Date.now().toString(36)}@1`;
      const apiKeyResult = await okxRequest({
        credential: masterCredsResult.data,
        method: 'POST',
        path: '/api/v5/users/subaccount/apikey',
        body: {
          subAcct: okxSubAcct,
          label: `${subAcctName}_api`.substring(0, 20),
          passphrase: generatedPassphrase,
          perm: 'read_only,trade',
        },
        isTradingEndpoint: false,
      });

      if (!apiKeyResult.ok) {
        return Response.json(
          okResponse(false, null, {
            code: 'PROVISION_FAILED',
            message: apiKeyResult.error?.okxMsg || 'API key creation failed',
            okxCode: apiKeyResult.error?.okxCode,
            okxMsg: apiKeyResult.error?.okxMsg,
          }),
          { status: 502 }
        );
      }

      okxApiKey = apiKeyResult.data?.data?.[0]?.apiKey;
      okxApiSecret = apiKeyResult.data?.data?.[0]?.secretKey;
      okxApiPassphrase = apiKeyResult.data?.data?.[0]?.passphrase;

      if (!okxApiKey || !okxApiSecret || !okxApiPassphrase) {
        return Response.json(okResponse(false, null, { code: 'PROVISION_FAILED', message: 'API key data incomplete' }), { status: 502 });
      }
      
      const nowISO = new Date().toISOString();
      
      const exchangeAccount = await base44.asServiceRole.entities.UserExchangeAccount.create({
        user_id: user.id,
        provider: 'OKX',
        external_account_id: okxSubAcct,
        account_label: subAcctName,
        status: 'ACTIVE',
        account_mode: 'futures',
        margin_mode: 'cross',
        default_leverage: 10,
        position_mode: 'net',
        created_at: nowISO
      });
      
      const secretEnc = await encryptSecret(okxApiSecret);
      const passphraseEnc = await encryptSecret(okxApiPassphrase);
      const permissions = ['read_only', 'trade'];

      await base44.asServiceRole.entities.ExchangeCredential.create({
        user_id: user.id,
        user_exchange_account_id: exchangeAccount.id,
        provider: 'OKX',
        api_key: okxApiKey,
        secret_enc: secretEnc,
        passphrase_enc: passphraseEnc,
        permissions_json: JSON.stringify(permissions),
        status: 'ACTIVE',
        created_at: nowISO
      });
      
      auditLog('ENSURE_ACCOUNT_SUCCESS', user.id, { accountId: exchangeAccount.id, okxSubAcct });
      
      const depositAddresses = await fetchDepositAddresses(base44, exchangeAccount, {
        apiKey: okxApiKey,
        secretKey: okxApiSecret,
        passphrase: okxApiPassphrase,
      });

      const accountReady = await okxRequest({
        credential: { apiKey: okxApiKey, secretKey: okxApiSecret, passphrase: okxApiPassphrase },
        method: 'GET',
        path: '/api/v5/account/config',
        isTradingEndpoint: true,
      });

      if (accountReady.ok) {
        const configData = accountReady.data?.data?.[0];
        await base44.asServiceRole.entities.UserExchangeAccount.update(exchangeAccount.id, {
          account_config_json: configData || null,
        });
      }
      
      return Response.json({
        ok: true,
        data: {
          accountId: exchangeAccount.id,
          externalAccountId: okxSubAcct,
          status: 'ACTIVE',
          depositAddresses,
          isNew: true,
          accountConfig: accountReady.ok ? accountReady.data?.data?.[0] : null,
          accountConfigError: accountReady.ok ? null : accountReady.error,
        }
      });
    }
    
    // ==================== ASSERT ACCOUNT READY ====================
    if (action === 'assertAccountReady') {
      const { accountId } = params;
      if (!accountId) return Response.json({ ok: false, error: { code: 'MISSING_ACCOUNT_ID', message: 'Account ID required' } }, { status: 400 });
      
      const accounts = await base44.entities.UserExchangeAccount.filter({ id: accountId, user_id: user.id });
      if (!accounts?.length) return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Account not found' } }, { status: 404 });
      
      const account = accounts[0];
      const credentialResult = await loadCredential(base44, account);
      if (!credentialResult.ok) {
        return Response.json(credentialResult, { status: 400 });
      }

      const credential = await buildOkxCredential(credentialResult.data);
      const configResult = await okxRequest({
        credential,
        method: 'GET',
        path: '/api/v5/account/config',
        isTradingEndpoint: true,
      });

      if (!configResult.ok) {
        return Response.json(okResponse(false, null, {
          code: 'CONFIG_FETCH_FAILED',
          message: configResult.error?.okxMsg || 'Failed to fetch config',
          okxCode: configResult.error?.okxCode,
          okxMsg: configResult.error?.okxMsg,
        }), { status: 502 });
      }

      const configData = configResult.data?.data?.[0];
      const acctLv = configData?.acctLv;

      await base44.asServiceRole.entities.UserExchangeAccount.update(accountId, {
        account_config_json: configData,
      });

      if (acctLv !== '2' && acctLv !== '3' && acctLv !== '4') {
        return Response.json({
          ok: false,
          error: {
            code: 'OKX_MODE_NOT_READY',
            message: 'Account mode must be set to a futures-enabled mode in the exchange web/app.',
            currentMode: acctLv,
          },
        }, { status: 400 });
      }

      return Response.json({ ok: true, data: { accountLevel: acctLv, config: configData } });
    }
    
    // ==================== KEEP ALIVE ====================
    if (action === 'keepAlive') {
      auditLog('KEEPALIVE_START', user.id, {});
      
      const credentials = await base44.asServiceRole.entities.ExchangeCredential.filter({
        user_id: user.id,
        provider: 'OKX',
        status: 'ACTIVE',
      });
      
      const results = [];
      for (const cred of credentials || []) {
        const accounts = await base44.entities.UserExchangeAccount.filter({ id: cred.user_exchange_account_id });
        if (!accounts?.length) continue;

        try {
          const credential = await buildOkxCredential(cred);
          const balanceResult = await okxRequest({
            credential,
            method: 'GET',
            path: '/api/v5/account/balance',
            isTradingEndpoint: true,
          });

          const success = balanceResult.ok;
          results.push({ credentialId: cred.id, accountId: accounts[0].id, success, response: balanceResult });

          if (success) {
            await base44.asServiceRole.entities.ExchangeCredential.update(cred.id, {
              last_used_at: new Date().toISOString(),
            });
          }
        } catch (err) {
          results.push({ credentialId: cred.id, accountId: accounts[0].id, success: false, error: err.message });
        }
      }
      
      auditLog('KEEPALIVE_COMPLETE', user.id, { results });
      return Response.json({ ok: true, data: { results } });
    }
    
    // ==================== LIST SUBACCOUNTS ====================
    if (action === 'listSubaccounts') {
      const accounts = await base44.entities.UserExchangeAccount.filter({ user_id: user.id, provider: 'OKX' });
      return Response.json({
        ok: true,
        data: (accounts || []).map(a => ({
          id: a.id,
          externalAccountId: a.external_account_id,
          label: a.account_label,
          status: a.status,
          accountMode: a.account_mode,
          leverage: a.default_leverage,
          createdAt: a.created_at || a.created_date
        }))
      });
    }
    
    // ==================== GET ACCOUNT CONFIG ====================
    if (action === 'getAccountConfig') {
      const { accountId } = params;
      if (!accountId) return Response.json({ ok: false, error: { code: 'MISSING_ACCOUNT_ID', message: 'Account ID required' } }, { status: 400 });
      
      const accounts = await base44.entities.UserExchangeAccount.filter({ id: accountId, user_id: user.id });
      if (!accounts?.length) return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Account not found' } }, { status: 404 });
      
      return Response.json({
        ok: true,
        data: {
          accountMode: accounts[0].account_mode,
          marginMode: accounts[0].margin_mode,
          leverage: accounts[0].default_leverage,
          positionMode: accounts[0].position_mode
        }
      });
    }
    
    // ==================== SET LEVERAGE ====================
    if (action === 'setLeverage') {
      const { accountId, instId, leverage, marginMode = 'cross' } = params;
      if (!accountId || !instId || !leverage) {
        return Response.json({ ok: false, error: { code: 'MISSING_FIELDS', message: 'accountId, instId, leverage required' } }, { status: 400 });
      }
      
      await base44.asServiceRole.entities.UserExchangeAccount.update(accountId, {
        default_leverage: leverage,
        margin_mode: marginMode
      });
      
      auditLog('SET_LEVERAGE', user.id, { accountId, instId, leverage, marginMode });
      
      return Response.json({ ok: true, data: { leverage, marginMode } });
    }
    
    return Response.json({ ok: false, error: { code: 'INVALID_ACTION', message: 'Invalid action' } }, { status: 400 });
    
  } catch (error) {
    console.error('[OKX_PROVISION_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});