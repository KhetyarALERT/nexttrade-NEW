import React from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, CheckCircle2, Clock, DollarSign, Shield, UserPlus, Gift, AlertCircle } from "lucide-react";

const t = {
  en: {
    title: "Your Invited Friends",
    subtitle: "Track their progress to eligibility",
    noReferrals: "No friends invited yet",
    noReferralsDesc: "Share your link above to start inviting",
    noReferralsTip: "Each eligible friend earns you $10!",
    kyc: "KYC",
    deposit: "Deposit",
    holding: "Holding",
    status: "Status",
    reward: "Reward",
    verified: "Verified",
    pending: "Pending",
    days: "days",
    daysLeft: "days left",
    complete: "Complete",
    earned: "Earned",
    notYet: "---",
    eligible: "Eligible",
    inProgress: "In Progress",
    waiting: "Waiting"
  },
  ar: {
    title: "أصدقاؤك المدعوون",
    subtitle: "تتبع تقدمهم نحو الأهلية",
    noReferrals: "لم تدعُ أصدقاء بعد",
    noReferralsDesc: "شارك رابطك أعلاه لبدء الدعوة",
    noReferralsTip: "كل صديق مؤهل يكسبك $10!",
    kyc: "تحقق",
    deposit: "إيداع",
    holding: "احتفاظ",
    status: "الحالة",
    reward: "المكافأة",
    verified: "موثّق",
    pending: "معلّق",
    days: "يوم",
    daysLeft: "يوم متبقي",
    complete: "مكتمل",
    earned: "مكتسب",
    notYet: "---",
    eligible: "مؤهل",
    inProgress: "قيد التقدم",
    waiting: "بانتظار"
  }
};

export default function ReferralStatusTable({ referrals = [], language = "en" }) {
  const txt = t[language] || t.en;

  if (!referrals || referrals.length === 0) {
    return (
      <Card className="border border-border/50 bg-card shadow-lg">
        <CardContent className="p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-10 h-10 text-primary/40" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">{txt.noReferrals}</h3>
          <p className="text-sm text-muted-foreground mb-3">{txt.noReferralsDesc}</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-600">
            <Gift className="w-4 h-4" />
            <span className="text-sm font-medium">{txt.noReferralsTip}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/50 bg-card shadow-lg overflow-hidden">
      <CardHeader className="py-4 px-5 bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">{txt.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{txt.subtitle}</p>
            </div>
          </div>
          <Badge className="bg-primary/10 text-primary border-0 text-sm px-3 py-1">
            {referrals.length}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30 border-b border-border/50">
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="p-4 font-semibold">Friend</th>
                <th className="p-4 font-semibold text-center">{txt.kyc}</th>
                <th className="p-4 font-semibold text-center">{txt.deposit}</th>
                <th className="p-4 font-semibold text-center">{txt.holding}</th>
                <th className="p-4 font-semibold text-center">{txt.status}</th>
                <th className="p-4 font-semibold text-center">{txt.reward}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {referrals.map((ref) => (
                <tr key={ref.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                        <span className="text-sm font-bold text-muted-foreground">
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
                  </td>
                  <td className="p-4 text-center">
                    {ref.kycVerified ? (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">{txt.verified}</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">{txt.pending}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`font-mono text-sm font-bold ${ref.netDeposit >= 100 ? "text-emerald-600" : "text-foreground"}`}>
                      ${ref.netDeposit.toFixed(0)}
                    </span>
                    {ref.netDeposit < 100 && (
                      <span className="block text-[10px] text-muted-foreground">min $100</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {ref.holdingDays100 > 0 ? (
                      <div className="space-y-1.5">
                        <Progress value={(ref.holdingDays100 / 30) * 100} className="h-2 w-20 mx-auto" />
                        <span className="text-xs text-muted-foreground">
                          {ref.holdingDays100 >= 30 ? txt.complete : `${30 - ref.holdingDays100} ${txt.daysLeft}`}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{txt.notYet}</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {ref.isEligible100 ? (
                      <Badge className="bg-emerald-500 text-white">{txt.eligible}</Badge>
                    ) : ref.holdingDays100 > 0 ? (
                      <Badge variant="outline" className="border-blue-500 text-blue-600">{txt.inProgress}</Badge>
                    ) : (
                      <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">{txt.waiting}</Badge>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {ref.voucherPaid ? (
                      <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600">
                        <DollarSign className="w-3.5 h-3.5" />
                        <span className="font-bold">$10</span>
                        <span className="text-xs">{txt.earned}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">{txt.notYet}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-border/50">
          {referrals.map((ref) => (
            <div key={ref.id} className="p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                    <span className="text-sm font-bold text-muted-foreground">
                      {ref.email?.charAt(0)?.toUpperCase() || "?"}
                    </span>
                  </div>
                  <div>
                    <span className="font-mono text-sm font-medium text-foreground block">{ref.email}</span>
                    <span className="text-xs text-muted-foreground">
                      {ref.registeredAt ? new Date(ref.registeredAt).toLocaleDateString() : "---"}
                    </span>
                  </div>
                </div>
                {ref.isEligible100 ? (
                  <Badge className="bg-emerald-500 text-white">{txt.eligible}</Badge>
                ) : ref.holdingDays100 > 0 ? (
                  <Badge variant="outline" className="border-blue-500 text-blue-600">{txt.inProgress}</Badge>
                ) : (
                  <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">{txt.waiting}</Badge>
                )}
              </div>
              
              {/* Status Grid */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-muted/30 rounded-xl p-3 text-center">
                  <Shield className={`w-5 h-5 mx-auto mb-1.5 ${ref.kycVerified ? "text-emerald-500" : "text-muted-foreground/50"}`} />
                  <span className="text-[10px] text-muted-foreground block mb-0.5">{txt.kyc}</span>
                  <span className={`text-xs font-semibold ${ref.kycVerified ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {ref.kycVerified ? "✓" : "—"}
                  </span>
                </div>
                <div className="bg-muted/30 rounded-xl p-3 text-center">
                  <DollarSign className={`w-5 h-5 mx-auto mb-1.5 ${ref.netDeposit >= 100 ? "text-emerald-500" : "text-muted-foreground/50"}`} />
                  <span className="text-[10px] text-muted-foreground block mb-0.5">{txt.deposit}</span>
                  <span className={`text-xs font-bold ${ref.netDeposit >= 100 ? "text-emerald-600" : "text-foreground"}`}>
                    ${ref.netDeposit.toFixed(0)}
                  </span>
                </div>
                <div className="bg-muted/30 rounded-xl p-3 text-center">
                  <Clock className={`w-5 h-5 mx-auto mb-1.5 ${ref.holdingDays100 >= 30 ? "text-emerald-500" : "text-muted-foreground/50"}`} />
                  <span className="text-[10px] text-muted-foreground block mb-0.5">{txt.holding}</span>
                  <span className="text-xs font-semibold text-foreground">{ref.holdingDays100}/30d</span>
                </div>
                <div className="bg-muted/30 rounded-xl p-3 text-center">
                  <Gift className={`w-5 h-5 mx-auto mb-1.5 ${ref.voucherPaid ? "text-emerald-500" : "text-muted-foreground/50"}`} />
                  <span className="text-[10px] text-muted-foreground block mb-0.5">{txt.reward}</span>
                  <span className={`text-xs font-bold ${ref.voucherPaid ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {ref.voucherPaid ? "$10" : "—"}
                  </span>
                </div>
              </div>
              
              {/* Progress bar if in progress */}
              {ref.holdingDays100 > 0 && ref.holdingDays100 < 30 && (
                <div className="bg-blue-500/5 rounded-xl p-3 border border-blue-500/20">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-blue-600 font-medium">{txt.holding} {txt.inProgress}</span>
                    <span className="text-muted-foreground">{ref.holdingDays100}/30 {txt.days}</span>
                  </div>
                  <Progress value={(ref.holdingDays100 / 30) * 100} className="h-2" />
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