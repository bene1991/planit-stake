-- Adicionar campo de índice de confiança na tabela methods
ALTER TABLE public.methods 
ADD COLUMN indice_confianca numeric DEFAULT 0 CHECK (indice_confianca >= 0 AND indice_confianca <= 100);

-- Criar tabela de estratégias
CREATE TABLE public.estrategias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  metodo_id uuid NOT NULL REFERENCES public.methods(id) ON DELETE CASCADE,
  tipo_operacao text CHECK (tipo_operacao IN ('Back', 'Lay')),
  odd_minima numeric,
  odd_maxima numeric,
  stake_tipo text CHECK (stake_tipo IN ('fixa', 'percentual')),
  stake_valor numeric,
  tempo_minuto_inicial integer,
  tempo_minuto_final integer,
  condicoes_entrada text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security na tabela estrategias
ALTER TABLE public.estrategias ENABLE ROW LEVEL SECURITY;

-- Policies para estrategias
CREATE POLICY "Users can view their own estrategias" 
ON public.estrategias 
FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own estrategias" 
ON public.estrategias 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own estrategias" 
ON public.estrategias 
FOR UPDATE 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own estrategias" 
ON public.estrategias 
FOR DELETE 
USING (auth.uid() = owner_id);

-- Criar tabela de simulações
CREATE TABLE public.simulacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  data timestamp with time zone DEFAULT now(),
  nome_sessao text NOT NULL,
  metodo_id uuid NOT NULL REFERENCES public.methods(id) ON DELETE CASCADE,
  tipo_operacao text CHECK (tipo_operacao IN ('Back', 'Lay')),
  odd_entrada numeric,
  odd_saida numeric,
  resultado text CHECK (resultado IN ('Green', 'Red')),
  comentarios text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security na tabela simulacoes
ALTER TABLE public.simulacoes ENABLE ROW LEVEL SECURITY;

-- Policies para simulacoes
CREATE POLICY "Users can view their own simulacoes" 
ON public.simulacoes 
FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own simulacoes" 
ON public.simulacoes 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own simulacoes" 
ON public.simulacoes 
FOR UPDATE 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own simulacoes" 
ON public.simulacoes 
FOR DELETE 
USING (auth.uid() = owner_id);

-- Trigger para atualizar updated_at nas estrategias
CREATE TRIGGER update_estrategias_updated_at
BEFORE UPDATE ON public.estrategias
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para atualizar updated_at nas simulacoes
CREATE TRIGGER update_simulacoes_updated_at
BEFORE UPDATE ON public.simulacoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para calcular índice de confiança dos métodos
CREATE OR REPLACE FUNCTION public.calcular_indice_confianca(metodo_id_param uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_ops integer;
  total_greens integer;
  win_rate numeric;
  dias_consecutivos_positivos integer;
  total_dias_operados integer;
  consistencia numeric;
  indice numeric;
BEGIN
  -- Contar total de operações do método
  SELECT COUNT(*)
  INTO total_ops
  FROM method_operations mo
  JOIN games g ON mo.game_id = g.id
  JOIN methods m ON mo.method_id = m.id
  WHERE m.id = metodo_id_param AND mo.result IS NOT NULL;

  -- Se não houver operações, retornar 0
  IF total_ops = 0 THEN
    RETURN 0;
  END IF;

  -- Contar greens
  SELECT COUNT(*)
  INTO total_greens
  FROM method_operations mo
  JOIN games g ON mo.game_id = g.id
  JOIN methods m ON mo.method_id = m.id
  WHERE m.id = metodo_id_param AND mo.result = 'Green';

  -- Calcular win rate
  win_rate := (total_greens::numeric / total_ops::numeric) * 100;

  -- Calcular consistência (simplificado: proporção de greens sobre total)
  -- Uma implementação mais complexa poderia analisar dias consecutivos
  consistencia := win_rate;

  -- Calcular índice de confiança
  indice := (win_rate * 0.7) + (consistencia * 0.3);

  -- Garantir que está entre 0 e 100
  indice := LEAST(GREATEST(indice, 0), 100);

  RETURN indice;
END;
$$;

-- Função para atualizar índices de confiança de todos os métodos de um usuário
CREATE OR REPLACE FUNCTION public.atualizar_indices_confianca(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  metodo_record RECORD;
  novo_indice numeric;
BEGIN
  FOR metodo_record IN 
    SELECT id FROM methods WHERE owner_id = user_id_param
  LOOP
    novo_indice := public.calcular_indice_confianca(metodo_record.id);
    
    UPDATE methods 
    SET indice_confianca = novo_indice
    WHERE id = metodo_record.id;
  END LOOP;
END;
$$;