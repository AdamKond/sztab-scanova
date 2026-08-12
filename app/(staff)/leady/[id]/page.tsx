// Karta leada — jeden ekran do pracy: header + ICP + aktywności + historia +
// notatki po lewej, etap/następny krok/pilot/zadania/źródło po prawej.

import { notFound } from "next/navigation";
import Link from "next/link";
import Topbar from "@/components/shell/Topbar";
import Card from "@/components/ui/Card";
import { Label, Input, Select, Textarea } from "@/components/ui/Field";
import StatusBadge from "@/components/crm/StatusBadge";
import PriorityBadge from "@/components/crm/PriorityBadge";
import StageSelect from "@/components/crm/StageSelect";
import ActionForm, { SubmitButton } from "@/components/crm/ActionForm";
import { getLead, listActivities, listStageHistory, listTasksForLead } from "@/lib/crm/queries";
import { addActivity, createTask, setNextAction, toggleTask, updateLeadNotes } from "@/lib/crm/actions";
import {
  ACTIVITY_LABELS,
  ACTIVITY_TYPES,
  CURRENT_LOYALTY_LABELS,
  OUTCOMES,
  OUTCOME_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
} from "@/lib/crm/constants";
import { daysBetween, fullDate, shortDate, shortDateTime, warsawDateOf, warsawToday } from "@/lib/crm/dates";
import type { ActivityType } from "@/lib/crm/types";

/** ISO (UTC) -> wartość dla <input type="datetime-local"> w czasie Warszawy. */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

function shortEmail(email: string | null): string {
  return email ? email.split("@")[0] : "—";
}

// Kolor kropki timeline per grupa typu aktywności — kontakt (niebieski),
// spotkanie/demo (fiolet), etap sprzedaży (bursztyn), notatka (szary) —
// żeby oko szybko wyłapało wzorzec w długiej liście.
const ACTIVITY_DOT: Record<ActivityType, string> = {
  wizyta: "bg-blue-500",
  ig_dm: "bg-blue-500",
  ig_followup: "bg-blue-500",
  telefon: "bg-blue-500",
  email: "bg-blue-500",
  whatsapp: "bg-blue-500",
  demo: "bg-violet-500",
  spotkanie: "bg-violet-500",
  oferta: "bg-amber-500",
  pilot_checkin: "bg-amber-500",
  notatka: "bg-slate-400",
};

const SECONDARY_LINK_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-4 text-[14px] font-medium text-ink hover:bg-canvas";

function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={SECONDARY_LINK_CLASS}
    >
      {children}
    </a>
  );
}

// toggleTask zwraca ActionResult, ale natywne <form action> na checkboxie
// zadania wymaga void|Promise<void> — cienki server action-owy wrapper,
// żeby nie musieć wciągać tu całego ActionForm dla jednego przełącznika.
async function toggleTaskAction(taskId: string): Promise<void> {
  "use server";
  await toggleTask(taskId);
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-2">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  const [activities, history, tasks] = await Promise.all([
    listActivities(id),
    listStageHistory(id),
    listTasksForLead(id),
  ]);

  const openTasks = tasks.filter((t) => t.status === "otwarte");
  const today = warsawToday();
  const pilotDaysLeft = lead.pilot_ends_at ? daysBetween(today, warsawDateOf(lead.pilot_ends_at)) : null;

  return (
    <>
      <Topbar
        title={lead.name}
        actions={
          <Link href={`/leady/${lead.id}/edytuj`} className={SECONDARY_LINK_CLASS}>
            Edytuj leada
          </Link>
        }
      />

      <div className="anim-in grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[18px] font-semibold text-ink">{lead.name}</h2>
              <StatusBadge status={lead.status} />
              <PriorityBadge priority={lead.priority} />
            </div>
            <div className="mt-1 text-[13px] text-ink-2">
              {[lead.category, [lead.city, lead.district].filter(Boolean).join(", ")]
                .filter(Boolean)
                .join(" · ") || "Brak danych adresowych"}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {lead.phone ? <LinkButton href={`tel:${lead.phone}`}>Zadzwoń</LinkButton> : null}
              {lead.instagram ? (
                <LinkButton href={`https://instagram.com/${lead.instagram}`}>Instagram</LinkButton>
              ) : null}
              {lead.www ? <LinkButton href={lead.www}>WWW</LinkButton> : null}
              {lead.email ? <LinkButton href={`mailto:${lead.email}`}>E-mail</LinkButton> : null}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-[15px] font-semibold text-ink">Kwalifikacja ICP</h2>
            <dl className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
              <Item label="Lokale" value={String(lead.locations_count)} />
              <Item
                label="Transakcje/dzień"
                value={lead.estimated_daily_transactions != null ? String(lead.estimated_daily_transactions) : "brak danych"}
              />
              <Item
                label="Program lojalnościowy"
                value={lead.current_loyalty ? CURRENT_LOYALTY_LABELS[lead.current_loyalty] : "brak danych"}
              />
              <Item
                label="Decydent"
                value={
                  lead.decision_maker_name
                    ? `${lead.decision_maker_name}${lead.decision_maker_role ? ` (${lead.decision_maker_role})` : ""}`
                    : "brak danych"
                }
              />
              <Item label="Ocena Google" value={lead.google_rating != null ? String(lead.google_rating) : "brak"} />
            </dl>
            {lead.qualification_note ? (
              <p className="mt-3 whitespace-pre-wrap text-[13px] text-ink">{lead.qualification_note}</p>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-3 text-[15px] font-semibold text-ink">Aktywności</h2>
            <ActionForm
              action={addActivity}
              resetOnSuccess
              className="mb-4 space-y-3 rounded-lg border border-line p-3"
            >
              <input type="hidden" name="lead_id" value={lead.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="type">Typ</Label>
                  <Select id="type" name="type" defaultValue="telefon">
                    {ACTIVITY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {ACTIVITY_LABELS[t]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="outcome">Wynik</Label>
                  <Select id="outcome" name="outcome" defaultValue="">
                    <option value="">— brak —</option>
                    {OUTCOMES.map((o) => (
                      <option key={o} value={o}>
                        {OUTCOME_LABELS[o]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="note">Notatka</Label>
                <Textarea id="note" name="note" />
              </div>
              <div>
                <Label htmlFor="happened_at">Kiedy (opcjonalnie)</Label>
                <Input id="happened_at" name="happened_at" type="datetime-local" />
              </div>
              <SubmitButton size="sm">Dodaj aktywność</SubmitButton>
            </ActionForm>

            {activities.length === 0 ? (
              <p className="text-[13px] text-ink-2">Brak zarejestrowanych aktywności.</p>
            ) : (
              <ul className="space-y-3">
                {activities.map((a) => (
                  <li key={a.id} className="flex gap-2.5">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ACTIVITY_DOT[a.type]}`} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                        <span className="font-medium text-ink">{ACTIVITY_LABELS[a.type]}</span>
                        {a.outcome ? <span className="text-ink-2">{OUTCOME_LABELS[a.outcome]}</span> : null}
                        <span className="text-ink-2">{shortDateTime(a.happened_at)}</span>
                        <span className="text-ink-2">· {shortEmail(a.created_by)}</span>
                      </div>
                      {a.note ? <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-ink">{a.note}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-[15px] font-semibold text-ink">Historia etapów</h2>
            {history.length === 0 ? (
              <p className="text-[13px] text-ink-2">Brak historii.</p>
            ) : (
              <ul className="space-y-2 text-[13px]">
                {history.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-ink">
                      {h.from_status ? STATUS_LABELS[h.from_status] : "—"} →{" "}
                      <span className="font-medium">{STATUS_LABELS[h.to_status]}</span>
                    </span>
                    <span className="text-ink-2">{shortDateTime(h.changed_at)}</span>
                    <span className="text-ink-2">· {shortEmail(h.changed_by)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-[15px] font-semibold text-ink">Notatki</h2>
            <ActionForm action={updateLeadNotes.bind(null, lead.id)} className="space-y-2">
              <Textarea name="notes" defaultValue={lead.notes ?? ""} />
              <SubmitButton size="sm">Zapisz notatki</SubmitButton>
            </ActionForm>
          </Card>
        </div>

        <div className="space-y-6">
          <StageSelect lead={lead} />

          <Card>
            <h2 className="mb-3 text-[15px] font-semibold text-ink">Następny krok</h2>
            <ActionForm action={setNextAction.bind(null, lead.id)} className="space-y-3">
              <div>
                <Label htmlFor="next_action">Następny krok</Label>
                <Input id="next_action" name="next_action" defaultValue={lead.next_action ?? ""} />
              </div>
              <div>
                <Label htmlFor="next_action_at">Termin</Label>
                <Input
                  id="next_action_at"
                  name="next_action_at"
                  type="datetime-local"
                  defaultValue={isoToLocalInput(lead.next_action_at)}
                />
              </div>
              <SubmitButton size="sm">Zapisz</SubmitButton>
            </ActionForm>
          </Card>

          <Card>
            <h2 className="mb-3 text-[15px] font-semibold text-ink">Pilot / Płatność</h2>
            <div className="space-y-3 text-[13px]">
              {lead.pilot_started_at || lead.pilot_ends_at ? (
                <div>
                  <div className="text-ink-2">Pilot</div>
                  <div className="text-ink">
                    {lead.pilot_started_at ? shortDate(lead.pilot_started_at) : "—"} –{" "}
                    {lead.pilot_ends_at ? shortDate(lead.pilot_ends_at) : "—"}
                    {pilotDaysLeft !== null ? (
                      <span className="ml-2 text-ink-2">
                        ({Math.abs(pilotDaysLeft)} dni {pilotDaysLeft >= 0 ? "do końca" : "po terminie"})
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {lead.paid_at ? (
                <div>
                  <div className="text-ink-2">Płatność</div>
                  <div className="text-ink">
                    {shortDate(lead.paid_at)} · {lead.plan ?? "—"} ·{" "}
                    {lead.monthly_revenue != null ? `${lead.monthly_revenue} zł/mies.` : "—"}
                  </div>
                </div>
              ) : null}
              {lead.churned_at || lead.lost_reason ? (
                <div>
                  <div className="text-ink-2">Utrata / churn</div>
                  <div className="text-ink">
                    {lead.churned_at ? `${shortDate(lead.churned_at)} — ` : ""}
                    {lead.lost_reason ?? ""}
                  </div>
                </div>
              ) : null}
              {lead.disqualification_reason ? (
                <div>
                  <div className="text-ink-2">Dyskwalifikacja</div>
                  <div className="text-ink">{lead.disqualification_reason}</div>
                </div>
              ) : null}
              {!lead.pilot_started_at &&
              !lead.pilot_ends_at &&
              !lead.paid_at &&
              !lead.churned_at &&
              !lead.disqualification_reason ? (
                <p className="text-ink-2">Brak danych pilota/płatności.</p>
              ) : null}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-[15px] font-semibold text-ink">Zadania</h2>
            {openTasks.length === 0 ? (
              <p className="mb-3 text-[13px] text-ink-2">Brak otwartych zadań.</p>
            ) : (
              <ul className="mb-3 space-y-1.5">
                {openTasks.map((t) => (
                  <li key={t.id}>
                    <form action={toggleTaskAction.bind(null, t.id)}>
                      <button
                        type="submit"
                        className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-line px-3 text-left text-[13px] hover:bg-canvas"
                      >
                        <span aria-hidden className="h-4 w-4 shrink-0 rounded border border-line" />
                        <span className="text-ink">{t.title}</span>
                        {t.due_at ? (
                          <span className="ml-auto shrink-0 text-[11px] text-ink-2">{shortDate(t.due_at)}</span>
                        ) : null}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={createTask} resetOnSuccess className="space-y-2 border-t border-line pt-3">
              <input type="hidden" name="lead_id" value={lead.id} />
              <div>
                <Label htmlFor="title">Nowe zadanie</Label>
                <Input id="title" name="title" required />
              </div>
              <div>
                <Label htmlFor="due_at">Termin</Label>
                <Input id="due_at" name="due_at" type="datetime-local" />
              </div>
              <SubmitButton size="sm">Dodaj zadanie</SubmitButton>
            </ActionForm>
          </Card>

          <Card>
            <h2 className="mb-3 text-[15px] font-semibold text-ink">Źródło</h2>
            <div className="space-y-1 text-[13px]">
              <div className="text-ink">{SOURCE_LABELS[lead.source]}</div>
              {lead.source_detail ? <div className="text-ink-2">{lead.source_detail}</div> : null}
              {lead.campaign ? <div className="text-ink-2">Kampania: {lead.campaign}</div> : null}
              <div className="text-ink-2">Utworzono: {fullDate(lead.created_at)}</div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
