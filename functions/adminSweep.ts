// @ts-nocheck
/// <reference lib="deno.ns" />
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getMasterCredentials, okxRequest, decryptSecret } from './okxCore.js';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  // 1. Identify User from the specific 500 USDT transfer
  const transfers = await base44.asServiceRole.entities.ExchangeTransfer.filter({
    amount: 500,
    from_account_type: 'funding',
    to_account_type: 'trading',
    status: 'COMPLETED'
  });
  
  // Find the one matching the ID prefix from screenshot
  const targetTransfer = transfers.find(t => t.user_id.startsWith('6969f269'));
  
  if (!targetTransfer) {
    return Response.json({ error: "Could not find the 500 USDT transfer for user 6969f269..." });
  }
  
  const userId = targetTransfer.user_id;
  console.log(`[SWEEP] Target User: ${userId}`);

  // 2. Get User's OKX Account & Credentials
  const accounts = await base44.asServiceRole.entities.UserExchangeAccount.filter({ 
    user_id: userId, 
    provider: 'OKX' 
  });
  const account = accounts[0];
  if (!account) return Response.json({ error: "No OKX account found" });

  const creds = await base44.asServiceRole.entities.ExchangeCredential.filter({ 
    user_exchange_account_id: account.id 
  });
  const cred = creds[0];
  if (!cred) return Response.json({ error: "No credentials found" });

  const userCredential = {
    apiKey: cred.api_key,
    secretKey: await decryptSecret(cred.secret_enc),
    passphrase: await decryptSecret(cred.passphrase_enc)
  };

  // 3. Check Sub-Trading Balance
  const balRes = await okxRequest({
    credential: userCredential,
    method: 'GET',
    path: '/api/v5/account/balance',
    isTradingEndpoint: true
  });

  if (!balRes.ok) return Response.json({ error: "Failed to fetch balance", details: balRes.error });

  const usdtDetails = balRes.data?.data?.[0]?.details?.find(d => d.ccy === 'USDT');
  const available = parseFloat(usdtDetails?.availBal || '0');
  
  console.log(`[SWEEP] Sub-Trading Balance: ${available} USDT`);

  if (available < 500) {
    return Response.json({ 
      error: "Insufficient balance in Sub-Trading", 
      currentBalance: available,
      note: "Funds might have been moved or used?"
    });
  }

  // 4. Sweep: Sub-Trading -> Master-Funding
  // Path: Sub-Trading (18) -> Sub-Funding (6) -> Master-Funding (6)
  // Step A: Sub-Trading -> Sub-Funding
  console.log('[SWEEP] Executing Step A: Sub-Trading -> Sub-Funding');
  const stepARes = await okxRequest({
    credential: userCredential,
    method: 'POST',
    path: '/api/v5/asset/transfer',
    body: {
      ccy: 'USDT',
      amt: '500',
      from: '18', // Trading
      to: '6',    // Funding
      type: '0'   // Internal
    }
  });

  if (!stepARes.ok) {
    return Response.json({ error: "Step A Failed", details: stepARes.error });
  }

  // Step B: Sub-Funding -> Master-Funding
  console.log('[SWEEP] Executing Step B: Sub-Funding -> Master-Funding');
  const masterCredsResult = getMasterCredentials();
  if (!masterCredsResult.ok) return Response.json(masterCredsResult);

  const stepBRes = await okxRequest({
    credential: masterCredsResult.data,
    method: 'POST',
    path: '/api/v5/asset/transfer',
    body: {
      ccy: 'USDT',
      amt: '500',
      from: '6', // Funding
      to: '6',   // Funding
      type: '2', // Sub to Master
      subAcct: account.external_account_id
    }
  });

  if (!stepBRes.ok) {
    return Response.json({ error: "Step B Failed", details: stepBRes.error });
  }

  const transId = stepBRes.data?.data?.[0]?.transId;

  // 5. Credit Internal Ledger
  console.log('[SWEEP] Crediting Internal Ledger');
  
  // Find/Create TradingAccount
  let tradingAccount = (await base44.entities.TradingAccount.filter({ user_id: userId }))[0];
  if (!tradingAccount) {
    tradingAccount = await base44.asServiceRole.entities.TradingAccount.create({
      account_id: `TA_${Date.now()}`,
      user_id: userId,
      nickname: 'Trading Account',
      account_type: 'demo',
      balance: 0,
      equity: 0,
      status: 'active'
    });
  }

  // Update Balance
  await base44.asServiceRole.entities.TradingAccount.update(tradingAccount.id, {
    balance: (tradingAccount.balance || 0) + 500,
    equity: (tradingAccount.equity || 0) + 500
  });

  // Find/Create Wallet
  let wallet = (await base44.entities.Wallet.filter({ trading_account_id: tradingAccount.id, currency: 'USDT' }))[0];
  if (!wallet) {
    wallet = await base44.asServiceRole.entities.Wallet.create({
      trading_account_id: tradingAccount.id,
      user_id: userId,
      currency: 'USDT',
      network: 'INTERNAL',
      balance: 0,
      status: 'active'
    });
  }

  await base44.asServiceRole.entities.Wallet.update(wallet.id, {
    balance: (wallet.balance || 0) + 500
  });

  // Log Transaction
  await base44.asServiceRole.entities.WalletTransaction.create({
    wallet_id: wallet.id,
    user_id: userId,
    type: 'internal_transfer_in',
    amount: 500,
    currency: 'USDT',
    status: 'completed',
    notes: `SWEEP FIX: Deposit from Funding (TransId: ${transId})`
  });

  return Response.json({
    success: true,
    message: "Swept 500 USDT from Sub-Trading to Master-Funding and credited Internal Ledger.",
    transId
  });
});