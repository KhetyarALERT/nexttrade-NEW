import React, { useState } from 'react';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';

const translations = {
  en: {
    dangerZone: "Danger Zone",
    dangerDesc: "Irreversible actions that permanently affect your account",
    deleteAccount: "Delete Account",
    deleteDesc: "Permanently delete your account and all associated data. This action cannot be undone.",
    deleteBtn: "Delete My Account",
    confirmTitle: "Are you absolutely sure?",
    confirmDesc: "This action cannot be undone. This will permanently delete your account and remove all your data from our servers.",
    typeConfirm: 'Type "DELETE" to confirm',
    cancel: "Cancel",
    deleting: "Deleting...",
    deleteSuccess: "Account deletion initiated. You will be logged out shortly.",
    deleteError: "Failed to delete account. Please contact support."
  },
  ar: {
    dangerZone: "منطقة الخطر",
    dangerDesc: "إجراءات لا رجعة فيها تؤثر على حسابك بشكل دائم",
    deleteAccount: "حذف الحساب",
    deleteDesc: "حذف حسابك نهائيًا وجميع البيانات المرتبطة به. لا يمكن التراجع عن هذا الإجراء.",
    deleteBtn: "حذف حسابي",
    confirmTitle: "هل أنت متأكد تمامًا؟",
    confirmDesc: "لا يمكن التراجع عن هذا الإجراء. سيؤدي هذا إلى حذف حسابك نهائيًا وإزالة جميع بياناتك من خوادمنا.",
    typeConfirm: 'اكتب "DELETE" للتأكيد',
    cancel: "إلغاء",
    deleting: "جاري الحذف...",
    deleteSuccess: "بدأت عملية حذف الحساب. سيتم تسجيل خروجك قريبًا.",
    deleteError: "فشل حذف الحساب. يرجى الاتصال بالدعم."
  }
};

export default function DangerZone({ language = 'en' }) {
  const t = translations[language] || translations.en;
  const { toast } = useToast();
  
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const isConfirmValid = confirmText.toUpperCase() === 'DELETE';

  const handleDeleteAccount = async () => {
    if (!isConfirmValid) return;
    
    setDeleting(true);
    try {
      // Call backend to delete user data
      const res = await base44.functions.invoke('deleteUserAccount', { action: 'delete' });
      
      if (res.data?.ok) {
        toast({
          title: t.deleteSuccess,
          className: "bg-emerald-50 border-emerald-200 text-emerald-900"
        });
        
        // Log out after short delay
        setTimeout(() => {
          base44.auth.logout();
        }, 2000);
      } else {
        throw new Error(res.data?.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Delete account error:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: t.deleteError
      });
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setConfirmText('');
    }
  };

  return (
    <>
      <Card className="border-rose-500/30 bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/20 dark:to-red-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-rose-700 dark:text-rose-400">
                {t.dangerZone}
              </CardTitle>
              <CardDescription className="text-rose-600/80 dark:text-rose-400/80">
                {t.dangerDesc}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-white/50 dark:bg-rose-950/30">
            <div>
              <h4 className="font-semibold text-rose-800 dark:text-rose-300">{t.deleteAccount}</h4>
              <p className="text-sm text-rose-600/80 dark:text-rose-400/80 mt-1">{t.deleteDesc}</p>
            </div>
            <Button
              variant="destructive"
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl shrink-0"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t.deleteBtn}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t.confirmTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {t.confirmDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            <Label htmlFor="confirm-delete" className="text-sm font-medium">
              {t.typeConfirm}
            </Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="mt-2 font-mono"
              disabled={deleting}
            />
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={!isConfirmValid || deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t.deleting}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t.deleteBtn}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}