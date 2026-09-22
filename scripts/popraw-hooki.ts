// Nadpisuje nazwę i hook (dm_text = "HOOK: ...") lokali w Bazie na podstawie
// poprawionego pliku researchu — po handle Instagrama. Użycie:
//   npx tsx scripts/popraw-hooki.ts <plik.txt> [--wykonaj]
// Format linii jak w import-leady-baza.ts. Linie po "###" są pomijane.
// Nie rusza wierszy, które już mają wysłany DM (tekst poszedł — nie zmieniamy historii).

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { normalizeInstagram, clampText } from "../lib/crm/normalize";
import { HOOK_PREFIX } from "../lib/crm/blitz";

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, "utf8").split("\n")) {
    const line = raw.trim();
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
  const file = process.argv[2];
  const execute = process.argv.includes("--wykonaj");
  if (!file) {
    console.error("Użycie: npx tsx scripts/popraw-hooki.ts <plik.txt> [--wykonaj]");
    process.exit(1);
  }
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
  let updated = 0, skipped = 0, missing = 0;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("###")) break;
    if (!line.includes("|")) continue;
    const parts = line.split("|").map((p) => p.trim());
    const instagram = normalizeInstagram(parts[0] ?? "");
    if (!instagram) continue;
    const name = clampText(parts[1] ?? "", 160);
    const city = clampText(parts[2] ?? "", 200);
    const hook = clampText(parts[5] ?? "", 200);
    const { data: row } = await db.from("crm_dm_blitz").select("id, sent_at").eq("instagram", instagram).maybeSingle();
    if (!row) { missing += 1; continue; }
    if (row.sent_at) { skipped += 1; continue; }
    const updates: Record<string, unknown> = { dm_text: hook ? `${HOOK_PREFIX} ${hook}` : "" };
    if (name) updates.name = name;
    if (city) updates.city = city;
    if (execute) {
      const { error } = await db.from("crm_dm_blitz").update(updates).eq("id", row.id);
      if (error) { console.log(`błąd @${instagram}: ${error.message}`); continue; }
    }
    updated += 1;
  }
  console.log(`${execute ? "zaktualizowano" : "do aktualizacji"}: ${updated}, pominięto (DM już wysłany): ${skipped}, brak w Bazie: ${missing}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
