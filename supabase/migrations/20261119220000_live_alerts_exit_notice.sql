-- Aviso de saída: guarda o placar na hora da entrada de cada método e quais avisos de saída já foram tratados.
ALTER TABLE public.live_alerts
  ADD COLUMN IF NOT EXISTS entry_goals jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS exit_notified_method_ids text[] NOT NULL DEFAULT '{}';
