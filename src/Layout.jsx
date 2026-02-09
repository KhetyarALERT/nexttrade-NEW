import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Link, useLocation } from "react-router-dom";
import { MobileNavigationProvider, useMobileNavigation, isRootPath as checkIsRootPath } from "@/components/mobile/MobileNavigationContext";
import PageTransition from "@/components/mobile/PageTransition";
import { createPageUrl } from "@/utils";
import { Globe, Mail, Moon, Sun, Home, TrendingUp, Wallet as WalletIcon, User, Menu, MessageCircle, HelpCircle, Headphones, ChevronDown, CreditCard, Gift, LogOut, Settings, Shield, Users, Wallet, Activity, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tSection } from "@/components/i18n/translations";
import nextTradeLogo from "@/assets/nexttrade-logo.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { WalletProvider } from "@/components/wallet/UnifiedWalletProvider";
import { AssistantModal } from "@/components/assistant-ui/assistant-modal";
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';
import { useWalletConnect } from "@/lib/web3/WalletConnectProvider";
import { triggerHaptic } from "@/components/mobile/haptics";

const formatShortAddress = (address, start = 6, end = 4) => {
  if (!address) return "";
  const str = address.toString();
  return `${str.slice(0, start)}...${str.slice(-end)}`;
};

function LayoutInner({ children }) {
  const location = useLocation();
  const { user, isAuthenticated, isLoadingAuth, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [language, setLanguage] = useState("en");
  const [theme, setTheme] = useState("dark");
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);
  const [accountTotals, setAccountTotals] = useState({ totalUsd: null, totalUsdt: null });
  const [loadingAccountTotals, setLoadingAccountTotals] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const isDark = theme === "dark";
    document.documentElement.classList.toggle("dark", isDark);
  }, [theme]);

  const isRTL = language === "ar";
  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  
  const navigation = [
    { name: { en: "Dashboard", ar: "لوحة التحكم" }, url: createPageUrl("Dashboard") },
    { name: { en: "Futures", ar: "عقود" }, url: createPageUrl("Futures") },
    { name: { en: "Meme Coins", ar: "ميم كوينز" }, url: createPageUrl("MemeCoins") },
    { name: { en: "Investing", ar: "الاستثمار" }, url: createPageUrl("Investing") },
    { name: { en: "Rewards", ar: "مكافآت" }, url: createPageUrl("Rewards") },
    { name: { en: "Assets", ar: "المحفظة" }, url: createPageUrl("Wallet") },
    { name: { en: "Learn & Earn", ar: "تعلّم واربح" }, url: createPageUrl("LearnEarn") },
  ];

  const formatUsdt = (val) => {
    if (val === null || val === undefined) return "—";
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <WalletProvider>
    <NotificationProvider>
    <div className={`min-h-screen bg-background text-foreground ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <style>{`
        .glass-effect {
          background: hsl(var(--background) / 0.8);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid hsl(var(--border) / 0.4);
        }
        .nav-link {
          position: relative;
          transition: all 0.2s ease;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 50%;
          width: 0;
          height: 2px;
          background: hsl(var(--primary));
          transition: all 0.2s ease;
          transform: translateX(-50%);
          border-radius: 2px;
        }
        .nav-link:hover::after,
        .nav-link.active::after {
          width: 100%;
        }
      `}</style>

      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'glass-effect shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to={createPageUrl("Home")} className="flex items-center gap-2">
              <img src={nextTradeLogo} alt="NextTrade" className="h-8 w-auto" />
            </Link>

            <div className="hidden lg:flex items-center gap-6">
              {navigation.map((item) => (
                <Link
                  key={item.url}
                  to={item.url}
                  className={`nav-link text-sm font-bold uppercase tracking-widest transition-all ${
                    location.pathname === item.url ? 'text-primary active' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {item.name[language]}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {isAuthenticated && <NotificationBell language={language} />}
              
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-xl">
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-xl">
                    <Globe className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuItem onClick={() => setLanguage("en")}>English</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage("ar")}>العربية</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="rounded-xl px-4 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
                      <span className="max-w-[120px] truncate">{user?.full_name || "Account"}</span>
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2">
                    <div className="p-4 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Assets</p>
                      <p className="text-xl font-bold font-mono">{formatUsdt(accountTotals.totalUsdt)} <span className="text-xs">USDT</span></p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="rounded-lg">
                      <Link to={createPageUrl("Profile")} className="flex items-center gap-2 w-full">
                        <User className="h-4 w-4" /> Profile Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-lg">
                      <Link to={createPageUrl("Wallet")} className="flex items-center gap-2 w-full">
                        <Wallet className="h-4 w-4" /> My Wallet
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="rounded-lg text-rose-500 focus:text-rose-500">
                      <LogOut className="h-4 w-4 mr-2" /> Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button asChild className="rounded-xl px-6 font-bold">
                  <Link to={createPageUrl("Login")}>Login</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        <PageTransition location={location}>
          {children}
        </PageTransition>
      </main>

      <AssistantModal />
    </div>
    </NotificationProvider>
    </WalletProvider>
  );
}

export default function Layout(props) {
  return (
    <MobileNavigationProvider>
      <LayoutInner {...props} />
    </MobileNavigationProvider>
  );
}
