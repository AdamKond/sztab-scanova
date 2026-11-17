// Planowanie wysyłki: co, kiedy i z której skrzynki. Czysty moduł (testy).
//
// Zasady (strategia 2026-11-17):
// - limit dzienny wspólny dla wszystkich skrzynek + limit per skrzynka
//   (Gmail/Workspace: 30–50 zimnych maili dziennie ze skrzynki to bezpieczny pułap),
// - rozgrzewka nowej domeny: start od małej liczby i +N dziennie,
// - okno wysyłki: dni robocze, godziny biurowe czasu Warszawy; cron poza
//   oknem nic nie wysyła (ale czyta skrzynki),
// - follow-upy (kroki 2 i 3) mają pierwszeństwo przed nowymi mailami i idą
//   z TEJ SAMEJ skrzynki, z której poszedł mail #1,
// - jeden mail dziennie na domenę odbiorcy (sieć z 5 adresami nie dostanie
//   5 maili w godzinę),
// - partia na jedno uruchomienie = reszta dnia / liczba uruchomień, które
//   zostały do końca okna — wysyłka rozkłada się równo na cały dzień.

import { addDays, daysBetween, warsawDateOf } from "../dates";
import type { CrmMailRow, CrmMailSettings, MailboxInfo } from "./types";

const WARSAW_TZ = "Europe/Warsaw";

const hourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: WARSAW_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  weekday: "short",
});

/** Godzina (z minutami jako ułamek) i dzień tygodnia (0 = niedziela) w Warszawie. */
export function warsawClock(now: Date): { hour: number; minute: number; weekday: number } {
  const parts = hourFormatter.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { hour, minute, weekday: wd };
}

/** Czy teraz jest okno wysyłki (dni robocze + godziny z ustawień). */
export function isSendWindow(settings: Pick<CrmMailSettings, "send_from_hour" | "send_to_hour" | "weekdays_only">, now: Date): boolean {
  const { hour, weekday } = warsawClock(now);
  if (settings.weekdays_only && (weekday === 0 || weekday === 6)) return false;
  return hour >= settings.send_from_hour && hour < settings.send_to_hour;
}

/**
 * Obowiązujący limit dzienny z uwzględnieniem rozgrzewki.
 * Dzień rozgrzewki 0 = warmup_start_limit, każdy kolejny dzień +warmup_step,
 * aż do daily_limit. Liczymy dni kalendarzowe (weekendy też), bo filtry
 * patrzą na wiek domeny, nie na dni robocze.
 */
export function effectiveDailyLimit(
  settings: Pick<CrmMailSettings, "daily_limit" | "warmup_start" | "warmup_start_limit" | "warmup_step">,
  today: string,
): number {
  if (!settings.warmup_start) return settings.daily_limit;
  const day = daysBetween(settings.warmup_start, today);
  if (day < 0) return 0; // rozgrzewka jeszcze się nie zaczęła
  return Math.min(settings.daily_limit, settings.warmup_start_limit + day * settings.warmup_step);
}

/** Ile uruchomień crona zostało do końca okna (łącznie z bieżącym). */
export function runsLeftToday(settings: Pick<CrmMailSettings, "send_to_hour">, now: Date, cronMinutes: number): number {
  const { hour, minute } = warsawClock(now);
  const minutesLeft = settings.send_to_hour * 60 - (hour * 60 + minute);
  if (minutesLeft <= 0) return 0;
  return Math.max(1, Math.ceil(minutesLeft / cronMinutes));
}

/** Wielkość partii na to uruchomienie: równy podział reszty dnia. */
export function batchSize(remainingToday: number, runsLeft: number): number {
  if (remainingToday <= 0 || runsLeft <= 0) return 0;
  return Math.max(1, Math.ceil(remainingToday / runsLeft));
}

export type PlannedStep = 1 | 2 | 3;

export interface PlannedSend {
  row: CrmMailRow;
  step: PlannedStep;
  mailbox: string;
}

export interface PlanInput {
  rows: CrmMailRow[];
  settings: CrmMailSettings;
  now: Date;
  /** Ile maili (wszystkich kroków) poszło dziś ze wszystkich skrzynek. */
  sentToday: number;
  /** Ile poszło dziś z każdej skrzynki (klucz = adres skrzynki). */
  sentTodayByMailbox: Record<string, number>;
  /** Domeny odbiorców, które dziś już coś dostały. */
  domainsToday: Set<string>;
  mailboxes: MailboxInfo[];
  cronMinutes: number;
}

/** Który krok sekwencji jest dla wiersza "do wysłania" dziś (albo null). */
export function dueStep(
  row: CrmMailRow,
  settings: Pick<CrmMailSettings, "followup_after_days" | "last_after_days">,
  today: string,
): PlannedStep | null {
  if (row.status === "oczekuje") return 1;
  if (row.status === "blad") {
    // Ponawiamy ten sam krok, który się nie udał (do 3 prób).
    if (row.attempts >= 3) return null;
    const next = (row.step + 1) as number;
    return next >= 1 && next <= 3 ? (next as PlannedStep) : null;
  }
  if (row.status === "wyslany" && row.sent_at) {
    return daysBetween(warsawDateOf(row.sent_at), today) >= settings.followup_after_days ? 2 : null;
  }
  if (row.status === "followup" && row.sent_at) {
    return daysBetween(warsawDateOf(row.sent_at), today) >= settings.last_after_days ? 3 : null;
  }
  return null;
}

/**
 * Plan partii na to uruchomienie. Nie dotyka bazy — dostaje liczby i wiersze,
 * zwraca listę (wiersz, krok, skrzynka). Kolejność: krok 3 → krok 2 → krok 1,
 * w każdej grupie najstarsze pierwsze.
 */
export function planBatch(input: PlanInput): PlannedSend[] {
  const { settings, now, mailboxes } = input;
  if (settings.paused) return [];
  if (!isSendWindow(settings, now)) return [];
  if (mailboxes.length === 0) return [];

  const today = warsawDateOf(now);
  const limit = effectiveDailyLimit(settings, today);
  const remaining = limit - input.sentToday;
  const size = batchSize(remaining, runsLeftToday(settings, now, input.cronMinutes));
  if (size <= 0) return [];

  const mailboxRoom = new Map<string, number>();
  for (const m of mailboxes) {
    mailboxRoom.set(m.email, Math.max(0, m.dailyCap - (input.sentTodayByMailbox[m.email] ?? 0)));
  }
  const domainsUsed = new Set(input.domainsToday);

  const candidates: { row: CrmMailRow; step: PlannedStep; sortKey: string }[] = [];
  for (const row of input.rows) {
    const step = dueStep(row, settings, today);
    if (!step) continue;
    // Krok 1 sortujemy po created_at (FIFO), follow-upy po sent_at (najdłużej czekające pierwsze).
    const sortKey = step === 1 ? row.created_at : row.sent_at ?? row.created_at;
    candidates.push({ row, step, sortKey });
  }
  candidates.sort((a, b) => b.step - a.step || a.sortKey.localeCompare(b.sortKey) || a.row.id.localeCompare(b.row.id));

  const planned: PlannedSend[] = [];
  for (const c of candidates) {
    if (planned.length >= size) break;
    if (domainsUsed.has(c.row.domain)) continue;

    let mailbox: string | null = null;
    if (c.step > 1 && c.row.mailbox) {
      // Follow-up z tej samej skrzynki — jeśli dziś już wyczerpana, poczeka.
      if ((mailboxRoom.get(c.row.mailbox) ?? 0) > 0) mailbox = c.row.mailbox;
    } else {
      // Nowy mail: skrzynka z największym zapasem (równe obciążenie).
      let best: string | null = null;
      let bestRoom = 0;
      for (const [email, room] of mailboxRoom) {
        if (room > bestRoom) {
          best = email;
          bestRoom = room;
        }
      }
      mailbox = best;
    }
    if (!mailbox) continue;

    mailboxRoom.set(mailbox, (mailboxRoom.get(mailbox) ?? 0) - 1);
    domainsUsed.add(c.row.domain);
    planned.push({ row: c.row, step: c.step, mailbox });
  }
  return planned;
}

/** Statystyki kolejki do kafelków na ekranie Maile. */
export function mailCounts(rows: CrmMailRow[]): Record<CrmMailRow["status"], number> & { total: number } {
  const c = {
    total: rows.length,
    oczekuje: 0,
    wyslany: 0,
    followup: 0,
    zamkniety: 0,
    odpowiedzial: 0,
    odbil: 0,
    skarga: 0,
    wypisany: 0,
    wstrzymany: 0,
    blad: 0,
  };
  for (const r of rows) c[r.status] += 1;
  return c;
}

/** Ile maili #1 wyszło (dowolny status po wysyłce) — mianownik skuteczności. */
export function contactedCount(rows: CrmMailRow[]): number {
  return rows.filter((r) => r.sent_at !== null).length;
}

/** Prognoza: ile dni kolejki zostało przy obecnym limicie. */
export function daysOfQueue(rows: CrmMailRow[], dailyLimit: number): number | null {
  if (dailyLimit <= 0) return null;
  const waiting = rows.filter((r) => r.status === "oczekuje").length;
  return Math.ceil(waiting / dailyLimit);
}

/** Dzień, w którym rozgrzewka osiągnie pełny limit. */
export function warmupFullDay(settings: Pick<CrmMailSettings, "daily_limit" | "warmup_start" | "warmup_start_limit" | "warmup_step">): string | null {
  if (!settings.warmup_start) return null;
  const days = Math.max(0, Math.ceil((settings.daily_limit - settings.warmup_start_limit) / settings.warmup_step));
  return addDays(settings.warmup_start, days);
}
