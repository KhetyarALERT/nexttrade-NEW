import React from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Ticket, Crown, CheckCircle2, Clock } from "lucide-react";

const t = {
  en: {
    title: "Your Vouchers",
    noVouchers: "No vouchers yet",
    noVouchersDesc: "Invite friends to start earning",
    referralBonus: "Referral Reward",
    levelUpBonus: "Level Bonus",
    available: "Available",
    used: "Used",
    pending: "Pending",
    totalEarned: "Total Earned"
  },
  ar: {
    title: "قسائمك",
    noVouchers: "لا توجد قسائم بعد",
    noVouchersDesc: "ادعُ أصدقاء لبدء الربح",
    referralBonus: "مكافأة إحالة",
    levelUpBonus: "مكافأة مستوى",
    available: "متاح",
    used: "مستخدم",
    pending: "قيد المعالجة",
    totalEarned: "إجمالي المكتسب"
  }
};

export default function VoucherLedger({ 
  vouchers = [], 
  totalValue = 0, 
  redeemableValue = 0,
  language = "en" 
}) {
  const txt = t[language] || t.en;

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Ticket className="w-4 h-4 text-muted-foreground" />
            {txt.title}
          </CardTitle>
          {totalValue > 0 && (
            <div className="text-right">
              <span className="text-xs text-muted-foreground">{txt.totalEarned}</span>
              <span className="text-lg font-bold text-primary ml-2">${totalValue}</span>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {vouchers.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Gift className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="font-medium text-foreground mb-1">{txt.noVouchers}</p>
            <p className="text-sm text-muted-foreground">{txt.noVouchersDesc}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {vouchers.map((voucher) => {
              const isReferral = voucher.type === 'referral_voucher';
              const isAvailable = voucher.status === 'redeemable';
              const isUsed = voucher.status === 'redeemed';

              return (
                <div 
                  key={voucher.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    isAvailable ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isReferral ? "bg-primary/10" : "bg-amber-500/10"
                  }`}>
                    {isReferral ? (
                      <Gift className="w-5 h-5 text-primary" />
                    ) : (
                      <Crown className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">
                      {isReferral ? txt.referralBonus : txt.levelUpBonus}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {voucher.createdAt ? new Date(voucher.createdAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <span className={`text-lg font-bold ${isUsed ? "text-muted-foreground" : "text-primary"}`}>
                      ${voucher.amount}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={`block mt-1 text-[10px] ${
                        isAvailable ? "border-primary/50 text-primary" : 
                        isUsed ? "text-muted-foreground" : "border-amber-500/50 text-amber-600"
                      }`}
                    >
                      {isAvailable ? txt.available : isUsed ? txt.used : txt.pending}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

VoucherLedger.propTypes = {
  vouchers: PropTypes.array,
  totalValue: PropTypes.number,
  redeemableValue: PropTypes.number,
  language: PropTypes.string
};