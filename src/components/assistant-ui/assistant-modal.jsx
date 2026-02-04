import { useEffect } from "react";
import { X, ShieldCheck, AlertCircle, MessageCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Thread } from "@/components/assistant-ui/thread";
import { tAssistant } from "@/components/i18n/translations";
import { cn } from "@/lib/utils";
import { useMobileNavigation } from "@/components/mobile/MobileNavigationContext";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
// @ts-ignore
import nextTradeLogo from "@/assets/nexttrade-logo.png";
import { useState } from "react";

export function AssistantModal({ language = "en" }) {
  const t = tAssistant(language);
  const isRtl = language === "ar";
  const location = useLocation();
  const navigate = useNavigate();
  const { assistantModalOpen, closeAssistantModal, openAssistantModal } = useMobileNavigation();
  const { user, isAuthenticated } = useAuth();
  const [kycStatus, setKycStatus] = useState(null);

  // Fetch KYC status for authenticated users
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    
    const fetchKycStatus = async () => {
      try {
        const verifications = await base44.entities.UserVerification.filter({ user_id: user.id });
        if (verifications?.length > 0) {
          setKycStatus(verifications[0].status);
        }
      } catch (err) {
        // Silently ignore - not critical
      }
    };
    fetchKycStatus();
  }, [isAuthenticated, user?.id]);
  
  // Hide completely on futures/trading/memecoins pages
  const isTradingPage = location.pathname.includes("Futures") || location.pathname.includes("Trading") || location.pathname.includes("MemeCoins");
  
  if (isTradingPage) {
    return null;
  }

  const displayName = user?.full_name || user?.email?.split("@")[0] || null;

  return (
    <>
      {/* Desktop Floating Trigger Button - always visible on desktop for logged-in users */}
      <Button
        onClick={openAssistantModal}
        className={cn(
          "fixed z-[100] hidden sm:flex",
          "bottom-6 right-6",
          "h-14 w-14 rounded-full p-0",
          "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/30",
          "transition-transform hover:scale-105 active:scale-95"
        )}
        aria-label={t.support}
      >
        <MessageCircle className="h-6 w-6 text-primary-foreground" />
      </Button>

      {/* Support Sheet/Drawer - works on both desktop and mobile */}
      <Sheet open={assistantModalOpen} onOpenChange={(open) => !open && closeAssistantModal()}>
        <SheetContent 
          side={isRtl ? "left" : "right"}
          hideCloseButton={true}
          className={cn(
            "p-0 flex flex-col",
            // Desktop: fixed width drawer
            "sm:w-[420px] sm:max-w-[420px]",
            // Mobile: full screen
            "w-full max-w-full",
            // Full height with safe area
            "h-full",
            // High z-index but below critical modals
            "z-[150]"
          )}
          // Prevent body scroll when open
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Header */}
          <SheetHeader className={cn(
            "flex-shrink-0 border-b border-border/70 px-4 py-3",
            "flex flex-row items-center justify-between gap-3",
            isRtl && "flex-row-reverse"
          )}>
            <div className={cn("flex items-center gap-3 flex-1 min-w-0", isRtl && "flex-row-reverse")}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background flex-shrink-0">
                <img src={nextTradeLogo} alt="NextTrade" className="h-6 w-6 object-contain" />
              </div>
              <div className={cn("flex-1 min-w-0", isRtl && "text-right")}>
                <SheetTitle className="text-base font-semibold text-foreground">
                  {language === "ar" ? "الدعم" : "Support"}
                </SheetTitle>
                {isAuthenticated && displayName ? (
                  <div className={cn("flex items-center gap-1.5 flex-wrap", isRtl && "flex-row-reverse justify-end")}>
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">{displayName}</span>
                    {kycStatus === "verified" && (
                      <Badge variant="success" className="text-[9px] px-1.5 py-0 h-4">
                        <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />
                        {language === "ar" ? "موثق" : "Verified"}
                      </Badge>
                    )}
                    {kycStatus === "pending" && (
                      <Badge variant="warning" className="text-[9px] px-1.5 py-0 h-4">
                        <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                        {language === "ar" ? "قيد المراجعة" : "Pending"}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs text-emerald-600">{language === "ar" ? "متصل" : "Online"}</span>
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeAssistantModal}
              className="h-9 w-9 rounded-xl flex-shrink-0"
              aria-label={t.closeLabel}
            >
              <X className="h-4 w-4" />
            </Button>
          </SheetHeader>

          {/* Chat Body - fills remaining space */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <Thread 
              language={language} 
              isRtl={isRtl} 
              onNavigate={(path) => {
                // Navigate using SPA router, keep widget open
                navigate(path);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}