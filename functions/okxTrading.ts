// @ts-nocheck
/// <reference lib="deno.ns" />
// OKX Trading Functions - Orders, Positions, Close

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { decryptSecret, okResponse, okxRequest } from './okxCore.ts';

function generateClientOrderId() {
  return `NT${Date.now()}${Math.random().toString(36).substring(2, 8)}`;
}

function auditLog(action, userId, details) {
  console.log(`[OKX_TRADING] [${new Date().toISOString()}] [${action}] User: ${userId}`, JSON.stringify(details));
}

async function resolveAccount(base44, userId, accountId) {
  const accounts = await base44.entities.UserExchangeAccount.filter({
    id: accountId,
    user_id: userId,
    provider: 'OKX',
  });
  if (!accounts?.length) return okResponse(false, null, { code: 'NOT_FOUND', message: 'Account not found' });
  return okResponse(true, accounts[0]);
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
    
    // ==================== PLACE ORDER ====================
    if (action === 'placeOrder') {
      const { accountId, instId, side, orderType = 'market', size, price, reduceOnly = false, leverage } = params;
      
      if (!accountId || !instId || !side || !size) {
        return Response.json({ ok: false, error: { code: 'MISSING_FIELDS', message: 'accountId, instId, side, size required' } }, { status: 400 });
      }
      
      const accountResult = await resolveAccount(base44, user.id, accountId);
      if (!accountResult.ok) return Response.json(accountResult, { status: 404 });

      const credentialResult = await resolveCredential(base44, accountResult.data);
      if (!credentialResult.ok) return Response.json(credentialResult, { status: 400 });

      const clientOrderId = generateClientOrderId();
      
      auditLog('PLACE_ORDER', user.id, { accountId, instId, side, orderType, size, price, reduceOnly });

      const tdMode = accountResult.data.margin_mode || 'cross';
      const ordType = orderType === 'limit' ? 'limit' : 'market';

      const orderResult = await okxRequest({
        credential: credentialResult.data,
        method: 'POST',
        path: '/api/v5/trade/order',
        body: {
          instId,
          tdMode,
          side,
          ordType,
          sz: String(size),
          px: ordType === 'limit' ? String(price || '') : undefined,
          reduceOnly: reduceOnly ? 'true' : undefined,
          clOrdId: clientOrderId,
          lever: leverage ? String(leverage) : undefined,
        },
        isTradingEndpoint: true,
      });

      if (!orderResult.ok) {
        return Response.json(okResponse(false, null, {
          code: 'ORDER_FAILED',
          message: orderResult.error?.okxMsg || 'Order failed',
          okxCode: orderResult.error?.okxCode,
          okxMsg: orderResult.error?.okxMsg,
        }), { status: 502 });
      }

      const okxOrder = orderResult.data?.data?.[0];
      return Response.json({
        ok: true,
        data: {
          orderId: okxOrder?.ordId || null,
          clientOrderId,
          status: okxOrder?.sCode === '0' ? 'SUBMITTED' : 'REJECTED',
          okx: okxOrder,
        },
      });
    }
    
    // ==================== CANCEL ORDER ====================
    if (action === 'cancelOrder') {
      const { orderId } = params;
      if (!orderId) return Response.json({ ok: false, error: { code: 'MISSING_ORDER_ID', message: 'Order ID required' } }, { status: 400 });
      
      const { accountId, instId } = params;
      if (!accountId || !instId) {
        return Response.json({ ok: false, error: { code: 'MISSING_FIELDS', message: 'accountId and instId required' } }, { status: 400 });
      }

      const accountResult = await resolveAccount(base44, user.id, accountId);
      if (!accountResult.ok) return Response.json(accountResult, { status: 404 });

      const credentialResult = await resolveCredential(base44, accountResult.data);
      if (!credentialResult.ok) return Response.json(credentialResult, { status: 400 });

      const cancelResult = await okxRequest({
        credential: credentialResult.data,
        method: 'POST',
        path: '/api/v5/trade/cancel-order',
        body: { ordId: orderId, instId },
        isTradingEndpoint: true,
      });

      if (!cancelResult.ok) {
        return Response.json(okResponse(false, null, {
          code: 'CANCEL_FAILED',
          message: cancelResult.error?.okxMsg || 'Cancel failed',
          okxCode: cancelResult.error?.okxCode,
          okxMsg: cancelResult.error?.okxMsg,
        }), { status: 502 });
      }

      return Response.json({ ok: true, data: cancelResult.data?.data });
    }
    
    // ==================== GET ORDERS ====================
    if (action === 'getOrders') {
      const { accountId, instId, status = 'open', limit = 50 } = params;
      if (!accountId) {
        return Response.json({ ok: false, error: { code: 'MISSING_ACCOUNT_ID', message: 'accountId required' } }, { status: 400 });
      }

      const accountResult = await resolveAccount(base44, user.id, accountId);
      if (!accountResult.ok) return Response.json(accountResult, { status: 404 });

      const credentialResult = await resolveCredential(base44, accountResult.data);
      if (!credentialResult.ok) return Response.json(credentialResult, { status: 400 });

      const path = status === 'history' ? '/api/v5/trade/orders-history' : '/api/v5/trade/orders-pending';
      const orderResult = await okxRequest({
        credential: credentialResult.data,
        method: 'GET',
        path,
        query: { instId, limit },
        isTradingEndpoint: true,
      });

      if (!orderResult.ok) {
        return Response.json(okResponse(false, null, {
          code: 'FETCH_FAILED',
          message: orderResult.error?.okxMsg || 'Failed to fetch orders',
          okxCode: orderResult.error?.okxCode,
          okxMsg: orderResult.error?.okxMsg,
        }), { status: 502 });
      }

      const orders = (orderResult.data?.data || []).map((o) => ({
        id: o.ordId,
        instId: o.instId,
        side: o.side,
        orderType: o.ordType,
        size: Number(o.sz),
        price: Number(o.px || 0),
        filledSize: Number(o.fillSz || 0),
        avgFillPrice: Number(o.avgPx || 0),
        status: o.state,
        createdAt: o.cTime ? new Date(Number(o.cTime)).toISOString() : null,
      }));

      return Response.json({ ok: true, data: orders });
    }
    
    // ==================== GET POSITIONS ====================
    if (action === 'getPositions') {
      const { accountId, instId } = params;
      
      if (!accountId) {
        return Response.json({ ok: false, error: { code: 'MISSING_ACCOUNT_ID', message: 'accountId required' } }, { status: 400 });
      }

      const accountResult = await resolveAccount(base44, user.id, accountId);
      if (!accountResult.ok) return Response.json(accountResult, { status: 404 });

      const credentialResult = await resolveCredential(base44, accountResult.data);
      if (!credentialResult.ok) return Response.json(credentialResult, { status: 400 });

      const positionResult = await okxRequest({
        credential: credentialResult.data,
        method: 'GET',
        path: '/api/v5/account/positions',
        query: { instType: 'SWAP', instId },
        isTradingEndpoint: true,
      });

      if (!positionResult.ok) {
        return Response.json(okResponse(false, null, {
          code: 'FETCH_FAILED',
          message: positionResult.error?.okxMsg || 'Failed to fetch positions',
          okxCode: positionResult.error?.okxCode,
          okxMsg: positionResult.error?.okxMsg,
        }), { status: 502 });
      }

      const positions = (positionResult.data?.data || []).map((p) => ({
        id: p.posId || `${p.instId}:${p.posSide}`,
        instId: p.instId,
        posSide: p.posSide,
        size: Number(p.pos || 0),
        entryPrice: Number(p.avgPx || 0),
        markPrice: Number(p.markPx || 0),
        unrealizedPnl: Number(p.upl || 0),
        liquidationPrice: Number(p.liqPx || 0),
        marginMode: p.mgnMode,
        leverage: Number(p.lever || 0),
        margin: Number(p.imr || 0),
        openedAt: p.cTime ? new Date(Number(p.cTime)).toISOString() : null,
      }));

      return Response.json({ ok: true, data: positions });
    }
    
    // ==================== CLOSE POSITION ====================
    if (action === 'closePosition') {
      const { accountId, instId, posSide, size } = params;
      if (!accountId || !instId) {
        return Response.json({ ok: false, error: { code: 'MISSING_FIELDS', message: 'accountId and instId required' } }, { status: 400 });
      }

      const accountResult = await resolveAccount(base44, user.id, accountId);
      if (!accountResult.ok) return Response.json(accountResult, { status: 404 });

      const credentialResult = await resolveCredential(base44, accountResult.data);
      if (!credentialResult.ok) return Response.json(credentialResult, { status: 400 });

      auditLog('CLOSE_POSITION', user.id, { accountId, instId, size });

      const closeResult = await okxRequest({
        credential: credentialResult.data,
        method: 'POST',
        path: '/api/v5/trade/close-position',
        body: {
          instId,
          posSide,
          mgnMode: accountResult.data.margin_mode || 'cross',
          sz: size ? String(size) : undefined,
        },
        isTradingEndpoint: true,
      });

      if (!closeResult.ok) {
        return Response.json(okResponse(false, null, {
          code: 'CLOSE_FAILED',
          message: closeResult.error?.okxMsg || 'Close failed',
          okxCode: closeResult.error?.okxCode,
          okxMsg: closeResult.error?.okxMsg,
        }), { status: 502 });
      }

      return Response.json({ ok: true, data: closeResult.data?.data });
    }
    
    return Response.json({ ok: false, error: { code: 'INVALID_ACTION', message: 'Invalid action' } }, { status: 400 });
    
  } catch (error) {
    console.error('[OKX_TRADING_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});
