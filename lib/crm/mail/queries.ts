import "server-only";

// Odczyty modułu Maile. Jak queries.ts: service role, selectAll, błędy głośno.

import { getServiceClient } from "@/lib/supabase/service";
import { selectAll } from "@/lib/db";
import { warsawDateOf, warsawToday } from "../dates";
import type { CrmMailEvent, CrmMailRow, CrmMailSettings } from "./types";

export async function listMailQueue(): Promise<CrmMailRow[]> {
  const db = getServiceClient();
  return selectAll<CrmMailRow>(db, "crm_mail_queue", {
    orderBy: { column: "created_at", ascending: true },
  });
}

/** Tylko wiersze, które cron może dziś ruszyć (bez czarnej listy i zamkniętych). */
export async function listMailActionable(): Promise<CrmMailRow[]> {
  const db = getServiceClient();
  return selectAll<CrmMailRow>(db, "crm_mail_queue", {
    filter: (q) => q.in("status", ["oczekuje", "wyslany", "followup", "blad"]),
    orderBy: { column: "created_at", ascending: true },
  });
}

export async function getMailRow(id: string): Promise<CrmMailRow | null> {
  const db = getServiceClient();
  const { data, error } = await db.from("crm_mail_queue").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Błąd bazy przy odczycie maila: ${error.message}`);
  return (data as CrmMailRow) ?? null;
}

export async function getMailRowByEmail(email: string): Promise<CrmMailRow | null> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("crm_mail_queue")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`Błąd bazy przy odczycie maila: ${error.message}`);
  return (data as CrmMailRow) ?? null;
}

export async function getMailForLead(leadId: string): Promise<CrmMailRow | null> {
  const db = getServiceClient();
  const { data, error } = await db.from("crm_mail_queue").select("*").eq("lead_id", leadId).limit(1).maybeSingle();
  if (error) throw new Error(`Błąd bazy przy odczycie maila: ${error.message}`);
  return (data as CrmMailRow) ?? null;
}

export async function getMailSettings(): Promise<CrmMailSettings> {
  const db = getServiceClient();
  const { data, error } = await db.from("crm_mail_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Błąd bazy przy odczycie ustawień maili: ${error.message}`);
  if (!data) {
    throw new Error("Brak wiersza crm_mail_settings — uruchom supabase/migration-006-maile.sql.");
  }
  return data as CrmMailSettings;
}

/** Ostatnie zdarzenia (dziennik na ekranie Maile). */
export async function listMailEvents(limit = 200): Promise<CrmMailEvent[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("crm_mail_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Błąd bazy przy odczycie zdarzeń: ${error.message}`);
  return (data ?? []) as CrmMailEvent[];
}

export interface TodayStats {
  today: string;
  sent: number;
  byMailbox: Record<string, number>;
  domains: Set<string>;
}

/** Ile poszło DZIŚ (dzień warszawski) — z dziennika, nie z pamięci procesu. */
export async function todayStats(now: Date = new Date()): Promise<TodayStats> {
  const db = getServiceClient();
  const today = warsawToday(now);
  // 36 h wstecz pokrywa każdy dzień warszawski niezależnie od strefy serwera.
  const sinceIso = new Date(now.getTime() - 36 * 3_600_000).toISOString();
  const { data, error } = await db
    .from("crm_mail_events")
    .select("email, mailbox, created_at, kind")
    .eq("kind", "wyslano")
    .gte("created_at", sinceIso);
  if (error) throw new Error(`Błąd bazy przy liczeniu dzisiejszych maili: ${error.message}`);
  const stats: TodayStats = { today, sent: 0, byMailbox: {}, domains: new Set() };
  for (const ev of (data ?? []) as { email: string; mailbox: string | null; created_at: string }[]) {
    if (warsawDateOf(ev.created_at) !== today) continue;
    stats.sent += 1;
    if (ev.mailbox) stats.byMailbox[ev.mailbox] = (stats.byMailbox[ev.mailbox] ?? 0) + 1;
    const domain = ev.email.split("@")[1];
    if (domain) stats.domains.add(domain);
  }
  return stats;
}

/** Message-ID przychodzących wiadomości, które już przetworzyliśmy. */
export async function processedIncomingIds(sinceIso: string): Promise<Set<string>> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("crm_mail_events")
    .select("message_id")
    .in("kind", ["odpowiedz", "odbicie", "autoodpowiedz", "wypisanie", "nieznany"])
    .gte("created_at", sinceIso)
    .not("message_id", "is", null);
  if (error) throw new Error(`Błąd bazy przy odczycie przetworzonych wiadomości: ${error.message}`);
  return new Set(((data ?? []) as { message_id: string }[]).map((r) => r.message_id));
}
