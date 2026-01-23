import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

const REF_CODE_KEY = "nt_ref_code";
const REF_TS_KEY = "nt_ref_ts";
const REF_FINALIZED_KEY = "nt_ref_finalized";
const MAX_REF_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Valid referral code pattern: 4-32 chars, alphanumeric + hyphen
const REFERRAL_CODE_REGEX = /^[A-Z0-9-]{4,32}$/i;

function isValidReferralCode(code) {
  return code && REFERRAL_CODE_REGEX.test(code);
}

/**
 * Hook to capture referral code from URL and finalize attribution after auth.
 * 
 * - On page load: captures ?ref=CODE from URL, stores in localStorage
 * - After user authenticates: calls backend to finalize attribution
 * - Clears localStorage after successful finalization
 */
export function useReferralCapture({ isAuthenticated, isLoadingAuth }) {
  const finalizingRef = useRef(false);

  // Step 1: Capture ref code from URL on initial load
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref") || params.get("code");

    if (refCode && isValidReferralCode(refCode)) {
      const normalized = refCode.trim().toUpperCase();
      
      // Store in localStorage
      try {
        localStorage.setItem(REF_CODE_KEY, normalized);
        localStorage.setItem(REF_TS_KEY, Date.now().toString());
        localStorage.removeItem(REF_FINALIZED_KEY); // Clear any old finalized flag
      } catch (e) {
        console.warn("[Referral] Failed to store ref code:", e);
      }

      // Optional: Track click (fire and forget, no await)
      base44.functions.invoke("referral", { action: "recordClick", code: normalized })
        .catch(() => {}); // Ignore errors

      // Clean URL without reload (remove ref param)
      const url = new URL(window.location.href);
      url.searchParams.delete("ref");
      url.searchParams.delete("code");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  // Step 2: Finalize attribution after auth
  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated) return;
    if (finalizingRef.current) return;

    const storedCode = localStorage.getItem(REF_CODE_KEY);
    const storedTs = localStorage.getItem(REF_TS_KEY);
    const alreadyFinalized = localStorage.getItem(REF_FINALIZED_KEY);

    // Skip if no code, already finalized, or code too old
    if (!storedCode || alreadyFinalized) return;
    
    if (storedTs) {
      const age = Date.now() - parseInt(storedTs, 10);
      if (age > MAX_REF_AGE_MS) {
        // Code expired, clean up
        localStorage.removeItem(REF_CODE_KEY);
        localStorage.removeItem(REF_TS_KEY);
        return;
      }
    }

    finalizingRef.current = true;

    // Call backend to finalize
    base44.functions.invoke("referral", { action: "finalizeReferral", code: storedCode })
      .then((res) => {
        const data = res.data;
        if (data?.ok || data?.status === "already_attributed" || data?.status === "created") {
          // Success - clear localStorage
          localStorage.removeItem(REF_CODE_KEY);
          localStorage.removeItem(REF_TS_KEY);
          localStorage.setItem(REF_FINALIZED_KEY, "true");
          console.log("[Referral] Attribution finalized:", data.status);
        } else if (data?.status === "self_referral" || data?.status === "invalid_code") {
          // Invalid - clear localStorage
          localStorage.removeItem(REF_CODE_KEY);
          localStorage.removeItem(REF_TS_KEY);
          console.log("[Referral] Attribution rejected:", data.status);
        }
      })
      .catch((err) => {
        console.warn("[Referral] Finalization error:", err);
      })
      .finally(() => {
        finalizingRef.current = false;
      });
  }, [isAuthenticated, isLoadingAuth]);
}

/**
 * Get stored referral code (for preserving during login redirect)
 */
export function getStoredReferralCode() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(REF_CODE_KEY);
  } catch {
    return null;
  }
}