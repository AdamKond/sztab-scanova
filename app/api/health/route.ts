import { NextResponse } from "next/server";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/service";

// Prawdziwy health-check: sprawdza połączenie i obecność tabel rdzenia,
// nie zwraca stałego {ok:true}. Brak konfiguracji i brak migracji to dwa
// różne, jawnie nazwane stany — inaczej debugowanie wdrożenia to zgadywanka.

const CORE_TABLES = [
  "crm_leads",
  "crm_stage_history",
  "crm_activities",
  "crm_settings",
  "crm_dm_blitz",
] as const;

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, status: "nieskonfigurowane", detail: "Brak SUPABASE_URL / SUPABASE_SERVICE_KEY." },
      { status: 503 },
    );
  }

  const db = getServiceClient();
  const missing: string[] = [];
  for (const table of CORE_TABLES) {
    const { error } = await db.from(table).select("*", { count: "exact", head: true }).limit(1);
    if (error) missing.push(table);
  }

  if (missing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        status: "brak_migracji",
        detail: `Brak tabel: ${missing.join(", ")}. Uruchom migracje z supabase/ (001–005).`,
      },
      { status: 503 },
    );
  }

  // Migracja 005 dokłada kolumny follow-upu — bez nich kolejka follow-upów nie zapisze stanu.
  const { error: fuError } = await db.from("crm_dm_blitz").select("followup_sent_at").limit(1);
  if (fuError) {
    return NextResponse.json(
      {
        ok: false,
        status: "brak_migracji_005",
        detail: "Brak kolumn follow-upu w crm_dm_blitz. Uruchom supabase/migration-005-lejek-dm.sql.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, status: "działa", tables: CORE_TABLES.length });
}
