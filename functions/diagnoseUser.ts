// @ts-nocheck
/// <reference lib="deno.ns" />
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// --- INLINED OKX CORE UTILS ---
const DEFAULT_OKX_BASE_URL = 'https://www.okx.com';
function getEnv(key) { return Deno.env.get(key); }
function getOkxBaseUrl() { return getEnv('OKX_BASE_URL') || DEFAULT_OKX_BASE_URL; }
function base64Encode(bytes) { return btoa(String.fromCharCode(...bytes)); }
function base64Decode(text) { return Uint8Array.from(atob(text), c => c.charCodeAt(0)); }
async function importAesKey() {
  const raw = getEnv('APP_ENCRYPTION_KEY');
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
  } catch (e) { return ''; }
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
  const bodyStr = method === 'GET' ? '' : (body ? JSON.stringify(body) : '');
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
    const res = await fetch(url, { method, headers, body: method === 'GET' ? undefined : bodyStr });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data?.code && data.code !== '0')) return { ok: false, error: data };
    return { ok: true, data };
  } catch (e) { return { ok: false, error: e.message };
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  // Hardcoded target user prefix from previous context
  const targetPrefix = '6969f269'; 
  
  // 1. Find User ID
  const users = await base44.asServiceRole.entities.User.list({limit: 100}); // Listing all to find match, or use filter if possible
  // SDK doesn't support 'startsWith' filter easily, so let's try to find via Transfer or Account like before
  const accounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({ provider: 'OKX' });
  const targetAccount = accounts.find(a => a.user_id.startsWith(targetPrefix));
  
  if (!targetAccount) return Response.json({ error: "User not found" });
  const userId = targetAccount.user_id;
  
  // 2. Internal Ledger Balance
  const tradingAccount = (await base44.asServiceRole.entities.TradingAccount.filter({ user_id: userId }))[0];
  const ledgerBal = tradingAccount ? tradingAccount.balance : 0;
  
  // 3. Real OKX Balances
  const creds = await base44.asServiceRole.entities.ExchangeCredential.filter({ user_exchange_account_id: targetAccount.id });
  const cred = creds[0];
  const userCredential = { apiKey: cred.api_key, secretKey: await decryptSecret(cred.secret_enc), passphrase: await decryptSecret(cred.passphrase_enc) };

  const fundRes = await okxRequest({ credential: userCredential, method: 'GET', path: '/api/v5/asset/balances?ccy=USDT' });
  const tradeRes = await okxRequest({ credential: userCredential, method: 'GET', path: '/api/v5/account/balance?ccy=USDT' });
  
  const realFunding = parseFloat(fundRes.data?.data?.[0]?.availBal || '0');
  const realTrading = parseFloat(tradeRes.data?.data?.[0]?.details?.[0]?.availBal || '0');

  return Response.json({
    userId,
    ledgerBal,
    realFunding,
    realTrading,
    totalReal: realFunding + realTrading,
    explanation: "Ledger = Virtual Copy Trading Balance. Real = Funds in OKX Subaccount."
  });
});