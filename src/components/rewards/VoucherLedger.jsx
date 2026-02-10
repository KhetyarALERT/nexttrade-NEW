import React, { useState } from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, Ticket, Crown, TrendingUp, DollarSign } from "lucide-react";

const t = {
  en: {
    title: "Your Vouchers",
    total: "Total Earned",
    redeemable: "Redeemable",
    noVouchers: "No vouchers yet",
    noVouchersDesc: "Invite friends to earn vouchers",
    all: "All",
    referral: "Referral",
    levelUp: "Level Bonus",
    depositBonus: "Deposit Bonus",
    available: "Available",
    used: "Used",
    pending: "Pending",
    revoked: "Revoked",
    tradeVoucher: "Trade Voucher"
  },
  ar: {
    title: "قسائمك",
    total: "إجمالي الأرباح",
    redeemable: "قابل للاستخدام",
    noVouchers: "لا توجد قسائم بعد",
    noVouchersDesc: "ادعُ أصدقاء لربح القسائم",
    all: "الكل",
    referral: "إحالة",
    levelUp: "مكافأة المستوى",
    depositBonus: "حافز الإيداع",
    available: "متاح",
    used: "مستخدم",
    pending: "قيد الانتظار",
    revoked: "ملغي",
    tradeVoucher: "قسيمة تداول"
  }
};

const voucherTypeConfig = {
  referral_voucher: {
    icon: Ticket,
    labelKey: "referral",
    color: "text-blue-500 bg-blue-500/12"
  },
  level_up_voucher: {
    icon: Crown,
    labelKey: "levelUp",
    color: "text-amber-600 bg-amber-500/12"
  },
  referral_deposit_voucher: {
    icon: TrendingUp,
    labelKey: "depositBonus",
    color: "text-emerald-600 bg-emerald-500/12"
  }
};

const statusConfig = {
  redeemable: { labelKey: "available", className: "bg-primary/10 text-primary border-primary/30" },
  redeemed: { labelKey: "used", className: "bg-muted text-muted-foreground border-border" },
  pending: { labelKey: "pending", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  credited: { labelKey: "available", className: "bg-primary/10 text-primary border-primary/30" },
  revoked: { labelKey: "revoked", className: "bg-destructive/10 text-destructive border-destructive/30" },
  expired: { labelKey: "used", className: "bg-muted text-muted-foreground border-border" }
};

function VoucherItem({ voucher, language }) {
  const txt = t[language] || t.en;
  const typeConfig = voucherTypeConfig[voucher.type] || voucherTypeConfig.referral_voucher;
  const Icon = typeConfig.icon;
  const status = statusConfig[voucher.status] || statusConfig.pending;

  // Format subtype for deposit bonuses
  let displaySubtype = voucher.subtype;
  if (voucher.type === 'referral_deposit_voucher' && voucher.subtype) {
    const tierMatch = voucher.subtype.match(/tier_(\d+)/);
    if (tierMatch) {
      displaySubtype = `$${tierMatch[1]}+ ${txt.tradeVoucher}`;
    }
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-card/90 border border-border/70 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${typeConfig.color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{txt[typeConfig.labelKey]}</p>
          <p className="text-xs text-muted-foreground">
            {voucher.createdAt ? new Date(voucher.createdAt).toLocaleDateString() : "—"}
            {displaySubtype && displaySubtype !== voucher.subtype && (
              <span className="ml-1">• {displaySubtype}</span>
            )}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-foreground">${voucher.amount}</p>
        <Badge variant="outline" className={`text-[10px] rounded-md ${status.className}`}>
          {txt[status.labelKey]}
        </Badge>
      </div>
    </div>
  );
}

VoucherItem.propTypes = {
  voucher: PropTypes.object.isRequired,
  language: PropTypes.string
};

export default function VoucherLedger({ 
  vouchers = [], 
  vouchersByCategory = /** @type {{referral?: any[], levelUp?: any[], depositBonus?: any[]}} */ ({}),
  totalValue = 0, 
  redeemableValue = 0,
  totalDepositBonusValue = 0,
  language = "en" 
}) {
  const txt = t[language] || t.en;
  const [activeTab, setActiveTab] = useState("all");

  // Filter vouchers based on active tab
  const getFilteredVouchers = () => {
    switch (activeTab) {
      case 'referral':
        return vouchersByCategory.referral || vouchers.filter(v => v.type === 'referral_voucher');
      case 'levelUp':
        return vouchersByCategory.levelUp || vouchers.filter(v => v.type === 'level_up_voucher');
      case 'depositBonus':
        return vouchersByCategory.depositBonus || vouchers.filter(v => v.type === 'referral_deposit_voucher');
      default:
        return vouchers;
    }
  };

  const filteredVouchers = getFilteredVouchers();

  // Count badges
  const referralCount = (vouchersByCategory.referral || vouchers.filter(v => v.type === 'referral_voucher')).length;
  const levelUpCount = (vouchersByCategory.levelUp || vouchers.filter(v => v.type === 'level_up_voucher')).length;
  const depositBonusCount = (vouchersByCategory.depositBonus || vouchers.filter(v => v.type === 'referral_deposit_voucher')).length;

  return (
    <Card className="border border-border/60 bg-card/90 rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-muted-foreground" />
            {txt.title}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <span className="text-xs text-muted-foreground block">{txt.total}</span>
              <span className="font-bold text-foreground">${totalValue}</span>
            </div>
            {redeemableValue > 0 && (
              <div className="text-right">
                <span className="text-xs text-muted-foreground block">{txt.redeemable}</span>
                <span className="font-bold text-primary">${redeemableValue}</span>
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Category Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4 rounded-xl bg-muted/10 border border-border/60">
            <TabsTrigger value="all" className="text-xs rounded-lg">
              {txt.all}
              {vouchers.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{vouchers.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="referral" className="text-xs rounded-lg">
              {txt.referral}
              {referralCount > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{referralCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="levelUp" className="text-xs rounded-lg">
              {txt.levelUp}
              {levelUpCount > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{levelUpCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="depositBonus" className="text-xs rounded-lg">
              {txt.depositBonus}
              {depositBonusCount > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{depositBonusCount}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Deposit Bonus Summary (only on deposit bonus tab) */}
          {activeTab === 'depositBonus' && totalDepositBonusValue > 0 && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/6 border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    {txt.depositBonus}
                  </span>
                </div>
                <span className="text-lg font-bold text-emerald-600">${totalDepositBonusValue}</span>
              </div>
            </div>
          )}

          {/* Voucher List */}
          {filteredVouchers.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Gift className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">{txt.noVouchers}</p>
              <p className="text-xs text-muted-foreground">{txt.noVouchersDesc}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredVouchers.map((voucher) => (
                <VoucherItem key={voucher.id} voucher={voucher} language={language} />
              ))}
            </div>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

VoucherLedger.propTypes = {
  vouchers: PropTypes.array,
  vouchersByCategory: PropTypes.object,
  totalValue: PropTypes.number,
  redeemableValue: PropTypes.number,
  totalDepositBonusValue: PropTypes.number,
  language: PropTypes.string
};