import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// `import "server-only"` na samej górze: gdyby ten moduł kiedykolwiek trafił
// do importu w komponencie klienckim, build ma paść z błędem zamiast wysłać
// klucz serwisowy do przeglądarki.
//
// Ten klient omija RLS. Autoryzacja dla niego to lib/auth.ts (twarda
// allowlista) — dostęp do danych zawsze poprzedza requireStaff/guardStaffAction.

let cached: SupabaseClient | null = null;

/**
 * Czy backend CRM ma komplet konfiguracji. Używane np. do rozróżnienia
 * "brak konfiguracji" od "brak danych" w warstwie UI.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

/**
 * Klient z rolą serwisową. Cache modułowy jest tu bezpieczny, bo klient nie
 * niesie żadnej sesji użytkownika — jest zawsze tym samym administratorem.
 */
export function getServiceClient(): SupabaseClient {
  if (cached) return cached;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    // Rdzeń CRM ma padać głośno. Ciche zwracanie pustych list wyglądałoby
    // jak "brak leadów" i doprowadziłoby do decyzji biznesowych na pustce.
    throw new Error(
      "Brak konfiguracji Supabase — uzupełnij SUPABASE_URL i SUPABASE_SERVICE_KEY w .env.local",
    );
  }

  cached = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      // Rola serwisowa nie ma sesji do trzymania ani tokenu do odświeżania;
      // na serwerze taki stan tylko generuje wycieki między żądaniami.
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      // Next podmienia globalny `fetch` na własny, cache'ujący wariant.
      // Bez `cache: "no-store"` odpowiedzi GET z PostgREST byłyby
      // współdzielone między żądaniami — CRM pokazywałby nieaktualne dane
      // (a przy różnych użytkownikach: cudze dane).
      fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }),
    },
  });

  return cached;
}
