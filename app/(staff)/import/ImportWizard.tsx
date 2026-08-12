"use client";

// Kreator importu leadów z CSV/TSV.
//
// Cztery kroki, świadomie rozdzielone: WEJŚCIE -> MAPOWANIE -> PODGLĄD -> RAPORT.
// Parsowanie pliku dzieje się w przeglądarce (papaparse), więc plik nigdy nie
// leci na serwer w całości — na serwer idą wyłącznie zmapowane wiersze.
//
// Klucz do zaufania użytkownika: NIC nie zapisuje się bez wcześniejszego
// „Sprawdź (dry-run)". Przycisk importu jest zablokowany, dopóki nie ma
// werdyktów z serwera — nie da się kliknąć „importuj" na ślepo.

import Link from "next/link";
import Papa from "papaparse";
import { useMemo, useRef, useState, useTransition } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Label, Select, Textarea } from "@/components/ui/Field";
import { Table, TD, TH, THead, TR } from "@/components/ui/Table";
import {
  normalizeGoogleRating,
  normalizeInstagram,
  normalizePhone,
  normalizeWww,
} from "@/lib/crm/normalize";
import { dryRunImport, runImport } from "./actions";
import {
  IMPORT_FIELDS,
  IMPORT_FIELD_LABELS,
  MAX_IMPORT_ROWS,
  parsePriorityValue,
  parseSourceValue,
  type ImportField,
  type ImportPayloadRow,
  type ImportReport,
  type ImportRow,
  type ImportVerdict,
} from "./types";

type Step = "wejscie" | "mapowanie" | "podglad" | "raport" | "koniec";

/** Pusty string = kolumna pominięta (wartość „— pomiń —" w Select). */
type Mapping = Record<string, ImportField | "">;

const PREVIEW_ROWS = 20;

// ----------------------------------------------------------------------------
// Zgadywanie mapowania
// ----------------------------------------------------------------------------

/** Nagłówek -> porównywalny klucz: bez ogonków, bez znaków innych niż alfanumeryczne. */
function normalizeHeader(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/gi, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Synonimy nagłówków po polsku i angielsku — arkusze przychodzą z Map Google,
// z eksportów i z ręcznej roboty, więc jedna nazwa kolumny nie wystarczy.
const HEADER_SYNONYMS: Record<ImportField, string[]> = {
  name: ["nazwa", "nazwafirmy", "name", "firma", "lokal", "businessname", "title", "punkt"],
  category: ["kategoria", "category", "branza", "typ", "type", "rodzaj"],
  city: ["miasto", "city", "miejscowosc", "town"],
  district: ["dzielnica", "district", "rejon", "obszar", "area", "osiedle"],
  address: ["adres", "address", "ulica", "street", "lokalizacja"],
  instagram: ["instagram", "ig", "insta", "instagramurl", "profilig"],
  phone: ["telefon", "tel", "phone", "numer", "komorka", "phonenumber", "mobile"],
  email: ["email", "mail", "eemail", "adresemail", "poczta"],
  www: ["www", "strona", "website", "url", "web", "stronawww", "witryna"],
  google_rating: ["ocena", "ocenagoogle", "googlerating", "rating", "gwiazdki", "stars", "opinie"],
  locations_count: ["liczbalokali", "lokale", "locations", "locationscount", "oddzialy", "punkty"],
  estimated_daily_transactions: [
    "transakcje",
    "transakcjedziennie",
    "dziennetransakcje",
    "dailytransactions",
    "transactions",
    "kliencidziennie",
    "paragony",
  ],
  source: ["zrodlo", "source", "skad", "kanal"],
  source_detail: ["zrodloszczegoly", "szczegolyzrodla", "sourcedetail", "detalzrodla", "szczegoly"],
  campaign: ["kampania", "campaign", "utmcampaign"],
  priority: ["priorytet", "priority", "prio", "ocenalead"],
  notes: ["notatki", "notatka", "notes", "uwagi", "komentarz", "opis", "note"],
};

/**
 * Automatyczne dopasowanie kolumn. Najpierw trafienia dokładne (żeby „ocena"
 * nie zabrała kolumny wcześniej niż „ocena google"), potem częściowe.
 * Każde pole może być użyte tylko raz — druga kolumna o podobnej nazwie
 * zostaje nieprzypisana i użytkownik decyduje sam.
 */
function guessMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  const used = new Set<ImportField>();
  const normalized = headers.map(normalizeHeader);

  for (const header of headers) mapping[header] = "";

  const assign = (index: number, field: ImportField) => {
    const header = headers[index];
    if (header === undefined || mapping[header] !== "" || used.has(field)) return;
    mapping[header] = field;
    used.add(field);
  };

  for (const field of IMPORT_FIELDS) {
    const synonyms = HEADER_SYNONYMS[field];
    const exact = normalized.findIndex((h) => h !== "" && synonyms.includes(h));
    if (exact >= 0) assign(exact, field);
  }
  for (const field of IMPORT_FIELDS) {
    if (used.has(field)) continue;
    const synonyms = HEADER_SYNONYMS[field];
    // Progi długości nie są ozdobą: bez nich krótkie nagłówki ("id", "lp")
    // trafiały w przypadkowe fragmenty synonimów ("id" siedzi w "kliencidziennie")
    // i kreator po cichu mapował złą kolumnę.
    const partial = normalized.findIndex(
      (h) =>
        h.length >= 3 &&
        synonyms.some(
          (s) => (s.length >= 3 && h.includes(s)) || (h.length >= 4 && s.includes(h)),
        ),
    );
    if (partial >= 0) assign(partial, field);
  }

  return mapping;
}

// ----------------------------------------------------------------------------
// Parsowanie
// ----------------------------------------------------------------------------

/**
 * Separator. Rozszerzenie .tsv jest rozstrzygające; poza tym patrzymy na
 * pierwszy wiersz. Pusty string oddaje decyzję papaparse (radzi sobie
 * z przecinkiem i średnikiem — polski Excel zapisuje CSV ze średnikiem).
 */
function detectDelimiter(text: string, fileName: string): string {
  if (/\.tsv$/i.test(fileName)) return "\t";
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  if (tabs > 0 && tabs >= commas && tabs >= semicolons) return "\t";
  return "";
}

interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

/** Zwraca dane albo polski komunikat błędu — nigdy nie rzuca. */
function parseText(text: string, fileName: string): { error: string } | { data: ParsedFile } {
  if (!text.trim()) return { error: "Plik jest pusty — nie ma czego zaimportować." };

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: detectDelimiter(text, fileName),
  });

  const headers = (result.meta.fields ?? []).map((h) => (h ?? "").trim()).filter((h) => h !== "");
  if (headers.length === 0) {
    return {
      error:
        "Nie udało się odczytać nagłówków. Upewnij się, że pierwszy wiersz zawiera nazwy kolumn, a plik jest zapisany jako CSV lub TSV.",
    };
  }
  if (headers.length === 1) {
    return {
      error:
        "Wykryto tylko jedną kolumnę — prawdopodobnie zły separator. Zapisz plik jako CSV (przecinek lub średnik) albo TSV (tabulator).",
    };
  }

  const rows = (result.data ?? []).filter((row) =>
    headers.some((h) => (row?.[h] ?? "").toString().trim() !== ""),
  );
  if (rows.length === 0) {
    return { error: "Plik zawiera tylko nagłówki — brak wierszy z danymi." };
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      error: `Plik ma ${rows.length} wierszy, a limit jednego importu to ${MAX_IMPORT_ROWS}. Podziel go na mniejsze części.`,
    };
  }

  return { data: { headers, rows } };
}

// ----------------------------------------------------------------------------
// Podgląd i walidacja po stronie klienta
// ----------------------------------------------------------------------------

/** Wartość pokazywana w podglądzie — dokładnie to, co zapisze serwer. */
function displayValue(field: ImportField, raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  switch (field) {
    case "instagram":
      return normalizeInstagram(v) ?? "";
    case "phone":
      return normalizePhone(v) ?? "";
    case "www":
      return normalizeWww(v) ?? "";
    case "google_rating": {
      const n = normalizeGoogleRating(v);
      return n === null ? "" : String(n);
    }
    case "source":
      return parseSourceValue(v);
    case "priority":
      return parsePriorityValue(v);
    default:
      return v;
  }
}

interface RowIssues {
  error: string | null;
  warnings: string[];
}

function rowIssues(values: ImportRow): RowIssues {
  const warnings: string[] = [];
  const name = (values.name ?? "").trim();
  const rating = (values.google_rating ?? "").trim();
  if (rating && normalizeGoogleRating(rating) === null) {
    warnings.push(`ocena „${rating}" poza zakresem 0–5 — pole zostanie puste`);
  }
  const email = (values.email ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    warnings.push(`„${email}" nie wygląda na e-mail — pole zostanie puste`);
  }
  return { error: name ? null : "brak nazwy firmy", warnings };
}

// ----------------------------------------------------------------------------
// Prezentacja werdyktów
// ----------------------------------------------------------------------------

const VERDICT_BADGE: Record<
  ImportVerdict["kind"],
  { tone: "green" | "red" | "amber"; label: string }
> = {
  dodany_bedzie: { tone: "green", label: "do dodania" },
  duplikat: { tone: "red", label: "pominięty — duplikat" },
  mozliwy_duplikat: { tone: "amber", label: "wymaga decyzji" },
  blad: { tone: "red", label: "błąd" },
};

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("FORBIDDEN")) return "Brak uprawnień — zaloguj się ponownie.";
  if (message.includes("RATE_LIMITED")) {
    return "Zbyt wiele operacji w krótkim czasie. Odczekaj chwilę i spróbuj ponownie.";
  }
  return `Operacja nie powiodła się: ${message}`;
}

// ----------------------------------------------------------------------------
// Komponent
// ----------------------------------------------------------------------------

export default function ImportWizard() {
  const [step, setStep] = useState<Step>("wejscie");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [pasted, setPasted] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [verdicts, setVerdicts] = useState<ImportVerdict[] | null>(null);
  const [forced, setForced] = useState<Record<number, boolean>>({});
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- krok 1: wejście -------------------------------------------------------

  const acceptParsed = (result: { error: string } | { data: ParsedFile }) => {
    if ("error" in result) {
      setInputError(result.error);
      setParsed(null);
      return;
    }
    setInputError(null);
    setParsed(result.data);
    setMapping(guessMapping(result.data.headers));
    setVerdicts(null);
    setForced({});
    setReport(null);
    setStep("mapowanie");
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      acceptParsed(parseText(text, file.name));
    } catch {
      setInputError("Nie udało się odczytać pliku. Spróbuj zapisać go ponownie jako CSV lub TSV.");
    }
  };

  const onPaste = () => {
    // Wklejka nie ma nazwy pliku — separator wykrywamy wyłącznie z treści.
    acceptParsed(parseText(pasted, "wklejka.csv"));
  };

  const resetAll = () => {
    setStep("wejscie");
    setParsed(null);
    setMapping({});
    setPasted("");
    setInputError(null);
    setActionError(null);
    setVerdicts(null);
    setForced({});
    setReport(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- mapowanie -------------------------------------------------------------

  const mappedFields = useMemo(
    () => Object.values(mapping).filter((f): f is ImportField => f !== ""),
    [mapping],
  );
  const nameColumns = useMemo(
    () => Object.entries(mapping).filter(([, f]) => f === "name").length,
    [mapping],
  );

  const mappingError =
    nameColumns === 0
      ? "Wskaż kolumnę z nazwą firmy — bez niej nie da się utworzyć leada."
      : nameColumns > 1
        ? "Do nazwy firmy może prowadzić tylko jedna kolumna."
        : null;

  const setColumn = (header: string, field: ImportField | "") => {
    setMapping((prev) => {
      const next: Mapping = { ...prev };
      // Jedno pole = jedna kolumna. Wybór „przenosi" pole, zamiast po cichu
      // zapisywać dwie wartości do tej samej kolumny bazy.
      if (field !== "") {
        for (const key of Object.keys(next)) {
          if (key !== header && next[key] === field) next[key] = "";
        }
      }
      next[header] = field;
      return next;
    });
  };

  // --- zmapowane wiersze -----------------------------------------------------

  const rowsForImport: ImportPayloadRow[] = useMemo(() => {
    if (!parsed) return [];
    const pairs = Object.entries(mapping).filter((e): e is [string, ImportField] => e[1] !== "");
    return parsed.rows.map((raw, index) => {
      const values: ImportRow = {};
      for (const [header, field] of pairs) {
        const v = (raw?.[header] ?? "").toString().trim();
        if (v !== "") values[field] = v;
      }
      return { row: index + 1, values };
    });
  }, [parsed, mapping]);

  const validation = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    for (const item of rowsForImport) {
      const issues = rowIssues(item.values);
      if (issues.error) errors += 1;
      if (issues.warnings.length > 0) warnings += 1;
    }
    return { total: rowsForImport.length, errors, warnings, ok: rowsForImport.length - errors };
  }, [rowsForImport]);

  // --- dry-run i import ------------------------------------------------------

  const onDryRun = () => {
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await dryRunImport(rowsForImport);
        if (result.error) {
          setActionError(result.error);
          return;
        }
        setVerdicts(result.verdicts ?? []);
        setForced({});
        setStep("raport");
      } catch (err) {
        setActionError(friendlyError(err));
      }
    });
  };

  const verdictCounts = useMemo(() => {
    const counts = { dodany_bedzie: 0, duplikat: 0, mozliwy_duplikat: 0, blad: 0 };
    for (const v of verdicts ?? []) counts[v.kind] += 1;
    return counts;
  }, [verdicts]);

  const forcedCount = useMemo(
    () => (verdicts ?? []).filter((v) => v.kind === "mozliwy_duplikat" && forced[v.row]).length,
    [verdicts, forced],
  );

  const toImportCount = verdictCounts.dodany_bedzie + forcedCount;

  const onRunImport = () => {
    if (!verdicts) return;
    setActionError(null);

    // Wysyłamy wszystko poza PEWNYMI duplikatami; możliwe duplikaty tylko
    // z zaznaczoną zgodą. Wiersze z błędem też lecą — serwer i tak sprawdza
    // je od nowa, a dzięki temu trafiają do końcowego raportu błędów.
    const byRow = new Map(rowsForImport.map((r) => [r.row, r]));
    const payload: ImportPayloadRow[] = [];
    for (const v of verdicts) {
      if (v.kind === "duplikat") continue;
      const source = byRow.get(v.row);
      if (!source) continue;
      if (v.kind === "mozliwy_duplikat") {
        if (!forced[v.row]) continue;
        payload.push({ ...source, force: true });
      } else {
        payload.push(source);
      }
    }

    if (payload.length === 0) {
      setActionError("Nie ma czego importować — wszystkie wiersze zostały pominięte.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await runImport(payload);
        if (result.error) {
          setActionError(result.error);
          return;
        }
        setReport(result.report ?? null);
        setStep("koniec");
      } catch (err) {
        setActionError(friendlyError(err));
      }
    });
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="anim-in space-y-6">
      <StepBar step={step} />

      {actionError ? (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {actionError}
        </p>
      ) : null}

      {step === "wejscie" ? (
        <Card className="space-y-5">
          <div>
            <Label htmlFor="import-file">Plik CSV / TSV</Label>
            <input
              id="import-file"
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
              onChange={(e) => void onFile(e.target.files?.[0])}
              className="block w-full text-[14px] text-ink file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-line file:bg-surface file:px-4 file:text-[14px] file:font-medium file:text-ink hover:file:bg-canvas"
            />
            <p className="mt-1.5 text-[13px] text-ink-2">
              Separator rozpoznajemy sami: przecinek, średnik lub tabulator (.tsv).
            </p>
          </div>

          <div className="border-t border-line pt-4">
            <Label htmlFor="import-paste">…albo wklej dane z arkusza</Label>
            <Textarea
              id="import-paste"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={"nazwa,miasto,telefon\nKawiarnia Dobra,Warszawa,512 345 678"}
              className="min-h-32 font-mono text-[13px]"
            />
            <div className="mt-2">
              <Button variant="secondary" onClick={onPaste} disabled={!pasted.trim()}>
                Wczytaj wklejone dane
              </Button>
            </div>
          </div>

          {inputError ? (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {inputError}
            </p>
          ) : null}
        </Card>
      ) : null}

      {step === "mapowanie" && parsed ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Dopasuj kolumny</h2>
              <p className="mt-0.5 text-[13px] text-ink-2">
                Wczytano {parsed.rows.length} wierszy i {parsed.headers.length} kolumn. Wstępne
                dopasowanie zgadliśmy z nazw nagłówków — sprawdź je.
              </p>
            </div>
            <Button variant="ghost" onClick={resetAll}>
              Wczytaj inny plik
            </Button>
          </div>

          <Table>
            <THead>
              <TH>Kolumna w pliku</TH>
              <TH>Przykład</TH>
              <TH>Pole w SZTAB-ie</TH>
            </THead>
            <tbody>
              {parsed.headers.map((header) => {
                const sample = parsed.rows.find((r) => (r?.[header] ?? "").trim() !== "");
                return (
                  <TR key={header}>
                    <TD className="font-medium">{header}</TD>
                    <TD className="max-w-56 truncate text-ink-2">
                      {(sample?.[header] ?? "").trim() || "—"}
                    </TD>
                    <TD>
                      <Select
                        aria-label={`Pole dla kolumny ${header}`}
                        value={mapping[header] ?? ""}
                        onChange={(e) => setColumn(header, e.target.value as ImportField | "")}
                        className="h-9 min-h-9 max-w-64 py-0"
                      >
                        <option value="">— pomiń —</option>
                        {IMPORT_FIELDS.map((field) => (
                          <option key={field} value={field}>
                            {IMPORT_FIELD_LABELS[field]}
                          </option>
                        ))}
                      </Select>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>

          {mappingError ? (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {mappingError}
            </p>
          ) : (
            <p className="text-[13px] text-ink-2">
              Zmapowane pola: {mappedFields.map((f) => IMPORT_FIELD_LABELS[f]).join(", ")}.
            </p>
          )}

          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={() => setStep("podglad")}
              disabled={mappingError !== null}
            >
              Dalej — podgląd
            </Button>
          </div>
        </Card>
      ) : null}

      {step === "podglad" && parsed ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Podgląd i walidacja</h2>
              <p className="mt-0.5 text-[13px] text-ink-2">
                Pierwsze {Math.min(PREVIEW_ROWS, rowsForImport.length)} z {validation.total} wierszy
                — wartości już po normalizacji, dokładnie tak trafią do bazy.
              </p>
            </div>
            <Button variant="ghost" onClick={() => setStep("mapowanie")}>
              Wróć do mapowania
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 text-[13px]">
            <Badge tone="neutral">Wierszy: {validation.total}</Badge>
            <Badge tone="green">Poprawnych: {validation.ok}</Badge>
            {validation.errors > 0 ? <Badge tone="red">Błędów: {validation.errors}</Badge> : null}
            {validation.warnings > 0 ? (
              <Badge tone="amber">Ostrzeżeń: {validation.warnings}</Badge>
            ) : null}
          </div>

          <Table>
            <THead>
              <TH className="w-12">#</TH>
              {mappedFields.map((f) => (
                <TH key={f}>{IMPORT_FIELD_LABELS[f]}</TH>
              ))}
              <TH>Uwagi</TH>
            </THead>
            <tbody>
              {rowsForImport.slice(0, PREVIEW_ROWS).map((item) => {
                const issues = rowIssues(item.values);
                return (
                  <TR key={item.row}>
                    <TD className="text-ink-2">{item.row}</TD>
                    {mappedFields.map((f) => (
                      <TD key={f} className="max-w-56 truncate">
                        {displayValue(f, item.values[f] ?? "")}
                      </TD>
                    ))}
                    <TD>
                      {issues.error ? (
                        <Badge tone="red">{issues.error}</Badge>
                      ) : issues.warnings.length > 0 ? (
                        <Badge tone="amber">{issues.warnings.join("; ")}</Badge>
                      ) : (
                        <span className="text-ink-2">—</span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-ink-2">
              Sprawdzenie niczego nie zapisuje — pokaże tylko, co się stanie z każdym wierszem.
            </p>
            <Button
              variant="primary"
              onClick={onDryRun}
              disabled={pending || validation.ok === 0}
            >
              {pending ? "Sprawdzam…" : "Sprawdź (dry-run)"}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === "raport" && verdicts ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Wynik sprawdzenia</h2>
              <p className="mt-0.5 text-[13px] text-ink-2">
                Nic jeszcze nie zostało zapisane. Zdecyduj o wierszach oznaczonych jako „wymaga
                decyzji" i uruchom import.
              </p>
            </div>
            <Button variant="ghost" onClick={() => setStep("podglad")}>
              Wróć do podglądu
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="green">Do dodania: {verdictCounts.dodany_bedzie}</Badge>
            <Badge tone="red">Duplikaty: {verdictCounts.duplikat}</Badge>
            <Badge tone="amber">Wymaga decyzji: {verdictCounts.mozliwy_duplikat}</Badge>
            {verdictCounts.blad > 0 ? <Badge tone="red">Błędy: {verdictCounts.blad}</Badge> : null}
          </div>

          <Table>
            <THead>
              <TH className="w-12">#</TH>
              <TH>Nazwa</TH>
              <TH>Werdykt</TH>
              <TH>Szczegóły</TH>
              <TH className="w-40">Decyzja</TH>
            </THead>
            <tbody>
              {verdicts.map((v) => {
                const badge = VERDICT_BADGE[v.kind];
                return (
                  <TR key={v.row}>
                    <TD className="text-ink-2">{v.row}</TD>
                    <TD className="font-medium">{v.name}</TD>
                    <TD>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </TD>
                    <TD className="text-ink-2">
                      <span>{v.message}</span>
                      {v.match ? (
                        <>
                          {" "}
                          <Link
                            href={`/leady/${v.match.id}`}
                            className="font-medium text-accent underline underline-offset-2"
                          >
                            {v.match.name}
                            {v.match.city ? ` (${v.match.city})` : ""}
                          </Link>
                        </>
                      ) : null}
                      {v.warnings.length > 0 ? (
                        <div className="mt-1 text-[12px] text-ink-2">{v.warnings.join(" ")}</div>
                      ) : null}
                    </TD>
                    <TD>
                      {v.kind === "mozliwy_duplikat" ? (
                        <label className="flex items-center gap-2 text-[13px] text-ink">
                          <input
                            type="checkbox"
                            checked={forced[v.row] ?? false}
                            onChange={(e) =>
                              setForced((prev) => ({ ...prev, [v.row]: e.target.checked }))
                            }
                            className="size-4 rounded border-line accent-accent"
                          />
                          importuj mimo to
                        </label>
                      ) : (
                        <span className="text-ink-2">—</span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-ink-2">
              Pewne duplikaty zostaną pominięte niezależnie od decyzji.
            </p>
            <Button
              variant="primary"
              onClick={onRunImport}
              disabled={pending || toImportCount === 0}
            >
              {pending ? "Importuję…" : `Importuj ${toImportCount} leadów`}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === "koniec" && report ? (
        <Card className="space-y-4">
          <h2 className="text-[15px] font-semibold text-ink">Import zakończony</h2>

          <div className="flex flex-wrap gap-2">
            <Badge tone="green">Dodano: {report.dodano}</Badge>
            <Badge tone="neutral">Pominięto: {report.pominieto}</Badge>
            <Badge tone="red">Duplikaty: {report.duplikaty}</Badge>
            {report.bledy.length > 0 ? (
              <Badge tone="red">Błędy: {report.bledy.length}</Badge>
            ) : null}
          </div>

          {report.bledy.length > 0 ? (
            <Table>
              <THead>
                <TH className="w-12">#</TH>
                <TH>Nazwa</TH>
                <TH>Powód</TH>
              </THead>
              <tbody>
                {report.bledy.map((b) => (
                  <TR key={`${b.row}-${b.message}`}>
                    <TD className="text-ink-2">{b.row}</TD>
                    <TD className="font-medium">{b.name}</TD>
                    <TD className="text-ink-2">{b.message}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Link
              href="/leady"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-accent px-4 text-[14px] font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Przejdź do leadów
            </Link>
            <Button variant="secondary" onClick={resetAll}>
              Zaimportuj kolejny plik
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Pasek kroków
// ----------------------------------------------------------------------------

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: "wejscie", label: "1. Wejście" },
  { key: "mapowanie", label: "2. Mapowanie" },
  { key: "podglad", label: "3. Podgląd" },
  { key: "raport", label: "4. Sprawdzenie" },
  { key: "koniec", label: "5. Wynik" },
];

function StepBar({ step }: { step: Step }) {
  const currentIndex = STEP_LABELS.findIndex((s) => s.key === step);
  return (
    <div className="flex flex-wrap gap-1.5">
      {STEP_LABELS.map((s, index) => (
        <Badge key={s.key} tone={index === currentIndex ? "blue" : index < currentIndex ? "green" : "neutral"}>
          {s.label}
        </Badge>
      ))}
    </div>
  );
}
