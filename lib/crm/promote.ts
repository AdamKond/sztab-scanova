import "server-only";

// Wspólny rdzeń "odpowiedział": lokal z Bazy staje się rozmową (albo wraca do
// istniejącej). Używany przez server action (klik człowieka) i przez webhook
// odpowiedzi z Instagrama (ManyChat / Meta) — jedna logika, dwa wejścia.

import { getServiceClient } from "@/lib/supabase/service";
import { findDuplicateCandidates } from "./queries";
import { normalizeName } from "./normalize";
import type { CrmDmBlitz } from "./blitz";

export const REPLIED_NEXT_ACTION = "Odpisać i wysłać filmik";

export async function promoteBlitzRow(
  row: CrmDmBlitz,
  by: string,
  note: string,
): Promise<{ leadId: string; created: boolean }> {
  const db = getServiceClient();
  if (row.lead_id) return { leadId: row.lead_id, created: false };

  const now = new Date().toISOString();

  // Stare importy mają ten sam Instagram — podpinamy istniejący wpis zamiast dublować.
  const candidates = await findDuplicateCandidates({
    instagram: row.instagram,
    normalized_name: normalizeName(row.name),
  });
  const existing = candidates.find(
    (c) => c.instagram === row.instagram || c.normalized_name === normalizeName(row.name),
  );

  let leadId: string;
  let created = false;
  if (existing) {
    leadId = existing.id;
    const { error } = await db
      .from("crm_leads")
      .update({
        status: "proba_kontaktu",
        source: "ig_dm",
        source_detail: "odpowiedź na DM z Bazy",
        campaign: row.campaign,
        owner: existing.owner ?? by,
        next_action: REPLIED_NEXT_ACTION,
        next_action_at: null,
      })
      .eq("id", leadId);
    if (error) throw new Error(`Nie udało się wznowić rozmowy: ${error.message}`);
  } else {
    const { data: lead, error } = await db
      .from("crm_leads")
      .insert({
        name: row.name,
        normalized_name: normalizeName(row.name),
        category: row.niche,
        city: row.city,
        instagram: row.instagram,
        source: "ig_dm",
        source_detail: "odpowiedź na DM z Bazy",
        campaign: row.campaign,
        status: "proba_kontaktu",
        priority: "B",
        owner: by,
        next_action: REPLIED_NEXT_ACTION,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Nie udało się utworzyć rozmowy: ${error.message}`);
    leadId = lead.id;
    created = true;
  }

  await db.from("crm_activities").insert({
    lead_id: leadId,
    type: "ig_dm",
    outcome: "zainteresowany",
    note,
    created_by: by,
  });

  // Trigger zapisuje historię bez autora — uzupełniamy najświeższy wpis.
  const { data: h } = await db
    .from("crm_stage_history")
    .select("id")
    .eq("lead_id", leadId)
    .is("changed_by", null)
    .order("changed_at", { ascending: false })
    .limit(1);
  if (h && h.length > 0) await db.from("crm_stage_history").update({ changed_by: by }).eq("id", h[0].id);

  await db
    .from("crm_dm_blitz")
    .update({
      lead_id: leadId,
      // Odpowiedź implikuje wysyłkę — odhacz, jeśli ktoś kliknął tylko "odpowiedział".
      sent_at: row.sent_at ?? now,
      sent_by: row.sent_by ?? by,
    })
    .eq("id", row.id);

  return { leadId, created };
}
