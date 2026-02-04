import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * createSupportTicket
 * Always succeeds for authenticated users.
 * Creates SupportTicket with clean fields and sends notifications to both admin and user.
 * 
 * Input:
 * - category: kyc | deposit | withdraw | trading | copy_trading | staking | rewards | general
 * - user_message: The actual user message only (not conversation history)
 * - source_route: Where the user was when creating ticket
 * - topic_route: The relevant page for this issue (optional)
 * - language: ar | en
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const { 
      category, 
      message,        // Legacy support
      user_message,   // Preferred: clean user message only
      route,          // Legacy support
      source_route,   // Where user was
      topic_route,    // Relevant page for issue
      language 
    } = payload;

    // Use user_message if provided, fall back to message
    const cleanMessage = (user_message || message || '').trim();
    
    if (!cleanMessage || cleanMessage.length === 0) {
      return Response.json({ ok: false, error: 'Message is required' }, { status: 400 });
    }

    // Valid categories
    const validCategories = ['kyc', 'deposit', 'withdraw', 'trading', 'copy_trading', 'staking', 'rewards', 'general'];
    const safeCategory = validCategories.includes(category) ? category : 'general';

    // Determine topic route based on category if not provided
    const resolvedTopicRoute = topic_route || getDefaultTopicRoute(safeCategory);
    const resolvedSourceRoute = source_route || route || null;

    // Create the ticket with service role
    const ticketData = {
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name || null,
      category: safeCategory,
      message: cleanMessage,
      source_route: resolvedSourceRoute,
      topic_route: resolvedTopicRoute,
      status: 'open',
      priority: 'normal',
    };

    const ticket = await base44.asServiceRole.entities.SupportTicket.create(ticketData);
    const ticketRef = `#${ticket.id.slice(-6).toUpperCase()}`;

    // Send admin notification email
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: 'admin@ruyaacapital.com',
        subject: `[Support] New Ticket ${ticketRef} - ${safeCategory.toUpperCase()}`,
        body: `
New support ticket received.

Reference: ${ticketRef}
User: ${user.full_name || 'N/A'} (${user.email})
Category: ${safeCategory}
Source Page: ${resolvedSourceRoute || 'Not specified'}
Topic Page: ${resolvedTopicRoute || 'Not specified'}
Language: ${language || 'en'}

---
USER MESSAGE:
${cleanMessage}
---

View in Admin Hub → Support Tickets tab
        `.trim(),
        from_name: 'NextTrade Support'
      });
    } catch (emailErr) {
      console.error('Failed to send admin notification:', emailErr);
    }

    // Send user confirmation email
    try {
      const isArabic = language === 'ar';
      const subject = isArabic 
        ? `تم استلام تذكرتك ${ticketRef}` 
        : `Your Support Ticket ${ticketRef} Received`;
      
      const body = isArabic
        ? `
مرحباً ${user.full_name || ''},

تم استلام تذكرة الدعم الخاصة بك بنجاح.

رقم التذكرة: ${ticketRef}
الموضوع: ${getCategoryLabel(safeCategory, 'ar')}

رسالتك:
"${cleanMessage.substring(0, 200)}${cleanMessage.length > 200 ? '...' : ''}"

سيقوم فريقنا بمراجعة طلبك والرد عليك خلال 24 ساعة.

مع تحيات،
فريق دعم NextTrade
        `.trim()
        : `
Hi ${user.full_name || ''},

Your support ticket has been received.

Ticket Reference: ${ticketRef}
Category: ${getCategoryLabel(safeCategory, 'en')}

Your message:
"${cleanMessage.substring(0, 200)}${cleanMessage.length > 200 ? '...' : ''}"

Our team will review your request and respond within 24 hours.

Best regards,
NextTrade Support Team
        `.trim();

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: user.email,
        subject,
        body,
        from_name: 'NextTrade Support'
      });
    } catch (emailErr) {
      console.error('Failed to send user confirmation:', emailErr);
    }

    return Response.json({
      ok: true,
      ticket_id: ticket.id,
      reference: ticketRef,
    });
  } catch (error) {
    console.error('createSupportTicket error:', error);
    console.error('Error data:', error.data || error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});

// Helper: Get default topic route based on category
function getDefaultTopicRoute(category) {
  const routes = {
    kyc: '/Profile?tab=security',
    deposit: '/Wallet?page=deposit',
    withdraw: '/Wallet',
    trading: '/Futures',
    copy_trading: '/Futures?tab=bots',
    staking: '/Investing',
    rewards: '/Rewards',
    general: null,
  };
  return routes[category] || null;
}

// Helper: Get category label for emails
function getCategoryLabel(category, lang) {
  const labels = {
    kyc: { en: 'Identity Verification (KYC)', ar: 'التحقق من الهوية' },
    deposit: { en: 'Deposit', ar: 'الإيداع' },
    withdraw: { en: 'Withdrawal', ar: 'السحب' },
    trading: { en: 'Trading', ar: 'التداول' },
    copy_trading: { en: 'Copy Trading', ar: 'نسخ التداول' },
    staking: { en: 'Staking', ar: 'الستيكينغ' },
    rewards: { en: 'Rewards', ar: 'المكافآت' },
    general: { en: 'General Support', ar: 'دعم عام' },
  };
  return labels[category]?.[lang] || labels.general[lang];
}