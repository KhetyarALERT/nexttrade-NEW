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
  DollarSign,
  Gauge,
  SlidersHorizontal,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import EstimatedOutcome from "./EstimatedOutcome";

const t = {
  en: {
    autoTrade: "Auto-Trade",
    autoTradeDesc: "Automatically accept signals from experts",
    on: "ON",
    off: "Off",
    custom: "Custom",
    choosePreset: "Choose a preset",
    presetHint: "Pick a safe starting point",
    mainControls: "Main controls",
    amountPerTrade: "Amount per trade",
    amountPerTradeDesc: "USDT allocated per signal",
    maxLeverage: "Max leverage",
    maxLeverageDesc: "Higher leverage increases risk",
    maxOpenTrades: "Max open trades",
    maxOpenTradesDesc: "Limit active positions",
    maxPerTrade: "Safety limit",
    maxPerTradeDesc: "Maximum USDT allowed per trade",
    signalExpiry: "Signal expiry (s)",
    priceDeviation: "Price deviation (%)",
    advanced: "Advanced",
    whatToExpect: "What to expect",
    save: "Save settings",
    saving: "Saving...",
    saved: "Settings saved!",
    noChanges: "No changes",
    low: "Conservative",
    mid: "Moderate",
    high: "Aggressive",
    trades: "trades",
    summaryUnit: "USDT/trade",
    autoTradeHelp:
      "When on, new expert signals are executed automatically using your settings. No manual accept needed."
  },
  ar: {
    autoTrade: "التداول التلقائي",
    autoTradeDesc: "قبول الإشارات تلقائياً من الخبراء",
    on: "مفعّل",
    off: "متوقف",
    custom: "مخصص",
    choosePreset: "اختر إعداداً مسبقاً",
    presetHint: "ابدأ بخيار بسيط وآمن",
    mainControls: "التحكم الرئيسي",
    amountPerTrade: "المبلغ لكل صفقة",
    amountPerTradeDesc: "USDT مخصص لكل إشارة",
    maxLeverage: "أقصى رافعة",
    maxLeverageDesc: "رافعة أعلى = مخاطرة أعلى",
    maxOpenTrades: "أقصى صفقات مفتوحة",
    maxOpenTradesDesc: "حد المراكز النشطة",
    maxPerTrade: "حد الأمان",
    maxPerTradeDesc: "أقصى USDT مسموح لكل صفقة",
    signalExpiry: "انتهاء الإشارة (ث)",
    priceDeviation: "انحراف السعر (%)",
    advanced: "إعدادات متقدمة",
    whatToExpect: "المتوقع",
    save: "حفظ الإعدادات",
    saving: "جارٍ الحفظ...",
    saved: "تم حفظ الإعدادات!",
    noChanges: "لا تغييرات",
    low: "محافظ",
    mid: "متوسط",
    high: "مخاطر",
    trades: "صفقات",
    summaryUnit: "USDT/صفقة",
    autoTradeHelp:
      "عند التفعيل، يتم تنفيذ إشارات الخبراء تلقائياً حسب إعداداتك. لا حاجة لقبول كل إشارة يدوياً."
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
        <button
          type="button"
          className="text-muted-foreground/60 hover:text-foreground transition-colors ltr:ml-1 rtl:mr-1"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} className="max-w-[260px] text-xs leading-relaxed p-3 text-foreground/80">
        {content}
      </PopoverContent>
    </Popover>
  );
}

function ControlBlock({ icon: Icon, title, helper, children }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-3">
      <div className="flex items-start gap-2">
        {Icon && <Icon className="w-4 h-4 text-primary mt-0.5" />}
        <div className="space-y-0.5">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          {helper && <p className="text-xs text-muted-foreground leading-snug">{helper}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function NumberSliderRow({ value, min, max, step, unit = "", onChange }) {
  const handleNumberChange = (e) => {
    const next = Number(e.target.value);
    onChange(Number.isFinite(next) ? Math.min(Math.max(next, min), max) : min);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          onChange={handleNumberChange}
          min={min}
          max={max}
          step={step}
          inputMode="decimal"
          className="h-11 w-28 text-sm"
        />
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
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

function FieldBlock({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      {children}
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
      preset.max_open_positions_total === settings.max_open_positions_total &&
      preset.max_margin_per_trade_usdt === settings.max_margin_per_trade_usdt
    );
    return match ? match[0] : null;
  }, [
    settings.fixed_margin_usdt,
    settings.max_leverage,
    settings.max_open_positions_total,
    settings.max_margin_per_trade_usdt
  ]);

  const presetLabel = activePreset ? labels[activePreset] : labels.custom;

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const summary = settings.auto_enabled
    ? `${presetLabel} • ${settings.fixed_margin_usdt} ${labels.summaryUnit} • ${settings.max_open_positions_total} ${labels.trades} • ${labels.maxLeverage.toLowerCase()} ${settings.max_leverage}x`
    : labels.off;

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="space-y-3">
      <Collapsible open={panelOpen} onOpenChange={setPanelOpen}>
        <div
          className={cn(
            "rounded-2xl border border-border/60 bg-[#0c1320] text-foreground transition-all",
            settings.auto_enabled ? "ring-1 ring-primary/25" : ""
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-border/70",
                  settings.auto_enabled ? "bg-primary/10 text-primary" : "bg-muted/40 text-muted-foreground"
                )}
              >
                {settings.auto_enabled ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold leading-tight">{labels.autoTrade}</span>
                  <HelpButton content={labels.autoTradeHelp} />
                </div>
                <p className="text-sm text-muted-foreground leading-snug truncate">{summary}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Switch
                checked={settings.auto_enabled}
                onCheckedChange={handleToggle}
                disabled={saving}
                className="data-[state=checked]:bg-primary"
              />
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-10 h-10 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5",
                    panelOpen && "bg-white/5 text-foreground"
                  )}
                >
                  <ChevronDown className={cn("w-4 h-4 transition-transform", panelOpen && "rotate-180")} />
                </button>
              </CollapsibleTrigger>
            </div>
          </div>

          <CollapsibleContent>
            <div className="border-t border-border/60" />

            <div className="p-4 space-y-5">
              {/* Quick setup */}
              <section className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-semibold">{labels.choosePreset}</h3>
                    <p className="text-xs text-muted-foreground">{labels.presetHint}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {["low", "mid", "high"].map((key) => {
                    const PresetIcon = key === "low" ? Shield : key === "mid" ? Scale : TrendingUp;
                    const isActive = activePreset === key;
                    const desc =
                      key === "low"
                        ? language === "ar"
                          ? "أقل مخاطرة وحجم أصغر"
                          : "Lower risk, smaller size"
                        : key === "mid"
                          ? language === "ar"
                            ? "خيار متوازن"
                            : "Balanced option"
                          : language === "ar"
                            ? "مخاطرة أعلى وحجم أكبر"
                            : "Higher risk, larger size";

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => applyPreset(key)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border border-border/50 bg-muted/10 p-4 text-left transition-colors min-h-[96px]",
                          "hover:border-primary/40 hover:bg-primary/5",
                          isActive && "border-primary/60 bg-primary/10"
                        )}
                      >
                        <div
                          className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center border",
                            isActive
                              ? "border-primary/60 bg-primary/10 text-primary"
                              : "border-border/60 text-muted-foreground"
                          )}
                        >
                          <PresetIcon className="w-4 h-4" />
                        </div>

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold truncate">{labels[key]}</span>
                            <span className="text-[11px] text-muted-foreground">{PRESETS[key].max_leverage}x</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
                          <p className="text-xs text-foreground/80">
                            {PRESETS[key].fixed_margin_usdt} USDT • {PRESETS[key].max_open_positions_total} {labels.trades}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Main controls */}
              <section className="space-y-4">
                <h3 className="text-sm font-semibold">{labels.mainControls}</h3>

                <div className="space-y-4">
                  <ControlBlock icon={DollarSign} title={labels.amountPerTrade} helper={labels.amountPerTradeDesc}>
                    <NumberSliderRow
                      value={settings.fixed_margin_usdt}
                      min={1}
                      max={200}
                      step={1}
                      unit="USDT"
                      onChange={(v) => update({ fixed_margin_usdt: v })}
                    />
                  </ControlBlock>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ControlBlock icon={SlidersHorizontal} title={labels.maxOpenTrades} helper={labels.maxOpenTradesDesc}>
                      <NumberSliderRow
                        value={settings.max_open_positions_total}
                        min={1}
                        max={10}
                        step={1}
                        onChange={(v) => update({ max_open_positions_total: v })}
                      />
                    </ControlBlock>

                    <ControlBlock icon={Gauge} title={labels.maxLeverage} helper={labels.maxLeverageDesc}>
                      <NumberSliderRow
                        value={settings.max_leverage}
                        min={1}
                        max={20}
                        step={1}
                        unit="x"
                        onChange={(v) => update({ max_leverage: v })}
                      />
                    </ControlBlock>
                  </div>

                  {/* Safety limit */}
                  <ControlBlock icon={ShieldCheck} title={labels.maxPerTrade} helper={labels.maxPerTradeDesc}>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={settings.max_margin_per_trade_usdt}
                        onChange={(e) => update({ max_margin_per_trade_usdt: Math.max(1, Number(e.target.value) || 1) })}
                        className="h-11 w-28 text-sm"
                        min={1}
                        inputMode="decimal"
                      />
                      <span className="text-xs text-muted-foreground">USDT</span>
                    </div>
                  </ControlBlock>
                </div>
              </section>

              {/* Outcome */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Activity className="w-4 h-4 text-primary" />
                  <span>{labels.whatToExpect}</span>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
                  <EstimatedOutcome
                    amount={settings.fixed_margin_usdt}
                    leverage={settings.max_leverage}
                    maxPerTrade={settings.max_margin_per_trade_usdt}
                    language={language}
                  />
                </div>
              </section>

              {/* Advanced */}
              <section className="space-y-2">
                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between rounded-lg border border-border/50 bg-muted/10 px-4 py-3 text-sm font-semibold text-foreground hover:border-primary/50"
                    >
                      <span>{labels.advanced}</span>
                      <ChevronDown className={cn("w-4 h-4 transition-transform", advancedOpen && "rotate-180")} />
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                      <FieldBlock label={labels.signalExpiry}>
                        <Input
                          type="number"
                          value={settings.signal_expiry_seconds}
                          onChange={(e) => update({ signal_expiry_seconds: Number(e.target.value) || 180 })}
                          className="h-11 text-sm"
                          inputMode="numeric"
                        />
                      </FieldBlock>
                      <FieldBlock label={labels.priceDeviation}>
                        <Input
                          type="number"
                          value={settings.max_entry_deviation_percent}
                          onChange={(e) => update({ max_entry_deviation_percent: Number(e.target.value) || 0.3 })}
                          className="h-11 text-sm"
                          step="0.1"
                          inputMode="decimal"
                        />
                      </FieldBlock>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </section>

              {/* Save */}
              <section className="space-y-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  size="sm"
                  className="w-full h-11 text-sm font-semibold bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin ltr:mr-2 rtl:ml-2" />
                  ) : (
                    <Save className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                  )}
                  {saving ? labels.saving : labels.save}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  {dirty ? (language === "ar" ? "لديك تغييرات غير محفوظة" : "You have unsaved changes") : labels.noChanges}
                </p>
              </section>
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
