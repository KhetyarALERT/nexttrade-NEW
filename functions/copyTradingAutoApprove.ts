// @ts-nocheck
/// <reference lib="deno.ns" />
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Process auto-acceptance for pending signal deliveries
// Triggered by Automation when SignalDelivery is created or periodically
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    // Auth check (admin or automation)
    const user = await base44.auth.me();
    // Allow if admin or no user (automation usually runs as service role or admin)
    // Actually Base44 automations run with full access via SDK if configured, but let's check basic auth presence
    if (user && user.role !== 'admin') {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }

    // 1. Find Pending Signal Deliveries
    // We only process 'PENDING' auto_status.
    // 'status' is 'DELIVERED' usually.
    const deliveries = await base44.asServiceRole.entities.SignalDelivery.filter({ 
      auto_status: 'PENDING' 
    }, '-delivered_at', 50); // Batch size 50

    if (!deliveries || deliveries.length === 0) {
      return Response.json({ ok: true, processed: 0, message: 'No pending deliveries' });
    }

    // Pre-fetch signals to avoid N+1
    const signalIds = [...new Set(deliveries.map(d => d.signal_id))];
    const signals = await Promise.all(signalIds.map(id => base44.asServiceRole.entities.Signal.get(id).catch(() => null)));
    const signalMap = signals.reduce((acc, s) => { if(s) acc[s.id] = s; return acc; }, {});

    let processedCount = 0;
    const now = new Date();

    for (const delivery of deliveries) {
      try {
        const signal = signalMap[delivery.signal_id];
        
        // --- GUARDRAIL 1: Signal Existence & Status ---
        if (!signal || signal.status !== 'ACTIVE') {
          await updateDeliveryStatus(base44, delivery.id, 'FAILED', 'Signal not active or missing');
          continue;
        }

        // --- GUARDRAIL 2: User Auto-Enabled ---
        const settingsRes = await base44.asServiceRole.entities.CopyTradingSettings.filter({ user_id: delivery.user_id });
        const settings = settingsRes?.[0];

        if (!settings || !settings.auto_enabled) {
          // Not enabled -> Skip (remain manual)
          await updateDeliveryStatus(base44, delivery.id, 'SKIPPED', 'Auto-trading disabled');
          continue;
        }

        // --- GUARDRAIL 3: Expiry ---
        const createdAt = new Date(signal.created_at || signal.published_at);
        const expirySeconds = settings.signal_expiry_seconds || 180;
        const ageSeconds = (now.getTime() - createdAt.getTime()) / 1000;
        
        if (ageSeconds > expirySeconds) {
          await updateDeliveryStatus(base44, delivery.id, 'EXPIRED', `Signal too old (${Math.round(ageSeconds)}s > ${expirySeconds}s)`);
          continue;
        }

        // --- GUARDRAIL 4: Price Deviation ---
        // Need live price. Fetching one by one is slow, but safe for MVP.
        let currentPrice = 0;
        try {
          const pRes = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${signal.symbol}`, { headers: { "User-Agent": "Mozilla/5.0" } });
          const pJson = await pRes.json();
          if (pJson.data?.[0]?.last) currentPrice = Number(pJson.data[0].last);
        } catch (e) {}

        if (currentPrice > 0 && signal.entry_price > 0) {
          const deviationPct = Math.abs(currentPrice - signal.entry_price) / signal.entry_price * 100;
          const maxDev = settings.max_entry_deviation_percent || 0.3;
          if (deviationPct > maxDev) {
            await updateDeliveryStatus(base44, delivery.id, 'SKIPPED', `Price deviation ${deviationPct.toFixed(2)}% > ${maxDev}%`);
            continue;
          }
        }

        // --- GUARDRAIL 5: Position Limits ---
        // Total positions
        const openPos = await base44.asServiceRole.entities.CopyPosition.filter({ user_id: delivery.user_id, status: 'OPEN' });
        const maxTotal = settings.max_open_positions_total || 5;
        if (openPos.length >= maxTotal) {
          await updateDeliveryStatus(base44, delivery.id, 'SKIPPED', `Max total positions reached (${openPos.length})`);
          continue;
        }
        
        // Per symbol
        const symbolPos = openPos.filter(p => p.symbol === signal.symbol);
        const maxSymbol = settings.max_open_positions_per_symbol || 2;
        if (symbolPos.length >= maxSymbol) {
          await updateDeliveryStatus(base44, delivery.id, 'SKIPPED', `Max positions for symbol reached (${symbolPos.length})`);
          continue;
        }

        // --- SIZING LOGIC ---
        let marginUsdt = 0;
        let leverage = 5;

        // Get Wallet for balance check
        const walletRes = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: delivery.user_id });
        const wallet = walletRes?.[0];
        if (!wallet) {
          await updateDeliveryStatus(base44, delivery.id, 'FAILED', 'Wallet not found');
          continue;
        }
        const available = wallet.available_balance || 0;

        // Mode: FIXED_MARGIN
        if (settings.mode === 'FIXED_MARGIN') {
          if (settings.fixed_margin_percent) {
            // Percent of available
            marginUsdt = available * (settings.fixed_margin_percent / 100);
          } else {
            // Fixed Amount
            marginUsdt = settings.fixed_margin_usdt || 5;
          }
        } 
        // Mode: RISK_BY_SL
        else if (settings.mode === 'RISK_BY_SL') {
          if (settings.require_sl && (!signal.stop_loss || signal.stop_loss <= 0)) {
            await updateDeliveryStatus(base44, delivery.id, 'SKIPPED', 'Missing SL for risk mode');
            continue;
          }
          
          if (signal.stop_loss > 0) {
            const riskPct = settings.risk_percent_equity || 1;
            // Equity approx = available + locked (or just available for safety)
            // Using available to be conservative
            const riskUsdt = available * (riskPct / 100);
            const riskPerUnit = Math.abs(signal.entry_price - signal.stop_loss);
            
            if (riskPerUnit > 0) {
              const sizeUnits = riskUsdt / riskPerUnit;
              const notional = sizeUnits * signal.entry_price;
              
              // Leverage determination needed for margin calc
              // We calc leverage first below, then margin
            } else {
               await updateDeliveryStatus(base44, delivery.id, 'FAILED', 'Invalid SL distance');
               continue;
            }
          } else {
             // Fallback or skip
             await updateDeliveryStatus(base44, delivery.id, 'SKIPPED', 'Missing SL');
             continue;
          }
        }

        // Determine Leverage
        const maxLev = Math.min(settings.max_leverage || 20, 20); // Platform cap 20
        if (settings.leverage_mode === 'FIXED') {
          leverage = Math.min(settings.fixed_leverage || 5, maxLev);
        } else {
          // Follow signal
          leverage = Math.min(signal.max_leverage || 5, maxLev);
        }

        // Recalculate Margin for RISK_BY_SL now that we have leverage
        if (settings.mode === 'RISK_BY_SL') {
           const riskPct = settings.risk_percent_equity || 1;
           const riskUsdt = available * (riskPct / 100);
           const riskPerUnit = Math.abs(signal.entry_price - signal.stop_loss);
           const sizeUnits = riskUsdt / riskPerUnit;
           const notional = sizeUnits * signal.entry_price;
           marginUsdt = notional / leverage;
        }

        // Clamp Margin
        const maxMargin = settings.max_margin_per_trade_usdt || 50;
        marginUsdt = Math.min(marginUsdt, maxMargin);
        
        // Final Balance Check
        // Rough check, exact check inside acceptSignalInternal
        if (marginUsdt > available) {
           await updateDeliveryStatus(base44, delivery.id, 'FAILED', `Insufficient balance (Need ${marginUsdt.toFixed(2)}, Have ${available.toFixed(2)})`);
           continue;
        }
        if (marginUsdt < 1) { // Min trade size guard
           await updateDeliveryStatus(base44, delivery.id, 'SKIPPED', `Calculated margin too small (${marginUsdt.toFixed(2)})`);
           continue;
        }

        // --- EXECUTION ---
        // Call internal accept function
        // We use invoke to call the function in the same context
        const response = await base44.functions.invoke('copyTradingUser', {
          action: 'acceptSignalInternal',
          targetUserId: delivery.user_id, // Pass target user
          signalId: signal.id,
          amount: marginUsdt,
          leverage: leverage,
          source: 'AUTO'
        });

        if (response.data?.ok) {
          await updateDeliveryStatus(base44, delivery.id, 'ACCEPTED', null);
          processedCount++;
        } else {
          const errorMsg = response.data?.error?.message || 'Unknown execution error';
          // Check specific error codes to distinguish failures
          const code = response.data?.error?.code;
          if (code === 'INSUFFICIENT_BALANCE') {
             await updateDeliveryStatus(base44, delivery.id, 'FAILED', 'Insufficient balance at execution');
          } else {
             await updateDeliveryStatus(base44, delivery.id, 'FAILED', errorMsg);
          }
        }

      } catch (err) {
        console.error(`Error processing delivery ${delivery.id}:`, err);
        await updateDeliveryStatus(base44, delivery.id, 'FAILED', `Internal error: ${err.message}`);
      }
    }

    return Response.json({ ok: true, processed: processedCount, totalPending: deliveries.length });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});

async function updateDeliveryStatus(base44, id, status, errorMsg) {
  try {
    const payload = {
      auto_status: status,
      processed_at: new Date().toISOString()
    };
    if (errorMsg) payload.auto_error = errorMsg;
    
    await base44.asServiceRole.entities.SignalDelivery.update(id, payload);
  } catch (e) {
    console.error(`Failed to update delivery ${id}:`, e);
  }
}