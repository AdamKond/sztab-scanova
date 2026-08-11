import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Klient przeglądarkowy na kluczu anon. SZTAB renderuje się serwerowo,
// więc na dziś jest to furtka na przyszłość (np. realtime, upload plików).
// Wolno tu użyć tylko zmiennych NEXT_PUBLIC_* — wszystko w tym module
// ląduje w bundlu wysyłanym do przeglądarki.

let cached: SupabaseClient | null = null;

/**
 * Singleton per karta przeglądarki: kilka instancji klienta konkurowałoby
 * o odświeżanie tego samego tokenu i powodowało losowe wylogowania.
 */
export function getAuthBrowserClient(): SupabaseClient {
  if (cached) return cached;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Brak konfiguracji Supabase — uzupełnij NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_ANON_KEY w .env.local",
    );
  }

  cached = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return cached;
}
