import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const NOWPAYMENTS_API_KEY = Deno.env.get("NOWPAYMENTS_API_KEY");
const NOWPAYMENTS_BASE_URL = "https://api.nowpayments.io/v1";

// Get JWT token for authenticated operations
const getAuthToken = async () => {
  const email = Deno.env.get("NOWPAYMENTS_EMAIL");
  const password = Deno.env.get("NOWPAYMENTS_PASSWORD");
  
  if (!email || !password) {
    throw new Error('NOWPayments credentials not configured');
  }
  
  const response = await fetch(`${NOWPAYMENTS_BASE_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  if (!response.ok || !data.token) {
    throw new Error(data.message || 'Failed to authenticate with NOWPayments');
  }
  
  return data.token;
};

// NOWPayments API helper with auth
const nowPaymentsRequest = async (endpoint, method = 'GET', body = null, token = null) => {
  if (!NOWPAYMENTS_API_KEY) {
    throw new Error('NOWPayments API key not configured');
  }
  
  const headers = {
    'x-api-key': NOWPAYMENTS_API_KEY,
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  
  console.log(`[CUSTODY] ${method} ${endpoint}`);
  const response = await fetch(`${NOWPAYMENTS_BASE_URL}${endpoint}`, options);
  const data = await response.json();
  
  if (!response.ok) {
    console.error('[CUSTODY_ERROR]', data);
    throw new Error(data.message || data.error || `NOWPayments API error: ${response.status}`);
  }
  
  return data;
};

const audit = (action, userId, data) => {
  console.log(`[CUSTODY_AUDIT] [${new Date().toISOString()}] ${action} | User: ${userId}`, JSON.stringify(data));
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const { action, ...params } = body;
    
    console.log('[CUSTODY]', { action, userId: user.id });

    // CREATE USER ACCOUNT (sub-partner balance)
    if (action === 'createAccount') {
      // Check if user already has a custody account
      const existing = await base44.entities.CustodyAccount.filter({ user_id: user.id });
      if (existing?.length) {
        return Response.json({ success: true, data: existing[0], existing: true });
      }
      
      // Generate unique name (max 30 chars, no email)
      const uniqueName = `user_${user.id.substring(0, 20)}`;
      
      const token = await getAuthToken();
      const result = await nowPaymentsRequest('/sub-partner/balance', 'POST', {
        name: uniqueName
      }, token);
      
      if (!result.result?.id) {
        throw new Error('Failed to create custody account');
      }
      
      // Store in database
      const custodyAccount = await base44.asServiceRole.entities.CustodyAccount.create({
        user_id: user.id,
        nowpayments_id: result.result.id,
        name: uniqueName,
        status: 'active',
        balances: {},
        last_sync: new Date().toISOString()
      });
      
      audit('CUSTODY_ACCOUNT_CREATED', user.id, { 
        custodyAccountId: custodyAccount.id, 
        nowpaymentsId: result.result.id 
      });
      
      return Response.json({ success: true, data: custodyAccount });
    }

    // GET USER BALANCE
    if (action === 'getBalance') {
      const accounts = await base44.entities.CustodyAccount.filter({ user_id: user.id });
      if (!accounts?.length) {
        return Response.json({ success: false, error: 'No custody account found' }, { status: 404 });
      }
      
      const account = accounts[0];
      const token = await getAuthToken();
      
      const result = await nowPaymentsRequest(`/sub-partner/balance/${account.nowpayments_id}`, 'GET', null, token);
      
      // Update local record
      await base44.asServiceRole.entities.CustodyAccount.update(account.id, {
        balances: result.balances || {},
        last_sync: new Date().toISOString()
      });
      
      return Response.json({ 
        success: true, 
        data: {
          id: account.id,
          nowpayments_id: account.nowpayments_id,
          balances: result.balances || {},
          last_sync: new Date().toISOString()
        }
      });
    }

    // CREATE DEPOSIT (payment into user balance)
    if (action === 'createDeposit') {
      const { amount, currency = 'usdttrc20' } = params;
      
      if (!amount || amount <= 0) {
        return Response.json({ success: false, error: 'Invalid amount' }, { status: 400 });
      }
      
      const accounts = await base44.entities.CustodyAccount.filter({ user_id: user.id });
      if (!accounts?.length) {
        return Response.json({ success: false, error: 'No custody account found. Create one first.' }, { status: 404 });
      }
      
      const account = accounts[0];
      const token = await getAuthToken();
      const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://app.base44.com';
      
      const result = await nowPaymentsRequest('/sub-partner/payment', 'POST', {
        sub_partner_id: account.nowpayments_id,
        price_amount: parseFloat(amount),
        price_currency: 'usd',
        pay_currency: currency,
        order_id: `custody_deposit_${account.id}_${Date.now()}`,
        order_description: `Deposit to NextTrade custody account`,
        ipn_callback_url: `${appUrl}/api/functions/walletWebhook`,
        success_url: `${appUrl}/Profile?tab=assets&deposit=success`,
        cancel_url: `${appUrl}/Profile?tab=assets&deposit=cancelled`
      }, token);
      
      audit('CUSTODY_DEPOSIT_CREATED', user.id, { 
        accountId: account.id, 
        amount, 
        currency,
        paymentId: result.payment_id 
      });
      
      return Response.json({ 
        success: true, 
        data: {
          payment_id: result.payment_id,
          payment_status: result.payment_status,
          pay_address: result.pay_address,
          pay_amount: result.pay_amount,
          pay_currency: result.pay_currency,
          invoice_url: result.invoice_url,
          expiration_estimate_date: result.expiration_estimate_date
        }
      });
    }

    // DEPOSIT FROM MASTER ACCOUNT (admin only - transfer from main to user)
    if (action === 'depositFromMaster') {
      if (user.role !== 'admin') {
        return Response.json({ success: false, error: 'Admin access required' }, { status: 403 });
      }
      
      const { userId, amount, currency = 'usdttrc20' } = params;
      
      if (!userId || !amount) {
        return Response.json({ success: false, error: 'Missing userId or amount' }, { status: 400 });
      }
      
      const accounts = await base44.asServiceRole.entities.CustodyAccount.filter({ user_id: userId });
      if (!accounts?.length) {
        return Response.json({ success: false, error: 'User custody account not found' }, { status: 404 });
      }
      
      const account = accounts[0];
      const token = await getAuthToken();
      
      const result = await nowPaymentsRequest('/sub-partner/deposit', 'POST', {
        sub_partner_id: account.nowpayments_id,
        amount: parseFloat(amount),
        currency
      }, token);
      
      audit('CUSTODY_DEPOSIT_FROM_MASTER', user.id, { 
        targetUserId: userId,
        accountId: account.id, 
        amount, 
        currency,
        transferId: result.id 
      });
      
      return Response.json({ success: true, data: result });
    }

    // WRITE-OFF (admin only - transfer from user to master)
    if (action === 'writeOff') {
      if (user.role !== 'admin') {
        return Response.json({ success: false, error: 'Admin access required' }, { status: 403 });
      }
      
      const { userId, amount, currency = 'usdttrc20' } = params;
      
      if (!userId || !amount) {
        return Response.json({ success: false, error: 'Missing userId or amount' }, { status: 400 });
      }
      
      const accounts = await base44.asServiceRole.entities.CustodyAccount.filter({ user_id: userId });
      if (!accounts?.length) {
        return Response.json({ success: false, error: 'User custody account not found' }, { status: 404 });
      }
      
      const account = accounts[0];
      const token = await getAuthToken();
      
      const result = await nowPaymentsRequest('/sub-partner/write-off', 'POST', {
        sub_partner_id: account.nowpayments_id,
        amount: parseFloat(amount),
        currency
      }, token);
      
      audit('CUSTODY_WRITE_OFF', user.id, { 
        targetUserId: userId,
        accountId: account.id, 
        amount, 
        currency,
        transferId: result.id 
      });
      
      return Response.json({ success: true, data: result });
    }

    // GET TRANSFERS
    if (action === 'getTransfers') {
      const { limit = 50, offset = 0 } = params;
      
      const accounts = await base44.entities.CustodyAccount.filter({ user_id: user.id });
      if (!accounts?.length) {
        return Response.json({ success: false, error: 'No custody account found' }, { status: 404 });
      }
      
      const account = accounts[0];
      const token = await getAuthToken();
      
      const result = await nowPaymentsRequest(
        `/sub-partner/transfer?sub_partner_id=${account.nowpayments_id}&limit=${limit}&offset=${offset}`, 
        'GET', 
        null, 
        token
      );
      
      return Response.json({ success: true, data: result });
    }

    // GET ALL TRANSFERS (admin only)
    if (action === 'getAllTransfers') {
      if (user.role !== 'admin') {
        return Response.json({ success: false, error: 'Admin access required' }, { status: 403 });
      }
      
      const { limit = 50, offset = 0 } = params;
      const token = await getAuthToken();
      
      const result = await nowPaymentsRequest(
        `/sub-partner/transfer?limit=${limit}&offset=${offset}`, 
        'GET', 
        null, 
        token
      );
      
      return Response.json({ success: true, data: result });
    }

    // LIST ALL CUSTODY ACCOUNTS (admin only)
    if (action === 'listAccounts') {
      if (user.role !== 'admin') {
        return Response.json({ success: false, error: 'Admin access required' }, { status: 403 });
      }
      
      const accounts = await base44.asServiceRole.entities.CustodyAccount.filter({}, '-created_date', 100);
      return Response.json({ success: true, data: accounts || [] });
    }

    return Response.json({ success: false, error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('[CUSTODY_ERROR]', error.message, error.stack);
    return Response.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
});