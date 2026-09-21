// Import lokali do Bazy (crm_dm_blitz) z plików tekstowych researchu.
//
// Uruchomienie: npx tsx scripts/import-leady-baza.ts <plik-albo-katalog> [--wykonaj]
// Bez --wykonaj: dry-run (parsuje, liczy, pokazuje duplikaty), nic nie zapisuje.
//
// Format linii (pola oddzielone |): @instagram | Nazwa | Miasto | nisza | obserwujący | hook
// Linie zaczynające się od "###" kończą sekcję pewnych lokali — reszta pliku
// (NIEPEWNE, NOTATKI) jest pomijana. Hook trafia do dm_text jako "HOOK: ..."
// i zastępuje pierwsze zdanie szablonu niszy (lib/crm/dm-copy.ts).

import { createClient } from "@supabase/supabase-js";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { normalizeInstagram, clampText } from "../lib/crm/normalize";
import { NICHES } from "../lib/crm/dm-copy";
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// Ujednolicenie nazw miast — filtr po mieście ma pokazywać jedno "Zamość", nie dwa.
const CITY_FIX: Record<string, string> = {
  "biala podlaska": "Biała Podlaska",
  chelm: "Chełm",
  pulawy: "Puławy",
  swidnik: "Świdnik",
  zamosc: "Zamość",
  krasnik: "Kraśnik",
  leczna: "Łęczna",
  lubartow: "Lubartów",
  bilgoraj: "Biłgoraj",
  "tomaszow lubelski": "Tomaszów Lubelski",
  rzeszow: "Rzeszów",
  naleczow: "Nałęczów",
  lukow: "Łuków",
  hrubieszow: "Hrubieszów",
  wlodawa: "Włodawa",
  "janow lubelski": "Janów Lubelski",
  "radzyn podlaski": "Radzyń Podlaski",
  "miedzyrzec podlaski": "Międzyrzec Podlaski",
  "deblin": "Dęblin",
  "belzyce": "Bełżyce",
  "opole lubelskie": "Opole Lubelskie",
};

export function fixCity(city: string | null): string | null {
  if (!city) return null;
  const key = city
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l");
  return CITY_FIX[key] ?? city.trim();
}

type Lokal = { instagram: string; name: string; city: string | null; niche: string; followers: number | null; dm_text: string };

function parseLine(line: string): Lokal | null {
  const parts = line.split("|").map((p) => p.trim());
  const instagram = normalizeInstagram(parts[0] ?? "");
  if (!instagram || !/^[a-z0-9._]{1,30}$/.test(instagram)) return null;
  const name = clampText(parts[1] ?? "", 160) ?? instagram;
  const city = fixCity(clampText(parts[2] ?? "", 200));
  const nicheRaw = (parts[3] ?? "").toLowerCase().trim();
  const niche = NICHES.includes(nicheRaw) ? nicheRaw : "restauracja";
  const followersRaw = Number((parts[4] ?? "").replace(/[^\d]/g, ""));
  const followers = Number.isFinite(followersRaw) && followersRaw > 0 ? followersRaw : null;
  const hook = clampText(parts[5] ?? "", 200);
  return { instagram, name, city, niche, followers, dm_text: hook ? `${HOOK_PREFIX} ${hook}` : "" };
}

function parseFile(file: string): Lokal[] {
  const out: Lokal[] = [];
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("###")) break;
    if (!line || line.startsWith("#") || !line.includes("|")) continue;
    const l = parseLine(line);
    if (l) out.push(l);
  }
  return out;
}

async function main() {
  loadEnvLocal();
  const target = process.argv[2];
  const execute = process.argv.includes("--wykonaj");
  if (!target) {
    console.error("Użycie: npx tsx scripts/import-leady-baza.ts <plik-albo-katalog> [--wykonaj]");
    process.exit(1);
  }
  const files = statSync(target).isDirectory()
    ? readdirSync(target).filter((f) => f.endsWith(".txt")).map((f) => path.join(target, f))
    : [target];

  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
    auth: { persistSession: false },
  });
  const { data: existing, error } = await db.from("crm_dm_blitz").select("instagram, name");
  if (error) throw error;
  const known = new Set((existing ?? []).map((r) => r.instagram));
  const knownNames = new Set((existing ?? []).map((r) => r.name.toLowerCase()));
  const campaign = `baza-${new Date().toISOString().slice(0, 7)}`;

  let totalNew = 0;
  const seen = new Set<string>();
  for (const file of files) {
    const rows = parseFile(file);
    const fresh = rows.filter((r) => {
      if (known.has(r.instagram) || seen.has(r.instagram)) return false;
      if (knownNames.has(r.name.toLowerCase())) return false;
      seen.add(r.instagram);
      return true;
    });
    console.log(`${path.basename(file)}: ${rows.length} linii, ${fresh.length} nowych, ${rows.length - fresh.length} duplikatów`);
    if (!execute) continue;
    let added = 0;
    for (const r of fresh) {
      const { error: insErr } = await db.from("crm_dm_blitz").insert({ ...r, campaign });
      if (insErr) console.log(`  pominięto @${r.instagram}: ${insErr.message}`);
      else added += 1;
    }
    totalNew += added;
    console.log(`  dodano ${added}`);
  }
  console.log(execute ? `RAZEM dodano ${totalNew}` : "dry-run — dodaj --wykonaj, żeby zapisać");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
