"use client";

import type { OrderBookEntry } from "@/lib/types";
import { formatCrypto } from "@/lib/utils";

interface OrderBookProps {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastPrice?: number;
}

export function OrderBook({ bids, asks, lastPrice }: OrderBookProps) {
  const maxQty = Math.max(
    ...bids.map((b) => b.quantity),
    ...asks.map((a) => a.quantity),
    1
  );

  return (
    <div className="flex h-full flex-col text-xs font-mono">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-muted-foreground">
        <span>Price (USDT)</span>
        <span>Qty</span>
        <span>Total</span>
      </div>

      {/* Asks (sells) - reversed so lowest ask is at bottom */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col justify-end">
          {[...asks].reverse().slice(0, 8).map((ask, i) => (
            <div
              key={`ask-${i}`}
              className="relative flex items-center justify-between px-3 py-0.5"
            >
              <div
                className="absolute inset-y-0 right-0 bg-destructive/10"
                style={{ width: `${(ask.quantity / maxQty) * 100}%` }}
              />
              <span className="relative z-10 text-destructive">
                {formatCrypto(ask.price, 2)}
              </span>
              <span className="relative z-10 text-foreground">
                {formatCrypto(ask.quantity, 4)}
              </span>
              <span className="relative z-10 text-muted-foreground">
                {formatCrypto(ask.price * ask.quantity, 2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Spread / last price */}
      <div className="border-y border-border px-3 py-1.5 text-center">
        <span className="text-sm font-semibold text-foreground">
          {lastPrice ? formatCrypto(lastPrice, 2) : "--"}
        </span>
      </div>

      {/* Bids (buys) */}
      <div className="flex-1 overflow-hidden">
        {bids.slice(0, 8).map((bid, i) => (
          <div
            key={`bid-${i}`}
            className="relative flex items-center justify-between px-3 py-0.5"
          >
            <div
              className="absolute inset-y-0 right-0 bg-primary/10"
              style={{ width: `${(bid.quantity / maxQty) * 100}%` }}
            />
            <span className="relative z-10 text-primary">
              {formatCrypto(bid.price, 2)}
            </span>
            <span className="relative z-10 text-foreground">
              {formatCrypto(bid.quantity, 4)}
            </span>
            <span className="relative z-10 text-muted-foreground">
              {formatCrypto(bid.price * bid.quantity, 2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
