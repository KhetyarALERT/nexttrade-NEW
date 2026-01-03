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

export default function NotificationSettings({ open, onOpenChange }) {
  const { preferences, timezone, updatePreferences } = useNotifications();
  const [localPrefs, setLocalPrefs] = useState({});
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
    } catch (err) {
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Timezone */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-slate-500" />
              <Label className="font-medium">Timezone</Label>
            </div>
            <div className="flex gap-2">
              <Select
                value={localPrefs.timezone || timezone}
                onValueChange={(v) => setLocalPrefs(prev => ({ ...prev, timezone: v }))}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleAutoDetect}>
                <Clock className="h-4 w-4 mr-1" />
                Auto
              </Button>
            </div>
          </div>

          {/* Master Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <Label className="font-medium">Enable Notifications</Label>
              <p className="text-xs text-slate-500">Receive alerts for important events</p>
            </div>
            <Switch
              checked={localPrefs.notifications_enabled}
              onCheckedChange={(v) => setLocalPrefs(prev => ({ ...prev, notifications_enabled: v }))}
            />
          </div>

          {/* Individual Toggles */}
          <div className="space-y-3">
            {[
              { key: "notify_price_alerts", label: "Price Alerts", desc: "When target prices are reached" },
              { key: "notify_trade_executions", label: "Trade Executions", desc: "When trades are opened or closed" },
              { key: "notify_margin_warnings", label: "Margin Warnings", desc: "Low margin and liquidation alerts" },
              { key: "notify_deposits", label: "Deposits", desc: "When deposits are confirmed" },
              { key: "notify_withdrawals", label: "Withdrawals", desc: "Withdrawal status updates" },
              { key: "notify_staking", label: "Staking", desc: "Staking rewards and updates" }
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">{item.label}</Label>
                  <p className="text-[10px] text-slate-500">{item.desc}</p>
                </div>
                <Switch
                  checked={localPrefs[item.key]}
                  onCheckedChange={(v) => setLocalPrefs(prev => ({ ...prev, [item.key]: v }))}
                  disabled={!localPrefs.notifications_enabled}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

NotificationSettings.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired
};