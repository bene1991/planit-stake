-- Add authorization check to atualizar_indices_confianca function
-- This prevents users from updating other users' confidence indices

CREATE OR REPLACE FUNCTION public.atualizar_indices_confianca(user_id_param uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  metodo_record RECORD;
  novo_indice numeric;
BEGIN
  -- Authorization check: ensure the caller owns the user_id
  IF user_id_param != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: cannot update confidence indices for other users';
  END IF;

  FOR metodo_record IN 
    SELECT id FROM methods WHERE owner_id = user_id_param
  LOOP
    novo_indice := public.calcular_indice_confianca(metodo_record.id);
    
    UPDATE methods 
    SET indice_confianca = novo_indice
    WHERE id = metodo_record.id;
  END LOOP;
END;
$function$;