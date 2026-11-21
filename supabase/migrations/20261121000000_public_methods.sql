-- Página pública /oferta: devolve só o necessário dos métodos com aviso ligado (sino), sem expor o resto da configuração
CREATE OR REPLACE FUNCTION public.public_methods()
RETURNS TABLE (id uuid, name text, entry_minute int, exit_minute int, green_stake numeric, red_stake numeric, cfg jsonb)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.name, s.entry_minute, s.exit_minute, s.green_stake, s.red_stake,
         jsonb_build_object(
           'variation_ids', COALESCE(s.filters_snapshot->'variation_ids', '[]'::jsonb),
           'quarantine_leagues', COALESCE(s.filters_snapshot->'quarantine_leagues', '[]'::jsonb),
           'red_overrides', COALESCE(s.filters_snapshot->'red_overrides', '{}'::jsonb),
           'result_overrides', COALESCE(s.filters_snapshot->'result_overrides', '{}'::jsonb))
  FROM strategy_simulations s
  WHERE COALESCE((s.filters_snapshot->>'notify_enabled')::boolean, false) = true
  ORDER BY s.name;
$$;
-- só quem está logado (a oferta fica dentro do sistema por enquanto); para abrir ao público: GRANT EXECUTE ... TO anon
REVOKE EXECUTE ON FUNCTION public.public_methods() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.public_methods() TO authenticated;
