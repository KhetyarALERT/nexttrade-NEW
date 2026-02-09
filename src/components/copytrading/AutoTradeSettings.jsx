import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
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
  DollarSign,
  Gauge,
  SlidersHorizontal,
  Activity } from "lucide-react";
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

function SliderRow({
  icon: Icon,
  label,
  hint = "",
  value,
  unit,
  min,
  max,
  step,
  onChange
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-[#0f1724] p-3 space-y-2 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-primary" />}
          <div>
            <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
            {hint && <p className="text-[11px] text-muted-foreground leading-tight">{hint}</p>}
          </div>
        </div>
        <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold font-mono border border-primary/30">
          {value}{unit}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
    </div>
  );
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

  const activePreset = useMemo(() => {
    const match = Object.entries(PRESETS).find(([, preset]) =>
      preset.fixed_margin_usdt === settings.fixed_margin_usdt &&
      preset.max_leverage === settings.max_leverage &&
      preset.max_open_positions_total === settings.max_open_positions_total
    );
    return match ? match[0] : null;
  }, [settings.fixed_margin_usdt, settings.max_leverage, settings.max_open_positions_total]);

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
          "rounded-3xl border transition-all duration-300 shadow-[0_18px_60px_rgba(0,0,0,0.45)]",
          "bg-gradient-to-b from-[#0b1220] via-[#0c1424] to-[#0a101b]",
          settings.auto_enabled
            ? "border-primary/50 ring-1 ring-primary/35"
            : "border-border/50"
        )}>
          <div className="flex items-center justify-between p-4 gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors border border-border/40",
                settings.auto_enabled
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "bg-muted/60 text-muted-foreground"
              )}>
                {settings.auto_enabled ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-1">
                    {labels.autoTrade}
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold",
                      settings.auto_enabled ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground"
                    )}>{settings.auto_enabled ? labels.on : labels.off}</span>
                  </span>
                  <HelpButton content={labels.autoTradeHelp} />
                </div>
                {settings.auto_enabled && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono tracking-wide">
                    {settings.fixed_margin_usdt} USDT · {settings.max_leverage}x · {settings.max_open_positions_total} {labels.trades}
                  </p>
                )}
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
                )}
              />

              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center transition-all border border-border/50",
                    "text-muted-foreground hover:text-foreground hover:bg-white/5",
                    panelOpen && "bg-white/5 text-foreground"
                  )}
                >
                  <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", panelOpen && "rotate-180")} />
                </button>
              </CollapsibleTrigger>
            </div>
          </div>

          <CollapsibleContent>
            <div className="px-4 pb-4 pt-2 space-y-4 border-t border-border/30 bg-[#0d162a]/80 rounded-b-3xl">
              <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-[0.08em]">
                <span>{language === "ar" ? "الوضعيات" : "Presets"}</span>
                <span className="text-[11px] text-primary/80 font-semibold">{labels.autoTradeDesc}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["low", "mid", "high"].map((key) => {
                  const PresetIcon = key === "low" ? Shield : key === "mid" ? Scale : TrendingUp;
                  const colors = {
                    low: "text-blue-500 bg-blue-500/10 border-blue-500/20",
                    mid: "text-amber-500 bg-amber-500/10 border-amber-500/20",
                    high: "text-rose-500 bg-rose-500/10 border-rose-500/20"
                  };
                  const isActive = activePreset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyPreset(key)}
                      className={cn(
                        "relative py-3 px-2.5 rounded-xl text-xs font-semibold transition-all border shadow-[0_10px_25px_rgba(0,0,0,0.25)]",
                        isActive
                          ? "border-primary bg-primary/15 text-primary ring-1 ring-primary/30"
                          : cn("hover:border-primary/25", colors[key])
                      )}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <PresetIcon className={cn("w-4 h-4", isActive ? "text-primary" : "")} />
                        <span className="text-[10px] font-mono text-muted-foreground">{PRESETS[key].max_leverage}x</span>
                      </div>
                      <span className={cn("block text-[11px] font-semibold", isActive ? "text-primary" : "text-foreground")}>{labels[key]}</span>
                      <span className="block text-[9px] text-muted-foreground font-mono mt-0.5">
                        {PRESETS[key].fixed_margin_usdt} USDT · {PRESETS[key].max_open_positions_total} {labels.trades}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3">
                <SliderRow
                  icon={DollarSign}
                  label={labels.amountPerTrade}
                  hint={labels.amountPerTradeDesc}
                  value={settings.fixed_margin_usdt}
                  unit=" USDT"
                  min={1}
                  max={200}
                  step={1}
                  onChange={(v) => update({ fixed_margin_usdt: v })}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <SliderRow
                    icon={Gauge}
                    label={labels.maxLeverage}
                    hint={labels.leverageHelp}
                    value={settings.max_leverage}
                    unit="x"
                    min={1}
                    max={20}
                    step={1}
                    onChange={(v) => update({ max_leverage: v })}
                  />
                  <SliderRow
                    icon={SlidersHorizontal}
                    label={labels.maxOpenTrades}
                    value={settings.max_open_positions_total}
                    unit=""
                    min={1}
                    max={10}
                    step={1}
                    onChange={(v) => update({ max_open_positions_total: v })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-primary/40 bg-primary/5 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.14)]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <div>
                    <span className="text-sm font-semibold text-foreground block">{labels.maxPerTrade}</span>
                    <span className="text-[11px] text-muted-foreground">{language === "ar" ? "حماية الحد لكل صفقة" : "Guardrail per trade"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={settings.max_margin_per_trade_usdt}
                    onChange={(e) => update({ max_margin_per_trade_usdt: Math.max(1, Number(e.target.value) || 1) })}
                    className="bg-[#0b1220] py-2 text-sm font-mono text-center rounded-xl flex border-2 shadow-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 hover:border-border/80 w-24 h-10 border-primary/40"
                    min={1}
                    inputMode="decimal"
                  />
                  <span className="text-[11px] text-muted-foreground">USDT</span>
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-[#0c1424] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.2)] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Activity className="w-4 h-4 text-primary" />
                    {language === "ar" ? "المتوقع" : "What to expect"}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{labels.maxPerTrade}</span>
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
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider font-semibold rounded-xl border border-border/50 bg-[#0b1220]"
                  >
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
                        inputMode="numeric"
                      />
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
                  size="sm"
                  className="w-full h-10 text-sm font-semibold bg-primary hover:bg-primary/90 shadow-md rounded-xl"
                >
                  {saving
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5" />
                    : <Save className="w-3.5 h-3.5 ltr:mr-1.5 rtl:ml-1.5" />}
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