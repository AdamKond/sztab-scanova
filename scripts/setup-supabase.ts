/**
 * Automat konfiguracji Supabase dla SZTAB-u — robi wszystko jednym poleceniem:
 *
 *   1. tworzy NOWY projekt Supabase w eu-central-1 (Frankfurt),
 *   2. czeka aż wstanie,
 *   3. uruchamia obie migracje (001 rdzeń, 002 etapy 2-4),
 *   4. wyłącza publiczną rejestrację,
 *   5. pobiera klucze API,
 *   6. zakłada konta z potwierdzonym e-mailem,
 *   7. zapisuje .env.local (scalając z istniejącą zawartością).
 *
 * Użycie:
 *   export SUPABASE_ACCESS_TOKEN=sbp_...        # token z supabase.com/dashboard/account/tokens
 *   npx tsx scripts/setup-supabase.ts adam@firma.pl oliwier@firma.pl
 *
 * Token przez zmienną środowiskową, a nie argument — argumenty lądują
 * w historii powłoki, zmienne nie.
 */

import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const API = "https://api.supabase.com";
const PROJECT_NAME = "sztab-scanova";
const REGION = "eu-central-1"; // Frankfurt — wymóg specyfikacji

const token = process.env.SUPABASE_ACCESS_TOKEN;
const emails = process.argv.slice(2).filter((a) => a.includes("@"));

function die(msg: string): never {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

if (!token) {
  die(
    "Brak SUPABASE_ACCESS_TOKEN.\n" +
      "   Wygeneruj token na https://supabase.com/dashboard/account/tokens\n" +
      "   i uruchom:  export SUPABASE_ACCESS_TOKEN=sbp_...",
  );
}
if (emails.length === 0) {
  die("Podaj adresy e-mail kont, np.:\n   npx tsx scripts/setup-supabase.ts adam@firma.pl oliwier@firma.pl");
}

/** Hasło dla bazy i kont — losowe, bez znaków psujących URL-e i powłokę. */
function strongPassword(len = 28): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_";
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // --- 1. Organizacja ------------------------------------------------------
  const orgs = await api<{ id: string; name: string }[]>("/v1/organizations");
  if (orgs.length === 0) die("Twoje konto Supabase nie ma żadnej organizacji.");
  const org = orgs[0];
  if (orgs.length > 1) {
    console.log(`ℹ️  Organizacji jest ${orgs.length}, używam pierwszej: ${org.name}`);
  }

  // --- 2. Projekt ----------------------------------------------------------
  const existing = await api<{ id: string; name: string; region: string; status: string }[]>(
    "/v1/projects",
  );
  let project = existing.find((p) => p.name === PROJECT_NAME);
  const dbPass = strongPassword(32);

  if (project) {
    console.log(`ℹ️  Projekt "${PROJECT_NAME}" już istnieje (${project.id}) — używam go.`);
  } else {
    console.log(`→ Tworzę projekt "${PROJECT_NAME}" w ${REGION} (organizacja: ${org.name})…`);
    project = await api<{ id: string; name: string; region: string; status: string }>("/v1/projects", {
      method: "POST",
      body: JSON.stringify({
        name: PROJECT_NAME,
        organization_id: org.id,
        region: REGION,
        db_pass: dbPass,
      }),
    });
    console.log(`✓ Utworzony: ${project.id}`);
    console.log(`  Hasło do bazy (zapisz w menedżerze haseł): ${dbPass}`);
  }

  const ref = project.id;

  // --- 3. Czekamy aż projekt wstanie --------------------------------------
  process.stdout.write("→ Czekam na uruchomienie bazy");
  for (let i = 0; i < 60; i++) {
    const p = await api<{ status: string }>(`/v1/projects/${ref}`);
    if (p.status === "ACTIVE_HEALTHY") {
      console.log(" — gotowa.");
      break;
    }
    process.stdout.write(".");
    await sleep(10_000);
    if (i === 59) die("Baza nie wstała w 10 minut — sprawdź dashboard Supabase.");
  }
  // Nawet po ACTIVE_HEALTHY endpoint SQL bywa chwilę niedostępny.
  await sleep(5_000);

  // --- 4. Migracje ---------------------------------------------------------
  const runSql = async (file: string) => {
    const sql = readFileSync(resolve(process.cwd(), "supabase", file), "utf8");
    console.log(`→ Uruchamiam ${file}…`);
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await api(`/v1/projects/${ref}/database/query`, {
          method: "POST",
          body: JSON.stringify({ query: sql }),
        });
        console.log(`✓ ${file}`);
        return;
      } catch (e) {
        if (attempt === 5) throw e;
        process.stdout.write("  (baza jeszcze nie przyjmuje zapytań, ponawiam…)\n");
        await sleep(15_000);
      }
    }
  };
  await runSql("migration-001-core.sql");
  await runSql("migration-002-etapy-2-4.sql");

  // --- 5. Wyłączenie publicznej rejestracji -------------------------------
  try {
    await api(`/v1/projects/${ref}/config/auth`, {
      method: "PATCH",
      body: JSON.stringify({ disable_signup: true }),
    });
    console.log("✓ Publiczna rejestracja wyłączona");
  } catch (e) {
    console.log(`⚠️  Nie udało się wyłączyć rejestracji automatycznie: ${(e as Error).message}`);
    console.log("   Zrób to ręcznie: Authentication → Sign In / Up → Allow new users to sign up = OFF");
  }

  // --- 6. Klucze API -------------------------------------------------------
  const keys = await api<{ name: string; api_key: string }[]>(
    `/v1/projects/${ref}/api-keys?reveal=true`,
  );
  const pick = (...names: string[]) =>
    keys.find((k) => names.includes(k.name))?.api_key ??
    die(`Nie znalazłem klucza (${names.join(" / ")}) w odpowiedzi API.`);
  const anonKey = pick("anon", "publishable");
  const serviceKey = pick("service_role", "secret");
  const url = `https://${ref}.supabase.co`;
  console.log("✓ Klucze API pobrane");

  // --- 7. Konta ------------------------------------------------------------
  const created: { email: string; id: string; password: string }[] = [];
  for (const email of emails) {
    const password = strongPassword(20);
    const res = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const body = (await res.json()) as { id?: string; msg?: string; message?: string };
    if (res.ok && body.id) {
      created.push({ email, id: body.id, password });
      console.log(`✓ Konto ${email} (${body.id})`);
    } else if (res.status === 422) {
      // Konto już istnieje — dociągamy jego UUID, żeby allowlista była kompletna.
      const list = await fetch(`${url}/auth/v1/admin/users`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      const users = (await list.json()) as { users?: { id: string; email: string }[] };
      const found = users.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (found) {
        created.push({ email, id: found.id, password: "(konto istniało wcześniej)" });
        console.log(`ℹ️  Konto ${email} już istniało (${found.id})`);
      }
    } else {
      console.log(`⚠️  Nie udało się założyć ${email}: ${body.msg ?? body.message ?? res.status}`);
    }
  }

  // --- 8. .env.local -------------------------------------------------------
  const envPath = resolve(process.cwd(), ".env.local");
  const previous = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const values: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    SUPABASE_URL: url,
    SUPABASE_SERVICE_KEY: serviceKey,
    STAFF_EMAILS: created.map((c) => c.email.toLowerCase()).join(","),
    STAFF_USER_IDS: created.map((c) => c.id).join(","),
  };
  // Zachowujemy linie, których nie nadpisujemy (np. VERCEL_OIDC_TOKEN).
  const kept = previous
    .split("\n")
    .filter((line) => line.trim() && !Object.keys(values).some((k) => line.startsWith(`${k}=`)));
  const next = [...kept, ...Object.entries(values).map(([k, v]) => `${k}=${v}`)].join("\n") + "\n";
  writeFileSync(envPath, next, { mode: 0o600 });
  console.log("✓ Zapisano .env.local");

  // --- Podsumowanie --------------------------------------------------------
  console.log("\n─────────────────────────────────────────────");
  console.log("GOTOWE. Dane do logowania (zapisz w menedżerze haseł):\n");
  for (const c of created) {
    console.log(`  ${c.email}\n    hasło: ${c.password}`);
  }
  console.log("\nNastępne kroki:");
  console.log("  bash scripts/vercel-env.sh     # wgraj zmienne na Vercela");
  console.log("  npx vercel deploy --prod       # nowy build ze zmiennymi");
  console.log("  npx tsx scripts/test-db.ts     # testy domenowe na żywej bazie");
  console.log("─────────────────────────────────────────────\n");
}

main().catch((e) => die((e as Error).message));
