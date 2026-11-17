"use server";

// Mutacje ekranu Maile. Każda zaczyna się od guardStaffAction() (jak actions.ts).

import { revalidatePath } from "next/cache";
import { guardStaffAction } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { findMailAccount, loadMailAccounts } from "@/lib/mail/accounts";
import { verifySmtp } from "@/lib/mail/smtp";
import { verifyImap } from "@/lib/mail/imap";
import { clampText, normalizeDomain, normalizeInstagram, normalizePhone, normalizeWww } from "./normalize";
import { NICHES } from "./dm-copy";
import { LIMITS } from "./validation";
import type { ActionResult } from "./actions";
import { getMailRow } from "./mail/queries";
import { applyUnsubscribe, logMailEvent, promoteMailRow, runMailCron, sendTestMail } from "./mail/run";
import { parseContactLines, type ParsedContact } from "./mail/parse";
import { insertContacts } from "./mail/insert";

function revalidate() {
  revalidatePath("/maile");
  revalidatePath("/", "layout");
}

function text(formData: FormData, key: string, max: number = LIMITS.shortText): string | null {
  const v = formData.get(key);
  return typeof v === "string" ? clampText(v, max) : null;
}

/** Jeden adres z formularza. */
export async function addMailContact(formData: FormData): Promise<ActionResult> {
  await guardStaffAction();
  const email = text(formData, "email", 200)?.toLowerCase() ?? null;
  const name = text(formData, "name", LIMITS.name);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "Podaj poprawny adres e-mail." };
  if (!name) return { error: "Nazwa lokalu jest wymagana." };
  const nicheRaw = text(formData, "niche") ?? "restauracja";
  const contact: ParsedContact = {
    email,
    name,
    city: text(formData, "city"),
    niche: NICHES.includes(nicheRaw) ? nicheRaw : "restauracja",
    www: normalizeWww(text(formData, "www")),
    instagram: normalizeInstagram(text(formData, "instagram")),
    phone: normalizePhone(text(formData, "phone")),
    note: text(formData, "note", LIMITS.notes),
  };
  const r = await insertContacts([contact], "reczne", text(formData, "campaign") ?? undefined);
  revalidate();
  if (r.added === 0) return { error: r.skipped[0] ?? "Ten adres już jest w kolejce." };
  return { ok: true, info: "Dodano do kolejki" };
}

/** Wklejona lista: `email | nazwa | miasto | nisza | www | notatka` (jedna linia = jeden lokal). */
export async function addMailContactsBulk(formData: FormData): Promise<ActionResult> {
  await guardStaffAction();
  const raw = text(formData, "lines", 200_000);
  if (!raw) return { error: "Wklej przynajmniej jedną linię." };
  const parsed = parseContactLines(raw);
  if (parsed.contacts.length === 0) return { error: parsed.errors[0] ?? "Nie znalazłem żadnego adresu." };
  const r = await insertContacts(parsed.contacts, "csv", text(formData, "campaign") ?? undefined);
  revalidate();
  const parts = [`dodano ${r.added}`];
  if (r.skipped.length) parts.push(`pominięto ${r.skipped.length}`);
  if (parsed.errors.length) parts.push(`${parsed.errors.length} linii bez adresu`);
  return { ok: true, info: parts.join(", ") };
}

export async function setMailPaused(paused: boolean): Promise<ActionResult> {
  const user = await guardStaffAction();
  const db = getServiceClient();
  const { error } = await db.from("crm_mail_settings").update({ paused }).eq("id", 1);
  if (error) return { error: `Nie udało się zapisać: ${error.message}` };
  await logMailEvent({ email: user.email ?? "?", kind: "cron", detail: paused ? "wysyłka WSTRZYMANA ręcznie" : "wysyłka WŁĄCZONA ręcznie" });
  revalidate();
  return { ok: true };
}

export async function updateMailSettings(formData: FormData): Promise<ActionResult> {
  await guardStaffAction();
  const int = (key: string, min: number, max: number): number | null => {
    const v = formData.get(key);
    if (typeof v !== "string" || !v.trim()) return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
  };
  const dailyLimit = int("daily_limit", 0, 1000);
  const followup = int("followup_after_days", 1, 30);
  const last = int("last_after_days", 1, 60);
  const from = int("send_from_hour", 0, 23);
  const to = int("send_to_hour", 1, 24);
  const warmStart = int("warmup_start_limit", 1, 1000);
  const warmStep = int("warmup_step", 1, 200);
  if (dailyLimit === null || followup === null || last === null || from === null || to === null || warmStart === null || warmStep === null) {
    return { error: "Sprawdź liczby: limit 0–1000, dni 1–30/1–60, godziny 0–23 / 1–24." };
  }
  if (to <= from) return { error: "Godzina końca musi być po godzinie startu." };
  if (last <= followup) return { error: "Ostatni mail musi być później niż follow-up." };
  const warmupRaw = formData.get("warmup_start");
  const warmup = typeof warmupRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(warmupRaw) ? warmupRaw : null;
  const variantRaw = formData.get("variant");
  const variant = variantRaw === "oferta" ? "oferta" : "pytanie";
  const db = getServiceClient();
  const { error } = await db
    .from("crm_mail_settings")
    .update({
      daily_limit: dailyLimit,
      followup_after_days: followup,
      last_after_days: last,
      send_from_hour: from,
      send_to_hour: to,
      weekdays_only: formData.get("weekdays_only") === "on",
      warmup_start: warmup,
      warmup_start_limit: warmStart,
      warmup_step: warmStep,
      variant,
    })
    .eq("id", 1);
  if (error) return { error: `Nie udało się zapisać ustawień: ${error.message}` };
  revalidate();
  return { ok: true };
}

/** Ręczne "odpowiedział" (np. odpisał telefonem albo z innego adresu). */
export async function markMailReplied(id: string): Promise<ActionResult> {
  const user = await guardStaffAction();
  const row = await getMailRow(id);
  if (!row) return { error: "Nie ma takiego wpisu." };
  const by = user.email!.toLowerCase();
  const db = getServiceClient();
  if (row.status !== "odpowiedzial") {
    const { error } = await db
      .from("crm_mail_queue")
      .update({ status: "odpowiedzial", replied_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { error: `Nie udało się zapisać: ${error.message}` };
    await logMailEvent({ queue_id: id, email: row.email, kind: "odpowiedz", step: row.step, mailbox: row.mailbox, detail: `oznaczone ręcznie przez ${by}` });
  }
  try {
    const r = await promoteMailRow({ ...row, status: "odpowiedzial" }, by, "Odpowiedź na zimny mail (oznaczone ręcznie).");
    revalidate();
    return { ok: true, id: r.leadId, info: r.created ? "Nowa rozmowa" : "Dopięto do istniejącej rozmowy" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function setMailHold(id: string, hold: boolean): Promise<ActionResult> {
  await guardStaffAction();
  const row = await getMailRow(id);
  if (!row) return { error: "Nie ma takiego wpisu." };
  const db = getServiceClient();
  let next: string;
  if (hold) {
    if (!["oczekuje", "wyslany", "followup", "blad"].includes(row.status)) return { error: "Tego wpisu nie da się wstrzymać." };
    next = "wstrzymany";
  } else {
    if (row.status !== "wstrzymany") return { error: "Ten wpis nie jest wstrzymany." };
    // Wracamy do etapu wynikającego z tego, co już poszło.
    next = row.step === 0 ? "oczekuje" : row.step === 1 ? "wyslany" : row.step === 2 ? "followup" : "zamkniety";
  }
  const { error } = await db.from("crm_mail_queue").update({ status: next }).eq("id", id);
  if (error) return { error: `Nie udało się zapisać: ${error.message}` };
  revalidate();
  return { ok: true };
}

export async function unsubscribeMail(id: string): Promise<ActionResult> {
  const user = await guardStaffAction();
  const row = await getMailRow(id);
  if (!row) return { error: "Nie ma takiego wpisu." };
  try {
    await applyUnsubscribe(row, `ręcznie przez ${user.email}`, null);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  revalidate();
  return { ok: true };
}

export async function removeMailContact(id: string): Promise<ActionResult> {
  await guardStaffAction();
  const row = await getMailRow(id);
  if (!row) return { error: "Nie ma takiego wpisu." };
  if (row.sent_at) return { error: "Do tego adresu już coś poszło — zamiast usuwać, wypisz go (zostaje na czarnej liście)." };
  const db = getServiceClient();
  const { error } = await db.from("crm_mail_queue").delete().eq("id", id);
  if (error) return { error: `Nie udało się usunąć: ${error.message}` };
  revalidate();
  return { ok: true };
}

export async function retryMail(id: string): Promise<ActionResult> {
  await guardStaffAction();
  const row = await getMailRow(id);
  if (!row) return { error: "Nie ma takiego wpisu." };
  if (row.status !== "blad") return { error: "Ponawiać można tylko wpisy z błędem." };
  const db = getServiceClient();
  const { error } = await db.from("crm_mail_queue").update({ attempts: 0, last_error: null }).eq("id", id);
  if (error) return { error: `Nie udało się zapisać: ${error.message}` };
  revalidate();
  return { ok: true };
}

/** Ręczne uruchomienie crona z ekranu (test całej pętli). */
export async function runMailNow(): Promise<ActionResult> {
  const user = await guardStaffAction();
  try {
    const r = await runMailCron(new Date());
    await logMailEvent({ email: user.email ?? "?", kind: "cron", detail: `uruchomienie ręczne: wysłano ${r.send.sent}, błędy ${r.send.failed}, odpowiedzi ${r.inbox.replies}, odbicia ${r.inbox.bounces}` });
    revalidate();
    const bits = [`wysłano ${r.send.sent}`];
    if (r.send.planned === 0) bits.push("nic nie było zaplanowane (okno/limit/pauza/pusta kolejka)");
    if (r.send.failed) bits.push(`błędy ${r.send.failed}`);
    if (r.inbox.replies) bits.push(`odpowiedzi ${r.inbox.replies}`);
    if (r.inbox.bounces) bits.push(`odbicia ${r.inbox.bounces}`);
    if (r.inbox.errors.length) bits.push(`skrzynki: ${r.inbox.errors[0]}`);
    if (r.send.dryRun) bits.push("TRYB NA SUCHO");
    return { ok: true, info: bits.join(", ") };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Mail testowy na własny adres. */
export async function sendMailTest(formData: FormData): Promise<ActionResult> {
  await guardStaffAction();
  const to = text(formData, "to", 200)?.toLowerCase();
  if (!to || !to.includes("@")) return { error: "Podaj adres, na który wysłać test." };
  const r = await sendTestMail(to, { name: text(formData, "name") ?? "Pizzeria Testowa", city: "Lublin", niche: "pizza" });
  revalidate();
  if (!r.ok) return { error: r.error ?? "Wysyłka się nie udała." };
  return { ok: true, info: r.dryRun ? `NA SUCHO (MAIL_DRY_RUN): temat „${r.subject}”` : `Wysłano test na ${to}: „${r.subject}”` };
}

/** Test logowania SMTP + IMAP każdej skrzynki. */
export async function checkMailboxes(): Promise<ActionResult> {
  await guardStaffAction();
  const accounts = loadMailAccounts();
  if (accounts.length === 0) return { error: "Brak skrzynek — ustaw MAIL_ACCOUNTS (patrz docs/maile-system.md)." };
  const results: string[] = [];
  for (const a of accounts) {
    const acc = findMailAccount(a.email)!;
    const [smtp, imap] = await Promise.all([verifySmtp(acc), verifyImap(acc)]);
    results.push(`${a.email}: SMTP ${smtp.ok ? "OK" : `BŁĄD (${smtp.error})`}, IMAP ${imap.ok ? "OK" : `BŁĄD (${imap.error})`}`);
  }
  const allOk = results.every((r) => !r.includes("BŁĄD"));
  return allOk ? { ok: true, info: results.join(" · ") } : { error: results.join(" · ") };
}
