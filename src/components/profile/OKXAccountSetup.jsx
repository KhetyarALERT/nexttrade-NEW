import { useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, Wallet, Copy, CheckCircle, AlertCircle, Shield, ExternalLink, Info } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function OKXAccountSetup({ language = "en", onComplete }) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('initial'); // initial, provisioning, ready, error
  const [accountData, setAccountData] = useState(null);
  const [errorData, setErrorData] = useState(null);
  const [depositAddresses, setDepositAddresses] = useState(null);
  const [copied, setCopied] = useState({});
  const [open, setOpen] = useState(false);

  const t = {
    en: {
      title: "Set Up Live Trading",
      description: "Create your live trading account to access real markets",
      createButton: "Create Live Account",
      creating: "Creating account...",
      success: "Account created successfully!",
      accountId: "Account ID",
      status: "Status",
      depositAddresses: "Deposit Addresses",
      network: "Network",
      address: "Address",
      copy: "Copy",
      copied: "Copied!",
      refresh: "Refresh Addresses",
      modeNotReady: "OKX Account Configuration Required",
      modeNotReadyDesc: "Your OKX master account must be configured for futures trading. Please:",
      modeStep1: "Log in to OKX web or mobile app",
      modeStep2: "Go to Account Settings → Trading Settings",
      modeStep3: "Set account level to 'Single-currency margin' or higher",
      modeStep4: "Come back and click 'Retry'",
      retry: "Retry Setup",
      close: "Close",
      warning: "Only send funds via the correct network. Wrong network = permanent loss.",
      viewInDashboard: "View in Dashboard"
    },
    ar: {
      title: "إعداد التداول المباشر",
      description: "أنشئ حساب تداول مباشر للوصول إلى الأسواق الحقيقية",
      createButton: "إنشاء حساب مباشر",
      creating: "جاري الإنشاء...",
      success: "تم إنشاء الحساب بنجاح!",
      accountId: "معرّف الحساب",
      status: "الحالة",
      depositAddresses: "عناوين الإيداع",
      network: "الشبكة",
      address: "العنوان",
      copy: "نسخ",
      copied: "تم النسخ!",
      refresh: "تحديث العناوين",
      modeNotReady: "يلزم تكوين حساب OKX",
      modeNotReadyDesc: "يجب تكوين حساب OKX الرئيسي الخاص بك لتداول العقود الآجلة. يرجى:",
      modeStep1: "تسجيل الدخول إلى تطبيق OKX أو الويب",
      modeStep2: "انتقل إلى إعدادات الحساب ← إعدادات التداول",
      modeStep3: "تعيين مستوى الحساب إلى 'هامش عملة واحدة' أو أعلى",
      modeStep4: "ارجع واضغط على 'إعادة المحاولة'",
      retry: "إعادة المحاولة",
      close: "إغلاق",
      warning: "أرسل الأموال فقط عبر الشبكة الصحيحة. شبكة خاطئة = خسارة دائمة.",
      viewInDashboard: "عرض في لوحة التحكم"
    }
  };

  const text = t[language] || t.en;

  const handleSetup = async () => {
    setLoading(true);
    setStep('provisioning');
    setErrorData(null);

    try {
      const result = await base44.functions.invoke('okxProvisioning', { action: 'ensureUserAccount' });
      
      if (!result.data?.ok) {
        const error = result.data?.error;
        
        // Handle OKX mode not ready
        if (error?.code === 'OKX_MODE_NOT_READY') {
          setStep('error');
          setErrorData(error);
          return;
        }
        
        throw new Error(error?.message || 'Failed to create account');
      }
      
      setAccountData(result.data.data);
      setDepositAddresses(result.data.data.depositAddresses);
      setStep('ready');
      
      toast.success(text.success);
      if (onComplete) onComplete(result.data.data);
      
    } catch (err) {
      console.error('[OKXSetup] Error:', err);
      setStep('error');
      setErrorData({ code: 'UNKNOWN', message: err.message });
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (value, key) => {
    await navigator.clipboard.writeText(value);
    setCopied(prev => ({ ...prev, [key]: true }));
    toast.success(text.copied);
    setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000);
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        className="rounded-xl border-emerald-500/50 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
      >
        <Wallet className="w-4 h-4 mr-2" />
        {text.createButton}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600" />
              {text.title}
            </DialogTitle>
            <DialogDescription>{text.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Initial / Ready State */}
            {(step === 'initial' || step === 'ready') && (
              <>
                {step === 'initial' && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-700">
                      {language === 'ar'
                        ? 'سيتم إنشاء حساب تداول مباشر مع عناوين إيداع فريدة.'
                        : 'A live trading account will be created with unique deposit addresses.'}
                    </AlertDescription>
                  </Alert>
                )}

                {step === 'ready' && accountData && (
                  <div className="space-y-4">
                    <Alert className="bg-emerald-50 border-emerald-200">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <AlertDescription className="text-sm text-emerald-700">
                        {text.success}
                      </AlertDescription>
                    </Alert>

                    <div className="rounded-xl border border-border bg-muted/20 p-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground block mb-1">{text.accountId}</span>
                          <code className="text-xs font-mono text-foreground">{accountData.accountId}</code>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">{text.status}</span>
                          <Badge className="bg-emerald-100 text-emerald-700 border-0">
                            {accountData.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {depositAddresses && Object.keys(depositAddresses).length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-foreground">{text.depositAddresses}</h4>
                        
                        {Object.entries(depositAddresses).map(([currency, data]) => {
                          if (data.error) return null;
                          if (!Array.isArray(data) || data.length === 0) return null;
                          
                          return (
                            <div key={currency} className="rounded-xl border border-border bg-background p-4">
                              <div className="flex items-center justify-between mb-3">
                                <span className="font-semibold text-foreground">{currency}</span>
                                <Badge variant="outline" className="text-xs">
                                  {data.length} {text.network}
                                </Badge>
                              </div>
                              
                              {data.map((addr, idx) => (
                                <div key={idx} className="rounded-lg bg-muted/30 p-3 mb-2">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-muted-foreground">{addr.chain}</span>
                                    {addr.selected && <CheckCircle className="h-3 w-3 text-emerald-500" />}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <code className="text-xs font-mono text-foreground break-all flex-1">
                                      {addr.address}
                                    </code>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleCopy(addr.address, `${currency}_${idx}`)}
                                      className="h-7 w-7 p-0"
                                    >
                                      {copied[`${currency}_${idx}`] ? (
                                        <CheckCircle className="h-3 w-3 text-emerald-500" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </div>
                                  {addr.tag && (
                                    <div className="mt-2 text-xs text-muted-foreground">
                                      Tag: <code className="font-mono">{addr.tag}</code>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <Alert className="bg-amber-50 border-amber-200">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-xs text-amber-700">
                        {text.warning}
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                <div className="flex gap-2">
                  {step === 'ready' && (
                    <Button
                      onClick={handleSetup}
                      disabled={loading}
                      variant="outline"
                      className="flex-1"
                    >
                      {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                      {text.refresh}
                    </Button>
                  )}
                  <Button
                    onClick={step === 'initial' ? handleSetup : () => setOpen(false)}
                    disabled={loading}
                    className={`${step === 'initial' ? 'flex-1' : ''} bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white`}
                  >
                    {loading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                    {step === 'initial' ? text.createButton : text.close}
                  </Button>
                </div>
              </>
            )}

            {/* OKX Mode Not Ready */}
            {step === 'error' && errorData?.code === 'OKX_MODE_NOT_READY' && (
              <div className="space-y-4">
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <AlertDescription className="text-sm text-amber-900 font-medium">
                    {text.modeNotReady}
                  </AlertDescription>
                </Alert>

                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">{text.modeNotReadyDesc}</p>
                  
                  <ol className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</span>
                      <span>{text.modeStep1}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</span>
                      <span>{text.modeStep2}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">3</span>
                      <span>{text.modeStep3}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">4</span>
                      <span>{text.modeStep4}</span>
                    </li>
                  </ol>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://www.okx.com/account/settings', '_blank')}
                    className="w-full"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {language === 'ar' ? 'فتح إعدادات OKX' : 'Open OKX Settings'}
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setOpen(false)} variant="outline" className="flex-1">
                    {text.close}
                  </Button>
                  <Button
                    onClick={handleSetup}
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                  >
                    {loading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                    {text.retry}
                  </Button>
                </div>
              </div>
            )}

            {/* Generic Error */}
            {step === 'error' && errorData && errorData.code !== 'OKX_MODE_NOT_READY' && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {errorData.message}
                  </AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Button onClick={() => setOpen(false)} variant="outline" className="flex-1">
                    {text.close}
                  </Button>
                  <Button onClick={handleSetup} disabled={loading} className="flex-1">
                    {loading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                    {text.retry}
                  </Button>
                </div>
              </div>
            )}

            {/* Provisioning */}
            {step === 'provisioning' && (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw className="h-12 w-12 animate-spin text-blue-600 mb-4" />
                <p className="text-muted-foreground font-medium">{text.creating}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

OKXAccountSetup.propTypes = {
  language: PropTypes.string,
  onComplete: PropTypes.func
};