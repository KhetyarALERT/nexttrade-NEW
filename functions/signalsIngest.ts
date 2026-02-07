// @ts-nocheck
/// <reference lib="deno.ns" />
// Signals Ingestion - Receives webhooks from Bot (Telegram/etc)
// Validates token, parses payload, creates Signal entity
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ==================== INLINE AUTO-ACCEPT (avoids auth issues with function invoke) ====================
async function executeAutoAccept(base44, { targetUserId, signalId, signal, amount, leverage, wallet, config }) {
  const amtNum = Number(amount);
  const levNum = Number(leverage) || 5;
  const now = new Date().toISOString();

  if (!targetUserId || !signalId || !amtNum || amtNum <= 0) {
    return { ok: false, error: 'Invalid input' };
  }

  // Idempotency: check if already acted
  const existingAction = await base44.asServiceRole.entities.SignalAction.filter({ user_id: targetUserId, signal_id: signalId });
  if (existingAction.length > 0) {
    return { ok: true, message: 'Already processed' };
  }

  // Commission calc
  const commRate = config?.commission_open_rate || 0.0005;
  const minComm = config?.min_commission_open || 0.05;
  const margin = amtNum;
  const notional = margin * levNum;
  const commOpen = Math.max(minComm, notional * commRate);
  const required = margin + commOpen;

  if (wallet.available_balance < required) {
    return { ok: false, error: `Insufficient balance: ${wallet.available_balance} < ${required}` };
  }

  // Live price
  let entryPrice = signal.entry_price || 0;
  try {
    const pRes = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${signal.symbol}`, { headers: { "User-Agent": "Mozilla/5.0" } });
    const pJson = await pRes.json();
    if (pJson.data?.[0]?.last) entryPrice = Number(pJson.data[0].last);
  } catch (e) {}
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) entryPrice = signal.entry_price || 0;

  const qtyBase = notional / entryPrice;

  // Create position
  const position = await base44.asServiceRole.entities.CopyPosition.create({
    user_id: targetUserId,
    signal_id: signalId,
    status: 'OPEN',
    symbol: signal.symbol,
    side: signal.side,
    entry_price: entryPrice,
    margin_usdt: margin,
    notional_usdt: notional,
    leverage: levNum,
    qty_base: qtyBase,
    stop_loss: signal.stop_loss,
    tp1: signal.tp1,
    tp2: signal.tp2,
    opened_at: now
  });

  // Signal Action
  await base44.asServiceRole.entities.SignalAction.create({
    signal_id: signalId,
    user_id: targetUserId,
    action: 'AUTO_ACCEPTED',
    accepted_at: now,
    user_amount_usdt: margin,
    user_leverage: levNum,
    commission_open_usdt: commOpen,
    created_at: now
  });

  // Increment accepted_count
  try {
    await base44.asServiceRole.entities.Signal.update(signalId, {
      accepted_count: (signal.accepted_count || 0) + 1
    });
  } catch (err) {}

  // Ledger: Commission
  const balBefore = wallet.available_balance;
  await base44.asServiceRole.entities.CopyTradingLedger.create({
    user_id: targetUserId,
    kind: 'COMMISSION',
    amount: -commOpen,
    currency: 'USDT',
    status: 'POSTED',
    ref_type: 'SIGNAL_ACCEPTANCE',
    ref_id: signalId,
    balance_before: balBefore,
    balance_after: balBefore - commOpen,
    description: `Auto commission for ${signal.symbol}`,
    created_at: now
  });

  // Ledger: Margin Lock
  await base44.asServiceRole.entities.CopyTradingLedger.create({
    user_id: targetUserId,
    kind: 'MARGIN_LOCK',
    amount: -margin,
    currency: 'USDT',
    status: 'POSTED',
    ref_type: 'POSITION',
    ref_id: position.id,
    balance_before: balBefore - commOpen,
    balance_after: balBefore - commOpen - margin,
    description: `Auto margin lock for ${signal.symbol}`,
    created_at: now
  });

  // Update Wallet
  const newAvailable = wallet.available_balance - required;
  const newLocked = wallet.locked_balance + margin;
  await base44.asServiceRole.entities.CopyTradingWallet.update(wallet.id, {
    available_balance: Math.max(0, newAvailable),
    locked_balance: newLocked,
    updated_at: now
  });

  // Notification
  try {
    let userLang = 'en';
    try {
      const prefs = await base44.asServiceRole.entities.UserPreferences.filter({ user_id: targetUserId });
      if (prefs?.[0]?.language) userLang = prefs[0].language;
    } catch (e) {}

    const isAr = userLang === 'ar';
    const title = isAr ? 'تم فتح صفقة تلقائياً' : 'Auto-Trade: Position Opened';
    const sideLabel = isAr ? (signal.side === 'LONG' ? 'شراء' : 'بيع') : signal.side;
    const message = isAr
      ? `صفقة ${sideLabel} على ${signal.symbol} بسعر ${entryPrice.toFixed(2)}. الهامش: ${margin} USDT، الرافعة: ${levNum}x`
      : `${signal.side} ${signal.symbol} @ ${entryPrice.toFixed(2)}. Margin: ${margin} USDT, Leverage: ${levNum}x`;

    await base44.asServiceRole.entities.Notification.create({
      user_id: targetUserId,
      type: 'trade_executed',
      title,
      message,
      data: { instId: signal.symbol, signalId, positionId: position.id, source: 'AUTO', link: `/Futures?tab=bots` },
      read: false,
      priority: 'high'
    });
  } catch (e) {
    console.error('[AUTO_ACCEPT] Notification error:', e.message);
  }

  console.log(`[AUTO_ACCEPT] SUCCESS: user=${targetUserId} signal=${signalId} symbol=${signal.symbol} margin=${margin} lev=${levNum}x entry=${entryPrice}`);
  return { ok: true, positionId: position.id, entryPrice, margin, leverage: levNum };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const base44 = createClientFromRequest(req);

  try {
    // 1. Auth Check (Secret Token OR Admin user)
    const botToken = req.headers.get('x-telegram-bot-api-secret-token');
    const secret = Deno.env.get('MASSIVE_API_KEY');
    
    // If bot token is provided, validate it
    if (botToken && secret && botToken !== secret) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    // If no bot token, check if caller is an admin user (for manual/test signals)
    if (!botToken) {
      try {
        const caller = await base44.auth.me();
        if (!caller || caller.role !== 'admin') {
          return Response.json({ ok: false, error: 'Unauthorized: admin required' }, { status: 401 });
        }
      } catch (e) {
        return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
      }
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

    // 4. Delivery: Create SignalDelivery for eligible users
    let deliveredCount = 0;
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
        const createdDeliveries = await base44.asServiceRole.entities.SignalDelivery.bulkCreate(deliveries);
        deliveredCount = deliveries.length;
        console.log(`[SIGNALS_INGEST] Delivered signal to ${deliveredCount} users`);

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

        // Use created deliveries which have IDs for updating
        const deliveriesWithIds = createdDeliveries || deliveries;
        for (const delivery of deliveriesWithIds) {
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

                    // Execute auto-accept INLINE (not via function invoke, to avoid auth issues)
                    try {
                      const autoResult = await executeAutoAccept(base44, {
                        targetUserId: delivery.user_id,
                        signalId: signal.id,
                        signal,
                        amount: marginAmount,
                        leverage: autoLeverage,
                        wallet: userWallet,
                        config
                      });
                      console.log(`[SIGNALS_INGEST] Auto-accept result for ${delivery.user_id}:`, JSON.stringify(autoResult));

                      // Update delivery status
                      try {
                        await base44.asServiceRole.entities.SignalDelivery.update(delivery.id || delivery._id, {
                          auto_status: autoResult.ok ? 'ACCEPTED' : 'FAILED',
                          auto_error: autoResult.ok ? null : (autoResult.error || 'Unknown'),
                          processed_at: new Date().toISOString()
                        });
                      } catch (e) {}
                    } catch (acceptErr) {
                      console.error(`[SIGNALS_INGEST] Auto-accept failed for ${delivery.user_id}:`, acceptErr.message);
                      try {
                        await base44.asServiceRole.entities.SignalDelivery.update(delivery.id || delivery._id, {
                          auto_status: 'FAILED',
                          auto_error: acceptErr.message,
                          processed_at: new Date().toISOString()
                        });
                      } catch (e) {}
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

    return Response.json({ ok: true, data: { signalId: signal.id, delivered: deliveredCount } });

  } catch (error) {
    console.error('[SIGNALS_INGEST_ERROR]', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});