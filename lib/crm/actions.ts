"use server";

// Mutacje domeny CRM. KAŻDA akcja zaczyna się od guardStaffAction() —
// Server Actions to publiczne endpointy HTTP, więc żadnych wyjątków.
// Autor (owner/created_by/changed_by) pochodzi WYŁĄCZNIE z sesji,
// nigdy z formularza.

import { revalidatePath } from "next/cache";
import { guardStaffAction } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { getLead } from "./queries";
import {
  isActivityOutcome,
  isActivityType,
  isCurrentLoyalty,
  isGoalMetric,
  isLeadPriority,
  isLeadSource,
  isLeadStatus,
  isTaskPriority,
  isTaskStatus,
  parseMoney,
  parsePositiveInt,
  validateStatusChange,
  warsawLocalToIso,
  LIMITS,
} from "./validation";
import {
  clampText,
  normalizeGoogleRating,
  normalizeInstagram,
  normalizeName,
  normalizePhone,
  normalizeWww,
} from "./normalize";
import type { LeadStatus } from "./types";

export interface ActionResult {
  error?: string;
  ok?: boolean;
  /** id utworzonego rekordu, gdy dotyczy */
  id?: string;
}

function text(formData: FormData, key: string, max: number = LIMITS.shortText): string | null {
  const v = formData.get(key);
  return typeof v === "string" ? clampText(v, max) : null;
}

/** Wspólne pola leada z formularza (bez statusu — status idzie osobną ścieżką). */
function leadFieldsFromForm(formData: FormData) {
  const name = text(formData, "name", LIMITS.name);
  const priorityRaw = formData.get("priority");
  const sourceRaw = formData.get("source");
  const loyaltyRaw = formData.get("current_loyalty");
  return {
    name,
    category: text(formData, "category"),
    city: text(formData, "city"),
    district: text(formData, "district"),
    address: text(formData, "address"),
    instagram: normalizeInstagram(text(formData, "instagram")),
    phone: normalizePhone(text(formData, "phone")),
    email: text(formData, "email"),
    www: normalizeWww(text(formData, "www")),
    google_rating: normalizeGoogleRating(text(formData, "google_rating")),
    locations_count: parsePositiveInt(formData.get("locations_count")) || 1,
    estimated_daily_transactions: parsePositiveInt(formData.get("estimated_daily_transactions")),
    current_loyalty: isCurrentLoyalty(loyaltyRaw) ? loyaltyRaw : null,
    decision_maker_name: text(formData, "decision_maker_name"),
    decision_maker_role: text(formData, "decision_maker_role"),
    source: isLeadSource(sourceRaw) ? sourceRaw : ("teren" as const),
    source_detail: text(formData, "source_detail"),
    campaign: text(formData, "campaign"),
    priority: isLeadPriority(priorityRaw) ? priorityRaw : ("B" as const),
    qualification_note: text(formData, "qualification_note", LIMITS.note),
    notes: text(formData, "notes", LIMITS.notes),
    next_action: text(formData, "next_action"),
    next_action_at: warsawLocalToIso(formData.get("next_action_at")),
  };
}

/**
 * Trigger w bazie zapisuje historię etapów bez autora (działa z service role
 * i nie zna sesji). Uzupełniamy changed_by w najświeższym wpisie bez autora
 * zaraz po zmianie — przy 2 użytkownikach wyścig jest teoretyczny, a dzięki
 * triggerowi historia powstaje też przy ręcznym SQL.
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
  if (error || !data || data.length === 0) return; // brak wpisu to nie błąd krytyczny
  await db.from("crm_stage_history").update({ changed_by: email }).eq("id", data[0].id);
}

// ----------------------------------------------------------------------------
// Leady
// ----------------------------------------------------------------------------

export async function createLead(formData: FormData): Promise<ActionResult> {
  const user = await guardStaffAction();
  const fields = leadFieldsFromForm(formData);
  if (!fields.name) return { error: "Nazwa firmy jest wymagana." };

  const ownerRaw = text(formData, "owner");
  const db = getServiceClient();
  const { data, error } = await db
    .from("crm_leads")
    .insert({
      ...fields,
      normalized_name: normalizeName(fields.name),
      // Prowadzący domyślnie = twórca; formularz może wskazać drugą osobę,
      // ale tylko spośród zalogowanych kont (walidacja miękka — 2 osoby).
      owner: ownerRaw?.toLowerCase() ?? user.email!.toLowerCase(),
    })
    .select("id")
    .single();
  if (error) return { error: `Nie udało się zapisać leada: ${error.message}` };

  await backfillHistoryAuthor(data.id, user.email!);
  revalidatePath("/", "layout");
  return { ok: true, id: data.id };
}

export async function updateLead(leadId: string, formData: FormData): Promise<ActionResult> {
  await guardStaffAction();
  const lead = await getLead(leadId);
  if (!lead) return { error: "Lead nie istnieje." };

  const fields = leadFieldsFromForm(formData);
  if (!fields.name) return { error: "Nazwa firmy jest wymagana." };

  const ownerRaw = text(formData, "owner");
  const db = getServiceClient();
  const { error } = await db
    .from("crm_leads")
    .update({
      ...fields,
      normalized_name: normalizeName(fields.name),
      owner: ownerRaw?.toLowerCase() ?? lead.owner,
    })
    .eq("id", leadId);
  if (error) return { error: `Nie udało się zapisać zmian: ${error.message}` };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * JEDYNA ścieżka zmiany statusu. Egzekwuje reguły przejść:
 * pilot_aktywny wymaga dat pilota, platny_klient wymaga paid_at + plan + MRR,
 * utracony/zdyskwalifikowany/churn wymagają powodu. Pola przejścia mogą
 * przyjść w tym samym formularzu (np. daty pilota przy przejściu w pilota).
 */
export async function changeLeadStatus(leadId: string, formData: FormData): Promise<ActionResult> {
  const user = await guardStaffAction();
  const statusRaw = formData.get("status");
  if (!isLeadStatus(statusRaw)) return { error: "Nieznany etap." };
  const target: LeadStatus = statusRaw;

  const lead = await getLead(leadId);
  if (!lead) return { error: "Lead nie istnieje." };
  if (lead.status === target) return { ok: true };

  // Pola towarzyszące przejściu — tylko te, które formularz faktycznie przysłał.
  const updates: Record<string, unknown> = {};
  const pilotStart = warsawLocalToIso(formData.get("pilot_started_at"));
  const pilotEnd = warsawLocalToIso(formData.get("pilot_ends_at"));
  const paidAt = warsawLocalToIso(formData.get("paid_at"));
  const churnedAt = warsawLocalToIso(formData.get("churned_at"));
  const plan = text(formData, "plan");
  const mrr = parseMoney(formData.get("monthly_revenue"));
  const lostReason = text(formData, "lost_reason", LIMITS.note);
  const disqReason = text(formData, "disqualification_reason", LIMITS.note);

  if (pilotStart !== null) updates.pilot_started_at = pilotStart;
  if (pilotEnd !== null) updates.pilot_ends_at = pilotEnd;
  if (paidAt !== null) updates.paid_at = paidAt;
  if (churnedAt !== null) updates.churned_at = churnedAt;
  if (plan !== null) updates.plan = plan;
  if (mrr !== null) updates.monthly_revenue = mrr;
  if (lostReason !== null) updates.lost_reason = lostReason;
  if (disqReason !== null) updates.disqualification_reason = disqReason;

  const missing = validateStatusChange(lead, target, updates);
  if (missing.length > 0) return { error: missing.join(" ") };

  const db = getServiceClient();
  const { error } = await db
    .from("crm_leads")
    .update({ ...updates, status: target })
    .eq("id", leadId);
  if (error) return { error: `Nie udało się zmienić etapu: ${error.message}` };

  await backfillHistoryAuthor(leadId, user.email!);
  revalidatePath("/", "layout");
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
  revalidatePath("/", "layout");
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
  revalidatePath("/", "layout");
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Aktywności — w tym "+ Szybki wpis"
// ----------------------------------------------------------------------------

export async function addActivity(formData: FormData): Promise<ActionResult> {
  const user = await guardStaffAction();
  const typeRaw = formData.get("type");
  if (!isActivityType(typeRaw)) return { error: "Nieznany typ aktywności." };
  const outcomeRaw = formData.get("outcome");
  const leadId = text(formData, "lead_id");

  // happened_at edytowalne (wieczorne uzupełnianie), ale nie dalej niż 24 h
  // w przód — wpis "z przyszłości" psułby liczniki dzienne.
  const happenedAt = warsawLocalToIso(formData.get("happened_at"));
  if (happenedAt && new Date(happenedAt).getTime() > Date.now() + 24 * 3600 * 1000) {
    return { error: "Data aktywności nie może być dalej niż 24 h w przyszłości." };
  }

  const db = getServiceClient();
  const { error } = await db.from("crm_activities").insert({
    lead_id: leadId,
    type: typeRaw,
    outcome: isActivityOutcome(outcomeRaw) ? outcomeRaw : null,
    note: text(formData, "note", LIMITS.note),
    ...(happenedAt ? { happened_at: happenedAt } : {}),
    created_by: user.email!.toLowerCase(),
  });
  if (error) return { error: `Nie udało się zapisać aktywności: ${error.message}` };

  // Opcjonalny następny krok w tym samym formularzu — szybki wpis ma w <10 s
  // zostawić lejek w stanie "wiadomo, co dalej".
  const nextAction = text(formData, "next_action");
  const nextActionAt = warsawLocalToIso(formData.get("next_action_at"));
  if (leadId && (nextAction || nextActionAt)) {
    const { error: nextErr } = await db
      .from("crm_leads")
      .update({ next_action: nextAction, next_action_at: nextActionAt })
      .eq("id", leadId);
    if (nextErr) return { error: `Aktywność zapisana, ale następny krok nie: ${nextErr.message}` };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Zadania / follow-upy
// ----------------------------------------------------------------------------

export async function createTask(formData: FormData): Promise<ActionResult> {
  const user = await guardStaffAction();
  const title = text(formData, "title", LIMITS.title);
  if (!title) return { error: "Treść zadania jest wymagana." };
  const priorityRaw = formData.get("priority");
  const assigned = text(formData, "assigned_to");

  const db = getServiceClient();
  const { error } = await db.from("crm_tasks").insert({
    lead_id: text(formData, "lead_id"),
    title,
    priority: isTaskPriority(priorityRaw) ? priorityRaw : "normalny",
    assigned_to: assigned?.toLowerCase() ?? user.email!.toLowerCase(),
    due_at: warsawLocalToIso(formData.get("due_at")),
    created_by: user.email!.toLowerCase(),
  });
  if (error) return { error: `Nie udało się dodać zadania: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleTask(taskId: string): Promise<ActionResult> {
  await guardStaffAction();
  const db = getServiceClient();
  const { data, error } = await db
    .from("crm_tasks")
    .select("status")
    .eq("id", taskId)
    .maybeSingle();
  if (error || !data) return { error: "Zadanie nie istnieje." };
  const done = data.status === "zrobione";
  const { error: updErr } = await db
    .from("crm_tasks")
    .update({
      status: done ? "otwarte" : "zrobione",
      done_at: done ? null : new Date().toISOString(),
    })
    .eq("id", taskId);
  if (updErr) return { error: `Nie udało się zmienić zadania: ${updErr.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateTask(taskId: string, formData: FormData): Promise<ActionResult> {
  await guardStaffAction();
  const title = text(formData, "title", LIMITS.title);
  if (!title) return { error: "Treść zadania jest wymagana." };
  const statusRaw = formData.get("status");
  const priorityRaw = formData.get("priority");

  const db = getServiceClient();
  const { error } = await db
    .from("crm_tasks")
    .update({
      title,
      status: isTaskStatus(statusRaw) ? statusRaw : "otwarte",
      priority: isTaskPriority(priorityRaw) ? priorityRaw : "normalny",
      assigned_to: text(formData, "assigned_to")?.toLowerCase() ?? null,
      due_at: warsawLocalToIso(formData.get("due_at")),
    })
    .eq("id", taskId);
  if (error) return { error: `Nie udało się zapisać zadania: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Cele
// ----------------------------------------------------------------------------

export async function saveGoal(formData: FormData): Promise<ActionResult> {
  await guardStaffAction();
  const name = text(formData, "name", LIMITS.title);
  const metricRaw = formData.get("metric");
  const target = parseMoney(formData.get("target_value"));
  const startsOn = text(formData, "starts_on");
  const endsOn = text(formData, "ends_on");

  if (!name) return { error: "Nazwa celu jest wymagana." };
  if (!isGoalMetric(metricRaw)) return { error: "Nieznana metryka celu." };
  if (target === null) return { error: "Wartość celu jest wymagana." };
  if (!startsOn || !endsOn) return { error: "Okres celu jest wymagany." };
  if (endsOn < startsOn) return { error: "Koniec okresu nie może być przed początkiem." };

  const goalId = text(formData, "goal_id");
  const db = getServiceClient();
  const payload = {
    name,
    metric: metricRaw,
    target_value: target,
    starts_on: startsOn,
    ends_on: endsOn,
    owner: text(formData, "owner")?.toLowerCase() ?? null,
  };
  const { error } = goalId
    ? await db.from("sales_goals").update(payload).eq("id", goalId)
    : await db.from("sales_goals").insert(payload);
  if (error) return { error: `Nie udało się zapisać celu: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleGoalActive(goalId: string): Promise<ActionResult> {
  await guardStaffAction();
  const db = getServiceClient();
  const { data, error } = await db
    .from("sales_goals")
    .select("active")
    .eq("id", goalId)
    .maybeSingle();
  if (error || !data) return { error: "Cel nie istnieje." };
  const { error: updErr } = await db
    .from("sales_goals")
    .update({ active: !data.active })
    .eq("id", goalId);
  if (updErr) return { error: `Nie udało się zmienić celu: ${updErr.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteGoal(goalId: string): Promise<ActionResult> {
  await guardStaffAction();
  const db = getServiceClient();
  const { error } = await db.from("sales_goals").delete().eq("id", goalId);
  if (error) return { error: `Nie udało się usunąć celu: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Ustawienia
// ----------------------------------------------------------------------------

export async function updateSettings(formData: FormData): Promise<ActionResult> {
  await guardStaffAction();
  const staleAfter = parsePositiveInt(formData.get("stale_after_days"));
  const stuckAfter = parsePositiveInt(formData.get("stage_stuck_after_days"));
  const pilotSoon = parsePositiveInt(formData.get("pilot_ending_soon_days"));
  const pilotCheckin = parsePositiveInt(formData.get("pilot_checkin_after_days"));
  if (!staleAfter || !stuckAfter || !pilotSoon || !pilotCheckin) {
    return { error: "Wszystkie progi muszą być dodatnimi liczbami dni." };
  }
  const db = getServiceClient();
  const { error } = await db
    .from("crm_settings")
    .update({
      stale_after_days: staleAfter,
      stage_stuck_after_days: stuckAfter,
      pilot_ending_soon_days: pilotSoon,
      pilot_checkin_after_days: pilotCheckin,
    })
    .eq("id", 1);
  if (error) return { error: `Nie udało się zapisać ustawień: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}
