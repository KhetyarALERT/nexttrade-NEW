import { useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  TrendingUp,
  Eye,
  EyeOff,
  RefreshCw,
  ChevronRight,
  Info
} from "lucide-react";
import CryptoIcon from "@/components/ui/CryptoIcon";

const translations = {
  en: {
    totalBalance: "Total Balance",
    fundingAccount: "Funding Account",
    tradingAccount: "Trading Account",
    available: "Available",
    inOrders: "In Orders",
    deposit: "Deposit",
    withdraw: "Withdraw",
    transfer: "Transfer",
    trade: "Trade Now",
    noAssets: "No assets yet",
    noAssetsDesc: "Deposit funds to get started",
    viewAll: "View All",
    quickActions: "Quick Actions",
    total: "Total",
    funding: "Funding",
    trading: "Trading"
  },
  ar: {
    totalBalance: "الرصيد الكلي",
    fundingAccount: "حساب التمويل",
    tradingAccount: "حساب التداول",
    available: "المتاح",
    inOrders: "في الأوامر",
    deposit: "إيداع",
    withdraw: "سحب",
    transfer: "تحويل",
    trade: "ابدأ التداول",
    noAssets: "لا توجد أصول",
    noAssetsDesc: "قم بالإيداع للبدء",
    viewAll: "عرض الكل",
    quickActions: "إجراءات سريعة",
    total: "الإجمالي",
    funding: "التمويل",
    trading: "التداول"
  }
};

export default function WalletOverview({
  language = "en",
  showBalances = true,
  wallets = [],
  okxBalances = null,
  totalBalance = 0,
  hasOkxAccount = false,
  isFullyUnlocked = false,
  onDeposit,
  onTransfer,
  onRefresh
}) {
  const t = translations[language] || translations.en;

  const formatBalance = (val) => {
    if (!showBalances) return "****";
    if (val === null || val === undefined) return "0.00";
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatUSD = (val) => {
    if (!showBalances) return "$****";
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Calculate internal funding balance
  const fundingBalance = wallets.reduce((sum, w) => {
    if (w.currency === "USDT" || w.currency === "USDC") return sum + (w.balance || 0);
    return sum;
  }, 0);

  // OKX balances
  const tradingBalance = okxBalances?.tradingUsdt || 0;
  const fundingOkx = okxBalances?.fundingUsdt || 0;

  return (
    <div className="space-y-6">
      {/* Total Balance Card */}
      <Card className="border-border/60 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t.totalBalance}</p>
              <p className="text-3xl sm:text-4xl font-bold text-foreground">
                {formatUSD(totalBalance)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={onDeposit}
                disabled={!isFullyUnlocked}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl flex-1 sm:flex-none"
              >
                <ArrowDownToLine className="h-4 w-4 mr-2" />
                {t.deposit}
              </Button>
              <Button
                variant="outline"
                disabled={!isFullyUnlocked}
                className="rounded-xl border-border flex-1 sm:flex-none"
              >
                <ArrowUpFromLine className="h-4 w-4 mr-2" />
                {t.withdraw}
              </Button>
              <Button
                variant="outline"
                disabled={!isFullyUnlocked}
                onClick={onTransfer}
                className="rounded-xl border-border flex-1 sm:flex-none"
              >
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                {t.transfer}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Funding Account */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Wallet className="h-4 w-4 text-blue-600" />
                {t.fundingAccount}
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {t.available}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {formatUSD(fundingBalance + fundingOkx)}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onDeposit}
                disabled={!isFullyUnlocked}
                className="rounded-lg text-xs flex-1"
              >
                <ArrowDownToLine className="h-3 w-3 mr-1" />
                {t.deposit}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!isFullyUnlocked}
                className="rounded-lg text-xs flex-1"
              >
                <ArrowUpFromLine className="h-3 w-3 mr-1" />
                {t.withdraw}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Trading Account */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                {t.tradingAccount}
              </CardTitle>
              {hasOkxAccount && (
                <Badge className="bg-emerald-500/20 text-emerald-700 border-0 text-xs">
                  Active
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {hasOkxAccount ? formatUSD(tradingBalance) : "$0.00"}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!isFullyUnlocked}
                onClick={onTransfer}
                className="rounded-lg text-xs flex-1"
              >
                <ArrowLeftRight className="h-3 w-3 mr-1" />
                {t.transfer}
              </Button>
              <Button
                size="sm"
                asChild
                disabled={!isFullyUnlocked}
                className="rounded-lg text-xs flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Link to={createPageUrl("Futures")}>
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {t.trade}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assets List */}
      <Card className="border-border/60">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">
            {language === "ar" ? "الأصول" : "Assets"}
          </CardTitle>
          {wallets.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              {t.viewAll} <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {wallets.length === 0 ? (
            <div className="text-center py-8">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">{t.noAssets}</p>
              <p className="text-xs text-muted-foreground mt-1">{t.noAssetsDesc}</p>
              <Button
                onClick={onDeposit}
                disabled={!isFullyUnlocked}
                className="mt-4 bg-primary hover:bg-primary/90 rounded-xl"
              >
                <ArrowDownToLine className="h-4 w-4 mr-2" />
                {t.deposit}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {wallets.slice(0, 5).map((wallet, idx) => {
                const usdValue = wallet.currency === "BTC" 
                  ? (wallet.balance || 0) * 95000 
                  : wallet.currency === "ETH" 
                  ? (wallet.balance || 0) * 3400 
                  : wallet.balance || 0;
                
                return (
                  <div
                    key={wallet.id || idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <CryptoIcon currency={wallet.currency} size="md" />
                      <div>
                        <p className="font-medium text-foreground">{wallet.currency}</p>
                        <p className="text-xs text-muted-foreground">{wallet.network || "—"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">{formatBalance(wallet.balance)}</p>
                      <p className="text-xs text-muted-foreground">{formatUSD(usdValue)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

WalletOverview.propTypes = {
  language: PropTypes.string,
  showBalances: PropTypes.bool,
  wallets: PropTypes.array,
  okxBalances: PropTypes.object,
  totalBalance: PropTypes.number,
  hasOkxAccount: PropTypes.bool,
  isFullyUnlocked: PropTypes.bool,
  onDeposit: PropTypes.func,
  onTransfer: PropTypes.func,
  onRefresh: PropTypes.func
};