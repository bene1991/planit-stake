-- Tabela principal de entradas BTTS
CREATE TABLE public.btts_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  league TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  odd NUMERIC NOT NULL,
  stake_value NUMERIC NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('Green', 'Red', 'Void')),
  method TEXT DEFAULT 'BTTS',
  profit NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de configurações de saúde BTTS
CREATE TABLE public.btts_health_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE,
  stake_percent NUMERIC DEFAULT 3.0,
  bankroll_initial NUMERIC DEFAULT 5000,
  bankroll_current NUMERIC DEFAULT 5000,
  bankroll_peak NUMERIC DEFAULT 5000,
  pause_until TIMESTAMPTZ,
  stake_reduction_until TIMESTAMPTZ,
  stake_reduction_percent NUMERIC DEFAULT 0,
  odd_range_min NUMERIC DEFAULT 2.05,
  odd_range_max NUMERIC DEFAULT 2.55,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de ligas em quarentena
CREATE TABLE public.btts_league_quarantine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  league TEXT NOT NULL,
  quarantine_until DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner_id, league)
);

-- Enable RLS
ALTER TABLE public.btts_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.btts_health_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.btts_league_quarantine ENABLE ROW LEVEL SECURITY;

-- RLS Policies for btts_entries
CREATE POLICY "Users can view their own btts entries"
ON public.btts_entries FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own btts entries"
ON public.btts_entries FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own btts entries"
ON public.btts_entries FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own btts entries"
ON public.btts_entries FOR DELETE
USING (auth.uid() = owner_id);

-- RLS Policies for btts_health_settings
CREATE POLICY "Users can view their own btts settings"
ON public.btts_health_settings FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own btts settings"
ON public.btts_health_settings FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own btts settings"
ON public.btts_health_settings FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own btts settings"
ON public.btts_health_settings FOR DELETE
USING (auth.uid() = owner_id);

-- RLS Policies for btts_league_quarantine
CREATE POLICY "Users can view their own league quarantine"
ON public.btts_league_quarantine FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own league quarantine"
ON public.btts_league_quarantine FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own league quarantine"
ON public.btts_league_quarantine FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own league quarantine"
ON public.btts_league_quarantine FOR DELETE
USING (auth.uid() = owner_id);

-- Trigger para updated_at
CREATE TRIGGER update_btts_entries_updated_at
BEFORE UPDATE ON public.btts_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_btts_health_settings_updated_at
BEFORE UPDATE ON public.btts_health_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();