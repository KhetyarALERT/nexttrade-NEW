// @ts-nocheck
/// <reference lib="deno.ns" />
// OKX Pool Admin - v1.0.1 - Fresh deploy trigger

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import {
  auditLog,
  decryptSecret,
  encryptSecret,
  getMasterCredentials,
  okxRequest,
} from './okxCore.js';

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

    console.log('[OKX_POOL_ADMIN] Action:', action, 'User:', user.email);

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

    // CHECK BALANCE
    if (action === 'checkBalance') {
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

    // GET DETAILS
    if (action === 'getDetails') {
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

    // GET HISTORY
    if (action === 'getHistory') {
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

    // ASSIGN
    if (action === 'assign') {
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

    // UNASSIGN
    if (action === 'unassign') {
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
        id: t.id, userId: t.user_id, fromAccount: t.from_account, toAccount: t.to_account,
        currency: t.currency, amount: t.amount, status: t.status, createdAt: t.created_at || t.created_date,
      })) });
    }

    // TRANSFER
    if (action === 'transfer') {
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
    
    return Response.json({ ok: false, error: { code: 'INVALID_ACTION', message: 'Invalid action' } }, { status: 400 });
    
  } catch (error) {
    console.error('[OKX_POOL_ADMIN_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});