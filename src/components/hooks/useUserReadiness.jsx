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
 * 
 * IMPORTANT: Only runs for authenticated users to avoid unnecessary API calls
 */
export function useUserReadiness({ enabled = true } = {}) {
  const [loading, setLoading] = useState(enabled);
  const [isReady, setIsReady] = useState(false);
  const [nextAction, setNextAction] = useState(null);

  const checkReadiness = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      setIsReady(false);
      setNextAction(null);
      return;
    }
    
    setLoading(true);
    
    try {
      // Check authentication first without making heavy API calls
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        setIsReady(false);
        setNextAction(null);
        setLoading(false);
        return;
      }
      
      const user = await base44.auth.me();
      if (!user) {
        setIsReady(false);
        setNextAction(null);
        setLoading(false);
        return;
      }
      
      // === FIRST: Check if user has ACTIVE exchange account (SINGLE SOURCE OF TRUTH) ===
      // This is the only check that matters for trading access
      const exchangeAccounts = await base44.entities.UserExchangeAccount.filter(
        { user_id: user.id, status: 'ACTIVE' }, 
        '-created_date', 
        1
      );
      
      const activeExchangeAccount = exchangeAccounts?.[0] || null;
      
      // User has active account = ready to trade. No other checks needed.
      if (activeExchangeAccount) {
        console.log('[useUserReadiness] User has ACTIVE exchange account:', activeExchangeAccount.id);
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
      
      // === No active account - check onboarding status (NON-BLOCKING for viewing) ===
      // Use UserVerification as single source of truth
      const [uvRes, requests] = await Promise.all([
        base44.functions.invoke("verificationService", { action: "getStatus" }),
        base44.entities.LiveAccountRequest.filter({ user_id: user.id }, '-created_date', 1)
      ]);
      
      const uvData = uvRes.data?.ok && uvRes.data.data?.exists ? uvRes.data.data : null;
      const request = requests?.[0] || null;
      
      // KYC status from UserVerification only
      const kycApproved = uvData?.status === 'verified';
      const kycRejected = uvData?.status === 'rejected';
      const kycPending = uvData?.status === 'pending';
      const kycUnverified = !uvData || uvData.status === 'unverified';
      
      // Request status
      const hasRequest = !!request;
      const isAssigned = request?.status === 'assigned' || !!request?.assigned_at || !!request?.assigned_pool_account_id;
      const isRejected = hasRequest && !!request.reviewed_at && !!request.rejection_reason;
      const isUnderReview = hasRequest && !request.reviewed_at;
      const isApproved = hasRequest && request.status === 'approved';
      
      // Determine next action based on where user is in the flow
      // IMPORTANT: blocking=false means Futures page is accessible (for viewing/demo)
      // User just sees a prompt to complete onboarding for full trading
      
      if (kycUnverified || kycRejected) {
        // Need KYC
        setIsReady(false);
        setNextAction({
          route: createPageUrl("Profile") + "?tab=security&openVerification=true",
          label: { 
            en: kycRejected ? "Re-submit Verification" : "Complete Verification", 
            ar: kycRejected ? "إعادة تقديم التحقق" : "أكمل التحقق" 
          },
          reason: kycRejected 
            ? (uvData?.rejection_reason || "KYC verification was rejected") 
            : "Identity verification required for live trading",
          blocking: false
        });
        setLoading(false);
        return;
      }
      
      if (kycPending) {
        // KYC pending review
        setIsReady(false);
        setNextAction({
          route: createPageUrl("Profile") + "?tab=security",
          label: { en: "Verification Pending", ar: "التحقق قيد المراجعة" },
          reason: "Your identity verification is being reviewed",
          blocking: false
        });
        setLoading(false);
        return;
      }
      
      // KYC approved but no request yet
      if (!hasRequest) {
        setIsReady(false);
        setNextAction({
          route: createPageUrl("Profile") + "?tab=accounts",
          label: { en: "Request Trading Account", ar: "طلب حساب تداول" },
          reason: "Submit a trading account request for live trading",
          blocking: false
        });
        setLoading(false);
        return;
      }
      
      // Has request - check status
      if (isRejected) {
        setIsReady(false);
        setNextAction({
          route: createPageUrl("Profile") + "?tab=accounts",
          label: { en: "Re-apply", ar: "إعادة التقديم" },
          reason: request.rejection_reason || "Previous request was rejected",
          blocking: false
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
          blocking: false
        });
        setLoading(false);
        return;
      }
      
      // Request approved/assigned but no active account yet (provisioning in progress)
      if (isApproved || isAssigned) {
        setIsReady(false);
        setNextAction({
          route: createPageUrl("Profile") + "?tab=accounts",
          label: { en: "Account Setup", ar: "إعداد الحساب" },
          reason: "Your account is being set up",
          blocking: false
        });
        setLoading(false);
        return;
      }
      
      // Fallback - unknown state
      setIsReady(false);
      setNextAction({
        route: createPageUrl("Profile") + "?tab=accounts",
        label: { en: "View Account Status", ar: "عرض حالة الحساب" },
        reason: "Check your account status",
        blocking: false
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
    if (enabled) {
      checkReadiness();
    } else {
      setLoading(false);
      setIsReady(false);
      setNextAction(null);
    }
  }, [enabled, checkReadiness]);

  return {
    isReady,
    nextAction,
    loading,
    refresh: checkReadiness
  };
}