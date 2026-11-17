import "server-only";

// Czytanie skrzynki przez IMAP: ostatnie wiadomości z INBOX, sparsowane do
// prostego kształtu (from, subject, text, wątek). Klasyfikacją zajmuje się
// lib/crm/mail/inbox.ts, zapisem lib/crm/mail/run.ts.

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { IncomingMessage } from "@/lib/crm/mail/inbox";
import type { MailAccount } from "./accounts";

export interface FetchedMessage extends IncomingMessage {
  messageId: string;
  uid: number;
}

/** Wiadomości z INBOX od `since` (maks. `limit`, najnowsze na końcu). */
export async function fetchInbox(account: MailAccount, since: Date, limit = 300): Promise<FetchedMessage[]> {
  const client = new ImapFlow({
    host: account.imap.host,
    port: account.imap.port,
    secure: account.imap.secure,
    auth: { user: account.imap.user, pass: account.pass },
    logger: false,
    socketTimeout: 60_000,
  });
  const out: FetchedMessage[] = [];
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ since }, { uid: true });
      const list = (uids || []).slice(-limit);
      if (list.length === 0) return out;
      for await (const msg of client.fetch(list, { uid: true, source: true }, { uid: true })) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        const headerValue = (name: string): string | null => {
          const v = parsed.headers.get(name);
          if (!v) return null;
          return typeof v === "string" ? v : Array.isArray(v) ? v.join(" ") : String((v as { text?: string }).text ?? v);
        };
        const refsRaw = headerValue("references") ?? "";
        const autoSubmitted = (headerValue("auto-submitted") ?? "").toLowerCase();
        out.push({
          uid: msg.uid,
          messageId: parsed.messageId ?? `<uid-${msg.uid}@${account.imap.host}>`,
          from: parsed.from?.text ?? "",
          subject: parsed.subject ?? "",
          text: parsed.text ?? (typeof parsed.html === "string" ? stripHtml(parsed.html) : ""),
          inReplyTo: parsed.inReplyTo ?? null,
          references: refsRaw.split(/\s+/).filter(Boolean),
          autoSubmitted:
            (autoSubmitted !== "" && autoSubmitted !== "no") ||
            parsed.headers.has("x-autoreply") ||
            parsed.headers.has("x-autorespond"),
          date: parsed.date ?? null,
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
  return out;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Test logowania IMAP (ekran Maile → "Sprawdź skrzynkę"). */
export async function verifyImap(account: MailAccount): Promise<{ ok: boolean; error?: string }> {
  const client = new ImapFlow({
    host: account.imap.host,
    port: account.imap.port,
    secure: account.imap.secure,
    auth: { user: account.imap.user, pass: account.pass },
    logger: false,
  });
  try {
    await client.connect();
    await client.logout();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
