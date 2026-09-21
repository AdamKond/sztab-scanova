import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/service";
import { promoteBlitzRow } from "@/lib/crm/promote";
import { normalizeInstagram, clampText } from "@/lib/crm/normalize";
import type { CrmDmBlitz } from "@/lib/crm/blitz";

// Odpowiedź na DM przychodząca z automatu (ManyChat "External Request" albo
// webhook Meta). Robi to samo, co klik "Odpowiedział": lokal z Bazy staje się
// rozmową z krokiem "Odpisał", a treść odpowiedzi ląduje w aktywnościach.
//
// Wejście (JSON): { "instagram": "nazwa_profilu", "text": "treść odpowiedzi" }
// Autoryzacja: nagłówek x-inbound-token albo ?token= = INBOUND_WEBHOOK_SECRET.
// Bez poprawnego tokenu 404 — endpoint ma nie istnieć dla skanera.

const buckets = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (buckets.get(ip) ?? []).filter((t) => t > now - 60_000);
  if (recent.length >= 60) {
    buckets.set(ip, recent);
    return true;
  }
  recent.push(now);
  buckets.set(ip, recent);
  return false;
}

export async function POST(request: NextRequest) {
  // trim: wartość wklejona do Vercela przez stdin potrafi mieć końcówkę linii.
  const secret = process.env.INBOUND_WEBHOOK_SECRET?.trim();
  if (!secret || !isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const token = (request.headers.get("x-inbound-token") ?? request.nextUrl.searchParams.get("token"))?.trim();
  if (token !== secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Za dużo żądań." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy JSON." }, { status: 400 });
  }
  const instagram = normalizeInstagram(typeof body.instagram === "string" ? body.instagram : null);
  if (!instagram) {
    return NextResponse.json({ error: "Pole instagram jest wymagane." }, { status: 400 });
  }
  const text = clampText(typeof body.text === "string" ? body.text : null, 2000);

  const db = getServiceClient();
  const { data: row, error } = await db.from("crm_dm_blitz").select("*").eq("instagram", instagram).maybeSingle();
  if (error) return NextResponse.json({ error: "Błąd bazy." }, { status: 500 });
  if (!row) return NextResponse.json({ ok: false, unknown: true, instagram }, { status: 404 });

  try {
    const { leadId, created } = await promoteBlitzRow(
      row as CrmDmBlitz,
      "instagram@inbound",
      text ? `Odpowiedź na IG: ${text}` : "Odpowiedział na DM (automat).",
    );
    // Kolejne wiadomości w tej samej rozmowie: dopisujemy treść, nie tworzymy nic nowego.
    if (!created && row.lead_id && text) {
      await db.from("crm_activities").insert({
        lead_id: leadId,
        type: "ig_dm",
        note: `Wiadomość na IG: ${text}`,
        created_by: "instagram@inbound",
      });
    }
    return NextResponse.json({ ok: true, lead_id: leadId, created });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
