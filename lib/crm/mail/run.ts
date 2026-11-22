import "server-only";

// Silnik Maili: jedno uruchomienie crona = (1) przeczytaj skrzynki
// (odpowiedzi, odbicia, "nie"), (2) wyślij zaplanowaną partię.
// Wszystko idempotentne: dziennik zdarzeń jest źródłem prawdy dla limitów
// i dla "już przetworzone".

import { getServiceClient } from "@/lib/supabase/service";
import { cronMinutes, findMailAccount, loadMailAccounts, mailboxInfos, signaturePhone, type MailAccount } from "@/lib/mail/accounts";
import { newMessageId, sendMail } from "@/lib/mail/smtp";
import { fetchInbox, type FetchedMessage } from "@/lib/mail/imap";
import { unsubscribeUrl } from "@/lib/mail/unsubscribe";
import { findDuplicateCandidates } from "../queries";
import { normalizeDomain, normalizeName } from "../normalize";
import { REPLIED_NEXT_ACTION } from "../promote";
import { classify, fromAddress } from "./inbox";
import { firstSubjectFor, renderMail, type MailContext } from "./copy";
import { planBatch, type PlannedSend } from "./plan";
import { getMailSettings, listMailActionable, processedIncomingIds, todayStats } from "./queries";
import type { CrmMailRow, MailEventKind } from "./types";

const SYSTEM_BY = "cron@maile";

export async function logMailEvent(ev: {
  queue_id?: string | null;
  email: string;
  kind: MailEventKind | "nieznany";
  step?: number | null;
  mailbox?: string | null;
  message_id?: string | null;
  detail?: string | null;
}): Promise<void> {
  const db = getServiceClient();
  const { error } = await db.from("crm_mail_events").insert({
    queue_id: ev.queue_id ?? null,
    email: ev.email,
    kind: ev.kind,
    step: ev.step ?? null,
    mailbox: ev.mailbox ?? null,
    message_id: ev.message_id ?? null,
    detail: ev.detail ?? null,
  });
  if (error) throw new Error(`Nie udało się zapisać zdarzenia maila: ${error.message}`);
}

function contextFor(row: CrmMailRow, account: MailAccount): MailContext {
  return {
    name: row.name,
    city: row.city,
    niche: row.niche,
    senderName: account.name,
    senderEmail: account.email,
    phone: signaturePhone(),
    unsubscribeUrl: unsubscribeUrl(row.email),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface SendSummary {
  planned: number;
  sent: number;
  failed: number;
  skipped: string[];
  dryRun: boolean;
}

/** Wysyła jeden zaplanowany krok i zapisuje wynik. */
async function sendPlanned(p: PlannedSend, variant: "pytanie" | "oferta"): Promise<{ ok: boolean; error?: string; dryRun?: boolean }> {
  const db = getServiceClient();
  const account = findMailAccount(p.mailbox);
  if (!account) return { ok: false, error: `Brak skrzynki ${p.mailbox} w MAIL_ACCOUNTS` };

  const ctx = contextFor(p.row, account);
  const firstSubject = p.row.subject ?? firstSubjectFor(variant, p.row.name, p.row.id);
  const rendered = renderMail(p.step, variant, ctx, firstSubject);
  const messageId = newMessageId(account.email);

  const result = await sendMail(account, {
    to: p.row.email,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    messageId,
    inReplyTo: p.step > 1 ? p.row.message_id : null,
    unsubscribeUrl: ctx.unsubscribeUrl,
  });

  const nowIso = new Date().toISOString();
  if (!result.ok) {
    await db
      .from("crm_mail_queue")
      .update({ status: "blad", last_error: result.error ?? "nieznany błąd", attempts: p.row.attempts + 1 })
      .eq("id", p.row.id);
    await logMailEvent({ queue_id: p.row.id, email: p.row.email, kind: "blad", step: p.step, mailbox: account.email, detail: result.error });
    return { ok: false, error: result.error };
  }

  const patch: Record<string, unknown> = {
    status: p.step === 1 ? "wyslany" : p.step === 2 ? "followup" : "zamkniety",
    step: p.step,
    last_step_at: nowIso,
    last_error: null,
    attempts: 0,
    mailbox: account.email,
  };
  if (p.step === 1) {
    patch.sent_at = nowIso;
    patch.subject = rendered.subject;
    patch.message_id = result.messageId;
  } else if (p.step === 2) {
    patch.step2_at = nowIso;
  } else {
    patch.step3_at = nowIso;
  }
  const { error } = await db.from("crm_mail_queue").update(patch).eq("id", p.row.id);
  if (error) throw new Error(`Mail poszedł, ale nie udało się zapisać stanu (${p.row.email}): ${error.message}`);
  await logMailEvent({
    queue_id: p.row.id,
    email: p.row.email,
    kind: "wyslano",
    step: p.step,
    mailbox: account.email,
    message_id: result.messageId,
    detail: result.dryRun ? `NA SUCHO: ${rendered.subject}` : rendered.subject,
  });
  return { ok: true, dryRun: result.dryRun };
}

/** Partia wysyłki na to uruchomienie (plan → wysyłka → zapis). */
export async function runSendBatch(now: Date = new Date()): Promise<SendSummary> {
  const settings = await getMailSettings();
  const mailboxes = mailboxInfos();
  const summary: SendSummary = { planned: 0, sent: 0, failed: 0, skipped: [], dryRun: false };
  if (mailboxes.length === 0) {
    summary.skipped.push("brak skrzynek (MAIL_ACCOUNTS)");
    return summary;
  }
  const [rows, stats] = await Promise.all([listMailActionable(), todayStats(now)]);
  const batch = planBatch({
    rows,
    settings,
    now,
    sentToday: stats.sent,
    sentTodayByMailbox: stats.byMailbox,
    domainsToday: stats.domains,
    mailboxes,
    cronMinutes: cronMinutes(),
  });
  summary.planned = batch.length;
  for (const [i, p] of batch.entries()) {
    const r = await sendPlanned(p, settings.variant);
    if (r.ok) summary.sent += 1;
    else {
      summary.failed += 1;
      summary.skipped.push(`${p.row.email}: ${r.error}`);
    }
    if (r.dryRun) summary.dryRun = true;
    // Odstęp między mailami w jednej partii: 2–5 s, jak człowiek, nie karabin.
    if (i < batch.length - 1 && !r.dryRun) await sleep(2000 + Math.floor(Math.random() * 3000));
  }
  return summary;
}

// ----------------------------------------------------------------------------
// Skrzynki: odpowiedzi, odbicia, wypisania
// ----------------------------------------------------------------------------

export interface InboxSummary {
  mailboxes: number;
  messages: number;
  replies: number;
  bounces: number;
  unsubscribes: number;
  autoreplies: number;
  errors: string[];
}

/** Awans odpowiedzi mailowej do Rozmów (jak promoteBlitzRow dla DM). */
export async function promoteMailRow(row: CrmMailRow, by: string, note: string): Promise<{ leadId: string; created: boolean }> {
  const db = getServiceClient();
  if (row.lead_id) return { leadId: row.lead_id, created: false };

  const candidates = await findDuplicateCandidates({
    normalized_name: normalizeName(row.name),
    instagram: row.instagram,
    phone: row.phone,
    domain: normalizeDomain(row.www) ?? (isGenericDomain(row.domain) ? null : row.domain),
  });
  const normalized = normalizeName(row.name);
  const existing = candidates.find(
    (c) =>
      (c.email && c.email.toLowerCase() === row.email) ||
      (row.instagram && c.instagram === row.instagram) ||
      (c.normalized_name === normalized && (!row.city || !c.city || c.city.toLowerCase() === row.city.toLowerCase())),
  );

  let leadId: string;
  let created = false;
  if (existing) {
    leadId = existing.id;
    const { error } = await db
      .from("crm_leads")
      .update({
        status: "proba_kontaktu",
        source: "email",
        source_detail: "odpowiedź na zimny mail",
        campaign: row.campaign,
        email: existing.email ?? row.email,
        owner: existing.owner ?? by,
        next_action: REPLIED_NEXT_ACTION,
        next_action_at: null,
      })
      .eq("id", leadId);
    if (error) throw new Error(`Nie udało się wznowić rozmowy: ${error.message}`);
  } else {
    const { data, error } = await db
      .from("crm_leads")
      .insert({
        name: row.name,
        normalized_name: normalized,
        category: row.niche,
        city: row.city,
        email: row.email,
        www: row.www,
        phone: row.phone,
        instagram: row.instagram,
        source: "email",
        source_detail: "odpowiedź na zimny mail",
        campaign: row.campaign,
        status: "proba_kontaktu",
        priority: "B",
        owner: by,
        next_action: REPLIED_NEXT_ACTION,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Nie udało się utworzyć rozmowy: ${error.message}`);
    leadId = data.id;
    created = true;
  }

  await db.from("crm_activities").insert({
    lead_id: leadId,
    type: "email",
    outcome: "zainteresowany",
    note,
    created_by: by,
  });
  const { data: h } = await db
    .from("crm_stage_history")
    .select("id")
    .eq("lead_id", leadId)
    .is("changed_by", null)
    .order("changed_at", { ascending: false })
    .limit(1);
  if (h && h.length > 0) await db.from("crm_stage_history").update({ changed_by: by }).eq("id", h[0].id);

  await db.from("crm_mail_queue").update({ lead_id: leadId }).eq("id", row.id);
  return { leadId, created };
}

function isGenericDomain(domain: string): boolean {
  return /^(gmail\.com|wp\.pl|o2\.pl|onet\.pl|onet\.eu|interia\.pl|interia\.eu|op\.pl|poczta\.fm|tlen\.pl|gazeta\.pl|vp\.pl|hotmail\.com|outlook\.com|outlook\.pl|yahoo\.com|yahoo\.pl|icloud\.com|me\.com|live\.com|protonmail\.com|proton\.me)$/.test(domain);
}

export async function applyReply(row: CrmMailRow, excerpt: string, by: string, incomingId: string | null): Promise<void> {
  const db = getServiceClient();
  const nowIso = new Date().toISOString();
  const { error } = await db
    .from("crm_mail_queue")
    .update({ status: "odpowiedzial", replied_at: nowIso, reply_excerpt: excerpt || null })
    .eq("id", row.id);
  if (error) throw new Error(`Nie udało się zapisać odpowiedzi: ${error.message}`);
  await logMailEvent({ queue_id: row.id, email: row.email, kind: "odpowiedz", step: row.step, mailbox: row.mailbox, message_id: incomingId, detail: excerpt });
  await promoteMailRow({ ...row, status: "odpowiedzial" }, by, `Odpowiedź na zimny mail${excerpt ? `: ${excerpt}` : "."}`);
}

export async function applyUnsubscribe(row: CrmMailRow, detail: string, incomingId: string | null): Promise<void> {
  const db = getServiceClient();
  const { error } = await db
    .from("crm_mail_queue")
    .update({ status: "wypisany", unsubscribed_at: new Date().toISOString(), reply_excerpt: detail || null })
    .eq("id", row.id);
  if (error) throw new Error(`Nie udało się zapisać wypisania: ${error.message}`);
  await logMailEvent({ queue_id: row.id, email: row.email, kind: "wypisanie", step: row.step, mailbox: row.mailbox, message_id: incomingId, detail });
}

export async function applyBounce(row: CrmMailRow, detail: string, incomingId: string | null): Promise<void> {
  const db = getServiceClient();
  const { error } = await db
    .from("crm_mail_queue")
    .update({ status: "odbil", bounced_at: new Date().toISOString(), last_error: detail })
    .eq("id", row.id);
  if (error) throw new Error(`Nie udało się zapisać odbicia: ${error.message}`);
  await logMailEvent({ queue_id: row.id, email: row.email, kind: "odbicie", step: row.step, mailbox: row.mailbox, message_id: incomingId, detail });
}

/** Dopasowanie przychodzącej wiadomości do wiersza kolejki. */
function matchRow(msg: FetchedMessage, rows: CrmMailRow[]): CrmMailRow | null {
  const from = fromAddress(msg.from);
  if (from) {
    const exact = rows.find((r) => r.email === from);
    if (exact) return exact;
  }
  // Odpowiedź z innego adresu (np. właściciel z prywatnego Gmaila) — po wątku.
  const threadIds = [msg.inReplyTo, ...msg.references].filter(Boolean) as string[];
  if (threadIds.length > 0) {
    const byThread = rows.find((r) => r.message_id && threadIds.includes(r.message_id));
    if (byThread) return byThread;
  }
  // Ostatnia deska: ta sama domena firmowa (nie webmail).
  if (from) {
    const domain = from.split("@")[1];
    if (domain && !isGenericDomain(domain)) {
      const sameDomain = rows.filter((r) => r.domain === domain && r.sent_at);
      if (sameDomain.length === 1) return sameDomain[0];
    }
  }
  return null;
}

/** Czyta wszystkie skrzynki i nanosi odpowiedzi/odbicia/wypisania. */
export async function processInboxes(now: Date = new Date()): Promise<InboxSummary> {
  const accounts = loadMailAccounts();
  const summary: InboxSummary = { mailboxes: accounts.length, messages: 0, replies: 0, bounces: 0, unsubscribes: 0, autoreplies: 0, errors: [] };
  if (accounts.length === 0) return summary;

  const db = getServiceClient();
  const since = new Date(now.getTime() - 14 * 86_400_000);
  const [processed, allRows] = await Promise.all([
    processedIncomingIds(since.toISOString()),
    (async () => {
      const { data, error } = await db.from("crm_mail_queue").select("*").not("sent_at", "is", null);
      if (error) throw new Error(`Błąd bazy przy odczycie kolejki: ${error.message}`);
      return (data ?? []) as CrmMailRow[];
    })(),
  ]);
  const known = new Set(allRows.map((r) => r.email));

  for (const account of accounts) {
    let messages: FetchedMessage[];
    try {
      messages = await fetchInbox(account, since);
    } catch (err) {
      summary.errors.push(`${account.email}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    for (const msg of messages) {
      if (processed.has(msg.messageId)) continue;
      // Własne wiadomości (kopie w Wysłanych nie są w INBOX, ale na wszelki wypadek).
      const from = fromAddress(msg.from);
      if (from && accounts.some((a) => a.email === from)) continue;

      const cls = classify(msg, known);
      summary.messages += 1;
      try {
        if (cls.kind === "bounce") {
          const row = (cls.recipient ? allRows.find((r) => r.email === cls.recipient) : null) ?? matchRow(msg, allRows);
          if (row && row.status !== "odbil") {
            await applyBounce(row, msg.subject.slice(0, 200), msg.messageId);
            summary.bounces += 1;
          } else {
            await logMailEvent({ email: from ?? "?", kind: "nieznany", mailbox: account.email, message_id: msg.messageId, detail: `odbicie bez dopasowania: ${msg.subject.slice(0, 120)}` });
          }
          continue;
        }
        const row = matchRow(msg, allRows);
        if (!row) {
          // Obcy mail w skrzynce (newsletter, znajomy) — zapamiętujemy, żeby nie czytać drugi raz.
          await logMailEvent({ email: from ?? "?", kind: "nieznany", mailbox: account.email, message_id: msg.messageId, detail: msg.subject.slice(0, 120) });
          continue;
        }
        if (cls.kind === "autoreply") {
          await logMailEvent({ queue_id: row.id, email: row.email, kind: "autoodpowiedz", step: row.step, mailbox: account.email, message_id: msg.messageId, detail: msg.subject.slice(0, 120) });
          summary.autoreplies += 1;
          continue;
        }
        if (cls.kind === "unsubscribe") {
          if (row.status !== "wypisany") await applyUnsubscribe(row, cls.excerpt, msg.messageId);
          summary.unsubscribes += 1;
          continue;
        }
        if (row.status === "odpowiedzial") {
          // Kolejna wiadomość w rozmowie — tylko dziennik; rozmowa żyje już w Rozmowach.
          await logMailEvent({ queue_id: row.id, email: row.email, kind: "odpowiedz", step: row.step, mailbox: account.email, message_id: msg.messageId, detail: cls.excerpt });
          continue;
        }
        await applyReply(row, cls.excerpt, SYSTEM_BY, msg.messageId);
        summary.replies += 1;
      } catch (err) {
        summary.errors.push(`${msg.messageId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return summary;
}

/** Pełne uruchomienie crona: najpierw skrzynki (żeby nie wysłać follow-upu komuś, kto odpisał), potem wysyłka. */
export async function runMailCron(now: Date = new Date()): Promise<{ inbox: InboxSummary; send: SendSummary }> {
  const inbox = await processInboxes(now);
  const send = await runSendBatch(now);
  if (send.sent > 0 || send.failed > 0 || inbox.replies > 0 || inbox.errors.length > 0) {
    await logMailEvent({
      email: SYSTEM_BY,
      kind: "cron",
      detail: JSON.stringify({ inbox: { ...inbox, errors: inbox.errors.slice(0, 5) }, send: { ...send, skipped: send.skipped.slice(0, 5) } }),
    });
  }
  return { inbox, send };
}

/** Mail testowy (krok 1) na własny adres — sprawdzenie treści i dostarczalności. */
export async function sendTestMail(to: string, sample: Pick<CrmMailRow, "name" | "city" | "niche">): Promise<{ ok: boolean; error?: string; dryRun?: boolean; subject: string }> {
  const settings = await getMailSettings();
  const account = loadMailAccounts()[0];
  if (!account) return { ok: false, error: "Brak skrzynek w MAIL_ACCOUNTS.", subject: "" };
  const ctx: MailContext = {
    name: sample.name,
    city: sample.city,
    niche: sample.niche,
    senderName: account.name,
    senderEmail: account.email,
    phone: signaturePhone(),
    unsubscribeUrl: unsubscribeUrl(to),
  };
  const rendered = renderMail(1, settings.variant, ctx, firstSubjectFor(settings.variant, sample.name, "test"));
  const result = await sendMail(account, {
    to,
    subject: `[TEST] ${rendered.subject}`,
    text: rendered.text,
    html: rendered.html,
    messageId: newMessageId(account.email),
    unsubscribeUrl: ctx.unsubscribeUrl,
  });
  await logMailEvent({ email: to, kind: "test", mailbox: account.email, message_id: result.messageId, detail: result.ok ? rendered.subject : result.error });
  return { ok: result.ok, error: result.error, dryRun: result.dryRun, subject: rendered.subject };
}
