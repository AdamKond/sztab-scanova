import "server-only";

// Pomocniki dostępu do danych wspólne dla całej domeny.
//
// selectAll: PostgREST ucina wyniki na limicie "Max rows" (domyślnie 1000),
// a goły .select() NIE zgłasza, że coś uciął. Bez jawnej paginacji KPI
// liczone na "wszystkich" wierszach po cichu kłamią po przekroczeniu limitu —
// dlatego każda lista w queries.ts przechodzi przez tę funkcję.

import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;

export interface SelectAllOptions {
  filter?: (q: any) => any;
  orderBy?: { column: string; ascending?: boolean };
}

export async function selectAll<T>(
  db: SupabaseClient,
  table: string,
  options: SelectAllOptions = {},
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = db.from(table).select("*");
    if (options.filter) query = options.filter(query);
    if (options.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending ?? true,
      });
    }
    // Stabilne stronicowanie wymaga deterministycznego porządku — dokładamy id.
    query = query.order("id", { ascending: true }).range(from, from + PAGE_SIZE - 1);
    const { data, error } = await query;
    // Rdzeń CRM failuje głośno: błąd bazy NIGDY nie zamienia się w pustą listę.
    if (error) throw new Error(`Błąd bazy przy odczycie ${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}
