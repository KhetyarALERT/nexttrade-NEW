import PropTypes from "prop-types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gift, TrendingUp, Clock, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import UsdtIcon from "@/components/ui/UsdtIcon";

function getLocale(lang) {
  return lang === "ar" ? "ar-u-nu-latn" : "en-US";
}

function fmtUsdt(val, language = "en") {
  if (val === null || val === undefined || !Number.isFinite(val)) return "0.00";
  return new Intl.NumberFormat(getLocale(language), { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(val);
}

const t = {
  en: {
    title: "Earnings Breakdown",
    subtitle: "Your accrued rewards across all active positions",
    totalEarned: "Total Earned",
    totalClaimed: "Claimed",
    totalClaimable: "Available to Claim",
    noEarnings: "No earnings yet. Start staking to earn rewards!",
    position: "Position",
    accrued: "Accrued",
    paid: "Paid",
    claimable: "Claimable",
    claim: "Claim",
    requested: "Requested",
    processing: "Processing...",
    bonusPoints: "Bonus Points",
    apy: "APY",
    days: "days",
    claimAll: "Claim All Available",
    close: "Close"
  },
  ar: {
    title: "تفاصيل الأرباح",
    subtitle: "مكافآتك المستحقة عبر جميع المراكز النشطة",
    totalEarned: "إجمالي المكتسب",
    totalClaimed: "المُطالَب به",
    totalClaimable: "متاح للمطالبة",
    noEarnings: "لا أرباح بعد. ابدأ الستاكينغ لكسب المكافآت!",
    position: "المركز",
    accrued: "مستحق",
    paid: "مدفوع",
    claimable: "قابل للمطالبة",
    claim: "مطالبة",
    requested: "مطلوب",
    processing: "جارٍ المعالجة...",
    bonusPoints: "نقاط إضافية",
    apy: "عائد سنوي",
    days: "أيام",
    claimAll: "مطالبة بالكل",
    close: "إغلاق"
  }
};

export default function StakingEarnedPanel({ positions, onClaim, claimingId, onClose, language = "en" }) {
  const labels = t[language] || t.en;

  const activePositions = (positions || []).filter(p =>
    p.status === "ACTIVE" && (p.accruedAmount > 0 || p.rewardsGranted > 0)
  );

  const totalAccrued = activePositions.reduce((s, p) => s + (p.accruedAmount || 0), 0);
  const totalPaid = activePositions.reduce((s, p) => s + (p.paidAmount || 0), 0);
  const totalClaimable = totalAccrued - totalPaid;

  return (
    <div className="space-y-4">
      {/* Summary Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{labels.totalEarned}</p>
          <p className="text-lg font-bold text-primary mt-0.5">{fmtUsdt(totalAccrued, language)}</p>
          <p className="text-[10px] text-muted-foreground">USDT</p>
        </div>
        <div className="bg-muted/50 border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{labels.totalClaimed}</p>
          <p className="text-lg font-bold text-foreground mt-0.5">{fmtUsdt(totalPaid, language)}</p>
          <p className="text-[10px] text-muted-foreground">USDT</p>
        </div>
        <div className={`border rounded-xl p-3 text-center ${totalClaimable > 0.01 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-muted/50 border-border"}`}>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{labels.totalClaimable}</p>
          <p className={`text-lg font-bold mt-0.5 ${totalClaimable > 0.01 ? "text-emerald-600" : "text-foreground"}`}>
            {fmtUsdt(totalClaimable, language)}
          </p>
          <p className="text-[10px] text-muted-foreground">USDT</p>
        </div>
      </div>

      {/* Per-position breakdown */}
      {activePositions.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <Gift className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>{labels.noEarnings}</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {activePositions.map((pos) => {
            const claimable = (pos.accruedAmount || 0) - (pos.paidAmount || 0);
            const isClaiming = claimingId === pos.id;
            const isRequested = pos.payoutStatus === "REQUESTED";

            return (
              <Card key={pos.id} className="border-border/60">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UsdtIcon size="sm" language={language} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {fmtUsdt(pos.principal, language)} USDT
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {pos.termDays} {labels.days} • {pos.apyPercent}% {labels.apy}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{labels.accrued}</p>
                        <p className="text-sm font-semibold text-emerald-600">+{fmtUsdt(pos.accruedAmount, language)}</p>
                      </div>

                      {claimable > 0.01 && !isRequested && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                          disabled={isClaiming}
                          onClick={() => onClaim?.(pos.id)}
                        >
                          {isClaiming ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              {labels.claim}
                              <ArrowRight className="w-3 h-3 ltr:ml-1 rtl:mr-1" />
                            </>
                          )}
                        </Button>
                      )}

                      {isRequested && (
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                          <Clock className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                          {labels.requested}
                        </Badge>
                      )}

                      {pos.payoutStatus === "PAID" && claimable <= 0.01 && (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                          {labels.paid || "Paid"}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Bonus points row */}
                  {pos.rewardsGranted > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-primary text-xs">
                      <Gift className="w-3.5 h-3.5" />
                      <span>+{pos.rewardsGranted} {labels.bonusPoints}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-end pt-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          {labels.close}
        </Button>
      </div>
    </div>
  );
}

StakingEarnedPanel.propTypes = {
  positions: PropTypes.array,
  onClaim: PropTypes.func,
  claimingId: PropTypes.string,
  onClose: PropTypes.func,
  language: PropTypes.oneOf(["en", "ar"])
};