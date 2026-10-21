// Raport duplikatów w Bazie (crm_dm_blitz). Tylko czyta — nic nie usuwa.
//
// Uruchomienie: npx tsx scripts/duplikaty-bazy.ts
//
// Szuka trzech rzeczy:
//  1. ten sam @instagram (po normalizacji: małe litery, bez @, bez kropek/podkreśleń),
//  2. ta sama nazwa w tym samym mieście (różne handle — np. ten sam lokal dodany dwa razy),
//  3. ta sama nazwa w różnych miastach (często sieć, więc tylko do oka),
//  4. ten sam szyld w jednym mieście (wspólne rzadkie słowo w nazwie — np.
//     „Pelier” i „Pelier Sweets”): to zwykle jeden właściciel, więc nie ma sensu
//     pisać dwa razy do tej samej osoby.
//
// Przy każdym duplikacie pokazuje, który wpis ma wysłany DM / rozmowę —
// kasować zawsze ten BEZ historii.
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

type Row = {
  id: string;
  name: string;
  city: string | null;
  niche: string;
  instagram: string;
  followers: number | null;
  campaign: string;
  sent_at: string | null;
  followup_sent_at: string | null;
  lead_id: string | null;
  created_at: string;
};

/** @Pizza_Loca. → pizzaloca (handle z IG ignoruje kropki i podkreślenia). */
function normHandle(h: string): string {
  return h.trim().toLowerCase().replace(/^@/, "").replace(/\/+$/, "").replace(/[._]/g, "");
}

function normName(n: string): string {
  return n
    .trim()
    .toLowerCase()
    .replace(/[„”"'’]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^a-ząćęłńóśźż0-9 ]/g, "")
    .trim();
}

function describe(r: Row): string {
  const marks = [
    r.lead_id ? "ROZMOWA" : null,
    r.sent_at ? `DM ${r.sent_at.slice(0, 10)}` : "bez DM-a",
    r.followup_sent_at ? "po follow-upie" : null,
  ].filter(Boolean);
  return `    @${r.instagram.padEnd(28)} ${r.name} · ${r.city ?? "—"} · ${r.niche} · ${marks.join(", ")} · dodany ${r.created_at.slice(0, 10)} · ${r.campaign} · id ${r.id}`;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.log("Brak SUPABASE_URL / SUPABASE_SERVICE_KEY w .env.local — nic nie sprawdzam.");
    process.exit(0);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const rows: Row[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("crm_dm_blitz")
      .select("id,name,city,niche,instagram,followers,campaign,sent_at,followup_sent_at,lead_id,created_at")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }
  console.log(`Baza: ${rows.length} lokali\n`);

  const group = <K extends string>(keyOf: (r: Row) => K | null) => {
    const m = new Map<string, Row[]>();
    for (const r of rows) {
      const k = keyOf(r);
      if (!k) continue;
      const list = m.get(k);
      if (list) list.push(r);
      else m.set(k, [r]);
    }
    return [...m.entries()].filter(([, list]) => list.length > 1);
  };

  const byHandle = group((r) => normHandle(r.instagram) || null);
  console.log(`1) Ten sam @instagram: ${byHandle.length} grup`);
  for (const [k, list] of byHandle) {
    console.log(`  → ${k} (${list.length}x)`);
    for (const r of list) console.log(describe(r));
  }

  const handleKeys = new Set(byHandle.map(([k]) => k));
  const sameCity = group((r) => {
    const n = normName(r.name);
    return n ? `${n}|${(r.city ?? "").toLowerCase()}` : null;
  }).filter(([, list]) => !list.every((r) => handleKeys.has(normHandle(r.instagram))));
  console.log(`\n2) Ta sama nazwa w tym samym mieście (inne handle): ${sameCity.length} grup`);
  for (const [k, list] of sameCity) {
    console.log(`  → ${k} (${list.length}x)`);
    for (const r of list) console.log(describe(r));
  }

  const otherCity = group((r) => normName(r.name) || null).filter(
    ([, list]) =>
      new Set(list.map((r) => (r.city ?? "").toLowerCase())).size > 1 &&
      !list.every((r) => handleKeys.has(normHandle(r.instagram))),
  );
  console.log(`\n3) Ta sama nazwa w innych miastach (może być sieć — tylko do oka): ${otherCity.length} grup`);
  for (const [k, list] of otherCity) {
    console.log(`  → ${k} (${list.length}x)`);
    for (const r of list) console.log(describe(r));
  }

  // 4) Wspólne RZADKIE słowo w nazwie (szyld), to samo miasto. Słowa generyczne
  // („kebab”, „ramen”, „pizza”) odpadają, bo występują w kilkudziesięciu nazwach.
  const GENERIC = new Set([
    "pizza", "pizzeria", "restauracja", "restaurant", "kawiarnia", "cafe", "coffee", "bar", "bistro",
    "sushi", "ramen", "kebab", "burger", "burgers", "food", "truck", "grill", "bakery", "piekarnia",
    "cukiernia", "lody", "lodziarnia", "brunch", "breakfast", "kuchnia", "trattoria", "osteria",
    "sklep", "deli", "club", "house", "the", "and", "oraz", "street", "studio", "lounge", "point",
    // słowa opisowe i przymiotniki od miast — wpadały jako „ten sam szyld”
    "karczma", "chata", "pijalnia", "zielony", "zielona", "między", "kuchni", "kuchnia", "sweets",
    "garden", "matcha", "indian", "italian", "gruzińska", "rzeszowska", "rzeszowskie", "lubelska",
    "lubelskie", "podlaska", "zapiekanki", "pierogarnia", "naturalne", "regionalna", "slodkie",
    "słodkie", "stoly", "stoły", "lunch", "shop", "cafe&lunch",
  ]);
  const freq = new Map<string, number>();
  const tokensOf = (r: Row) =>
    normName(r.name)
      .split(" ")
      .filter((w) => w.length >= 4 && !GENERIC.has(w));
  // Nazwy miast (i to, co po nich zostaje w nazwie lokalu) nie są szyldem.
  const cityWords = new Set<string>();
  for (const r of rows) for (const w of normName(r.city ?? "").split(" ")) if (w.length >= 4) cityWords.add(w);
  for (const r of rows) for (const t of new Set(tokensOf(r))) freq.set(t, (freq.get(t) ?? 0) + 1);

  const brandPairs: string[][] = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i];
      const b = rows[j];
      if ((a.city ?? "") !== (b.city ?? "")) continue;
      if (normHandle(a.instagram) === normHandle(b.instagram)) continue;
      const shared = tokensOf(a).filter(
        (t) => tokensOf(b).includes(t) && !cityWords.has(t) && (freq.get(t) ?? 0) <= 2,
      );
      if (shared.length) brandPairs.push([shared.join(", "), describe(a), describe(b)]);
    }
  }
  console.log(`\n4) Ten sam szyld w jednym mieście (jeden właściciel?): ${brandPairs.length} par`);
  for (const [shared, a, b] of brandPairs) {
    console.log(`  → wspólne: ${shared}`);
    console.log(a);
    console.log(b);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
