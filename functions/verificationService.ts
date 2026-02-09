import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Verification Service - Single Source of Truth for User Verification Status
 * 
 * Data responsibilities:
 * - UserVerification: status + pointers ONLY (no doc URLs, no full audit)
 * - VerificationRequest: full KYC data + help requests + audit history
 * 
 * Actions:
 * - getStatus: Get user's verification status from UserVerification + current request details
 * - submitKyc: Submit/update KYC (creates or updates pending KYC request)
 * - submitHelp: Submit help request (creates separate help record, does NOT change KYC status)
 * - adminApprove: Admin approves KYC verification
 * - adminReject: Admin rejects KYC verification
 * - adminRespond: Admin responds to help request (does not change verification status)
 * - runCleanup: Consolidate duplicate KYC requests (admin only, KYC only, never deletes)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ========== GET STATUS ==========
    if (action === "getStatus") {
      const targetUserId = body.userId || user.id;
      
      // Only admin can query other users
      if (targetUserId !== user.id && user.role !== "admin") {
        return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }

      // Check UserVerification (single source of truth for status)
      const verifications = await base44.asServiceRole.entities.UserVerification.filter(
        { user_id: targetUserId }
      );

      if (verifications.length === 0) {
        return Response.json({
          ok: true,
          data: {
            status: "unverified",
            exists: false
          }
        });
      }

      const uv = verifications[0];
      
      // Load current request details (full KYC data lives here)
      let currentRequest = null;
      if (uv.current_request_id) {
        try {
          const requests = await base44.asServiceRole.entities.VerificationRequest.filter(
            { id: uv.current_request_id }
          );
          currentRequest = requests[0] || null;
        } catch (e) {
          // Request may have been deleted
        }
      }

      return Response.json({
        ok: true,
        data: {
          status: uv.status,
          verified_at: uv.verified_at,
          verified_by: uv.verified_by,
          rejection_reason: uv.rejection_reason,
          current_request_id: uv.current_request_id,
          current_request: currentRequest,
          exists: true
        }
      });
    }

    // ========== SUBMIT KYC ==========
    if (action === "submitKyc") {
      const { fullName, documentType, frontUrl, backUrl, selfieUrl, dateOfBirth, country } = body;

      // Get or create UserVerification record
      let uvRecords = await base44.asServiceRole.entities.UserVerification.filter({ user_id: user.id });
      let uv = uvRecords[0];

      // If already verified, block new KYC submissions
      if (uv?.status === "verified") {
        return Response.json({
          ok: false,
          error: "Already verified",
          status: "already_verified"
        });
      }

      // Check for existing pending KYC request (request_type = kyc or full)
      const pendingRequests = await base44.asServiceRole.entities.VerificationRequest.filter({
        user_id: user.id,
        status: "pending"
      });
      
      // Filter to KYC type only
      const pendingKycRequests = pendingRequests.filter(r => 
        r.request_type === "kyc" || r.request_type === "full" || !r.request_type
      );

      let verificationRequest;

      if (pendingKycRequests.length > 0) {
        // UPDATE existing pending KYC request (no duplicate)
        const existingRequest = pendingKycRequests[0];
        
        const updateData = {
          submitted_at: new Date().toISOString()
        };
        
        // Only update fields that are provided
        if (fullName) updateData.full_name = fullName;
        if (documentType) updateData.document_type = documentType;
        if (frontUrl) updateData.document_front_url = frontUrl;
        if (backUrl) updateData.document_back_url = backUrl;
        if (selfieUrl) updateData.selfie_url = selfieUrl;
        if (dateOfBirth) updateData.date_of_birth = dateOfBirth;
        if (country) updateData.country = country;

        await base44.asServiceRole.entities.VerificationRequest.update(existingRequest.id, updateData);
        verificationRequest = { ...existingRequest, ...updateData };
      } else {
        // Create NEW KYC request
        verificationRequest = await base44.asServiceRole.entities.VerificationRequest.create({
          user_id: user.id,
          user_email: user.email,
          full_name: fullName,
          document_type: documentType || "passport",
          document_front_url: frontUrl,
          document_back_url: backUrl,
          selfie_url: selfieUrl,
          date_of_birth: dateOfBirth,
          country: country,
          status: "pending",
          request_type: "kyc",
          submitted_at: new Date().toISOString()
        });
      }

      // Create or update UserVerification
      if (!uv) {
        uv = await base44.asServiceRole.entities.UserVerification.create({
          user_id: user.id,
          user_email: user.email,
          full_name: fullName,
          status: "pending",
          current_request_id: verificationRequest.id
        });
      } else {
        await base44.asServiceRole.entities.UserVerification.update(uv.id, {
          status: "pending",
          current_request_id: verificationRequest.id,
          full_name: fullName || uv.full_name
        });
      }

      // Notify all admins: KYC submitted
      try {
        const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 200);
        const admins = (allUsers || []).filter(u => u.role === 'admin');
        for (const admin of admins) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: admin.id,
            type: 'kyc_submitted',
            title: `KYC Submitted: ${fullName || user.email}`,
            message: `${user.email} submitted a KYC verification request (${documentType || 'passport'})`,
            priority: 'high',
            read: false,
            data: {
              verification_request_id: verificationRequest.id,
              user_id: user.id,
              user_email: user.email,
              status: 'pending',
              timestamp: new Date().toISOString(),
              link: `/OKXAdminHub?tab=verification&requestId=${verificationRequest.id}`
            }
          });
        }
      } catch (e) {
        console.error('[verificationService] Failed to notify admins on KYC submit:', e.message);
      }

      return Response.json({
        ok: true,
        data: {
          request_id: verificationRequest.id,
          status: "pending"
        }
      });
    }

    // ========== SUBMIT HELP REQUEST ==========
    // Help requests are SEPARATE from KYC - they do NOT change verification status
    if (action === "submitHelp") {
      const { helpMessage, fullName, documentType, frontUrl } = body;

      if (!helpMessage) {
        return Response.json({ ok: false, error: "helpMessage required" });
      }

      // Create a SEPARATE help request record
      const helpRequest = await base44.asServiceRole.entities.VerificationRequest.create({
        user_id: user.id,
        user_email: user.email,
        full_name: fullName || user.full_name || "",
        document_type: documentType || "passport",
        document_front_url: frontUrl || null,
        status: "needs_help",
        request_type: "help",
        help_message: helpMessage,
        help_requested_at: new Date().toISOString(),
        submitted_at: new Date().toISOString()
      });

      // NOTE: Do NOT update UserVerification status - help requests don't affect KYC status

      return Response.json({
        ok: true,
        data: {
          request_id: helpRequest.id,
          status: "needs_help"
        }
      });
    }

    // ========== ADMIN APPROVE ==========
    if (action === "adminApprove") {
      if (user.role !== "admin") {
        return Response.json({ ok: false, error: "Admin only" }, { status: 403 });
      }

      const { requestId } = body;
      if (!requestId) {
        return Response.json({ ok: false, error: "requestId required" });
      }

      // Get the request
      const requests = await base44.asServiceRole.entities.VerificationRequest.filter({ id: requestId });
      if (requests.length === 0) {
        return Response.json({ ok: false, error: "Request not found" });
      }
      const vr = requests[0];

      // Only approve KYC requests (not help requests)
      if (vr.request_type === "help") {
        return Response.json({ ok: false, error: "Cannot approve help requests - use adminRespond instead" });
      }

      // Update request
      await base44.asServiceRole.entities.VerificationRequest.update(requestId, {
        status: "approved",
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString()
      });

      // Mark other pending KYC requests for this user as superseded (NOT help requests)
      const otherRequests = await base44.asServiceRole.entities.VerificationRequest.filter({
        user_id: vr.user_id
      });
      for (const other of otherRequests) {
        // Only supersede KYC requests, not help requests
        const isKycRequest = other.request_type === "kyc" || other.request_type === "full" || !other.request_type;
        if (other.id !== requestId && isKycRequest && !other.is_superseded) {
          if (other.status === "pending" || other.status === "under_review") {
            await base44.asServiceRole.entities.VerificationRequest.update(other.id, {
              status: "superseded",
              is_superseded: true
            });
          }
        }
      }

      // Update or create UserVerification
      const uvRecords = await base44.asServiceRole.entities.UserVerification.filter({ user_id: vr.user_id });
      if (uvRecords.length === 0) {
        await base44.asServiceRole.entities.UserVerification.create({
          user_id: vr.user_id,
          user_email: vr.user_email,
          full_name: vr.full_name,
          status: "verified",
          current_request_id: requestId,
          verified_at: new Date().toISOString(),
          verified_by: user.email
        });
      } else {
        await base44.asServiceRole.entities.UserVerification.update(uvRecords[0].id, {
          status: "verified",
          current_request_id: requestId,
          verified_at: new Date().toISOString(),
          verified_by: user.email,
          full_name: vr.full_name || uvRecords[0].full_name,
          rejection_reason: null,
          rejected_at: null
        });
      }

      // Notify all admins: KYC approved
      try {
        const allUsersAppr = await base44.asServiceRole.entities.User.list('-created_date', 200);
        const adminsAppr = (allUsersAppr || []).filter(u => u.role === 'admin');
        for (const admin of adminsAppr) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: admin.id,
            type: 'kyc_approved',
            title: `KYC Approved: ${vr.full_name || vr.user_email}`,
            message: `${vr.user_email}'s KYC verification was approved by ${user.email}`,
            priority: 'normal',
            read: false,
            data: {
              verification_request_id: requestId,
              user_id: vr.user_id,
              user_email: vr.user_email,
              status: 'approved',
              timestamp: new Date().toISOString(),
              link: `/OKXAdminHub?tab=verification&requestId=${requestId}`
            }
          });
        }
      } catch (e) {
        console.error('[verificationService] Failed to notify admins on approve:', e.message);
      }

      // Notify the user: KYC approved
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_id: vr.user_id,
          type: 'kyc_approved',
          title: 'KYC Verified ✅',
          message: 'Your identity verification has been approved. You now have full access to all features.',
          priority: 'high',
          read: false,
          data: { link: '/Profile?tab=security', status: 'approved' }
        });
      } catch (e) {
        console.error('[verificationService] Failed to notify user on approve:', e.message);
      }

      // === AUTO-PROVISION: Create TradingAccount + Wallets for verified user ===
      try {
        // IDEMPOTENCY: Use deterministic account_id to prevent duplicates
        const liveAccountId = `TA_live_${vr.user_id}`;
        
        // Check by deterministic ID first (most reliable dedup check)
        const existingByAccountId = await base44.asServiceRole.entities.TradingAccount.filter({
          account_id: liveAccountId
        });
        
        if (existingByAccountId?.length > 0) {
          console.log('[verificationService] Live account already exists (by account_id):', liveAccountId, '- skipping provisioning');
        } else {
          // Also check by user_id + is_demo=false as fallback (catches old-format IDs)
          const allUserAccounts = await base44.asServiceRole.entities.TradingAccount.filter({
            user_id: vr.user_id
          });
          const existingLiveAccounts = (allUserAccounts || []).filter(a => !a.is_demo);
          
          if (existingLiveAccounts.length > 0) {
            console.log('[verificationService] User already has', existingLiveAccounts.length, 'live account(s) (old format), skipping provisioning');
          } else {
            const newAccount = await base44.asServiceRole.entities.TradingAccount.create({
              account_id: liveAccountId,
              user_id: vr.user_id,
              user_email: vr.user_email,
              nickname: 'Trading Account',
              account_type: 'mentor',
              balance: 0,
              equity: 0,
              margin_used: 0,
              unrealized_pnl: 0,
              realized_pnl: 0,
              total_trades: 0,
              winning_trades: 0,
              status: 'active',
              default_leverage: 5,
              is_demo: false,
              demo_balance: 0
            });
            
            console.log('[verificationService] Auto-provisioned TradingAccount:', newAccount.id, 'for user:', vr.user_id);
            
            // Create USDT wallet only if none exists for this user
            const existingWallets = await base44.asServiceRole.entities.Wallet.filter({
              user_id: vr.user_id, currency: 'USDT', is_primary: true
            });
            
            if (!existingWallets?.length) {
              await base44.asServiceRole.entities.Wallet.create({
                trading_account_id: newAccount.id,
                user_id: vr.user_id,
                currency: 'USDT',
                network: 'TRC20',
                balance: 0,
                locked_balance: 0,
                staked_balance: 0,
                status: 'active',
                total_deposited: 0,
                total_withdrawn: 0,
                is_primary: true
              });
              console.log('[verificationService] Auto-provisioned USDT wallet for user:', vr.user_id);
            }
            
            // Notify user: Trading Account approved
            await base44.asServiceRole.entities.Notification.create({
              user_id: vr.user_id,
              type: 'system',
              title: 'Trading Account Approved! 🚀',
              message: 'Your live trading account has been approved and is ready to use. Deposit funds to start trading.',
              priority: 'high',
              read: false,
              data: { link: '/Wallet?page=deposit' }
            });
          }
        }
      } catch (provErr) {
        console.error('[verificationService] Auto-provision failed:', provErr.message);
        // Non-blocking — user is still verified even if provisioning fails
      }

      return Response.json({ ok: true, status: "approved" });
    }

    // ========== ADMIN REJECT ==========
    if (action === "adminReject") {
      if (user.role !== "admin") {
        return Response.json({ ok: false, error: "Admin only" }, { status: 403 });
      }

      const { requestId, reason } = body;
      if (!requestId) {
        return Response.json({ ok: false, error: "requestId required" });
      }

      // Get the request
      const requests = await base44.asServiceRole.entities.VerificationRequest.filter({ id: requestId });
      if (requests.length === 0) {
        return Response.json({ ok: false, error: "Request not found" });
      }
      const vr = requests[0];

      // Only reject KYC requests
      if (vr.request_type === "help") {
        return Response.json({ ok: false, error: "Cannot reject help requests - use adminRespond instead" });
      }

      // Update request
      await base44.asServiceRole.entities.VerificationRequest.update(requestId, {
        status: "rejected",
        rejection_reason: reason || "Verification declined",
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString()
      });

      // Update UserVerification
      const uvRecords = await base44.asServiceRole.entities.UserVerification.filter({ user_id: vr.user_id });
      if (uvRecords.length > 0) {
        await base44.asServiceRole.entities.UserVerification.update(uvRecords[0].id, {
          status: "rejected",
          current_request_id: requestId,
          rejection_reason: reason || "Verification declined",
          rejected_at: new Date().toISOString()
        });
      }

      // Notify all admins: KYC rejected
      try {
        const allUsersRej = await base44.asServiceRole.entities.User.list('-created_date', 200);
        const adminsRej = (allUsersRej || []).filter(u => u.role === 'admin');
        for (const admin of adminsRej) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: admin.id,
            type: 'kyc_rejected',
            title: `KYC Rejected: ${vr.full_name || vr.user_email}`,
            message: `${vr.user_email}'s KYC was rejected by ${user.email}. Reason: ${reason || 'No reason'}`,
            priority: 'normal',
            read: false,
            data: {
              verification_request_id: requestId,
              user_id: vr.user_id,
              user_email: vr.user_email,
              status: 'rejected',
              timestamp: new Date().toISOString(),
              link: `/OKXAdminHub?tab=verification&requestId=${requestId}`
            }
          });
        }
      } catch (e) {
        console.error('[verificationService] Failed to notify admins on reject:', e.message);
      }

      // Notify the user: KYC rejected
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_id: vr.user_id,
          type: 'kyc_rejected',
          title: 'Verification Update',
          message: reason || 'Your verification could not be completed. Please submit new documents.',
          priority: 'high',
          read: false,
          data: { link: '/Profile?tab=security&openVerification=true', status: 'rejected' }
        });
      } catch (e) {
        console.error('[verificationService] Failed to notify user on reject:', e.message);
      }

      return Response.json({ ok: true, status: "rejected" });
    }

    // ========== ADMIN RESPOND (for help requests) ==========
    if (action === "adminRespond") {
      if (user.role !== "admin") {
        return Response.json({ ok: false, error: "Admin only" }, { status: 403 });
      }

      const { requestId, response } = body;
      if (!requestId || !response) {
        return Response.json({ ok: false, error: "requestId and response required" });
      }

      // Get the request
      const requests = await base44.asServiceRole.entities.VerificationRequest.filter({ id: requestId });
      if (requests.length === 0) {
        return Response.json({ ok: false, error: "Request not found" });
      }

      // Update request with admin response
      await base44.asServiceRole.entities.VerificationRequest.update(requestId, {
        admin_response: response,
        admin_responded_at: new Date().toISOString(),
        reviewed_by: user.email,
        status: "under_review"
      });

      // NOTE: Do NOT change UserVerification status - help responses don't affect verification

      return Response.json({ ok: true, status: "responded" });
    }

    // ========== RUN CLEANUP (Admin Only) ==========
    if (action === "runCleanup") {
      if (user.role !== "admin") {
        return Response.json({ ok: false, error: "Admin only" }, { status: 403 });
      }

      const dryRun = body.dryRun === true;

      // Get all verification requests
      const allRequests = await base44.asServiceRole.entities.VerificationRequest.list("-created_date", 1000);
      
      // Group by user_id
      const byUser = {};
      for (const req of allRequests) {
        if (!byUser[req.user_id]) byUser[req.user_id] = [];
        byUser[req.user_id].push(req);
      }

      let kycSuperseded = 0;
      let uvCreated = 0;
      let uvUpdated = 0;
      const userSummaries = [];

      for (const [userId, requests] of Object.entries(byUser)) {
        // Separate KYC requests from help requests
        const kycRequests = requests.filter(r => 
          r.request_type === "kyc" || r.request_type === "full" || !r.request_type || r.request_type === "help_request"
        ).filter(r => r.request_type !== "help"); // Exclude pure help requests
        
        const helpRequests = requests.filter(r => r.request_type === "help");

        // Sort KYC by created_date desc
        kycRequests.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

        // Find best KYC status
        const approved = kycRequests.find(r => r.status === "approved");
        const pending = kycRequests.find(r => r.status === "pending" || r.status === "under_review" || r.status === "needs_help");
        const rejected = kycRequests.find(r => r.status === "rejected");

        let currentKycRequest = approved || pending || rejected || kycRequests[0];
        let finalStatus = "unverified";

        if (approved) {
          finalStatus = "verified";
          currentKycRequest = approved;
        } else if (pending) {
          finalStatus = "pending";
          currentKycRequest = pending;
        } else if (rejected) {
          finalStatus = "rejected";
          currentKycRequest = rejected;
        } else if (!currentKycRequest) {
          // No KYC requests at all
          continue;
        }

        // Mark other KYC requests as superseded (NOT help requests)
        for (const req of kycRequests) {
          if (req.id !== currentKycRequest.id && !req.is_superseded) {
            if (req.status === "pending" || req.status === "under_review") {
              if (!dryRun) {
                await base44.asServiceRole.entities.VerificationRequest.update(req.id, {
                  status: "superseded",
                  is_superseded: true
                });
              }
              kycSuperseded++;
            }
          }
        }

        // Ensure UserVerification exists and is correct
        const uvRecords = await base44.asServiceRole.entities.UserVerification.filter({ user_id: userId });
        if (uvRecords.length === 0) {
          if (!dryRun) {
            await base44.asServiceRole.entities.UserVerification.create({
              user_id: userId,
              user_email: currentKycRequest.user_email,
              full_name: currentKycRequest.full_name,
              status: finalStatus,
              current_request_id: currentKycRequest.id,
              verified_at: finalStatus === "verified" ? currentKycRequest.reviewed_at : null,
              verified_by: finalStatus === "verified" ? currentKycRequest.reviewed_by : null,
              rejection_reason: finalStatus === "rejected" ? currentKycRequest.rejection_reason : null
            });
          }
          uvCreated++;
        } else {
          // Update if status doesn't match
          const uv = uvRecords[0];
          if (uv.status !== finalStatus || uv.current_request_id !== currentKycRequest.id) {
            if (!dryRun) {
              await base44.asServiceRole.entities.UserVerification.update(uv.id, {
                status: finalStatus,
                current_request_id: currentKycRequest.id,
                verified_at: finalStatus === "verified" ? currentKycRequest.reviewed_at : null,
                verified_by: finalStatus === "verified" ? currentKycRequest.reviewed_by : null,
                rejection_reason: finalStatus === "rejected" ? currentKycRequest.rejection_reason : null
              });
            }
            uvUpdated++;
          }
        }

        userSummaries.push({
          user_id: userId,
          kyc_count: kycRequests.length,
          help_count: helpRequests.length,
          final_status: finalStatus,
          current_request_id: currentKycRequest.id
        });
      }

      return Response.json({
        ok: true,
        data: {
          dry_run: dryRun,
          users_processed: Object.keys(byUser).length,
          kyc_requests_superseded: kycSuperseded,
          user_verifications_created: uvCreated,
          user_verifications_updated: uvUpdated,
          user_summaries: userSummaries.slice(0, 20) // First 20 for review
        }
      });
    }

    // ========== ADMIN SET STATUS (Direct Override) ==========
    if (action === "adminSetStatus") {
      if (user.role !== "admin") {
        return Response.json({ ok: false, error: "Admin only" }, { status: 403 });
      }

      const { userId, newStatus, reason } = body;
      if (!userId || !newStatus) {
        return Response.json({ ok: false, error: "userId and newStatus required" });
      }

      const validStatuses = ["unverified", "pending", "verified", "rejected"];
      if (!validStatuses.includes(newStatus)) {
        return Response.json({ ok: false, error: "Invalid status" });
      }

      // Get or create UserVerification
      const uvRecords = await base44.asServiceRole.entities.UserVerification.filter({ user_id: userId });
      
      const updateData = {
        status: newStatus
      };

      if (newStatus === "verified") {
        updateData.verified_at = new Date().toISOString();
        updateData.verified_by = user.email;
        updateData.rejection_reason = null;
        updateData.rejected_at = null;
      } else if (newStatus === "rejected") {
        updateData.rejection_reason = reason || "Admin override";
        updateData.rejected_at = new Date().toISOString();
        updateData.verified_at = null;
        updateData.verified_by = null;
      } else if (newStatus === "unverified") {
        updateData.verified_at = null;
        updateData.verified_by = null;
        updateData.rejection_reason = null;
        updateData.rejected_at = null;
      }

      if (uvRecords.length === 0) {
        // Create new record
        const targetUser = await base44.asServiceRole.entities.User.filter({ id: userId });
        await base44.asServiceRole.entities.UserVerification.create({
          user_id: userId,
          user_email: targetUser[0]?.email || "",
          ...updateData
        });
      } else {
        // Update existing
        await base44.asServiceRole.entities.UserVerification.update(uvRecords[0].id, updateData);
      }

      return Response.json({ ok: true, status: newStatus });
    }

    return Response.json({ ok: false, error: "Unknown action" });

  } catch (error) {
    console.error("[verificationService] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});