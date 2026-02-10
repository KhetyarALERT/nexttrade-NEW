import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
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
  Settings2,
  Shield,
  Scale,
  TrendingUp,
  Target,
  Activity,
  Wallet
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import EstimatedOutcome from "./EstimatedOutcome";

const t = {
  en: {
    autoTrade: "Auto-Trade",
    configBot: "Configure your trading bot",
    riskPresets: "Risk Presets",
    safe: "Safe",
    balanced: "Balanced",
    pro: "Pro",
    tradeAmount: "Trade Amount",
    leverage: "Leverage (Risk)",
    maxTrades: "Max Open Trades",
    safetyLimit: "Safety Limit",
    save: "Save",
    saving: "Saving...",
    saved: "Settings updated",
    advanced: "Advanced",
    expiry: "Expiry (s)",
    deviation: "Dev %",
    leverageHelp: "Leverage multiplies your trade size. Higher leverage = higher profit potential but higher risk.",
    autoTradeHelp: "When enabled, expert signals are executed automatically using these settings."
  },
  ar: {
    autoTrade: "تداول تلقائي",
    configBot: "قم بضبط بوت التداول الخاص بك",
    riskPresets: "إعدادات المخاطرة",
    safe: "آمن",
    balanced: "متوازن",
    pro: "متقدم",
    tradeAmount: "مبلغ الصفقة",
    leverage: "الرافعة (المخاطرة)",
    maxTrades: "أقصى صفقات",
    safetyLimit: "حد الأمان",
    save: "حفظ",
    saving: "جارٍ الحفظ...",
    saved: "تم التحديث",
    advanced: "متقدم",
    expiry: "الانتهاء (ث)",
    deviation: "الانحراف %",
    leverageHelp: "الرافعة تضاعف حجم صفقتك. رافعة أعلى تعني ربحاً محتملاً أكبر ولكن مخاطرة أعلى.",
    autoTradeHelp: "عند التفعيل، يتم تنفيذ إشارات الخبراء تلقائياً حسب هذه الإعدادات."
  }
};

const PRESETS = {
  low: { fixed_margin_usdt: 5, max_leverage: 3, max_open_positions_total: 2, max_margin_per_trade_usdt: 10 },
  mid: { fixed_margin_usdt: 10, max_leverage: 10, max_open_positions_total: 5, max_margin_per_trade_usdt: 25 },
  high: { fixed_margin_usdt: 25, max_leverage: 20, max_open_positions_total: 8, max_margin_per_trade_usdt: 50 }
};

const Help = ({ content }) => (
  <Popover>
    <PopoverTrigger asChild>
      <button type="button" className="opacity-30 hover:opacity-100 transition-opacity ml-1.5 outline-none">
        <Info className="w-3.5 h-3.5" />
      </button>
    </PopoverTrigger>
    <PopoverContent side="top" className="w-64 p-3 text-[12px] leading-relaxed bg-popover/95 backdrop-blur-md shadow-2xl border-primary/10 rounded-xl">
      {content}
    </PopoverContent>
  </Popover>
);

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
      if (res.data?.ok && res.data.data) setSettings(prev => ({ ...prev, ...res.data.data }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const update = (changes) => {
    setSettings(prev => ({ ...prev, ...changes }));
    setDirty(true);
  };

  const handleToggle = async (enabled) => {
    update({ auto_enabled: enabled });
    setSaving(true);
    try {
      const res = await base44.functions.invoke("copyTradingUser", { action: "saveSettings", settings: { ...settings, auto_enabled: enabled } });
      if (res.data?.ok) {
        toast.success(enabled ? (language === "ar" ? "مفعّل" : "Auto-Trade Active") : (language === "ar" ? "متوقف" : "Auto-Trade Paused"));
        setDirty(false);
      }
    } catch (e) {
      toast.error(e.message);
      update({ auto_enabled: !enabled });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("copyTradingUser", { action: "saveSettings", settings });
      if (res.data?.ok) {
        toast.success(labels.saved);
        setDirty(false);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary/30" /></div>;

  const activePreset = Object.entries(PRESETS).find(([, v]) => 
    v.fixed_margin_usdt === settings.fixed_margin_usdt && 
    v.max_leverage === settings.max_leverage
  )?.[0];

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="w-full font-sans">
      <Collapsible open={panelOpen} onOpenChange={setPanelOpen}>
        <div className={cn(
          "rounded-2xl border transition-all duration-500 overflow-hidden",
          settings.auto_enabled ? "border-primary/40 bg-primary/[0.03] shadow-xl shadow-primary/5" : "border-border/60 bg-card/40 backdrop-blur-sm"
        )}>
          {/* Header Section */}
          <div className="flex items-center justify-between px-3 py-2.5 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500",
                settings.auto_enabled ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "bg-muted/80 text-muted-foreground"
              )}>
                {settings.auto_enabled ? <Zap className="w-4.5 h-4.5 fill-current" /> : <ZapOff className="w-4.5 h-4.5" />}
              </div>
              <div className="truncate">
                <div className="flex items-center gap-1">
                  <span className="text-[13px] font-bold tracking-tight text-foreground">{labels.autoTrade}</span>
                  <Help content={labels.autoTradeHelp} />
                </div>
                <p className="text-[10px] text-muted-foreground font-medium opacity-70 truncate">
                  {labels.configBot}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={settings.auto_enabled} onCheckedChange={handleToggle} disabled={saving} className="data-[state=checked]:bg-emerald-500" />
              <CollapsibleTrigger asChild>
                <button type="button" className="w-7 h-7 rounded-full hover:bg-muted/80 flex items-center justify-center transition-all">
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-500", panelOpen && "rotate-180")} />
                </button>
              </CollapsibleTrigger>
            </div>
          </div>

          <CollapsibleContent className="border-t border-border/20">
            <div className="p-3 space-y-5">
              
              {/* Risk Presets */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <div className="h-1 w-4 bg-primary/30 rounded-full" />
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.15em]">{labels.riskPresets}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["low", "mid", "high"].map(key => {
                    const Icon = key === "low" ? Shield : key === "mid" ? Scale : TrendingUp;
                    const active = activePreset === key;
                    const config = {
                      low: { color: "text-emerald-500", bg: "bg-emerald-500/10", label: labels.safe },
                      mid: { color: "text-amber-500", bg: "bg-amber-500/10", label: labels.balanced },
                      high: { color: "text-rose-500", bg: "bg-rose-500/10", label: labels.pro }
                    };
                    return (
                      <button key={key} onClick={() => update(PRESETS[key])} className={cn(
                        "flex flex-col items-center py-2.5 px-1.5 rounded-xl border-2 transition-all duration-300 group",
                        active ? "border-primary bg-primary/[0.04] shadow-md" : "border-transparent bg-muted/30 hover:bg-muted/50"
                      )}>
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-1.5 transition-transform group-hover:scale-110", active ? config[key].bg + " " + config[key].color : "bg-background/80 text-muted-foreground")}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className={cn("text-[11px] font-bold tracking-tight", active ? "text-primary" : "text-muted-foreground")}>{config[key].label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Main Controls */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-0.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-muted/50 flex items-center justify-center">
                        <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-[12px] font-bold text-foreground/90">{labels.tradeAmount}</span>
                    </div>
                    <span className="text-[13px] font-mono font-black text-primary tracking-tight">${settings.fixed_margin_usdt}</span>
                  </div>
                  <Slider value={[settings.fixed_margin_usdt]} min={1} max={100} step={1} onValueChange={([v]) => update({ fixed_margin_usdt: v })} className="py-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-0.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-muted/50 flex items-center justify-center">
                        <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-[12px] font-bold text-foreground/90">{labels.leverage}</span>
                    </div>
                    <span className="text-[13px] font-mono font-black text-primary tracking-tight">x{settings.max_leverage}</span>
                  </div>
                  <Slider value={[settings.max_leverage]} min={1} max={20} step={1} onValueChange={([v]) => update({ max_leverage: v })} className="py-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-0.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-muted/50 flex items-center justify-center">
                        <Target className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-[12px] font-bold text-foreground/90">{labels.maxTrades}</span>
                    </div>
                    <span className="text-[13px] font-mono font-black text-primary tracking-tight">{settings.max_open_positions_total}</span>
                  </div>
                  <Slider value={[settings.max_open_positions_total]} min={1} max={10} step={1} onValueChange={([v]) => update({ max_open_positions_total: v })} className="py-2" />
                </div>
              </div>

              {/* Safety Limit */}
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-primary/20 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
                <div className="relative flex items-center justify-between p-3 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/10 shadow-inner">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    </div>
                    <span className="text-[12px] font-bold text-foreground/90">{labels.safetyLimit}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-background/60 px-3 py-1.5 rounded-lg border border-emerald-500/10 shadow-sm">
                    <span className="text-[11px] font-bold text-emerald-500/60">$</span>
                    <input type="number" value={settings.max_margin_per_trade_usdt} onChange={e => update({ max_margin_per_trade_usdt: Number(e.target.value) })} className="w-12 bg-transparent text-right text-[13px] font-mono font-black focus:outline-none text-foreground" />
                  </div>
                </div>
              </div>

              {/* Advanced & Outcome */}
              <div className="space-y-4">
                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <CollapsibleTrigger asChild>
                    <button type="button" className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-muted/20 hover:bg-muted/40 transition-all group">
                      <div className="flex items-center gap-2">
                        <Settings2 className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{labels.advanced}</span>
                      </div>
                      <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-500", advancedOpen && "rotate-180")} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 grid grid-cols-2 gap-3 px-0.5">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase px-0.5">{labels.expiry} (s)</span>
                      <div className="p-2 rounded-lg border border-border/40 bg-muted/10">
                        <input type="number" value={settings.signal_expiry_seconds} onChange={e => update({ signal_expiry_seconds: Number(e.target.value) })} className="w-full bg-transparent text-center text-[12px] font-mono font-bold focus:outline-none" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase px-0.5">{labels.deviation} %</span>
                      <div className="p-2 rounded-lg border border-border/40 bg-muted/10">
                        <input type="number" step="0.1" value={settings.max_entry_deviation_percent} onChange={e => update({ max_entry_deviation_percent: Number(e.target.value) })} className="w-full bg-transparent text-center text-[12px] font-mono font-bold focus:outline-none" />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="pt-2">
                  <EstimatedOutcome amount={settings.fixed_margin_usdt} leverage={settings.max_leverage} maxPerTrade={settings.max_margin_per_trade_usdt} language={language} />
                </div>
              </div>

              {/* Save Button */}
              <div className={cn(
                "transition-all duration-500 overflow-hidden",
                dirty ? "max-h-20 opacity-100 mt-1" : "max-h-0 opacity-0"
              )}>
                <Button onClick={handleSave} disabled={saving} className="w-full h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-[12px] font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.97] flex items-center justify-center gap-1.5">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? labels.saving : labels.save}
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

AutoTradeSettings.propTypes = { language: PropTypes.string };
