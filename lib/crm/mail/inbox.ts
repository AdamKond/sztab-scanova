// Klasyfikacja przychodzących wiadomości (czysty moduł, testowalny).
// IMAP dostarcza nagłówki i tekst — tu decydujemy: odpowiedź / "nie" /
// odbicie / autoodpowiedź / nieznane. Zapis do bazy robi lib/crm/mail/run.ts.

export interface IncomingMessage {
  from: string;
  subject: string;
  text: string;
  inReplyTo: string | null;
  references: string[];
  /** Nagłówek Auto-Submitted / X-Autoreply itp. */
  autoSubmitted: boolean;
  date: Date | null;
}

export type Classification =
  | { kind: "bounce"; recipient: string | null }
  /** Powiadomienie o OPÓŹNIENIU dostawy (Gmail: „Delivery Status Notification (Delay)”) — nic nie robimy. */
  | { kind: "delay" }
  | { kind: "autoreply" }
  | { kind: "unsubscribe"; excerpt: string }
  | { kind: "reply"; excerpt: string };

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/** Adresy e-mail z treści (małe litery, bez duplikatów, w kolejności). */
export function extractEmails(text: string): string[] {
  const out: string[] = [];
  for (const m of text.match(EMAIL_RE) ?? []) {
    const v = m.toLowerCase();
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

export function isBounce(msg: Pick<IncomingMessage, "from" | "subject">): boolean {
  const from = msg.from.toLowerCase();
  const subject = msg.subject.toLowerCase();
  return (
    from.includes("mailer-daemon") ||
    from.includes("postmaster@") ||
    from.includes("mail delivery") ||
    /undeliver|delivery status|delivery failure|failure notice|nie mo[żz]na dostarczy|niedostarczon|returned mail|mail delivery failed/.test(subject)
  );
}

export function isAutoReply(msg: Pick<IncomingMessage, "subject" | "text" | "autoSubmitted">): boolean {
  if (msg.autoSubmitted) return true;
  const s = msg.subject.toLowerCase();
  const t = msg.text.slice(0, 600).toLowerCase();
  return (
    /auto(matyczna|matic)?[ -]?(odpowied|reply|response)|out of office|poza biurem|nieobecn|urlop/.test(s) ||
    /automatyczna odpowied|auto-reply|autoreply|out of office|jestem poza biurem|przebywam na urlopie/.test(t)
  );
}

/** Odpowiedź typu "nie" — wypisujemy i nie piszemy więcej. */
export function isOptOut(text: string): boolean {
  const t = ownLines(text).toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return false;
  // Krótkie "nie", "nie dziękuję", "nie, dzięki" — całość to odmowa.
  if (/^(nie|nie[,.!]? ?(dzi[eę]ki|dzi[eę]kuj[eę]|dziekuje)|nie jestem zainteresowan[ay]|niezainteresowan[ay])[.!]*$/.test(t)) return true;
  return /(prosz[eę] (o )?(nie|zaprzesta|usun)|nie pisa[ćc] |nie pisz|nie chc[eę]|nie jeste[śs]my zainteresowan|nie jestem zainteresowan|wypisz|usu[ńn] (mnie|nas|m[óo]j adres)|unsubscribe|spam)/.test(t);
}

/**
 * Tylko linie napisane przez odbiorcę — bez cytatu naszej wiadomości
 * (linie z ">" i wszystko po "napisał(a):" / "wrote:").
 */
export function ownLines(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const l = line.trim();
    if (/^(on .+ wrote:|w dniu .+ napisa[łl]a?\(?a?\)?:|.+ <.+@.+> napisa[łl]a?\(?a?\)?:|-{2,} ?(original message|wiadomość oryginalna|forwarded message) ?-{2,}|od: .+|from: .+)$/i.test(l)) break;
    if (l.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

export function excerptOf(text: string, max = 400): string {
  const own = ownLines(text).replace(/\s+/g, " ").trim();
  return own.length > max ? `${own.slice(0, max - 1)}…` : own;
}

/**
 * Klasyfikacja. `known` = adresy z kolejki (małe litery), żeby przy odbiciu
 * wskazać, KTÓREGO adresata dotyczy.
 */
/** Opóźnienie dostawy: serwer odbiorcy chwilowo nie odpowiada; adres może być dobry. */
export function isDelay(msg: Pick<IncomingMessage, "from" | "subject">): boolean {
  return isBounce(msg) && /\(delay\)|delayed|op[óo][źz]nien|will keep trying|nadal pr[óo]buj/i.test(msg.subject);
}

export function classify(msg: IncomingMessage, known: Set<string>): Classification {
  if (isDelay(msg)) return { kind: "delay" };
  if (isBounce(msg)) {
    const inBody = extractEmails(msg.text).find((e) => known.has(e)) ?? null;
    return { kind: "bounce", recipient: inBody };
  }
  if (isAutoReply(msg)) return { kind: "autoreply" };
  const excerpt = excerptOf(msg.text);
  if (isOptOut(msg.text)) return { kind: "unsubscribe", excerpt };
  return { kind: "reply", excerpt };
}

/** Adres nadawcy z nagłówka From ("Jan <jan@x.pl>" → "jan@x.pl"). */
export function fromAddress(from: string): string | null {
  const m = from.match(EMAIL_RE);
  return m ? m[0].toLowerCase() : null;
}
