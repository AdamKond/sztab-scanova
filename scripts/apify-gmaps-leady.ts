// Zbiera lokale z Google Maps przez Apify (compass/crawler-google-places)
// razem z adresami e-mail ze stron lokali i zapisuje CSV pod import-maile.ts.
//
//   npx tsx scripts/apify-gmaps-leady.ts "Lublin" [--fraza=restauracja,pizzeria,kawiarnia] [--max=150] [--out=docs/research-2026-11/gmaps-lublin.csv]
//
// Token: APIFY_TOKEN w env albo ~/.apify/auth.json (po `apify login`).
// Koszt: ~0,004 USD za lokal + enrichment kontaktów (plan FREE = 5 USD/mies.,
// czyli ok. 800–1000 lokali miesięcznie). Skrypt najpierw wypisuje szacunek.
//
// Wyjścia:
//   <out>            — lokale Z e-mailem (gotowe do importu),
//   <out>-bez-maila.csv — lokale ze stroną, ale bez znalezionego adresu
//                         (dla scripts/znajdz-maile.ts, który szuka głębiej).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isSendableEmail, normalizeNiche } from "../lib/crm/mail/parse";

const ACTOR = "compass~crawler-google-places";
const API = "https://api.apify.com/v2";

function token(): string {
  const env = process.env.APIFY_TOKEN?.trim();
  if (env) return env;
  const file = path.join(os.homedir(), ".apify", "auth.json");
  if (existsSync(file)) {
    const j = JSON.parse(readFileSync(file, "utf8")) as { token?: string };
    if (j.token) return j.token;
  }
  throw new Error("Brak tokenu Apify: ustaw APIFY_TOKEN albo zaloguj się `apify login` (token w ~/.apify/auth.json).");
}

interface Place {
  title?: string;
  categoryName?: string;
  city?: string;
  website?: string;
  phone?: string;
  emails?: string[];
  url?: string;
  totalScore?: number;
  reviewsCount?: number;
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
  street?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T>(pathname: string, init?: RequestInit): Promise<T> {
  const url = `${API}${pathname}${pathname.includes("?") ? "&" : "?"}token=${encodeURIComponent(token())}`;
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Apify ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

async function runActor(city: string, phrases: string[], max: number): Promise<Place[]> {
  const input = {
    searchStringsArray: phrases,
    locationQuery: `${city}, Polska`,
    language: "pl",
    maxCrawledPlacesPerSearch: max,
    skipClosedPlaces: true,
    website: "withWebsite",
    scrapeContacts: true,
    scrapePlaceDetailPage: false,
    maxImages: 0,
    maxReviews: 0,
  };
  console.log(`Start: ${phrases.join(", ")} w ${city}, do ${max} na frazę…`);
  const started = await api<{ data: { id: string; defaultDatasetId: string } }>(`/acts/${ACTOR}/runs?memory=2048`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const runId = started.data.id;
  const datasetId = started.data.defaultDatasetId;
  console.log(`Run ${runId} (https://console.apify.com/actors/runs/${runId})`);
  for (;;) {
    await sleep(15_000);
    const run = await api<{ data: { status: string; stats?: { computeUnits?: number }; usageTotalUsd?: number } }>(`/actor-runs/${runId}`);
    const st = run.data.status;
    process.stdout.write(`\r  stan: ${st}${run.data.usageTotalUsd !== undefined ? `, koszt ~${run.data.usageTotalUsd.toFixed(2)} USD` : ""}      `);
    if (st === "SUCCEEDED") break;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(st)) throw new Error(`Run zakończony stanem ${st}`);
  }
  console.log();
  const items: Place[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await api<Place[]>(`/datasets/${datasetId}/items?format=json&clean=true&offset=${offset}&limit=1000`);
    items.push(...page);
    if (page.length < 1000) break;
  }
  return items;
}

const q = (s: string | number | null | undefined) => `"${String(s ?? "").replace(/"/g, '""')}"`;

async function main() {
  const args = process.argv.slice(2);
  const city = args.find((a) => !a.startsWith("--"));
  if (!city) {
    console.error('Użycie: npx tsx scripts/apify-gmaps-leady.ts "Lublin" [--fraza=restauracja,pizzeria] [--max=150] [--out=plik.csv]');
    process.exit(1);
  }
  const phrases = (args.find((a) => a.startsWith("--fraza="))?.slice(8) ?? "restauracja,pizzeria,kawiarnia,burgery,sushi").split(",").map((s) => s.trim()).filter(Boolean);
  const max = Number(args.find((a) => a.startsWith("--max="))?.slice(6) ?? "150") || 150;
  const slug = city.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
  const out = args.find((a) => a.startsWith("--out="))?.slice(6) ?? `docs/research-${new Date().toISOString().slice(0, 7)}/gmaps-${slug}.csv`;
  mkdirSync(path.dirname(out), { recursive: true });
  console.log(`Szacunek: do ${phrases.length * max} lokali ≈ ${(phrases.length * max * 0.004).toFixed(2)} USD + kontakty.`);

  const places = await runActor(city, phrases, max);
  const seen = new Set<string>();
  const withMail: string[] = ["email,nazwa,miasto,nisza,www,uwaga"];
  const noMail: string[] = ["nazwa,miasto,nisza,www,uwaga"];
  let dup = 0;
  for (const p of places) {
    if (p.permanentlyClosed || p.temporarilyClosed) continue;
    const key = (p.url ?? `${p.title}|${p.street}`).toLowerCase();
    if (seen.has(key)) {
      dup += 1;
      continue;
    }
    seen.add(key);
    const note = [p.totalScore ? `ocena ${p.totalScore}` : null, p.reviewsCount ? `${p.reviewsCount} opinii` : null, p.categoryName ?? null].filter(Boolean).join(", ");
    const email = (p.emails ?? []).map((e) => e.toLowerCase()).find(isSendableEmail);
    const niche = normalizeNiche(p.categoryName);
    if (email) withMail.push([email, p.title, p.city ?? city, niche, p.website, note].map(q).join(","));
    else if (p.website) noMail.push([p.title, p.city ?? city, niche, p.website, note].map(q).join(","));
  }
  writeFileSync(out, withMail.join("\n") + "\n", "utf8");
  const outNoMail = out.replace(/\.csv$/, "-bez-maila.csv");
  writeFileSync(outNoMail, noMail.join("\n") + "\n", "utf8");
  console.log(`Lokali: ${places.length} (${dup} duplikatów). Z e-mailem: ${withMail.length - 1} → ${out}. Ze stroną bez maila: ${noMail.length - 1} → ${outNoMail}`);
  console.log(`Dalej: npx tsx scripts/import-maile.ts ${out} --zrodlo=gmaps --wykonaj`);
  console.log(`       npx tsx scripts/znajdz-maile.ts ${outNoMail}   (dociąga adresy ze stron)`);
}

main().catch((err) => {
  console.error("Błąd:", err instanceof Error ? err.message : err);
  process.exit(1);
});
