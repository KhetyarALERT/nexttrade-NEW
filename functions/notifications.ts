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
      
      // Normalize response - some notifications may have data nested in 'data' field (legacy)
      const normalized = (notifications || []).map(n => {
        // If notification has nested data structure, flatten it
        if (n.data && typeof n.data === 'object' && n.data.user_id) {
          return {
            id: n.id,
            created_date: n.created_date,
            updated_date: n.updated_date,
            ...n.data
          };
        }
        return n;
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
      
      // Get the notification first
      const allNotifs = await base44.asServiceRole.entities.Notification.filter({
        id: notificationId
      });
      
      if (!allNotifs?.length) {
        return Response.json({ ok: false, error: 'Notification not found' }, { status: 404 });
      }
      
      const notif = allNotifs[0];
      // Check ownership - user_id can be at top level or inside data (legacy)
      const notifUserId = notif.user_id || notif.data?.user_id;
      if (notifUserId !== user.id) {
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
        // Handle legacy nested data structure
        const isUnread = notif.read === false || notif.data?.read === false;
        if (isUnread) {
          await base44.asServiceRole.entities.Notification.update(notif.id, { read: true });
        }
      }
      
      return Response.json({ ok: true, updated: (unread || []).length });
    }

    // GET UNREAD COUNT
    if (action === 'getUnreadCount') {
      const all = await base44.asServiceRole.entities.Notification.filter({
        user_id: user.id
      });
      
      // Count unread - handle legacy nested data structure
      const unreadCount = (all || []).filter(n => {
        const isRead = n.read === true || n.data?.read === true;
        return !isRead;
      }).length;
      
      return Response.json({ ok: true, count: unreadCount });
    }

    return Response.json({ ok: false, error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('[NOTIFICATIONS_ERROR]', error.message, error.stack);
    return Response.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
});