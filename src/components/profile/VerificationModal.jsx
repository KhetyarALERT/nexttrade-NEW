import { useState, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, CheckCircle2, AlertCircle, Camera, FileText, User, Loader2, ChevronDown, HelpCircle, MessageSquare } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

// Validate date format YYYY-MM-DD
const isValidDateFormat = (dateStr) => {
  if (!dateStr) return true; // Empty is ok (optional field)
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const [year, month, day] = dateStr.split("-").map(Number);
  if (year < 1920 || year > new Date().getFullYear()) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  // Check if valid date
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

// Format input to enforce YYYY-MM-DD pattern
const formatDateInput = (value) => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, "");
  // Format as YYYY-MM-DD
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
};

const translations = {
  en: {
    title: "Identity Verification",
    subtitle: "Complete KYC to unlock full platform access",
    step1: "Upload ID Document",
    step2: "Personal Information",
    step3: "Selfie Verification",
    needHelp: "Need Help?",
    askForHelp: "Ask for Help",
    helpPlaceholder: "Describe your issue (e.g., having trouble uploading document, date format confusion, etc.)",
    helpSent: "Help request sent! Our team will contact you soon.",
    helpPending: "Help request pending",
    fullName: "Full Name (as on ID)",
    dob: "Date of Birth",
    country: "Country",
    docType: "Document Type",
    passport: "Passport",
    nationalId: "National ID",
    driversLicense: "Driver's License",
    uploadFront: "Upload Front of Document",
    uploadBack: "Upload Back of Document",
    uploadSelfie: "Upload Selfie with ID",
    selfieHint: "Hold your ID next to your face",
    dragDrop: "Drag and drop or click to upload",
    fileTypes: "JPG, PNG or PDF (max 5MB)",
    submit: "Submit Verification",
    submitting: "Submitting...",
    success: "Verification submitted successfully! We'll review within 24-48 hours.",
    error: "Failed to submit verification",
    pending: "Your verification is pending review",
    underReview: "Under review - we'll notify you soon",
    approved: "Your account is verified",
    rejected: "Verification rejected",
  },
  ar: {
    title: "التحقق من الهوية",
    subtitle: "أكمل KYC لفتح الوصول الكامل للمنصة",
    step1: "رفع وثيقة الهوية",
    step2: "المعلومات الشخصية",
    step3: "التحقق بالصورة الذاتية",
    needHelp: "تحتاج مساعدة؟",
    askForHelp: "طلب مساعدة",
    helpPlaceholder: "صف مشكلتك (مثال: صعوبة في رفع المستند، مشكلة في تنسيق التاريخ، إلخ.)",
    helpSent: "تم إرسال طلب المساعدة! سيتواصل معك فريقنا قريباً.",
    helpPending: "طلب المساعدة قيد الانتظار",
    fullName: "الاسم الكامل (كما في الهوية)",
    dob: "تاريخ الميلاد",
    country: "الدولة",
    docType: "نوع المستند",
    passport: "جواز سفر",
    nationalId: "بطاقة هوية وطنية",
    driversLicense: "رخصة قيادة",
    uploadFront: "رفع وجه المستند",
    uploadBack: "رفع ظهر المستند",
    uploadSelfie: "رفع صورة ذاتية مع الهوية",
    selfieHint: "أمسك هويتك بجانب وجهك",
    dragDrop: "اسحب وأفلت أو انقر للرفع",
    fileTypes: "JPG, PNG أو PDF (حد أقصى 5MB)",
    submit: "إرسال التحقق",
    submitting: "جارٍ الإرسال...",
    success: "تم إرسال التحقق بنجاح! سنراجع خلال 24-48 ساعة.",
    error: "فشل إرسال التحقق",
    pending: "التحقق قيد المراجعة",
    underReview: "قيد المراجعة - سنخطرك قريبًا",
    approved: "حسابك موثق",
    rejected: "التحقق مرفوض",
  },
};

const countries = [
  "United Arab Emirates", "Saudi Arabia", "Kuwait", "Qatar", "Bahrain", "Oman",
  "Egypt", "Jordan", "Lebanon", "Syria", "Iraq", "Palestine", "Yemen", "Libya",
  "Tunisia", "Algeria", "Morocco", "Sudan", "United States", "United Kingdom", 
  "Germany", "France", "Canada", "Australia", "India", "Pakistan", "Turkey", 
  "Iran", "Afghanistan", "Bangladesh", "Malaysia", "Indonesia", "Other"
];

export default function VerificationModal({ open, onOpenChange, language = "en", existingRequest = null }) {
  const t = translations[language] || translations.en;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [showHelpForm, setShowHelpForm] = useState(false);
  const [helpMessage, setHelpMessage] = useState("");
  const [sendingHelp, setSendingHelp] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    dob: "",
    country: "",
    documentType: "passport",
    frontFile: null,
    backFile: null,
    selfieFile: null,
  });

  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      // Reset to step 1 when modal closes
      setStep(1);
      setCountryDropdownOpen(false);
      setShowHelpForm(false);
      setHelpMessage("");
    } else {
      // Track verification started when modal opens
      base44.auth.me().then(user => {
        base44.analytics.track({
          eventName: "verification_started",
          properties: { language, user_id: user?.id, user_email: user?.email }
        });
      }).catch(() => {
        base44.analytics.track({
          eventName: "verification_started",
          properties: { language }
        });
      });
    }
  }, [open, language]);

  // Track step changes
  useEffect(() => {
    if (open && step > 1) {
      base44.auth.me().then(user => {
        base44.analytics.track({
          eventName: "verification_step_reached",
          properties: { step, language, user_id: user?.id, user_email: user?.email }
        });
      }).catch(() => {
        base44.analytics.track({
          eventName: "verification_step_reached",
          properties: { step, language }
        });
      });
    }
  }, [step, open, language]);

  const handleAskForHelp = async () => {
    if (!helpMessage.trim()) {
      toast.error(language === "ar" ? "يرجى وصف مشكلتك" : "Please describe your issue");
      return;
    }

    setSendingHelp(true);
    try {
      const user = await base44.auth.me();

      // Upload document if available
      let frontUrl = null;
      if (form.frontFile) {
        const result = await base44.integrations.Core.UploadFile({ file: form.frontFile });
        frontUrl = result.file_url;
      }

      // Create a help request verification entry
      await base44.entities.VerificationRequest.create({
        user_id: user.id,
        user_email: user.email,
        full_name: form.fullName || user.full_name || "",
        document_type: form.documentType,
        document_front_url: frontUrl,
        status: "needs_help",
        help_message: helpMessage,
        help_requested_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
      });

      // Track help request
      base44.analytics.track({
        eventName: "verification_help_requested",
        properties: { user_id: user.id, user_email: user.email, has_document: Boolean(frontUrl) }
      });

      toast.success(t.helpSent);
      setShowHelpForm(false);
      setHelpMessage("");
      onOpenChange(false);
    } catch (err) {
      console.error("Help request error:", err);
      toast.error(language === "ar" ? "فشل إرسال طلب المساعدة" : "Failed to send help request");
    } finally {
      setSendingHelp(false);
    }
  };

  const handleFileChange = useCallback((type, file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(language === "ar" ? "الملف كبير جدًا" : "File too large");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (type === "front") {
        setFrontPreview(result);
        setForm((prev) => ({ ...prev, frontFile: file }));
      } else if (type === "back") {
        setBackPreview(result);
        setForm((prev) => ({ ...prev, backFile: file }));
      } else {
        setSelfiePreview(result);
        setForm((prev) => ({ ...prev, selfieFile: file }));
      }
    };
    reader.readAsDataURL(file);
  }, [language]);
  
  // Simple country select handler
  const handleCountrySelect = useCallback((country) => {
    setForm((prev) => ({ ...prev, country }));
    setCountryDropdownOpen(false);
  }, []);

  const handleSubmit = async () => {
    if (!form.fullName || !form.documentType || !form.frontFile) {
      toast.error(language === "ar" ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }

    setLoading(true);
    try {
      // Upload files first
      const uploadFile = async (file) => {
        if (!file) return null;
        const result = await base44.integrations.Core.UploadFile({ file });
        return result.file_url;
      };

      const [frontUrl, backUrl, selfieUrl] = await Promise.all([
        uploadFile(form.frontFile),
        uploadFile(form.backFile),
        uploadFile(form.selfieFile),
      ]);

      const user = await base44.auth.me();

      await base44.entities.VerificationRequest.create({
        user_id: user.id,
        user_email: user.email,
        full_name: form.fullName,
        document_type: form.documentType,
        document_front_url: frontUrl,
        document_back_url: backUrl,
        selfie_url: selfieUrl,
        date_of_birth: form.dob || null,
        country: form.country || null,
        status: "pending",
        submitted_at: new Date().toISOString(),
      });

      // Track verification completed
      base44.analytics.track({
        eventName: "verification_completed",
        properties: { 
          document_type: form.documentType,
          has_selfie: Boolean(selfieUrl),
          country: form.country || "not_provided",
          user_id: user.id,
          user_email: user.email
        }
      });

      toast.success(t.success);
      onOpenChange(false);
    } catch (err) {
      console.error("Verification submission error:", err);
      toast.error(t.error);
    } finally {
      setLoading(false);
    }
  };

  if (existingRequest) {
    const statusMessages = {
      pending: { icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-500/10", msg: t.pending },
      under_review: { icon: AlertCircle, color: "text-blue-500", bg: "bg-blue-500/10", msg: t.underReview },
      approved: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", msg: t.approved },
      rejected: { icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-500/10", msg: `${t.rejected}: ${existingRequest.rejection_reason || ""}` },
      needs_help: { icon: HelpCircle, color: "text-amber-500", bg: "bg-amber-500/10", msg: t.helpPending },
    };
    const status = statusMessages[existingRequest.status] || statusMessages.pending;
    const Icon = status.icon;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
          </DialogHeader>
          <div className={`flex flex-col items-center gap-4 p-6 rounded-xl ${status.bg}`}>
            <Icon className={`w-12 h-12 ${status.color}`} />
            <p className={`text-center font-medium ${status.color}`}>{status.msg}</p>
            {existingRequest.status === "rejected" && (
              <Button onClick={() => onOpenChange(false)} variant="outline">
                {language === "ar" ? "حاول مرة أخرى" : "Try Again"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl">{t.title}</DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step >= s ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {s}
              </div>
              {s < 3 && <div className={`w-12 h-1 mx-1 ${step > s ? "bg-blue-600" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Document Upload (FIRST) */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              {t.step1}
            </h3>

            <div>
              <Label>{t.docType}</Label>
              <div className="relative">
                <select
                  value={form.documentType}
                  onChange={(e) => setForm({ ...form, documentType: e.target.value })}
                  className="flex h-11 w-full items-center justify-between whitespace-nowrap rounded-xl border-2 border-input bg-background/50 px-4 py-2 text-sm shadow-sm ring-offset-background transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer"
                >
                  <option value="passport">{t.passport}</option>
                  <option value="national_id">{t.nationalId}</option>
                  <option value="drivers_license">{t.driversLicense}</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <FileUploadBox
              label={t.uploadFront + " *"}
              preview={frontPreview}
              onFileChange={(f) => handleFileChange("front", f)}
              language={language}
              t={t}
            />

            <FileUploadBox
              label={t.uploadBack}
              preview={backPreview}
              onFileChange={(f) => handleFileChange("back", f)}
              language={language}
              t={t}
            />

            <Button 
              onClick={() => setStep(2)} 
              className="w-full bg-blue-600 hover:bg-blue-700" 
              disabled={!form.frontFile}
            >
              {language === "ar" ? "متابعة" : "Continue"}
            </Button>

            {/* Ask for Help Button */}
            <div className="border-t border-border pt-4 mt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowHelpForm(!showHelpForm)}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                {t.needHelp}
              </Button>

              {showHelpForm && (
                <div className="mt-3 space-y-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                        {language === "ar" ? "صف مشكلتك وسنساعدك" : "Describe your issue and we'll help you"}
                      </p>
                      <Textarea
                        value={helpMessage}
                        onChange={(e) => setHelpMessage(e.target.value)}
                        placeholder={t.helpPlaceholder}
                        className="h-24 resize-none text-sm"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleAskForHelp}
                    disabled={sendingHelp || !helpMessage.trim()}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {sendingHelp ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {language === "ar" ? "جاري الإرسال..." : "Sending..."}</>
                    ) : (
                      <><HelpCircle className="w-4 h-4 mr-2" /> {t.askForHelp}</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Personal Info */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              {t.step2}
            </h3>
            <div className="space-y-3">
              <div>
                <Label>{t.fullName} *</Label>
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label className="flex items-center gap-2 flex-wrap">
                  {t.dob}
                </Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={form.dob}
                  onChange={(e) => setForm({ ...form, dob: formatDateInput(e.target.value) })}
                  className={`${form.dob && !isValidDateFormat(form.dob) ? "border-red-500 focus:border-red-500 focus:ring-red-500/30" : ""}`}
                  placeholder="YYYY-MM-DD"
                  maxLength={10}
                />
                {form.dob && !isValidDateFormat(form.dob) ? (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {language === "ar" ? "تنسيق غير صالح! استخدم: YYYY-MM-DD (مثال: 1990-05-15)" : "Invalid format! Use: YYYY-MM-DD (e.g., 1990-05-15)"}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === "ar" ? "التنسيق: YYYY-MM-DD (مثال: 1990-05-15)" : "Format: YYYY-MM-DD (e.g., 1990-05-15)"}
                  </p>
                )}
              </div>
              <div>
                <Label>{t.country}</Label>
                <div className="relative">
                  <select
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="flex h-11 w-full items-center justify-between whitespace-nowrap rounded-xl border-2 border-input bg-background/50 px-4 py-2 text-sm shadow-sm ring-offset-background transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer"
                  >
                    <option value="">{language === "ar" ? "اختر الدولة" : "Select country"}</option>
                    {countries.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                {language === "ar" ? "السابق" : "Back"}
              </Button>
              <Button 
                onClick={() => setStep(3)} 
                className="flex-1 bg-blue-600 hover:bg-blue-700" 
                disabled={!form.fullName || (form.dob && !isValidDateFormat(form.dob))}
              >
                {language === "ar" ? "متابعة" : "Continue"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Selfie */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-600" />
              {t.step3}
            </h3>

            <FileUploadBox
              label={t.uploadSelfie}
              hint={t.selfieHint}
              preview={selfiePreview}
              onFileChange={(f) => handleFileChange("selfie", f)}
              language={language}
              t={t}
            />

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1" disabled={loading}>
                {language === "ar" ? "السابق" : "Back"}
              </Button>
              <Button onClick={handleSubmit} className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={loading || !form.frontFile}>
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t.submitting}</>
                ) : t.submit}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FileUploadBox({ label, hint, preview, onFileChange, t }) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden">
        {preview ? (
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="w-8 h-8" />
            <span className="text-sm">{t.dragDrop}</span>
            <span className="text-xs">{t.fileTypes}</span>
          </div>
        )}
        <input
          type="file"
          className="hidden"
          accept="image/*,.pdf"
          onChange={(e) => onFileChange(e.target.files?.[0])}
        />
      </label>
    </div>
  );
}

VerificationModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  language: PropTypes.string,
  existingRequest: PropTypes.object,
};

FileUploadBox.propTypes = {
  label: PropTypes.string,
  hint: PropTypes.string,
  preview: PropTypes.string,
  onFileChange: PropTypes.func,
  t: PropTypes.object,
};