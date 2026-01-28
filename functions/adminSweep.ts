// @ts-nocheck
/// <reference lib="deno.ns" />
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getMasterCredentials, okxRequest, okResponse } from './okxCore.js';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  // Hardcoded ID from the user screenshot/context for safety, or generic if 'all' provided
  const targetUserId = "6969f269-e373-4530-b371-007620000000"; // Based on partial ID in screenshot, likely need to find by filter if generic
  // Actually, I'll search by the partial ID to be safe or just use the current user if they run it.
  // Better: The user asked me to "test it on the last transfer". I will make this function accept a userId or default to current.

  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Admin only' }, { status: 403 });
  }

  const { targetUserPartial } = await req.json().catch(() => ({}));
  
  // Find the user
  let targetUser = null;
  if (targetUserPartial) {
    const users = await base44.entities.User.filter({ id: { $regex: targetUserPartial } }); // Pseudo-filter
    // Actually Base44 filter is exact match usually. I'll list all users and find. Or better, just rely on the fact the user is likely the one logged in or I can find the ExchangeTransfer.
    // Let's look for the specific ExchangeTransfer that was "COMPLETED" 500 USDT Funding->Trading.
    // user_id: "6969f269..."
  }

  // Strategy:
  // 1. Find UserExchangeAccount for the user
  // 2. Get Sub-Trading Balance
  // 3. Transfer to Master Funding
  // 4. Credit Internal Ledger

  // I'll implement a generic "Sweep User" function.
  
  const targetId = targetUserPartial || "6969f269-e373-4530-b371-007620000000"; // Placeholder, I'll search for transfers to find the ID.
  
  // Let's try to find the transfer first to get the exact User ID
  const transfers = await base44.asServiceRole.entities.ExchangeTransfer.filter({
    amount: 500,
    from_account_type: 'funding',
    to_account_type: 'trading',
    status: 'COMPLETED'
  });
  
  const transfer = transfers.find(t => t.user_id.startsWith('6969f269'));
  
  if (!transfer) {
    return Response.json({ message: "Could not find the specific 500 USDT transfer to fix." });
  }
  
  const userId = transfer.user_id;
  console.log(`Sweeping for user ${userId}`);

  // 1. Get Account
  const accounts = await base44.entities.UserExchangeAccount.filter({ user_id: userId, provider: 'OKX' });
  const account = accounts[0];
  if (!account) return Response.json({ error: "No OKX account" });

  // 2. Get Sub-Trading Balance
  // We need the credential to query the subaccount
  const creds = await base44.asServiceRole.entities.ExchangeCredential.filter({ user_exchange_account_id: account.id });
  // decrypt not available here easily without importing from okxCore (which exports decryptSecret).
  // okxCore exports decryptSecret.
  
  // Actually, better to use the Master Key to query the subaccount directly if possible, or just use the user creds.
  // I will use user creds.
  
  // Wait, okxCore exports `okResponse` etc. I need to update okxCore imports in this file.
  // I'll assume the imports at the top are correct.

  // Fetch credential
  // ... (Simplified: I'll trust the logic in `okxTransfers.js` helps here, but I'll write the sweep logic inline)
  
  // Let's reuse okxTransfers "transferFunds" logic but manually triggered.
  // Actually, I'll just write the steps.

  return Response.json({
    status: "To be implemented in next step once I verify I can run this."
  });
});