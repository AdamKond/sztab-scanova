// Import leadow outboundowych (research web) do SZTAB -> crm_leads.
//
// Domyslnie DRY-RUN: drukuje plan, nie laczy sie z baza. Zapis wymaga
// jawnej flagi --wykonaj. Duplikaty (normalized_name + miasto) sa pomijane,
// wiec skrypt mozna bezpiecznie uruchamiac wielokrotnie na tym samym pliku.
//
// Uzycie:
//   npx tsx scripts/import-leady-outbound.ts [plik.json]
//   npx tsx scripts/import-leady-outbound.ts [plik.json] --wykonaj
//
// Domyslny plik: scripts/leady-outbound-2026-08.json
// Ksztalt pliku: { campaign, source_detail, leads: [{ name, category, city,
//   address?, instagram?, phone?, www?, google_rating?, locations_count?,
//   priority, qualification_note, dm }] }
// Pole "dm" laduje w notes jako gotowy tekst wiadomosci na IG.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  clampText,
  normalizeGoogleRating,
  normalizeInstagram,
  normalizeName,
  normalizePhone,
  normalizeWww,
} from "@/lib/crm/normalize";

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

type InputLead = {
  name: string;
  category?: string;
  city?: string;
  address?: string;
  instagram?: string;
  phone?: string;
  www?: string;
  google_rating?: number;
  locations_count?: number;
  priority?: "A" | "B" | "C" | "D";
  qualification_note?: string;
  dm?: string;
};

type InputFile = {
  campaign?: string;
  source_detail?: string;
  leads: InputLead[];
};

async function findExistingLeadId(
  supabase: SupabaseClient,
  normalizedName: string,
  city: string | undefined,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("crm_leads")
    .select("id, city")
    .eq("normalized_name", normalizedName);
  if (error) throw new Error(`Blad zapytania o duplikaty: ${error.message}`);
  if (!data || data.length === 0) return null;
  const targetCity = normalizeName(city ?? "");
  const match = data.find((row) => normalizeName(String(row.city ?? "")) === targetCity);
  return match ? String(match.id) : null;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const wykonaj = argv.includes("--wykonaj");
  const fileArg = argv.find((a) => !a.startsWith("--"));
  const filePath = path.resolve(
    process.cwd(),
    fileArg ?? "scripts/leady-outbound-2026-08.json",
  );

  if (!existsSync(filePath)) {
    console.error(`Nie ma pliku: ${filePath}`);
    process.exit(1);
  }

  const input = JSON.parse(readFileSync(filePath, "utf8")) as InputFile;
  const campaign = clampText(input.campaign, 160);
  const sourceDetail = clampText(input.source_detail, 160);

  const rows = input.leads.map((old) => {
    const name = clampText(old.name, 160);
    if (!name) throw new Error(`Lead bez nazwy w pliku: ${JSON.stringify(old)}`);
    const noteParts: string[] = [];
    if (old.dm) noteParts.push(`DM (IG) — gotowy do wyslania:\n${old.dm}`);
    return {
      name,
      normalized_name: normalizeName(name),
      category: clampText(old.category, 160),
      city: clampText(old.city, 160),
      address: clampText(old.address, 300),
      instagram: normalizeInstagram(old.instagram),
      phone: normalizePhone(old.phone),
      www: normalizeWww(old.www),
      google_rating: normalizeGoogleRating(old.google_rating),
      locations_count: old.locations_count && old.locations_count > 0 ? old.locations_count : 1,
      current_loyalty: null,
      source: "inne" as const,
      source_detail: sourceDetail,
      campaign,
      status: "nowy" as const,
      priority: old.priority ?? "B",
      qualification_note: clampText(old.qualification_note, 2000),
      next_action: "Wyslac DM na Instagramie (tekst w notatce)",
      notes: noteParts.length > 0 ? noteParts.join("\n\n") : null,
    };
  });

  console.log(`Plik: ${filePath}`);
  console.log(`Kampania: ${campaign ?? "(brak)"} | Zrodlo: inne / ${sourceDetail ?? "(brak)"}`);
  console.log(`Leadow w pliku: ${rows.length}\n`);
  for (const r of rows) {
    console.log(
      `  [${r.priority}] ${r.name} (${r.city ?? "?"}) — ${r.category ?? "?"}` +
        `${r.google_rating ? ` — ${r.google_rating} w Google` : ""}` +
        `${r.locations_count > 1 ? ` — ${r.locations_count} lokale` : ""}`,
    );
  }

  if (!wykonaj) {
    console.log("\nDRY-RUN: nic nie zapisano. Zapis: dodaj flage --wykonaj.");
    return;
  }

  loadEnvLocal();
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error("Brak SUPABASE_URL / SUPABASE_SERVICE_KEY w .env.local.");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const existingId = await findExistingLeadId(supabase, row.normalized_name, row.city ?? undefined);
    if (existingId) {
      skipped += 1;
      console.log(`  POMINIETO (duplikat ${existingId}): ${row.name} (${row.city ?? "?"})`);
      continue;
    }
    const { error } = await supabase.from("crm_leads").insert(row);
    if (error) throw new Error(`Blad zapisu "${row.name}": ${error.message}`);
    inserted += 1;
    console.log(`  DODANO: ${row.name} (${row.city ?? "?"})`);
  }

  console.log(`\nGotowe. Dodano: ${inserted}, pominieto duplikaty: ${skipped}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
