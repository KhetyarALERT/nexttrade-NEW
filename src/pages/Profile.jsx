import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  RefreshCw,
  LifeBuoy,
  LogOut,
  Clock,
  Copy,
  CheckCircle2,
  User,
  Lock,
  Gift,
  ExternalLink,
  ChevronRight,
  Upload,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Activity,
  History,
  Bell,
  Globe,
  Settings
} from "lucide-react";
import TradingAccountCard from "@/components/profile/TradingAccountCard";
import TradesTable from "@/components/profile/TradesTable";
import AssetsPage from "@/components/profile/AssetsPage";
import RecentTransactions from "@/components/profile/RecentTransactions";
import StakingPanel from "@/components/profile/StakingPanel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import NotificationPreferencesTab from "@/components/profile/NotificationPreferencesTab.jsx";
import { fetchCurrentUser, updateCurrentUser } from "@/api/functions";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

const translations = {
  en: {
    heroTitle: "Account Center",
    personalInfo: "Personal Information",
    security: "Security",
    referrals: "Referrals",
    vouchers: "Vouchers",
    trades: "Trades",
    displayNameLabel: "Display Name",
    bioLabel: "Bio",
    saveChanges: "Save",
    saving: "Saving...",
    notVerified: "Not Verified",
    verified: "Verified",
    passwordLabel: "Password",
    managePassword: "Change",
    twoFactor: "2FA",
    loginActivity: "Login Activity",
    referralCode: "Referral Code",
    referralLink: "Referral Link",
    copySuccess: "Copied",
    logout: "Logout",
    refresh: "Refresh",
    support: "Support",
    updateSuccess: "Profile updated",
    loadError: "Failed to load"
  },
  ar: {
    heroTitle: "مركز الحساب",
    personalInfo: "المعلومات الشخصية",
    security: "الأمان",
    referrals: "الإحالات",
    vouchers: "القسائم",
    trades: "الصفقات",
    displayNameLabel: "الاسم",
    bioLabel: "نبذة",
    saveChanges: "حفظ",
    saving: "جاري الحفظ...",
    notVerified: "غير موثق",
    verified: "موثق",
    passwordLabel: "كلمة المرور",
    managePassword: "تغيير",
    twoFactor: "التحقق",
    loginActivity: "نشاط الدخول",
    referralCode: "كود الإحالة",
    referralLink: "رابط الإحالة",
    copySuccess: "تم النسخ",
    logout: "خروج",
    refresh: "تحديث",
    support: "الدعم",
    updateSuccess: "تم التحديث",
    loadError: "فشل التحميل"
  }
};

const normalizeUserProfile = (user = {}) => ({
  uuid: user.id || "---",
  fullName: user.fullName || user.name || "",
  email: user.email || "",
  bio: user.bio || "",
  avatarUrl: user.avatarUrl || "",
  verificationStatus: user.verificationStatus || "not_verified",
  twoFactorEnabled: user.twoFactorEnabled || false,
  referralCode: user.referralCode || "NEXT-7829",
  referralLink: `https://nexttrade.app/ref/${user.referralCode || "NEXT-7829"}`
});

export default function Profile({ language = "en" }) {
  const t = translations[language] || translations.en;
  const { toast } = useToast();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [formState, setFormState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [demoAccount, setDemoAccount] = useState(null);
  const [liveAccount, setLiveAccount] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loadingAccount, setLoadingAccount] = useState(false);

  const loadUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCurrentUser();
      setUser(data);
      setFormState(normalizeUserProfile(data));
    } catch (err) {
      console.error("Failed to load user", err);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  const loadTradingAccounts = useCallback(async () => {
    setLoadingAccount(true);
    try {
      const [demoResult, liveResult, walletsResult, tradesResult] = await Promise.all([
        base44.functions.invoke('tradingAccount', { action: 'getOrCreate', accountType: 'demo' }),
        base44.functions.invoke('tradingAccount', { action: 'getOrCreate', accountType: 'live' }),
        base44.functions.invoke('wallet', { action: 'list' }),
        base44.functions.invoke('tradingAccount', { action: 'getTrades' })
      ]);
      
      if (demoResult.data?.success) setDemoAccount(demoResult.data.data);
      if (liveResult.data?.success) setLiveAccount(liveResult.data.data);
      if (walletsResult.data?.success) setWallets(walletsResult.data.data || []);
      if (tradesResult.data?.success) setTrades(tradesResult.data.data || []);
    } catch (err) {
      console.error("Failed to load accounts", err);
    } finally {
      setLoadingAccount(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
    loadTradingAccounts();
  }, [loadUser, loadTradingAccounts]);

  const handleCopy = useCallback((text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: t.copySuccess, duration: 2000 });
    });
  }, [toast, t.copySuccess]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateCurrentUser({ fullName: formState.fullName, bio: formState.bio });
      toast({ title: t.updateSuccess, duration: 2000 });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  }, [formState, toast, t.updateSuccess]);

  const handleLogout = useCallback(() => {
    base44.auth.logout();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 sm:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-8">
        <div className="mx-auto max-w-2xl">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={loadUser} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!formState) return <UserNotRegisteredError />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-20 pt-4 sm:pt-8" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-4 border-white shadow-lg ring-2 ring-blue-100">
                  <AvatarImage src={formState.avatarUrl} alt={formState.fullName} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-xl font-bold text-white">
                    {formState.fullName?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <button className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow-lg">
                  <Upload className="h-3 w-3" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{formState.fullName || "User"}</h1>
                <Badge className={formState.verificationStatus === 'verified' ? 'bg-emerald-500' : 'bg-amber-500'}>
                  {formState.verificationStatus === 'verified' ? t.verified : t.notVerified}
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <Button size="sm" onClick={() => navigate(createPageUrl("Trading"))} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex-1 sm:flex-none">
                <TrendingUp className="mr-1.5 h-4 w-4" /> Trade
              </Button>
              <Button variant="outline" size="sm" onClick={() => { loadUser(); loadTradingAccounts(); }} className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100 flex-1 sm:flex-none">
                <RefreshCw className="mr-1.5 h-4 w-4" /> {t.refresh}
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout} className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 flex-1 sm:flex-none">
                <LogOut className="mr-1.5 h-4 w-4" /> {t.logout}
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue={new URLSearchParams(window.location.search).get('tab') || "personal"} className="space-y-6">
          <TabsList className="w-full justify-start gap-1 border-b border-slate-200 bg-transparent p-0 overflow-x-auto flex-nowrap">
            {[
              { value: "personal", label: t.personalInfo },
              { value: "accounts", label: language === "en" ? "Accounts" : "الحسابات" },
              { value: "assets", label: language === "en" ? "Assets" : "الأصول" },
              { value: "notifications", label: language === "en" ? "Notifications" : "الإشعارات" },
              { value: "security", label: t.security },
              { value: "referrals", label: t.referrals },
              { value: "trades", label: t.trades }
            ].map((tab) => (
              <TabsTrigger 
                key={tab.value}
                value={tab.value} 
                className="rounded-none border-b-2 border-transparent px-3 sm:px-4 pb-3 pt-0 font-medium text-sm whitespace-nowrap transition-all data-[state=active]:border-blue-600 data-[state=active]:text-blue-600"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Personal Information */}
          <TabsContent value="personal" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2 border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-4 sm:p-6">
                  <CardTitle className="text-lg">{t.personalInfo}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4 sm:p-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">User ID</Label>
                    <div className="flex items-center gap-2">
                      <Input value={formState.uuid} readOnly className="bg-slate-50 font-mono text-xs border-slate-300" />
                      <Button variant="outline" size="icon" onClick={() => handleCopy(formState.uuid)} className="flex-shrink-0">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">{t.displayNameLabel}</Label>
                    <Input 
                      value={formState.fullName} 
                      onChange={(e) => setFormState({...formState, fullName: e.target.value})}
                      className="border-slate-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">{t.bioLabel}</Label>
                    <Textarea 
                      value={formState.bio} 
                      onChange={(e) => setFormState({...formState, bio: e.target.value})}
                      className="min-h-[100px] border-slate-300"
                    />
                  </div>
                </CardContent>
                <CardFooter className="border-t border-slate-100 bg-slate-50/50 p-4">
                  <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                    {saving ? t.saving : t.saveChanges}
                  </Button>
                </CardFooter>
              </Card>
              
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <LifeBuoy className="h-5 w-5 text-blue-600" />
                    {t.support}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <p className="text-sm text-slate-600 mb-4">Need help? Our team is available 24/7.</p>
                  <Button variant="outline" className="w-full rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100" onClick={() => navigate(createPageUrl("Contact"))}>
                    <LifeBuoy className="mr-2 h-4 w-4" /> Contact Support
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Trading Accounts */}
          <TabsContent value="accounts" className="space-y-6">
            {loadingAccount ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                  {demoAccount && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-500 mb-2">Demo Account</h3>
                      <TradingAccountCard account={demoAccount} language={language} onRefresh={loadTradingAccounts} />
                    </div>
                  )}
                  {liveAccount && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-500 mb-2">Live Account</h3>
                      <TradingAccountCard account={liveAccount} language={language} onRefresh={loadTradingAccounts} />
                    </div>
                  )}
                </div>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Activity className="h-5 w-5 text-blue-600" />
                        Open Positions
                      </CardTitle>
                      <Button variant="outline" size="sm" onClick={() => navigate(createPageUrl("Trading"))} className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100">
                        New Trade
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 sm:p-4">
                    <TradesTable 
                      trades={trades.filter(t => t.status === 'OPEN')} 
                      language={language}
                      onCloseTrade={async (trade, currentPrice) => {
                        try {
                          await base44.functions.invoke('tradingAccount', {
                            action: 'closeTrade',
                            tradeId: trade.id,
                            exitPrice: currentPrice
                          });
                          loadTradingAccounts();
                        } catch (err) {
                          console.error("Failed to close trade", err);
                        }
                      }}
                    />
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <History className="h-5 w-5 text-blue-600" />
                      Trade History
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 sm:p-4">
                    <TradesTable trades={trades.filter(t => t.status === 'CLOSED').slice(0, 10)} language={language} />
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Assets Tab */}
          <TabsContent value="assets" className="space-y-6">
            {loadingAccount ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                <AssetsPage wallets={wallets} language={language} onRefresh={loadTradingAccounts} liveAccount={liveAccount} demoAccount={demoAccount} trades={trades} />
                <div className="space-y-6">
                  <RecentTransactions language={language} />
                  <StakingPanel wallets={wallets} language={language} onRefresh={loadTradingAccounts} />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <NotificationPreferencesTab language={language} />
          </TabsContent>

          {/* Security */}
          <TabsContent value="security" className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-4">
                <CardTitle className="text-lg">{t.security}</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-slate-100 p-0">
                {[
                  { title: "Identity Verification", status: formState.verificationStatus === 'verified' ? t.verified : t.notVerified, icon: ShieldCheck, action: "Verify" },
                  { title: t.passwordLabel, status: "Last changed 3 months ago", icon: Lock, action: t.managePassword },
                  { title: t.twoFactor, status: formState.twoFactorEnabled ? "Enabled" : "Disabled", icon: ShieldCheck, action: "Setup" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                        <item.icon className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.status}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-blue-600 rounded-xl">
                      {item.action} <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Referrals */}
          <TabsContent value="referrals" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Today's Referrals", value: "0" },
                { label: "30D Referrals", value: "12" },
                { label: "Yesterday Commission", value: "$0.00" },
                { label: "30D Commission", value: "$145.20" }
              ].map((stat, i) => (
                <Card key={i} className="border-slate-200">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-4">
                <CardTitle className="text-lg">Referral Program</CardTitle>
                <CardDescription>Earn up to 40% commission</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm">{t.referralCode}</Label>
                    <div className="flex gap-2">
                      <Input value={formState.referralCode} readOnly className="font-mono font-bold bg-slate-50" />
                      <Button variant="outline" size="icon" onClick={() => handleCopy(formState.referralCode)} className="rounded-xl border-slate-300">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">{t.referralLink}</Label>
                    <div className="flex gap-2">
                      <Input value={formState.referralLink} readOnly className="text-xs bg-slate-50" />
                      <Button variant="outline" size="icon" onClick={() => handleCopy(formState.referralLink)} className="rounded-xl border-slate-300">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trades */}
          <TabsContent value="trades" className="space-y-6">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-lg">{t.trades}</CardTitle>
                <Button variant="outline" size="sm" className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100">
                  <ExternalLink className="mr-2 h-4 w-4" /> Export
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-medium">Symbol</TableHead>
                        <TableHead className="font-medium">Side</TableHead>
                        <TableHead className="font-medium">Size</TableHead>
                        <TableHead className="font-medium">P&L</TableHead>
                        <TableHead className="text-right font-medium">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trades.slice(0, 10).map((trade, i) => (
                        <TableRow key={i} className="hover:bg-slate-50">
                          <TableCell className="font-medium">{trade.symbol}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={trade.side === 'LONG' ? 'text-emerald-700 border-emerald-300' : 'text-rose-700 border-rose-300'}>
                              {trade.side}
                            </Badge>
                          </TableCell>
                          <TableCell>{trade.quantity}</TableCell>
                          <TableCell className={trade.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            {trade.pnl >= 0 ? '+' : ''}{trade.pnl?.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-xs text-slate-500">
                            {new Date(trade.opened_at || trade.created_date).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

Profile.propTypes = {
  language: PropTypes.oneOf(["en", "ar"])
};