import "server-only";

// Skrzynki nadawcze z env MAIL_ACCOUNTS (JSON). Hasła nigdy nie trafiają do
// bazy ani do UI — stąd wychodzi tylko MailboxInfo (adres, nazwa, limit).
//
// Format (tablica):
// [
//   { "email": "adam@scanova.pl", "pass": "haslo-aplikacji", "name": "Adam Kondracki", "dailyCap": 40 },
//   { "email": "adam@x.pl", "pass": "...", "smtp": { "host": "smtp.x.pl", "port": 465 },
//     "imap": { "host": "imap.x.pl", "port": 993 } },
//   { "email": "stara@gmail.com", "pass": "...", "onlyFollowups": true }   // tylko kończy rozpoczęte wątki
// ]
// Bez smtp/imap zakładamy Gmail / Google Workspace (smtp.gmail.com:465, imap.gmail.com:993)
// z hasłem aplikacji (konto musi mieć włączoną weryfikację dwuetapową).

import type { MailboxInfo } from "@/lib/crm/mail/types";

export interface MailAccount extends MailboxInfo {
  pass: string;
  smtp: { host: string; port: number; secure: boolean; user: string };
  imap: { host: string; port: number; secure: boolean; user: string };
  /** Adres, na który mają wracać odpowiedzi (domyślnie sama skrzynka). */
  replyTo: string | null;
}

const DEFAULT_CAP = 40;

let cached: MailAccount[] | null = null;

export function loadMailAccounts(): MailAccount[] {
  if (cached) return cached;
  const raw = process.env.MAIL_ACCOUNTS?.trim();
  if (!raw) {
    cached = [];
    return cached;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("MAIL_ACCOUNTS nie jest poprawnym JSON-em.");
  }
  if (!Array.isArray(parsed)) throw new Error("MAIL_ACCOUNTS musi być tablicą skrzynek.");

  const accounts: MailAccount[] = [];
  for (const item of parsed as Record<string, unknown>[]) {
    const email = typeof item.email === "string" ? item.email.trim().toLowerCase() : "";
    const pass = typeof item.pass === "string" ? item.pass : "";
    if (!email || !pass) throw new Error("Każda skrzynka w MAIL_ACCOUNTS wymaga pól email i pass.");
    const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Adam Kondracki";
    const cap = typeof item.dailyCap === "number" && item.dailyCap > 0 ? Math.floor(item.dailyCap) : DEFAULT_CAP;
    const smtp = (item.smtp ?? {}) as Record<string, unknown>;
    const imap = (item.imap ?? {}) as Record<string, unknown>;
    const smtpPort = typeof smtp.port === "number" ? smtp.port : 465;
    const imapPort = typeof imap.port === "number" ? imap.port : 993;
    accounts.push({
      email,
      name,
      dailyCap: cap,
      onlyFollowups: item.onlyFollowups === true,
      pass,
      replyTo: typeof item.replyTo === "string" && item.replyTo.trim() ? item.replyTo.trim() : null,
      smtp: {
        host: typeof smtp.host === "string" ? smtp.host : "smtp.gmail.com",
        port: smtpPort,
        secure: typeof smtp.secure === "boolean" ? smtp.secure : smtpPort === 465,
        user: typeof smtp.user === "string" ? smtp.user : email,
      },
      imap: {
        host: typeof imap.host === "string" ? imap.host : "imap.gmail.com",
        port: imapPort,
        secure: typeof imap.secure === "boolean" ? imap.secure : true,
        user: typeof imap.user === "string" ? imap.user : email,
      },
    });
  }
  cached = accounts;
  return cached;
}

/** Wersja bez sekretów — do planowania i UI. */
export function mailboxInfos(): MailboxInfo[] {
  return loadMailAccounts().map(({ email, name, dailyCap, onlyFollowups }) => ({ email, name, dailyCap, onlyFollowups }));
}

export function findMailAccount(email: string): MailAccount | null {
  const e = email.trim().toLowerCase();
  return loadMailAccounts().find((a) => a.email === e) ?? null;
}

/** Tryb na sucho: nic nie wychodzi, wszystko loguje się jak wysłane. */
export function isMailDryRun(): boolean {
  return process.env.MAIL_DRY_RUN === "1" || process.env.MAIL_DRY_RUN === "true";
}

/** Telefon do podpisu (opcjonalny). */
export function signaturePhone(): string | null {
  const v = process.env.MAIL_PHONE?.trim();
  return v ? v : null;
}

/** Co ile minut uruchamia się cron (musi zgadzać się z vercel.json). */
export function cronMinutes(): number {
  const n = Number(process.env.MAIL_CRON_MINUTES ?? "15");
  return Number.isFinite(n) && n > 0 ? n : 15;
}
