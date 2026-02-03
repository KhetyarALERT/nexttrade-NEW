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
      // Check if authenticated first to avoid unnecessary calls
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        setLoading(false);
        return;
      }
      
      const user = await base44.auth.me();
      if (!user) {
        setLoading(false);
        return;
      }

      // Load preferences - use filter with user_id
      let prefsResult = [];
      try {
        prefsResult = await base44.entities.UserPreferences.filter({ user_id: user.id });
      } catch (prefsErr) {
        // RLS might block - use defaults
        console.warn("[NotificationProvider] Could not load preferences:", prefsErr?.message);
      }
      
      if (prefsResult?.length) {
        setPreferences(prefsResult[0]);
        if (prefsResult[0].timezone) {
          const normalized = normalizeTimeZone(prefsResult[0].timezone);
          setTimezone(normalized || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
        }
      } else {
        // No preferences found - use defaults (don't try to create, admin/service creates them)
        const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
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
        setTimezone(normalizeTimeZone(detectedTz) || "UTC");
      }

      // Load notifications via backend function to bypass RLS issues
      // (notifications created by service role have service email as created_by)
      try {
        const notifsRes = await base44.functions.invoke("notifications", { action: "list", limit: 50 });
        // Axios response - data is in notifsRes.data
        const responseData = notifsRes?.data;
        if (responseData?.ok) {
          const notifs = responseData.data || [];
          setNotifications(notifs);
          setUnreadCount(notifs.filter(n => !n.read).length || 0);
        } else {
          // Server returned ok: false - this is normal if user has no notifications
          // Don't log as warning unless there's actually an error message
          if (responseData?.error) {
            console.warn("[NotificationProvider] Server returned error:", responseData.error);
          }
          setNotifications([]);
          setUnreadCount(0);
        }
      } catch (notifErr) {
        // Network or other error - don't spam console, just use empty
        // This can happen if user is not authenticated or function doesn't exist
        if (notifErr?.response?.status !== 401) {
          console.warn("[NotificationProvider] Failed to load notifications:", notifErr?.message);
        }
        setNotifications([]);
        setUnreadCount(0);
      }
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
      await base44.functions.invoke("notifications", { action: "markRead", notificationId });
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
      await base44.functions.invoke("notifications", { action: "markAllRead" });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  }, []);

  // Update preferences
  const updatePreferences = useCallback(async (updates) => {
    try {
      if (!preferences?.id) {
        // No preferences record yet - try to create one
        const user = await base44.auth.me();
        if (!user) return;
        
        try {
          const newPrefs = await base44.entities.UserPreferences.create({
            user_id: user.id,
            ...updates
          });
          setPreferences(newPrefs);
          if (updates.timezone) {
            const normalized = normalizeTimeZone(updates.timezone);
            setTimezone(normalized || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
          }
          return;
        } catch (createErr) {
          console.warn("Failed to create preferences:", createErr?.message);
          return;
        }
      }
      
      await base44.entities.UserPreferences.update(preferences.id, updates);
      setPreferences(prev => ({ ...prev, ...updates }));
      if (updates.timezone) {
        const normalized = normalizeTimeZone(updates.timezone);
        setTimezone(normalized || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      }
    } catch (err) {
      console.error("Failed to update preferences:", err);
      throw err; // Re-throw so UI can show error
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