"use server";

// Server actions importu leadów.
//
// Zasady, od których nie ma odstępstw:
// 1. Każda akcja zaczyna się od guardStaffAction() — server actions to publiczne
//    endpointy HTTP z przewidywalnym ID, da się je wywołać curl-em bez naszego UI.
// 2. Nie ufamy klientowi w NICZYM. Kreator normalizuje dane tylko po to, żeby
//    pokazać podgląd; tutaj cała normalizacja i walidacja leci od nowa.
// 3. dryRunImport NIE PISZE do bazy — to jedyna różnica logiki wobec runImport,
//    dlatego obie akcje dzielą tę samą funkcję oceniającą (evaluateRows).
//    Gdyby ocena była zduplikowana, raport z dry-runu prędzej czy później
//    rozjechałby się z tym, co faktycznie robi import.

import { revalidatePath } from "next/cache";
import { guardStaffAction } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { findDuplicateCandidates } from "@/lib/crm/queries";
import {
  clampText,
  normalizeDomain,
  normalizeGoogleRating,
  normalizeInstagram,
  normalizeName,
  normalizePhone,
  normalizeWww,
} from "@/lib/crm/normalize";
import { LIMITS } from "@/lib/crm/validation";
import type { CrmLead } from "@/lib/crm/types";
import {
  IMPORT_CHUNK_SIZE,
  MAX_IMPORT_ROWS,
  parseCountValue,
  parsePriorityValue,
  parseSourceValue,
  type DryRunResult,
  type ImportPayloadRow,
  type ImportReportError,
  type ImportRow,
  type ImportVerdict,
  type RunImportResult,
} from "./types";

// ----------------------------------------------------------------------------
// Przygotowanie wiersza
// ----------------------------------------------------------------------------

/** Wiersz gotowy do wstawienia + klucze do porównań duplikatów. */
interface PreparedRow {
  /** Rekord dokładnie w kształcie kolumn crm_leads (bez pól płatnościowych). */
  lead: Record<string, unknown>;
  keys: {
    normalized_name: string;
    city: string | null;
    phone: string | null;
    instagram: string | null;
    domain: string | null;
  };
  displayName: string;
  warnings: string[];
}

function pick(values: ImportRow, field: keyof ImportRow): string | null {
  const v = values[field];
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/**
 * Surowy wiersz -> rekord leada. Zwraca błąd zamiast rzucać, bo jeden zepsuty
 * wiersz nie może wywrócić całego importu.
 */
function prepareRow(
  values: ImportRow,
  owner: string,
): { error: string; prepared?: undefined } | { error?: undefined; prepared: PreparedRow } {
  const warnings: string[] = [];

  const name = clampText(pick(values, "name"), LIMITS.name);
  if (!name) return { error: "Brak nazwy firmy — wiersz pominięty." };

  const normalized_name = normalizeName(name);
  if (!normalized_name) {
    return { error: "Nazwa firmy składa się z samej interpunkcji — wiersz pominięty." };
  }

  const city = clampText(pick(values, "city"), LIMITS.shortText);
  const phone = normalizePhone(pick(values, "phone"));
  const instagram = normalizeInstagram(pick(values, "instagram"));
  const www = normalizeWww(clampText(pick(values, "www"), LIMITS.shortText));
  const domain = normalizeDomain(www);

  // Ocena Google: normalizeGoogleRating zwraca null dla wartości spoza 0–5.
  // Rozróżniamy "puste" od "podane, ale bezsensowne" — w drugim przypadku
  // ostrzegamy, bo cicha utrata danych to najgorszy rodzaj importu.
  const ratingRaw = pick(values, "google_rating");
  const google_rating = normalizeGoogleRating(ratingRaw);
  if (ratingRaw !== null && google_rating === null) {
    warnings.push(`Ocena Google „${ratingRaw}" jest poza zakresem 0–5 — pole zostanie puste.`);
  }

  // E-mail bez małpy to prawie zawsze przesunięta kolumna w arkuszu.
  // Zapisanie śmiecia zablokowałoby późniejszy mailing, więc czyścimy i mówimy o tym.
  const emailRaw = clampText(pick(values, "email"), LIMITS.shortText);
  let email = emailRaw;
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    warnings.push(`„${emailRaw}" nie wygląda na adres e-mail — pole zostanie puste.`);
    email = null;
  }

  const sourceRaw = pick(values, "source");
  const source = parseSourceValue(sourceRaw);
  if (sourceRaw && source === "inne" && sourceRaw.trim().toLowerCase() !== "inne") {
    warnings.push(`Nieznane źródło „${sourceRaw}" — ustawimy „inne".`);
  }

  const priorityRaw = pick(values, "priority");
  const priority = parsePriorityValue(priorityRaw);
  if (priorityRaw && priorityRaw.trim().toUpperCase().slice(0, 1) !== priority) {
    warnings.push(`Nieznany priorytet „${priorityRaw}" — ustawimy „B".`);
  }

  // locations_count jest NOT NULL w schemacie; brak danych = jeden lokal.
  const locations_count = parseCountValue(pick(values, "locations_count")) || 1;

  return {
    prepared: {
      lead: {
        name,
        normalized_name,
        category: clampText(pick(values, "category"), LIMITS.shortText),
        city,
        district: clampText(pick(values, "district"), LIMITS.shortText),
        address: clampText(pick(values, "address"), LIMITS.shortText),
        instagram,
        phone,
        email,
        www,
        google_rating,
        locations_count,
        estimated_daily_transactions: parseCountValue(
          pick(values, "estimated_daily_transactions"),
        ),
        source,
        source_detail: clampText(pick(values, "source_detail"), LIMITS.shortText),
        campaign: clampText(pick(values, "campaign"), LIMITS.shortText),
        priority,
        notes: clampText(pick(values, "notes"), LIMITS.notes),
        // Prowadzący = osoba, która kliknęła import. Nigdy z pliku:
        // właściciel leada to fakt o naszym zespole, nie dana wejściowa.
        owner,
        // status celowo pominięty -> domyślna wartość z bazy ('nowy').
        // monthly_revenue / plan / paid_at / pilot_* / churned_at również:
        // import to wejście do prospectingu, nie księga przychodów.
      },
      keys: { normalized_name, city, phone, instagram, domain },
      displayName: name,
      warnings,
    },
  };
}

// ----------------------------------------------------------------------------
// Wykrywanie duplikatów
// ----------------------------------------------------------------------------

type DupKind = "pewny" | "mozliwy" | null;

interface DupResult {
  kind: DupKind;
  message: string;
  match: { id: string; name: string; city: string | null } | null;
}

function sameCity(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Klasyfikacja kandydatów zwróconych przez findDuplicateCandidates.
 *
 * PEWNY (pomijamy bez pytania) — sygnały, które w praktyce nie dają fałszywych
 * trafień: ta sama nazwa W TYM SAMYM mieście, ten sam telefon, ten sam Instagram.
 * MOŻLIWY (decyzja użytkownika) — ta sama nazwa przy innym/braku miasta
 * ("Piekarnia u Basi" bywa w każdym mieście) albo ta sama domena WWW
 * (sieciówka ma jedną stronę dla wielu lokali — to często NIE jest duplikat).
 */
function classifyDuplicate(prepared: PreparedRow, candidates: CrmLead[]): DupResult {
  const { normalized_name, city, phone, instagram, domain } = prepared.keys;

  for (const c of candidates) {
    if (phone && c.phone === phone) {
      return { kind: "pewny", message: "Ten sam telefon co istniejący lead.", match: toMatch(c) };
    }
    if (instagram && c.instagram === instagram) {
      return { kind: "pewny", message: "Ten sam Instagram co istniejący lead.", match: toMatch(c) };
    }
    if (c.normalized_name === normalized_name && sameCity(city, c.city)) {
      return {
        kind: "pewny",
        message: "Ta sama nazwa i miasto co istniejący lead.",
        match: toMatch(c),
      };
    }
  }

  for (const c of candidates) {
    if (c.normalized_name === normalized_name) {
      return {
        kind: "mozliwy",
        message: c.city
          ? `Ta sama nazwa, ale inne miasto (istniejący: ${c.city}).`
          : "Ta sama nazwa, brak miasta do porównania.",
        match: toMatch(c),
      };
    }
    // findDuplicateCandidates szuka domeny przez ilike %domena%, więc
    // dopasowanie trzeba potwierdzić dokładnym porównaniem domen.
    if (domain && normalizeDomain(c.www) === domain) {
      return { kind: "mozliwy", message: `Ta sama domena WWW (${domain}).`, match: toMatch(c) };
    }
  }

  return { kind: null, message: "", match: null };
}

function toMatch(lead: CrmLead) {
  return { id: lead.id, name: lead.name, city: lead.city };
}

// ----------------------------------------------------------------------------
// Ocena całej paczki (wspólna dla dry-runu i importu)
// ----------------------------------------------------------------------------

interface EvaluatedRow {
  verdict: ImportVerdict;
  /** Ustawione tylko wtedy, gdy wiersz faktycznie ma zostać wstawiony. */
  prepared: PreparedRow | null;
}

/** Stan deduplikacji w obrębie jednej paczki (plik potrafi dublować sam siebie). */
interface BatchSeen {
  nameCity: Map<string, number>;
  phone: Map<string, number>;
  instagram: Map<string, number>;
}

function batchDuplicateOf(keys: PreparedRow["keys"], seen: BatchSeen): number | null {
  if (keys.phone) {
    const hit = seen.phone.get(keys.phone);
    if (hit !== undefined) return hit;
  }
  if (keys.instagram) {
    const hit = seen.instagram.get(keys.instagram);
    if (hit !== undefined) return hit;
  }
  if (keys.city) {
    const hit = seen.nameCity.get(`${keys.normalized_name}|${keys.city.trim().toLowerCase()}`);
    if (hit !== undefined) return hit;
  }
  return null;
}

function rememberInBatch(keys: PreparedRow["keys"], row: number, seen: BatchSeen): void {
  if (keys.phone) seen.phone.set(keys.phone, row);
  if (keys.instagram) seen.instagram.set(keys.instagram, row);
  if (keys.city) seen.nameCity.set(`${keys.normalized_name}|${keys.city.trim().toLowerCase()}`, row);
}

/**
 * Ocenia każdy wiersz paczki.
 *
 * @param respectForce false w dry-runie (zawsze pokazujemy „wymaga decyzji"),
 *                     true w imporcie (zgoda użytkownika przepuszcza wiersz).
 *                     Flaga `force` działa WYŁĄCZNIE na możliwe duplikaty —
 *                     pewnego duplikatu nie da się przepchnąć z przeglądarki.
 */
async function evaluateRows(
  rows: ImportPayloadRow[],
  owner: string,
  respectForce: boolean,
): Promise<EvaluatedRow[]> {
  const results: EvaluatedRow[] = [];
  const seen: BatchSeen = { nameCity: new Map(), phone: new Map(), instagram: new Map() };

  // Pamięć podręczna zapytań o duplikaty w obrębie jednego wywołania.
  // Arkusze potrafią mieć setki powtórzeń tych samych kluczy (np. pusta
  // kolumna telefonu), a bez cache byłoby to kilka tysięcy zapytań do bazy.
  const candidateCache = new Map<string, CrmLead[]>();

  for (const item of rows) {
    const rowNo = Number.isFinite(item.row) ? item.row : results.length + 1;
    const values = (item.values ?? {}) as ImportRow;

    const { error, prepared } = prepareRow(values, owner);
    if (error || !prepared) {
      results.push({
        verdict: {
          row: rowNo,
          name: typeof values.name === "string" ? values.name.trim() : "—",
          kind: "blad",
          message: error ?? "Nie udało się przetworzyć wiersza.",
          match: null,
          warnings: [],
        },
        prepared: null,
      });
      continue;
    }

    // 1. Kolizja wewnątrz paczki ma pierwszeństwo — nie ma sensu pytać bazy
    //    o wiersz, który i tak dubluje wcześniejszą pozycję z tego samego pliku.
    const batchHit = batchDuplicateOf(prepared.keys, seen);
    if (batchHit !== null) {
      results.push({
        verdict: {
          row: rowNo,
          name: prepared.displayName,
          kind: "duplikat",
          message: `Powtórzenie wiersza ${batchHit} z tego samego pliku.`,
          match: null,
          warnings: prepared.warnings,
        },
        prepared: null,
      });
      continue;
    }

    // 2. Kolizja z bazą.
    const cacheKey = JSON.stringify([
      prepared.keys.normalized_name,
      prepared.keys.phone,
      prepared.keys.instagram,
      prepared.keys.domain,
    ]);
    let candidates = candidateCache.get(cacheKey);
    if (!candidates) {
      candidates = await findDuplicateCandidates({
        normalized_name: prepared.keys.normalized_name,
        phone: prepared.keys.phone,
        instagram: prepared.keys.instagram,
        domain: prepared.keys.domain,
      });
      candidateCache.set(cacheKey, candidates);
    }

    const dup = classifyDuplicate(prepared, candidates);

    if (dup.kind === "pewny") {
      results.push({
        verdict: {
          row: rowNo,
          name: prepared.displayName,
          kind: "duplikat",
          message: dup.message,
          match: dup.match,
          warnings: prepared.warnings,
        },
        prepared: null,
      });
      continue;
    }

    if (dup.kind === "mozliwy" && !(respectForce && item.force === true)) {
      // W dry-runie rejestrujemy klucze mimo braku decyzji: jeśli plik zawiera
      // dwa takie same wiersze, użytkownik ma zobaczyć jeden do decyzji,
      // a nie dwa niezależne pytania o to samo.
      rememberInBatch(prepared.keys, rowNo, seen);
      results.push({
        verdict: {
          row: rowNo,
          name: prepared.displayName,
          kind: "mozliwy_duplikat",
          message: dup.message,
          match: dup.match,
          warnings: prepared.warnings,
        },
        prepared: null,
      });
      continue;
    }

    rememberInBatch(prepared.keys, rowNo, seen);
    results.push({
      verdict: {
        row: rowNo,
        name: prepared.displayName,
        kind: "dodany_bedzie",
        message:
          dup.kind === "mozliwy" ? `Dodany mimo podobieństwa: ${dup.message}` : "Nowy lead.",
        match: dup.kind === "mozliwy" ? dup.match : null,
        warnings: prepared.warnings,
      },
      prepared,
    });
  }

  return results;
}

/** Wspólna bramka wejściowa obu akcji: sesja + kształt i rozmiar ładunku. */
function validatePayload(rows: unknown): string | null {
  if (!Array.isArray(rows)) return "Nieprawidłowe dane wejściowe importu.";
  if (rows.length === 0) return "Brak wierszy do zaimportowania.";
  if (rows.length > MAX_IMPORT_ROWS) {
    return `Import obsługuje maksymalnie ${MAX_IMPORT_ROWS} wierszy naraz (przysłano ${rows.length}). Podziel plik na mniejsze części.`;
  }
  return null;
}

// ----------------------------------------------------------------------------
// Akcje
// ----------------------------------------------------------------------------

/** Sprawdzenie bez zapisu: co się stanie z każdym wierszem. ZERO zapisów. */
export async function dryRunImport(rows: ImportPayloadRow[]): Promise<DryRunResult> {
  const user = await guardStaffAction();
  const payloadError = validatePayload(rows);
  if (payloadError) return { error: payloadError };

  const owner = (user.email ?? "").toLowerCase();
  try {
    const evaluated = await evaluateRows(rows, owner, false);
    return { verdicts: evaluated.map((e) => e.verdict) };
  } catch (err) {
    return {
      error: `Nie udało się sprawdzić pliku: ${err instanceof Error ? err.message : "nieznany błąd"}`,
    };
  }
}

/**
 * Właściwy import. Duplikaty liczymy TU jeszcze raz — między dry-runem
 * a kliknięciem „Importuj" ktoś mógł dodać leada ręcznie, a klient mógł
 * przysłać cokolwiek.
 */
export async function runImport(rows: ImportPayloadRow[]): Promise<RunImportResult> {
  const user = await guardStaffAction();
  const payloadError = validatePayload(rows);
  if (payloadError) return { error: payloadError };

  const owner = (user.email ?? "").toLowerCase();

  let evaluated: EvaluatedRow[];
  try {
    evaluated = await evaluateRows(rows, owner, true);
  } catch (err) {
    return {
      error: `Nie udało się przygotować importu: ${err instanceof Error ? err.message : "nieznany błąd"}`,
    };
  }

  const bledy: ImportReportError[] = [];
  let duplikaty = 0;
  const toInsert: { row: number; name: string; lead: Record<string, unknown> }[] = [];

  for (const item of evaluated) {
    if (item.verdict.kind === "blad") {
      bledy.push({
        row: item.verdict.row,
        name: item.verdict.name,
        message: item.verdict.message,
      });
    } else if (item.verdict.kind === "duplikat" || item.verdict.kind === "mozliwy_duplikat") {
      duplikaty += 1;
    } else if (item.prepared) {
      toInsert.push({
        row: item.verdict.row,
        name: item.verdict.name,
        lead: item.prepared.lead,
      });
    }
  }

  const db = getServiceClient();
  let dodano = 0;

  for (let i = 0; i < toInsert.length; i += IMPORT_CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + IMPORT_CHUNK_SIZE);
    const { error } = await db.from("crm_leads").insert(chunk.map((c) => c.lead));
    if (!error) {
      dodano += chunk.length;
      continue;
    }
    // Paczka padła — powtarzamy wiersz po wierszu, żeby jeden wadliwy rekord
    // nie zabrał ze sobą 99 poprawnych i żeby błąd dało się przypisać
    // konkretnemu wierszowi arkusza.
    for (const c of chunk) {
      const { error: rowError } = await db.from("crm_leads").insert(c.lead);
      if (rowError) {
        bledy.push({ row: c.row, name: c.name, message: `Baza odrzuciła wiersz: ${rowError.message}` });
      } else {
        dodano += 1;
      }
    }
  }

  if (dodano > 0) revalidatePath("/", "layout");

  return {
    report: {
      dodano,
      duplikaty,
      pominieto: duplikaty + bledy.length,
      bledy,
    },
  };
}
