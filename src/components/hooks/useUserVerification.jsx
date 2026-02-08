import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

/**
 * useUserVerification - Single Source of Truth for Verification Status
 * 
 * Returns:
 * - status: "unverified" | "pending" | "verified" | "rejected"
 * - isVerified: boolean
 * - label: { en: string, ar: string }
 * - ctaVisible: boolean
 * - ctaLabel: { en: string, ar: string }
 * - ctaRoute: string
 * - currentRequest: VerificationRequest object (for details/docs)
 * - loading: boolean
 * - refresh: function
 * 
 * CRITICAL: Uses UserVerification.status ONLY (not VerificationRequest.status)
 */
export function useUserVerification({ enabled = true } = {}) {
  const [loading, setLoading] = useState(enabled);
  const [status, setStatus] = useState("unverified");
  const [currentRequest, setCurrentRequest] = useState(null);
  const [verificationData, setVerificationData] = useState(null);

  const loadStatus = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke("verificationService", { action: "getStatus" });
      
      if (res.data?.ok && res.data.data?.exists) {
        const uvData = res.data.data;
        setStatus(uvData.status);
        setCurrentRequest(uvData.current_request || null);
        setVerificationData(uvData);
      } else {
        setStatus("unverified");
        setCurrentRequest(null);
        setVerificationData(null);
      }
    } catch (err) {
      console.error("[useUserVerification] Failed to load:", err);
      setStatus("unverified");
      setCurrentRequest(null);
      setVerificationData(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      loadStatus();
    }
  }, [enabled, loadStatus]);

  // Subscribe to UserVerification changes
  useEffect(() => {
    if (!enabled) return;

    let userId = null;
    base44.auth.me().then(u => { userId = u?.id; }).catch(() => {});

    const unsubscribe = base44.entities.UserVerification.subscribe((event) => {
      if (userId && event.data?.user_id === userId) {
        loadStatus();
      }
    });

    return () => unsubscribe();
  }, [enabled, loadStatus]);

  // Resolve UI display values
  const isVerified = status === "verified";
  
  const label = {
    verified: { en: "Verified", ar: "موثق" },
    pending: { en: "Pending Review", ar: "قيد المراجعة" },
    rejected: { en: "Rejected", ar: "مرفوض" },
    unverified: { en: "Not Verified", ar: "غير موثق" }
  }[status] || { en: "Unknown", ar: "غير معروف" };

  const ctaVisible = status !== "verified";
  
  const ctaLabel = {
    pending: { en: "Check Status", ar: "تحقق من الحالة" },
    rejected: { en: "Resubmit Documents", ar: "إعادة تقديم المستندات" },
    unverified: { en: "Complete Verification", ar: "أكمل التحقق" }
  }[status] || { en: "Verify Identity", ar: "تحقق من الهوية" };

  const ctaRoute = `${createPageUrl("Profile")}?tab=security&openVerification=true`;

  return {
    status,
    isVerified,
    label,
    ctaVisible,
    ctaLabel,
    ctaRoute,
    currentRequest,
    verificationData,
    loading,
    refresh: loadStatus
  };
}