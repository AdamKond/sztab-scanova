import Link from "next/link";
import Topbar from "@/components/shell/Topbar";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import MetricTile from "@/components/ui/MetricTile";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/crm/StatusBadge";
import PriorityBadge from "@/components/crm/PriorityBadge";
import QuickActivity from "@/components/crm/QuickActivity";
import {
  listActivities,
  listGoals,
  listLeads,
  listStageHistory,
  getSettings,
} from "@/lib/crm/queries";
import {
  computeMrr,
  followupBuckets,
  goalProgress,
  leadsWithoutNextStep,
  pilotsEndingSoon,
  pilotsNeedingCheckin,
  reachedAtLeast,
  staleLeads,
} from "@/lib/crm/metrics";
import {
  ACTIVITY_LABELS,
  OPEN_STATUSES,
  OUTCOME_LABELS,
} from "@/lib/crm/constants";
import {
  daysAgoLabel,
  daysBetween,
  daysSince,
  shortDateTime,
  warsawDateOf,
  warsawToday,
} from "@/lib/crm/dates";
import type { CrmLead } from "@/lib/crm/types";

const plnFormat = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});

// Krótka forma autora: część e-maila przed @ wystarcza przy dwóch osobach.
function person(email: string | null): string {
  return email ? email.split("@")[0] : "—";
}

function LeadRow({ lead, detail }: { lead: CrmLead; detail?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line py-3 last:border-0">
      <Link
        href={`/leady/${lead.id}`}
        className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink hover:text-accent"
      >
        {lead.name}
      </Link>
      <StatusBadge status={lead.status} />
      <PriorityBadge priority={lead.priority} />
      {detail ? <span className="w-full text-[12px] text-ink-2 sm:w-auto">{detail}</span> : null}
    </li>
  );
}

function Section({
  title,
  count,
  tone = "default",
  children,
}: {
  title: string;
  count?: number;
  tone?: "default" | "danger" | "amber";
  children: React.ReactNode;
}) {
  const badgeClass =
    tone === "danger"
      ? "bg-red-50 text-red-700 border-red-100"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700 border-amber-100"
        : "bg-neutral-100 text-neutral-700 border-neutral-200";
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {count !== undefined ? (
          <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${badgeClass}`}>
            {count}
          </span>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

export default async function DzisPage({
  searchParams,
}: {
  searchParams: Promise<{ szybki?: string }>;
}) {
  const sp = await searchParams;
  const [leads, activities, history, goals, settings] = await Promise.all([
    listLeads(),
    listActivities(),
    listStageHistory(),
    listGoals(),
    getSettings(),
  ]);

  const today = warsawToday();
  const followups = followupBuckets(leads);
  const aWithoutStep = leadsWithoutNextStep(leads).filter((l) => l.priority === "A");
  const endingPilots = pilotsEndingSoon(leads, settings.pilot_ending_soon_days);
  const quietPilots = pilotsNeedingCheckin(leads, activities, settings.pilot_checkin_after_days);
  const stale = staleLeads(leads, settings.stale_after_days).filter(
    (l) => !followups.overdue.some((f) => f.id === l.id) && !followups.today.some((f) => f.id === l.id),
  );
  const demosToday = leads.filter(
    (l) => l.status === "demo_umowione" && l.next_action_at && warsawDateOf(l.next_action_at) === today,
  );
  const reached = reachedAtLeast(history);
  const recentActivities = activities.slice(0, 10);
  const leadName = new Map(leads.map((l) => [l.id, l.name]));

  const activeGoals = goals.filter((g) => g.active && g.ends_on >= today && g.starts_on <= today);
  const mrr = computeMrr(leads);

  const openLeads = leads
    .filter((l) => OPEN_STATUSES.includes(l.status))
    .map((l) => ({ id: l.id, name: l.name, status: l.status }))
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));

  const quickOpen = sp.szybki === "1";
  const allQuietSections =
    followups.overdue.length === 0 && stale.length === 0 && quietPilots.length === 0;

  return (
    <>
      <Topbar
        title="Dziś"
        actions={
          <Link href={quickOpen ? "/" : "/?szybki=1"}>
            <Button variant="primary">{quickOpen ? "× Zamknij" : "+ Szybki wpis"}</Button>
          </Link>
        }
      />

      <div className="anim-in space-y-6">
        {quickOpen ? (
          <Card>
            <h2 className="mb-3 text-[15px] font-semibold text-ink">Szybki wpis</h2>
            <QuickActivity leads={openLeads} />
          </Card>
        ) : null}

        {/* KPI dnia: przejścia lejka i pieniądze, nie liczba klików. */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <MetricTile
            label="Kontakty z decydentem"
            value={String(reached.get("kontakt_zdecydentem")?.size ?? 0)}
            sub="łącznie, z historii etapów"
          />
          <MetricTile
            label="Demo wykonane"
            value={String(reached.get("demo_wykonane")?.size ?? 0)}
            sub="łącznie, z historii etapów"
          />
          <MetricTile
            label="Piloty aktywne"
            value={String(leads.filter((l) => l.status === "pilot_aktywny").length)}
          />
          <MetricTile
            label="Płatni klienci"
            value={String(leads.filter((l) => l.status === "platny_klient").length)}
            tone="success"
          />
          <MetricTile label="MRR" value={plnFormat.format(mrr)} tone="success" />
        </div>

        {allQuietSections ? (
          <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-[13px] font-medium text-green-700">
            Brak zaległości, stygnących leadów i cichych pilotów — czysta karta. Idź w teren. 💪
          </p>
        ) : null}

        {followups.overdue.length > 0 ? (
          <Section title="Zaległe follow-upy" count={followups.overdue.length} tone="danger">
            <ul>
              {followups.overdue.map((l) => (
                <LeadRow
                  key={l.id}
                  lead={l}
                  detail={
                    <>
                      <span className="font-medium text-danger">
                        {daysBetween(warsawDateOf(l.next_action_at!), today)} dni po terminie
                      </span>
                      {l.next_action ? ` · ${l.next_action}` : null}
                    </>
                  }
                />
              ))}
            </ul>
          </Section>
        ) : null}

        <Section title="Follow-upy na dziś" count={followups.today.length}>
          {followups.today.length === 0 ? (
            <EmptyState
              title="Brak follow-upów na dziś"
              hint="Zaplanuj następne kroki przy leadach — pusty dzień to okazja na teren."
            />
          ) : (
            <ul>
              {followups.today.map((l) => (
                <LeadRow key={l.id} lead={l} detail={l.next_action ?? undefined} />
              ))}
            </ul>
          )}
        </Section>

        {demosToday.length > 0 ? (
          <Section title="Demo dziś" count={demosToday.length}>
            <ul>
              {demosToday.map((l) => (
                <LeadRow key={l.id} lead={l} detail={l.next_action ?? undefined} />
              ))}
            </ul>
          </Section>
        ) : null}

        {aWithoutStep.length > 0 ? (
          <Section title="Leady A bez następnego kroku" count={aWithoutStep.length} tone="amber">
            <ul>
              {aWithoutStep.map((l) => (
                <LeadRow
                  key={l.id}
                  lead={l}
                  detail="najlepsze dopasowanie ICP czeka na plan — ustaw następny krok"
                />
              ))}
            </ul>
          </Section>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Piloty kończące się" count={endingPilots.length} tone="amber">
            {endingPilots.length === 0 ? (
              <p className="text-[13px] text-ink-2">
                Żaden pilot nie kończy się w ciągu {settings.pilot_ending_soon_days} dni.
              </p>
            ) : (
              <ul>
                {endingPilots.map((l) => {
                  const left = daysBetween(today, warsawDateOf(l.pilot_ends_at!));
                  return (
                    <LeadRow
                      key={l.id}
                      lead={l}
                      detail={
                        left < 0 ? (
                          <span className="font-medium text-danger">po terminie — czas na decyzję</span>
                        ) : (
                          `${left} dni do decyzji`
                        )
                      }
                    />
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="Piloty bez check-inu" count={quietPilots.length} tone="danger">
            {quietPilots.length === 0 ? (
              <p className="text-[13px] text-ink-2">
                Wszystkie piloty mają check-in z ostatnich {settings.pilot_checkin_after_days} dni.
              </p>
            ) : (
              <ul>
                {quietPilots.map((l) => (
                  <LeadRow key={l.id} lead={l} detail="umów check-in — pilot bez opieki nie skonwertuje" />
                ))}
              </ul>
            )}
          </Section>
        </div>

        {stale.length > 0 ? (
          <Section title="Stygnące leady" count={stale.length} tone="amber">
            <ul>
              {stale.slice(0, 8).map((l) => (
                <LeadRow
                  key={l.id}
                  lead={l}
                  detail={`${daysAgoLabel(daysSince(l.last_activity_at ?? l.created_at))} ciszy · prowadzi ${person(l.owner)}`}
                />
              ))}
            </ul>
            {stale.length > 8 ? (
              <Link
                href="/leady?stygnace=1"
                className="mt-2 inline-block text-[13px] font-medium text-accent hover:underline"
              >
                Wszystkie stygnące ({stale.length}) →
              </Link>
            ) : null}
          </Section>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Aktywne cele" count={activeGoals.length}>
            {activeGoals.length === 0 ? (
              <EmptyState
                title="Brak aktywnych celów"
                hint="Ustaw cel sprintu w zakładce Cele — bez celu nie ma tempa."
                action={
                  <Link href="/cele">
                    <Button size="sm">Przejdź do celów</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-3">
                {activeGoals.map((g) => {
                  const p = goalProgress(g, { leads, activities, history });
                  const pct = p.progress === null ? 0 : Math.min(100, Math.round(p.progress * 100));
                  const done = p.progress !== null && p.progress >= 1;
                  const isMrr = g.metric === "mrr";
                  return (
                    <li key={g.id}>
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="text-[13px] font-medium text-ink">{g.name}</span>
                        <span className="tabular text-[12px] text-ink-2">
                          {isMrr ? plnFormat.format(p.actual) : p.actual} /{" "}
                          {isMrr ? plnFormat.format(g.target_value) : g.target_value}
                          {" · "}
                          {Math.max(0, daysBetween(today, g.ends_on))} dni
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className={`h-full rounded-full ${done ? "bg-success" : "bg-accent"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="Ostatnie aktywności">
            {recentActivities.length === 0 ? (
              <EmptyState
                title="Brak aktywności"
                hint="Dodaj pierwszy wpis przyciskiem „+ Szybki wpis” u góry."
              />
            ) : (
              <ul>
                {recentActivities.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-line py-3 text-[13px] last:border-0"
                  >
                    <span className="font-medium text-ink">{ACTIVITY_LABELS[a.type]}</span>
                    {a.outcome ? <span className="text-ink-2">· {OUTCOME_LABELS[a.outcome]}</span> : null}
                    {a.lead_id && leadName.get(a.lead_id) ? (
                      <Link href={`/leady/${a.lead_id}`} className="text-accent hover:underline">
                        {leadName.get(a.lead_id)}
                      </Link>
                    ) : null}
                    <span className="ml-auto text-[12px] text-ink-2">
                      {shortDateTime(a.happened_at)} · {person(a.created_by)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
