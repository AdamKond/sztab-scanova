// Migracja danych ze STAREGO Sztabu do SZTAB.
//
// UWAGA: to narzędzie DOKUMENTUJE proces migracji. Nie jest jeszcze
// uruchamiane na prawdziwych danych — czeka na eksport ze starego systemu.
// Domyślnie działa w trybie DRY-RUN (nic nie zapisuje, tylko drukuje plan
// i raport rzeczy wymagających decyzji człowieka). Zapis do bazy wymaga
// jawnej flagi --wykonaj — migracja danych sprzedażowych to operacja
// jednorazowa i nieodwracalna (bez pełnego rollbacku), więc nie może się
// zdarzyć przez pomyłkę.
//
// Użycie:
//   npx tsx scripts/import-stary-sztab.ts <plik.json>
//   npx tsx scripts/import-stary-sztab.ts <plik.json> --wykonaj
//   npx tsx scripts/import-stary-sztab.ts <plik.json> --demo-pilotaz=demo_wykonane
//   npx tsx scripts/import-stary-sztab.ts <plik.json> --klient=platny_klient --wykonaj
//
// Plik wejściowy — JSON wyeksportowany ze starych tabel crm_leads/
// crm_activities/crm_tasks, w kształcie:
//   { "leads": OldLead[], "activities": OldActivity[], "tasks": OldTask[] }
//
// Opcje:
//   --wykonaj
//       Wykonaj zapis do bazy. Bez tej flagi skrypt tylko liczy i drukuje
//       plan — nie łączy się nawet z Supabase.
//   --demo-pilotaz=demo_wykonane|pilot_umowiony
//       Stary status "demo_pilotaz" nie ma jednoznacznego odpowiednika —
//       mógł oznaczać wykonane demo ALBO już umówiony pilot. Bez tej flagi
//       takie leady NIE są importowane, tylko trafiają na listę "wymaga
//       decyzji" (edytuj dane źródłowe albo podaj tę flagę, żeby zdecydować
//       globalnie dla całego pliku). Status pilot_aktywny jest z importu
//       CELOWO wykluczony — wymaga dat startu/końca pilota, których stary
//       system nie przechowywał w sposób, który dawałoby się zaufać.
//   --klient=platny_klient
//       Stary status "klient" NIE jest automatycznie mapowany na
//       platny_klient — w starym Sztabie ten status nie gwarantował
//       kompletu danych płatności. Z tą flagą wiersze, które w eksporcie
//       mają jawnie podane pola-doczepki `mrr`, `plan` i `paid_at`,
//       zostają zaimportowane jako platny_klient. Reszta (i tak, i bez
//       flagi) trafia do statusu "oferta" z notatką i na listę "wymaga
//       weryfikacji" — ktoś musi ręcznie sprawdzić, czy to nadal klient.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  clampText,
  normalizeGoogleRating,
  normalizeInstagram,
  normalizeName,
  normalizePhone,
  normalizeWww,
} from "@/lib/crm/normalize";
import type { ActivityType, LeadSource, LeadStatus, TaskStatus } from "@/lib/crm/types";

// ----------------------------------------------------------------------------
// .env.local — potrzebne WYŁĄCZNIE w trybie --wykonaj.
// ----------------------------------------------------------------------------

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    if (!key) continue;

    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// ----------------------------------------------------------------------------
// Kształt danych starego Sztabu — luźno typowany, bo dokładny schemat starych
// tabel nie jest tu źródłem prawdy. Znane pola słownikowe (status, source,
// type) mapujemy jawnie; reszta przechodzi 1:1 lub przez normalize.ts.
// ----------------------------------------------------------------------------

type OldLeadStatus =
  | "nowy"
  | "skontaktowany"
  | "rozmowa"
  | "demo_pilotaz"
  | "klient"
  | "odrzucony"
  | "uspiony";

type OldSource =
  | "teren"
  | "ig_dm"
  | "ads_meta"
  | "ads_google"
  | "polecenie"
  | "inbound"
  | "partner";

type OldActivityType = "wizyta" | "dm" | "dm_followup" | "telefon" | "demo" | "spotkanie" | "mail";

interface OldLead {
  id: string | number;
  name?: string;
  city?: string | null;
  category?: string | null;
  district?: string | null;
  address?: string | null;
  instagram?: string | null;
  phone?: string | null;
  email?: string | null;
  www?: string | null;
  google_rating?: number | string | null;
  status?: string;
  source?: string;
  owner?: string | null;
  notes?: string | null;
  lost_reason?: string | null;
  // Pola-doczepki (sidecar) — potrzebne wyłącznie do decyzji o statusie
  // "klient" pod flagą --klient=platny_klient. Stary eksport ich zwykle
  // nie ma; ich brak jest oczekiwany i obsłużony (patrz decideStatus()).
  mrr?: number | string | null;
  plan?: string | null;
  paid_at?: string | null;
  [key: string]: unknown;
}

interface OldActivity {
  id?: string | number;
  lead_id: string | number;
  type?: string;
  note?: string | null;
  happened_at?: string | null;
  created_by?: string | null;
  [key: string]: unknown;
}

interface OldTask {
  id?: string | number;
  lead_id?: string | number | null;
  title?: string;
  done_at?: string | null;
  due_date?: string | null;
  assigned_to?: string | null;
  created_by?: string | null;
  // Kubełki starego sprintu ("dziś", "ten tydzień"...) nie mają odpowiednika
  // w nowym modelu (SZTAB liczy follow-upy z next_action_at/due_at, nie ze
  // sztywnych kubełków) i CELOWO nie powinny go dostać — inaczej przenieślibyśmy
  // stary sposób myślenia o priorytetach do nowego systemu. Pole ignorujemy.
  day_bucket?: unknown;
  [key: string]: unknown;
}

interface OldExport {
  leads?: OldLead[];
  activities?: OldActivity[];
  tasks?: OldTask[];
}

// ----------------------------------------------------------------------------
// Tabele mapowań — jedyne miejsce, w którym zapada decyzja "stara wartość X
// to nowa wartość Y". Trzymane jawnie (nie algorytmicznie), żeby zmiana
// mapowania była widoczna w diffie, a nie ukryta w logice.
// ----------------------------------------------------------------------------

const STATUS_MAP_SIMPLE: Partial<Record<OldLeadStatus, LeadStatus>> = {
  nowy: "nowy",
  skontaktowany: "proba_kontaktu",
  rozmowa: "kontakt_zdecydentem",
  odrzucony: "utracony",
  uspiony: "followup_pozniej",
};

const SOURCE_MAP: Record<OldSource, LeadSource> = {
  teren: "teren",
  ig_dm: "ig_dm",
  ads_meta: "ads_meta",
  ads_google: "ads_google",
  polecenie: "polecenie",
  inbound: "inbound",
  partner: "partner",
};

const ACTIVITY_TYPE_MAP: Record<OldActivityType, ActivityType> = {
  wizyta: "wizyta",
  dm: "ig_dm",
  dm_followup: "ig_followup",
  telefon: "telefon",
  demo: "demo",
  spotkanie: "spotkanie",
  mail: "email",
};

function mapSource(raw: unknown): LeadSource {
  if (typeof raw === "string" && raw in SOURCE_MAP) {
    return SOURCE_MAP[raw as OldSource];
  }
  // Nieznane/brakujące źródło trafia jawnie do "inne" — nie zgadujemy.
  return "inne";
}

function mapActivityType(raw: unknown): { type: ActivityType; unknownRaw: string | null } {
  if (typeof raw === "string" && raw in ACTIVITY_TYPE_MAP) {
    return { type: ACTIVITY_TYPE_MAP[raw as OldActivityType], unknownRaw: null };
  }
  return { type: "notatka", unknownRaw: raw === undefined || raw === null ? "(brak)" : String(raw) };
}

// ----------------------------------------------------------------------------
// Decyzja o statusie leada.
// ----------------------------------------------------------------------------

interface MappedStatus {
  status: LeadStatus;
  note: string | null;
  lostReason: string | null;
  extra: { monthly_revenue?: number; plan?: string; paid_at?: string };
  wymagaWeryfikacji: boolean;
}

type StatusDecision =
  | { kind: "mapped"; result: MappedStatus }
  // demo_pilotaz bez --demo-pilotaz: NIE importujemy, tylko raportujemy.
  | { kind: "wymaga_decyzji" }
  // Status spoza znanego słownika starego Sztabu: NIE importujemy.
  | { kind: "nieznany_status"; rawStatus: string | undefined };

function decideStatus(
  old: OldLead,
  opts: { demoPilotaz: "demo_wykonane" | "pilot_umowiony" | null; klientPlatny: boolean },
): StatusDecision {
  const raw = old.status;

  if (raw && raw in STATUS_MAP_SIMPLE) {
    const status = STATUS_MAP_SIMPLE[raw as OldLeadStatus]!;
    if (raw === "odrzucony") {
      const lostReason =
        clampText(old.lost_reason ?? null, 4000) ?? "import ze starego Sztabu — powód nieznany";
      return {
        kind: "mapped",
        result: { status, note: null, lostReason, extra: {}, wymagaWeryfikacji: false },
      };
    }
    return {
      kind: "mapped",
      result: { status, note: null, lostReason: null, extra: {}, wymagaWeryfikacji: false },
    };
  }

  if (raw === "demo_pilotaz") {
    if (!opts.demoPilotaz) return { kind: "wymaga_decyzji" };
    return {
      kind: "mapped",
      result: {
        status: opts.demoPilotaz,
        note: "import ze starego Sztabu: status demo_pilotaz zmapowany globalną flagą --demo-pilotaz.",
        lostReason: null,
        extra: {},
        wymagaWeryfikacji: false,
      },
    };
  }

  if (raw === "klient") {
    const mrrRaw = old.mrr;
    const mrr = typeof mrrRaw === "string" ? Number(mrrRaw.replace(",", ".")) : mrrRaw;
    const hasCompletePaymentData =
      opts.klientPlatny &&
      typeof mrr === "number" &&
      Number.isFinite(mrr) &&
      mrr > 0 &&
      typeof old.plan === "string" &&
      old.plan.trim().length > 0 &&
      typeof old.paid_at === "string" &&
      old.paid_at.trim().length > 0;

    if (hasCompletePaymentData) {
      return {
        kind: "mapped",
        result: {
          status: "platny_klient",
          note: "import ze starego Sztabu: status klient z kompletem danych płatności (mrr/plan/paid_at).",
          lostReason: null,
          extra: { monthly_revenue: mrr as number, plan: old.plan as string, paid_at: old.paid_at as string },
          wymagaWeryfikacji: false,
        },
      };
    }
    return {
      kind: "mapped",
      result: {
        status: "oferta",
        note:
          "import ze starego Sztabu: był klientem (status klient), ale brak kompletu danych płatności (mrr/plan/paid_at) — WYMAGA WERYFIKACJI.",
        lostReason: null,
        extra: {},
        wymagaWeryfikacji: true,
      },
    };
  }

  return { kind: "nieznany_status", rawStatus: raw };
}

// ----------------------------------------------------------------------------
// CLI
// ----------------------------------------------------------------------------

interface Cli {
  filePath: string;
  wykonaj: boolean;
  demoPilotaz: "demo_wykonane" | "pilot_umowiony" | null;
  klientPlatny: boolean;
}

function parseArgs(argv: string[]): Cli {
  const positional: string[] = [];
  let wykonaj = false;
  let demoPilotaz: "demo_wykonane" | "pilot_umowiony" | null = null;
  let klientPlatny = false;

  for (const arg of argv) {
    if (arg === "--wykonaj") {
      wykonaj = true;
    } else if (arg.startsWith("--demo-pilotaz=")) {
      const value = arg.slice("--demo-pilotaz=".length);
      if (value !== "demo_wykonane" && value !== "pilot_umowiony") {
        console.error(
          `Nieprawidłowa wartość --demo-pilotaz: "${value}". Dozwolone: demo_wykonane, pilot_umowiony.`,
        );
        process.exit(1);
      }
      demoPilotaz = value;
    } else if (arg === "--klient=platny_klient") {
      klientPlatny = true;
    } else if (arg.startsWith("--klient=")) {
      console.error('Nieprawidłowa wartość --klient. Jedyna dozwolona: --klient=platny_klient.');
      process.exit(1);
    } else if (arg.startsWith("--")) {
      console.error(`Nieznana opcja: ${arg}`);
      process.exit(1);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length !== 1) {
    console.error(
      "Użycie: npx tsx scripts/import-stary-sztab.ts <plik.json> [--wykonaj] [--demo-pilotaz=demo_wykonane|pilot_umowiony] [--klient=platny_klient]",
    );
    process.exit(1);
  }

  return { filePath: positional[0], wykonaj, demoPilotaz, klientPlatny };
}

// ----------------------------------------------------------------------------
// Plan leadów: normalizacja, wykrywanie duplikatów wewnątrz pliku (po
// znormalizowanej nazwie + mieście), decyzja o statusie.
// ----------------------------------------------------------------------------

interface PlannedLead {
  oldId: string;
  name: string;
  normalizedName: string;
  city: string | null;
  category: string | null;
  district: string | null;
  address: string | null;
  instagram: string | null;
  phone: string | null;
  email: string | null;
  www: string | null;
  google_rating: number | null;
  owner: string | null;
  notes: string | null;
  source: LeadSource;
  status: LeadStatus;
  note: string | null;
  lost_reason: string | null;
  extra: MappedStatus["extra"];
}

interface LeadPlanResult {
  plan: PlannedLead[];
  // oldId -> oldId zachowanego leada, do którego trzeba przekierować
  // aktywności/zadania (siebie samego dla leadów z planu, id "oryginału"
  // dla duplikatów, null dla leadów pominiętych bez zamiennika).
  redirect: Map<string, string | null>;
  duplicates: { oldId: string; duplicateOfOldId: string; name: string }[];
  wymagaDecyzjiDemoPilotaz: { oldId: string; name: string }[];
  nieznanyStatus: { oldId: string; name: string; status: string | undefined }[];
  wymagaWeryfikacji: { oldId: string; name: string }[];
  pominietoBrakNazwy: string[];
}

function buildLeadPlan(oldLeads: OldLead[], cli: Cli): LeadPlanResult {
  const plan: PlannedLead[] = [];
  const redirect = new Map<string, string | null>();
  const seenKeys = new Map<string, string>(); // znormalizowany klucz -> pierwszy oldId
  const duplicates: LeadPlanResult["duplicates"] = [];
  const wymagaDecyzjiDemoPilotaz: LeadPlanResult["wymagaDecyzjiDemoPilotaz"] = [];
  const nieznanyStatus: LeadPlanResult["nieznanyStatus"] = [];
  const wymagaWeryfikacji: LeadPlanResult["wymagaWeryfikacji"] = [];
  const pominietoBrakNazwy: string[] = [];

  for (const old of oldLeads) {
    const oldId = String(old.id);
    const name = (old.name ?? "").trim();
    if (!name) {
      pominietoBrakNazwy.push(oldId);
      redirect.set(oldId, null);
      continue;
    }

    const key = `${normalizeName(name)}|||${normalizeName(String(old.city ?? ""))}`;
    const firstSeenId = seenKeys.get(key);
    if (firstSeenId) {
      duplicates.push({ oldId, duplicateOfOldId: firstSeenId, name });
      redirect.set(oldId, firstSeenId);
      continue;
    }

    const decision = decideStatus(old, { demoPilotaz: cli.demoPilotaz, klientPlatny: cli.klientPlatny });

    if (decision.kind === "wymaga_decyzji") {
      wymagaDecyzjiDemoPilotaz.push({ oldId, name });
      redirect.set(oldId, null);
      continue;
    }
    if (decision.kind === "nieznany_status") {
      nieznanyStatus.push({ oldId, name, status: decision.rawStatus });
      redirect.set(oldId, null);
      continue;
    }

    seenKeys.set(key, oldId);
    redirect.set(oldId, oldId);
    if (decision.result.wymagaWeryfikacji) {
      wymagaWeryfikacji.push({ oldId, name });
    }

    plan.push({
      oldId,
      name,
      normalizedName: normalizeName(name),
      city: (old.city as string | null | undefined) ?? null,
      category: (old.category as string | null | undefined) ?? null,
      district: (old.district as string | null | undefined) ?? null,
      address: (old.address as string | null | undefined) ?? null,
      instagram: normalizeInstagram(old.instagram as string | null | undefined),
      phone: normalizePhone(old.phone as string | null | undefined),
      email: (old.email as string | null | undefined) ?? null,
      www: normalizeWww(old.www as string | null | undefined),
      google_rating: normalizeGoogleRating(old.google_rating as string | number | null | undefined),
      owner: (old.owner as string | null | undefined) ?? null,
      notes: clampText((old.notes as string | null | undefined) ?? null, 8000),
      source: mapSource(old.source),
      status: decision.result.status,
      note: decision.result.note,
      lost_reason: decision.result.lostReason,
      extra: decision.result.extra,
    });
  }

  return {
    plan,
    redirect,
    duplicates,
    wymagaDecyzjiDemoPilotaz,
    nieznanyStatus,
    wymagaWeryfikacji,
    pominietoBrakNazwy,
  };
}

// ----------------------------------------------------------------------------
// Plan aktywności i zadań — powiązania lead_id idą przez `redirect`, żeby
// aktywność przypięta do duplikatu trafiła do zachowanego leada.
// ----------------------------------------------------------------------------

interface PlannedActivity {
  oldId: string;
  effectiveOldLeadId: string;
  type: ActivityType;
  note: string | null;
  happened_at: string;
  created_by: string;
}

interface ActivityPlanResult {
  plan: PlannedActivity[];
  pominietoBrakLeada: string[];
  pominietoBrakDaty: string[];
  nieznanyTyp: { oldId: string; rawType: string }[];
}

function buildActivityPlan(
  oldActivities: OldActivity[],
  redirect: Map<string, string | null>,
): ActivityPlanResult {
  const plan: PlannedActivity[] = [];
  const pominietoBrakLeada: string[] = [];
  const pominietoBrakDaty: string[] = [];
  const nieznanyTyp: { oldId: string; rawType: string }[] = [];

  oldActivities.forEach((old, index) => {
    const oldId = String(old.id ?? `aktywnosc-${index + 1}`);
    const oldLeadId = String(old.lead_id);
    const effective = redirect.get(oldLeadId);
    if (!effective) {
      pominietoBrakLeada.push(oldId);
      return;
    }

    const happenedAt = (old.happened_at as string | null | undefined) ?? null;
    if (!happenedAt) {
      pominietoBrakDaty.push(oldId);
      return;
    }

    const { type, unknownRaw } = mapActivityType(old.type);
    if (unknownRaw) nieznanyTyp.push({ oldId, rawType: unknownRaw });

    const noteParts: string[] = [];
    if (unknownRaw) noteParts.push(`import: nieznany typ aktywności w starym Sztabie ("${unknownRaw}")`);
    if (old.note) noteParts.push(String(old.note));

    plan.push({
      oldId,
      effectiveOldLeadId: effective,
      type,
      note: clampText(noteParts.length > 0 ? noteParts.join(" — ") : null, 4000),
      happened_at: happenedAt,
      created_by: (old.created_by as string | null | undefined)?.trim() || "import-stary-sztab",
    });
  });

  return { plan, pominietoBrakLeada, pominietoBrakDaty, nieznanyTyp };
}

interface PlannedTask {
  oldId: string;
  effectiveOldLeadId: string | null;
  title: string;
  status: TaskStatus;
  due_at: string | null;
  done_at: string | null;
  assigned_to: string | null;
  created_by: string;
}

interface TaskPlanResult {
  plan: PlannedTask[];
  pominietoBrakTytulu: string[];
  pominietoNieznanyLead: string[];
}

function buildTaskPlan(oldTasks: OldTask[], redirect: Map<string, string | null>): TaskPlanResult {
  const plan: PlannedTask[] = [];
  const pominietoBrakTytulu: string[] = [];
  const pominietoNieznanyLead: string[] = [];

  oldTasks.forEach((old, index) => {
    const oldId = String(old.id ?? `zadanie-${index + 1}`);
    const title = (old.title ?? "").trim();
    if (!title) {
      pominietoBrakTytulu.push(oldId);
      return;
    }

    let effectiveOldLeadId: string | null = null;
    if (old.lead_id !== undefined && old.lead_id !== null) {
      const resolved = redirect.get(String(old.lead_id));
      if (resolved === undefined || resolved === null) {
        // Zadanie miało leada w starych danych, ale ten lead nie trafił do
        // importu (pominięty/nieznany) — zadanie i tak importujemy, tylko
        // bez powiązania, i raportujemy dla ręcznego przeglądu.
        pominietoNieznanyLead.push(oldId);
      } else {
        effectiveOldLeadId = resolved;
      }
    }

    plan.push({
      oldId,
      effectiveOldLeadId,
      title,
      status: old.done_at ? "zrobione" : "otwarte",
      due_at: (old.due_date as string | null | undefined) ?? null,
      done_at: (old.done_at as string | null | undefined) ?? null,
      assigned_to: (old.assigned_to as string | null | undefined) ?? null,
      created_by: (old.created_by as string | null | undefined)?.trim() || "import-stary-sztab",
    });
  });

  return { plan, pominietoBrakTytulu, pominietoNieznanyLead };
}

// ----------------------------------------------------------------------------
// Raport (dry-run i --wykonaj drukują to samo podsumowanie planu).
// ----------------------------------------------------------------------------

function printReport(
  leadResult: LeadPlanResult,
  activityResult: ActivityPlanResult,
  taskResult: TaskPlanResult,
): void {
  console.log("=== PLAN LEADÓW ===");
  console.log(`Do importu: ${leadResult.plan.length}`);
  console.log(`Pominięto — brak nazwy: ${leadResult.pominietoBrakNazwy.length}`);
  console.log(`Pominięto — duplikat (nazwa+miasto): ${leadResult.duplicates.length}`);
  console.log(`Pominięto — nieznany status: ${leadResult.nieznanyStatus.length}`);
  console.log("");

  if (leadResult.duplicates.length > 0) {
    console.log("--- Duplikaty (pominięte, przekierowane do pierwszego wystąpienia) ---");
    for (const d of leadResult.duplicates) {
      console.log(`  ${d.oldId} „${d.name}” -> duplikat leada ${d.duplicateOfOldId}`);
    }
    console.log("");
  }

  if (leadResult.nieznanyStatus.length > 0) {
    console.log("--- Nieznany status (pominięte, wymaga poprawy danych źródłowych) ---");
    for (const n of leadResult.nieznanyStatus) {
      console.log(`  ${n.oldId} „${n.name}” status="${n.status ?? "(brak)"}"`);
    }
    console.log("");
  }

  if (leadResult.wymagaDecyzjiDemoPilotaz.length > 0) {
    console.log(
      `--- WYMAGA DECYZJI: status "demo_pilotaz" bez --demo-pilotaz (${leadResult.wymagaDecyzjiDemoPilotaz.length}) ---`,
    );
    for (const d of leadResult.wymagaDecyzjiDemoPilotaz) {
      console.log(`  ${d.oldId} „${d.name}”`);
    }
    console.log(
      "  -> Podaj --demo-pilotaz=demo_wykonane albo --demo-pilotaz=pilot_umowiony, albo popraw dane źródłowe.",
    );
    console.log("");
  }

  if (leadResult.wymagaWeryfikacji.length > 0) {
    console.log(
      `--- WYMAGA WERYFIKACJI: status "klient" bez kompletu danych płatności (${leadResult.wymagaWeryfikacji.length}) ---`,
    );
    for (const w of leadResult.wymagaWeryfikacji) {
      console.log(`  ${w.oldId} „${w.name}” — zaimportowany jako "oferta"`);
    }
    console.log("");
  }

  console.log("=== PLAN AKTYWNOŚCI ===");
  console.log(`Do importu: ${activityResult.plan.length}`);
  console.log(`Pominięto — lead nieznany/pominięty: ${activityResult.pominietoBrakLeada.length}`);
  console.log(`Pominięto — brak happened_at: ${activityResult.pominietoBrakDaty.length}`);
  console.log(`Nieznany typ (zmapowany na "notatka"): ${activityResult.nieznanyTyp.length}`);
  console.log("");

  console.log("=== PLAN ZADAŃ ===");
  console.log(`Do importu: ${taskResult.plan.length}`);
  console.log(`Pominięto — brak tytułu: ${taskResult.pominietoBrakTytulu.length}`);
  console.log(
    `Zaimportowane bez powiązania z leadem (lead pominięty w imporcie): ${taskResult.pominietoNieznanyLead.length}`,
  );
  console.log("");
}

// ----------------------------------------------------------------------------
// Zapis (--wykonaj). Kolejność: leady, potem aktywności, potem zadania —
// historię etapów tworzy sam trigger crm_track_status_change przy insercie
// leada, więc nie ma osobnego kroku backfillu historii.
// ----------------------------------------------------------------------------

async function findExistingLeadId(
  supabase: SupabaseClient,
  normalizedName: string,
  city: string | null,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("crm_leads")
    .select("id, city")
    .eq("normalized_name", normalizedName);
  if (error || !data) return null;

  const targetCity = normalizeName(city ?? "");
  const match = data.find((row) => normalizeName(String(row.city ?? "")) === targetCity);
  return match ? (match.id as string) : null;
}

async function execute(
  leadResult: LeadPlanResult,
  activityResult: ActivityPlanResult,
  taskResult: TaskPlanResult,
): Promise<void> {
  loadEnvLocal();
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error(
      "Brak konfiguracji — uzupełnij SUPABASE_URL i SUPABASE_SERVICE_KEY w .env.local (patrz supabase/README.md).",
    );
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  console.log("=== ZAPIS DO BAZY ===");

  // oldId (leada z planu) -> nowe UUID w bazie.
  const newIdByOldId = new Map<string, string>();
  let leadsInserted = 0;
  let leadsDuplicateInDb = 0;
  let leadsFailed = 0;

  for (const lead of leadResult.plan) {
    const existingId = await findExistingLeadId(supabase, lead.normalizedName, lead.city);
    if (existingId) {
      leadsDuplicateInDb += 1;
      newIdByOldId.set(lead.oldId, existingId);
      console.log(`  pominięto (duplikat w bazie): „${lead.name}” -> istniejący lead ${existingId}`);
      continue;
    }

    const { data, error } = await supabase
      .from("crm_leads")
      .insert({
        name: lead.name,
        normalized_name: lead.normalizedName,
        category: lead.category,
        city: lead.city,
        district: lead.district,
        address: lead.address,
        instagram: lead.instagram,
        phone: lead.phone,
        email: lead.email,
        www: lead.www,
        google_rating: lead.google_rating,
        owner: lead.owner,
        source: lead.source,
        status: lead.status,
        lost_reason: lead.lost_reason,
        monthly_revenue: lead.extra.monthly_revenue ?? null,
        plan: lead.extra.plan ?? null,
        paid_at: lead.extra.paid_at ?? null,
        notes: [lead.note, lead.notes].filter(Boolean).join("\n\n") || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      leadsFailed += 1;
      console.error(`  BŁĄD insertu leada „${lead.name}” (stary id ${lead.oldId}): ${error?.message}`);
      continue;
    }

    leadsInserted += 1;
    newIdByOldId.set(lead.oldId, data.id as string);
  }

  console.log(
    `Leady: wstawiono ${leadsInserted}, pominięto (duplikat w bazie) ${leadsDuplicateInDb}, błędów ${leadsFailed}.`,
  );

  let activitiesInserted = 0;
  let activitiesFailed = 0;
  let activitiesNoLeadId = 0;
  for (const activity of activityResult.plan) {
    const newLeadId = newIdByOldId.get(activity.effectiveOldLeadId);
    if (!newLeadId) {
      // Lead był duplikatem w bazie z błędem insertu albo insert leada padł —
      // aktywność nie ma do czego się przypiąć.
      activitiesNoLeadId += 1;
      continue;
    }
    const { error } = await supabase.from("crm_activities").insert({
      lead_id: newLeadId,
      type: activity.type,
      note: activity.note,
      happened_at: activity.happened_at,
      created_by: activity.created_by,
    });
    if (error) {
      activitiesFailed += 1;
      console.error(`  BŁĄD insertu aktywności (stary id ${activity.oldId}): ${error.message}`);
      continue;
    }
    activitiesInserted += 1;
  }
  console.log(
    `Aktywności: wstawiono ${activitiesInserted}, bez leada w bazie ${activitiesNoLeadId}, błędów ${activitiesFailed}.`,
  );

  let tasksInserted = 0;
  let tasksFailed = 0;
  for (const task of taskResult.plan) {
    const newLeadId = task.effectiveOldLeadId ? newIdByOldId.get(task.effectiveOldLeadId) ?? null : null;
    const { error } = await supabase.from("crm_tasks").insert({
      lead_id: newLeadId,
      title: task.title,
      status: task.status,
      due_at: task.due_at,
      done_at: task.done_at,
      assigned_to: task.assigned_to,
      created_by: task.created_by,
    });
    if (error) {
      tasksFailed += 1;
      console.error(`  BŁĄD insertu zadania „${task.title}” (stary id ${task.oldId}): ${error.message}`);
      continue;
    }
    tasksInserted += 1;
  }
  console.log(`Zadania: wstawiono ${tasksInserted}, błędów ${tasksFailed}.`);
}

// ----------------------------------------------------------------------------
// main
// ----------------------------------------------------------------------------

async function main(): Promise<void> {
  const cli = parseArgs(process.argv.slice(2));

  const resolvedPath = path.resolve(process.cwd(), cli.filePath);
  if (!existsSync(resolvedPath)) {
    console.error(`Nie znaleziono pliku: ${resolvedPath}`);
    process.exit(1);
  }

  let raw: OldExport;
  try {
    raw = JSON.parse(readFileSync(resolvedPath, "utf8")) as OldExport;
  } catch (err) {
    console.error(`Nieprawidłowy JSON w ${resolvedPath}: ${(err as Error).message}`);
    process.exit(1);
  }

  const oldLeads = raw.leads ?? [];
  const oldActivities = raw.activities ?? [];
  const oldTasks = raw.tasks ?? [];

  console.log(
    `Wczytano: ${oldLeads.length} leadów, ${oldActivities.length} aktywności, ${oldTasks.length} zadań z ${resolvedPath}.`,
  );
  console.log(cli.wykonaj ? "TRYB: --wykonaj (zapis do bazy)" : "TRYB: dry-run (tylko plan, bez zapisu i bez połączenia z bazą)");
  console.log("");

  const leadResult = buildLeadPlan(oldLeads, cli);
  const activityResult = buildActivityPlan(oldActivities, leadResult.redirect);
  const taskResult = buildTaskPlan(oldTasks, leadResult.redirect);

  printReport(leadResult, activityResult, taskResult);

  if (!cli.wykonaj) {
    console.log("Dry-run zakończony. Żadne dane nie zostały zapisane. Użyj --wykonaj, żeby zaimportować.");
    return;
  }

  await execute(leadResult, activityResult, taskResult);
}

main().catch((err) => {
  console.error("Nieoczekiwany błąd skryptu:", err);
  process.exit(1);
});
