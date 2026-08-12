import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Input, Label, Select } from "@/components/ui/Field";
import Topbar from "@/components/shell/Topbar";
import ActionForm, { SubmitButton } from "@/components/crm/ActionForm";
import { staffEmails } from "@/lib/auth";
import { listActivities, listGoals, listLeads, listStageHistory } from "@/lib/crm/queries";
import { deleteGoal, saveGoal, toggleGoalActive } from "@/lib/crm/actions";
import { goalProgress } from "@/lib/crm/metrics";
import { GOAL_METRICS, GOAL_METRIC_LABELS } from "@/lib/crm/constants";
import { daysBetween, fullDate, warsawToday } from "@/lib/crm/dates";
import type { SalesGoal } from "@/lib/crm/types";

const plnFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("pl-PL");

function formatMetricValue(goal: SalesGoal, value: number): string {
  return goal.metric === "mrr" ? plnFormatter.format(value) : numberFormatter.format(value);
}

export default async function CelePage() {
  const [goals, leads, activities, history] = await Promise.all([
    listGoals(),
    listLeads(),
    listActivities(),
    listStageHistory(),
  ]);
  const owners = staffEmails();
  const today = warsawToday();

  const active = goals.filter((g) => g.active && today <= g.ends_on);
  const historyGoals = goals.filter((g) => !g.active || today > g.ends_on);

  function GoalCard({ goal, muted = false }: { goal: SalesGoal; muted?: boolean }) {
    const { actual, progress } = goalProgress(goal, { leads, activities, history });
    const pct = progress === null ? 0 : Math.max(0, progress * 100);
    const barWidth = Math.min(100, pct);
    const isComplete = progress !== null && progress >= 1;
    const daysLeft = daysBetween(today, goal.ends_on);

    return (
      <Card className={muted ? "bg-canvas" : undefined}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={`truncate text-[15px] font-semibold ${muted ? "text-ink-2" : "text-ink"}`}>
              {goal.name}
            </div>
            <div className="mt-0.5 text-[12px] text-ink-2">
              {GOAL_METRIC_LABELS[goal.metric]} · {fullDate(goal.starts_on)}–{fullDate(goal.ends_on)} ·{" "}
              {goal.owner ?? "wspólny"}
            </div>
          </div>
          {!goal.active ? <Badge tone="slate">Nieaktywny</Badge> : null}
        </div>

        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-canvas">
            <div
              className={`h-full rounded-full ${isComplete ? "bg-success" : "bg-accent"}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[13px]">
            <span className="tabular font-medium text-ink">
              {formatMetricValue(goal, actual)} / {formatMetricValue(goal, Number(goal.target_value))}
            </span>
            {muted ? null : (
              <span className="text-ink-2">
                {daysLeft >= 0 ? `${daysLeft} dni do końca` : "zakończony"}
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <details>
            <summary className="cursor-pointer list-none rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink hover:bg-canvas">
              Edytuj
            </summary>
            <div className="mt-2 w-[300px] max-w-[85vw]">
              <ActionForm action={saveGoal} className="space-y-2.5">
                <input type="hidden" name="goal_id" value={goal.id} />
                <div>
                  <Label htmlFor={`name-${goal.id}`}>Nazwa</Label>
                  <Input id={`name-${goal.id}`} name="name" defaultValue={goal.name} required maxLength={240} />
                </div>
                <div>
                  <Label htmlFor={`metric-${goal.id}`}>Metryka</Label>
                  <Select id={`metric-${goal.id}`} name="metric" defaultValue={goal.metric}>
                    {GOAL_METRICS.map((m) => (
                      <option key={m} value={m}>
                        {GOAL_METRIC_LABELS[m]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor={`target-${goal.id}`}>Wartość celu</Label>
                  <Input
                    id={`target-${goal.id}`}
                    name="target_value"
                    type="number"
                    min="0"
                    step="any"
                    defaultValue={goal.target_value}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor={`start-${goal.id}`}>Początek</Label>
                    <Input id={`start-${goal.id}`} name="starts_on" type="date" defaultValue={goal.starts_on} required />
                  </div>
                  <div>
                    <Label htmlFor={`end-${goal.id}`}>Koniec</Label>
                    <Input id={`end-${goal.id}`} name="ends_on" type="date" defaultValue={goal.ends_on} required />
                  </div>
                </div>
                <div>
                  <Label htmlFor={`owner-${goal.id}`}>Właściciel</Label>
                  <Select id={`owner-${goal.id}`} name="owner" defaultValue={goal.owner ?? ""}>
                    <option value="">wspólny</option>
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

          <form
            action={async () => {
              // Goły <form action> oczekuje void — opakowujemy akcję zwracającą ActionResult.
              "use server";
              await toggleGoalActive(goal.id);
            }}
          >
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-line bg-surface px-3 text-[12px] font-medium text-ink hover:bg-canvas md:min-h-0 md:py-1.5"
            >
              {goal.active ? "Dezaktywuj" : "Aktywuj"}
            </button>
          </form>

          <ConfirmDialog
            title="Usunąć cel?"
            description={`Cel „${goal.name}” zostanie trwale usunięty. Tej operacji nie da się cofnąć.`}
            confirmLabel="Usuń"
            action={async () => {
              "use server";
              await deleteGoal(goal.id);
            }}
          >
            Usuń
          </ConfirmDialog>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Topbar title="Cele" />

      <div className="anim-in space-y-6">
        <p className="text-[13px] text-ink-2">
          Cele są edytowalne — żadnych zakodowanych „6 wizyt dziennie”. Główne KPI to przejścia lejka,
          płatni klienci i MRR; aktywności to wskaźnik wykonania.
        </p>

        <Card>
          <h2 className="mb-3 text-[14px] font-semibold text-ink">Nowy cel</h2>
          <ActionForm action={saveGoal} resetOnSuccess className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="new-name">Nazwa *</Label>
              <Input id="new-name" name="name" required maxLength={240} placeholder="np. Q3 — nowi płatni klienci" />
            </div>
            <div>
              <Label htmlFor="new-metric">Metryka</Label>
              <Select id="new-metric" name="metric" defaultValue="platni_klienci">
                {GOAL_METRICS.map((m) => (
                  <option key={m} value={m}>
                    {GOAL_METRIC_LABELS[m]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="new-target">Wartość celu *</Label>
              <Input id="new-target" name="target_value" type="number" min="0" step="any" required />
            </div>
            <div>
              <Label htmlFor="new-start">Początek okresu *</Label>
              <Input id="new-start" name="starts_on" type="date" required />
            </div>
            <div>
              <Label htmlFor="new-end">Koniec okresu *</Label>
              <Input id="new-end" name="ends_on" type="date" required />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="new-owner">Właściciel</Label>
              <Select id="new-owner" name="owner" defaultValue="">
                <option value="">wspólny</option>
                {owners.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-2">
              <SubmitButton>Zapisz cel</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <div>
          <h2 className="mb-3 text-[14px] font-semibold text-ink">Aktywne cele</h2>
          {active.length === 0 ? (
            <Card>
              <EmptyState title="Brak aktywnych celów" hint="Dodaj cel powyżej." />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {active.map((g) => (
                <GoalCard key={g.id} goal={g} />
              ))}
            </div>
          )}
        </div>

        {historyGoals.length > 0 ? (
          <div>
            <h2 className="mb-3 text-[14px] font-semibold text-ink">Historia</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {historyGoals.map((g) => (
                <GoalCard key={g.id} goal={g} muted />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
