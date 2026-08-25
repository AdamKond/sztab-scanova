import Topbar from "@/components/shell/Topbar";
import EmptyState from "@/components/ui/EmptyState";
import { listDmBlitz } from "@/lib/crm/queries";
import type { CrmDmBlitz } from "@/lib/crm/blitz";
import WysylkaList from "./WysylkaList";

// Ekran "Wysyłka DM": wspólna checklista masowej kampanii Instagram.
// Stan (kto wysłany, przez kogo) żyje w bazie, więc Adam i Oliwier widzą
// to samo z każdego urządzenia. Kto odpowie — jednym kliknięciem staje się
// leadem w crm_leads i dalej idzie normalnym pipeline'em.

export default async function WysylkaPage() {
  let rows: CrmDmBlitz[] = [];
  let missingTable = false;
  try {
    rows = await listDmBlitz();
  } catch (err) {
    // Brak tabeli = migracja 004 jeszcze nie wykonana. To jedyny błąd, który
    // pokazujemy miękko — reszta ma failować głośno jak wszędzie w SZTAB.
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("crm_dm_blitz")) throw err;
    missingTable = true;
  }

  return (
    <>
      <Topbar title="Wysyłka DM" />
      {missingTable ? (
        <EmptyState
          title="Tabela kampanii jeszcze nie istnieje"
          hint="Uruchom supabase/migration-004-wysylka-dm.sql w SQL Editorze Supabase (tak jak migracje 001–003). Zasieje też całą listę 219 lokali."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Brak lokali w kampanii"
          hint="Zasiew z migracji 004 nie wszedł — uruchom ją ponownie na pustej tabeli."
        />
      ) : (
        <WysylkaList initialRows={rows} />
      )}
    </>
  );
}
