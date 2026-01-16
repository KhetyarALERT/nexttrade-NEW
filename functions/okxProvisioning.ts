// @ts-nocheck
/// <reference lib="deno.ns" />
// OKX Provisioning - Create subaccounts, API keys, configure accounts

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

function generateSubAcctName(userId) {
  const prefix = 'NT';
  const userPart = (userId || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase();
  const timePart = Date.now().toString(36).toUpperCase();
  return `${prefix}${userPart}${timePart}`.substring(0, 20);
}

function auditLog(action, userId, details) {
  console.log(`[OKX_AUDIT] [${new Date().toISOString()}] [${action}] User: ${userId}`, JSON.stringify(details));
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
    
    // ==================== PROVISION USER (Idempotent) ====================
    if (action === 'provisionUser') {
      auditLog('PROVISION_START', user.id, { email: user.email });
      
      // Check if user already has an exchange account
      const existing = await base44.entities.UserExchangeAccount.filter({ user_id: user.id, provider: 'OKX', status: 'ACTIVE' });
      if (existing && existing.length > 0) {
        auditLog('PROVISION_SKIP_EXISTS', user.id, { accountId: existing[0].id });
        return Response.json({ 
          ok: true, 
          data: { 
            accountId: existing[0].id, 
            externalAccountId: existing[0].external_account_id,
            status: existing[0].status,
            isNew: false 
          }
        });
      }
      
      const subAcctName = generateSubAcctName(user.id);
      let okxSubAcct = null;
      let okxApiKey = null;
      let okxApiSecret = null;
      let okxApiPassphrase = null;
      let provisionSuccess = false;
      
      try {
        // Step 1: Create sub-account
        const createResult = await okxRequest('POST', '/api/v5/users/subaccount/create-subaccount', {
          subAcct: subAcctName,
          label: (user.full_name || user.email || 'User').substring(0, 20)
        }, apiKey, secretKey, passphrase);
        
        console.log('[OKX] Create subaccount result:', createResult);
        
        if (createResult.code === '0' && createResult.data?.[0]) {
          okxSubAcct = createResult.data[0].subAcct;
          
          // Step 2: Create API key for sub-account
          const generatedPassphrase = `Sub${Date.now().toString(36)}@1`;
          const apiKeyResult = await okxRequest('POST', '/api/v5/users/subaccount/apikey', {
            subAcct: okxSubAcct,
            label: `${subAcctName}_api`.substring(0, 20),
            passphrase: generatedPassphrase,
            perm: 'read_only,trade'
          }, apiKey, secretKey, passphrase);
          
          console.log('[OKX] Create API key result:', { code: apiKeyResult.code, msg: apiKeyResult.msg });
          
          if (apiKeyResult.code === '0' && apiKeyResult.data?.[0]) {
            okxApiKey = apiKeyResult.data[0].apiKey;
            okxApiSecret = apiKeyResult.data[0].secretKey;
            okxApiPassphrase = apiKeyResult.data[0].passphrase;
            
            // Step 3: Configure account (futures mode)
            await okxRequest('POST', '/api/v5/account/set-account-level', { acctLv: '2' }, okxApiKey, okxApiSecret, okxApiPassphrase);
            
            provisionSuccess = true;
          }
        }
      } catch (err) {
        console.error('[OKX] Provision error:', err.message);
      }
      
      if (!provisionSuccess) {
        return Response.json({ ok: false, error: { code: 'PROVISION_FAILED', message: 'Failed to provision OKX account' } }, { status: 500 });
      }
      
      const nowISO = new Date().toISOString();
      
      // Create UserExchangeAccount
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
      
      // Create ExchangeCredential (secrets stored as refs - in production would encrypt)
      await base44.asServiceRole.entities.ExchangeCredential.create({
        user_id: user.id,
        user_exchange_account_id: exchangeAccount.id,
        provider: 'OKX',
        api_key: okxApiKey,
        secret_ref: `okx_secret_${exchangeAccount.id}`, // In production: encrypt okxApiSecret
        passphrase_ref: `okx_pass_${exchangeAccount.id}`, // In production: encrypt okxApiPassphrase
        permissions: ['read_only', 'trade'],
        status: 'ACTIVE',
        created_at: nowISO
      });
      
      auditLog('PROVISION_SUCCESS', user.id, { accountId: exchangeAccount.id, okxSubAcct });
      
      return Response.json({
        ok: true,
        data: {
          accountId: exchangeAccount.id,
          externalAccountId: okxSubAcct,
          status: 'ACTIVE',
          isNew: true
        }
      });
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
      
      // For now, just update local config - in production would call OKX API
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