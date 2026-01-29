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
        max_leverage: Number(signal.max_leverage) || 20,
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
      const uniqueUserIds = [...new Set(targets.map(t => t.user_id))].filter(Boolean);

      // Optimization: Fetch all user preferences in one go to avoid N+1 queries during notification loop
      let prefsMap = new Map();
      try {
        // Fetch up to 2000 preferences (reasonable batch size)
        // Note: In production with >2000 users, this should be paginated or fetched in batches
        const allPrefs = await base44.asServiceRole.entities.UserPreferences.list('', 2000);
        if (allPrefs && Array.isArray(allPrefs)) {
          allPrefs.forEach(p => {
            if (p.user_id) prefsMap.set(p.user_id, p);
          });
        }
      } catch (e) {
        console.error('Failed to pre-fetch user preferences:', e);
      }

      let deliveredCount = 0;
      const deliveryDetails = [];

      for (const userId of uniqueUserIds) {
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
            
            // Check UserPreferences for notifications using in-memory map
            let shouldNotify = true;
            let userLang = 'en';
            
            const pref = prefsMap.get(userId);
            if (pref) {
              if (pref.notifications_enabled === false) shouldNotify = false;
              if (pref.notify_signals === false) shouldNotify = false;
              if (pref.language) userLang = pref.language;
            }

            if (shouldNotify) {
              let title, message;
              if (userLang === 'ar') {
                const sideAr = newSignal.side === 'LONG' ? 'شراء' : 'بيع';
                const entryStr = newSignal.entry_price || 'سعر السوق';
                title = `إشارة جديدة: ${newSignal.symbol} ${sideAr}`;
                message = `دخول: ${entryStr} | هدف: ${newSignal.tp1} | وقف: ${newSignal.stop_loss}`;
              } else {
                title = `New Signal: ${newSignal.symbol} ${newSignal.side}`;
                message = `Entry: ${newSignal.entry_price || 'Market'} | TP: ${newSignal.tp1} | SL: ${newSignal.stop_loss}`;
              }

              await base44.asServiceRole.entities.Notification.create({
                user_id: userId,
                type: 'system', // or specific 'signal' type if added to enum
                title: title,
                message: message,
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

      // Populate accepted_count dynamically for signals where it might be missing or stale (especially existing ones)
      // This ensures the dashboard always shows accurate counts without requiring a database migration
      const signalsWithCounts = await Promise.all(signals.map(async (signal) => {
        // If count exists, use it? Or verify? 
        // User reported seeing 0, so we must assume it's unreliable for now.
        // Let's count SignalActions for this signal.
        try {
          // Count 'ACCEPTED' and 'AUTO_ACCEPTED'
          // SDK filter returns array, we take length. Optimized would be .count() if available, but filter is robust.
          const actions = await base44.asServiceRole.entities.SignalAction.filter({ signal_id: signal.id });
          const count = actions.filter(a => a.action === 'ACCEPTED' || a.action === 'AUTO_ACCEPTED').length;
          
          // Optionally self-heal the entity in background if mismatch
          if (signal.accepted_count !== count) {
            // Don't await this to keep response fast
            base44.asServiceRole.entities.Signal.update(signal.id, { accepted_count: count }).catch(() => {});
          }

          return { ...signal, accepted_count: count };
        } catch (e) {
          console.error(`Failed to count actions for signal ${signal.id}:`, e);
          return signal;
        }
      }));
      
      return Response.json({ ok: true, data: signalsWithCounts || [] });
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