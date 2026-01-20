// @ts-nocheck
/// <reference lib="deno.ns" />
// OKX Admin Control Hub v1.2
// Manage sub-account pool, assignments, withdrawals, balances, transaction history

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import {
  auditLog,
  decryptSecret,
  encryptSecret,
  getMasterCredentials,
  okResponse,
  okxRequest,
} from './okxCore.js';

// Build credential object from encrypted data
async function buildCredential(apiKey, secretEnc, passphraseEnc) {
  const secretKey = await decryptSecret(secretEnc);
  const passphrase = await decryptSecret(passphraseEnc);
  return { apiKey, secretKey, passphrase };
}

// Verify admin access
function requireAdmin(user) {
  if (!user || user.role !== 'admin') {
    return { ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }

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

    // ==================== ADD SUB-ACCOUNT TO POOL (Admin) ====================
    if (action === 'addToPool') {
      const adminCheck = requireAdmin(user);
      if (!adminCheck.ok) return Response.json(adminCheck, { status: 403 });

      const { subaccountName, apiKey, secretKey, passphrase, permissions = ['read', 'trade'], ipWhitelist = [], notes = '' } = params;

      if (!subaccountName || !apiKey || !secretKey || !passphrase) {
        return Response.json({ ok: false, error: { code: 'MISSING_FIELDS', message: 'subaccountName, apiKey, secretKey, passphrase required' } }, { status: 400 });
      }

      // Check if already exists
      const existing = await base44.asServiceRole.entities.OKXSubAccountPool.filter({ subaccount_name: subaccountName });
      if (existing?.length) {
        return Response.json({ ok: false, error: { code: 'ALREADY_EXISTS', message: 'Sub-account already in pool' } }, { status: 400 });
      }

      // Encrypt secrets
      const secretEnc = await encryptSecret(secretKey);
      const passphraseEnc = await encryptSecret(passphrase);

      const nowISO = new Date().toISOString();

      // Test the credentials by fetching balance
      let testResult = null;
      let balanceUsdt = 0;
      try {
        const credential = { apiKey, secretKey, passphrase };
        testResult = await okxRequest({
          credential,
          method: 'GET',
          path: '/api/v5/account/balance',
          isTradingEndpoint: true,
        });

        if (testResult.ok) {
          const details = testResult.data?.data?.[0]?.details || [];
          const usdtEntry = details.find(d => d.ccy === 'USDT');
          balanceUsdt = parseFloat(usdtEntry?.cashBal || usdtEntry?.availBal || '0');
        }
      } catch (e) {
        console.error('[ADMIN] Test credential failed:', e.message);
      }

      // Create pool entry
      const poolAccount = await base44.asServiceRole.entities.OKXSubAccountPool.create({
        subaccount_name: subaccountName,
        api_key: apiKey,
        secret_enc: secretEnc,
        passphrase_enc: passphraseEnc,
        permissions: permissions,
        ip_whitelist: ipWhitelist,
        status: testResult?.ok ? 'AVAILABLE' : 'ERROR',
        last_balance_check: nowISO,
        last_balance_usdt: balanceUsdt,
        notes: testResult?.ok ? notes : `${notes} | Test failed: ${testResult?.error?.okxMsg || 'Unknown error'}`,
        created_at: nowISO,
        updated_at: nowISO,
      });

      auditLog('POOL_ADD', user.id, { subaccountName, status: poolAccount.status });

      return Response.json({
        ok: true,
        data: {
          poolAccountId: poolAccount.id,
          subaccountName,
          status: poolAccount.status,
          balanceUsdt,
          testResult: testResult?.ok ? 'SUCCESS' : (testResult?.error?.okxMsg || 'FAILED'),
        },
      });
    }

    // ==================== LIST POOL ACCOUNTS (Admin) ====================
    if (action === 'listPool') {
      const adminCheck = requireAdmin(user);
      if (!adminCheck.ok) return Response.json(adminCheck, { status: 403 });

      const { status } = params;
      let query = {};
      if (status) query.status = status;

      const poolAccounts = await base44.asServiceRole.entities.OKXSubAccountPool.filter(query, '-created_date', 100);

      return Response.json({
        ok: true,
        data: (poolAccounts || []).map(p => ({
          id: p.id,
          subaccountName: p.subaccount_name,
          apiKey: p.api_key ? `${p.api_key.substring(0, 8)}...` : null,
          status: p.status,
          permissions: p.permissions,
          assignedToUserId: p.assigned_to_user_id,
          assignedToAccountId: p.assigned_to_account_id,
          assignedAt: p.assigned_at,
          lastBalanceUsdt: p.last_balance_usdt,
          lastBalanceCheck: p.last_balance_check,
          notes: p.notes,
          createdAt: p.created_at || p.created_date,
          updatedAt: p.updated_at,
        })),
      });
    }

    // ==================== CHECK POOL ACCOUNT BALANCE (Admin) ====================
    if (action === 'checkPoolBalance') {
      const adminCheck = requireAdmin(user);
      if (!adminCheck.ok) return Response.json(adminCheck, { status: 403 });

      const { poolAccountId } = params;
      if (!poolAccountId) {
        return Response.json({ ok: false, error: { code: 'MISSING_FIELDS', message: 'poolAccountId required' } }, { status: 400 });
      }

      const poolAccounts = await base44.asServiceRole.entities.OKXSubAccountPool.filter({ id: poolAccountId });
      if (!poolAccounts?.length) {
        return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Pool account not found' } }, { status: 404 });
      }

      const poolAccount = poolAccounts[0];
      const credential = await buildCredential(poolAccount.api_key, poolAccount.secret_enc, poolAccount.passphrase_enc);

      // Get trading account balance
      const balanceResult = await okxRequest({
        credential,
        method: 'GET',
        path: '/api/v5/account/balance',
        isTradingEndpoint: true,
      });

      // Get funding account balance
      const fundingResult = await okxRequest({
        credential,
        method: 'GET',
        path: '/api/v5/asset/balances',
        isTradingEndpoint: false,
      });

      if (!balanceResult.ok && !fundingResult.ok) {
        await base44.asServiceRole.entities.OKXSubAccountPool.update(poolAccountId, {
          status: 'ERROR',
          notes: `Balance check failed: ${balanceResult.error?.okxMsg || fundingResult.error?.okxMsg || 'Unknown'}`,
          updated_at: new Date().toISOString(),
        });

        return Response.json({
          ok: false,
          error: {
            code: 'BALANCE_CHECK_FAILED',
            message: balanceResult.error?.okxMsg || 'Failed to check balance',
            okxCode: balanceResult.error?.okxCode,
          },
        }, { status: 502 });
      }

      // Parse trading account balances
      const tradingDetails = balanceResult.data?.data?.[0]?.details || [];
      const tradingBalances = tradingDetails.map(d => ({
        currency: d.ccy,
        available: parseFloat(d.availBal || '0'),
        frozen: parseFloat(d.frozenBal || '0'),
        total: parseFloat(d.cashBal || d.eq || '0'),
        equity: parseFloat(d.eq || '0'),
        accountType: 'trading',
      }));

      // Parse funding account balances
      const fundingDetails = fundingResult.data?.data || [];
      const fundingBalances = fundingDetails.map(d => ({
        currency: d.ccy,
        available: parseFloat(d.availBal || d.bal || '0'),
        frozen: parseFloat(d.frozenBal || '0'),
        total: parseFloat(d.bal || '0'),
        accountType: 'funding',
      }));

      // Combine balances
      const allBalances = [...tradingBalances, ...fundingBalances];
      
      // Calculate totals
      const tradingUsdt = tradingBalances.find(b => b.currency === 'USDT')?.total || 0;
      const fundingUsdt = fundingBalances.find(b => b.currency === 'USDT')?.total || 0;
      const totalUsdt = tradingUsdt + fundingUsdt;
      
      const nowISO = new Date().toISOString();

      await base44.asServiceRole.entities.OKXSubAccountPool.update(poolAccountId, {
        last_balance_check: nowISO,
        last_balance_usdt: totalUsdt,
        status: poolAccount.assigned_to_user_id ? 'ASSIGNED' : 'AVAILABLE',
        updated_at: nowISO,
      });

      return Response.json({
        ok: true,
        data: {
          balances: allBalances,
          tradingUsdt,
          fundingUsdt,
          totalUsdt,
          checkedAt: nowISO,
        },
      });
    }

    // ==================== GET POOL ACCOUNT DETAILS (Admin) ====================
    if (action === 'getPoolAccountDetails') {
      const adminCheck = requireAdmin(user);
      if (!adminCheck.ok) return Response.json(adminCheck, { status: 403 });

      const { poolAccountId } = params;
      if (!poolAccountId) {
        return Response.json({ ok: false, error: { code: 'MISSING_FIELDS', message: 'poolAccountId required' } }, { status: 400 });
      }

      const poolAccounts = await base44.asServiceRole.entities.OKXSubAccountPool.filter({ id: poolAccountId });
      if (!poolAccounts?.length) {
        return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Pool account not found' } }, { status: 404 });
      }

      const poolAccount = poolAccounts[0];
      const credential = await buildCredential(poolAccount.api_key, poolAccount.secret_enc, poolAccount.passphrase_enc);

      // Fetch all data in parallel
      const [balanceResult, fundingResult, configResult, positionsResult] = await Promise.all([
        okxRequest({ credential, method: 'GET', path: '/api/v5/account/balance', isTradingEndpoint: true }),
        okxRequest({ credential, method: 'GET', path: '/api/v5/asset/balances', isTradingEndpoint: false }),
        okxRequest({ credential, method: 'GET', path: '/api/v5/account/config', isTradingEndpoint: true }),
        okxRequest({ credential, method: 'GET', path: '/api/v5/account/positions', isTradingEndpoint: true }),
      ]);

      // Parse trading balances
      const tradingDetails = balanceResult.data?.data?.[0]?.details || [];
      const tradingBalances = tradingDetails.map(d => ({
        currency: d.ccy,
        available: parseFloat(d.availBal || '0'),
        frozen: parseFloat(d.frozenBal || '0'),
        total: parseFloat(d.cashBal || d.eq || '0'),
        equity: parseFloat(d.eq || '0'),
        accountType: 'trading',
      }));

      // Parse funding balances
      const fundingDetails = fundingResult.data?.data || [];
      const fundingBalances = fundingDetails.map(d => ({
        currency: d.ccy,
        available: parseFloat(d.availBal || d.bal || '0'),
        frozen: parseFloat(d.frozenBal || '0'),
        total: parseFloat(d.bal || '0'),
        accountType: 'funding',
      }));

      // Parse account config
      const config = configResult.data?.data?.[0] || {};

      // Parse positions
      const positions = (positionsResult.data?.data || []).map(p => ({
        instId: p.instId,
        posSide: p.posSide,
        pos: parseFloat(p.pos || '0'),
        avgPx: parseFloat(p.avgPx || '0'),
        upl: parseFloat(p.upl || '0'),
        lever: parseFloat(p.lever || '0'),
        liqPx: parseFloat(p.liqPx || '0'),
        mgnMode: p.mgnMode,
        notionalUsd: parseFloat(p.notionalUsd || '0'),
      })).filter(p => p.pos !== 0);

      // Calculate totals
      const tradingUsdt = tradingBalances.find(b => b.currency === 'USDT')?.total || 0;
      const fundingUsdt = fundingBalances.find(b => b.currency === 'USDT')?.total || 0;
      const totalUsdt = tradingUsdt + fundingUsdt;
      const totalEquity = parseFloat(balanceResult.data?.data?.[0]?.totalEq || '0');

      const nowISO = new Date().toISOString();
      await base44.asServiceRole.entities.OKXSubAccountPool.update(poolAccountId, {
        last_balance_check: nowISO,
        last_balance_usdt: totalUsdt,
        updated_at: nowISO,
      });

      return Response.json({
        ok: true,
        data: {
          poolAccount: {
            id: poolAccount.id,
            subaccountName: poolAccount.subaccount_name,
            status: poolAccount.status,
            permissions: poolAccount.permissions,
            assignedToUserId: poolAccount.assigned_to_user_id,
            createdAt: poolAccount.created_at || poolAccount.created_date,
          },
          balances: {
            trading: tradingBalances,
            funding: fundingBalances,
            tradingUsdt,
            fundingUsdt,
            totalUsdt,
            totalEquity,
          },
          config: {
            accountLevel: config.acctLv,
            posMode: config.posMode,
            autoLoan: config.autoLoan,
            greeksType: config.greeksType,
            level: config.level,
            levelTmp: config.levelTmp,
          },
          positions,
          checkedAt: nowISO,
        },
      });
    }

    // ==================== GET TRANSACTION HISTORY (Admin) ====================
    if (action === 'getTransactionHistory') {
      const adminCheck = requireAdmin(user);
      if (!adminCheck.ok) return Response.json(adminCheck, { status: 403 });

      const { poolAccountId, type = 'all', limit = 50 } = params;
      if (!poolAccountId) {
        return Response.json({ ok: false, error: { code: 'MISSING_FIELDS', message: 'poolAccountId required' } }, { status: 400 });
      }

      const poolAccounts = await base44.asServiceRole.entities.OKXSubAccountPool.filter({ id: poolAccountId });
      if (!poolAccounts?.length) {
        return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Pool account not found' } }, { status: 404 });
      }

      const poolAccount = poolAccounts[0];
      const credential = await buildCredential(poolAccount.api_key, poolAccount.secret_enc, poolAccount.passphrase_enc);

      const results = { deposits: [], withdrawals: [], bills: [] };

      // Fetch deposit history
      if (type === 'all' || type === 'deposits') {
        const depositResult = await okxRequest({
          credential,
          method: 'GET',
          path: '/api/v5/asset/deposit-history',
          query: { limit: String(limit) },
          isTradingEndpoint: false,
        });
        if (depositResult.ok) {
          results.deposits = (depositResult.data?.data || []).map(d => ({
            txId: d.txId,
            chain: d.chain,
            currency: d.ccy,
            amount: parseFloat(d.amt || '0'),
            from: d.from,
            to: d.to,
            state: d.state,
            actualDepBlkConfirm: d.actualDepBlkConfirm,
            ts: d.ts,
          }));
        }
      }

      // Fetch withdrawal history
      if (type === 'all' || type === 'withdrawals') {
        const withdrawResult = await okxRequest({
          credential,
          method: 'GET',
          path: '/api/v5/asset/withdrawal-history',
          query: { limit: String(limit) },
          isTradingEndpoint: false,
        });
        if (withdrawResult.ok) {
          results.withdrawals = (withdrawResult.data?.data || []).map(w => ({
            wdId: w.wdId,
            txId: w.txId,
            chain: w.chain,
            currency: w.ccy,
            amount: parseFloat(w.amt || '0'),
            fee: parseFloat(w.fee || '0'),
            to: w.to,
            state: w.state,
            ts: w.ts,
          }));
        }
      }

      // Fetch bills/trade history
      if (type === 'all' || type === 'bills') {
        const billsResult = await okxRequest({
          credential,
          method: 'GET',
          path: '/api/v5/account/bills',
          query: { limit: String(limit) },
          isTradingEndpoint: true,
        });
        if (billsResult.ok) {
          results.bills = (billsResult.data?.data || []).map(b => ({
            billId: b.billId,
            instId: b.instId,
            instType: b.instType,
            subType: b.subType,
            currency: b.ccy,
            balChg: parseFloat(b.balChg || '0'),
            bal: parseFloat(b.bal || '0'),
            fee: parseFloat(b.fee || '0'),
            pnl: parseFloat(b.pnl || '0'),
            ts: b.ts,
          }));
        }
      }

      return Response.json({
        ok: true,
        data: results,
      });
    }

    // ==================== ASSIGN POOL ACCOUNT TO USER (Admin) ====================
    if (action === 'assignToUser') {
      const adminCheck = requireAdmin(user);
      if (!adminCheck.ok) return Response.json(adminCheck, { status: 403 });

      const { poolAccountId, userId } = params;
      if (!poolAccountId || !userId) {
        return Response.json({ ok: false, error: { code: 'MISSING_FIELDS', message: 'poolAccountId and userId required' } }, { status: 400 });
      }

      // Get pool account
      const poolAccounts = await base44.asServiceRole.entities.OKXSubAccountPool.filter({ id: poolAccountId });
      if (!poolAccounts?.length) {
        return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Pool account not found' } }, { status: 404 });
      }

      const poolAccount = poolAccounts[0];
      if (poolAccount.status === 'ASSIGNED') {
        return Response.json({ ok: false, error: { code: 'ALREADY_ASSIGNED', message: 'Pool account already assigned' } }, { status: 400 });
      }

      // Get target user
      const users = await base44.asServiceRole.entities.User.filter({ id: userId });
      if (!users?.length) {
        return Response.json({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } }, { status: 404 });
      }
      const targetUser = users[0];

      // Check if user already has an OKX account
      const existingAccounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({ user_id: userId, provider: 'OKX' });
      if (existingAccounts?.some(a => a.status === 'ACTIVE')) {
        return Response.json({ ok: false, error: { code: 'USER_HAS_ACCOUNT', message: 'User already has an active OKX account' } }, { status: 400 });
      }

      const nowISO = new Date().toISOString();

      // Create UserExchangeAccount
      const exchangeAccount = await base44.asServiceRole.entities.UserExchangeAccount.create({
        user_id: userId,
        user_email: targetUser.email,
        pool_account_id: poolAccountId,
        provider: 'OKX',
        external_account_id: poolAccount.subaccount_name,
        account_label: poolAccount.subaccount_name,
        status: 'ACTIVE',
        account_mode: 'futures',
        margin_mode: 'cross',
        default_leverage: 10,
        position_mode: 'net',
        created_at: nowISO,
        updated_at: nowISO,
      });

      // Create ExchangeCredential
      await base44.asServiceRole.entities.ExchangeCredential.create({
        user_id: userId,
        user_exchange_account_id: exchangeAccount.id,
        pool_account_id: poolAccountId,
        provider: 'OKX',
        api_key: poolAccount.api_key,
        secret_enc: poolAccount.secret_enc,
        passphrase_enc: poolAccount.passphrase_enc,
        permissions: poolAccount.permissions || ['read', 'trade'],
        ip_whitelist: poolAccount.ip_whitelist || [],
        status: 'ACTIVE',
        created_at: nowISO,
        updated_at: nowISO,
      });

      // Update pool account
      await base44.asServiceRole.entities.OKXSubAccountPool.update(poolAccountId, {
        status: 'ASSIGNED',
        assigned_to_user_id: userId,
        assigned_to_account_id: exchangeAccount.id,
        assigned_at: nowISO,
        updated_at: nowISO,
      });

      auditLog('POOL_ASSIGN', user.id, { poolAccountId, userId, exchangeAccountId: exchangeAccount.id });

      return Response.json({
        ok: true,
        data: {
          exchangeAccountId: exchangeAccount.id,
          userId,
          userEmail: targetUser.email,
          subaccountName: poolAccount.subaccount_name,
          status: 'ACTIVE',
        },
      });
    }

    // ==================== UNASSIGN POOL ACCOUNT (Admin) ====================
    if (action === 'unassignFromUser') {
      const adminCheck = requireAdmin(user);
      if (!adminCheck.ok) return Response.json(adminCheck, { status: 403 });

      const { poolAccountId } = params;
      if (!poolAccountId) {
        return Response.json({ ok: false, error: { code: 'MISSING_FIELDS', message: 'poolAccountId required' } }, { status: 400 });
      }

      const poolAccounts = await base44.asServiceRole.entities.OKXSubAccountPool.filter({ id: poolAccountId });
      if (!poolAccounts?.length) {
        return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Pool account not found' } }, { status: 404 });
      }

      const poolAccount = poolAccounts[0];
      if (poolAccount.status !== 'ASSIGNED') {
        return Response.json({ ok: false, error: { code: 'NOT_ASSIGNED', message: 'Pool account is not assigned' } }, { status: 400 });
      }

      const nowISO = new Date().toISOString();

      // Suspend the exchange account
      if (poolAccount.assigned_to_account_id) {
        await base44.asServiceRole.entities.UserExchangeAccount.update(poolAccount.assigned_to_account_id, {
          status: 'SUSPENDED',
          updated_at: nowISO,
        });

        // Revoke credentials
        const creds = await base44.asServiceRole.entities.ExchangeCredential.filter({
          user_exchange_account_id: poolAccount.assigned_to_account_id,
        });
        for (const cred of creds || []) {
          await base44.asServiceRole.entities.ExchangeCredential.update(cred.id, {
            status: 'REVOKED',
            updated_at: nowISO,
          });
        }
      }

      // Update pool account
      await base44.asServiceRole.entities.OKXSubAccountPool.update(poolAccountId, {
        status: 'AVAILABLE',
        assigned_to_user_id: null,
        assigned_to_account_id: null,
        assigned_at: null,
        updated_at: nowISO,
      });

      auditLog('POOL_UNASSIGN', user.id, { poolAccountId });

      return Response.json({ ok: true, data: { poolAccountId, status: 'AVAILABLE' } });
    }

    // ==================== LIST ALL USER ACCOUNTS (Admin) ====================
    if (action === 'listUserAccounts') {
      const adminCheck = requireAdmin(user);
      if (!adminCheck.ok) return Response.json(adminCheck, { status: 403 });

      const { status, provider = 'OKX' } = params;
      let query = { provider };
      if (status) query.status = status;

      const accounts = await base44.asServiceRole.entities.UserExchangeAccount.filter(query, '-created_date', 100);

      return Response.json({
        ok: true,
        data: (accounts || []).map(a => ({
          id: a.id,
          userId: a.user_id,
          userEmail: a.user_email,
          poolAccountId: a.pool_account_id,
          externalAccountId: a.external_account_id,
          accountLabel: a.account_label,
          status: a.status,
          accountMode: a.account_mode,
          marginMode: a.margin_mode,
          defaultLeverage: a.default_leverage,
          lastBalanceUsdt: a.last_balance_usdt,
          lastSyncAt: a.last_sync_at,
          createdAt: a.created_at || a.created_date,
          updatedAt: a.updated_at,
        })),
      });
    }

    // ==================== LIST ALL WITHDRAWALS (Admin) ====================
    if (action === 'listWithdrawals') {
      const adminCheck = requireAdmin(user);
      if (!adminCheck.ok) return Response.json(adminCheck, { status: 403 });

      const { status, limit = 50 } = params;
      let query = { provider: 'OKX' };
      if (status) query.status = status;

      const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter(query, '-created_date', limit);

      return Response.json({
        ok: true,
        data: (withdrawals || []).map(w => ({
          id: w.id,
          userId: w.user_id,
          userEmail: w.user_email,
          currency: w.currency,
          chain: w.chain,
          address: w.address,
          amount: w.amount,
          fee: w.fee,
          netAmount: w.net_amount,
          status: w.status,
          txHash: w.tx_hash,
          externalWithdrawalId: w.external_withdrawal_id,
          rejectionReason: w.rejection_reason,
          reviewedBy: w.reviewed_by,
          reviewedAt: w.reviewed_at,
          createdAt: w.created_at || w.created_date,
          completedAt: w.completed_at,
        })),
      });
    }

    // ==================== LIST ALL TRANSFERS (Admin) ====================
    if (action === 'listTransfers') {
      const adminCheck = requireAdmin(user);
      if (!adminCheck.ok) return Response.json(adminCheck, { status: 403 });

      const { status, limit = 50 } = params;
      let query = { provider: 'OKX' };
      if (status) query.status = status;

      const transfers = await base44.asServiceRole.entities.ExchangeTransfer.filter(query, '-created_date', limit);

      return Response.json({
        ok: true,
        data: (transfers || []).map(t => ({
          id: t.id,
          userId: t.user_id,
          fromAccount: t.from_account,
          fromAccountType: t.from_account_type,
          toAccount: t.to_account,
          toAccountType: t.to_account_type,
          currency: t.currency,
          amount: t.amount,
          status: t.status,
          externalTransferId: t.external_transfer_id,
          errorMessage: t.error_message,
          createdAt: t.created_at || t.created_date,
          completedAt: t.completed_at,
        })),
      });
    }

    // ==================== ADMIN TRANSFER: MAIN <-> SUB-ACCOUNT ====================
    if (action === 'adminTransfer') {
      const adminCheck = requireAdmin(user);
      if (!adminCheck.ok) return Response.json(adminCheck, { status: 403 });

      const { direction, poolAccountId, currency = 'USDT', amount } = params;
      // direction: 'toSub' (main -> sub) or 'toMain' (sub -> main)

      if (!direction || !poolAccountId || !amount || amount <= 0) {
        return Response.json({ ok: false, error: { code: 'MISSING_FIELDS', message: 'direction, poolAccountId, amount required' } }, { status: 400 });
      }

      if (!['toSub', 'toMain'].includes(direction)) {
        return Response.json({ ok: false, error: { code: 'INVALID_DIRECTION', message: 'direction must be toSub or toMain' } }, { status: 400 });
      }

      const poolAccounts = await base44.asServiceRole.entities.OKXSubAccountPool.filter({ id: poolAccountId });
      if (!poolAccounts?.length) {
        return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Pool account not found' } }, { status: 404 });
      }

      const poolAccount = poolAccounts[0];
      const masterCredsResult = getMasterCredentials();
      if (!masterCredsResult.ok) {
        return Response.json(masterCredsResult, { status: 500 });
      }

      const nowISO = new Date().toISOString();

      // OKX internal transfer via master account
      // type: 1 = main to sub, 2 = sub to main
      const transferBody = {
        ccy: currency,
        amt: String(amount),
        from: '6', // 6 = funding account
        to: '6',
        type: direction === 'toSub' ? '1' : '2',
        subAcct: poolAccount.subaccount_name,
      };

      const transferResult = await okxRequest({
        credential: masterCredsResult.data,
        method: 'POST',
        path: '/api/v5/asset/transfer',
        body: transferBody,
        isTradingEndpoint: false,
      });

      const transferStatus = transferResult.ok ? 'COMPLETED' : 'FAILED';
      const externalId = transferResult.data?.data?.[0]?.transId || null;

      // Record transfer
      const transfer = await base44.asServiceRole.entities.ExchangeTransfer.create({
        user_id: poolAccount.assigned_to_user_id || 'ADMIN',
        provider: 'OKX',
        from_account: direction === 'toSub' ? 'main' : poolAccount.subaccount_name,
        from_account_type: 'funding',
        to_account: direction === 'toSub' ? poolAccount.subaccount_name : 'main',
        to_account_type: 'funding',
        currency,
        amount,
        status: transferStatus,
        external_transfer_id: externalId,
        error_message: transferResult.ok ? null : (transferResult.error?.okxMsg || 'Transfer failed'),
        completed_at: transferResult.ok ? nowISO : null,
        created_at: nowISO,
      });

      auditLog('ADMIN_TRANSFER', user.id, { direction, poolAccountId, currency, amount, status: transferStatus });

      if (!transferResult.ok) {
        return Response.json({
          ok: false,
          error: {
            code: 'TRANSFER_FAILED',
            message: transferResult.error?.okxMsg || 'Transfer failed',
            okxCode: transferResult.error?.okxCode,
          },
        }, { status: 502 });
      }

      return Response.json({
        ok: true,
        data: {
          transferId: transfer.id,
          externalTransferId: externalId,
          status: 'COMPLETED',
          direction,
          amount,
          currency,
        },
      });
    }

    // ==================== GET DASHBOARD STATS (Admin) ====================
    if (action === 'getDashboardStats') {
      const adminCheck = requireAdmin(user);
      if (!adminCheck.ok) return Response.json(adminCheck, { status: 403 });

      const [poolAccounts, userAccounts, withdrawals, transfers] = await Promise.all([
        base44.asServiceRole.entities.OKXSubAccountPool.filter({}, '-created_date', 1000),
        base44.asServiceRole.entities.UserExchangeAccount.filter({ provider: 'OKX' }, '-created_date', 1000),
        base44.asServiceRole.entities.WithdrawalRequest.filter({ provider: 'OKX' }, '-created_date', 1000),
        base44.asServiceRole.entities.ExchangeTransfer.filter({ provider: 'OKX' }, '-created_date', 1000),
      ]);

      const poolStats = {
        total: poolAccounts?.length || 0,
        available: poolAccounts?.filter(p => p.status === 'AVAILABLE').length || 0,
        assigned: poolAccounts?.filter(p => p.status === 'ASSIGNED').length || 0,
        error: poolAccounts?.filter(p => p.status === 'ERROR').length || 0,
        disabled: poolAccounts?.filter(p => p.status === 'DISABLED').length || 0,
        totalBalanceUsdt: poolAccounts?.reduce((sum, p) => sum + (p.last_balance_usdt || 0), 0) || 0,
      };

      const accountStats = {
        total: userAccounts?.length || 0,
        active: userAccounts?.filter(a => a.status === 'ACTIVE').length || 0,
        suspended: userAccounts?.filter(a => a.status === 'SUSPENDED').length || 0,
        pending: userAccounts?.filter(a => a.status === 'PENDING').length || 0,
      };

      const withdrawalStats = {
        total: withdrawals?.length || 0,
        pending: withdrawals?.filter(w => ['PENDING_CONFIRM', 'PENDING_REVIEW', 'APPROVED', 'PROCESSING'].includes(w.status)).length || 0,
        completed: withdrawals?.filter(w => w.status === 'COMPLETED').length || 0,
        failed: withdrawals?.filter(w => ['REJECTED', 'FAILED', 'CANCELLED'].includes(w.status)).length || 0,
        totalAmountCompleted: withdrawals?.filter(w => w.status === 'COMPLETED').reduce((sum, w) => sum + (w.amount || 0), 0) || 0,
      };

      const transferStats = {
        total: transfers?.length || 0,
        completed: transfers?.filter(t => t.status === 'COMPLETED').length || 0,
        failed: transfers?.filter(t => t.status === 'FAILED').length || 0,
        totalAmountCompleted: transfers?.filter(t => t.status === 'COMPLETED').reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
      };

      return Response.json({
        ok: true,
        data: {
          pool: poolStats,
          accounts: accountStats,
          withdrawals: withdrawalStats,
          transfers: transferStats,
        },
      });
    }

    // ==================== UPDATE POOL ACCOUNT STATUS (Admin) ====================
    if (action === 'updatePoolStatus') {
      const adminCheck = requireAdmin(user);
      if (!adminCheck.ok) return Response.json(adminCheck, { status: 403 });

      const { poolAccountId, status, notes } = params;
      if (!poolAccountId || !status) {
        return Response.json({ ok: false, error: { code: 'MISSING_FIELDS', message: 'poolAccountId and status required' } }, { status: 400 });
      }

      if (!['AVAILABLE', 'DISABLED', 'ERROR'].includes(status)) {
        return Response.json({ ok: false, error: { code: 'INVALID_STATUS', message: 'Invalid status' } }, { status: 400 });
      }

      const poolAccounts = await base44.asServiceRole.entities.OKXSubAccountPool.filter({ id: poolAccountId });
      if (!poolAccounts?.length) {
        return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Pool account not found' } }, { status: 404 });
      }

      const poolAccount = poolAccounts[0];
      if (poolAccount.status === 'ASSIGNED' && status !== 'ASSIGNED') {
        return Response.json({ ok: false, error: { code: 'CANNOT_CHANGE', message: 'Cannot change status of assigned account. Unassign first.' } }, { status: 400 });
      }

      const nowISO = new Date().toISOString();
      const updateData = { status, updated_at: nowISO };
      if (notes !== undefined) updateData.notes = notes;

      await base44.asServiceRole.entities.OKXSubAccountPool.update(poolAccountId, updateData);

      auditLog('POOL_STATUS_UPDATE', user.id, { poolAccountId, status });

      return Response.json({ ok: true, data: { poolAccountId, status } });
    }

    // ==================== LIST USERS (Admin) ====================
    if (action === 'listUsers') {
      const adminCheck = requireAdmin(user);
      if (!adminCheck.ok) return Response.json(adminCheck, { status: 403 });

      const { limit = 100 } = params;
      const allUsers = await base44.asServiceRole.entities.User.filter({}, '-created_date', limit);

      // Get user account assignments
      const accounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({ provider: 'OKX' });
      const accountMap = {};
      for (const acc of accounts || []) {
        accountMap[acc.user_id] = acc;
      }

      return Response.json({
        ok: true,
        data: (allUsers || []).map(u => ({
          id: u.id,
          email: u.email,
          fullName: u.full_name,
          role: u.role,
          hasOkxAccount: !!accountMap[u.id],
          okxAccountStatus: accountMap[u.id]?.status || null,
          okxAccountId: accountMap[u.id]?.id || null,
          createdAt: u.created_date,
        })),
      });
    }

    return Response.json({ ok: false, error: { code: 'INVALID_ACTION', message: 'Invalid action' } }, { status: 400 });

  } catch (error) {
    console.error('[OKX_ADMIN_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});