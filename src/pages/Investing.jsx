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
  const promoBonus = {
    newUser: true,
    fiveK: { amount: 4999, duration: 49 }
  };

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
              <CardContent className="p-4 sm:p-6">
                <p className="text-xs text-muted-foreground mb-4">{t.stakingVouchersSubtitle}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge className="rounded-full border-0 bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-emerald-400/30 text-emerald-700 dark:text-emerald-200 px-3 py-1 text-[11px] shadow-sm">
                    {t.promoNewUser}
                  </Badge>
                  <Badge className="rounded-full border-0 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-yellow-300/30 text-amber-700 dark:text-amber-200 px-3 py-1 text-[11px] shadow-sm">
                    {t.promoFiveK}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mb-4">{t.minDepositNote}</p>

                {/* Enhanced Mobile-First USDT Staking Card */}
                <Card className="bg-card border-border text-foreground shadow-sm">
                  <CardContent className="p-0">
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="usdt" className="border-border">
                        <AccordionTrigger className="hover:no-underline px-3 sm:px-4 py-3 sm:py-4">
                          {/* Mobile: Stack vertically | Desktop: Horizontal */}
                          <div className="flex flex-col sm:flex-row w-full gap-2 sm:gap-4 sm:items-center">
                            {/* Asset info - always visible */}
                            <div className="flex items-center gap-3 shrink-0">
                              <CryptoIcon currency="USDT" size="sm" className="ring-1 ring-border" />
                              <div className="leading-tight text-left">
                                <div className="text-sm font-semibold text-foreground">USDT</div>
                                <div className="text-[11px] text-muted-foreground">Tether</div>
                              </div>
                            </div>

                            {/* APY & Duration - wrap on mobile */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:flex-1">
                              <div className="text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                                {pctMin !== null && pctMax !== null ? `${pctMin.toFixed(2)}%~${pctMax.toFixed(2)}%` : "—"}
                              </div>

                              <div className="text-xs sm:text-sm text-muted-foreground">
                                {language === "ar" ?
                                `مرن، ${durationMin ?? "—"}-${durationMax ?? "—"} ${t.days}` :
                                `Flexible, ${durationMin ?? "—"}-${durationMax ?? "—"} days`}
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>

                        <AccordionContent className="px-3 sm:px-4 pb-4">
                          <div className="overflow-x-auto -mx-3 sm:mx-0">
                            <table className="w-full text-sm border-collapse min-w-[300px]">
                              <thead>
                                <tr className="text-xs text-muted-foreground">
                                  <th className="text-left py-2 pr-2 sm:pr-4 pl-3 sm:pl-0">{`${t.amount} (USDT)`}</th>
                                  {stakeTiers?.durations?.map((d) =>
                                  <th key={d} className="text-right py-2 px-1 sm:pl-4 whitespace-nowrap">
                                      {language === "ar" ? `${d} ${t.days}` : `${d}d`}
                                    </th>
                                  )}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {stakeTiers?.amounts?.map((amt) =>
                                <tr key={amt}>
                                    <td className="py-2 pr-2 sm:pr-4 pl-3 sm:pl-0 font-semibold text-foreground">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <CryptoIcon currency="USDT" size="xs" className="ring-1 ring-border" />
                                        <span>{Number(amt).toLocaleString()}</span>
                                        {Number(amt) === 50 ? (
                                          <Badge className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[9px]">
                                            {t.newUserMin}
                                          </Badge>
                                        ) : null}
                                      </div>
                                    </td>
                                    {stakeTiers?.durations?.map((d) => {
                                    const pct = stakeTiers?.percentByDuration?.[d];
                                    const showFiveKBonus = promoBonus.fiveK && Number(amt) === promoBonus.fiveK.amount && Number(d) === promoBonus.fiveK.duration;
                                    return (
                                      <td key={d} className="py-2 px-1 sm:pl-4 text-right font-mono text-muted-foreground text-xs sm:text-sm">
                                          <div className="flex flex-col items-end gap-1">
                                            <span>{Number.isFinite(Number(pct)) ? `${pct}%` : "—"}</span>
                                            {showFiveKBonus ? <Badge className="rounded-full border-0 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-yellow-300/30 text-amber-700 dark:text-amber-200 text-[9px] px-2">200% bonus</Badge> : null}
                                          </div>
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
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg">{t.whatIsTitle}</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3 text-sm text-muted-foreground">
              <p>{t.whatIsP1}</p>
              <p>{t.whatIsP2}</p>
              <p>{t.whatIsP3}</p>
              <p className="text-xs text-muted-foreground">{t.whatIsHint}</p>
              <div className="rounded-lg border border-border bg-muted p-3">
                <div className="text-[11px] text-muted-foreground">{t.countdownLabel}</div>
                <div className="text-sm font-semibold text-foreground">{t.countdownStarts}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>);

}

Investing.propTypes = {
  language: PropTypes.oneOf(["en", "ar"])
};
