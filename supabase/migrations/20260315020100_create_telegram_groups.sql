-- Create telegram_groups table
CREATE TABLE IF NOT EXISTS public.telegram_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    chat_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_groups ENABLE ROW LEVEL SECURITY;

-- Basic policy for owners (placeholder, update based on your auth needs)
CREATE POLICY "Enable all for authenticated users" ON public.telegram_groups
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
