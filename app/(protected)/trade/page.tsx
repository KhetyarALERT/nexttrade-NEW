"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { TradingChart } from "@/components/trading/trading-chart";
import { OrderBook } from "@/components/trading/order-book";
import { TradePanel } from "@/components/trading/trade-panel";
import { OpenPositions } from "@/components/trading/open-positions";
import {
  useBinanceTicker,
  useBinanceOrderBook,
  useBinanceKlines,
  POPULAR_SYMBOLS,
  TIMEFRAMES,
} from "@/lib/binance";
import { formatUSD, formatPercent } from "@/lib/utils";
import type { Trade } from "@/lib/types";
import { ChevronDown, Search } from "lucide-react";

export default function TradePage() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("15m");
  const [showSymbolSearch, setShowSymbolSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);

  // Binance data
  const allSymbols = useMemo(() => POPULAR_SYMBOLS, []);
  const tickers = useBinanceTicker(allSymbols);
  const { bids, asks } = useBinanceOrderBook(symbol);
  const { candles, loading: chartLoading } = useBinanceKlines(
    symbol,
    timeframe
  );

  const currentTicker = tickers[symbol];

  // Fetch wallet and trades
  const fetchData = useCallback(async () => {
    try {
      const [walletRes, tradesRes] = await Promise.all([
        fetch("/api/wallet"),
        fetch("/api/trades?status=open"),
      ]);
      if (walletRes.ok) {
        const { wallet } = await walletRes.json();
        setWalletBalance(wallet?.usdt_balance || 0);
      }
      if (tradesRes.ok) {
        const { trades } = await tradesRes.json();
        setOpenTrades(trades || []);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredSymbols = POPULAR_SYMBOLS.filter((s) =>
    s.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="flex items-center gap-4 border-b border-border px-4 py-2">
        {/* Symbol selector */}
        <div className="relative">
          <button
            onClick={() => setShowSymbolSearch(!showSymbolSearch)}
            className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-accent"
          >
            {symbol.replace("USDT", "/USDT")}
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>

          {showSymbolSearch && (
            <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-card p-2 shadow-xl">
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredSymbols.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSymbol(s);
                      setShowSymbolSearch(false);
                      setSearchQuery("");
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-secondary ${
                      s === symbol
                        ? "bg-primary/10 text-primary"
                        : "text-foreground"
                    }`}
                  >
                    <span className="font-medium">
                      {s.replace("USDT", "/USDT")}
                    </span>
                    {tickers[s] && (
                      <span
                        className={`font-mono ${
                          tickers[s].priceChangePercent >= 0
                            ? "text-primary"
                            : "text-destructive"
                        }`}
                      >
                        {formatPercent(tickers[s].priceChangePercent)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Ticker info */}
        {currentTicker && (
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="font-mono text-lg font-bold text-foreground">
                {formatUSD(currentTicker.price)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">24h Change</span>
              <p
                className={`font-mono font-semibold ${
                  currentTicker.priceChangePercent >= 0
                    ? "text-primary"
                    : "text-destructive"
                }`}
              >
                {formatPercent(currentTicker.priceChangePercent)}
              </p>
            </div>
            <div className="hidden md:block">
              <span className="text-muted-foreground">24h High</span>
              <p className="font-mono text-foreground">
                {formatUSD(currentTicker.high)}
              </p>
            </div>
            <div className="hidden md:block">
              <span className="text-muted-foreground">24h Low</span>
              <p className="font-mono text-foreground">
                {formatUSD(currentTicker.low)}
              </p>
            </div>
            <div className="hidden lg:block">
              <span className="text-muted-foreground">Volume</span>
              <p className="font-mono text-foreground">
                {(currentTicker.quoteVolume / 1e6).toFixed(1)}M
              </p>
            </div>
          </div>
        )}
      </header>

      {/* Main grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chart + Positions */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Timeframe selector */}
          <div className="flex gap-1 border-b border-border px-3 py-1.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${
                  timeframe === tf.value
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="flex-1">
            <TradingChart candles={candles} loading={chartLoading} />
          </div>

          {/* Positions */}
          <div className="h-48 border-t border-border lg:h-56">
            <div className="flex items-center gap-4 border-b border-border px-3 py-1.5">
              <span className="text-xs font-semibold text-foreground">
                Positions ({openTrades.length})
              </span>
            </div>
            <div className="h-[calc(100%-28px)] overflow-auto">
              <OpenPositions
                trades={openTrades}
                tickers={tickers}
                onClose={fetchData}
              />
            </div>
          </div>
        </div>

        {/* Right sidebar: Order Book + Trade Panel */}
        <div className="hidden w-72 flex-col border-l border-border lg:flex xl:w-80">
          {/* Order Book */}
          <div className="h-1/2 border-b border-border">
            <div className="border-b border-border px-3 py-1.5">
              <span className="text-xs font-semibold text-foreground">
                Order Book
              </span>
            </div>
            <div className="h-[calc(100%-28px)]">
              <OrderBook
                bids={bids}
                asks={asks}
                lastPrice={currentTicker?.price}
              />
            </div>
          </div>

          {/* Trade Panel */}
          <div className="flex-1">
            <TradePanel
              symbol={symbol}
              lastPrice={currentTicker?.price || 0}
              walletBalance={walletBalance}
              onTradeExecuted={fetchData}
            />
          </div>
        </div>
      </div>

      {/* Click outside to close symbol search */}
      {showSymbolSearch && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSymbolSearch(false)}
        />
      )}
    </div>
  );
}
