-- Create telegram_logs table for tracking all Telegram messages sent
CREATE TABLE IF NOT EXISTS public.telegram_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('signal', 'result', 'alert', 'info', 'notification')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on user_id and created_at for fast queries
CREATE INDEX IF NOT EXISTS idx_telegram_logs_user_id ON public.telegram_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_created_at ON public.telegram_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_type ON public.telegram_logs(type);

-- Enable RLS
ALTER TABLE public.telegram_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only see their own logs
CREATE POLICY "Users can view own telegram logs"
  ON public.telegram_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert telegram logs"
  ON public.telegram_logs
  FOR INSERT
  WITH CHECK (true);
