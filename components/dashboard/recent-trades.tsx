"use client";

import type { Trade } from "@/lib/types";
import { formatUSD } from "@/lib/utils";
import { format } from "date-fns";

interface RecentTradesProps {
  trades: Trade[];
}

export function RecentTrades({ trades }: RecentTradesProps) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">
          Recent Trades
        </h3>
      </div>
      {trades.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No trades yet. Start trading!
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {trades.slice(0, 8).map((trade) => (
            <div
              key={trade.id}
              className="flex items-center justify-between px-4 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex rounded px-1.5 py-0.5 text-xs font-semibold ${
                    trade.side === "long"
                      ? "bg-primary/10 text-primary"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {trade.side.toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {trade.symbol.replace("USDT", "/USDT")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(trade.opened_at), "MMM d, HH:mm")}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm text-foreground">
                  {formatUSD(trade.entry_price)}
                </p>
                {trade.pnl !== null && (
                  <p
                    className={`font-mono text-xs ${
                      trade.pnl >= 0 ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {trade.pnl >= 0 ? "+" : ""}
                    {formatUSD(trade.pnl)}
                  </p>
                )}
                {trade.status === "open" && (
                  <span className="text-xs text-muted-foreground">Open</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
