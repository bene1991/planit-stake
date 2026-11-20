import { supabase } from '@/integrations/supabase/client';

// Busca todas as linhas em páginas de 1000 pedidas em paralelo (antes eram sequenciais: ~22 idas e voltas).
export async function fetchAllRows(table: string, columns = '*', orderBy = 'id'): Promise<any[]> {
  const db = supabase as any;
  const size = 1000;
  const { count, error: cErr } = await db.from(table).select('*', { count: 'exact', head: true });
  if (cErr) throw cErr;
  const pages = Math.ceil((count || 0) / size);
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      db.from(table).select(columns).order(orderBy).range(i * size, i * size + size - 1)
        .then((r: any) => { if (r.error) throw r.error; return r.data || []; })),
  );
  return results.flat();
}
