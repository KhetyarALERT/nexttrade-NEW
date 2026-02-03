import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const OKX_API_URL = 'https://www.okx.com';

// Encryption helpers using APP_ENCRYPTION_KEY
const getEncryptionKey = async (): Promise<CryptoKey> => {
  const keyStr = Deno.env.get('APP_ENCRYPTION_KEY');
  if (!keyStr) throw new Error('APP_ENCRYPTION_KEY not configured');
  
  // Derive a 256-bit key from the secret
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
  
  return crypto.subtle.importKey(
    'raw', hashBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
  );
};

const encryptSecret = async (plaintext: string): Promise<string> => {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, encoder.encode(plaintext)
  );
  // Return as base64: iv:ciphertext
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  return `${ivB64}:${ctB64}`;
};

const decryptSecret = async (ciphertext: string): Promise<string> => {
  const key = await getEncryptionKey();
  const [ivB64, ctB64] = ciphertext.split(':');
  if (!ivB64 || !ctB64) throw new Error('Invalid encrypted format');
  
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, key, ct
  );
  return new TextDecoder().decode(decrypted);
};

const jsonOk = (data: any, init: ResponseInit = {}) =>
  Response.json({ ok: true, data }, init);
const jsonError = (code: string, message: string, status = 400, extra: Record<string, unknown> = {}) =>
  Response.json({ ok: false, error: { code, message, ...extra } }, { status });

// Generate HMAC-SHA256 signature for OKX API
// OKX signature = Base64(HMAC-SHA256(timestamp + method + requestPath + body, secretKey))
const generateOkxSignature = async (
  timestamp: string,
  method: string,
  requestPath: string,
  body: string,
  secretKey: string
): Promise<string> => {
  const prehash = timestamp + method + requestPath + body;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const msgData = encoder.encode(prehash);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  // OKX requires Base64 encoding, not hex
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
};

// Make authenticated OKX API request
const okxRequest = async (
  method: string,
  endpoint: string,
  body: object | null,
  apiKey: string,
  secretKey: string,
  passphrase: string
): Promise<{ code: string; msg: string; data: any }> => {
  const timestamp = new Date().toISOString();
  const bodyStr = body ? JSON.stringify(body) : '';
  
  const signature = await generateOkxSignature(
    timestamp,
    method,
    endpoint,
    bodyStr,
    secretKey
  );
  
  const headers: Record<string, string> = {
    'OK-ACCESS-KEY': apiKey,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': passphrase,
    'Content-Type': 'application/json'
  };
  
  const response = await fetch(`${OKX_API_URL}${endpoint}`, {
    method,
    headers,
    body: bodyStr || undefined
  });
  
  return response.json();
};

// Log audit event
const logAudit = (action: string, userId: string, details: object): void => {
  const timestamp = new Date().toISOString();
  console.log(`[AUDIT] [${timestamp}] [${action}] User: ${userId}`, JSON.stringify(details));
};

// Generate unique sub-account name (OKX requires 6-20 alphanumeric)
const generateSubAcctName = (userId: string): string => {
  const prefix = 'NT';
  const userPart = userId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase();
  const timePart = Date.now().toString(36).toUpperCase();
  return `${prefix}${userPart}${timePart}`.substring(0, 20);
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  // CORS headers for preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }
  
  try {
    // Verify authentication
    const user = await base44.auth.me();
    if (!user) {
      return jsonError('UNAUTHORIZED', 'Unauthorized', 401);
    }
    
    const body = await req.json();
    const { action, ...params } = body;
    
    console.log('[SUBACCOUNT] Request:', { action, params, userId: user.id });
    
    // Get OKX Master API credentials (from secrets)
    const apiKey = Deno.env.get('OKX_MAIN_API_KEY');
    const secretKey = Deno.env.get('OKX_MAIN_SECRET');
    const passphrase = Deno.env.get('OKX_MAIN_PASSPHRASE');
    
    if (!apiKey || !secretKey || !passphrase) {
      console.log('[SUBACCOUNT] Missing OKX API credentials');
      return jsonError(
        'CONFIG_ERROR',
        'Exchange API not configured. Please add OKX_MAIN_API_KEY, OKX_MAIN_SECRET, and OKX_MAIN_PASSPHRASE to secrets.',
        500
      );
    }
    
    // ==================== CREATE SUB-ACCOUNT ====================
    if (action === 'create') {
      const { nickname, accountType = 'futures', leverage = 10 } = params;
      
      // Validate inputs
      if (!nickname || nickname.length < 2 || nickname.length > 32) {
        return jsonError('VALIDATION_ERROR', 'Nickname must be 2-32 characters', 400);
      }
      
      // Check for duplicate nickname for this user
      const existing = await base44.entities.Subaccount.filter({ 
        user_id: user.id, 
        nickname: nickname 
      });
      
      if (existing && existing.length > 0) {
        return jsonError('DUPLICATE', 'A subaccount with this nickname already exists', 400);
      }
      
      logAudit('SUBACCOUNT_CREATE_START', user.id, { nickname, accountType });
      
      let okxResult: any = null;
      let okxSubAcct: string | null = null;
      let okxApiKey: string | null = null;
      let okxApiSecret: string | null = null;
      let okxApiPassphrase: string | null = null;
      let apiSuccess = false;
      
      try {
        // Step 1: Create sub-account on OKX
        const subAcctName = generateSubAcctName(user.id);
        
        console.log('[SUBACCOUNT] Creating OKX sub-account:', subAcctName);
        
        okxResult = await okxRequest(
          'POST',
          '/api/v5/users/subaccount/create-subaccount',
          {
            subAcct: subAcctName,
            label: nickname.substring(0, 20) // OKX label max 20 chars
          },
          apiKey,
          secretKey,
          passphrase
        );
        
        console.log('[SUBACCOUNT] OKX create response:', okxResult);
        
        if (okxResult.code === '0' && okxResult.data?.[0]) {
          okxSubAcct = okxResult.data[0].subAcct;
          
          // Step 2: Create API key for sub-account
          console.log('[SUBACCOUNT] Creating API key for:', okxSubAcct);
          
          const apiKeyResult = await okxRequest(
            'POST',
            '/api/v5/users/subaccount/apikey',
            {
              subAcct: okxSubAcct,
              label: `${nickname.substring(0, 10)}_api`,
              passphrase: `Sub${Date.now().toString(36)}@1`, // Generate unique passphrase
              perm: 'read_only,trade' // Read + Trade permissions
            },
            apiKey,
            secretKey,
            passphrase
          );
          
          console.log('[SUBACCOUNT] OKX API key response:', {
            code: apiKeyResult.code,
            msg: apiKeyResult.msg,
            hasData: !!apiKeyResult.data
          });
          
          if (apiKeyResult.code === '0' && apiKeyResult.data?.[0]) {
            okxApiKey = apiKeyResult.data[0].apiKey;
            okxApiSecret = apiKeyResult.data[0].secretKey;
            okxApiPassphrase = apiKeyResult.data[0].passphrase;
            
            // Step 3: Enable futures trading (set account level to 2)
            console.log('[SUBACCOUNT] Enabling futures trading...');
            
            // Use sub-account's own API key to set account config
            const configResult = await okxRequest(
              'POST',
              '/api/v5/account/set-account-level',
              { acctLv: '2' }, // 2 = Single-currency margin (futures enabled)
              okxApiKey,
              okxApiSecret,
              okxApiPassphrase
            );
            
            console.log('[SUBACCOUNT] Account level config:', configResult);
            
            // Step 4: Set default leverage if futures enabled
            if (accountType === 'futures' || accountType === 'both') {
              console.log('[SUBACCOUNT] Setting leverage to:', leverage);
              
              const leverageResult = await okxRequest(
                'POST',
                '/api/v5/account/set-leverage',
                {
                  instId: 'BTC-USDT-SWAP',
                  lever: String(leverage),
                  mgnMode: 'cross'
                },
                okxApiKey,
                okxApiSecret,
                okxApiPassphrase
              );
              
              console.log('[SUBACCOUNT] Leverage result:', leverageResult);
            }
            
            apiSuccess = true;
          }
        }
      } catch (apiError: any) {
        console.log('[SUBACCOUNT] OKX API error:', apiError.message);
        // Continue with local account creation if OKX fails
      }
      
      // Generate local subaccount ID as fallback
      const localSubId = `nt_${user.id.substring(0, 8)}_${Date.now()}`;
      
      // Encrypt sensitive API credentials before storing
      let encryptedSecret: string | null = null;
      let encryptedPassphrase: string | null = null;
      
      if (okxApiSecret) {
        try {
          encryptedSecret = await encryptSecret(okxApiSecret);
        } catch (e) {
          console.error('[SUBACCOUNT] Failed to encrypt API secret:', e.message);
        }
      }
      
      if (okxApiPassphrase) {
        try {
          encryptedPassphrase = await encryptSecret(okxApiPassphrase);
        } catch (e) {
          console.error('[SUBACCOUNT] Failed to encrypt passphrase:', e.message);
        }
      }
      
      // Create subaccount record in database with encrypted credentials
      const subaccountRecord = await base44.asServiceRole.entities.Subaccount.create({
        user_id: user.id,
        user_email: user.email,
        subaccount_id: okxSubAcct || localSubId,
        nickname,
        account_type: accountType,
        leverage,
        status: 'active',
        okx_status: apiSuccess ? 'synced' : 'local',
        okx_subacct: okxSubAcct || null,
        // API key is not sensitive on its own, but secret and passphrase are encrypted
        okx_api_key: okxApiKey || null,
        api_secret_encrypted: encryptedSecret,
        api_passphrase_encrypted: encryptedPassphrase,
        permissions: ['trade', 'read']
      });
      
      // Create corresponding account entities based on type
      if (accountType === 'spot' || accountType === 'both') {
        await base44.asServiceRole.entities.SpotAccount.create({
          user_id: user.id,
          subaccount_id: subaccountRecord.id,
          balance_usdt: 0,
          balance_btc: 0,
          balance_eth: 0,
          total_value_usdt: 0,
          status: 'active',
          last_sync: new Date().toISOString()
        });
      }
      
      if (accountType === 'futures' || accountType === 'both') {
        await base44.asServiceRole.entities.FuturesAccount.create({
          user_id: user.id,
          subaccount_id: subaccountRecord.id,
          balance_usdt: 0,
          margin_balance: 0,
          unrealized_pnl: 0,
          leverage: leverage,
          margin_mode: 'cross',
          open_positions: 0,
          status: 'active',
          last_sync: new Date().toISOString()
        });
      }
      
      logAudit('SUBACCOUNT_CREATE_SUCCESS', user.id, { 
        subaccount_id: subaccountRecord.id,
        okx_synced: apiSuccess,
        okx_subacct: okxSubAcct,
        account_type: accountType
      });
      
      return jsonOk({
        id: subaccountRecord.id,
        nickname: subaccountRecord.nickname,
        account_type: subaccountRecord.account_type,
        leverage: subaccountRecord.leverage,
        status: subaccountRecord.status,
        okx_synced: apiSuccess,
        created_date: subaccountRecord.created_date,
      });
    }
    
    // ==================== LIST SUB-ACCOUNTS ====================
    if (action === 'list') {
      // Get user's subaccounts
      const subaccounts = await base44.entities.Subaccount.filter({ 
        user_id: user.id 
      });
      
      // Return without sensitive data (no API keys!)
      const safeData = (subaccounts || []).map((s: any) => ({
        id: s.id,
        nickname: s.nickname,
        account_type: s.account_type,
        leverage: s.leverage,
        status: s.status,
        okx_synced: s.okx_status === 'synced',
        created_date: s.created_date,
        updated_date: s.updated_date
      }));
      
      return jsonOk(safeData);
    }
    
    // ==================== DELETE SUB-ACCOUNT ====================
    if (action === 'delete') {
      const { subaccountId } = params;
      
      // Verify ownership
      const subaccount = await base44.entities.Subaccount.filter({ 
        id: subaccountId,
        user_id: user.id 
      });
      
      if (!subaccount || subaccount.length === 0) {
        return jsonError('NOT_FOUND', 'Subaccount not found', 404);
      }
      
      // Note: OKX sub-accounts cannot be deleted, only deactivated
      // We just mark as inactive in our database
      await base44.asServiceRole.entities.Subaccount.update(subaccountId, {
        status: 'inactive'
      });
      
      logAudit('SUBACCOUNT_DELETE', user.id, { subaccountId });
      
      return jsonOk({ deleted: true });
    }
    
    // ==================== TRANSFER FUNDS ====================
    if (action === 'transfer') {
      const { subaccountId, direction, amount, asset = 'USDT' } = params;
      // direction: 'to_sub' (main -> sub) or 'from_sub' (sub -> main)
      
      if (!subaccountId || !direction || !amount || amount <= 0) {
        return jsonError('INVALID_PARAMS', 'Invalid transfer parameters', 400);
      }
      
      // Get subaccount details
      const subaccounts = await base44.entities.Subaccount.filter({ 
        id: subaccountId,
        user_id: user.id 
      });
      
      if (!subaccounts || subaccounts.length === 0) {
        return jsonError('NOT_FOUND', 'Subaccount not found', 404);
      }
      
      const subaccount = subaccounts[0];
      
      if (!subaccount.okx_subacct) {
        return jsonError('NOT_SYNCED', 'Subaccount not synced with OKX', 400);
      }
      
      logAudit('TRANSFER_START', user.id, { subaccountId, direction, amount, asset });
      
      try {
        // OKX sub-account transfer
        // type: 1 = main to sub, 2 = sub to main
        const transferResult = await okxRequest(
          'POST',
          '/api/v5/asset/subaccount/transfer',
          {
            ccy: asset,
            amt: String(amount),
            from: direction === 'to_sub' ? '6' : '6', // 6 = funding account
            to: direction === 'to_sub' ? '6' : '6',
            subAcct: subaccount.okx_subacct,
            type: direction === 'to_sub' ? '1' : '2'
          },
          apiKey,
          secretKey,
          passphrase
        );
        
        console.log('[SUBACCOUNT] Transfer result:', transferResult);
        
        if (transferResult.code !== '0') {
          return jsonError('TRANSFER_FAILED', `Transfer failed: ${transferResult.msg}`, 400);
        }
        
        // Create transfer record
        const transfer = await base44.asServiceRole.entities.InternalTransfer.create({
          user_id: user.id,
          transfer_id: transferResult.data?.[0]?.transId || `tf_${Date.now()}`,
          source_account: direction === 'to_sub' ? 'main' : subaccountId,
          target_account: direction === 'to_sub' ? subaccountId : 'main',
          asset,
          amount,
          status: 'completed'
        });
        
        logAudit('TRANSFER_SUCCESS', user.id, { 
          transfer_id: transfer.id,
          okx_trans_id: transferResult.data?.[0]?.transId,
          amount,
          asset 
        });
        
        return jsonOk(transfer);
        
      } catch (transferError: any) {
        console.log('[SUBACCOUNT] Transfer error:', transferError.message);
        return jsonError('TRANSFER_FAILED', `Transfer failed: ${transferError.message}`, 500);
      }
    }
    
    // ==================== GET BALANCE ====================
    if (action === 'balance') {
      const { subaccountId } = params;
      
      // Get subaccount details
      const subaccounts = await base44.entities.Subaccount.filter({ 
        id: subaccountId,
        user_id: user.id 
      });
      
      if (!subaccounts || subaccounts.length === 0) {
        return jsonError('NOT_FOUND', 'Subaccount not found', 404);
      }
      
      const subaccount = subaccounts[0];
      
      if (!subaccount.okx_api_key || !subaccount.api_secret_encrypted) {
        return jsonError('NOT_SYNCED', 'Subaccount not synced with OKX', 400);
      }
      
      try {
        // Decrypt credentials before use
        let decryptedSecret: string;
        let decryptedPassphrase: string;
        
        try {
          decryptedSecret = await decryptSecret(subaccount.api_secret_encrypted);
          decryptedPassphrase = await decryptSecret(subaccount.api_passphrase_encrypted);
        } catch (decryptErr: any) {
          console.error('[SUBACCOUNT] Decryption failed:', decryptErr.message);
          return jsonError('DECRYPT_FAILED', 'Failed to decrypt credentials', 500);
        }
        
        // Get balance using sub-account's own API key
        const balanceResult = await okxRequest(
          'GET',
          '/api/v5/account/balance',
          null,
          subaccount.okx_api_key,
          decryptedSecret,
          decryptedPassphrase
        );
        
        if (balanceResult.code !== '0') {
          return jsonError('BALANCE_FAILED', `Failed to get balance: ${balanceResult.msg}`, 400);
        }
        
        return jsonOk(balanceResult.data);
        
      } catch (balanceError: any) {
        console.log('[SUBACCOUNT] Balance error:', balanceError.message);
        return jsonError('BALANCE_FAILED', `Failed to get balance: ${balanceError.message}`, 500);
      }
    }
    
    return jsonError('INVALID_ACTION', 'Invalid action', 400);
    
  } catch (error: any) {
    console.error('[SUBACCOUNT_ERROR]', error.message, error.stack);
    return jsonError('INTERNAL_ERROR', error.message || 'Internal server error', 500);
  }
});