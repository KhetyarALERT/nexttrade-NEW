// @ts-nocheck
/// <reference lib="deno.ns" />
// Copy Trading Processor - Closes positions based on market price
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper to fetch market price (stub - replaces with real fetch or passed prices)
async function getMarketPrice(symbol) {
  // In a real scenario, fetch from OKX API or internal price cache
  // For now, we assume this function is called with price context or fetches live
  try {
    const res = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${symbol}`);
    const json = await res.json();
    return Number(json.data?.[0]?.last);
  } catch (e) {
    console.error(`Failed to fetch price for ${symbol}:`, e);
    return null;
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    // Basic auth check (can be admin or cron secret)
    const user = await base44.auth.me();
    // Allow admin or maybe a service token check in future. For now admin only.
    if (user?.role !== 'admin') {
       // Check for cron header if automated? For now stick to admin trigger.
       return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // 1. Fetch Open Positions
    const positions = await base44.asServiceRole.entities.CopyPosition.filter({ status: 'OPEN' }, '-opened_at', 100);
    
    if (!positions?.length) {
      return Response.json({ ok: true, message: 'No open positions' });
    }

    // 2. Fetch Config for Commission
    const configs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
    const config = configs?.[0];
    const commRate = config?.commission_close_rate || 0.0005;
    const minComm = config?.min_commission_close || 0.05;

    let processed = 0;
    const updates = [];

    // 3. Check each position
    for (const pos of positions) {
      const currentPrice = await getMarketPrice(pos.symbol);
      if (!currentPrice) continue;

      let closeReason = null;
      const side = pos.side;
      
      // TP/SL Check
      if (side === 'LONG') {
        if (pos.stop_loss && currentPrice <= pos.stop_loss) closeReason = 'SL';
        else if (pos.tp1 && currentPrice >= pos.tp1) closeReason = 'TP';
        else if (pos.tp2 && currentPrice >= pos.tp2) closeReason = 'TP'; // Logic usually: partial close? For simplicity close all on TP1 or TP2.
      } else { // SHORT
        if (pos.stop_loss && currentPrice >= pos.stop_loss) closeReason = 'SL';
        else if (pos.tp1 && currentPrice <= pos.tp1) closeReason = 'TP';
      }

      if (closeReason) {
        // Calculate PnL
        // Long: (Exit - Entry) * Size / Entry (if coin margined?) No, USDT margined: (Exit - Entry) * Size?
        // Wait, notional_usdt = entry * size? 
        // Let's assume linear linear: (Exit - Entry) * Quantity
        // pos.notional_usdt is margin * leverage roughly. 
        // We need quantity. entities/CopyPosition doesn't store quantity explicitly? 
        // It has `notional_usdt` and `entry_price`. Qty = notional_usdt / entry_price?
        // Wait, usually notional = size * price. 
        // `CopyPosition` schema: entry_price, notional_usdt, leverage.
        // So Position Size (Coins) = notional_usdt / entry_price.
        
        const qty = pos.notional_usdt / pos.entry_price;
        const rawPnl = side === 'LONG' 
          ? (currentPrice - pos.entry_price) * qty
          : (pos.entry_price - currentPrice) * qty;
        
        const pnl = Number(rawPnl.toFixed(2));
        const pnlPct = (rawPnl / (pos.notional_usdt / pos.leverage)) * 100;

        // Calculate Commission
        const commClose = Math.max(minComm, pos.notional_usdt * commRate);

        // Update Position
        await base44.asServiceRole.entities.CopyPosition.update(pos.id, {
          status: 'CLOSED',
          close_price: currentPrice,
          close_reason: closeReason,
          closed_at: new Date().toISOString(),
          pnl_usdt: pnl,
          pnl_pct: pnlPct,
          commission_close_usdt: commClose
        });

        // Update Ledger: PnL
        await base44.asServiceRole.entities.CopyTradingLedger.create({
          user_id: pos.user_id,
          kind: 'PNL',
          amount: pnl,
          currency: 'USDT',
          status: 'POSTED',
          ref_type: 'POSITION',
          ref_id: pos.id,
          description: `PnL for ${pos.symbol} (${closeReason})`,
          created_at: new Date().toISOString()
        });

        // Update Ledger: Commission
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

        // Update Wallet (Unlock Margin + PnL - Comm)
        // Margin was locked. Now we release it + PnL - Comm.
        // Actually, usually "Locked" means removed from Available.
        // So we add (Margin + PnL - Comm) to Available.
        // And remove Margin from Locked.
        const margin = pos.notional_usdt / pos.leverage;
        
        const walletRes = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: pos.user_id });
        if (walletRes?.[0]) {
          const w = walletRes[0];
          await base44.asServiceRole.entities.CopyTradingWallet.update(w.id, {
            locked_balance: w.locked_balance - margin,
            available_balance: w.available_balance + margin + pnl - commClose,
            lifetime_pnl: (w.lifetime_pnl || 0) + pnl - commClose,
            updated_at: new Date().toISOString()
          });
        }

        updates.push({ id: pos.id, symbol: pos.symbol, pnl });
        processed++;
      }
    }

    return Response.json({ ok: true, processed, updates });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});