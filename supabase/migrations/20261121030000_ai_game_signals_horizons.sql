-- a pergunta da IA passa a ser "sai gol nos próximos 20 e 30 minutos": goal_chance = 20 min, goal_chance_30 = 30 min
ALTER TABLE public.ai_game_signals
  ADD COLUMN IF NOT EXISTS goal_chance_30 int,
  ADD COLUMN IF NOT EXISTS goal_next20 boolean,
  ADD COLUMN IF NOT EXISTS goal_next30 boolean;
