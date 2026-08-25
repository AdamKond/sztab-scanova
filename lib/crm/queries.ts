import "server-only";

// Odczyty domeny CRM. Wyłącznie za service role, wywoływane z kodu, który
// wcześniej przeszedł requireStaff()/guardStaffAction().
//
// Zasady:
// - każdy błąd bazy leci wyjątkiem (rdzeń failuje głośno, KPI nie pokazuje 0),
// - każda lista przechodzi przez selectAll (paginacja ponad limit PostgREST),
// - pola numeric z PostgREST parsujemy na granicy (przychodzą jako stringi).

import { getServiceClient } from "@/lib/supabase/service";
import { selectAll } from "@/lib/db";
import type { CrmDmBlitz } from "./blitz";
import type {
  CrmActivity,
  CrmAdsLog,
  CrmBriefing,
  CrmContent,
  CrmLead,
  CrmNote,
  CrmPartner,
  CrmSettings,
  CrmStageHistory,
  CrmTask,
  CrmTemplate,
  SalesGoal,
} from "./types";

function parseLead(row: CrmLead): CrmLead {
  return {
    ...row,
    monthly_revenue: row.monthly_revenue === null ? null : Number(row.monthly_revenue),
    google_rating: row.google_rating === null ? null : Number(row.google_rating),
  };
}

function parseGoal(row: SalesGoal): SalesGoal {
  return { ...row, target_value: Number(row.target_value) };
}

export async function listLeads(): Promise<CrmLead[]> {
  const db = getServiceClient();
  const rows = await selectAll<CrmLead>(db, "crm_leads", {
    orderBy: { column: "updated_at", ascending: false },
  });
  return rows.map(parseLead);
}

export async function getLead(id: string): Promise<CrmLead | null> {
  const db = getServiceClient();
  const { data, error } = await db.from("crm_leads").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Błąd bazy przy odczycie leada: ${error.message}`);
  return data ? parseLead(data as CrmLead) : null;
}

export async function listActivities(leadId?: string): Promise<CrmActivity[]> {
  const db = getServiceClient();
  return selectAll<CrmActivity>(db, "crm_activities", {
    filter: leadId ? (q) => q.eq("lead_id", leadId) : undefined,
    orderBy: { column: "happened_at", ascending: false },
  });
}

export async function listStageHistory(leadId?: string): Promise<CrmStageHistory[]> {
  const db = getServiceClient();
  return selectAll<CrmStageHistory>(db, "crm_stage_history", {
    filter: leadId ? (q) => q.eq("lead_id", leadId) : undefined,
    orderBy: { column: "changed_at", ascending: true },
  });
}

export async function listTasks(): Promise<CrmTask[]> {
  const db = getServiceClient();
  return selectAll<CrmTask>(db, "crm_tasks", {
    orderBy: { column: "due_at", ascending: true },
  });
}

export async function listTasksForLead(leadId: string): Promise<CrmTask[]> {
  const db = getServiceClient();
  return selectAll<CrmTask>(db, "crm_tasks", {
    filter: (q) => q.eq("lead_id", leadId),
    orderBy: { column: "due_at", ascending: true },
  });
}

export async function listGoals(): Promise<SalesGoal[]> {
  const db = getServiceClient();
  const rows = await selectAll<SalesGoal>(db, "sales_goals", {
    orderBy: { column: "starts_on", ascending: false },
  });
  return rows.map(parseGoal);
}

export async function getSettings(): Promise<CrmSettings> {
  const db = getServiceClient();
  const { data, error } = await db.from("crm_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Błąd bazy przy odczycie ustawień: ${error.message}`);
  // Brak wiersza ustawień = niewykonana migracja. Failujemy głośno zamiast
  // po cichu przyjmować domyślne progi — to sygnał złej konfiguracji.
  if (!data) {
    throw new Error(
      "Brak wiersza crm_settings — uruchom supabase/migration-001-core.sql (patrz supabase/README.md).",
    );
  }
  return data as CrmSettings;
}

// ----------------------------------------------------------------------------
// Etapy 2–4: partnerzy, szablony, content, reklamy, odprawy
// ----------------------------------------------------------------------------

export async function listPartners(): Promise<CrmPartner[]> {
  const db = getServiceClient();
  return selectAll<CrmPartner>(db, "crm_partners", {
    orderBy: { column: "name", ascending: true },
  });
}

export async function listTemplates(): Promise<CrmTemplate[]> {
  const db = getServiceClient();
  return selectAll<CrmTemplate>(db, "crm_templates", {
    orderBy: { column: "step", ascending: true },
  });
}

export async function listContent(): Promise<CrmContent[]> {
  const db = getServiceClient();
  return selectAll<CrmContent>(db, "crm_content", {
    orderBy: { column: "created_at", ascending: false },
  });
}

export async function listAdsLog(): Promise<CrmAdsLog[]> {
  const db = getServiceClient();
  const rows = await selectAll<CrmAdsLog>(db, "crm_ads_log", {
    orderBy: { column: "log_date", ascending: false },
  });
  // numeric przychodzi jako string — parsujemy na granicy.
  return rows.map((r) => ({ ...r, spend: Number(r.spend) }));
}

export async function getBriefing(day: string): Promise<CrmBriefing | null> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("crm_briefings")
    .select("*")
    .eq("briefing_date", day)
    .maybeSingle();
  if (error) throw new Error(`Błąd bazy przy odczycie odprawy: ${error.message}`);
  return (data as CrmBriefing) ?? null;
}

/**
 * Kandydaci na duplikaty dla podanych kluczy — używane przy tworzeniu leada
 * i w imporcie. Porównujemy po znormalizowanej nazwie, telefonie, domenie
 * i Instagramie. Zwraca istniejące leady pasujące do KTÓREGOKOLWIEK klucza.
 */
export async function findDuplicateCandidates(keys: {
  normalized_name?: string | null;
  phone?: string | null;
  domain?: string | null;
  instagram?: string | null;
}): Promise<CrmLead[]> {
  const db = getServiceClient();
  const found = new Map<string, CrmLead>();

  if (keys.normalized_name) {
    const { data, error } = await db
      .from("crm_leads")
      .select("*")
      .eq("normalized_name", keys.normalized_name)
      .limit(20);
    if (error) throw new Error(`Błąd bazy przy szukaniu duplikatów: ${error.message}`);
    for (const row of (data ?? []) as CrmLead[]) found.set(row.id, parseLead(row));
  }
  if (keys.phone) {
    const { data, error } = await db.from("crm_leads").select("*").eq("phone", keys.phone).limit(20);
    if (error) throw new Error(`Błąd bazy przy szukaniu duplikatów: ${error.message}`);
    for (const row of (data ?? []) as CrmLead[]) found.set(row.id, parseLead(row));
  }
  if (keys.instagram) {
    const { data, error } = await db
      .from("crm_leads")
      .select("*")
      .eq("instagram", keys.instagram)
      .limit(20);
    if (error) throw new Error(`Błąd bazy przy szukaniu duplikatów: ${error.message}`);
    for (const row of (data ?? []) as CrmLead[]) found.set(row.id, parseLead(row));
  }
  if (keys.domain) {
    // www przechowujemy z https://, więc porównanie po fragmencie domeny.
    const { data, error } = await db
      .from("crm_leads")
      .select("*")
      .ilike("www", `%${keys.domain}%`)
      .limit(20);
    if (error) throw new Error(`Błąd bazy przy szukaniu duplikatów: ${error.message}`);
    for (const row of (data ?? []) as CrmLead[]) found.set(row.id, parseLead(row));
  }
  return [...found.values()];
}

// ----------------------------------------------------------------------------
// Whiteboard — tablica strategii
// ----------------------------------------------------------------------------

/**
 * Karty tablicy w kolejności wyświetlania: sort_order rosnąco, a przy remisie
 * created_at rosnąco (starsza karta wyżej).
 *
 * selectAll przyjmuje tylko jedną kolumnę w `orderBy`, a kolejność wywołań
 * .order() wyznacza priorytet sortowania — dlatego pierwszy klucz dokładamy
 * przez `filter`. Sortowanie musi zajść w bazie, bo lista jest stronicowana
 * i posortowanie dopiero w JS pomieszałoby wyniki między stronami.
 */
export async function listNotes(): Promise<CrmNote[]> {
  const db = getServiceClient();
  return selectAll<CrmNote>(db, "crm_notes", {
    filter: (q) => q.order("sort_order", { ascending: true }),
    orderBy: { column: "created_at", ascending: true },
  });
}

export async function listDmBlitz(): Promise<CrmDmBlitz[]> {
  const db = getServiceClient();
  // Kolejność nadaje groupBlitzByNiche — zasiew ma jeden created_at dla
  // wszystkich wierszy, więc sortowanie bazą nic tu nie wnosi.
  return selectAll<CrmDmBlitz>(db, "crm_dm_blitz", {
    orderBy: { column: "instagram", ascending: true },
  });
}
