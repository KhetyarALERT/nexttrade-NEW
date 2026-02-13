-- Internal paper/simulated trades
CREATE TABLE IF NOT EXISTS public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('LONG', 'SHORT')),
  order_type TEXT NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
  quantity NUMERIC(20,8) NOT NULL,
  entry_price NUMERIC(20,8) NOT NULL,
  exit_price NUMERIC(20,8),
  leverage INTEGER NOT NULL DEFAULT 1,
  take_profit NUMERIC(20,8),
  stop_loss NUMERIC(20,8),
  margin_used NUMERIC(20,8) NOT NULL DEFAULT 0,
  realized_pnl NUMERIC(20,8) DEFAULT 0,
  fee NUMERIC(20,8) DEFAULT 0,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trades_select_own" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "trades_insert_own" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "trades_update_own" ON public.trades FOR UPDATE USING (auth.uid() = user_id);
