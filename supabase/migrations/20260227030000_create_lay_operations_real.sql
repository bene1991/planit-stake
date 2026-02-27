-- Create a new table for real Lay 0x1 operations
CREATE TABLE IF NOT EXISTS public.lay_operations_real (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    fixture_id TEXT NOT NULL,
    operation_date DATE NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    league TEXT NOT NULL,
    odd_used NUMERIC NOT NULL,
    liability NUMERIC DEFAULT 1000 NOT NULL,
    stake NUMERIC NOT NULL,
    final_score_home INTEGER,
    final_score_away INTEGER,
    status TEXT CHECK (status IN ('Green', 'Red', 'Pending')) DEFAULT 'Pending',
    profit NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS policies
ALTER TABLE public.lay_operations_real ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lay operations" 
    ON public.lay_operations_real FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lay operations" 
    ON public.lay_operations_real FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lay operations" 
    ON public.lay_operations_real FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lay operations" 
    ON public.lay_operations_real FOR DELETE 
    USING (auth.uid() = user_id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_lay_operations_real_user_date ON public.lay_operations_real (user_id, operation_date);
CREATE INDEX IF NOT EXISTS idx_lay_operations_real_fixture ON public.lay_operations_real (fixture_id);
