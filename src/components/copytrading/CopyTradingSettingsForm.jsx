import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Loader2, Save, ShieldCheck, Zap } from "lucide-react";

export default function CopyTradingSettingsForm({ language }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    auto_enabled: false,
    mode: "FIXED_MARGIN",
    fixed_margin_usdt: 5,
    fixed_margin_percent: 0,
    risk_percent_equity: 1,
    leverage_mode: "FOLLOW_SIGNAL_CAP",
    fixed_leverage: 5,
    max_leverage: 20,
    max_margin_per_trade_usdt: 50,
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
        setSettings({ ...settings, ...res.data.data });
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validate
      if (settings.mode === 'FIXED_MARGIN' && settings.fixed_margin_usdt < 1) {
        throw new Error("Minimum margin is 1 USDT");
      }
      
      const res = await base44.functions.invoke("copyTradingUser", { 
        action: "saveSettings", 
        settings 
      });
      
      if (res.data?.ok) {
        toast.success(language === "ar" ? "تم حفظ الإعدادات" : "Settings saved");
      } else {
        throw new Error(res.data?.error?.message || "Save failed");
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" /></div>;

  const t = {
    enableAuto: language === "ar" ? "تفعيل القبول التلقائي" : "Enable Auto-Accept",
    autoDesc: language === "ar" ? "سيتم تنفيذ الإشارات الواردة تلقائياً بناءً على القواعد أدناه." : "Incoming signals will be executed automatically based on the rules below.",
    mode: language === "ar" ? "وضع التحجيم" : "Sizing Mode",
    fixedMargin: language === "ar" ? "هامش ثابت" : "Fixed Margin",
    riskBySl: language === "ar" ? "مخاطرة حسب وقف الخسارة" : "Risk % (by SL)",
    marginAmount: language === "ar" ? "مبلغ الهامش (USDT)" : "Margin Amount (USDT)",
    riskPercent: language === "ar" ? "نسبة المخاطرة من الرصيد (%)" : "Risk % of Balance",
    leverage: language === "ar" ? "الرافعة المالية" : "Leverage",
    followSignal: language === "ar" ? "تتبع الإشارة (بحد أقصى)" : "Follow Signal (Capped)",
    fixedLev: language === "ar" ? "رافعة ثابتة" : "Fixed Leverage",
    caps: language === "ar" ? "الحدود والضوابط" : "Guardrails & Limits",
    maxMargin: language === "ar" ? "أقصى هامش للصفقة" : "Max Margin per Trade",
    maxPos: language === "ar" ? "أقصى عدد صفقات مفتوحة" : "Max Open Positions",
    expiry: language === "ar" ? "وقت انتهاء الصلاحية (ثواني)" : "Signal Expiry (Seconds)",
    deviation: language === "ar" ? "أقصى انحراف للسعر (%)" : "Max Price Deviation (%)"
  };

  return (
    <div className="space-y-6">
      <Card className="border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/10">
        <CardContent className="p-6 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className={`h-5 w-5 ${settings.auto_enabled ? "text-blue-600 fill-blue-600" : "text-slate-400"}`} />
              <h3 className="font-bold text-lg">{t.enableAuto}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{t.autoDesc}</p>
          </div>
          <Switch 
            checked={settings.auto_enabled} 
            onCheckedChange={(v) => setSettings({...settings, auto_enabled: v})} 
          />
        </CardContent>
      </Card>

      <div className={`grid gap-6 md:grid-cols-2 ${!settings.auto_enabled ? "opacity-50 pointer-events-none" : ""}`}>
        {/* Sizing Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.mode}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select 
              value={settings.mode} 
              onValueChange={(v) => setSettings({...settings, mode: v})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIXED_MARGIN">{t.fixedMargin}</SelectItem>
                <SelectItem value="RISK_BY_SL">{t.riskBySl}</SelectItem>
              </SelectContent>
            </Select>

            {settings.mode === "FIXED_MARGIN" ? (
              <div className="space-y-2">
                <Label>{t.marginAmount}</Label>
                <Input 
                  type="number" 
                  value={settings.fixed_margin_usdt} 
                  onChange={(e) => setSettings({...settings, fixed_margin_usdt: Number(e.target.value)})}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{t.riskPercent}</Label>
                <div className="flex items-center gap-4">
                  <Slider 
                    value={[settings.risk_percent_equity]} 
                    min={0.1} max={5} step={0.1} 
                    onValueChange={(v) => setSettings({...settings, risk_percent_equity: v[0]})}
                    className="flex-1"
                  />
                  <span className="w-12 text-right font-mono">{settings.risk_percent_equity}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {language === "ar" 
                    ? "سيتم حساب حجم الصفقة بحيث لا تخسر أكثر من هذه النسبة إذا ضرب السعر وقف الخسارة." 
                    : "Position size calculates so you lose max this % if SL is hit."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leverage Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.leverage}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select 
              value={settings.leverage_mode} 
              onValueChange={(v) => setSettings({...settings, leverage_mode: v})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FOLLOW_SIGNAL_CAP">{t.followSignal}</SelectItem>
                <SelectItem value="FIXED">{t.fixedLev}</SelectItem>
              </SelectContent>
            </Select>

            {settings.leverage_mode === "FIXED" && (
              <div className="space-y-2">
                <Label>{t.fixedLev} (x)</Label>
                <Input 
                  type="number" 
                  value={settings.fixed_leverage} 
                  onChange={(e) => setSettings({...settings, fixed_leverage: Number(e.target.value)})}
                />
              </div>
            )}

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs text-muted-foreground uppercase">Cap (Max Limit)</Label>
              <div className="flex items-center gap-4">
                <Slider 
                  value={[settings.max_leverage]} 
                  min={1} max={20} step={1} 
                  onValueChange={(v) => setSettings({...settings, max_leverage: v[0]})}
                  className="flex-1"
                />
                <span className="w-12 text-right font-mono">{settings.max_leverage}x</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Guardrails */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base">{t.caps}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>{t.maxMargin}</Label>
              <Input 
                type="number" 
                value={settings.max_margin_per_trade_usdt} 
                onChange={(e) => setSettings({...settings, max_margin_per_trade_usdt: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.maxPos}</Label>
              <Input 
                type="number" 
                value={settings.max_open_positions_total} 
                onChange={(e) => setSettings({...settings, max_open_positions_total: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.expiry}</Label>
              <Input 
                type="number" 
                value={settings.signal_expiry_seconds} 
                onChange={(e) => setSettings({...settings, signal_expiry_seconds: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.deviation}</Label>
              <Input 
                type="number" 
                value={settings.max_entry_deviation_percent} 
                onChange={(e) => setSettings({...settings, max_entry_deviation_percent: Number(e.target.value)})}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pt-4">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white min-w-[150px]"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {language === "ar" ? "حفظ التغييرات" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}