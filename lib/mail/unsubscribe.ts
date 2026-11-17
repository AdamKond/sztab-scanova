// Link do wypisania się: adres + HMAC, żeby nikt nie wypisał cudzego adresu
// zgadując URL. Bez bazy — podpis weryfikujemy samym sekretem.
//
// Sekret: MAIL_SECRET (dowolny długi losowy ciąg). Bez niego moduł rzuca —
// mail bez działającego linku do wypisania nie ma prawa wyjść.

import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.MAIL_SECRET?.trim();
  if (!s || s.length < 16) {
    throw new Error("Brak MAIL_SECRET (min. 16 znaków) — potrzebny do linków wypisania.");
  }
  return s;
}

function sign(email: string): string {
  return createHmac("sha256", secret()).update(email.trim().toLowerCase()).digest("base64url").slice(0, 32);
}

export function unsubscribeToken(email: string): string {
  return sign(email);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = Buffer.from(sign(email));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Publiczny adres Sztabu (bez końcowego ukośnika). */
export function publicBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SZTAB_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "https://sztab-scanova.vercel.app";
}

export function unsubscribeUrl(email: string): string {
  const e = Buffer.from(email.trim().toLowerCase()).toString("base64url");
  return `${publicBaseUrl()}/api/mail/wypisz?e=${e}&t=${unsubscribeToken(email)}`;
}

export function decodeEmailParam(e: string | null): string | null {
  if (!e) return null;
  try {
    const v = Buffer.from(e, "base64url").toString("utf8").trim().toLowerCase();
    return v.includes("@") ? v : null;
  } catch {
    return null;
  }
}
