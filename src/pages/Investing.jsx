import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Lock } from "lucide-react";
import StakingPanel from "@/components/profile/StakingPanel";

const translations = {
  en: {
    title: "Investing",
    subtitle: "Earn yield with smart staking strategies",
    staking: "Staking",
    refresh: "Refresh",
    note: "Staking products may vary by wallet and availability.",
  },
  ar: {
    title: "الاستثمار",
    subtitle: "اكسب عوائد عبر استراتيجيات استثمار ذكية",
    staking: "الاستثمار",
    refresh: "تحديث",
    note: "قد تختلف منتجات الاستثمار حسب المحفظة والتوفر.",
  },
};

export default function Investing({ language = "en" }) {
  const t = translations[language] || translations.en;

  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadWallets = useCallback(async () => {
    setLoading(true);
    try {
      const walletsResult = await base44.functions.invoke("wallet", { action: "list" });
      if (walletsResult.data?.success) {
        setWallets(walletsResult.data.data || []);
      } else {
        setWallets([]);
      }
    } catch (err) {
      console.error("Failed to load wallets:", err);
      setWallets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-20 pt-8" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-slate-900">{t.title}</h1>
              <Badge variant="outline" className="border-slate-200 text-slate-700">
                <Lock className="h-3.5 w-3.5 mr-1" />
                {t.staking}
              </Badge>
            </div>
            <p className="text-slate-600 mt-2">{t.subtitle}</p>
            <p className="text-xs text-slate-500 mt-2">{t.note}</p>
          </div>

          <Button variant="outline" onClick={loadWallets} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {t.refresh}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <StakingPanel wallets={wallets} language={language} onRefresh={loadWallets} />
          </div>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg">{language === "ar" ? "كيف يعمل" : "How it works"}</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3 text-sm text-slate-600">
              <p>
                {language === "ar"
                  ? "اختر محفظة USDT، حدّد المبلغ، ثم اختر مدة القفل لتحصل على عائد سنوي (APY)."
                  : "Choose your USDT wallet, enter an amount, then pick a lock period to earn APY."}
              </p>
              <p>
                {language === "ar"
                  ? "بعد انتهاء مدة القفل يمكنك سحب المبلغ مع الأرباح."
                  : "After the lock period ends, you can withdraw principal plus rewards."}
              </p>
              <p className="text-xs text-slate-500">
                {language === "ar"
                  ? "ملاحظة: الإلغاء المبكر قد يخصم جزءًا من الأرباح وفقًا لشروط المنتج."
                  : "Note: Early unstaking may reduce earned rewards per product terms."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

Investing.propTypes = {
  language: PropTypes.oneOf(["en", "ar"]),
};
