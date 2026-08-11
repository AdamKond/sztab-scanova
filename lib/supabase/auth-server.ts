import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";

// Klient SSR na kluczu anon — jedyne źródło tożsamości użytkownika w RSC/akcjach.
// Klucz serwisowy NIGDY tu nie trafia: ten klient działa w kontekście sesji
// użytkownika (cookies), a nie w kontekście administratora bazy.

/**
 * Zwraca `true`, gdy publiczna konfiguracja Supabase jest dostępna.
 * Warstwa auth musi dać się zbudować i uruchomić bez .env.local (np. na CI),
 * dlatego brak konfiguracji traktujemy tu jako "nikt nie jest zalogowany",
 * a nie jako błąd krytyczny — inaczej niż w lib/supabase/service.ts.
 */
function isAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Tworzy NOWY klient dla każdego żądania. Współdzielenie instancji między
 * żądaniami przeciekłoby sesję jednego użytkownika do drugiego, dlatego
 * świadomie nie ma tu cache'u modułowego.
 */
export async function getAuthServerClient(): Promise<SupabaseClient> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Brak konfiguracji Supabase — uzupełnij NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_ANON_KEY w .env.local",
    );
  }

  // W Next 16 `cookies()` jest asynchroniczne — stąd async w całej funkcji.
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // W Server Components zapis cookies jest zabroniony i rzuca wyjątkiem.
          // To nie jest błąd: odświeżanie tokenu wykonuje middleware.ts, które
          // ma prawo pisać do odpowiedzi. Cichy catch jest tu zamierzony.
        }
      },
    },
  });
}

/**
 * Tożsamość użytkownika WYŁĄCZNIE przez `getUser()`.
 * `getSession()` czyta cookie bez weryfikacji podpisu po stronie Auth,
 * więc jego wynik da się podrobić — nie wolno na nim opierać decyzji
 * o dostępie. `getUser()` waliduje token u dostawcy.
 */
export async function getCurrentUser(): Promise<User | null> {
  if (!isAuthConfigured()) return null;

  try {
    const supabase = await getAuthServerClient();
    const { data, error } = await supabase.auth.getUser();
    // Błąd sieci/tokenu = brak zaufanej tożsamości. Fail closed.
    if (error) return null;
    return data.user;
  } catch {
    return null;
  }
}
