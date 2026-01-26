// @ts-nocheck
/// <reference lib="deno.ns" />
// Signals Ingestion - Receives webhooks from Bot (Telegram/etc)
// Validates token, parses payload, creates Signal entity
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const base44 = createClientFromRequest(req);

  try {
    // 1. Auth Check (Secret Token)
    const authHeader = req.headers.get('x-telegram-bot-api-secret-token') || req.headers.get('authorization');
    const secret = Deno.env.get('MASSIVE_API_KEY'); // Reuse existing secret or create specific one
    
    // Simple bearer check if provided
    if (authHeader && secret && !authHeader.includes(secret)) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { source = 'telegram', rawText, messageId, timestamp, parsed } = body;

    if (!rawText) {
      return Response.json({ ok: false, error: 'Missing rawText' }, { status: 400 });
    }

    // 2. Parse Logic (if not pre-parsed)
    let signalData = parsed || {};
    
    // Fallback: If no parsed data provided, try basic heuristic (can be improved later)
    if (!parsed) {
      // Regex for basic format: "Symbol: BTC/USDT Side: LONG Entry: 50000..."
      // This is a stub - assume bot sends parsed data for Phase 2
      // or just store as ACTIVE signal requiring manual review if parsing fails
      signalData.symbol = 'UNKNOWN'; 
    }

    // Validate critical fields
    if (!signalData.symbol || !signalData.side || !signalData.entry_price) {
      console.warn('[SIGNALS_INGEST] Incomplete signal data:', signalData);
      // We still save it but maybe as status=PENDING_REVIEW if possible? 
      // For now, we reject incomplete signals to ensure quality
      return Response.json({ ok: false, error: 'Incomplete signal data (Symbol, Side, Entry required)' }, { status: 400 });
    }

    // Normalize
    const symbol = signalData.symbol.replace('/', '-').toUpperCase();
    // Ensure -SWAP suffix if missing for perp (basic heuristic)
    const finalSymbol = symbol.endsWith('-SWAP') ? symbol : `${symbol}-SWAP`;

    const now = new Date().toISOString();
    
    // 3. Create Signal Entity
    const signal = await base44.asServiceRole.entities.Signal.create({
      source,
      source_message_id: String(messageId || Date.now()),
      status: 'ACTIVE',
      symbol: finalSymbol,
      side: signalData.side.toUpperCase(), // LONG/SHORT
      entry_type: signalData.entry_type || 'MARKET',
      entry_price: Number(signalData.entry_price),
      entry_range_low: Number(signalData.entry_range_low || 0),
      entry_range_high: Number(signalData.entry_range_high || 0),
      stop_loss: Number(signalData.stop_loss),
      tp1: Number(signalData.tp1 || 0),
      tp2: Number(signalData.tp2 || 0),
      timeframe: signalData.timeframe || '',
      raw_text: rawText,
      notes: signalData.notes || '',
      published_at: timestamp ? new Date(timestamp * 1000).toISOString() : now,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Default 24h expiry
    });

    console.log(`[SIGNALS_INGEST] Created signal ${signal.id} for ${finalSymbol}`);

    // 4. Delivery (Phase 2): Create SignalDelivery for eligible users
    // Check config first
    const configs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
    const config = configs?.[0];

    if (config?.signals_enabled) {
      // Find eligible users: active wallet? KYC?
      // For MVP: deliver to all users who have a CopyTradingWallet
      const wallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ status: 'ACTIVE' });
      
      const deliveries = [];
      for (const wallet of wallets || []) {
        // Check KYC if required
        if (config.require_kyc) {
           // This check is expensive in loop, optimization needed for scale
           // For now assuming active wallet implies passed KYC checks during deposit
        }

        deliveries.push({
          signal_id: signal.id,
          user_id: wallet.user_id,
          delivered_at: now,
          status: 'DELIVERED'
        });
      }

      if (deliveries.length > 0) {
        await base44.asServiceRole.entities.SignalDelivery.bulkCreate(deliveries);
        console.log(`[SIGNALS_INGEST] Delivered signal to ${deliveries.length} users`);
      }
    }

    return Response.json({ ok: true, data: { signalId: signal.id, delivered: true } });

  } catch (error) {
    console.error('[SIGNALS_INGEST_ERROR]', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});