import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Bell, Clock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNotifications } from "./NotificationProvider";
import { toast } from "sonner";

const COMMON_TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (US)" },
  { value: "America/Chicago", label: "Central Time (US)" },
  { value: "America/Denver", label: "Mountain Time (US)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US)" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Asia/Shanghai", label: "Shanghai" },
  { value: "Asia/Hong_Kong", label: "Hong Kong" },
  { value: "Australia/Sydney", label: "Sydney" }
];

export default function NotificationSettings({ open, onOpenChange, language = "en" }) {
  const { preferences, timezone, updatePreferences } = useNotifications();
  const isAr = language === "ar";

  const t = {
    settings: isAr ? "إعدادات الإشعارات" : "Notification Settings",
    timezone: isAr ? "المنطقة الزمنية" : "Timezone",
    auto: isAr ? "تلقائي" : "Auto",
    enable: isAr ? "تفعيل الإشعارات" : "Enable Notifications",
    enableDesc: isAr ? "تلقي تنبيهات للأحداث المهمة" : "Receive alerts for important events",
    save: isAr ? "حفظ الإعدادات" : "Save Settings",
    saving: isAr ? "جاري الحفظ..." : "Saving...",
    cancel: isAr ? "إلغاء" : "Cancel",
    types: {
      notify_price_alerts: { 
        label: isAr ? "تنبيهات الأسعار" : "Price Alerts", 
        desc: isAr ? "عند الوصول إلى الأسعار المستهدفة" : "When target prices are reached" 
      },
      notify_trade_executions: { 
        label: isAr ? "تنفيذ الصفقات" : "Trade Executions", 
        desc: isAr ? "عند فتح أو إغلاق الصفقات" : "When trades are opened or closed" 
      },
      notify_margin_warnings: { 
        label: isAr ? "تحذيرات الهامش" : "Margin Warnings", 
        desc: isAr ? "تنبيهات انخفاض الهامش والتصفية" : "Low margin and liquidation alerts" 
      },
      notify_deposits: { 
        label: isAr ? "الإيداعات" : "Deposits", 
        desc: isAr ? "عند تأكيد الإيداعات" : "When deposits are confirmed" 
      },
      notify_withdrawals: { 
        label: isAr ? "السحوبات" : "Withdrawals", 
        desc: isAr ? "تحديثات حالة السحب" : "Withdrawal status updates" 
      },
      notify_staking: { 
        label: isAr ? "الاستثمار" : "Staking", 
        desc: isAr ? "مكافآت الاستثمار والتحديثات" : "Staking rewards and updates" 
      }
    }
  };

  /**
   * @typedef {Object} NotificationPrefs
   * @property {boolean} notifications_enabled
   * @property {boolean} notify_price_alerts
   * @property {boolean} notify_trade_executions
   * @property {boolean} notify_margin_warnings
   * @property {boolean} notify_deposits
   * @property {boolean} notify_withdrawals
   * @property {boolean} notify_staking
   * @property {string} timezone
   */

  /** @type {[NotificationPrefs, import('react').Dispatch<import('react').SetStateAction<NotificationPrefs>>]} */
  const [localPrefs, setLocalPrefs] = useState(() => ({
    notifications_enabled: true,
    notify_price_alerts: true,
    notify_trade_executions: true,
    notify_margin_warnings: true,
    notify_deposits: true,
    notify_withdrawals: true,
    notify_staking: true,
    timezone: String(timezone || "UTC"),
  }));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (preferences) {
      setLocalPrefs({
        notifications_enabled: preferences.notifications_enabled ?? true,
        notify_price_alerts: preferences.notify_price_alerts ?? true,
        notify_trade_executions: preferences.notify_trade_executions ?? true,
        notify_margin_warnings: preferences.notify_margin_warnings ?? true,
        notify_deposits: preferences.notify_deposits ?? true,
        notify_withdrawals: preferences.notify_withdrawals ?? true,
        notify_staking: preferences.notify_staking ?? true,
        timezone: preferences.timezone || timezone
      });
    }
  }, [preferences, timezone]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePreferences({
        ...localPrefs,
        timezone_auto_detected: false
      });
      toast.success("Settings saved");
      onOpenChange(false);
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAutoDetect = () => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setLocalPrefs(prev => ({ ...prev, timezone: detected }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir={isAr ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t.settings}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isAr ? "تخصيص تفضيلات الإشعارات" : "Customize your notification preferences"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4" dir={isAr ? "rtl" : "ltr"}>
          {/* Timezone */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-slate-500" />
              <Label className="font-medium">{t.timezone}</Label>
            </div>
            <div className="flex gap-2">
              <Select
                value={localPrefs.timezone || timezone}
                onValueChange={(v) => setLocalPrefs(prev => ({ ...prev, timezone: v }))}
              >
                <SelectTrigger className="flex-1 text-right">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir={isAr ? "rtl" : "ltr"}>
                  {COMMON_TIMEZONES.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleAutoDetect}>
                <Clock className={`h-4 w-4 ${isAr ? "ml-1" : "mr-1"}`} />
                {t.auto}
              </Button>
            </div>
          </div>

          {/* Master Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <Label className="font-medium">{t.enable}</Label>
              <p className="text-xs text-slate-500">{t.enableDesc}</p>
            </div>
            <Switch
              checked={localPrefs.notifications_enabled}
              onCheckedChange={(v) => setLocalPrefs(prev => ({ ...prev, notifications_enabled: v }))}
            />
          </div>

          {/* Individual Toggles */}
          <div className="space-y-3">
            {Object.entries(t.types).map(([key, info]) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">{info.label}</Label>
                  <p className="text-[10px] text-slate-500">{info.desc}</p>
                </div>
                <Switch
                  checked={localPrefs[key]}
                  onCheckedChange={(v) => setLocalPrefs(prev => ({ ...prev, [key]: v }))}
                  disabled={!localPrefs.notifications_enabled}
                />
              </div>
            ))}
          </div>
        </div>

        <div className={`flex gap-2 ${isAr ? "justify-start" : "justify-end"}`}>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t.saving : t.save}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

NotificationSettings.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  language: PropTypes.string
};