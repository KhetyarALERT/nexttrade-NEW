import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BINGX_API_URL = 'https://open-api.bingx.com';

// Generate HMAC signature for BingX API
const generateSignature = async (params, secretKey) => {
  const queryString = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const msgData = encoder.encode(queryString);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// Log audit event
const logAudit = (action, userId, details) => {
  const timestamp = new Date().toISOString();
  console.log(`[AUDIT] [${timestamp}] [${action}] User: ${userId}`, JSON.stringify(details));
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    // Verify authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const { action, ...params } = body;
    
    console.log('[SUBACCOUNT] Request:', { action, params, userId: user.id });
    
    // Get API credentials
    const apiKey = Deno.env.get('BINGX_API_KEY');
    const secretKey = Deno.env.get('BINGX_SECRET_KEY');
    
    if (!apiKey || !secretKey) {
      console.log('[SUBACCOUNT] Missing API credentials');
      return Response.json({ success: false, error: 'BingX API not configured' }, { status: 500 });
    }
    
    if (action === 'create') {
      const { nickname, accountType = 'futures', leverage = 10 } = params;
      
      // Validate inputs
      if (!nickname || nickname.length < 2 || nickname.length > 32) {
        return Response.json({ 
          success: false, 
          error: 'Nickname must be 2-32 characters' 
        }, { status: 400 });
      }
      
      // Check for duplicate nickname for this user
      const existing = await base44.entities.Subaccount.filter({ 
        user_id: user.id, 
        nickname: nickname 
      });
      
      if (existing && existing.length > 0) {
        return Response.json({ 
          success: false, 
          error: 'A subaccount with this nickname already exists' 
        }, { status: 400 });
      }
      
      logAudit('SUBACCOUNT_CREATE_START', user.id, { nickname, accountType });
      
      // Generate unique subaccount identifier
      const subUid = `nt_${user.id.substring(0, 8)}_${Date.now()}`;
      
      // For BingX subaccount creation - attempt API call
      // Note: BingX subaccount API requires specific permissions
      let bingxResult = null;
      let apiSuccess = false;
      
      try {
        const timestamp = Date.now();
        const requestParams = {
          subUid: subUid,
          note: nickname,
          timestamp: timestamp.toString()
        };
        
        const signature = await generateSignature(requestParams, secretKey);
        const queryString = Object.keys(requestParams)
          .sort()
          .map(key => `${key}=${encodeURIComponent(requestParams[key])}`)
          .join('&');
        
        const url = `${BINGX_API_URL}/openApi/subAccount/v1/create?${queryString}&signature=${signature}`;
        
        console.log('[SUBACCOUNT] BingX API call:', { url: url.replace(signature, '***') });
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'X-BX-APIKEY': apiKey,
            'Content-Type': 'application/json'
          }
        });
        
        bingxResult = await response.json();
        console.log('[SUBACCOUNT] BingX response:', bingxResult);
        
        if (bingxResult.code === 0) {
          apiSuccess = true;
        }
      } catch (apiError) {
        console.log('[SUBACCOUNT] BingX API error:', apiError.message);
        // Continue with local account creation even if BingX API fails
      }
      
      // Create subaccount record in database
      // This allows users to manage accounts even if BingX API has issues
      const subaccountRecord = await base44.asServiceRole.entities.Subaccount.create({
        user_id: user.id,
        user_email: user.email,
        subaccount_id: apiSuccess && bingxResult?.data?.subUid 
          ? bingxResult.data.subUid 
          : subUid,
        nickname,
        account_type: accountType,
        leverage,
        status: apiSuccess ? 'active' : 'pending',
        bingx_status: apiSuccess ? 'created' : 'local_only',
        permissions: ['trade', 'read']
      });
      
      logAudit('SUBACCOUNT_CREATE_SUCCESS', user.id, { 
        subaccount_id: subaccountRecord.id,
        bingx_success: apiSuccess
      });
      
      return Response.json({ 
        success: true, 
        data: {
          id: subaccountRecord.id,
          nickname: subaccountRecord.nickname,
          account_type: subaccountRecord.account_type,
          leverage: subaccountRecord.leverage,
          status: subaccountRecord.status,
          created_date: subaccountRecord.created_date
        }
      });
    }
    
    if (action === 'list') {
      // Get user's subaccounts
      const subaccounts = await base44.entities.Subaccount.filter({ 
        user_id: user.id 
      });
      
      // Return without sensitive data
      const safeData = (subaccounts || []).map(s => ({
        id: s.id,
        nickname: s.nickname,
        account_type: s.account_type,
        leverage: s.leverage,
        status: s.status,
        created_date: s.created_date,
        updated_date: s.updated_date
      }));
      
      return Response.json({ success: true, data: safeData });
    }
    
    if (action === 'delete') {
      const { subaccountId } = params;
      
      // Verify ownership
      const subaccount = await base44.entities.Subaccount.filter({ 
        id: subaccountId,
        user_id: user.id 
      });
      
      if (!subaccount || subaccount.length === 0) {
        return Response.json({ 
          success: false, 
          error: 'Subaccount not found' 
        }, { status: 404 });
      }
      
      // Mark as inactive (soft delete)
      await base44.asServiceRole.entities.Subaccount.update(subaccountId, {
        status: 'inactive'
      });
      
      logAudit('SUBACCOUNT_DELETE', user.id, { subaccountId });
      
      return Response.json({ success: true });
    }
    
    return Response.json({ success: false, error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('[SUBACCOUNT_ERROR]', error.message, error.stack);
    return Response.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});