// Metryki sprzedażowe — WYŁĄCZNIE czyste funkcje na tablicach w pamięci,
// bez dostępu do bazy. Dzięki temu testujemy je w vitest bez Supabase.
//
// Zasada nadrzędna: konwersje i "osiągnięcia" liczymy z crm_stage_history
// ("lead KIEDYKOLWIEK wszedł w etap X lub dalszy"), nie z bieżącego statusu.
// Lead utracony po demo nadal wykonał demo — inaczej lejek kłamie.

import {
  FUNNEL_ORDER,
  OPEN_STATUSES,
  TERMINAL_STATUSES,
} from "./constants";
import { daysBetween, msBetween, warsawDateOf, warsawToday } from "./dates";
import type {
  ActivityType,
  CrmActivity,
  CrmLead,
  CrmStageHistory,
  GoalMetric,
  LeadSource,
  LeadStatus,
  SalesGoal,
} from "./types";

const FUNNEL_INDEX: ReadonlyMap<LeadStatus, number> = new Map(
  FUNNEL_ORDER.map((s, i) => [s, i]),
);

const MS_PER_DAY = 86_400_000;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ----------------------------------------------------------------------------
// MRR
// ----------------------------------------------------------------------------

/**
 * MRR = suma monthly_revenue wyłącznie AKTYWNYCH płatnych klientów.
 * Churn nie liczy się do MRR. Pilot nie liczy się do MRR.
 */
export function computeMrr(leads: CrmLead[]): number {
  let sum = 0;
  for (const l of leads) {
    if (l.status === "platny_klient" && l.monthly_revenue !== null) {
      // PostgREST potrafi zwrócić numeric jako string — brońmy się na granicy.
      sum += Number(l.monthly_revenue);
    }
  }
  return sum;
}

// ----------------------------------------------------------------------------
// Zasięg etapów z historii
// ----------------------------------------------------------------------------

/**
 * Dla każdego etapu lejka: zbiór leadów, które osiągnęły ten etap LUB dalszy.
 * "Lub dalszy" jest kluczowe: lead może przeskoczyć etap (nowy -> demo_umowione)
 * i mimo braku wpisu "proba_kontaktu" na pewno był kontaktowany.
 * Wpisy statusów spoza lejka (followup_pozniej, utracony...) nie budują zasięgu.
 */
export function reachedAtLeast(history: CrmStageHistory[]): Map<LeadStatus, Set<string>> {
  // Najdalszy osiągnięty indeks lejka per lead.
  const maxIndex = new Map<string, number>();
  for (const h of history) {
    const idx = FUNNEL_INDEX.get(h.to_status);
    if (idx === undefined) continue;
    const prev = maxIndex.get(h.lead_id);
    if (prev === undefined || idx > prev) maxIndex.set(h.lead_id, idx);
  }
  const result = new Map<LeadStatus, Set<string>>();
  for (const status of FUNNEL_ORDER) {
    const i = FUNNEL_INDEX.get(status)!;
    const set = new Set<string>();
    for (const [leadId, max] of maxIndex) {
      if (max >= i) set.add(leadId);
    }
    result.set(status, set);
  }
  return result;
}

export interface StageConversion {
  from: LeadStatus;
  to: LeadStatus;
  fromCount: number;
  toCount: number;
  /** null gdy brak danych w mianowniku — "brak danych" to nie "0%". */
  rate: number | null;
}

/** Konwersje między kolejnymi etapami lejka. */
export function stageConversions(history: CrmStageHistory[]): StageConversion[] {
  const reached = reachedAtLeast(history);
  const rows: StageConversion[] = [];
  for (let i = 0; i < FUNNEL_ORDER.length - 1; i++) {
    const from = FUNNEL_ORDER[i];
    const to = FUNNEL_ORDER[i + 1];
    const fromCount = reached.get(from)!.size;
    const toCount = reached.get(to)!.size;
    rows.push({ from, to, fromCount, toCount, rate: fromCount > 0 ? toCount / fromCount : null });
  }
  return rows;
}

/** Konwersja między dwoma dowolnymi etapami lejka (np. demo_wykonane -> pilot_aktywny). */
export function conversionBetween(
  history: CrmStageHistory[],
  from: LeadStatus,
  to: LeadStatus,
): { fromCount: number; toCount: number; rate: number | null } {
  const reached = reachedAtLeast(history);
  const fromCount = reached.get(from)?.size ?? 0;
  const toCount = reached.get(to)?.size ?? 0;
  return { fromCount, toCount, rate: fromCount > 0 ? toCount / fromCount : null };
}

// ----------------------------------------------------------------------------
// Czas w etapie i czas do płatności
// ----------------------------------------------------------------------------

export interface StageTime {
  status: LeadStatus;
  count: number;
  avgDays: number | null;
  medianDays: number | null;
}

/**
 * Czas spędzony w każdym etapie lejka: od wejścia w etap do następnej zmiany
 * statusu (dla bieżącego etapu — do teraz).
 */
export function timeInStages(history: CrmStageHistory[], now: Date = new Date()): StageTime[] {
  const byLead = new Map<string, CrmStageHistory[]>();
  for (const h of history) {
    const arr = byLead.get(h.lead_id);
    if (arr) arr.push(h);
    else byLead.set(h.lead_id, [h]);
  }
  const durations = new Map<LeadStatus, number[]>();
  const nowIso = now.toISOString();
  for (const entries of byLead.values()) {
    entries.sort((a, b) => a.changed_at.localeCompare(b.changed_at));
    for (let i = 0; i < entries.length; i++) {
      const status = entries[i].to_status;
      if (!FUNNEL_INDEX.has(status)) continue;
      const end = i + 1 < entries.length ? entries[i + 1].changed_at : nowIso;
      const ms = msBetween(entries[i].changed_at, end);
      if (ms < 0) continue;
      const arr = durations.get(status);
      if (arr) arr.push(ms);
      else durations.set(status, [ms]);
    }
  }
  return FUNNEL_ORDER.map((status) => {
    const ms = durations.get(status) ?? [];
    const days = ms.map((v) => v / MS_PER_DAY);
    return { status, count: days.length, avgDays: average(days), medianDays: median(days) };
  });
}

/**
 * Czas od pierwszego wpisu historii (utworzenie leada) do wejścia w
 * platny_klient, w dniach — dla leadów, które zapłaciły.
 */
export function daysToPaid(history: CrmStageHistory[]): number[] {
  const byLead = new Map<string, CrmStageHistory[]>();
  for (const h of history) {
    const arr = byLead.get(h.lead_id);
    if (arr) arr.push(h);
    else byLead.set(h.lead_id, [h]);
  }
  const result: number[] = [];
  for (const entries of byLead.values()) {
    entries.sort((a, b) => a.changed_at.localeCompare(b.changed_at));
    const paid = entries.find((e) => e.to_status === "platny_klient");
    if (!paid) continue;
    const ms = msBetween(entries[0].changed_at, paid.changed_at);
    if (ms >= 0) result.push(ms / MS_PER_DAY);
  }
  return result;
}

// ----------------------------------------------------------------------------
// Win rate
// ----------------------------------------------------------------------------

export interface WinRate {
  won: number;
  lost: number;
  churned: number;
  /** won / (won + lost + churned); null gdy mianownik 0. Zdyskwalifikowani celowo poza mianownikiem. */
  rate: number | null;
}

/**
 * Win rate w okresie [fromDay, toDay] (YYYY-MM-DD, Europe/Warsaw, włącznie)
 * liczony z historii przejść: wygrana = wejście w platny_klient,
 * przegrana = wejście w utracony lub churn. Zdyskwalifikowany nie liczy się
 * do mianownika — to filtr jakości leadów, nie porażka sprzedaży.
 */
export function winRate(
  history: CrmStageHistory[],
  fromDay?: string,
  toDay?: string,
): WinRate {
  const wonLeads = new Set<string>();
  const lostLeads = new Set<string>();
  const churnedLeads = new Set<string>();
  for (const h of history) {
    const day = warsawDateOf(h.changed_at);
    if (fromDay && day < fromDay) continue;
    if (toDay && day > toDay) continue;
    if (h.to_status === "platny_klient") wonLeads.add(h.lead_id);
    else if (h.to_status === "utracony") lostLeads.add(h.lead_id);
    else if (h.to_status === "churn") churnedLeads.add(h.lead_id);
  }
  const won = wonLeads.size;
  const lost = lostLeads.size;
  const churned = churnedLeads.size;
  const denom = won + lost + churned;
  return { won, lost, churned, rate: denom > 0 ? won / denom : null };
}

// ----------------------------------------------------------------------------
// Stygnące leady, brak następnego kroku, follow-upy
// ----------------------------------------------------------------------------

/**
 * Stygnące: lead otwarty, bez zaplanowanego PRZYSZŁEGO kroku, bez żadnej
 * aktywności od `staleAfterDays` dni (fallback: created_at, gdy zero aktywności).
 * Lead z follow-upem umówionym na przyszły tydzień nie "stygnie" — czeka.
 */
export function staleLeads(
  leads: CrmLead[],
  staleAfterDays: number,
  now: Date = new Date(),
): CrmLead[] {
  const today = warsawToday(now);
  return leads
    .filter((l) => {
      if (!OPEN_STATUSES.includes(l.status)) return false;
      if (l.next_action_at && warsawDateOf(l.next_action_at) > today) return false;
      const reference = l.last_activity_at ?? l.created_at;
      return daysBetween(warsawDateOf(reference), today) >= staleAfterDays;
    })
    .sort((a, b) =>
      (a.last_activity_at ?? a.created_at).localeCompare(b.last_activity_at ?? b.created_at),
    );
}

/** Otwarte leady bez żadnego zaplanowanego następnego kroku. */
export function leadsWithoutNextStep(leads: CrmLead[]): CrmLead[] {
  return leads.filter((l) => OPEN_STATUSES.includes(l.status) && !l.next_action_at);
}

export interface FollowupBuckets {
  overdue: CrmLead[];
  today: CrmLead[];
}

/** Follow-upy: zaległe (termin przed dziś) i na dziś. Tylko leady otwarte. */
export function followupBuckets(leads: CrmLead[], now: Date = new Date()): FollowupBuckets {
  const today = warsawToday(now);
  const overdue: CrmLead[] = [];
  const todayList: CrmLead[] = [];
  for (const l of leads) {
    if (!OPEN_STATUSES.includes(l.status) || !l.next_action_at) continue;
    const day = warsawDateOf(l.next_action_at);
    if (day < today) overdue.push(l);
    else if (day === today) todayList.push(l);
  }
  const byDate = (a: CrmLead, b: CrmLead) =>
    (a.next_action_at ?? "").localeCompare(b.next_action_at ?? "");
  overdue.sort(byDate);
  todayList.sort(byDate);
  return { overdue, today: todayList };
}

// ----------------------------------------------------------------------------
// Piloty
// ----------------------------------------------------------------------------

/** Piloty aktywne kończące się w ciągu `withinDays` dni (albo już po terminie). */
export function pilotsEndingSoon(
  leads: CrmLead[],
  withinDays: number,
  now: Date = new Date(),
): CrmLead[] {
  const today = warsawToday(now);
  return leads
    .filter((l) => {
      if (l.status !== "pilot_aktywny" || !l.pilot_ends_at) return false;
      return daysBetween(today, warsawDateOf(l.pilot_ends_at)) <= withinDays;
    })
    .sort((a, b) => (a.pilot_ends_at ?? "").localeCompare(b.pilot_ends_at ?? ""));
}

/**
 * Piloty aktywne bez check-inu (aktywność pilot_checkin) od `afterDays` dni.
 * Gdy nie było żadnego check-inu, liczymy od startu pilota.
 */
export function pilotsNeedingCheckin(
  leads: CrmLead[],
  activities: CrmActivity[],
  afterDays: number,
  now: Date = new Date(),
): CrmLead[] {
  const today = warsawToday(now);
  const lastCheckin = new Map<string, string>();
  for (const a of activities) {
    if (a.type !== "pilot_checkin" || !a.lead_id) continue;
    const prev = lastCheckin.get(a.lead_id);
    if (!prev || a.happened_at > prev) lastCheckin.set(a.lead_id, a.happened_at);
  }
  return leads.filter((l) => {
    if (l.status !== "pilot_aktywny") return false;
    const reference = lastCheckin.get(l.id) ?? l.pilot_started_at ?? l.created_at;
    return daysBetween(warsawDateOf(reference), today) >= afterDays;
  });
}

// ----------------------------------------------------------------------------
// Wyniki per źródło i per osoba
// ----------------------------------------------------------------------------

export interface SourceRow {
  source: LeadSource;
  total: number;
  decisionMakerContacts: number;
  demosDone: number;
  pilots: number;
  paid: number;
  mrr: number;
}

/**
 * Lejek per źródło — odpowiada na pytanie "które kanały dają płatnych
 * i utrzymanych klientów, a nie tylko tanie formularze".
 */
export function resultsBySource(leads: CrmLead[], history: CrmStageHistory[]): SourceRow[] {
  const reached = reachedAtLeast(history);
  const atLeast = (status: LeadStatus, id: string) => reached.get(status)?.has(id) ?? false;
  const bySource = new Map<LeadSource, SourceRow>();
  for (const l of leads) {
    let row = bySource.get(l.source);
    if (!row) {
      row = {
        source: l.source,
        total: 0,
        decisionMakerContacts: 0,
        demosDone: 0,
        pilots: 0,
        paid: 0,
        mrr: 0,
      };
      bySource.set(l.source, row);
    }
    row.total += 1;
    if (atLeast("kontakt_zdecydentem", l.id)) row.decisionMakerContacts += 1;
    if (atLeast("demo_wykonane", l.id)) row.demosDone += 1;
    if (atLeast("pilot_aktywny", l.id)) row.pilots += 1;
    if (atLeast("platny_klient", l.id)) row.paid += 1;
    if (l.status === "platny_klient" && l.monthly_revenue !== null) {
      row.mrr += Number(l.monthly_revenue);
    }
  }
  return [...bySource.values()].sort((a, b) => b.total - a.total);
}

export interface OwnerActivityRow {
  person: string;
  total: number;
  byType: Partial<Record<ActivityType, number>>;
}

/** Aktywności per osoba w okresie [fromDay, toDay] (YYYY-MM-DD, włącznie). */
export function activitiesByPerson(
  activities: CrmActivity[],
  fromDay?: string,
  toDay?: string,
): OwnerActivityRow[] {
  const byPerson = new Map<string, OwnerActivityRow>();
  for (const a of activities) {
    const day = warsawDateOf(a.happened_at);
    if (fromDay && day < fromDay) continue;
    if (toDay && day > toDay) continue;
    const person = a.created_by.toLowerCase();
    let row = byPerson.get(person);
    if (!row) {
      row = { person, total: 0, byType: {} };
      byPerson.set(person, row);
    }
    row.total += 1;
    row.byType[a.type] = (row.byType[a.type] ?? 0) + 1;
  }
  return [...byPerson.values()].sort((a, b) => b.total - a.total);
}

// ----------------------------------------------------------------------------
// Powody utraty / dyskwalifikacji
// ----------------------------------------------------------------------------

export interface ReasonRow {
  reason: string;
  count: number;
}

/** Zliczenie powodów utraty (status utracony/churn) lub dyskwalifikacji. */
export function lossReasons(leads: CrmLead[]): { lost: ReasonRow[]; disqualified: ReasonRow[] } {
  const lost = new Map<string, number>();
  const disq = new Map<string, number>();
  for (const l of leads) {
    if ((l.status === "utracony" || l.status === "churn") && l.lost_reason) {
      lost.set(l.lost_reason, (lost.get(l.lost_reason) ?? 0) + 1);
    }
    if (l.status === "zdyskwalifikowany" && l.disqualification_reason) {
      disq.set(l.disqualification_reason, (disq.get(l.disqualification_reason) ?? 0) + 1);
    }
  }
  const toRows = (m: Map<string, number>) =>
    [...m.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
  return { lost: toRows(lost), disqualified: toRows(disq) };
}

// ----------------------------------------------------------------------------
// Postęp celów
// ----------------------------------------------------------------------------

export interface GoalProgress {
  goal: SalesGoal;
  actual: number;
  /** 0..1, może przekroczyć 1 przy przebiciu celu. null gdy target 0. */
  progress: number | null;
}

/**
 * Postęp celu w jego okresie [starts_on, ends_on]:
 * - aktywnosci: liczba aktywności (bez notatek — notatka to nie praca sprzedażowa),
 * - kontakty_z_decydentem / demo / piloty / platni_klienci: liczba UNIKALNYCH
 *   leadów, które w okresie weszły w odpowiedni etap (z historii),
 * - mrr: bieżące MRR (cel poziomu, nie przyrostu).
 */
export function goalProgress(
  goal: SalesGoal,
  data: { leads: CrmLead[]; activities: CrmActivity[]; history: CrmStageHistory[] },
): GoalProgress {
  const inPeriod = (iso: string) => {
    const day = warsawDateOf(iso);
    return day >= goal.starts_on && day <= goal.ends_on;
  };
  const uniqueLeadsEntering = (status: LeadStatus) => {
    const set = new Set<string>();
    for (const h of data.history) {
      if (h.to_status === status && inPeriod(h.changed_at)) set.add(h.lead_id);
    }
    return set.size;
  };

  let actual: number;
  switch (goal.metric) {
    case "aktywnosci":
      actual = data.activities.filter((a) => a.type !== "notatka" && inPeriod(a.happened_at)).length;
      break;
    case "kontakty_z_decydentem":
      actual = uniqueLeadsEntering("kontakt_zdecydentem");
      break;
    case "demo":
      actual = uniqueLeadsEntering("demo_wykonane");
      break;
    case "piloty":
      actual = uniqueLeadsEntering("pilot_aktywny");
      break;
    case "platni_klienci":
      actual = uniqueLeadsEntering("platny_klient");
      break;
    case "mrr":
      actual = computeMrr(data.leads);
      break;
  }
  const target = Number(goal.target_value);
  return { goal, actual, progress: target > 0 ? actual / target : null };
}

// ----------------------------------------------------------------------------
// Liczności lejka (bieżący stan)
// ----------------------------------------------------------------------------

export function funnelCounts(leads: CrmLead[]): Map<LeadStatus, number> {
  const counts = new Map<LeadStatus, number>();
  for (const l of leads) counts.set(l.status, (counts.get(l.status) ?? 0) + 1);
  return counts;
}

/** Leady zalegające w bieżącym etapie ponad próg (wg ostatniej zmiany statusu). */
export function stuckLeads(
  leads: CrmLead[],
  history: CrmStageHistory[],
  stuckAfterDays: number,
  now: Date = new Date(),
): { lead: CrmLead; daysInStage: number }[] {
  const today = warsawToday(now);
  // Ostatnia zmiana statusu per lead — wejście w bieżący etap.
  const lastChange = new Map<string, string>();
  for (const h of history) {
    const prev = lastChange.get(h.lead_id);
    if (!prev || h.changed_at > prev) lastChange.set(h.lead_id, h.changed_at);
  }
  const rows: { lead: CrmLead; daysInStage: number }[] = [];
  for (const l of leads) {
    if (!OPEN_STATUSES.includes(l.status)) continue;
    const entered = lastChange.get(l.id) ?? l.created_at;
    const days = daysBetween(warsawDateOf(entered), today);
    if (days >= stuckAfterDays) rows.push({ lead: l, daysInStage: days });
  }
  return rows.sort((a, b) => b.daysInStage - a.daysInStage);
}

// Grupy statusów przydatne w UI (eksport dla ekranów).
export const STATUS_GROUPS = {
  open: OPEN_STATUSES,
  terminal: TERMINAL_STATUSES,
} as const;
