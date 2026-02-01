// @ts-nocheck
/// <reference lib="deno.ns" />
// Copy Trading Admin Functions - Server-side only (admin role required)
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

    // Admin check
    if (user.role !== 'admin') {
      return Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const { action } = body || {};

    // ==================== GET CONFIG ====================
    if (action === 'getConfig') {
      const configs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
      const config = configs?.[0] || {
        id: null,
        config_key: 'default',
        enabled: false,
        min_deposit_usdt: 50,
        require_kyc: true,
        deposit_source: 'OKX_FUNDING',
        auto_approve_enabled: true,
        auto_approve_max_amount: 1000,
        auto_approve_min_age_minutes: 5,
        signals_enabled: false,
        pool_wallet_name: 'Main Copy Trading Pool'
      };
      return Response.json({ ok: true, data: config });
    }

    // ==================== SAVE CONFIG ====================
    if (action === 'saveConfig') {
      const { configData } = body;
      if (!configData) {
        return Response.json({ ok: false, error: { code: 'MISSING_DATA', message: 'Missing config data' } });
      }

      const now = new Date().toISOString();
      const payload = {
        enabled: Boolean(configData.enabled),
        min_deposit_usdt: Number(configData.min_deposit_usdt) || 50,
        require_kyc: configData.require_kyc !== false,
        deposit_source: configData.deposit_source || 'OKX_FUNDING',
        auto_approve_enabled: configData.auto_approve_enabled !== false,
        auto_approve_max_amount: Number(configData.auto_approve_max_amount) || 1000,
        auto_approve_min_age_minutes: Number(configData.auto_approve_min_age_minutes) || 5,
        signals_enabled: Boolean(configData.signals_enabled),
        pool_wallet_name: configData.pool_wallet_name || 'Main Copy Trading Pool',
        updated_at: now,
        updated_by: user.email
      };

      // Check if config exists
      const configs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
      const existingConfig = configs?.[0];

      let result;
      if (existingConfig?.id) {
        result = await base44.asServiceRole.entities.CopyTradingConfig.update(existingConfig.id, payload);
      } else {
        result = await base44.asServiceRole.entities.CopyTradingConfig.create({
          config_key: 'default',
          ...payload
        });
      }

      return Response.json({ ok: true, data: result });
    }

    // ==================== LIST WALLETS ====================
    if (action === 'listWallets') {
      const { limit = 50 } = body;
      const wallets = await base44.asServiceRole.entities.CopyTradingWallet.list('-updated_at', Math.min(200, Number(limit) || 50));
      return Response.json({ ok: true, data: wallets || [] });
    }

    // ==================== LIST ALLOCATIONS ====================
    if (action === 'listAllocations') {
      const { status, limit = 100 } = body;
      let allocations;
      if (status) {
        allocations = await base44.asServiceRole.entities.CopyTradingAllocation.filter(
          { status },
          '-created_at',
          Math.min(500, Number(limit) || 100)
        );
      } else {
        allocations = await base44.asServiceRole.entities.CopyTradingAllocation.list('-created_at', Math.min(500, Number(limit) || 100));
      }
      return Response.json({ ok: true, data: allocations || [] });
    }

    // ==================== LIST LEDGER ====================
    if (action === 'listLedger') {
      const { user_id, limit = 100 } = body;
      let entries;
      if (user_id) {
        entries = await base44.asServiceRole.entities.CopyTradingLedger.filter(
          { user_id },
          '-created_at',
          Math.min(500, Number(limit) || 100)
        );
      } else {
        // List all ledger entries (POSTED and VOID) for admin visibility
        entries = await base44.asServiceRole.entities.CopyTradingLedger.list(
          '-created_at',
          Math.min(500, Number(limit) || 100)
        );
      }
      return Response.json({ ok: true, data: entries || [] });
    }

    // ==================== GET STATS ====================
    if (action === 'getStats') {
      // Fetch all data with same limits used by list actions to ensure consistency
      const [wallets, ledgerEntries] = await Promise.all([
        base44.asServiceRole.entities.CopyTradingWallet.list('-updated_at', 200),
        base44.asServiceRole.entities.CopyTradingLedger.list('-created_at', 500),
      ]);

      const walls = wallets || [];
      const ledger = ledgerEntries || [];

      // Compute totals from wallet records
      // Total Balance should represent Total Equity (Available + Locked)
      const totalBalance = walls.reduce((sum, w) => sum + (w.available_balance || 0) + (w.locked_balance || 0), 0);
      const totalAllocated = walls.reduce((sum, w) => sum + (w.locked_balance || 0), 0);
      const totalLifetimeDeposited = walls.reduce((sum, w) => sum + (w.lifetime_deposited || 0), 0);
      
      // Count ledger entries by status
      const postedCredits = ledger.filter(e => e.status === 'POSTED' && e.kind === 'CREDIT').length;
      const voidCredits = ledger.filter(e => e.status === 'VOID' && e.kind === 'CREDIT').length;

      return Response.json({
        ok: true,
        data: {
          totalWallets: walls.length,
          totalBalance,
          totalAllocated,
          totalLifetimeDeposited,
          postedDeposits: postedCredits,
          failedDeposits: voidCredits,
          // Legacy field for backward compatibility
          pendingAllocations: 0
        }
      });
    }

    // ==================== RUN PROCESSOR NOW ====================
    if (action === 'runProcessorNow') {
      // Call the processor function
      const res = await base44.asServiceRole.functions.invoke('copyTradingAutoApprove', {});
      return Response.json(res);
    }

    // ==================== ADMIN WITHDRAWAL ====================
    if (action === 'withdrawFundsAdmin') {
      const { userEmail, amount, note } = body;
      
      if (!userEmail) return Response.json({ ok: false, error: { code: 'INVALID_INPUT', message: 'User email required' } });
      const withdrawalAmount = Number(amount);
      if (!Number.isFinite(withdrawalAmount) || withdrawalAmount <= 0) {
        return Response.json({ ok: false, error: { code: 'INVALID_AMOUNT', message: 'Invalid amount' } });
      }

      const users = await base44.asServiceRole.entities.User.filter({ email: userEmail.trim().toLowerCase() });
      if (!users?.length) return Response.json({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      const targetUser = users[0];

      const wallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: targetUser.id });
      const wallet = wallets?.[0];
      
      if (!wallet) return Response.json({ ok: false, error: { code: 'NO_WALLET', message: 'Wallet not found' } });
      if (wallet.available_balance < withdrawalAmount) {
        return Response.json({ ok: false, error: { code: 'INSUFFICIENT_FUNDS', message: `Insufficient balance: ${wallet.available_balance}` } });
      }

      const now = new Date().toISOString();
      const idempotencyKey = `admin_withdraw:${targetUser.id}:${Date.now()}`;

      // Create Ledger
      const ledgerEntry = await base44.asServiceRole.entities.CopyTradingLedger.create({
        user_id: targetUser.id,
        kind: 'WITHDRAWAL_ADMIN',
        amount: -withdrawalAmount,
        currency: 'USDT',
        status: 'POSTED',
        ref_type: 'ADMIN_ADJUST',
        idempotency_key: idempotencyKey,
        balance_before: wallet.available_balance,
        balance_after: wallet.available_balance - withdrawalAmount,
        description: `Admin withdrawal: ${note || 'Manual deduction'}`,
        meta: { admin_email: user.email, note },
        created_at: now
      });

      // Update Wallet
      await base44.asServiceRole.entities.CopyTradingWallet.update(wallet.id, {
        available_balance: wallet.available_balance - withdrawalAmount,
        lifetime_withdrawn: (wallet.lifetime_withdrawn || 0) + withdrawalAmount,
        updated_at: now
      });

      return Response.json({ ok: true, data: { success: true, newBalance: wallet.available_balance - withdrawalAmount } });
    }

    // ==================== MANUAL TOP-UP ====================
    if (action === 'manualTopUp') {
      const { userEmail, amount, note } = body;
      
      // Validate inputs
      if (!userEmail || typeof userEmail !== 'string') {
        console.error('[MANUAL_TOPUP] Missing or invalid userEmail');
        return Response.json({ ok: false, error: { code: 'INVALID_INPUT', message: 'User email is required' } });
      }
      
      const topUpAmount = Number(amount);
      if (!Number.isFinite(topUpAmount) || topUpAmount <= 0) {
        console.error('[MANUAL_TOPUP] Invalid amount:', amount);
        return Response.json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Amount must be a positive number' } });
      }

      const normalizedEmail = userEmail.trim().toLowerCase();
      console.log('[MANUAL_TOPUP] Starting top-up for:', { email: normalizedEmail, amount: topUpAmount, adminEmail: user.email });

      // Find user by email
      const users = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
      if (!users || users.length === 0) {
        console.error('[MANUAL_TOPUP] User not found:', normalizedEmail);
        return Response.json({ ok: false, error: { code: 'USER_NOT_FOUND', message: `User with email ${normalizedEmail} not found` } });
      }
      const targetUser = users[0];
      console.log('[MANUAL_TOPUP] Found user:', { userId: targetUser.id, email: targetUser.email });

      // Get or create wallet
      let wallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: targetUser.id });
      let wallet = wallets?.[0];
      
      const now = new Date().toISOString();
      
      if (!wallet) {
        console.log('[MANUAL_TOPUP] Creating new wallet for user:', targetUser.id);
        wallet = await base44.asServiceRole.entities.CopyTradingWallet.create({
          user_id: targetUser.id,
          user_email: targetUser.email,
          available_balance: 0,
          locked_balance: 0,
          lifetime_deposited: 0,
          lifetime_withdrawn: 0,
          lifetime_pnl: 0,
          status: 'ACTIVE',
          created_at: now,
          updated_at: now
        });
        console.log('[MANUAL_TOPUP] Created wallet:', wallet.id);
      }

      const balanceBefore = wallet.available_balance || 0;
      const balanceAfter = balanceBefore + topUpAmount;
      const idempotencyKey = `admin_topup:${targetUser.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

      console.log('[MANUAL_TOPUP] Creating ledger entry:', { balanceBefore, balanceAfter, idempotencyKey });

      // Create ledger entry
      const ledgerEntry = await base44.asServiceRole.entities.CopyTradingLedger.create({
        user_id: targetUser.id,
        kind: 'CREDIT',
        amount: topUpAmount,
        currency: 'USDT',
        status: 'POSTED',
        ref_type: 'ADMIN_ADJUST',
        ref_id: null,
        idempotency_key: idempotencyKey,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: `Admin manual top-up by ${user.email}${note ? ': ' + note : ''}`,
        meta: {
          admin_email: user.email,
          admin_note: note || null,
          timestamp: now
        },
        created_at: now
      });
      console.log('[MANUAL_TOPUP] Created ledger entry:', ledgerEntry.id);

      // Update wallet balance
      await base44.asServiceRole.entities.CopyTradingWallet.update(wallet.id, {
        available_balance: balanceAfter,
        lifetime_deposited: (wallet.lifetime_deposited || 0) + topUpAmount,
        last_activity_at: now,
        updated_at: now
      });
      console.log('[MANUAL_TOPUP] Updated wallet balance:', { walletId: wallet.id, newBalance: balanceAfter });

      return Response.json({
        ok: true,
        data: {
          walletId: wallet.id,
          ledgerEntryId: ledgerEntry.id,
          userEmail: targetUser.email,
          amount: topUpAmount,
          balanceBefore,
          balanceAfter,
          adminEmail: user.email
        }
      });
    }

    // ==================== SIGNAL MANAGEMENT (PHASE 2) ====================
    
    if (action === 'listSignals') {
      const { limit = 50, status } = body;
      const query = status ? { status } : {};
      const signals = await base44.asServiceRole.entities.Signal.filter(query, '-published_at', Number(limit));
      return Response.json({ ok: true, data: signals || [] });
    }

    if (action === 'createSignal') {
      const { signal } = body;
      if (!signal || !signal.symbol || !signal.side) {
        return Response.json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Missing required fields' } });
      }

      const now = new Date().toISOString();
      // Default expiration: 24h if not set
      const expiresAt = signal.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const newSignal = await base44.asServiceRole.entities.Signal.create({
        source: 'manual',
        source_message_id: `manual_${Date.now()}`,
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
        max_leverage: Math.min(100, Math.max(1, Number(signal.max_leverage) || 20)),
        timeframe: signal.timeframe || '1h',
        notes: signal.notes || '',
        raw_text: signal.raw_text || 'Manual signal created by admin',
        published_at: now,
        expires_at: expiresAt
      });

      // Deliver signal to eligible users
      try {
        const configs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
        const config = configs?.[0];
        
        // Manual signals are always delivered if signals enabled globally
        if (config?.signals_enabled) {
          const wallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ status: 'ACTIVE' });
          const deliveries = [];
          
          for (const wallet of wallets || []) {
            deliveries.push({
              signal_id: newSignal.id,
              user_id: wallet.user_id,
              delivered_at: now,
              status: 'DELIVERED'
            });
          }

          if (deliveries.length > 0) {
            await base44.asServiceRole.entities.SignalDelivery.bulkCreate(deliveries);
            
            // Send notifications
            for (const delivery of deliveries) {
              try {
                // Simplified preference check - assume yes for MVP manual signals
                await base44.asServiceRole.entities.Notification.create({
                  user_id: delivery.user_id,
                  type: 'trade_executed',
                  title: '🚀 New Trading Signal',
                  message: `${newSignal.symbol} ${newSignal.side} @ ${newSignal.entry_price}`,
                  data: { 
                    instId: newSignal.symbol,
                    signalId: newSignal.id,
                    link: `/Trading?tab=bots&signalId=${newSignal.id}`
                  },
                  read: false,
                  priority: 'high'
                });
              } catch (e) {}
            }
          }
        }
      } catch (err) {
        console.error('Failed to deliver manual signal:', err);
      }
      
      return Response.json({ ok: true, data: newSignal });
    }

    // ==================== SIGNAL DETAILS & FORCE CLOSE ====================
    if (action === 'getSignalDetails') {
      const { signalId } = body;
      if (!signalId) return Response.json({ ok: false, error: 'Missing signalId' });

      // 1. Get Signal
      let signal;
      try { signal = await base44.asServiceRole.entities.Signal.get(signalId); } catch(e) {}
      if (!signal) return Response.json({ ok: false, error: 'Signal not found' });

      // 2. Get Positions (current status)
      const positions = await base44.asServiceRole.entities.CopyPosition.filter({ signal_id: signalId }, '-opened_at', 500);
      
      // 3. Get User Details
      const userIds = [...new Set(positions.map(p => p.user_id))];
      const userMap = {};
      
      // Batch fetch users (simulated via parallel promises if $in not supported, or just list all users if small scale)
      // Since we don't have $in guaranteed, we'll fetch individually in parallel (capped)
      await Promise.all(userIds.map(async (uid) => {
        try {
          const u = await base44.asServiceRole.entities.User.get(uid);
          if (u) userMap[uid] = u;
        } catch (e) {}
      }));

      // 4. Combine
      const rows = positions.map(p => {
        const u = userMap[p.user_id] || {};
        return {
          positionId: p.id,
          userId: p.user_id,
          email: u.email || 'Unknown',
          name: u.full_name || u.display_name || 'User',
          status: p.status,
          leverage: p.leverage,
          margin: p.notional_usdt / p.leverage,
          entryPrice: p.entry_price,
          pnl: p.pnl_usdt,
          openedAt: p.opened_at
        };
      });

      return Response.json({ ok: true, data: { signal, rows } });
    }

    if (action === 'forceCloseSignalPositions') {
      const { signalId, userId } = body;
      if (!signalId) return Response.json({ ok: false, error: 'Missing signalId' });

      // 1. Find Open Positions
      const query = { signal_id: signalId, status: 'OPEN' };
      if (userId) query.user_id = userId;
      
      const positions = await base44.asServiceRole.entities.CopyPosition.filter(query);
      if (!positions.length) return Response.json({ ok: true, message: 'No open positions to close', processed: 0 });

      // 2. Get Live Price (Once)
      const symbol = positions[0].symbol;
      let closePrice = 0;
      try {
        const res = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${symbol}`);
        const json = await res.json();
        closePrice = Number(json.data?.[0]?.last);
      } catch (e) {}
      
      if (!closePrice || closePrice <= 0) {
        // Fallback to entry price if live fetch fails (emergency close)
        closePrice = positions[0].entry_price; 
      }

      // 3. Close Loop
      let processed = 0;
      const now = new Date().toISOString();
      const configs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
      const config = configs?.[0];
      const commRate = config?.commission_close_rate || 0.0005;
      const minComm = config?.min_commission_close || 0.05;

      for (const pos of positions) {
        try {
          const qty = pos.notional_usdt / pos.entry_price;
          const rawPnl = pos.side === 'LONG' 
            ? (closePrice - pos.entry_price) * qty
            : (pos.entry_price - closePrice) * qty;
          
          const pnl = Number(rawPnl.toFixed(2));
          const pnlPct = (rawPnl / (pos.notional_usdt / pos.leverage)) * 100;
          const commClose = Math.max(minComm, pos.notional_usdt * commRate);

          // Update Position
          await base44.asServiceRole.entities.CopyPosition.update(pos.id, {
            status: 'CLOSED',
            close_price: closePrice,
            close_reason: 'MANUAL', // Admin force close
            closed_at: now,
            pnl_usdt: pnl,
            pnl_pct: pnlPct,
            commission_close_usdt: commClose
          });

          // Ledger PnL
          await base44.asServiceRole.entities.CopyTradingLedger.create({
            user_id: pos.user_id,
            kind: 'PNL',
            amount: pnl,
            currency: 'USDT',
            status: 'POSTED',
            ref_type: 'POSITION',
            ref_id: pos.id,
            description: `PnL for ${pos.symbol} (Admin Force Close)`,
            created_at: now
          });

          // Ledger Comm
          await base44.asServiceRole.entities.CopyTradingLedger.create({
            user_id: pos.user_id,
            kind: 'COMMISSION_CLOSE',
            amount: -commClose,
            currency: 'USDT',
            status: 'POSTED',
            ref_type: 'POSITION',
            ref_id: pos.id,
            description: `Close commission for ${pos.symbol}`,
            created_at: now
          });

          // Update Wallet
          const margin = pos.notional_usdt / pos.leverage;
          const walletRes = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: pos.user_id });
          if (walletRes?.[0]) {
            const w = walletRes[0];
            await base44.asServiceRole.entities.CopyTradingWallet.update(w.id, {
              locked_balance: w.locked_balance - margin,
              available_balance: w.available_balance + margin + pnl - commClose,
              lifetime_pnl: (w.lifetime_pnl || 0) + pnl - commClose,
              updated_at: now
            });
          }

          // Notify
          await base44.asServiceRole.entities.Notification.create({
            user_id: pos.user_id,
            type: 'trade_closed',
            title: '⚠️ Position Force Closed',
            message: `Admin closed ${pos.symbol} @ ${closePrice}. PnL: ${pnl.toFixed(2)} USDT`,
            data: { 
              instId: pos.symbol,
              positionId: pos.id,
              pnl,
              link: `/Trading?tab=bots&instId=${pos.symbol}`
            },
            read: false,
            priority: 'high'
          });

          processed++;
        } catch (e) {
          console.error(`Failed to force close position ${pos.id}:`, e);
        }
      }

      return Response.json({ ok: true, processed });
    }

    if (action === 'expireSignal') {
      const { signalId } = body;
      if (!signalId) return Response.json({ ok: false, error: { code: 'MISSING_ID', message: 'Signal ID required' } });

      await base44.asServiceRole.entities.Signal.update(signalId, {
        status: 'EXPIRED',
        expires_at: new Date().toISOString() // Expire immediately
      });

      return Response.json({ ok: true, data: { signalId, status: 'EXPIRED' } });
    }

    // ==================== GET COPY TRADING STATS FOR DASHBOARD ====================
    if (action === 'getCopyTradingStats') {
      const [wallets, allocations] = await Promise.all([
        base44.asServiceRole.entities.CopyTradingWallet.list('-updated_at', 200),
        base44.asServiceRole.entities.CopyTradingAllocation.list('-created_at', 500)
      ]);

      const walls = wallets || [];
      const allocs = allocations || [];

      const totalBalance = walls.reduce((sum, w) => sum + (w.available_balance || 0) + (w.locked_balance || 0), 0);
      const activeWallets = walls.filter(w => w.status === 'ACTIVE').length;
      const suspendedWallets = walls.filter(w => w.status === 'SUSPENDED').length;
      const pendingAllocations = allocs.filter(a => a.status === 'PENDING' || a.status === 'PENDING_SETTLEMENT').length;
      const failedAllocations = allocs.filter(a => a.status === 'FAILED').length;

      return Response.json({
        ok: true,
        data: {
          available: activeWallets,
          assigned: walls.length,
          error: failedAllocations,
          totalBalance,
          pendingAllocations,
          suspendedWallets
        }
      });
    }

    return Response.json({ ok: false, error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` } });

  } catch (error) {
    console.error('[COPY_TRADING_ADMIN_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});