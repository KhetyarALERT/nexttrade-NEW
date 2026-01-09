import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Globe, Phone, Mail, Moon, Sun, Home, TrendingUp, Wallet as WalletIcon, User, Grid, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { WalletProvider, useWallet } from "@/lib/web3/WalletContext";
import { Web3ModalButton } from "@/components/wallet/Web3ModalButton";

// Component to display Web3 wallet info in dropdown
function Web3WalletDropdownItem({ language }) {
  const { account, balance, networkName, isConnected, formatAddress, formatBalance } = useWallet();
  
  if (!isConnected) return null;
  
  return (
    <DropdownMenuItem className="flex-col items-start gap-1 cursor-default focus:bg-accent/50">
      <div className="flex items-center gap-2 w-full">
        <WalletIcon className="h-4 w-4 text-primary" />
        <span className="font-medium">{language === "ar" ? "محفظة Web3" : "Web3 Wallet"}</span>
      </div>
      <div className="flex flex-col gap-0.5 w-full pl-6 text-xs">
        <div className="flex items-center justify-between w-full">
          <span className="text-muted-foreground">{language === "ar" ? "العنوان" : "Address"}:</span>
          <span className="font-mono">{formatAddress(account)}</span>
        </div>
        <div className="flex items-center justify-between w-full">
          <span className="text-muted-foreground">{language === "ar" ? "الشبكة" : "Network"}:</span>
          <span>{networkName || "—"}</span>
        </div>
        <div className="flex items-center justify-between w-full">
          <span className="text-muted-foreground">{language === "ar" ? "الرصيد" : "Balance"}:</span>
          <span className="font-semibold text-primary">{formatBalance(balance)} {networkName === 'Ethereum' ? 'ETH' : networkName === 'Solana' ? 'SOL' : networkName === 'Tron' ? 'TRX' : ''}</span>
        </div>
      </div>
    </DropdownMenuItem>
  );
}

Web3WalletDropdownItem.propTypes = {
  language: PropTypes.string.isRequired
};

export default function Layout({ children, currentPageName: _currentPageName }) {
  const location = useLocation();
  const { user, isAuthenticated, isLoadingAuth, navigateToLogin, logout } = useAuth();

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
  const [accountBalances, setAccountBalances] = useState({ fundingUsdt: 0, spotUsdt: null, futuresUsdt: null, wealthUsdt: 0 });
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
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    try {
      localStorage.setItem(STORAGE_KEYS.language, language);
    } catch {
      // ignore storage access issues
    }
  }, [language]);



  const isRTL = language === "ar";
  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  const futuresPath = String(createPageUrl("Futures")).split("?")[0];
  const tradingPath = String(createPageUrl("Trading")).split("?")[0];
  const isTradingPage = location.pathname === futuresPath || location.pathname === tradingPath;

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
        { name: { en: "Buy with Card", ar: "شراء بالبطاقة" }, url: createPageUrl("BuyWithCard") },
        { name: { en: "On-chain Deposit", ar: "إيداع على السلسلة" }, url: createPageUrl("OnChainDeposit") },
        { name: { en: "My Assets", ar: "الأصول" }, url: `${createPageUrl("Profile")}?tab=assets&assetTab=main` },
        { name: { en: "P2P (Coming soon)", ar: "P2P (قريباً)" }, url: null },
      ],
    },
    { type: "link", name: { en: "Learn & Earn", ar: "تعلّم واربح" }, url: createPageUrl("LearnEarn") },
  ];

  const footerQuickLinks = [
    { name: { en: "Dashboard", ar: "لوحة التحكم" }, url: createPageUrl("Dashboard") },
    { name: { en: "Futures", ar: "عقود" }, url: createPageUrl("Futures") },
    { name: { en: "Investing", ar: "الاستثمار" }, url: createPageUrl("Investing") },
    { name: { en: "Rewards", ar: "مكافآت" }, url: createPageUrl("Rewards") },
    { name: { en: "Learn & Earn", ar: "تعلّم واربح" }, url: createPageUrl("LearnEarn") },
    { name: { en: "About Us", ar: "من نحن" }, url: createPageUrl("About") },
    { name: { en: "Open Account", ar: "فتح حساب" }, url: createPageUrl("Contact") },
  ];

  const accountEmail = user?.email;
  const accountMenuLabel = accountLabel;

  const loadAccountTotals = async () => {
    if (!isAuthenticated) return;
    setLoadingAccountTotals(true);
    try {
      const [walletsResult, futuresAccountResult] = await Promise.all([
        base44.functions.invoke("wallet", { action: "list" }),
        base44.functions.invoke("tradingAccount", { action: "getOrCreate", accountType: "live" }),
      ]);

      const wallets = walletsResult.data?.success ? (walletsResult.data.data || []) : [];
      const futuresAccount = futuresAccountResult.data?.success ? futuresAccountResult.data.data : null;

      const totalUsdt = wallets.reduce((sum, w) => {
        if (w?.currency === "USDT" || w?.currency === "USDC") return sum + (w.balance || 0);
        return sum;
      }, 0);

      const wealthUsdt = wallets.reduce((sum, w) => {
        if (w?.currency === "USDT" || w?.currency === "USDC") return sum + (w.staked_balance || 0);
        return sum;
      }, 0);

      const futuresUsdt = (futuresAccount?.equity ?? futuresAccount?.balance ?? futuresAccount?.demo_balance);

      const totalUsd = wallets.reduce((sum, w) => {
        if (w?.currency === "USDT" || w?.currency === "USDC") return sum + (w.balance || 0);
        if (w?.currency === "BTC") return sum + (w.balance || 0) * 95000;
        if (w?.currency === "ETH") return sum + (w.balance || 0) * 3400;
        return sum + (w.balance || 0);
      }, 0);

      setAccountTotals({ totalUsd, totalUsdt });
      setAccountBalances({
        fundingUsdt: totalUsdt,
        spotUsdt: null,
        futuresUsdt: typeof futuresUsdt === "number" ? futuresUsdt : null,
        wealthUsdt,
      });
    } catch (err) {
      console.error("Failed to load wallet totals:", err);
      setAccountTotals({ totalUsd: 0, totalUsdt: 0 });
      setAccountBalances({ fundingUsdt: 0, spotUsdt: null, futuresUsdt: null, wealthUsdt: 0 });
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
  }, [isAuthenticated, isLoadingAuth]);


  return (
    <WalletProvider>
    <NotificationProvider>
    <div className={`min-h-screen overflow-x-hidden bg-background text-foreground ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <style>{`
        :root {
          --primary-600: #2563eb;
          --primary-700: #1d4ed8;
          --accent-500: #06b6d4;
          --accent-600: #0891b2;
          --success-500: #10B981;
          --gradient-primary: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
          --gradient-gold: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        
        .glass-effect {
          background: hsl(var(--background) / 0.75);
          backdrop-filter: blur(12px);
          border: 1px solid hsl(var(--border) / 0.6);
        }

        .nav-link {
          position: relative;
          transition: all 0.3s ease;
        }

        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0;
          height: 2px;
          background: var(--gradient-primary);
          transition: width 0.3s ease;
        }

        .nav-link:hover::after,
        .nav-link.active::after {
          width: 100%;
        }

        .glow-button {
          position: relative;
          overflow: hidden;
          box-shadow: 0 0 20px rgba(37, 99, 235, 0.3);
          transition: all 0.3s ease;
        }

        .glow-button:hover {
          box-shadow: 0 0 30px rgba(37, 99, 235, 0.5);
          transform: translateY(-2px);
        }
      `}</style>

      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass-effect shadow-lg' : 'bg-transparent'}`
        }>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <Link to={createPageUrl("Home")} className="flex items-center">
              <img
                src={nextTradeLogo}
                alt="NextTrade"
                className="h-12 w-auto" />

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
                        ? 'text-blue-600 active'
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
              <NotificationBell onSettingsClick={() => setNotificationSettingsOpen(true)} />

              <Web3ModalButton language={language} />

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
                    <Button className="glow-button bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-0 rounded-xl px-4 hover:from-blue-700 hover:to-cyan-700">
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
                          <Link to={createPageUrl("Profile") + "?tab=assets&assetTab=main&modal=withdraw"}>
                            {language === "ar" ? "سحب" : "Withdraw"}
                          </Link>
                        </Button>
                        <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                          <Link to={createPageUrl("Profile") + "?tab=assets&assetTab=main&modal=deposit"}>
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
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl("Profile") + "?tab=assets&assetTab=main"}>
                        <div className="flex w-full items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4" />
                            <span>{language === "ar" ? "حساب التمويل" : "Fund Account"}</span>
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">{formatUsdt(accountBalances.fundingUsdt)} USDT</span>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl("Profile") + "?tab=assets&assetTab=spot"}>
                        <div className="flex w-full items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            <span>{language === "ar" ? "حساب سبوت" : "Spot Account"}</span>
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">
                            {accountBalances.spotUsdt === null ? "—" : `${formatUsdt(accountBalances.spotUsdt)} USDT`}
                          </span>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl("Profile") + "?tab=assets&assetTab=futures"}>
                        <div className="flex w-full items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            <span>{language === "ar" ? "حساب العقود" : "Futures Account"}</span>
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">
                            {accountBalances.futuresUsdt === null ? "—" : `${formatUsdt(accountBalances.futuresUsdt)} USDT`}
                          </span>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl("Investing")}>
                        <div className="flex w-full items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4" />
                            <span>{language === "ar" ? "حساب الثروة" : "Wealth Account"}</span>
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">{formatUsdt(accountBalances.wealthUsdt)} USDT</span>
                        </div>
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <div className="px-2 py-1.5 text-xs text-muted-foreground">{language === "ar" ? "الحساب" : "Account"}</div>
                    <Web3WalletDropdownItem language={language} />
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
                        {language === "ar" ? "الصفحة الرئيسية للمكافآت" : "Rewards Hub"}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl("Profile") + "?tab=referrals"}>
                        <Users className="h-4 w-4" />
                        {language === "ar" ? "دعوة واربح" : "Invite to Earn"}
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
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
                  className="glow-button bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-0 rounded-xl px-6 hover:from-blue-700 hover:to-cyan-700"
                  type="button"
                  onClick={() => navigateToLogin()}
                >
                  {accountLabel}
                </Button>
              )}
            </div>

            {/* Mobile Menu Button - Hidden since we have bottom nav */}
            <div className="md:hidden flex items-center gap-2">
              <NotificationBell onSettingsClick={() => setNotificationSettingsOpen(true)} />

              <Web3ModalButton language={language} />

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

        {/* Mobile Menu - Hidden, using bottom nav instead */}
        {false && mobileMenuOpen && (
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
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700"
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
                      navigateToLogin();
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

      {/* Main Content */}
      <main className="pt-20 md:pb-0 pb-20">
        {React.cloneElement(children, { language })}
      </main>

      {/* Footer */}
      {!isTradingPage && (
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
                  <Phone className="w-4 h-4" />
                  <span className="">963940632191+</span>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>support@nexttrade.app</span>
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
      
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-effect border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          <Link
            to={createPageUrl("Dashboard")}
            className={`flex flex-col items-center justify-center flex-1 gap-1 py-2 rounded-lg transition-all transform ${
              location.pathname === createPageUrl("Dashboard")
                ? 'text-primary bg-primary/20 shadow-md shadow-primary/25 border-t-2 border-primary scale-105'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">{language === 'ar' ? 'الرئيسية' : 'Home'}</span>
          </Link>
          
          <Link
            to={createPageUrl("Futures")}
            className={`flex flex-col items-center justify-center flex-1 gap-1 py-2 rounded-lg transition-all transform ${
              location.pathname === createPageUrl("Futures")
                ? 'text-primary bg-primary/20 shadow-md shadow-primary/25 border-t-2 border-primary scale-105'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-[10px] font-medium">{language === 'ar' ? 'عقود' : 'Trade'}</span>
          </Link>
          
          <Link
            to={createPageUrl("Profile") + "?tab=assets&assetTab=main"}
            className={`flex flex-col items-center justify-center flex-1 gap-1 py-2 rounded-lg transition-all transform ${
              location.pathname.includes("Profile") && location.search.includes("assets")
                ? 'text-primary bg-primary/20 shadow-md shadow-primary/25 border-t-2 border-primary scale-105'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <WalletIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{language === 'ar' ? 'المحفظة' : 'Assets'}</span>
          </Link>
          
          <Link
            to={createPageUrl("Investing")}
            className={`flex flex-col items-center justify-center flex-1 gap-1 py-2 rounded-lg transition-all transform ${
              location.pathname === createPageUrl("Investing")
                ? 'text-primary bg-primary/20 shadow-md shadow-primary/25 border-t-2 border-primary scale-105'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Grid className="w-5 h-5" />
            <span className="text-[10px] font-medium">{language === 'ar' ? 'استثمار' : 'Invest'}</span>
          </Link>
          
          <Link
            to={isAuthenticated ? createPageUrl("Profile") : '#'}
            onClick={isAuthenticated ? undefined : (e) => { e.preventDefault(); navigateToLogin(); }}
            className={`flex flex-col items-center justify-center flex-1 gap-1 py-2 rounded-lg transition-all transform ${
              location.pathname.includes("Profile") && !location.search.includes("assets")
                ? 'text-primary bg-primary/20 shadow-md shadow-primary/25 border-t-2 border-primary scale-105'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">{language === 'ar' ? 'الحساب' : 'Account'}</span>
          </Link>
        </div>
      </nav>
      
      <NotificationSettings 
        open={notificationSettingsOpen} 
        onOpenChange={setNotificationSettingsOpen} 
      />
    </div>
    </NotificationProvider>
    </WalletProvider>);

}

Layout.propTypes = {
  children: PropTypes.node.isRequired,
  currentPageName: PropTypes.string,
};
