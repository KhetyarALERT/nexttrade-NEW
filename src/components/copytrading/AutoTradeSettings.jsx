import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
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
  Info,
  DollarSign,
  HelpCircle,
  Shield,
  Scale,
  TrendingUp,
  Settings2 } from
"lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import EstimatedOutcome from "./EstimatedOutcome";

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

  const handleToggle = async (enabled) => {
    update({ auto_enabled: enabled });
    // Auto-save toggle immediately for instant feedback
    setSaving(true);
    try {
      const updatedSettings = { ...settings, auto_enabled: enabled };
      const res = await base44.functions.invoke("copyTradingUser", { action: "saveSettings", settings: updatedSettings });
      if (res.data?.ok) {
        toast.success(enabled ?
        language === "ar" ? "التداول التلقائي مفعّل" : "Auto-Trade enabled" :
        language === "ar" ? "التداول التلقائي متوقف" : "Auto-Trade disabled"
        );
        setDirty(false);
        setSettings(updatedSettings);
      } else {
        throw new Error(res.data?.error?.message || "Save failed");
      }
    } catch (e) {
      toast.error(e.message);
      update({ auto_enabled: !enabled }); // revert
    } finally {
      setSaving(false);
    }
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
      <div className="flex justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>);

  }

  const activePreset = Object.entries(PRESETS).find(([, v]) =>
  v.fixed_margin_usdt === settings.fixed_margin_usdt &&
  v.max_leverage === settings.max_leverage &&
  v.max_open_positions_total === settings.max_open_positions_total
  )?.[0] || null;

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      <Collapsible open={panelOpen} onOpenChange={setPanelOpen}>
        {/* Compact Header - Always Visible */}
        <div className={cn(
          "rounded-2xl border border-border/60 bg-card/90 transition-all duration-200 shadow-sm backdrop-blur-sm",
          settings.auto_enabled ?
          "border-primary/35 ring-1 ring-primary/12" :
          "border-border/60"
        )}>
          <div className="flex items-center justify-between p-3 gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                settings.auto_enabled ?
                "bg-primary/12 text-primary border border-primary/25" :
                "bg-muted/70 text-muted-foreground border border-border/60"
              )}>
                {settings.auto_enabled ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-foreground tracking-tight">{labels.autoTrade}</span>
                  <HelpButton content={labels.autoTradeHelp} />
                </div>
                {settings.auto_enabled &&
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 font-mono tabular-nums tracking-tight">
                    {settings.fixed_margin_usdt} <span className="text-[8px]">USDT</span> · {settings.max_leverage}<span className="text-[8px]">×</span> · {settings.max_open_positions_total} {labels.trades}
                  </p>
                }
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Switch
                checked={settings.auto_enabled}
                onCheckedChange={handleToggle}
                disabled={saving}
                className={cn(
                  "data-[state=checked]:bg-primary",
                  saving && "opacity-50"
                )} />

              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
                    "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    panelOpen && "bg-muted/50 text-foreground"
                  )}>

                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", panelOpen && "rotate-180")} />
                </button>
              </CollapsibleTrigger>
            </div>
          </div>

          {/* Expandable Settings Body */}
          <CollapsibleContent>
            <div className="px-4 pb-4 pt-2 space-y-3 border-t border-border/60 bg-background/30 rounded-b-2xl">
              {/* Presets Row */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                {["low", "mid", "high"].map((key) => {
                  const PresetIcon = key === "low" ? Shield : key === "mid" ? Scale : TrendingUp;
                  const colors = {
                    low: "text-emerald-300 bg-emerald-500/8 border-emerald-500/12",
                    mid: "text-amber-300 bg-amber-500/10 border-amber-500/14",
                    high: "text-rose-300 bg-rose-500/10 border-rose-500/14"
                  };
                  const isActive = activePreset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyPreset(key)}
                      className={cn(
                        "relative py-2.5 px-2 rounded-xl text-xs font-medium transition-all border",
                        isActive ?
                        "border-primary/45 bg-primary/10 text-primary" :
                        cn("hover:border-border/80", colors[key])
                      )}>
                      <PresetIcon className={cn("w-4 h-4 mx-auto mb-1.5", isActive ? "text-primary" : "")} />
                      <span className={cn("block text-[11px] font-bold tracking-tight", isActive ? "text-primary" : "text-foreground")}>{labels[key]}</span>
                      <span className="block text-[9px] text-muted-foreground/60 font-mono tabular-nums mt-0.5">
                        {PRESETS[key].fixed_margin_usdt}<span className="text-[8px]">$</span> · {PRESETS[key].max_leverage}<span className="text-[8px]">×</span>
                      </span>
                    </button>);
                })}
              </div>

              {/* Amount Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-primary/60" />
                    <span className="text-xs font-medium text-foreground">{labels.amountPerTrade}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      value={settings.fixed_margin_usdt}
                      onChange={(e) => update({ fixed_margin_usdt: Math.max(1, Number(e.target.value) || 1) })}
                      className="bg-background/80 py-2 text-xs font-mono text-center rounded-xl flex border border-border/60 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm hover:border-border w-20 h-8"
                      min={1}
                      inputMode="decimal" />

                    <span className="text-[10px] text-muted-foreground font-medium">USDT</span>
                  </div>
                </div>
                <Slider
                  value={[settings.fixed_margin_usdt]}
                  min={1}
                  max={100}
                  step={1}
                  onValueChange={([v]) => update({ fixed_margin_usdt: v })}
                  className="w-full" />

              </div>

              {/* Leverage & Trades - Premium Mini Cards */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-border/60 bg-card/85 backdrop-blur-sm p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest">{labels.maxLeverage}</span>
                    <HelpButton content={labels.leverageHelp} side="top" />
                  </div>
                  <div className="text-center py-0.5">
                    <span className="font-mono text-2xl font-bold text-foreground tabular-nums leading-none">{settings.max_leverage}</span>
                    <span className="text-[10px] font-medium text-muted-foreground/50 ml-0.5">×</span>
                  </div>
                  <Slider
                    value={[settings.max_leverage]}
                    min={1}
                    max={20}
                    step={1}
                    onValueChange={([v]) => update({ max_leverage: v })} />
                </div>
                <div className="rounded-xl border border-border/60 bg-card/85 backdrop-blur-sm p-3 space-y-2">
                  <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest block">{labels.maxOpenTrades}</span>
                  <div className="text-center py-0.5">
                    <span className="font-mono text-2xl font-bold text-foreground tabular-nums leading-none">{settings.max_open_positions_total}</span>
                  </div>
                  <Slider
                    value={[settings.max_open_positions_total]}
                    min={1}
                    max={10}
                    step={1}
                    onValueChange={([v]) => update({ max_open_positions_total: v })} />
                </div>
              </div>

              {/* Safety Limit - Inline */}
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/80 p-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary/70" />
                  <span className="text-[11px] font-semibold text-foreground tracking-tight">{labels.maxPerTrade}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    value={settings.max_margin_per_trade_usdt}
                    onChange={(e) => update({ max_margin_per_trade_usdt: Math.max(1, Number(e.target.value) || 1) })}
                    className="bg-background/80 py-2 text-xs font-mono text-center rounded-xl flex border border-border/60 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm hover:border-border w-20 h-8"
                    min={1}
                    inputMode="decimal" />

                  <span className="text-[10px] text-muted-foreground">USDT</span>
                </div>
              </div>

              {/* Estimated Outcome Preview */}
              <EstimatedOutcome
                amount={settings.fixed_margin_usdt}
                leverage={settings.max_leverage}
                maxPerTrade={settings.max_margin_per_trade_usdt}
                language={language} />


              {/* Advanced Collapsible */}
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider font-medium bg-muted/30 rounded-lg border border-border/60">

                    <Settings2 className="w-3 h-3" />
                    {advancedOpen ? labels.hideAdvanced : labels.showAdvanced}
                    <ChevronDown className={cn("w-3 h-3 transition-transform", advancedOpen && "rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-medium">
                        {language === "ar" ? "انتهاء الإشارة (ث)" : "Signal Expiry (s)"}
                      </label>
                      <Input
                        type="number"
                        value={settings.signal_expiry_seconds}
                        onChange={(e) => update({ signal_expiry_seconds: Number(e.target.value) || 180 })}
                        className="h-7 font-mono text-xs"
                        inputMode="numeric" />

                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-medium">
                        {language === "ar" ? "انحراف السعر %" : "Price Deviation %"}
                      </label>
                      <Input
                        type="number"
                        value={settings.max_entry_deviation_percent}
                        onChange={(e) => update({ max_entry_deviation_percent: Number(e.target.value) || 0.3 })}
                        className="h-7 font-mono text-xs"
                        step="0.1"
                        inputMode="decimal" />

                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Save Button */}
              {dirty &&
              <Button
                onClick={handleSave}
                disabled={saving}
                size="sm"
                className="w-full h-10 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90">

                  {saving ?
                <Loader2 className="w-4 h-4 animate-spin ltr:mr-2 rtl:ml-2" /> :

                <Save className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                }
                  {saving ? labels.saving : labels.save}
                </Button>
              }
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>);

}

AutoTradeSettings.propTypes = {
  language: PropTypes.string
};