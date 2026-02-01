import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    // Hardcoded fix for admin@ruyaacapital.com (695729460f2712be53338a8a)
    const userId = '695729460f2712be53338a8a';
    const wallets = await base44.asServiceRole.entities.CopyTradingWallet.filter({ user_id: userId });
    
    if (!wallets?.length) return Response.json({ ok: false, msg: 'No wallet' });
    const wallet = wallets[0];

    // Correction: Reduce locked_balance by 650 (the total of 3 stakes: 500+100+50)
    // Assuming 750.2 is the current locked, and it should be ~100.2 (if any active signals) or 0.
    // User said "last staked ... should be deducted".
    // I will subtract 650 from locked_balance.
    
    const adjustment = 650.0;
    const newLocked = Math.max(0, wallet.locked_balance - adjustment);

    await base44.asServiceRole.entities.CopyTradingWallet.update(wallet.id, {
      locked_balance: newLocked,
      updated_at: new Date().toISOString()
    });

    return Response.json({ 
      ok: true, 
      oldLocked: wallet.locked_balance, 
      newLocked, 
      adjustment 
    });

  } catch (e) {
    return Response.json({ ok: false, error: e.message });
  }
});