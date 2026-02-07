import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Zap, ZapOff, Loader2, Save, ShieldCheck,
  ChevronDown, HelpCircle, Shield, Scale, TrendingUp, Settings2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import EstimatedOutcome from "./EstimatedOutcome";
import NumericInput from "./NumericInput";

/* ─── i18n ────────────────────────────────────────────── */
const t = {
  en: {
    autoTrade: "Auto-Trade",
    autoTradeDesc: "Automatically accept signals from experts",
    on: "ON",
    off: "OFF",
    perTradeBudget: "Per-trade budget",
    leverageLimit: "Leverage limit",
    maxTradesAtOnce: "Max trades at once",
    totalBudgetCap: "Total budget cap",
    save: "Save Settings",
    saving: "Saving...",
    saved: "Settings saved!",
    low: "Conservative",
    lowSub: "Smaller swings",
    mid: "Moderate",
    midSub: "Balanced",
    high: "Aggressive",
    highSub: "Bigger swings",
    recommended: "Recommended",
    showAdvanced: "Advanced",
    hideAdvanced: "Hide Advanced",
    trades: "trades",
    leverageHelp: "Leverage multiplies your trade size. 10× means $10 controls $100. Higher leverage = higher profit potential AND higher risk.",
    autoTradeHelp: "When on, new expert signals are executed automatically using your settings. No manual accept needed.",
    summaryPerTrade: "Per trade",
    summaryUpTo: "up to",
    summaryLev: "Leverage",
    summaryExposure: "Exposure",
  },
  ar: {
    autoTrade: "التداول التلقائي",
    autoTradeDesc: "قبول الإشارات تلقائياً من الخبراء",
    on: "مفعّل",
    off: "متوقف",
    perTradeBudget: "ميزانية كل صفقة",
    leverageLimit: "حد الرافعة",
    maxTradesAtOnce: "أقصى صفقات في وقت واحد",
    totalBudgetCap: "سقف الميزانية الإجمالي",
    save: "حفظ الإعدادات",
    saving: "جارٍ الحفظ...",
    saved: "تم حفظ الإعدادات!",
    low: "محافظ",
    lowSub: "تقلبات صغيرة",
    mid: "متوسط",
    midSub: "متوازن",
    high: "عدواني",
    highSub: "تقلبات أكبر",
    recommended: "موصى به",
    showAdvanced: "متقدم",
    hideAdvanced: "إخفاء المتقدمة",
    trades: "صفقات",
    leverageHelp: "الرافعة تضاعف حجم صفقتك. رافعة 10× تعني أن $10 تتحكم بـ $100.",
    autoTradeHelp: "عند التفعيل، يتم تنفيذ إشارات الخبراء تلقائياً حسب إعداداتك.",
    summaryPerTrade: "لكل صفقة",
    summaryUpTo: "حتى",
    summaryLev: "رافعة",
    summaryExposure: "تعرض",
  },
};

/* ─── Presets ──────────────────────────────────────────── */
const PRESETS = {
  low:  { fixed_margin_usdt: 5,  max_leverage: 5,  max_open_positions_total: 3, max_margin_per_trade_usdt: 10 },
  mid:  { fixed_margin_usdt: 10, max_leverage: 10, max_open_positions_total: 5, max_margin_per_trade_usdt: 25 },
  high: { fixed_margin_usdt: 25, max_leverage: 20, max_open_positions_total: 8, max_margin_per_trade_usdt: 50 },
};

/* ─── Helpers ─────────────────────────────────────────── */
function HelpTip({ content, side = "bottom" }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="text-muted-foreground/50 hover:text-foreground transition-colors ml-1">
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} className="max-w-[240px] text-xs leading-relaxed p-3 text-foreground/80">
        {content}
      </PopoverContent>
    </Popover>
  );
}

/* ─── Main Component ──────────────────────────────────── */
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
    max_entry_deviation_percent: 0.3,
  });

  useEffect(() => { loadSettings(); }, []);

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

  const applyPreset = (key) => update(PRESETS[key]);

  /* ─── Derived summary (single source of truth) ───── */
  const summary = useMemo(() => {
    const perTrade = Math.min(settings.fixed_margin_usdt, settings.max_margin_per_trade_usdt);
    const totalExposure = perTrade * settings.max_open_positions_total;
    return { perTrade, totalExposure };
  }, [settings.fixed_margin_usdt, settings.max_margin_per_trade_usdt, settings.max_open_positions_total]);

  /* ─── Active preset detection ───── */
  const activePreset = Object.entries(PRESETS).find(([, v]) =>
    v.fixed_margin_usdt === settings.fixed_margin_usdt &&
    v.max_leverage === settings.max_leverage &&
    v.max_open_positions_total === settings.max_open_positions_total
  )?.[0] || null;

  /* ─── Toggle (auto-save) ───── */
  const handleToggle = async (enabled) => {
    update({ auto_enabled: enabled });
    setSaving(true);
    try {
      const updatedSettings = { ...settings, auto_enabled: enabled };
      const res = await base44.functions.invoke("copyTradingUser", { action: "saveSettings", settings: updatedSettings });
      if (res.data?.ok) {
        toast.success(enabled
          ? (language === "ar" ? "التداول التلقائي مفعّل" : "Auto-Trade enabled")
          : (language === "ar" ? "التداول التلقائي متوقف" : "Auto-Trade disabled")
        );
        setDirty(false);
        setSettings(updatedSettings);
      } else {
        throw new Error(res.data?.error?.message || "Save failed");
      }
    } catch (e) {
      toast.error(e.message);
      update({ auto_enabled: !enabled });
    } finally {
      setSaving(false);
    }
  };

  /* ─── Save ───── */
  const handleSave = async () => {
    setSaving(true);
    try {
      if (settings.fixed_margin_usdt < 1) throw new Error(language === "ar" ? "الحد الأدنى 1 USDT" : "Minimum is 1 USDT");
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
      </div>
    );
  }

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      <Collapsible open={panelOpen} onOpenChange={setPanelOpen}>
        {/* ─── Compact Header ─── */}
        <div className={cn(
          "rounded-xl border transition-all duration-200",
          settings.auto_enabled
            ? "border-primary/30 bg-gradient-to-r from-primary/5 via-primary/[0.03] to-transparent"
            : "border-border/40 bg-card/50"
        )}>
          <div className="flex items-center justify-between p-3 gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                settings.auto_enabled ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground"
              )}>
                {settings.auto_enabled ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-foreground tracking-tight">{labels.autoTrade}</span>
                  <HelpTip content={labels.autoTradeHelp} />
                </div>
                {/* Live Summary — always reflects current settings */}
                {settings.auto_enabled && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono tracking-wide leading-tight">
                    {labels.summaryPerTrade}: {summary.perTrade} USDT · {labels.summaryUpTo} {settings.max_open_positions_total} {labels.trades} · {settings.max_leverage}× · {labels.summaryExposure}: {summary.totalExposure} USDT
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Switch
                checked={settings.auto_enabled}
                onCheckedChange={handleToggle}
                disabled={saving}
                className={cn("data-[state=checked]:bg-primary", saving && "opacity-50")}
              />
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
                    "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    panelOpen && "bg-muted/50 text-foreground"
                  )}
                >
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", panelOpen && "rotate-180")} />
                </button>
              </CollapsibleTrigger>
            </div>
          </div>

          {/* ─── Expandable Body ─── */}
          <CollapsibleContent>
            <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/30">

              {/* ── Risk Presets ── */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                {(["low", "mid", "high"]).map((key) => {
                  const Icon = key === "low" ? Shield : key === "mid" ? Scale : TrendingUp;
                  const colors = {
                    low: "text-blue-500 bg-blue-500/10 border-blue-500/20",
                    mid: "text-amber-500 bg-amber-500/10 border-amber-500/20",
                    high: "text-rose-500 bg-rose-500/10 border-rose-500/20",
                  };
                  const isActive = activePreset === key;
                  const isMid = key === "mid";
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyPreset(key)}
                      className={cn(
                        "relative py-2 px-2 rounded-lg text-xs font-medium transition-all border",
                        isActive
                          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                          : cn("hover:border-primary/20", colors[key])
                      )}
                    >
                      {isMid && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-bold uppercase tracking-wider bg-amber-500 text-white px-1.5 py-0 rounded-full leading-relaxed">
                          {labels.recommended}
                        </span>
                      )}
                      <Icon className={cn("w-4 h-4 mx-auto mb-0.5", isActive ? "text-primary" : "")} />
                      <span className={cn("block text-[11px] font-semibold", isActive ? "text-primary" : "text-foreground")}>
                        {labels[key]}
                      </span>
                      <span className="block text-[9px] text-muted-foreground mt-0.5">
                        {labels[key + "Sub"]}
                      </span>
                      <span className="block text-[9px] text-muted-foreground font-mono">
                        {PRESETS[key].fixed_margin_usdt}$ · {PRESETS[key].max_leverage}×
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* ── Per-trade Budget ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{labels.perTradeBudget}</span>
                  <NumericInput
                    value={settings.fixed_margin_usdt}
                    onChange={(v) => update({ fixed_margin_usdt: v })}
                    min={1}
                    max={1000}
                    suffix="USDT"
                  />
                </div>
                <Slider
                  value={[settings.fixed_margin_usdt]}
                  min={1}
                  max={100}
                  step={1}
                  onValueChange={([v]) => update({ fixed_margin_usdt: v })}
                  className="w-full"
                />
              </div>

              {/* ── Leverage & Trades (compact row) ── */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/40 bg-card/60 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{labels.leverageLimit}</span>
                    <HelpTip content={labels.leverageHelp} side="top" />
                  </div>
                  <div className="text-center">
                    <span className="font-mono text-xl font-bold text-foreground tracking-tighter">
                      {settings.max_leverage}<span className="text-xs font-normal text-muted-foreground">×</span>
                    </span>
                  </div>
                  <Slider
                    value={[settings.max_leverage]}
                    min={1}
                    max={20}
                    step={1}
                    onValueChange={([v]) => update({ max_leverage: v })}
                  />
                </div>
                <div className="rounded-lg border border-border/40 bg-card/60 p-2.5 space-y-1.5">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">{labels.maxTradesAtOnce}</span>
                  <div className="text-center">
                    <span className="font-mono text-xl font-bold text-foreground tracking-tighter">
                      {settings.max_open_positions_total}
                    </span>
                  </div>
                  <Slider
                    value={[settings.max_open_positions_total]}
                    min={1}
                    max={10}
                    step={1}
                    onValueChange={([v]) => update({ max_open_positions_total: v })}
                  />
                </div>
              </div>

              {/* ── Total Budget Cap ── */}
              <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs font-medium text-foreground">{labels.totalBudgetCap}</span>
                </div>
                <NumericInput
                  value={settings.max_margin_per_trade_usdt}
                  onChange={(v) => update({ max_margin_per_trade_usdt: v })}
                  min={1}
                  max={10000}
                  suffix="USDT"
                  inputClassName="border-emerald-500/20"
                />
              </div>

              {/* ── Live Summary Bar ── */}
              <div className="rounded-lg bg-muted/30 border border-border/20 px-3 py-2 text-center">
                <p className="text-[11px] font-mono text-foreground/70 tabular-nums leading-relaxed">
                  {labels.summaryPerTrade}: <span className="font-semibold text-foreground">{summary.perTrade} USDT</span>
                  {" · "}
                  {labels.summaryUpTo} <span className="font-semibold text-foreground">{settings.max_open_positions_total}</span> {labels.trades}
                  {" · "}
                  {labels.summaryLev}: <span className="font-semibold text-foreground">{settings.max_leverage}×</span>
                  {" · "}
                  {labels.summaryExposure}: <span className="font-semibold text-foreground">{summary.totalExposure} USDT</span>
                </p>
              </div>

              {/* ── Estimated Outcome ── */}
              <EstimatedOutcome
                amount={settings.fixed_margin_usdt}
                leverage={settings.max_leverage}
                maxPerTrade={settings.max_margin_per_trade_usdt}
                language={language}
              />

              {/* ── Advanced ── */}
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider font-medium"
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
                      <NumericInput
                        value={settings.signal_expiry_seconds}
                        onChange={(v) => update({ signal_expiry_seconds: v })}
                        min={30}
                        max={600}
                        className="w-full"
                        inputClassName="w-full"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-medium">
                        {language === "ar" ? "انحراف السعر %" : "Price Deviation %"}
                      </label>
                      <NumericInput
                        value={settings.max_entry_deviation_percent}
                        onChange={(v) => update({ max_entry_deviation_percent: v })}
                        min={0.1}
                        max={5}
                        step={0.1}
                        suffix="%"
                        className="w-full"
                        inputClassName="w-full"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ── Save Button ── */}
              {dirty && (
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  size="sm"
                  className="w-full h-8 text-xs font-semibold bg-primary hover:bg-primary/90 shadow-sm"
                >
                  {saving
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5" />
                    : <Save className="w-3.5 h-3.5 ltr:mr-1.5 rtl:ml-1.5" />
                  }
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
  language: PropTypes.string,
};