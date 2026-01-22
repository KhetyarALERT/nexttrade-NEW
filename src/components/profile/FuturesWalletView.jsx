import { useState } from "react";
import PropTypes from "prop-types";
import { Search, RefreshCw, ArrowLeftRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CryptoIcon from "@/components/ui/CryptoIcon";

export default function FuturesWalletView({
  tradingAccount,
  trades = [],
  showBalances = true,
  onTransfer,
  onRefresh,
  demoAccount,
  language: _language = 'en'
}) {
  const t = _language === 'ar' ? {
    totalAssets: 'إجمالي الأصول',
    transfer: 'تحويل',
    search: 'بحث',
    hideSmall: 'إخفاء الأصول < 1 USD',
    todayPnl: 'ربح/خسارة اليوم',
    availableMargin: 'الهامش المتاح',
    maintenanceMargin: 'هامش الصيانة',
    effectiveMargin: 'الهامش الفعّال',
    operation: 'إجراء',
    noAssets: 'لا توجد أصول'
  } : {
    totalAssets: 'Total Assets',
    transfer: 'Transfer',
    search: 'Search',
    hideSmall: 'Hide assets < 1 USD',
    todayPnl: "Today's PnL",
    availableMargin: 'Available Margin',
    maintenanceMargin: 'Maintenance Margin',
    effectiveMargin: 'Effective Margin',
    operation: 'Operation',
    noAssets: 'No assets found'
  };

  // Prefer live account when available (Assets page expectation).
  const account = tradingAccount || demoAccount;
  const [searchTerm, setSearchTerm] = useState("");
  const [hideSmallAssets, setHideSmallAssets] = useState(false);
  const [loading, setLoading] = useState(false);

  // Calculate futures account metrics from trading account and trades
  const openTrades = trades.filter((t) => t.status === 'OPEN');

  const accountAssets = account?.balance ?? account?.demo_balance ?? account?.equity ?? 0;
  const accountBalance = account?.equity ?? account?.demo_balance ?? account?.balance ?? 0;
  const unrealizedPnl = account?.unrealized_pnl || 0;
  const marginUsed = account?.margin_used || 0;
  const availableMargin = accountBalance - marginUsed;
  const transferable = Math.max(0, availableMargin - marginUsed * 0.1); // Keep 10% buffer

  const formatValue = (val) => {
    if (!showBalances) return "****";
    if (val === null || val === undefined) return "0.00";
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
  };

  const handleRefresh = async () => {
    setLoading(true);
    if (onRefresh) await onRefresh();
    setLoading(false);
  };

  // Group positions by crypto
  const positionsByCrypto = {};
  openTrades.forEach((trade) => {
    const crypto = trade.symbol?.split('-')[0] || 'USDT';
    if (!positionsByCrypto[crypto]) {
      positionsByCrypto[crypto] = {
        crypto,
        accountAssets: 0,
        accountBalance: 0,
        unrealizedPnl: 0,
        transferable: 0,
        availableMargin: 0,
        positionMargin: 0,
        positions: []
      };
    }
    positionsByCrypto[crypto].positions.push(trade);
    positionsByCrypto[crypto].positionMargin += trade.margin || 0;
    positionsByCrypto[crypto].unrealizedPnl += trade.pnl || 0;
  });

  // Always show USDT as main asset
  if (!positionsByCrypto['USDT']) {
    positionsByCrypto['USDT'] = {
      crypto: 'USDT',
      accountAssets,
      accountBalance,
      unrealizedPnl,
      transferable,
      availableMargin,
      positionMargin: marginUsed,
      positions: []
    };
  } else {
    positionsByCrypto['USDT'].accountAssets = accountAssets;
    positionsByCrypto['USDT'].accountBalance = accountBalance;
    positionsByCrypto['USDT'].transferable = transferable;
    positionsByCrypto['USDT'].availableMargin = availableMargin;
  }

  const filteredAssets = Object.values(positionsByCrypto).filter((asset) => {
    if (searchTerm && !asset.crypto.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (hideSmallAssets && asset.accountAssets < 1) return false;
    return true;
  });

  return (
      <div className="space-y-4">
        {/* Header Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <span className="text-slate-600 text-xs block mb-1">{t.totalAssets}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900">
                {showBalances ? formatValue(accountAssets) : "****"}
              </span>
              <span className="text-slate-500 text-sm">USDT</span>
            </div>
            <div className="text-slate-500 text-xs mt-1">≈ ${showBalances ? formatValue(accountAssets) : "****"}</div>
          </div>
          <Button
            onClick={onTransfer}
            variant="outline"
            size="sm"
            className="border-slate-200 bg-white text-slate-900 hover:bg-slate-50 px-3 text-xs font-medium rounded-xl inline-flex items-center justify-center gap-2 whitespace-nowrap h-8"
          >
            <ArrowLeftRight className="w-4 h-4 mr-1.5" /> {t.transfer}
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="usdm" className="mb-4">
          <TabsList className="bg-transparent border-b border-slate-200 w-full justify-start rounded-none p-0 h-auto">
            <TabsTrigger
              value="usdm"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent text-slate-500 data-[state=active]:text-slate-900 px-4 py-2">

              USD-M Perp
            </TabsTrigger>
            <TabsTrigger
              value="coinm"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent text-slate-500 data-[state=active]:text-slate-900 px-4 py-2">

              Coin-M Perp
            </TabsTrigger>
            <TabsTrigger
              value="standard"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent text-slate-500 data-[state=active]:text-slate-900 px-4 py-2">

              Standard Futures
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Balance Summary */}
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-xl font-bold text-slate-900">{showBalances ? formatValue(accountBalance) : "****"}</span>
          <span className="text-slate-500 text-sm">USDT</span>
          <span className="text-slate-500 text-xs">≈ ${showBalances ? formatValue(accountBalance) : "****"}</span>
        </div>
        
        <div className="flex items-center gap-2 mb-4">
          <span className="text-slate-600 text-xs">{t.todayPnl}:</span>
          <span className={`text-xs font-medium ${unrealizedPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {unrealizedPnl >= 0 ? '+' : ''}{showBalances ? `$${formatValue(unrealizedPnl)}` : "****"}
            {unrealizedPnl !== 0 && accountAssets > 0 &&
            <span className="ml-1">
                ({(unrealizedPnl / accountAssets * 100).toFixed(2)}%)
              </span>
            }
          </span>
        </div>

        {/* Multi-Assets Info */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <span className="text-slate-500 text-[10px] block">{t.availableMargin}</span>
            <span className="text-slate-900 text-sm font-medium">{showBalances ? formatValue(availableMargin) : "****"} USD</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">{t.maintenanceMargin}</span>
            <span className="text-slate-900 text-sm font-medium">{showBalances ? formatValue(marginUsed * 0.5) : "****"} USD</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">{t.effectiveMargin}</span>
            <span className="text-slate-900 text-sm font-medium">{showBalances ? formatValue(accountBalance) : "****"} USD</span>
          </div>
        </div>
      </div>

      {/* Assets Table */}
      <div className="rounded-2xl overflow-hidden bg-white border border-slate-200">
        <div className="p-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className={`absolute ${_language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
              <Input
                placeholder={t.search}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${_language === 'ar' ? 'pr-9' : 'pl-9'} bg-white border-slate-200 text-slate-900 placeholder:text-slate-400`} />

            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer whitespace-nowrap">
              <Checkbox checked={hideSmallAssets} onCheckedChange={setHideSmallAssets} className="border-slate-300" />
              {t.hideSmall}
            </label>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={loading}
              className="text-slate-500 hover:text-slate-900">

              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="overflow-x-hidden">
          <table className="w-full table-fixed">
            <thead>
              <tr className="text-left text-[10px] text-slate-500 border-b border-slate-100 uppercase">
                <th className="px-4 py-3 font-medium">Crypto</th>
                <th className="hidden md:table-cell px-4 py-3 font-medium text-right">Account Assets</th>
                <th className="hidden md:table-cell px-4 py-3 font-medium text-right">Account Balance</th>
                <th className="px-4 py-3 font-medium text-right">Unrealized PnL</th>
                <th className="hidden lg:table-cell px-4 py-3 font-medium text-right">Transferable</th>
                <th className="hidden lg:table-cell px-4 py-3 font-medium text-right">Available Margin</th>
                <th className="hidden lg:table-cell px-4 py-3 font-medium text-right">Position Margin</th>
                <th className="px-4 py-3 font-medium text-center">{t.operation}</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.length === 0 ?
              <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500 text-sm">
                    {t.noAssets}
                  </td>
                </tr> :

              filteredAssets.map((asset) =>
              <tr key={asset.crypto} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CryptoIcon currency={asset.crypto} size="sm" />
                        <span className="text-slate-900 font-medium text-sm">{asset.crypto}</span>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500 md:hidden">
                        <span className="text-slate-400">Assets:</span> {showBalances ? formatValue(asset.accountAssets) : "****"}
                        <span className="mx-2 text-slate-700">•</span>
                        <span className="text-slate-400">Bal:</span> {showBalances ? formatValue(asset.accountBalance) : "****"}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-right text-slate-900 text-sm">
                      {showBalances ? formatValue(asset.accountAssets) : "****"}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-right text-slate-900 text-sm">
                      {showBalances ? formatValue(asset.accountBalance) : "****"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-medium ${asset.unrealizedPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {asset.unrealizedPnl >= 0 ? '+' : ''}{showBalances ? formatValue(asset.unrealizedPnl) : "****"}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3 text-right text-slate-900 text-sm">
                      {showBalances ? formatValue(asset.transferable) : "****"}
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3 text-right text-slate-900 text-sm">
                      {showBalances ? formatValue(asset.availableMargin) : "****"}
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3 text-right text-white text-sm">
                      {showBalances ? formatValue(asset.positionMargin) : "****"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                    variant="ghost"
                    size="sm"
                    onClick={onTransfer}
                    className="text-indigo-300 hover:text-indigo-200 text-xs h-7 rounded-xl">

                        Transfer
                      </Button>
                    </td>
                  </tr>
              )
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>);

}

FuturesWalletView.propTypes = {
  tradingAccount: PropTypes.object,
  trades: PropTypes.array,
  showBalances: PropTypes.bool,
  onTransfer: PropTypes.func,
  onRefresh: PropTypes.func,
  demoAccount: PropTypes.object
};
FuturesWalletView.propTypes.language = PropTypes.string;
