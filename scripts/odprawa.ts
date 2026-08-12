/**
 * Odprawa dnia BEZ płatnego API — przez subskrypcję w Claude Code.
 *
 * Pomysł: skrypt robi to, co normalnie robi warstwa AI, poza jednym krokiem —
 * samego napisania tekstu. Dane wypisuje na ekran, człowiek (albo Claude Code)
 * pisze odprawę, a skrypt zapisuje ją do bazy. Aplikacja pokazuje ją dokładnie
 * tak samo, jakby wygenerowało ją API.
 *
 * Użycie:
 *   npx tsx scripts/odprawa.ts                 # wypisz dane + instrukcję dla modelu
 *   npx tsx scripts/odprawa.ts --zapisz plik.md  # zapisz gotową odprawę na dziś
 *   npx tsx scripts/odprawa.ts --pokaz         # pokaż dzisiejszą odprawę z bazy
 *
 * Do modelu trafiają tylko zagregowane liczby, nazwy firm, etapy i następne
 * kroki — bez telefonów, e-maili i notatek (tak samo jak przez API).
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildBriefingPayload, BRIEFING_SYSTEM } from "../lib/crm/briefing-payload";
import { warsawToday, fullDate } from "../lib/crm/dates";
import type {
  CrmActivity,
  CrmLead,
  CrmSettings,
  CrmStageHistory,
  SalesGoal,
} from "../lib/crm/types";

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

loadEnvLocal();
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error("Brak SUPABASE_URL / SUPABASE_SERVICE_KEY w .env.local.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const today = warsawToday();

async function pobierzDane() {
  const [leads, activities, history, goals, settings] = await Promise.all([
    db.from("crm_leads").select("*"),
    db.from("crm_activities").select("*"),
    db.from("crm_stage_history").select("*"),
    db.from("sales_goals").select("*"),
    db.from("crm_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  for (const r of [leads, activities, history, goals, settings]) {
    if (r.error) {
      console.error(`Błąd bazy: ${r.error.message}`);
      process.exit(1);
    }
  }
  return {
    leads: (leads.data ?? []) as CrmLead[],
    activities: (activities.data ?? []) as CrmActivity[],
    history: (history.data ?? []) as CrmStageHistory[],
    goals: (goals.data ?? []) as SalesGoal[],
    settings: settings.data as CrmSettings,
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--pokaz") {
    const { data } = await db
      .from("crm_briefings")
      .select("content_md, created_by")
      .eq("briefing_date", today)
      .maybeSingle();
    console.log(data?.content_md ?? `Brak odprawy na ${fullDate(today)}.`);
    return;
  }

  if (args[0] === "--zapisz") {
    const file = args[1];
    if (!file || !existsSync(file)) {
      console.error("Podaj istniejący plik: npx tsx scripts/odprawa.ts --zapisz odprawa.md");
      process.exit(1);
    }
    const content = readFileSync(file, "utf8").trim();
    if (!content) {
      console.error("Plik jest pusty.");
      process.exit(1);
    }
    const { error } = await db
      .from("crm_briefings")
      .upsert(
        { briefing_date: today, content_md: content, created_by: "claude-code" },
        { onConflict: "briefing_date" },
      );
    if (error) {
      console.error(`Nie udało się zapisać: ${error.message}`);
      process.exit(1);
    }
    console.log(`✓ Odprawa na ${fullDate(today)} zapisana. Zobaczysz ją w zakładce „Odprawa AI”.`);
    return;
  }

  // Domyślnie: wypisz to, co dostałby model.
  const dane = await pobierzDane();
  console.log("═══ INSTRUKCJA DLA MODELU ═══\n");
  console.log(BRIEFING_SYSTEM);
  console.log("\n═══ DANE NA DZIŚ ═══\n");
  console.log(buildBriefingPayload(dane));
  console.log("\n═══ KONIEC ═══");
  console.log("\nNapisz odprawę wg instrukcji, zapisz do pliku i wykonaj:");
  console.log("  npx tsx scripts/odprawa.ts --zapisz odprawa.md");
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
