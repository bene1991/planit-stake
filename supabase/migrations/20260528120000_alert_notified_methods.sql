-- Track which methods (strategy_simulations) already received a Telegram notification
-- for a given alert. Enables per-method notification while still allowing retries.
alter table public.live_alerts
  add column if not exists notified_method_ids text[] not null default '{}';
