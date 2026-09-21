// Baza — wszystkie lokale do zaczepienia. Stąd bierze się kolejka na Dziś.

import Topbar from "@/components/shell/Topbar";
import MetricTile from "@/components/ui/MetricTile";
import BazaList from "@/components/baza/BazaList";
import AddLokal from "@/components/baza/AddLokal";
import { listDmBlitz } from "@/lib/crm/queries";
import { blitzCounts } from "@/lib/crm/blitz";

export default async function BazaPage() {
  const rows = await listDmBlitz();
  const now = Date.now();
  const counts = blitzCounts(rows, now);
  const replied = counts.in_crm;
  const contacted = rows.length - counts.todo;
  const replyRate = contacted > 0 ? Math.round((100 * replied) / contacted) : null;

  return (
    <>
      <Topbar title="Baza" subtitle={`${rows.length} lokali. Kolejka na Dziś układa się stąd: nisze o największej częstotliwości wizyt pierwsze.`} actions={<AddLokal />} />

      <div className="anim-in space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <MetricTile label="Do wysłania" value={String(counts.todo)} />
          <MetricTile label="Czeka na odpowiedź" value={String(counts.waiting + counts.followed_up)} sub={counts.followup_due ? `${counts.followup_due} do follow-upu` : undefined} tone={counts.followup_due ? "warning" : "default"} />
          <MetricTile label="Odpowiedziało" value={String(replied)} tone={replied ? "success" : "default"} />
          <MetricTile label="Skuteczność" value={replyRate === null ? "—" : `${replyRate}%`} sub={contacted ? `${replied} z ${contacted} zaczepionych` : "zacznij wysyłać"} />
        </div>

        <BazaList rows={rows} now={now} />
      </div>
    </>
  );
}
