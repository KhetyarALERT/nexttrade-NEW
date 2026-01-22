import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    // Handle entity automation payload format: { event, data, old_data }
    // OR manual call format: { action, verificationId }
    const { action, verificationId, event, data } = body;
    
    // If triggered by entity automation (create event)
    if (event && event.type === 'create' && data) {
      console.log(`Processing new verification request from automation: ${event.entity_id}`);
      
      const verification = data;
      const isHelpRequest = verification.request_type === "help_request" || verification.status === "needs_help";
      const subject = isHelpRequest 
        ? `[HELP NEEDED] KYC Help Request - ${verification.full_name || verification.user_email}`
        : `[ACTION REQUIRED] New KYC Verification Request - ${verification.full_name || 'New User'}`;

      let emailBody = "";
      if (isHelpRequest) {
        emailBody = `
A user needs help with their identity verification.

User Details:
- Name: ${verification.full_name || "Not provided"}
- Email: ${verification.user_email || "N/A"}
- User ID: ${verification.user_id}
- Requested: ${new Date(verification.help_requested_at || verification.created_date).toLocaleString()}

Help Message:
"${verification.help_message || "No message provided"}"

Document (if attached):
- Front: ${verification.document_front_url || "Not attached"}

Please respond to this user in the admin dashboard.

---
NextTrade Platform
        `.trim();
      } else {
        emailBody = `
A new identity verification request has been submitted.

User Details:
- Name: ${verification.full_name || "Not provided"}
- Email: ${verification.user_email || "N/A"}
- Country: ${verification.country || "N/A"}
- Document Type: ${verification.document_type || "N/A"}
- Submitted: ${new Date(verification.submitted_at || verification.created_date).toLocaleString()}

Document URLs:
- Front: ${verification.document_front_url || "Not provided"}
- Back: ${verification.document_back_url || "Not provided"}
- Selfie: ${verification.selfie_url || "Not provided"}

Please review this request in the admin dashboard.

---
NextTrade Platform
        `.trim();
      }

      // Send to registered admin user email
      try {
        await base44.integrations.Core.SendEmail({
          to: "admin@ruyaacapital.com",
          subject,
          body: emailBody,
        });
        console.log("Admin notification email sent successfully");
      } catch (emailErr) {
        console.error("Failed to send admin email:", emailErr);
        // Don't fail the whole function if email fails
      }

      return Response.json({ success: true, message: "Admin notified via automation" });
    }

    // Action: notifyAdmin - Manual call to notify admin
    if (action === "notifyAdmin") {
      if (!verificationId) {
        return Response.json({ error: "Missing verificationId" }, { status: 400 });
      }

      const verification = await base44.asServiceRole.entities.VerificationRequest.get(verificationId);
      if (!verification) {
        return Response.json({ error: "Verification not found" }, { status: 404 });
      }

      const isHelpRequest = verification.request_type === "help_request" || verification.status === "needs_help";
      const subject = isHelpRequest 
        ? `[HELP NEEDED] KYC Help Request - ${verification.full_name || verification.user_email}`
        : `[ACTION REQUIRED] New KYC Verification Request - ${verification.full_name}`;

      let emailBody = "";
      if (isHelpRequest) {
        emailBody = `
A user needs help with their identity verification.

User Details:
- Name: ${verification.full_name || "Not provided"}
- Email: ${verification.user_email || "N/A"}
- User ID: ${verification.user_id}
- Requested: ${new Date(verification.help_requested_at || verification.created_date).toLocaleString()}

Help Message:
"${verification.help_message || "No message provided"}"

Document (if attached):
- Front: ${verification.document_front_url || "Not attached"}

Please respond to this user in the admin dashboard.

---
NextTrade Platform
        `.trim();
      } else {
        emailBody = `
A new identity verification request has been submitted.

User Details:
- Name: ${verification.full_name}
- Email: ${verification.user_email || "N/A"}
- Country: ${verification.country || "N/A"}
- Document Type: ${verification.document_type}
- Submitted: ${new Date(verification.submitted_at || verification.created_date).toLocaleString()}

Document URLs:
- Front: ${verification.document_front_url || "Not provided"}
- Back: ${verification.document_back_url || "Not provided"}
- Selfie: ${verification.selfie_url || "Not provided"}

Please review this request in the admin dashboard.

---
NextTrade Platform
        `.trim();
      }

      try {
        await base44.integrations.Core.SendEmail({
          to: "admin@ruyaacapital.com",
          subject,
          body: emailBody,
        });
      } catch (emailErr) {
        console.error("Failed to send admin email:", emailErr);
      }

      return Response.json({ success: true, message: "Admin notified" });
    }

    // Action: notifyUser - Notify user of verification status change
    if (action === "notifyUser") {
      if (!verificationId) {
        return Response.json({ error: "Missing verificationId" }, { status: 400 });
      }

      const verification = await base44.asServiceRole.entities.VerificationRequest.get(verificationId);
      if (!verification) {
        return Response.json({ error: "Verification not found" }, { status: 404 });
      }

      const userEmail = verification.user_email;
      if (!userEmail) {
        return Response.json({ error: "User email not found" }, { status: 400 });
      }

      let subject = "";
      let emailBody = "";

      if (verification.status === "approved") {
        subject = "Your Identity Verification is Approved! ✅";
        emailBody = `
Hello ${verification.full_name || "Valued User"},

Great news! Your identity verification has been approved.

You now have full access to all NextTrade features including:
- Withdrawals
- Higher trading limits
- Full account functionality

Start trading now at NextTrade.

Best regards,
The NextTrade Team
        `.trim();

        // Update user's verification status
        if (verification.user_id) {
          try {
            await base44.asServiceRole.auth.updateUser(verification.user_id, {
              verification_status: "verified",
              verification_request_id: verification.id,
              verification_completed_at: new Date().toISOString()
            });
          } catch (e) {
            console.error("Failed to update user verification status:", e);
          }
        }

        // Create in-app notification
        try {
          await base44.asServiceRole.entities.Notification.create({
            user_id: verification.user_id,
            type: "system",
            title: "KYC Verified ✅",
            message: "Your identity verification has been approved! You now have full access to all features.",
            priority: "high",
            read: false
          });
        } catch (e) {
          console.error("Failed to create notification:", e);
        }

      } else if (verification.status === "rejected") {
        subject = "Identity Verification Update";
        emailBody = `
Hello ${verification.full_name || "Valued User"},

We've reviewed your identity verification submission.

Unfortunately, we were unable to verify your identity at this time.

${verification.rejection_reason ? `Reason: ${verification.rejection_reason}` : ""}

You can submit a new verification request with updated documents. Common issues include:
- Blurry or unclear document images
- Documents that don't match the information provided
- Expired documents

If you need help, please contact our support team.

Best regards,
The NextTrade Team
        `.trim();

        // Update user's verification status
        if (verification.user_id) {
          try {
            await base44.asServiceRole.auth.updateUser(verification.user_id, {
              verification_status: "rejected",
              verification_request_id: verification.id
            });
          } catch (e) {
            console.error("Failed to update user verification status:", e);
          }
        }

        // Create in-app notification
        try {
          await base44.asServiceRole.entities.Notification.create({
            user_id: verification.user_id,
            type: "system",
            title: "Verification Update",
            message: verification.rejection_reason || "Your verification could not be completed. Please try again with clearer documents.",
            priority: "high",
            read: false
          });
        } catch (e) {
          console.error("Failed to create notification:", e);
        }

      } else if (verification.admin_response) {
        subject = "Response to Your KYC Help Request";
        emailBody = `
Hello ${verification.full_name || "Valued User"},

Our team has responded to your verification help request.

Response:
"${verification.admin_response}"

If you still need assistance, please don't hesitate to reach out.

Best regards,
The NextTrade Team
        `.trim();

        // Create in-app notification
        try {
          await base44.asServiceRole.entities.Notification.create({
            user_id: verification.user_id,
            type: "system",
            title: "KYC Help Response",
            message: verification.admin_response,
            priority: "normal",
            read: false
          });
        } catch (e) {
          console.error("Failed to create notification:", e);
        }
      }

      if (subject && emailBody) {
        await base44.integrations.Core.SendEmail({
          to: userEmail,
          subject,
          body: emailBody,
        });

        // Mark user as notified
        await base44.asServiceRole.entities.VerificationRequest.update(verificationId, {
          user_notified: true
        });
      }

      return Response.json({ success: true, message: "User notified" });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in notification function:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});