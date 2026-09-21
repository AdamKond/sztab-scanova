"use client";

// Pasek kroków rozmowy: gdzie jesteśmy, co dalej i jeden przycisk "Dalej".
// Pola wymagane przez krok (daty pilota, MRR, powód) pokazujemy dopiero
// po kliknięciu — serwer (advanceStep) i tak waliduje wszystko od nowa.

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Field";
import { advanceStep, type ActionResult } from "@/lib/crm/actions";
import { MAIN_STEPS, STEP_HINTS, STEP_LABELS, nextMainStep, stepOf, type Step } from "@/lib/crm/steps";
import { addDays, warsawToday } from "@/lib/crm/dates";
import type { CrmLead } from "@/lib/crm/types";

const NEEDS_FORM: Step[] = ["wizyta", "pilot", "klient", "pozniej", "nie", "rezygnacja"];

export default function StepBar({ lead }: { lead: CrmLead }) {
  const router = useRouter();
  const current = stepOf(lead.status);
  const currentIdx = MAIN_STEPS.indexOf(current);
  const next = nextMainStep(current);
  const prev = currentIdx > 0 ? MAIN_STEPS[currentIdx - 1] : null;
  const [target, setTarget] = useState<Step | null>(null);
  const [isPending, startTransition] = useTransition();
  const today = warsawToday();

  const [state, formAction] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const result = await advanceStep(lead.id, formData);
      if (result.ok) {
        setTarget(null);
        router.refresh();
      }
      return result;
    },
    null,
  );

  function go(step: Step) {
    if (NEEDS_FORM.includes(step)) {
      setTarget(step);
      return;
    }
    const fd = new FormData();
    fd.set("step", step);
    startTransition(() => formAction(fd));
  }

  const closed = current === "nie" || current === "rezygnacja";

  return (
    <div>
      {/* Pasek postępu */}
      <ol className="flex flex-wrap gap-1.5">
        {MAIN_STEPS.map((s, i) => {
          const done = currentIdx > i;
          const active = current === s;
          return (
            <li
              key={s}
              className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                active
                  ? "bg-accent text-white"
                  : done
                    ? "bg-accent-soft text-accent"
                    : "bg-canvas text-ink-3"
              }`}
            >
              {STEP_LABELS[s]}
            </li>
          );
        })}
        {currentIdx === -1 ? (
          <li className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${closed ? "bg-danger-soft text-danger" : "bg-canvas text-ink-2"}`}>
            {STEP_LABELS[current]}
          </li>
        ) : null}
      </ol>

      <p className="mt-3 text-[14px] text-ink">{STEP_HINTS[current]}</p>

      {target === null ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {next ? (
            <Button variant="primary" onClick={() => go(next)} disabled={isPending}>
              Dalej: {STEP_LABELS[next]}
            </Button>
          ) : null}
          {closed || current === "pozniej" ? (
            <Button variant="primary" onClick={() => go("rozmawia")} disabled={isPending}>
              Wznów rozmowę
            </Button>
          ) : null}
          {!closed && current !== "pozniej" && current !== "klient" ? (
            <Button variant="secondary" onClick={() => go("pozniej")} disabled={isPending}>
              Później
            </Button>
          ) : null}
          {current === "klient" || current === "pilot" ? (
            <Button variant="ghost" onClick={() => go("rezygnacja")} disabled={isPending}>
              Zrezygnował
            </Button>
          ) : !closed ? (
            <Button variant="ghost" onClick={() => go("nie")} disabled={isPending}>
              Nie
            </Button>
          ) : null}
          {prev ? (
            <Button variant="ghost" size="md" onClick={() => go(prev)} disabled={isPending} className="ml-auto">
              ← {STEP_LABELS[prev]}
            </Button>
          ) : null}
        </div>
      ) : (
        <form action={formAction} className="anim-in mt-4 space-y-3 rounded-xl bg-canvas p-4">
          <input type="hidden" name="step" value={target} />
          <div className="text-[14px] font-semibold text-ink">
            {target === "pozniej"
              ? "Kiedy wrócić do tematu?"
              : target === "nie"
                ? "Dlaczego nie?"
                : target === "rezygnacja"
                  ? "Dlaczego zrezygnował?"
                  : `Przejście: ${STEP_LABELS[target]}`}
          </div>

          {target === "wizyta" ? (
            <div>
              <Label htmlFor="next_action_at">Kiedy wizyta? (opcjonalnie)</Label>
              <Input id="next_action_at" name="next_action_at" type="datetime-local" />
            </div>
          ) : null}

          {target === "pilot" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pilot_started_at">Start pilota</Label>
                <Input id="pilot_started_at" name="pilot_started_at" type="date" defaultValue={today} />
              </div>
              <div>
                <Label htmlFor="pilot_ends_at">Koniec (miesiąc za darmo)</Label>
                <Input id="pilot_ends_at" name="pilot_ends_at" type="date" defaultValue={addDays(today, 30)} />
              </div>
            </div>
          ) : null}

          {target === "klient" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="paid_at">Płaci od</Label>
                <Input id="paid_at" name="paid_at" type="date" defaultValue={today} />
              </div>
              <div>
                <Label htmlFor="plan">Plan</Label>
                <Input id="plan" name="plan" placeholder="np. Standard" defaultValue={lead.plan ?? ""} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="monthly_revenue">Miesięcznie (zł)</Label>
                <Input id="monthly_revenue" name="monthly_revenue" inputMode="decimal" defaultValue={lead.monthly_revenue ?? ""} />
              </div>
            </div>
          ) : null}

          {target === "pozniej" ? (
            <div>
              <Label htmlFor="next_action_at">Data</Label>
              <Input id="next_action_at" name="next_action_at" type="date" required defaultValue={addDays(today, 30)} />
            </div>
          ) : null}

          {target === "nie" || target === "rezygnacja" ? (
            <div>
              <Label htmlFor="lost_reason">Powód</Label>
              <Textarea id="lost_reason" name="lost_reason" required rows={2} placeholder="Jedno zdanie — to wiedza na przyszłość" />
            </div>
          ) : null}

          {state?.error ? (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {state.error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button type="submit" variant="primary">
              Zatwierdź
            </Button>
            <Button type="button" variant="ghost" onClick={() => setTarget(null)}>
              Anuluj
            </Button>
          </div>
        </form>
      )}

      {target === null && state?.error ? (
        <p role="alert" className="mt-2 text-[13px] font-medium text-danger">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
