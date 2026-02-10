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

// Verification Badge Component - reads status directly from VerificationRequest entity
function VerificationBadge({ status, language, onClickNotVerified, onClickPending }) {
  const t = translations[language] || translations.en;
  
  // Status comes directly from VerificationRequest.status field
  // Values: 'pending', 'under_review', 'approved', 'rejected', 'needs_help'
  
  if (status === 'approved') {
    return (
      <Badge className="bg-emerald-600 dark:bg-emerald-700 text-white border-0 px-3 py-1 font-medium cursor-default">
        <CheckCircle2 className="mr-1 h-3 w-3" /> {t.verified}
      </Badge>
    );
  }
  
  if (status === 'rejected') {
    return (
      <Badge 
        className="bg-rose-600 dark:bg-rose-700 text-white border-0 px-3 py-1 font-medium cursor-pointer hover:bg-rose-700 dark:hover:bg-rose-800 transition-colors"
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
        className="bg-primary text-primary-foreground border-0 px-3 py-1 font-medium cursor-pointer hover:bg-primary/90 transition-colors"
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
      className="bg-amber-600 dark:bg-amber-700 text-white border-0 px-3 py-1 font-medium cursor-pointer hover:bg-amber-700 dark:hover:bg-amber-800 transition-colors"
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
  const [referralStats, setReferralStats] = useState({ signups: 0 });
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [existingVerification, setExistingVerification] = useState(null);
  const [copyTradingDepositOpen, setCopyTradingDepositOpen] = useState(false);
  const [kycVideoOpen, setKycVideoOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const loadUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await base44.auth.me();
      let profile = normalizeUserProfile(data);
      
      // Fetch referral info (code + stats)
      try {
        const refRes = await base44.functions.invoke("referral", { action: "getMyReferralInfo" });
        if (refRes.data?.success) {
          if (refRes.data.data?.code) {
            profile.referralCode = refRes.data.data.code;
            profile.referralLink = refRes.data.data.link;
          }
          if (refRes.data.data?.stats) {
            setReferralStats(refRes.data.data.stats);
          }
        }
      } catch (err) {
        console.error("Failed to load referral info", err);
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
      // Use verificationService to get status from UserVerification (single source of truth)
      const res = await base44.functions.invoke("verificationService", { action: "getStatus" });
      
      if (res.data?.ok) {
        const uvData = res.data.data;
        
        if (uvData.exists) {
          // Map status: verified → approved for UI compatibility
          const mappedStatus = uvData.status === "verified" ? "approved" : uvData.status;
          
          // If we have current request details, include them
          if (uvData.current_request) {
            setExistingVerification({
              ...uvData.current_request,
              status: mappedStatus
            });
          } else {
            // No current request but status exists
            setExistingVerification({
              status: mappedStatus,
              rejection_reason: uvData.rejection_reason
            });
          }
        } else {
          // No UserVerification record = unverified
          setExistingVerification(null);
        }
      } else {
        setExistingVerification(null);
      }
    } catch (err) {
      console.error("Failed to load verification:", err);
      setExistingVerification(null);
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

  // Subscribe to UserVerification changes for real-time badge update
  useEffect(() => {
    if (!isAuthenticated || isLoadingAuth) return;

    let userId = null;
    
    // Get current user ID first
    base44.auth.me().then(user => {
      userId = user.id;
    }).catch(() => {});

    const unsubscribe = base44.entities.UserVerification.subscribe((event) => {
      // Check if this update is for the current user
      if (userId && event.data?.user_id === userId) {
        // Reload verification status when UserVerification changes
        loadVerificationRequest();
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated, isLoadingAuth, loadVerificationRequest]);

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
        className: "bg-card border-border text-foreground"
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
          <Skeleton className="h-48 w-full rounded-2xl" />
          <div className="grid gap-4 lg:grid-cols-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
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
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
          <Button 
            onClick={loadUser} 
            className="mt-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
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
        <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="relative p-6 sm:p-8">
            
            <div className="flex flex-col gap-6">
              {/* Top Row: Avatar and Info */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div
                  className="relative group"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleAvatarDrop}
                >
                  <Avatar className="relative h-24 w-24 sm:h-28 sm:w-28 border-4 border-border shadow-lg">
                    <AvatarImage src={formState.avatarUrl} alt={formState.fullName} />
                    <AvatarFallback className="bg-muted text-2xl sm:text-3xl font-bold text-foreground">
                      {formState.fullName?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-all duration-200"
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
                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg flex-1 sm:flex-none"
                  >
                    <TrendingUp className="mr-2 h-4 w-4" /> Trade Now
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => { loadUser(); loadTradingAccounts(); }} 
                    className="rounded-lg border-border text-foreground hover:bg-muted flex-1 sm:flex-none"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" /> {t.refresh}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleLogout} 
                    className="rounded-lg border-destructive/30 text-destructive hover:bg-destructive/10 flex-1 sm:flex-none"
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
                    value: `$${((okxAccount?.balances?.tradingUsdt || 0) + (okxAccount?.balances?.fundingUsdt || 0) + (copyTradingWallet?.available_balance || 0)).toFixed(2)}`,
                    icon: DollarSign
                  },
                  { 
                    label: language === "en" ? "Total P&L" : "الربح/الخسارة", 
                    value: `$${trades.reduce((sum, t) => sum + (t.pnl || 0), 0).toFixed(2)}`,
                    icon: BarChart3
                  },
                  { 
                    label: language === "en" ? "Open Trades" : "الصفقات المفتوحة", 
                    value: trades.filter(t => t.status === 'OPEN').length,
                    icon: Activity
                  },
                  { 
                    label: language === "en" ? "Referrals" : "الإحالات", 
                    value: (referralStats?.signups || 0).toString(),
                    icon: Users
                  }
                ].map((stat, i) => (
                  <Card 
                    key={i} 
                    className="border border-border bg-card"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                        <div className="p-1.5 rounded-lg bg-muted">
                          <stat.icon className="h-4 w-4 text-muted-foreground" />
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
          <div className="bg-card border border-border rounded-xl p-1.5">
            <TabsList
              className="w-full justify-start gap-1 bg-transparent flex overflow-x-auto scrollbar-hide rounded-lg"
              style={{ scrollbarWidth: "none" }}
            >
              {[
                { value: "personal", label: t.personalInfo, icon: User },
                { value: "accounts", label: language === "en" ? "Accounts" : "الحسابات", icon: Activity },
                { value: "notifications", label: language === "en" ? "Notifications" : "الإشعارات", icon: Bell },
                { value: "security", label: t.security, icon: Shield },
                { value: "trades", label: t.trades, icon: BarChart3 },
                { value: "copy_settings", label: language === "en" ? "Copy Settings" : "إعدادات النسخ", icon: TrendingUp }
              ].map((tab) => (
                <TabsTrigger 
                  key={tab.value}
                  value={tab.value} 
                  className="group relative rounded-lg px-3 py-2 font-medium text-[11px] sm:text-xs whitespace-nowrap transition-all duration-150 flex-shrink-0 min-w-[78px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground hover:text-foreground hover:bg-muted/50"
                >
                  <tab.icon className="mr-1 h-3.5 w-3.5 inline-block" />
                  <span className="hidden xs:inline sm:inline">{tab.label}</span>
                  <span className="xs:hidden sm:hidden">
                    {tab.value === "personal" ? (language === "en" ? "Info" : "معلومات") :
                     tab.value === "accounts" ? (language === "en" ? "Acc" : "حساب") :
                     tab.value === "notifications" ? (language === "en" ? "Notif" : "إشعار") :
                     tab.value === "security" ? (language === "en" ? "Sec" : "أمان") :
                     tab.value === "trades" ? (language === "en" ? "Trade" : "تداول") : 
                     tab.value === "copy_settings" ? (language === "en" ? "Copy" : "نسخ") : tab.label}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Personal Information Tab */}
          <TabsContent value="personal" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2 border-border rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-border bg-muted/30 p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <User className="h-5 w-5 text-foreground" />
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
                      <User className="h-4 w-4 text-muted-foreground" />
                      User ID
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        value={formState.uuid} 
                        readOnly 
                        className="bg-muted/30 font-mono text-sm border-border rounded-lg" 
                      />
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => handleCopy(formState.uuid)} 
                        className="flex-shrink-0 rounded-lg border-border hover:bg-muted transition-colors"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                      {t.displayNameLabel}
                    </Label>
                    <Input 
                      value={formState.fullName} 
                      onChange={(e) => setFormState({...formState, fullName: e.target.value})}
                      className="border-border rounded-lg"
                      placeholder={language === "en" ? "Enter your display name" : "أدخل اسمك"}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      {t.bioLabel}
                    </Label>
                    <Textarea 
                      value={formState.bio} 
                      onChange={(e) => setFormState({...formState, bio: e.target.value})}
                      className="min-h-[120px] border-border rounded-lg resize-none"
                      placeholder={language === "en" ? "Tell us about yourself..." : "أخبرنا عن نفسك..."}
                    />
                  </div>
                </CardContent>
                <CardFooter className="border-t border-border bg-muted/30 p-5">
                  <Button 
                    onClick={handleSave} 
                    disabled={saving} 
                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
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
                <Card className="border-border rounded-2xl overflow-hidden">
                  <CardHeader className="border-b border-border bg-muted/30 p-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <LifeBuoy className="h-5 w-5 text-foreground" />
                      </div>
                      <CardTitle className="text-lg font-bold text-foreground">{t.support}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {language === "en" 
                        ? "Need help? Check our guides or contact support."
                        : "تحتاج مساعدة؟ اطلع على أدلتنا أو اتصل بالدعم."}
                    </p>
                    <Button 
                      variant="outline" 
                      className="w-full rounded-lg border-border text-foreground hover:bg-muted" 
                      asChild
                    >
                      <Link to={createPageUrl("Help")}>
                        <HelpCircle className="mr-2 h-4 w-4" /> 
                        {language === "en" ? "Help Center" : "مركز المساعدة"}
                      </Link>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full rounded-lg border-border text-foreground hover:bg-muted" 
                      asChild
                    >
                      <Link to={createPageUrl("Contact")}>
                        <LifeBuoy className="mr-2 h-4 w-4" /> 
                        {language === "en" ? "Contact Support" : "اتصل بالدعم"}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border rounded-2xl overflow-hidden bg-card">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-muted">
                        <Award className="h-6 w-6 text-foreground" />
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
                <RefreshCw className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground font-medium">
                  {language === "en" ? "Loading accounts..." : "جاري تحميل الحسابات..."}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                  {/* Copy Trading Wallet Card */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        {language === "en" ? "Copy Trading Account" : "حساب نسخ التداول"}
                      </h3>
                      <Badge className="bg-primary/15 text-primary border border-primary/30 px-2 py-1 text-[11px] rounded-md">
                        {language === "en" ? "Managed" : "مُدار"}
                      </Badge>
                    </div>
                    <Card className="border border-border bg-card rounded-2xl overflow-hidden">
                      <CardContent className="p-0">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                              <Wallet className="w-5 h-5 text-foreground" />
                            </div>
                            <div className="space-y-1">
                              <h3 className="font-semibold text-foreground text-sm leading-tight">{language === "en" ? "Copy Trading" : "نسخ التداول"}</h3>
                              <Badge variant="outline" className={`text-[10px] px-2 py-0.5 rounded-md ${copyTradingWallet?.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'bg-muted text-muted-foreground border-border'}`}>
                                {copyTradingWallet?.status === 'ACTIVE' ? (language === "en" ? "Active" : "نشط") : (language === "en" ? "Inactive" : "غير نشط")}
                              </Badge>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={loadTradingAccounts} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="p-4">
                          <p className="text-xs text-muted-foreground mb-1">{language === "en" ? "Available Balance" : "الرصيد المتاح"}</p>
                          <p className="text-2xl sm:text-3xl font-bold text-foreground">${(copyTradingWallet?.available_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="border-t border-border">
                          <div className="grid grid-cols-2 divide-x divide-border">
                            <div className="p-3">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{language === "en" ? "Locked" : "مقفل"}</p>
                              <p className="text-sm font-semibold text-foreground mt-0.5">
                                ${(copyTradingWallet?.locked_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                            <div className="p-3">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{language === "en" ? "Total Deposited" : "إجمالي الإيداع"}</p>
                              <p className="text-sm font-semibold text-foreground mt-0.5">
                                ${(copyTradingWallet?.lifetime_deposited || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 border-t border-border">
                          <Button
                            size="sm"
                            onClick={() => setCopyTradingDepositOpen(true)}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs h-9"
                          >
                            <ArrowDownToLine className="h-3.5 w-3.5 mr-1.5" />
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
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        {language === "en" ? "Trading Account" : "حساب تداول"}
                      </h3>
                      {/* Real Money badge removed */}
                    </div>
                    <OKXLiveAccountCard language={language} onRefresh={loadTradingAccounts} />
                  </div>
                </div>

                <Card className="border-border rounded-2xl overflow-hidden">
                  <CardHeader className="border-b border-border bg-muted/30 p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          <Activity className="h-5 w-5 text-foreground" />
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
                        className="rounded-lg border-border bg-background hover:bg-muted"
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

                <Card className="border-border rounded-2xl overflow-hidden">
                  <CardHeader className="border-b border-border bg-muted/30 p-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <History className="h-5 w-5 text-foreground" />
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
            <Card className="border-border rounded-2xl overflow-hidden bg-muted/20">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-muted">
                      <ShieldCheck className="h-6 w-6 text-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-bold text-foreground">
                          {language === "en" ? "Identity Verification (KYC)" : "التحقق من الهوية (KYC)"}
                        </h3>
                        {/* Watch How Button */}
                        <button
                          type="button"
                          onClick={() => setKycVideoOpen(true)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/10 px-2.5 py-1 rounded-full transition-colors"
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                          {language === "en" ? "Watch how" : "شاهد الشرح"}
                        </button>
                      </div>
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
                          <div className="mt-2 p-2 rounded-lg bg-muted text-xs">
                            <p className="font-medium text-foreground">
                              {language === "en" ? "Admin Response:" : "رد الإدارة:"}
                            </p>
                            <p className="text-muted-foreground">{existingVerification.admin_response}</p>
                          </div>
                        )}
                    </div>
                  </div>
                  {/* Hide button when verified */}
                  {existingVerification?.status !== 'approved' && (
                    <Button
                      data-pf="verify-button"
                      onClick={() => setVerificationModalOpen(true)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-6"
                    >
                      {existingVerification 
                        ? (language === "en" ? "Check Status" : "تحقق من الحالة")
                        : (language === "en" ? "Start Verification" : "بدء التحقق")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Password Management Card */}
            <Card className="border-border rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30 p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Lock className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-foreground">{t.passwordLabel}</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      {language === "en" ? "Manage your password" : "إدارة كلمة المرور"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted border border-border">
                      <Lock className="h-6 w-6 text-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.passwordLabel}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {language === "en" ? "Manage your password" : "إدارة كلمة المرور"}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setChangePasswordOpen(true)}
                    className="text-foreground border-border hover:bg-muted rounded-lg"
                  >
                    {t.managePassword} <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 2FA Section - Coming Soon */}
            <Card className="border-border rounded-2xl overflow-hidden opacity-60">
              <CardHeader className="border-b border-border bg-muted/30 p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <ShieldCheck className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl font-bold text-foreground">{t.twoFactor}</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">
                      {language === "en" ? "Coming Soon" : "قريباً"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  {language === "en" 
                    ? "Two-factor authentication adds an extra layer of security to your account. This feature is coming soon."
                    : "المصادقة الثنائية تضيف طبقة إضافية من الأمان لحسابك. هذه الميزة قادمة قريباً."}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30 p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Clock className="h-5 w-5 text-foreground" />
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

            {/* Danger Zone */}
            <DangerZone language={language} />

            <VerificationModal
              open={verificationModalOpen}
              onOpenChange={setVerificationModalOpen}
              language={language}
              existingRequest={existingVerification}
              onSuccess={loadVerificationRequest}
            />

            {/* Copy Trading Deposit Modal */}
            <AllocationModal
              open={copyTradingDepositOpen}
              onOpenChange={setCopyTradingDepositOpen}
              language={language}
              onSuccess={loadTradingAccounts}
            />

            {/* KYC Help Video Modal */}
            {kycVideoOpen && (
              <VideoModal
                open={kycVideoOpen}
                onClose={() => setKycVideoOpen(false)}
                youtubeId={getHelpVideo("kyc_verification")?.youtube_id || "R7IeJxSWkP8"}
                title={language === "en" ? "Verify account (KYC)" : "توثيق الحساب (KYC)"}
              />
            )}

            {/* Change Password Modal */}
            <ChangePasswordModal
              open={changePasswordOpen}
              onOpenChange={setChangePasswordOpen}
              language={language}
              userId={formState?.uuid}
              userEmail={formState?.email}
            />
          </TabsContent>

          {/* Copy Settings Tab */}
          <TabsContent value="copy_settings" className="space-y-6">
            <CopyTradingSettingsForm language={language} />
          </TabsContent>

          {/* Trades Tab */}
          <TabsContent value="trades" className="space-y-6">
            <Card className="border-border rounded-2xl overflow-hidden">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 border-b border-border bg-muted/30 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <BarChart3 className="h-5 w-5 text-foreground" />
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
                  className="rounded-lg border-border hover:bg-muted transition-colors"
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
                              <TableRow key={trade.id || i} className="hover:bg-muted/50 transition-colors">
                                <TableCell className="font-semibold text-foreground">
                                  {trade.symbol}
                                  <div className="mt-1 text-[10px] text-muted-foreground sm:hidden">
                                    <span className="text-muted-foreground/70">{language === "en" ? "Opened" : "فتح"}:</span> {fmtTime(opened)}
                                    <span className="mx-2 text-muted-foreground/40">•</span>
                                    <span className="text-muted-foreground/70">{language === "en" ? "Closed" : "إغلاق"}:</span> {fmtTime(closed)}
                                  </div>
                                </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`${
                                trade.side === 'LONG' 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
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
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                            {fmtTime(opened)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
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