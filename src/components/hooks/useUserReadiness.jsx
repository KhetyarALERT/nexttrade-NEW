import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

/**
 * useUserReadiness - Single source of truth for user onboarding readiness
 * 
 * Returns:
 * - isReady: boolean - can user access Futures trading?
 * - nextAction: { route, label: {en, ar}, reason, blocking } - where to send user if not ready
 * - loading: boolean
 * - refresh: function - manually reload status
 */
export function useUserReadiness() {
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [nextAction, setNextAction] = useState(null);

  const checkReadiness = useCallback(async () => {
    setLoading(true);
    
    try {
      const user = await base44.auth.me();
      if (!user) {
        setIsReady(false);
        setNextAction(null);
        setLoading(false);
        return;
      }
      
      const [verifications, requests] = await Promise.all([
        base44.entities.VerificationRequest.filter({ user_id: user.id }, '-submitted_at', 1),
        base44.entities.LiveAccountRequest.filter({ user_id: user.id }, '-created_date', 1)
      ]);
      
      const verification = verifications?.[0] || null;
      const request = requests?.[0] || null;
      
      // === STEP 1: KYC Check ===
      const kycApproved = verification?.status === 'approved';
      const kycRejected = verification?.status === 'rejected';
      const kycPending = verification && !kycApproved && !kycRejected;
      
      if (!verification || kycRejected) {
        setIsReady(false);
        setNextAction({
          route: createPageUrl("Profile") + "?tab=security&openVerification=true",
          label: { 
            en: kycRejected ? "Re-submit Verification" : "Complete Verification", 
            ar: kycRejected ? "إعادة تقديم التحقق" : "أكمل التحقق" 
          },
          reason: kycRejected 
            ? (verification?.rejection_reason || "KYC verification was rejected") 
            : "Identity verification required",
          blocking: true
        });
        setLoading(false);
        return;
      }
      
      if (kycPending) {
        setIsReady(false);
        setNextAction({
          route: createPageUrl("Profile") + "?tab=security",
          label: { en: "Verification Pending", ar: "التحقق قيد المراجعة" },
          reason: "Your identity verification is being reviewed",
          blocking: true
        });
        setLoading(false);
        return;
      }
      
      // === STEP 2: Request Check ===
      if (!request) {
        setIsReady(false);
        setNextAction({
          route: createPageUrl("Profile") + "?tab=accounts",
          label: { en: "Request Trading Account", ar: "طلب حساب تداول" },
          reason: "Submit a trading account request",
          blocking: true
        });
        setLoading(false);
        return;
      }
      
      // === STEP 3: Review Status ===
      const isAssigned = request.status === 'assigned' || !!request.assigned_at || !!request.assigned_pool_account_id;
      const isRejected = !!request.reviewed_at && !!request.rejection_reason;
      const isUnderReview = !request.reviewed_at;
      
      if (isRejected) {
        setIsReady(false);
        setNextAction({
          route: createPageUrl("Profile") + "?tab=accounts",
          label: { en: "Re-apply", ar: "إعادة التقديم" },
          reason: request.rejection_reason || "Previous request was rejected",
          blocking: true
        });
        setLoading(false);
        return;
      }
      
      if (isUnderReview) {
        setIsReady(false);
        setNextAction({
          route: createPageUrl("Profile") + "?tab=accounts",
          label: { en: "Under Review", ar: "قيد المراجعة" },
          reason: "Your request is being reviewed by our team",
          blocking: true
        });
        setLoading(false);
        return;
      }
      
      // === STEP 4: Ready ===
      if (isAssigned) {
        setIsReady(true);
        setNextAction({
          route: createPageUrl("Futures"),
          label: { en: "Start Trading", ar: "ابدأ التداول" },
          reason: null,
          blocking: false
        });
        setLoading(false);
        return;
      }
      
      // Fallback
      setIsReady(false);
      setNextAction({
        route: createPageUrl("Profile") + "?tab=accounts",
        label: { en: "View Account Status", ar: "عرض حالة الحساب" },
        reason: "Unknown account status",
        blocking: true
      });
      
    } catch (err) {
      console.error('[useUserReadiness] Error:', err);
      setIsReady(false);
      setNextAction(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkReadiness();
  }, [checkReadiness]);

  return {
    isReady,
    nextAction,
    loading,
    refresh: checkReadiness
  };
}