import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Link, useLocation } from "react-router-dom";
import { MobileNavigationProvider, useMobileNavigation, isRootPath as checkIsRootPath } from "@/components/mobile/MobileNavigationContext";
import PageTransition from "@/components/mobile/PageTransition";
import { createPageUrl } from "@/utils";
import { Globe, Mail, Moon, Sun, Home, TrendingUp, Wallet as WalletIcon, User, Menu, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tSection } from "@/components/i18n/translations";
// @ts-ignore - Vite resolves asset imports at runtime; checkJs may not have module typings for .png
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
import NotificationSettings from "@/components/notifications/NotificationSettings";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { ChevronDown, CreditCard, Gift, LogOut, Settings, Shield, Users, Wallet } from "lucide-react";
import { WalletProvider } from "@/components/wallet/UnifiedWalletProvider";
import { Web3ModalButton } from "@/components/wallet/Web3ModalButton";
import { AssistantModal } from "@/components/assistant-ui/assistant-modal";
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';
import { useAccount } from "wagmi";
import { useWalletConnect } from "@/lib/web3/WalletConnectProvider";
import { getStoredReferralCode } from "@/components/hooks/useReferralCapture";

const formatShortAddress = (address, start = 6, end = 4) => {
  if (!address) return "";
  const str = address.toString();
  return `${str.slice(0, start)}...${str.slice(-end)}`;
};

// Component to display connected wallet info in Accounts section
function EvmConnectedWalletAccountsItem({ language }) {
  const { address, isConnected, chain } = useAccount();
  const hasEvm = Boolean(isConnected && address);

  if (!hasEvm) return null;

  return (
    <DropdownMenuItem className="flex-col items-start gap-1 cursor-default focus:bg-accent/50">
      <div className="flex items-center gap-2 w-full">
        <WalletIcon className="h-4 w-4 text-primary" />
        <span className="font-medium">{language === "ar" ? "محفظة EVM متصلة" : "Connected EVM Wallet"}</span>
      </div>
      <div className="flex flex-col gap-1 w-full pl-6 text-xs">
        <div className="flex items-center justify-between w-full">
          <span className="text-muted-foreground">{chain?.name || "EVM"}:</span>
          <span className="font-mono">{formatShortAddress(address)}</span>
        </div>
      </div>
    </DropdownMenuItem>
  );
}

function SolanaConnectedWalletAccountsItem({ language }) {
  const solWallet = useSolanaWallet();
  const hasSolana = Boolean(solWallet?.connected && solWallet?.publicKey);

  if (!hasSolana) return null;

  return (
    <DropdownMenuItem className="flex-col items-start gap-1 cursor-default focus:bg-accent/50">
      <div className="flex items-center gap-2 w-full">
        <WalletIcon className="h-4 w-4 text-primary" />
        <span className="font-medium">{language === "ar" ? "محفظة سولانا متصلة" : "Connected Solana Wallet"}</span>
      </div>
      <div className="flex flex-col gap-1 w-full pl-6 text-xs">
        <div className="flex items-center justify-between w-full">
          <span className="text-muted-foreground">Solana:</span>
          <span className="font-mono">{formatShortAddress(solWallet.publicKey, 4, 4)}</span>
        </div>
      </div>
    </DropdownMenuItem>
  );
}

function ConnectedWalletAccountsItem({ language }) {
  const { enabled: wagmiEnabled } = useWalletConnect();
  const solWallet = useSolanaWallet();
  const hasSolana = Boolean(solWallet?.connected && solWallet?.publicKey);

  if (!wagmiEnabled && !hasSolana) return null;

  return (
    <>
      {wagmiEnabled ? <EvmConnectedWalletAccountsItem language={language} /> : null}
      {hasSolana ? <SolanaConnectedWalletAccountsItem language={language} /> : null}
    </>
  );
}

ConnectedWalletAccountsItem.propTypes = {
  language: PropTypes.string.isRequired
};

export default function Layout({ children, currentPageName: _currentPageName }) {
  const location = useLocation();
  const { user, isAuthenticated, isLoadingAuth, navigateToLogin, logout } = useAuth();
  const solWallet = useSolanaWallet();

  const STORAGE_KEYS = {
    language: "app_language",
    theme: "app_theme",
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [language, setLanguage] = useState("en");
  const [theme, setTheme] = useState("dark");
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);
  const [accountTotals, setAccountTotals] = useState({ totalUsd: 0, totalUsdt: 0 });
  const [accountBalances, setAccountBalances] = useState({ fundingUsdt: 0, spotUsdt: null, futuresUsdt: null, wealthUsdt: 0, stakedActiveUsdt: 0, stakedPendingUsdt: 0, nextUnlockAt: null, copyTradingAvailableUsdt: 0, copyTradingLockedUsdt: 0 });
  const [loadingAccountTotals, setLoadingAccountTotals] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedLang = localStorage.getItem(STORAGE_KEYS.language);
      if (storedLang === "en" || storedLang === "ar") setLanguage(storedLang);

      const storedTheme = localStorage.getItem(STORAGE_KEYS.theme);
      if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
      else setTheme("dark");
    } catch {
      // ignore storage access issues
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const isDark = theme === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    try {
      localStorage.setItem(STORAGE_KEYS.theme, isDark ? "dark" : "light");
    } catch {
      // ignore storage access issues
    }
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const isRtl = language === "ar";

    // Set lang and dir on <html> element to prevent Chrome auto-translate
    document.documentElement.lang = language;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";

    // Ensure notranslate class on body
    document.body.classList.add("notranslate");
    document.body.setAttribute("translate", "no");

    // Add notranslate meta if not present
    if (!document.querySelector('meta[name="google"][content="notranslate"]')) {
      const meta = document.createElement("meta");
      meta.name = "google";
      meta.content = "notranslate";
      document.head.appendChild(meta);
    }

    try {
      localStorage.setItem(STORAGE_KEYS.language, language);

      // Sync language to backend UserPreferences if authenticated
      // Optimization: Debounce or check before call to avoid excessive writes
      if (isAuthenticated && user?.id) {
        (async () => {
          try {
            const prefs = await base44.entities.UserPreferences.filter({ user_id: user.id });
            if (prefs && prefs.length > 0) {
              // Only update if actually different to save DB writes
              if (prefs[0].language !== language) {
                await base44.entities.UserPreferences.update(prefs[0].id, { language });
              }
            } else {
              // Create only if missing
              await base44.entities.UserPreferences.create({
                user_id: user.id,
                language,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
              });
            }
          } catch (e) {
            console.warn("Failed to sync language preference", e);
          }
        })();
      }
    } catch {
      // ignore storage access issues
    }
  }, [language, isAuthenticated, user?.id]);



  const isRTL = language === "ar";
  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  const futuresPath = String(createPageUrl("Futures")).split("?")[0];
  const tradingPath = String(createPageUrl("Trading")).split("?")[0];
  const isTradingPage = location.pathname === futuresPath || location.pathname === tradingPath;
  const memeCoinsPath = String(createPageUrl('MemeCoins')).split('?')[0];
  const isMemeCoinsPage = location.pathname === memeCoinsPath;
  const isAdminHub = location.pathname.includes("OKXAdminHub") || location.pathname.includes("admin");

  const SolanaNavWalletButton = () => {
    return <UnifiedWalletButton />;
  };

  const accountLabel = (() => {
    if (isLoadingAuth) return language === "en" ? "Account" : "الحساب";
    if (!isAuthenticated) return language === "en" ? "Login" : "تسجيل الدخول";
    const name = user?.name || user?.full_name || user?.display_name;
    return (name && String(name).trim()) || user?.email || (language === "en" ? "My Account" : "حسابي");
  })();

  const navigation = [
    { type: "link", name: { en: "Dashboard", ar: "لوحة التحكم" }, url: createPageUrl("Dashboard") },
    { type: "link", name: { en: "Futures", ar: "عقود" }, url: createPageUrl("Futures") },
    { type: "link", name: { en: "Meme Coins", ar: "ميم كوينز" }, url: createPageUrl("MemeCoins") },
    { type: "link", name: { en: "Investing", ar: "الاستثمار" }, url: createPageUrl("Investing") },
    { type: "link", name: { en: "Rewards", ar: "مكافآت" }, url: createPageUrl("Rewards") },
    {
      type: "dropdown",
      name: { en: "Assets", ar: "المحفظة" },
      items: [
        { name: { en: "My Assets", ar: "الأصول" }, url: createPageUrl("Wallet") },
        { name: { en: "Deposit", ar: "إيداع" }, url: `${createPageUrl("Wallet")}?page=deposit` },
        { name: { en: "History", ar: "السجل" }, url: `${createPageUrl("Wallet")}?page=history` },
      ],
    },
    { type: "link", name: { en: "Learn & Earn", ar: "تعلّم واربح" }, url: createPageUrl("LearnEarn") },
  ];

  const footerQuickLinks = [
        { name: { en: "Dashboard", ar: "لوحة التحكم" }, url: createPageUrl("Dashboard") },
        { name: { en: "Futures", ar: "عقود" }, url: createPageUrl("Futures") },
        { name: { en: "Wallet", ar: "المحفظة" }, url: createPageUrl("Wallet") },
        { name: { en: "Investing", ar: "الاستثمار" }, url: createPageUrl("Investing") },
        { name: { en: "Rewards", ar: "مكافآت" }, url: createPageUrl("Rewards") },
        { name: { en: "About Us", ar: "من نحن" }, url: createPageUrl("About") },
        { name: { en: "Open Account", ar: "فتح حساب" }, url: createPageUrl("Contact") },
      ];

  const accountEmail = user?.email;
  const accountMenuLabel = accountLabel;

  const loadAccountTotals = async () => {
    if (!isAuthenticated) return;
    setLoadingAccountTotals(true);
    try {
      const [walletsResult, okxAccountResult, stakingResult, copyTradingResult] = await Promise.all([
        base44.functions.invoke("wallet", { action: "list" }),
        base44.functions.invoke("okxUserAccount", { action: "getMyAccount" }),
        base44.functions.invoke("stakingUser", { action: "getWalletOverlay" }),
        base44.functions.invoke("copyTradingUser", { action: "getWallet" }).catch(() => ({ data: { ok: false } })),
      ]);

      const wallets = walletsResult.data?.success ? (walletsResult.data.data || []) : [];
      const okxData = okxAccountResult.data?.ok ? okxAccountResult.data.data : null;
      const stakingData = stakingResult.data?.ok ? stakingResult.data.data : null;
      const copyTradingData = copyTradingResult.data?.ok ? copyTradingResult.data.data : null;

      // Wallets: Fund Account balance (internal platform wallets)
      const internalFundingUsdt = wallets.reduce((sum, w) => {
        if (w?.currency === "USDT" || w?.currency === "USDC") return sum + (w.balance || 0);
        return sum;
      }, 0);

      // Wallets: Wealth/Staked balance
      const wealthUsdt = wallets.reduce((sum, w) => {
        if (w?.currency === "USDT" || w?.currency === "USDC") return sum + (w.staked_balance || 0);
        return sum;
      }, 0);

      // OKX Balances - REAL synced data from OKX subaccount
      const okxFundingUsdt = okxData?.hasAccount ? (okxData.balances?.fundingUsdt || 0) : 0;
      const okxTradingUsdt = okxData?.hasAccount ? (okxData.balances?.tradingUsdt || 0) : 0;

      // Staking: ACTIVE funds are OUT of OKX (in main pool), PENDING are still in OKX funding
      const stakedActiveUsdt = stakingData?.activeLockedByCcy?.USDT || 0;
      const stakedPendingUsdt = stakingData?.pendingLockedByCcy?.USDT || 0;
      const nextUnlockAt = stakingData?.nextUnlockAt || null;

      // Copy Trading: Available balance (internal wallet), Locked (in signals)
      // Note: Copy Trading balance is INTERNAL (demo USDT), not in OKX
      const copyTradingAvailableUsdt = copyTradingData?.available_balance || 0;
      const copyTradingLockedUsdt = copyTradingData?.locked_balance || 0;

      // Combined totals
      // Main Wallet (Funding + Trading) - strictly liquid/trading assets
      const mainWalletTotal = internalFundingUsdt + okxFundingUsdt + okxTradingUsdt;
      
      // Total including staking & copy trading
      const totalUsdt = mainWalletTotal + wealthUsdt + stakedActiveUsdt + copyTradingAvailableUsdt + copyTradingLockedUsdt;
      const totalUsd = totalUsdt; // 1:1 for USDT

      setAccountTotals({ totalUsd, totalUsdt, mainWalletTotal });
      setAccountBalances({
        // Fund Account = internal platform funding + OKX funding account
        fundingUsdt: internalFundingUsdt + okxFundingUsdt,
        spotUsdt: null, // No spot trading yet
        // Futures = OKX trading account (where margin trading happens)
        futuresUsdt: okxData?.hasAccount ? okxTradingUsdt : null,
        wealthUsdt,
        stakedActiveUsdt,
        stakedPendingUsdt,
        nextUnlockAt,
        copyTradingAvailableUsdt,
        copyTradingLockedUsdt,
        hasCopyTrading: copyTradingData !== null && (copyTradingAvailableUsdt > 0 || copyTradingLockedUsdt > 0 || (copyTradingData?.lifetime_deposited || 0) > 0),
      });
    } catch (err) {
      console.error("Failed to load wallet totals:", err);
      setAccountTotals({ totalUsd: 0, totalUsdt: 0 });
      setAccountBalances({ fundingUsdt: 0, spotUsdt: null, futuresUsdt: null, wealthUsdt: 0, stakedActiveUsdt: 0, stakedPendingUsdt: 0, nextUnlockAt: null, copyTradingAvailableUsdt: 0, copyTradingLockedUsdt: 0, hasCopyTrading: false });
    } finally {
      setLoadingAccountTotals(false);
    }
  };

  const formatUsdt = (val) => {
    if (val === null || val === undefined) return "—";
    if (!Number.isFinite(val)) return "—";
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  useEffect(() => {
    if (!isAuthenticated || isLoadingAuth) return;
    loadAccountTotals();
    // Track login event when user becomes authenticated with user info
    base44.auth.me().then(currentUser => {
      base44.analytics.track({
        eventName: "user_login",
        properties: { method: "session", user_id: currentUser?.id, user_email: currentUser?.email }
      });
    }).catch(() => {
      base44.analytics.track({
        eventName: "user_login",
        properties: { method: "session" }
      });
    });
  }, [isAuthenticated, isLoadingAuth]);


  return (
    <WalletProvider>
    <NotificationProvider>
    <div className={`min-h-screen overflow-x-hidden bg-background text-foreground ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <style>{`
        :root {
          --gradient-primary: linear-gradient(135deg, hsl(160 100% 38%) 0%, hsl(160 100% 28%) 100%);
          --gradient-gold: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        
        .glass-effect {
          background: hsl(var(--background) / 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid hsl(var(--border) / 0.5);
        }

        .nav-link {
          position: relative;
          transition: all 0.2s ease;
        }

        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0;
          height: 2px;
          background: hsl(160 100% 38%);
          transition: width 0.2s ease;
          border-radius: 1px;
        }

        .nav-link:hover::after,
        .nav-link.active::after {
          width: 100%;
        }

        .glow-button {
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, hsl(160 100% 38%) 0%, hsl(160 100% 28%) 100%);
          box-shadow: 0 4px 20px hsl(160 100% 38% / 0.3);
          transition: all 0.2s ease;
        }

        .glow-button:hover {
          box-shadow: 0 6px 30px hsl(160 100% 38% / 0.4);
          transform: translateY(-1px);
        }
      `}</style>

      {/* Navigation - Hidden on trading and admin pages */}
      {!isTradingPage && !isAdminHub && (
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass-effect shadow-lg' : 'bg-transparent'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to={createPageUrl("Home")} className="flex items-center">
              <img
                src={nextTradeLogo}
                alt="NextTrade"
                className="h-10 w-auto" />

            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {navigation.map((item) => {
                if (item.type === "dropdown") {
                  return (
                    <DropdownMenu key={item.name.en}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="nav-link text-sm font-medium transition-all transform text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        >
                          {item.name[language]}
                          <ChevronDown className="w-4 h-4 opacity-80" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        {item.items.map((sub) => (
                          <DropdownMenuItem
                            key={sub.name.en}
                            asChild={Boolean(sub.url)}
                            disabled={!sub.url}
                          >
                            {sub.url ? (
                              <Link to={sub.url}>{sub.name[language]}</Link>
                            ) : (
                              <span>{sub.name[language]}</span>
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                }

                const activePath = String(item.url).split("?")[0];
                const isActive = location.pathname === activePath;

                return (
                  <Link
                    key={item.url}
                    to={item.url}
                    className={`nav-link text-sm font-medium transition-all transform ${
                      isActive
                        ? 'text-primary active'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {item.name[language]}
                  </Link>
                );
              })}
            </div>

            {/* Actions */}
            <div className="hidden md:flex items-center gap-3">
              {isAuthenticated && <NotificationBell onSettingsClick={() => setNotificationSettingsOpen(true)} language={language} />}

              {isMemeCoinsPage && <SolanaNavWalletButton />}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={toggleTheme}
                aria-label={language === "ar" ? "تبديل المظهر" : "Toggle theme"}
              >
                {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Globe className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLanguage("en")}>
                    English
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage("ar")}>
                    العربية
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="glow-button text-white border-0 rounded-xl px-4">
                      <span className="max-w-[160px] truncate">{accountMenuLabel}</span>
                      <ChevronDown className="w-4 h-4 ml-2 opacity-90" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <div className="p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs text-muted-foreground">{language === "ar" ? "إجمالي الأصول" : "Total Assets"}</div>
                          <div className="text-2xl font-semibold text-foreground">
                            {accountTotals.totalUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="text-xs font-medium text-muted-foreground ml-1">USDT</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ≈ ${accountTotals.totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={loadAccountTotals}
                          className="text-xs text-muted-foreground hover:text-foreground"
                          disabled={loadingAccountTotals}
                        >
                          {loadingAccountTotals ? (language === "ar" ? "..." : "…") : (language === "ar" ? "تحديث" : "Refresh")}
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button asChild variant="outline" className="w-full">
                                          <Link to={createPageUrl("Wallet")}>
                                            {language === "ar" ? "سحب" : "Withdraw"}
                                          </Link>
                                        </Button>
                                        <Button asChild className="w-full bg-primary hover:bg-primary/90">
                                          <Link to={`${createPageUrl("Wallet")}?page=deposit`}>
                                            {language === "ar" ? "إيداع" : "Deposit"}
                                          </Link>
                                        </Button>
                      </div>
                    </div>

                    <div className="px-2 py-1.5 space-y-1">
                      <div className="text-sm font-semibold text-foreground truncate">{accountMenuLabel}</div>
                      {accountEmail ? (
                        <div className="text-xs font-normal text-muted-foreground truncate">{accountEmail}</div>
                      ) : null}
                      <div className="mt-2">
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {language === "ar" ? "مستخدم" : "Regular user"}
                        </span>
                      </div>
                    </div>
                    <DropdownMenuSeparator />

                    <div className="px-2 py-1.5 text-xs text-muted-foreground">{language === "ar" ? "الحسابات" : "Accounts"}</div>
                    <ConnectedWalletAccountsItem language={language} />
                    <DropdownMenuItem asChild>
                                    <Link to={createPageUrl("Wallet")}>
                                      <div className="flex w-full items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                          <Wallet className="h-4 w-4" />
                                          <span>{language === "ar" ? "المحفظة" : "Wallet"}</span>
                                        </div>
                                        <span className="text-xs font-medium text-muted-foreground">{formatUsdt(accountTotals.mainWalletTotal)} USDT</span>
                                      </div>
                                    </Link>
                                  </DropdownMenuItem>

                      {/* Copy Trading - always show when wallet exists */}
                      {(accountBalances.hasCopyTrading || accountBalances.copyTradingAvailableUsdt > 0) && (
                        <DropdownMenuItem asChild>
                          <Link to={createPageUrl("Futures") + "?tab=bots"}>
                            <div className="flex w-full items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-blue-600" />
                                <span>{language === "ar" ? "نسخ التداول" : "Copy Trading"}</span>
                              </div>
                              <span className="text-xs font-medium text-blue-600">{formatUsdt(accountBalances.copyTradingAvailableUsdt + accountBalances.copyTradingLockedUsdt)} USDT</span>
                            </div>
                          </Link>
                        </DropdownMenuItem>
                      )}

                      {/* Staking (Locked) - show if any staking exists */}
                      {(accountBalances.stakedActiveUsdt > 0 || accountBalances.stakedPendingUsdt > 0) && (
                        <DropdownMenuItem asChild>
                          <Link to={createPageUrl("Investing")}>
                            <div className="flex w-full items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-amber-600" />
                                <span>{language === "ar" ? "مستثمر (مقفل)" : "Staked (Locked)"}</span>
                              </div>
                              <span className="text-xs font-medium text-amber-600">{formatUsdt(accountBalances.stakedActiveUsdt)} USDT</span>
                            </div>
                          </Link>
                        </DropdownMenuItem>
                      )}

                      {/* Show Total incl staking if active staking exists */}
                      {accountBalances.stakedActiveUsdt > 0 && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center justify-between">
                          <span>{language === "ar" ? "الإجمالي (شامل الستيكنج)" : "Total (incl. staking)"}</span>
                          <span className="font-medium text-foreground">{formatUsdt(accountTotals.totalUsdt)} USDT</span>
                        </div>
                      )}

                      {/* Next unlock date */}
                      {accountBalances.nextUnlockAt && (
                        <div className="px-2 py-1 text-[10px] text-muted-foreground">
                          {language === "ar" ? "يفتح في" : "Unlocks"}: {new Date(accountBalances.nextUnlockAt).toLocaleDateString()}
                        </div>
                      )}

                      <DropdownMenuSeparator />

                    <div className="px-2 py-1.5 text-xs text-muted-foreground">{language === "ar" ? "الحساب" : "Account"}</div>
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl("Profile") + "?tab=personal"}>
                        <User className="h-4 w-4" />
                        {language === "ar" ? "المعلومات الشخصية" : "Personal Info"}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl("Profile") + "?tab=security"}>
                        <Shield className="h-4 w-4" />
                        {language === "ar" ? "مركز الأمان" : "Security Center"}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl("Profile") + "?tab=notifications"}>
                        <Settings className="h-4 w-4" />
                        {language === "ar" ? "التفضيلات" : "Preferences"}
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">{language === "ar" ? "المكافآت" : "Rewards"}</div>
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl("Rewards")}>
                        <Gift className="h-4 w-4" />
                        {language === "ar" ? "مركز المكافآت" : "Rewards Hub"}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl("Rewards") + "?tab=referrals"}>
                        <Users className="h-4 w-4" />
                        {language === "ar" ? "دعوة واربح" : "Invite & Earn"}
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={async (e) => {
                        e.preventDefault();
                        // Track logout event with user info
                        try {
                          const currentUser = await base44.auth.me();
                          base44.analytics.track({
                            eventName: "user_logout",
                            properties: { method: "manual", user_id: currentUser?.id, user_email: currentUser?.email }
                          });
                        } catch {
                          base44.analytics.track({
                            eventName: "user_logout",
                            properties: { method: "manual" }
                          });
                        }
                        logout(true);
                      }}
                      className="text-rose-600 focus:text-rose-700"
                    >
                      <LogOut className="h-4 w-4" />
                      {language === "ar" ? "تسجيل الخروج" : "Log Out"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  className="glow-button text-white border-0 rounded-xl px-6"
                  type="button"
                  onClick={() => {
                    // Preserve ref code in URL when redirecting to login
                    const refCode = getStoredReferralCode();
                    const currentUrl = new URL(window.location.href);
                    if (refCode && !currentUrl.searchParams.has('ref')) {
                      currentUrl.searchParams.set('ref', refCode);
                    }
                    navigateToLogin(currentUrl.toString());
                  }}
                >
                  {accountLabel}
                </Button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-label={language === "ar" ? "فتح القائمة" : "Open menu"}
              >
                <Menu className="w-5 h-5" />
              </Button>
              {isAuthenticated && <NotificationBell onSettingsClick={() => setNotificationSettingsOpen(true)} language={language} />}

              {isMemeCoinsPage && <SolanaNavWalletButton />}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={toggleTheme}
                aria-label={language === "ar" ? "تبديل المظهر" : "Toggle theme"}
              >
                {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>

              {/* Language Switcher for Mobile */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Globe className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLanguage("en")}>
                    English
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage("ar")}>
                    العربية
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden glass-effect border-t border-border">
            <div className="px-4 py-6 space-y-4">
              {navigation.map((item) => {
                if (item.type === "dropdown") {
                  return (
                    <div key={item.name.en} className="space-y-2">
                      <div className="text-foreground font-medium">{item.name[language]}</div>
                      <div className="pl-3 space-y-2">
                        {item.items.map((sub) => (
                          sub.url ? (
                            <Link
                              key={sub.name.en}
                              to={sub.url}
                              className="block text-muted-foreground hover:text-foreground text-sm"
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              {sub.name[language]}
                            </Link>
                          ) : (
                            <div key={sub.name.en} className="block text-muted-foreground/70 text-sm">
                              {sub.name[language]}
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <Link
                    key={item.url}
                    to={item.url}
                    className="block text-foreground hover:text-blue-600 font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.name[language]}
                  </Link>
                );
              })}
              <Button
                className="w-full glow-button text-white"
                asChild
              >
                {isAuthenticated ? (
                  <Link to={createPageUrl("Profile") + "?tab=personal"} onClick={() => setMobileMenuOpen(false)}>
                    {accountLabel}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      // Preserve ref code in URL when redirecting to login
                      const refCode = getStoredReferralCode();
                      const currentUrl = new URL(window.location.href);
                      if (refCode && !currentUrl.searchParams.has('ref')) {
                        currentUrl.searchParams.set('ref', refCode);
                      }
                      navigateToLogin(currentUrl.toString());
                    }}
                  >
                    {accountLabel}
                  </button>
                )}
              </Button>
            </div>
          </div>
        )}
      </nav>
      )}

      {/* Main Content */}
      <main className={`${isTradingPage ? 'pt-0' : 'pt-16'} md:pb-0 pb-20`}>
        {React.cloneElement(children, { language })}
      </main>

      {/* Footer - Only on Home Page */}
      {!isTradingPage && !isMemeCoinsPage && !isAdminHub && (location.pathname === createPageUrl("Home") || location.pathname === "/") && (
      <footer className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={nextTradeLogo}
                  alt="NextTrade"
                  className="h-10 w-auto" />

              </div>
              <p className="text-gray-400 text-sm">
                {language === "en" ?
                "Your trusted partner in intelligent crypto trading." :
                "شريكك الموثوق في تداول العملات الرقمية الذكي"}
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">{language === "en" ? "Quick Links" : "روابط سريعة"}</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                {footerQuickLinks.map((item) => (
                  <li key={item.url}>
                    <Link to={item.url} className="hover:text-white transition-all transform">
                      {item.name[language]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">{language === "en" ? "Trading" : "التداول"}</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>{language === "en" ? "Bitcoin (BTC)" : "بيتكوين (BTC)"}</li>
                <li>{language === "en" ? "Ethereum (ETH)" : "إيثيريوم (ETH)"}</li>
                <li>{language === "en" ? "Solana (SOL)" : "سولانا (SOL)"}</li>
                <li>{language === "en" ? "Altcoins" : "العملات البديلة"}</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">{language === "en" ? "Contact" : "اتصل بنا"}</h3>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>info@nexttrade.exchange</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-8 text-center text-sm text-gray-400">
            <p>
              {language === "en" ?
              "© 2025 NextTrade. All rights reserved." :
              "© 2025 NextTrade. جميع الحقوق محفوظة"}
            </p>
            <p className="mt-2 text-xs">
              <a
                className="hover:text-white transition-all transform"
                href="https://www.tradingview.com/"
                target="_blank"
                rel="noreferrer"
              >
                {language === "en"
                  ? "Charts powered by TradingView Lightweight Charts™"
                  : "الرسوم البيانية مدعومة من TradingView Lightweight Charts™"}
              </a>
            </p>
            <p className="mt-2 text-xs">
              {language === "en" ?
              "Crypto trading involves risk. Please trade responsibly." :
              "تداول العملات الرقمية ينطوي على مخاطر. يرجى التداول بمسؤولية"}
            </p>
          </div>
        </div>
      </footer>
      )}
      
      {/* Mobile Bottom Navigation - 5 items only: Overview, Trade, Wallet, Support, Account */}
      {!isMemeCoinsPage && !isTradingPage && !isAdminHub && (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] glass-effect border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-14 px-1">
          {(() => {
            const navT = tSection("nav", language);
            return (
              <>
                <Link
                  to={createPageUrl("Dashboard")}
                  className={`flex flex-col items-center justify-center flex-1 gap-0.5 py-1.5 rounded-lg transition-all ${
                    location.pathname === createPageUrl("Dashboard") || location.pathname === '/' || location.pathname === createPageUrl("Home")
                      ? 'text-primary bg-primary/15'
                      : 'text-muted-foreground'
                  }`}
                >
                  <Home className="w-4 h-4" />
                  <span className="text-[9px] font-medium">{navT.overview}</span>
                </Link>

                <Link
                  to={createPageUrl("Futures")}
                  className={`flex flex-col items-center justify-center flex-1 gap-0.5 py-1.5 rounded-lg transition-all ${
                    location.pathname === createPageUrl("Futures")
                      ? 'text-primary bg-primary/15'
                      : 'text-muted-foreground'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-[9px] font-medium">{navT.trade}</span>
                </Link>

                <Link
                  to={createPageUrl("Wallet")}
                  className={`flex flex-col items-center justify-center flex-1 gap-0.5 py-1.5 rounded-lg transition-all ${
                    location.pathname.includes("Wallet")
                      ? 'text-primary bg-primary/15'
                      : 'text-muted-foreground'
                  }`}
                >
                  <WalletIcon className="w-4 h-4" />
                  <span className="text-[9px] font-medium">{navT.wallet}</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    // Toggle existing support chat widget
                    const trigger = document.querySelector('[data-support-trigger]');
                    if (trigger) trigger.click();
                  }}
                  className="flex flex-col items-center justify-center flex-1 gap-0.5 py-1.5 rounded-lg transition-all text-muted-foreground active:text-primary active:bg-primary/15"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-[9px] font-medium">{navT.support}</span>
                </button>

                <Link
                  to={isAuthenticated ? createPageUrl("Profile") : '#'}
                  onClick={isAuthenticated ? undefined : (e) => { 
                    e.preventDefault(); 
                    const refCode = getStoredReferralCode();
                    const currentUrl = new URL(window.location.href);
                    if (refCode && !currentUrl.searchParams.has('ref')) {
                      currentUrl.searchParams.set('ref', refCode);
                    }
                    navigateToLogin(currentUrl.toString()); 
                  }}
                  className={`flex flex-col items-center justify-center flex-1 gap-0.5 py-1.5 rounded-lg transition-all ${
                    location.pathname.includes("Profile")
                      ? 'text-primary bg-primary/15'
                      : 'text-muted-foreground'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span className="text-[9px] font-medium">{navT.account}</span>
                </Link>
              </>
            );
          })()}
        </div>
      </nav>
      )}
      
      <NotificationSettings 
        open={notificationSettingsOpen} 
        onOpenChange={setNotificationSettingsOpen} 
        language={language}
      />
      {!isAdminHub && <AssistantModal language={language} />}
    </div>
    </NotificationProvider>
    </WalletProvider>);

}

Layout.propTypes = {
  children: PropTypes.node.isRequired,
  currentPageName: PropTypes.string,
};