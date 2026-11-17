// Import adresów do kolejki Maili (crm_mail_queue) z pliku CSV/TXT.
//
//   npx tsx scripts/import-maile.ts <plik-lub-katalog> [--wykonaj] [--kampania=mail-2026-11] [--zrodlo=csv|gmaps|strona]
//
// Bez --wykonaj = dry-run (pokazuje, co by dodał). Format pliku jak na ekranie
// Maile → "Wklej listę": `email | nazwa | miasto | nisza | www | notatka`
// albo CSV z nagłówkiem (kolumny email, nazwa/name, miasto/city, nisza, www,
// instagram, telefon, uwaga). Duplikaty i czarna lista są pomijane.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseContactLines, type ParsedContact } from "../lib/crm/mail/parse";

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

function filesOf(target: string): string[] {
  if (statSync(target).isDirectory()) {
    return readdirSync(target)
      .filter((f) => /\.(csv|txt)$/i.test(f))
      .map((f) => path.join(target, f));
  }
  return [target];
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith("--"));
  const run = args.includes("--wykonaj");
  const campaign = args.find((a) => a.startsWith("--kampania="))?.slice("--kampania=".length) || `mail-${new Date().toISOString().slice(0, 7)}`;
  const sourceArg = args.find((a) => a.startsWith("--zrodlo="))?.slice("--zrodlo=".length);
  const source = sourceArg === "gmaps" || sourceArg === "strona" ? sourceArg : "csv";
  if (!target || !existsSync(target)) {
    console.error("Użycie: npx tsx scripts/import-maile.ts <plik-lub-katalog> [--wykonaj] [--kampania=...] [--zrodlo=csv|gmaps|strona]");
    process.exit(1);
  }

  const all: ParsedContact[] = [];
  let errors = 0;
  for (const file of filesOf(target)) {
    const r = parseContactLines(readFileSync(file, "utf8"));
    console.log(`${path.basename(file)}: ${r.contacts.length} adresów, ${r.errors.length} pominiętych`);
    for (const e of r.errors.slice(0, 5)) console.log(`   · ${e}`);
    all.push(...r.contacts);
    errors += r.errors.length;
  }
  const unique = new Map<string, ParsedContact>();
  for (const c of all) if (!unique.has(c.email)) unique.set(c.email, c);
  console.log(`\nRazem: ${unique.size} unikalnych adresów (${all.length - unique.size} powtórzonych w plikach, ${errors} pominiętych).`);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error("Brak SUPABASE_URL / SUPABASE_SERVICE_KEY w .env.local");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const emails = [...unique.keys()];
  const known = new Set<string>();
  for (let i = 0; i < emails.length; i += 200) {
    const { data, error } = await db.from("crm_mail_queue").select("email").in("email", emails.slice(i, i + 200));
    if (error) throw new Error(`Błąd bazy: ${error.message}`);
    for (const e of (data ?? []) as { email: string }[]) known.add(e.email);
  }
  const fresh = [...unique.values()].filter((c) => !known.has(c.email));
  console.log(`Już w kolejce: ${known.size}. Do dodania: ${fresh.length}. Kampania: ${campaign}, źródło: ${source}.`);

  const byCity = new Map<string, number>();
  for (const c of fresh) byCity.set(c.city ?? "?", (byCity.get(c.city ?? "?") ?? 0) + 1);
  console.log("Miasta:", [...byCity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([c, n]) => `${c} ${n}`).join(", "));

  if (!run) {
    console.log("\nDRY-RUN — dodaj --wykonaj, żeby zapisać.");
    for (const c of fresh.slice(0, 10)) console.log(`  ${c.email} | ${c.name} | ${c.city ?? ""} | ${c.niche}`);
    return;
  }
  const rows = fresh.map((c) => ({
    email: c.email,
    domain: c.email.split("@")[1],
    name: c.name,
    city: c.city,
    niche: c.niche,
    www: c.www,
    instagram: c.instagram,
    phone: c.phone,
    note: c.note,
    source,
    campaign,
  }));
  let added = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("crm_mail_queue").insert(rows.slice(i, i + 500));
    if (error) throw new Error(`Nie udało się dodać: ${error.message}`);
    added += Math.min(500, rows.length - i);
  }
  console.log(`\nDodano ${added} adresów do kolejki.`);
}

main().catch((err) => {
  console.error("Błąd:", err instanceof Error ? err.message : err);
  process.exit(1);
});
