// @ts-nocheck
/// <reference lib="deno.ns" />
// OKX Transfers & Balances - Internal transfers, deposit/withdraw

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { decryptSecret, getCached, okResponse, okxRequest, setCache } from './okxCore.js';

function auditLog(action, userId, details) {
  console.log(`[OKX_TRANSFER] [${new Date().toISOString()}] [${action}] User: ${userId}`, JSON.stringify(details));
}

// Generate confirmation token
function generateConfirmToken() {
  return `${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
}

// Withdrawal cooldown hours for new addresses
const COOLDOWN_HOURS = 24;
const DEPOSIT_CACHE_MS = 45000;

async function resolveAccount(base44, userId, accountId) {
  const accounts = await base44.entities.UserExchangeAccount.filter({
    user_id: userId,
    provider: 'OKX',
    ...(accountId ? { id: accountId } : {}),
  });
  const account = accounts?.find((a) => a.status === 'ACTIVE') || accounts?.[0];
  if (!account) return okResponse(false, null, { code: 'NO_ACCOUNT', message: 'No exchange account found' });
  return okResponse(true, account);
}

async function resolveCredential(base44, account) {
  const creds = await base44.asServiceRole.entities.ExchangeCredential.filter({
    user_exchange_account_id: account.id,
    provider: 'OKX',
    status: 'ACTIVE',
  });
  if (!creds?.length) return okResponse(false, null, { code: 'NO_CREDENTIALS', message: 'Account credentials not found' });
  const cred = creds[0];
  const secretKey = await decryptSecret(cred.secret_enc || cred.secretEnc);
  const passphrase = await decryptSecret(cred.passphrase_enc || cred.passphraseEnc);
  return okResponse(true, {
    apiKey: cred.api_key || cred.apiKey,
    secretKey,
    passphrase,
  });
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
    
    const body = await req.json();
    const { action, ...params } = body;
    
    // ==================== TRANSFER FUNDS ====================
    if (action === 'transferFunds') {
      const { fromAccount, fromType = 'funding', toAccount, toType = 'trading', currency = 'USDT', amount } = params;
      
      if (!fromAccount || !toAccount || !amount || amount <= 0) {
        return Response.json({ ok: false, error: { code: 'INVALID_PARAMS', message: 'Invalid transfer parameters' } }, { status: 400 });
      }
      
      // Verify account ownership
      const accounts = await base44.entities.UserExchangeAccount.filter({ user_id: user.id, provider: 'OKX' });
      const accountIds = accounts.map(a => a.id);
      
      if (fromAccount !== 'main' && !accountIds.includes(fromAccount)) {
        return Response.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authorized for source account' } }, { status: 403 });
      }
      if (toAccount !== 'main' && !accountIds.includes(toAccount)) {
        return Response.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authorized for destination account' } }, { status: 403 });
      }
      
      const nowISO = new Date().toISOString();
      auditLog('TRANSFER_FUNDS', user.id, { fromAccount, toAccount, currency, amount });
      
      // Create transfer record
      const transfer = await base44.asServiceRole.entities.ExchangeTransfer.create({
        user_id: user.id,
        provider: 'OKX',
        from_account: fromAccount,
        from_account_type: fromType,
        to_account: toAccount,
        to_account_type: toType,
        currency,
        amount,
        status: 'COMPLETED', // Simulated - in production would call OKX API
        external_transfer_id: `tf_${Date.now()}`,
        completed_at: nowISO,
        created_at: nowISO
      });
      
      return Response.json({
        ok: true,
        data: {
          transferId: transfer.id,
          status: 'COMPLETED'
        }
      });
    }
    
    // ==================== GET BALANCES ====================
    if (action === 'getBalances') {
      const { accountId } = params;

      const accountResult = await resolveAccount(base44, user.id, accountId);
      if (!accountResult.ok) return Response.json(accountResult, { status: 404 });
      const account = accountResult.data;

      const credentialResult = await resolveCredential(base44, account);
      if (!credentialResult.ok) return Response.json(credentialResult, { status: 400 });

      const result = await okxRequest({
        credential: credentialResult.data,
        method: 'GET',
        path: '/api/v5/account/balance',
        isTradingEndpoint: true,
      });

      if (!result.ok) {
        return Response.json(okResponse(false, null, {
          code: 'FETCH_FAILED',
          message: result.error?.okxMsg || 'Failed to fetch balances',
          okxCode: result.error?.okxCode,
          okxMsg: result.error?.okxMsg,
        }), { status: 502 });
      }

      const balances = (result.data?.data?.[0]?.details || []).map(d => ({
        currency: d.ccy,
        available: parseFloat(d.availBal || 0),
        frozen: parseFloat(d.frozenBal || 0),
        total: parseFloat(d.cashBal || d.eq || 0),
      }));

      return Response.json({ ok: true, data: { balances } });
    }
    
    // ==================== GET DEPOSIT ADDRESS ====================
    if (action === 'getDepositAddress') {
      const { accountId, currency = 'USDT', chain } = params;

      const accountResult = await resolveAccount(base44, user.id, accountId);
      if (!accountResult.ok) return Response.json(accountResult, { status: 404 });
      const account = accountResult.data;

      const cacheKey = `deposit:${account.id}:${currency}:${chain || 'any'}`;
      const cached = getCached(cacheKey, DEPOSIT_CACHE_MS);
      if (cached) return Response.json({ ok: true, data: { addresses: cached, fromCache: true } });

      if (account.deposit_addresses_json?.[currency]) {
        const entry = account.deposit_addresses_json[currency];
        if (Array.isArray(entry) && entry.length) {
          setCache(cacheKey, entry);
          return Response.json({ ok: true, data: { addresses: entry, fromCache: true } });
        }
      }

      const credentialResult = await resolveCredential(base44, account);
      if (!credentialResult.ok) return Response.json(credentialResult, { status: 400 });

      const result = await okxRequest({
        credential: credentialResult.data,
        method: 'GET',
        path: '/api/v5/asset/deposit-address',
        query: { ccy: currency, chain },
        isTradingEndpoint: false,
      });

      if (!result.ok) {
        return Response.json(okResponse(false, null, {
          code: 'FETCH_FAILED',
          message: result.error?.okxMsg || 'Failed to fetch deposit address',
          okxCode: result.error?.okxCode,
          okxMsg: result.error?.okxMsg,
        }), { status: 502 });
      }

      const addresses = (result.data?.data || []).map(d => ({
        chain: d.chain || d.ccy,
        address: d.addr,
        tag: d.tag || d.memo || null,
        to: d.to,
        selected: d.selected,
      }));

      const updatedDeposits = { ...(account.deposit_addresses_json || {}), [currency]: addresses };
      await base44.asServiceRole.entities.UserExchangeAccount.update(account.id, {
        deposit_addresses_json: updatedDeposits,
        deposit_addresses_fetched_at: new Date().toISOString(),
      });

      setCache(cacheKey, addresses);
      return Response.json({ ok: true, data: { addresses, fromCache: false } });
    }
    
    // ==================== REQUEST WITHDRAWAL ====================
    if (action === 'requestWithdrawal') {
      const { accountId, currency = 'USDT', chain, address, amount, addressTag, fee = 0 } = params;

      if (!chain || !address || !amount || amount <= 0) {
        return Response.json({ ok: false, error: { code: 'INVALID_PARAMS', message: 'chain, address, amount required' } }, { status: 400 });
      }

      const nowISO = new Date().toISOString();
      const now = new Date();

      const accountResult = await resolveAccount(base44, user.id, accountId);
      if (!accountResult.ok) return Response.json(accountResult, { status: 404 });

      const allowlist = await base44.entities.AddressAllowlist.filter({
        user_id: user.id,
        address,
        chain,
        currency,
        status: 'ACTIVE',
      });
      const isAllowlisted = allowlist && allowlist.length > 0;

      let cooldownUntil = null;
      if (!isAllowlisted) {
        const cooldownDate = new Date(now.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);
        cooldownUntil = cooldownDate.toISOString();
        await base44.asServiceRole.entities.AddressAllowlist.create({
          user_id: user.id,
          address,
          chain,
          currency,
          label: 'Auto-added',
          is_verified: false,
          verification_method: 'NONE',
          cooldown_until: cooldownUntil,
          status: 'ACTIVE',
          created_at: nowISO,
        });

        return Response.json(okResponse(false, null, {
          code: 'ADDRESS_NOT_ALLOWLISTED',
          message: 'Address added to allowlist. Retry after cooldown.',
          cooldownUntil,
        }), { status: 403 });
      }

      const entry = allowlist[0];
      if (entry.cooldown_until && new Date(entry.cooldown_until) > now) {
        return Response.json(okResponse(false, null, {
          code: 'ADDRESS_IN_COOLDOWN',
          message: `Address is in cooldown until ${entry.cooldown_until}`,
          cooldownUntil: entry.cooldown_until,
        }), { status: 403 });
      }

      const confirmToken = generateConfirmToken();
      const confirmExpires = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

      auditLog('REQUEST_WITHDRAWAL', user.id, { currency, chain, address, amount });

      const withdrawal = await base44.asServiceRole.entities.WithdrawalRequest.create({
        user_id: user.id,
        user_exchange_account_id: accountResult.data.id,
        provider: 'OKX',
        currency,
        chain,
        address,
        address_tag: addressTag || null,
        amount,
        fee,
        net_amount: amount - fee,
        status: 'PENDING_CONFIRM',
        risk_score: 0,
        risk_flags: [],
        is_allowlisted: true,
        allowlist_added_at: entry.created_at || nowISO,
        cooldown_until: null,
        confirmation_token: confirmToken,
        confirmation_expires_at: confirmExpires,
        created_at: nowISO,
      });

      return Response.json({
        ok: true,
        data: {
          withdrawalId: withdrawal.id,
          status: withdrawal.status,
          requiresConfirmation: true,
          confirmationExpiresAt: confirmExpires,
        },
      });
    }
    
    // ==================== CONFIRM WITHDRAWAL ====================
    if (action === 'confirmWithdrawal') {
      const { withdrawalId, confirmationToken } = params;
      
      if (!withdrawalId || !confirmationToken) {
        return Response.json({ ok: false, error: { code: 'INVALID_PARAMS', message: 'withdrawalId and confirmationToken required' } }, { status: 400 });
      }
      
      const withdrawals = await base44.entities.WithdrawalRequest.filter({ id: withdrawalId, user_id: user.id });
      if (!withdrawals?.length) {
        return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Withdrawal not found' } }, { status: 404 });
      }
      
      const withdrawal = withdrawals[0];
      
      if (withdrawal.status !== 'PENDING_CONFIRM') {
        return Response.json({ ok: false, error: { code: 'INVALID_STATUS', message: `Cannot confirm withdrawal in ${withdrawal.status} status` } }, { status: 400 });
      }
      
      if (withdrawal.confirmation_token !== confirmationToken) {
        return Response.json({ ok: false, error: { code: 'INVALID_TOKEN', message: 'Invalid confirmation token' } }, { status: 400 });
      }
      
      if (withdrawal.confirmation_expires_at && new Date(withdrawal.confirmation_expires_at) < new Date()) {
        return Response.json({ ok: false, error: { code: 'TOKEN_EXPIRED', message: 'Confirmation token expired' } }, { status: 400 });
      }
      
      const allowlist = await base44.entities.AddressAllowlist.filter({
        user_id: user.id,
        address: withdrawal.address,
        chain: withdrawal.chain,
        currency: withdrawal.currency,
        status: 'ACTIVE',
      });

      if (!allowlist?.length) {
        return Response.json({ ok: false, error: { code: 'ADDRESS_NOT_ALLOWLISTED', message: 'Address not allowlisted' } }, { status: 403 });
      }

      // Check cooldown
      if (withdrawal.cooldown_until && new Date(withdrawal.cooldown_until) > new Date()) {
        return Response.json({ 
          ok: false, 
          error: { 
            code: 'IN_COOLDOWN', 
            message: `Address is in cooldown until ${withdrawal.cooldown_until}`,
            cooldownUntil: withdrawal.cooldown_until
          }
        }, { status: 400 });
      }
      
      const nowISO = new Date().toISOString();
      auditLog('CONFIRM_WITHDRAWAL', user.id, { withdrawalId, amount: withdrawal.amount });
      
      const accountResult = await resolveAccount(base44, user.id, withdrawal.user_exchange_account_id);
      if (!accountResult.ok) return Response.json(accountResult, { status: 404 });

      const credentialResult = await resolveCredential(base44, accountResult.data);
      if (!credentialResult.ok) return Response.json(credentialResult, { status: 400 });

      const balanceResult = await okxRequest({
        credential: credentialResult.data,
        method: 'GET',
        path: '/api/v5/account/balance',
        isTradingEndpoint: true,
      });

      if (!balanceResult.ok) {
        return Response.json(okResponse(false, null, {
          code: 'BALANCE_CHECK_FAILED',
          message: balanceResult.error?.okxMsg || 'Failed to check balances',
          okxCode: balanceResult.error?.okxCode,
          okxMsg: balanceResult.error?.okxMsg,
        }), { status: 502 });
      }

      const balanceEntry = (balanceResult.data?.data?.[0]?.details || []).find((d) => d.ccy === withdrawal.currency);
      const available = parseFloat(balanceEntry?.availBal || '0');
      if (available < withdrawal.amount) {
        return Response.json(okResponse(false, null, {
          code: 'INSUFFICIENT_BALANCE',
          message: 'Insufficient balance for withdrawal',
        }), { status: 400 });
      }

      const withdrawalResult = await okxRequest({
        credential: credentialResult.data,
        method: 'POST',
        path: '/api/v5/asset/withdrawal',
        body: {
          ccy: withdrawal.currency,
          amt: String(withdrawal.amount),
          fee: String(withdrawal.fee || 0),
          dest: '4',
          toAddr: withdrawal.address,
          chain: withdrawal.chain,
        },
        isTradingEndpoint: false,
      });

      if (!withdrawalResult.ok) {
        return Response.json(okResponse(false, null, {
          code: 'WITHDRAWAL_FAILED',
          message: withdrawalResult.error?.okxMsg || 'Withdrawal failed',
          okxCode: withdrawalResult.error?.okxCode,
          okxMsg: withdrawalResult.error?.okxMsg,
        }), { status: 502 });
      }

      const okxWithdrawalId = withdrawalResult.data?.data?.[0]?.wdId || null;

      await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawalId, {
        status: 'SUBMITTED',
        confirmed_at: nowISO,
        external_withdrawal_id: okxWithdrawalId,
      });

      return Response.json({
        ok: true,
        data: {
          withdrawalId,
          status: 'SUBMITTED',
          externalWithdrawalId: okxWithdrawalId,
        },
      });
    }
    
    // ==================== GET WITHDRAWAL HISTORY ====================
    if (action === 'getWithdrawHistory') {
      const { status, limit = 50 } = params;
      
      let query = { user_id: user.id, provider: 'OKX' };
      if (status) query.status = status;
      
      const withdrawals = await base44.entities.WithdrawalRequest.filter(query, '-created_date', limit);
      
      return Response.json({
        ok: true,
        data: (withdrawals || []).map(w => ({
          id: w.id,
          currency: w.currency,
          chain: w.chain,
          address: w.address,
          amount: w.amount,
          fee: w.fee,
          status: w.status,
          txHash: w.tx_hash,
          createdAt: w.created_at || w.created_date
        }))
      });
    }
    
    // ==================== GET DEPOSIT HISTORY ====================
    if (action === 'getDepositHistory') {
      // In production: Call OKX API
      return Response.json({ ok: true, data: [] });
    }
    
    return Response.json({ ok: false, error: { code: 'INVALID_ACTION', message: 'Invalid action' } }, { status: 400 });
    
  } catch (error) {
    console.error('[OKX_TRANSFER_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});