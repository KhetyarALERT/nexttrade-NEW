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
  
  console.log('[OKX_REQUEST]', method, requestPath, bodyStr ? bodyStr.substring(0, 200) : '');

  try {
    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers,
      body: method.toUpperCase() === 'GET' ? undefined : (bodyStr || undefined),
    });
    const data = await res.json().catch(() => ({}));
    
    console.log('[OKX_RESPONSE]', res.status, JSON.stringify(data).substring(0, 500));

    if (!res.ok || (data?.code && data.code !== '0')) {
      return { ok: false, error: { httpStatus: res.status, okxCode: data?.code, okxMsg: data?.msg } };
    }
    return { ok: true, data };
  } catch (error) {
    console.log('[OKX_ERROR]', error?.message);
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

    // GET MY OKX ACCOUNT - Returns account info + balance + positions for margin calc
    if (action === 'getMyAccount') {
      const credResult = await getUserOkxCredential(base44, user.id);
      
      if (!credResult.ok) {
        return Response.json({ ok: true, data: { hasAccount: false } });
      }

      const { account, credential } = credResult.data;

      // Fetch balances and positions from OKX
      const [tradingRes, fundingRes, posRes] = await Promise.all([
        okxRequest({ credential, method: 'GET', path: '/api/v5/account/balance', isTradingEndpoint: true }),
        okxRequest({ credential, method: 'GET', path: '/api/v5/asset/balances', isTradingEndpoint: false }),
        okxRequest({ credential, method: 'GET', path: '/api/v5/account/positions', isTradingEndpoint: true }),
      ]);

      const tradingDetails = tradingRes.data?.data?.[0]?.details || [];
      const fundingDetails = fundingRes.data?.data || [];
      const positions = (posRes.data?.data || []).filter(p => parseFloat(p.pos || '0') !== 0);

      // Calculate margin used by open positions
      const marginUsed = positions.reduce((sum, pos) => sum + parseFloat(pos.margin || '0'), 0);
      const unrealizedPnl = positions.reduce((sum, pos) => sum + parseFloat(pos.upl || '0'), 0);

      const tradingUsdt = parseFloat(tradingDetails.find(d => d.ccy === 'USDT')?.cashBal || '0');
      const fundingUsdt = parseFloat(fundingDetails.find(d => d.ccy === 'USDT')?.bal || '0');
      const totalEquity = parseFloat(tradingRes.data?.data?.[0]?.totalEq || '0');
      
      // Available balance = total equity - margin used (what user can actually use for new trades)
      const availableBalance = parseFloat(tradingRes.data?.data?.[0]?.details?.find(d => d.ccy === 'USDT')?.availBal || '0');

      // Build perCcy object for all currencies (funding + trading combined)
      const perCcy = {};
      
      // Add funding balances
      for (const f of fundingDetails) {
        const ccy = f.ccy;
        if (!perCcy[ccy]) perCcy[ccy] = { funding: 0, trading: 0, total: 0, availFunding: 0, availTrading: 0 };
        perCcy[ccy].funding = parseFloat(f.bal || '0');
        perCcy[ccy].availFunding = parseFloat(f.availBal || f.bal || '0');
      }
      
      // Add trading balances
      for (const t of tradingDetails) {
        const ccy = t.ccy;
        if (!perCcy[ccy]) perCcy[ccy] = { funding: 0, trading: 0, total: 0, availFunding: 0, availTrading: 0 };
        perCcy[ccy].trading = parseFloat(t.cashBal || '0');
        perCcy[ccy].availTrading = parseFloat(t.availBal || '0');
      }
      
      // Calculate totals
      for (const ccy of Object.keys(perCcy)) {
        perCcy[ccy].total = perCcy[ccy].funding + perCcy[ccy].trading;
      }

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
            totalEquity,
            availableBalance,
            marginUsed,
            unrealizedPnl
          },
          perCcy,
          positionCount: positions.length,
          accountMode: account.account_mode,
          marginMode: account.margin_mode,
          defaultLeverage: account.default_leverage || 5, // Default to 5x for regional limits
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

    // GET DEPOSIT ADDRESS - Fetch deposit addresses for user's OKX subaccount
    if (action === 'getDepositAddress') {
      const { ccy = 'USDT' } = params;
      
      const credResult = await getUserOkxCredential(base44, user.id);
      
      if (!credResult.ok) {
        return Response.json({ ok: false, error: credResult.error });
      }

      const { credential } = credResult.data;

      // Call OKX deposit address endpoint
      const depositRes = await okxRequest({
        credential,
        method: 'GET',
        path: '/api/v5/asset/deposit-address',
        query: { ccy },
        isTradingEndpoint: false
      });

      if (!depositRes.ok) {
        return Response.json({ ok: false, error: depositRes.error });
      }

      const addresses = (depositRes.data?.data || []).map(addr => ({
        chain: addr.chain,
        address: addr.addr,
        tag: addr.tag || addr.memo || null,
        minDeposit: addr.minDep,
        selected: addr.selected === true,
        contractAddr: addr.ctAddr || null
      }));

      return Response.json({ ok: true, data: addresses });
    }

    // GET ALL DEPOSIT ADDRESSES - Fetch deposit addresses for multiple currencies
    if (action === 'getAllDepositAddresses') {
      const currencies = params.currencies || ['USDT', 'BTC', 'ETH'];
      
      const credResult = await getUserOkxCredential(base44, user.id);
      
      if (!credResult.ok) {
        return Response.json({ ok: false, error: credResult.error });
      }

      const { credential } = credResult.data;

      const results = {};
      
      // Fetch addresses for each currency in parallel
      const promises = currencies.map(async (ccy) => {
        try {
          const depositRes = await okxRequest({
            credential,
            method: 'GET',
            path: '/api/v5/asset/deposit-address',
            query: { ccy },
            isTradingEndpoint: false
          });

          if (depositRes.ok && depositRes.data?.data) {
            results[ccy] = depositRes.data.data.map(addr => ({
              chain: addr.chain,
              address: addr.addr,
              tag: addr.tag || addr.memo || null,
              minDeposit: addr.minDep,
              selected: addr.selected === true,
              contractAddr: addr.ctAddr || null
            }));
          } else {
            results[ccy] = { error: depositRes.error?.okxMsg || 'Failed to fetch' };
          }
        } catch (err) {
          results[ccy] = { error: err.message };
        }
      });

      await Promise.all(promises);

      return Response.json({ ok: true, data: results });
    }

    // INTERNAL TRANSFER - Transfer between funding and trading accounts
    if (action === 'transfer') {
      const { ccy = 'USDT', amount, from, to, idempotencyKey } = params;
      
      if (!amount || amount <= 0) {
        return Response.json({ ok: false, error: { code: 'INVALID_AMOUNT', message: 'Amount must be positive' } }, { status: 400 });
      }
      
      if (!from || !to) {
        return Response.json({ ok: false, error: { code: 'MISSING_PARAMS', message: 'from and to required' } }, { status: 400 });
      }
      
      // Map user-friendly names to OKX account types
      // OKX account types: 6 = Funding, 18 = Trading
      const accountTypeMap = {
        'funding': '6',
        'trading': '18',
        'spot': '1',  // Spot account if needed
      };
      
      const fromType = accountTypeMap[from.toLowerCase()];
      const toType = accountTypeMap[to.toLowerCase()];
      
      if (!fromType || !toType) {
        return Response.json({ ok: false, error: { code: 'INVALID_ACCOUNT_TYPE', message: 'Invalid from/to account type. Use: funding, trading' } }, { status: 400 });
      }
      
      if (fromType === toType) {
        return Response.json({ ok: false, error: { code: 'SAME_ACCOUNT', message: 'Cannot transfer to same account' } }, { status: 400 });
      }
      
      const credResult = await getUserOkxCredential(base44, user.id);
      
      if (!credResult.ok) {
        return Response.json({ ok: false, error: credResult.error });
      }

      const { account, credential } = credResult.data;
      const now = new Date().toISOString();

      // Idempotency check - prevent duplicate transfers
      if (idempotencyKey) {
        const existing = await base44.asServiceRole.entities.ExchangeTransfer.filter({
          user_id: user.id,
          provider: 'OKX',
          external_transfer_id: idempotencyKey
        });
        if (existing?.length) {
          console.log('[OKX_TRANSFER] Idempotent hit:', idempotencyKey);
          return Response.json({ ok: true, data: { 
            transId: existing[0].external_transfer_id,
            ccy: existing[0].currency,
            from: existing[0].from_account_type,
            to: existing[0].to_account_type,
            amount: existing[0].amount,
            status: existing[0].status,
            existing: true
          }});
        }
      }

      // Create PENDING transfer record before calling OKX
      const transferRecord = await base44.asServiceRole.entities.ExchangeTransfer.create({
        user_id: user.id,
        provider: 'OKX',
        from_account: account.external_account_id || 'self',
        from_account_type: from.toLowerCase(),
        to_account: account.external_account_id || 'self',
        to_account_type: to.toLowerCase(),
        currency: ccy,
        amount: parseFloat(amount),
        status: 'PENDING',
        created_at: now
      });

      // Execute the transfer
      const transferRes = await okxRequest({
        credential,
        method: 'POST',
        path: '/api/v5/asset/transfer',
        body: {
          ccy,
          amt: String(amount),
          from: fromType,
          to: toType,
          type: '0' // 0 = within account, not sub-account transfer
        },
        isTradingEndpoint: false
      });

      const result = transferRes.data?.data?.[0];
      const completedAt = new Date().toISOString();

      // Check for OKX-level or inner error
      if (!transferRes.ok || (result?.code && result.code !== '0')) {
        const errMsg = transferRes.error?.okxMsg || result?.msg || 'Transfer failed';
        // Update record to FAILED
        await base44.asServiceRole.entities.ExchangeTransfer.update(transferRecord.id, {
          status: 'FAILED',
          error_message: errMsg,
          completed_at: completedAt
        });
        return Response.json({ ok: false, error: { code: result?.code || 'TRANSFER_FAILED', message: errMsg } });
      }

      // Update record to COMPLETED
      await base44.asServiceRole.entities.ExchangeTransfer.update(transferRecord.id, {
        status: 'COMPLETED',
        external_transfer_id: result?.transId || idempotencyKey || null,
        completed_at: completedAt
      });

      return Response.json({
        ok: true,
        data: {
          transId: result?.transId,
          ccy: result?.ccy || ccy,
          from: from,
          to: to,
          amount: parseFloat(result?.amt || amount),
          status: 'COMPLETED'
        }
      });
    }

    // GET TRANSFER HISTORY
    if (action === 'getTransferHistory') {
      const { ccy, limit = 20 } = params;
      
      const credResult = await getUserOkxCredential(base44, user.id);
      
      if (!credResult.ok) {
        return Response.json({ ok: false, error: credResult.error });
      }

      const { credential } = credResult.data;

      const query = { limit: String(limit), type: '0' };
      if (ccy) query.ccy = ccy;

      const historyRes = await okxRequest({
        credential,
        method: 'GET',
        path: '/api/v5/asset/transfer-state',
        query,
        isTradingEndpoint: false
      });

      // Note: OKX may not have a direct "transfer history" endpoint
      // This tries transfer-state which requires transId
      // For now return empty if not supported
      if (!historyRes.ok) {
        return Response.json({ ok: true, data: [] });
      }

      return Response.json({ ok: true, data: historyRes.data?.data || [] });
    }

    // GET FUNDING ACCOUNT ASSETS - Detailed funding balance with all currencies
    if (action === 'getFundingAssets') {
      const credResult = await getUserOkxCredential(base44, user.id);
      
      if (!credResult.ok) {
        return Response.json({ ok: false, error: credResult.error });
      }

      const { credential } = credResult.data;

      const fundingRes = await okxRequest({
        credential,
        method: 'GET',
        path: '/api/v5/asset/balances',
        isTradingEndpoint: false
      });

      if (!fundingRes.ok) {
        return Response.json({ ok: false, error: fundingRes.error });
      }

      const assets = (fundingRes.data?.data || []).map(a => ({
        ccy: a.ccy,
        balance: parseFloat(a.bal || '0'),
        available: parseFloat(a.availBal || a.bal || '0'),
        frozen: parseFloat(a.frozenBal || '0')
      })).filter(a => a.balance > 0);

      return Response.json({ ok: true, data: assets });
    }

    // GET TRADING ACCOUNT ASSETS - Detailed trading balance with all currencies
    if (action === 'getTradingAssets') {
      const credResult = await getUserOkxCredential(base44, user.id);
      
      if (!credResult.ok) {
        return Response.json({ ok: false, error: credResult.error });
      }

      const { credential } = credResult.data;

      const tradingRes = await okxRequest({
        credential,
        method: 'GET',
        path: '/api/v5/account/balance',
        isTradingEndpoint: true
      });

      if (!tradingRes.ok) {
        return Response.json({ ok: false, error: tradingRes.error });
      }

      const details = tradingRes.data?.data?.[0]?.details || [];
      const totalEq = parseFloat(tradingRes.data?.data?.[0]?.totalEq || '0');
      
      const assets = details.map(d => ({
        ccy: d.ccy,
        balance: parseFloat(d.cashBal || '0'),
        available: parseFloat(d.availBal || '0'),
        equity: parseFloat(d.eq || d.cashBal || '0'),
        frozen: parseFloat(d.frozenBal || '0'),
        upl: parseFloat(d.upl || '0')
      })).filter(a => a.balance > 0 || a.equity > 0);

      return Response.json({ 
        ok: true, 
        data: { 
          assets, 
          totalEquity: totalEq 
        } 
      });
    }

    // GET DEPOSIT HISTORY
    if (action === 'getDepositHistory') {
      const { ccy, limit = 20 } = params;
      
      const credResult = await getUserOkxCredential(base44, user.id);
      
      if (!credResult.ok) {
        return Response.json({ ok: false, error: credResult.error });
      }

      const { credential } = credResult.data;

      const query = { limit: String(limit) };
      if (ccy) query.ccy = ccy;

      const historyRes = await okxRequest({
        credential,
        method: 'GET',
        path: '/api/v5/asset/deposit-history',
        query,
        isTradingEndpoint: false
      });

      if (!historyRes.ok) {
        return Response.json({ ok: false, error: historyRes.error });
      }

      const deposits = (historyRes.data?.data || []).map(d => ({
        txId: d.txId,
        ccy: d.ccy,
        chain: d.chain,
        amount: parseFloat(d.amt || '0'),
        from: d.from,
        to: d.to,
        state: d.state, // 0: waiting, 1: deposit credited, 2: complete
        stateLabel: d.state === '0' ? 'Pending' : d.state === '1' ? 'Credited' : d.state === '2' ? 'Complete' : 'Unknown',
        ts: d.ts
      }));

      return Response.json({ ok: true, data: deposits });
    }

    // PLACE ORDER
    if (action === 'placeOrder') {
      const credResult = await getUserOkxCredential(base44, user.id);
      
      if (!credResult.ok) {
        return Response.json({ ok: false, error: credResult.error });
      }

      const { credential } = credResult.data;
      const { instId, side, orderType, size, price, reduceOnly, leverage } = params;

      if (!instId || !side || !size) {
        return Response.json({ ok: false, error: { code: 'MISSING_PARAMS', message: 'instId, side, size required' } }, { status: 400 });
      }

      // Get instrument info to properly calculate contract size
      const instRes = await fetch(`${getOkxBaseUrl()}/api/v5/public/instruments?instType=SWAP&instId=${encodeURIComponent(instId)}`);
      const instData = await instRes.json().catch(() => ({}));
      const instrument = instData?.data?.[0];
      
      if (!instrument) {
        return Response.json({ ok: false, error: { code: 'INVALID_INSTRUMENT', message: `Unknown instrument: ${instId}` } }, { status: 400 });
      }

      const ctVal = parseFloat(instrument.ctVal || '1'); // Contract value in base currency
      const minSz = parseFloat(instrument.minSz || '1'); // Minimum order size in contracts
      const lotSz = parseFloat(instrument.lotSz || '1'); // Lot size for rounding

      // OKX sz is in contracts, NOT in base asset quantity
      // If user passes quantity in base asset, convert to contracts
      // contracts = quantity / ctVal
      let contracts = Math.abs(parseFloat(size));
      
      // If the size looks like it's already in small contract units (e.g., < 100 for most coins)
      // and the instrument's ctVal is small (< 1), treat it as base asset quantity
      // Otherwise if ctVal >= 1, user is probably passing contracts directly
      if (ctVal > 0 && ctVal < 1) {
        // For USDT-margined swaps, ctVal is typically small (e.g., 0.001 for BTC)
        // User passes quantity in base asset, convert to contracts
        contracts = contracts / ctVal;
      }
      
      // Round to lot size and ensure minimum
      contracts = Math.max(minSz, Math.floor(contracts / lotSz) * lotSz);
      
      // Ensure it's an integer if lotSz is 1
      if (lotSz === 1) {
        contracts = Math.floor(contracts);
      }

      console.log('[OKX_USER_ACCOUNT] Order calc:', { 
        inputSize: size, 
        ctVal, 
        minSz, 
        lotSz, 
        calculatedContracts: contracts 
      });

      // Get account config to determine position mode (net vs hedge)
      const configRes = await okxRequest({
        credential,
        method: 'GET',
        path: '/api/v5/account/config',
        isTradingEndpoint: true
      });
      
      const posMode = configRes.data?.data?.[0]?.posMode || 'net_mode';
      const isHedgeMode = posMode === 'long_short_mode';
      console.log('[OKX_USER_ACCOUNT] Account pos mode:', posMode, 'isHedge:', isHedgeMode);

      // Set leverage first if provided (cap at 5x for regional restrictions)
      if (leverage && Number.isFinite(Number(leverage))) {
        const leverRes = await okxRequest({
          credential,
          method: 'POST',
          path: '/api/v5/account/set-leverage',
          body: {
            instId,
            lever: String(Math.min(5, Math.max(1, Math.floor(leverage)))), // Cap at 5x for regional limits
            mgnMode: 'cross',
            posSide: isHedgeMode ? (side.toLowerCase() === 'buy' ? 'long' : 'short') : undefined
          },
          isTradingEndpoint: true
        });
        console.log('[OKX_USER_ACCOUNT] Set leverage result:', JSON.stringify(leverRes));
      }

      // Determine posSide based on account mode
      // Net mode: don't send posSide at all (OKX will use default)
      // Hedge mode: buy -> long, sell -> short (for opening positions)
      let posSide;
      if (isHedgeMode) {
        // In hedge mode, side=buy opens long, side=sell opens short
        posSide = side.toLowerCase() === 'buy' ? 'long' : 'short';
      }
      // If net mode, don't include posSide

      // Place the order
      const orderBody = {
        instId,
        tdMode: 'cross',
        side: side.toLowerCase(),
        ordType: orderType === 'limit' ? 'limit' : 'market',
        sz: String(contracts),
      };
      
      // Only add posSide for hedge mode
      if (posSide) {
        orderBody.posSide = posSide;
      }

      // Only set reduceOnly if it's true (OKX doesn't like reduceOnly: false)
      if (reduceOnly) {
        orderBody.reduceOnly = true;
      }

      if (orderType === 'limit' && price) {
        orderBody.px = String(price);
      }

      console.log('[OKX_USER_ACCOUNT] Placing order:', JSON.stringify(orderBody));

      const orderRes = await okxRequest({
        credential,
        method: 'POST',
        path: '/api/v5/trade/order',
        body: orderBody,
        isTradingEndpoint: true
      });

      console.log('[OKX_USER_ACCOUNT] Order raw response:', JSON.stringify(orderRes));
      
      // OKX returns data array even on partial failures - check inner sCode
      if (orderRes.data?.data?.[0]) {
        const innerResult = orderRes.data.data[0];
        if (innerResult.sCode && innerResult.sCode !== '0') {
          console.log('[OKX_USER_ACCOUNT] Order inner error:', innerResult.sCode, innerResult.sMsg);
          return Response.json({ 
            ok: false, 
            error: { 
              code: innerResult.sCode, 
              message: innerResult.sMsg || 'Order rejected',
              details: innerResult
            } 
          });
        }
      }

      if (!orderRes.ok) {
        const errMsg = orderRes.error?.okxMsg || orderRes.error?.message || 'Order failed';
        return Response.json({ ok: false, error: { code: orderRes.error?.okxCode || 'ORDER_FAILED', message: errMsg, details: orderRes.error } });
      }

      // Check if the order was actually accepted
      const orderData = orderRes.data?.data?.[0];
      if (orderData?.sCode && orderData.sCode !== '0') {
        return Response.json({ ok: false, error: { code: orderData.sCode, message: orderData.sMsg || 'Order rejected by exchange' } });
      }

      return Response.json({
        ok: true,
        data: {
          orderId: orderData?.ordId,
          result: orderData,
          contractsOrdered: contracts
        }
      });
    }

    // CLOSE POSITION
    if (action === 'closePosition') {
      const credResult = await getUserOkxCredential(base44, user.id);
      
      if (!credResult.ok) {
        return Response.json({ ok: false, error: credResult.error });
      }

      const { credential } = credResult.data;
      const { instId, posSide, size } = params;

      if (!instId) {
        return Response.json({ ok: false, error: { code: 'MISSING_PARAMS', message: 'instId required' } }, { status: 400 });
      }

      const closeBody = {
        instId,
        mgnMode: 'cross',
      };

      if (posSide) {
        closeBody.posSide = posSide.toLowerCase();
      }

      const closeRes = await okxRequest({
        credential,
        method: 'POST',
        path: '/api/v5/trade/close-position',
        body: closeBody,
        isTradingEndpoint: true
      });

      if (!closeRes.ok) {
        return Response.json({ ok: false, error: closeRes.error });
      }

      return Response.json({
        ok: true,
        data: closeRes.data?.data?.[0]
      });
    }

    return Response.json({ ok: false, error: { code: 'INVALID_ACTION' } }, { status: 400 });

  } catch (error) {
    console.error('[OKX_USER_ACCOUNT_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});