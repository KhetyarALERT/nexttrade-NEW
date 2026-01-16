// @ts-nocheck
/// <reference lib="deno.ns" />
// OKX Trading Functions - Orders, Positions, Close

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const OKX_API_URL = 'https://www.okx.com';

async function generateOkxSignature(timestamp, method, requestPath, body, secretKey) {
  const prehash = timestamp + method.toUpperCase() + requestPath + body;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const msgData = encoder.encode(prehash);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function okxRequest(method, endpoint, body, apiKey, secretKey, passphrase) {
  const timestamp = new Date().toISOString();
  const bodyStr = body ? JSON.stringify(body) : '';
  const signature = await generateOkxSignature(timestamp, method, endpoint, bodyStr, secretKey);
  
  const response = await fetch(`${OKX_API_URL}${endpoint}`, {
    method: method.toUpperCase(),
    headers: {
      'OK-ACCESS-KEY': apiKey,
      'OK-ACCESS-SIGN': signature,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': passphrase,
      'Content-Type': 'application/json'
    },
    body: method.toUpperCase() === 'GET' ? undefined : (bodyStr || undefined)
  });
  return response.json();
}

function generateClientOrderId() {
  return `NT${Date.now()}${Math.random().toString(36).substring(2, 8)}`;
}

function auditLog(action, userId, details) {
  console.log(`[OKX_TRADING] [${new Date().toISOString()}] [${action}] User: ${userId}`, JSON.stringify(details));
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
    
    const apiKey = Deno.env.get('OKX_API_KEY');
    const secretKey = Deno.env.get('OKX_SECRET_KEY');
    const passphrase = Deno.env.get('OKX_PASSPHRASE');
    
    if (!apiKey || !secretKey || !passphrase) {
      return Response.json({ ok: false, error: { code: 'CONFIG_ERROR', message: 'OKX API credentials not configured' } }, { status: 500 });
    }
    
    // ==================== PLACE ORDER ====================
    if (action === 'placeOrder') {
      const { accountId, instId, side, orderType = 'market', size, price, reduceOnly = false, leverage } = params;
      
      if (!accountId || !instId || !side || !size) {
        return Response.json({ ok: false, error: { code: 'MISSING_FIELDS', message: 'accountId, instId, side, size required' } }, { status: 400 });
      }
      
      // Verify account ownership
      const accounts = await base44.entities.UserExchangeAccount.filter({ id: accountId, user_id: user.id, provider: 'OKX' });
      if (!accounts?.length) {
        return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Account not found' } }, { status: 404 });
      }
      
      const clientOrderId = generateClientOrderId();
      const nowISO = new Date().toISOString();
      
      auditLog('PLACE_ORDER', user.id, { accountId, instId, side, orderType, size, price, reduceOnly });
      
      // Create order record
      const orderRecord = await base44.asServiceRole.entities.ExchangeOrder.create({
        user_id: user.id,
        user_exchange_account_id: accountId,
        provider: 'OKX',
        inst_id: instId,
        side,
        order_type: orderType,
        size,
        price: price || null,
        reduce_only: reduceOnly,
        leverage: leverage || accounts[0].default_leverage,
        margin_mode: accounts[0].margin_mode,
        status: 'PENDING',
        external_client_order_id: clientOrderId,
        created_at: nowISO
      });
      
      // In production: Call OKX API to place order
      // For now, simulate successful order
      const simulatedOrderId = `okx_${Date.now()}`;
      
      await base44.asServiceRole.entities.ExchangeOrder.update(orderRecord.id, {
        status: orderType === 'market' ? 'FILLED' : 'OPEN',
        external_order_id: simulatedOrderId,
        filled_size: orderType === 'market' ? size : 0,
        avg_fill_price: price || 0,
        filled_at: orderType === 'market' ? nowISO : null
      });
      
      // Create/update position record for market orders
      if (orderType === 'market') {
        const existingPositions = await base44.entities.ExchangePosition.filter({
          user_id: user.id,
          user_exchange_account_id: accountId,
          inst_id: instId,
          status: 'OPEN'
        });
        
        if (existingPositions?.length) {
          // Update existing position
          const pos = existingPositions[0];
          const newSize = reduceOnly ? Math.max(0, pos.size - size) : pos.size + size;
          await base44.asServiceRole.entities.ExchangePosition.update(pos.id, {
            size: newSize,
            status: newSize === 0 ? 'CLOSED' : 'OPEN',
            last_sync_at: nowISO,
            updated_at: nowISO
          });
        } else if (!reduceOnly) {
          // Create new position
          await base44.asServiceRole.entities.ExchangePosition.create({
            user_id: user.id,
            user_exchange_account_id: accountId,
            provider: 'OKX',
            inst_id: instId,
            pos_side: side === 'buy' ? 'long' : 'short',
            size,
            avg_entry_price: price || 0,
            margin_mode: accounts[0].margin_mode,
            leverage: leverage || accounts[0].default_leverage,
            status: 'OPEN',
            opened_at: nowISO,
            created_at: nowISO
          });
        }
      }
      
      return Response.json({
        ok: true,
        data: {
          orderId: orderRecord.id,
          externalOrderId: simulatedOrderId,
          clientOrderId,
          status: orderType === 'market' ? 'FILLED' : 'OPEN'
        }
      });
    }
    
    // ==================== CANCEL ORDER ====================
    if (action === 'cancelOrder') {
      const { orderId } = params;
      if (!orderId) return Response.json({ ok: false, error: { code: 'MISSING_ORDER_ID', message: 'Order ID required' } }, { status: 400 });
      
      const orders = await base44.entities.ExchangeOrder.filter({ id: orderId, user_id: user.id });
      if (!orders?.length) return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, { status: 404 });
      
      if (orders[0].status !== 'OPEN' && orders[0].status !== 'PENDING') {
        return Response.json({ ok: false, error: { code: 'INVALID_STATUS', message: 'Order cannot be cancelled' } }, { status: 400 });
      }
      
      auditLog('CANCEL_ORDER', user.id, { orderId });
      
      await base44.asServiceRole.entities.ExchangeOrder.update(orderId, { status: 'CANCELLED' });
      
      return Response.json({ ok: true, data: { orderId, status: 'CANCELLED' } });
    }
    
    // ==================== GET ORDERS ====================
    if (action === 'getOrders') {
      const { accountId, status, limit = 50 } = params;
      
      let query = { user_id: user.id, provider: 'OKX' };
      if (accountId) query.user_exchange_account_id = accountId;
      if (status) query.status = status;
      
      const orders = await base44.entities.ExchangeOrder.filter(query, '-created_date', limit);
      
      return Response.json({
        ok: true,
        data: (orders || []).map(o => ({
          id: o.id,
          instId: o.inst_id,
          side: o.side,
          orderType: o.order_type,
          size: o.size,
          price: o.price,
          filledSize: o.filled_size,
          avgFillPrice: o.avg_fill_price,
          status: o.status,
          externalOrderId: o.external_order_id,
          createdAt: o.created_at || o.created_date
        }))
      });
    }
    
    // ==================== GET POSITIONS ====================
    if (action === 'getPositions') {
      const { accountId, instId } = params;
      
      let query = { user_id: user.id, provider: 'OKX', status: 'OPEN' };
      if (accountId) query.user_exchange_account_id = accountId;
      if (instId) query.inst_id = instId;
      
      const positions = await base44.entities.ExchangePosition.filter(query);
      
      return Response.json({
        ok: true,
        data: (positions || []).map(p => ({
          id: p.id,
          instId: p.inst_id,
          posSide: p.pos_side,
          size: p.size,
          entryPrice: p.avg_entry_price,
          markPrice: p.mark_price,
          unrealizedPnl: p.unrealized_pnl,
          liquidationPrice: p.liquidation_price,
          marginMode: p.margin_mode,
          leverage: p.leverage,
          margin: p.margin,
          openedAt: p.opened_at
        }))
      });
    }
    
    // ==================== CLOSE POSITION ====================
    if (action === 'closePosition') {
      const { positionId, size } = params;
      if (!positionId) return Response.json({ ok: false, error: { code: 'MISSING_POSITION_ID', message: 'Position ID required' } }, { status: 400 });
      
      const positions = await base44.entities.ExchangePosition.filter({ id: positionId, user_id: user.id, status: 'OPEN' });
      if (!positions?.length) return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Position not found' } }, { status: 404 });
      
      const position = positions[0];
      const closeSize = size || position.size;
      
      auditLog('CLOSE_POSITION', user.id, { positionId, closeSize });
      
      // Place a reduce-only market order to close
      const closeSide = position.pos_side === 'long' ? 'sell' : 'buy';
      const nowISO = new Date().toISOString();
      
      const closeOrder = await base44.asServiceRole.entities.ExchangeOrder.create({
        user_id: user.id,
        user_exchange_account_id: position.user_exchange_account_id,
        provider: 'OKX',
        inst_id: position.inst_id,
        side: closeSide,
        order_type: 'market',
        size: closeSize,
        reduce_only: true,
        status: 'FILLED',
        filled_size: closeSize,
        filled_at: nowISO,
        created_at: nowISO
      });
      
      const newSize = position.size - closeSize;
      await base44.asServiceRole.entities.ExchangePosition.update(positionId, {
        size: newSize,
        status: newSize <= 0 ? 'CLOSED' : 'OPEN',
        closed_at: newSize <= 0 ? nowISO : null,
        updated_at: nowISO
      });
      
      return Response.json({
        ok: true,
        data: {
          positionId,
          closeOrderId: closeOrder.id,
          closedSize: closeSize,
          remainingSize: newSize
        }
      });
    }
    
    return Response.json({ ok: false, error: { code: 'INVALID_ACTION', message: 'Invalid action' } }, { status: 400 });
    
  } catch (error) {
    console.error('[OKX_TRADING_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});