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
      // Update user's verification status
      try {
        console.log(`User ${data.user_id} verification approved`);
      } catch (e) {
        console.error("Failed to update user status:", e);
      }
      
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
      
      // Send notification to user
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_id: data.user_id,
          type: "system",
          title: "KYC Verified ✅",
          message: "Congratulations! Your identity verification has been approved. You now have full access to all platform features including withdrawals and higher limits.",
          priority: "high",
          read: false
        });
        console.log(`Created approval notification for user ${data.user_id}`);
      } catch (e) {
        console.error("Failed to create notification:", e);
      }
      
      // Send email notification
      if (data.user_email) {
        try {
          await base44.integrations.Core.SendEmail({
            to: data.user_email,
            subject: "Your Identity Verification is Approved! ✅",
            body: `
Hello ${data.full_name || "Valued User"},

Great news! Your identity verification has been approved.

You now have full access to all NextTrade features including:
• Withdrawals
• Higher trading limits
• Full account functionality

Start trading now at NextTrade.

Best regards,
The NextTrade Team
            `.trim()
          });
          console.log(`Sent approval email to ${data.user_email}`);
        } catch (e) {
          console.error("Failed to send email:", e);
        }
      }
    } else if (newStatus === 'rejected') {
      // Send rejection notification
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_id: data.user_id,
          type: "system",
          title: "Verification Update",
          message: data.rejection_reason || "Your verification could not be completed. Please submit new documents with clearer images.",
          priority: "high",
          read: false
        });
        console.log(`Created rejection notification for user ${data.user_id}`);
      } catch (e) {
        console.error("Failed to create notification:", e);
      }
      
      // Send email notification
      if (data.user_email) {
        try {
          await base44.integrations.Core.SendEmail({
            to: data.user_email,
            subject: "Identity Verification Update",
            body: `
Hello ${data.full_name || "Valued User"},

We've reviewed your identity verification submission.

Unfortunately, we were unable to verify your identity at this time.

${data.rejection_reason ? `Reason: ${data.rejection_reason}` : ""}

You can submit a new verification request with updated documents. Common issues include:
• Blurry or unclear document images
• Documents that don't match the information provided
• Expired documents

If you need help, please contact our support team.

Best regards,
The NextTrade Team
            `.trim()
          });
          console.log(`Sent rejection email to ${data.user_email}`);
        } catch (e) {
          console.error("Failed to send email:", e);
        }
      }
    } else if (newStatus === 'under_review' && data.admin_response) {
      // Admin responded to help request
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_id: data.user_id,
          type: "system",
          title: "KYC Help Response",
          message: data.admin_response,
          priority: "normal",
          read: false
        });
        console.log(`Created help response notification for user ${data.user_id}`);
      } catch (e) {
        console.error("Failed to create notification:", e);
      }
      
      // Send email notification
      if (data.user_email) {
        try {
          await base44.integrations.Core.SendEmail({
            to: data.user_email,
            subject: "Response to Your KYC Help Request",
            body: `
Hello ${data.full_name || "Valued User"},

Our team has responded to your verification help request.

Response:
"${data.admin_response}"

If you still need assistance, please don't hesitate to reach out.

Best regards,
The NextTrade Team
            `.trim()
          });
          console.log(`Sent help response email to ${data.user_email}`);
        } catch (e) {
          console.error("Failed to send email:", e);
        }
      }
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