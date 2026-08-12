// Lista leadów — domyślnie gęsta tabela (nie kanban). Wszystkie filtry żyją
// w URL (GET), żeby dało się wysłać link koledze/koleżance z drugiego konta.
// Filtrujemy w JS po jednym listLeads() — SZTAB ma 2 osoby i mały zbiór
// danych, więc osobne zapytania per filtr byłyby czystą stratą.

import Link from "next/link";
import Topbar from "@/components/shell/Topbar";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import StatusBadge from "@/components/crm/StatusBadge";
import PriorityBadge from "@/components/crm/PriorityBadge";
import { listLeads } from "@/lib/crm/queries";
import { getSettings } from "@/lib/crm/queries";
import { staleLeads } from "@/lib/crm/metrics";
import { daysAgoLabel, daysSince, shortDate, warsawDateOf, warsawToday } from "@/lib/crm/dates";
import {
  ALL_STATUSES,
  FUNNEL_ORDER,
  OPEN_STATUSES,
  PRIORITIES,
  PRIORITY_LABELS,
  SOURCES,
  SOURCE_LABELS,
  STATUS_LABELS,
} from "@/lib/crm/constants";
import type { CrmLead } from "@/lib/crm/types";

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Lista prowadzących = allowlista STAFF_EMAILS, patrz leady/nowy/page.tsx. */
function owners(): string[] {
  const raw = process.env.STAFF_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Cyfry z telefonu — do porównania "512345678" vs "+48 512 345 678". */
function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

function shortEmail(email: string | null): string {
  if (!email) return "—";
  return email.split("@")[0];
}

function buildHref(base: string, params: SearchParams, overrides: Record<string, string | undefined>) {
  const usp = new URLSearchParams();
  const merged: SearchParams = { ...params, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    const v = first(value);
    if (v) usp.set(key, v);
  }
  const qs = usp.toString();
  return qs ? `${base}?${qs}` : base;
}

export default async function LeadyPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const etap = first(sp.etap);
  const priorytet = first(sp.priorytet);
  const zrodlo = first(sp.zrodlo);
  const miasto = first(sp.miasto)?.trim().toLowerCase();
  const kategoria = first(sp.kategoria)?.trim().toLowerCase();
  const prowadzacy = first(sp.prowadzacy);
  const bezKroku = first(sp.bez_kroku) === "1";
  const stygnace = first(sp.stygnace) === "1";
  const q = first(sp.q)?.trim().toLowerCase();
  const widok = first(sp.widok) === "kanban" ? "kanban" : "lista";

  const [allLeads, settings] = await Promise.all([listLeads(), getSettings()]);

  // Zbiór id stygnących leadów liczony na PEŁNEJ liście — staleLeads sam
  // ocenia każdy lead niezależnie (status, next_action_at, ostatnia aktywność),
  // więc policzenie go przed resztą filtrów albo po nich daje ten sam wynik.
  const staleIds = new Set(staleLeads(allLeads, settings.stale_after_days).map((l) => l.id));

  const qDigits = q ? digitsOnly(q) : "";

  const leads = allLeads.filter((l) => {
    if (etap && l.status !== etap) return false;
    if (priorytet && l.priority !== priorytet) return false;
    if (zrodlo && l.source !== zrodlo) return false;
    if (miasto && !(l.city ?? "").toLowerCase().includes(miasto)) return false;
    if (kategoria && !(l.category ?? "").toLowerCase().includes(kategoria)) return false;
    if (prowadzacy && (l.owner ?? "").toLowerCase() !== prowadzacy) return false;
    if (bezKroku && !(OPEN_STATUSES.includes(l.status) && !l.next_action_at)) return false;
    if (stygnace && !staleIds.has(l.id)) return false;
    if (q) {
      const nameHit = l.name.toLowerCase().includes(q);
      const igHit = (l.instagram ?? "").toLowerCase().includes(q);
      const wwwHit = (l.www ?? "").toLowerCase().includes(q);
      const phoneHit = qDigits.length > 0 && digitsOnly(l.phone ?? "").includes(qDigits);
      if (!nameHit && !igHit && !wwwHit && !phoneHit) return false;
    }
    return true;
  });

  const filtersActive =
    !!etap || !!priorytet || !!zrodlo || !!miasto || !!kategoria || !!prowadzacy || bezKroku || stygnace || !!q;

  const today = warsawToday();
  const staffOwners = owners();

  return (
    <>
      <Topbar
        title="Leady"
        actions={
          <Link
            href="/leady/nowy"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-accent px-4 text-[14px] font-medium text-white hover:bg-accent-hover"
          >
            + Nowy lead
          </Link>
        }
      >
        <form method="get" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
          <div>
            <Label htmlFor="q" className="sr-only">
              Szukaj
            </Label>
            <Input id="q" name="q" placeholder="Szukaj: nazwa, telefon, IG, www" defaultValue={q ?? ""} />
          </div>
          <div>
            <Label htmlFor="etap" className="sr-only">
              Etap
            </Label>
            <Select id="etap" name="etap" defaultValue={etap ?? ""}>
              <option value="">Wszystkie etapy</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="priorytet" className="sr-only">
              Priorytet
            </Label>
            <Select id="priorytet" name="priorytet" defaultValue={priorytet ?? ""}>
              <option value="">Wszystkie priorytety</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="zrodlo" className="sr-only">
              Źródło
            </Label>
            <Select id="zrodlo" name="zrodlo" defaultValue={zrodlo ?? ""}>
              <option value="">Wszystkie źródła</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="miasto" className="sr-only">
              Miasto
            </Label>
            <Input id="miasto" name="miasto" placeholder="Miasto" defaultValue={sp.miasto ? String(first(sp.miasto)) : ""} />
          </div>
          <div>
            <Label htmlFor="kategoria" className="sr-only">
              Kategoria
            </Label>
            <Input id="kategoria" name="kategoria" placeholder="Kategoria" defaultValue={first(sp.kategoria) ?? ""} />
          </div>
          <div>
            <Label htmlFor="prowadzacy" className="sr-only">
              Prowadzący
            </Label>
            <Select id="prowadzacy" name="prowadzacy" defaultValue={prowadzacy ?? ""}>
              <option value="">Wszyscy prowadzący</option>
              {staffOwners.map((o) => (
                <option key={o} value={o}>
                  {shortEmail(o)}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" name="bez_kroku" value="1" defaultChecked={bezKroku} className="h-4 w-4" />
            Bez następnego kroku
          </label>
          <label className="flex min-h-11 items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" name="stygnace" value="1" defaultChecked={stygnace} className="h-4 w-4" />
            Stygnące
          </label>
          {/* Zachowaj bieżący widok (lista/kanban) przy wysłaniu formularza filtrów. */}
          <input type="hidden" name="widok" value={widok} />
          <div className="flex items-center">
            <Button type="submit" variant="primary" size="sm">
              Filtruj
            </Button>
          </div>
        </form>
      </Topbar>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[13px] text-ink-2">
          <span>{leads.length} z {allLeads.length} leadów</span>
          {filtersActive ? (
            <Link href="/leady" className="font-medium text-accent hover:underline">
              Wyczyść filtry
            </Link>
          ) : null}
        </div>
        <div className="hidden items-center gap-1 rounded-lg border border-line bg-surface p-0.5 text-[13px] md:flex">
          <Link
            href={buildHref("/leady", sp, { widok: undefined })}
            className={`rounded-md px-3 py-1.5 font-medium ${
              widok === "lista" ? "bg-accent text-white" : "text-ink hover:bg-canvas"
            }`}
          >
            Lista
          </Link>
          <Link
            href={buildHref("/leady", sp, { widok: "kanban" })}
            className={`rounded-md px-3 py-1.5 font-medium ${
              widok === "kanban" ? "bg-accent text-white" : "text-ink hover:bg-canvas"
            }`}
          >
            Kanban
          </Link>
        </div>
      </div>

      {leads.length === 0 ? (
        <Card>
          <EmptyState
            title="Brak leadów spełniających filtry"
            hint="Zmień kryteria albo wyczyść filtry, żeby zobaczyć wszystkie leady."
          />
        </Card>
      ) : widok === "kanban" ? (
        <KanbanView leads={leads} today={today} />
      ) : (
        <>
          {/* Desktop: gęsta tabela. */}
          <div className="hidden md:block">
            <Table>
              <THead>
                <TH>Nazwa</TH>
                <TH>Priorytet</TH>
                <TH>Miasto</TH>
                <TH>Lokale</TH>
                <TH>Etap</TH>
                <TH>Prowadzący</TH>
                <TH>Ostatnia aktywność</TH>
                <TH>Następny krok</TH>
                <TH>Źródło</TH>
              </THead>
              <tbody>
                {leads.map((l) => (
                  <LeadRow key={l.id} lead={l} today={today} />
                ))}
              </tbody>
            </Table>
          </div>

          {/* Mobile: karty, bez przewijania w poziomie. */}
          <div className="space-y-2 md:hidden">
            {leads.map((l) => (
              <LeadCard key={l.id} lead={l} today={today} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function LeadRow({ lead, today }: { lead: CrmLead; today: string }) {
  const lastActivityDays = lead.last_activity_at ? daysSince(lead.last_activity_at) : null;
  const isStale = lead.last_activity_at
    ? lastActivityDays !== null && lastActivityDays >= 0
    : true;
  const overdue = lead.next_action_at ? warsawDateOf(lead.next_action_at) < today : false;

  return (
    <TR>
      <TD>
        <Link href={`/leady/${lead.id}`} className="font-medium text-accent hover:underline">
          {lead.name}
        </Link>
      </TD>
      <TD>
        <PriorityBadge priority={lead.priority} />
      </TD>
      <TD>{lead.city ?? "—"}</TD>
      <TD>{lead.locations_count}</TD>
      <TD>
        <StatusBadge status={lead.status} />
      </TD>
      <TD>{shortEmail(lead.owner)}</TD>
      <TD className={lastActivityDaysAmber(lead, isStale)}>
        {lead.last_activity_at ? daysAgoLabel(lastActivityDays ?? 0) : "brak"}
      </TD>
      <TD className={overdue ? "text-danger" : undefined}>
        {lead.next_action_at ? (
          <>
            {lead.next_action ? `${lead.next_action} — ` : ""}
            {shortDate(lead.next_action_at)}
          </>
        ) : (
          lead.next_action ?? "—"
        )}
      </TD>
      <TD>{SOURCE_LABELS[lead.source]}</TD>
    </TR>
  );
}

// Amber tylko gdy naprawdę stygnie (staleLeads liczy próg + status otwarty +
// brak przyszłego kroku) — sama obecność aktywności nie wystarcza, żeby to
// ocenić na poziomie wiersza, więc znacznik "isStale" liczymy w rodzicu.
function lastActivityDaysAmber(lead: CrmLead, isStale: boolean): string | undefined {
  return isStale && lead.last_activity_at ? "text-amber-700" : undefined;
}

function LeadCard({ lead, today }: { lead: CrmLead; today: string }) {
  const overdue = lead.next_action_at ? warsawDateOf(lead.next_action_at) < today : false;
  return (
    <Link href={`/leady/${lead.id}`}>
      <Card padding="sm" className="hover:bg-canvas">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px] font-medium text-ink">{lead.name}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            <PriorityBadge priority={lead.priority} />
            <StatusBadge status={lead.status} />
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-2">
          {lead.city ? <span>{lead.city}</span> : null}
          <span>{shortEmail(lead.owner)}</span>
          {lead.last_activity_at ? (
            <span>{daysAgoLabel(daysSince(lead.last_activity_at))}</span>
          ) : (
            <span>brak aktywności</span>
          )}
        </div>
        {lead.next_action || lead.next_action_at ? (
          <div className={`mt-1 text-[12px] ${overdue ? "text-danger" : "text-ink-2"}`}>
            {lead.next_action ? `${lead.next_action} ` : ""}
            {lead.next_action_at ? `— ${shortDate(lead.next_action_at)}` : ""}
          </div>
        ) : null}
      </Card>
    </Link>
  );
}

// Kanban: TYLKO podgląd, bez drag-and-drop — każda karta linkuje do leada.
// "Dni w etapie" liczymy z updated_at jako przybliżenie (nie ciągniemy tu
// listStageHistory, żeby lista zostawała jednym prostym zapytaniem) — dokładny
// czas w etapie liczy dopiero karta leada, jeśli będzie potrzebny.
function KanbanView({ leads, today }: { leads: CrmLead[]; today: string }) {
  const present = new Set(leads.map((l) => l.status));
  const columns = OPEN_STATUSES.filter((s) => present.has(s)).sort(
    (a, b) => FUNNEL_ORDER.indexOf(a) - FUNNEL_ORDER.indexOf(b),
  );
  const byStatus = new Map<string, CrmLead[]>();
  for (const l of leads) {
    if (!columns.includes(l.status)) continue;
    const arr = byStatus.get(l.status);
    if (arr) arr.push(l);
    else byStatus.set(l.status, [l]);
  }

  return (
    <div className="hidden gap-3 overflow-x-auto md:grid md:auto-cols-[220px] md:grid-flow-col">
      {columns.map((status) => (
        <div key={status} className="min-w-[220px]">
          <div className="mb-2 flex items-center justify-between text-[12px] font-medium text-ink-2">
            <span>{STATUS_LABELS[status]}</span>
            <span>{byStatus.get(status)?.length ?? 0}</span>
          </div>
          <div className="space-y-2">
            {(byStatus.get(status) ?? []).map((l) => (
              <Link key={l.id} href={`/leady/${l.id}`}>
                <Card padding="sm" className="hover:bg-canvas">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-ink">{l.name}</span>
                    <PriorityBadge priority={l.priority} />
                  </div>
                  <div className="mt-1 text-[11px] text-ink-2">
                    {Math.max(daysSince(l.updated_at, new Date()), 0)} dni w etapie
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
