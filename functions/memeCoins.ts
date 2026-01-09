// @ts-nocheck
/// <reference lib="deno.ns" />
// deno-lint-ignore-file

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const JUPITER_QUOTE_BASE = 'https://quote-api.jup.ag/v6';
const JUPITER_PRICE_BASE = 'https://price.jup.ag/v6';

function json(data, init = {}) {
  return Response.json(data, init);
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' }, { status: 405 });
    }

    // Create client (auth may or may not be present depending on app settings)
    try {
      const base44 = createClientFromRequest(req);
      await base44.auth.me().catch(() => null);
    } catch {
      // ignore base44 client init failures for public usage
    }

    const payload = await req.json().catch(() => ({}));
    const action = payload?.action;

    if (action === 'getSwapQuote') {
      const { inputMint, outputMint, amount, slippageBps } = payload || {};
      if (!inputMint || !outputMint || !amount) {
        return json({ success: false, error: 'Missing required params' }, { status: 400 });
      }

      const params = new URLSearchParams({
        inputMint: String(inputMint),
        outputMint: String(outputMint),
        amount: String(amount),
        slippageBps: String(slippageBps ?? 50),
      });

      const res = await fetch(`${JUPITER_QUOTE_BASE}/quote?${params.toString()}`);
      if (!res.ok) {
        const body = await safeJson(res);
        return json(
          { success: false, error: 'Jupiter quote failed', status: res.status, details: body },
          { status: res.status }
        );
      }

      const data = await res.json();
      return json({ success: true, data });
    }

    if (action === 'getSwapTransaction') {
      const { quoteResponse, userPublicKey, wrapUnwrapSOL } = payload || {};
      if (!quoteResponse || !userPublicKey) {
        return json({ success: false, error: 'Missing required params' }, { status: 400 });
      }

      const res = await fetch(`${JUPITER_QUOTE_BASE}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey: String(userPublicKey),
          wrapAndUnwrapSol: wrapUnwrapSOL ?? true,
          computeUnitPriceMicroLamports: 'auto',
        }),
      });

      if (!res.ok) {
        const body = await safeJson(res);
        return json(
          { success: false, error: 'Jupiter swap failed', status: res.status, details: body },
          { status: res.status }
        );
      }

      const data = await res.json();
      return json({ success: true, data });
    }

    if (action === 'getTokenPrice') {
      const { mint } = payload || {};
      if (!mint) {
        return json({ success: false, error: 'Missing mint' }, { status: 400 });
      }

      const res = await fetch(`${JUPITER_PRICE_BASE}/price?ids=${encodeURIComponent(String(mint))}`);
      if (!res.ok) {
        const body = await safeJson(res);
        return json(
          { success: false, error: 'Jupiter price failed', status: res.status, details: body },
          { status: res.status }
        );
      }

      const data = await res.json();
      return json({ success: true, data });
    }

    return json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
});
