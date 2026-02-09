import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  Shield,
  Wallet,
  ArrowDownToLine,
  PlayCircle,
  HelpCircle
} from "lucide-react";
import VideoModal from "@/components/help/VideoModal";
import { getHelpVideo } from "@/components/help/helpVideos";
import TradingAccountCard from "@/components/profile/TradingAccountCard";
import OKXLiveAccountCard from "@/components/profile/OKXLiveAccountCard";
import TradesTable from "@/components/profile/TradesTable";
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
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import AuthRequiredState from "@/components/AuthRequiredState";
import VerificationModal from "@/components/profile/VerificationModal";
import AllocationModal from "@/components/copytrading/AllocationModal";
import CopyTradingDepositHistory from "@/components/copytrading/CopyTradingDepositHistory.jsx";
import CopyTradingSettingsForm from "@/components/copytrading/CopyTradingSettingsForm.jsx";
import DangerZone from "@/components/profile/DangerZone";
import ChangePasswordModal from "@/components/profile/ChangePasswordModal";

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

const REFERRAL_DOMAIN = "https://nexttrade.exchange";

const normalizeUserProfile = (user = {}) => ({
  uuid: user.id || "---",
  fullName: user.full_name || user.fullName || user.name || "",
  email: user.email || "",
  bio: user.bio || "",
  avatarUrl: user.avatar_url || user.avatarUrl || "",
  twoFactorEnabled: user.twoFactorEnabled || false,
  referralCode: user.referralCode || user.referral_code || "",
  referralLink: user.referralCode || user.referral_code 
    ? `${REFERRAL_DOMAIN}/r/${user.referralCode || user.referral_code}`
    : "",
  createdDate: user.created_date || user.createdDate || new Date().toISOString()
});

// Verification Badge Component
function VerificationBadge({ status, language, onClickNotVerified, onClickPending }) {
  const t = translations[language] || translations.en;
  
  if (status === 'approved') {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1 font-medium cursor-default">
        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> {t.verified}
      </Badge>
    );
  }
  
  if (status === 'rejected') {
    return (
      <Badge 
        className="bg-rose-500/10 text-rose-500 border-rose-500/20 px-3 py-1 font-medium cursor-pointer hover:bg-rose-500/20 transition-all duration-300"
        onClick={onClickNotVerified}
        role="button"
        tabIndex={0}
      >
        <AlertCircle className="mr-1.5 h-3.5 w-3.5" /> {language === "en" ? "Rejected" : "مرفوض"}
      </Badge>
    );
  }
  
  if (status === 'pending' || status === 'under_review' || status === 'needs_help') {
    return (
      <Badge 
        className="bg-blue-500/10 text-blue-500 border-blue-500/20 px-3 py-1 font-medium cursor-pointer hover:bg-blue-500/20 transition-all duration-300"
        onClick={onClickPending}
        role="button"
        tabIndex={0}
      >
        <Clock className="mr-1.5 h-3.5 w-3.5 animate-pulse" /> {language === "en" ? "Pending" : "قيد المراجعة"}
      </Badge>
    );
  }
  
  return (
    <Badge 
      className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-3 py-1 font-medium cursor-pointer hover:bg-amber-500/20 transition-all duration-300"
      onClick={onClickNotVerified}
      role="button"
      tabIndex={0}
    >
      <AlertCircle className="mr-1.5 h-3.5 w-3.5" /> {t.notVerified}
    </Badge>
  );
}

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
  const shouldOpenVerification = new URLSearchParams(location.search).get('openVerification') === 'true';

  const avatarInputRef = useRef(null);

  const [formState, setFormState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [demoAccount, setDemoAccount] = useState(null);
  const [liveAccount, setLiveAccount] = useState(null);
  const [okxAccount, setOkxAccount] = useState(null);
  const [copyTradingWallet, setCopyTradingWallet] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [trades, setTrades] = useState([]);
  const [referralStats, setReferralStats] = useState({ signups: 0 });
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [existingVerification, setExistingVerification] = useState(null);
  const [allocationModalOpen, setAllocationModalOpen] = useState(false);
  const [copyTradingDepositOpen, setCopyTradingDepositOpen] = useState(false);
  const [kycVideoOpen, setKycVideoOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      const user = await base44.auth.me();
      if (!user) throw new Error("User not found");
      setFormState(normalizeUserProfile(user));
      
      // Load verification status
      const verifications = await base44.entities.VerificationRequest.filter({ user_id: user.id }, '-created_date', 1);
      if (verifications?.length > 0) {
        setExistingVerification(verifications[0]);
      }
    } catch (err) {
      console.error("Failed to load user:", err);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  const loadTradingAccounts = useCallback(async () => {
    try {
      setLoadingAccount(true);
      const user = await base44.auth.me();
      if (!user) return;

      const [demo, live, okx, walletsRes, tradesRes, referralRes, copyTradingRes] = await Promise.all([
        base44.entities.TradingAccount.filter({ user_id: user.id, is_demo: true }, '-created_date', 1),
        base44.entities.TradingAccount.filter({ user_id: user.id, is_demo: false }, '-created_date', 1),
        base44.functions.invoke("okxUserAccount", { action: "getMyAccount" }).catch(() => ({ data: { ok: false } })),
        base44.functions.invoke("wallet", { action: "list" }),
        base44.entities.Trade.filter({ user_id: user.id }, '-opened_at', 50),
        base44.functions.invoke("referral", { action: "getStats" }),
        base44.functions.invoke("copyTradingUser", { action: "getWallet" }).catch(() => ({ data: { ok: false } }))
      ]);

      if (demo?.length > 0) setDemoAccount(demo[0]);
      if (live?.length > 0) setLiveAccount(live[0]);
      if (okx.data?.ok) setOkxAccount(okx.data.data);
      if (walletsRes.data?.success) setWallets(walletsRes.data.data);
      if (tradesRes) setTrades(tradesRes);
      if (referralRes.data?.success) setReferralStats(referralRes.data.data);
      if (copyTradingRes.data?.ok) setCopyTradingWallet(copyTradingRes.data.data);

    } catch (err) {
      console.error("Failed to load trading accounts:", err);
    } finally {
      setLoadingAccount(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadUser();
      loadTradingAccounts();
    }
  }, [isAuthenticated, loadUser, loadTradingAccounts]);

  useEffect(() => {
    if (shouldOpenVerification && !verificationModalOpen) {
      setVerificationModalOpen(true);
      setSearchParams({ openVerification: null });
    }
  }, [shouldOpenVerification, verificationModalOpen]);

  const handleCopy = useCallback((text) => {
    navigator.clipboard.writeText(text);
    toast({ title: t.copySuccess, duration: 2000 });
  }, [toast, t.copySuccess]);

  const handleSaveProfile = useCallback(async (e) => {
    e.preventDefault();
    if (!formState) return;
    setSaving(true);
    try {
      await base44.auth.update({
        full_name: formState.fullName,
        bio: formState.bio,
        avatar_url: formState.avatarUrl
      });
      toast({ title: t.updateSuccess, duration: 2000 });
    } catch (err) {
      console.error("Failed to update profile:", err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update profile' });
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

    const maxBytes = 5_000_000;
    if (file.size > maxBytes) {
      toast({ variant: 'destructive', title: 'Error', description: t.photoTooLarge });
      return;
    }

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormState((prev) => ({ ...prev, avatarUrl: file_url }));
      toast({ title: t.photoUpdated, duration: 1500 });
    } catch (err) {
      console.error("Failed to upload avatar:", err);
      toast({ variant: 'destructive', title: 'Error', description: language === "ar" ? "فشل رفع الصورة" : "Failed to upload image" });
    }
  }, [toast, t.invalidPhotoType, t.photoTooLarge, t.photoUpdated, language]);

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
          <Skeleton className="h-48 w-full rounded-2xl" />
          <div className="grid gap-4 lg:grid-cols-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="mx-auto max-w-2xl">
          <Alert variant="destructive" className="border-destructive/20 bg-destructive/5">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
          <Button 
            onClick={loadUser} 
            className="mt-6 rounded-xl"
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
        
        {/* Profile Header */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-border/40 bg-card/50 backdrop-blur-md shadow-sm">
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div
                className="relative group"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleAvatarDrop}
              >
                <Avatar className="h-24 w-24 sm:h-28 sm:w-28 border-2 border-border/40 shadow-sm">
                  <AvatarImage src={formState.avatarUrl} alt={formState.fullName} />
                  <AvatarFallback className="bg-muted text-2xl sm:text-3xl font-bold text-muted-foreground">
                    {formState.fullName?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-border/40 bg-background text-foreground shadow-sm hover:bg-muted transition-all duration-300"
                  aria-label={t.changePhoto}
                >
                  <Upload className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarInputChange}
                />
              </div>
              
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    {formState.fullName || "User"}
                  </h1>
                  <VerificationBadge 
                    status={existingVerification?.status} 
                    language={language}
                    onClickNotVerified={() => setVerificationModalOpen(true)}
                    onClickPending={() => setVerificationModalOpen(true)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {t.memberSince} {memberSinceDate}
                  </div>
                  <div className="flex items-center gap-1.5 font-mono">
                    <User className="h-3.5 w-3.5" />
                    {formState.uuid.slice(0, 8)}...
                    <button onClick={() => handleCopy(formState.uuid)} className="hover:text-foreground transition-colors">
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadTradingAccounts}
                  className="rounded-lg border-border/40 h-9 flex-1 sm:flex-none"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-2 ${loadingAccount ? 'animate-spin' : ''}`} />
                  {t.refresh}
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleLogout}
                  className="rounded-lg h-9 flex-1 sm:flex-none"
                >
                  <LogOut className="h-3.5 w-3.5 mr-2" />
                  {t.logout}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Navigation Tabs */}
        <Tabs value={activeProfileTab} onValueChange={(v) => setSearchParams({ tab: v })} className="space-y-8">
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="w-full sm:w-auto justify-start bg-transparent border-b border-border/40 rounded-none h-auto p-0 gap-6">
              {[
                { id: "personal", label: t.personalInfo, icon: User },
                { id: "accounts", label: language === "en" ? "Accounts" : "الحسابات", icon: Wallet },
                { id: "notifications", label: language === "en" ? "Notifications" : "الإشعارات", icon: Bell },
                { id: "security", label: t.security, icon: Shield },
                { id: "referrals", label: t.referrals, icon: Users },
                { id: "trades", label: t.trades, icon: BarChart3 },
                { id: "copy_settings", label: language === "en" ? "Copy Settings" : "إعدادات النسخ", icon: TrendingUp }
              ].map((tab) => (
                <TabsTrigger 
                  key={tab.id}
                  value={tab.id}
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 py-3 gap-2 transition-all"
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Personal Info Tab */}
          <TabsContent value="personal" className="mt-0">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      {t.personalInfo}
                    </CardTitle>
                    <CardDescription>Manage your public profile and personal details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{language === "en" ? "User ID" : "معرف المستخدم"}</Label>
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/40 font-mono text-sm">
                          <span className="truncate flex-1">{formState.uuid}</span>
                          <Button variant="ghost" size="sm" onClick={() => handleCopy(formState.uuid)} className="h-7 w-7 p-0">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.displayNameLabel}</Label>
                        <Input 
                          value={formState.fullName} 
                          onChange={(e) => setFormState(prev => ({ ...prev, fullName: e.target.value }))}
                          className="rounded-lg border-border/40 bg-background"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.bioLabel}</Label>
                      <Textarea 
                        value={formState.bio} 
                        onChange={(e) => setFormState(prev => ({ ...prev, bio: e.target.value }))}
                        className="rounded-lg border-border/40 bg-background min-h-[100px] resize-none"
                        placeholder="Tell us about yourself..."
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-border/40 bg-muted/10 pt-6">
                    <Button 
                      onClick={handleSaveProfile} 
                      disabled={saving}
                      className="rounded-lg px-8"
                    >
                      {saving ? t.saving : t.saveChanges}
                    </Button>
                  </CardFooter>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LifeBuoy className="h-5 w-5 text-primary" />
                      {t.support}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">Need help? Check our guides or contact support.</p>
                    <Button variant="outline" className="w-full justify-start rounded-lg border-border/40" asChild>
                      <Link to={createPageUrl("Help")}>
                        <HelpCircle className="mr-2 h-4 w-4" /> Help Center
                      </Link>
                    </Button>
                    <Button variant="outline" className="w-full justify-start rounded-lg border-border/40" asChild>
                      <Link to={createPageUrl("Contact")}>
                        <Headphones className="mr-2 h-4 w-4" /> Contact Support
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      Account Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <span className="text-sm font-medium">Premium Member</span>
                      <Badge className="bg-primary/20 text-primary border-none">Active</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Accounts Tab */}
          <TabsContent value="accounts" className="mt-0 space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                {/* Copy Trading Wallet */}
                <Card className="overflow-hidden">
                  <CardHeader className="bg-muted/30 border-b border-border/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <TrendingUp className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Copy Trading Wallet</CardTitle>
                          <CardDescription>Funds allocated for copy trading</CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="rounded-md border-border/40">USDT</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="grid grid-cols-2 divide-x divide-border/40">
                      <div className="p-6">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Available</p>
                        <p className="text-2xl font-bold font-mono">
                          ${(copyTradingWallet?.available_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="p-6">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Locked</p>
                        <p className="text-2xl font-bold font-mono">
                          ${(copyTradingWallet?.locked_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-muted/10 border-t border-border/40 p-4">
                    <Button 
                      size="sm" 
                      onClick={() => setCopyTradingDepositOpen(true)}
                      className="w-full rounded-lg"
                    >
                      <ArrowDownToLine className="h-4 w-4 mr-2" />
                      Transfer to Copy Trading
                    </Button>
                  </CardFooter>
                </Card>

                {/* Trading Account */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Trading Account
                    </h3>
                  </div>
                  <OKXLiveAccountCard language={language} onRefresh={loadTradingAccounts} />
                </div>
              </div>

              <div className="space-y-6">
                <CopyTradingDepositHistory language={language} limit={5} />
              </div>
            </div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="mt-0">
            <NotificationPreferencesTab language={language} />
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="mt-0 space-y-6">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <ShieldCheck className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-bold">Identity Verification (KYC)</h3>
                        <button
                          type="button"
                          onClick={() => setKycVideoOpen(true)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                          Watch how
                        </button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {existingVerification?.status === 'approved'
                          ? "Your identity has been verified successfully"
                          : "Complete verification to unlock withdrawals and higher limits"}
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setVerificationModalOpen(true)}
                    variant={existingVerification?.status === 'approved' ? "outline" : "default"}
                    className="rounded-lg px-6"
                  >
                    {existingVerification?.status === 'approved' ? "View Status" : "Start Verification"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" />
                    Password Management
                  </CardTitle>
                  <CardDescription>Update your account password regularly</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" onClick={() => setChangePasswordOpen(true)} className="w-full rounded-lg border-border/40">
                    Change Password
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Two-Factor Authentication
                  </CardTitle>
                  <CardDescription>Add an extra layer of security</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-sm font-medium">Status</span>
                    <Badge variant="secondary" className="rounded-md">Disabled</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            <DangerZone language={language} />
          </TabsContent>

          {/* Referrals Tab */}
          <TabsContent value="referrals" className="mt-0">
            <Card className="max-w-2xl mx-auto text-center">
              <CardContent className="p-10 space-y-6">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Gift className="h-10 w-10 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold">Rewards Hub</h3>
                  <p className="text-muted-foreground">Earn through referrals, daily check-ins, and milestones!</p>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Level 1", value: "$10", color: "text-primary" },
                    { label: "Level 2", value: "$2", color: "text-blue-500" },
                    { label: "Level 3", value: "$0.50", color: "text-purple-500" }
                  ].map((lvl) => (
                    <div key={lvl.label} className="p-4 rounded-xl bg-muted/30 border border-border/40">
                      <p className="text-xs font-medium text-muted-foreground mb-1">{lvl.label}</p>
                      <p className={`text-xl font-bold ${lvl.color}`}>{lvl.value}</p>
                    </div>
                  ))}
                </div>
                
                {formState?.referralCode && (
                  <div className="p-6 rounded-xl bg-muted/30 border border-border/40 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t.referralCode}</p>
                    <div className="flex items-center justify-center gap-3">
                      <code className="text-2xl font-bold font-mono tracking-tighter">{formState.referralCode}</code>
                      <Button variant="ghost" size="sm" onClick={() => handleCopy(formState.referralCode)} className="h-10 w-10 p-0">
                        <Copy className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                )}
                
                <Button asChild className="w-full sm:w-auto rounded-xl px-10 h-12 text-base">
                  <Link to={createPageUrl("Rewards")}>
                    Go to Rewards Hub
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trades Tab */}
          <TabsContent value="trades" className="mt-0 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-1">
                  <CardTitle>Trade History</CardTitle>
                  <CardDescription>Your complete trading activity</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="rounded-lg border-border/40">
                  <ExternalLink className="h-4 w-4 mr-2" /> Export
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border/40">
                        <TableHead>Symbol</TableHead>
                        <TableHead>Side</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>P&L</TableHead>
                        <TableHead className="hidden sm:table-cell">Opened</TableHead>
                        <TableHead className="hidden md:table-cell">Closed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trades.slice(0, 20).map((trade, i) => {
                        const pnlVal = trade.pnl || trade.unrealized_pnl || 0;
                        const opened = trade.opened_at || trade.created_at;
                        const closed = trade.closed_at || trade.updated_at;
                        return (
                          <TableRow key={trade.id || i} className="border-border/40">
                            <TableCell className="font-bold">{trade.symbol}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={trade.side === 'LONG' ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' : 'text-rose-500 border-rose-500/20 bg-rose-500/5'}>
                                {trade.side}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">{formatSize(trade.quantity)}</TableCell>
                            <TableCell className={`font-bold font-mono ${pnlVal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {pnlVal >= 0 ? '+' : ''}{Number(pnlVal).toFixed(2)}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                              {new Date(opened).toLocaleString()}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                              {closed ? new Date(closed).toLocaleString() : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Copy Settings Tab */}
          <TabsContent value="copy_settings" className="mt-0">
            <CopyTradingSettingsForm language={language} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <VerificationModal 
        open={verificationModalOpen} 
        onOpenChange={setVerificationModalOpen} 
        language={language}
        onSuccess={loadUser}
      />
      <AllocationModal
        open={allocationModalOpen}
        onOpenChange={setAllocationModalOpen}
        language={language}
        onSuccess={loadTradingAccounts}
      />
      <ChangePasswordModal
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
        language={language}
        userId={formState?.uuid}
        userEmail={formState?.email}
      />
      {kycVideoOpen && (
        <VideoModal
          open={kycVideoOpen}
          onClose={() => setKycVideoOpen(false)}
          youtubeId={getHelpVideo("kyc_verification")?.youtube_id || "R7IeJxSWkP8"}
          title={language === "en" ? "Verify account (KYC)" : "توثيق الحساب (KYC)"}
        />
      )}
    </div>
  );
}

Profile.propTypes = {
  language: PropTypes.oneOf(["en", "ar"])
};
