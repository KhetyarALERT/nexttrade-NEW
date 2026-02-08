import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Track user login:
 * 1. Update User.last_login_at
 * 2. Create admin notification (throttled: max 1 per user per 30 min)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date().toISOString();

    // 1. Update last_login_at on User entity
    try {
      await base44.asServiceRole.entities.User.update(user.id, {
        last_login_at: now
      });
    } catch (e) {
      console.error('[trackLogin] Failed to update last_login_at:', e.message);
    }

    // 2. Throttle check: find most recent user_login notification for this user
    // We check if one was created in last 30 minutes
    let shouldNotify = true;
    try {
      const recentNotifs = await base44.asServiceRole.entities.Notification.filter(
        { type: 'user_login' },
        '-created_date',
        50
      );
      // Find one for this specific user (check data.user_id)
      const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
      const recentForUser = (recentNotifs || []).find(n => {
        if (n.data?.login_user_id !== user.id) return false;
        const created = new Date(n.created_date).getTime();
        return created > thirtyMinAgo;
      });
      if (recentForUser) {
        shouldNotify = false;
        console.log('[trackLogin] Throttled: recent login notification exists for', user.email);
      }
    } catch (e) {
      console.error('[trackLogin] Throttle check failed:', e.message);
      // Proceed with notification on error
    }

    // 3. Create admin notification if not throttled
    if (shouldNotify) {
      try {
        // Get all admin users
        const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 200);
        const admins = (allUsers || []).filter(u => u.role === 'admin');

        const title = `User Login: ${user.full_name || user.email}`;
        const message = `${user.email} logged in at ${new Date(now).toLocaleString()}`;

        for (const admin of admins) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: admin.id,
            type: 'user_login',
            title,
            message,
            priority: 'low',
            read: false,
            data: {
              login_user_id: user.id,
              login_user_email: user.email,
              timestamp: now,
              link: `/OKXAdminHub?tab=users&userId=${user.id}`
            }
          });
        }
        console.log('[trackLogin] Created login notifications for', admins.length, 'admins');
      } catch (e) {
        console.error('[trackLogin] Failed to create admin notifications:', e.message);
      }
    }

    return Response.json({ ok: true, last_login_at: now, notified: shouldNotify });
  } catch (error) {
    console.error('[trackLogin] Error:', error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});