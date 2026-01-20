// @ts-nocheck
/// <reference lib="deno.ns" />
// OKX User Account - User-facing balance, positions, orders for assigned sub-accounts

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

async function getUserOkxCredential(base44, userId) {
  // Find user's active OKX account
  const accounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({
    user_id: userId,
    provider: 'OKX',
    status: 'ACTIVE'
  });

  if (!accounts?.length) {
    return { ok: false, error: { code: 'NO_ACCOUNT', message: 'No active OKX account' } };
  }

  const account = accounts[0];

  // Get credentials
  const credentials = await base44.asServiceRole.entities.ExchangeCredential.filter({
    user_exchange_account_id: account.id,
    provider: 'OKX',
    status: 'ACTIVE'
  });

  if (!credentials?.length) {
    return { ok: false, error: { code: 'NO_CREDENTIALS', message: 'No active credentials' } };
  }

  const cred = credentials[0];

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

    console.log('[OKX_USER_ACCOUNT] Action:', action, 'User:', user.email);

    // GET MY OKX ACCOUNT - Returns account info + balance
    if (action === 'getMyAccount') {
      const credResult = await getUserOkxCredential(base44, user.id);
      
      if (!credResult.ok) {
        return Response.json({ ok: true, data: { hasAccount: false } });
      }

      const { account, credential } = credResult.data;

      // Fetch balances from OKX
      const [tradingRes, fundingRes] = await Promise.all([
        okxRequest({ credential, method: 'GET', path: '/api/v5/account/balance', isTradingEndpoint: true }),
        okxRequest({ credential, method: 'GET', path: '/api/v5/asset/balances', isTradingEndpoint: false }),
      ]);

      const tradingDetails = tradingRes.data?.data?.[0]?.details || [];
      const fundingDetails = fundingRes.data?.data || [];

      const tradingUsdt = parseFloat(tradingDetails.find(d => d.ccy === 'USDT')?.cashBal || '0');
      const fundingUsdt = parseFloat(fundingDetails.find(d => d.ccy === 'USDT')?.bal || '0');
      const totalEquity = parseFloat(tradingRes.data?.data?.[0]?.totalEq || '0');

      // Update cached balance
      const now = new Date().toISOString();
      await base44.asServiceRole.entities.UserExchangeAccount.update(account.id, {
        last_balance_usdt: tradingUsdt + fundingUsdt,
        last_sync_at: now,
        updated_at: now
      });

      return Response.json({
        ok: true,
        data: {
          hasAccount: true,
          accountId: account.id,
          externalAccountId: account.external_account_id,
          accountLabel: account.account_label,
          status: account.status,
          provider: 'OKX',
          balances: {
            tradingUsdt,
            fundingUsdt,
            totalUsdt: tradingUsdt + fundingUsdt,
            totalEquity
          },
          accountMode: account.account_mode,
          marginMode: account.margin_mode,
          defaultLeverage: account.default_leverage,
          lastSync: now
        }
      });
    }

    // GET BALANCE ONLY - Lightweight balance check
    if (action === 'getBalance') {
      const credResult = await getUserOkxCredential(base44, user.id);
      
      if (!credResult.ok) {
        return Response.json({ ok: true, data: { hasAccount: false, balance: 0 } });
      }

      const { account, credential } = credResult.data;

      // Fetch trading balance only for speed
      const tradingRes = await okxRequest({
        credential,
        method: 'GET',
        path: '/api/v5/account/balance',
        isTradingEndpoint: true
      });

      const tradingUsdt = parseFloat(tradingRes.data?.data?.[0]?.details?.find(d => d.ccy === 'USDT')?.cashBal || '0');
      const totalEquity = parseFloat(tradingRes.data?.data?.[0]?.totalEq || '0');

      return Response.json({
        ok: true,
        data: {
          hasAccount: true,
          accountId: account.id,
          balance: totalEquity || tradingUsdt,
          tradingUsdt,
          totalEquity
        }
      });
    }

    // GET POSITIONS
    if (action === 'getPositions') {
      const credResult = await getUserOkxCredential(base44, user.id);
      
      if (!credResult.ok) {
        return Response.json({ ok: false, error: credResult.error });
      }

      const { credential } = credResult.data;

      const posRes = await okxRequest({
        credential,
        method: 'GET',
        path: '/api/v5/account/positions',
        isTradingEndpoint: true
      });

      if (!posRes.ok) {
        return Response.json({ ok: false, error: posRes.error });
      }

      const positions = (posRes.data?.data || [])
        .filter(pos => parseFloat(pos.pos || '0') !== 0)
        .map(pos => ({
          instId: pos.instId,
          posSide: pos.posSide,
          size: parseFloat(pos.pos || '0'),
          avgPx: parseFloat(pos.avgPx || '0'),
          markPx: parseFloat(pos.markPx || '0'),
          upl: parseFloat(pos.upl || '0'),
          uplRatio: parseFloat(pos.uplRatio || '0'),
          lever: parseFloat(pos.lever || '0'),
          liqPx: parseFloat(pos.liqPx || '0'),
          margin: parseFloat(pos.margin || '0'),
          mgnMode: pos.mgnMode,
          cTime: pos.cTime,
          uTime: pos.uTime
        }));

      return Response.json({ ok: true, data: positions });
    }

    // GET OPEN ORDERS
    if (action === 'getOrders') {
      const credResult = await getUserOkxCredential(base44, user.id);
      
      if (!credResult.ok) {
        return Response.json({ ok: false, error: credResult.error });
      }

      const { credential } = credResult.data;

      const orderRes = await okxRequest({
        credential,
        method: 'GET',
        path: '/api/v5/trade/orders-pending',
        query: { instType: 'SWAP' },
        isTradingEndpoint: true
      });

      if (!orderRes.ok) {
        return Response.json({ ok: false, error: orderRes.error });
      }

      const orders = (orderRes.data?.data || []).map(o => ({
        ordId: o.ordId,
        instId: o.instId,
        side: o.side,
        posSide: o.posSide,
        ordType: o.ordType,
        sz: parseFloat(o.sz || '0'),
        px: parseFloat(o.px || '0'),
        state: o.state,
        lever: parseFloat(o.lever || '0'),
        cTime: o.cTime,
        uTime: o.uTime
      }));

      return Response.json({ ok: true, data: orders });
    }

    // CHECK ACCOUNT EXISTS - Fast check without balance
    if (action === 'checkAccount') {
      const accounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({
        user_id: user.id,
        provider: 'OKX',
        status: 'ACTIVE'
      });

      if (!accounts?.length) {
        return Response.json({ ok: true, data: { hasAccount: false } });
      }

      const account = accounts[0];
      return Response.json({
        ok: true,
        data: {
          hasAccount: true,
          accountId: account.id,
          externalAccountId: account.external_account_id,
          accountLabel: account.account_label,
          status: account.status,
          lastBalanceUsdt: account.last_balance_usdt,
          lastSync: account.last_sync_at
        }
      });
    }

    return Response.json({ ok: false, error: { code: 'INVALID_ACTION' } }, { status: 400 });

  } catch (error) {
    console.error('[OKX_USER_ACCOUNT_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});