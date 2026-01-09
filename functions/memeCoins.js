/**
 * Meme Coins Backend Function - DEPRECATED
 * 
 * This function is no longer used. The frontend now calls DexScreener API directly
 * since DexScreener supports CORS and doesn't require a backend proxy.
 * 
 * This file is kept as a placeholder. You can delete it from Base44 dashboard.
 */

// Simple pass-through function that returns a deprecation notice
Deno.serve(async (req) => {
  return Response.json({
    success: false,
    error: 'This endpoint is deprecated. Use the DexScreener API directly from the frontend.',
    documentation: 'https://docs.dexscreener.com/api/reference'
  }, { status: 410 }); // 410 Gone
});
