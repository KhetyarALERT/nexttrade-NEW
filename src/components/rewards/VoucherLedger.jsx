import React from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Ticket, Crown, DollarSign } from "lucide-react";

const t = {
  en: {
    title: "Your Vouchers",
    noVouchers: "No vouchers yet",
    noVouchersDesc: "Earn vouchers by inviting friends",
    referralBonus: "Referral Bonus",
    levelUpBonus: "Level Up Bonus",
    redeemable: "Redeemable",
    redeemed: "Redeemed",
    pending: "Pending",
    totalValue: "Total Value",
    redeemableValue: "Redeemable"
  },
  ar: {
    title: "قسائمك",
    noVouchers: "لا توجد قسائم بعد",
    noVouchersDesc: "اربح قسائم بدعوة الأصدقاء",
    referralBonus: "مكافأة الإحالة",
    levelUpBonus: "مكافأة الترقية",
    redeemable: "قابل للاسترداد",
    redeemed: "مستردّ",
    pending: "معلّق",
    totalValue: "القيمة الإجمالية",
    redeemableValue: "قابل للاسترداد"
  }
};

const voucherTypeConfig = {
  referral_voucher: {
    icon: Gift,
    color: "from-emerald-500 to-teal-500"
  },
  level_up_voucher: {
    icon: Crown,
    color: "from-amber-500 to-orange-500"
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
    <Card className="border-0 shadow-md">
      <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Ticket className="w-4 h-4" />
            {txt.title}
          </CardTitle>
          {totalValue > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">{txt.totalValue}:</span>
                <span className="font-bold text-foreground ml-1">${totalValue}</span>
              </div>
              {redeemableValue > 0 && (
                <Badge className="bg-emerald-500 text-white">
                  ${redeemableValue} {txt.redeemableValue}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {vouchers.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Gift className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="font-medium text-muted-foreground">{txt.noVouchers}</p>
            <p className="text-sm text-muted-foreground/70">{txt.noVouchersDesc}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {vouchers.map((voucher) => {
              const config = voucherTypeConfig[voucher.type] || voucherTypeConfig.referral_voucher;
              const Icon = config.icon;
              const isReferral = voucher.type === 'referral_voucher';

              return (
                <div 
                  key={voucher.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${config.color}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">
                      {isReferral ? txt.referralBonus : txt.levelUpBonus}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {voucher.description || (isReferral ? "Eligible referral reward" : `Level ${voucher.meta?.level || "?"} upgrade`)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-emerald-600">${voucher.amount}</p>
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] ${
                        voucher.status === 'redeemable' 
                          ? "border-emerald-500 text-emerald-600" 
                          : voucher.status === 'redeemed'
                            ? "border-muted-foreground text-muted-foreground"
                            : "border-amber-500 text-amber-600"
                      }`}
                    >
                      {voucher.status === 'redeemable' ? txt.redeemable : 
                       voucher.status === 'redeemed' ? txt.redeemed : txt.pending}
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