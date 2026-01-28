// @ts-nocheck
/// <reference lib="deno.ns" />
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// --- INLINED OKX CORE UTILS (to avoid import issues) ---
const DEFAULT_OKX_BASE_URL = 'https://www.okx.com';

function getEnv(key) { return Deno.env.get(key); }
function getOkxBaseUrl() { return getEnv('OKX_BASE_URL') || DEFAULT_OKX_BASE_URL; }
function base64Encode(bytes) { return btoa(String.fromCharCode(...bytes)); }
function base64Decode(text) { return Uint8Array.from(atob(text), c => c.charCodeAt(0)); }

async function importAesKey() {
  const raw = getEnv('APP_ENCRYPTION_KEY');
  if (!raw) throw new Error('Missing APP_ENCRYPTION_KEY');
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(raw));
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['decrypt']);
}

async function decryptSecret(payload) {
  if (!payload) return '';
  try {
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
  } catch (e) {
    console.error("Decrypt failed:", e);
    return '';
  }
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

async function okxRequest({ credential, method, path, body }) {
  const timestamp = new Date().toISOString();
  const bodyStr = body ? JSON.stringify(body) : '';
  const signature = await generateOkxSignature(timestamp, method, path, bodyStr, credential.secretKey);

  const headers = {
    'OK-ACCESS-KEY': credential.apiKey,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': credential.passphrase,
    'Content-Type': 'application/json',
  };

  const url = `${getOkxBaseUrl()}${path}`;
  try {
    const res = await fetch(url, { method, headers, body: bodyStr || undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data?.code && data.code !== '0')) {
      return { ok: false, error: data };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function getMasterCredentials() {
  return {
    apiKey: getEnv('OKX_MAIN_API_KEY'),
    secretKey: getEnv('OKX_MAIN_SECRET'),
    passphrase: getEnv('OKX_MAIN_PASSPHRASE')
  };
}
// -------------------------------------------------------

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  // 1. Identify User
  const transfers = await base44.asServiceRole.entities.ExchangeTransfer.filter({
    amount: 500,
    from_account_type: 'funding',
    to_account_type: 'trading',
    status: 'COMPLETED'
  });
  
  const targetTransfer = transfers.find(t => t.user_id.startsWith('6969f269'));
  if (!targetTransfer) return Response.json({ error: "Target transfer not found." });
  
  const userId = targetTransfer.user_id;
  console.log(`[SWEEP] User: ${userId}`);

  // 2. Get Credentials
  const accounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({ user_id: userId, provider: 'OKX' });
  const account = accounts[0];
  if (!account) return Response.json({ error: "No OKX account" });

  const creds = await base44.asServiceRole.entities.ExchangeCredential.filter({ user_exchange_account_id: account.id });
  const cred = creds[0];
  if (!cred) return Response.json({ error: "No credentials" });

  const userCredential = {
    apiKey: cred.api_key,
    secretKey: await decryptSecret(cred.secret_enc),
    passphrase: await decryptSecret(cred.passphrase_enc)
  };

  // 3. Sweep Logic
  // A: Sub-Trading -> Sub-Funding
  const stepARes = await okxRequest({
    credential: userCredential,
    method: 'POST',
    path: '/api/v5/asset/transfer',
    body: { ccy: 'USDT', amt: '500', from: '18', to: '6', type: '0' }
  });

  if (!stepARes.ok) return Response.json({ error: "Step A (Trading->Funding) Failed", details: stepARes.error });

  // B: Sub-Funding -> Master-Funding
  const masterCreds = getMasterCredentials();
  if (!masterCreds.apiKey) return Response.json({ error: "Master credentials missing" });

  const stepBRes = await okxRequest({
    credential: masterCreds,
    method: 'POST',
    path: '/api/v5/asset/transfer',
    body: { ccy: 'USDT', amt: '500', from: '6', to: '6', type: '2', subAcct: account.external_account_id }
  });

  if (!stepBRes.ok) return Response.json({ error: "Step B (Sub->Master) Failed", details: stepBRes.error });

  const transId = stepBRes.data?.data?.[0]?.transId;

  // 4. Credit Ledger
  let tradingAccount = (await base44.entities.TradingAccount.filter({ user_id: userId }))[0];
  if (!tradingAccount) {
    tradingAccount = await base44.asServiceRole.entities.TradingAccount.create({
      account_id: `TA_${Date.now()}`,
      user_id: userId,
      nickname: 'Trading Account',
      account_type: 'demo',
      balance: 0,
      equity: 0,
      status: 'active'
    });
  }

  await base44.asServiceRole.entities.TradingAccount.update(tradingAccount.id, {
    balance: (tradingAccount.balance || 0) + 500,
    equity: (tradingAccount.equity || 0) + 500
  });

  let wallet = (await base44.entities.Wallet.filter({ trading_account_id: tradingAccount.id, currency: 'USDT' }))[0];
  if (!wallet) {
    wallet = await base44.asServiceRole.entities.Wallet.create({
      trading_account_id: tradingAccount.id,
      user_id: userId,
      currency: 'USDT',
      network: 'INTERNAL',
      balance: 0,
      status: 'active'
    });
  }

  await base44.asServiceRole.entities.Wallet.update(wallet.id, {
    balance: (wallet.balance || 0) + 500
  });

  await base44.asServiceRole.entities.WalletTransaction.create({
    wallet_id: wallet.id,
    user_id: userId,
    type: 'internal_transfer_in',
    amount: 500,
    currency: 'USDT',
    status: 'completed',
    notes: `SWEEP FIX: Deposit from Funding (TransId: ${transId})`
  });

  return Response.json({ success: true, transId });
});