// @ts-nocheck
/// <reference lib="deno.ns" />
// Copy Trading User Functions - Phase 1: Immediate OKX Transfer Funding
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper: Get or create CopyTradingWallet for user (ensures wallet always exists)
async function getOrCreateWallet(base44, user) {
  try {
    const wallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: user.id });
    if (wallets?.length > 0) {
      return wallets[0];
    }
    
    // Create new wallet with zero balance
    const now = new Date().toISOString();
    const newWallet = await base44.asServiceRole.entities.CopyTradingWallet.create({
      user_id: user.id,
      user_email: user.email || "", 
      available_balance: 0,
      locked_balance: 0,
      lifetime_deposited: 0,
      lifetime_withdrawn: 0,
      lifetime_pnl: 0,
      status: 'ACTIVE',
      created_at: now,
      updated_at: now
    });
    
    console.log(`[COPY_TRADING] Created wallet for user ${user.email}`);
    return newWallet;
  } catch (error) {
    console.error(`[COPY_TRADING] getOrCreateWallet error: ${error.message}`);
    throw error;
  }
}

// Crypto helpers for OKX API calls
function base64Encode(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64Decode(text) {
  const bin = atob(text);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function getEnv(key) {
  return Deno.env.get(key);
}

async function importAesKey() {
  const raw = getEnv('APP_ENCRYPTION_KEY');
  if (!raw) throw new Error('Missing APP_ENCRYPTION_KEY');
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(raw));
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function decryptSecret(payload) {
  if (!payload) return '';
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const iv = base64Decode(parsed.iv);
  const tag = base64Decode(parsed.tag);
  const ciphertext = base64Decode(parsed.ciphertext);
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);
  const key = await importAesKey();
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, combined);
  return new TextDecoder().decode(decrypted);
}

async function generateOkxSignature(timestamp, method, requestPath, body, secretKey) {
  const prehash = timestamp + method.toUpperCase() + requestPath + body;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const msgData = encoder.encode(prehash);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return base64Encode(new Uint8Array(signature));
}

async function okxRequest({ credential, method, path, body }) {
  const timestamp = new Date().toISOString();
  const bodyStr = body ? JSON.stringify(body) : '';
  const signature = await generateOkxSignature(timestamp, method, path, bodyStr, credential.secretKey);

  const headers = {
    'OK-ACCESS-KEY': credential.apiKey,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': credential.passphrase,
    'Content-Type': 'application/json',
  };

  const baseUrl = getEnv('OKX_BASE_URL') || 'https://www.okx.com';
  const url = `${baseUrl}${path}`;

  try {
    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers,
      body: method.toUpperCase() === 'GET' ? undefined : (bodyStr || undefined),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || (data?.code && data.code !== '0')) {
      return { ok: false, error: { httpStatus: res.status, okxCode: data?.code, okxMsg: data?.msg } };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: { okxMsg: error?.message || 'Network error' } };
  }
}

// Helper: Get user's OKX account and credentials
async function getUserOkxCredential(base44, userId) {
  const accounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({
    user_id: userId,
    provider: 'OKX',
    status: 'ACTIVE'
  });

  if (!accounts?.length) {
    return { ok: false, error: { code: 'NO_ACCOUNT', message: 'No active OKX account' } };
  }

  const account = accounts[0];

  const credentials = await base44.asServiceRole.entities.ExchangeCredential.filter({
    user_exchange_account_id: account.id,
    provider: 'OKX',
    status: 'ACTIVE'
  });

  if (!credentials?.length) {
    return { ok: false, error: { code: 'NO_CREDENTIALS', message: 'No active credentials' } };
  }

  const cred = credentials[0];

  return {
    ok: true,
    data: {
      account,
      credential: {
        apiKey: cred.api_key,
        secretKey: await decryptSecret(cred.secret_enc),
        passphrase: await decryptSecret(cred.passphrase_enc)
      }
    }
  };
}

// Helper: Get user's OKX trading balance via direct API call
async function getOkxTradingBalance(base44, userId) {
  try {
    const credResult = await getUserOkxCredential(base44, userId);
    
    if (!credResult.ok) {
      return { ok: false, balance: 0, error: credResult.error?.message || 'No OKX account' };
    }

    const { credential } = credResult.data;

    // Fetch trading balance directly from OKX
    const tradingRes = await okxRequest({
      credential,
      method: 'GET',
      path: '/api/v5/account/balance'
    });

    if (!tradingRes.ok) {
      return { ok: false, balance: 0, error: tradingRes.error?.okxMsg || 'Failed to fetch balance' };
    }

    const details = tradingRes.data?.data?.[0]?.details || [];
    const usdtDetail = details.find(d => d.ccy === 'USDT');
    const availableBalance = parseFloat(usdtDetail?.availBal || '0');

    return { ok: true, balance: availableBalance, source: 'live' };
  } catch (err) {
    console.error('[COPY_TRADING] Failed to get OKX balance:', err.message);
    return { ok: false, balance: 0, error: err.message };
  }
}

async function processSignalAcceptance({ base44, targetUserId, signalId, amount, leverage, source }) {
  const amtNum = Number(amount);
  const levNum = Number(leverage) || 5;

  if (!targetUserId) return Response.json({ ok: false, error: { code: 'NO_USER', message: 'User not identified' } });
  if (!signalId || !amtNum || amtNum <= 0) {
    return Response.json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid input' } });
  }

  // 1. Check idempotency (both SignalAction AND CopyPosition)
  const existingAction = await base44.asServiceRole.entities.SignalAction.filter({ user_id: targetUserId, signal_id: signalId });
  if (existingAction.length > 0) {
    console.log(`[COPY_ACCEPT] IDEMPOTENCY: user=${targetUserId} signal=${signalId} already has SignalAction`);
    const walletRes = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: targetUserId });
    const wallet = walletRes?.[0];
    return Response.json({ 
      ok: true, 
      success: true,
      wallet: wallet ? { available: wallet.available_balance, locked: wallet.locked_balance } : null,
      message: 'Already processed'
    });
  }
  const existingPosition = await base44.asServiceRole.entities.CopyPosition.filter({ user_id: targetUserId, signal_id: signalId });
  if (existingPosition.length > 0) {
    console.log(`[COPY_ACCEPT] IDEMPOTENCY: user=${targetUserId} signal=${signalId} already has CopyPosition`);
    const walletRes = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: targetUserId });
    const wallet = walletRes?.[0];
    return Response.json({ 
      ok: true, 
      success: true,
      wallet: wallet ? { available: wallet.available_balance, locked: wallet.locked_balance } : null,
      message: 'Already processed'
    });
  }

  // 2. Get wallet (need target user object)
  let targetUserObj;
  try {
    targetUserObj = await base44.asServiceRole.entities.User.get(targetUserId);
  } catch(e) {}
  
  if (!targetUserObj) return Response.json({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
  
  const wallet = await getOrCreateWallet(base44, targetUserObj);

  // 3. Get Signal
  let signal;
  try { signal = await base44.asServiceRole.entities.Signal.get(signalId); } catch (e) {}
  if (!signal || signal.status !== 'ACTIVE') {
    return Response.json({ ok: false, error: { code: 'SIGNAL_INVALID', message: 'Signal not active' } });
  }

  const configs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
  const config = configs?.[0];
  const commRate = config?.commission_open_rate || 0.0005;
  const minComm = config?.min_commission_open || 0.05;

  // 3b. Max Leverage Cap
  let userMaxLev = 50; 
  try {
    const ents = await base44.asServiceRole.entities.UserEntitlement.filter({ user_id: targetUserId });
    if (ents?.length) {
      userMaxLev = ents[0].leverage_max || 50;
      if (userMaxLev < 20) userMaxLev = 20; 
    }
  } catch (e) {}

  const signalMaxLev = signal.max_leverage || 20;
  const allowedMaxLev = Math.min(signalMaxLev, userMaxLev, 100);

  if (levNum > allowedMaxLev) {
    return Response.json({ ok: false, error: { code: 'LEVERAGE_EXCEEDED', message: `Leverage ${levNum}x exceeds limit. Max: ${allowedMaxLev}x` } });
  }

  // 4. Calc Funds
  const margin = amtNum;
  const notional = margin * levNum;
  const commOpen = Math.max(minComm, notional * commRate);
  const required = margin + commOpen;

  // 5. Validate Balance
  if (wallet.available_balance < required) {
    const missing = required - wallet.available_balance;
    return Response.json({ ok: false, error: { code: 'INSUFFICIENT_BALANCE', message: `Insufficient balance`, required, available: wallet.available_balance } });
  }

  const now = new Date().toISOString();

  // 6. Live Price
  let entryPrice = signal.entry_price || 0;
  try {
    const pRes = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${signal.symbol}`, { headers: { "User-Agent": "Mozilla/5.0" } });
    const pJson = await pRes.json();
    if (pJson.data?.[0]?.last) entryPrice = Number(pJson.data[0].last);
  } catch (e) {}
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) entryPrice = signal.entry_price || 0;

  // Calculate explicit quantity in base currency
  const qtyBase = notional / entryPrice;

  // 7. Create Position
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

  // 8. Signal Action
  await base44.asServiceRole.entities.SignalAction.create({
    signal_id: signalId,
    user_id: targetUserId,
    action: source === 'AUTO' ? 'AUTO_ACCEPTED' : 'ACCEPTED',
    accepted_at: now,
    user_amount_usdt: margin,
    user_leverage: levNum,
    commission_open_usdt: commOpen,
    created_at: now
  });

  // 8.1 Increment accepted_count on Signal (fire and forget for performance)
  try {
    const sig = await base44.asServiceRole.entities.Signal.get(signalId);
    if (sig) {
      await base44.asServiceRole.entities.Signal.update(signalId, {
        accepted_count: (sig.accepted_count || 0) + 1
      });
    }
  } catch (err) {
    console.error('Failed to update signal accepted_count:', err);
  }

  // 9. Ledger
  const balBefore = wallet.available_balance;
  
  // Debit commission
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
    description: `Open commission for ${signal.symbol}`,
    created_at: now
  });

  // Lock margin
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
    description: `Locked margin for ${signal.symbol} position`,
    created_at: now
  });

  // 10. Update Wallet
  const newAvailable = wallet.available_balance - required;
  const newLocked = wallet.locked_balance + margin;
  await base44.asServiceRole.entities.CopyTradingWallet.update(wallet.id, {
    available_balance: Math.max(0, newAvailable),
    locked_balance: newLocked,
    updated_at: now
  });

  // 11. Notification
  try {
    let userLang = 'en';
    try {
      const prefs = await base44.asServiceRole.entities.UserPreferences.filter({ user_id: targetUserId });
      if (prefs?.[0]?.language) userLang = prefs[0].language;
    } catch (e) {}

    const isAr = userLang === 'ar';
    const title = isAr 
      ? (source === 'AUTO' ? 'تم قبول الإشارة تلقائياً' : 'تم قبول الإشارة')
      : (source === 'AUTO' ? 'Signal Auto-Accepted' : 'Signal Accepted');
    
    let message;
    if (isAr) {
      const sideAr = signal.side === 'LONG' ? 'شراء' : 'بيع';
      message = `تم فتح صفقة ${sideAr} على ${signal.symbol} بسعر ${entryPrice.toFixed(2)}. الهامش: ${margin} USDT`;
    } else {
      message = `Opened ${signal.side} position on ${signal.symbol} @ ${entryPrice.toFixed(2)}. Margin: ${margin} USDT`;
    }

    await base44.asServiceRole.entities.Notification.create({
      user_id: targetUserId,
      type: 'trade_executed',
      title: title,
      message: message,
      data: { instId: signal.symbol, signalId, positionId: position.id, link: `/Futures?tab=bots&instId=${signal.symbol}&positionId=${position.id}` },
      read: false,
      priority: 'normal'
    });
  } catch (e) {}

  return Response.json({ ok: true, success: true, wallet: { available: newAvailable, locked: newLocked } });
}

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

    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const { action } = body || {};

    // ==================== GET CONFIG ====================
    if (action === 'getConfig') {
      const configs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
      const config = configs?.[0] || {
        enabled: false,
        min_deposit_usdt: 50,
        require_kyc: true,
        deposit_source: 'OKX_TRADING',
        signals_enabled: false
      };

      // Also fetch user entitlement for max leverage
      let userEntitlement = null;
      try {
        const ents = await base44.asServiceRole.entities.UserEntitlement.filter({ user_id: user.id });
        if (ents?.length) userEntitlement = ents[0];
      } catch (e) {}

      // Effective User Max Leverage (Global default vs User override)
      // Default global max leverage is 20 if not set in config (schema default needed or assumed)
      // For Copy Trading (Paper), we can be more generous if no entitlement exists
      // FIX: Handle legacy entitlements with 5x default by bumping them to 20x min for paper mode
      const globalMaxLev = 50; 
      let userMaxLev = userEntitlement?.leverage_max || globalMaxLev;
      if (userMaxLev < 20) userMaxLev = 20; // Minimum floor for paper trading

      return Response.json({ 
        ok: true, 
        data: {
          ...config,
          // Expose effective max leverage for UI logic
          user_max_leverage: userMaxLev
        }
      });
    }

    // ==================== GET WALLET (auto-create if missing) ====================
    if (action === 'getWallet') {
      const wallet = await getOrCreateWallet(base44, user);
      return Response.json({ ok: true, data: wallet });
    }

    // ==================== GET ALLOCATIONS ====================
    if (action === 'getAllocations') {
      const allocations = await base44.asServiceRole.entities.CopyTradingAllocation.filter(
        { user_id: user.id },
        '-created_at',
        50
      );
      return Response.json({ ok: true, data: allocations || [] });
    }

    // ==================== GET LEDGER ====================
    if (action === 'getLedger') {
      const { limit = 20 } = body;
      const entries = await base44.asServiceRole.entities.CopyTradingLedger.filter(
        { user_id: user.id, status: 'POSTED' },
        '-created_at',
        Math.min(100, Number(limit) || 20)
      );
      return Response.json({ ok: true, data: entries || [] });
    }

    // ==================== DEPOSIT FUNDS (Same as Staking: Trading→Funding, then auto-approve transfers to Main) ====================
    // Flow: Trading→Funding (user cred) → Create PENDING allocation → Auto-approve processor → Funding→Main (master) + credit wallet
    if (action === 'createAllocation' || action === 'depositFunds') {
      const { amount } = body;
      const amountNum = Number(amount);

      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        return Response.json({ ok: false, error: { code: 'INVALID_AMOUNT', message: 'Invalid amount' } });
      }

      // Get config
      const configs = await base44.asServiceRole.entities.CopyTradingConfig.filter({ config_key: 'default' });
      const config = configs?.[0];

      if (!config?.enabled) {
        return Response.json({ ok: false, error: { code: 'DISABLED', message: 'Copy trading is not enabled' } });
      }

      const minDeposit = config.min_deposit_usdt || 50;
      if (amountNum < minDeposit) {
        return Response.json({ ok: false, error: { code: 'MIN_AMOUNT', message: `Minimum deposit is ${minDeposit} USDT` } });
      }

      // Check KYC if required
      if (config.require_kyc) {
        const verifications = await base44.asServiceRole.entities.VerificationRequest.filter(
          { user_id: user.id, status: 'approved' },
          '-created_date',
          1
        );
        if (!verifications?.length) {
          return Response.json({ ok: false, error: { code: 'KYC_REQUIRED', message: 'KYC verification required' } });
        }
      }

      // Get OKX trading balance to validate
      const balanceCheck = await getOkxTradingBalance(base44, user.id);
      if (!balanceCheck.ok) {
        return Response.json({ ok: false, error: { code: 'NO_OKX_ACCOUNT', message: 'Please set up your trading account first' } });
      }

      if (balanceCheck.balance < amountNum) {
        return Response.json({ ok: false, error: { code: 'INSUFFICIENT_BALANCE', message: `Insufficient balance. Available: ${balanceCheck.balance.toFixed(2)} USDT` } });
      }

      // Idempotency check - prevent duplicate deposits within 30 seconds
      const recentAllocations = await base44.asServiceRole.entities.CopyTradingAllocation.filter(
        { user_id: user.id, status: 'PENDING' },
        '-created_at',
        1
      );
      if (recentAllocations?.length > 0) {
        const lastAlloc = new Date(recentAllocations[0].created_at || recentAllocations[0].created_date);
        if (Date.now() - lastAlloc.getTime() < 30000) {
          return Response.json({ ok: false, error: { code: 'DUPLICATE_REQUEST', message: 'Please wait before submitting another deposit' } });
        }
      }

      const now = new Date().toISOString();
      const idempotencyKey = `deposit:${user.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

      console.log(JSON.stringify({ 
        event: 'COPY_TRADING_DEPOSIT_START', 
        userId: user.id, 
        userEmail: user.email, 
        amount: amountNum,
        idempotencyKey
      }));
      
      const credResult = await getUserOkxCredential(base44, user.id);
      if (!credResult.ok) {
        return Response.json({ ok: false, error: { code: 'NO_OKX_ACCOUNT', message: 'Trading account not available' } });
      }

      const { account, credential } = credResult.data;

      // STEP 1: Create transfer record BEFORE OKX call (like staking does)
      let lockTransferId = null;
      try {
        const lockTransfer = await base44.asServiceRole.entities.ExchangeTransfer.create({
          user_id: user.id,
          provider: 'OKX',
          from_account: account.external_account_id || 'self',
          from_account_type: 'trading',
          to_account: account.external_account_id || 'self',
          to_account_type: 'funding',
          currency: 'USDT',
          amount: amountNum,
          status: 'PENDING',
          created_at: now
        });
        lockTransferId = lockTransfer?.id;
        console.log('[COPY_TRADING] Created lock transfer record:', lockTransferId);
      } catch (e) {
        console.log('[COPY_TRADING] Failed to create lock transfer record:', e.message);
      }

      // STEP 2: Execute OKX transfer: Trading(18) → Funding(6) using USER's credentials
      const transferRes = await okxRequest({
        credential,
        method: 'POST',
        path: '/api/v5/asset/transfer',
        body: {
          ccy: 'USDT',
          amt: String(amountNum),
          from: '18', // Trading
          to: '6',    // Funding
          type: '0'   // Within same account
        }
      });

      const transferResult = transferRes.data?.data?.[0];
      const completedAt = new Date().toISOString();

      if (!transferRes.ok || (transferResult?.code && transferResult.code !== '0')) {
        const errMsg = transferRes.error?.okxMsg || transferResult?.msg || 'Lock transfer failed';
        console.error('[COPY_TRADING] Trading->Funding failed:', errMsg);
        
        // Update transfer to FAILED
        if (lockTransferId) {
          try {
            await base44.asServiceRole.entities.ExchangeTransfer.update(lockTransferId, {
              status: 'FAILED',
              error_message: errMsg,
              completed_at: completedAt
            });
          } catch (e) {
            console.log('[COPY_TRADING] Failed to update transfer to FAILED:', e.message);
          }
        }
        
        return Response.json({ ok: false, error: { code: 'LOCK_FAILED', message: errMsg } });
      }

      // Update transfer to COMPLETED
      if (lockTransferId) {
        try {
          await base44.asServiceRole.entities.ExchangeTransfer.update(lockTransferId, {
            status: 'COMPLETED',
            external_transfer_id: transferResult?.transId || null,
            completed_at: completedAt
          });
          console.log('[COPY_TRADING] Updated lock transfer to COMPLETED:', lockTransferId);
        } catch (e) {
          console.log('[COPY_TRADING] Failed to update transfer to COMPLETED:', e.message);
        }
      }

      // STEP 3: Create PENDING_SETTLEMENT allocation (settlement processor will handle Funding→Main + wallet credit)
      const allocation = await base44.asServiceRole.entities.CopyTradingAllocation.create({
        user_id: user.id,
        user_email: user.email,
        amount: amountNum,
        status: 'PENDING_SETTLEMENT', // Awaiting step2 (Funding subaccount → Funding main)
        deposit_source: 'OKX_FUNDING',
        step1_transfer_id: lockTransferId, // Trading→Funding completed
        idempotency_key: idempotencyKey,
        retry_count: 0,
        created_at: completedAt,
        updated_at: completedAt
      });

      console.log('[COPY_TRADING] Created PENDING allocation:', allocation.id);

      // Notify admins
      try {
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        for (const admin of (admins || []).slice(0, 5)) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: admin.id,
            type: 'system',
            title: 'New Copy Trading Deposit',
            message: `${user.email} deposited ${amountNum} USDT for Copy Trading`,
            data: { allocationId: allocation.id, action: 'copy_trading_deposit' },
            read: false,
            priority: 'high'
          });
        }
      } catch (e) {
        console.log('[COPY_TRADING] Failed to notify admins:', e.message);
      }

      // Create notification for user
      try {
        // Get user language
        let userLang = 'en';
        try {
          const prefs = await base44.asServiceRole.entities.UserPreferences.filter({ user_id: user.id });
          if (prefs?.[0]?.language) userLang = prefs[0].language;
        } catch (e) {}

        const title = userLang === 'ar' ? 'إيداع نسخ التداول قيد المعالجة' : 'Copy Trading Deposit Pending';
        const message = userLang === 'ar' 
          ? `جاري معالجة إيداعك بقيمة ${amountNum} USDT. سيتم إضافته إلى رصيد نسخ التداول قريباً.`
          : `Your deposit of ${amountNum} USDT is being processed. It will be credited to your Copy Trading balance shortly.`;

        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id,
          type: 'system',
          title: title,
          message: message,
          data: { amount: amountNum, allocationId: allocation.id },
          read: false,
          priority: 'normal'
        });
      } catch (notifErr) {
        console.error('[COPY_TRADING] Failed to create notification:', notifErr.message);
      }

      console.log(JSON.stringify({ 
        event: 'COPY_TRADING_DEPOSIT_PENDING', 
        userId: user.id, 
        amount: amountNum, 
        allocationId: allocation.id,
        lockTransferId,
        okxTransferId: transferResult?.transId
      }));

      return Response.json({ 
        ok: true, 
        data: { 
          success: true,
          amount: amountNum,
          status: 'PENDING',
          allocationId: allocation.id,
          lockTransferId,
          message: 'Funds locked. Processing deposit to Copy Trading balance.'
        } 
      });
    }

    // ==================== CLEANUP OLD PENDING ====================
    if (action === 'cleanupPending') {
      // Admin-only cleanup of stuck PENDING allocations from OKX_TRADING
      const adminUser = await base44.auth.me();
      if (adminUser?.role !== 'admin') {
        return Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
      }

      const oldPending = await base44.asServiceRole.entities.CopyTradingAllocation.filter({
        status: 'PENDING',
        deposit_source: 'OKX_TRADING'
      });

      let cleaned = 0;
      for (const alloc of oldPending || []) {
        await base44.asServiceRole.entities.CopyTradingAllocation.update(alloc.id, {
          status: 'CANCELED',
          note: 'Auto-canceled: OKX_TRADING deposits are now instant',
          updated_at: new Date().toISOString()
        });
        cleaned++;
      }

      return Response.json({ ok: true, data: { cleaned, message: `Cleaned ${cleaned} old PENDING allocations` } });
    }

    // ==================== CANCEL ALLOCATION (Phase 2 - Signal allocations only) ====================
    if (action === 'cancelAllocation') {
      // This is for canceling signal allocations in Phase 2
      // Deposits are immediate and cannot be cancelled
      return Response.json({ ok: false, error: { code: 'NOT_SUPPORTED', message: 'Deposits cannot be cancelled. Use withdrawal instead.' } });
    }

    // ==================== GET SIGNALS ====================
    if (action === 'getSignals') {
      // List signals delivered to user
      // 1. Get deliveries
      const deliveries = await base44.asServiceRole.entities.SignalDelivery.filter({ user_id: user.id }, '-delivered_at', 50);
      if (!deliveries.length) return Response.json({ ok: true, data: [] });

      // 2. Get active signals
      const signalIds = deliveries.map(d => d.signal_id);
      // Fetch signals manually or wait for 'in' operator support. For now fetch active signals and filter.
      const activeSignals = await base44.asServiceRole.entities.Signal.filter({ status: 'ACTIVE' }, '-published_at', 50);
      
      // 3. Filter by delivery and not acted upon
      // Check existing actions
      const actions = await base44.asServiceRole.entities.SignalAction.filter({ user_id: user.id });
      const actedSignalIds = new Set(actions.map(a => a.signal_id));

      const mySignals = activeSignals.filter(s => 
        signalIds.includes(s.id) && !actedSignalIds.has(s.id)
      );

      return Response.json({ ok: true, data: mySignals });
    }

    // ==================== INTERNAL ACCEPT LOGIC (EXPOSED FOR AUTO) ====================
    if (action === 'acceptSignalInternal') {
      let targetUserId = user?.id;
      if (!targetUserId && body.targetUserId) {
        if (user?.role === 'admin') {
          targetUserId = body.targetUserId;
        }
      }

      const { signalId, amount, leverage, source = 'MANUAL' } = body;
      return await processSignalAcceptance({ base44, targetUserId, signalId, amount, leverage, source });
    }

    // ==================== ACCEPT SIGNAL (MANUAL) ====================
    if (action === 'acceptSignal') {
      const { signalId, amount, leverage } = body;
      // Manual accept always targets self
      return await processSignalAcceptance({ base44, targetUserId: user.id, signalId, amount, leverage, source: 'MANUAL' });
    }

    // ==================== REJECT SIGNAL ====================
    if (action === 'rejectSignal') {
      const { signalId } = body;
      if (!signalId) return Response.json({ ok: false, error: { code: 'INVALID', message: 'Missing ID' } });

      const now = new Date().toISOString();
      await base44.asServiceRole.entities.SignalAction.create({
        signal_id: signalId,
        user_id: user.id,
        action: 'REJECTED',
        rejected_at: now,
        created_at: now
      });

      // Update Delivery status to SEEN (optional, but good for cleanup)
      // We don't have delivery ID directly, query by user+signal
      // Skipping for speed, Action table is enough to filter.

      return Response.json({ ok: true, success: true });
    }

    // ==================== GET POSITIONS ====================
    if (action === 'getPositions') {
      const { status } = body;
      const query = { user_id: user.id };
      if (status) query.status = status;
      
      const positions = await base44.asServiceRole.entities.CopyPosition.filter(query, '-opened_at', 50);
      return Response.json({ ok: true, data: positions || [] });
    }

    // ==================== SETTINGS (AUTO ACCEPT) ====================
    if (action === 'getSettings') {
      const settings = await base44.asServiceRole.entities.CopyTradingSettings.filter({ user_id: user.id });
      return Response.json({ ok: true, data: settings?.[0] || null });
    }

    if (action === 'saveSettings') {
      const { settings } = body;
      if (!settings) return Response.json({ ok: false, error: { code: 'MISSING_DATA', message: 'Missing settings' } });

      // CRITICAL: Always use asServiceRole for settings operations to ensure proper access
      const existing = await base44.asServiceRole.entities.CopyTradingSettings.filter({ user_id: user.id });
      const now = new Date().toISOString();
      const payload = {
        user_id: user.id,
        auto_enabled: Boolean(settings.auto_enabled),
        mode: settings.mode || 'FIXED_MARGIN',
        fixed_margin_usdt: Number(settings.fixed_margin_usdt) || 5,
        fixed_margin_percent: settings.fixed_margin_percent ? Number(settings.fixed_margin_percent) : null,
        risk_percent_equity: Number(settings.risk_percent_equity) || 1,
        leverage_mode: settings.leverage_mode || 'FOLLOW_SIGNAL_CAP',
        fixed_leverage: Number(settings.fixed_leverage) || 5,
        max_leverage: Number(settings.max_leverage) || 20,
        max_margin_per_trade_usdt: Number(settings.max_margin_per_trade_usdt) || 50,
        max_open_positions_total: Number(settings.max_open_positions_total) || 5,
        max_open_positions_per_symbol: Number(settings.max_open_positions_per_symbol) || 2,
        signal_expiry_seconds: Number(settings.signal_expiry_seconds) || 180,
        max_entry_deviation_percent: Number(settings.max_entry_deviation_percent) || 0.3,
        require_sl: settings.require_sl !== false,
        updated_at: now
      };

      let res;
      if (existing?.length) {
        // Verify user owns this settings record before updating
        if (existing[0].user_id !== user.id) {
          return Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Cannot update settings of another user' } }, { status: 403 });
        }
        res = await base44.asServiceRole.entities.CopyTradingSettings.update(existing[0].id, payload);
      } else {
        payload.created_at = now;
        res = await base44.asServiceRole.entities.CopyTradingSettings.create(payload);
      }
      return Response.json({ ok: true, data: res });
    }

    return Response.json({ ok: false, error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` } });

  } catch (error) {
    console.error('[COPY_TRADING_USER_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});