// Czysta logika Bazy lokali i kolejki DM (tabela crm_dm_blitz).
//
// Bez "server-only": grupowanie, etapy i kolejkę liczy też client component
// (optymistyczne odhaczanie), więc kod musi być czystą funkcją bez bazy.

import { firstDm, followupDm } from "./dm-copy";

export type CrmDmBlitz = {
  id: string;
  name: string;
  city: string | null;
  niche: string;
  instagram: string;
  followers: number | null;
  /** Tekst z zasiewu (stara, długa wersja) — UI używa firstDmText(), nie tej kolumny. */
  dm_text: string;
  campaign: string;
  sent_at: string | null;
  sent_by: string | null;
  followup_sent_at: string | null;
  followup_sent_by: string | null;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
};

// ----------------------------------------------------------------------------
// Lejek: DM #1 → (3 dni ciszy) follow-up → odpowiedź = rozmowa w CRM.
// Etap wyliczamy z timestampów zamiast trzymać kolumnę statusu — nie ma czego
// synchronizować i cofnięcie odhaczenia automatycznie cofa etap.
// ----------------------------------------------------------------------------

export const FOLLOWUP_AFTER_DAYS = 3;

/** Bezpieczny dzienny limit DM-ów z jednego konta IG — powyżej rośnie ryzyko blokady. */
export const DAILY_DM_LIMIT = 30;

export type BlitzStage =
  | "todo" // DM #1 jeszcze nie wysłany
  | "waiting" // DM #1 wysłany, cisza krótsza niż próg
  | "followup_due" // cisza ≥ progu — lokal czeka w kolejce follow-upu
  | "followed_up" // follow-up wysłany, dalej cisza
  | "in_crm"; // odpowiedział — żyje już jako rozmowa

export const STAGE_LABELS: Record<BlitzStage, string> = {
  todo: "Do wysłania",
  waiting: "Czeka na odpowiedź",
  followup_due: "Follow-up dziś",
  followed_up: "Po follow-upie",
  in_crm: "Rozmowa",
};

export function blitzStage(row: CrmDmBlitz, nowMs: number): BlitzStage {
  if (row.lead_id) return "in_crm";
  if (!row.sent_at) return "todo";
  if (row.followup_sent_at) return "followed_up";
  const silenceMs = nowMs - Date.parse(row.sent_at);
  return silenceMs >= FOLLOWUP_AFTER_DAYS * 86_400_000 ? "followup_due" : "waiting";
}

export function countFollowupsDue(rows: CrmDmBlitz[], nowMs: number): number {
  return rows.filter((r) => blitzStage(r, nowMs) === "followup_due").length;
}

export function blitzCounts(rows: CrmDmBlitz[], nowMs: number): Record<BlitzStage, number> {
  const counts: Record<BlitzStage, number> = {
    todo: 0,
    waiting: 0,
    followup_due: 0,
    followed_up: 0,
    in_crm: 0,
  };
  for (const r of rows) counts[blitzStage(r, nowMs)] += 1;
  return counts;
}

/** Prefiks w dm_text oznaczający spersonalizowany hook (reszta DM-a z szablonu niszy). */
export const HOOK_PREFIX = "HOOK:";

export function customHookOf(row: Pick<CrmDmBlitz, "dm_text">): string | null {
  const t = row.dm_text?.trim() ?? "";
  return t.startsWith(HOOK_PREFIX) ? t.slice(HOOK_PREFIX.length).trim() || null : null;
}

/** Tekst pierwszego DM-a: szablon niszy z hookiem lokalu, jeśli research go dał. */
export function firstDmText(row: Pick<CrmDmBlitz, "niche" | "dm_text">): string {
  return firstDm(row.niche, customHookOf(row));
}

export function followupDmText(): string {
  return followupDm();
}

// Kolejność sekcji = kolejność uderzenia: od nisz o najwyższej częstotliwości
// wizyt (pizza piątkowa, kawa codzienna) do ogólnych restauracji.
export const BLITZ_NICHE_ORDER = [
  "pizza",
  "burgery",
  "kebab/street food",
  "kawiarnia",
  "cukiernia/lody",
  "sniadania/brunch",
  "sushi/azja",
  "boba/matcha",
  "vegan",
  "wloska",
  "restauracja",
] as const;

export const BLITZ_NICHE_LABELS: Record<string, string> = {
  pizza: "Pizza",
  burgery: "Burgery",
  "kebab/street food": "Kebab i street food",
  kawiarnia: "Kawiarnie",
  "cukiernia/lody": "Cukiernie, lody, piekarnie",
  "sniadania/brunch": "Śniadania i brunch",
  "sushi/azja": "Sushi i Azja",
  "boba/matcha": "Boba i matcha",
  vegan: "Vegan",
  wloska: "Włoskie",
  restauracja: "Restauracje",
};

export function blitzNicheLabel(niche: string): string {
  return BLITZ_NICHE_LABELS[niche] ?? niche;
}

const NICHE_INDEX = new Map<string, number>(BLITZ_NICHE_ORDER.map((n, i) => [n, i]));

/** Porządek uderzenia: nisza wg listy, w niszy większe profile pierwsze. */
export function compareBlitz(a: CrmDmBlitz, b: CrmDmBlitz): number {
  return (
    (NICHE_INDEX.get(a.niche) ?? 99) - (NICHE_INDEX.get(b.niche) ?? 99) ||
    (b.followers ?? 0) - (a.followers ?? 0) ||
    a.name.localeCompare(b.name, "pl")
  );
}

export type BlitzGroup = {
  niche: string;
  label: string;
  rows: CrmDmBlitz[];
  sent: number;
};

/**
 * Grupuje wpisy po niszy w kolejności uderzenia; w grupie najpierw największe
 * profile (followers malejąco). Nisze spoza znanej listy lądują na końcu.
 */
export function groupBlitzByNiche(rows: CrmDmBlitz[]): BlitzGroup[] {
  const byNiche = new Map<string, CrmDmBlitz[]>();
  for (const row of rows) {
    const list = byNiche.get(row.niche);
    if (list) list.push(row);
    else byNiche.set(row.niche, [row]);
  }
  const niches = [...byNiche.keys()].sort(
    (a, b) => (NICHE_INDEX.get(a) ?? 99) - (NICHE_INDEX.get(b) ?? 99) || a.localeCompare(b, "pl"),
  );
  return niches.map((niche) => {
    const list = byNiche.get(niche)!;
    list.sort(compareBlitz);
    return {
      niche,
      label: blitzNicheLabel(niche),
      rows: list,
      sent: list.filter((r) => r.sent_at !== null).length,
    };
  });
}

export function blitzProgress(rows: CrmDmBlitz[]): { sent: number; total: number } {
  return { sent: rows.filter((r) => r.sent_at !== null).length, total: rows.length };
}

/** "A" dla Adama, "O" dla Oliwiera — inicjał z e-maila do plakietki "kto wysłał". */
export function senderInitial(email: string | null): string | null {
  if (!email) return null;
  const first = email.trim()[0];
  return first ? first.toUpperCase() : null;
}

// ----------------------------------------------------------------------------
// Kolejka na dziś
// ----------------------------------------------------------------------------

/** DM-y #1 wysłane danego dnia (YYYY-MM-DD wg Warszawy) przez daną osobę. */
export function sentTodayBy(
  rows: CrmDmBlitz[],
  email: string,
  today: string,
  warsawDay: (iso: string) => string,
): CrmDmBlitz[] {
  const me = email.toLowerCase();
  return rows
    .filter((r) => r.sent_at && r.sent_by?.toLowerCase() === me && warsawDay(r.sent_at) === today)
    .sort((a, b) => (a.sent_at ?? "").localeCompare(b.sent_at ?? ""));
}

/**
 * Kolejka nowych DM-ów na dziś: to, co już wysłałem dziś (odhaczone, u góry)
 * + kolejne lokale do wysłania w porządku uderzenia, razem do `limit`.
 */
export function dailyQueue(
  rows: CrmDmBlitz[],
  nowMs: number,
  email: string,
  today: string,
  warsawDay: (iso: string) => string,
  limit: number = DAILY_DM_LIMIT,
): { done: CrmDmBlitz[]; next: CrmDmBlitz[] } {
  const done = sentTodayBy(rows, email, today, warsawDay);
  const room = Math.max(0, limit - done.length);
  const next = rows
    .filter((r) => blitzStage(r, nowMs) === "todo")
    .sort(compareBlitz)
    .slice(0, room);
  return { done, next };
}

/** Wszystkie lokale bez wysłanego DM-a, w porządku uderzenia (kolejka bez limitu). */
export function todoQueue(rows: CrmDmBlitz[], nowMs: number): CrmDmBlitz[] {
  return rows.filter((r) => blitzStage(r, nowMs) === "todo").sort(compareBlitz);
}

/** Follow-upy, które wypadły: najdłużej czekające pierwsze. */
export function followupQueue(rows: CrmDmBlitz[], nowMs: number): CrmDmBlitz[] {
  return rows
    .filter((r) => blitzStage(r, nowMs) === "followup_due")
    .sort((a, b) => (a.sent_at ?? "").localeCompare(b.sent_at ?? ""));
}
