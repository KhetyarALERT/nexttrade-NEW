// @ts-nocheck
/// <reference lib="deno.ns" />
// OKX Provisioning - Create subaccounts, API keys, configure accounts

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
    
    const masterCredsResult = getMasterCredentials();
    if (!masterCredsResult.ok) {
      return Response.json(masterCredsResult, { status: 500 });
    }
    
    // ====================ENSURE USER ACCOUNT (Idempotent) ====================
    if (action === 'ensureUserAccount') {
      auditLog('ENSURE_ACCOUNT_START', user.id, { email: user.email });
      
      // Check if user already has an active exchange account
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
        path: '/api/v5/users/subaccount/create-subaccount',
        body: {
          subAcct: subAcctName,
          label: (user.full_name || user.email || 'User').substring(0, 20),
        },
        isTradingEndpoint: false,
      });

      if (!createResult.ok) {
        console.error('[OKX] Provision error:', createResult.error?.okxMsg);
        console.log('[OKX] Create subaccount result:', createResult.error?.okxData || createResult.error);
        
        // Handle IP binding error specifically
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
      
      const secretEnc = await encryptSecret(okxApiSecret);
      const passphraseEnc = await encryptSecret(okxApiPassphrase);
      const permissions = ['read_only', 'trade'];

      // Create ExchangeCredential
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
      
      // Fetch deposit addresses
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