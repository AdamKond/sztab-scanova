// Tworzy konto w Supabase Auth dla nowego użytkownika SZTAB (Adam / Oliwier).
// Uruchomienie: npx tsx scripts/create-user.ts email haslo
//
// Konto jest od razu potwierdzone (email_confirm: true) — SZTAB ma zamkniętą
// rejestrację, więc nie ma sensu wysyłać maila weryfikacyjnego do dwóch osób,
// które i tak trzeba ręcznie dopisać do allowlisty (STAFF_EMAILS/STAFF_USER_IDS).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Prosty parser .env.local: KEY=VALUE per linia, „#” zaczyna komentarz,
 * puste linie pomijane. Celowo NIE nadpisuje już ustawionych process.env —
 * zmienne wstrzyknięte przez powłokę/CI mają pierwszeństwo przed plikiem.
 */
function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    if (!key) continue;

    let value = line.slice(eq + 1).trim();
    // Dopuszczamy wartości w cudzysłowach (proste, bez ucieczek).
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function main(): Promise<void> {
  loadEnvLocal();

  const [, , email, password] = process.argv;
  if (!email || !password) {
    console.error("Użycie: npx tsx scripts/create-user.ts <email> <haslo>");
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error(
      "Brak konfiguracji — uzupełnij SUPABASE_URL i SUPABASE_SERVICE_KEY w .env.local (patrz supabase/README.md).",
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    // Konto już istnieje — nie traktujemy tego jako porażkę skryptu, tylko
    // wypisujemy ID istniejącego użytkownika, żeby dało się je dopisać do allowlisty.
    const alreadyExists =
      error.status === 422 ||
      /already.*registered|already exists/i.test(error.message ?? "");

    if (alreadyExists) {
      const existing = await findUserByEmail(supabase, email);
      if (existing) {
        console.log(`Użytkownik o adresie ${email} już istnieje. UUID: ${existing.id}`);
        console.log(
          "Przypomnienie: Dopisz UUID do STAFF_USER_IDS i e-mail do STAFF_EMAILS.",
        );
        return;
      }
    }

    console.error(`Błąd tworzenia użytkownika: ${error.message}`);
    process.exit(1);
  }

  const user = data.user;
  if (!user) {
    console.error("Supabase nie zwróciło danych utworzonego użytkownika.");
    process.exit(1);
  }

  console.log(`Utworzono konto ${email}. UUID: ${user.id}`);
  console.log("Przypomnienie: Dopisz UUID do STAFF_USER_IDS i e-mail do STAFF_EMAILS.");
}

/**
 * admin.createUser nie ma odpowiednika "getUserByEmail" w tej wersji SDK —
 * listUsers z filtrowaniem po stronie klienta wystarczy przy dwóch kontach.
 */
async function findUserByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<{ id: string } | null> {
  const target = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error || !data) return null;

    const match = data.users.find((u) => u.email?.trim().toLowerCase() === target);
    if (match) return { id: match.id };

    if (data.users.length < perPage) return null;
    page += 1;
  }
}

main().catch((err) => {
  console.error("Nieoczekiwany błąd:", err);
  process.exit(1);
});
