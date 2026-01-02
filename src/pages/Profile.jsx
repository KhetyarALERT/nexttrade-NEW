import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  RefreshCw,
  LifeBuoy,
  LogOut,
  Mail,
  Phone,
  Globe2,
  Clock,
  Loader2,
  Copy,
  CheckCircle2,
  User,
  Lock,
  History,
  Gift,
  ExternalLink,
  ChevronRight,
  Upload,
  TrendingUp,
  TrendingDown
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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
    support: "Contact Support"
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
    support: "الدعم الفني"
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
  <div className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      <span>{label}</span>
    </div>
    <p className="text-lg font-bold text-slate-900">{value}</p>
  </div>
);

const SecurityItem = ({ title, status, actionLabel, icon: Icon, statusColor = "text-slate-500" }) => (
  <div className="flex items-center justify-between py-4 border-b border-slate-100 last:border-0">
    <div className="flex items-center gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-5 w-5 text-slate-600" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className={`text-xs ${statusColor}`}>{status}</p>
      </div>
    </div>
    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
      {actionLabel} <ChevronRight className="ml-1 h-4 w-4" />
    </Button>
  </div>
);

const VoucherCard = ({ title, condition, expiry, status, available }) => (
  <Card className={`overflow-hidden border-slate-200 ${!available ? 'opacity-60 grayscale' : ''}`}>
    <div className="flex h-full">
      <div className={`flex w-24 flex-col items-center justify-center gap-1 ${available ? 'bg-blue-600' : 'bg-slate-400'} text-white`}>
        <Gift className="h-8 w-8" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Voucher</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between">
          <h4 className="font-bold text-slate-900">{title}</h4>
          <Badge variant={available ? "default" : "secondary"} className="text-[10px]">
            {status}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-slate-500">{condition}</p>
        <div className="mt-auto pt-4 flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <Clock className="h-3 w-3" />
            <span>Expires: {expiry}</span>
          </div>
          {available && (
            <Button size="sm" className="h-7 px-3 text-[10px]">Use Now</Button>
          )}
        </div>
      </div>
    </div>
  </Card>
);

export default function Profile({ language }) {
  const t = translations[language] || translations.en;
  const { toast } = useToast();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [formState, setFormState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadUser = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCurrentUser();
      const normalized = normalizeUserProfile(data);
      setUser(data);
      setFormState(normalized);
    } catch (err) {
      console.error("Failed to load user", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: t.copySuccess,
      duration: 2000
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCurrentUser({
        fullName: formState.fullName,
        bio: formState.bio
      });
      toast({
        title: "Profile updated successfully"
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: err.message
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid gap-8 lg:grid-cols-3">
            <Skeleton className="h-96 lg:col-span-2 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!formState) return <UserNotRegisteredError />;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 pt-8" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="h-20 w-20 border-4 border-white shadow-sm">
                <AvatarImage src={formState.avatarUrl} />
                <AvatarFallback className="bg-blue-600 text-xl font-bold text-white">
                  {formState.fullName?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <button className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-slate-600 hover:bg-slate-200">
                <Upload className="h-3.5 w-3.5" />
              </button>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{formState.fullName || "User"}</h1>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline" className="bg-white text-[10px] font-mono">
                  ID: {formState.uuid}
                </Badge>
                <Badge className={formState.verificationStatus === 'verified' ? 'bg-emerald-500' : 'bg-amber-500'}>
                  {formState.verificationStatus === 'verified' ? t.verified : t.notVerified}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => loadUser()} className="bg-white">
              <RefreshCw className="mr-2 h-4 w-4" /> {t.refresh}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => base44.auth.logout()}>
              <LogOut className="mr-2 h-4 w-4" /> {t.logout}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="personal" className="space-y-8">
          <TabsList className="h-auto w-full justify-start gap-8 border-b border-slate-200 bg-transparent p-0">
            <TabsTrigger value="personal" className="rounded-none border-b-2 border-transparent px-1 pb-4 pt-0 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600">
              {t.personalInfo}
            </TabsTrigger>
            <TabsTrigger value="security" className="rounded-none border-b-2 border-transparent px-1 pb-4 pt-0 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600">
              {t.security}
            </TabsTrigger>
            <TabsTrigger value="referrals" className="rounded-none border-b-2 border-transparent px-1 pb-4 pt-0 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600">
              {t.referrals}
            </TabsTrigger>
            <TabsTrigger value="vouchers" className="rounded-none border-b-2 border-transparent px-1 pb-4 pt-0 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600">
              {t.vouchers}
            </TabsTrigger>
            <TabsTrigger value="trades" className="rounded-none border-b-2 border-transparent px-1 pb-4 pt-0 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600">
              {t.trades}
            </TabsTrigger>
          </TabsList>

          {/* Personal Information */}
          <TabsContent value="personal" className="space-y-6">
            <div className="grid gap-8 lg:grid-cols-3">
              <Card className="lg:col-span-2 border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">{t.personalInfo}</CardTitle>
                  <CardDescription>Update your public profile information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t.uuidLabel}</Label>
                      <Input value={formState.uuid} readOnly className="bg-slate-50 font-mono text-xs" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.displayNameLabel}</Label>
                      <Input 
                        value={formState.fullName} 
                        onChange={(e) => setFormState({...formState, fullName: e.target.value})}
                        placeholder="Your display name" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t.bioLabel}</Label>
                    <Textarea 
                      value={formState.bio} 
                      onChange={(e) => setFormState({...formState, bio: e.target.value})}
                      placeholder="Tell us a bit about your trading style..." 
                      className="min-h-[120px]"
                    />
                  </div>
                </CardContent>
                <CardFooter className="border-t border-slate-100 bg-slate-50/50 py-4">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? t.saving : t.saveChanges}
                  </Button>
                </CardFooter>
              </Card>
              
              <div className="space-y-6">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">{t.support}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-slate-500">Need help with your account? Our team is available 24/7.</p>
                    <Button variant="outline" className="w-full" onClick={() => navigate(createPageUrl("Contact"))}>
                      <LifeBuoy className="mr-2 h-4 w-4" /> {t.support}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Security & Verification */}
          <TabsContent value="security" className="space-y-6">
            <div className="grid gap-8 lg:grid-cols-3">
              <Card className="lg:col-span-2 border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">{t.security}</CardTitle>
                  <CardDescription>Manage your account security and verification status.</CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-slate-100">
                  <SecurityItem 
                    title={t.verificationStatus} 
                    status={formState.verificationStatus === 'verified' ? t.verified : t.notVerified}
                    statusColor={formState.verificationStatus === 'verified' ? "text-emerald-600" : "text-amber-600"}
                    actionLabel="Verify Now"
                    icon={ShieldCheck}
                  />
                  <SecurityItem 
                    title={t.passwordLabel} 
                    status="Last changed 3 months ago"
                    actionLabel="Update"
                    icon={Lock}
                  />
                  <SecurityItem 
                    title={t.twoFactor} 
                    status={formState.twoFactorEnabled ? "Enabled" : "Disabled"}
                    statusColor={formState.twoFactorEnabled ? "text-emerald-600" : "text-slate-500"}
                    actionLabel="Setup"
                    icon={ShieldCheck}
                  />
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">{t.loginActivity}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3 text-xs">
                      <div className="mt-0.5 h-2 w-2 rounded-full bg-emerald-500" />
                      <div>
                        <p className="font-semibold text-slate-900">Chrome on Windows</p>
                        <p className="text-slate-500">Dubai, UAE • 192.168.1.{i}</p>
                        <p className="text-slate-400">2 hours ago</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Refer & Earn */}
          <TabsContent value="referrals" className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoPill label={t.todayReferrals} value="0" icon={User} />
              <InfoPill label={t.monthReferrals} value="12" icon={User} />
              <InfoPill label={t.yesterdayCommission} value="$0.00" icon={TrendingUp} />
              <InfoPill label={t.monthCommission} value="$145.20" icon={TrendingUp} />
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              <Card className="lg:col-span-2 border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Referral Program</CardTitle>
                  <CardDescription>Invite your friends and earn up to 40% commission on every trade they make.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t.referralCode}</Label>
                      <div className="flex gap-2">
                        <Input value={formState.referralCode} readOnly className="font-mono font-bold" />
                        <Button variant="outline" size="icon" onClick={() => handleCopy(formState.referralCode)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t.referralLink}</Label>
                      <div className="flex gap-2">
                        <Input value={formState.referralLink} readOnly className="text-xs" />
                        <Button variant="outline" size="icon" onClick={() => handleCopy(formState.referralLink)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <h4 className="text-sm font-bold text-blue-900">How it works</h4>
                    <ul className="mt-2 space-y-2 text-xs text-blue-800">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3" /> Share your referral link with friends
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3" /> They sign up and start trading
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3" /> You receive instant commission on every trade
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Recent Referrals</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { id: "USR-9281", date: "2023-12-28", status: "Active", reward: "$12.40" },
                      { id: "USR-4412", date: "2023-12-25", status: "Active", reward: "$8.15" },
                      { id: "USR-1092", date: "2023-12-20", status: "Inactive", reward: "$0.00" }
                    ].map((ref) => (
                      <div key={ref.id} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{ref.id}</p>
                          <p className="text-[10px] text-slate-400">{ref.date}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-emerald-600">{ref.reward}</p>
                          <Badge variant="outline" className="h-4 text-[8px] uppercase">{ref.status}</Badge>
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
              <TabsList className="mb-6 bg-slate-100 p-1">
                <TabsTrigger value="available" className="px-8">{t.available}</TabsTrigger>
                <TabsTrigger value="unavailable" className="px-8">{t.unavailable}</TabsTrigger>
              </TabsList>
              <TabsContent value="available" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <VoucherCard 
                  title="$50 Trading Bonus" 
                  condition="Min. deposit $500" 
                  expiry="2024-02-15" 
                  status="Active" 
                  available={true} 
                />
                <VoucherCard 
                  title="Zero Fee Trade" 
                  condition="Valid for first 5 trades" 
                  expiry="2024-01-30" 
                  status="New" 
                  available={true} 
                />
                <VoucherCard 
                  title="10% Rebate" 
                  condition="On all crypto pairs" 
                  expiry="2024-03-01" 
                  status="Active" 
                  available={true} 
                />
              </TabsContent>
              <TabsContent value="unavailable" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <VoucherCard 
                  title="$10 Welcome Bonus" 
                  condition="New user registration" 
                  expiry="2023-12-01" 
                  status="Expired" 
                  available={false} 
                />
                <VoucherCard 
                  title="VIP Upgrade" 
                  condition="Trade volume > $1M" 
                  expiry="2023-11-15" 
                  status="Used" 
                  available={false} 
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* My Trades */}
          <TabsContent value="trades" className="space-y-6">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg">{t.trades}</CardTitle>
                  <CardDescription>Your recent trading history and performance.</CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <ExternalLink className="mr-2 h-4 w-4" /> Export CSV
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold">{t.symbol}</TableHead>
                      <TableHead className="font-bold">{t.side}</TableHead>
                      <TableHead className="font-bold">{t.size}</TableHead>
                      <TableHead className="font-bold">{t.entryExit}</TableHead>
                      <TableHead className="font-bold">{t.pnl}</TableHead>
                      <TableHead className="text-right font-bold">{t.date}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { symbol: "BTC/USDT", side: "Buy", size: "0.45", entry: "42,150.00", exit: "43,200.00", pnl: "+$472.50", status: "profit", date: "2023-12-30 14:22" },
                      { symbol: "ETH/USDT", side: "Sell", size: "2.50", entry: "2,240.50", exit: "2,210.00", pnl: "+$76.25", status: "profit", date: "2023-12-29 09:15" },
                      { symbol: "SOL/USDT", side: "Buy", size: "150.00", entry: "105.20", exit: "102.40", pnl: "-$420.00", status: "loss", date: "2023-12-28 18:40" },
                      { symbol: "BTC/USDT", side: "Sell", size: "0.12", entry: "44,100.00", exit: "43,850.00", pnl: "+$30.00", status: "profit", date: "2023-12-27 11:05" },
                      { symbol: "BNB/USDT", side: "Buy", size: "25.00", entry: "312.40", exit: "315.20", pnl: "+$70.00", status: "profit", date: "2023-12-26 16:30" }
                    ].map((trade, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-bold">{trade.symbol}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={trade.side === 'Buy' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-rose-600 border-rose-200 bg-rose-50'}>
                            {trade.side}
                          </Badge>
                        </TableCell>
                        <TableCell>{trade.size}</TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {trade.entry} → {trade.exit}
                        </TableCell>
                        <TableCell className={`font-bold ${trade.status === 'profit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          <div className="flex items-center gap-1">
                            {trade.status === 'profit' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {trade.pnl}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs text-slate-400">{trade.date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

Profile.propTypes = {
  language: PropTypes.oneOf(["en", "ar"]).isRequired
};
