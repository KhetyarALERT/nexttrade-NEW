// @ts-nocheck
/// <reference lib="deno.ns" />
// Copy Trading Processor - Closes positions based on market price
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper to fetch all tickers efficiently (Batch Request)
async function getTickerMap(instType) {
  try {
    const res = await fetch(`https://www.okx.com/api/v5/market/tickers?instType=${instType}`, {
      headers: { "User-Agent": "Base44/CopyTrading" }
    });
    const json = await res.json();
    if (json.code !== '0') {
      console.error(`OKX API Error for ${instType}:`, json.msg);
      return {};
    }
    
    const map = {};
    for (const item of json.data || []) {
      map[item.instId] = Number(item.last);
    }
    return map;
  } catch (e) {
    console.error(`Failed to fetch tickers for ${instType}:`, e);
    return {};
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    // Allow admin execution (scheduled tasks typically run as admin or have a way to auth)
    if (user?.role !== 'admin') {
       return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // 1. Fetch Open Positions
    // Increased limit to 1000 to ensure we cover all active positions in one run
    const positions = await base44.asServiceRole.entities.CopyPosition.filter({ status: 'OPEN' }, '-opened_at', 1000);
    
    if (!positions?.length) {
      return Response.json({ ok: true, message: 'No open positions' });
    }

    // 2. Fetch Config for Commission
    const configs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
    const config = configs?.[0];
    const commRate = config?.commission_close_rate || 0.0005;
    const minComm = config?.min_commission_close || 0.05;

    // 3. Batch Fetch Prices (Zero API Spam)
    // NOTE: We only fetch PUBLIC market data here. 
    // This processor is for INTERNAL copy trading only and does NOT execute trades on real OKX accounts.
    // Check which instrument types are needed
    let needSwap = false;
    let needSpot = false;
    
    for (const p of positions) {
      if (p.symbol.endsWith('-SWAP')) needSwap = true;
      else needSpot = true; // Fallback assumption for non-swap symbols
    }

    const priceMap = {};
    
    // Fetch SWAP tickers (1 call for all swaps)
    if (needSwap) {
      const swaps = await getTickerMap('SWAP');
      Object.assign(priceMap, swaps);
    }
    
    // Fetch SPOT tickers (1 call for all spots) if needed
    if (needSpot) {
      const spots = await getTickerMap('SPOT');
      Object.assign(priceMap, spots);
    }

    let processed = 0;
    const updates = [];

    // 4. Check Logic & Execute Closes
    for (const pos of positions) {
      const currentPrice = priceMap[pos.symbol];
      
      // Skip if price unavailable (e.g. delisted or API error)
      if (!currentPrice) continue;

      let closeReason = null;
      const side = pos.side;
      
      // Trigger Logic: Price Hits Target Level
      if (side === 'LONG') {
        // Long SL: Price drops BELOW or EQUAL to SL
        if (pos.stop_loss && currentPrice <= pos.stop_loss) closeReason = 'SL';
        // Long TP: Price rises ABOVE or EQUAL to TP
        else if (pos.tp1 && currentPrice >= pos.tp1) closeReason = 'TP';
        else if (pos.tp2 && currentPrice >= pos.tp2) closeReason = 'TP';
      } else { // SHORT
        // Short SL: Price rises ABOVE or EQUAL to SL
        if (pos.stop_loss && currentPrice >= pos.stop_loss) closeReason = 'SL';
        // Short TP: Price drops BELOW or EQUAL to TP
        else if (pos.tp1 && currentPrice <= pos.tp1) closeReason = 'TP';
        else if (pos.tp2 && currentPrice <= pos.tp2) closeReason = 'TP';
      }

      if (closeReason) {
        // Calculate PnL
        const qty = pos.notional_usdt / pos.entry_price;
        const rawPnl = side === 'LONG' 
          ? (currentPrice - pos.entry_price) * qty
          : (pos.entry_price - currentPrice) * qty;
        
        const pnl = Number(rawPnl.toFixed(2));
        const pnlPct = (rawPnl / (pos.notional_usdt / pos.leverage)) * 100;

        // Calculate Closing Commission
        const commClose = Math.max(minComm, pos.notional_usdt * commRate);

        // A. Update Position to CLOSED
        await base44.asServiceRole.entities.CopyPosition.update(pos.id, {
          status: 'CLOSED',
          close_price: currentPrice,
          close_reason: closeReason,
          closed_at: new Date().toISOString(),
          pnl_usdt: pnl,
          pnl_pct: pnlPct,
          commission_close_usdt: commClose
        });

        // B. Ledger: Realized PnL
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

        // C. Ledger: Commission
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

        // D. Update Wallet: Unlock Margin + Add Net PnL
        const margin = pos.notional_usdt / pos.leverage;
        const walletRes = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: pos.user_id });
        if (walletRes?.[0]) {
          const w = walletRes[0];
          await base44.asServiceRole.entities.CopyTradingWallet.update(w.id, {
            locked_balance: Math.max(0, w.locked_balance - margin),
            available_balance: Math.max(0, w.available_balance + margin + pnl - commClose),
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
            const isProfit = pnl >= 0;
            const title = closeReason === 'TP' 
              ? '✅ Take Profit Executed' 
              : (isProfit ? '🛑 Position Closed' : '🛑 Stop Loss Executed');
            
            await base44.asServiceRole.entities.Notification.create({
              user_id: pos.user_id,
              type: closeReason === 'TP' ? 'trade_closed' : 'margin_warning',
              title: title,
              message: `${pos.symbol} closed at ${currentPrice}. PnL: ${pnlStr} USDT`,
              data: { 
                instId: pos.symbol,
                positionId: pos.id,
                pnl,
                reason: closeReason,
                link: `/Futures?tab=bots` // Correct link to Copy Trading tab
              },
              read: false,
              priority: 'high'
            });
          }
        } catch (e) {
          console.error('[COPY_TRADING_PROCESSOR] Notification error:', e.message);
        }

        updates.push({ id: pos.id, symbol: pos.symbol, pnl, reason: closeReason });
        processed++;
      }
    }

    return Response.json({ 
      ok: true, 
      processed, 
      updates,
      prices_fetched: Object.keys(priceMap).length 
    });

  } catch (error) {
    console.error('[COPY_TRADING_PROCESSOR] Fatal error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});