import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Shield,
  TrendingUp,
  DollarSign,
  User,
  Info,
  ExternalLink,
  Loader2,
  XCircle
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const INCOME_OPTIONS = {
  under_1000: { en: "Under $1,000", ar: "أقل من 1,000$" },
  "1000_5000": { en: "$1,000 - $5,000", ar: "1,000$ - 5,000$" },
  "5000_10000": { en: "$5,000 - $10,000", ar: "5,000$ - 10,000$" },
  "10000_50000": { en: "$10,000 - $50,000", ar: "10,000$ - 50,000$" },
  over_50000: { en: "Over $50,000", ar: "أكثر من 50,000$" }
};

const DEPOSIT_OPTIONS = {
  under_500: { en: "Under $500", ar: "أقل من 500$" },
  "500_1000": { en: "$500 - $1,000", ar: "500$ - 1,000$" },
  "1000_5000": { en: "$1,000 - $5,000", ar: "1,000$ - 5,000$" },
  "5000_10000": { en: "$5,000 - $10,000", ar: "5,000$ - 10,000$" },
  over_10000: { en: "Over $10,000", ar: "أكثر من 10,000$" }
};

const EXPERIENCE_OPTIONS = {
  beginner: { en: "Beginner (< 1 year)", ar: "مبتدئ (أقل من سنة)" },
  intermediate: { en: "Intermediate (1-3 years)", ar: "متوسط (1-3 سنوات)" },
  advanced: { en: "Advanced (3-5 years)", ar: "متقدم (3-5 سنوات)" },
  professional: { en: "Professional (5+ years)", ar: "محترف (5+ سنوات)" }
};

const translations = {
  en: {
    title: "Request Live Trading Account",
    subtitle: "Complete this form to request a real money trading account",
    verificationRequired: "Identity Verification Required",
    verificationDesc: "You must complete identity verification (KYC) before requesting a live trading account.",
    verifyNow: "Verify Now",
    
    // Form sections
    personalSection: "Personal Information",
    financialSection: "Financial Information",
    experienceSection: "Trading Experience",
    agreementsSection: "Agreements & Acknowledgments",
    
    // Fields
    monthlyIncome: "Monthly Income (USD)",
    monthlyIncomeHelp: "This helps us understand your financial capacity",
    expectedDeposit: "Expected Initial Deposit",
    expectedDepositHelp: "How much do you plan to deposit initially?",
    tradingExperience: "Trading Experience Level",
    tradingExperienceHelp: "Be honest - this helps us provide better support",
    previousPlatforms: "Previous Trading Platforms (Optional)",
    previousPlatformsPlaceholder: "e.g., Binance, Bybit, OKX, etc.",
    additionalNotes: "Additional Notes (Optional)",
    additionalNotesPlaceholder: "Any additional information you'd like to share...",
    
    // Agreements
    riskAcknowledgment: "I understand that trading cryptocurrencies and derivatives involves significant risk of loss",
    riskAcknowledgmentDesc: "You may lose some or all of your invested capital. Only trade with funds you can afford to lose.",
    termsAcceptance: "I accept the Terms of Service and Privacy Policy",
    termsAcceptanceDesc: "By checking this box, you agree to our trading terms and conditions.",
    viewTerms: "View Terms",
    
    // Actions
    submitRequest: "Submit Request",
    submitting: "Submitting...",
    cancel: "Cancel",
    
    // Status messages
    requestPending: "Request Pending",
    requestPendingDesc: "Your request is being reviewed by our team. We'll notify you once it's processed.",
    requestUnderReview: "Under Review",
    requestUnderReviewDesc: "An admin is currently reviewing your application.",
    requestApproved: "Request Approved",
    requestApprovedDesc: "Your live trading account is being set up. You'll be notified when it's ready.",
    requestRejected: "Request Rejected",
    requestRejectedReason: "Reason",
    requestAssigned: "Account Assigned",
    requestAssignedDesc: "Your live trading account is ready! You can start trading now.",
    
    // Success
    submitSuccess: "Request submitted successfully!",
    submitSuccessDesc: "We'll review your application and get back to you soon.",
    
    // Errors
    fillRequired: "Please fill all required fields",
    acceptTerms: "You must accept the terms and acknowledge the risks",
    submitError: "Failed to submit request. Please try again."
  },
  ar: {
    title: "طلب حساب تداول حقيقي",
    subtitle: "أكمل هذا النموذج لطلب حساب تداول بأموال حقيقية",
    verificationRequired: "التحقق من الهوية مطلوب",
    verificationDesc: "يجب إكمال التحقق من الهوية (KYC) قبل طلب حساب تداول حقيقي.",
    verifyNow: "تحقق الآن",
    
    personalSection: "المعلومات الشخصية",
    financialSection: "المعلومات المالية",
    experienceSection: "خبرة التداول",
    agreementsSection: "الموافقات والإقرارات",
    
    monthlyIncome: "الدخل الشهري (دولار)",
    monthlyIncomeHelp: "يساعدنا هذا على فهم قدرتك المالية",
    expectedDeposit: "الإيداع الأولي المتوقع",
    expectedDepositHelp: "كم تخطط للإيداع في البداية؟",
    tradingExperience: "مستوى خبرة التداول",
    tradingExperienceHelp: "كن صادقاً - هذا يساعدنا على تقديم دعم أفضل",
    previousPlatforms: "منصات التداول السابقة (اختياري)",
    previousPlatformsPlaceholder: "مثال: Binance, Bybit, OKX, إلخ.",
    additionalNotes: "ملاحظات إضافية (اختياري)",
    additionalNotesPlaceholder: "أي معلومات إضافية تود مشاركتها...",
    
    riskAcknowledgment: "أفهم أن تداول العملات الرقمية والمشتقات ينطوي على مخاطر خسارة كبيرة",
    riskAcknowledgmentDesc: "قد تخسر بعض أو كل رأس مالك المستثمر. تداول فقط بالأموال التي يمكنك تحمل خسارتها.",
    termsAcceptance: "أوافق على شروط الخدمة وسياسة الخصوصية",
    termsAcceptanceDesc: "بتحديد هذا المربع، فإنك توافق على شروط وأحكام التداول الخاصة بنا.",
    viewTerms: "عرض الشروط",
    
    submitRequest: "إرسال الطلب",
    submitting: "جاري الإرسال...",
    cancel: "إلغاء",
    
    requestPending: "الطلب قيد الانتظار",
    requestPendingDesc: "يتم مراجعة طلبك من قبل فريقنا. سنخطرك بمجرد معالجته.",
    requestUnderReview: "قيد المراجعة",
    requestUnderReviewDesc: "مسؤول يراجع طلبك حالياً.",
    requestApproved: "تمت الموافقة على الطلب",
    requestApprovedDesc: "يتم إعداد حساب التداول الحقيقي الخاص بك. سيتم إخطارك عندما يكون جاهزاً.",
    requestRejected: "تم رفض الطلب",
    requestRejectedReason: "السبب",
    requestAssigned: "تم تعيين الحساب",
    requestAssignedDesc: "حساب التداول الحقيقي الخاص بك جاهز! يمكنك البدء في التداول الآن.",
    
    submitSuccess: "تم إرسال الطلب بنجاح!",
    submitSuccessDesc: "سنراجع طلبك ونرد عليك قريباً.",
    
    fillRequired: "يرجى ملء جميع الحقول المطلوبة",
    acceptTerms: "يجب قبول الشروط والإقرار بالمخاطر",
    submitError: "فشل إرسال الطلب. يرجى المحاولة مرة أخرى."
  }
};

export default function LiveAccountRequestForm({ 
  open, 
  onOpenChange, 
  language = "en",
  existingRequest = null,
  isVerified = false,
  onVerifyClick
}) {
  const t = translations[language] || translations.en;
  const isRtl = language === "ar";
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    monthly_income: "",
    expected_deposit: "",
    trading_experience: "",
    previous_platforms: "",
    additional_notes: "",
    risk_acknowledgment: false,
    terms_accepted: false
  });

  // If there's an existing request, show status instead of form
  if (existingRequest) {
    const statusConfig = {
      pending: { 
        icon: Clock, 
        color: "text-amber-500", 
        bg: "bg-amber-500/10", 
        title: t.requestPending, 
        desc: t.requestPendingDesc 
      },
      under_review: { 
        icon: FileText, 
        color: "text-blue-500", 
        bg: "bg-blue-500/10", 
        title: t.requestUnderReview, 
        desc: t.requestUnderReviewDesc 
      },
      approved: { 
        icon: CheckCircle2, 
        color: "text-emerald-500", 
        bg: "bg-emerald-500/10", 
        title: t.requestApproved, 
        desc: t.requestApprovedDesc 
      },
      rejected: { 
        icon: XCircle, 
        color: "text-rose-500", 
        bg: "bg-rose-500/10", 
        title: t.requestRejected, 
        desc: existingRequest.rejection_reason || "" 
      },
      assigned: { 
        icon: CheckCircle2, 
        color: "text-emerald-500", 
        bg: "bg-emerald-500/10", 
        title: t.requestAssigned, 
        desc: t.requestAssignedDesc 
      }
    };
    
    const status = statusConfig[existingRequest.status] || statusConfig.pending;
    const StatusIcon = status.icon;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              {t.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className={`rounded-xl ${status.bg} p-6 text-center`}>
            <StatusIcon className={`h-12 w-12 mx-auto mb-3 ${status.color}`} />
            <h3 className="font-semibold text-foreground text-lg">{status.title}</h3>
            <p className="text-sm text-muted-foreground mt-2">{status.desc}</p>
            
            {existingRequest.status === "rejected" && existingRequest.rejection_reason && (
              <div className="mt-4 p-3 bg-rose-100 dark:bg-rose-900/30 rounded-lg text-left">
                <p className="text-xs font-medium text-rose-700 dark:text-rose-400">{t.requestRejectedReason}:</p>
                <p className="text-sm text-rose-600 dark:text-rose-300 mt-1">{existingRequest.rejection_reason}</p>
              </div>
            )}
          </div>
          
          <div className="text-xs text-muted-foreground text-center">
            {language === "ar" ? "تاريخ الطلب" : "Requested"}: {new Date(existingRequest.created_date).toLocaleDateString()}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Verification gate
  if (!isVerified) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              {t.verificationRequired}
            </DialogTitle>
            <DialogDescription>{t.verificationDesc}</DialogDescription>
          </DialogHeader>
          
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-6 text-center">
            <Shield className="h-16 w-16 mx-auto mb-4 text-amber-500" />
            <p className="text-sm text-muted-foreground mb-4">{t.verificationDesc}</p>
            <Link to={`${createPageUrl("Profile")}?tab=security&openVerification=true`}>
              <Button 
                onClick={() => onOpenChange(false)}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              >
                <Shield className="h-4 w-4 mr-2" />
                {t.verifyNow}
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleSubmit = async () => {
    // Validation
    if (!formData.monthly_income || !formData.expected_deposit || !formData.trading_experience) {
      toast.error(t.fillRequired);
      return;
    }
    
    if (!formData.risk_acknowledgment || !formData.terms_accepted) {
      toast.error(t.acceptTerms);
      return;
    }

    setLoading(true);
    try {
      const user = await base44.auth.me();
      
      await base44.entities.LiveAccountRequest.create({
        user_id: user.id,
        user_email: user.email,
        user_full_name: user.full_name || user.name || "",
        status: "pending",
        monthly_income: formData.monthly_income,
        expected_deposit: formData.expected_deposit,
        trading_experience: formData.trading_experience,
        previous_platforms: formData.previous_platforms || null,
        additional_notes: formData.additional_notes || null,
        risk_acknowledgment: true,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString()
      });

      toast.success(t.submitSuccess, { description: t.submitSuccessDesc });
      onOpenChange(false);
      
      // Refresh the page to show the pending request
      window.location.reload();
    } catch (err) {
      console.error("Failed to submit request:", err);
      toast.error(t.submitError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir={isRtl ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-2">
          {/* Financial Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              {t.financialSection}
            </div>
            
            <div className="space-y-2">
              <Label>{t.monthlyIncome} *</Label>
              <Select 
                value={formData.monthly_income} 
                onValueChange={(v) => setFormData({...formData, monthly_income: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INCOME_OPTIONS).map(([key, labels]) => (
                    <SelectItem key={key} value={key}>{labels[language] || labels.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t.monthlyIncomeHelp}</p>
            </div>
            
            <div className="space-y-2">
              <Label>{t.expectedDeposit} *</Label>
              <Select 
                value={formData.expected_deposit} 
                onValueChange={(v) => setFormData({...formData, expected_deposit: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DEPOSIT_OPTIONS).map(([key, labels]) => (
                    <SelectItem key={key} value={key}>{labels[language] || labels.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t.expectedDepositHelp}</p>
            </div>
          </div>

          {/* Trading Experience */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              {t.experienceSection}
            </div>
            
            <div className="space-y-2">
              <Label>{t.tradingExperience} *</Label>
              <Select 
                value={formData.trading_experience} 
                onValueChange={(v) => setFormData({...formData, trading_experience: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPERIENCE_OPTIONS).map(([key, labels]) => (
                    <SelectItem key={key} value={key}>{labels[language] || labels.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t.tradingExperienceHelp}</p>
            </div>
            
            <div className="space-y-2">
              <Label>{t.previousPlatforms}</Label>
              <Textarea
                value={formData.previous_platforms}
                onChange={(e) => setFormData({...formData, previous_platforms: e.target.value})}
                placeholder={t.previousPlatformsPlaceholder}
                className="h-20 resize-none"
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t.additionalNotes}</Label>
              <Textarea
                value={formData.additional_notes}
                onChange={(e) => setFormData({...formData, additional_notes: e.target.value})}
                placeholder={t.additionalNotesPlaceholder}
                className="h-20 resize-none"
              />
            </div>
          </div>

          {/* Agreements */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="h-4 w-4 text-amber-500" />
              {t.agreementsSection}
            </div>
            
            {/* Risk Acknowledgment */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="risk"
                  checked={formData.risk_acknowledgment}
                  onCheckedChange={(checked) => setFormData({...formData, risk_acknowledgment: !!checked})}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="risk" className="text-sm font-medium cursor-pointer">
                    {t.riskAcknowledgment} *
                  </Label>
                  <p className="text-xs text-muted-foreground">{t.riskAcknowledgmentDesc}</p>
                </div>
              </div>
            </div>
            
            {/* Terms Acceptance */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="terms"
                  checked={formData.terms_accepted}
                  onCheckedChange={(checked) => setFormData({...formData, terms_accepted: !!checked})}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="terms" className="text-sm font-medium cursor-pointer">
                    {t.termsAcceptance} *
                  </Label>
                  <p className="text-xs text-muted-foreground">{t.termsAcceptanceDesc}</p>
                  <a 
                    href="/terms-of-service" 
                    target="_blank" 
                    className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {t.viewTerms}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            className="flex-1"
            disabled={loading}
          >
            {t.cancel}
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={loading || !formData.risk_acknowledgment || !formData.terms_accepted}
            className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t.submitting}</>
            ) : (
              <><CheckCircle2 className="h-4 w-4 mr-2" /> {t.submitRequest}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

LiveAccountRequestForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  language: PropTypes.string,
  existingRequest: PropTypes.object,
  isVerified: PropTypes.bool,
  onVerifyClick: PropTypes.func
};