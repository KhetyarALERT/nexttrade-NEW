-- Internal ledger wallet
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'USDT',
  balance NUMERIC(20,8) NOT NULL DEFAULT 10000,
  locked_balance NUMERIC(20,8) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, currency)
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallets_select_own" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wallets_update_own" ON public.wallets FOR UPDATE USING (auth.uid() = user_id);

-- Wallet transactions (deposits, withdrawals, trade settlements)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'trade_open', 'trade_close', 'fee', 'pnl')),
  amount NUMERIC(20,8) NOT NULL,
  balance_after NUMERIC(20,8) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_tx_select_own" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wallet_tx_insert_own" ON public.wallet_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
