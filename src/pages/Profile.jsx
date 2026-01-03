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
  Wallet,
  Plus
} from "lucide-react";
import CreateSubaccountModal from "@/components/profile/CreateSubaccountModal";
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
import { fetchCurrentUser, updateCurrentUser } from "@/api/functions";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

const translations = {
  en: {
    heroTitle: "Account Center",
    heroSubtitle: "Manage your identity, security, and trading performance.",
    personalInfo: "Personal Information",
    security: "Security & Verification",
    referrals: "Refer & Earn",
    vouchers: "My Vouchers",
    trades: "My Trades",
    uuidLabel: "User UUID",
    displayNameLabel: "Display Name",
    bioLabel: "Short Bio",
    saveChanges: "Save Changes",
    saving: "Saving...",
    verificationStatus: "Identity Verification",
    notVerified: "Not Verified",
    pending: "Pending",
    verified: "Verified",
    passwordLabel: "Password",
    managePassword: "Change Password",
    twoFactor: "2FA Authentication",
    loginActivity: "Login Activity",
    referralCode: "Referral Code",
    referralLink: "Referral Link",
    todayReferrals: "Today's Referrals",
    monthReferrals: "30D Referrals",
    yesterdayCommission: "Yesterday's Commission",
    monthCommission: "30D Commission",
    available: "Available",
    unavailable: "Unavailable",
    symbol: "Symbol",
    side: "Side",
    size: "Size",
    entryExit: "Entry / Exit",
    pnl: "PnL",
    date: "Date",
    copySuccess: "Copied to clipboard",
    logout: "Log Out",
    refresh: "Refresh Data",
    support: "Contact Support",
    updateSuccess: "Profile updated successfully",
    updateError: "Failed to update profile",
    loadError: "Failed to load user data"
  },
  ar: {
    heroTitle: "مركز الحساب",
    heroSubtitle: "إدارة هويتك وأمنك وأداء التداول الخاص بك.",
    personalInfo: "المعلومات الشخصية",
    security: "الأمن والتحقق",
    referrals: "الإحالة والكسب",
    vouchers: "قسائمي",
    trades: "تداولاتي",
    uuidLabel: "معرف المستخدم (UUID)",
    displayNameLabel: "اسم العرض",
    bioLabel: "نبذة قصيرة",
    saveChanges: "حفظ التغييرات",
    saving: "جاري الحفظ...",
    verificationStatus: "حالة التحقق من الهوية",
    notVerified: "غير موثق",
    pending: "قيد الانتظار",
    verified: "موثق",
    passwordLabel: "كلمة المرور",
    managePassword: "تغيير كلمة المرور",
    twoFactor: "المصادقة الثنائية (2FA)",
    loginActivity: "نشاط تسجيل الدخول",
    referralCode: "كود الإحالة",
    referralLink: "رابط الإحالة",
    todayReferrals: "إحالات اليوم",
    monthReferrals: "إحالات 30 يوم",
    yesterdayCommission: "عمولة الأمس",
    monthCommission: "عمولة 30 يوم",
    available: "متاح",
    unavailable: "غير متاح",
    symbol: "الرمز",
    side: "الجانب",
    size: "الحجم",
    entryExit: "الدخول / الخروج",
    pnl: "الربح والخسارة",
    date: "التاريخ",
    copySuccess: "تم النسخ إلى الحافظة",
    logout: "تسجيل الخروج",
    refresh: "تحديث البيانات",
    support: "الدعم الفني",
    updateSuccess: "تم تحديث الملف الشخصي بنجاح",
    updateError: "فشل تحديث الملف الشخصي",
    loadError: "فشل تحميل بيانات المستخدم"
  }
};

const normalizeUserProfile = (user = {}) => {
  return {
    uuid: user.id || user.uuid || "---",
    fullName: user.fullName || user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    bio: user.bio || "",
    avatarUrl: user.avatarUrl || user.avatar || "",
    verificationStatus: user.verificationStatus || "not_verified",
    twoFactorEnabled: user.twoFactorEnabled || false,
    referralCode: user.referralCode || "NEXT-7829",
    referralLink: user.referralLink || `https://nexttrade.app/ref/${user.referralCode || "NEXT-7829"}`
  };
};

const InfoPill = ({ label, value, icon: Icon }) => (
  <Card className="border-slate-200 shadow-sm transition-shadow hover:shadow-md">
    <CardContent className="p-5">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-600 mb-2">
        {Icon && <Icon className="h-4 w-4 text-blue-600" />}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </CardContent>
  </Card>
);

InfoPill.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  icon: PropTypes.elementType
};

const SecurityItem = ({ 
  title, 
  status, 
  actionLabel, 
  icon: Icon, 
  statusColor = "text-slate-600",
  onAction 
}) => (
  <div className="flex items-center justify-between py-5 border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50">
    <div className="flex items-center gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
        <Icon className="h-6 w-6 text-blue-600" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900 mb-1">{title}</p>
        <p className={`text-xs font-medium ${statusColor}`}>{status}</p>
      </div>
    </div>
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={onAction}
      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
    >
      {actionLabel} <ChevronRight className="ml-1 h-4 w-4" />
    </Button>
  </div>
);

SecurityItem.propTypes = {
  title: PropTypes.string.isRequired,
  status: PropTypes.string.isRequired,
  actionLabel: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  statusColor: PropTypes.string,
  onAction: PropTypes.func
};

const VoucherCard = ({ title, condition, expiry, status, available }) => (
  <Card 
    className={`overflow-hidden border-slate-200 shadow-sm transition-all hover:shadow-md ${
      !available ? 'opacity-50' : ''
    }`}
  >
    <div className="flex h-full">
      <div 
        className={`flex w-28 flex-col items-center justify-center gap-2 ${
          available ? 'bg-gradient-to-b from-blue-600 to-blue-700' : 'bg-slate-400'
        } text-white`}
      >
        <Gift className="h-10 w-10" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Voucher</span>
      </div>
      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-bold text-slate-900 text-base">{title}</h4>
            <Badge 
              variant={available ? "default" : "secondary"} 
              className={`text-[10px] ${available ? 'bg-blue-600' : ''}`}
            >
              {status}
            </Badge>
          </div>
          <p className="text-xs text-slate-600 mb-4">{condition}</p>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            <span>Expires: {expiry}</span>
          </div>
          {available && (
            <Button 
              size="sm" 
              className="h-8 px-4 text-xs bg-blue-600 hover:bg-blue-700"
            >
              Use Now
            </Button>
          )}
        </div>
      </div>
    </div>
  </Card>
);

VoucherCard.propTypes = {
  title: PropTypes.string.isRequired,
  condition: PropTypes.string.isRequired,
  expiry: PropTypes.string.isRequired,
  status: PropTypes.string.isRequired,
  available: PropTypes.bool.isRequired
};

export default function Profile({ language = "en" }) {
  const t = translations[language] || translations.en;
  const { toast } = useToast();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [formState, setFormState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [subaccounts, setSubaccounts] = useState([]);
  const [subaccountModalOpen, setSubaccountModalOpen] = useState(false);
  const [loadingSubaccounts, setLoadingSubaccounts] = useState(false);

  const loadUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCurrentUser();
      const normalized = normalizeUserProfile(data);
      setUser(data);
      setFormState(normalized);
    } catch (err) {
      console.error("Failed to load user", err);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  const loadSubaccounts = useCallback(async () => {
    setLoadingSubaccounts(true);
    try {
      const result = await base44.functions.invoke('createSubaccount', { action: 'list' });
      if (result.data?.success) {
        setSubaccounts(result.data.data || []);
      }
    } catch (err) {
      console.error("Failed to load subaccounts", err);
    } finally {
      setLoadingSubaccounts(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
    loadSubaccounts();
  }, [loadUser, loadSubaccounts]);

  const handleCopy = useCallback((text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: t.copySuccess,
        duration: 2000
      });
    }).catch((err) => {
      console.error("Copy failed", err);
    });
  }, [toast, t.copySuccess]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateCurrentUser({
        fullName: formState.fullName,
        bio: formState.bio
      });
      toast({
        title: t.updateSuccess,
        duration: 2000
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: t.updateError,
        description: err.message
      });
    } finally {
      setSaving(false);
    }
  }, [formState, toast, t.updateSuccess, t.updateError]);

  const handleLogout = useCallback(() => {
    base44.auth.logout();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <div className="grid gap-8 lg:grid-cols-3">
            <Skeleton className="h-[500px] lg:col-span-2 rounded-2xl" />
            <Skeleton className="h-[500px] rounded-2xl" />
          </div>
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
            <RefreshCw className="mr-2 h-4 w-4" /> Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!formState) return <UserNotRegisteredError />;

  return (
    <div 
      className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-20 pt-8" 
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="mb-10 flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-4 border-white shadow-lg ring-2 ring-blue-100 transition-all group-hover:ring-blue-200">
                <AvatarImage src={formState.avatarUrl} alt={formState.fullName} />
                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-2xl font-bold text-white">
                  {formState.fullName?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <button 
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:scale-110"
                aria-label="Upload avatar"
              >
                <Upload className="h-4 w-4" />
              </button>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                {formState.fullName || "User"}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-slate-50 font-mono text-xs">
                  ID: {formState.uuid}
                </Badge>
                <Badge 
                  className={
                    formState.verificationStatus === 'verified' 
                      ? 'bg-emerald-500 hover:bg-emerald-600' 
                      : 'bg-amber-500 hover:bg-amber-600'
                  }
                >
                  {formState.verificationStatus === 'verified' ? t.verified : t.notVerified}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              size="sm" 
              onClick={() => setSubaccountModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" /> {language === "en" ? "Open Account" : "فتح حساب"}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => { loadUser(); loadSubaccounts(); }} 
              className="bg-white border-slate-300 hover:bg-slate-50"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> {t.refresh}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="mr-2 h-4 w-4" /> {t.logout}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="personal" className="space-y-8">
          <TabsList className="h-auto w-full justify-start gap-1 border-b border-slate-200 bg-transparent p-0">
            {[
              { value: "personal", label: t.personalInfo },
              { value: "accounts", label: language === "en" ? "Trading Accounts" : "حسابات التداول" },
              { value: "security", label: t.security },
              { value: "referrals", label: t.referrals },
              { value: "vouchers", label: t.vouchers },
              { value: "trades", label: t.trades }
            ].map((tab) => (
              <TabsTrigger 
                key={tab.value}
                value={tab.value} 
                className="rounded-none border-b-2 border-transparent px-4 pb-4 pt-0 font-semibold transition-all data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 hover:text-blue-600"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Personal Information */}
          <TabsContent value="personal" className="space-y-6">
            <div className="grid gap-8 lg:grid-cols-3">
              <Card className="lg:col-span-2 border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-xl">{t.personalInfo}</CardTitle>
                  <CardDescription>Update your public profile information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700">{t.uuidLabel}</Label>
                      <Input 
                        value={formState.uuid} 
                        readOnly 
                        className="bg-slate-50 font-mono text-sm border-slate-300" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700">{t.displayNameLabel}</Label>
                      <Input 
                        value={formState.fullName} 
                        onChange={(e) => setFormState({...formState, fullName: e.target.value})}
                        placeholder="Your display name" 
                        className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700">{t.bioLabel}</Label>
                    <Textarea 
                      value={formState.bio} 
                      onChange={(e) => setFormState({...formState, bio: e.target.value})}
                      placeholder="Tell us a bit about your trading style..." 
                      className="min-h-[140px] border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </CardContent>
                <CardFooter className="border-t border-slate-100 bg-slate-50/50 py-5">
                  <Button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {saving ? t.saving : t.saveChanges}
                  </Button>
                </CardFooter>
              </Card>
              
              <div className="space-y-6">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <LifeBuoy className="h-5 w-5 text-blue-600" />
                      {t.support}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-6">
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Need help with your account? Our team is available 24/7 to assist you.
                    </p>
                    <Button 
                      variant="outline" 
                      className="w-full border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700" 
                      onClick={() => navigate(createPageUrl("Contact"))}
                    >
                      <LifeBuoy className="mr-2 h-4 w-4" /> {t.support}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Trading Accounts */}
          <TabsContent value="accounts" className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-blue-600" />
                    {language === "en" ? "Your Trading Accounts" : "حسابات التداول الخاصة بك"}
                  </CardTitle>
                  <CardDescription>
                    {language === "en" 
                      ? "Manage your BingX subaccounts for trading" 
                      : "إدارة حساباتك الفرعية على BingX للتداول"}
                  </CardDescription>
                </div>
                <Button onClick={() => setSubaccountModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="mr-2 h-4 w-4" /> {language === "en" ? "New Account" : "حساب جديد"}
                </Button>
              </CardHeader>
              <CardContent className="p-6">
                {loadingSubaccounts ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : subaccounts.length === 0 ? (
                  <div className="text-center py-12">
                    <Wallet className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">
                      {language === "en" ? "No trading accounts yet" : "لا توجد حسابات تداول بعد"}
                    </h3>
                    <p className="text-slate-500 mb-4">
                      {language === "en" 
                        ? "Create your first trading account to start trading" 
                        : "أنشئ حساب التداول الأول للبدء"}
                    </p>
                    <Button onClick={() => setSubaccountModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="mr-2 h-4 w-4" /> {language === "en" ? "Create Account" : "إنشاء حساب"}
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {subaccounts.map((account) => (
                      <Card key={account.id} className="border-slate-200 hover:shadow-md transition-shadow">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
                                <Wallet className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-900">{account.nickname}</h4>
                                <p className="text-xs text-slate-500 capitalize">{account.account_type}</p>
                              </div>
                            </div>
                            <Badge 
                              className={
                                account.status === 'active' 
                                  ? 'bg-emerald-500' 
                                  : account.status === 'pending' 
                                    ? 'bg-amber-500' 
                                    : 'bg-red-500'
                              }
                            >
                              {account.status}
                            </Badge>
                          </div>
                          {account.account_type !== 'spot' && (
                            <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-3">
                              <span className="text-slate-500">{language === "en" ? "Leverage" : "الرافعة"}</span>
                              <span className="font-bold text-blue-600">{account.leverage}x</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                            <span>{language === "en" ? "Created" : "تاريخ الإنشاء"}</span>
                            <span>{new Date(account.created_date).toLocaleDateString()}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security & Verification */}
          <TabsContent value="security" className="space-y-6">
            <div className="grid gap-8 lg:grid-cols-3">
              <Card className="lg:col-span-2 border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-xl">{t.security}</CardTitle>
                  <CardDescription>Manage your account security and verification status.</CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-slate-100 p-6">
                  <SecurityItem 
                    title={t.verificationStatus} 
                    status={formState.verificationStatus === 'verified' ? t.verified : t.notVerified}
                    statusColor={formState.verificationStatus === 'verified' ? "text-emerald-600" : "text-amber-600"}
                    actionLabel="Verify Now"
                    icon={ShieldCheck}
                    onAction={() => console.log("Verify clicked")}
                  />
                  <SecurityItem 
                    title={t.passwordLabel} 
                    status="Last changed 3 months ago"
                    actionLabel={t.managePassword}
                    icon={Lock}
                    onAction={() => console.log("Password clicked")}
                  />
                  <SecurityItem 
                    title={t.twoFactor} 
                    status={formState.twoFactorEnabled ? "Enabled" : "Disabled"}
                    statusColor={formState.twoFactorEnabled ? "text-emerald-600" : "text-slate-600"}
                    actionLabel="Setup"
                    icon={ShieldCheck}
                    onAction={() => console.log("2FA clicked")}
                  />
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-lg">{t.loginActivity}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                  {[
                    { browser: "Chrome on Windows", location: "Dubai, UAE", ip: "192.168.1.1", time: "2 hours ago" },
                    { browser: "Safari on iPhone", location: "Dubai, UAE", ip: "192.168.1.2", time: "1 day ago" },
                    { browser: "Firefox on Mac", location: "Abu Dhabi, UAE", ip: "192.168.1.3", time: "3 days ago" }
                  ].map((activity, i) => (
                    <div key={i} className="flex items-start gap-3 pb-5 border-b border-slate-100 last:border-0 last:pb-0">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-semibold text-slate-900">{activity.browser}</p>
                        <p className="text-slate-600 mt-0.5">{activity.location} • {activity.ip}</p>
                        <p className="text-slate-400 text-xs mt-0.5">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Refer & Earn */}
          <TabsContent value="referrals" className="space-y-8">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <InfoPill label={t.todayReferrals} value="0" icon={User} />
              <InfoPill label={t.monthReferrals} value="12" icon={User} />
              <InfoPill label={t.yesterdayCommission} value="$0.00" icon={TrendingUp} />
              <InfoPill label={t.monthCommission} value="$145.20" icon={TrendingUp} />
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              <Card className="lg:col-span-2 border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-xl">Referral Program</CardTitle>
                  <CardDescription>Invite your friends and earn up to 40% commission on every trade they make.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700">{t.referralCode}</Label>
                      <div className="flex gap-2">
                        <Input 
                          value={formState.referralCode} 
                          readOnly 
                          className="font-mono font-bold text-lg bg-slate-50 border-slate-300" 
                        />
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => handleCopy(formState.referralCode)}
                          className="flex-shrink-0 border-slate-300 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700">{t.referralLink}</Label>
                      <div className="flex gap-2">
                        <Input 
                          value={formState.referralLink} 
                          readOnly 
                          className="text-xs bg-slate-50 border-slate-300" 
                        />
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => handleCopy(formState.referralLink)}
                          className="flex-shrink-0 border-slate-300 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border-2 border-blue-100 bg-gradient-to-br from-blue-50 to-blue-100/50 p-6">
                    <h4 className="text-base font-bold text-blue-900 mb-4">How it works</h4>
                    <ul className="space-y-3 text-sm text-blue-800">
                      <li className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" /> 
                        Share your referral link with friends
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" /> 
                        They sign up and start trading
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" /> 
                        You receive instant commission on every trade
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-lg">Recent Referrals</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-5">
                    {[
                      { id: "USR-9281", date: "Dec 28, 2023", status: "Active", reward: "$12.40" },
                      { id: "USR-4412", date: "Dec 25, 2023", status: "Active", reward: "$8.15" },
                      { id: "USR-1092", date: "Dec 20, 2023", status: "Inactive", reward: "$0.00" }
                    ].map((ref) => (
                      <div 
                        key={ref.id} 
                        className="flex items-center justify-between pb-5 border-b border-slate-100 last:border-0 last:pb-0"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{ref.id}</p>
                          <p className="text-xs text-slate-500 mt-1">{ref.date}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-emerald-600 mb-1">{ref.reward}</p>
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] uppercase ${
                              ref.status === 'Active' ? 'border-emerald-200 text-emerald-700' : 'border-slate-200 text-slate-600'
                            }`}
                          >
                            {ref.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Vouchers */}
          <TabsContent value="vouchers" className="space-y-6">
            <Tabs defaultValue="available" className="w-full">
              <TabsList className="mb-8 bg-slate-100 p-1 border border-slate-200">
                <TabsTrigger value="available" className="px-10 data-[state=active]:bg-white data-[state=active]:text-blue-600">
                  {t.available}
                </TabsTrigger>
                <TabsTrigger value="unavailable" className="px-10 data-[state=active]:bg-white data-[state=active]:text-blue-600">
                  {t.unavailable}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="available" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <VoucherCard 
                  title="$50 Trading Bonus" 
                  condition="Min. deposit $500" 
                  expiry="Feb 15, 2024" 
                  status="Active" 
                  available={true} 
                />
                <VoucherCard 
                  title="Zero Fee Trade" 
                  condition="Valid for first 5 trades" 
                  expiry="Jan 30, 2024" 
                  status="New" 
                  available={true} 
                />
                <VoucherCard 
                  title="10% Rebate" 
                  condition="On all crypto pairs" 
                  expiry="Mar 1, 2024" 
                  status="Active" 
                  available={true} 
                />
              </TabsContent>
              <TabsContent value="unavailable" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <VoucherCard 
                  title="$10 Welcome Bonus" 
                  condition="New user registration" 
                  expiry="Dec 1, 2023" 
                  status="Expired" 
                  available={false} 
                />
                <VoucherCard 
                  title="VIP Upgrade" 
                  condition="Trade volume > $1M" 
                  expiry="Nov 15, 2023" 
                  status="Used" 
                  available={false} 
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* My Trades */}
          <TabsContent value="trades" className="space-y-6">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-slate-100 bg-slate-50/50">
                <div>
                  <CardTitle className="text-xl">{t.trades}</CardTitle>
                  <CardDescription>Your recent trading history and performance.</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="border-slate-300 hover:bg-slate-50">
                  <ExternalLink className="mr-2 h-4 w-4" /> Export CSV
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-bold text-slate-700">{t.symbol}</TableHead>
                        <TableHead className="font-bold text-slate-700">{t.side}</TableHead>
                        <TableHead className="font-bold text-slate-700">{t.size}</TableHead>
                        <TableHead className="font-bold text-slate-700">{t.entryExit}</TableHead>
                        <TableHead className="font-bold text-slate-700">{t.pnl}</TableHead>
                        <TableHead className="text-right font-bold text-slate-700">{t.date}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { symbol: "BTC/USDT", side: "Buy", size: "0.45", entry: "42,150.00", exit: "43,200.00", pnl: "+$472.50", status: "profit", date: "Dec 30, 2023 14:22" },
                        { symbol: "ETH/USDT", side: "Sell", size: "2.50", entry: "2,240.50", exit: "2,210.00", pnl: "+$76.25", status: "profit", date: "Dec 29, 2023 09:15" },
                        { symbol: "SOL/USDT", side: "Buy", size: "150.00", entry: "105.20", exit: "102.40", pnl: "-$420.00", status: "loss", date: "Dec 28, 2023 18:40" },
                        { symbol: "BTC/USDT", side: "Sell", size: "0.12", entry: "44,100.00", exit: "43,850.00", pnl: "+$30.00", status: "profit", date: "Dec 27, 2023 11:05" },
                        { symbol: "BNB/USDT", side: "Buy", size: "25.00", entry: "312.40", exit: "315.20", pnl: "+$70.00", status: "profit", date: "Dec 26, 2023 16:30" }
                      ].map((trade, i) => (
                        <TableRow key={i} className="hover:bg-slate-50 transition-colors">
                          <TableCell className="font-bold text-slate-900">{trade.symbol}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={
                                trade.side === 'Buy' 
                                  ? 'text-emerald-700 border-emerald-300 bg-emerald-50 font-semibold' 
                                  : 'text-rose-700 border-rose-300 bg-rose-50 font-semibold'
                              }
                            >
                              {trade.side}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-700">{trade.size}</TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {trade.entry} → {trade.exit}
                          </TableCell>
                          <TableCell className={`font-bold ${trade.status === 'profit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            <div className="flex items-center gap-2">
                              {trade.status === 'profit' 
                                ? <TrendingUp className="h-4 w-4" /> 
                                : <TrendingDown className="h-4 w-4" />
                              }
                              {trade.pnl}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs text-slate-500">{trade.date}</TableCell>
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

      <CreateSubaccountModal
        open={subaccountModalOpen}
        onOpenChange={setSubaccountModalOpen}
        onSuccess={() => loadSubaccounts()}
        language={language}
      />
    </div>
  );
}

Profile.propTypes = {
  language: PropTypes.oneOf(["en", "ar"])
};

export { CreateSubaccountModal };