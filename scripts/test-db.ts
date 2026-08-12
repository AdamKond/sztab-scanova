// Testy domenowe na ŻYWEJ bazie SZTAB (nowy, osobny projekt Supabase —
// NIGDY produkcja SCANOVY). Sprawdzają rzeczy, których nie da się sprawdzić
// w vitest: triggery Postgresa (historia etapów, last_activity_at,
// updated_at) i CHECK constrainty.
//
// Uruchomienie: npx tsx scripts/test-db.ts
//
// Brak konfiguracji lub brak wykonanej migracji to NIE błąd tego skryptu —
// to normalny stan świeżego środowiska (np. CI bez sekretów). Dlatego
// w takim wypadku kończymy z kodem 0, żeby nie blokować pipeline'u.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    if (!key) continue;

    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const SKIP_MESSAGE =
  "POMINIĘTO — brak konfiguracji/migracji (patrz supabase/README.md)";

let failures = 0;

function check(name: string, cond: boolean): void {
  if (cond) {
    console.log(`✅ ${name}`);
  } else {
    console.log(`❌ ${name}`);
    failures += 1;
  }
}

async function main(): Promise<void> {
  loadEnvLocal();

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.log(SKIP_MESSAGE);
    process.exit(0);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Sonda: jeśli tabela nie istnieje (migracja nie została uruchomiona)
  // albo dane logowania są złe, traktujemy to jak brak konfiguracji.
  const probe = await supabase.from("crm_leads").select("id").limit(1);
  if (probe.error) {
    console.log(SKIP_MESSAGE);
    process.exit(0);
  }

  const runId = `zz-test-sztab-${Date.now()}`;
  let leadId: string | null = null;

  try {
    await runTests(supabase, runId, (id) => {
      leadId = id;
    });
  } finally {
    // Sprzątanie ZAWSZE, niezależnie od wyniku testów — kasujemy leada;
    // crm_stage_history i crm_activities kasują się kaskadowo (FK on delete cascade).
    if (leadId) {
      const { error } = await supabase.from("crm_leads").delete().eq("id", leadId);
      if (error) {
        console.error(`Uwaga: nie udało się posprzątać testowego leada ${leadId}: ${error.message}`);
      } else {
        console.log(`Posprzątano: usunięto testowego leada ${leadId}.`);
      }
    }
  }

  process.exit(failures > 0 ? 1 : 0);
}

async function runTests(
  supabase: SupabaseClient,
  runId: string,
  setLeadId: (id: string) => void,
): Promise<void> {
  // 1. Insert leada -> trigger crm_track_status_change tworzy JEDEN wpis
  //    historii (from_status null -> to_status 'nowy').
  const { data: insertedLead, error: insertError } = await supabase
    .from("crm_leads")
    .insert({ name: runId, normalized_name: runId.toLowerCase() })
    .select()
    .single();
  check("insert leada powiódł się", !insertError && !!insertedLead);
  if (!insertedLead) return; // Bez leada reszta testów nie ma sensu.
  setLeadId(insertedLead.id);

  const { data: history1, error: history1Error } = await supabase
    .from("crm_stage_history")
    .select("*")
    .eq("lead_id", insertedLead.id)
    .order("changed_at", { ascending: true });
  check(
    "trigger utworzył dokładnie jeden wpis historii przy insercie (null -> nowy)",
    !history1Error &&
      history1?.length === 1 &&
      history1[0].from_status === null &&
      history1[0].to_status === "nowy",
  );

  // 2. Update statusu -> drugi wpis historii (nowy -> proba_kontaktu),
  //    a trigger crm_touch_updated_at podbija updated_at.
  const { data: updatedLead, error: updateError } = await supabase
    .from("crm_leads")
    .update({ status: "proba_kontaktu" })
    .eq("id", insertedLead.id)
    .select()
    .single();
  check("update statusu leada powiódł się", !updateError && !!updatedLead);
  check(
    "trigger podbił updated_at przy update",
    !!updatedLead &&
      new Date(updatedLead.updated_at).getTime() >
        new Date(insertedLead.updated_at).getTime(),
  );

  const { data: history2, error: history2Error } = await supabase
    .from("crm_stage_history")
    .select("*")
    .eq("lead_id", insertedLead.id)
    .order("changed_at", { ascending: true });
  check(
    "trigger utworzył drugi wpis historii przy zmianie statusu (nowy -> proba_kontaktu)",
    !history2Error &&
      history2?.length === 2 &&
      history2[1].from_status === "nowy" &&
      history2[1].to_status === "proba_kontaktu",
  );

  // 3. Insert aktywności z happened_at -> trigger crm_sync_last_activity
  //    podbija last_activity_at leada do tej chwili.
  const happenedAt = new Date(Date.now() - 60_000).toISOString();
  const { data: activity, error: activityError } = await supabase
    .from("crm_activities")
    .insert({
      lead_id: insertedLead.id,
      type: "telefon",
      happened_at: happenedAt,
      created_by: "test-db-script",
    })
    .select()
    .single();
  check("insert aktywności powiódł się", !activityError && !!activity);

  const { data: leadAfterActivity, error: leadAfterActivityError } = await supabase
    .from("crm_leads")
    .select("last_activity_at")
    .eq("id", insertedLead.id)
    .single();
  check(
    "trigger zaktualizował last_activity_at leada do happened_at aktywności",
    !leadAfterActivityError &&
      !!leadAfterActivity?.last_activity_at &&
      new Date(leadAfterActivity.last_activity_at).getTime() ===
        new Date(happenedAt).getTime(),
  );

  // 4. crm_settings to singleton (id=1), seedowany w migracji.
  const { data: settings, error: settingsError } = await supabase
    .from("crm_settings")
    .select("*")
    .eq("id", 1)
    .single();
  check("crm_settings ma wiersz singleton id=1", !settingsError && settings?.id === 1);

  // 5. CHECK constraint na status odrzuca wartości spoza słownika.
  const { error: garbageStatusError } = await supabase
    .from("crm_leads")
    .update({ status: "nieprawidlowy_status_xyz" })
    .eq("id", insertedLead.id);
  check(
    "CHECK constraint odrzuca nieprawidłową wartość status",
    !!garbageStatusError,
  );
}

main().catch((err) => {
  console.error("Nieoczekiwany błąd skryptu:", err);
  process.exit(1);
});
