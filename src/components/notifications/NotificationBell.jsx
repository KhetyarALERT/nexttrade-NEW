import { useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Bell, Check, CheckCheck, Settings, TrendingUp, AlertTriangle, Wallet, Lock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "./NotificationProvider";

import { Headphones } from "lucide-react";

import { Shield, LogIn } from "lucide-react";

const NOTIFICATION_ICONS = {
  price_alert: TrendingUp,
  trade_executed: TrendingUp,
  trade_closed: Check,
  margin_warning: AlertTriangle,
  liquidation_warning: AlertTriangle,
  deposit_confirmed: Wallet,
  withdrawal_confirmed: Wallet,
  withdrawal_failed: AlertTriangle,
  staking_reward: Lock,
  system: Info,
  ticket_created: Headphones,
  ticket_updated: Headphones,
  ticket_admin_reply: Headphones,
  signal_new: TrendingUp,
  kyc_submitted: Shield,
  kyc_approved: Shield,
  kyc_rejected: Shield,
  kyc_update: Shield,
  user_login: LogIn
};

const NOTIFICATION_COLORS = {
  price_alert: "bg-blue-500/10 text-blue-500",
  trade_executed: "bg-emerald-500/10 text-emerald-500",
  trade_closed: "bg-emerald-500/10 text-emerald-500",
  margin_warning: "bg-amber-500/10 text-amber-500",
  liquidation_warning: "bg-red-500/10 text-red-500",
  deposit_confirmed: "bg-emerald-500/10 text-emerald-500",
  withdrawal_confirmed: "bg-emerald-500/10 text-emerald-500",
  withdrawal_failed: "bg-red-500/10 text-red-500",
  staking_reward: "bg-purple-500/10 text-purple-500",
  system: "bg-slate-500/10 text-slate-500",
  ticket_created: "bg-blue-500/10 text-blue-500",
  ticket_updated: "bg-blue-500/10 text-blue-500",
  ticket_admin_reply: "bg-emerald-500/10 text-emerald-500",
  signal_new: "bg-blue-500/10 text-blue-500",
  kyc_submitted: "bg-amber-500/10 text-amber-500",
  kyc_approved: "bg-emerald-500/10 text-emerald-500",
  kyc_rejected: "bg-red-500/10 text-red-500",
  kyc_update: "bg-blue-500/10 text-blue-500",
  user_login: "bg-slate-500/10 text-slate-500"
};

export default function NotificationBell({ onSettingsClick, language = "en" }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, formatDate } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const isAr = language === "ar";

  const t = {
    notifications: isAr ? "الإشعارات" : "Notifications",
    markAllRead: isAr ? "تحديد الكل كمقروء" : "Mark all read",
    noNotifications: isAr ? "لا توجد إشعارات بعد" : "No notifications yet",
  };

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Handle Signal Notifications
    if (notification.data?.signalId) {
      setOpen(false);
      navigate(`${createPageUrl("Futures")}?tab=bots&signalId=${notification.data.signalId}`);
      return;
    }
    
    // Handle ticket notifications - route to appropriate page
    if (notification.type?.startsWith('ticket_') && notification.data?.link) {
      setOpen(false);
      navigate(notification.data.link);
      return;
    }

    // Handle KYC notifications - deep link to admin hub KYC tab
    if (notification.type?.startsWith('kyc_') && notification.data?.link) {
      setOpen(false);
      navigate(notification.data.link);
      return;
    }

    // Handle user_login notifications - deep link to admin hub users tab
    if (notification.type === 'user_login' && notification.data?.link) {
      setOpen(false);
      navigate(notification.data.link);
      return;
    }
    
    // Navigate if the notification has a link
    if (notification.data?.link) {
      setOpen(false);
      navigate(notification.data.link);
    }
  };

  // Helper to translate notification content on the fly if needed
  const getTranslatedContent = (n) => {
    if (!isAr) return { title: n.title, message: n.message };

    let title = n.title;
    let message = n.message;

    // Common backend strings fallback translation
    if (title.startsWith("New Signal:")) {
      title = title.replace("New Signal:", "إشارة جديدة:");
    } else if (title === "Order Filled") {
      title = "تم تنفيذ الأمر";
    } else if (title === "Price Alert:") {
      title = "تنبيه سعر:";
    } else if (title === "Signal Accepted") {
      title = "تم قبول الإشارة";
    }

    // Message translations (simple replacements)
    if (message.includes("Entry:")) {
      message = message.replace("Entry:", "دخول:").replace("TP:", "هدف:").replace("SL:", "وقف:");
    }

    return { title, message };
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label={isAr ? `${unreadCount} إشعار غير مقروء` : `${unreadCount} unread notifications`}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" dir={isAr ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">{t.notifications}</h4>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-7 text-xs">
                <CheckCheck className={`h-3 w-3 ${isAr ? "ml-1" : "mr-1"}`} />
                {t.markAllRead}
              </Button>
            )}
            {onSettingsClick && (
              <Button variant="ghost" size="icon" onClick={onSettingsClick} className="h-7 w-7">
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              {t.noNotifications}
            </div>
          ) : (
            <div className="divide-y">
              {notifications.slice(0, 20).map((notification) => {
                const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
                const colorClass = NOTIFICATION_COLORS[notification.type] || "bg-slate-500/10 text-slate-500";
                const { title, message } = getTranslatedContent(notification);
                
                return (
                  <div
                   key={notification.id}
                   onClick={() => handleNotificationClick(notification)}
                   role="button"
                   tabIndex={0}
                   onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleNotificationClick(notification); }}
                   className={`p-3 cursor-pointer hover:bg-accent transition-colors ${
                     !notification.read ? 'bg-primary/5' : ''
                   }`}
                  >
                   <div className="flex gap-3">
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                       <Icon className="h-4 w-4" />
                     </div>
                     <div className="flex-1 min-w-0">
                       <p className={`text-sm font-medium truncate ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                         {title}
                       </p>
                       <p className="text-xs text-muted-foreground line-clamp-2">{message}</p>
                       <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {formatDate(notification.created_date, { 
                            month: 'short', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

NotificationBell.propTypes = {
  onSettingsClick: PropTypes.func,
  language: PropTypes.string
};