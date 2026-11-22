// Ustawienia wysyłki z linii poleceń (to samo, co formularz na ekranie Maile).
//
//   npx tsx scripts/ustaw-maile.ts                       # pokaż
//   npx tsx scripts/ustaw-maile.ts --wariant=oferta --rozgrzewka=2026-11-24 --limit=150 --start
//   npx tsx scripts/ustaw-maile.ts --pauza               # zatrzymaj wysyłkę
//
// Flagi: --wariant=oferta|pytanie, --limit=N, --rozgrzewka=YYYY-MM-DD|brak,
// --start-rozgrzewki=N, --krok-rozgrzewki=N, --followup=N, --ostatni=N,
// --od=H, --do=H, --start (włącz), --pauza (wyłącz).

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
  const args = process.argv.slice(2);
  const val = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  const patch: Record<string, unknown> = {};
  if (val("wariant")) patch.variant = val("wariant") === "pytanie" ? "pytanie" : "oferta";
  if (val("limit")) patch.daily_limit = Number(val("limit"));
  if (val("rozgrzewka")) patch.warmup_start = val("rozgrzewka") === "brak" ? null : val("rozgrzewka");
  if (val("start-rozgrzewki")) patch.warmup_start_limit = Number(val("start-rozgrzewki"));
  if (val("krok-rozgrzewki")) patch.warmup_step = Number(val("krok-rozgrzewki"));
  if (val("followup")) patch.followup_after_days = Number(val("followup"));
  if (val("ostatni")) patch.last_after_days = Number(val("ostatni"));
  if (val("od")) patch.send_from_hour = Number(val("od"));
  if (val("do")) patch.send_to_hour = Number(val("do"));
  if (args.includes("--start")) patch.paused = false;
  if (args.includes("--pauza")) patch.paused = true;

  if (Object.keys(patch).length > 0) {
    const { error } = await db.from("crm_mail_settings").update(patch).eq("id", 1);
    if (error) throw new Error(error.message);
    console.log("Zapisano:", patch);
  }
  const { data, error } = await db.from("crm_mail_settings").select("*").eq("id", 1).single();
  if (error) throw new Error(error.message);
  // PostgREST ucina na 1000 wierszy — liczymy per status z count: "exact".
  const counts: Record<string, number> = {};
  for (const st of ["oczekuje", "wyslany", "followup", "zamkniety", "odpowiedzial", "odbil", "skarga", "wypisany", "wstrzymany", "blad"]) {
    const { count } = await db.from("crm_mail_queue").select("id", { count: "exact", head: true }).eq("status", st);
    if (count) counts[st] = count;
  }
  console.log("Ustawienia:", { ...data, updated_at: undefined });
  console.log("Kolejka:", counts);
}

main().catch((err) => {
  console.error("Błąd:", err instanceof Error ? err.message : err);
  process.exit(1);
});
