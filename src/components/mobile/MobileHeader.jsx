import PropTypes from "prop-types";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useMobileNavigation, isRootPath } from "./MobileNavigationContext";
// @ts-ignore
import nextTradeLogo from "@/assets/nexttrade-logo.png";

export default function MobileHeader({ language = "en", title = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { getActiveTabFromPath } = useMobileNavigation();
  
  const pathname = location.pathname;
  const isRoot = isRootPath(pathname);
  const activeTab = getActiveTabFromPath(pathname);
  
  // Default titles per tab
  const tabTitles = {
    Dashboard: language === "ar" ? "الرئيسية" : "Home",
    Futures: language === "ar" ? "التداول" : "Trade",
    Wallet: language === "ar" ? "المحفظة" : "Wallet",
    Profile: language === "ar" ? "الحساب" : "Account",
  };
  
  const displayTitle = title || tabTitles[activeTab] || "";

  const handleBack = () => {
    navigate(-1);
  };

  // On root screens: show logo
  // On sub-routes: show back button + title
  if (isRoot) {
    return (
      <div className="md:hidden flex items-center justify-between px-4 h-12 border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-40" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <img src={nextTradeLogo} alt="NextTrade" className="h-8 w-auto" />
        <div className="w-8" /> {/* Spacer for balance */}
      </div>
    );
  }

  return (
    <div className="md:hidden flex items-center gap-3 px-4 h-12 border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-40" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <button
        type="button"
        onClick={handleBack}
        className="flex items-center justify-center w-9 h-9 -ml-2 rounded-full active:bg-accent transition-colors touch-manipulation"
        style={{ touchAction: "manipulation" }}
        aria-label={language === "ar" ? "رجوع" : "Back"}
      >
        <ArrowLeft className="h-5 w-5 text-foreground/70" />
      </button>
      <span className="font-semibold text-foreground truncate flex-1">
        {displayTitle}
      </span>
    </div>
  );
}

MobileHeader.propTypes = {
  language: PropTypes.string,
  title: PropTypes.string,
};