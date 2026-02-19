"use client";

import { useBinanceTicker, POPULAR_SYMBOLS } from "@/lib/binance";
import { formatUSD, formatPercent } from "@/lib/utils";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";

export function MarketOverview() {
  const tickers = useBinanceTicker(POPULAR_SYMBOLS);

  const sorted = POPULAR_SYMBOLS.map((s) => tickers[s]).filter(Boolean).sort(
    (a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent)
  );

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">
          Market Overview
        </h3>
      </div>
      <div className="divide-y divide-border/50">
        {sorted.length === 0 &&
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="h-4 w-20 animate-pulse rounded bg-secondary" />
              <div className="h-4 w-16 animate-pulse rounded bg-secondary" />
            </div>
          ))}
        {sorted.map((ticker) => (
          <Link
            key={ticker.symbol}
            href={`/trade?symbol=${ticker.symbol}`}
            className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-secondary/30"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full ${
                  ticker.priceChangePercent >= 0
                    ? "bg-primary/10"
                    : "bg-destructive/10"
                }`}
              >
                {ticker.priceChangePercent >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                )}
              </div>
              <div>
                <span className="text-sm font-medium text-foreground">
                  {ticker.symbol.replace("USDT", "")}
                </span>
                <span className="ml-1 text-xs text-muted-foreground">
                  /USDT
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm text-foreground">
                {formatUSD(ticker.price)}
              </p>
              <p
                className={`font-mono text-xs ${
                  ticker.priceChangePercent >= 0
                    ? "text-primary"
                    : "text-destructive"
                }`}
              >
                {formatPercent(ticker.priceChangePercent)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
