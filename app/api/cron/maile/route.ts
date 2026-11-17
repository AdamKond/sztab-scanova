import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/service";
import { runMailCron } from "@/lib/crm/mail/run";

// Cron Vercela (vercel.json → crons) woła ten endpoint co kilkanaście minut.
// Vercel sam dokłada nagłówek Authorization: Bearer <CRON_SECRET>; bez
// zgodnego sekretu odpowiadamy 404 (endpoint ma nie istnieć dla obcych).
//
// Jedno uruchomienie: przeczytaj skrzynki → wyślij partię. Okno godzin,
// limity i rozgrzewkę pilnuje lib/crm/mail/plan.ts — cron może chodzić
// częściej niż trzeba, poza oknem nic nie wysyła.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : request.nextUrl.searchParams.get("token")?.trim();
  if (token !== secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const result = await runMailCron(new Date());
    return NextResponse.json({ ok: true, ...result, inbox: { ...result.inbox }, at: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
