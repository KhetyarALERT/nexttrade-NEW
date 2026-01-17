import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useLocation, useNavigate } from "react-router-dom";
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
  Sparkles,
  Award,
  Users,
  DollarSign,
  BarChart3,
  Shield
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
import { useAuth } from "@/lib/AuthContext";
import AuthRequiredState from "@/components/AuthRequiredState";
import VerificationModal from "@/components/profile/VerificationModal";

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
    saveChanges: "Save Changes",
    saving: "Saving...",
    notVerified: "Not Verified",
    verified: "Verified",
    passwordLabel: "Password",
    managePassword: "Change",
    twoFactor: "2FA Authentication",
    loginActivity: "Login Activity",
    referralCode: "Referral Code",
    referralLink: "Referral Link",
    copySuccess: "Copied to clipboard",
    logout: "Logout",
    refresh: "Refresh",
    support: "Support Center",
    updateSuccess: "Profile updated successfully",
    loadError: "Failed to load profile",
    welcomeBack: "Welcome back",
    accountOverview: "Account Overview",
    quickActions: "Quick Actions",
    memberSince: "Member since",
    changePhoto: "Change photo",
    photoUpdated: "Photo updated",
    invalidPhotoType: "Please select an image file",
    photoTooLarge: "Image is too large. Please choose a smaller one.",
    shareInvite: "Share invite",
    inviteMessage: "Invite friends to NextTrade",
    inviteMessageBody: "Join NextTrade using my referral link:",
    shareNotSupported: "Sharing isn't available here. Link copied instead.",
    accessTitle: "Log in to access your account",
    accessDescription: "Please log in to view your assets, referrals, and account settings.",
    accessPrimary: "Log in",
    accessSecondary: "Back to home",
  },
  ar: {
    heroTitle: "مركز الحساب",
    personalInfo: "المعلومات الشخصية",
    security: "الأمان",
    referrals: "الإحالات",
    vouchers: "القسائم",
    trades: "الصفقات",
    displayNameLabel: "الاسم",
    bioLabel: "نبذة تعريفية",
    saveChanges: "حفظ التغييرات",
    saving: "جاري الحفظ...",
    notVerified: "غير موثق",
    verified: "موثق",
    passwordLabel: "كلمة المرور",
    managePassword: "تغيير",
    twoFactor: "المصادقة الثنائية",
    loginActivity: "نشاط تسجيل الدخول",
    referralCode: "كود الإحالة",
    referralLink: "رابط الإحالة",
    copySuccess: "تم النسخ",
    logout: "تسجيل الخروج",
    refresh: "تحديث",
    support: "مركز الدعم",
    updateSuccess: "تم تحديث الملف الشخصي",
    loadError: "فشل تحميل الملف الشخصي",
    welcomeBack: "مرحباً بعودتك",
    accountOverview: "نظرة عامة على الحساب",
    quickActions: "إجراءات سريعة",
    memberSince: "عضو منذ",
    changePhoto: "تغيير الصورة",
    photoUpdated: "تم تحديث الصورة",
    invalidPhotoType: "يرجى اختيار ملف صورة",
    photoTooLarge: "حجم الصورة كبير. اختر صورة أصغر.",
    shareInvite: "مشاركة الدعوة",
    inviteMessage: "ادعُ أصدقاءك إلى NextTrade",
    inviteMessageBody: "انضم إلى NextTrade عبر رابط الإحالة الخاص بي:",
    shareNotSupported: "المشاركة غير متاحة هنا. تم نسخ الرابط بدلاً من ذلك.",
    accessTitle: "سجّل الدخول للوصول إلى حسابك",
    accessDescription: "يرجى تسجيل الدخول لعرض الأصول والإحالات وإعدادات الحساب.",
    accessPrimary: "تسجيل الدخول",
    accessSecondary: "العودة للرئيسية",
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
  referralLink: `https://nexttrade.app/ref/${user.referralCode || "NEXT-7829"}`,
  createdDate: user.createdDate || new Date().toISOString()
});

export default function Profile({ language = "en" }) {
  const t = translations[language] || translations.en;
  const { isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const setSearchParams = (patch, { replace = true } = {}) => {
    const params = new URLSearchParams(location.search);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") params.delete(key);
      else params.set(key, String(value));
    });
    const next = params.toString();
    const current = location.search.startsWith("?") ? location.search.slice(1) : location.search;
    if (next !== current) {
      navigate({ pathname: location.pathname, search: next ? `?${next}` : "" }, { replace });
    }
  };

  const activeProfileTab = new URLSearchParams(location.search).get('tab') || "personal";

  const avatarInputRef = useRef(null);

  const [formState, setFormState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [demoAccount, setDemoAccount] = useState(null);
  const [liveAccount, setLiveAccount] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [existingVerification, setExistingVerification] = useState(null);

  const loadUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCurrentUser();
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

  const loadVerificationRequest = useCallback(async () => {
    try {
      const user = await base44.auth.me();
      const requests = await base44.entities.VerificationRequest.filter({ user_id: user.id }, "-created_date", 1);
      if (requests && requests.length > 0) {
        setExistingVerification(requests[0]);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError(null);
      return;
    }
    loadUser();
    loadTradingAccounts();
    loadVerificationRequest();
  }, [isAuthenticated, isLoadingAuth, loadUser, loadTradingAccounts, loadVerificationRequest]);

  const handleCopy = useCallback((text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ 
        title: t.copySuccess, 
        duration: 2000,
        className: "bg-emerald-50 border-emerald-200 text-emerald-900"
      });
    });
  }, [toast, t.copySuccess]);

  const handleShareReferral = useCallback(async () => {
    const referralLink = formState?.referralLink;
    if (!referralLink) return;

    const shareTitle = t.inviteMessage;
    const shareText = `${t.inviteMessageBody} ${referralLink}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: referralLink
        });
        return;
      }
    } catch {
      // Fall through to copy.
    }

    try {
      await navigator.clipboard.writeText(referralLink);
      toast({
        title: t.shareNotSupported,
        duration: 2500,
        className: "bg-slate-50 border-slate-200 text-slate-900"
      });
    } catch {
      // If clipboard isn't available, we still avoid throwing in UI.
      toast({
        variant: "destructive",
        title: "Error",
        description: language === "ar" ? "تعذر مشاركة الرابط" : "Couldn't share the link"
      });
    }
  }, [formState?.referralLink, language, t.inviteMessage, t.inviteMessageBody, t.shareNotSupported, toast]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateCurrentUser({
        fullName: formState.fullName,
        bio: formState.bio,
        avatarUrl: formState.avatarUrl
      });
      toast({ 
        title: t.updateSuccess, 
        duration: 2000,
        className: "bg-emerald-50 border-emerald-200 text-emerald-900"
      });
    } catch (err) {
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: err.message 
      });
    } finally {
      setSaving(false);
    }
  }, [formState, toast, t.updateSuccess]);

  const applyAvatarFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Error', description: t.invalidPhotoType });
      return;
    }

    // Keep payload reasonable if Base44 stores this field.
    const maxBytes = 1_500_000;
    if (file.size > maxBytes) {
      toast({ variant: 'destructive', title: 'Error', description: t.photoTooLarge });
      return;
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    setFormState((prev) => ({ ...prev, avatarUrl: String(dataUrl || '') }));
    toast({ title: t.photoUpdated, duration: 1500, className: "bg-emerald-50 border-emerald-200 text-emerald-900" });
  }, [toast, t.invalidPhotoType, t.photoTooLarge, t.photoUpdated]);

  const handleAvatarInputChange = useCallback((e) => {
    const file = e.currentTarget.files?.[0];
    if (file) applyAvatarFile(file);
    e.currentTarget.value = '';
  }, [applyAvatarFile]);

  const handleAvatarDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) applyAvatarFile(file);
  }, [applyAvatarFile]);

  const handleLogout = useCallback(() => {
    base44.auth.logout();
  }, []);

  const formatSize = useCallback((v) => {
    if (v === undefined || v === null) return '-';
    const n = Number(v);
    return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  }, []);

  if (!isLoadingAuth && !isAuthenticated) {
    return (
      <AuthRequiredState
        title={t.accessTitle}
        description={t.accessDescription}
        primaryActionLabel={t.accessPrimary}
        secondaryActionLabel={t.accessSecondary}
        secondaryActionHref={createPageUrl("Home")}
        onPrimaryAction={navigateToLogin}
      />
    );
  }

  if (loading || isLoadingAuth) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 sm:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-48 w-full rounded-3xl" />
          <div className="grid gap-4 lg:grid-cols-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
          <Skeleton className="h-[400px] w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="mx-auto max-w-2xl">
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
          <Button 
            onClick={loadUser} 
            className="mt-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/30 rounded-xl"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!formState) return <UserNotRegisteredError />;

  const memberSinceDate = new Date(formState.createdDate).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { 
    year: 'numeric', 
    month: 'long' 
  });

  return (
    <div 
      className="min-h-screen bg-background text-foreground pb-20 pt-4 sm:pt-8" 
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Enhanced Header with Gradient Background */}
        <div className="mb-8 overflow-hidden rounded-3xl border border-border bg-card shadow-xl backdrop-blur-sm">
          <div className="relative p-6 sm:p-8">
            {/* Decorative Background Pattern */}
            <div className="absolute inset-0 bg-grid-slate-100 dark:bg-grid-slate-900 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
            
            <div className="flex flex-col gap-6">
              {/* Top Row: Avatar and Info */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div
                  className="relative group"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleAvatarDrop}
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full opacity-75 blur group-hover:opacity-100 transition duration-300" />
                  <Avatar className="relative h-24 w-24 sm:h-28 sm:w-28 border-4 border-white shadow-2xl ring-2 ring-blue-100">
                    <AvatarImage src={formState.avatarUrl} alt={formState.fullName} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-2xl sm:text-3xl font-bold text-white">
                      {formState.fullName?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-4 border-white bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300 hover:scale-110"
                    aria-label={t.changePhoto}
                    title={t.changePhoto}
                  >
                    <Upload className="h-4 w-4" />
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarInputChange}
                  />
                </div>
                
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                      {formState.fullName || "User"}
                    </h1>
                    <Badge 
                      className={`${
                        formState.verificationStatus === 'verified' 
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0' 
                          : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0'
                      } shadow-lg px-3 py-1 font-medium`}
                    >
                      {formState.verificationStatus === 'verified' ? (
                        <><CheckCircle2 className="mr-1 h-3 w-3" /> {t.verified}</>
                      ) : (
                        <><AlertCircle className="mr-1 h-3 w-3" /> {t.notVerified}</>
                      )}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {t.memberSince}: <span className="font-medium text-foreground">{memberSinceDate}</span>
                  </p>
                  
                  <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span className="min-w-0 truncate font-mono">{formState.uuid}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleCopy(formState.uuid)}
                      className="h-6 w-6 p-0 hover:bg-muted rounded-lg"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap gap-2 sm:ml-auto w-full sm:w-auto">
                  <Button 
                    size="sm" 
                    onClick={() => navigate(createPageUrl("Futures"))} 
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/30 rounded-xl flex-1 sm:flex-none transition-all duration-300 hover:scale-105"
                  >
                    <TrendingUp className="mr-2 h-4 w-4" /> Trade Now
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => { loadUser(); loadTradingAccounts(); }} 
                    className="rounded-xl border-border bg-background/50 backdrop-blur-sm text-foreground hover:bg-muted flex-1 sm:flex-none transition-all duration-300"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" /> {t.refresh}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleLogout} 
                    className="rounded-xl border-destructive/30 bg-background/50 backdrop-blur-sm text-destructive hover:bg-destructive/10 flex-1 sm:flex-none transition-all duration-300"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> {t.logout}
                  </Button>
                </div>
              </div>

              {/* Stats Overview Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-4 border-t border-border">
                {[
                  { 
                    label: language === "en" ? "Total Balance" : "الرصيد الكلي", 
                    value: `$${((liveAccount?.balance || 0) + (demoAccount?.balance || 0)).toFixed(2)}`,
                    icon: DollarSign,
                    gradient: "from-emerald-500 to-teal-600",
                    bgGradient: "from-emerald-50 to-teal-50"
                  },
                  { 
                    label: language === "en" ? "Total P&L" : "الربح/الخسارة", 
                    value: `$${trades.reduce((sum, t) => sum + (t.pnl || 0), 0).toFixed(2)}`,
                    icon: BarChart3,
                    gradient: "from-blue-500 to-indigo-600",
                    bgGradient: "from-blue-50 to-indigo-50"
                  },
                  { 
                    label: language === "en" ? "Open Trades" : "الصفقات المفتوحة", 
                    value: trades.filter(t => t.status === 'OPEN').length,
                    icon: Activity,
                    gradient: "from-indigo-500 to-blue-600",
                    bgGradient: "from-indigo-50 to-blue-50"
                  },
                  { 
                    label: language === "en" ? "Referrals" : "الإحالات", 
                    value: "12",
                    icon: Users,
                    gradient: "from-orange-500 to-red-600",
                    bgGradient: "from-orange-50 to-red-50"
                  }
                ].map((stat, i) => (
                  <Card 
                    key={i} 
                    className="border border-border bg-card shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer overflow-hidden relative group"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                    <CardContent className="p-4 relative">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                          <stat.icon className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <p className="text-xl sm:text-2xl font-bold text-foreground">
                        {stat.value}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Tabs */}
        <Tabs
          value={activeProfileTab}
          onValueChange={(tab) => setSearchParams({ tab })}
          className="space-y-6"
        >
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg rounded-2xl border-2 border-border shadow-xl p-3">
            <TabsList className="w-full justify-start gap-1.5 sm:gap-2 bg-transparent p-0 flex overflow-x-auto scrollbar-hide pb-1">
              {[
                { value: "personal", label: t.personalInfo, icon: User },
                { value: "accounts", label: language === "en" ? "Accounts" : "الحسابات", icon: Activity },
                { value: "assets", label: language === "en" ? "Assets" : "الأصول", icon: DollarSign },
                { value: "notifications", label: language === "en" ? "Notifications" : "الإشعارات", icon: Bell },
                { value: "security", label: t.security, icon: Shield },
                { value: "referrals", label: t.referrals, icon: Users },
                { value: "trades", label: t.trades, icon: BarChart3 }
              ].map((tab) => (
                <TabsTrigger 
                  key={tab.value}
                  value={tab.value} 
                  className="group relative rounded-xl px-2 py-2 sm:px-4 sm:py-3 font-medium text-[10px] sm:text-sm whitespace-nowrap transition-all duration-300 border-2 border-transparent flex-shrink-0 data-[state=active]:border-blue-500 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/40 data-[state=inactive]:bg-muted/50 hover:bg-muted hover:border-muted-foreground/20"
                >
                  <tab.icon className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 inline-block" />
                  <span className="hidden xs:inline sm:inline">{tab.label}</span>
                  <span className="xs:hidden sm:hidden">
                    {tab.value === "personal" ? (language === "en" ? "Info" : "معلومات") :
                     tab.value === "accounts" ? (language === "en" ? "Acc" : "حساب") :
                     tab.value === "assets" ? (language === "en" ? "Assets" : "أصول") :
                     tab.value === "notifications" ? (language === "en" ? "Notif" : "إشعار") :
                     tab.value === "security" ? (language === "en" ? "Sec" : "أمان") :
                     tab.value === "referrals" ? (language === "en" ? "Ref" : "إحالة") :
                     tab.value === "trades" ? (language === "en" ? "Trade" : "تداول") : tab.label}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Personal Information Tab */}
          <TabsContent value="personal" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2 border-border shadow-xl rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-border bg-muted/30 p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-foreground">{t.personalInfo}</CardTitle>
                      <CardDescription className="text-sm text-muted-foreground">
                        {language === "en" ? "Manage your personal details" : "إدارة معلوماتك الشخصية"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600" />
                      User ID
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        value={formState.uuid} 
                        readOnly 
                        className="bg-muted/30 font-mono text-sm border-border rounded-xl" 
                      />
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => handleCopy(formState.uuid)} 
                        className="flex-shrink-0 rounded-xl border-border hover:bg-muted transition-all duration-300"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-blue-600" />
                      {t.displayNameLabel}
                    </Label>
                    <Input 
                      value={formState.fullName} 
                      onChange={(e) => setFormState({...formState, fullName: e.target.value})}
                      className="border-border rounded-xl"
                      placeholder={language === "en" ? "Enter your display name" : "أدخل اسمك"}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Activity className="h-4 w-4 text-blue-600" />
                      {t.bioLabel}
                    </Label>
                    <Textarea 
                      value={formState.bio} 
                      onChange={(e) => setFormState({...formState, bio: e.target.value})}
                      className="min-h-[120px] border-border rounded-xl resize-none"
                      placeholder={language === "en" ? "Tell us about yourself..." : "أخبرنا عن نفسك..."}
                    />
                  </div>
                </CardContent>
                <CardFooter className="border-t border-border bg-muted/30 p-6">
                  <Button 
                    onClick={handleSave} 
                    disabled={saving} 
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/30 rounded-xl transition-all duration-300 hover:scale-105"
                  >
                    {saving ? (
                      <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> {t.saving}</>
                    ) : (
                      <><CheckCircle2 className="mr-2 h-4 w-4" /> {t.saveChanges}</>
                    )}
                  </Button>
                </CardFooter>
              </Card>
              
              <div className="space-y-6">
                <Card className="border-border shadow-xl rounded-3xl overflow-hidden">
                  <CardHeader className="border-b border-border bg-muted/30 p-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg">
                        <LifeBuoy className="h-5 w-5 text-white" />
                      </div>
                      <CardTitle className="text-lg font-bold text-foreground">{t.support}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {language === "en" 
                        ? "Need help? Our team is available 24/7 to assist you."
                        : "تحتاج مساعدة؟ فريقنا متاح على مدار الساعة لمساعدتك."}
                    </p>
                    <Button 
                      variant="outline" 
                      className="w-full rounded-xl border-border text-foreground hover:bg-muted transition-all duration-300 hover:scale-105" 
                      onClick={() => navigate(createPageUrl("Contact"))}
                    >
                      <LifeBuoy className="mr-2 h-4 w-4" /> 
                      {language === "en" ? "Contact Support" : "اتصل بالدعم"}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border shadow-xl rounded-3xl overflow-hidden bg-card">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-lg">
                        <Award className="h-6 w-6 text-white" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-bold text-foreground">
                          {language === "en" ? "Account Status" : "حالة الحساب"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {language === "en" 
                            ? "Premium Member" 
                            : "عضو مميز"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Trading Accounts Tab */}
          <TabsContent value="accounts" className="space-y-6">
            {loadingAccount ? (
              <div className="flex flex-col items-center justify-center py-20">
                <RefreshCw className="h-12 w-12 animate-spin text-blue-600 mb-4" />
                <p className="text-muted-foreground font-medium">
                  {language === "en" ? "Loading accounts..." : "جاري تحميل الحسابات..."}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                  {demoAccount && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 animate-pulse" />
                          {language === "en" ? "Demo Account" : "حساب تجريبي"}
                        </h3>
                        <Badge className="bg-blue-100 text-blue-700 border-0">
                          {language === "en" ? "Practice" : "تدريب"}
                        </Badge>
                      </div>
                      <TradingAccountCard account={demoAccount} language={language} onRefresh={loadTradingAccounts} />
                    </div>
                  )}
                  {liveAccount && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 animate-pulse" />
                          {language === "en" ? "Live Account" : "حساب حقيقي"}
                        </h3>
                        <Badge className="bg-emerald-100 text-emerald-700 border-0">
                          {language === "en" ? "Real Money" : "مال حقيقي"}
                        </Badge>
                      </div>
                      <TradingAccountCard account={liveAccount} language={language} onRefresh={loadTradingAccounts} />
                    </div>
                  )}
                </div>

                <Card className="border-border shadow-xl rounded-3xl overflow-hidden">
                  <CardHeader className="border-b border-border bg-muted/30 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-lg">
                          <Activity className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-xl font-bold text-foreground">
                            {language === "en" ? "Open Positions" : "المراكز المفتوحة"}
                          </CardTitle>
                          <CardDescription className="text-sm text-muted-foreground">
                            {trades.filter(t => t.status === 'OPEN').length} {language === "en" ? "active trades" : "صفقة نشطة"}
                          </CardDescription>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => navigate(createPageUrl("Futures"))} 
                        className="rounded-xl border-border bg-background hover:bg-muted transition-all duration-300 hover:scale-105"
                      >
                        <TrendingUp className="mr-2 h-4 w-4" />
                        {language === "en" ? "New Trade" : "صفقة جديدة"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
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
                          toast({ 
                            title: language === "en" ? "Trade closed successfully" : "تم إغلاق الصفقة بنجاح",
                            className: "bg-emerald-50 border-emerald-200 text-emerald-900"
                          });
                        } catch (err) {
                          console.error("Failed to close trade", err);
                          toast({ 
                            variant: "destructive", 
                            title: "Error", 
                            description: err.message 
                          });
                        }
                      }}
                    />
                  </CardContent>
                </Card>

                <Card className="border-border shadow-xl rounded-3xl overflow-hidden">
                  <CardHeader className="border-b border-border bg-muted/30 p-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg">
                        <History className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold text-foreground">
                          {language === "en" ? "Trade History" : "سجل الصفقات"}
                        </CardTitle>
                        <CardDescription className="text-sm text-muted-foreground">
                          {language === "en" ? "Your recent closed trades" : "صفقاتك المغلقة الأخيرة"}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <TradesTable trades={trades.filter(t => t.status === 'CLOSED').slice(0, 10)} language={language} />
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Assets Tab */}
          <TabsContent value="assets" className="space-y-6">
            {loadingAccount ? (
              <div className="flex flex-col items-center justify-center py-20">
                <RefreshCw className="h-12 w-12 animate-spin text-blue-600 mb-4" />
                <p className="text-slate-600 font-medium">
                  {language === "en" ? "Loading assets..." : "جاري تحميل الأصول..."}
                </p>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
                <AssetsPage 
                  wallets={wallets} 
                  language={language} 
                  onRefresh={loadTradingAccounts} 
                  liveAccount={liveAccount} 
                  demoAccount={demoAccount} 
                  trades={trades} 
                />
                <div className="space-y-6">
                  <RecentTransactions language={language} />
                  <StakingPanel 
                    wallets={wallets} 
                    language={language} 
                    onRefresh={loadTradingAccounts} 
                  />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <NotificationPreferencesTab language={language} />
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            {/* Identity Verification Card - Prominent */}
            <Card className="border-border shadow-xl rounded-3xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-lg">
                      <ShieldCheck className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">
                        {language === "en" ? "Identity Verification (KYC)" : "التحقق من الهوية (KYC)"}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {language === "en" 
                          ? "Complete verification to unlock withdrawals and higher limits"
                          : "أكمل التحقق لفتح السحوبات والحدود الأعلى"}
                      </p>
                      {existingVerification && (
                        <Badge className={`mt-2 ${
                          existingVerification.status === 'approved' ? 'bg-emerald-500' :
                          existingVerification.status === 'rejected' ? 'bg-rose-500' :
                          'bg-amber-500'
                        } text-white`}>
                          {existingVerification.status === 'approved' ? (language === "en" ? "Verified" : "موثق") :
                           existingVerification.status === 'rejected' ? (language === "en" ? "Rejected" : "مرفوض") :
                           existingVerification.status === 'under_review' ? (language === "en" ? "Under Review" : "قيد المراجعة") :
                           (language === "en" ? "Pending" : "قيد الانتظار")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => setVerificationModalOpen(true)}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl px-6 shadow-lg"
                  >
                    {existingVerification?.status === 'approved' 
                      ? (language === "en" ? "View Status" : "عرض الحالة")
                      : existingVerification 
                        ? (language === "en" ? "Check Status" : "تحقق من الحالة")
                        : (language === "en" ? "Start Verification" : "بدء التحقق")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30 p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-red-600 to-red-700 shadow-lg">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-foreground">{t.security}</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      {language === "en" ? "Manage your account security settings" : "إدارة إعدادات أمان حسابك"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="divide-y divide-border p-0">
                {[
                  { 
                    title: t.passwordLabel, 
                    status: language === "en" ? "Last changed 3 months ago" : "آخر تغيير قبل 3 أشهر", 
                    icon: Lock, 
                    action: t.managePassword,
                    gradient: "from-blue-500 to-blue-600",
                    bgGradient: "from-blue-50 to-blue-50"
                  },
                  { 
                    title: t.twoFactor, 
                    status: formState.twoFactorEnabled 
                      ? (language === "en" ? "Enabled" : "مفعل") 
                      : (language === "en" ? "Disabled" : "معطل"), 
                    icon: ShieldCheck, 
                    action: language === "en" ? "Setup" : "إعداد",
                    gradient: "from-indigo-500 to-blue-600",
                    bgGradient: "from-indigo-50 to-blue-50"
                  }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-6 hover:bg-muted/50 transition-colors duration-200">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.bgGradient} border border-border shadow-sm`}>
                        <item.icon className={`h-6 w-6 text-transparent bg-gradient-to-r ${item.gradient} bg-clip-text`} style={{WebkitTextFillColor: 'transparent', backgroundClip: 'text'}} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.status}</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`text-transparent bg-gradient-to-r ${item.gradient} bg-clip-text hover:bg-muted rounded-xl transition-all duration-300`}
                    >
                      {item.action} <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30 p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold text-foreground">{t.loginActivity}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  {language === "en" 
                    ? "Monitor your recent login activity and sessions."
                    : "راقب نشاط تسجيل الدخول والجلسات الأخيرة."}
                </p>
              </CardContent>
            </Card>

            <VerificationModal
              open={verificationModalOpen}
              onOpenChange={setVerificationModalOpen}
              language={language}
              existingRequest={existingVerification}
            />
          </TabsContent>

          {/* Referrals Tab */}
          <TabsContent value="referrals" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { 
                  label: language === "en" ? "Today's Referrals" : "إحالات اليوم", 
                  value: "0",
                  gradient: "from-blue-500 to-blue-600",
                  bgGradient: "from-blue-50 to-blue-50"
                },
                { 
                  label: language === "en" ? "30D Referrals" : "إحالات 30 يوم", 
                  value: "12",
                  gradient: "from-emerald-500 to-emerald-600",
                  bgGradient: "from-emerald-50 to-emerald-50"
                },
                { 
                  label: language === "en" ? "Yesterday Commission" : "عمولة الأمس", 
                  value: "$0.00",
                  gradient: "from-indigo-500 to-indigo-600",
                  bgGradient: "from-indigo-50 to-indigo-50"
                },
                { 
                  label: language === "en" ? "30D Commission" : "عمولة 30 يوم", 
                  value: "$145.20",
                  gradient: "from-orange-500 to-orange-600",
                  bgGradient: "from-orange-50 to-orange-50"
                }
              ].map((stat, i) => (
                <Card key={i} className={`border-0 bg-gradient-to-br ${stat.bgGradient} shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer rounded-2xl`}>
                  <CardContent className="p-6">
                    <p className="text-xs font-medium text-slate-600 mb-3">{stat.label}</p>
                    <p className={`text-3xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                      {stat.value}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-border shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 shadow-lg">
                      <Gift className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-foreground">
                        {language === "en" ? "Referral Program" : "برنامج الإحالة"}
                      </CardTitle>
                      <CardDescription className="text-sm text-muted-foreground">
                        {language === "en" ? "Invite friends and earn commissions" : "ادعُ أصدقاءك واربح عمولات"}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-0 shadow-lg px-3 py-1">
                    {language === "en" ? "Active" : "نشط"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Gift className="h-4 w-4 text-indigo-600" />
                      {t.referralCode}
                    </Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input 
                        value={formState.referralCode} 
                        readOnly 
                        className="min-w-0 flex-1 font-mono font-bold text-lg bg-muted/30 border-border rounded-xl" 
                      />
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => handleCopy(formState.referralCode)} 
                        className="rounded-xl border-border hover:bg-muted transition-all duration-300"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-indigo-600" />
                      {t.referralLink}
                    </Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input 
                        value={formState.referralLink} 
                        readOnly 
                        className="min-w-0 flex-1 text-xs bg-muted/30 border-border rounded-xl" 
                      />
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => handleCopy(formState.referralLink)} 
                        className="rounded-xl border-border hover:bg-muted transition-all duration-300"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={handleShareReferral}
                    className="rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg shadow-blue-500/20"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    {t.shareInvite}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCopy(formState.referralLink)}
                    className="rounded-xl border-border hover:bg-muted"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {language === "ar" ? "نسخ الرابط" : "Copy link"}
                  </Button>
                </div>

                <div className="rounded-2xl bg-muted/30 p-6 border border-border">
                  <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-indigo-600" />
                    {language === "en" ? "How it works" : "كيف يعمل"}
                  </h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                      <span>{language === "en" ? "Share your unique referral link" : "شارك رابط الإحالة الفريد الخاص بك"}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                      <span>{language === "en" ? "Earn commissions when they trade" : "اربح عمولات عندما يتداولون"}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                      <span>{language === "en" ? "Commissions are credited to your wallet" : "تُضاف العمولات إلى محفظتك"}</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trades Tab */}
          <TabsContent value="trades" className="space-y-6">
            <Card className="border-border shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 border-b border-border bg-muted/30 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg">
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-foreground">{t.trades}</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      {language === "en" ? "Complete trading history" : "سجل التداول الكامل"}
                    </CardDescription>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-xl border-border hover:bg-muted transition-all duration-300"
                >
                  <ExternalLink className="mr-2 h-4 w-4" /> 
                  {language === "en" ? "Export" : "تصدير"}
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="font-semibold text-foreground">
                          {language === "en" ? "Symbol" : "الرمز"}
                        </TableHead>
                        <TableHead className="font-semibold text-foreground">
                          {language === "en" ? "Side" : "الجانب"}
                        </TableHead>
                        <TableHead className="font-semibold text-foreground">
                          {language === "en" ? "Size" : "الحجم"}
                        </TableHead>
                        <TableHead className="font-semibold text-foreground">P&L</TableHead>
                        <TableHead className="hidden sm:table-cell font-semibold text-foreground">
                          {language === "en" ? "Opened" : "فتح"}
                        </TableHead>
                        <TableHead className="hidden md:table-cell font-semibold text-foreground">
                          {language === "en" ? "Closed" : "إغلاق"}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const fmtTime = (iso) => {
                          if (!iso) return "—";
                          const d = new Date(iso);
                          if (Number.isNaN(d.getTime())) return "—";
                          return d.toLocaleString(language === "ar" ? "ar-AE" : undefined, {
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                        };

                        const calcPnl = (trade) => {
                          if (typeof trade?.pnl === "number") return trade.pnl;
                          if (trade?.status === "OPEN" && typeof trade?.unrealized_pnl === "number") return trade.unrealized_pnl;
                          return 0;
                        };

                        return trades
                          .slice(0, 20)
                          .map((trade, i) => {
                            const pnlVal = calcPnl(trade);
                            const opened = trade.opened_at || trade.created_at || trade.created_date;
                            const closed = trade.closed_at || trade.updated_at;

                            return (
                              <TableRow key={trade.id || i} className="hover:bg-slate-50 transition-colors duration-200">
                                <TableCell className="font-semibold text-slate-900">
                                  {trade.symbol}
                                  <div className="mt-1 text-[10px] text-slate-500 sm:hidden">
                                    <span className="text-slate-400">{language === "en" ? "Opened" : "فتح"}:</span> {fmtTime(opened)}
                                    <span className="mx-2 text-slate-300">•</span>
                                    <span className="text-slate-400">{language === "en" ? "Closed" : "إغلاق"}:</span> {fmtTime(closed)}
                                  </div>
                                </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`${
                                trade.side === 'LONG' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                                  : 'bg-rose-50 text-rose-700 border-rose-300'
                              } font-medium`}
                            >
                              {trade.side === 'LONG' ? (
                                <><TrendingUp className="mr-1 h-3 w-3" /> {trade.side}</>
                              ) : (
                                <><TrendingDown className="mr-1 h-3 w-3" /> {trade.side}</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{formatSize(trade.quantity)}</TableCell>
                          <TableCell className={`font-bold ${pnlVal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {pnlVal >= 0 ? '+' : ''}{Number(pnlVal).toFixed(2)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-slate-600">
                            {fmtTime(opened)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-slate-600">
                            {fmtTime(closed)}
                          </TableCell>
                              </TableRow>
                            );
                          });
                      })()}
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