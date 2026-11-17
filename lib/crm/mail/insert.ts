import "server-only";

// Wspólny insert do kolejki z deduplikacją po adresie. Używany przez akcje
// ekranu Maile i skrypt importu. CELOWO poza mail-actions.ts: w pliku
// "use server" każdy eksport jest publicznym endpointem, a ta funkcja nie
// sprawdza sesji.

import { getServiceClient } from "@/lib/supabase/service";
import type { ParsedContact } from "./parse";
import type { MailSource } from "./types";

export async function insertContacts(
  contacts: ParsedContact[],
  source: MailSource,
  campaign?: string,
): Promise<{ added: number; skipped: string[] }> {
  const db = getServiceClient();
  const skipped: string[] = [];
  const rows = [];
  const seen = new Set<string>();
  // in() z tysiącem adresów bywa za długie dla URL-a PostgREST — porcjami.
  const known = new Set<string>();
  const emails = [...new Set(contacts.map((c) => c.email))];
  for (let i = 0; i < emails.length; i += 200) {
    const { data, error } = await db.from("crm_mail_queue").select("email").in("email", emails.slice(i, i + 200));
    if (error) throw new Error(`Błąd bazy przy sprawdzaniu duplikatów: ${error.message}`);
    for (const e of (data ?? []) as { email: string }[]) known.add(e.email);
  }
  for (const c of contacts) {
    if (known.has(c.email) || seen.has(c.email)) {
      skipped.push(`${c.email}: już w kolejce`);
      continue;
    }
    seen.add(c.email);
    rows.push({
      email: c.email,
      domain: c.email.split("@")[1],
      name: c.name,
      city: c.city,
      niche: c.niche,
      www: c.www,
      instagram: c.instagram,
      phone: c.phone,
      note: c.note,
      source,
      campaign: campaign?.trim() || `mail-${new Date().toISOString().slice(0, 7)}`,
    });
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("crm_mail_queue").insert(rows.slice(i, i + 500));
    if (error) throw new Error(`Nie udało się dodać adresów: ${error.message}`);
  }
  return { added: rows.length, skipped };
}
