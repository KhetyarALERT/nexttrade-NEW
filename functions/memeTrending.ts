import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const window = url.searchParams.get("window") || "5m"; // 5m, 1h, 24h
    const limit = parseInt(url.searchParams.get("limit") || "50");

    // Fetch top tokens by trend_score from cache
    const tokens = await base44.entities.MemeTokenCache.list('-trend_score', limit);

    return Response.json({
      ok: true,
      data: tokens,
      meta: {
        window,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});