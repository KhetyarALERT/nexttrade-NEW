"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatUSD } from "@/lib/utils";
import { ArrowDownToLine, ArrowUpFromLine, X } from "lucide-react";

interface WalletCardProps {
  balance: number;
  onUpdate: () => void;
}

export function WalletCard({ balance, onUpdate }: WalletCardProps) {
  const [showModal, setShowModal] = useState<"deposit" | "withdraw" | null>(
    null
  );
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAction() {
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (showModal === "withdraw" && val > balance) {
      toast.error("Insufficient balance");
      return;
    }

    setLoading(true);
    try {
      const endpoint =
        showModal === "deposit"
          ? "/api/wallet/deposit"
          : "/api/wallet/withdraw";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: val }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Operation failed");
        return;
      }
      toast.success(
        showModal === "deposit"
          ? `Deposited ${formatUSD(val)}`
          : `Withdrew ${formatUSD(val)}`
      );
      setShowModal(null);
      setAmount("");
      onUpdate();
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  const presets = [100, 500, 1000, 5000];

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">Wallet Balance</p>
          <p className="font-mono text-3xl font-bold text-foreground">
            {formatUSD(balance)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">USDT</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowModal("deposit")}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Deposit
          </button>
          <button
            onClick={() => setShowModal("withdraw")}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            <ArrowUpFromLine className="h-4 w-4" />
            Withdraw
          </button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {showModal === "deposit" ? "Deposit USDT" : "Withdraw USDT"}
              </h3>
              <button
                onClick={() => {
                  setShowModal(null);
                  setAmount("");
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {showModal === "withdraw" && (
              <p className="mb-3 text-xs text-muted-foreground">
                Available: {formatUSD(balance)}
              </p>
            )}

            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              step="any"
              min="0"
              className="mb-3 w-full rounded-lg border border-border bg-background px-4 py-3 text-lg text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              autoFocus
            />

            <div className="mb-4 flex gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(String(p))}
                  className="flex-1 rounded-md bg-secondary py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                >
                  {formatUSD(p)}
                </button>
              ))}
            </div>

            <button
              onClick={handleAction}
              disabled={loading || !amount || parseFloat(amount) <= 0}
              className={`w-full rounded-lg py-3 text-sm font-semibold transition-colors disabled:opacity-40 ${
                showModal === "deposit"
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-secondary text-foreground hover:bg-accent"
              }`}
            >
              {loading
                ? "Processing..."
                : showModal === "deposit"
                  ? "Deposit"
                  : "Withdraw"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
