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
    
    // Status filter: If not provided, we include 'candidate' and 'approved' (exclude rejected if desired, but user said "return BOTH candidate and approved"). 
    // Usually "solid picks" shouldn't include rejected.
    // However, user said "If status is NOT provided ... return BOTH candidate and approved records".
    // I'll explicitly filter for these two if status is missing.
    
    const filter = {};
    if (body.status) {
      filter.status = body.status;
    } else {
      // Default to showing candidates and approved
      filter.status = { $in: ['candidate', 'approved'] };
    }
    
    const limit = body.limit && Number(body.limit) > 0 ? Number(body.limit) : 30;
    
    // Use string format for sort: '-createdAtMs' for descending
    const alerts = await base44.asServiceRole.entities.MemeScoutAlert.filter(
      filter, 
      '-createdAtMs',
      limit
    );

    return json({ ok: true, data: alerts });

  } catch (error) {
    console.error('[MemeScoutList] Error:', error);
    return json({ ok: false, error: error.message }, 500);
  }
});