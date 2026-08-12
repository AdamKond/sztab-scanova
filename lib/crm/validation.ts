// Walidacja danych wejściowych i reguł przejść statusów.
// Wszystko po stronie serwera — danym z przeglądarki nie ufamy nigdy
// (status, owner, created_by i identyfikatory też przychodzą z formularzy,
// ale autora zawsze ustalamy z sesji, a wartości słownikowe sprawdzamy tutaj).

import {
  ALL_STATUSES,
  ACTIVITY_TYPES,
  ADS_PLATFORMS,
  CONTENT_CHANNELS,
  CONTENT_FORMATS,
  CONTENT_STATUSES,
  CURRENT_LOYALTY_OPTIONS,
  GOAL_METRICS,
  OUTCOMES,
  PRIORITIES,
  SOURCES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TEMPLATE_CHANNELS,
} from "./constants";
import type {
  ActivityOutcome,
  ActivityType,
  AdsPlatform,
  ContentChannel,
  ContentFormat,
  ContentStatus,
  CrmLead,
  CurrentLoyalty,
  GoalMetric,
  LeadPriority,
  LeadSource,
  LeadStatus,
  TaskPriority,
  TaskStatus,
  TemplateChannel,
} from "./types";

// Limity długości pól tekstowych — ochrona przed wklejkami i wektorami DoS.
export const LIMITS = {
  name: 160,
  shortText: 200,
  title: 240,
  note: 4000,
  notes: 8000,
} as const;

// ----------------------------------------------------------------------------
// Type guardy wartości słownikowych (dane z formularzy to zawsze stringi).
// ----------------------------------------------------------------------------

export function isLeadStatus(v: unknown): v is LeadStatus {
  return typeof v === "string" && (ALL_STATUSES as string[]).includes(v);
}
export function isLeadPriority(v: unknown): v is LeadPriority {
  return typeof v === "string" && (PRIORITIES as string[]).includes(v);
}
export function isLeadSource(v: unknown): v is LeadSource {
  return typeof v === "string" && (SOURCES as string[]).includes(v);
}
export function isActivityType(v: unknown): v is ActivityType {
  return typeof v === "string" && (ACTIVITY_TYPES as string[]).includes(v);
}
export function isActivityOutcome(v: unknown): v is ActivityOutcome {
  return typeof v === "string" && (OUTCOMES as string[]).includes(v);
}
export function isTaskStatus(v: unknown): v is TaskStatus {
  return typeof v === "string" && (TASK_STATUSES as string[]).includes(v);
}
export function isTaskPriority(v: unknown): v is TaskPriority {
  return typeof v === "string" && (TASK_PRIORITIES as string[]).includes(v);
}
export function isGoalMetric(v: unknown): v is GoalMetric {
  return typeof v === "string" && (GOAL_METRICS as string[]).includes(v);
}
export function isCurrentLoyalty(v: unknown): v is CurrentLoyalty {
  return typeof v === "string" && (CURRENT_LOYALTY_OPTIONS as string[]).includes(v);
}
export function isTemplateChannel(v: unknown): v is TemplateChannel {
  return typeof v === "string" && (TEMPLATE_CHANNELS as string[]).includes(v);
}
export function isContentChannel(v: unknown): v is ContentChannel {
  return typeof v === "string" && (CONTENT_CHANNELS as string[]).includes(v);
}
export function isContentFormat(v: unknown): v is ContentFormat {
  return typeof v === "string" && (CONTENT_FORMATS as string[]).includes(v);
}
export function isContentStatus(v: unknown): v is ContentStatus {
  return typeof v === "string" && (CONTENT_STATUSES as string[]).includes(v);
}
export function isAdsPlatform(v: unknown): v is AdsPlatform {
  return typeof v === "string" && (ADS_PLATFORMS as string[]).includes(v);
}

// ----------------------------------------------------------------------------
// Reguły przejść statusów: które pola muszą być ustawione, żeby przejście
// było uczciwe. Bez tego "płatny klient" bez MRR to fikcja w raportach.
// ----------------------------------------------------------------------------

export interface StatusRequirementInput {
  pilot_started_at?: string | null;
  pilot_ends_at?: string | null;
  paid_at?: string | null;
  plan?: string | null;
  monthly_revenue?: number | null;
  churned_at?: string | null;
  lost_reason?: string | null;
  disqualification_reason?: string | null;
}

/**
 * Zwraca listę polskich komunikatów o brakach dla danego statusu docelowego.
 * Pusta lista = przejście dozwolone. Sprawdzamy stan PO scaleniu zmian
 * z formularza z istniejącym leadem (caller robi merge).
 */
export function missingForStatus(
  target: LeadStatus,
  data: StatusRequirementInput,
): string[] {
  const missing: string[] = [];
  switch (target) {
    case "pilot_aktywny":
      if (!data.pilot_started_at) missing.push("Data startu pilota jest wymagana.");
      if (!data.pilot_ends_at) missing.push("Data końca pilota jest wymagana.");
      break;
    case "platny_klient":
      if (!data.paid_at) missing.push("Data płatności jest wymagana.");
      if (!data.plan?.trim()) missing.push("Plan abonamentowy jest wymagany.");
      if (data.monthly_revenue === null || data.monthly_revenue === undefined) {
        missing.push("Miesięczny przychód (MRR) jest wymagany.");
      } else if (!(Number(data.monthly_revenue) > 0)) {
        missing.push("Miesięczny przychód musi być większy od zera.");
      }
      break;
    case "utracony":
      if (!data.lost_reason?.trim()) missing.push("Powód utraty jest wymagany.");
      break;
    case "zdyskwalifikowany":
      if (!data.disqualification_reason?.trim()) {
        missing.push("Powód dyskwalifikacji jest wymagany.");
      }
      break;
    case "churn":
      if (!data.churned_at) missing.push("Data rezygnacji jest wymagana.");
      if (!data.lost_reason?.trim()) missing.push("Powód rezygnacji jest wymagany.");
      break;
  }
  if (
    target === "pilot_aktywny" &&
    data.pilot_started_at &&
    data.pilot_ends_at &&
    data.pilot_ends_at < data.pilot_started_at
  ) {
    missing.push("Koniec pilota nie może być przed jego startem.");
  }
  return missing;
}

/** Scala istniejącego leada ze zmianami i sprawdza wymagania statusu. */
export function validateStatusChange(
  lead: Pick<
    CrmLead,
    | "pilot_started_at"
    | "pilot_ends_at"
    | "paid_at"
    | "plan"
    | "monthly_revenue"
    | "churned_at"
    | "lost_reason"
    | "disqualification_reason"
  >,
  target: LeadStatus,
  updates: StatusRequirementInput,
): string[] {
  return missingForStatus(target, {
    pilot_started_at: updates.pilot_started_at !== undefined ? updates.pilot_started_at : lead.pilot_started_at,
    pilot_ends_at: updates.pilot_ends_at !== undefined ? updates.pilot_ends_at : lead.pilot_ends_at,
    paid_at: updates.paid_at !== undefined ? updates.paid_at : lead.paid_at,
    plan: updates.plan !== undefined ? updates.plan : lead.plan,
    monthly_revenue:
      updates.monthly_revenue !== undefined ? updates.monthly_revenue : lead.monthly_revenue,
    churned_at: updates.churned_at !== undefined ? updates.churned_at : lead.churned_at,
    lost_reason: updates.lost_reason !== undefined ? updates.lost_reason : lead.lost_reason,
    disqualification_reason:
      updates.disqualification_reason !== undefined
        ? updates.disqualification_reason
        : lead.disqualification_reason,
  });
}

// ----------------------------------------------------------------------------
// Parsowanie pól formularzy
// ----------------------------------------------------------------------------

/** Kwota z formularza ("129,00" / "129.00") -> number albo null. */
export function parseMoney(raw: FormDataEntryValue | null): number | null {
  if (raw === null || typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number(raw.replace(",", ".").replace(/\s/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

/** Dodatnia liczba całkowita z formularza albo null. */
export function parsePositiveInt(raw: FormDataEntryValue | null): number | null {
  if (raw === null || typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

/**
 * datetime-local ("2026-08-12T14:30") lub date ("2026-08-12") -> ISO UTC.
 * Wartość interpretujemy jako czas POLSKI (Europe/Warsaw), bo obaj użytkownicy
 * pracują w Polsce, a serwer może stać gdziekolwiek. Dwuprzebiegowe liczenie
 * offsetu obsługuje noc zmiany czasu.
 */
export function warsawLocalToIso(raw: FormDataEntryValue | null): string | null {
  if (raw === null || typeof raw !== "string" || raw.trim() === "") return null;
  const v = raw.trim();
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00"] = m;
  const asUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  // Pierwszy przebieg: przybliżony offset Warszawy w tym momencie.
  const offset1 = warsawOffsetMs(new Date(asUtc));
  // Drugi przebieg: offset policzony już dla skorygowanej chwili (granica DST).
  const offset2 = warsawOffsetMs(new Date(asUtc - offset1));
  return new Date(asUtc - offset2).toISOString();
}

function warsawOffsetMs(at: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second"),
  );
  return asIfUtc - at.getTime();
}
