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
import type { CrmActivity, CrmLead, CrmSettings, CrmStageHistory } from "./types";

function parseLead(row: CrmLead): CrmLead {
  return {
    ...row,
    monthly_revenue: row.monthly_revenue === null ? null : Number(row.monthly_revenue),
    google_rating: row.google_rating === null ? null : Number(row.google_rating),
  };
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
  if (error) throw new Error(`Błąd bazy przy odczycie rozmowy: ${error.message}`);
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

export async function getSettings(): Promise<CrmSettings> {
  const db = getServiceClient();
  const { data, error } = await db.from("crm_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Błąd bazy przy odczycie ustawień: ${error.message}`);
  if (!data) {
    throw new Error(
      "Brak wiersza crm_settings — uruchom supabase/migration-001-core.sql (patrz supabase/README.md).",
    );
  }
  return data as CrmSettings;
}

/**
 * Kandydaci na duplikaty dla podanych kluczy — przy tworzeniu rozmowy,
 * awansie z Bazy i w webhooku z landingu. Zwraca leady pasujące do
 * KTÓREGOKOLWIEK klucza.
 */
export async function findDuplicateCandidates(keys: {
  normalized_name?: string | null;
  phone?: string | null;
  domain?: string | null;
  instagram?: string | null;
}): Promise<CrmLead[]> {
  const db = getServiceClient();
  const found = new Map<string, CrmLead>();
  const collect = async (q: PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
    const { data, error } = await q;
    if (error) throw new Error(`Błąd bazy przy szukaniu duplikatów: ${error.message}`);
    for (const row of (data ?? []) as CrmLead[]) found.set(row.id, parseLead(row));
  };

  if (keys.normalized_name) {
    await collect(db.from("crm_leads").select("*").eq("normalized_name", keys.normalized_name).limit(20));
  }
  if (keys.phone) {
    await collect(db.from("crm_leads").select("*").eq("phone", keys.phone).limit(20));
  }
  if (keys.instagram) {
    await collect(db.from("crm_leads").select("*").eq("instagram", keys.instagram).limit(20));
  }
  if (keys.domain) {
    // www przechowujemy z https://, więc porównanie po fragmencie domeny.
    await collect(db.from("crm_leads").select("*").ilike("www", `%${keys.domain}%`).limit(20));
  }
  return [...found.values()];
}

// ----------------------------------------------------------------------------
// Baza lokali (crm_dm_blitz)
// ----------------------------------------------------------------------------

export async function listDmBlitz(): Promise<CrmDmBlitz[]> {
  const db = getServiceClient();
  // Kolejność nadaje compareBlitz/groupBlitzByNiche — baza sortuje tylko stabilnie.
  return selectAll<CrmDmBlitz>(db, "crm_dm_blitz", {
    orderBy: { column: "instagram", ascending: true },
  });
}

/** Wpis Bazy powiązany z rozmową (skąd przyszła, kiedy poszedł DM). */
export async function getBlitzForLead(leadId: string): Promise<CrmDmBlitz | null> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("crm_dm_blitz")
    .select("*")
    .eq("lead_id", leadId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Błąd bazy przy odczycie Bazy: ${error.message}`);
  return (data as CrmDmBlitz) ?? null;
}
