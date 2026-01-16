import { useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Wallet, Copy, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function LiveAccountCard({ language = "en", onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState(null);
  const [depositAddresses, setDepositAddresses] = useState(null);
  const [copied, setCopied] = useState({});

  const handleCreateAccount = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('okxProvisioning', { action: 'ensureUserAccount' });
      
      if (!result.data?.ok) {
        throw new Error(result.data?.error?.message || 'Failed to create account');
      }
      
      setAccount(result.data.data);
      setDepositAddresses(result.data.data.depositAddresses);
      
      toast.success(
        result.data.data.isNew 
          ? (language === 'ar' ? 'تم إنشاء حساب التداول!' : 'Live account created successfully!')
          : (language === 'ar' ? 'تم تحميل الحساب' : 'Account loaded')
      );
      
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('[LiveAccount] Create error:', err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text, key) => {
    await navigator.clipboard.writeText(text);
    setCopied(prev => ({ ...prev, [key]: true }));
    toast.success(language === 'ar' ? 'تم النسخ' : 'Copied!');
    setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000);
  };

  return (
    <Card className="border-border shadow-lg rounded-2xl">
      <CardHeader className="border-b border-border bg-muted/30 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-md">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-foreground">
                {language === 'ar' ? 'حساب التداول المباشر' : 'Live Trading Account'}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {language === 'ar' ? 'حساب تداول حقيقي مع أموال حقيقية' : 'Real trading with real funds'}
              </p>
            </div>
          </div>
          {account && (
            <Badge className="bg-emerald-100 text-emerald-700 border-0">
              {language === 'ar' ? 'نشط' : 'Active'}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-5 space-y-4">
        {!account ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? 'قم بإنشاء حساب تداول مباشر للوصول إلى التداول الحقيقي والإيداع والسحب.'
                : 'Create a live trading account to access real trading, deposits, and withdrawals.'}
            </p>
            <Button
              onClick={handleCreateAccount}
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl"
            >
              {loading ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> {language === 'ar' ? 'جاري الإنشاء...' : 'Creating...'}</>
              ) : (
                <>{language === 'ar' ? 'إنشاء حساب مباشر' : 'Create Live Account'}</>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/20 p-4 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {language === 'ar' ? 'معرّف الحساب' : 'Account ID'}
                </span>
                <Badge variant="outline" className="text-xs">
                  {account.status}
                </Badge>
              </div>
              <div className="text-sm font-mono text-foreground break-all">
                {account.accountId}
              </div>
            </div>
            
            {depositAddresses && Object.keys(depositAddresses).length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  {language === 'ar' ? 'عناوين الإيداع' : 'Deposit Addresses'}
                </h4>
                
                {Object.entries(depositAddresses).map(([currency, data]) => {
                  if (data.error) return null;
                  if (!Array.isArray(data) || data.length === 0) return null;
                  
                  return (
                    <div key={currency} className="rounded-xl border border-border/50 bg-background p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-foreground">{currency}</span>
                        <Badge variant="outline" className="text-xs">
                          {data.length} {language === 'ar' ? 'شبكة' : 'network(s)'}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        {data.slice(0, 2).map((addr, idx) => (
                          <div key={idx} className="rounded-lg bg-muted/30 p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-muted-foreground">{addr.chain}</span>
                              {addr.selected && (
                                <CheckCircle className="h-3 w-3 text-emerald-500" />
                              )}
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
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                {language === 'ar'
                  ? 'تأكد من إرسال الأموال فقط عبر الشبكة الصحيحة. الإيداعات من شبكة خاطئة سوف تفقد بشكل دائم.'
                  : 'Only send funds via the correct network. Deposits from wrong networks will be lost permanently.'}
              </p>
            </div>
            
            <Button
              onClick={handleCreateAccount}
              disabled={loading}
              variant="outline"
              className="w-full rounded-xl"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {language === 'ar' ? 'تحديث العناوين' : 'Refresh Addresses'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

LiveAccountCard.propTypes = {
  language: PropTypes.string,
  onRefresh: PropTypes.func
};