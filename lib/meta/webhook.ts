// Czysta część integracji z Instagramem: weryfikacja podpisu i parsowanie
// payloadu webhooka. Bez "server-only", żeby dało się testować w vitest.

import { createHmac, timingSafeEqual } from "node:crypto";

/** X-Hub-Signature-256 = "sha256=" + HMAC(app secret, surowe body). */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const got = header.slice("sha256=".length);
  if (got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(expected, "hex"));
}

export type InboundMessage = {
  senderId: string;
  recipientId: string;
  text: string | null;
  mid: string | null;
  timestamp: number;
  isEcho: boolean;
};

/** Wyciąga wiadomości z payloadu webhooka; reszta (read, reakcje) pomijana. */
export function parseWebhook(payload: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const p = payload as { object?: string; entry?: unknown[] } | null;
  if (p?.object !== "instagram" || !Array.isArray(p.entry)) return out;
  for (const entry of p.entry as { messaging?: unknown[] }[]) {
    for (const ev of (entry.messaging ?? []) as Record<string, any>[]) {
      const msg = ev.message;
      if (!msg || !ev.sender?.id) continue;
      out.push({
        senderId: String(ev.sender.id),
        recipientId: String(ev.recipient?.id ?? ""),
        text: typeof msg.text === "string" ? msg.text : null,
        mid: typeof msg.mid === "string" ? msg.mid : null,
        timestamp: Number(ev.timestamp ?? Date.now()),
        isEcho: Boolean(msg.is_echo),
      });
    }
  }
  return out;
}
