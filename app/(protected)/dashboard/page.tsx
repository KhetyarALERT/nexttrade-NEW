"use client";

import { useState, useEffect, useCallback } from "react";
import { WalletCard } from "@/components/dashboard/wallet-card";
import { MarketOverview } from "@/components/dashboard/market-overview";
import { RecentTrades } from "@/components/dashboard/recent-trades";
import { TransactionList } from "@/components/dashboard/transaction-list";
import { AiChat } from "@/components/dashboard/ai-chat";
import { createClient } from "@/lib/supabase/client";
import type { Trade, WalletTransaction } from "@/lib/types";
import Link from "next/link";
import { CandlestickChart, Wallet } from "lucide-react";

export default function DashboardPage() {
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // Get user info
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setDisplayName(
          user.user_metadata?.display_name || user.email?.split("@")[0] || "Trader"
        );
      }

      // Get wallet data
      const walletRes = await fetch("/api/wallet");
      if (walletRes.ok) {
        const { wallet, transactions: txns } = await walletRes.json();
        setWalletBalance(wallet?.usdt_balance || 0);
        setTransactions(txns || []);
      }

      // Get all trades (both open and closed)
      const [openRes, closedRes] = await Promise.all([
        fetch("/api/trades?status=open"),
        fetch("/api/trades?status=closed"),
      ]);

      const allTrades: Trade[] = [];
      if (openRes.ok) {
        const { trades: openTrades } = await openRes.json();
        allTrades.push(...(openTrades || []));
      }
      if (closedRes.ok) {
        const { trades: closedTrades } = await closedRes.json();
        allTrades.push(...(closedTrades || []));
      }
      setTrades(allTrades);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openTrades = trades.filter((t) => t.status === "open");
  const closedTrades = trades.filter((t) => t.status === "closed");
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl p-4 lg:p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Welcome, {displayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Your trading dashboard
            </p>
          </div>
          <Link
            href="/trade"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <CandlestickChart className="h-4 w-4" />
            Start Trading
          </Link>
        </div>

        {/* Stats row */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total Equity</p>
            <p className="font-mono text-xl font-bold text-foreground">
              ${walletBalance.toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Open Positions</p>
            <p className="font-mono text-xl font-bold text-foreground">
              {openTrades.length}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total Trades</p>
            <p className="font-mono text-xl font-bold text-foreground">
              {closedTrades.length}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total P&L</p>
            <p
              className={`font-mono text-xl font-bold ${
                totalPnl >= 0 ? "text-primary" : "text-destructive"
              }`}
            >
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-2">
            <WalletCard balance={walletBalance} onUpdate={fetchData} />
            <RecentTrades trades={trades} />
            <TransactionList transactions={transactions} />
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <MarketOverview />
            <div className="h-[450px]">
              <AiChat />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
