// @ts-nocheck
/// <reference lib="deno.ns" />
// OKX Core Functions - Signature, Request, Utilities

const DEFAULT_OKX_BASE_URL = 'https://www.okx.com';
const DEFAULT_SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

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

function getEncryptionKeyMaterial() {
  const raw = getEnv('APP_ENCRYPTION_KEY');
  if (!raw) {
    throw new Error('Missing APP_ENCRYPTION_KEY. Add APP_ENCRYPTION_KEY to Base44 Secrets.');
  }
  return raw;
}

async function importAesKey() {
  const raw = getEncryptionKeyMaterial();
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(raw));
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(plaintext) {
  const key = await importAesKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(String(plaintext || ''))
  );
  const encryptedBytes = new Uint8Array(encrypted);
  const tag = encryptedBytes.slice(encryptedBytes.length - 16);
  const ciphertext = encryptedBytes.slice(0, -16);
  return {
    iv: base64Encode(iv),
    tag: base64Encode(tag),
    ciphertext: base64Encode(ciphertext),
  };
}

export async function decryptSecret(payload) {
  if (!payload) return '';
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const iv = base64Decode(parsed.iv);
  const tag = base64Decode(parsed.tag);
  const ciphertext = base64Decode(parsed.ciphertext);
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);
  const key = await importAesKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    combined
  );
  return new TextDecoder().decode(decrypted);
}

// Generate HMAC-SHA256 signature for OKX API
export async function generateOkxSignature(timestamp, method, requestPath, body, secretKey) {
  const prehash = timestamp + method.toUpperCase() + requestPath + body;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const msgData = encoder.encode(prehash);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return base64Encode(new Uint8Array(signature));
}

export function okResponse(ok, data = null, error = null) {
  if (ok) return { ok: true, data };
  return { ok: false, error: error || { code: 'UNKNOWN_ERROR', message: 'Unknown error' } };
}

export function okxError({ httpStatus, okxCode, okxMsg, okxData, request }) {
  return {
    ok: false,
    error: {
      httpStatus,
      okxCode,
      okxMsg,
      okxData,
      request,
    },
  };
}

export function getMasterCredentials() {
  const apiKey = getEnv('OKX_MAIN_API_KEY');
  const secretKey = getEnv('OKX_MAIN_SECRET');
  const passphrase = getEnv('OKX_MAIN_PASSPHRASE');
  if (!apiKey || !secretKey || !passphrase) {
    return okResponse(false, null, {
      code: 'CONFIG_ERROR',
      message: 'Missing OKX main credentials. Set OKX_MAIN_API_KEY, OKX_MAIN_SECRET, OKX_MAIN_PASSPHRASE.',
    });
  }
  return okResponse(true, { apiKey, secretKey, passphrase });
}

export function getSolanaRpcUrl() {
  return getEnv('SOLANA_RPC_URL') || DEFAULT_SOLANA_RPC;
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

export async function okxRequest({ credential, method, path, query, body, isTradingEndpoint = false }) {
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
      const err = okxError({
        httpStatus: res.status,
        okxCode: data?.code,
        okxMsg: data?.msg,
        okxData: data,
        request: { method: method.toUpperCase(), requestPath },
      });
      console.error('[OKX_REQUEST_ERROR]', JSON.stringify(err.error));
      return err;
    }

    return okResponse(true, data);
  } catch (error) {
    const err = okxError({
      httpStatus: 0,
      okxCode: null,
      okxMsg: error?.message || 'Network error',
      okxData: null,
      request: { method: method.toUpperCase(), requestPath },
    });
    console.error('[OKX_REQUEST_ERROR]', JSON.stringify(err.error));
    return err;
  }
}

// Audit logging
export function auditLog(action, userId, details) {
  const timestamp = new Date().toISOString();
  console.log(`[OKX_AUDIT] [${timestamp}] [${action}] User: ${userId}`, JSON.stringify(details));
}

// Generate unique sub-account name
export function generateSubAcctName(userId) {
  const prefix = 'NT';
  const userPart = (userId || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase();
  const timePart = Date.now().toString(36).toUpperCase();
  return `${prefix}${userPart}${timePart}`.substring(0, 20);
}

// Generate unique client order ID
export function generateClientOrderId(prefix = 'NT') {
  return `${prefix}${Date.now()}${Math.random().toString(36).substring(2, 8)}`;
}

// Rate limiting cache (simple in-memory, reset on cold start)
const rateLimitCache = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

export function checkRateLimit(key) {
  const now = Date.now();
  const entry = rateLimitCache.get(key);
  
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitCache.set(key, { windowStart: now, count: 1 });
    return true;
  }
  
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  entry.count++;
  return true;
}

// Simple cache for market data
const dataCache = new Map();

export function getCached(key, maxAgeMs = 30000) {
  const entry = dataCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > maxAgeMs) {
    dataCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache(key, data) {
  dataCache.set(key, { data, timestamp: Date.now() });
}

// Validate required fields
export function validateRequired(params, requiredFields) {
  const missing = requiredFields.filter(f => params[f] === undefined || params[f] === null || params[f] === '');
  if (missing.length > 0) {
    return { ok: false, error: { code: 'MISSING_FIELDS', message: `Missing required fields: ${missing.join(', ')}` } };
  }
  return { ok: true };
}

// Main handler - this file exports utilities, actual endpoints are in separate files
Deno.serve(async () => {
  return Response.json(
    { ok: false, error: { code: 'NOT_IMPLEMENTED', message: 'Use specific OKX function endpoints' } },
    { status: 400 }
  );
});
