import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Notifications backend function
 * Handles notification list, mark read, mark all read
 * Uses asServiceRole to bypass RLS issues (notifications are created by service role)
 * Security: All operations are scoped to the authenticated user's ID
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const { action, ...params } = body;
    
    console.log('[NOTIFICATIONS]', { action, userId: user.id });

    // LIST USER'S NOTIFICATIONS
    if (action === 'list') {
      const { limit = 50, skip = 0 } = params;
      
      // Use asServiceRole because notifications are created by service role
      // which sets created_by to service email, not user email
      // Security: we filter by user_id which is the authenticated user
      const notifications = await base44.asServiceRole.entities.Notification.filter(
        { user_id: user.id },
        '-created_date',
        limit + skip
      );
      
      const result = (notifications || []).slice(skip, skip + limit);
      return Response.json({ ok: true, data: result });
    }

    // MARK SINGLE NOTIFICATION AS READ
    if (action === 'markRead') {
      const { notificationId } = params;
      
      if (!notificationId) {
        return Response.json({ ok: false, error: 'notificationId required' }, { status: 400 });
      }
      
      // Verify notification belongs to user
      const notifications = await base44.asServiceRole.entities.Notification.filter({
        id: notificationId,
        user_id: user.id
      });
      
      if (!notifications?.length) {
        return Response.json({ ok: false, error: 'Notification not found' }, { status: 404 });
      }
      
      await base44.asServiceRole.entities.Notification.update(notificationId, { read: true });
      
      return Response.json({ ok: true });
    }

    // MARK ALL NOTIFICATIONS AS READ
    if (action === 'markAllRead') {
      // Get all unread notifications for user
      const unread = await base44.asServiceRole.entities.Notification.filter({
        user_id: user.id,
        read: false
      });
      
      // Mark each as read
      for (const notif of (unread || [])) {
        await base44.asServiceRole.entities.Notification.update(notif.id, { read: true });
      }
      
      return Response.json({ ok: true, updated: (unread || []).length });
    }

    // GET UNREAD COUNT
    if (action === 'getUnreadCount') {
      const unread = await base44.asServiceRole.entities.Notification.filter({
        user_id: user.id,
        read: false
      });
      
      return Response.json({ ok: true, count: (unread || []).length });
    }

    return Response.json({ ok: false, error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('[NOTIFICATIONS_ERROR]', error.message, error.stack);
    return Response.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
});