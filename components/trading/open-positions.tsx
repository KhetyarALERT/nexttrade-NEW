"use client";

import { useState } from "react";
import type { Trade, TickerData } from "@/lib/types";
import { formatUSD, formatPercent } from "@/lib/utils";
import { toast } from "sonner";
import { X } from "lucide-react";

interface OpenPositionsProps {
  trades: Trade[];
  tickers: Record<string, TickerData>;
  onClose: () => void;
}

export function OpenPositions({ trades, tickers, onClose }: OpenPositionsProps) {
  const [closingId, setClosingId] = useState<string | null>(null);

  async function handleClose(trade: Trade) {
    const ticker = tickers[trade.symbol];
    if (!ticker) {
      toast.error("Cannot get current price");
      return;
    }

    setClosingId(trade.id);
    try {
      const res = await fetch(`/api/trades/${trade.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exit_price: ticker.price }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to close trade");
        return;
      }
      toast.success(
        `Closed ${trade.symbol} - PnL: ${data.pnl >= 0 ? "+" : ""}${data.pnl.toFixed(2)} USDT`
      );
      onClose();
    } catch {
      toast.error("Network error");
    } finally {
      setClosingId(null);
    }
  }

  function calcPnl(trade: Trade) {
    const ticker = tickers[trade.symbol];
    if (!ticker) return { pnl: 0, pnlPercent: 0 };
    const currentPrice = ticker.price;
    let pnl: number;
    if (trade.side === "long") {
      pnl = (currentPrice - trade.entry_price) * trade.quantity * trade.leverage;
    } else {
      pnl = (trade.entry_price - currentPrice) * trade.quantity * trade.leverage;
    }
    const pnlPercent = (pnl / trade.margin) * 100;
    return { pnl, pnlPercent };
  }

  if (trades.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No open positions
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Symbol</th>
            <th className="px-3 py-2 text-left font-medium">Side</th>
            <th className="px-3 py-2 text-right font-medium">Size</th>
            <th className="px-3 py-2 text-right font-medium">Entry</th>
            <th className="px-3 py-2 text-right font-medium">Mark</th>
            <th className="px-3 py-2 text-right font-medium">Lev</th>
            <th className="px-3 py-2 text-right font-medium">PnL (USDT)</th>
            <th className="px-3 py-2 text-right font-medium">ROE%</th>
            <th className="px-3 py-2 text-center font-medium">Close</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => {
            const { pnl, pnlPercent } = calcPnl(trade);
            const ticker = tickers[trade.symbol];
            return (
              <tr
                key={trade.id}
                className="border-b border-border/50 hover:bg-secondary/30"
              >
                <td className="px-3 py-2 font-medium text-foreground">
                  {trade.symbol}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded px-1.5 py-0.5 text-xs font-semibold ${
                      trade.side === "long"
                        ? "bg-primary/10 text-primary"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {trade.side.toUpperCase()}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-foreground">
                  {trade.quantity}
                </td>
                <td className="px-3 py-2 text-right font-mono text-foreground">
                  {formatUSD(trade.entry_price)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-foreground">
                  {ticker ? formatUSD(ticker.price) : "--"}
                </td>
                <td className="px-3 py-2 text-right font-mono text-primary">
                  {trade.leverage}x
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono font-semibold ${
                    pnl >= 0 ? "text-primary" : "text-destructive"
                  }`}
                >
                  {pnl >= 0 ? "+" : ""}
                  {pnl.toFixed(2)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono ${
                    pnlPercent >= 0 ? "text-primary" : "text-destructive"
                  }`}
                >
                  {formatPercent(pnlPercent)}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => handleClose(trade)}
                    disabled={closingId === trade.id}
                    className="inline-flex items-center justify-center rounded bg-secondary px-2 py-1 text-xs text-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                    aria-label={`Close ${trade.symbol} position`}
                  >
                    {closingId === trade.id ? (
                      "..."
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
