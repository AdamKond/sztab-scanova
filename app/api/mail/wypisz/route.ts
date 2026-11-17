import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/service";
import { decodeEmailParam, verifyUnsubscribeToken } from "@/lib/mail/unsubscribe";
import { normalizeDomain } from "@/lib/crm/normalize";

// Publiczny link "nie chcę więcej wiadomości" z każdego maila.
// GET = kliknięcie w link; POST = One-Click (RFC 8058) z Gmaila/Outlooka.
// Adres jest podpisany HMAC-em, więc nie da się wypisać cudzego adresu
// zgadując URL. Nieznany adres też dostaje "Gotowe" — nie zdradzamy,
// czy jest w bazie.

export const dynamic = "force-dynamic";

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f5f5f7;color:#1d1d1f;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
main{background:#fff;border-radius:20px;padding:32px;max-width:460px;box-shadow:0 8px 30px rgba(0,0,0,.06)}h1{font-size:22px;margin:0 0 12px}p{font-size:15px;line-height:1.5;margin:0;color:#515154}</style></head>
<body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
  return new NextResponse(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

async function unsubscribe(email: string): Promise<void> {
  const db = getServiceClient();
  const nowIso = new Date().toISOString();
  const { data } = await db.from("crm_mail_queue").select("id, status, step, mailbox").eq("email", email).maybeSingle();
  if (data) {
    await db.from("crm_mail_queue").update({ status: "wypisany", unsubscribed_at: nowIso }).eq("id", data.id);
    await db.from("crm_mail_events").insert({ queue_id: data.id, email, kind: "wypisanie", step: data.step, mailbox: data.mailbox, detail: "link w mailu" });
  } else {
    // Adres spoza kolejki (np. przekazany dalej) — zapisujemy jako czarną listę,
    // żeby przyszły import go nie dodał.
    await db.from("crm_mail_queue").insert({
      email,
      domain: normalizeDomain(email.split("@")[1]) ?? email.split("@")[1],
      name: email,
      source: "reczne",
      status: "wypisany",
      unsubscribed_at: nowIso,
      note: "wypisany linkiem, nie był w kolejce",
    });
    await db.from("crm_mail_events").insert({ email, kind: "wypisanie", detail: "link w mailu (adres spoza kolejki)" });
  }
}

async function handle(request: NextRequest) {
  if (!isSupabaseConfigured()) return page("Chwilowo niedostępne", "Spróbuj ponownie za chwilę.", 503);
  const email = decodeEmailParam(request.nextUrl.searchParams.get("e"));
  const token = request.nextUrl.searchParams.get("t") ?? "";
  if (!email || !token) return page("Nieprawidłowy link", "Ten link jest niepełny. Wystarczy odpisać „nie” na naszą wiadomość.", 400);
  let valid = false;
  try {
    valid = verifyUnsubscribeToken(email, token);
  } catch {
    return page("Chwilowo niedostępne", "Spróbuj ponownie za chwilę albo odpisz „nie” na naszą wiadomość.", 503);
  }
  if (!valid) return page("Nieprawidłowy link", "Ten link nie przeszedł weryfikacji. Wystarczy odpisać „nie” na naszą wiadomość.", 400);
  try {
    await unsubscribe(email);
  } catch {
    return page("Chwilowo niedostępne", "Nie udało się zapisać. Odpisz „nie” na naszą wiadomość, a wypiszemy ręcznie.", 500);
  }
  return page("Gotowe", `Adres ${email} nie dostanie od nas więcej wiadomości. Przepraszamy za kłopot i powodzenia!`);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
