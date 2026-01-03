import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Search, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import CryptoIcon from "@/components/ui/CryptoIcon";
import { marketStore } from "@/components/trading/marketStore";

// Top coins to display
const TOP_COINS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'MATIC', 'DOT', 'LTC', 'UNI', 'LINK', 'AVAX', 'ATOM', 'XLM'];

export default function SpotWalletView({ spotBalance = 0, onDeposit, onWithdraw, showBalances = true }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [hideZeroBalances, setHideZeroBalances] = useState(true);
  const [prices, setPrices] = useState({});
  const [changes, setChanges] = useState({});

  useEffect(() => {
    // Subscribe to market data for top coins
    const symbols = TOP_COINS.map(c => `${c}-USDT`);
    
    symbols.forEach(symbol => {
      marketStore.subscribeToTicker(symbol);
    });

    const updatePrices = (data) => {
      setPrices(data.prices || {});
      setChanges(data.tickers || {});
    };

    marketStore.subscribe(updatePrices);

    return () => {
      marketStore.unsubscribe(updatePrices);
    };
  }, []);

  const formatPrice = (price) => {
    if (!price) return "--";
    if (price >= 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (price >= 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  };

  const formatChange = (change) => {
    if (change === undefined || change === null) return "0.00%";
    return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
  };

  const getFilteredCoins = () => {
    let coins = TOP_COINS;
    if (searchTerm) {
      coins = coins.filter(c => c.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return coins;
  };

  const filteredCoins = getFilteredCoins();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#1a1a2e] rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-slate-400 text-xs block mb-1">Total Assets (USDT)</span>
            <div className="text-2xl font-bold text-white">
              {showBalances ? `$${spotBalance.toFixed(2)}` : "****"}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={onDeposit} size="sm" className="bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none">
              Deposit
            </Button>
            <Button onClick={onWithdraw} size="sm" variant="outline" className="border-slate-600 text-white hover:bg-slate-800 flex-1 sm:flex-none">
              Withdraw
            </Button>
          </div>
        </div>
      </div>

      {/* Asset List */}
      <div className="bg-[#1a1a2e] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search coin"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer whitespace-nowrap">
              <Checkbox checked={hideZeroBalances} onCheckedChange={setHideZeroBalances} className="border-slate-600" />
              Hide 0 balance
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px]">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
                <th className="px-4 py-2 font-medium">Crypto</th>
                <th className="px-4 py-2 font-medium text-right">Amount | Value</th>
                <th className="px-4 py-2 font-medium text-right">Last Price</th>
                <th className="px-4 py-2 font-medium text-right">24h Change</th>
              </tr>
            </thead>
            <tbody>
              {filteredCoins.map((coin) => {
                const symbol = `${coin}-USDT`;
                const price = prices[symbol] || 0;
                const ticker = changes[symbol] || {};
                const change24h = ticker.priceChangePercent || 0;
                const balance = 0; // From spot wallet balance

                if (hideZeroBalances && balance === 0) return null;

                return (
                  <tr key={coin} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CryptoIcon currency={coin} size="sm" />
                        <div>
                          <div className="text-white font-medium text-sm">{coin}</div>
                          <div className="text-slate-500 text-xs">{coin}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-white text-sm">{balance.toFixed(6)}</div>
                      <div className="text-slate-500 text-xs">{showBalances ? `$${(balance * price).toFixed(2)}` : '****'}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-slate-300 text-sm font-mono">{formatPrice(price)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className={`flex items-center justify-end gap-1 text-sm font-medium ${
                        change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {formatChange(change24h)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

SpotWalletView.propTypes = {
  spotBalance: PropTypes.number,
  onDeposit: PropTypes.func,
  onWithdraw: PropTypes.func,
  showBalances: PropTypes.bool
};