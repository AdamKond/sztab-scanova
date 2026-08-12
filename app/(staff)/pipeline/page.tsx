import Link from "next/link";

import StatusBadge from "@/components/crm/StatusBadge";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Label, Select } from "@/components/ui/Field";
import MetricTile from "@/components/ui/MetricTile";
import { TD, TH, THead, TR, Table } from "@/components/ui/Table";
import {
  FUNNEL_ORDER,
  OPEN_STATUSES,
  SOURCES,
  SOURCE_LABELS,
  STATUS_LABELS,
  TERMINAL_STATUSES,
} from "@/lib/crm/constants";
import { addDays, warsawDateOf, warsawToday } from "@/lib/crm/dates";
import {
  daysToPaid,
  funnelCounts,
  median,
  stageConversions,
  stuckLeads,
  timeInStages,
  winRate,
} from "@/lib/crm/metrics";
import { getSettings, listLeads, listStageHistory } from "@/lib/crm/queries";
import type { LeadStatus } from "@/lib/crm/types";

// Ekran analityczny — NIE jest to miejsce do pracy z leadami (to /leady).
// Layout w (staff)/layout.tsx wymusza requireStaff(), więc tu zakładamy autoryzację.
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type Okres = "30" | "90" | "wszystko";

function paramStr(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

// Procent z jedną wspólną konwencją: brak danych w mianowniku to "—", nie "0%".
function pct(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

function fmtDays(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)} dni`;
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const okresRaw = paramStr(sp.okres);
  const okres: Okres = okresRaw === "30" || okresRaw === "wszystko" ? okresRaw : "90";
  const zrodlo = paramStr(sp.zrodlo) ?? "";
  const prowadzacy = paramStr(sp.prowadzacy) ?? "";

  const [allLeads, allHistory, settings] = await Promise.all([
    listLeads(),
    listStageHistory(),
    getSettings(),
  ]);

  const today = warsawToday();
  const fromDay = okres === "wszystko" ? undefined : addDays(today, -Number(okres));

  // Filtrujemy najpierw leady, potem historię do leadów z przefiltrowanego zbioru —
  // zgodnie z zasadą "lead liczy się do lejka, historia idzie za leadem".
  const filteredLeads = allLeads.filter(
    (l) => (!zrodlo || l.source === zrodlo) && (!prowadzacy || l.owner === prowadzacy),
  );
  const filteredLeadIds = new Set(filteredLeads.map((l) => l.id));
  const historyForLeads = allHistory.filter((h) => filteredLeadIds.has(h.lead_id));
  // Okres zawęża wyłącznie metryki konwersji (stageConversions, winRate) —
  // czas w etapie i zaleganie liczymy z pełnej historii, bo inaczej ucięty
  // okres kłamałby o tym, jak długo lead faktycznie siedzi w etapie.
  const periodHistory = fromDay
    ? historyForLeads.filter((h) => warsawDateOf(h.changed_at) >= fromDay)
    : historyForLeads;

  const owners = [...new Set(allLeads.map((l) => l.owner).filter((o): o is string => !!o))].sort(
    (a, b) => a.localeCompare(b, "pl"),
  );

  // Metryki górne
  const openCount = filteredLeads.filter((l) => OPEN_STATUSES.includes(l.status)).length;
  const wr = winRate(historyForLeads, fromDay, today);
  const medianPaid = median(daysToPaid(historyForLeads));
  const newInPeriod = filteredLeads.filter((l) => {
    const day = warsawDateOf(l.created_at);
    return (!fromDay || day >= fromDay) && day <= today;
  }).length;

  // Lejek — stan obecny
  const funnelStatuses: LeadStatus[] = [...FUNNEL_ORDER, "followup_pozniej", ...TERMINAL_STATUSES];
  const counts = funnelCounts(filteredLeads);
  const maxCount = Math.max(1, ...funnelStatuses.map((s) => counts.get(s) ?? 0));

  const conversions = stageConversions(periodHistory);
  const stageTimes = timeInStages(historyForLeads);
  const stuck = stuckLeads(filteredLeads, historyForLeads, settings.stage_stuck_after_days);

  return (
    <>
      <Topbar title="Pipeline">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="okres">Okres</Label>
            <Select id="okres" name="okres" defaultValue={okres} className="w-40">
              <option value="30">Ostatnie 30 dni</option>
              <option value="90">Ostatnie 90 dni</option>
              <option value="wszystko">Wszystko</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="zrodlo">Źródło</Label>
            <Select id="zrodlo" name="zrodlo" defaultValue={zrodlo} className="w-44">
              <option value="">Wszystkie</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="prowadzacy">Prowadzący</Label>
            <Select id="prowadzacy" name="prowadzacy" defaultValue={prowadzacy} className="w-44">
              <option value="">Wszyscy</option>
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="primary" size="sm">
            Filtruj
          </Button>
        </form>
      </Topbar>

      <div className="anim-in space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricTile label="Otwarte leady" value={String(openCount)} />
          <MetricTile
            label="Win rate"
            value={pct(wr.rate)}
            sub={`${wr.won} / ${wr.won + wr.lost + wr.churned} (wygrane / (wygrane+utracone+churn))`}
          />
          <MetricTile label="Mediana dni do płatności" value={fmtDays(medianPaid)} />
          <MetricTile label="Nowe leady w okresie" value={String(newInPeriod)} />
        </div>

        <Card>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">Lejek — stan obecny</h2>
          {filteredLeads.length === 0 ? (
            <EmptyState
              title="Brak leadów dla wybranych filtrów"
              hint="Zmień źródło lub prowadzącego, żeby zobaczyć lejek."
            />
          ) : (
            <div className="space-y-2">
              {funnelStatuses.map((status) => {
                const count = counts.get(status) ?? 0;
                const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
                const isTerminal = TERMINAL_STATUSES.includes(status);
                const barColor = isTerminal
                  ? "bg-neutral-300"
                  : status === "platny_klient"
                    ? "bg-success"
                    : "bg-accent";
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div
                      className={`w-44 shrink-0 truncate text-[13px] ${isTerminal ? "text-ink-2" : "text-ink"}`}
                    >
                      {STATUS_LABELS[status]}
                    </div>
                    <div className="relative h-5 flex-1 rounded bg-canvas">
                      <div className={`h-5 rounded ${barColor}`} style={{ width: `${width}%` }} />
                    </div>
                    <div className="tabular w-10 shrink-0 text-right text-[13px] font-medium text-ink">
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 text-[15px] font-semibold text-ink">Konwersje między etapami</h2>
          <p className="mb-3 text-[12px] italic text-ink-2">
            Lead liczy się jako „osiągnął etap”, jeśli KIEDYKOLWIEK wszedł w ten etap lub dalszy —
            utracony po demo nadal wykonał demo.
          </p>
          {conversions.every((c) => c.fromCount === 0) ? (
            <EmptyState
              title="Brak danych o konwersjach"
              hint="W wybranym okresie nie odnotowano zmian statusów."
            />
          ) : (
            <Table>
              <THead>
                <TH>Etap → Etap</TH>
                <TH className="text-right">Licznik / mianownik</TH>
                <TH className="text-right">Procent</TH>
              </THead>
              <tbody>
                {conversions.map((c) => (
                  <TR key={`${c.from}-${c.to}`}>
                    <TD>
                      {STATUS_LABELS[c.from]} → {STATUS_LABELS[c.to]}
                    </TD>
                    <TD className="tabular text-right">
                      {c.toCount} / {c.fromCount}
                    </TD>
                    <TD className="tabular text-right font-medium">{pct(c.rate)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 text-[15px] font-semibold text-ink">Czas w etapie</h2>
          <p className="mb-3 text-[12px] text-ink-2">
            Czas w bieżącym (jeszcze niezakończonym) etapie liczy się do dziś.
          </p>
          <Table>
            <THead>
              <TH>Etap</TH>
              <TH className="text-right">Liczba przejść</TH>
              <TH className="text-right">Średnio (dni)</TH>
              <TH className="text-right">Mediana (dni)</TH>
            </THead>
            <tbody>
              {stageTimes.map((s) => (
                <TR key={s.status}>
                  <TD>{STATUS_LABELS[s.status]}</TD>
                  <TD className="tabular text-right">{s.count}</TD>
                  <TD className="tabular text-right">
                    {s.avgDays === null ? "—" : s.avgDays.toFixed(1)}
                  </TD>
                  <TD className="tabular text-right">
                    {s.medianDays === null ? "—" : s.medianDays.toFixed(1)}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-ink">Zalegający</h2>
            <div className="text-[12px] text-ink-2">
              próg: {settings.stage_stuck_after_days} dni — zmienisz w{" "}
              <Link href="/ustawienia" className="text-accent hover:underline">
                Ustawieniach
              </Link>
            </div>
          </div>
          {stuck.length === 0 ? (
            <EmptyState
              title="Brak zalegających leadów"
              hint="Wszystkie otwarte leady mieszczą się w progu czasu na etapie."
            />
          ) : (
            <Table>
              <THead>
                <TH>Nazwa</TH>
                <TH>Etap</TH>
                <TH className="text-right">Dni w etapie</TH>
                <TH>Prowadzący</TH>
                <TH>Następny krok</TH>
              </THead>
              <tbody>
                {stuck.map(({ lead, daysInStage }) => {
                  const veryStuck = daysInStage > settings.stage_stuck_after_days * 2;
                  return (
                    <TR key={lead.id}>
                      <TD>
                        <Link href={`/leady/${lead.id}`} className="text-accent hover:underline">
                          {lead.name}
                        </Link>
                      </TD>
                      <TD>
                        <StatusBadge status={lead.status} />
                      </TD>
                      <TD
                        className={`tabular text-right font-medium ${veryStuck ? "text-danger" : "text-ink"}`}
                      >
                        {daysInStage}
                      </TD>
                      <TD>{lead.owner ?? "—"}</TD>
                      <TD className="max-w-[240px] truncate">{lead.next_action ?? "—"}</TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
