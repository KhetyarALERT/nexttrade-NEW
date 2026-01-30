// @ts-nocheck
/// <reference lib="deno.ns" />

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    
    // Default filter by status if not provided, or 'candidate'/'approved'
    // Actually, prompt says: status?: "candidate"|"approved"|"rejected"
    // If not specified, maybe return all or just candidate/approved?
    // Let's support filtering.
    
    const filter = {};
    if (body.status) {
      filter.status = body.status;
    }
    
    const limit = body.limit || 30;
    
    // Order by createdAtMs descending
    const alerts = await base44.asServiceRole.entities.MemeScoutAlert.filter(
      filter, 
      { sort: { createdAtMs: -1 }, limit }
    );

    return json({ ok: true, data: alerts });

  } catch (error) {
    console.error('[MemeScoutList] Error:', error);
    return json({ ok: false, error: error.message }, 500);
  }
});