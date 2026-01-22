import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

const REFERRAL_COOKIE_KEY = "nexttrade_ref";
const REFERRAL_COOKIE_DAYS = 30;

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export default function ReferralRedirect() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("validating"); // validating | valid | invalid
  const [error, setError] = useState(null);

  useEffect(() => {
    async function processReferral() {
      if (!code) {
        setStatus("invalid");
        setError("No referral code provided");
        return;
      }

      const cleanCode = code.trim().toUpperCase();

      try {
        // Validate code
        const res = await base44.functions.invoke("referral", {
          action: "validateCode",
          code: cleanCode
        });

        if (!res.data?.valid) {
          setStatus("invalid");
          setError("Invalid referral code");
          setTimeout(() => navigate(createPageUrl("Home")), 2000);
          return;
        }

        // Store in cookie and localStorage for persistence
        setCookie(REFERRAL_COOKIE_KEY, cleanCode, REFERRAL_COOKIE_DAYS);
        localStorage.setItem(REFERRAL_COOKIE_KEY, cleanCode);
        localStorage.setItem(REFERRAL_COOKIE_KEY + "_ts", Date.now().toString());

        // Record click (fire and forget)
        base44.functions.invoke("referral", {
          action: "recordClick",
          code: cleanCode
        }).catch(() => {});

        setStatus("valid");

        // Redirect to registration with code
        setTimeout(() => {
          // Check if user is already authenticated
          base44.auth.isAuthenticated().then(isAuth => {
            if (isAuth) {
              navigate(createPageUrl("Dashboard"));
            } else {
              // Redirect to login/register - the code is stored in cookie
              base44.auth.redirectToLogin(createPageUrl("Dashboard"));
            }
          });
        }, 1500);

      } catch (err) {
        console.error("Referral validation error:", err);
        setStatus("invalid");
        setError("Something went wrong");
        setTimeout(() => navigate(createPageUrl("Home")), 2000);
      }
    }

    processReferral();
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4">
        {status === "validating" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-lg font-medium text-foreground">Validating referral...</p>
          </>
        )}

        {status === "valid" && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="text-lg font-medium text-foreground">Referral accepted!</p>
            <p className="text-sm text-muted-foreground">Redirecting you to sign up...</p>
          </>
        )}

        {status === "invalid" && (
          <>
            <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mx-auto">
              <XCircle className="h-8 w-8 text-rose-600" />
            </div>
            <p className="text-lg font-medium text-foreground">{error || "Invalid referral"}</p>
            <p className="text-sm text-muted-foreground">Redirecting to homepage...</p>
          </>
        )}
      </div>
    </div>
  );
}