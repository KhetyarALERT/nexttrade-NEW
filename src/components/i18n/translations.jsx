// Central i18n dictionary for the app
// All UI strings should be referenced from here

export const translations = {
  // Navigation
  nav: {
    en: {
      overview: "Overview",
      trade: "Trade",
      wallet: "Wallet",
      support: "Support",
      account: "Account",
      home: "Home",
      futures: "Futures",
      memeCoins: "Meme Coins",
      investing: "Investing",
      rewards: "Rewards",
      deposit: "Deposit",
      withdraw: "Withdraw",
      history: "History",
      learnEarn: "Learn & Earn",
      assets: "Assets",
      dashboard: "Dashboard"
    },
    ar: {
      overview: "نظرة عامة",
      trade: "تداول",
      wallet: "المحفظة",
      support: "الدعم",
      account: "الحساب",
      home: "الرئيسية",
      futures: "عقود",
      memeCoins: "ميم كوينز",
      investing: "الاستثمار",
      rewards: "مكافآت",
      deposit: "إيداع",
      withdraw: "سحب",
      history: "السجل",
      learnEarn: "تعلّم واربح",
      assets: "الأصول",
      dashboard: "لوحة التحكم"
    }
  },

  // Common actions
  actions: {
    en: {
      refresh: "Refresh",
      cancel: "Cancel",
      confirm: "Confirm",
      save: "Save",
      delete: "Delete",
      edit: "Edit",
      close: "Close",
      back: "Back",
      next: "Next",
      submit: "Submit",
      copy: "Copy",
      copied: "Copied!",
      loading: "Loading...",
      retry: "Retry",
      viewAll: "View All",
      login: "Log In",
      logout: "Log Out",
      signUp: "Sign Up"
    },
    ar: {
      refresh: "تحديث",
      cancel: "إلغاء",
      confirm: "تأكيد",
      save: "حفظ",
      delete: "حذف",
      edit: "تعديل",
      close: "إغلاق",
      back: "رجوع",
      next: "التالي",
      submit: "إرسال",
      copy: "نسخ",
      copied: "تم النسخ!",
      loading: "جاري التحميل...",
      retry: "إعادة المحاولة",
      viewAll: "عرض الكل",
      login: "تسجيل الدخول",
      logout: "تسجيل الخروج",
      signUp: "إنشاء حساب"
    }
  },

  // Wallet
  wallet: {
    en: {
      title: "Wallet",
      totalBalance: "Total Balance",
      available: "Available",
      inOrders: "In Orders",
      fundingAccount: "Funding Account",
      tradingAccount: "Trading Account",
      deposit: "Deposit",
      withdraw: "Withdraw",
      transfer: "Transfer",
      history: "History",
      noAssets: "No assets yet",
      noAssetsDesc: "Deposit funds to get started",
      selectCurrency: "Select Currency",
      selectNetwork: "Select Network",
      depositAddress: "Deposit Address",
      scanQR: "Scan QR Code",
      minDeposit: "Minimum Deposit",
      networkFee: "Network Fee",
      estimatedArrival: "Estimated Arrival",
      depositNote: "Only send {currency} to this address. Sending other assets may result in permanent loss.",
      recentDeposits: "Recent Deposits",
      noDeposits: "No deposits yet",
      pending: "Pending",
      completed: "Completed",
      failed: "Failed",
      tradeNow: "Trade Now"
    },
    ar: {
      title: "المحفظة",
      totalBalance: "الرصيد الكلي",
      available: "المتاح",
      inOrders: "في الأوامر",
      fundingAccount: "حساب التمويل",
      tradingAccount: "حساب التداول",
      deposit: "إيداع",
      withdraw: "سحب",
      transfer: "تحويل",
      history: "السجل",
      noAssets: "لا توجد أصول",
      noAssetsDesc: "قم بالإيداع للبدء",
      selectCurrency: "اختر العملة",
      selectNetwork: "اختر الشبكة",
      depositAddress: "عنوان الإيداع",
      scanQR: "امسح رمز QR",
      minDeposit: "الحد الأدنى للإيداع",
      networkFee: "رسوم الشبكة",
      estimatedArrival: "الوصول المتوقع",
      depositNote: "أرسل {currency} فقط إلى هذا العنوان. إرسال أصول أخرى قد يؤدي إلى خسارة دائمة.",
      recentDeposits: "الإيداعات الأخيرة",
      noDeposits: "لا توجد إيداعات",
      pending: "قيد الانتظار",
      completed: "مكتمل",
      failed: "فشل",
      tradeNow: "ابدأ التداول"
    }
  },

  // Transfer
  transfer: {
    en: {
      title: "Transfer",
      subtitle: "Transfer between your funding and trading accounts",
      from: "From",
      to: "To",
      amount: "Amount",
      available: "Available",
      max: "Max",
      transfer: "Transfer",
      transferring: "Transferring...",
      success: "Transfer successful!",
      error: "Transfer failed",
      funding: "Funding",
      trading: "Trading",
      swapAccounts: "Swap accounts",
      invalidAmount: "Please enter a valid amount",
      exceedsBalance: "Amount exceeds available balance",
      asset: "Asset"
    },
    ar: {
      title: "تحويل",
      subtitle: "تحويل بين حساب التمويل وحساب التداول",
      from: "من",
      to: "إلى",
      amount: "المبلغ",
      available: "المتاح",
      max: "الحد الأقصى",
      transfer: "تحويل",
      transferring: "جاري التحويل...",
      success: "تم التحويل بنجاح!",
      error: "فشل التحويل",
      funding: "التمويل",
      trading: "التداول",
      swapAccounts: "تبديل الحسابات",
      invalidAmount: "يرجى إدخال مبلغ صالح",
      exceedsBalance: "المبلغ يتجاوز الرصيد المتاح",
      asset: "الأصل"
    }
  },

  // KYC / Verification
  kyc: {
    en: {
      verifyIdentity: "Verify Your Identity",
      verifyDesc: "Complete KYC verification to unlock all features",
      startKyc: "Start Verification",
      kycPending: "Verification Pending",
      kycPendingDesc: "Your documents are being reviewed. This usually takes 24-48 hours.",
      kycRejected: "Verification Rejected",
      kycRejectedDesc: "Please review the reason and resubmit your documents.",
      resubmit: "Resubmit Documents",
      verified: "Verified",
      notVerified: "Not Verified",
      underReview: "Under Review"
    },
    ar: {
      verifyIdentity: "تحقق من هويتك",
      verifyDesc: "أكمل التحقق من الهوية لفتح جميع الميزات",
      startKyc: "بدء التحقق",
      kycPending: "التحقق قيد المراجعة",
      kycPendingDesc: "يتم مراجعة مستنداتك. عادة ما يستغرق هذا 24-48 ساعة.",
      kycRejected: "تم رفض التحقق",
      kycRejectedDesc: "يرجى مراجعة السبب وإعادة تقديم مستنداتك.",
      resubmit: "إعادة تقديم المستندات",
      verified: "موثق",
      notVerified: "غير موثق",
      underReview: "قيد المراجعة"
    }
  },

  // Account
  account: {
    en: {
      activateAccount: "Activate Trading Account",
      activateDesc: "Request a trading account to start depositing and trading",
      requestAccount: "Request Account",
      accountPending: "Account Request Pending",
      accountPendingDesc: "Your trading account request is being processed.",
      loginRequired: "Login Required",
      loginDesc: "Please log in to access your account",
      personalInfo: "Personal Information",
      security: "Security",
      referrals: "Referrals",
      notifications: "Notifications",
      settings: "Settings"
    },
    ar: {
      activateAccount: "تفعيل حساب التداول",
      activateDesc: "اطلب حساب تداول للبدء في الإيداع والتداول",
      requestAccount: "طلب حساب",
      accountPending: "طلب الحساب قيد المراجعة",
      accountPendingDesc: "يتم معالجة طلب حساب التداول الخاص بك.",
      loginRequired: "تسجيل الدخول مطلوب",
      loginDesc: "يرجى تسجيل الدخول للوصول إلى حسابك",
      personalInfo: "المعلومات الشخصية",
      security: "الأمان",
      referrals: "الإحالات",
      notifications: "الإشعارات",
      settings: "الإعدادات"
    }
  },

  // Support / Chat
  support: {
    en: {
      title: "Support",
      online: "Online",
      offline: "Offline",
      placeholder: "Type your message...",
      send: "Send",
      welcomeMessage: "Hi! How can I help you today?",
      closeChat: "Close chat"
    },
    ar: {
      title: "الدعم",
      online: "متصل",
      offline: "غير متصل",
      placeholder: "اكتب رسالتك...",
      send: "إرسال",
      welcomeMessage: "مرحباً! كيف يمكنني مساعدتك اليوم؟",
      closeChat: "إغلاق المحادثة"
    }
  },

  // Errors
  errors: {
    en: {
      generic: "Something went wrong",
      network: "Network error. Please check your connection.",
      unauthorized: "Please log in to continue",
      notFound: "Not found",
      serverError: "Server error. Please try again later."
    },
    ar: {
      generic: "حدث خطأ ما",
      network: "خطأ في الشبكة. يرجى التحقق من اتصالك.",
      unauthorized: "يرجى تسجيل الدخول للمتابعة",
      notFound: "غير موجود",
      serverError: "خطأ في الخادم. يرجى المحاولة لاحقاً."
    }
  },

  // Trading
  trading: {
    en: {
      buy: "Buy",
      sell: "Sell",
      long: "Long",
      short: "Short",
      market: "Market",
      limit: "Limit",
      price: "Price",
      amount: "Amount",
      total: "Total",
      leverage: "Leverage",
      margin: "Margin",
      pnl: "PnL",
      openPositions: "Open Positions",
      orderHistory: "Order History",
      noPositions: "No open positions",
      noOrders: "No pending orders"
    },
    ar: {
      buy: "شراء",
      sell: "بيع",
      long: "شراء",
      short: "بيع",
      market: "سوق",
      limit: "محدد",
      price: "السعر",
      amount: "المبلغ",
      total: "الإجمالي",
      leverage: "الرافعة",
      margin: "الهامش",
      pnl: "الربح/الخسارة",
      openPositions: "المراكز المفتوحة",
      orderHistory: "سجل الأوامر",
      noPositions: "لا توجد مراكز مفتوحة",
      noOrders: "لا توجد أوامر معلقة"
    }
  }
};

// Helper function to get translation
export function t(section, key, language = "en") {
  const sectionData = translations[section];
  if (!sectionData) return key;
  const langData = sectionData[language] || sectionData.en;
  if (!langData) return key;
  return langData[key] || key;
}

// Helper to get entire section
export function tSection(section, language = "en") {
  const sectionData = translations[section];
  if (!sectionData) return {};
  return sectionData[language] || sectionData.en || {};
}

// Assistant translations (for support chat)
export function tAssistant(language = "en") {
  return translations.support[language] || translations.support.en;
}