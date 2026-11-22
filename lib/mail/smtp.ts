import "server-only";

// Wysyłka przez SMTP skrzynki (Gmail / Google Workspace / dowolny host).
// Jeden transport per skrzynka, cache w procesie. Tekst zawsze; HTML tylko w wariancie „oferta”.

import nodemailer, { type Transporter } from "nodemailer";
import { randomUUID } from "node:crypto";
import { isMailDryRun, type MailAccount } from "./accounts";

const transports = new Map<string, Transporter>();

function transportFor(account: MailAccount): Transporter {
  const existing = transports.get(account.email);
  if (existing) return existing;
  const t = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.smtp.user, pass: account.pass },
    // Jeden mail na raz — tempo nadaje cron, nie pula połączeń.
    pool: false,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 40_000,
  });
  transports.set(account.email, t);
  return t;
}

/** Message-ID generujemy sami, żeby follow-up mógł wskazać wątek (In-Reply-To). */
export function newMessageId(mailboxEmail: string): string {
  const domain = mailboxEmail.split("@")[1] ?? "scanova.tech";
  return `<${randomUUID()}@${domain}>`;
}

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  /** Wersja HTML (wariant „oferta”); tekst zostaje jako alternatywa. */
  html?: string | null;
  messageId: string;
  /** Message-ID maila #1 — dla kroków 2 i 3 (wątek). */
  inReplyTo?: string | null;
  unsubscribeUrl: string;
}

export interface SendResult {
  ok: boolean;
  messageId: string;
  error?: string;
  dryRun?: boolean;
}

export async function sendMail(account: MailAccount, mail: OutgoingMail): Promise<SendResult> {
  if (isMailDryRun()) {
    return { ok: true, messageId: mail.messageId, dryRun: true };
  }
  try {
    const info = await transportFor(account).sendMail({
      from: { name: account.name, address: account.email },
      to: mail.to,
      replyTo: account.replyTo ?? undefined,
      subject: mail.subject,
      text: mail.text,
      html: mail.html ?? undefined,
      messageId: mail.messageId,
      inReplyTo: mail.inReplyTo ?? undefined,
      references: mail.inReplyTo ?? undefined,
      headers: {
        // RFC 8058: wypisanie jednym kliknięciem w Gmailu/Outlooku + link mailto.
        "List-Unsubscribe": `<${mail.unsubscribeUrl}>, <mailto:${account.email}?subject=nie>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    return { ok: true, messageId: info.messageId || mail.messageId };
  } catch (err) {
    return { ok: false, messageId: mail.messageId, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Test połączenia SMTP (ekran Maile → "Sprawdź skrzynkę"). */
export async function verifySmtp(account: MailAccount): Promise<{ ok: boolean; error?: string }> {
  try {
    await transportFor(account).verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
