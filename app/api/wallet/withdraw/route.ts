import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const withdrawSchema = z.object({
  amount: z.number().positive(),
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
  const parsed = withdrawSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid amount" },
      { status: 400 }
    );
  }

  const { amount } = parsed.data;

  const { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!wallet) {
    return NextResponse.json(
      { error: "Wallet not found" },
      { status: 404 }
    );
  }

  if (wallet.usdt_balance < amount) {
    return NextResponse.json(
      { error: "Insufficient balance" },
      { status: 400 }
    );
  }

  const newBalance = wallet.usdt_balance - amount;

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

  await supabase.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: user.id,
    type: "withdrawal",
    asset: "USDT",
    amount: -amount,
    balance_before: wallet.usdt_balance,
    balance_after: newBalance,
    description: `Withdrew ${amount} USDT`,
  });

  return NextResponse.json({
    success: true,
    new_balance: newBalance,
  });
}
