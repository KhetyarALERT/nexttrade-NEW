import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Automation function: Triggered when VerificationRequest entity is updated
 * Handles KYC status changes and notifies users accordingly
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    // Entity automation payload structure
    const { event, data, old_data } = body;
    
    if (!event || !data) {
      return Response.json({ error: "Invalid automation payload" }, { status: 400 });
    }
    
    console.log(`Processing KYC event: ${event.type} for verification ${event.entity_id}`);
    
    // Only process update events where status changed
    if (event.type !== 'update') {
      return Response.json({ ok: true, message: "Skipped - not an update event" });
    }
    
    const oldStatus = old_data?.status;
    const newStatus = data?.status;
    
    // Skip if status didn't change
    if (oldStatus === newStatus) {
      return Response.json({ ok: true, message: "Skipped - status unchanged" });
    }
    
    console.log(`KYC status changed: ${oldStatus} -> ${newStatus} for user ${data.user_id}`);
    
    // Handle status transitions
    if (newStatus === 'approved') {
      // NOTE: Notifications are now handled by verificationService.adminApprove (single source).
      // This automation only handles referral attribution and marking as notified.
      console.log(`[processKycStatusChange] User ${data.user_id} verification approved - skipping notifications (handled by verificationService)`);
      
      // Process referral attribution for KYC approval
      try {
        await base44.asServiceRole.functions.invoke("referral", {
          action: "processKycApproval",
          userId: data.user_id
        });
        console.log(`Processed referral KYC approval for user ${data.user_id}`);
      } catch (e) {
        console.error("Failed to process referral KYC:", e);
      }
    } else if (newStatus === 'rejected') {
      // NOTE: Notifications handled by verificationService.adminReject
      console.log(`[processKycStatusChange] User ${data.user_id} verification rejected - skipping notifications (handled by verificationService)`);
    } else if (newStatus === 'under_review' && data.admin_response) {
      // NOTE: Notifications handled by verificationService.adminRespond / notifyAdminVerification
      console.log(`[processKycStatusChange] Help response for user ${data.user_id} - skipping notifications (handled by verificationService)`);
    }
    
    // Mark as notified
    try {
      await base44.asServiceRole.entities.VerificationRequest.update(event.entity_id, {
        user_notified: true
      });
    } catch (e) {
      console.error("Failed to mark as notified:", e);
    }
    
    return Response.json({ 
      ok: true, 
      message: `Processed KYC status change: ${oldStatus} -> ${newStatus}`,
      userId: data.user_id
    });
    
  } catch (error) {
    console.error("Error processing KYC status change:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});