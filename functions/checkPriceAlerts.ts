// @ts-nocheck
// This file runs in Deno runtime (serverless function) - TypeScript checking is handled by Deno
import { createClientFromRequest } from 'https://esm.sh/@base44/sdk@0.8.6?target=deno&dts';

// This function checks price alerts and fires notifications
// Should be called by a scheduled task every 5 minutes

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    // This function runs as admin to check all user alerts
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all user preferences with active price alerts
    const allPrefs = await base44.asServiceRole.entities.UserPreferences.filter({});
    
    if (!allPrefs?.length) {
      return Response.json({ success: true, message: 'No preferences found', checked: 0 });
    }

    // Fetch current prices from BingX
    let prices: Record<string, number> = {};
    try {
      const response = await fetch('https://open-api.bingx.com/openApi/swap/v2/quote/ticker');
      const data: {
        code?: number;
        data?: Array<{ symbol: string; lastPrice: string }>;
      } = await response.json();

      if (data.code === 0 && data.data) {
        data.data.forEach((ticker) => {
          prices[ticker.symbol] = Number.parseFloat(ticker.lastPrice);
        });
      }
    } catch (e) {
      console.error('Failed to fetch prices:', e);
      // Use fallback prices
      prices = {
        'BTC-USDT': 96850,
        'ETH-USDT': 3420,
        'SOL-USDT': 198,
        'BNB-USDT': 705
      };
    }

    let alertsTriggered = 0;
    let alertsChecked = 0;

    for (const prefs of allPrefs) {
      if (!prefs.notifications_enabled || !prefs.notify_price_alerts) continue;
      if (!prefs.price_alerts?.length) continue;

      const updatedAlerts = [];
      
      for (const alert of prefs.price_alerts) {
        alertsChecked++;
        
        if (!alert.active) {
          updatedAlerts.push(alert);
          continue;
        }

        const currentPrice = prices[alert.symbol];
        if (!currentPrice) {
          updatedAlerts.push(alert);
          continue;
        }

        let triggered = false;
        if (alert.condition === 'above' && currentPrice >= alert.targetPrice) {
          triggered = true;
        } else if (alert.condition === 'below' && currentPrice <= alert.targetPrice) {
          triggered = true;
        }

        if (triggered) {
          alertsTriggered++;
          
          // Create notification
          await base44.asServiceRole.entities.Notification.create({
            user_id: prefs.user_id,
            type: 'price_alert',
            title: `Price Alert: ${alert.symbol}`,
            message: `${alert.symbol} is now ${alert.condition === 'above' ? 'above' : 'below'} $${alert.targetPrice.toLocaleString()}. Current price: $${currentPrice.toLocaleString()}`,
            data: {
              symbol: alert.symbol,
              targetPrice: alert.targetPrice,
              currentPrice: currentPrice,
              condition: alert.condition
            },
            priority: 'high'
          });

          // Deactivate the alert after triggering
          updatedAlerts.push({ ...alert, active: false, triggeredAt: new Date().toISOString() });
        } else {
          updatedAlerts.push(alert);
        }
      }

      // Update user preferences with modified alerts
      if (alertsTriggered > 0) {
        await base44.asServiceRole.entities.UserPreferences.update(prefs.id, {
          price_alerts: updatedAlerts
        });
      }
    }

    console.log(`[PRICE_ALERTS] Checked ${alertsChecked} alerts, triggered ${alertsTriggered}`);

    return Response.json({ 
      success: true, 
      checked: alertsChecked,
      triggered: alertsTriggered
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[PRICE_ALERTS_ERROR]', message);
    return Response.json({ error: message }, { status: 500 });
  }
});