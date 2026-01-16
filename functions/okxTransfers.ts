// @ts-nocheck
/// <reference lib="deno.ns" />
// OKX Transfers & Balances - Internal transfers, deposit/withdraw

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

function auditLog(action, userId, details) {
  console.log(`[OKX_TRANSFER] [${new Date().toISOString()}] [${action}] User: ${userId}`, JSON.stringify(details));
}

// Generate confirmation token
function generateConfirmToken() {
  return `${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
}

// Withdrawal cooldown hours for new addresses
const COOLDOWN_HOURS = 24;

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
      
      // In production: Call OKX API for real balances
      // For now, return simulated data
      return Response.json({
        ok: true,
        data: {
          balances: [
            { currency: 'USDT', available: 1000, frozen: 0, total: 1000 },
            { currency: 'BTC', available: 0.01, frozen: 0, total: 0.01 }
          ]
        }
      });
    }
    
    // ==================== GET DEPOSIT ADDRESS ====================
    if (action === 'getDepositAddress') {
      const { currency = 'USDT', chain = 'TRC20' } = params;
      
      // In production: Call OKX API
      return Response.json({
        ok: true,
        data: {
          address: 'T...simulated...',
          chain,
          currency,
          memo: null
        }
      });
    }
    
    // ==================== REQUEST WITHDRAWAL ====================
    if (action === 'requestWithdrawal') {
      const { currency = 'USDT', chain, address, amount, addressTag } = params;
      
      if (!chain || !address || !amount || amount <= 0) {
        return Response.json({ ok: false, error: { code: 'INVALID_PARAMS', message: 'chain, address, amount required' } }, { status: 400 });
      }
      
      const nowISO = new Date().toISOString();
      const now = new Date();
      
      // Check if address is in allowlist
      const allowlist = await base44.entities.AddressAllowlist.filter({ user_id: user.id, address, chain, status: 'ACTIVE' });
      const isAllowlisted = allowlist && allowlist.length > 0;
      
      let riskFlags = [];
      let riskScore = 0;
      let cooldownUntil = null;
      
      if (!isAllowlisted) {
        riskFlags.push('NEW_ADDRESS');
        riskScore += 30;
        
        // Add to allowlist with cooldown
        const cooldownDate = new Date(now.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);
        cooldownUntil = cooldownDate.toISOString();
        
        await base44.asServiceRole.entities.AddressAllowlist.create({
          user_id: user.id,
          address,
          chain,
          label: 'Auto-added',
          is_verified: false,
          verification_method: 'NONE',
          cooldown_until: cooldownUntil,
          status: 'ACTIVE',
          created_at: nowISO
        });
        
        riskFlags.push('COOLDOWN_REQUIRED');
      } else {
        const entry = allowlist[0];
        if (entry.cooldown_until && new Date(entry.cooldown_until) > now) {
          cooldownUntil = entry.cooldown_until;
          riskFlags.push('IN_COOLDOWN');
          riskScore += 20;
        }
      }
      
      // Large withdrawal flag
      if (amount > 10000) {
        riskFlags.push('LARGE_AMOUNT');
        riskScore += 20;
      }
      
      // Generate confirmation token
      const confirmToken = generateConfirmToken();
      const confirmExpires = new Date(now.getTime() + 30 * 60 * 1000).toISOString(); // 30 min
      
      auditLog('REQUEST_WITHDRAWAL', user.id, { currency, chain, address, amount, riskScore, riskFlags });
      
      // Create withdrawal request
      const withdrawal = await base44.asServiceRole.entities.WithdrawalRequest.create({
        user_id: user.id,
        provider: 'OKX',
        currency,
        chain,
        address,
        address_tag: addressTag || null,
        amount,
        fee: 1, // Simulated fee
        net_amount: amount - 1,
        status: cooldownUntil ? 'PENDING_REVIEW' : 'PENDING_CONFIRM',
        risk_score: riskScore,
        risk_flags: riskFlags,
        is_allowlisted: isAllowlisted,
        allowlist_added_at: isAllowlisted ? allowlist[0].created_at : nowISO,
        cooldown_until: cooldownUntil,
        confirmation_token: confirmToken,
        confirmation_expires_at: confirmExpires,
        created_at: nowISO
      });
      
      return Response.json({
        ok: true,
        data: {
          withdrawalId: withdrawal.id,
          status: withdrawal.status,
          requiresConfirmation: true,
          riskFlags,
          cooldownUntil,
          confirmationExpiresAt: confirmExpires
        }
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
      
      // In production: Call OKX withdrawal API here
      
      await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawalId, {
        status: 'PROCESSING',
        confirmed_at: nowISO
      });
      
      return Response.json({
        ok: true,
        data: {
          withdrawalId,
          status: 'PROCESSING'
        }
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