"use server";

// Mutacje domeny CRM. KAŻDA akcja zaczyna się od guardStaffAction() —
// Server Actions to publiczne endpointy HTTP, więc żadnych wyjątków.
// Autor (owner/created_by/changed_by) pochodzi WYŁĄCZNIE z sesji,
// nigdy z formularza.

import { revalidatePath } from "next/cache";
import { guardStaffAction } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { findDuplicateCandidates, getLead } from "./queries";
import {
  isActivityType,
  isLeadSource,
  parseMoney,
  parsePositiveInt,
  validateStatusChange,
  warsawLocalToIso,
  LIMITS,
} from "./validation";
import { clampText, normalizeInstagram, normalizeName, normalizePhone } from "./normalize";
import { STEP_STATUS, type Step } from "./steps";
import { NICHES } from "./dm-copy";
import { addDays, warsawToday } from "./dates";
import { promoteBlitzRow, REPLIED_NEXT_ACTION } from "./promote";
import { HOOK_PREFIX, type CrmDmBlitz } from "./blitz";

export interface ActionResult {
  error?: string;
  ok?: boolean;
  /** id utworzonego/znalezionego rekordu, gdy dotyczy */
  id?: string;
  /** krótka informacja zwrotna (np. ile wierszy dodano) */
  info?: string;
}

function text(formData: FormData, key: string, max: number = LIMITS.shortText): string | null {
  const v = formData.get(key);
  return typeof v === "string" ? clampText(v, max) : null;
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

/**
 * Trigger w bazie zapisuje historię etapów bez autora (działa z service role
 * i nie zna sesji). Uzupełniamy changed_by w najświeższym wpisie bez autora
 * zaraz po zmianie — przy 2 użytkownikach wyścig jest teoretyczny.
 */
async function backfillHistoryAuthor(leadId: string, email: string): Promise<void> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("crm_stage_history")
    .select("id")
    .eq("lead_id", leadId)
    .is("changed_by", null)
    .order("changed_at", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return;
  await db.from("crm_stage_history").update({ changed_by: email }).eq("id", data[0].id);
}

// Następny krok wpisywany automatycznie przy przejściu — człowiek może nadpisać.
const STEP_NEXT_ACTION: Record<Step, string | null> = {
  odpisal: REPLIED_NEXT_ACTION,
  rozmawia: "Umówić wizytę (5 min)",
  wizyta: "Wizyta i demo na miejscu",
  demo: "Domknąć pilot",
  pilot: "Check-in pilota",
  klient: null,
  pozniej: "Wrócić do tematu",
  nie: null,
  rezygnacja: null,
};

// ----------------------------------------------------------------------------
// Rozmowy
// ----------------------------------------------------------------------------

/** Nowa rozmowa spoza Bazy (telefon, wizyta w terenie, polecenie). */
export async function createConversation(formData: FormData): Promise<ActionResult> {
  const user = await guardStaffAction();
  const name = text(formData, "name", LIMITS.name);
  if (!name) return { error: "Nazwa lokalu jest wymagana." };
  const sourceRaw = formData.get("source");
  const source = isLeadSource(sourceRaw) ? sourceRaw : "teren";
  const instagram = normalizeInstagram(text(formData, "instagram"));
  const phone = normalizePhone(text(formData, "phone"));
  const city = text(formData, "city");
  const normalized = normalizeName(name);

  // Ten sam lokal drugi raz to nie nowa rozmowa — wracamy do istniejącej.
  const candidates = await findDuplicateCandidates({ normalized_name: normalized, instagram, phone });
  const certain = candidates.find(
    (c) =>
      (instagram && c.instagram === instagram) ||
      (phone && c.phone === phone) ||
      (c.normalized_name === normalized && (!city || !c.city || c.city.toLowerCase() === city.toLowerCase())),
  );
  if (certain) return { ok: true, id: certain.id, info: "Ten lokal już jest w Sztabie." };

  const email = user.email!.toLowerCase();
  const step: Step = source === "ig_dm" ? "odpisal" : "rozmawia";
  const db = getServiceClient();
  const { data, error } = await db
    .from("crm_leads")
    .insert({
      name,
      normalized_name: normalized,
      category: text(formData, "category"),
      city,
      instagram,
      phone,
      decision_maker_name: text(formData, "decision_maker_name"),
      source,
      status: STEP_STATUS[step],
      priority: "B",
      owner: email,
      next_action: STEP_NEXT_ACTION[step],
      notes: text(formData, "notes", LIMITS.notes),
    })
    .select("id")
    .single();
  if (error) return { error: `Nie udało się dodać rozmowy: ${error.message}` };

  await backfillHistoryAuthor(data.id, email);
  revalidateAll();
  return { ok: true, id: data.id };
}

/** Dane kontaktowe rozmowy — mały formularz na karcie, bez 20 pól ICP. */
export async function updateLeadBasics(leadId: string, formData: FormData): Promise<ActionResult> {
  await guardStaffAction();
  const name = text(formData, "name", LIMITS.name);
  if (!name) return { error: "Nazwa lokalu jest wymagana." };
  const db = getServiceClient();
  const { error } = await db
    .from("crm_leads")
    .update({
      name,
      normalized_name: normalizeName(name),
      instagram: normalizeInstagram(text(formData, "instagram")),
      phone: normalizePhone(text(formData, "phone")),
      city: text(formData, "city"),
      category: text(formData, "category"),
      decision_maker_name: text(formData, "decision_maker_name"),
    })
    .eq("id", leadId);
  if (error) return { error: `Nie udało się zapisać: ${error.message}` };
  revalidateAll();
  return { ok: true };
}

/**
 * JEDYNA ścieżka zmiany kroku (statusu). Egzekwuje reguły przejść:
 * pilot wymaga dat, płatny klient wymaga daty + planu + MRR, "nie" wymaga powodu.
 * Ustawia też sensowny następny krok, żeby rozmowa nie znikała z Dziś.
 */
export async function advanceStep(leadId: string, formData: FormData): Promise<ActionResult> {
  const user = await guardStaffAction();
  const stepRaw = formData.get("step");
  if (typeof stepRaw !== "string" || !(stepRaw in STEP_STATUS)) return { error: "Nieznany krok." };
  const step = stepRaw as Step;
  const target = STEP_STATUS[step];

  const lead = await getLead(leadId);
  if (!lead) return { error: "Rozmowa nie istnieje." };

  const updates: Record<string, unknown> = {};
  const today = warsawToday();

  if (step === "pilot") {
    // Domyślnie miesiąc od dziś — formularz może nadpisać.
    updates.pilot_started_at = warsawLocalToIso(formData.get("pilot_started_at")) ?? warsawLocalToIso(today);
    updates.pilot_ends_at =
      warsawLocalToIso(formData.get("pilot_ends_at")) ?? warsawLocalToIso(addDays(today, 30));
  }
  if (step === "klient") {
    updates.paid_at = warsawLocalToIso(formData.get("paid_at")) ?? warsawLocalToIso(today);
    const plan = text(formData, "plan");
    const mrr = parseMoney(formData.get("monthly_revenue"));
    if (plan !== null) updates.plan = plan;
    if (mrr !== null) updates.monthly_revenue = mrr;
  }
  if (step === "nie" || step === "rezygnacja") {
    const reason = text(formData, "lost_reason", LIMITS.note);
    if (reason !== null) updates.lost_reason = reason;
  }
  if (step === "rezygnacja") {
    updates.churned_at = warsawLocalToIso(formData.get("churned_at")) ?? warsawLocalToIso(today);
  }

  const missing = validateStatusChange(lead, target, updates);
  if (missing.length > 0) return { error: missing.join(" ") };

  const nextAt = warsawLocalToIso(formData.get("next_action_at"));
  if (step === "pozniej" && !nextAt) return { error: "Podaj datę, kiedy wrócić do tematu." };
  const nextAction = text(formData, "next_action") ?? STEP_NEXT_ACTION[step];

  const db = getServiceClient();
  const { error } = await db
    .from("crm_leads")
    .update({
      ...updates,
      ...(lead.status !== target ? { status: target } : {}),
      next_action: nextAction,
      // Pilot: pierwszy check-in za tydzień. Inne kroki: data z formularza albo brak (= dziś na Dziś).
      next_action_at: nextAt ?? (step === "pilot" ? warsawLocalToIso(addDays(today, 7)) : null),
    })
    .eq("id", leadId);
  if (error) return { error: `Nie udało się zmienić kroku: ${error.message}` };

  await backfillHistoryAuthor(leadId, user.email!);
  revalidateAll();
  return { ok: true };
}

export async function setNextAction(leadId: string, formData: FormData): Promise<ActionResult> {
  await guardStaffAction();
  const db = getServiceClient();
  const { error } = await db
    .from("crm_leads")
    .update({
      next_action: text(formData, "next_action"),
      next_action_at: warsawLocalToIso(formData.get("next_action_at")),
    })
    .eq("id", leadId);
  if (error) return { error: `Nie udało się zapisać następnego kroku: ${error.message}` };
  revalidateAll();
  return { ok: true };
}

export async function updateLeadNotes(leadId: string, formData: FormData): Promise<ActionResult> {
  await guardStaffAction();
  const db = getServiceClient();
  const { error } = await db
    .from("crm_leads")
    .update({ notes: text(formData, "notes", LIMITS.notes) })
    .eq("id", leadId);
  if (error) return { error: `Nie udało się zapisać notatek: ${error.message}` };
  revalidateAll();
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Aktywności — "co się wydarzyło"
// ----------------------------------------------------------------------------

export async function addActivity(formData: FormData): Promise<ActionResult> {
  const user = await guardStaffAction();
  const typeRaw = formData.get("type");
  if (!isActivityType(typeRaw)) return { error: "Nieznany typ wpisu." };
  const leadId = text(formData, "lead_id");
  if (!leadId) return { error: "Brak rozmowy." };

  const db = getServiceClient();
  const { error } = await db.from("crm_activities").insert({
    lead_id: leadId,
    type: typeRaw,
    note: text(formData, "note", LIMITS.note),
    created_by: user.email!.toLowerCase(),
  });
  if (error) return { error: `Nie udało się zapisać wpisu: ${error.message}` };

  // Opcjonalny następny krok w tym samym formularzu — wpis ma w <10 s
  // zostawić rozmowę w stanie "wiadomo, co dalej".
  const nextAction = text(formData, "next_action");
  const nextActionAt = warsawLocalToIso(formData.get("next_action_at"));
  if (nextAction || nextActionAt) {
    const { error: nextErr } = await db
      .from("crm_leads")
      .update({
        ...(nextAction ? { next_action: nextAction } : {}),
        next_action_at: nextActionAt,
      })
      .eq("id", leadId);
    if (nextErr) return { error: `Wpis zapisany, ale następny krok nie: ${nextErr.message}` };
  }

  revalidateAll();
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Baza lokali i kolejka DM (crm_dm_blitz)
// ----------------------------------------------------------------------------

export async function setDmSent(blitzId: string, sent: boolean): Promise<ActionResult> {
  const user = await guardStaffAction();
  const db = getServiceClient();
  const updates = sent
    ? { sent_at: new Date().toISOString(), sent_by: user.email!.toLowerCase() }
    : { sent_at: null, sent_by: null };
  const { error } = await db.from("crm_dm_blitz").update(updates).eq("id", blitzId);
  if (error) return { error: `Nie udało się zapisać: ${error.message}` };
  if (!sent) {
    // Cofnięcie DM-a #1 cofa też follow-up. Osobne zapytanie: bez migracji 005
    // tych kolumn nie ma i nie może to blokować samego cofnięcia.
    await db
      .from("crm_dm_blitz")
      .update({ followup_sent_at: null, followup_sent_by: null })
      .eq("id", blitzId);
  }
  revalidateAll();
  return { ok: true };
}

export async function setDmFollowup(blitzId: string, sent: boolean): Promise<ActionResult> {
  const user = await guardStaffAction();
  const db = getServiceClient();
  if (sent) {
    const { data, error } = await db.from("crm_dm_blitz").select("sent_at").eq("id", blitzId).maybeSingle();
    if (error) return { error: `Błąd bazy: ${error.message}` };
    if (!data) return { error: "Nie znaleziono lokalu." };
    if (!data.sent_at) return { error: "Najpierw wyślij pierwszy DM." };
  }
  const updates = sent
    ? { followup_sent_at: new Date().toISOString(), followup_sent_by: user.email!.toLowerCase() }
    : { followup_sent_at: null, followup_sent_by: null };
  const { error } = await db.from("crm_dm_blitz").update(updates).eq("id", blitzId);
  if (error) {
    if (/followup_sent_at/.test(error.message)) {
      return { error: "Baza nie ma jeszcze kolumn follow-upu — uruchom supabase/migration-005-lejek-dm.sql w SQL Editorze Supabase." };
    }
    return { error: `Nie udało się zapisać: ${error.message}` };
  }
  revalidateAll();
  return { ok: true };
}

/** "Odpowiedział" — lokal z Bazy staje się rozmową (albo wraca do istniejącej). */
export async function promoteDmToLead(blitzId: string): Promise<ActionResult> {
  const user = await guardStaffAction();
  const db = getServiceClient();
  const { data: row, error } = await db.from("crm_dm_blitz").select("*").eq("id", blitzId).maybeSingle();
  if (error) return { error: `Błąd bazy: ${error.message}` };
  if (!row) return { error: "Nie znaleziono lokalu." };

  try {
    const { leadId } = await promoteBlitzRow(row as CrmDmBlitz, user.email!.toLowerCase(), "Odpowiedział na DM z Bazy.");
    revalidateAll();
    return { ok: true, id: leadId };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

function campaignForToday(): string {
  return `baza-${warsawToday().slice(0, 7)}`;
}

type LokalInput = {
  name: string;
  city: string | null;
  niche: string;
  instagram: string;
  followers: number | null;
  /** "HOOK: ..." albo "" — patrz customHookOf w blitz.ts. */
  dm_text: string;
};

function parseLokalLine(line: string): LokalInput | null {
  // Format linii: @instagram | Nazwa | Miasto | nisza | obserwujący | hook  (kolejne pola opcjonalne)
  const parts = line
    .split(/\s*[|;\t]\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return null;
  const instagram = normalizeInstagram(parts[0]);
  if (!instagram) return null;
  const name = clampText(parts[1] ?? instagram, LIMITS.name) ?? instagram;
  const city = clampText(parts[2] ?? "", LIMITS.shortText);
  const nicheRaw = (parts[3] ?? "").toLowerCase();
  const niche = NICHES.includes(nicheRaw) ? nicheRaw : "restauracja";
  const followersRaw = Number((parts[4] ?? "").replace(/\s/g, ""));
  const followers = Number.isFinite(followersRaw) && followersRaw > 0 ? Math.round(followersRaw) : null;
  const hook = clampText(parts[5] ?? "", 200);
  return { name, city, niche, instagram, followers, dm_text: hook ? `${HOOK_PREFIX} ${hook}` : "" };
}

async function insertLokale(items: LokalInput[]): Promise<{ added: number; skipped: string[] }> {
  const db = getServiceClient();
  const campaign = campaignForToday();
  let added = 0;
  const skipped: string[] = [];
  for (const it of items) {
    // Wiersz po wierszu, żeby jeden duplikat (unikalny instagram) nie zablokował całej wklejki.
    const { error } = await db.from("crm_dm_blitz").insert({ ...it, campaign });
    if (error) skipped.push(`@${it.instagram}`);
    else added += 1;
  }
  return { added, skipped };
}

export async function addLokal(formData: FormData): Promise<ActionResult> {
  await guardStaffAction();
  const instagram = normalizeInstagram(text(formData, "instagram"));
  if (!instagram) return { error: "Instagram lokalu jest wymagany." };
  const name = text(formData, "name", LIMITS.name) ?? instagram;
  const nicheRaw = (text(formData, "niche") ?? "").toLowerCase();
  const hook = text(formData, "hook");
  const item: LokalInput = {
    name,
    city: text(formData, "city"),
    niche: NICHES.includes(nicheRaw) ? nicheRaw : "restauracja",
    instagram,
    followers: parsePositiveInt(formData.get("followers")),
    dm_text: hook ? `${HOOK_PREFIX} ${hook}` : "",
  };
  const { added, skipped } = await insertLokale([item]);
  if (added === 0) return { error: `@${instagram} już jest w Bazie.` };
  revalidateAll();
  return { ok: true, info: skipped.length ? `Pominięto: ${skipped.join(", ")}` : undefined };
}

export async function addLokaleBulk(formData: FormData): Promise<ActionResult> {
  await guardStaffAction();
  const raw = text(formData, "lines", 20_000) ?? "";
  const items = raw
    .split(/\r?\n/)
    .map(parseLokalLine)
    .filter((x): x is LokalInput => x !== null);
  if (items.length === 0) return { error: "Nie rozpoznano żadnej linii. Format: @instagram | Nazwa | Miasto | nisza" };
  const { added, skipped } = await insertLokale(items);
  revalidateAll();
  return {
    ok: true,
    info: `Dodano ${added} z ${items.length}.${skipped.length ? ` Pominięto (już w Bazie): ${skipped.join(", ")}` : ""}`,
  };
}

export async function removeLokal(blitzId: string): Promise<ActionResult> {
  await guardStaffAction();
  const db = getServiceClient();
  const { error } = await db.from("crm_dm_blitz").delete().eq("id", blitzId);
  if (error) return { error: `Nie udało się usunąć: ${error.message}` };
  revalidateAll();
  return { ok: true };
}
