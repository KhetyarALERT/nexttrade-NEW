"use client";

import type { WalletTransaction } from "@/lib/types";
import { formatUSD } from "@/lib/utils";
import { format } from "date-fns";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CandlestickChart,
  Coins,
} from "lucide-react";

interface TransactionListProps {
  transactions: WalletTransaction[];
}

const typeIcon: Record<string, typeof ArrowDownToLine> = {
  deposit: ArrowDownToLine,
  withdrawal: ArrowUpFromLine,
  trade_buy: CandlestickChart,
  trade_sell: CandlestickChart,
  pnl: Coins,
  fee: Coins,
};

const typeColor: Record<string, string> = {
  deposit: "text-primary bg-primary/10",
  withdrawal: "text-destructive bg-destructive/10",
  trade_buy: "text-foreground bg-secondary",
  trade_sell: "text-foreground bg-secondary",
  pnl: "text-primary bg-primary/10",
  fee: "text-muted-foreground bg-secondary",
};

export function TransactionList({ transactions }: TransactionListProps) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">
          Transaction History
        </h3>
      </div>
      {transactions.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No transactions yet
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {transactions.slice(0, 10).map((tx) => {
            const Icon = typeIcon[tx.type] || Coins;
            const color = typeColor[tx.type] || "text-foreground bg-secondary";
            return (
              <div
                key={tx.id}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full ${color}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">
                      {tx.type.replace("_", " ")}
                    </p>
                    <p className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {tx.description}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`font-mono text-sm font-medium ${
                      tx.amount >= 0 ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {tx.amount >= 0 ? "+" : ""}
                    {formatUSD(tx.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(tx.created_at), "MMM d, HH:mm")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
