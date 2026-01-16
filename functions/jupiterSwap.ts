// @ts-nocheck
/// <reference lib="deno.ns" />
// Jupiter Swap Functions - Quotes and transaction building for POST_DEX tokens

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const JUPITER_QUOTE_BASE = 'https://quote-api.jup.ag/v6';

function json(data, init = {}) {
  return Response.json(data, init);
}

function auditLog(action, userId, details) {
  console.log(`[JUPITER] [${new Date().toISOString()}] [${action}] User: ${userId || 'anon'}`, JSON.stringify(details));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }
    });
  }
  
  let base44 = null;
  let user = null;
  
  try {
    base44 = createClientFromRequest(req);
    user = await base44.auth.me().catch(() => null);
  } catch {
    // Allow some actions without auth
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
      
      const res = await fetch(`${JUPITER_QUOTE_BASE}/quote?${queryParams.toString()}`);
      
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        return json({ ok: false, error: { code: 'QUOTE_FAILED', message: errorBody.error || 'Quote failed', status: res.status } }, { status: res.status });
      }
      
      const quoteData = await res.json();
      
      return json({
        ok: true,
        data: {
          inMint,
          outMint,
          inAmount: quoteData.inAmount,
          outAmount: quoteData.outAmount,
          priceImpactPct: quoteData.priceImpactPct,
          slippageBps: quoteData.slippageBps,
          routePlan: quoteData.routePlan,
          quoteResponse: quoteData // Full response for buildSwapTx
        }
      });
    }
    
    // ==================== BUILD SWAP TX ====================
    if (action === 'buildSwapTx') {
      const { userPubkey, quoteResponse, wrapUnwrapSOL = true } = params;
      
      if (!userPubkey || !quoteResponse) {
        return json({ ok: false, error: { code: 'MISSING_PARAMS', message: 'userPubkey and quoteResponse required' } }, { status: 400 });
      }
      
      auditLog('BUILD_SWAP_TX', user?.id, { 
        userPubkey, 
        inMint: quoteResponse.inputMint, 
        outMint: quoteResponse.outputMint,
        inAmount: quoteResponse.inAmount,
        outAmount: quoteResponse.outAmount
      });
      
      const swapPayload = {
        quoteResponse,
        userPublicKey: String(userPubkey),
        wrapAndUnwrapSol: wrapUnwrapSOL,
        computeUnitPriceMicroLamports: 'auto',
        dynamicComputeUnitLimit: true
      };
      
      const res = await fetch(`${JUPITER_QUOTE_BASE}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(swapPayload)
      });
      
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        return json({ ok: false, error: { code: 'SWAP_BUILD_FAILED', message: errorBody.error || 'Swap build failed', status: res.status } }, { status: res.status });
      }
      
      const swapData = await res.json();
      
      // Log trade if user is authenticated
      if (user && base44) {
        const nowISO = new Date().toISOString();
        await base44.asServiceRole.entities.MemeTradeLog.create({
          user_id: user.id,
          trade_type: 'JUPITER_SWAP',
          mint_in: quoteResponse.inputMint,
          mint_out: quoteResponse.outputMint,
          amount_in: parseFloat(quoteResponse.inAmount) / 1e9, // Assuming SOL decimals
          expected_amount_out: parseFloat(quoteResponse.outAmount) / 1e9,
          slippage_bps: quoteResponse.slippageBps,
          price_impact: parseFloat(quoteResponse.priceImpactPct),
          status: 'PENDING',
          wallet_address: userPubkey,
          route_info: quoteResponse.routePlan,
          created_at: nowISO
        });
      }
      
      return json({
        ok: true,
        data: {
          swapTransaction: swapData.swapTransaction, // Base64 encoded transaction
          lastValidBlockHeight: swapData.lastValidBlockHeight
        }
      });
    }
    
    // ==================== TRACK TX ====================
    if (action === 'trackTx') {
      if (!user) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Login required' } }, { status: 401 });
      
      const { signature, tradeLogId } = params;
      if (!signature) return json({ ok: false, error: { code: 'MISSING_SIGNATURE', message: 'Signature required' } }, { status: 400 });
      
      const nowISO = new Date().toISOString();
      
      // Create transaction log
      await base44.asServiceRole.entities.SolanaTxLog.create({
        user_id: user.id,
        signature,
        tx_type: 'SWAP',
        status: 'CONFIRMING',
        created_at: nowISO
      });
      
      // Update trade log if provided
      if (tradeLogId) {
        await base44.asServiceRole.entities.MemeTradeLog.update(tradeLogId, {
          signature,
          status: 'SUBMITTED',
          submitted_at: nowISO
        });
      }
      
      return json({
        ok: true,
        data: {
          signature,
          status: 'CONFIRMING',
          message: 'Transaction submitted. Check explorer for confirmation.'
        }
      });
    }
    
    return json({ ok: false, error: { code: 'INVALID_ACTION', message: 'Invalid action' } }, { status: 400 });
    
  } catch (error) {
    console.error('[JUPITER_ERROR]', error.message);
    return json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});