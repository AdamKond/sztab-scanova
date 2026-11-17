// Darmowe źródło lokali: restaurantguru.com (listing miasta → strony lokali →
// adres WWW, kuchnia, telefon, Instagram). Wynik to CSV `nazwa,miasto,nisza,www,uwaga`
// dla scripts/znajdz-maile.ts, który szuka e-maili na stronach lokali.
//
//   npx tsx scripts/restaurantguru-leady.ts Rzeszow [--strony=20] [--out=docs/research-2026-11/rg-rzeszow.csv]
//
// Miasto w pisowni restaurantguru (bez polskich znaków): Lublin, Rzeszow, Kielce,
// Radom, Warsaw, Krakow, Bialystok, Zamosc, Chelm, Pulawy, Swidnik…
// ~17 lokali na stronę listingu; Rzeszów ma ~80 stron. Tempo grzeczne
// (4 strony lokali naraz, ~0,4 s przerwy), bez logowania, tylko publiczne dane.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { normalizeNiche } from "../lib/crm/mail/parse";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": UA, "accept-language": "pl,en;q=0.8" } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const strip = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&#039;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

interface Place {
  name: string;
  url: string;
  www: string | null;
  cuisines: string;
  phone: string | null;
  instagram: string | null;
  rating: string | null;
  reviews: string | null;
}

function parseDetail(html: string, url: string): Place {
  const one = html.replace(/\n/g, " ");
  const h1 = one.match(/<h1[^>]*>(.*?)<\/h1>/);
  const name = h1 ? strip(h1[1]) : strip(one.match(/<title>([^<]*)<\/title>/)?.[1] ?? "").split(/[,–-]/)[0];
  // WWW: anchor w bloku .website — tekst linku to domena lokalu (href prowadzi przez przekierowanie RG).
  const site = one.match(/<div class="website">.*?<a[^>]*>\s*([^<\s]+)\s*<\/a>/);
  const www = site ? site[1].trim() : null;
  const cuisine = one.match(/class="cuisine_wrapper">(.*?)<\/div>\s*<\/div>/);
  const cuisines = cuisine ? strip(cuisine[1]).replace(/\s*,\s*/g, ", ") : "";
  const phone = one.match(/href="tel:([^"]+)"/)?.[1] ?? null;
  const ig = one.match(/<div class="instagram">.*?<a[^>]*>\s*@?([A-Za-z0-9._]+)\s*<\/a>/);
  const rating = one.match(/"ratingValue":\s*"?([0-9.]+)"?/)?.[1] ?? null;
  const reviews = one.match(/"reviewCount":\s*"?([0-9]+)"?/)?.[1] ?? null;
  return { name, url, www, cuisines, phone, instagram: ig ? ig[1] : null, rating, reviews };
}

function nicheFromCuisines(cuisines: string, name: string): string {
  const c = `${cuisines} ${name}`.toLowerCase();
  if (/pizza/.test(c)) return "pizza";
  if (/burger/.test(c)) return "burgery";
  if (/kebab|street food|fast food/.test(c)) return "kebab/street food";
  if (/sushi|japanese|asian|ramen|thai|vietnam|chinese|korean/.test(c)) return "sushi/azja";
  if (/cafe|coffee|kawiarnia|cukiernia|bakery|dessert|ice cream|lod/.test(c)) return /cukiernia|bakery|dessert|ice cream|lod/.test(c) ? "cukiernia/lody" : "kawiarnia";
  if (/breakfast|brunch/.test(c)) return "sniadania/brunch";
  if (/vegan|vegetarian cuisine/.test(c)) return "vegan";
  if (/italian/.test(c)) return "wloska";
  return normalizeNiche(cuisines.split(",")[0]);
}

async function main() {
  const args = process.argv.slice(2);
  const city = args.find((a) => !a.startsWith("--"));
  if (!city) {
    console.error("Użycie: npx tsx scripts/restaurantguru-leady.ts Rzeszow [--strony=20] [--out=plik.csv]");
    process.exit(1);
  }
  const maxPages = Number(args.find((a) => a.startsWith("--strony="))?.slice(9) ?? "20") || 20;
  const out = args.find((a) => a.startsWith("--out="))?.slice(6) ?? `docs/research-${new Date().toISOString().slice(0, 7)}/rg-${city.toLowerCase()}.csv`;
  mkdirSync(path.dirname(out), { recursive: true });

  // Już zebrane adresy (wznawianie bez powtórek).
  const seen = new Set<string>();
  if (existsSync(out)) for (const l of readFileSync(out, "utf8").split("\n").slice(1)) if (l.trim()) seen.add(l.split(",")[0].replace(/"/g, "").toLowerCase());

  const detailUrls: string[] = [];
  const linkRe = new RegExp(`href="(https://restaurantguru\\.com/[A-Za-z0-9-]+-${city})"`, "g");
  for (let p = 1; p <= maxPages; p++) {
    const url = `https://restaurantguru.com/restaurant-${city}-t1${p > 1 ? `/${p}` : ""}`;
    const html = await get(url);
    if (!html) {
      console.log(`strona ${p}: brak odpowiedzi, koniec listingu`);
      break;
    }
    const before = detailUrls.length;
    for (const m of html.matchAll(linkRe)) if (!detailUrls.includes(m[1])) detailUrls.push(m[1]);
    process.stdout.write(`\rlisting ${p}/${maxPages}: ${detailUrls.length} lokali`);
    if (detailUrls.length === before && p > 1) break;
    await sleep(400);
  }
  console.log();

  const places: Place[] = [];
  let i = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (i < detailUrls.length) {
        const url = detailUrls[i++];
        const html = await get(url);
        if (html) places.push(parseDetail(html, url));
        done += 1;
        if (done % 10 === 0 || done === detailUrls.length) process.stdout.write(`\rlokale ${done}/${detailUrls.length}, ze stroną: ${places.filter((x) => x.www).length}`);
        await sleep(400);
      }
    }),
  );
  console.log();

  const q = (s: string | null | undefined) => `"${(s ?? "").replace(/"/g, '""')}"`;
  const lines = existsSync(out) ? [] : ["nazwa,miasto,nisza,www,uwaga"];
  let added = 0;
  for (const p of places) {
    if (!p.www || seen.has(p.name.toLowerCase())) continue;
    seen.add(p.name.toLowerCase());
    const note = [p.rating ? `ocena ${p.rating}` : null, p.reviews ? `${p.reviews} opinii` : null, p.cuisines || null, p.phone ? `tel ${p.phone}` : null, p.instagram ? `@${p.instagram}` : null].filter(Boolean).join(", ");
    lines.push([p.name, city, nicheFromCuisines(p.cuisines, p.name), p.www, note].map(q).join(","));
    added += 1;
  }
  writeFileSync(out, (existsSync(out) ? readFileSync(out, "utf8").replace(/\n?$/, "\n") : "") + lines.join("\n") + "\n", "utf8");
  console.log(`Lokali: ${places.length}, ze stroną WWW: ${added} (nowych) → ${out}`);
  console.log(`Dalej: npx tsx scripts/znajdz-maile.ts ${out}`);
}

main().catch((err) => {
  console.error("Błąd:", err instanceof Error ? err.message : err);
  process.exit(1);
});
