import { useState } from "react";
import PropTypes from "prop-types";
import { Link, useNavigate } from "react-router-dom";
import WithdrawModal from "./WithdrawModal";
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
  Info,
  Lock,
  Clock,
  Sparkles,
  ArrowLeft
} from "lucide-react";
import CryptoIcon from "@/components/ui/CryptoIcon";
import RecentTransfersCard from "./RecentTransfersCard";

const translations = {
  en: {
    totalBalance: "Total Balance",
    totalInclStaking: "Total (incl. staking)",
    fundingAccount: "Funding Account",
    tradingAccount: "Trading Account",
    stakingLocked: "Staking (Locked)",
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
    trading: "Trading",
    staked: "Staked",
    locked: "Locked",
    unlocks: "Unlocks",
    pendingApproval: "Pending approval",
    activeLocked: "Active (locked)",
    viewStaking: "View Staking",
    noActiveStakes: "No active stakes",
    stakedFundsLocked: "Staked funds are locked and not tradable until unlock date"
  },
  ar: {
    totalBalance: "الرصيد الكلي",
    totalInclStaking: "الإجمالي (شامل الستيكنج)",
    fundingAccount: "حساب التمويل",
    tradingAccount: "حساب التداول",
    stakingLocked: "الستيكنج (مقفل)",
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
    trading: "التداول",
    staked: "مستثمر",
    locked: "مقفل",
    unlocks: "يفتح في",
    pendingApproval: "بانتظار الموافقة",
    activeLocked: "نشط (مقفل)",
    viewStaking: "عرض الستيكنج",
    noActiveStakes: "لا توجد استثمارات نشطة",
    stakedFundsLocked: "الأموال المستثمرة مقفلة ولا يمكن تداولها حتى تاريخ الفتح"
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
  stakingOverlay = null,
  copyTradingWallet = null,
  onDeposit,
  onTransfer,
  onCopyTradingDeposit,
  onRefresh,
  showBackButton = false
}) {
  const t = translations[language] || translations.en;
  const navigate = useNavigate();
  const [assetView, setAssetView] = useState("total"); // total | funding | trading | staked
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

  // Staking amounts (from overlay)
  const activeLockedUsdt = stakingOverlay?.activeLockedByCcy?.USDT || 0;
  const pendingLockedUsdt = stakingOverlay?.pendingLockedByCcy?.USDT || 0;
  const nextUnlockAt = stakingOverlay?.nextUnlockAt;
  const hasStaking = activeLockedUsdt > 0 || pendingLockedUsdt > 0;
  
  // Total including staking: OKX total + ACTIVE locked (pending is still in OKX funding)
  const totalWithStaking = totalBalance + activeLockedUsdt;

  const formatBalance = (val) => {
    if (!showBalances) return "****";
    if (val === null || val === undefined) return "0.00";
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
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
  
  // Withdrawable calculation: total funding - trading (locked in positions)
  const totalFunding = fundingBalance + fundingOkx;
  const lockedInPositions = tradingBalance;
  const withdrawableBalance = Math.max(0, totalFunding - lockedInPositions);
  
  // perCcy from OKX (contains funding + trading per currency)
  const perCcy = okxBalances?.perCcy || {};
  
  // Build unified asset list from perCcy
  const buildAssetList = () => {
    const assets = [];
    const assetMap = { ...perCcy };

    // Inject Copy Trading balance into USDT
    if (copyTradingWallet) {
      const ctTotal = (copyTradingWallet.available_balance || 0) + (copyTradingWallet.locked_balance || 0);
      if (ctTotal > 0) {
        if (!assetMap["USDT"]) assetMap["USDT"] = { total: 0, funding: 0, trading: 0 };
        // We track it in 'total' but separate from funding/trading
        // This ensures it shows up in "Total" view
      }
    }
    
    // Add all currencies
    for (const [ccy, data] of Object.entries(assetMap)) {
      let displayBalance = 0;
      let funding = data.funding || 0;
      let trading = data.trading || 0;
      let total = data.total || 0;

      // Add Internal Funding (from props.wallets) if USDT
      if (ccy === "USDT") {
        funding += fundingBalance; // Add internal wallet funding
        total += fundingBalance;
        
        // Add Copy Trading if USDT
        if (copyTradingWallet) {
          const ctTotal = (copyTradingWallet.available_balance || 0) + (copyTradingWallet.locked_balance || 0);
          total += ctTotal;
        }
      }

      if (assetView === "total") displayBalance = total;
      else if (assetView === "funding") displayBalance = funding;
      else if (assetView === "trading") displayBalance = trading;
      
      if (displayBalance > 0 || (assetView === "total" && total > 0)) {
        assets.push({
          currency: ccy,
          balance: displayBalance,
          funding,
          trading,
          total,
          usdValue: ccy === "USDT" || ccy === "USDC" ? displayBalance :
                    ccy === "BTC" ? displayBalance * 95000 :
                    ccy === "ETH" ? displayBalance * 3400 :
                    ccy === "SOL" ? displayBalance * 180 :
                    displayBalance
        });
      }
    }
    
    // Sort by USD value descending
    assets.sort((a, b) => b.usdValue - a.usdValue);
    return assets;
  };
  
  const assetList = buildAssetList();

  return (
    <div className="space-y-6">
      {/* Mobile Back Button */}
      {showBackButton && (
        <div className="lg:hidden mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === "ar" ? "رجوع" : "Back"}
          </Button>
        </div>
      )}
      
      {/* Total Balance Card */}
      <Card className="border-border/60 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t.totalBalance}</p>
              <p className="text-3xl sm:text-4xl font-bold text-foreground">
                {formatUSD(totalBalance)}
              </p>
              {activeLockedUsdt > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t.totalInclStaking}: <span className="font-medium text-foreground">{formatUSD(totalWithStaking)}</span>
                </p>
              )}
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
                onClick={() => setWithdrawModalOpen(true)}
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                onClick={() => setWithdrawModalOpen(true)}
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

        {/* Staking (Locked) Card */}
        <Card className="border-border/60 border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-600" />
                {t.stakingLocked}
              </CardTitle>
              {activeLockedUsdt > 0 && (
                <Badge className="bg-amber-500/20 text-amber-700 border-0 text-xs">
                  {t.locked}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {formatUSD(activeLockedUsdt)}
            </p>
            {nextUnlockAt ? (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t.unlocks}: {new Date(nextUnlockAt).toLocaleDateString()}
              </p>
            ) : activeLockedUsdt > 0 ? (
              <p className="text-xs text-amber-600 mt-1">Unlock date pending</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">{t.noActiveStakes}</p>
            )}
            {pendingLockedUsdt > 0 && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {t.pendingApproval}: {formatUSD(pendingLockedUsdt)}
              </p>
            )}
            <div className="mt-3">
              <Button
                size="sm"
                asChild
                variant="outline"
                className="rounded-lg text-xs w-full border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
              >
                <Link to={createPageUrl("Investing")}>
                  <Lock className="h-3 w-3 mr-1" />
                  {t.viewStaking}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Copy Trading Card - Removed and merged into Total/Assets as requested */}
      </div>

      {/* Assets List */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between mb-3">
            <CardTitle className="text-base font-semibold">
              {language === "ar" ? "الأصول" : "Assets"}
            </CardTitle>
          </div>
          {/* View Toggle */}
          <Tabs value={assetView} onValueChange={setAssetView} className="w-full">
            <TabsList className={`grid w-full max-w-md ${hasStaking ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <TabsTrigger value="total" className="text-xs">{t.total}</TabsTrigger>
              <TabsTrigger value="funding" className="text-xs">{t.funding}</TabsTrigger>
              <TabsTrigger value="trading" className="text-xs">{t.trading}</TabsTrigger>
              {hasStaking && (
                <TabsTrigger value="staked" className="text-xs">{t.staked}</TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {/* Staked Tab Content */}
          {assetView === "staked" ? (
            <div className="space-y-3">
              {/* Info banner */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <Info className="h-3.5 w-3.5 flex-shrink-0" />
                  {t.stakedFundsLocked}
                </p>
              </div>
              
              {/* Active locked */}
              {activeLockedUsdt > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div className="flex items-center gap-3">
                    <CryptoIcon currency="USDT" size="md" />
                    <div>
                      <p className="font-medium text-foreground">USDT</p>
                      <p className="text-xs text-emerald-600">{t.activeLocked}</p>
                      {nextUnlockAt && (
                        <p className="text-xs text-muted-foreground">
                          {t.unlocks}: {new Date(nextUnlockAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground font-mono">{formatBalance(activeLockedUsdt)}</p>
                  </div>
                </div>
              )}
              
              {/* Pending locked */}
              {pendingLockedUsdt > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-amber-500/20">
                  <div className="flex items-center gap-3">
                    <CryptoIcon currency="USDT" size="md" />
                    <div>
                      <p className="font-medium text-foreground">USDT</p>
                      <p className="text-xs text-amber-600">{t.pendingApproval}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground font-mono">{formatBalance(pendingLockedUsdt)}</p>
                  </div>
                </div>
              )}
              
              {!activeLockedUsdt && !pendingLockedUsdt && (
                <div className="text-center py-8">
                  <Lock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">{t.noActiveStakes}</p>
                  <Button
                    asChild
                    className="mt-4 bg-amber-600 hover:bg-amber-700 rounded-xl"
                  >
                    <Link to={createPageUrl("Investing")}>
                      <Lock className="h-4 w-4 mr-2" />
                      {t.viewStaking}
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          ) : assetList.length === 0 ? (
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
              {assetList.map((asset, idx) => (
                <div
                  key={asset.currency}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <CryptoIcon currency={asset.currency} size="md" />
                    <div>
                      <p className="font-medium text-foreground">{asset.currency}</p>
                      {assetView === "total" && (asset.funding > 0 || asset.trading > 0) && (
                        <p className="text-xs text-muted-foreground">
                          {asset.funding > 0 && `F: ${formatBalance(asset.funding)}`}
                          {asset.funding > 0 && asset.trading > 0 && " • "}
                          {asset.trading > 0 && `T: ${formatBalance(asset.trading)}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground font-mono">{formatBalance(asset.balance)}</p>
                    {asset.currency !== "USDT" && asset.currency !== "USDC" && (
                      <p className="text-xs text-muted-foreground">{formatUSD(asset.usdValue)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Transfers */}
      <RecentTransfersCard language={language} limit={5} />
      
      {/* Withdraw Modal */}
      <WithdrawModal
        open={withdrawModalOpen}
        onOpenChange={setWithdrawModalOpen}
        language={language}
        onSuccess={onRefresh}
        walletData={{
          withdrawable: withdrawableBalance,
          locked: lockedInPositions,
          pending: 0
        }}
      />
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
  stakingOverlay: PropTypes.object,
  copyTradingWallet: PropTypes.object,
  onDeposit: PropTypes.func,
  onTransfer: PropTypes.func,
  onCopyTradingDeposit: PropTypes.func,
  onRefresh: PropTypes.func,
  showBackButton: PropTypes.bool
};