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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import CryptoIcon from "@/components/ui/CryptoIcon";

export default function Investing({ language = "en" }) {
  const t = tInvesting(language);

  const stakeTiers = POSITION_VOUCHERS?.stakeTiers;
  const tierDurations = Array.isArray(stakeTiers?.durations) ? stakeTiers.durations : [];
  const durationMin = tierDurations.length ? Math.min(...tierDurations) : null;
  const durationMax = tierDurations.length ? Math.max(...tierDurations) : null;
  const pctValues = tierDurations.
  map((d) => Number(stakeTiers?.percentByDuration?.[d])).
  filter((v) => Number.isFinite(v));
  const pctMin = pctValues.length ? Math.min(...pctValues) : null;
  const pctMax = pctValues.length ? Math.max(...pctValues) : null;

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
    <div className="min-h-screen bg-background text-foreground pb-20 pt-8" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-foreground">{t.title}</h1>
              <Badge variant="outline" className="border-border text-muted-foreground">
                <Lock className="h-3.5 w-3.5 mr-1" />
                {t.staking}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-2">{t.subtitle}</p>
            <p className="text-xs text-muted-foreground mt-2">{t.note}</p>
          </div>

          <Button variant="outline" onClick={loadWallets} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {t.refresh}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <StakingPanel wallets={wallets} language={language} onRefresh={loadWallets} />

            <Card className="border-border shadow-sm">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-lg">{t.stakingVouchersTitle}</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-xs text-muted-foreground mb-4">{t.stakingVouchersSubtitle}</p>

                {/* Enhanced UX: USDT-only row like screenshot; details expand */}
                <Card className="bg-card border-border text-foreground shadow-sm">
                  <CardContent className="p-0">
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="usdt" className="border-border">
                        <AccordionTrigger className="hover:no-underline px-4 py-4">
                          <div className="flex w-full items-center gap-4">
                            <div className="flex items-center gap-3 min-w-[160px]">
                              <CryptoIcon currency="USDT" size="sm" className="ring-1 ring-border" />
                              <div className="leading-tight">
                                <div className="text-sm font-semibold text-foreground">USDT</div>
                                <div className="text-[11px] text-muted-foreground">Tether</div>
                              </div>
                            </div>

                            <div className="text-emerald-600 text-sm font-semibold flex-1">
                              {pctMin !== null && pctMax !== null ? `${pctMin.toFixed(2)}%~${pctMax.toFixed(2)}%` : "—"}
                            </div>

                            <div className="text-sm text-muted-foreground whitespace-nowrap">
                              {language === "ar" ?
                              `مرن، ${durationMin ?? "—"}-${durationMax ?? "—"} ${t.days}` :
                              `Flexible, ${durationMin ?? "—"}-${durationMax ?? "—"} days`}
                            </div>
                          </div>
                        </AccordionTrigger>

                        <AccordionContent className="px-4 pb-4">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                              <thead>
                                <tr className="text-xs text-slate-400">
                                  <th className="text-left py-2 pr-4">{`${t.amount} (USDT)`}</th>
                                  {stakeTiers?.durations?.map((d) =>
                                  <th key={d} className="text-right py-2 pl-4 whitespace-nowrap">
                                      {language === "ar" ? `${d} ${t.days}` : `${d}d`}
                                    </th>
                                  )}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {stakeTiers?.amounts?.map((amt) =>
                                <tr key={amt}>
                                    <td className="py-2 pr-4 font-semibold text-foreground">{Number(amt).toLocaleString()}</td>
                                    {stakeTiers?.durations?.map((d) => {
                                    const pct = stakeTiers?.percentByDuration?.[d];
                                    return (
                                      <td key={d} className="py-2 pl-4 text-right font-mono text-muted-foreground">
                                          {Number.isFinite(Number(pct)) ? `${pct}%` : "—"}
                                        </td>);

                                  })}
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg">{t.howItWorksTitle}</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3 text-sm text-muted-foreground">
              <p>{t.howItWorksP1}</p>
              <p>{t.howItWorksP2}</p>
              <p className="text-xs text-muted-foreground">{t.howItWorksNote}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>);

}

Investing.propTypes = {
  language: PropTypes.oneOf(["en", "ar"])
};