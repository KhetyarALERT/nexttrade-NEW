import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * createSupportTicket
 * Always succeeds for authenticated users.
 * Creates SupportTicket with required fields and triggers notification.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const { category, message, route, language } = payload;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return Response.json({ ok: false, error: 'Message is required' }, { status: 400 });
    }

    // Valid categories
    const validCategories = ['kyc', 'deposit', 'withdraw', 'trading', 'copy_trading', 'staking', 'rewards', 'general'];
    const safeCategory = validCategories.includes(category) ? category : 'general';

    // Create the ticket with service role (RLS create rule is strict)
    const ticketData = {
      user_id: user.id,
      user_email: user.email,
      category: safeCategory,
      message: message.trim(),
      page_route: route || null,
      status: 'open',
      priority: 'normal',
    };

    // Use service role to bypass RLS create restrictions
    // This is safe because we've already authenticated the user
    const ticket = await base44.asServiceRole.entities.SupportTicket.create(ticketData);

    // The entity automation will trigger supportTicketNotify automatically
    // But we can also call it directly for immediate notification
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: 'support@nexttrade.exchange',
        subject: `[Support] New Ticket - ${safeCategory} (#${ticket.id.slice(-6)})`,
        body: `
New support ticket received:

User: ${user.email}
User ID: ${user.id}
Category: ${safeCategory}
Page: ${route || 'Not specified'}
Language: ${language || 'en'}

Message:
${message.trim()}

---
View in Admin Hub: /OKXAdminHub (Support Tickets tab)
        `.trim(),
        from_name: 'NextTrade Support System'
      });
    } catch (emailErr) {
      console.error('Failed to send notification email:', emailErr);
      // Don't fail - ticket was created
    }

    return Response.json({
      ok: true,
      ticket_id: ticket.id,
      reference: `#${ticket.id.slice(-6).toUpperCase()}`,
    });
  } catch (error) {
    console.error('createSupportTicket error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});