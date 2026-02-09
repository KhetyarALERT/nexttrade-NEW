import React from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, CheckCircle2, Clock, DollarSign, Shield, UserPlus, Gift, Lock } from "lucide-react";

const t = {
  en: {
    title: "Your Referrals",
    noReferrals: "No referrals yet",
    noReferralsDesc: "Share your link to start earning",
    kyc: "KYC",
    deposit: "Deposit",
    holding: "30-Day Hold",
    status: "Status",
    reward: "Reward",
    verified: "Yes",
    pending: "No",
    days: "days",
    daysLeft: "left",
    eligible: "Eligible",
    inProgress: "In Progress",
    waiting: "Waiting",
    bigDepositBonuses: "Big Deposit Bonuses",
    bigDepositDesc: "Earn extra trade vouchers when your friend holds higher deposits for 30 days",
    locked: "Locked",
    achieved: "Achieved",
    holdingPeriod: "Holding"
  },
  ar: {
    title: "إحالاتك",
    noReferrals: "لا توجد إحالات بعد",
    noReferralsDesc: "شارك رابطك لتبدأ الربح",
    kyc: "تحقق",
    deposit: "إيداع",
    holding: "احتفاظ 30 يوم",
    status: "الحالة",
    reward: "المكافأة",
    verified: "نعم",
    pending: "لا",
    days: "يوم",
    daysLeft: "متبقي",
    eligible: "مؤهل",
    inProgress: "قيد التقدم",
    waiting: "بانتظار",
    bigDepositBonuses: "حوافز الإيداع الكبيرة",
    bigDepositDesc: "احصل على قسائم تداول إضافية عندما يحافظ صديقك على صافي إيداع أعلى لمدة 30 يوم",
    locked: "مقفل",
    achieved: "تم",
    holdingPeriod: "احتفاظ"
  }
};

// Deposit bonus tier badge component
function DepositBonusBadge({ tier, language }) {
  const txt = t[language] || t.en;
  const { threshold, amount, holdingDays, isEligible, voucherIssued } = tier;
  
  // Determine state: achieved, holding, or locked
  let state = 'locked';
  if (voucherIssued || isEligible) {
    state = 'achieved';
  } else if (holdingDays > 0) {
    state = 'holding';
  }

  const stateStyles = {
    locked: "bg-muted/50 text-muted-foreground border-border/50",
    holding: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    achieved: "bg-primary/10 text-primary border-primary/30"
  };

  const stateIcons = {
    locked: <Lock className="w-2.5 h-2.5" />,
    holding: <Clock className="w-2.5 h-2.5" />,
    achieved: <CheckCircle2 className="w-2.5 h-2.5" />
  };

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium ${stateStyles[state]}`}>
      {stateIcons[state]}
      <span>${threshold}</span>
      {state === 'holding' && (
        <span className="opacity-70">({holdingDays}/30)</span>
      )}
      {state === 'achieved' && (
        <span className="text-primary font-bold">+${amount}</span>
      )}
    </div>
  );
}

DepositBonusBadge.propTypes = {
  tier: PropTypes.object.isRequired,
  language: PropTypes.string
};

export default function ReferralStatusTable({ referrals = [], language = "en" }) {
  const txt = t[language] || t.en;

  if (!referrals || referrals.length === 0) {
    return (
      <Card className="border border-border/70 bg-card/95 rounded-2xl shadow-sm">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <p className="font-medium text-foreground mb-1">{txt.noReferrals}</p>
          <p className="text-sm text-muted-foreground">{txt.noReferralsDesc}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/70 bg-card/95 rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            {txt.title}
          </div>
          <Badge variant="secondary" className="rounded-md">{referrals.length}</Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          {referrals.map((ref) => {
            const bonusTiers = ref.depositBonuses
              ? [ref.depositBonuses.tier500, ref.depositBonuses.tier1000, ref.depositBonuses.tier2000].filter(Boolean)
              : [];

            return (
            <div 
              key={ref.id} 
              className="p-4 rounded-2xl bg-card/90 border border-border/70 shadow-sm"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3 gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-sm font-bold text-muted-foreground">
                      {ref.email?.charAt(0)?.toUpperCase() || "?"}
                    </span>
                  </div>
                  <div>
                    <span className="font-mono text-sm font-medium text-foreground break-all">{ref.email}</span>
                    <span className="block text-xs text-muted-foreground">
                      {ref.registeredAt ? new Date(ref.registeredAt).toLocaleDateString() : "---"}
                    </span>
                  </div>
                </div>
                {ref.isEligible100 ? (
                  <Badge className="bg-primary/15 text-primary border-primary/30 rounded-md">{txt.eligible}</Badge>
                ) : ref.holdingDays100 > 0 ? (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-600 rounded-md">{txt.inProgress}</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground rounded-md">{txt.waiting}</Badge>
                )}
              </div>
              
              {/* Status Grid - Basic $10 voucher requirements */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-lg bg-muted/15 border border-border/60">
                  <Shield className={`w-4 h-4 mx-auto mb-1 ${ref.kycVerified ? "text-primary" : "text-muted-foreground/40"}`} />
                  <span className="text-[10px] text-muted-foreground block">{txt.kyc}</span>
                  <span className={`text-xs font-medium ${ref.kycVerified ? "text-primary" : "text-muted-foreground"}`}>
                    {ref.kycVerified ? txt.verified : txt.pending}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-muted/15 border border-border/60">
                  <DollarSign className={`w-4 h-4 mx-auto mb-1 ${ref.netDeposit >= 100 ? "text-primary" : "text-muted-foreground/40"}`} />
                  <span className="text-[10px] text-muted-foreground block">{txt.deposit}</span>
                  <span className={`text-xs font-bold ${ref.netDeposit >= 100 ? "text-primary" : "text-foreground"}`}>
                    ${ref.netDeposit?.toFixed(0) || 0}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-muted/15 border border-border/60">
                  <Clock className={`w-4 h-4 mx-auto mb-1 ${ref.holdingDays100 >= 30 ? "text-primary" : "text-muted-foreground/40"}`} />
                  <span className="text-[10px] text-muted-foreground block">{txt.holding}</span>
                  <span className="text-xs font-medium text-foreground">{ref.holdingDays100 || 0}/30</span>
                </div>
                <div className="p-2 rounded-lg bg-muted/15 border border-border/60">
                  <DollarSign className={`w-4 h-4 mx-auto mb-1 ${ref.voucherPaid ? "text-primary" : "text-muted-foreground/40"}`} />
                  <span className="text-[10px] text-muted-foreground block">{txt.reward}</span>
                  <span className={`text-xs font-bold ${ref.voucherPaid ? "text-primary" : "text-muted-foreground"}`}>
                    {ref.voucherPaid ? "$10" : "—"}
                  </span>
                </div>
              </div>
              
              {/* Progress bar if in progress for $100 threshold */}
              {ref.holdingDays100 > 0 && ref.holdingDays100 < 30 && (
                <div className="mt-3">
                  <Progress value={(ref.holdingDays100 / 30) * 100} className="h-2 rounded-full" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {30 - ref.holdingDays100} {txt.days} {txt.daysLeft}
                  </p>
                </div>
              )}

              {/* Big Deposit Bonuses Section - Only show if KYC verified and deposited */}
              {bonusTiers.length > 0 && ref.kycVerified && ref.netDeposit >= 100 ? (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Gift className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-medium">{txt.bigDepositBonuses}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {bonusTiers.map((tier) => (
                      <DepositBonusBadge key={tier.threshold} tier={tier} language={language} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

ReferralStatusTable.propTypes = {
  referrals: PropTypes.array,
  language: PropTypes.string
};