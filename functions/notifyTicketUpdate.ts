import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * notifyTicketUpdate
 * Called after admin updates a ticket (status change or response).
 * Sends email notification to the ticket user.
 * 
 * Input:
 * - ticket_id: The ticket ID to notify about
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const adminUser = await base44.auth.me();

    if (!adminUser || adminUser.role !== 'admin') {
      return Response.json({ ok: false, error: 'Admin access required' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const { ticket_id } = payload;

    if (!ticket_id) {
      return Response.json({ ok: false, error: 'ticket_id is required' }, { status: 400 });
    }

    // Get the ticket
    const tickets = await base44.asServiceRole.entities.SupportTicket.filter({ id: ticket_id });
    if (!tickets || tickets.length === 0) {
      return Response.json({ ok: false, error: 'Ticket not found' }, { status: 404 });
    }

    const ticket = tickets[0];
    const ticketRef = `#${ticket.id.slice(-6).toUpperCase()}`;

    // Get user preferences for language
    let userLang = 'en';
    try {
      const prefs = await base44.asServiceRole.entities.UserPreferences.filter({ user_id: ticket.user_id });
      if (prefs?.length > 0 && prefs[0].language) {
        userLang = prefs[0].language;
      }
    } catch {
      // Default to English
    }

    const isArabic = userLang === 'ar';
    const statusLabel = getStatusLabel(ticket.status, userLang);

    // Build email content
    let subject, body;
    
    if (ticket.status === 'closed') {
      subject = isArabic 
        ? `تم إغلاق تذكرتك ${ticketRef}`
        : `Your Ticket ${ticketRef} Has Been Resolved`;
    } else {
      subject = isArabic
        ? `تحديث على تذكرتك ${ticketRef}`
        : `Update on Your Ticket ${ticketRef}`;
    }

    body = isArabic
      ? `
مرحباً ${ticket.user_name || ''},

تم تحديث تذكرة الدعم الخاصة بك.

رقم التذكرة: ${ticketRef}
الحالة: ${statusLabel}
${ticket.admin_response ? `
---
رد فريق الدعم:
${ticket.admin_response}
---
` : ''}
إذا كان لديك أي استفسارات إضافية، يمكنك الرد على هذه الرسالة أو فتح تذكرة جديدة من خلال التطبيق.

مع تحيات،
فريق دعم NextTrade
      `.trim()
      : `
Hi ${ticket.user_name || ''},

Your support ticket has been updated.

Ticket Reference: ${ticketRef}
Status: ${statusLabel}
${ticket.admin_response ? `
---
Support Team Response:
${ticket.admin_response}
---
` : ''}
If you have any further questions, you can reply to this email or open a new ticket through the app.

Best regards,
NextTrade Support Team
      `.trim();

    // Send email to user
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: ticket.user_email,
      subject,
      body,
      from_name: 'NextTrade Support'
    });

    // Log the notification
    console.log(`Ticket update notification sent: ${ticketRef} -> ${ticket.user_email}`);

    return Response.json({
      ok: true,
      notified: ticket.user_email,
      ticket_ref: ticketRef,
    });
  } catch (error) {
    console.error('notifyTicketUpdate error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});

function getStatusLabel(status, lang) {
  const labels = {
    open: { en: 'Open', ar: 'مفتوحة' },
    in_progress: { en: 'In Progress', ar: 'قيد المعالجة' },
    closed: { en: 'Resolved', ar: 'تم الحل' },
  };
  return labels[status]?.[lang] || labels.open[lang];
}
// Trigger redeploy