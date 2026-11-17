// Lokale gastronomiczne z OpenStreetMap (Overpass API) — darmowe, bez limitów
// per konto. Zwraca nazwę, kategorię, stronę WWW i (gdy jest) e-mail.
//
//   npx tsx scripts/osm-leady.ts "Lublin" [--out=docs/research-2026-11/osm-lublin.csv] [--z-pliku=odp.json]
//
// Wyjścia (jak apify-gmaps-leady.ts):
//   <out>               — lokale z e-mailem w OSM (gotowe do import-maile.ts),
//   <out>-bez-maila.csv — lokale ze stroną WWW bez e-maila (dla znajdz-maile.ts).
// Linki do Facebooka/Instagrama nie liczą się jako strona (nie ma tam e-maila).
//
// Główny serwer overpass-api.de bywa przeciążony (502) — próbujemy po kolei
// kilka luster. Granice miasta bierzemy z Nominatim (bounding box).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isSendableEmail, normalizeNiche } from "../lib/crm/mail/parse";

const UA = "sztab-scanova/1.0 (kontakt: scanova.support@gmail.com)";
const MIRRORS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

interface Element {
  tags: Record<string, string>;
}

async function bbox(city: string): Promise<[number, number, number, number]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pl&q=${encodeURIComponent(city)}`;
  const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "pl" } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const data = (await res.json()) as { boundingbox: [string, string, string, string]; display_name: string }[];
  if (!data[0]) throw new Error(`Nominatim nie zna miasta "${city}"`);
  const [s, n, w, e] = data[0].boundingbox.map(Number);
  console.log(`Granice: ${data[0].display_name}`);
  return [s, w, n, e];
}

async function overpass(query: string, round = 1): Promise<Element[]> {
  let lastErr = "";
  for (const ep of MIRRORS) {
    try {
      const res = await fetch(ep, {
        method: "POST",
        headers: { "user-agent": UA, "content-type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) {
        lastErr = `${ep}: ${res.status}`;
        console.log(`  ${lastErr}, próbuję następne lustro`);
        continue;
      }
      const d = (await res.json()) as { elements?: Element[] };
      return d.elements ?? [];
    } catch (err) {
      lastErr = `${ep}: ${err instanceof Error ? err.message : String(err)}`;
      console.log(`  ${lastErr}, próbuję następne lustro`);
    }
  }
  // Serwery Overpass bywają zapchane przez kilka minut — trzy rundy z przerwą.
  if (round < 3) {
    console.log(`  wszystkie lustra zajęte, czekam 120 s (runda ${round + 1}/3)`);
    await new Promise((r) => setTimeout(r, 120_000));
    return overpass(query, round + 1);
  }
  throw new Error(`Overpass nie odpowiada: ${lastErr}`);
}

function nicheOf(t: Record<string, string>): string {
  const c = `${t.cuisine ?? ""} ${t.amenity ?? ""} ${t.name ?? ""}`.toLowerCase();
  if (/pizza/.test(c)) return "pizza";
  if (/burger/.test(c)) return "burgery";
  if (/kebab|fast_food/.test(c)) return "kebab/street food";
  if (/sushi|japanese|asian|ramen|thai|vietnam|chinese|korean/.test(c)) return "sushi/azja";
  if (/ice_cream|cukiernia|dessert|cake|bakery/.test(c)) return "cukiernia/lody";
  if (/cafe|coffee|kawiar/.test(c)) return "kawiarnia";
  if (/breakfast|brunch/.test(c)) return "sniadania/brunch";
  if (/vegan|vegetarian/.test(c)) return "vegan";
  if (/italian/.test(c)) return "wloska";
  return normalizeNiche(t.cuisine?.split(";")[0]);
}

const isSocial = (u: string) => /facebook\.com|fb\.com|instagram\.com|tiktok\.com|linktr\.ee|google\.|goo\.gl/i.test(u);
const q = (s: string | null | undefined) => `"${(s ?? "").replace(/"/g, '""')}"`;

async function main() {
  const args = process.argv.slice(2);
  const city = args.find((a) => !a.startsWith("--"));
  if (!city) {
    console.error('Użycie: npx tsx scripts/osm-leady.ts "Lublin" [--out=plik.csv]');
    process.exit(1);
  }
  const slug = city.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
  const out = args.find((a) => a.startsWith("--out="))?.slice(6) ?? `docs/research-${new Date().toISOString().slice(0, 7)}/osm-${slug}.csv`;
  mkdirSync(path.dirname(out), { recursive: true });

  // --z-pliku=plik.json: gotowa odpowiedź Overpass (np. zapisana wcześniej) zamiast pytania serwera.
  const fromFile = args.find((a) => a.startsWith("--z-pliku="))?.slice(10);
  let els: Element[];
  if (fromFile) {
    els = ((JSON.parse(readFileSync(fromFile, "utf8")) as { elements?: Element[] }).elements ?? []);
  } else {
    const [s, w, n, e] = await bbox(city);
    const query = `[out:json][timeout:150];
nwr(${s},${w},${n},${e})["amenity"~"^(restaurant|cafe|fast_food|bar|pub|ice_cream|food_court|biergarten)$"]["name"];
out tags center;`;
    console.log("Pytam Overpass…");
    els = await overpass(query);
    writeFileSync(out.replace(/\.csv$/, ".overpass.json"), JSON.stringify({ elements: els }), "utf8");
  }

  const withMail: string[] = ["email,nazwa,miasto,nisza,www,uwaga"];
  const noMail: string[] = ["nazwa,miasto,nisza,www,uwaga"];
  const seen = new Set<string>();
  let social = 0;
  for (const el of els) {
    const t = el.tags;
    const name = t.name?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const www = (t.website ?? t["contact:website"] ?? "").trim();
    const email = (t.email ?? t["contact:email"] ?? "").trim().toLowerCase().split(/[;,\s]+/)[0];
    const phone = t.phone ?? t["contact:phone"] ?? "";
    const town = t["addr:city"] ?? city;
    const note = [t.amenity, t.cuisine ? `kuchnia ${t.cuisine}` : null, phone ? `tel ${phone}` : null].filter(Boolean).join(", ");
    const niche = nicheOf(t);
    if (email && isSendableEmail(email)) {
      withMail.push([email, name, town, niche, www && !isSocial(www) ? www : "", note].map(q).join(","));
    } else if (www) {
      if (isSocial(www)) {
        social += 1;
        continue;
      }
      noMail.push([name, town, niche, www, note].map(q).join(","));
    }
  }
  writeFileSync(out, withMail.join("\n") + "\n", "utf8");
  const outNoMail = out.replace(/\.csv$/, "-bez-maila.csv");
  writeFileSync(outNoMail, noMail.join("\n") + "\n", "utf8");
  console.log(`Lokali w OSM: ${els.length}. Z e-mailem: ${withMail.length - 1} → ${out}. Ze stroną bez maila: ${noMail.length - 1} → ${outNoMail} (${social} tylko z Facebookiem/IG, pominięte).`);
  console.log(`Dalej: npx tsx scripts/import-maile.ts ${out} --zrodlo=strona --wykonaj`);
  console.log(`       npx tsx scripts/znajdz-maile.ts ${outNoMail}`);
}

main().catch((err) => {
  console.error("Błąd:", err instanceof Error ? err.message : err);
  process.exit(1);
});
