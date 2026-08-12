import Link from "next/link";
import Topbar from "@/components/shell/Topbar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { Input, Label, Select } from "@/components/ui/Field";
import ActionForm, { SubmitButton } from "@/components/crm/ActionForm";
import { staffEmails } from "@/lib/auth";
import { listLeads, listTasks } from "@/lib/crm/queries";
import { createTask, toggleTask, updateTask } from "@/lib/crm/actions";
import { followupBuckets } from "@/lib/crm/metrics";
import { OPEN_STATUSES, TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/crm/constants";
import { daysBetween, shortDate, warsawDateOf, warsawToday } from "@/lib/crm/dates";
import type { CrmTask, TaskPriority } from "@/lib/crm/types";

// Ton priorytetu zadania — osobna paleta niż PriorityBadge leada (tam A-D,
// tu niski/normalny/wysoki), więc mapujemy lokalnie zamiast dokładać wariant
// do współdzielonego komponentu.
const TASK_PRIORITY_TONES: Record<TaskPriority, "amber" | "neutral" | "slate"> = {
  wysoki: "amber",
  normalny: "neutral",
  niski: "slate",
};

/** Lokalna część adresu (przed @) — gęstszy widok list zadań. */
function shortEmail(email: string | null): string {
  if (!email) return "—";
  return email.split("@")[0];
}

export default async function FollowupPage() {
  const [tasks, leads] = await Promise.all([listTasks(), listLeads()]);
  const owners = staffEmails();
  const today = warsawToday();

  const leadNameById = new Map(leads.map((l) => [l.id, l.name]));
  const openLeadsSorted = leads
    .filter((l) => OPEN_STATUSES.includes(l.status))
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));

  const openTasks = tasks.filter((t) => t.status === "otwarte");
  const overdue = openTasks
    .filter((t) => t.due_at && warsawDateOf(t.due_at) < today)
    .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
  const dueToday = openTasks
    .filter((t) => t.due_at && warsawDateOf(t.due_at) === today)
    .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
  const next7 = openTasks
    .filter((t) => {
      if (!t.due_at) return false;
      const day = warsawDateOf(t.due_at);
      return day > today && daysBetween(today, day) <= 7;
    })
    .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
  const noDue = openTasks
    .filter((t) => !t.due_at)
    .sort((a, b) => a.title.localeCompare(b.title, "pl"));

  const done = tasks
    .filter((t) => t.status === "zrobione")
    .sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""))
    .slice(0, 20);

  const { overdue: leadsOverdue, today: leadsToday } = followupBuckets(leads);

  function TaskRow({ task, muted = false }: { task: CrmTask; muted?: boolean }) {
    const leadName = task.lead_id ? leadNameById.get(task.lead_id) : null;
    const isOverdue = task.due_at ? warsawDateOf(task.due_at) < today : false;
    const isDone = task.status === "zrobione";
    return (
      <div className={`rounded-lg border border-line ${muted ? "bg-canvas" : "bg-surface"}`}>
        <div className="flex items-center gap-3 px-3 py-2.5">
          <form
            action={async () => {
              // Goły <form action> oczekuje void — opakowujemy akcję zwracającą ActionResult.
              "use server";
              await toggleTask(task.id);
            }}
          >
            <button
              type="submit"
              aria-label={isDone ? "Cofnij ukończenie zadania" : "Oznacz jako zrobione"}
              title={isDone ? "Cofnij ukończenie" : "Oznacz jako zrobione"}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
                isDone
                  ? "border-success/30 bg-green-50 text-success"
                  : "border-line bg-surface text-ink-2 hover:bg-canvas"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l4.5 4.5L19 7" />
              </svg>
            </button>
          </form>

          <div className="min-w-0 flex-1">
            <div className={`truncate text-[14px] font-medium ${muted ? "text-ink-2" : "text-ink"}`}>
              {task.title}
              {leadName ? (
                <Link href={`/leady/${task.lead_id}`} className="ml-1.5 font-normal text-accent hover:underline">
                  → {leadName}
                </Link>
              ) : null}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2">
              {task.due_at ? (
                <span className={isOverdue ? "font-medium text-danger" : ""}>
                  {shortDate(task.due_at)}
                  {isOverdue ? " — po terminie" : ""}
                </span>
              ) : (
                <span>Bez terminu</span>
              )}
              <Badge tone={TASK_PRIORITY_TONES[task.priority]}>{TASK_PRIORITY_LABELS[task.priority]}</Badge>
              <span title={task.assigned_to ?? undefined}>{shortEmail(task.assigned_to)}</span>
            </div>
          </div>

          <details className="shrink-0">
            <summary className="cursor-pointer list-none rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink hover:bg-canvas">
              Edytuj
            </summary>
            <div className="mt-2 w-[280px] max-w-[80vw]">
              <ActionForm action={updateTask.bind(null, task.id)} className="space-y-2.5">
                <div>
                  <Label htmlFor={`title-${task.id}`}>Treść</Label>
                  <Input id={`title-${task.id}`} name="title" defaultValue={task.title} required maxLength={240} />
                </div>
                <div>
                  <Label htmlFor={`due-${task.id}`}>Termin</Label>
                  <Input
                    id={`due-${task.id}`}
                    name="due_at"
                    type="datetime-local"
                    defaultValue={toDatetimeLocalValue(task.due_at)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor={`priority-${task.id}`}>Priorytet</Label>
                    <Select id={`priority-${task.id}`} name="priority" defaultValue={task.priority}>
                      {TASK_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {TASK_PRIORITY_LABELS[p]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`status-${task.id}`}>Status</Label>
                    <Select id={`status-${task.id}`} name="status" defaultValue={task.status}>
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {TASK_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor={`assigned-${task.id}`}>Przypisane do</Label>
                  <Select id={`assigned-${task.id}`} name="assigned_to" defaultValue={task.assigned_to ?? ""}>
                    <option value="">— nieprzypisane —</option>
                    {owners.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </div>
                <SubmitButton size="sm">Zapisz</SubmitButton>
              </ActionForm>
            </div>
          </details>
        </div>
      </div>
    );
  }

  function Section({
    title,
    tasksList,
    countTone,
  }: {
    title: string;
    tasksList: CrmTask[];
    countTone?: "red";
  }) {
    return (
      <div>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
          <Badge tone={countTone === "red" && tasksList.length > 0 ? "red" : "neutral"}>
            {tasksList.length}
          </Badge>
        </div>
        {tasksList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[13px] text-ink-2">
            Brak zadań
          </div>
        ) : (
          <div className="space-y-2">
            {tasksList.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Topbar title="Follow-up" />

      <div className="space-y-5">
        {/* Pasek przypomnień follow-upów leadów — celowo jedna linia z linkiem,
            żeby nie duplikować widoku Dziś (tam jest pełna lista). */}
        <Card padding="sm" className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="font-medium text-ink">Follow-upy leadów:</span>
          <span className={leadsOverdue.length > 0 ? "font-medium text-danger" : "text-ink-2"}>
            {leadsOverdue.length} zaległych
          </span>
          <span className="text-ink-2">·</span>
          <span className="text-ink-2">{leadsToday.length} dziś</span>
          <Link href="/" className="ml-auto font-medium text-accent hover:underline">
            Zobacz szczegóły w Dziś →
          </Link>
        </Card>

        <Card>
          <h2 className="mb-3 text-[14px] font-semibold text-ink">+ Nowe zadanie</h2>
          <ActionForm action={createTask} resetOnSuccess className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="new-title">Treść zadania *</Label>
              <Input id="new-title" name="title" required maxLength={240} placeholder="np. Zadzwonić w sprawie oferty" />
            </div>
            <div>
              <Label htmlFor="new-lead">Lead (opcjonalnie)</Label>
              <Select id="new-lead" name="lead_id" defaultValue="">
                <option value="">— brak —</option>
                {openLeadsSorted.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="new-due">Termin</Label>
              <Input id="new-due" name="due_at" type="datetime-local" />
            </div>
            <div>
              <Label htmlFor="new-priority">Priorytet</Label>
              <Select id="new-priority" name="priority" defaultValue="normalny">
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {TASK_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="new-assigned">Przypisane do</Label>
              <Select id="new-assigned" name="assigned_to" defaultValue="">
                <option value="">— ja —</option>
                {owners.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-2">
              <SubmitButton>Dodaj zadanie</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        {openTasks.length === 0 && done.length === 0 ? (
          <Card>
            <EmptyState title="Brak zadań" hint="Dodaj pierwsze zadanie powyżej." />
          </Card>
        ) : (
          <>
            <Section title="Zaległe" tasksList={overdue} countTone="red" />
            <Section title="Dzisiaj" tasksList={dueToday} />
            <Section title="Najbliższe 7 dni" tasksList={next7} />
            <Section title="Bez terminu" tasksList={noDue} />

            <details className="rounded-lg border border-line bg-surface p-3">
              <summary className="cursor-pointer text-[14px] font-semibold text-ink">
                Zrobione ({done.length})
              </summary>
              <div className="mt-3 space-y-2">
                {done.length === 0 ? (
                  <div className="px-3 py-4 text-center text-[13px] text-ink-2">Brak zrobionych zadań</div>
                ) : (
                  done.map((t) => <TaskRow key={t.id} task={t} muted />)
                )}
              </div>
            </details>
          </>
        )}
      </div>
    </>
  );
}

/** ISO -> wartość dla <input type="datetime-local"> w czasie Europe/Warsaw. */
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const day = warsawDateOf(iso);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${day}T${time}`;
}
