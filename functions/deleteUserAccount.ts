import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Delete User Account - Removes all user data
 * This is a destructive operation that cannot be undone.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action !== 'delete') {
      return Response.json({ ok: false, error: 'Invalid action' }, { status: 400 });
    }

    console.log(`[DELETE_ACCOUNT] Starting deletion for user ${user.id} (${user.email})`);

    // List of entities to delete (ordered by dependencies)
    const entitiesToDelete = [
      'Notification',
      'Trade',
      'WalletTransaction',
      'Wallet',
      'TradingAccount',
      'CopyPosition',
      'CopyTradingWallet',
      'CopyTradingAllocation',
      'CopyTradingSettings',
      'SignalAcceptance',
      'StakingPosition',
      'ExchangeOrder',
      'ExchangePosition',
      'ExchangeTransfer',
      'ExchangeCredential',
      'UserExchangeAccount',
      'WithdrawalRequest',
      'VerificationRequest',
      'LiveAccountRequest',
      'UserPreferences',
      'UserLearnProgress',
      'ReferralAttribution',
      'RewardLedger',
      'MemeWatchlist',
      'MemeScoutAlert',
      'MemeTradeLog',
      'SolanaTxLog'
    ];

    let deletedCounts = {};

    for (const entityName of entitiesToDelete) {
      try {
        // Try to delete by user_id first (most common pattern)
        const byUserId = await base44.asServiceRole.entities[entityName]?.filter({ user_id: user.id });
        if (byUserId && byUserId.length > 0) {
          for (const record of byUserId) {
            await base44.asServiceRole.entities[entityName].delete(record.id);
          }
          deletedCounts[entityName] = byUserId.length;
          console.log(`[DELETE_ACCOUNT] Deleted ${byUserId.length} ${entityName} records (by user_id)`);
          continue;
        }

        // Try created_by as fallback
        const byCreatedBy = await base44.asServiceRole.entities[entityName]?.filter({ created_by: user.email });
        if (byCreatedBy && byCreatedBy.length > 0) {
          for (const record of byCreatedBy) {
            await base44.asServiceRole.entities[entityName].delete(record.id);
          }
          deletedCounts[entityName] = byCreatedBy.length;
          console.log(`[DELETE_ACCOUNT] Deleted ${byCreatedBy.length} ${entityName} records (by created_by)`);
        }
      } catch (e) {
        // Entity might not exist or user has no records - that's OK
        console.log(`[DELETE_ACCOUNT] Skipped ${entityName}: ${e.message}`);
      }
    }

    console.log(`[DELETE_ACCOUNT] Completed for user ${user.id}`, deletedCounts);

    return Response.json({
      ok: true,
      message: 'Account data deleted successfully',
      deletedCounts
    });

  } catch (error) {
    console.error('[DELETE_ACCOUNT] Error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});