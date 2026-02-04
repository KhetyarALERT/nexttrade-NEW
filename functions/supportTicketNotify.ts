import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Support Ticket Notification Handler
 * Triggered by entity automation when SupportTicket is created
 * Sends email notification to admin
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    
    // Handle entity automation payload
    const { event, data } = payload;
    
    if (!event || event.type !== 'create' || event.entity_name !== 'SupportTicket') {
      return Response.json({ ok: true, skipped: true, reason: 'Not a SupportTicket create event' });
    }
    
    if (!data) {
      return Response.json({ ok: true, skipped: true, reason: 'No data in payload' });
    }
    
    const ticket = data;
    
    // Build email content
    const subject = `[Support] New Ticket - ${ticket.category || 'General'} (${ticket.priority || 'normal'} priority)`;
    
    const body = `
New support ticket received:

User: ${ticket.user_email || 'Unknown'}
User ID: ${ticket.user_id || 'Unknown'}
Category: ${ticket.category || 'general'}
Priority: ${ticket.priority || 'normal'}
Page: ${ticket.page_route || 'Not specified'}

Message:
${ticket.message || 'No message'}

---
View in Admin Hub: /OKXAdminHub (Support tab)
    `.trim();
    
    // Send notification email to admin
    // Using the Core.SendEmail integration
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: 'support@nexttrade.exchange', // Admin email - could also be pulled from config
        subject,
        body,
        from_name: 'NextTrade Support System'
      });
    } catch (emailErr) {
      console.error('Failed to send admin notification email:', emailErr);
      // Don't fail the whole request if email fails
    }
    
    return Response.json({ 
      ok: true, 
      ticketId: ticket.id,
      notified: true 
    });
  } catch (error) {
    console.error('Support ticket notification error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});