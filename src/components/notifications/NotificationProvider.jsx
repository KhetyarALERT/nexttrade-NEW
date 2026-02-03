import { createContext, useContext, useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Bell, TrendingUp, AlertTriangle, CheckCircle, Wallet, Lock, Info } from "lucide-react";

const NotificationContext = createContext(null);

const NOTIFICATION_ICONS = {
  price_alert: TrendingUp,
  trade_executed: TrendingUp,
  trade_closed: CheckCircle,
  margin_warning: AlertTriangle,
  liquidation_warning: AlertTriangle,
  deposit_confirmed: Wallet,
  withdrawal_confirmed: Wallet,
  withdrawal_failed: AlertTriangle,
  staking_reward: Lock,
  system: Info
};

const NOTIFICATION_COLORS = {
  price_alert: "text-blue-500",
  trade_executed: "text-emerald-500",
  trade_closed: "text-emerald-500",
  margin_warning: "text-amber-500",
  liquidation_warning: "text-red-500",
  deposit_confirmed: "text-emerald-500",
  withdrawal_confirmed: "text-emerald-500",
  withdrawal_failed: "text-red-500",
  staking_reward: "text-purple-500",
  system: "text-slate-500"
};

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState(null);
  const [timezone, setTimezone] = useState("UTC");
  const [loading, setLoading] = useState(true);

  const normalizeTimeZone = useCallback((tz) => {
    if (!tz) return null;
    const raw = String(tz).trim();
    if (!raw) return null;

    // Common label-to-IANA fallbacks (in case a label was stored by mistake).
    const lower = raw.toLowerCase();
    const map = {
      dubai: "Asia/Dubai",
      uae: "Asia/Dubai",
      "united arab emirates": "Asia/Dubai",
      "gmt+4": "Asia/Dubai",
      "utc+4": "Asia/Dubai",
    };
    const candidate = map[lower] || raw;

    try {
      // Validate timeZone string.
      Intl.DateTimeFormat(undefined, { timeZone: candidate }).format(new Date());
      return candidate;
    } catch {
      return null;
    }
  }, []);

  // Auto-detect timezone
  useEffect(() => {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(normalizeTimeZone(detectedTimezone) || "UTC");
  }, [normalizeTimeZone]);

  // Load preferences and notifications
  const loadData = useCallback(async () => {
    try {
      // Use cached user if possible to avoid extra auth calls
      // base44.auth.me() usually hits the server. 
      // We can rely on the fact that if we are here, we might be logged in, 
      // but let's just make sure we don't spam if not logged in.
      // Better: check authentication state from context if available, but we are inside the provider.
      // We'll proceed but safeguard against excessive calls.
      const user = await base44.auth.me();
      if (!user) return;

      // Load or create preferences
      const prefsResult = await base44.entities.UserPreferences.filter({ user_id: user.id });
      if (prefsResult?.length) {
        setPreferences(prefsResult[0]);
        if (prefsResult[0].timezone) {
          const normalized = normalizeTimeZone(prefsResult[0].timezone);
          setTimezone(normalized || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
        }
      } else {
        // Create default preferences with auto-detected timezone
        // Wrapped in try-catch to handle 403 permission errors gracefully
        const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        try {
          const newPrefs = await base44.entities.UserPreferences.create({
            user_id: user.id,
            timezone: detectedTz,
            timezone_auto_detected: true,
            notifications_enabled: true,
            notify_price_alerts: true,
            notify_trade_executions: true,
            notify_margin_warnings: true,
            notify_deposits: true,
            notify_withdrawals: true,
            notify_staking: true,
            price_alerts: []
          });
          setPreferences(newPrefs);
        } catch (createErr) {
          // 403 = RLS permission denied - user may not have create rights yet
          // Silently ignore and use defaults, don't trigger rerenders
          console.warn("[NotificationProvider] Could not create UserPreferences (may be RLS):", createErr?.message);
          setPreferences({
            user_id: user.id,
            timezone: detectedTz,
            notifications_enabled: true,
            notify_price_alerts: true,
            notify_trade_executions: true,
            notify_margin_warnings: true,
            notify_deposits: true,
            notify_withdrawals: true,
            notify_staking: true,
            price_alerts: []
          });
        }
        setTimezone(normalizeTimeZone(detectedTz) || "UTC");
      }

      // Load notifications
      const notifs = await base44.asServiceRole.entities.Notification.filter(
        { user_id: user.id },
        '-created_date',
        50
      );
      setNotifications(notifs || []);
      setUnreadCount(notifs?.filter(n => !n.read).length || 0);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [normalizeTimeZone]);

  useEffect(() => {
    loadData();
    // Poll for new notifications every 2 minutes to reduce load
    const interval = setInterval(loadData, 120000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Show toast notification
  const showToast = useCallback((notification) => {
    const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
    const color = NOTIFICATION_COLORS[notification.type] || "text-slate-500";
    
    toast(notification.title, {
      description: notification.message,
      icon: <Icon className={`w-5 h-5 ${color}`} />,
      duration: notification.priority === 'urgent' ? 10000 : 5000
    });
  }, []);

  // Create notification
  const createNotification = useCallback(async (data) => {
    try {
      const user = await base44.auth.me();
      if (!user) return;

      // Check preferences
      if (preferences && !preferences.notifications_enabled) return;
      
      const typePrefs = {
        price_alert: preferences?.notify_price_alerts,
        trade_executed: preferences?.notify_trade_executions,
        trade_closed: preferences?.notify_trade_executions,
        margin_warning: preferences?.notify_margin_warnings,
        liquidation_warning: preferences?.notify_margin_warnings,
        deposit_confirmed: preferences?.notify_deposits,
        withdrawal_confirmed: preferences?.notify_withdrawals,
        withdrawal_failed: preferences?.notify_withdrawals,
        staking_reward: preferences?.notify_staking
      };

      if (typePrefs[data.type] === false) return;

      const notification = await base44.entities.Notification.create({
        user_id: user.id,
        ...data,
        read: false
      });

      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      showToast(notification);

      return notification;
    } catch (err) {
      console.error("Failed to create notification:", err);
    }
  }, [preferences, showToast]);

  // Mark as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await base44.asServiceRole.entities.Notification.update(notificationId, { read: true });
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => 
        base44.asServiceRole.entities.Notification.update(n.id, { read: true })
      ));
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  }, [notifications]);

  // Update preferences
  const updatePreferences = useCallback(async (updates) => {
    try {
      if (!preferences) return;
      await base44.entities.UserPreferences.update(preferences.id, updates);
      setPreferences(prev => ({ ...prev, ...updates }));
      if (updates.timezone) {
        const normalized = normalizeTimeZone(updates.timezone);
        setTimezone(normalized || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      }
    } catch (err) {
      console.error("Failed to update preferences:", err);
    }
  }, [preferences, normalizeTimeZone]);

  // Format date in user's timezone
  const formatDate = useCallback((date, options = {}) => {
    const d = new Date(date);
    const safeTz = normalizeTimeZone(timezone) || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    try {
      return d.toLocaleString(undefined, {
        timeZone: safeTz,
        ...options
      });
    } catch {
      return d.toLocaleString(undefined, { ...options });
    }
  }, [timezone, normalizeTimeZone]);

  const value = {
    notifications,
    unreadCount,
    preferences,
    timezone,
    loading,
    createNotification,
    markAsRead,
    markAllAsRead,
    updatePreferences,
    formatDate,
    refresh: loadData
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

NotificationProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}