import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * BingX REST API Client
 * 
 * Handles all trading and account operations via signed REST endpoints
 * NEVER polls for live prices - use WebSocket for that
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, params } = await req.json();
    
    // Get API credentials from environment
    const apiKey = Deno.env.get('BINGX_API_KEY');
    const secretKey = Deno.env.get('BINGX_SECRET_KEY');
    
    if (!apiKey || !secretKey) {
      return Response.json({ 
        error: 'BingX API credentials not configured' 
      }, { status: 500 });
    }

    // For demo trading, use internal system instead of BingX API
    // This prevents 500 errors when BingX credentials aren't properly set up
    if (action.startsWith('futures.') || action.startsWith('spot.')) {
      return Response.json({ 
        success: false, 
        error: 'Use tradingAccount function for trading operations',
        hint: 'Trading is handled through our internal demo system'
      }, { status: 400 });
    }

    const client = new BingXRestClient(apiKey, secretKey);
    let result;

    switch (action) {
      // SPOT ENDPOINTS
      case 'spot.placeOrder':
        result = await client.spot.placeOrder(params);
        break;
      case 'spot.cancelOrder':
        result = await client.spot.cancelOrder(params);
        break;
      case 'spot.getOpenOrders':
        result = await client.spot.getOpenOrders(params);
        break;
      case 'spot.getBalance':
        result = await client.spot.getBalance();
        break;

      // FUTURES/SWAP ENDPOINTS
      case 'futures.placeOrder':
        result = await client.futures.placeOrder(params);
        break;
      case 'futures.cancelOrder':
        result = await client.futures.cancelOrder(params);
        break;
      case 'futures.getPositions':
        result = await client.futures.getPositions(params);
        break;
      case 'futures.getBalance':
        result = await client.futures.getBalance();
        break;
      case 'futures.getPnL':
        result = await client.futures.getPnL(params);
        break;

      // SUBACCOUNT ENDPOINTS
      case 'subaccount.executeSpotTrade':
        result = await client.subaccount.executeSpotTrade(params);
        break;
      case 'subaccount.executeFuturesTrade':
        result = await client.subaccount.executeFuturesTrade(params);
        break;
      case 'subaccount.getBalance':
        result = await client.subaccount.getBalance(params.subAccountId);
        break;
      case 'subaccount.getPositions':
        result = await client.subaccount.getPositions(params.subAccountId);
        break;

      // INTERNAL TRANSFER
      case 'transfer.internal':
        result = await client.transfer.internal(params);
        break;

      default:
        return Response.json({ 
          error: `Unknown action: ${action}` 
        }, { status: 400 });
    }

    return Response.json({ success: true, data: result });

  } catch (error) {
    console.error('[BingX REST] Error:', error);
    return Response.json({ 
      error: error.message,
      details: error.response?.data || null
    }, { status: 500 });
  }
});

/**
 * BingX REST Client Implementation
 */
class BingXRestClient {
  constructor(apiKey, secretKey) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.spotBaseUrl = 'https://open-api.bingx.com';
    this.swapBaseUrl = 'https://open-api-swap.bingx.com';
  }

  /**
   * Generate HMAC signature for BingX API
   */
  generateSignature(queryString) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.secretKey);
    const msgData = encoder.encode(queryString);
    
    return crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    ).then(key => 
      crypto.subtle.sign('HMAC', key, msgData)
    ).then(signature => 
      Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    );
  }

  /**
   * Make signed API request
   */
  async signedRequest(method, endpoint, params = {}, baseUrl = this.spotBaseUrl) {
    const timestamp = Date.now();
    const queryParams = { ...params, timestamp };
    
    const queryString = Object.keys(queryParams)
      .sort()
      .map(key => `${key}=${queryParams[key]}`)
      .join('&');

    const signature = await this.generateSignature(queryString);
    const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

    const headers = {
      'X-BX-APIKEY': this.apiKey,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, { method, headers });
    const data = await response.json();

    if (!response.ok || data.code !== 0) {
      throw new Error(data.msg || 'BingX API error');
    }

    return data.data;
  }

  // SPOT TRADING
  spot = {
    placeOrder: async (params) => {
      return this.signedRequest('POST', '/openApi/spot/v1/trade/order', params);
    },
    
    cancelOrder: async (params) => {
      return this.signedRequest('POST', '/openApi/spot/v1/trade/cancel', params);
    },
    
    getOpenOrders: async (params) => {
      return this.signedRequest('GET', '/openApi/spot/v1/trade/openOrders', params);
    },
    
    getBalance: async () => {
      return this.signedRequest('GET', '/openApi/spot/v1/account/balance');
    }
  };

  // FUTURES/SWAP TRADING
  futures = {
    placeOrder: async (params) => {
      return this.signedRequest(
        'POST', 
        '/openApi/swap/v2/trade/order', 
        params, 
        this.swapBaseUrl
      );
    },
    
    cancelOrder: async (params) => {
      return this.signedRequest(
        'POST', 
        '/openApi/swap/v2/trade/order/cancel', 
        params, 
        this.swapBaseUrl
      );
    },
    
    getPositions: async (params = {}) => {
      return this.signedRequest(
        'GET', 
        '/openApi/swap/v2/user/positions', 
        params, 
        this.swapBaseUrl
      );
    },
    
    getBalance: async () => {
      return this.signedRequest(
        'GET', 
        '/openApi/swap/v2/user/balance', 
        {}, 
        this.swapBaseUrl
      );
    },
    
    getPnL: async (params) => {
      return this.signedRequest(
        'GET', 
        '/openApi/swap/v2/user/income', 
        params, 
        this.swapBaseUrl
      );
    }
  };

  // SUBACCOUNT OPERATIONS
  subaccount = {
    executeSpotTrade: async (params) => {
      const { subAccountId, ...orderParams } = params;
      return this.signedRequest(
        'POST', 
        '/openApi/subAccount/v1/spot/trade/order', 
        { ...orderParams, subAccountId }
      );
    },
    
    executeFuturesTrade: async (params) => {
      const { subAccountId, ...orderParams } = params;
      return this.signedRequest(
        'POST', 
        '/openApi/subAccount/v1/swap/trade/order', 
        { ...orderParams, subAccountId },
        this.swapBaseUrl
      );
    },
    
    getBalance: async (subAccountId) => {
      return this.signedRequest(
        'GET', 
        '/openApi/subAccount/v1/balance', 
        { subAccountId }
      );
    },
    
    getPositions: async (subAccountId) => {
      return this.signedRequest(
        'GET', 
        '/openApi/subAccount/v1/positions', 
        { subAccountId },
        this.swapBaseUrl
      );
    }
  };

  // INTERNAL TRANSFER
  transfer = {
    internal: async (params) => {
      return this.signedRequest(
        'POST', 
        '/openApi/api/v3/post/internal/transfer', 
        params
      );
    }
  };
}