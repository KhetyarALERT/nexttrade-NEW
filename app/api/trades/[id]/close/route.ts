import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { exit_price } = body;

  if (!exit_price || exit_price <= 0) {
    return NextResponse.json(
      { error: "Valid exit price is required" },
      { status: 400 }
    );
  }

  // Get the trade
  const { data: trade } = await supabase
    .from("trades")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "open")
    .single();

  if (!trade) {
    return NextResponse.json(
      { error: "Trade not found or already closed" },
      { status: 404 }
    );
  }

  // Calculate PnL
  let pnl: number;
  if (trade.side === "long") {
    pnl =
      (exit_price - trade.entry_price) *
      trade.quantity *
      trade.leverage;
  } else {
    pnl =
      (trade.entry_price - exit_price) *
      trade.quantity *
      trade.leverage;
  }
  const pnlPercent = (pnl / trade.margin) * 100;

  // Close the trade
  const { error: updateError } = await supabase
    .from("trades")
    .update({
      status: "closed",
      exit_price,
      pnl,
      pnl_percent: pnlPercent,
      closed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to close trade" },
      { status: 500 }
    );
  }

  // Return margin + PnL to wallet
  const returnAmount = trade.margin + pnl;

  const { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (wallet) {
    const newBalance = wallet.usdt_balance + returnAmount;
    await supabase
      .from("wallets")
      .update({
        usdt_balance: Math.max(0, newBalance),
        total_equity: Math.max(0, newBalance),
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id);

    await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      user_id: user.id,
      type: pnl >= 0 ? "pnl" : "pnl",
      asset: "USDT",
      amount: returnAmount,
      balance_before: wallet.usdt_balance,
      balance_after: Math.max(0, newBalance),
      description: `Closed ${trade.side.toUpperCase()} ${trade.symbol} - PnL: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} USDT`,
    });
  }

  return NextResponse.json({
    success: true,
    pnl,
    pnl_percent: pnlPercent,
    return_amount: returnAmount,
  });
}
