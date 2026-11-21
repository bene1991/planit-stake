-- mercado na hora da leitura: Over (gols atuais + 0,5) na Polymarket, convertido para a janela de 25 min, e o sinal em teste
ALTER TABLE public.ai_game_signals
  ADD COLUMN IF NOT EXISTS line numeric,
  ADD COLUMN IF NOT EXISTS over_price numeric,
  ADD COLUMN IF NOT EXISTS market_p25 int,
  ADD COLUMN IF NOT EXISTS edge int,
  ADD COLUMN IF NOT EXISTS signal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS market_slug text;
