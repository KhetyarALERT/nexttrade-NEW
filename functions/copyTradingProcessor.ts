// @ts-nocheck
/// <reference lib="deno.ns" />
// Copy Trading Processor - Isolated & Robust
// Handles SL/TP/Liquidation for internal Copy Trading only.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper to fetch all tickers efficiently (Batch Request)
async function getTickerMap(instType) {
  try {
    const res = await fetch(`https://www.okx.com/api/v5/market/tickers?instType=${instType}`, {
      headers: { "User-Agent": "Base44/CopyTradingProcessor" }
    });
    const json = await res.json();
    if (json.code !== '0') {
      console.error(`[PROCESSOR] OKX API Error for ${instType}:`, json.msg);
      return {};
    }
    
    const map = {};
    for (const item of json.data || []) {
      map[item.instId] = Number(item.last);
    }
    return map;
  } catch (e) {
    console.error(`[PROCESSOR] Failed to fetch tickers for ${instType}:`, e);
    return {};
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const startTs = Date.now();

  try {
    const user = await base44.auth.me();
    // Strict admin check
    if (user?.role !== 'admin') {
       return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // 1. Fetch Open Positions
    // Increased limit to 1000 to cover all active positions
    const positions = await base44.asServiceRole.entities.CopyPosition.filter({ status: 'OPEN' }, '-opened_at', 1000);
    
    if (!positions?.length) {
      return Response.json({ ok: true, message: 'No open positions', processed: 0 });
    }

    // 2. Fetch Config for Commission
    const configs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
    const config = configs?.[0];
    const commRate = config?.commission_close_rate || 0.0005;
    const minComm = config?.min_commission_close || 0.05;

    // 3. Batch Fetch Prices (Zero API Spam)
    let needSwap = false;
    let needSpot = false;
    
    for (const p of positions) {
      if (p.symbol.endsWith('-SWAP')) needSwap = true;
      else needSpot = true; 
    }

    const priceMap = {};
    if (needSwap) Object.assign(priceMap, await getTickerMap('SWAP'));
    if (needSpot) Object.assign(priceMap, await getTickerMap('SPOT'));

    if (Object.keys(priceMap).length === 0) {
       console.warn('[PROCESSOR] No prices fetched, skipping run safely.');
       return Response.json({ ok: false, error: 'Price feed failed' });
    }

    let processed = 0;
    const updates = [];

    // 4. Check Logic & Execute Closes
    for (const pos of positions) {
      const currentPrice = priceMap[pos.symbol];
      
      // Skip if price unavailable (safe skip)
      if (!currentPrice) continue;

      // EXPLICIT POSITION SIZING (Backwards Compatible)
      const margin = pos.margin_usdt || (pos.notional_usdt / pos.leverage);
      const qty = pos.qty_base || (pos.notional_usdt / pos.entry_price);
      const side = pos.side;

      // 1. Calculate PnL (Linear Math)
      let rawPnl = 0;
      if (side === 'LONG') {
        rawPnl = (currentPrice - pos.entry_price) * qty;
      } else {
        rawPnl = (pos.entry_price - currentPrice) * qty;
      }

      let pnl = Number(rawPnl.toFixed(2));
      let closeReason = null;

      // 2. LIQUIDATION GUARD (Highest Priority)
      // If loss exceeds margin (pnl <= -margin), liquidate.
      // E.g. Margin 10, PnL -12 -> Liquidate, Cap loss at -10.
      if (pnl <= -margin) {
        closeReason = 'LIQUIDATION';
        pnl = -margin; // Cap loss to margin amount
      } 
      else {
        // 3. SL/TP TRIGGERS (Simple Breach Logic)
        if (side === 'LONG') {
          if (pos.stop_loss && currentPrice <= pos.stop_loss) closeReason = 'SL';
          else if (pos.tp1 && currentPrice >= pos.tp1) closeReason = 'TP';
          else if (pos.tp2 && currentPrice >= pos.tp2) closeReason = 'TP';
        } else { // SHORT
          if (pos.stop_loss && currentPrice >= pos.stop_loss) closeReason = 'SL';
          else if (pos.tp1 && currentPrice <= pos.tp1) closeReason = 'TP';
          else if (pos.tp2 && currentPrice <= pos.tp2) closeReason = 'TP';
        }
      }

      if (closeReason) {
        // Calculate PnL % based on NOTIONAL for display (standard)
        // or MARGIN? User said "roi cannot go below -100% on margin".
        // Let's store pnl_pct based on margin for internal consistency if LIQ.
        // But usually pnl_pct is on margin for futures.
        // Let's stick to user request: "pnl_pct_notional = pnl_usdt / notional_usdt * 100"
        // But for liquidation, let's make sure it reflects reality.
        
        let pnlPct = (pnl / pos.notional_usdt) * 100;
        
        // If Liquidated, explicit -100% on margin? 
        // User asked: "roi cannot go below -100% on margin"
        // Let's calculate ROI on margin to check
        const roiMargin = (pnl / margin) * 100;
        
        // Calculate Closing Commission (Standard)
        // For liquidation, usually exchange takes remaining margin? 
        // Simplicity: Deduct commission if funds remain, otherwise 0?
        // Let's apply standard comm unless it pushes us negative?
        // If pnl is -margin, user has 0 left. Commission would make it negative.
        // Rule: User balance cannot be negative.
        // If LIQUIDATION, commission is effectively absorbed in the total loss (max loss = margin).
        
        let commClose = Math.max(minComm, pos.notional_usdt * commRate);
        if (closeReason === 'LIQUIDATION') {
           commClose = 0; // No extra comm fee on top of total loss
        }

        // A. Update Position to CLOSED
        await base44.asServiceRole.entities.CopyPosition.update(pos.id, {
          status: closeReason === 'LIQUIDATION' ? 'LIQUIDATED' : 'CLOSED',
          close_price: currentPrice,
          close_reason: closeReason,
          closed_at: new Date().toISOString(),
          pnl_usdt: pnl,
          pnl_pct: pnlPct, // Storing notional % as requested
          commission_close_usdt: commClose
        });

        // B. Ledger: Realized PnL
        await base44.asServiceRole.entities.CopyTradingLedger.create({
          user_id: pos.user_id,
          kind: closeReason === 'LIQUIDATION' ? 'LIQUIDATION' : 'PNL',
          amount: pnl,
          currency: 'USDT',
          status: 'POSTED',
          ref_type: 'POSITION',
          ref_id: pos.id,
          description: `${closeReason} for ${pos.symbol}`,
          created_at: new Date().toISOString()
        });

        // C. Ledger: Commission (if any)
        if (commClose > 0) {
          await base44.asServiceRole.entities.CopyTradingLedger.create({
            user_id: pos.user_id,
            kind: 'COMMISSION_CLOSE',
            amount: -commClose,
            currency: 'USDT',
            status: 'POSTED',
            ref_type: 'POSITION',
            ref_id: pos.id,
            description: `Close commission for ${pos.symbol}`,
            created_at: new Date().toISOString()
          });
        }

        // D. Update Wallet: Unlock Margin + Add Net PnL
        // Net Change = +Margin (unlock) + PnL (neg/pos) - Commission
        // If Liquidated: +Margin - Margin - 0 = 0 change to available. Correct.
        
        const walletRes = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: pos.user_id });
        if (walletRes?.[0]) {
          const w = walletRes[0];
          const netChange = margin + pnl - commClose;
          
          await base44.asServiceRole.entities.CopyTradingWallet.update(w.id, {
            locked_balance: Math.max(0, w.locked_balance - margin),
            available_balance: Math.max(0, w.available_balance + netChange),
            lifetime_pnl: (w.lifetime_pnl || 0) + pnl - commClose,
            updated_at: new Date().toISOString()
          });
        }

        // E. Send Notification
        try {
          // Check preferences
          let shouldNotify = true;
          try {
            const prefs = await base44.asServiceRole.entities.UserPreferences.filter({ user_id: pos.user_id });
            if (prefs?.[0]) {
                if (prefs[0].notifications_enabled === false) shouldNotify = false;
                if (prefs[0].notify_trade_executions === false) shouldNotify = false;
            }
          } catch (e) {}

          if (shouldNotify) {
            const pnlStr = pnl >= 0 ? `+${pnl.toFixed(2)}` : `${pnl.toFixed(2)}`;
            let title = 'Position Closed';
            if (closeReason === 'TP') title = '✅ Take Profit Executed';
            else if (closeReason === 'SL') title = '🛑 Stop Loss Executed';
            else if (closeReason === 'LIQUIDATION') title = '☠️ Position Liquidated';
            
            await base44.asServiceRole.entities.Notification.create({
              user_id: pos.user_id,
              type: closeReason === 'TP' ? 'trade_closed' : 'liquidation_warning',
              title: title,
              message: `${pos.symbol} ${closeReason} @ ${currentPrice}. PnL: ${pnlStr} USDT`,
              data: { 
                instId: pos.symbol,
                positionId: pos.id,
                pnl,
                reason: closeReason,
                link: `/Futures?tab=bots`
              },
              read: false,
              priority: 'high'
            });
          }
        } catch (e) {
          console.error('[PROCESSOR] Notification error:', e.message);
        }

        updates.push({ id: pos.id, symbol: pos.symbol, pnl, reason: closeReason });
        processed++;
      }
    }

    const duration = Date.now() - startTs;
    return Response.json({ 
      ok: true, 
      processed, 
      updates,
      prices_fetched: Object.keys(priceMap).length,
      duration_ms: duration
    });

  } catch (error) {
    console.error('[PROCESSOR] Fatal error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});