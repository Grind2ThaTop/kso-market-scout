ALTER TABLE public.auto_trade_settings 
ADD COLUMN IF NOT EXISTS paper_bankroll numeric NOT NULL DEFAULT 1000,
ADD COLUMN IF NOT EXISTS paper_bankroll_initial numeric NOT NULL DEFAULT 1000;