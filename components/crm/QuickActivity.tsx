"use client";

// Panel "Szybki wpis" — cel: zalogować aktywność w mniej niż 10 sekund.
// Typ aktywności to duże przyciski (najczęstsze na wierzchu), reszta pól
// jest opcjonalna, żeby nie blokować zapisu szczegółami, których w biegu
// i tak nikt nie uzupełni.

import { useEffect, useMemo, useRef, useState } from "react";
import ActionForm, { SubmitButton } from "@/components/crm/ActionForm";
import StatusBadge from "@/components/crm/StatusBadge";
import Button from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";
import { ACTIVITY_LABELS, OUTCOMES, OUTCOME_LABELS } from "@/lib/crm/constants";
import { addActivity } from "@/lib/crm/actions";
import type { ActivityType, LeadStatus } from "@/lib/crm/types";

// Najczęściej używane typy jako osobne przyciski — reszta chowa się w select,
// żeby rząd przycisków mieścił się na ekranie telefonu.
const QUICK_TYPES: ActivityType[] = ["wizyta", "ig_dm", "telefon", "demo"];
const REST_TYPES: ActivityType[] = (Object.keys(ACTIVITY_LABELS) as ActivityType[]).filter(
  (t) => !QUICK_TYPES.includes(t),
);

interface QuickLead {
  id: string;
  name: string;
  status: LeadStatus;
}

export default function QuickActivity({ leads }: { leads: QuickLead[] }) {
  // Domyślnie "wizyta" — najczęstszy typ w terenie, więc trafienie w Zapisz
  // bez dotykania niczego innego już jest poprawnym wpisem.
  const [type, setType] = useState<ActivityType>("wizyta");
  const [leadQuery, setLeadQuery] = useState("");
  const [leadId, setLeadId] = useState("");

  const leadByName = useMemo(() => {
    const m = new Map<string, QuickLead>();
    for (const l of leads) m.set(l.name, l);
    return m;
  }, [leads]);
  const matchedLead = leadByName.get(leadQuery) ?? null;

  const rootRef = useRef<HTMLDivElement>(null);

  // ActionForm po sukcesie robi natywny form.reset() — to czyści pola
  // niekontrolowane, ale NIE odpala onChange dla stanu Reacta (type,
  // leadQuery, leadId). Nasłuchujemy zdarzenia "reset" bezpośrednio na
  // elemencie <form> (fazę "at target" dostają też zwykłe listenery), żeby
  // zsynchronizować stan kontrolowany po udanym zapisie.
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const onFormReset = () => {
      setType("wizyta");
      setLeadQuery("");
      setLeadId("");
    };
    form.addEventListener("reset", onFormReset);
    return () => form.removeEventListener("reset", onFormReset);
  }, []);

  return (
    <div ref={rootRef}>
      <ActionForm action={addActivity} resetOnSuccess onSuccessMessage="Zapisano." className="space-y-3">
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="lead_id" value={leadId} />

        <div>
          <Label>Typ aktywności</Label>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TYPES.map((t) => (
              <Button
                key={t}
                type="button"
                size="md"
                variant={type === t ? "primary" : "secondary"}
                onClick={() => setType(t)}
              >
                {ACTIVITY_LABELS[t]}
              </Button>
            ))}
            <Select
              className="w-auto flex-1 min-w-[9rem]"
              value={REST_TYPES.includes(type) ? type : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v) setType(v as ActivityType);
              }}
              aria-label="Inny typ aktywności"
            >
              <option value="" disabled={REST_TYPES.includes(type)}>
                Inny typ…
              </option>
              {REST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACTIVITY_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="qa-outcome">Wynik</Label>
            <Select id="qa-outcome" name="outcome" defaultValue="">
              <option value="">— brak —</option>
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {OUTCOME_LABELS[o]}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="qa-lead">Lead</Label>
            <Input
              id="qa-lead"
              list="qa-lead-options"
              placeholder="— bez leada —"
              autoComplete="off"
              value={leadQuery}
              onChange={(e) => {
                const v = e.target.value;
                setLeadQuery(v);
                setLeadId(leadByName.get(v)?.id ?? "");
              }}
            />
            <datalist id="qa-lead-options">
              {leads.map((l) => (
                <option key={l.id} value={l.name} />
              ))}
            </datalist>
            {matchedLead ? (
              <div className="mt-1.5">
                <StatusBadge status={matchedLead.status} />
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <Label htmlFor="qa-note">Notatka</Label>
          <Textarea id="qa-note" name="note" rows={2} placeholder="Krótko, co się wydarzyło…" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="qa-next-action">Następny krok</Label>
            <Input id="qa-next-action" name="next_action" placeholder="np. zadzwonić ponownie" />
          </div>
          <div>
            <Label htmlFor="qa-next-action-at">Termin</Label>
            <Input id="qa-next-action-at" name="next_action_at" type="datetime-local" />
          </div>
        </div>

        <SubmitButton>Zapisz</SubmitButton>
      </ActionForm>
    </div>
  );
}
