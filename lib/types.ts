export type WalletAsset = {
  id: string;
  symbol: string;
  name: string;
  balance: number;
  available_balance: number;
  locked_balance: number;
  avg_buy_price: number;
};

export type Wallet = {
  id: string;
  user_id: string;
  usdt_balance: number;
  total_equity: number;
  created_at: string;
  updated_at: string;
  assets: WalletAsset[];
};

export type WalletTransaction = {
  id: string;
  wallet_id: string;
  user_id: string;
  type: "deposit" | "withdrawal" | "trade_buy" | "trade_sell" | "fee" | "pnl";
  asset: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
};

export type Trade = {
  id: string;
  user_id: string;
  symbol: string;
  side: "long" | "short";
  type: "market" | "limit";
  status: "open" | "closed" | "cancelled" | "liquidated";
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  leverage: number;
  margin: number;
  pnl: number | null;
  pnl_percent: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  opened_at: string;
  closed_at: string | null;
};

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type TickerData = {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  high: number;
  low: number;
  volume: number;
  quoteVolume: number;
};

export type OrderBookEntry = {
  price: number;
  quantity: number;
};

export type CandleData = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
