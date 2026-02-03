import React from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, CheckCircle2, Clock, AlertCircle, DollarSign, Shield } from "lucide-react";

const t = {
  en: {
    title: "Your Referrals",
    noReferrals: "No referrals yet",
    noReferralsDesc: "Share your link to start earning",
    kyc: "KYC",
    deposit: "Deposit",
    holding: "Holding",
    eligible: "Status",
    voucher: "Voucher",
    verified: "Verified",
    pending: "Pending",
    days: "days",
    daysLeft: "days left",
    paid: "Paid",
    notYet: "---",
    active: "Active",
    inProgress: "In Progress"
  },
  ar: {
    title: "إحالاتك",
    noReferrals: "لا توجد إحالات بعد",
    noReferralsDesc: "شارك رابطك لتبدأ الربح",
    kyc: "تحقق",
    deposit: "إيداع",
    holding: "الاحتفاظ",
    eligible: "الحالة",
    voucher: "القسيمة",
    verified: "موثّق",
    pending: "معلّق",
    days: "يوم",
    daysLeft: "يوم متبقي",
    paid: "مدفوع",
    notYet: "---",
    active: "نشط",
    inProgress: "قيد التقدم"
  }
};

export default function ReferralStatusTable({ referrals = [], language = "en" }) {
  const txt = t[language] || t.en;

  if (!referrals || referrals.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <Users className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <p className="font-medium text-muted-foreground">{txt.noReferrals}</p>
          <p className="text-sm text-muted-foreground/70">{txt.noReferralsDesc}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md overflow-hidden">
      <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Users className="w-4 h-4" />
          {txt.title}
          <Badge variant="secondary" className="ml-auto">{referrals.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/20">
              <tr className="text-left text-muted-foreground text-xs">
                <th className="p-3 font-medium">User</th>
                <th className="p-3 font-medium text-center">{txt.kyc}</th>
                <th className="p-3 font-medium text-center">{txt.deposit}</th>
                <th className="p-3 font-medium text-center">{txt.holding}</th>
                <th className="p-3 font-medium text-center">{txt.eligible}</th>
                <th className="p-3 font-medium text-center">{txt.voucher}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {referrals.map((ref) => (
                <tr key={ref.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3">
                    <span className="font-mono text-foreground">{ref.email}</span>
                    <span className="block text-xs text-muted-foreground">
                      {ref.registeredAt ? new Date(ref.registeredAt).toLocaleDateString() : "---"}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {ref.kycVerified ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-0">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> {txt.verified}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <Clock className="w-3 h-3 mr-1" /> {txt.pending}
                      </Badge>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`font-mono font-semibold ${ref.netDeposit >= 100 ? "text-emerald-600" : "text-foreground"}`}>
                      ${ref.netDeposit.toFixed(0)}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {ref.holdingDays100 > 0 ? (
                      <div className="space-y-1">
                        <Progress value={(ref.holdingDays100 / 30) * 100} className="h-1.5 w-16 mx-auto" />
                        <span className="text-xs text-muted-foreground">
                          {ref.holdingDays100 >= 30 ? "30+" : `${30 - ref.holdingDays100} ${txt.daysLeft}`}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">---</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {ref.isEligible100 ? (
                      <Badge className="bg-emerald-500 text-white">{txt.active}</Badge>
                    ) : ref.holdingDays100 > 0 ? (
                      <Badge variant="outline" className="border-amber-500 text-amber-600">{txt.inProgress}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">{txt.pending}</Badge>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {ref.voucherPaid ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-0">
                        <DollarSign className="w-3 h-3 mr-0.5" />$10 {txt.paid}
                      </Badge>
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
        <div className="md:hidden divide-y divide-border">
          {referrals.map((ref) => (
            <div key={ref.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-sm font-medium text-foreground">{ref.email}</span>
                  <span className="block text-xs text-muted-foreground">
                    {ref.registeredAt ? new Date(ref.registeredAt).toLocaleDateString() : "---"}
                  </span>
                </div>
                {ref.isEligible100 ? (
                  <Badge className="bg-emerald-500 text-white text-xs">{txt.active}</Badge>
                ) : ref.holdingDays100 > 0 ? (
                  <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">{txt.inProgress}</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-xs">{txt.pending}</Badge>
                )}
              </div>
              
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-muted/30 rounded-lg p-2">
                  <Shield className={`w-4 h-4 mx-auto mb-1 ${ref.kycVerified ? "text-emerald-500" : "text-muted-foreground"}`} />
                  <span className="text-[10px] text-muted-foreground block">{txt.kyc}</span>
                  <span className={`text-xs font-medium ${ref.kycVerified ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {ref.kycVerified ? "✓" : "---"}
                  </span>
                </div>
                <div className="bg-muted/30 rounded-lg p-2">
                  <DollarSign className={`w-4 h-4 mx-auto mb-1 ${ref.netDeposit >= 100 ? "text-emerald-500" : "text-muted-foreground"}`} />
                  <span className="text-[10px] text-muted-foreground block">{txt.deposit}</span>
                  <span className="text-xs font-semibold text-foreground">${ref.netDeposit.toFixed(0)}</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-2">
                  <Clock className={`w-4 h-4 mx-auto mb-1 ${ref.holdingDays100 >= 30 ? "text-emerald-500" : "text-muted-foreground"}`} />
                  <span className="text-[10px] text-muted-foreground block">{txt.holding}</span>
                  <span className="text-xs font-medium text-foreground">{ref.holdingDays100}/30</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-2">
                  <DollarSign className={`w-4 h-4 mx-auto mb-1 ${ref.voucherPaid ? "text-emerald-500" : "text-muted-foreground"}`} />
                  <span className="text-[10px] text-muted-foreground block">{txt.voucher}</span>
                  <span className={`text-xs font-medium ${ref.voucherPaid ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {ref.voucherPaid ? "$10" : "---"}
                  </span>
                </div>
              </div>
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