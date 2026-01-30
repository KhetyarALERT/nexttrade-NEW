// @ts-nocheck
/// <reference lib="deno.ns" />

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-nexttrade-scout-key'
    }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-nexttrade-scout-key'
      }
    });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  // Auth check
  const scoutKey = req.headers.get('x-nexttrade-scout-key');
  const envKey = Deno.env.get('NEXTTRADE_SCOUT_KEY');

  if (!envKey || scoutKey !== envKey) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { 
      mint, symbol, name, score, marketCap, liquidityUsd, 
      imageUrl, websiteUrl, twitterUrl, telegramUrl,
      priceUsd, priceChange24h, volume24h,
      dexUrl, rugcheckUrl, solscanUrl, source, createdAtMs, raw, status,
      // New safety fields
      stage, rugScore, rugged, mintAuthorityRevoked, freezeAuthorityDisabled,
      riskFlags, riskLevel, lpStatus, lpLocked, lpBurned
    } = body;

    if (!mint) {
      return json({ ok: false, error: 'Missing mint' }, 400);
    }

    // Check if exists
    const existing = await base44.asServiceRole.entities.MemeScoutAlert.filter({ mint }, { limit: 1 });
    
    if (existing && existing.length > 0) {
      // Update
      const id = existing[0].id;
      await base44.asServiceRole.entities.MemeScoutAlert.update(id, {
        symbol, name, score, marketCap, liquidityUsd,
        imageUrl, websiteUrl, twitterUrl, telegramUrl,
        priceUsd, priceChange24h, volume24h,
        dexUrl, rugcheckUrl, solscanUrl, source,
        // Safety fields
        stage, rugScore, rugged, mintAuthorityRevoked, freezeAuthorityDisabled,
        riskFlags, riskLevel, lpStatus, lpLocked, lpBurned,
        // Only update status if provided, else keep existing
        ...(status ? { status } : {}),
        raw: raw || existing[0].raw,
        updated_date: new Date().toISOString()
      });
    } else {
      // Create
      await base44.asServiceRole.entities.MemeScoutAlert.create({
        mint, symbol, name, score, marketCap, liquidityUsd,
        imageUrl, websiteUrl, twitterUrl, telegramUrl,
        priceUsd, priceChange24h, volume24h,
        dexUrl, rugcheckUrl, solscanUrl, source,
        // Safety fields
        stage, rugScore, rugged, mintAuthorityRevoked, freezeAuthorityDisabled,
        riskFlags, riskLevel, lpStatus, lpLocked, lpBurned,
        createdAtMs: createdAtMs || Date.now(),
        status: status || 'candidate',
        raw
      });
    }

    return json({ ok: true });

  } catch (error) {
    console.error('[MemeScoutIngest] Error:', error);
    return json({ ok: false, error: error.message }, 500);
  }
});