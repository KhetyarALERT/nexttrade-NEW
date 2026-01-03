import { useState } from "react";
import PropTypes from "prop-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Wallet, AlertCircle, CheckCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function CreateSubaccountModal({ open, onOpenChange, onSuccess, language = "en" }) {
  const [nickname, setNickname] = useState("");
  const [accountType, setAccountType] = useState("futures");
  const [leverage, setLeverage] = useState([10]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const t = {
    en: {
      title: "Create Trading Account",
      subtitle: "Open a new BingX subaccount linked to your profile",
      nickname: "Account Nickname",
      nicknamePlaceholder: "e.g., Main Trading",
      nicknameHelp: "2-32 characters, used to identify this account",
      accountType: "Account Type",
      spot: "Spot Trading",
      futures: "Futures Trading",
      both: "Spot & Futures",
      leverage: "Default Leverage",
      leverageHelp: "Can be adjusted per trade",
      create: "Create Account",
      creating: "Creating...",
      cancel: "Cancel",
      success: "Account created successfully!",
      errors: {
        nickname: "Please enter a valid nickname (2-32 characters)",
        duplicate: "An account with this nickname already exists",
        api: "Failed to create account. Please try again."
      }
    },
    ar: {
      title: "إنشاء حساب تداول",
      subtitle: "افتح حساباً فرعياً جديداً على BingX مرتبطاً بملفك الشخصي",
      nickname: "اسم الحساب",
      nicknamePlaceholder: "مثال: التداول الرئيسي",
      nicknameHelp: "2-32 حرفاً، يُستخدم لتحديد هذا الحساب",
      accountType: "نوع الحساب",
      spot: "التداول الفوري",
      futures: "العقود الآجلة",
      both: "فوري وآجل",
      leverage: "الرافعة المالية الافتراضية",
      leverageHelp: "يمكن تعديلها لكل صفقة",
      create: "إنشاء الحساب",
      creating: "جاري الإنشاء...",
      cancel: "إلغاء",
      success: "تم إنشاء الحساب بنجاح!",
      errors: {
        nickname: "يرجى إدخال اسم صالح (2-32 حرفاً)",
        duplicate: "يوجد حساب بهذا الاسم بالفعل",
        api: "فشل إنشاء الحساب. يرجى المحاولة مرة أخرى."
      }
    }
  }[language];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate
    if (!nickname || nickname.length < 2 || nickname.length > 32) {
      setError(t.errors.nickname);
      return;
    }

    setLoading(true);

    try {
      const result = await base44.functions.invoke('createSubaccount', {
        action: 'create',
        nickname: nickname.trim(),
        accountType,
        leverage: leverage[0]
      });

      if (result.data?.success) {
        setSuccess(t.success);
        setTimeout(() => {
          setNickname("");
          setAccountType("futures");
          setLeverage([10]);
          setSuccess(null);
          onOpenChange(false);
          if (onSuccess) onSuccess(result.data.data);
        }, 1500);
      } else {
        setError(result.data?.error || t.errors.api);
      }
    } catch (err) {
      setError(err.message || t.errors.api);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setNickname("");
      setError(null);
      setSuccess(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle>{t.title}</DialogTitle>
              <DialogDescription>{t.subtitle}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-500 bg-green-50 text-green-700">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="nickname">{t.nickname}</Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t.nicknamePlaceholder}
              maxLength={32}
              disabled={loading}
            />
            <p className="text-xs text-gray-500">{t.nicknameHelp}</p>
          </div>

          <div className="space-y-2">
            <Label>{t.accountType}</Label>
            <Select value={accountType} onValueChange={setAccountType} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spot">{t.spot}</SelectItem>
                <SelectItem value="futures">{t.futures}</SelectItem>
                <SelectItem value="both">{t.both}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(accountType === "futures" || accountType === "both") && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t.leverage}</Label>
                <span className="text-sm font-bold text-blue-600">{leverage[0]}x</span>
              </div>
              <Slider
                value={leverage}
                onValueChange={setLeverage}
                min={1}
                max={125}
                step={1}
                disabled={loading}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>1x</span>
                <span>125x</span>
              </div>
              <p className="text-xs text-gray-500">{t.leverageHelp}</p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t.creating}
                </>
              ) : (
                t.create
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

CreateSubaccountModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  language: PropTypes.string
};