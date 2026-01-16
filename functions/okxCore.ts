// @ts-nocheck
/// <reference lib="deno.ns" />
// OKX Core Functions - Signature, Request, Utilities

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const OKX_API_URL = 'https://www.okx.com';

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
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// Make authenticated OKX API request
export async function okxRequest(method, endpoint, body, apiKey, secretKey, passphrase) {
  const timestamp = new Date().toISOString();
  const bodyStr = body ? JSON.stringify(body) : '';
  
  const signature = await generateOkxSignature(timestamp, method, endpoint, bodyStr, secretKey);
  
  const headers = {
    'OK-ACCESS-KEY': apiKey,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': passphrase,
    'Content-Type': 'application/json'
  };
  
  const response = await fetch(`${OKX_API_URL}${endpoint}`, {
    method: method.toUpperCase(),
    headers,
    body: method.toUpperCase() === 'GET' ? undefined : (bodyStr || undefined)
  });
  
  return response.json();
}

// Standard response format
export function okResponse(ok, data = null, error = null) {
  if (ok) return { ok: true, data };
  return { ok: false, error: error || { code: 'UNKNOWN_ERROR', message: 'Unknown error' } };
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

// Get OKX master credentials from env
export function getMasterCredentials() {
  const apiKey = Deno.env.get('OKX_API_KEY');
  const secretKey = Deno.env.get('OKX_SECRET_KEY');
  const passphrase = Deno.env.get('OKX_PASSPHRASE');
  
  if (!apiKey || !secretKey || !passphrase) {
    return { ok: false, error: { code: 'CONFIG_ERROR', message: 'OKX API credentials not configured' } };
  }
  
  return { ok: true, apiKey, secretKey, passphrase };
}

// Main handler - this file exports utilities, actual endpoints are in separate files
Deno.serve(async (req) => {
  return Response.json({ 
    ok: false, 
    error: { code: 'NOT_IMPLEMENTED', message: 'Use specific OKX function endpoints' }
  }, { status: 400 });
});