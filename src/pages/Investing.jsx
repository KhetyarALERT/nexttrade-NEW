import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Lock } from "lucide-react";
import StakingPanel from "@/components/profile/StakingPanel";
import { POSITION_VOUCHERS } from "@/lib/rewards-config";
import { tInvesting } from "@/lib/i18n/investing";

export default function Investing({ language = "en" }) {
  const t = tInvesting(language);

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
          <div className="lg:col-span-2 space-y-6">
            <StakingPanel wallets={wallets} language={language} onRefresh={loadWallets} />

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="text-lg">{t.stakingVouchersTitle}</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-xs text-slate-500 mb-4">{t.stakingVouchersSubtitle}</p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-xs text-slate-500">
                        <th className="text-left py-2 pr-4">{language === "ar" ? `${t.amount} (USDT)` : `${t.amount} (USDT)`}</th>
                        {POSITION_VOUCHERS.stakeTiers.durations.map((d) => (
                          <th key={d} className="text-right py-2 pl-4 whitespace-nowrap">
                            {language === "ar" ? `${d} ${t.days}` : `${d}d`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {POSITION_VOUCHERS.stakeTiers.amounts.map((amt) => (
                        <tr key={amt}>
                          <td className="py-2 pr-4 font-semibold text-slate-900">{amt.toLocaleString()}</td>
                          {POSITION_VOUCHERS.stakeTiers.durations.map((d) => {
                            const pct = POSITION_VOUCHERS.stakeTiers.percentByDuration[d];
                            return (
                              <td key={d} className="py-2 pl-4 text-right font-mono text-slate-700">
                                {Number.isFinite(Number(pct)) ? `${pct}%` : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg">{t.howItWorksTitle}</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3 text-sm text-slate-600">
              <p>{t.howItWorksP1}</p>
              <p>{t.howItWorksP2}</p>
              <p className="text-xs text-slate-500">{t.howItWorksNote}</p>
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
