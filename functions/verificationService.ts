import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Verification Service - Single Source of Truth for User Verification Status
 * 
 * Actions:
 * - getStatus: Get user's verification status from UserVerification
 * - submitKyc: Submit/update KYC (creates or updates pending request)
 * - adminApprove: Admin approves verification
 * - adminReject: Admin rejects verification
 * - runCleanup: One-time cleanup to fix duplicate requests (admin only)
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
      // Get current user's verification status
      const targetUserId = body.userId || user.id;
      
      // Only admin can query other users
      if (targetUserId !== user.id && user.role !== "admin") {
        return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }

      // Check UserVerification (single source of truth)
      const verifications = await base44.asServiceRole.entities.UserVerification.filter(
        { user_id: targetUserId }
      );

      if (verifications.length === 0) {
        // No record = unverified
        return Response.json({
          ok: true,
          data: {
            status: "unverified",
            exists: false
          }
        });
      }

      const uv = verifications[0];
      
      // Optionally load current request details
      let currentRequest = null;
      if (uv.current_request_id) {
        try {
          const requests = await base44.asServiceRole.entities.VerificationRequest.filter(
            { id: uv.current_request_id }
          );
          currentRequest = requests[0] || null;
        } catch (e) {
          // Ignore - request may have been deleted
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
      const { fullName, documentType, frontUrl, backUrl, selfieUrl, dateOfBirth, country, helpMessage, requestType } = body;

      // Get or create UserVerification record
      let uvRecords = await base44.asServiceRole.entities.UserVerification.filter({ user_id: user.id });
      let uv = uvRecords[0];

      // If already verified, block new submissions
      if (uv?.status === "verified") {
        return Response.json({
          ok: false,
          error: "Already verified",
          status: "already_verified"
        });
      }

      // Check for existing pending request
      const pendingRequests = await base44.asServiceRole.entities.VerificationRequest.filter({
        user_id: user.id,
        status: "pending"
      });

      let verificationRequest;

      if (pendingRequests.length > 0) {
        // UPDATE existing pending request (no duplicate)
        const existingRequest = pendingRequests[0];
        
        const updateData = {
          full_name: fullName || existingRequest.full_name,
          document_type: documentType || existingRequest.document_type,
          submitted_at: new Date().toISOString()
        };
        
        if (frontUrl) updateData.document_front_url = frontUrl;
        if (backUrl) updateData.document_back_url = backUrl;
        if (selfieUrl) updateData.selfie_url = selfieUrl;
        if (dateOfBirth) updateData.date_of_birth = dateOfBirth;
        if (country) updateData.country = country;
        if (helpMessage) {
          updateData.help_message = helpMessage;
          updateData.status = "needs_help";
          updateData.request_type = "help_request";
        }

        await base44.asServiceRole.entities.VerificationRequest.update(existingRequest.id, updateData);
        verificationRequest = { ...existingRequest, ...updateData };
      } else {
        // Create NEW request
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
          status: helpMessage ? "needs_help" : "pending",
          request_type: requestType || (helpMessage ? "help_request" : "full"),
          help_message: helpMessage,
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

      return Response.json({
        ok: true,
        data: {
          request_id: verificationRequest.id,
          status: "pending"
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

      // Update request
      await base44.asServiceRole.entities.VerificationRequest.update(requestId, {
        status: "approved",
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString()
      });

      // Mark any other pending requests for this user as superseded
      const otherRequests = await base44.asServiceRole.entities.VerificationRequest.filter({
        user_id: vr.user_id
      });
      for (const other of otherRequests) {
        if (other.id !== requestId && (other.status === "pending" || other.status === "under_review" || other.status === "needs_help")) {
          await base44.asServiceRole.entities.VerificationRequest.update(other.id, {
            status: "superseded",
            is_superseded: true
          });
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

      return Response.json({ ok: true, status: "rejected" });
    }

    // ========== RUN CLEANUP (Admin Only) ==========
    if (action === "runCleanup") {
      if (user.role !== "admin") {
        return Response.json({ ok: false, error: "Admin only" }, { status: 403 });
      }

      // Get all verification requests
      const allRequests = await base44.asServiceRole.entities.VerificationRequest.list("-created_date", 1000);
      
      // Group by user_id
      const byUser = {};
      for (const req of allRequests) {
        if (!byUser[req.user_id]) byUser[req.user_id] = [];
        byUser[req.user_id].push(req);
      }

      let fixed = 0;
      let created = 0;

      for (const [userId, requests] of Object.entries(byUser)) {
        // Sort by created_date desc
        requests.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

        // Find best status
        const approved = requests.find(r => r.status === "approved");
        const pending = requests.find(r => r.status === "pending" || r.status === "under_review" || r.status === "needs_help");
        const rejected = requests.find(r => r.status === "rejected");

        let currentRequest = approved || pending || rejected || requests[0];
        let finalStatus = "unverified";

        if (approved) {
          finalStatus = "verified";
          currentRequest = approved;
        } else if (pending) {
          finalStatus = "pending";
          currentRequest = pending;
        } else if (rejected) {
          finalStatus = "rejected";
          currentRequest = rejected;
        }

        // Mark others as superseded
        for (const req of requests) {
          if (req.id !== currentRequest.id && !req.is_superseded) {
            if (req.status === "pending" || req.status === "under_review" || req.status === "needs_help") {
              await base44.asServiceRole.entities.VerificationRequest.update(req.id, {
                status: "superseded",
                is_superseded: true
              });
              fixed++;
            }
          }
        }

        // Ensure UserVerification exists and is correct
        const uvRecords = await base44.asServiceRole.entities.UserVerification.filter({ user_id: userId });
        if (uvRecords.length === 0) {
          await base44.asServiceRole.entities.UserVerification.create({
            user_id: userId,
            user_email: currentRequest.user_email,
            full_name: currentRequest.full_name,
            status: finalStatus,
            current_request_id: currentRequest.id,
            verified_at: finalStatus === "verified" ? currentRequest.reviewed_at : null,
            verified_by: finalStatus === "verified" ? currentRequest.reviewed_by : null,
            rejection_reason: finalStatus === "rejected" ? currentRequest.rejection_reason : null
          });
          created++;
        } else {
          // Update if status doesn't match
          const uv = uvRecords[0];
          if (uv.status !== finalStatus || uv.current_request_id !== currentRequest.id) {
            await base44.asServiceRole.entities.UserVerification.update(uv.id, {
              status: finalStatus,
              current_request_id: currentRequest.id,
              verified_at: finalStatus === "verified" ? currentRequest.reviewed_at : null,
              verified_by: finalStatus === "verified" ? currentRequest.reviewed_by : null,
              rejection_reason: finalStatus === "rejected" ? currentRequest.rejection_reason : null
            });
            fixed++;
          }
        }
      }

      return Response.json({
        ok: true,
        data: {
          users_processed: Object.keys(byUser).length,
          requests_superseded: fixed,
          verifications_created: created
        }
      });
    }

    return Response.json({ ok: false, error: "Unknown action" });

  } catch (error) {
    console.error("[verificationService] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});