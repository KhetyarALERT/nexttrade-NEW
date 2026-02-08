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
      // Note: Entity stores properties in 'data' field, so we query 'data.user_id'
      // Query by user_id (top-level entity field, not nested data)
      const notifications = await base44.asServiceRole.entities.Notification.filter(
        { user_id: user.id },
        '-created_date',
        limit + skip
      );
      
      console.log('[NOTIFICATIONS] Found', notifications?.length || 0, 'notifications for user', user.id);
      
      // Normalize response - raw response has props at top level: {read, type, title, message, priority, user_id, data: {...extra}}
      const normalized = (notifications || []).map(n => {
        return {
          id: n.id,
          created_date: n.created_date,
          updated_date: n.updated_date,
          user_id: n.user_id,
          type: n.type,
          title: n.title,
          message: n.message,
          read: n.read ?? false,
          priority: n.priority || 'normal',
          data: n.data || null
        };
      });
      
      const result = normalized.slice(skip, skip + limit);
      return Response.json({ ok: true, data: result });
    }

    // MARK SINGLE NOTIFICATION AS READ
    if (action === 'markRead') {
      const { notificationId } = params;
      
      if (!notificationId) {
        return Response.json({ ok: false, error: 'notificationId required' }, { status: 400 });
      }
      
      // Verify notification belongs to user
      // Note: Can't filter by id + data.user_id together easily, so get notification and verify
      let notification;
      try {
        notification = await base44.asServiceRole.entities.Notification.get(notificationId);
      } catch (e) {
        notification = null;
      }
      
      if (!notification || notification.user_id !== user.id) {
        return Response.json({ ok: false, error: 'Notification not found' }, { status: 404 });
      }
      
      const notifications = [notification];
      
      if (!notifications?.length) {
        return Response.json({ ok: false, error: 'Notification not found' }, { status: 404 });
      }
      
      await base44.asServiceRole.entities.Notification.update(notificationId, { read: true });
      
      return Response.json({ ok: true });
    }

    // MARK ALL NOTIFICATIONS AS READ
    if (action === 'markAllRead') {
      // Get all unread notifications for user
      // Note: filter by user_id, then filter read=false in code since DB stores in nested data field
      const allUserNotifs = await base44.asServiceRole.entities.Notification.filter({
        user_id: user.id
      });
      const unread = (allUserNotifs || []).filter(n => n.read === false);
      
      // Mark each as read
      for (const notif of (unread || [])) {
        await base44.asServiceRole.entities.Notification.update(notif.id, { read: true });
      }
      
      return Response.json({ ok: true, updated: (unread || []).length });
    }

    // GET UNREAD COUNT
    if (action === 'getUnreadCount') {
      const allUserNotifs = await base44.asServiceRole.entities.Notification.filter({
        user_id: user.id
      });
      const unreadCount = (allUserNotifs || []).filter(n => n.read === false).length;
      
      return Response.json({ ok: true, count: unreadCount });
    }

    return Response.json({ ok: false, error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('[NOTIFICATIONS_ERROR]', error.message, error.stack);
    return Response.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
});