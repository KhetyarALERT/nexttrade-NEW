import React from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Ticket, Crown, Wallet, CheckCircle2, Clock } from "lucide-react";

const t = {
  en: {
    title: "Your Vouchers",
    subtitle: "Trade vouchers earned from referrals",
    noVouchers: "No vouchers yet",
    noVouchersDesc: "Invite friends to start earning vouchers",
    noVouchersTip: "Vouchers can be used for copy trading",
    referralBonus: "Referral Reward",
    levelUpBonus: "Level Bonus",
    redeemable: "Ready to Use",
    redeemed: "Used",
    pending: "Processing",
    totalEarned: "Total Earned",
    available: "Available"
  },
  ar: {
    title: "قسائمك",
    subtitle: "قسائم التداول المكتسبة من الإحالات",
    noVouchers: "لا توجد قسائم بعد",
    noVouchersDesc: "ادعُ أصدقاء لبدء كسب القسائم",
    noVouchersTip: "يمكن استخدام القسائم لنسخ التداول",
    referralBonus: "مكافأة إحالة",
    levelUpBonus: "مكافأة مستوى",
    redeemable: "جاهز للاستخدام",
    redeemed: "مستخدم",
    pending: "قيد المعالجة",
    totalEarned: "إجمالي المكتسب",
    available: "متاح"
  }
};

const voucherTypeConfig = {
  referral_voucher: {
    icon: Gift,
    color: "from-emerald-500 to-teal-500",
    bgLight: "from-emerald-500/10 to-teal-500/10"
  },
  level_up_voucher: {
    icon: Crown,
    color: "from-amber-500 to-orange-500",
    bgLight: "from-amber-500/10 to-orange-500/10"
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
    <Card className="border border-border/50 bg-card shadow-lg overflow-hidden">
      <CardHeader className="py-4 px-5 bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Ticket className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">{txt.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{txt.subtitle}</p>
            </div>
          </div>
        </div>
        
        {/* Summary Stats */}
        {totalValue > 0 && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
            <div className="flex-1 bg-muted/30 rounded-xl p-3 text-center">
              <span className="text-xs text-muted-foreground block mb-1">{txt.totalEarned}</span>
              <span className="text-xl font-bold text-foreground">${totalValue}</span>
            </div>
            <div className="flex-1 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 rounded-xl p-3 text-center border border-emerald-500/20">
              <span className="text-xs text-emerald-600 block mb-1">{txt.available}</span>
              <span className="text-xl font-bold text-emerald-600">${redeemableValue}</span>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-4">
        {vouchers.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/10 to-pink-500/10 flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-10 h-10 text-purple-400/50" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">{txt.noVouchers}</h3>
            <p className="text-sm text-muted-foreground mb-3">{txt.noVouchersDesc}</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 text-purple-600">
              <Ticket className="w-4 h-4" />
              <span className="text-sm font-medium">{txt.noVouchersTip}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {vouchers.map((voucher) => {
              const config = voucherTypeConfig[voucher.type] || voucherTypeConfig.referral_voucher;
              const Icon = config.icon;
              const isReferral = voucher.type === 'referral_voucher';
              const isRedeemable = voucher.status === 'redeemable';
              const isRedeemed = voucher.status === 'redeemed';

              return (
                <div 
                  key={voucher.id}
                  className={`relative rounded-2xl border overflow-hidden transition-all ${
                    isRedeemable 
                      ? "border-emerald-500/30 bg-gradient-to-r from-emerald-500/5 to-transparent" 
                      : isRedeemed
                        ? "border-border/50 bg-muted/30 opacity-60"
                        : "border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-transparent"
                  }`}
                >
                  <div className="p-4 flex items-center gap-4">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${config.color} shadow-lg flex-shrink-0`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground">
                          {isReferral ? txt.referralBonus : txt.levelUpBonus}
                        </span>
                        {isRedeemable && (
                          <Badge className="bg-emerald-500 text-white text-[10px] px-2 py-0">
                            <CheckCircle2 className="w-3 h-3 mr-0.5" />
                            {txt.redeemable}
                          </Badge>
                        )}
                        {!isRedeemable && !isRedeemed && (
                          <Badge variant="outline" className="border-amber-500 text-amber-600 text-[10px] px-2 py-0">
                            <Clock className="w-3 h-3 mr-0.5" />
                            {txt.pending}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {voucher.description || (isReferral ? "Friend became eligible" : `Level ${voucher.meta?.level || "?"} reached`)}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {voucher.createdAt ? new Date(voucher.createdAt).toLocaleDateString() : ""}
                      </p>
                    </div>
                    
                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <span className={`text-2xl font-bold ${
                        isRedeemable ? "text-emerald-600" : isRedeemed ? "text-muted-foreground" : "text-amber-600"
                      }`}>
                        ${voucher.amount}
                      </span>
                    </div>
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