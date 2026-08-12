// Metryki marketingowe (Etapy 2–3) — czyste funkcje, bez dostępu do bazy.
//
// Nazewnictwo pilnowane świadomie: CPL to koszt LEADA (surowego zgłoszenia).
// Kosztem pozyskania KLIENTA (CAC) wolno nazwać wyłącznie spend / płatni
// klienci. Mieszanie tych pojęć zawyża skuteczność reklam w raportach.

import { OPEN_STATUSES, OUTBOUND_SEQUENCE } from "./constants";
import { warsawDateOf, warsawToday } from "./dates";
import type {
  ActivityType,
  AdsPlatform,
  CrmActivity,
  CrmAdsLog,
  CrmLead,
} from "./types";

// ----------------------------------------------------------------------------
// Reklamy
// ----------------------------------------------------------------------------

export interface AdsMetrics {
  /** CTR = clicks / impressions. null gdy brak danych w mianowniku. */
  ctr: number | null;
  /** CPC = spend / clicks. */
  cpc: number | null;
  /** CPL = spend / surowe leady. To NIE jest koszt pozyskania klienta. */
  cpl: number | null;
  /** Koszt kwalifikowanego leada = spend / qualified_leads. */
  costPerQualified: number | null;
  /** Koszt demo = spend / demos. */
  costPerDemo: number | null;
  /** CAC = spend / płatni klienci — jedyna metryka, którą wolno tak nazywać. */
  cac: number | null;
}

function ratio(numerator: number, denominator: number | null | undefined): number | null {
  // 0 w mianowniku to "brak danych", nie "0 zł" — null wymusza "—" w UI.
  if (!denominator || denominator <= 0) return null;
  return numerator / denominator;
}

export function adsMetrics(
  row: Pick<
    CrmAdsLog,
    "spend" | "impressions" | "clicks" | "raw_leads" | "qualified_leads" | "demos" | "paid_customers"
  >,
): AdsMetrics {
  const spend = Number(row.spend);
  return {
    ctr: ratio(row.clicks ?? 0, row.impressions),
    cpc: ratio(spend, row.clicks),
    cpl: ratio(spend, row.raw_leads),
    costPerQualified: ratio(spend, row.qualified_leads),
    costPerDemo: ratio(spend, row.demos),
    cac: ratio(spend, row.paid_customers),
  };
}

export interface AdsTotals extends AdsMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  rawLeads: number;
  qualifiedLeads: number;
  demos: number;
  pilots: number;
  paidCustomers: number;
}

/** Suma dziennika z metrykami; opcjonalny filtr platformy/kampanii/okresu. */
export function adsTotals(
  rows: CrmAdsLog[],
  filter: { platform?: AdsPlatform; campaign?: string; fromDay?: string; toDay?: string } = {},
): AdsTotals {
  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let rawLeads = 0;
  let qualifiedLeads = 0;
  let demos = 0;
  let pilots = 0;
  let paidCustomers = 0;
  for (const r of rows) {
    if (filter.platform && r.platform !== filter.platform) continue;
    if (filter.campaign !== undefined && r.campaign !== filter.campaign) continue;
    if (filter.fromDay && r.log_date < filter.fromDay) continue;
    if (filter.toDay && r.log_date > filter.toDay) continue;
    // PostgREST zwraca numeric jako string — Number() na granicy.
    spend += Number(r.spend);
    impressions += r.impressions ?? 0;
    clicks += r.clicks ?? 0;
    rawLeads += r.raw_leads;
    qualifiedLeads += r.qualified_leads;
    demos += r.demos;
    pilots += r.pilots;
    paidCustomers += r.paid_customers;
  }
  return {
    spend,
    impressions,
    clicks,
    rawLeads,
    qualifiedLeads,
    demos,
    pilots,
    paidCustomers,
    ctr: ratio(clicks, impressions),
    cpc: ratio(spend, clicks),
    cpl: ratio(spend, rawLeads),
    costPerQualified: ratio(spend, qualifiedLeads),
    costPerDemo: ratio(spend, demos),
    cac: ratio(spend, paidCustomers),
  };
}

/**
 * Alert drogiego CPL: co najmniej `streakDays` KOLEJNYCH dni kalendarzowych
 * (licząc wstecz od najnowszego wpisu platformy) z wydatkiem > 0 i CPL powyżej
 * progu albo bez leadów. Trzy drogie dni rozrzucone po miesiącu to nie seria —
 * fałszywy alert popycha do wyłączania działającej kreacji.
 */
export function cplAlert(
  rows: CrmAdsLog[],
  platform: AdsPlatform,
  threshold: number,
  streakDays: number,
): boolean {
  // Dzienne sumy platformy (kampanie zsumowane), posortowane malejąco po dacie.
  const byDay = new Map<string, { spend: number; leads: number }>();
  for (const r of rows) {
    if (r.platform !== platform) continue;
    const agg = byDay.get(r.log_date) ?? { spend: 0, leads: 0 };
    agg.spend += Number(r.spend);
    agg.leads += r.raw_leads;
    byDay.set(r.log_date, agg);
  }
  const days = [...byDay.keys()].sort().reverse();
  if (days.length < streakDays) return false;

  let streak = 0;
  let expected: string | null = null;
  for (const day of days) {
    if (expected !== null && day !== expected) break; // dziura w kalendarzu przerywa serię
    const { spend, leads } = byDay.get(day)!;
    const cpl = ratio(spend, leads);
    const bad = spend > 0 && (cpl === null || cpl > threshold);
    if (!bad) break;
    streak += 1;
    if (streak >= streakDays) return true;
    const parts: number[] = day.split("-").map(Number);
    expected = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] - 1)).toISOString().slice(0, 10);
  }
  return false;
}

// ----------------------------------------------------------------------------
// Kolejka outboundu (Etap 2) — czysta logika podpowiedzi następnego ruchu.
// ----------------------------------------------------------------------------

export interface OutboundItem {
  lead: CrmLead;
  /** Sugerowany następny ruch z sekwencji DM → follow-up → telefon → wizyta. */
  suggestedStep: ActivityType;
  /** Ostatni outboundowy kontakt (ISO) albo null, gdy jeszcze go nie było. */
  lastTouch: string | null;
  /** Ile już było prób z sekwencji. */
  attempts: number;
}

const SEQUENCE_SET = new Set<ActivityType>(OUTBOUND_SEQUENCE);

/**
 * Kolejka kontaktów na dziś: leady otwarte, bez zaplanowanego PRZYSZŁEGO kroku,
 * posortowane priorytetem A→D, a w ramach priorytetu — najdłużej nietykane
 * najpierw. Sugerowany krok to następny element sekwencji po ostatniej próbie;
 * lead bez Instagrama omija kroki DM (nie da się napisać DM bez konta).
 */
export function outboundQueue(
  leads: CrmLead[],
  activities: CrmActivity[],
  now: Date = new Date(),
): OutboundItem[] {
  const today = warsawToday(now);

  // Ostatnia aktywność sekwencyjna + liczba prób per lead.
  const lastSeq = new Map<string, { at: string; type: ActivityType; count: number }>();
  for (const a of activities) {
    if (!a.lead_id || !SEQUENCE_SET.has(a.type)) continue;
    const prev = lastSeq.get(a.lead_id);
    if (!prev) {
      lastSeq.set(a.lead_id, { at: a.happened_at, type: a.type, count: 1 });
    } else {
      prev.count += 1;
      if (a.happened_at > prev.at) {
        prev.at = a.happened_at;
        prev.type = a.type;
      }
    }
  }

  const items: OutboundItem[] = [];
  for (const lead of leads) {
    if (!OPEN_STATUSES.includes(lead.status)) continue;
    // Zaplanowany przyszły krok = lead ma plan; kolejka jest dla bezplanowych.
    if (lead.next_action_at && warsawDateOf(lead.next_action_at) > today) continue;
    // Leady w trakcie pilota nie potrzebują zimnego outboundu — mają check-iny.
    if (lead.status === "pilot_aktywny" || lead.status === "pilot_umowiony") continue;

    const seq = lastSeq.get(lead.id);
    const sequence = lead.instagram
      ? OUTBOUND_SEQUENCE
      : OUTBOUND_SEQUENCE.filter((s) => s !== "ig_dm" && s !== "ig_followup");

    let suggested: ActivityType;
    if (!seq) {
      suggested = sequence[0];
    } else {
      const idx = sequence.indexOf(seq.type);
      // Po ostatnim kroku sekwencji zostajemy przy wizycie — dalej decyduje człowiek.
      suggested = idx >= 0 && idx < sequence.length - 1 ? sequence[idx + 1] : sequence[sequence.length - 1];
    }

    items.push({
      lead,
      suggestedStep: suggested,
      lastTouch: seq?.at ?? lead.last_activity_at,
      attempts: seq?.count ?? 0,
    });
  }

  const priorityRank = { A: 0, B: 1, C: 2, D: 3 } as const;
  return items.sort((a, b) => {
    const p = priorityRank[a.lead.priority] - priorityRank[b.lead.priority];
    if (p !== 0) return p;
    return (a.lastTouch ?? "0000").localeCompare(b.lastTouch ?? "0000");
  });
}
