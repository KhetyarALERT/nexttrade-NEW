import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Zap,
  ZapOff,
  Loader2,
  Save,
  ShieldCheck,
  ChevronDown,
  HelpCircle,
  Shield,
  Scale,
  TrendingUp,
  Settings2,
  Sparkles,
  Target,
  Activity,
  Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import EstimatedOutcome from "./EstimatedOutcome";
import ParameterSlider from "@/components/ui/parameter-slider";

const t = {
  en: {
    autoTrade: "Auto-Trade",
    autoTradeDesc: "Automatically accept signals from experts",
    on: "ON",
    off: "OFF",
    amountPerTrade: "Amount per Trade",
    amountPerTradeDesc: "USDT allocated per signal",
    amountPlaceholder: "e.g. 10",
    maxLeverage: "Max Leverage",
    maxOpenTrades: "Max Open Trades",
    safetySettings: "Safety Limit",
    maxPerTrade: "Max per trade",
    save: "Save Settings",
    saving: "Saving...",
    saved: "Settings saved!",
    low: "Conservative",
    mid: "Moderate",
    high: "Aggressive",
    showAdvanced: "Advanced",
    hideAdvanced: "Hide Advanced",
    leverageFollows: "Follows signal cap",
    trades: "trades",
    leverageHelp: "Leverage multiplies your trade size. 10x means $10 controls $100. Higher leverage = higher profit potential AND higher risk.",
    autoTradeHelp: "When on, new expert signals are executed automatically using your settings. No manual accept needed.",
    settings: "Settings"
  },
  ar: {
    autoTrade: "التداول التلقائي",
    autoTradeDesc: "قبول الإشارات تلقائياً من الخبراء",
    on: "مفعّل",
    off: "متوقف",
    amountPerTrade: "المبلغ لكل صفقة",
    amountPerTradeDesc: "USDT مخصص لكل إشارة",
    amountPlaceholder: "مثال: 10",
    maxLeverage: "أقصى رافعة",
    maxOpenTrades: "أقصى صفقات مفتوحة",
    safetySettings: "حد الأمان",
    maxPerTrade: "أقصى لكل صفقة",
    save: "حفظ الإعدادات",
    saving: "جارٍ الحفظ...",
    saved: "تم حفظ الإعدادات!",
    low: "محافظ",
    mid: "متوسط",
    high: "مخاطر",
    showAdvanced: "متقدم",
    hideAdvanced: "إخفاء المتقدمة",
    leverageFollows: "تتبع رافعة الإشارة",
    trades: "صفقات",
    leverageHelp: "الرافعة تضاعف حجم صفقتك. رافعة 10x تعني أن $10 تتحكم بـ $100. رافعة أعلى = ربح محتمل أعلى وخسارة محتملة أعلى.",
    autoTradeHelp: "عند التفعيل، يتم تنفيذ إشارات الخبراء تلقائياً حسب إعداداتك. لا حاجة لقبول كل إشارة يدوياً.",
    settings: "الإعدادات"
  }
};

const PRESETS = {
  low: { fixed_margin_usdt: 5, max_leverage: 5, max_open_positions_total: 3, max_margin_per_trade_usdt: 10 },
  mid: { fixed_margin_usdt: 10, max_leverage: 10, max_open_positions_total: 5, max_margin_per_trade_usdt: 25 },
  high: { fixed_margin_usdt: 25, max_leverage: 20, max_open_positions_total: 8, max_margin_per_trade_usdt: 50 }
};

function HelpButton({ content, side = "bottom" }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="text-muted-foreground/60 hover:text-foreground transition-colors ml-1">
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} className="max-w-[240px] text-xs leading-relaxed p-3 text-foreground/80">
        {content}
      </PopoverContent>
    </Popover>);

}

export default function AutoTradeSettings({ language = "en" }) {
  const labels = t[language] || t.en;
  const isRTL = language === "ar";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

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

  const sliderConfig = useMemo(() => ([
    {
      id: "fixed_margin_usdt",
      label: labels.amountPerTrade,
      min: 1,
      max: 200,
      step: 1,
      value: Number(settings.fixed_margin_usdt) || 1,
      unit: "USDT",
    },
    {
      id: "max_leverage",
      label: labels.maxLeverage,
      min: 1,
      max: 20,
      step: 1,
      value: Number(settings.max_leverage) || 1,
      unit: "x",
    },
    {
      id: "max_open_positions_total",
      label: labels.maxOpenTrades,
      min: 1,
      max: 10,
      step: 1,
      value: Number(settings.max_open_positions_total) || 1,
      unit: "",
    },
  ]), [labels.amountPerTrade, labels.maxLeverage, labels.maxOpenTrades, settings.fixed_margin_usdt, settings.max_leverage, settings.max_open_positions_total]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await base44.functions.invoke("copyTradingUser", { action: "getSettings" });
      if (res.data?.ok && res.data.data) {
        setSettings((prev) => ({ ...prev, ...res.data.data }));
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const update = (changes) => {
    setSettings((prev) => ({ ...prev, ...changes }));
    setDirty(true);
  };

  const applyPreset = (key) => {
    update(PRESETS[key]);
  };

  const handleToggle = (enabled) => {
    update({ auto_enabled: enabled });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke("copyTradingUser", { action: "updateSettings", settings });
      toast.success(labels.saved);
      setDirty(false);
    } catch (e) {
      console.error("Failed to save settings", e);
      toast.error(e?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#0c1522] p-4 text-sm text-muted-foreground">
        {language === "ar" ? "جاري التحميل..." : "Loading settings..."}
      </div>
    );
  }

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="space-y-3">
      <Collapsible open={panelOpen} onOpenChange={setPanelOpen}>
        <div className={cn(
          "rounded-3xl border border-emerald-500/20 bg-[#0c1522] text-foreground shadow-[0_10px_40px_rgba(0,0,0,0.25)]",
          panelOpen ? "ring-1 ring-emerald-400/20" : ""
        )}>
          <div className="flex items-center justify-between p-4 gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors border",
                settings.auto_enabled ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/40" : "bg-white/5 text-muted-foreground border-white/10"
              )}>
                {settings.auto_enabled ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tracking-tight text-white">{labels.autoTrade}</span>
                  <Badge className="bg-emerald-500/10 text-emerald-200 border border-emerald-400/30 rounded-lg text-[10px]">
                    {settings.fixed_margin_usdt} USDT · {settings.max_leverage}x · {settings.max_open_positions_total} {labels.trades}
                  </Badge>
                  <HelpButton content={labels.autoTradeHelp} />
                </div>
                <p className="text-[11px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-300" />
                  {labels.autoTradeDesc}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Switch
                checked={settings.auto_enabled}
                onCheckedChange={handleToggle}
                disabled={saving}
                className={cn(
                  "data-[state=checked]:bg-emerald-500",
                  "shadow-[0_0_0_6px_rgba(16,185,129,0.15)]",
                  saving && "opacity-50"
                )}
              />
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                    "text-muted-foreground hover:text-white hover:bg-white/10",
                    panelOpen && "bg-white/10 text-white"
                  )}>
                  <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", panelOpen && "rotate-180")} />
                </button>
              </CollapsibleTrigger>
            </div>
          </div>

          <CollapsibleContent>
            <div className="px-4 pb-5 pt-1 space-y-4 bg-[#0b131f] border-t border-white/5 rounded-b-3xl">
              <div className="grid grid-cols-3 gap-2 pt-3">
                {Object.entries(PRESETS).map(([key, preset]) => {
                  const PresetIcon = key === "low" ? Shield : key === "mid" ? Scale : TrendingUp;
                  const isActive = settings.fixed_margin_usdt === preset.fixed_margin_usdt && settings.max_leverage === preset.max_leverage && settings.max_open_positions_total === preset.max_open_positions_total;
                  const tone = key === "low" ? "emerald" : key === "mid" ? "amber" : "rose";
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyPreset(key)}
                      className={cn(
                        "relative p-3 rounded-xl text-xs font-semibold border transition-all",
                        "flex flex-col items-start gap-1",
                        isActive
                          ? "border-emerald-400/50 bg-emerald-400/10 text-white shadow-[0_10px_30px_rgba(16,185,129,0.15)]"
                          : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20"
                      )}
                    >
                      <div className="flex items-center gap-2 w-full justify-between">
                        <span className="capitalize">{labels[key]}</span>
                        <PresetIcon className={cn("w-4 h-4", isActive ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : tone === "rose" ? "text-rose-300" : "text-emerald-300")} />
                      </div>
                      <div className="text-[11px] text-muted-foreground/70 font-mono">
                        {preset.fixed_margin_usdt} USDT · {preset.max_leverage}x · {preset.max_open_positions_total} {labels.trades}
                      </div>
                    </button>
                  );
                })}
              </div>

              <ParameterSlider
                id="auto-trade-sliders"
                sliders={sliderConfig}
                onValueChange={(field, val) => update({ [field]: val })}
              />

              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-300" />
                  {labels.maxPerTrade}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={settings.max_margin_per_trade_usdt}
                    onChange={(e) => update({ max_margin_per_trade_usdt: Math.max(1, Number(e.target.value) || 1) })}
                    className="h-9 w-24 rounded-xl bg-[#0a101a] border border-white/10 text-right font-mono text-sm text-white"
                    min={1}
                  />
                  <span className="text-xs text-muted-foreground">USDT</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0d1727] p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Target className="w-4 h-4 text-emerald-300" />
                  {language === "ar" ? "المتوقع" : "What to expect"}
                </div>
                <EstimatedOutcome
                  amount={settings.fixed_margin_usdt}
                  leverage={settings.max_leverage}
                  maxPerTrade={settings.max_margin_per_trade_usdt}
                  language={language}
                />
              </div>

              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white"
                  >
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-emerald-300" />
                      {advancedOpen ? labels.hideAdvanced : labels.showAdvanced}
                    </div>
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", advancedOpen && "rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-2 gap-3 pt-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {language === "ar" ? "انتهاء الإشارة (ث)" : "Signal Expiry (s)"}
                      </label>
                      <Input
                        type="number"
                        value={settings.signal_expiry_seconds}
                        onChange={(e) => update({ signal_expiry_seconds: Number(e.target.value) || 180 })}
                        className="h-8 font-mono text-xs bg-[#0a101a] border border-white/10 rounded-lg text-white"
                        inputMode="numeric"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {language === "ar" ? "انحراف السعر %" : "Price Deviation %"}
                      </label>
                      <Input
                        type="number"
                        value={settings.max_entry_deviation_percent}
                        onChange={(e) => update({ max_entry_deviation_percent: Number(e.target.value) || 0.3 })}
                        className="h-8 font-mono text-xs bg-[#0a101a] border border-white/10 rounded-lg text-white"
                        step="0.1"
                        inputMode="decimal"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {dirty && (
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full h-12 text-sm font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_12px_30px_rgba(16,185,129,0.25)]"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {saving ? labels.saving : labels.save}
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );

}

AutoTradeSettings.propTypes = {
  language: PropTypes.string
};