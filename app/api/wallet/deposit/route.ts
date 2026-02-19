import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const depositSchema = z.object({
  amount: z.number().positive().max(1000000),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = depositSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid amount" },
      { status: 400 }
    );
  }

  const { amount } = parsed.data;

  // Get current wallet
  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (walletError || !wallet) {
    return NextResponse.json(
      { error: "Wallet not found" },
      { status: 404 }
    );
  }

  const newBalance = wallet.usdt_balance + amount;

  // Update wallet balance
  const { error: updateError } = await supabase
    .from("wallets")
    .update({
      usdt_balance: newBalance,
      total_equity: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", wallet.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update wallet" },
      { status: 500 }
    );
  }

  // Record transaction
  await supabase.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: user.id,
    type: "deposit",
    asset: "USDT",
    amount,
    balance_before: wallet.usdt_balance,
    balance_after: newBalance,
    description: `Deposited ${amount} USDT`,
  });

  return NextResponse.json({
    success: true,
    new_balance: newBalance,
  });
}
