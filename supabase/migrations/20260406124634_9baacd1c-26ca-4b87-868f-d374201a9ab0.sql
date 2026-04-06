
CREATE TABLE public.engine_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  signals_found integer DEFAULT 0,
  trades_executed integer DEFAULT 0,
  trades_skipped integer DEFAULT 0,
  paper_mode boolean DEFAULT true,
  error_message text,
  details jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.engine_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own engine runs"
  ON public.engine_runs FOR ALL
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_engine_runs_user_started ON public.engine_runs(user_id, started_at DESC);
