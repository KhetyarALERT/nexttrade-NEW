import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const tradeSchema = z.object({
  symbol: z.string(),
  side: z.enum(["long", "short"]),
  type: z.enum(["market", "limit"]),
  quantity: z.number().positive(),
  leverage: z.number().min(1).max(125),
  entry_price: z.number().positive(),
  stop_loss: z.number().optional(),
  take_profit: z.number().optional(),
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "open";

  const { data: trades } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", status)
    .order("opened_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ trades: trades || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = tradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid trade data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const trade = parsed.data;
  const margin = (trade.quantity * trade.entry_price) / trade.leverage;

  // Check wallet balance
  const { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!wallet || wallet.usdt_balance < margin) {
    return NextResponse.json(
      { error: "Insufficient margin balance" },
      { status: 400 }
    );
  }

  // Deduct margin from wallet
  const newBalance = wallet.usdt_balance - margin;
  await supabase
    .from("wallets")
    .update({
      usdt_balance: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", wallet.id);

  // Record margin deduction
  await supabase.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: user.id,
    type: "trade_buy",
    asset: "USDT",
    amount: -margin,
    balance_before: wallet.usdt_balance,
    balance_after: newBalance,
    description: `Opened ${trade.side.toUpperCase()} ${trade.symbol} - Margin: ${margin.toFixed(2)} USDT`,
  });

  // Create trade
  const { data: newTrade, error: tradeError } = await supabase
    .from("trades")
    .insert({
      user_id: user.id,
      symbol: trade.symbol,
      side: trade.side,
      type: trade.type,
      status: "open",
      entry_price: trade.entry_price,
      quantity: trade.quantity,
      leverage: trade.leverage,
      margin,
      stop_loss: trade.stop_loss || null,
      take_profit: trade.take_profit || null,
    })
    .select()
    .single();

  if (tradeError) {
    return NextResponse.json(
      { error: "Failed to create trade" },
      { status: 500 }
    );
  }

  return NextResponse.json({ trade: newTrade });
}
