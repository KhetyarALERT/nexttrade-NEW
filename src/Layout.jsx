import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Globe, Menu, X, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import nextTradeLogo from "@/assets/nexttrade-logo.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";
import NotificationBell from "@/components/notifications/NotificationBell";
import NotificationSettings from "@/components/notifications/NotificationSettings";

export default function Layout({ children }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [language, setLanguage] = useState("en");
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);



  const isRTL = language === "ar";
  const isTradingPage = false; // always show header/footer per request

  const navigation = [
  { name: { en: "Home", ar: "الرئيسية" }, url: createPageUrl("Home") },
  { name: { en: "Dashboard", ar: "لوحة التحكم" }, url: createPageUrl("Dashboard") },
  { name: { en: "Trading", ar: "التداول" }, url: createPageUrl("Trading") },
  { name: { en: "Profile", ar: "الملف الشخصي" }, url: createPageUrl("Profile") },
  { name: { en: "Contact", ar: "اتصل بنا" }, url: createPageUrl("Contact") }];


  return (
    <NotificationProvider>
    <div className={`min-h-screen bg-[#FAFAF9] ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
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
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.3);
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
              {navigation.map((item) =>
              <Link
                key={item.url}
                to={item.url}
                className={`nav-link text-sm font-medium transition-colors ${
                location.pathname === item.url ?
                'text-blue-600 active' :
                'text-gray-700 hover:text-blue-600'}`
                }>

                  {item.name[language]}
                </Link>
              )}
            </div>

            {/* Actions */}
            <div className="hidden md:flex items-center gap-3">
              <NotificationBell onSettingsClick={() => setNotificationSettingsOpen(true)} />
              
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

              <Button
                className="glow-button bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-0 rounded-xl px-6 hover:from-blue-700 hover:to-cyan-700"
                asChild>

                <Link to={createPageUrl("Profile") + "?tab=accounts"}>
                  {language === "en" ? "My Account" : "حسابي"}
                </Link>
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-2">
              <NotificationBell onSettingsClick={() => setNotificationSettingsOpen(true)} />
              
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

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>

                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen &&
        <div className="md:hidden glass-effect border-t border-gray-200">
            <div className="px-4 py-6 space-y-4">
              {navigation.map((item) =>
            <Link
              key={item.url}
              to={item.url}
              className="block text-gray-700 hover:text-blue-600 font-medium"
              onClick={() => setMobileMenuOpen(false)}>

                  {item.name[language]}
                </Link>
            )}
              <Button
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700"
              asChild>

                <Link to={createPageUrl("Profile") + "?tab=accounts"} onClick={() => setMobileMenuOpen(false)}>
                  {language === "en" ? "My Account" : "حسابي"}
                </Link>
              </Button>
            </div>
          </div>
        }
      </nav>
      )}

      {/* Main Content */}
      <main className={isTradingPage ? "" : "pt-20"}>
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
                {navigation.map((item) =>
                <li key={item.url}>
                    <Link to={item.url} className="hover:text-white transition-colors">
                      {item.name[language]}
                    </Link>
                  </li>
                )}
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
              {language === "en" ?
              "Crypto trading involves risk. Please trade responsibly." :
              "تداول العملات الرقمية ينطوي على مخاطر. يرجى التداول بمسؤولية"}
            </p>
          </div>
        </div>
      </footer>
      )}
      
      <NotificationSettings 
        open={notificationSettingsOpen} 
        onOpenChange={setNotificationSettingsOpen} 
      />
    </div>
    </NotificationProvider>);

}

Layout.propTypes = {
  children: PropTypes.node.isRequired
};