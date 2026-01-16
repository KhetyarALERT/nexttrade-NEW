// @ts-nocheck
/// <reference lib="deno.ns" />
// OKX System Test - End-to-end validation

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
    if (!user?.role === 'admin') {
      return Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }
    
    const body = await req.json().catch(() => ({}));
    const { action, targetUserId } = body;
    const userId = targetUserId || user.id;
    
    const report = { userId, timestamp: new Date().toISOString(), tests: [] };
    
    // ==================== PROVISIONING TEST ====================
    if (action === 'testProvisioning') {
      // Test 1: Ensure user account
      try {
        const result = await base44.functions.invoke('okxProvisioning', { action: 'ensureUserAccount' });
        report.tests.push({
          name: 'ensureUserAccount',
          passed: result.data?.ok === true,
          data: result.data,
          error: result.data?.error
        });
      } catch (err) {
        report.tests.push({ name: 'ensureUserAccount', passed: false, error: err.message });
      }
      
      // Test 2: Get account config
      const accounts = await base44.entities.UserExchangeAccount.filter({ user_id: userId, provider: 'OKX' });
      if (accounts?.length) {
        try {
          const configResult = await base44.functions.invoke('okxProvisioning', { 
            action: 'assertAccountReady', 
            accountId: accounts[0].id 
          });
          report.tests.push({
            name: 'assertAccountReady',
            passed: configResult.data?.ok === true,
            data: configResult.data,
            error: configResult.data?.error
          });
        } catch (err) {
          report.tests.push({ name: 'assertAccountReady', passed: false, error: err.message });
        }
        
        // Test 3: Get deposit address
        try {
          const depositResult = await base44.functions.invoke('okxTransfers', {
            action: 'getDepositAddress',
            accountId: accounts[0].id,
            currency: 'USDT'
          });
          report.tests.push({
            name: 'getDepositAddress',
            passed: depositResult.data?.ok === true && depositResult.data?.data?.addresses?.length > 0,
            data: depositResult.data,
            error: depositResult.data?.error
          });
        } catch (err) {
          report.tests.push({ name: 'getDepositAddress', passed: false, error: err.message });
        }
        
        // Test 4: Get balances
        try {
          const balanceResult = await base44.functions.invoke('okxTransfers', {
            action: 'getBalances',
            accountId: accounts[0].id
          });
          report.tests.push({
            name: 'getBalances',
            passed: balanceResult.data?.ok === true,
            data: balanceResult.data,
            error: balanceResult.data?.error
          });
        } catch (err) {
          report.tests.push({ name: 'getBalances', passed: false, error: err.message });
        }
      } else {
        report.tests.push({ name: 'accountExists', passed: false, error: 'No account created' });
      }
      
      // Test 5: Get tickers
      try {
        const tickerResult = await base44.functions.invoke('okxMarketData', { action: 'getTickersSwap' });
        report.tests.push({
          name: 'getTickersSwap',
          passed: tickerResult.data?.ok === true && tickerResult.data?.data?.length > 0,
          data: { count: tickerResult.data?.data?.length || 0 },
          error: tickerResult.data?.error
        });
      } catch (err) {
        report.tests.push({ name: 'getTickersSwap', passed: false, error: err.message });
      }
      
      report.summary = {
        total: report.tests.length,
        passed: report.tests.filter(t => t.passed).length,
        failed: report.tests.filter(t => !t.passed).length
      };
      
      return Response.json({ ok: true, data: report });
    }
    
    // ==================== WITHDRAWAL DRY RUN ====================
    if (action === 'testWithdrawalDryRun') {
      const { toAddr, chain = 'USDT-TRC20', currency = 'USDT', amount = 10 } = body;
      
      if (!toAddr) {
        return Response.json({ ok: false, error: { code: 'MISSING_ADDRESS', message: 'toAddr required' } }, { status: 400 });
      }
      
      try {
        const result = await base44.functions.invoke('okxTransfers', {
          action: 'requestWithdrawal',
          currency,
          chain,
          address: toAddr,
          amount
        });
        
        report.tests.push({
          name: 'requestWithdrawal',
          passed: result.data?.ok === true,
          data: result.data,
          note: 'Withdrawal created but NOT confirmed. Use confirmWithdrawal to execute.'
        });
      } catch (err) {
        report.tests.push({ name: 'requestWithdrawal', passed: false, error: err.message });
      }
      
      report.summary = {
        total: report.tests.length,
        passed: report.tests.filter(t => t.passed).length,
        failed: report.tests.filter(t => !t.passed).length
      };
      
      return Response.json({ ok: true, data: report });
    }
    
    return Response.json({ ok: false, error: { code: 'INVALID_ACTION', message: 'Invalid action. Use testProvisioning or testWithdrawalDryRun' } }, { status: 400 });
    
  } catch (error) {
    console.error('[OKX_TEST_ERROR]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});