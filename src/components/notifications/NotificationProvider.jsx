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

  // Auto-detect timezone
  useEffect(() => {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(detectedTimezone);
  }, []);

  // Load preferences and notifications
  const loadData = useCallback(async () => {
    try {
      const user = await base44.auth.me();
      if (!user) return;

      // Load or create preferences
      const prefsResult = await base44.entities.UserPreferences.filter({ user_id: user.id });
      if (prefsResult?.length) {
        setPreferences(prefsResult[0]);
        if (prefsResult[0].timezone) {
          setTimezone(prefsResult[0].timezone);
        }
      } else {
        // Create default preferences with auto-detected timezone
        const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
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
        setTimezone(detectedTz);
      }

      // Load notifications
      const notifs = await base44.entities.Notification.filter(
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
  }, []);

  useEffect(() => {
    loadData();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadData, 30000);
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
      await base44.entities.Notification.update(notificationId, { read: true });
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
        base44.entities.Notification.update(n.id, { read: true })
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
        setTimezone(updates.timezone);
      }
    } catch (err) {
      console.error("Failed to update preferences:", err);
    }
  }, [preferences]);

  // Format date in user's timezone
  const formatDate = useCallback((date, options = {}) => {
    const d = new Date(date);
    return d.toLocaleString(undefined, {
      timeZone: timezone,
      ...options
    });
  }, [timezone]);

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