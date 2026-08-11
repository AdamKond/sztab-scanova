// Pomocniki dat. Wszystkie granice dni liczymy w Europe/Warsaw, nigdy w UTC
// serwera — wizyta wpisana o 23:30 czasu polskiego ma należeć do tego dnia,
// który widzi człowiek w Lublinie, a nie do "jutra" według serwera w Irlandii.

const WARSAW_TZ = "Europe/Warsaw";

// "en-CA" formatuje jako YYYY-MM-DD — porównywalne leksykograficznie.
const warsawDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: WARSAW_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dzień (YYYY-MM-DD) w strefie Europe/Warsaw dla danej chwili. */
export function warsawDateOf(instant: Date | string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return warsawDayFormatter.format(d);
}

/** Dzisiejszy dzień (YYYY-MM-DD) w Europe/Warsaw. */
export function warsawToday(now: Date = new Date()): string {
  return warsawDateOf(now);
}

/**
 * Różnica w pełnych dniach kalendarzowych między dwoma YYYY-MM-DD (b - a).
 * Liczymy w UTC na sztywnych datach, żeby zmiana czasu letni/zimowy nigdy
 * nie dała 0.96 ani 1.04 dnia.
 */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const utcA = Date.UTC(ay, am - 1, ad);
  const utcB = Date.UTC(by, bm - 1, bd);
  return Math.round((utcB - utcA) / 86_400_000);
}

/** Dodaje n dni do YYYY-MM-DD (n może być ujemne). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Ile pełnych dni minęło od chwili `iso` do teraz (w dniach warszawskich). */
export function daysSince(iso: string, now: Date = new Date()): number {
  return daysBetween(warsawDateOf(iso), warsawDateOf(now));
}

/** Milisekundy między dwoma ISO timestampami (b - a). */
export function msBetween(aIso: string, bIso: string): number {
  return new Date(bIso).getTime() - new Date(aIso).getTime();
}

/** Format krótkiej daty do UI: "12.08". */
export function shortDate(isoOrDay: string): string {
  const day = isoOrDay.length > 10 ? warsawDateOf(isoOrDay) : isoOrDay;
  const [, m, d] = day.split("-");
  return `${d}.${m}`;
}

/** Format pełnej daty do UI: "12.08.2026". */
export function fullDate(isoOrDay: string): string {
  const day = isoOrDay.length > 10 ? warsawDateOf(isoOrDay) : isoOrDay;
  const [y, m, d] = day.split("-");
  return `${d}.${m}.${y}`;
}

/** Data + godzina do UI: "12.08 14:30" (Europe/Warsaw). */
export function shortDateTime(iso: string): string {
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat("pl-PL", {
    timeZone: WARSAW_TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${shortDate(iso)} ${time}`;
}

/** Względny opis dni ciszy: "dziś", "wczoraj", "5 dni temu". */
export function daysAgoLabel(days: number): string {
  if (days <= 0) return "dziś";
  if (days === 1) return "wczoraj";
  return `${days} dni temu`;
}
