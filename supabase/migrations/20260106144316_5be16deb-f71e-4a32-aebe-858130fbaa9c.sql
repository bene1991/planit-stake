-- Deletar jogos que NÃO estão associados ao método BTTS FILTRO ODD 2
DELETE FROM games
WHERE id NOT IN (
  SELECT DISTINCT game_id 
  FROM method_operations 
  WHERE method_id = '034249b4-b700-4454-9450-0540d177acd5'
);

-- Adicionar coluna stake_value_reais na tabela operational_settings
ALTER TABLE operational_settings 
ADD COLUMN IF NOT EXISTS stake_value_reais DECIMAL(10,2) DEFAULT 100.00;