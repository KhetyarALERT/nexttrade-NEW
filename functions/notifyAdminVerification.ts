import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { verificationId } = body;

    if (!verificationId) {
      return Response.json({ error: "Missing verificationId" }, { status: 400 });
    }

    // Get the verification request
    const verification = await base44.asServiceRole.entities.VerificationRequest.get(verificationId);
    if (!verification) {
      return Response.json({ error: "Verification not found" }, { status: 404 });
    }

    // Send email notification to admin
    await base44.integrations.Core.SendEmail({
      to: "admin@nexttrade.exchange",
      subject: `[ACTION REQUIRED] New KYC Verification Request - ${verification.full_name}`,
      body: `
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
      `.trim(),
    });

    return Response.json({ success: true, message: "Admin notified" });
  } catch (error) {
    console.error("Error notifying admin:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});