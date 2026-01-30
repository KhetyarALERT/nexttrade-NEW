// @ts-nocheck
/// <reference lib="deno.ns" />

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const JUPITER_QUOTE_BASE = 'https://quote-api.jup.ag/v6';

function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...(init.headers || {})
    }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Methods': 'POST, OPTIONS', 
        'Access-Control-Allow-Headers': 'Content-Type, Authorization' 
      }
    });
  }
  
  let base44;
  let user;
  
  try {
    base44 = createClientFromRequest(req);
    // Optional auth check - strictly strictly for logging/tracking if needed
    user = await base44.auth.me().catch(() => null);
  } catch {
    // Continue without auth
  }
  
  try {
    const body = await req.json().catch(() => ({}));
    const { action, ...params } = body;

    // ==================== GET QUOTE ====================
    if (action === 'getQuote') {
      const { inMint, outMint, amountIn, slippageBps = 50 } = params;
      
      if (!inMint || !outMint || !amountIn) {
        return json({ ok: false, error: { code: 'MISSING_PARAMS', message: 'inMint, outMint, amountIn required' } }, { status: 400 });
      }
      
      const queryParams = new URLSearchParams({
        inputMint: String(inMint),
        outputMint: String(outMint),
        amount: String(amountIn),
        slippageBps: String(slippageBps)
      });
      
      let res, data;
      let retries = 3;
      while (retries > 0) {
        try {
          res = await fetch(`${JUPITER_QUOTE_BASE}/quote?${queryParams.toString()}`);
          data = await res.json();
          if (res.ok) break;
          throw new Error(data.error || 'Quote failed');
        } catch (e) {
          retries--;
          if (retries === 0) {
             console.error('Jupiter Quote Error:', e);
             return json({ ok: false, error: { code: 'QUOTE_FAILED', message: e.message } }, { status: 500 });
          }
          await new Promise(r => setTimeout(r, 500)); // Wait 500ms
        }
      }
      
      return json({
        ok: true,
        data: {
          inMint,
          outMint,
          inAmount: data.inAmount,
          outAmount: data.outAmount,
          priceImpactPct: data.priceImpactPct,
          slippageBps: data.slippageBps,
          routePlan: data.routePlan,
          quoteResponse: data
        }
      });
    }
    
    // ==================== BUILD SWAP TX ====================
    if (action === 'buildSwapTx') {
      const { userPubkey, quoteResponse, wrapUnwrapSOL = true } = params;
      
      if (!userPubkey || !quoteResponse) {
        return json({ ok: false, error: { code: 'MISSING_PARAMS', message: 'userPubkey and quoteResponse required' } }, { status: 400 });
      }
      
      const swapPayload = {
        quoteResponse,
        userPublicKey: String(userPubkey),
        wrapAndUnwrapSol: wrapUnwrapSOL,
        prioritizationFeeLamports: 'auto'
      };
      
      const res = await fetch(`${JUPITER_QUOTE_BASE}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(swapPayload)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        return json({ ok: false, error: { code: 'SWAP_BUILD_FAILED', message: data.error || 'Swap build failed' } }, { status: res.status });
      }
      
      // Log trade if user exists (fire and forget)
      if (user && base44) {
        try {
          await base44.asServiceRole.entities.MemeTradeLog.create({
            user_id: user.id,
            trade_type: 'JUPITER_SWAP',
            mint_in: quoteResponse.inputMint,
            mint_out: quoteResponse.outputMint,
            amount_in: Number(quoteResponse.inAmount),
            status: 'PENDING',
            wallet_address: userPubkey,
            created_at: new Date().toISOString()
          });
        } catch (e) {
          console.error("Failed to log trade", e);
        }
      }
      
      return json({
        ok: true,
        data: {
          swapTransaction: data.swapTransaction,
          lastValidBlockHeight: data.lastValidBlockHeight
        }
      });
    }
    
    return json({ ok: false, error: { code: 'INVALID_ACTION', message: 'Invalid action' } }, { status: 400 });
    
  } catch (error) {
    return json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});