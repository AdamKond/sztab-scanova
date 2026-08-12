import Link from "next/link";
import Topbar from "@/components/shell/Topbar";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import MetricTile from "@/components/ui/MetricTile";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import { SOURCE_LABELS } from "@/lib/crm/constants";
import {
  computeMrr,
  conversionBetween,
  lossReasons,
  pilotsNeedingCheckin,
} from "@/lib/crm/metrics";
import {
  getSettings,
  listActivities,
  listLeads,
  listStageHistory,
} from "@/lib/crm/queries";
import { daysBetween, fullDate, shortDate, warsawDateOf, warsawToday } from "@/lib/crm/dates";

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});

function pct(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

// Ekran odpowiada na pytania 4 i 5 briefu: ile pilotów konwertuje w abonamenty
// i ile mamy MRR. Pilot NIGDY nie jest tu pokazywany jako płatny klient.
export default async function PilotyPage() {
  const [leads, activities, history, settings] = await Promise.all([
    listLeads(),
    listActivities(),
    listStageHistory(),
    getSettings(),
  ]);

  const today = warsawToday();
  const activePilots = leads
    .filter((l) => l.status === "pilot_aktywny")
    .sort((a, b) => (a.pilot_ends_at ?? "9999").localeCompare(b.pilot_ends_at ?? "9999"));
  const paidClients = leads
    .filter((l) => l.status === "platny_klient")
    .sort((a, b) => (b.monthly_revenue ?? 0) - (a.monthly_revenue ?? 0));
  const churned = leads
    .filter((l) => l.status === "churn")
    .sort((a, b) => (b.churned_at ?? "").localeCompare(a.churned_at ?? ""));
  const quietPilots = pilotsNeedingCheckin(leads, activities, settings.pilot_checkin_after_days);
  const pilotConv = conversionBetween(history, "pilot_aktywny", "platny_klient");
  const mrr = computeMrr(leads);
  const reasons = lossReasons(leads);

  // Ostatni check-in per lead — do kolumny "opieka nad pilotem".
  const lastCheckin = new Map<string, string>();
  for (const a of activities) {
    if (a.type !== "pilot_checkin" || !a.lead_id) continue;
    const prev = lastCheckin.get(a.lead_id);
    if (!prev || a.happened_at > prev) lastCheckin.set(a.lead_id, a.happened_at);
  }

  return (
    <>
      <Topbar title="Piloty i przychód" />

      <div className="anim-in space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <MetricTile label="Aktywne piloty" value={String(activePilots.length)} />
          <MetricTile
            label="Pilot → płatny"
            value={pct(pilotConv.rate)}
            sub={`${pilotConv.toCount} z ${pilotConv.fromCount} pilotów`}
          />
          <MetricTile label="Płatni klienci" value={String(paidClients.length)} tone="success" />
          <MetricTile label="MRR" value={pln.format(mrr)} tone="success" />
          <MetricTile
            label="Churn"
            value={String(churned.length)}
            tone={churned.length > 0 ? "danger" : "default"}
          />
        </div>

        <Card>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">Aktywne piloty</h2>
          {activePilots.length === 0 ? (
            <EmptyState
              title="Brak aktywnych pilotów"
              hint="Umów pilot z leadów po wykonanym demo — zakładka Leady, filtr etapu."
            />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Firma</TH>
                  <TH>Start</TH>
                  <TH>Koniec</TH>
                  <TH className="text-right">Dni do decyzji</TH>
                  <TH>Ostatni check-in</TH>
                  <TH>Następny krok</TH>
                </tr>
              </THead>
              <tbody>
                {activePilots.map((l) => {
                  const left = l.pilot_ends_at
                    ? daysBetween(today, warsawDateOf(l.pilot_ends_at))
                    : null;
                  const checkin = lastCheckin.get(l.id);
                  return (
                    <TR key={l.id}>
                      <TD>
                        <Link href={`/leady/${l.id}`} className="font-medium text-ink hover:text-accent">
                          {l.name}
                        </Link>
                      </TD>
                      <TD>{l.pilot_started_at ? fullDate(l.pilot_started_at) : "—"}</TD>
                      <TD>{l.pilot_ends_at ? fullDate(l.pilot_ends_at) : "—"}</TD>
                      <TD className="text-right">
                        {left === null ? (
                          "—"
                        ) : left < 0 ? (
                          <span className="font-semibold text-danger">po terminie</span>
                        ) : (
                          <span
                            className={
                              left <= settings.pilot_ending_soon_days
                                ? "font-semibold text-danger"
                                : "tabular"
                            }
                          >
                            {left}
                          </span>
                        )}
                      </TD>
                      <TD>
                        {checkin ? (
                          shortDate(checkin)
                        ) : (
                          <span className="font-medium text-warning">brak</span>
                        )}
                      </TD>
                      <TD className="max-w-[220px] truncate">{l.next_action ?? "—"}</TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        {quietPilots.length > 0 ? (
          <Card>
            <h2 className="mb-3 text-[15px] font-semibold text-ink">
              Piloty bez check-inu od {settings.pilot_checkin_after_days} dni
            </h2>
            <ul>
              {quietPilots.map((l) => (
                <li key={l.id} className="flex items-center gap-2 border-b border-line py-3 last:border-0">
                  <Link href={`/leady/${l.id}`} className="text-[14px] font-medium text-ink hover:text-accent">
                    {l.name}
                  </Link>
                  <span className="text-[12px] text-ink-2">
                    zaplanuj check-in — pilot bez opieki nie skonwertuje
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">Płatni klienci</h2>
          {paidClients.length === 0 ? (
            <EmptyState
              title="Jeszcze bez płatnych klientów"
              hint="Domykaj piloty: przejście na płatny wymaga daty płatności, planu i MRR."
            />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Firma</TH>
                  <TH>Plan</TH>
                  <TH className="text-right">MRR</TH>
                  <TH>Płaci od</TH>
                  <TH>Źródło</TH>
                </tr>
              </THead>
              <tbody>
                {paidClients.map((l) => (
                  <TR key={l.id}>
                    <TD>
                      <Link href={`/leady/${l.id}`} className="font-medium text-ink hover:text-accent">
                        {l.name}
                      </Link>
                    </TD>
                    <TD>{l.plan ?? "—"}</TD>
                    <TD className="tabular text-right font-medium text-success">
                      {l.monthly_revenue !== null ? pln.format(l.monthly_revenue) : "—"}
                    </TD>
                    <TD>{l.paid_at ? fullDate(l.paid_at) : "—"}</TD>
                    <TD>{SOURCE_LABELS[l.source]}</TD>
                  </TR>
                ))}
                <tr className="border-t border-line">
                  <TD className="font-semibold">Razem</TD>
                  <TD>{""}</TD>
                  <TD className="tabular text-right font-semibold text-success">{pln.format(mrr)}</TD>
                  <TD>{""}</TD>
                  <TD>{""}</TD>
                </tr>
              </tbody>
            </Table>
          )}
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-[15px] font-semibold text-ink">Churn</h2>
            {churned.length === 0 ? (
              <p className="text-[13px] text-ink-2">Brak rezygnacji. Oby jak najdłużej.</p>
            ) : (
              <ul>
                {churned.map((l) => (
                  <li key={l.id} className="border-b border-line py-3 last:border-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link href={`/leady/${l.id}`} className="text-[14px] font-medium text-ink hover:text-accent">
                        {l.name}
                      </Link>
                      <span className="text-[12px] text-ink-2">
                        {l.churned_at ? fullDate(l.churned_at) : "—"}
                      </span>
                    </div>
                    <p className="text-[13px] text-ink-2">{l.lost_reason ?? "powód nieznany"}</p>
                    {l.monthly_revenue !== null ? (
                      // Utracone MRR pokazujemy wyszarzone: churn NIE wlicza się do MRR.
                      <p className="text-[12px] text-ink-2 line-through">
                        {pln.format(l.monthly_revenue)} / mies.
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-[15px] font-semibold text-ink">Powody utraty i dyskwalifikacji</h2>
            {reasons.lost.length === 0 && reasons.disqualified.length === 0 ? (
              <p className="text-[13px] text-ink-2">
                Brak danych — powody zbierają się przy przejściach w utracony / churn / zdyskwalifikowany.
              </p>
            ) : (
              <div className="space-y-3 text-[13px]">
                {reasons.lost.length > 0 ? (
                  <div>
                    <h3 className="mb-1 font-medium text-ink">Utrata / rezygnacja</h3>
                    <ul className="space-y-1">
                      {reasons.lost.map((r) => (
                        <li key={r.reason} className="flex justify-between gap-2 text-ink-2">
                          <span className="truncate">{r.reason}</span>
                          <span className="tabular font-medium text-ink">{r.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {reasons.disqualified.length > 0 ? (
                  <div>
                    <h3 className="mb-1 font-medium text-ink">Dyskwalifikacja</h3>
                    <ul className="space-y-1">
                      {reasons.disqualified.map((r) => (
                        <li key={r.reason} className="flex justify-between gap-2 text-ink-2">
                          <span className="truncate">{r.reason}</span>
                          <span className="tabular font-medium text-ink">{r.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
