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
  ArrowLeft,
  Activity
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
  const [assetView, setAssetView] = useState("total");
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

  const activeLockedUsdt = stakingOverlay?.activeLockedByCcy?.USDT || 0;
  const totalWithStaking = totalBalance + activeLockedUsdt;

  const formatUSD = (val) => {
    if (!showBalances) return "$****";
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fundingBalance = wallets.reduce((sum, w) => {
    if (w.currency === "USDT" || w.currency === "USDC") return sum + (w.balance || 0);
    return sum;
  }, 0);

  const tradingBalance = okxBalances?.tradingUsdt || 0;
  const fundingOkx = okxBalances?.fundingUsdt || 0;
  const perCcy = okxBalances?.perCcy || {};
  
  const buildAssetList = () => {
    const assets = [];
    const assetMap = { ...perCcy };

    if (copyTradingWallet) {
      const ctTotal = (copyTradingWallet.available_balance || 0) + (copyTradingWallet.locked_balance || 0);
      if (ctTotal > 0) {
        if (!assetMap["USDT"]) assetMap["USDT"] = { total: 0, funding: 0, trading: 0 };
      }
    }
    
    for (const [ccy, data] of Object.entries(assetMap)) {
      let displayBalance = 0;
      let funding = data.funding || 0;
      let trading = data.trading || 0;
      let total = data.total || 0;

      if (ccy === "USDT") {
        funding += fundingBalance;
        total += fundingBalance;
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
    
    assets.sort((a, b) => b.usdValue - a.usdValue);
    return assets;
  };
  
  const assetList = buildAssetList();

  return (
    <div className="space-y-8">
      {/* Total Balance Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-transparent to-transparent overflow-hidden">
        <CardContent className="p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-8">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t.totalBalance}</p>
              <p className="text-4xl sm:text-5xl font-bold tracking-tighter text-foreground">
                {formatUSD(totalBalance)}
              </p>
              {activeLockedUsdt > 0 && (
                <p className="text-xs font-medium text-muted-foreground">
                  {t.totalInclStaking}: <span className="text-foreground">{formatUSD(totalWithStaking)}</span>
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={onDeposit}
                disabled={!isFullyUnlocked}
                className="rounded-xl h-11 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20"
              >
                <ArrowDownToLine className="h-4 w-4 mr-2" />
                {t.deposit}
              </Button>
              <Button
                variant="outline"
                disabled={!isFullyUnlocked}
                onClick={() => setWithdrawModalOpen(true)}
                className="rounded-xl h-11 px-6 border-border/40 bg-background/50 backdrop-blur-sm font-bold"
              >
                <ArrowUpFromLine className="h-4 w-4 mr-2" />
                {t.withdraw}
              </Button>
              <Button
                variant="outline"
                disabled={!isFullyUnlocked}
                onClick={onTransfer}
                className="rounded-xl h-11 px-6 border-border/40 bg-background/50 backdrop-blur-sm font-bold"
              >
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                {t.transfer}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Funding Account */}
        <Card className="border-border/40 bg-card/30">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4 text-blue-500" />
                {t.fundingAccount}
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-bold border-none bg-blue-500/10 text-blue-500">
                {t.available}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-2xl font-bold tracking-tight">
              {formatUSD(fundingBalance + fundingOkx)}
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="w-full rounded-lg h-9 text-xs font-bold"
              onClick={onDeposit}
            >
              Add Funds
            </Button>
          </CardContent>
        </Card>

        {/* Trading Account */}
        <Card className="border-border/40 bg-card/30">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-500" />
                {t.tradingAccount}
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-bold border-none bg-emerald-500/10 text-emerald-500">
                Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-2xl font-bold tracking-tight">
              {formatUSD(tradingBalance)}
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="w-full rounded-lg h-9 text-xs font-bold"
              asChild
            >
              <Link to={createPageUrl("Futures")}>Go to Trading</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Staking Account */}
        <Card className="border-border/40 bg-card/30">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Lock className="h-4 w-4 text-purple-500" />
                {t.stakingLocked}
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-bold border-none bg-purple-500/10 text-purple-500">
                Staked
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-2xl font-bold tracking-tight">
              {formatUSD(activeLockedUsdt)}
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="w-full rounded-lg h-9 text-xs font-bold"
              asChild
            >
              <Link to={createPageUrl("Investing")}>Manage Staking</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Assets List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Your Assets
          </h2>
          <div className="flex items-center gap-1 p-1 bg-muted/30 border border-border/40 rounded-lg">
            {["total", "funding", "trading"].map((view) => (
              <Button
                key={view}
                variant={assetView === view ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setAssetView(view)}
                className={`rounded-md px-3 h-7 text-[10px] font-bold uppercase tracking-wider ${assetView === view ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              >
                {t[view]}
              </Button>
            ))}
          </div>
        </div>

        <Card className="border-border/40 bg-card/30 overflow-hidden">
          <div className="divide-y divide-border/40">
            {assetList.length > 0 ? (
              assetList.map((asset) => (
                <div key={asset.currency} className="p-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-background border border-border/40">
                      <CryptoIcon currency={asset.currency} className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{asset.currency}</p>
                      <p className="text-[10px] font-medium text-muted-foreground">
                        {asset.currency === "USDT" ? "Tether USD" : asset.currency}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-foreground">
                      {showBalances ? asset.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : "****"}
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground">
                      {formatUSD(asset.usdValue)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center">
                <p className="text-sm font-medium text-muted-foreground">{t.noAssets}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{t.noAssetsDesc}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <RecentTransfersCard language={language} />

      <WithdrawModal
        open={withdrawModalOpen}
        onOpenChange={setWithdrawModalOpen}
        language={language}
        withdrawableBalance={withdrawableBalance}
        onSuccess={onRefresh}
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
