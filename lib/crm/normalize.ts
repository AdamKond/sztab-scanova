// Normalizacja danych wejściowych. Jedno miejsce, z którego korzystają
// formularze, server actions i import CSV — żeby "Costa Coffee ", "@costacoffee"
// i "https://instagram.com/costacoffee/" trafiały do bazy w jednej postaci
// i dały się porównać przy wykrywaniu duplikatów.

/**
 * normalized_name: trim, lowercase, pojedyncze spacje, bez końcowej
 * interpunkcji. Ustawiane ZAWSZE przez kod serwerowy, nigdy z formularza.
 */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?\-–—\s]+$/u, "");
}

/** Instagram: przechowujemy sam handle, bez URL-a i bez @. */
export function normalizeInstagram(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let v = raw.trim().toLowerCase();
  v = v.replace(/^https?:\/\/(www\.)?instagram\.com\//, "");
  v = v.replace(/^@/, "");
  v = v.replace(/[/?#].*$/, "");
  v = v.trim();
  return v.length > 0 ? v : null;
}

/**
 * Telefon: tylko cyfry i wiodący "+". Polskie 9-cyfrowe numery bez prefiksu
 * dostają +48, żeby "512 345 678" i "+48512345678" były tym samym numerem
 * przy porównaniu duplikatów.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let v = raw.replace(/[^\d+]/g, "");
  if (!v) return null;
  if (v.startsWith("00")) v = `+${v.slice(2)}`;
  if (!v.startsWith("+") && v.length === 9) v = `+48${v}`;
  return v;
}

/**
 * Domena z adresu WWW: bez schematu, bez www., bez ścieżki — do porównań
 * duplikatów. "https://www.kawiarnia.pl/menu" -> "kawiarnia.pl".
 */
export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let v = raw.trim().toLowerCase();
  v = v.replace(/^https?:\/\//, "");
  v = v.replace(/^www\./, "");
  v = v.replace(/[/?#].*$/, "");
  v = v.trim();
  return v.length > 0 && v.includes(".") ? v : null;
}

/** WWW do zapisu: dokleja https:// jeśli brakuje schematu. */
export function normalizeWww(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/** Ocena Google: akceptujemy 0–5, zaokrąglamy do 1 miejsca; inaczej null. */
export function normalizeGoogleRating(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 5) return null;
  return Math.round(n * 10) / 10;
}

/** Przycina tekst do limitu (ochrona przed wklejeniem książki w notatkę). */
export function clampText(raw: string | null | undefined, max: number): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  return v.length > max ? v.slice(0, max) : v;
}
