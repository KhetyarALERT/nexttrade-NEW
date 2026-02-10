import { useState } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Mail } from "lucide-react";
import { useMediaQuery } from "@/components/hooks/useMediaQuery";

const translations = {
  en: {
    title: "Change Password",
    description: "Enter your current password and choose a new one.",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmPassword: "Confirm New Password",
    currentPlaceholder: "Enter current password",
    newPlaceholder: "Enter new password",
    confirmPlaceholder: "Confirm new password",
    change: "Change Password",
    changing: "Changing...",
    success: "Password changed successfully!",
    successDesc: "Your password has been updated. You can close this dialog.",
    close: "Close",
    cancel: "Cancel",
    sendResetLink: "Send password reset link",
    sendingReset: "Sending...",
    resetSent: "Reset link sent!",
    resetSentDesc: "Check your email inbox (and spam folder) for the reset link.",
    errors: {
      currentRequired: "Current password is required",
      newRequired: "New password is required",
      confirmRequired: "Please confirm your new password",
      mismatch: "Passwords do not match",
      tooShort: "Password must be at least 8 characters",
      noUppercase: "Password must contain at least one uppercase letter",
      noLowercase: "Password must contain at least one lowercase letter",
      noNumber: "Password must contain at least one number",
      sameAsOld: "New password must be different from current password",
      generic: "Failed to change password. Please check your current password and try again.",
    },
  },
  ar: {
    title: "تغيير كلمة المرور",
    description: "أدخل كلمة المرور الحالية واختر كلمة مرور جديدة.",
    currentPassword: "كلمة المرور الحالية",
    newPassword: "كلمة المرور الجديدة",
    confirmPassword: "تأكيد كلمة المرور الجديدة",
    currentPlaceholder: "أدخل كلمة المرور الحالية",
    newPlaceholder: "أدخل كلمة المرور الجديدة",
    confirmPlaceholder: "أكد كلمة المرور الجديدة",
    change: "تغيير كلمة المرور",
    changing: "جاري التغيير...",
    success: "تم تغيير كلمة المرور بنجاح!",
    successDesc: "تم تحديث كلمة المرور. يمكنك إغلاق هذا الحوار.",
    close: "إغلاق",
    cancel: "إلغاء",
    sendResetLink: "إرسال رابط إعادة تعيين كلمة المرور",
    sendingReset: "جاري الإرسال...",
    resetSent: "تم إرسال رابط إعادة التعيين!",
    resetSentDesc: "تحقق من بريدك الإلكتروني (ومجلد البريد المزعج) للرابط.",
    errors: {
      currentRequired: "كلمة المرور الحالية مطلوبة",
      newRequired: "كلمة المرور الجديدة مطلوبة",
      confirmRequired: "يرجى تأكيد كلمة المرور الجديدة",
      mismatch: "كلمات المرور غير متطابقة",
      tooShort: "يجب أن تكون كلمة المرور 8 أحرف على الأقل",
      noUppercase: "يجب أن تحتوي كلمة المرور على حرف كبير واحد على الأقل",
      noLowercase: "يجب أن تحتوي كلمة المرور على حرف صغير واحد على الأقل",
      noNumber: "يجب أن تحتوي كلمة المرور على رقم واحد على الأقل",
      sameAsOld: "يجب أن تكون كلمة المرور الجديدة مختلفة عن الحالية",
      generic: "فشل تغيير كلمة المرور. يرجى التحقق من كلمة المرور الحالية والمحاولة مرة أخرى.",
    },
  },
};

function validatePassword(password, t) {
  if (!password) return t.errors.newRequired;
  if (password.length < 8) return t.errors.tooShort;
  if (!/[A-Z]/.test(password)) return t.errors.noUppercase;
  if (!/[a-z]/.test(password)) return t.errors.noLowercase;
  if (!/[0-9]/.test(password)) return t.errors.noNumber;
  return null;
}

export default function ChangePasswordModal({ open, onOpenChange, language = "en", userId, userEmail }) {
  const t = translations[language] || translations.en;
  const isMobile = useMediaQuery("(max-width: 640px)");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState(/** @type {{current?: string, new?: string, confirm?: string}} */ ({}));

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setLoading(false);
    setResetLoading(false);
    setSuccess(false);
    setResetSuccess(false);
    setError("");
    setFieldErrors({});
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const validate = () => {
    const errors = {};

    if (!currentPassword.trim()) {
      errors.current = t.errors.currentRequired;
    }

    const newPwError = validatePassword(newPassword, t);
    if (newPwError) {
      errors.new = newPwError;
    }

    if (!confirmPassword) {
      errors.confirm = t.errors.confirmRequired;
    } else if (newPassword !== confirmPassword) {
      errors.confirm = t.errors.mismatch;
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      errors.new = t.errors.sameAsOld;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!validate()) return;

    setLoading(true);
    try {
      await base44.auth.changePassword({
        userId,
        currentPassword,
        newPassword,
      });
      setSuccess(true);
    } catch (err) {
      console.error("Change password error:", err);
      setError(err?.message || t.errors.generic);
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetLink = async () => {
    if (!userEmail) return;
    setResetLoading(true);
    setError("");
    try {
      await base44.auth.resetPasswordRequest(userEmail);
      setResetSuccess(true);
    } catch (err) {
      console.error("Reset password request error:", err);
      setError(err?.message || t.errors.generic);
    } finally {
      setResetLoading(false);
    }
  };

  const content = (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      {success ? (
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{t.success}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t.successDesc}</p>
          </div>
          <Button onClick={handleClose} className="mt-4">
            {t.close}
          </Button>
        </div>
      ) : resetSuccess ? (
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{t.resetSent}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t.resetSentDesc}</p>
          </div>
          <Button onClick={handleClose} className="mt-4">
            {t.close}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="current-password" className="text-sm font-medium">
              {t.currentPassword}
            </Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, current: undefined }));
                }}
                placeholder={t.currentPlaceholder}
                className={`pr-10 ${fieldErrors.current ? "border-destructive" : ""}`}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute inset-y-0 right-0 rtl:right-auto rtl:left-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.current && (
              <p className="text-xs text-destructive">{fieldErrors.current}</p>
            )}
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-sm font-medium">
              {t.newPassword}
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, new: undefined }));
                }}
                placeholder={t.newPlaceholder}
                className={`pr-10 ${fieldErrors.new ? "border-destructive" : ""}`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 right-0 rtl:right-auto rtl:left-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.new && (
              <p className="text-xs text-destructive">{fieldErrors.new}</p>
            )}
            {/* Password requirements hint */}
            <p className="text-[10px] text-muted-foreground">
              {language === "ar"
                ? "8 أحرف على الأقل، حرف كبير، حرف صغير، ورقم"
                : "Min 8 chars, uppercase, lowercase, and number"}
            </p>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-sm font-medium">
              {t.confirmPassword}
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
                }}
                placeholder={t.confirmPlaceholder}
                className={`pr-10 ${fieldErrors.confirm ? "border-destructive" : ""}`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-0 rtl:right-auto rtl:left-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.confirm && (
              <p className="text-xs text-destructive">{fieldErrors.confirm}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.changing}
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  {t.change}
                </>
              )}
            </Button>
            <Button type="button" variant="ghost" onClick={handleClose} className="w-full">
              {t.cancel}
            </Button>
          </div>

          {/* Reset link option */}
          <div className="border-t border-border pt-4 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleSendResetLink}
              disabled={resetLoading || !userEmail}
              className="w-full text-sm"
            >
              {resetLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.sendingReset}
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  {t.sendResetLink}
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-4 pb-8">
          <DrawerHeader className="text-left rtl:text-right">
            <DrawerTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-blue-600" />
              {t.title}
            </DrawerTitle>
            <DrawerDescription>{t.description}</DrawerDescription>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-600" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

ChangePasswordModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  language: PropTypes.oneOf(["en", "ar"]),
  userId: PropTypes.string,
  userEmail: PropTypes.string,
};