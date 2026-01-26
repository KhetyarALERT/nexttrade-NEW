// @ts-nocheck
/// <reference lib="deno.ns" />
// Signals Admin Functions - Signal ingestion and management
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }
    });
  }

  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Please log in' } }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const { action } = body || {};

    // ==================== CREATE SIGNAL (MANUAL) ====================
    if (action === 'createSignal') {
      const { signal } = body;
      if (!signal || !signal.symbol || !signal.side) {
        return Response.json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Missing required signal fields' } });
      }

      const now = new Date().toISOString();
      const expiresAt = signal.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // 1. Create Signal
      const newSignal = await base44.asServiceRole.entities.Signal.create({
        source: 'manual',
        status: 'ACTIVE',
        symbol: signal.symbol.toUpperCase(),
        side: signal.side.toUpperCase(),
        entry_type: signal.entry_type || 'MARKET',
        entry_price: Number(signal.entry_price) || 0,
        entry_range_low: Number(signal.entry_range_low) || 0,
        entry_range_high: Number(signal.entry_range_high) || 0,
        stop_loss: Number(signal.stop_loss) || 0,
        tp1: Number(signal.tp1) || 0,
        tp2: Number(signal.tp2) || 0,
        timeframe: signal.timeframe || '15m',
        notes: signal.notes || '',
        published_at: now,
        expires_at: expiresAt
      });

      // 2. Deliver to Eligible Users
      // Simplified targeting for Phase 2: Deliver to ALL users with a CopyTradingWallet (ACTIVE or not) 
      // + The creator (if they have a user account) to ensure testing works.
      
      // Fetch ALL wallets (up to 1000 for now)
      const wallets = await base44.asServiceRole.entities.CopyTradingWallet.list('', 1000);
      
      // Also ensure current user is in the list if they aren't already
      let targets = [...(wallets || [])];
      
      // Check if current user has a wallet
      const userWallet = targets.find(w => w.user_id === user.id);
      if (!userWallet) {
        // If admin doesn't have a wallet, auto-create one for testing purposes? 
        // No, better to just deliver even without wallet, so they see it in Inbox (and then are prompted to create wallet/deposit).
        // Actually, Inbox requires Copy Mode which usually requires wallet? 
        // Let's just add the user ID to the delivery list regardless.
        targets.push({ user_id: user.id });
      }

      // Deduplicate
      const uniqueUserIds = [...new Set(targets.map(t => t.user_id))];

      let deliveredCount = 0;
      const deliveryDetails = [];

      for (const userId of uniqueUserIds) {
        if (!userId) continue;
        try {
          // Check if already delivered (idempotency)
          const existing = await base44.asServiceRole.entities.SignalDelivery.filter({ signal_id: newSignal.id, user_id: userId });
          if (existing.length === 0) {
            await base44.asServiceRole.entities.SignalDelivery.create({
              signal_id: newSignal.id,
              user_id: userId,
              delivered_at: now,
              status: 'DELIVERED'
            });
            
            // Check UserPreferences for notifications
            let shouldNotify = true;
            try {
              const prefs = await base44.asServiceRole.entities.UserPreferences.filter({ user_id: userId });
              if (prefs?.[0] && prefs[0].notifications_enabled === false) shouldNotify = false;
              if (prefs?.[0] && prefs[0].notify_signals === false) shouldNotify = false;
            } catch (e) {}

            if (shouldNotify) {
              await base44.asServiceRole.entities.Notification.create({
                user_id: userId,
                type: 'system', // or specific 'signal' type if added to enum
                title: `New Signal: ${newSignal.symbol} ${newSignal.side}`,
                message: `Entry: ${newSignal.entry_price || 'Market'} | TP: ${newSignal.tp1} | SL: ${newSignal.stop_loss}`,
                data: { signalId: newSignal.id, action: 'new_signal' },
                read: false,
                priority: 'normal',
                created_at: now
              });
            }

            deliveredCount++;
            deliveryDetails.push(userId);
          }
        } catch (e) {
          console.error(`Failed delivery to ${userId}:`, e);
        }
      }

      return Response.json({ ok: true, data: { signal: newSignal, deliveredCount, recipients: deliveryDetails } });
    }

    // ==================== LIST SIGNALS ====================
    if (action === 'listSignals') {
      const { limit = 50, status } = body;
      let query = {};
      if (status) query.status = status;
      
      const signals = await base44.asServiceRole.entities.Signal.filter(
        query,
        '-published_at',
        Math.min(100, Number(limit) || 50)
      );
      
      return Response.json({ ok: true, data: signals || [] });
    }

    // ==================== UPDATE STATUS ====================
    if (action === 'updateSignalStatus') {
      const { signalId, status } = body;
      if (!signalId || !['ACTIVE', 'EXPIRED', 'CANCELED'].includes(status)) {
        return Response.json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid status or ID' } });
      }

      await base44.asServiceRole.entities.Signal.update(signalId, {
        status: status
      });

      return Response.json({ ok: true, success: true });
    }

    // ==================== GET STATS ====================
    if (action === 'getSignalStats') {
        const signals = await base44.asServiceRole.entities.Signal.list('-published_at', 500);
        const total = signals.length;
        const active = signals.filter(s => s.status === 'ACTIVE').length;
        const expired = signals.filter(s => s.status === 'EXPIRED').length;
        const actions = await base44.asServiceRole.entities.SignalAction.list('-created_at', 500);
        const accepted = actions.filter(a => a.action === 'ACCEPTED').length;
        
        return Response.json({ ok: true, data: { total, active, expired, accepted } });
    }

    return Response.json({ ok: false, error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` } });

  } catch (error) {
    console.error('[SIGNALS_ADMIN_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});