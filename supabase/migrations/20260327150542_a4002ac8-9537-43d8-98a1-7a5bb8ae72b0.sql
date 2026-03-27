
CREATE TYPE public.trade_status AS ENUM ('pending', 'filled', 'partial', 'cancelled', 'failed', 'stopped');
CREATE TYPE public.trade_side AS ENUM ('yes', 'no');

CREATE TABLE public.auto_trade_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  kill_switch BOOLEAN NOT NULL DEFAULT false,
  max_daily_loss NUMERIC NOT NULL DEFAULT 50,
  max_position_size NUMERIC NOT NULL DEFAULT 25,
  max_open_positions INTEGER NOT NULL DEFAULT 5,
  min_signal_score NUMERIC NOT NULL DEFAULT 7.0,
  min_confidence NUMERIC NOT NULL DEFAULT 0.6,
  cooldown_seconds INTEGER NOT NULL DEFAULT 300,
  allowed_providers TEXT[] NOT NULL DEFAULT ARRAY['kalshi', 'polymarket'],
  paper_mode BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  market_id TEXT NOT NULL,
  market_title TEXT NOT NULL,
  provider TEXT NOT NULL,
  side trade_side NOT NULL,
  entry_price NUMERIC NOT NULL,
  current_price NUMERIC,
  size NUMERIC NOT NULL,
  stop_price NUMERIC,
  target_price NUMERIC,
  status TEXT NOT NULL DEFAULT 'open',
  pnl NUMERIC DEFAULT 0,
  signal_score NUMERIC,
  confidence NUMERIC,
  setup_type TEXT,
  paper_mode BOOLEAN NOT NULL DEFAULT true,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.order_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  position_id UUID REFERENCES public.positions(id),
  market_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  side trade_side NOT NULL,
  order_type TEXT NOT NULL DEFAULT 'market',
  price NUMERIC NOT NULL,
  size NUMERIC NOT NULL,
  status trade_status NOT NULL DEFAULT 'pending',
  provider_order_id TEXT,
  error_message TEXT,
  paper_mode BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ
);

CREATE TABLE public.daily_pnl (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trade_date DATE NOT NULL DEFAULT CURRENT_DATE,
  realized_pnl NUMERIC NOT NULL DEFAULT 0,
  trade_count INTEGER NOT NULL DEFAULT 0,
  kill_switch_triggered BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, trade_date)
);

ALTER TABLE public.auto_trade_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_pnl ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own settings" ON public.auto_trade_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own positions" ON public.positions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own orders" ON public.order_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own pnl" ON public.daily_pnl FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_auto_trade_settings_updated_at BEFORE UPDATE ON public.auto_trade_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON public.positions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_daily_pnl_updated_at BEFORE UPDATE ON public.daily_pnl FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_positions_user_status ON public.positions(user_id, status);
CREATE INDEX idx_order_history_user ON public.order_history(user_id, created_at DESC);
CREATE INDEX idx_daily_pnl_user_date ON public.daily_pnl(user_id, trade_date DESC);
