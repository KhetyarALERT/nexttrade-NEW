import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Bell, Clock, Globe, AlertTriangle, TrendingUp, Wallet, Lock, CheckCircle, RefreshCw, Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

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
  { value: "Asia/Riyadh", label: "Riyadh" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Asia/Shanghai", label: "Shanghai" },
  { value: "Asia/Hong_Kong", label: "Hong Kong" },
  { value: "Australia/Sydney", label: "Sydney" }
];

// All BingX USDT-M Perpetual symbols
const ALL_SYMBOLS = [
  "BTC-USDT", "ETH-USDT", "SOL-USDT", "BNB-USDT", "XRP-USDT", "DOGE-USDT", 
  "ADA-USDT", "AVAX-USDT", "LINK-USDT", "DOT-USDT", "MATIC-USDT", "LTC-USDT",
  "SHIB-USDT", "TRX-USDT", "ATOM-USDT", "UNI-USDT", "APT-USDT", "ARB-USDT",
  "OP-USDT", "NEAR-USDT", "FIL-USDT", "ICP-USDT", "HBAR-USDT", "VET-USDT",
  "SAND-USDT", "MANA-USDT", "AAVE-USDT", "EOS-USDT", "XLM-USDT", "ALGO-USDT"
];

const NOTIFICATION_TYPES = [
  { key: "notify_price_alerts", label: "Price Alerts", desc: "When target prices are reached", icon: TrendingUp, color: "text-blue-500" },
  { key: "notify_trade_executions", label: "Trade Executions", desc: "When trades are opened or closed", icon: TrendingUp, color: "text-emerald-500" },
  { key: "notify_margin_warnings", label: "Margin Warnings", desc: "Low margin and liquidation alerts", icon: AlertTriangle, color: "text-amber-500" },
  { key: "notify_deposits", label: "Deposits", desc: "When deposits are confirmed", icon: Wallet, color: "text-emerald-500" },
  { key: "notify_withdrawals", label: "Withdrawals", desc: "Withdrawal status updates", icon: Wallet, color: "text-blue-500" },
  { key: "notify_staking", label: "Staking", desc: "Staking rewards and updates", icon: Lock, color: "text-purple-500" }
];

export default function NotificationPreferencesTab({ language = "en" }) {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [newAlert, setNewAlert] = useState({ symbol: 'BTC-USDT', targetPrice: '', condition: 'above' });
  const [symbolSearch, setSymbolSearch] = useState("");
  const [marketPrices, setMarketPrices] = useState({});
  
  const t = language === "ar" ? {
    title: "إعدادات الإشعارات",
    timezone: "المنطقة الزمنية",
    autoDetect: "تلقائي",
    enableNotifications: "تفعيل الإشعارات",
    enableDesc: "استلام تنبيهات للأحداث المهمة",
    notificationTypes: "أنواع الإشعارات",
    priceAlerts: "تنبيهات الأسعار",
    addAlert: "إضافة تنبيه",
    noAlerts: "لا توجد تنبيهات",
    save: "حفظ",
    saving: "جاري الحفظ...",
    saved: "تم الحفظ",
    above: "أعلى من",
    below: "أقل من"
  } : {
    title: "Notification Preferences",
    timezone: "Timezone",
    autoDetect: "Auto Detect",
    enableNotifications: "Enable Notifications",
    enableDesc: "Receive alerts for important events",
    notificationTypes: "Notification Types",
    priceAlerts: "Price Alerts",
    addAlert: "Add Alert",
    noAlerts: "No price alerts set",
    save: "Save Changes",
    saving: "Saving...",
    saved: "Settings saved",
    above: "Above",
    below: "Below"
  };

  // Load market prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // Use Binance futures public endpoint (CORS-friendly) for UI-only price display.
        // Symbols in this UI are in BingX format (e.g., BTC-USDT). Convert to Binance format (BTCUSDT).
        const response = await fetch('https://fapi.binance.com/fapi/v1/ticker/price');
        if (!response.ok) throw new Error(`Binance ticker failed: ${response.status}`);
        const data = await response.json();

        const binanceMap = new Map();
        (Array.isArray(data) ? data : []).forEach((t) => {
          const sym = String(t?.symbol || '').toUpperCase();
          const price = Number(t?.price);
          if (sym && Number.isFinite(price)) binanceMap.set(sym, price);
        });

        const prices = {};
        ALL_SYMBOLS.forEach((bingxSymbol) => {
          const binanceSymbol = String(bingxSymbol || '').replace(/-/g, '').toUpperCase();
          const p = binanceMap.get(binanceSymbol);
          if (Number.isFinite(p)) prices[bingxSymbol] = p;
        });

        if (Object.keys(prices).length) setMarketPrices(prices);
      } catch {
        // Use fallback
        setMarketPrices({
          'BTC-USDT': 96850, 'ETH-USDT': 3420, 'SOL-USDT': 198, 'BNB-USDT': 705,
          'XRP-USDT': 2.18, 'DOGE-USDT': 0.32, 'ADA-USDT': 0.89, 'AVAX-USDT': 38.5
        });
      }
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      if (!user) return;

      const prefs = await base44.entities.UserPreferences.filter({ user_id: user.id });
      if (prefs?.length) {
        setPreferences(prefs[0]);
      } else {
        // Create default preferences
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
      }
    } catch (err) {
      console.error("Failed to load preferences:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const handleSave = async () => {
    if (!preferences) return;
    setSaving(true);
    try {
      await base44.entities.UserPreferences.update(preferences.id, {
        timezone: preferences.timezone,
        timezone_auto_detected: false,
        notifications_enabled: preferences.notifications_enabled,
        notify_price_alerts: preferences.notify_price_alerts,
        notify_trade_executions: preferences.notify_trade_executions,
        notify_margin_warnings: preferences.notify_margin_warnings,
        notify_deposits: preferences.notify_deposits,
        notify_withdrawals: preferences.notify_withdrawals,
        notify_staking: preferences.notify_staking,
        price_alerts: preferences.price_alerts
      });
      toast.success(t.saved);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleAutoDetect = () => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setPreferences(prev => ({ ...prev, timezone: detected, timezone_auto_detected: true }));
  };

  const handleAddAlert = () => {
    if (!newAlert.targetPrice) {
      toast.error("Please enter a target price");
      return;
    }
    const alert = {
      id: Date.now().toString(),
      symbol: newAlert.symbol,
      targetPrice: parseFloat(newAlert.targetPrice),
      condition: newAlert.condition,
      active: true,
      created: new Date().toISOString()
    };
    setPreferences(prev => ({
      ...prev,
      price_alerts: [...(prev.price_alerts || []), alert]
    }));
    setNewAlert({ symbol: 'BTC-USDT', targetPrice: '', condition: 'above' });
    setShowAlertDialog(false);
  };

  const handleRemoveAlert = (alertId) => {
    setPreferences(prev => ({
      ...prev,
      price_alerts: (prev.price_alerts || []).filter(a => a.id !== alertId)
    }));
  };

  const handleToggleAlert = (alertId) => {
    setPreferences(prev => ({
      ...prev,
      price_alerts: (prev.price_alerts || []).map(a => 
        a.id === alertId ? { ...a, active: !a.active } : a
      )
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-8 text-center text-slate-500">
          Failed to load preferences. Please try again.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timezone Settings */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            {t.timezone}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select
              value={preferences.timezone}
              onValueChange={(v) => setPreferences(prev => ({ ...prev, timezone: v, timezone_auto_detected: false }))}
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
            <Button variant="outline" onClick={handleAutoDetect} className="rounded-xl">
              <Clock className="h-4 w-4 mr-1.5" />
              {t.autoDetect}
            </Button>
          </div>
          {preferences.timezone_auto_detected && (
            <p className="text-xs text-slate-500 mt-2">
              Automatically detected from your browser
            </p>
          )}
        </CardContent>
      </Card>

      {/* Master Toggle */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bell className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <Label className="font-medium">{t.enableNotifications}</Label>
                <p className="text-xs text-slate-500">{t.enableDesc}</p>
              </div>
            </div>
            <Switch
              checked={preferences.notifications_enabled}
              onCheckedChange={(v) => setPreferences(prev => ({ ...prev, notifications_enabled: v }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-4">
          <CardTitle className="text-lg">{t.notificationTypes}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 p-0">
          {NOTIFICATION_TYPES.map(item => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-slate-100`}>
                    <Icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">{item.label}</Label>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                </div>
                <Switch
                  checked={preferences[item.key]}
                  onCheckedChange={(v) => setPreferences(prev => ({ ...prev, [item.key]: v }))}
                  disabled={!preferences.notifications_enabled}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Price Alerts */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              {t.priceAlerts}
            </CardTitle>
            <Button 
              size="sm" 
              onClick={() => setShowAlertDialog(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
              disabled={!preferences.notifications_enabled || !preferences.notify_price_alerts}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t.addAlert}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {(!preferences.price_alerts || preferences.price_alerts.length === 0) ? (
            <div className="text-center py-8 text-slate-500">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t.noAlerts}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {preferences.price_alerts.map(alert => (
                <div key={alert.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={alert.active}
                      onCheckedChange={() => handleToggleAlert(alert.id)}
                      disabled={!preferences.notifications_enabled}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{alert.symbol}</span>
                        <Badge variant="outline" className={alert.condition === 'above' ? 'text-emerald-600 border-emerald-300' : 'text-red-600 border-red-300'}>
                          {alert.condition === 'above' ? t.above : t.below} ${alert.targetPrice?.toLocaleString()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveAlert(alert.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8"
        >
          {saving ? (
            <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t.saving}</>
          ) : (
            <><CheckCircle className="h-4 w-4 mr-2" />{t.save}</>
          )}
        </Button>
      </div>

      {/* Add Alert Dialog */}
      <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.addAlert}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Symbol</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search symbols..."
                  value={symbolSearch}
                  onChange={(e) => setSymbolSearch(e.target.value)}
                  className="pl-8 mb-2"
                />
              </div>
              <Select
                value={newAlert.symbol}
                onValueChange={(v) => setNewAlert(prev => ({ ...prev, symbol: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {ALL_SYMBOLS
                    .filter(s => s.toLowerCase().includes(symbolSearch.toLowerCase()))
                    .map(s => (
                      <SelectItem key={s} value={s}>
                        <div className="flex items-center justify-between w-full">
                          <span>{s}</span>
                          {marketPrices[s] && (
                            <span className="text-xs text-slate-500 ml-2">
                              ${marketPrices[s]?.toLocaleString(undefined, { maximumFractionDigits: marketPrices[s] < 1 ? 6 : 2 })}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {marketPrices[newAlert.symbol] && (
                <p className="text-sm text-slate-500">
                  Current price: <span className="font-mono font-medium text-slate-700">${marketPrices[newAlert.symbol]?.toLocaleString(undefined, { maximumFractionDigits: marketPrices[newAlert.symbol] < 1 ? 6 : 2 })}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select
                value={newAlert.condition}
                onValueChange={(v) => setNewAlert(prev => ({ ...prev, condition: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">{t.above}</SelectItem>
                  <SelectItem value="below">{t.below}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Price (USD)</Label>
              <Input
                type="number"
                value={newAlert.targetPrice}
                onChange={(e) => setNewAlert(prev => ({ ...prev, targetPrice: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAlertDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAlert} className="bg-blue-600 hover:bg-blue-700 text-white">
              Add Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

NotificationPreferencesTab.propTypes = {
  language: PropTypes.string
};