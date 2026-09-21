// Klienci — piloty (miesiąc za darmo), płatni i ci, którzy odeszli. Pilot NIGDY
// nie jest pokazywany jako płatny klient; MRR liczy tylko płacących.

import Link from "next/link";
import Topbar from "@/components/shell/Topbar";
import Card, { CardTitle } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import MetricTile from "@/components/ui/MetricTile";
import { listLeads } from "@/lib/crm/queries";
import { computeMrr } from "@/lib/crm/metrics";
import { daysBetween, fullDate, shortDate, warsawDateOf, warsawToday } from "@/lib/crm/dates";
import type { CrmLead } from "@/lib/crm/types";

const pln = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 });

function Row({ lead, right, sub }: { lead: CrmLead; right?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <li>
      <Link href={`/rozmowy/${lead.id}`} className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-canvas">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-ink">{lead.name}</div>
          {sub ? <div className="mt-0.5 truncate text-[13px] text-ink-2">{sub}</div> : null}
        </div>
        {right ? <div className="shrink-0 text-right text-[13px]">{right}</div> : null}
      </Link>
    </li>
  );
}

export default async function KlienciPage() {
  const leads = await listLeads();
  const today = warsawToday();

  const pilots = leads
    .filter((l) => l.status === "pilot_aktywny")
    .sort((a, b) => (a.pilot_ends_at ?? "9999").localeCompare(b.pilot_ends_at ?? "9999"));
  const paid = leads
    .filter((l) => l.status === "platny_klient")
    .sort((a, b) => (b.monthly_revenue ?? 0) - (a.monthly_revenue ?? 0));
  const churned = leads
    .filter((l) => l.status === "churn")
    .sort((a, b) => (b.churned_at ?? "").localeCompare(a.churned_at ?? ""));
  const mrr = computeMrr(leads);

  return (
    <>
      <Topbar title="Klienci" subtitle="Piloty, płacący i ci, którzy odeszli." />

      <div className="anim-in space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <MetricTile label="Piloty" value={String(pilots.length)} />
          <MetricTile label="Płacący" value={String(paid.length)} tone="success" />
          <MetricTile label="MRR" value={pln.format(mrr)} tone="success" sub="miesięcznie, tylko płacący" />
          <MetricTile label="Odeszli" value={String(churned.length)} tone={churned.length ? "danger" : "default"} />
        </div>

        <Card>
          <CardTitle count={pilots.length}>Piloty</CardTitle>
          {pilots.length === 0 ? (
            <EmptyState title="Brak aktywnych pilotów" hint="Po demo kliknij w rozmowie „Dalej: Pilot” — pilot startuje z datą końca za 30 dni." />
          ) : (
            <ul className="-mx-3">
              {pilots.map((l) => {
                const left = l.pilot_ends_at ? daysBetween(today, warsawDateOf(l.pilot_ends_at)) : null;
                return (
                  <Row
                    key={l.id}
                    lead={l}
                    sub={`${l.pilot_started_at ? shortDate(l.pilot_started_at) : "—"} – ${l.pilot_ends_at ? shortDate(l.pilot_ends_at) : "—"}${l.next_action ? ` · ${l.next_action}` : ""}`}
                    right={
                      left === null ? (
                        "—"
                      ) : left < 0 ? (
                        <span className="font-semibold text-danger">po terminie</span>
                      ) : (
                        <span className={left <= 7 ? "font-semibold text-warning" : "text-ink-2"}>{left} dni</span>
                      )
                    }
                  />
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle count={paid.length}>Płacący</CardTitle>
          {paid.length === 0 ? (
            <EmptyState title="Jeszcze nikt nie płaci" hint="Pod koniec pilota: „Dalej: Płaci” z planem i kwotą miesięczną." />
          ) : (
            <ul className="-mx-3">
              {paid.map((l) => (
                <Row
                  key={l.id}
                  lead={l}
                  sub={`${l.plan ?? "—"} · od ${l.paid_at ? fullDate(l.paid_at) : "—"}`}
                  right={<span className="tabular font-semibold text-success">{l.monthly_revenue !== null ? pln.format(l.monthly_revenue) : "—"}</span>}
                />
              ))}
            </ul>
          )}
        </Card>

        {churned.length > 0 ? (
          <Card>
            <CardTitle count={churned.length}>Odeszli</CardTitle>
            <ul className="-mx-3">
              {churned.map((l) => (
                <Row
                  key={l.id}
                  lead={l}
                  sub={l.lost_reason ?? "powód nieznany"}
                  right={<span className="text-ink-3">{l.churned_at ? fullDate(l.churned_at) : "—"}</span>}
                />
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </>
  );
}
