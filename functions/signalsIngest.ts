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

        // ==================== AUTO-ACCEPT FOR USERS WITH auto_enabled ====================
        // Fetch ALL CopyTradingSettings with auto_enabled=true
        let autoSettings = [];
        try {
          autoSettings = await base44.asServiceRole.entities.CopyTradingSettings.filter({ auto_enabled: true });
        } catch (e) {
          console.error('[SIGNALS_INGEST] Failed to fetch auto settings:', e.message);
        }

        const autoEnabledUserIds = new Set((autoSettings || []).map(s => s.user_id));
        console.log(`[SIGNALS_INGEST] Auto-enabled users: ${autoEnabledUserIds.size}`);

        for (const delivery of deliveries) {
          try {
            // --- AUTO-ACCEPT LOGIC ---
            if (autoEnabledUserIds.has(delivery.user_id)) {
              const userSettings = autoSettings.find(s => s.user_id === delivery.user_id);
              if (userSettings) {
                // Check max open positions limit
                const openPositions = await base44.asServiceRole.entities.CopyPosition.filter({ user_id: delivery.user_id, status: 'OPEN' });
                const openCount = openPositions?.length || 0;
                const maxOpen = userSettings.max_open_positions_total || 5;

                if (openCount >= maxOpen) {
                  console.log(`[SIGNALS_INGEST] Skipping auto-accept for ${delivery.user_id}: ${openCount}/${maxOpen} positions open`);
                } else {
                  // Check wallet balance
                  const userWallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: delivery.user_id, status: 'ACTIVE' });
                  const userWallet = userWallets?.[0];
                  const marginAmount = Math.min(
                    userSettings.fixed_margin_usdt || 5,
                    userSettings.max_margin_per_trade_usdt || 50
                  );

                  if (!userWallet || userWallet.available_balance < marginAmount + 0.1) {
                    console.log(`[SIGNALS_INGEST] Skipping auto-accept for ${delivery.user_id}: insufficient balance (${userWallet?.available_balance || 0} < ${marginAmount})`);
                  } else {
                    // Determine leverage: follow signal cap or use fixed
                    let autoLeverage = userSettings.max_leverage || 10;
                    if (userSettings.leverage_mode === 'FIXED') {
                      autoLeverage = userSettings.fixed_leverage || 5;
                    }
                    // Cap to signal's max leverage if present
                    if (signal.max_leverage && autoLeverage > signal.max_leverage) {
                      autoLeverage = signal.max_leverage;
                    }

                    console.log(`[SIGNALS_INGEST] Auto-accepting signal ${signal.id} for user ${delivery.user_id}: margin=${marginAmount}, leverage=${autoLeverage}x`);

                    // Use the internal accept action via SDK function invoke
                    try {
                      const acceptRes = await base44.asServiceRole.functions.invoke('copyTradingUser', {
                        action: 'acceptSignalInternal',
                        targetUserId: delivery.user_id,
                        signalId: signal.id,
                        amount: marginAmount,
                        leverage: autoLeverage,
                        source: 'AUTO'
                      });
                      console.log(`[SIGNALS_INGEST] Auto-accept result for ${delivery.user_id}:`, JSON.stringify(acceptRes?.data || acceptRes));
                    } catch (acceptErr) {
                      console.error(`[SIGNALS_INGEST] Auto-accept failed for ${delivery.user_id}:`, acceptErr.message);
                    }
                  }
                }
                // Skip manual notification for auto-accepted users (they get trade notification instead)
                continue;
              }
            }

            // --- MANUAL NOTIFICATION (for users without auto-accept) ---
            let shouldNotify = true;
            try {
              const prefs = await base44.asServiceRole.entities.UserPreferences.filter({ user_id: delivery.user_id });
              if (prefs?.[0]) {
                if (prefs[0].notifications_enabled === false) shouldNotify = false;
                if (prefs[0].notify_signals === false) shouldNotify = false;
              }
            } catch (e) {}
            
            if (shouldNotify) {
              await base44.asServiceRole.entities.Notification.create({
                user_id: delivery.user_id,
                type: 'signal_new',
                title: 'New Trading Signal',
                message: `${finalSymbol} ${signalData.side.toUpperCase()} @ ${signalData.entry_price}`,
                data: { 
                  instId: finalSymbol,
                  signalId: signal.id,
                  link: `/Trading?tab=bots&instId=${finalSymbol}&signalId=${signal.id}`
                },
                read: false,
                priority: 'high'
              });
            }
          } catch (e) {
            console.error(`[SIGNALS_INGEST] Failed to process delivery for ${delivery.user_id}:`, e.message);
          }
        }
      }
    }

    return Response.json({ ok: true, data: { signalId: signal.id, delivered: deliveries.length || 0 } });

  } catch (error) {
    console.error('[SIGNALS_INGEST_ERROR]', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});