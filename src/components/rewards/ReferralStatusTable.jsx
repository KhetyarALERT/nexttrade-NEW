import React from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, CheckCircle2, Clock, DollarSign, Shield, UserPlus } from "lucide-react";

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
    waiting: "Waiting"
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
    waiting: "بانتظار"
  }
};

export default function ReferralStatusTable({ referrals = [], language = "en" }) {
  const txt = t[language] || t.en;

  if (!referrals || referrals.length === 0) {
    return (
      <Card className="border border-border bg-card">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <p className="font-medium text-foreground mb-1">{txt.noReferrals}</p>
          <p className="text-sm text-muted-foreground">{txt.noReferralsDesc}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            {txt.title}
          </div>
          <Badge variant="secondary">{referrals.length}</Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          {referrals.map((ref) => (
            <div 
              key={ref.id} 
              className="p-4 rounded-xl bg-muted/30 border border-border"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-xs font-bold text-muted-foreground">
                      {ref.email?.charAt(0)?.toUpperCase() || "?"}
                    </span>
                  </div>
                  <div>
                    <span className="font-mono text-sm font-medium text-foreground">{ref.email}</span>
                    <span className="block text-xs text-muted-foreground">
                      {ref.registeredAt ? new Date(ref.registeredAt).toLocaleDateString() : "---"}
                    </span>
                  </div>
                </div>
                {ref.isEligible100 ? (
                  <Badge className="bg-primary text-primary-foreground">{txt.eligible}</Badge>
                ) : ref.holdingDays100 > 0 ? (
                  <Badge variant="outline" className="border-amber-500/50 text-amber-600">{txt.inProgress}</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">{txt.waiting}</Badge>
                )}
              </div>
              
              {/* Status Grid */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-lg bg-background">
                  <Shield className={`w-4 h-4 mx-auto mb-1 ${ref.kycVerified ? "text-primary" : "text-muted-foreground/40"}`} />
                  <span className="text-[10px] text-muted-foreground block">{txt.kyc}</span>
                  <span className={`text-xs font-medium ${ref.kycVerified ? "text-primary" : "text-muted-foreground"}`}>
                    {ref.kycVerified ? txt.verified : txt.pending}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-background">
                  <DollarSign className={`w-4 h-4 mx-auto mb-1 ${ref.netDeposit >= 100 ? "text-primary" : "text-muted-foreground/40"}`} />
                  <span className="text-[10px] text-muted-foreground block">{txt.deposit}</span>
                  <span className={`text-xs font-bold ${ref.netDeposit >= 100 ? "text-primary" : "text-foreground"}`}>
                    ${ref.netDeposit?.toFixed(0) || 0}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-background">
                  <Clock className={`w-4 h-4 mx-auto mb-1 ${ref.holdingDays100 >= 30 ? "text-primary" : "text-muted-foreground/40"}`} />
                  <span className="text-[10px] text-muted-foreground block">{txt.holding}</span>
                  <span className="text-xs font-medium text-foreground">{ref.holdingDays100 || 0}/30</span>
                </div>
                <div className="p-2 rounded-lg bg-background">
                  <DollarSign className={`w-4 h-4 mx-auto mb-1 ${ref.voucherPaid ? "text-primary" : "text-muted-foreground/40"}`} />
                  <span className="text-[10px] text-muted-foreground block">{txt.reward}</span>
                  <span className={`text-xs font-bold ${ref.voucherPaid ? "text-primary" : "text-muted-foreground"}`}>
                    {ref.voucherPaid ? "$10" : "—"}
                  </span>
                </div>
              </div>
              
              {/* Progress bar if in progress */}
              {ref.holdingDays100 > 0 && ref.holdingDays100 < 30 && (
                <div className="mt-3">
                  <Progress value={(ref.holdingDays100 / 30) * 100} className="h-1.5" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {30 - ref.holdingDays100} {txt.days} {txt.daysLeft}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

ReferralStatusTable.propTypes = {
  referrals: PropTypes.array,
  language: PropTypes.string
};