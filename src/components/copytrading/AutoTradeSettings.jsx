import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Zap, 
  ZapOff, 
  Loader2, 
  Save, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp,
  Info,
  DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";

const t = {
  en: {
    autoTrade: "Auto-Trade",
    autoTradeDesc: "Automatically accept signals from experts",
    on: "ON",
    off: "OFF",
    amountPerTrade: "Amount per Trade",
    amountPerTradeDesc: "How much USDT to use for each signal",
    amountPlaceholder: "e.g. 10",
    maxLeverage: "Max Leverage",
    maxLeverageDesc: "Maximum leverage allowed",
    maxOpenTrades: "Max Open Trades",
    maxOpenTradesDesc: "How many trades can be open at once",
    safetySettings: "Safety Limits",
    safetyDesc: "Protect your balance with these limits",
    maxPerTrade: "Max per trade",
    save: "Save Settings",
    saving: "Saving...",
    saved: "Settings saved!",
    saveFailed: "Failed to save",
    low: "Conservative",
    mid: "Moderate",
    high: "Aggressive",
    showAdvanced: "Show Advanced",
    hideAdvanced: "Hide Advanced",
    leverageFollows: "Follows signal leverage",
    trades: "trades",
  },
  ar: {
    autoTrade: "التداول التلقائي",
    autoTradeDesc: "قبول الإشارات تلقائياً من الخبراء",
    on: "مفعّل",
    off: "متوقف",
    amountPerTrade: "المبلغ لكل صفقة",
    amountPerTradeDesc: "كم USDT تستخدم لكل إشارة",
    amountPlaceholder: "مثال: 10",
    maxLeverage: "أقصى رافعة",
    maxLeverageDesc: "الحد الأقصى للرافعة المالية",
    maxOpenTrades: "أقصى صفقات مفتوحة",
    maxOpenTradesDesc: "عدد الصفقات المفتوحة في نفس الوقت",
    safetySettings: "حدود الأمان",
    safetyDesc: "حماية رصيدك بهذه الحدود",
    maxPerTrade: "أقصى لكل صفقة",
    save: "حفظ الإعدادات",
    saving: "جارٍ الحفظ...",
    saved: "تم حفظ الإعدادات!",
    saveFailed: "فشل الحفظ",
    low: "محافظ",
    mid: "متوسط",
    high: "عدواني",
    showAdvanced: "إعدادات متقدمة",
    hideAdvanced: "إخفاء المتقدمة",
    leverageFollows: "تتبع رافعة الإشارة",
    trades: "صفقات",
  }
};

// Preset configurations for beginners
const PRESETS = {
  low:  { fixed_margin_usdt: 5,  max_leverage: 5,  max_open_positions_total: 3, max_margin_per_trade_usdt: 10 },
  mid:  { fixed_margin_usdt: 10, max_leverage: 10, max_open_positions_total: 5, max_margin_per_trade_usdt: 25 },
  high: { fixed_margin_usdt: 25, max_leverage: 20, max_open_positions_total: 8, max_margin_per_trade_usdt: 50 },
};

export default function AutoTradeSettings({ language = "en" }) {
  const labels = t[language] || t.en;
  const isRTL = language === "ar";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [settings, setSettings] = useState({
    auto_enabled: false,
    mode: "FIXED_MARGIN",
    fixed_margin_usdt: 10,
    risk_percent_equity: 1,
    leverage_mode: "FOLLOW_SIGNAL_CAP",
    fixed_leverage: 5,
    max_leverage: 10,
    max_margin_per_trade_usdt: 25,
    max_open_positions_total: 5,
    signal_expiry_seconds: 180,
    max_entry_deviation_percent: 0.3
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await base44.functions.invoke("copyTradingUser", { action: "getSettings" });
      if (res.data?.ok && res.data.data) {
        setSettings(prev => ({ ...prev, ...res.data.data }));
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const update = (changes) => {
    setSettings(prev => ({ ...prev, ...changes }));
    setDirty(true);
  };

  const applyPreset = (key) => {
    update(PRESETS[key]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (settings.mode === "FIXED_MARGIN" && settings.fixed_margin_usdt < 1) {
        throw new Error(language === "ar" ? "الحد الأدنى 1 USDT" : "Minimum is 1 USDT");
      }
      const res = await base44.functions.invoke("copyTradingUser", { action: "saveSettings", settings });
      if (res.data?.ok) {
        toast.success(labels.saved);
        setDirty(false);
      } else {
        throw new Error(res.data?.error?.message || "Save failed");
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const activePreset = Object.entries(PRESETS).find(([, v]) =>
    v.fixed_margin_usdt === settings.fixed_margin_usdt &&
    v.max_leverage === settings.max_leverage &&
    v.max_open_positions_total === settings.max_open_positions_total
  )?.[0] || null;

  return (
    <div className="space-y-3" dir={isRTL ? "rtl" : "ltr"}>
      {/* Main Toggle */}
      <Card className={cn(
        "transition-all",
        settings.auto_enabled 
          ? "border-primary/40 bg-primary/5 shadow-sm" 
          : "border-border/50"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                "p-2 rounded-xl flex-shrink-0",
                settings.auto_enabled 
                  ? "bg-primary/15 text-primary" 
                  : "bg-muted text-muted-foreground"
              )}>
                {settings.auto_enabled ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{labels.autoTrade}</span>
                  <Badge 
                    variant={settings.auto_enabled ? "default" : "secondary"} 
                    className={cn(
                      "text-[10px] px-1.5 py-0",
                      settings.auto_enabled ? "bg-primary" : ""
                    )}
                  >
                    {settings.auto_enabled ? labels.on : labels.off}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{labels.autoTradeDesc}</p>
              </div>
            </div>
            <Switch
              checked={settings.auto_enabled}
              onCheckedChange={(v) => update({ auto_enabled: v })}
              className="flex-shrink-0"
            />
          </div>
        </CardContent>
      </Card>

      {/* Settings body - only if enabled */}
      {settings.auto_enabled && (
        <div className="space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-300">
          
          {/* Quick Presets */}
          <div className="grid grid-cols-3 gap-2">
            {(["low", "mid", "high"]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className={cn(
                  "py-2.5 px-2 rounded-xl text-xs font-medium transition-all border-2",
                  activePreset === key
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border/50 bg-card hover:border-primary/30 text-foreground"
                )}
              >
                <div className="text-center">
                  <span className={cn(
                    "text-lg block mb-0.5",
                    key === "low" ? "" : key === "mid" ? "" : ""
                  )}>
                    {key === "low" ? "🛡️" : key === "mid" ? "⚖️" : "🚀"}
                  </span>
                  <span>{labels[key]}</span>
                  <span className="block text-[10px] text-muted-foreground mt-0.5 font-mono">
                    {PRESETS[key].fixed_margin_usdt} USDT · {PRESETS[key].max_leverage}x
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Amount per Trade */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{labels.amountPerTrade}</span>
                </div>
                <span className="font-mono text-sm font-bold text-primary">{settings.fixed_margin_usdt} USDT</span>
              </div>
              <p className="text-xs text-muted-foreground">{labels.amountPerTradeDesc}</p>
              <div className="flex items-center gap-3">
                <Slider
                  value={[settings.fixed_margin_usdt]}
                  min={1}
                  max={100}
                  step={1}
                  onValueChange={([v]) => update({ fixed_margin_usdt: v })}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={settings.fixed_margin_usdt}
                  onChange={(e) => update({ fixed_margin_usdt: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-20 h-8 text-center font-mono text-sm"
                  min={1}
                  inputMode="decimal"
                />
              </div>
            </CardContent>
          </Card>

          {/* Leverage & Max Trades - Side by Side */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-3 space-y-2">
                <span className="text-xs font-medium text-muted-foreground">{labels.maxLeverage}</span>
                <div className="text-center">
                  <span className="font-mono text-2xl font-bold text-foreground">{settings.max_leverage}x</span>
                </div>
                <Slider
                  value={[settings.max_leverage]}
                  min={1}
                  max={20}
                  step={1}
                  onValueChange={([v]) => update({ max_leverage: v })}
                />
                <p className="text-[10px] text-muted-foreground text-center">{labels.leverageFollows}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 space-y-2">
                <span className="text-xs font-medium text-muted-foreground">{labels.maxOpenTrades}</span>
                <div className="text-center">
                  <span className="font-mono text-2xl font-bold text-foreground">{settings.max_open_positions_total}</span>
                </div>
                <Slider
                  value={[settings.max_open_positions_total]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={([v]) => update({ max_open_positions_total: v })}
                />
                <p className="text-[10px] text-muted-foreground text-center">{labels.trades}</p>
              </CardContent>
            </Card>
          </div>

          {/* Safety Limit (Max per trade) */}
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium">{labels.safetySettings}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{labels.maxPerTrade}</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={settings.max_margin_per_trade_usdt}
                    onChange={(e) => update({ max_margin_per_trade_usdt: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-20 h-8 text-center font-mono text-sm"
                    min={1}
                    inputMode="decimal"
                  />
                  <span className="text-xs text-muted-foreground">USDT</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showAdvanced ? labels.hideAdvanced : labels.showAdvanced}
          </button>

          {showAdvanced && (
            <Card className="animate-in fade-in-0 slide-in-from-top-1 duration-200">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {language === "ar" ? "إعدادات متقدمة للمتداولين ذوي الخبرة" : "Advanced settings for experienced traders"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">
                      {language === "ar" ? "انتهاء الإشارة (ثواني)" : "Signal Expiry (sec)"}
                    </label>
                    <Input
                      type="number"
                      value={settings.signal_expiry_seconds}
                      onChange={(e) => update({ signal_expiry_seconds: Number(e.target.value) || 180 })}
                      className="h-8 font-mono text-sm"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">
                      {language === "ar" ? "انحراف السعر %" : "Price Deviation %"}
                    </label>
                    <Input
                      type="number"
                      value={settings.max_entry_deviation_percent}
                      onChange={(e) => update({ max_entry_deviation_percent: Number(e.target.value) || 0.3 })}
                      className="h-8 font-mono text-sm"
                      step="0.1"
                      inputMode="decimal"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={saving || !dirty}
            className={cn(
              "w-full transition-all",
              dirty ? "bg-primary shadow-lg shadow-primary/25" : "bg-primary/50"
            )}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin ltr:mr-2 rtl:ml-2" />
            ) : (
              <Save className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
            )}
            {saving ? labels.saving : labels.save}
          </Button>
        </div>
      )}
    </div>
  );
}

AutoTradeSettings.propTypes = {
  language: PropTypes.string,
};