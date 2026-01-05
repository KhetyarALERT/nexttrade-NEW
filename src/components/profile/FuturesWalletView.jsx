import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Search, RefreshCw, TrendingUp, TrendingDown, ArrowLeftRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import CryptoIcon from "@/components/ui/CryptoIcon";
import { base44 } from "@/api/base44Client";

export default function FuturesWalletView({
  tradingAccount,
  trades = [],
  showBalances = true,
  onTransfer,
  onRefresh,
  demoAccount,
  language = 'en'
}) {
  // Use demo account for testing - will sync with trades
  const account = demoAccount || tradingAccount;
  const [searchTerm, setSearchTerm] = useState("");
  const [hideSmallAssets, setHideSmallAssets] = useState(false);
  const [loading, setLoading] = useState(false);

  // Calculate futures account metrics from trading account and trades
  const openTrades = trades.filter((t) => t.status === 'OPEN');

  const accountAssets = account?.balance || account?.demo_balance || 0;
  const accountBalance = account?.equity || account?.demo_balance || 0;
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
        <div className="rounded-xl p-4 sm:p-6 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <span className="text-slate-400 text-xs block mb-1">Total Assets ⓘ</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-white">
                {showBalances ? formatValue(accountAssets) : "****"}
              </span>
              <span className="text-slate-400 text-sm">USDT</span>
            </div>
            <div className="text-slate-500 text-xs mt-1">≈ ${showBalances ? formatValue(accountAssets) : "****"}</div>
          </div>
          <Button
            onClick={onTransfer}
            variant="outline"
            size="sm" className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-3 text-xs font-medium rounded-xl inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground h-8 border-slate-600 hover:bg-slate-800">


            <ArrowLeftRight className="w-4 h-4 mr-1.5" /> Transfer
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="usdm" className="mb-4">
          <TabsList className="bg-transparent border-b border-slate-700 w-full justify-start rounded-none p-0 h-auto">
            <TabsTrigger
              value="usdm"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-yellow-500 data-[state=active]:bg-transparent text-slate-400 data-[state=active]:text-white px-4 py-2">

              USD-M Perp
            </TabsTrigger>
            <TabsTrigger
              value="coinm"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-yellow-500 data-[state=active]:bg-transparent text-slate-400 data-[state=active]:text-white px-4 py-2">

              Coin-M Perp
            </TabsTrigger>
            <TabsTrigger
              value="standard"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-yellow-500 data-[state=active]:bg-transparent text-slate-400 data-[state=active]:text-white px-4 py-2">

              Standard Futures
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Balance Summary */}
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-xl font-bold text-white">{showBalances ? formatValue(accountBalance) : "****"}</span>
          <span className="text-slate-400 text-sm">USDT</span>
          <span className="text-slate-500 text-xs">≈ ${showBalances ? formatValue(accountBalance) : "****"}</span>
        </div>
        
        <div className="flex items-center gap-2 mb-4">
          <span className="text-slate-400 text-xs">Today's PnL:</span>
          <span className={`text-xs font-medium ${unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {unrealizedPnl >= 0 ? '+' : ''}{showBalances ? `$${formatValue(unrealizedPnl)}` : "****"}
            {unrealizedPnl !== 0 && accountAssets > 0 &&
            <span className="ml-1">
                ({(unrealizedPnl / accountAssets * 100).toFixed(2)}%)
              </span>
            }
          </span>
        </div>

        {/* Multi-Assets Info */}
        <div className="mb-4">
          <span className="text-slate-400 text-xs font-medium">Multi-Assets Info</span>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <span className="text-slate-500 text-[10px] block">Available Margin</span>
            <span className="text-white text-sm font-medium">{showBalances ? formatValue(availableMargin) : "****"} USD</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Maintenance Margin</span>
            <span className="text-white text-sm font-medium">{showBalances ? formatValue(marginUsed * 0.5) : "****"} USD</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Effective Margin</span>
            <span className="text-white text-sm font-medium">{showBalances ? formatValue(accountBalance) : "****"} USD</span>
          </div>
        </div>
      </div>

      {/* Assets Table */}
      <div className="rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="p-4 border-b border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />

            </div>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer whitespace-nowrap">
              <Checkbox checked={hideSmallAssets} onCheckedChange={setHideSmallAssets} className="border-slate-600" />
              Hide assets &lt; 1 USD
            </label>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={loading}
              className="text-slate-400 hover:text-white">

              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] text-slate-400 border-b border-slate-800 uppercase">
                <th className="px-4 py-3 font-medium">Crypto</th>
                <th className="px-4 py-3 font-medium text-right">Account Assets</th>
                <th className="px-4 py-3 font-medium text-right">Account Balance</th>
                <th className="px-4 py-3 font-medium text-right">Unrealized PnL</th>
                <th className="px-4 py-3 font-medium text-right">Transferable</th>
                <th className="px-4 py-3 font-medium text-right">Available Margin</th>
                <th className="px-4 py-3 font-medium text-right">Position Margin</th>
                <th className="px-4 py-3 font-medium text-center">Operation</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.length === 0 ?
              <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500 text-sm">
                    No assets found
                  </td>
                </tr> :

              filteredAssets.map((asset) =>
              <tr key={asset.crypto} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CryptoIcon currency={asset.crypto} size="sm" />
                        <span className="text-white font-medium text-sm">{asset.crypto}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-white text-sm">
                      {showBalances ? formatValue(asset.accountAssets) : "****"}
                    </td>
                    <td className="px-4 py-3 text-right text-white text-sm">
                      {showBalances ? formatValue(asset.accountBalance) : "****"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-medium ${asset.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {asset.unrealizedPnl >= 0 ? '+' : ''}{showBalances ? formatValue(asset.unrealizedPnl) : "****"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-white text-sm">
                      {showBalances ? formatValue(asset.transferable) : "****"}
                    </td>
                    <td className="px-4 py-3 text-right text-white text-sm">
                      {showBalances ? formatValue(asset.availableMargin) : "****"}
                    </td>
                    <td className="px-4 py-3 text-right text-white text-sm">
                      {showBalances ? formatValue(asset.positionMargin) : "****"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                    variant="ghost"
                    size="sm"
                    onClick={onTransfer}
                    className="text-blue-400 hover:text-blue-300 text-xs h-7">

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