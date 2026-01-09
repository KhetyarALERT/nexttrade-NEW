export const memeCoinsI18n = {
  en: {
    title: "Meme Coin Terminal",
    solana: "Solana",
    searchPlaceholder: "Search tokens...",

    hot: "Hot",
    newest: "New",
    marketCap: "MC",
    liquidity: "Liquidity",

    filters: "Filters",
    reset: "Reset",
    tokens: "tokens",
    token: "Token",
    action: "Action",
    loadingMemeCoins: "Loading meme coins...",
    noTokensFound: "No tokens found",
    noTokensMatchSearch: "No tokens match your search",

    minLiquidity: "Min Liquidity ($)",
    minMarketCap: "Min MC ($)",
    minVolume: "Min Vol",
    maxAgeHours: "Max Age (hours)",
    greenOnly: "Green only",
    hasLogo: "Has logo",
    hasSocials: "Has socials",
    lpSecured: "LP secured",
    lpLocked: "LP locked",
    lpBurned: "LP burned",

    chartUnavailable: "Chart unavailable",
    openChart: "Open chart",
    close: "Close",
    copy: "Copy",
    copied: "Copied",

    price: "Price",
    volume: "Vol",
    age: "Age",
    trade: "Trade",

    selectTokenToOpenTerminal: "Select a token to open the terminal.",

    estimated: "Estimated",
    live: "Live",

    pay: "Pay",
    receive: "Receive",
    slippage: "Slippage",

    connectWallet: "Connect wallet",
    connectFromNavbar: "Connect your Solana wallet from the navbar to trade.",

    buy: "Buy",
    sell: "Sell",
    buyLiveRequired: "BUY (live quote required)",
    sellLiveRequired: "SELL (live quote required)",

    launched: "Launched",
    socials: "Socials",
    website: "Website",
  },
  ar: {
    title: "محطة عملات الميم",
    solana: "سولانا",
    searchPlaceholder: "ابحث عن العملات...",

    hot: "الأكثر تداولاً",
    newest: "الجديدة",
    marketCap: "القيمة السوقية",
    liquidity: "السيولة",

    filters: "الفلاتر",
    reset: "إعادة ضبط",
    tokens: "عملة",
    token: "العملة",
    action: "إجراء",
    loadingMemeCoins: "جاري تحميل عملات الميم...",
    noTokensFound: "لم يتم العثور على عملات",
    noTokensMatchSearch: "لا توجد عملات تطابق البحث",

    minLiquidity: "أقل سيولة ($)",
    minMarketCap: "أقل قيمة سوقية ($)",
    minVolume: "أقل حجم",
    maxAgeHours: "أقصى عمر (ساعة)",
    greenOnly: "الارتفاع فقط",
    hasLogo: "مع شعار",
    hasSocials: "مع روابط",
    lpSecured: "سيولة مؤمّنة",
    lpLocked: "سيولة مقفلة",
    lpBurned: "سيولة محروقة",

    chartUnavailable: "المخطط غير متاح",
    openChart: "فتح المخطط",
    close: "إغلاق",
    copy: "نسخ",
    copied: "تم النسخ",

    price: "السعر",
    volume: "الحجم",
    age: "العمر",
    trade: "تداول",

    selectTokenToOpenTerminal: "اختر عملة لفتح المحطة.",

    estimated: "تقديري",
    live: "مباشر",

    pay: "ادفع",
    receive: "استلم",
    slippage: "الانزلاق السعري",

    connectWallet: "ربط المحفظة",
    connectFromNavbar: "اربط محفظة سولانا من الشريط العلوي للتداول.",

    buy: "شراء",
    sell: "بيع",
    buyLiveRequired: "شراء (يلزم سعر مباشر)",
    sellLiveRequired: "بيع (يلزم سعر مباشر)",

    launched: "وقت الإطلاق",
    socials: "الروابط",
    website: "الموقع",
  },
};

export function tMemeCoins(language) {
  return memeCoinsI18n[language] || memeCoinsI18n.en;
}
