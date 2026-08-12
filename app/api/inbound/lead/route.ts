import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/service";
import { findDuplicateCandidates } from "@/lib/crm/queries";
import {
  normalizeDomain,
  normalizeInstagram,
  normalizeName,
  normalizePhone,
  normalizeWww,
  clampText,
} from "@/lib/crm/normalize";

// Tokenowany endpoint przyjmowania leadów z formularza landingu (Etap 2).
//
// Zasady:
// - bez poprawnego tokenu odpowiadamy 404 (nie 401) — endpoint ma nie istnieć
//   dla skanera, dokładnie jak reszta prywatnej powierzchni SZTAB-u,
// - duplikat po telefonie/Instagramie/nazwie+mieście NIE tworzy drugiego leada,
//   tylko dopisuje aktywność "notatka" do istniejącego — formularz wysłany
//   drugi raz to sygnał zainteresowania, nie nowa firma,
// - UTM-y trafiają w source_detail/campaign; źródło zawsze "inbound".

const MAX_BODY = 32 * 1024; // 32 kB — formularz, nie upload

// Prosty limit per IP w pamięci procesu: landing to publiczny internet.
const buckets = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (buckets.get(ip) ?? []).filter((t) => t > now - 60_000);
  if (recent.length >= 10) {
    buckets.set(ip, recent);
    return true;
  }
  recent.push(now);
  buckets.set(ip, recent);
  return false;
}

function str(v: unknown, max = 200): string | null {
  return typeof v === "string" ? clampText(v, max) : null;
}

export async function POST(request: NextRequest) {
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  // Funkcja wyłączona (brak sekretu) = endpoint nie istnieje.
  if (!secret || !isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const token = request.headers.get("x-inbound-token") ?? request.nextUrl.searchParams.get("token");
  if (token !== secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Za dużo zgłoszeń. Spróbuj za chwilę." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) {
      return NextResponse.json({ error: "Zgłoszenie zbyt duże." }, { status: 413 });
    }
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy JSON." }, { status: 400 });
  }

  const name = str(body.name, 160);
  if (!name) {
    return NextResponse.json({ error: "Pole name jest wymagane." }, { status: 400 });
  }

  const phone = normalizePhone(str(body.phone));
  const instagram = normalizeInstagram(str(body.instagram));
  const www = normalizeWww(str(body.www));
  const city = str(body.city);
  const message = str(body.message, 2000);
  const utmSource = str(body.utm_source);
  const utmMedium = str(body.utm_medium);
  const utmCampaign = str(body.utm_campaign);
  const normalized = normalizeName(name);

  const db = getServiceClient();

  // Dedup jak w imporcie: pewny duplikat nie tworzy nowej firmy.
  const candidates = await findDuplicateCandidates({
    normalized_name: normalized,
    phone,
    instagram,
    domain: normalizeDomain(str(body.www)),
  });
  const certain = candidates.find(
    (c) =>
      (phone && c.phone === phone) ||
      (instagram && c.instagram === instagram) ||
      (c.normalized_name === normalized &&
        city &&
        c.city &&
        c.city.toLowerCase() === city.toLowerCase()),
  );

  if (certain) {
    const { error } = await db.from("crm_activities").insert({
      lead_id: certain.id,
      type: "notatka",
      outcome: "zainteresowany",
      note: `Ponowne zgłoszenie z landingu${message ? `: ${message}` : "."}${
        utmCampaign ? ` (kampania: ${utmCampaign})` : ""
      }`,
      created_by: "landing@inbound",
    });
    if (error) {
      return NextResponse.json({ error: "Błąd zapisu." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const { data, error } = await db
    .from("crm_leads")
    .insert({
      name,
      normalized_name: normalized,
      city,
      category: str(body.category),
      phone,
      email: str(body.email),
      instagram,
      www,
      source: "inbound",
      source_detail: [utmSource, utmMedium].filter(Boolean).join(" / ") || null,
      campaign: utmCampaign,
      // Zgłoszenie z formularza = firma sama się odezwała; priorytet B do ręcznej
      // kwalifikacji, nie A — o A decyduje człowiek po weryfikacji ICP.
      priority: "B",
      notes: message ? `Wiadomość z landingu: ${message}` : null,
      next_action: "Oddzwonić / odpisać na zgłoszenie z landingu",
      // Lead z formularza stygnie błyskawicznie — kontakt ma być tego samego dnia.
      next_action_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ error: "Błąd zapisu." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
