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
  ArrowDownToLine
} from "lucide-react";
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
import CopyTradingDepositHistory from "@/components/copytrading/CopyTradingDepositHistory";

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

// Verification Badge Component - reads status directly from VerificationRequest entity
function VerificationBadge({ status, language, onClickNotVerified, onClickPending }) {
  const t = translations[language] || translations.en;
  
  // Status comes directly from VerificationRequest.status field
  // Values: 'pending', 'under_review', 'approved', 'rejected', 'needs_help'
  
  if (status === 'approved') {
    return (
      <Badge className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0 shadow-lg px-3 py-1 font-medium cursor-default">
        <CheckCircle2 className="mr-1 h-3 w-3" /> {t.verified}
      </Badge>
    );
  }
  
  if (status === 'rejected') {
    return (
      <Badge 
        className="bg-gradient-to-r from-rose-500 to-rose-600 text-white border-0 shadow-lg px-3 py-1 font-medium cursor-pointer hover:from-rose-600 hover:to-rose-700 transition-all duration-300 hover:scale-105"
        onClick={onClickNotVerified}
        role="button"
        tabIndex={0}
      >
        <AlertCircle className="mr-1 h-3 w-3" /> {language === "en" ? "Rejected" : "مرفوض"}
      </Badge>
    );
  }
  
  if (status === 'pending' || status === 'under_review' || status === 'needs_help') {
    return (
      <Badge 
        className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 shadow-lg px-3 py-1 font-medium cursor-pointer hover:from-blue-600 hover:to-blue-700 transition-all duration-300"
        onClick={onClickPending}
        role="button"
        tabIndex={0}
      >
        <Clock className="mr-1 h-3 w-3 animate-pulse" /> {language === "en" ? "Pending" : "قيد المراجعة"}
      </Badge>
    );
  }
  
  // No verification request exists (status is null/undefined) - show "Not Verified"
  return (
    <Badge 
      className="bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0 shadow-lg px-3 py-1 font-medium cursor-pointer hover:from-amber-600 hover:to-amber-700 transition-all duration-300 hover:scale-105"
      onClick={onClickNotVerified}
      role="button"
      tabIndex={0}
    >
      <AlertCircle className="mr-1 h-3 w-3" /> {t.notVerified}
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
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [existingVerification, setExistingVerification] = useState(null);
  const [copyTradingDepositOpen, setCopyTradingDepositOpen] = useState(false);

  const loadUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await base44.auth.me();
      let profile = normalizeUserProfile(data);
      
      // If no referral code, fetch/generate one
      if (!profile.referralCode) {
        try {
          const refRes = await base44.functions.invoke("referral", { action: "getMyReferralInfo" });
          if (refRes.data?.success && refRes.data.data?.code) {
            profile.referralCode = refRes.data.data.code;
            profile.referralLink = refRes.data.data.link;
          }
        } catch {}
      }
      
      setFormState(profile);
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
      // Note: We don't auto-create live accounts from frontend. Only demo accounts are auto-created.
      const [demoResult, walletsResult, tradesResult, okxResult, copyTradingResult] = await Promise.all([
        base44.functions.invoke('tradingAccount', { action: 'getOrCreate', accountType: 'demo' }),
        base44.functions.invoke('wallet', { action: 'list' }),
        base44.functions.invoke('tradingAccount', { action: 'getTrades' }),
        base44.functions.invoke('okxUserAccount', { action: 'getMyAccount' }),
        base44.functions.invoke('copyTradingUser', { action: 'getWallet' }).catch(() => ({ data: { ok: false } }))
      ]);
      
      if (demoResult.data?.success) setDemoAccount(demoResult.data.data);
      // Don't set liveAccount from demo result - live accounts are OKX-based only
      setLiveAccount(null);
      if (walletsResult.data?.success) setWallets(walletsResult.data.data || []);
      if (tradesResult.data?.success) setTrades(tradesResult.data.data || []);
      if (okxResult.data?.ok && okxResult.data.data?.hasAccount) {
        setOkxAccount(okxResult.data.data);
      }
      if (copyTradingResult.data?.ok) {
        setCopyTradingWallet(copyTradingResult.data.data);
      }
    } catch (err) {
      console.error("Failed to load accounts", err);
    } finally {
      setLoadingAccount(false);
    }
  }, []);

  const loadVerificationRequest = useCallback(async () => {
    try {
      const user = await base44.auth.me();
      // Get the most recent verification request for this user
      const requests = await base44.entities.VerificationRequest.filter({ user_id: user.id }, "-created_date", 1);
      
      if (requests && requests.length > 0) {
        const latestRequest = requests[0];
        // Always update the verification state with the latest data
        setExistingVerification(latestRequest);
      } else {
        // No verification request exists
        setExistingVerification(null);
      }
    } catch (err) {
      console.error("Failed to load verification:", err);
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

  // Subscribe to verification request changes for real-time badge update
  useEffect(() => {
    if (!isAuthenticated || isLoadingAuth) return;

    let userId = null;
    
    // Get current user ID first
    base44.auth.me().then(user => {
      userId = user.id;
    }).catch(() => {});

    const unsubscribe = base44.entities.VerificationRequest.subscribe((event) => {
      // Check if this update is for the current user
      if (userId && event.data?.user_id === userId) {
        // Update verification state immediately
        setExistingVerification(event.data);
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated, isLoadingAuth]);

  // Poll for verification status changes as backup (every 5 seconds)
  useEffect(() => {
    if (!isAuthenticated || isLoadingAuth) return;
    
    const pollInterval = setInterval(() => {
      loadVerificationRequest();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [isAuthenticated, isLoadingAuth, loadVerificationRequest]);

  // Auto-open verification modal if requested via URL
  useEffect(() => {
    if (shouldOpenVerification && !isLoadingAuth && isAuthenticated) {
      setVerificationModalOpen(true);
      // Clear the query param after opening
      setSearchParams({ openVerification: null });
    }
  }, [shouldOpenVerification, isLoadingAuth, isAuthenticated]);

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
      // Use base44.auth.updateMe() to persist custom user fields
      await base44.auth.updateMe({
        full_name: formState.fullName,
        bio: formState.bio,
        avatar_url: formState.avatarUrl
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

    // Max 5MB for avatar upload
    const maxBytes = 5_000_000;
    if (file.size > maxBytes) {
      toast({ variant: 'destructive', title: 'Error', description: t.photoTooLarge });
      return;
    }

    try {
      // Upload to Base44 storage for permanent URL
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      setFormState((prev) => ({ ...prev, avatarUrl: file_url }));
      toast({ title: t.photoUpdated, duration: 1500, className: "bg-emerald-50 border-emerald-200 text-emerald-900" });
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
                    {/* Verification Badge - reads directly from existingVerification.status */}
                    <VerificationBadge 
                      status={existingVerification?.status} 
                      language={language}
                      onClickNotVerified={() => {
                        setSearchParams({ tab: 'security' });
                        setVerificationModalOpen(true);
                      }}
                      onClickPending={() => setSearchParams({ tab: 'security' })}
                    />
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
                    // Show OKX real balance + Copy Trading balance (no demo)
                    value: `$${((okxAccount?.balances?.tradingUsdt || 0) + (okxAccount?.balances?.fundingUsdt || 0) + (copyTradingWallet?.available_balance || 0)).toFixed(2)}`,
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
                  {/* Copy Trading Wallet Card */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 animate-pulse" />
                        {language === "en" ? "Copy Trading Account" : "حساب نسخ التداول"}
                      </h3>
                      <Badge className="bg-blue-100 text-blue-700 border-0">
                        {language === "en" ? "Managed" : "مُدار"}
                      </Badge>
                    </div>
                    <Card className="border-slate-200 shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                      <CardContent className="p-0">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
                              <Wallet className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-900">{language === "en" ? "Copy Trading" : "نسخ التداول"}</h3>
                              <Badge className={`text-[10px] ${copyTradingWallet?.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                                {copyTradingWallet?.status === 'ACTIVE' ? (language === "en" ? "Active" : "نشط") : (language === "en" ? "Inactive" : "غير نشط")}
                              </Badge>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={loadTradingAccounts} className="h-8 w-8">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50">
                          <p className="text-xs text-slate-500 mb-1">{language === "en" ? "Available Balance" : "الرصيد المتاح"}</p>
                          <p className="text-2xl sm:text-3xl font-bold text-slate-900">
                            ${(copyTradingWallet?.available_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-px bg-slate-100">
                          <div className="p-3 bg-white">
                            <p className="text-[10px] text-slate-500 uppercase">{language === "en" ? "Locked" : "مقفل"}</p>
                            <p className="text-sm font-bold text-slate-900">
                              ${(copyTradingWallet?.locked_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="p-3 bg-white">
                            <p className="text-[10px] text-slate-500 uppercase">{language === "en" ? "Total Deposited" : "إجمالي الإيداع"}</p>
                            <p className="text-sm font-bold text-slate-900">
                              ${(copyTradingWallet?.lifetime_deposited || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                        <div className="p-3 border-t border-slate-100">
                          <Button
                            size="sm"
                            onClick={() => setCopyTradingDepositOpen(true)}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs"
                          >
                            <ArrowDownToLine className="h-3 w-3 mr-1" />
                            {language === "en" ? "Transfer to Copy Trading" : "تحويل إلى نسخ التداول"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    {/* Copy Trading Deposit History */}
                    <CopyTradingDepositHistory language={language} limit={5} />
                  </div>
                  {/* OKX Live Account - Priority */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 animate-pulse" />
                        {language === "en" ? "Trading Account" : "حساب تداول"}
                      </h3>
                      {okxAccount && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-0">
                          {language === "en" ? "Real Money" : "مال حقيقي"}
                        </Badge>
                      )}
                    </div>
                    <OKXLiveAccountCard language={language} onRefresh={loadTradingAccounts} />
                  </div>
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
                        {existingVerification?.status === 'approved'
                          ? (language === "en" 
                              ? "Your identity has been verified successfully"
                              : "تم التحقق من هويتك بنجاح")
                          : (language === "en" 
                              ? "Complete verification to unlock withdrawals and higher limits"
                              : "أكمل التحقق لفتح السحوبات والحدود الأعلى")
                        }
                      </p>
                      {existingVerification && (
                          <Badge className={`mt-2 ${
                            existingVerification.status === 'approved' ? 'bg-emerald-500' :
                            existingVerification.status === 'rejected' ? 'bg-rose-500' :
                            existingVerification.status === 'needs_help' ? 'bg-amber-500' :
                            'bg-amber-500'
                          } text-white`}>
                            {existingVerification.status === 'approved' ? (language === "en" ? "Verified" : "موثق") :
                             existingVerification.status === 'rejected' ? (language === "en" ? "Rejected" : "مرفوض") :
                             existingVerification.status === 'under_review' ? (language === "en" ? "Under Review" : "قيد المراجعة") :
                             existingVerification.status === 'needs_help' ? (language === "en" ? "Help Requested" : "طلب مساعدة") :
                             (language === "en" ? "Pending" : "قيد الانتظار")}
                          </Badge>
                        )}
                        {existingVerification?.admin_response && existingVerification.status !== 'approved' && (
                          <div className="mt-2 p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-xs">
                            <p className="font-medium text-blue-700 dark:text-blue-400">
                              {language === "en" ? "Admin Response:" : "رد الإدارة:"}
                            </p>
                            <p className="text-blue-600 dark:text-blue-300">{existingVerification.admin_response}</p>
                          </div>
                        )}
                    </div>
                  </div>
                  {/* Hide button when verified */}
                  {existingVerification?.status !== 'approved' && (
                    <Button
                      onClick={() => setVerificationModalOpen(true)}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl px-6 shadow-lg"
                    >
                      {existingVerification 
                        ? (language === "en" ? "Check Status" : "تحقق من الحالة")
                        : (language === "en" ? "Start Verification" : "بدء التحقق")}
                    </Button>
                  )}
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

            {/* Copy Trading Deposit Modal */}
            <AllocationModal
              open={copyTradingDepositOpen}
              onOpenChange={setCopyTradingDepositOpen}
              language={language}
              onSuccess={loadTradingAccounts}
            />
          </TabsContent>

          {/* Referrals Tab - Link to Rewards Hub */}
          <TabsContent value="referrals" className="space-y-6">
            <Card className="border-border shadow-xl rounded-3xl overflow-hidden">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center mx-auto mb-4">
                  <Gift className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  {language === "en" ? "Rewards Hub" : "مركز المكافآت"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {language === "en" 
                    ? "Earn through referrals, daily check-ins, and milestones!" 
                    : "اربح من الإحالات والتسجيل اليومي والإنجازات!"}
                </p>
                
                {/* Earnings Preview */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                    <p className="text-xs text-muted-foreground">Level 1</p>
                    <p className="text-lg font-bold text-blue-600">$10</p>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30">
                    <p className="text-xs text-muted-foreground">Level 2</p>
                    <p className="text-lg font-bold text-purple-600">$2</p>
                  </div>
                  <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/30">
                    <p className="text-xs text-muted-foreground">Level 3</p>
                    <p className="text-lg font-bold text-orange-600">$0.50</p>
                  </div>
                </div>
                
                {formState?.referralCode && (
                  <div className="mb-6 p-4 rounded-xl bg-muted/30 border border-border">
                    <p className="text-xs text-muted-foreground mb-2">{t.referralCode}</p>
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-lg font-bold font-mono text-foreground">{formState.referralCode}</code>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleCopy(formState.referralCode)}
                        className="h-8 w-8 p-0"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                
                <Button
                  asChild
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl px-8"
                >
                  <Link to={createPageUrl("Rewards")}>
                    <Gift className="mr-2 h-4 w-4" />
                    {language === "en" ? "Go to Rewards Hub" : "اذهب إلى مركز المكافآت"}
                  </Link>
                </Button>
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