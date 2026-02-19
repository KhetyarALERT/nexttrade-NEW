"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatUSD } from "@/lib/utils";

interface TradePanelProps {
  symbol: string;
  lastPrice: number;
  walletBalance: number;
  onTradeExecuted: () => void;
}

export function TradePanel({
  symbol,
  lastPrice,
  walletBalance,
  onTradeExecuted,
}: TradePanelProps) {
  const [side, setSide] = useState<"long" | "short">("long");
  const [quantity, setQuantity] = useState("");
  const [leverage, setLeverage] = useState(10);
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [loading, setLoading] = useState(false);

  const qty = parseFloat(quantity) || 0;
  const margin = lastPrice > 0 ? (qty * lastPrice) / leverage : 0;
  const notionalValue = qty * lastPrice;

  const leverageOptions = [1, 2, 5, 10, 20, 50, 75, 100, 125];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (margin > walletBalance) {
      toast.error("Insufficient margin balance");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          side,
          type: "market",
          quantity: qty,
          leverage,
          entry_price: lastPrice,
          stop_loss: stopLoss ? parseFloat(stopLoss) : undefined,
          take_profit: takeProfit ? parseFloat(takeProfit) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to open trade");
        return;
      }

      toast.success(
        `${side.toUpperCase()} ${symbol} opened at ${lastPrice.toFixed(2)}`
      );
      setQuantity("");
      setStopLoss("");
      setTakeProfit("");
      onTradeExecuted();
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      {/* Side toggle */}
      <div className="flex gap-1 border-b border-border p-3">
        <button
          type="button"
          onClick={() => setSide("long")}
          className={`flex-1 rounded-md py-2 text-xs font-semibold transition-colors ${
            side === "long"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          Long
        </button>
        <button
          type="button"
          onClick={() => setSide("short")}
          className={`flex-1 rounded-md py-2 text-xs font-semibold transition-colors ${
            side === "short"
              ? "bg-destructive text-destructive-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          Short
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {/* Market price display */}
        <div className="rounded-lg bg-secondary/50 p-2 text-center">
          <span className="text-xs text-muted-foreground">Market Price</span>
          <p className="font-mono text-sm font-semibold text-foreground">
            {formatUSD(lastPrice)}
          </p>
        </div>

        {/* Quantity */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            Quantity ({symbol.replace("USDT", "")})
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0.00"
            step="any"
            min="0"
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        {/* Leverage */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Leverage</label>
            <span className="font-mono text-xs font-semibold text-primary">
              {leverage}x
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {leverageOptions.map((lev) => (
              <button
                type="button"
                key={lev}
                onClick={() => setLeverage(lev)}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  leverage === lev
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {lev}x
              </button>
            ))}
          </div>
        </div>

        {/* SL/TP */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Stop Loss
            </label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="Optional"
              step="any"
              className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Take Profit
            </label>
            <input
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder="Optional"
              step="any"
              className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Order summary */}
        <div className="space-y-1 rounded-lg bg-secondary/50 p-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Notional</span>
            <span className="text-foreground">{formatUSD(notionalValue)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Margin</span>
            <span className="text-foreground">{formatUSD(margin)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Available</span>
            <span className="text-foreground">
              {formatUSD(walletBalance)}
            </span>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="border-t border-border p-3">
        <button
          type="submit"
          disabled={loading || qty <= 0 || margin > walletBalance}
          className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 ${
            side === "long"
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
          }`}
        >
          {loading
            ? "Opening..."
            : `${side === "long" ? "Buy/Long" : "Sell/Short"} ${symbol.replace("USDT", "")}`}
        </button>
      </div>
    </form>
  );
}
