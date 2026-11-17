// Szuka adresów e-mail na stronach lokali (strona główna + /kontakt itp.).
//
//   npx tsx scripts/znajdz-maile.ts <plik.csv> [--out=wynik.csv] [--rownolegle=6]
//
// Wejście: CSV/TXT z kolumną www (albo linie `nazwa | miasto | nisza | www`),
// np. wynik scripts/apify-gmaps-leady.ts albo docs/research-2026-09/kontakty.csv.
// Wyjście: CSV `email,nazwa,miasto,nisza,www,uwaga` gotowe do
// scripts/import-maile.ts. Pomija adresy portali/techniczne (isSendableEmail).
//
// Zasady: tylko adresy OPUBLIKOWANE przez lokal na własnej stronie (RODO/PKE),
// timeout 12 s na stronę, bez JS — strony na Wixie/Squarespace bywają puste,
// wtedy próbujemy jeszcze podstron kontaktowych.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isSendableEmail, normalizeNiche, splitCsvRow } from "../lib/crm/mail/parse";

const CONTACT_PATHS = ["", "/kontakt", "/kontakt/", "/contact", "/kontakt.html", "/o-nas", "/about", "/#kontakt"];
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

interface Row {
  name: string;
  city: string;
  niche: string;
  www: string;
  note: string;
}

function readRows(file: string): Row[] {
  const text = readFileSync(file, "utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const header = splitCsvRow(lines[0]).map((c) => c.replace(/"/g, "").trim().toLowerCase());
  const iWww = header.findIndex((h) => h === "www" || h === "website" || h === "strona");
  const rows: Row[] = [];
  if (iWww >= 0) {
    const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
    const iName = idx(["nazwa", "name", "title"]);
    const iCity = idx(["miasto", "city"]);
    const iNiche = idx(["nisza", "niche", "kategoria", "category", "categoryname"]);
    const iNote = idx(["uwaga", "notatka", "note"]);
    for (const line of lines.slice(1)) {
      const f = splitCsvRow(line).map((c) => c.replace(/^"|"$/g, "").trim());
      const www = f[iWww];
      if (!www) continue;
      rows.push({ name: f[iName] ?? "", city: iCity >= 0 ? f[iCity] ?? "" : "", niche: iNiche >= 0 ? f[iNiche] ?? "" : "", www, note: iNote >= 0 ? f[iNote] ?? "" : "" });
    }
    return rows;
  }
  for (const line of lines) {
    const f = line.split(/\s*[|;\t]\s*/).map((x) => x.trim());
    const www = f.find((x) => /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(x) && !x.includes("@"));
    if (!www) continue;
    const rest = f.filter((x) => x !== www);
    rows.push({ name: rest[0] ?? "", city: rest[1] ?? "", niche: rest[2] ?? "", www, note: "" });
  }
  return rows;
}

async function fetchText(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": UA, accept: "text/html,*/*" }, redirect: "follow" });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!/html|text|xml/.test(type)) return null;
    const body = await res.text();
    return body.slice(0, 1_500_000);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function decodeObfuscated(html: string): string {
  return html
    .replace(/&#64;|&#x40;|%40|\s?\[at\]\s?|\s?\(at\)\s?|\s+at\s+(?=[a-z0-9-]+\s*(\.|\[dot\]|\(dot\))\s*[a-z]{2,})/gi, "@")
    .replace(/\s?\[dot\]\s?|\s?\(dot\)\s?|&#46;/gi, ".")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function emailsFrom(html: string): string[] {
  const text = decodeObfuscated(html);
  const found = new Set<string>();
  for (const m of text.match(/mailto:([^"'?\s>]+)/gi) ?? []) {
    const e = m.slice(7).toLowerCase();
    if (isSendableEmail(e)) found.add(e);
  }
  for (const m of text.match(EMAIL_RE) ?? []) {
    const e = m.toLowerCase();
    if (isSendableEmail(e)) found.add(e);
  }
  return [...found];
}

function base(www: string): string {
  const v = www.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/** Preferuj adres w domenie strony, potem kontakt@/biuro@, na końcu resztę. */
function pickBest(emails: string[], www: string): string | null {
  if (emails.length === 0) return null;
  const domain = base(www).replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  const score = (e: string) => {
    let s = 0;
    if (e.endsWith(`@${domain}`)) s += 10;
    if (/^(kontakt|biuro|info|hello|hej|rezerwacje|restauracja|office|contact)@/.test(e)) s += 3;
    if (/^(sklep|zamowienia|catering|marketing|wspolpraca|współpraca)@/.test(e)) s += 1;
    return s;
  };
  return [...emails].sort((a, b) => score(b) - score(a))[0];
}

async function findForRow(row: Row): Promise<{ email: string | null; checked: number }> {
  const root = base(row.www);
  let checked = 0;
  const all = new Set<string>();
  for (const p of CONTACT_PATHS) {
    const html = await fetchText(`${root}${p}`);
    checked += 1;
    if (!html) continue;
    for (const e of emailsFrom(html)) all.add(e);
    // Strona główna dała adres w domenie lokalu → nie szukamy dalej.
    const best = pickBest([...all], row.www);
    if (best && best.endsWith(`@${root.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}`)) break;
    if (p === "" && all.size > 0) break;
  }
  return { email: pickBest([...all], row.www), checked };
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const out = args.find((a) => a.startsWith("--out="))?.slice(6) ?? (file ? file.replace(/\.(csv|txt)$/i, "") + "-maile.csv" : "maile.csv");
  const parallel = Number(args.find((a) => a.startsWith("--rownolegle="))?.slice(13) ?? "6") || 6;
  if (!file || !existsSync(file)) {
    console.error("Użycie: npx tsx scripts/znajdz-maile.ts <plik.csv> [--out=wynik.csv] [--rownolegle=6]");
    process.exit(1);
  }
  const rows = readRows(file);
  const seenWww = new Set<string>();
  const todo = rows.filter((r) => {
    const k = base(r.www).toLowerCase();
    if (seenWww.has(k)) return false;
    seenWww.add(k);
    return true;
  });
  console.log(`${todo.length} stron do sprawdzenia (${parallel} naraz)…`);

  const results: { row: Row; email: string | null }[] = [];
  let i = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: parallel }, async () => {
      while (i < todo.length) {
        const row = todo[i++];
        const r = await findForRow(row);
        results.push({ row, email: r.email });
        done += 1;
        if (done % 10 === 0 || done === todo.length) process.stdout.write(`\r${done}/${todo.length} sprawdzonych, ${results.filter((x) => x.email).length} adresów`);
      }
    }),
  );
  console.log();

  const found = results.filter((x) => x.email);
  const q = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
  const lines = ["email,nazwa,miasto,nisza,www,uwaga"];
  for (const { row, email } of found) {
    lines.push([email!, row.name, row.city, normalizeNiche(row.niche), base(row.www), row.note].map(q).join(","));
  }
  writeFileSync(out, lines.join("\n") + "\n", "utf8");
  console.log(`Znaleziono ${found.length} adresów z ${todo.length} stron → ${out}`);
  console.log(`Dalej: npx tsx scripts/import-maile.ts ${out} --zrodlo=strona --wykonaj`);
}

main().catch((err) => {
  console.error("Błąd:", err instanceof Error ? err.message : err);
  process.exit(1);
});
