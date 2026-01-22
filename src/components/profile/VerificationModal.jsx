import { useState, useCallback } from "react";
import PropTypes from "prop-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, CheckCircle2, AlertCircle, Camera, FileText, User, Calendar, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const translations = {
  en: {
    title: "Identity Verification",
    subtitle: "Complete KYC to unlock full platform access",
    step1: "Personal Information",
    step2: "Document Upload",
    step3: "Selfie Verification",
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
    step1: "المعلومات الشخصية",
    step2: "رفع المستندات",
    step3: "التحقق بالصورة الذاتية",
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
  const t = translations[language];
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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

        {/* Loading/Transition State */}
        {transitioning && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {/* Step 1: Personal Info */}
        {!transitioning && step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              {t.step1}
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
                <Label className="flex items-center gap-2">
                  {t.dob}
                  <span className="text-xs text-muted-foreground font-normal">
                    ({language === "ar" ? "اضغط لفتح التقويم أو اكتب" : "Tap to open calendar or type"})
                  </span>
                </Label>
                <div className="relative">
                  <Input
                    type="date"
                    value={form.dob}
                    onChange={(e) => setForm({ ...form, dob: e.target.value })}
                    className="pr-10"
                    placeholder="YYYY-MM-DD"
                    max={new Date().toISOString().split('T')[0]}
                    min="1920-01-01"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {language === "ar" ? "مثال: 1990-05-15" : "Format: YYYY-MM-DD (e.g., 1990-05-15)"}
                </p>
              </div>
              <div>
                <Label>{t.country}</Label>
                <Select 
                  value={form.country} 
                  onValueChange={(v) => setForm({ ...form, country: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر الدولة" : "Select country"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {countries.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button 
              onClick={() => goToStep(2)} 
              className="w-full bg-blue-600 hover:bg-blue-700" 
              disabled={!form.fullName || transitioning}
            >
              {language === "ar" ? "التالي" : "Continue"}
            </Button>
          </div>
        )}

        {/* Step 2: Document Upload */}
        {!transitioning && step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              {t.step2}
            </h3>
            
            <div>
              <Label>{t.docType}</Label>
              <Select value={form.documentType} onValueChange={(v) => setForm({ ...form, documentType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passport">{t.passport}</SelectItem>
                  <SelectItem value="national_id">{t.nationalId}</SelectItem>
                  <SelectItem value="drivers_license">{t.driversLicense}</SelectItem>
                </SelectContent>
              </Select>
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

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => goToStep(1)} className="flex-1" disabled={transitioning}>
                {language === "ar" ? "السابق" : "Back"}
              </Button>
              <Button onClick={() => goToStep(3)} className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!form.frontFile || transitioning}>
                {language === "ar" ? "التالي" : "Continue"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Selfie */}
        {!transitioning && step === 3 && (
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
              <Button variant="outline" onClick={() => goToStep(2)} className="flex-1" disabled={transitioning || loading}>
                {language === "ar" ? "السابق" : "Back"}
              </Button>
              <Button onClick={handleSubmit} className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={loading || transitioning}>
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