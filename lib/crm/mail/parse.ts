// Parser wklejanych list adresów (ekran Maile → "Wklej listę" i skrypt importu).
// Czysty moduł. Jedna linia = jeden lokal:
//   email | nazwa | miasto | nisza | www | notatka
// Separator: | ; tab. Kolejność pól po adresie jest stała; brakujące = puste.
// Rozpoznaje też nagłówek CSV z research (kolumny instagram,nazwa,miasto,email,...).

import { NICHES } from "../dm-copy";
import { normalizeInstagram, normalizePhone, normalizeWww } from "../normalize";

export interface ParsedContact {
  email: string;
  name: string;
  city: string | null;
  niche: string;
  www: string | null;
  instagram: string | null;
  phone: string | null;
  note: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Domeny, z których nie piszemy (portale, agregatory, nasze własne). */
const BLOCKED_DOMAINS = [
  "scanova.tech",
  "pyszne.pl",
  "glovoapp.com",
  "wolt.com",
  "uber.com",
  "ubereats.com",
  "google.com",
  "facebook.com",
  "instagram.com",
  "wix.com",
  "wixpress.com",
  "sentry.io",
  "example.com",
  "domain.com",
  "email.com",
  "test.com",
];

/** Lokalne części, które prawie nigdy nie prowadzą do właściciela. */
const BLOCKED_LOCAL = ["noreply", "no-reply", "donotreply", "abuse", "postmaster", "webmaster", "hostmaster", "privacy", "rodo", "iod", "praca", "rekrutacja", "faktury", "invoice", "ksiegowosc"];

export function isSendableEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return false;
  const [local, domain] = e.split("@");
  if (BLOCKED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return false;
  if (BLOCKED_LOCAL.some((l) => local === l || local.startsWith(`${l}.`) || local.startsWith(`${l}-`))) return false;
  // Obrazki i pliki złapane regexem ze stron ("logo@2x.png").
  if (/\.(png|jpe?g|gif|svg|webp|css|js)$/.test(domain)) return false;
  return true;
}

export function normalizeNiche(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "restauracja";
  if (NICHES.includes(v)) return v;
  if (/pizz/.test(v)) return "pizza";
  if (/burger/.test(v)) return "burgery";
  if (/kebab|street|food ?truck/.test(v)) return "kebab/street food";
  if (/kawiar|cafe|caffe|coffee|kawa/.test(v)) return "kawiarnia";
  if (/cukier|lod|desery|ciast|piekar/.test(v)) return "cukiernia/lody";
  if (/śniad|sniad|brunch/.test(v)) return "sniadania/brunch";
  if (/sushi|azj|ramen|tajsk|wietnam|chiń|chin|japo|kore/.test(v)) return "sushi/azja";
  if (/boba|bubble|matcha/.test(v)) return "boba/matcha";
  if (/vegan|wege|wega/.test(v)) return "vegan";
  if (/włos|wlos|ital|trattor|osteria/.test(v)) return "wloska";
  return "restauracja";
}

/** Rozbija linię na pola po | ; lub tabulatorze (przecinek tylko gdy brak innych). */
function splitLine(line: string): string[] {
  if (/[|;\t]/.test(line)) return line.split(/\s*[|;\t]\s*/);
  return line.split(/\s*,\s*/);
}

export function parseContactLines(raw: string): { contacts: ParsedContact[]; errors: string[] } {
  const contacts: ParsedContact[] = [];
  const errors: string[] = [];
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { contacts, errors };

  // Nagłówek CSV z research (kontakty.csv): kolumny po nazwach.
  const header = lines[0].toLowerCase().replace(/^﻿/, "");
  if (/(^|[,;|\t])"?email"?([,;|\t]|$)/.test(header) && /nazwa|name/.test(header)) {
    const cols = splitCsvRow(header).map((c) => c.replace(/"/g, "").trim());
    const idx = (n: string) => cols.indexOf(n);
    const iEmail = idx("email");
    const iName = idx("nazwa") >= 0 ? idx("nazwa") : idx("name");
    const iCity = idx("miasto") >= 0 ? idx("miasto") : idx("city");
    const iNiche = idx("nisza") >= 0 ? idx("nisza") : idx("niche") >= 0 ? idx("niche") : idx("kategoria");
    const iWww = idx("www") >= 0 ? idx("www") : idx("website");
    const iIg = idx("instagram");
    const iPhone = idx("telefon") >= 0 ? idx("telefon") : idx("phone");
    const iNote = idx("uwaga") >= 0 ? idx("uwaga") : idx("notatka") >= 0 ? idx("notatka") : idx("note");
    for (const line of lines.slice(1)) {
      const f = splitCsvRow(line).map((c) => c.replace(/^"|"$/g, "").trim());
      const email = (f[iEmail] ?? "").toLowerCase();
      if (!email) continue;
      if (!isSendableEmail(email)) {
        errors.push(`${email}: adres pominięty (portal/techniczny/niepoprawny)`);
        continue;
      }
      const name = f[iName] || email.split("@")[1];
      contacts.push({
        email,
        name,
        city: iCity >= 0 ? f[iCity] || null : null,
        niche: normalizeNiche(iNiche >= 0 ? f[iNiche] : null),
        www: normalizeWww(iWww >= 0 ? f[iWww] : null),
        instagram: normalizeInstagram(iIg >= 0 ? f[iIg] : null),
        phone: normalizePhone(iPhone >= 0 ? f[iPhone] : null),
        note: iNote >= 0 ? f[iNote] || null : null,
      });
    }
    return { contacts, errors };
  }

  for (const line of lines) {
    const f = splitLine(line);
    // Adres może być w dowolnym miejscu linii — bierzemy pierwszy, który wygląda jak e-mail.
    const emailIdx = f.findIndex((x) => EMAIL_RE.test(x.trim().toLowerCase()));
    if (emailIdx < 0) {
      errors.push(`brak adresu: ${line.slice(0, 60)}`);
      continue;
    }
    const email = f[emailIdx].trim().toLowerCase();
    if (!isSendableEmail(email)) {
      errors.push(`${email}: adres pominięty (portal/techniczny)`);
      continue;
    }
    const rest = f.filter((_, i) => i !== emailIdx).map((x) => x.trim());
    const [name, city, niche, www, note] = rest;
    contacts.push({
      email,
      name: name || email.split("@")[1],
      city: city || null,
      niche: normalizeNiche(niche),
      www: normalizeWww(www || null),
      instagram: null,
      phone: null,
      note: note || null,
    });
  }
  return { contacts, errors };
}

/** Minimalny parser wiersza CSV z cudzysłowami. */
export function splitCsvRow(row: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQ && row[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if ((ch === "," || ch === ";") && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
