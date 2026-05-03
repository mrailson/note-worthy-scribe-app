ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS notes_input_tokens     INTEGER,
  ADD COLUMN IF NOT EXISTS notes_output_tokens    INTEGER,
  ADD COLUMN IF NOT EXISTS notes_cost_usd_est     NUMERIC(10, 6);

ALTER TABLE public.pipeline_test_runs
  ADD COLUMN IF NOT EXISTS model_override         TEXT,
  ADD COLUMN IF NOT EXISTS input_tokens           INTEGER,
  ADD COLUMN IF NOT EXISTS output_tokens          INTEGER,
  ADD COLUMN IF NOT EXISTS cost_usd_est           NUMERIC(10, 6);

CREATE INDEX IF NOT EXISTS idx_pipeline_test_runs_model_size
  ON public.pipeline_test_runs(model_override, test_size);