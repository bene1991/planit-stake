-- Criar tabela de status do robô
CREATE TABLE IF NOT EXISTS robot_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    last_ping TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'online', -- 'online', 'error', 'offline'
    error_count INTEGER DEFAULT 0,
    last_error_message TEXT,
    last_error_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir registro inicial se não existir
INSERT INTO robot_status (id, status)
VALUES ('00000000-0000-0000-0000-000000000000', 'online')
ON CONFLICT (id) DO NOTHING;

-- Grant permissions (assumindo que o usuário anon/authenticated precisa ler)
GRANT SELECT ON robot_status TO anon, authenticated;
GRANT ALL ON robot_status TO service_role;
