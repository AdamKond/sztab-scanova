// Wspólne typy i czyste helpery kreatora importu.
//
// Plik celowo BEZ "use server" i BEZ "server-only": te same funkcje muszą
// działać w podglądzie po stronie klienta ORAZ w walidacji po stronie serwera.
// Dzięki temu użytkownik widzi w podglądzie dokładnie tę wartość, która trafi
// do bazy (jedno źródło prawdy dla fallbacków źródła, priorytetu i liczników).
// Server actions nie mogą eksportować niczego poza funkcjami async — stąd
// osobny moduł na typy i stałe.

import { SOURCE_LABELS, SOURCES } from "@/lib/crm/constants";
import { isLeadPriority, isLeadSource } from "@/lib/crm/validation";
import type { LeadPriority, LeadSource } from "@/lib/crm/types";

/** Twardy limit jednego importu. Ten sam po stronie klienta i serwera. */
export const MAX_IMPORT_ROWS = 2000;

/** Wielkość paczki INSERT-a. Mniejsze paczki = mniejszy blast radius błędu. */
export const IMPORT_CHUNK_SIZE = 100;

/**
 * Pola, które wolno zaimportować.
 *
 * DLACZEGO nie ma tu status / monthly_revenue / plan / paid_at / pilot_*:
 * import to WEJŚCIE DO PROSPECTINGU, a nie księga przychodów. Wszystko,
 * co dotyczy pieniędzy i etapu lejka, musi powstać z realnej aktywności
 * handlowca (zmiana statusu ma własne reguły w validation.ts i zapisuje
 * historię etapów). Gdyby CSV mógł ustawić "płatny klient" z MRR-em,
 * raporty przychodów dałoby się zafałszować jednym wklejeniem arkusza.
 * Import tworzy więc wyłącznie świeże leady w statusie domyślnym ('nowy').
 */
export const IMPORT_FIELDS = [
  "name",
  "category",
  "city",
  "district",
  "address",
  "instagram",
  "phone",
  "email",
  "www",
  "google_rating",
  "locations_count",
  "estimated_daily_transactions",
  "source",
  "source_detail",
  "campaign",
  "priority",
  "notes",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  name: "Nazwa firmy",
  category: "Kategoria",
  city: "Miasto",
  district: "Dzielnica",
  address: "Adres",
  instagram: "Instagram",
  phone: "Telefon",
  email: "E-mail",
  www: "WWW",
  google_rating: "Ocena Google",
  locations_count: "Liczba lokali",
  estimated_daily_transactions: "Transakcje dziennie",
  source: "Źródło",
  source_detail: "Szczegóły źródła",
  campaign: "Kampania",
  priority: "Priorytet",
  notes: "Notatki",
};

/** Jeden wiersz po zmapowaniu kolumn — same stringi prosto z pliku. */
export type ImportRow = Partial<Record<ImportField, string>>;

/**
 * Wiersz w ładunku wysyłanym do server action.
 * `row` to numer wiersza danych w pliku (1 = pierwszy wiersz pod nagłówkiem) —
 * dzięki temu raport wskazuje użytkownikowi konkretne miejsce w arkuszu.
 * `force` = "importuj mimo to"; serwer honoruje tę flagę WYŁĄCZNIE dla
 * możliwych duplikatów, nigdy dla pewnych.
 */
export interface ImportPayloadRow {
  row: number;
  values: ImportRow;
  force?: boolean;
}

export type ImportVerdictKind =
  | "dodany_bedzie"
  | "duplikat"
  | "mozliwy_duplikat"
  | "blad";

/** Istniejący lead, z którym wiersz koliduje (null przy kolizji w obrębie pliku). */
export interface ImportVerdictMatch {
  id: string;
  name: string;
  city: string | null;
}

export interface ImportVerdict {
  row: number;
  /** Nazwa po normalizacji — to, co użytkownik rozpozna w raporcie. */
  name: string;
  kind: ImportVerdictKind;
  /** Polski powód werdyktu (błąd walidacji albo rodzaj duplikatu). */
  message: string;
  match: ImportVerdictMatch | null;
  /** Miękkie uwagi (np. ocena Google poza 0–5 zostanie wyzerowana). */
  warnings: string[];
}

export interface DryRunResult {
  error?: string;
  verdicts?: ImportVerdict[];
}

export interface ImportReportError {
  row: number;
  name: string;
  message: string;
}

/**
 * Raport końcowy.
 * - `dodano` — faktycznie wstawione wiersze,
 * - `duplikaty` — pominięte jako duplikat (pewny albo możliwy bez zgody),
 * - `bledy` — wiersze odrzucone przez walidację lub bazę,
 * - `pominieto` — suma pominiętych (duplikaty + błędy).
 */
export interface ImportReport {
  dodano: number;
  pominieto: number;
  duplikaty: number;
  bledy: ImportReportError[];
}

export interface RunImportResult {
  error?: string;
  report?: ImportReport;
}

// ----------------------------------------------------------------------------
// Czyste parsery wartości słownikowych (klient + serwer)
// ----------------------------------------------------------------------------

// Rozpoznajemy też polskie etykiety ("Instagram DM"), bo arkusze robią ludzie,
// a nie eksporty z API — w kolumnie "źródło" częściej jest etykieta niż slug.
const SOURCE_BY_LABEL = new Map<string, LeadSource>(
  SOURCES.map((s) => [SOURCE_LABELS[s].toLowerCase(), s]),
);

/**
 * Źródło z pliku -> LeadSource. Fallback "inne", NIE "teren":
 * lead z zewnętrznej listy nie był pozyskany w terenie i takie kłamstwo
 * rozjechałoby raport skuteczności kanałów.
 */
export function parseSourceValue(raw: string | null | undefined): LeadSource {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "inne";
  const slug = v.replace(/[\s.\-–—]+/g, "_");
  if (isLeadSource(slug)) return slug;
  const byLabel = SOURCE_BY_LABEL.get(v);
  if (byLabel) return byLabel;
  return "inne";
}

/**
 * Priorytet z pliku -> A/B/C/D. Bierzemy pierwszy znak, bo w arkuszach
 * bywa "A — idealne dopasowanie" albo "b". Fallback "B" (dobre dopasowanie),
 * czyli neutralne domyślne, nie zawyżone "A".
 */
export function parsePriorityValue(raw: string | null | undefined): LeadPriority {
  const v = (raw ?? "").trim().toUpperCase();
  if (!v) return "B";
  const first = v.slice(0, 1);
  return isLeadPriority(first) ? first : "B";
}

/**
 * Liczba całkowita nieujemna z arkusza ("1 200", "1200,0") albo null.
 * Spacje nierozdzielające z Excela też wycinamy.
 */
export function parseCountValue(raw: string | null | undefined): number | null {
  const v = (raw ?? "").replace(/[\s ]/g, "").replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}
