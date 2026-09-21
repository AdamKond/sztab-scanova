import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/service";
import { fetchUsername, metaConfig, parseWebhook, sendMessage, verifySignature } from "@/lib/meta/instagram";
import { promoteBlitzRow, REPLIED_NEXT_ACTION } from "@/lib/crm/promote";
import { findDuplicateCandidates } from "@/lib/crm/queries";
import { normalizeName } from "@/lib/crm/normalize";
import { replyByKey, LINKS } from "@/lib/crm/dm-copy";
import type { CrmDmBlitz } from "@/lib/crm/blitz";

// Webhook Instagram Messaging (Meta). Gdy ktoś odpisze na nasz DM:
//   1. rozpoznajemy lokal po nazwie profilu (Baza → Rozmowy),
//   2. rozmowa dostaje krok "Odpisał" i treść wiadomości w aktywnościach,
//   3. przy PIERWSZEJ wiadomości bot odpisuje filmikiem (jeśli META_AUTO_REPLY=1
//      i jest NEXT_PUBLIC_FILM_URL) — kolejne wiadomości pisze już człowiek.
//
// Zawsze odpowiadamy 200 na zdarzenia, które rozumiemy — Meta ponawia dostawę
// przy błędach, a duplikaty wiadomości w Sztabie są gorsze niż brak jednej.

const BOT = "instagram@bot";
const INBOUND = "instagram@inbound";

/** Weryfikacja webhooka przy dodawaniu w panelu Meta. */
export async function GET(request: NextRequest) {
  const { verifyToken } = metaConfig();
  const sp = request.nextUrl.searchParams;
  if (
    verifyToken &&
    sp.get("hub.mode") === "subscribe" &&
    sp.get("hub.verify_token")?.trim() === verifyToken
  ) {
    return new NextResponse(sp.get("hub.challenge") ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: NextRequest) {
  const cfg = metaConfig();
  if (!cfg.appSecret || !isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), cfg.appSecret)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const messages = parseWebhook(payload).filter((m) => !m.isEcho && m.text);
  const results: unknown[] = [];
  for (const m of messages) {
    try {
      results.push(await handleInbound(m.senderId, m.text!, cfg));
    } catch (e) {
      results.push({ sender: m.senderId, error: (e as Error).message });
    }
  }
  return NextResponse.json({ ok: true, handled: results.length, results });
}

async function handleInbound(senderId: string, text: string, cfg: ReturnType<typeof metaConfig>) {
  const db = getServiceClient();
  const username = cfg.accessToken ? await fetchUsername(senderId, cfg.accessToken) : null;
  const note = `Wiadomość na IG${username ? ` (@${username})` : ""}: ${text}`;

  // 1. Lokal z Bazy → rozmowa.
  let leadId: string | null = null;
  let firstContact = false;
  if (username) {
    const { data: row } = await db.from("crm_dm_blitz").select("*").eq("instagram", username).maybeSingle();
    if (row) {
      firstContact = !row.lead_id;
      const r = await promoteBlitzRow(row as CrmDmBlitz, INBOUND, note);
      leadId = r.leadId;
    }
  }

  // 2. Ktoś spoza Bazy (napisał pierwszy, np. z reklamy) → istniejąca albo nowa rozmowa.
  if (!leadId) {
    const existing = username ? (await findDuplicateCandidates({ instagram: username }))[0] : null;
    if (existing) {
      leadId = existing.id;
    } else {
      const name = username ?? `Instagram ${senderId}`;
      const { data: lead, error } = await db
        .from("crm_leads")
        .insert({
          name,
          normalized_name: normalizeName(name),
          instagram: username,
          source: "ig_dm",
          source_detail: "napisał pierwszy na Instagramie",
          status: "proba_kontaktu",
          priority: "B",
          owner: null,
          next_action: REPLIED_NEXT_ACTION,
          notes: `IGSID: ${senderId}`,
        })
        .select("id")
        .single();
      if (error) throw new Error(`Nie udało się założyć rozmowy: ${error.message}`);
      leadId = lead.id;
      firstContact = true;
    }
  }

  // Kolejne wiadomości: tylko dopisujemy treść (promote zapisuje ją przy pierwszej).
  if (!firstContact) {
    await db.from("crm_activities").insert({ lead_id: leadId, type: "ig_dm", note, created_by: INBOUND });
  }

  // 3. Auto-odpowiedź botem — tylko raz, tylko z filmikiem, tylko gdy włączona.
  let replied = false;
  if (firstContact && cfg.autoReply && LINKS.film && cfg.accessToken && cfg.igUserId) {
    const reply = replyByKey("film")!.text;
    const sent = await sendMessage(cfg.igUserId, senderId, reply, cfg.accessToken);
    replied = sent.ok;
    await db.from("crm_activities").insert({
      lead_id: leadId,
      type: "ig_dm",
      note: sent.ok ? `Bot odpisał: ${reply}` : `Bot NIE odpisał (${sent.error}) — odpisz ręcznie.`,
      created_by: BOT,
    });
    if (sent.ok) {
      await db
        .from("crm_leads")
        .update({ next_action: "Bot wysłał filmik — czekamy na odpowiedź, potem umów wizytę" })
        .eq("id", leadId);
    }
  }

  return { sender: senderId, username, lead_id: leadId, firstContact, replied };
}
